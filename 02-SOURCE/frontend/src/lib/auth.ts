// Authentication layer.
//
// IDENTITY CONTRACT — the single most important rule in this codebase:
//   session.user.id === EmployeeProfile.id (local accounts) OR
//   session.user.id === profiles.id === auth.users.id (real Supabase accounts)
// The previous build broke by mixing these two spaces up. They are kept
// deliberately distinct here too: a local demo account's id stays
// "EMP-NNNNN"-shaped and is looked up in store.ts; a real Supabase account's
// id is the auth.users UUID and is looked up in the `profiles` table. Never
// assume one id shape implies the other.
//
// PHASE 5 — hybrid, transitional design. Real employee accounts, once
// created through the provision-employee Edge Function (see that file for
// the full chain) or provisioned directly in Supabase Auth (e.g. the first
// HR account), authenticate through actual Supabase Auth: the Employee Code
// is resolved to that profile's real Supabase Auth login email via the
// `resolve_login_identity` RPC (never guessed or derived client-side — a
// real account is not guaranteed to use the synthetic
// `<code>@auth.internal` scheme the Edge Function assigns; see that
// migration's comment), then signed in via supabase.auth.signInWithPassword.
// The existing seeded demo accounts are not migrated yet (Phase 6) and have
// no Supabase Auth user at all, so they keep authenticating through the
// original localStorage credential store below, unchanged. signIn() tries
// Supabase first and falls back to the local store only when Supabase
// reports "no such account" — see signIn()'s own comment for why that
// ordering, and why falling back on an ambiguous error is safe.
//
// The employee record (local store, or the `profiles` table under RLS) is
// always the source of truth for role and status, so HR deactivating an
// account or changing a role takes effect on the very next sign-in — no
// separate mirror to drift out of sync, for either account type.

import { loadStore } from './store'
import type { UserRole } from './store'
import { supabase, isSupabaseConfigured } from './supabase'

export type { UserRole }

export interface SessionUser {
  id: string
  name: string
  role: UserRole
  employeeNumber: string
}

export interface Session {
  user: SessionUser
  expiresAt: number
}

export type AuthError = 'INVALID_CREDENTIALS' | 'INACTIVE_ACCOUNT' | 'SYSTEM_ERROR'

export type AuthResult =
  | { ok: true; session: Session }
  | { ok: false; error: AuthError }

const CREDENTIAL_KEY = 'hr_portal_credentials_v1'
const SESSION_KEY = 'hr_portal_session_v1'
const SESSION_TTL_MS = 8 * 60 * 60 * 1000

// Password shared by every seeded demo account. Deliberately not rendered
// anywhere in the UI (auth-flow-spec §9).
const DEMO_PASSWORD = 'Geo@123456'

interface CredentialRecord {
  employeeNumber: string
  salt: string
  hash: string
}

// ─── Password hashing (local demo accounts only) ──────────────────────────────
// Synchronous by necessity: the HR "create employee" path is a synchronous
// React event handler. This keeps plaintext out of storage, which is the
// point, but it is NOT a production KDF, and it is not used for real
// accounts at all — Supabase Auth (GoTrue) owns those passwords entirely,
// hashed server-side with bcrypt, never touching this code path or
// PostgreSQL (§6.4). This hashing exists solely to keep the pre-existing
// local demo accounts working during this transitional phase.

function hashPassword(password: string, salt: string): string {
  let h1 = 0x811c9dc5
  let h2 = 0x1000193
  const input = `${salt}::${password}::${salt}`

  for (let round = 0; round < 5000; round++) {
    for (let i = 0; i < input.length; i++) {
      const c = input.charCodeAt(i) ^ (round & 0xff)
      h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0
      h2 = Math.imul(h2 + c + round, 0x85ebca6b) >>> 0
      h1 = ((h1 << 13) | (h1 >>> 19)) >>> 0
      h2 = ((h2 << 7) | (h2 >>> 25)) >>> 0
    }
  }

  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0')
}

function makeSalt(): string {
  const bytes = new Uint8Array(12)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

// Constant-time-ish comparison so a timing signal does not leak the hash.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

// ─── Credential storage (local demo accounts only) ────────────────────────────

function makeCredential(employeeNumber: string, password: string): CredentialRecord {
  const salt = makeSalt()
  return { employeeNumber, salt, hash: hashPassword(password, salt) }
}

// Seeds credentials on first run, and tops up any seeded employee that has none
// yet — which is what happens when the roster gains a role (the technical
// manager and the GM) after credentials were already written.
function loadCredentials(): CredentialRecord[] {
  let records: CredentialRecord[] = []

  try {
    const raw = localStorage.getItem(CREDENTIAL_KEY)
    if (raw) records = JSON.parse(raw) as CredentialRecord[]
  } catch {
    records = []
  }

  const known = new Set(records.map((c) => c.employeeNumber))
  const missing = loadStore().employees.filter((e) => !known.has(e.id))

  if (missing.length > 0) {
    records = [...records, ...missing.map((e) => makeCredential(e.id, DEMO_PASSWORD))]
    saveCredentials(records)
  }

  return records
}

function saveCredentials(records: CredentialRecord[]): void {
  try {
    localStorage.setItem(CREDENTIAL_KEY, JSON.stringify(records))
  } catch {
    // storage unavailable — sign-in will fail closed, which is correct
  }
}

// ─── Session state ─────────────────────────────────────────────────────────────

let currentSession: Session | null = null
let restored = false
// Which path the live session came from, so signOut() and the Supabase
// auth-state listener only ever act on a session they are actually
// responsible for — a local demo session must never be torn down by a
// Supabase SIGNED_OUT event that has nothing to do with it, and vice versa.
let sessionSource: 'local' | 'supabase' | null = null
const authListeners = new Set<(session: Session | null) => void>()

function persistSession(session: Session | null): void {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    else localStorage.removeItem(SESSION_KEY)
  } catch {
    // non-fatal: the session simply will not survive a refresh
  }
}

function notify(session: Session | null): void {
  for (const listener of authListeners) listener(session)
}

// Rebuilds a LOCAL session from storage, re-reading role and status from the
// employee record so a revoked or demoted account cannot ride an old token.
// Synchronous and local-store-only by design — this is what lets
// AuthProvider render immediately for the common case (no reload delay) and
// keeps this function's existing behavior completely unchanged for demo
// accounts. Restoring a real Supabase session is a separate, async path —
// see restoreSupabaseSession() below.
function restoreSession(): Session | null {
  if (restored) return currentSession
  restored = true

  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null

    const stored = JSON.parse(raw) as Session
    if (!stored?.user?.id || typeof stored.expiresAt !== 'number') return null

    if (Date.now() >= stored.expiresAt) {
      persistSession(null)
      return null
    }

    const employee = loadStore().employees.find((e) => e.id === stored.user.id)
    if (!employee || employee.status !== 'ACTIVE') {
      persistSession(null)
      return null
    }

    currentSession = {
      user: {
        id: employee.id,
        name: employee.name,
        role: employee.role,
        employeeNumber: employee.id,
      },
      expiresAt: stored.expiresAt,
    }
    sessionSource = 'local'
    return currentSession
  } catch {
    return null
  }
}

/** Synchronous, local-only restoration — unchanged from before Phase 5. */
export function getSession(): Session | null {
  return restoreSession()
}

// ─── Supabase Auth ─────────────────────────────────────────────────────────────

interface LoginIdentity {
  auth_id: string
  login_email: string
  status: 'ACTIVE' | 'INACTIVE'
}

/**
 * Resolves Employee Code -> Supabase Auth login email via the
 * `resolve_login_identity` RPC (SECURITY DEFINER; see its migration for why
 * a direct table read cannot do this pre-auth). Returns `null` for an
 * unknown code, an RPC failure, or a missing Supabase client — the caller
 * treats all three identically ("not a real account here") so that response
 * shape never signals which case occurred.
 */
async function resolveLoginIdentity(employeeCode: string): Promise<LoginIdentity | null> {
  if (!supabase) return null

  try {
    const { data, error } = await supabase.rpc('resolve_login_identity', {
      p_employee_code: employeeCode,
    })
    if (error) return null

    const row = (Array.isArray(data) ? data[0] : data) as LoginIdentity | undefined
    if (!row?.login_email || !row.auth_id) return null
    return row
  } catch {
    return null
  }
}

interface ProfileRow {
  id: string
  employee_code: string
  name: string
  role: UserRole
  status: 'ACTIVE' | 'INACTIVE'
}

/**
 * Reads the caller's own profile under RLS (profiles_select_self, Phase 3 —
 * `id = auth.uid()`) and enforces the same "inactive accounts cannot use a
 * live session" rule the local path has always had (§6.7).
 */
async function resolveActiveProfile(uid: string): Promise<{ profile: ProfileRow } | { error: AuthError }> {
  if (!supabase) return { error: 'SYSTEM_ERROR' }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, employee_code, name, role, status')
      .eq('id', uid)
      .single()

    if (error || !data) return { error: 'SYSTEM_ERROR' }
    if (data.status !== 'ACTIVE') return { error: 'INACTIVE_ACCOUNT' }
    return { profile: data as ProfileRow }
  } catch {
    return { error: 'SYSTEM_ERROR' }
  }
}

function toSession(profile: ProfileRow, expiresAtSeconds: number | undefined): Session {
  return {
    user: {
      id: profile.id,
      name: profile.name,
      role: profile.role,
      employeeNumber: profile.employee_code,
    },
    expiresAt: (expiresAtSeconds ?? Math.floor(Date.now() / 1000) + 8 * 60 * 60) * 1000,
  }
}

/**
 * Attempts sign-in through real Supabase Auth. Returns `null` — meaning "not
 * applicable, the caller should try the local path" — only when the
 * sign-in call itself failed (no such Auth user, or a wrong password).
 * Supabase deliberately returns the same generic error for both cases (the
 * same anti-enumeration reasoning the local path already follows), so this
 * function cannot and does not try to distinguish them; a wrong password for
 * a real account simply falls through to a local lookup that also fails,
 * ending in the same INVALID_CREDENTIALS result either way — never a
 * different, more permissive one. Once sign-in itself succeeds, every
 * subsequent outcome (inactive account, system error) is definitive and is
 * returned directly, never falling through.
 */
async function signInWithSupabase(employeeCode: string, password: string): Promise<AuthResult | null> {
  if (!supabase) return null

  const identity = await resolveLoginIdentity(employeeCode)
  if (!identity) return null // no matching real account — fall through to the local demo path

  let authResponse
  try {
    authResponse = await supabase.auth.signInWithPassword({
      email: identity.login_email,
      password,
    })
  } catch {
    return null
  }

  const { data, error } = authResponse
  if (error || !data.session) return null

  if (data.session.user.id !== identity.auth_id) {
    // Should never happen — profiles.id is a foreign key straight into
    // auth.users.id — but fail closed rather than trust a mismatch.
    await supabase.auth.signOut()
    return { ok: false, error: 'SYSTEM_ERROR' }
  }

  const profileResult = await resolveActiveProfile(data.session.user.id)
  if ('error' in profileResult) {
    if (profileResult.error === 'INACTIVE_ACCOUNT') {
      // Valid credentials, but the account is deactivated — end the
      // Supabase session immediately rather than leaving a live, unusable
      // token behind.
      await supabase.auth.signOut()
    }
    return { ok: false, error: profileResult.error }
  }

  const session = toSession(profileResult.profile, data.session.expires_at)
  currentSession = session
  sessionSource = 'supabase'
  restored = true
  notify(session)
  // Supabase's own client already persists its session under its own
  // localStorage key — persistSession()/SESSION_KEY is the local-path
  // mechanism only, not duplicated here.
  return { ok: true, session }
}

/**
 * Re-checks a real Supabase session on page load. Async by nature (unlike
 * the local restoreSession()), so AuthProvider only calls this when there is
 * no local session to restore synchronously first — see App.tsx.
 */
export async function restoreSupabaseSession(): Promise<Session | null> {
  if (!supabase) return null

  try {
    const { data } = await supabase.auth.getSession()
    if (!data.session) return null

    const profileResult = await resolveActiveProfile(data.session.user.id)
    if ('error' in profileResult) {
      if (profileResult.error === 'INACTIVE_ACCOUNT') {
        await supabase.auth.signOut()
      }
      return null
    }

    const session = toSession(profileResult.profile, data.session.expires_at)
    currentSession = session
    sessionSource = 'supabase'
    restored = true
    notify(session)
    return session
  } catch {
    return null
  }
}

if (supabase) {
  supabase.auth.onAuthStateChange((event) => {
    // Only ever acts on a session this module currently believes is
    // Supabase-backed — a local demo session is untouched by Supabase's own
    // lifecycle events, and this listener does not duplicate the explicit
    // handling already done in signInWithSupabase/restoreSupabaseSession/
    // signOut for SIGNED_IN and token refresh.
    if (event === 'SIGNED_OUT' && sessionSource === 'supabase') {
      currentSession = null
      sessionSource = null
      notify(null)
    }
  })
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function signIn(employeeNumber: string, password: string): Promise<AuthResult> {
  const normalized = employeeNumber.trim().toUpperCase()

  if (!normalized || !password) {
    return { ok: false, error: 'INVALID_CREDENTIALS' }
  }

  if (isSupabaseConfigured) {
    const supabaseResult = await signInWithSupabase(normalized, password)
    if (supabaseResult) return supabaseResult
    // null: no matching Supabase Auth user (or an unreachable/misconfigured
    // Supabase project) — fall through to the existing local accounts below,
    // exactly as if Supabase were not configured at all.
  }

  try {
    // Simulated round trip so the caller's loading state is observable —
    // unchanged from before Phase 5.
    await new Promise((resolve) => setTimeout(resolve, 400))

    const credential = loadCredentials().find((c) => c.employeeNumber === normalized)
    const employee = loadStore().employees.find((e) => e.id === normalized)

    // Verify the password even when the account is unknown, so response time
    // does not reveal whether an employee ID exists (auth-flow-spec §4).
    const candidate = hashPassword(password, credential?.salt ?? 'absent-account-salt')
    const passwordMatches = credential ? safeEqual(candidate, credential.hash) : false

    if (!credential || !employee || !passwordMatches) {
      return { ok: false, error: 'INVALID_CREDENTIALS' }
    }

    if (employee.status !== 'ACTIVE') {
      return { ok: false, error: 'INACTIVE_ACCOUNT' }
    }

    const session: Session = {
      user: {
        id: employee.id,
        name: employee.name,
        role: employee.role,
        employeeNumber: employee.id,
      },
      expiresAt: Date.now() + SESSION_TTL_MS,
    }

    currentSession = session
    sessionSource = 'local'
    restored = true
    persistSession(session)
    notify(session)

    return { ok: true, session }
  } catch {
    return { ok: false, error: 'SYSTEM_ERROR' }
  }
}

export async function signOut(): Promise<void> {
  if (supabase && sessionSource === 'supabase') {
    try {
      await supabase.auth.signOut()
    } catch {
      // Non-fatal: local state is cleared unconditionally below regardless,
      // so the app's own UI always reflects "signed out" even if the
      // network call itself failed.
    }
  }

  currentSession = null
  sessionSource = null
  restored = true
  persistSession(null)
  notify(null)
}

// MANAGER, TECH_MANAGER and GM all work out of the same management area. The
// pages there scope their data to what the signed-in approver may act on and
// see, so there is one implementation rather than three near-copies.
export function dashboardPath(role: UserRole): string {
  switch (role) {
    case 'EMPLOYEE':
      return '/employee/dashboard'
    case 'MANAGER':
    case 'TECH_MANAGER':
    case 'GM':
      return '/manager/dashboard'
    case 'HR':
      return '/hr/dashboard'
  }
}

export function subscribeToAuthChanges(callback: (session: Session | null) => void) {
  authListeners.add(callback)
  return () => {
    authListeners.delete(callback)
  }
}

// ─── HR-driven account management (local demo accounts only) ─────────────────
// Real accounts never reach these — their credentials live entirely inside
// Supabase Auth, created via provisionEmployeeAccount() below, never here.

export function createHRUserCredential(data: {
  employeeNumber: string
  name: string
  role: UserRole
  password: string
}): void {
  const records = loadCredentials().filter((c) => c.employeeNumber !== data.employeeNumber)
  records.push(makeCredential(data.employeeNumber, data.password))
  saveCredentials(records)
}

export function updateHRUserCredential(
  employeeNumber: string,
  updates: { name?: string; role?: UserRole; active?: boolean; password?: string }
): void {
  if (updates.password) {
    const records = loadCredentials().filter((c) => c.employeeNumber !== employeeNumber)
    records.push(makeCredential(employeeNumber, updates.password))
    saveCredentials(records)
  }

  // Name, role and status are read from the employee record on every sign-in
  // and on every session restore, so a deactivation or demotion is enforced
  // immediately without a mirrored copy here.
  if (updates.active === false && sessionSource === 'local' && currentSession?.user.id === employeeNumber) {
    void signOut()
  }
}

/** Development helper — the seeded password. Never rendered in the UI. */
export function getDemoPassword(): string {
  return DEMO_PASSWORD
}

// ─── Password change (real Supabase accounts only) ────────────────────────────
// Demo/local accounts never reach this — see createHRUserCredential/
// updateHRUserCredential above for how their passwords are managed instead.

export type ChangePasswordError =
  | 'CURRENT_PASSWORD_INCORRECT'
  | 'SAME_AS_CURRENT'
  | 'WEAK_PASSWORD'
  | 'NOT_SUPPORTED'
  | 'SYSTEM_ERROR'

export type ChangePasswordResult = { ok: true } | { ok: false; error: ChangePasswordError; message: string }

/**
 * Changes the signed-in real Supabase user's own password.
 *
 * The current password is verified by re-authenticating with it via
 * signInWithPassword — Supabase Auth has no separate "verify password"
 * endpoint, and this is its documented pattern for confirming a password
 * before a sensitive change. Only on success does updateUser() apply the new
 * one. Neither password is ever sent anywhere but supabase-js's own Auth
 * calls: not to a custom RPC, not into any table, not logged.
 *
 * Gated on sessionSource === 'supabase' (not just `supabase` being
 * configured) so this can never run against a local demo session even if
 * one happens to be live in the same browser tab.
 */
export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<ChangePasswordResult> {
  if (!supabase || sessionSource !== 'supabase') {
    return { ok: false, error: 'NOT_SUPPORTED', message: 'Password changes are only available for real accounts.' }
  }

  if (currentPassword === newPassword) {
    return { ok: false, error: 'SAME_AS_CURRENT', message: 'New password must be different from your current password.' }
  }

  try {
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user?.email) {
      return { ok: false, error: 'SYSTEM_ERROR', message: 'Your session could not be verified. Please sign in again.' }
    }

    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: userData.user.email,
      password: currentPassword,
    })
    if (verifyError) {
      return { ok: false, error: 'CURRENT_PASSWORD_INCORRECT', message: 'Current password is incorrect.' }
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
    if (updateError) {
      const message = /password/i.test(updateError.message)
        ? updateError.message
        : 'Could not update your password. Please choose a different password and try again.'
      return { ok: false, error: 'WEAK_PASSWORD', message }
    }

    return { ok: true }
  } catch {
    return { ok: false, error: 'SYSTEM_ERROR', message: 'Could not reach the server. Please try again.' }
  }
}

// ─── Real employee provisioning (Supabase) ────────────────────────────────────

export interface ProvisionEmployeeInput {
  role: 'EMPLOYEE' | 'MANAGER'
  employeeCode: string
  password: string
  firstName: string
  lastName: string
  position: string
  /** A real, ACTIVE departments.id — Phase 6A Extension replaced free-text department with this. */
  departmentId: string
  email: string
  phone?: string
  managerId?: string | null
  permissionMinutesPerMonth?: number
  /** MANAGER only — see hr_create_manager_with_team (§5.5). */
  teamMemberIds?: string[]
}

export type ProvisionEmployeeResult =
  | { ok: true; profile: { id: string; employee_code: string; name: string; role: UserRole } }
  | { ok: false; error: string }

/**
 * Calls the provision-employee Edge Function — the only path that creates a
 * real Auth user and its matching profiles row. Wired into the Add Employee
 * form's submit handler since Phase 6A (HREmployeesPage.createEmployee).
 *
 * No plaintext password is stored anywhere by this function or by the Edge
 * Function it calls — the password is transmitted once, over this
 * authenticated call, straight into Supabase Auth Admin's createUser(), and
 * is never written to a Postgres table, a log, or localStorage.
 */
export async function provisionEmployeeAccount(
  input: ProvisionEmployeeInput
): Promise<ProvisionEmployeeResult> {
  if (!supabase) {
    return { ok: false, error: 'Supabase is not configured in this environment.' }
  }

  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) {
    return { ok: false, error: 'You must be signed in as HR to create an account.' }
  }

  try {
    const { data, error } = await supabase.functions.invoke('provision-employee', {
      body: {
        role: input.role,
        employee_code: input.employeeCode,
        password: input.password,
        first_name: input.firstName,
        last_name: input.lastName,
        position: input.position,
        department_id: input.departmentId,
        email: input.email,
        phone: input.phone,
        manager_id: input.managerId ?? null,
        permission_minutes_per_month: input.permissionMinutesPerMonth,
        team_member_ids: input.teamMemberIds ?? [],
      },
    })

    if (error) {
      return { ok: false, error: error.message }
    }
    if (!data?.profile) {
      return { ok: false, error: 'Unexpected response from the server.' }
    }

    return { ok: true, profile: data.profile }
  } catch {
    return { ok: false, error: 'Could not reach the server. Please try again.' }
  }
}

// ─── HR-driven password change for a real employee (Supabase) ────────────────

export type AdminUpdatePasswordResult = { ok: true } | { ok: false; error: string }

/**
 * Calls the hr-update-employee-password Edge Function — the only path that
 * can change a real employee's Supabase Auth password on HR's behalf. Wired
 * into the Edit Employee form's existing Password field
 * (HREmployeesPage.handleEdit).
 *
 * This never signs the target employee in and never asks for or reads their
 * current password — it goes straight through a server-side admin operation
 * scoped to the caller (verified HR) and the one profile HR selected. See
 * that function for the full trust chain.
 */
export async function adminUpdateEmployeePassword(
  profileId: string,
  newPassword: string
): Promise<AdminUpdatePasswordResult> {
  if (!supabase) {
    return { ok: false, error: 'Supabase is not configured in this environment.' }
  }

  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) {
    return { ok: false, error: 'You must be signed in as HR to change a password.' }
  }

  try {
    const { error } = await supabase.functions.invoke('hr-update-employee-password', {
      body: { profile_id: profileId, new_password: newPassword },
    })

    if (error) {
      return { ok: false, error: error.message }
    }
    return { ok: true }
  } catch {
    return { ok: false, error: 'Could not reach the server. Please try again.' }
  }
}
