// hr-update-employee-password — the one trusted server-side boundary for HR
// changing another real employee's Supabase Auth password (Edit Employee's
// existing Password field — see HREmployeesPage.handleEdit in App.tsx).
//
// Mirrors provision-employee's trust shape exactly:
//
//   HR frontend
//       -> this Edge Function (re-verifies is_hr() independently)
//       -> Supabase Auth Admin API (auth.users password updated)
//
// The service-role key lives only in this function's own environment
// (SUPABASE_SERVICE_ROLE_KEY, platform-provisioned) and is never returned in
// any response, logged, or reachable from a browser. It is used for exactly
// one thing: admin.updateUserById({ password }). Verifying the caller and
// resolving the target profile both run through a client scoped to the
// CALLER's own JWT, so RLS (profiles_select_hr) — not this function's own
// admin privileges — is what actually lets the lookup succeed.
//
// The target Auth user is never taken from a client-supplied Auth ID —
// only a profiles.id (the profile HR selected in the Edit Employee list) is
// accepted, and it is resolved against the profiles table before use.
// profiles.id === auth.users.id by foreign key, so once the profile row is
// confirmed to exist, its id is the correct, trusted Auth target.
//
// No password is ever written to a Postgres table, a log, or returned in
// this function's response — it is read once from the request body and
// handed straight to admin.updateUserById(), which is Supabase Auth's own
// bcrypt-hashed storage, never this codebase's.

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

interface UpdatePasswordRequestBody {
  profile_id?: string
  new_password?: string
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
  // verify they are really HR, and to resolve the target profile under RLS
  // (profiles_select_hr), never bypassed by this function's own admin
  // privileges.
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
    return jsonError('Only HR may change an employee password.', 403)
  }

  let body: UpdatePasswordRequestBody
  try {
    body = await req.json()
  } catch {
    return jsonError('Invalid request body.', 400)
  }

  const profileId = String(body.profile_id ?? '').trim()
  if (!profileId) {
    return jsonError('profile_id is required.', 400)
  }

  const newPassword = String(body.new_password ?? '')
  if (!newPassword) {
    return jsonError('A new password is required.', 400)
  }

  // Step 2: resolve the target Auth user ID from the trusted profiles
  // relationship, under the caller's own RLS — never trust a client-supplied
  // Auth ID directly. profiles.id === auth.users.id for every real account,
  // so confirming this row exists is sufficient to know the target.
  const { data: targetProfile, error: profileError } = await callerClient
    .from('profiles')
    .select('id')
    .eq('id', profileId)
    .maybeSingle()

  if (profileError) {
    return jsonError('Could not verify the selected employee.', 400)
  }
  if (!targetProfile) {
    return jsonError('Selected employee could not be found.', 404)
  }

  // Step 3: only now that the caller is confirmed HR and the target profile
  // is confirmed to exist, construct the admin-privileged client — read from
  // this function's own server-side environment, never from the request
  // body, never returned to the caller.
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })

  const { error: updateError } = await adminClient.auth.admin.updateUserById(targetProfile.id, {
    password: newPassword,
  })
  if (updateError) {
    return jsonError(updateError.message ?? 'Could not update the password.', 400)
  }

  return jsonResponse({ ok: true }, 200)
})
