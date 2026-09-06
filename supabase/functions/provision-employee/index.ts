// provision-employee — the one trusted server-side boundary for creating a
// real employee account (PRODUCTION-BACKEND-PLAN.md §6.3, §13.6).
//
//   HR frontend
//       -> this Edge Function (re-verifies is_hr() independently)
//       -> Supabase Auth Admin API (auth.users created)
//       -> hr_create_employee / hr_create_manager_with_team (profiles created)
//
// The service-role key lives only in this function's own environment
// (SUPABASE_SERVICE_ROLE_KEY, set via `supabase secrets set`) and is never
// returned in any response, logged, or reachable from a browser. It is used
// for exactly one thing: admin.createUser(). Every other operation —
// verifying the caller, calling the profiles-side RPC — runs through a
// client scoped to the CALLER's own JWT, so auth.uid() inside those RPCs
// resolves to the real HR user, not to this function or the service role.
//
// No password is ever written to a Postgres table, a log, or returned in
// this function's response — it is read once from the request body and
// handed straight to admin.createUser(), which is Supabase Auth's own
// bcrypt-hashed storage, never this codebase's.
//
// Deployed via `supabase functions deploy --use-api` (Backend Activation
// session) — live at /functions/v1/provision-employee on the linked
// project. SUPABASE_URL/SUPABASE_ANON_KEY/SUPABASE_SERVICE_ROLE_KEY are
// auto-provisioned by the platform for every Edge Function; no manual
// secret configuration was needed.

import { createClient } from 'npm:@supabase/supabase-js@2.113.0'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

function jsonError(message: string, status: number): Response {
  return jsonResponse({ error: message }, status)
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface ProvisionRequestBody {
  role?: string
  employee_code?: string
  password?: string
  first_name?: string
  last_name?: string
  position?: string
  department_id?: string
  email?: string
  phone?: string
  manager_id?: string | null
  permission_minutes_per_month?: number
  team_member_ids?: string[]
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }
  if (req.method !== 'POST') {
    return jsonError('Method not allowed.', 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonError('Server is not configured.', 500)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return jsonError('Not authenticated.', 401)
  }

  // Step 1: a client scoped to the CALLER's own JWT — used to independently
  // verify they are really HR, and later to call the profile-creation RPC
  // as them, so its own internal is_hr() re-check is a second, independent
  // gate, never bypassed by this function's own admin privileges.
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  })

  const { data: userData, error: userError } = await callerClient.auth.getUser()
  if (userError || !userData?.user) {
    return jsonError('Not authenticated.', 401)
  }

  const { data: isHr, error: isHrError } = await callerClient.rpc('is_hr')
  if (isHrError || isHr !== true) {
    return jsonError('Only HR may create employee accounts.', 403)
  }

  let body: ProvisionRequestBody
  try {
    body = await req.json()
  } catch {
    return jsonError('Invalid request body.', 400)
  }

  const role = body.role === 'MANAGER' ? 'MANAGER' : body.role === 'EMPLOYEE' ? 'EMPLOYEE' : null
  if (!role) {
    return jsonError('role must be EMPLOYEE or MANAGER.', 400)
  }

  // Canonical form is uppercase, matching the approved Employee Code
  // implementation exactly (App.tsx createEmployee) — enforced here too,
  // since this function must never trust that the caller already
  // canonicalized it, and the database RPCs re-validate it again themselves
  // as a third, independent layer.
  const employeeCode = String(body.employee_code ?? '').trim().toUpperCase()
  if (!employeeCode) {
    return jsonError('Employee Code is required.', 400)
  }

  const password = String(body.password ?? '')
  if (!password) {
    return jsonError('Initial password is required.', 400)
  }
  // No complexity policy is enforced here or anywhere else — the approved V1
  // decision is that HR may assign a simple temporary password
  // (PRODUCTION-BACKEND-PLAN.md §6.4).

  const email = String(body.email ?? '').trim().toLowerCase()
  if (!email || !EMAIL_PATTERN.test(email)) {
    return jsonError('A valid email is required.', 400)
  }

  const departmentId = String(body.department_id ?? '').trim()
  if (!departmentId) {
    return jsonError('Department is required.', 400)
  }

  // Deterministic synthetic Auth alias — must match employeeCodeToSyntheticEmail
  // in 02-SOURCE/frontend/src/lib/auth.ts exactly, or sign-in will never find
  // this account (§6.2).
  const authEmail = `${employeeCode.toLowerCase()}@auth.internal`

  // Step 2: only now that the caller is confirmed to be HR, construct the
  // admin-privileged client using the service-role key — read from this
  // function's own server-side environment, never from the request body,
  // never returned to the caller.
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email: authEmail,
    password,
    email_confirm: true,
  })
  if (createError || !created?.user) {
    return jsonError(createError?.message ?? 'Could not create the Auth account.', 400)
  }

  const newEmployee = {
    id: created.user.id,
    employee_code: employeeCode,
    first_name: body.first_name,
    last_name: body.last_name,
    position: body.position,
    department_id: departmentId,
    email,
    phone: body.phone,
    manager_id: body.manager_id ?? null,
    permission_minutes_per_month: body.permission_minutes_per_month,
    role,
    status: 'ACTIVE',
  }

  // Step 3: the profiles-side work, through the approved SECURITY DEFINER
  // RPC — called as the caller (callerClient), not the admin client, so
  // auth.uid() inside it resolves to the real HR user and its own is_hr()
  // check runs for real.
  const rpcName = role === 'MANAGER' ? 'hr_create_manager_with_team' : 'hr_create_employee'
  const rpcArgs =
    role === 'MANAGER'
      ? { new_employee: newEmployee, team_member_ids: body.team_member_ids ?? [] }
      : { new_employee: newEmployee }

  const { data: profile, error: rpcError } = await callerClient.rpc(rpcName, rpcArgs)

  if (rpcError) {
    // Partial failure: the Auth user exists but the profile does not. Never
    // leave an orphaned login with no profile behind it — clean up the Auth
    // user before reporting the error (§13.10's mitigation).
    try {
      await adminClient.auth.admin.deleteUser(created.user.id)
    } catch {
      // The cleanup itself failing is logged by Supabase's own function
      // logs; there is nothing further this function can safely do here
      // without risking masking the original, more informative rpcError.
    }
    return jsonError(rpcError.message, 400)
  }

  return jsonResponse({ profile }, 200)
})
