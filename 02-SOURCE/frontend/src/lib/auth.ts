// Authentication layer.
//
// IDENTITY CONTRACT — the single most important rule in this codebase:
//   session.user.id === EmployeeProfile.id === "EMP-NNNNN"
// The previous build returned the Supabase profiles UUID here while store.ts
// keyed everything by "EMP-NNNNN". The two never matched, so every lookup
// (manager resolution, My Team, request ownership, notifications) silently
// returned nothing. One key space, everywhere.
//
// The employee record in the store is the source of truth for role and status,
// so HR deactivating an account or changing a role takes effect on the very
// next sign-in — no separate mirror to drift out of sync.

import { loadStore } from './store'
import type { UserRole } from './store'

export type { UserRole }

export interface SessionUser {
  id: string // "EMP-00001" — same key space as EmployeeProfile.id
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

// ─── Password hashing ─────────────────────────────────────────────────────────
// Synchronous by necessity: the HR "create employee" path is a synchronous
// React event handler. This keeps plaintext out of storage, which is the point,
// but it is NOT a production KDF. When the server-side layer lands, hashing
// moves to the server and uses bcrypt or argon2id.

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

// ─── Credential storage ───────────────────────────────────────────────────────

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

// ─── Session persistence ──────────────────────────────────────────────────────

let currentSession: Session | null = null
let restored = false
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

// Rebuilds the session from storage, re-reading role and status from the
// employee record so a revoked or demoted account cannot ride an old token.
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
    return currentSession
  } catch {
    return null
  }
}

export function getSession(): Session | null {
  return restoreSession()
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function signIn(employeeNumber: string, password: string): Promise<AuthResult> {
  const normalized = employeeNumber.trim().toUpperCase()

  if (!normalized || !password) {
    return { ok: false, error: 'INVALID_CREDENTIALS' }
  }

  try {
    // Simulated round trip so the caller's loading state is observable.
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
    restored = true
    persistSession(session)
    notify(session)

    return { ok: true, session }
  } catch {
    return { ok: false, error: 'SYSTEM_ERROR' }
  }
}

export function signOut(): void {
  currentSession = null
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

// ─── HR-driven account management ─────────────────────────────────────────────
// These were empty no-ops. HR could "create" an employee who could never log in,
// and "deactivate" one whose access was never revoked.

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
  if (updates.active === false && currentSession?.user.id === employeeNumber) {
    signOut()
  }
}

/** Development helper — the seeded password. Never rendered in the UI. */
export function getDemoPassword(): string {
  return DEMO_PASSWORD
}
