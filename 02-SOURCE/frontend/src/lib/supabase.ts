// Supabase client — browser-side, anon key only.
//
// The service-role key must never appear in this file, any other frontend
// module, or the built bundle. Admin operations (creating an Auth user) run
// exclusively inside the provision-employee Edge Function, server-side —
// see supabase/functions/provision-employee/index.ts.
//
// createClient() throws synchronously if given an empty URL, so this module
// must not construct a client at all when the env vars are absent — which is
// the current state of this repo (no .env yet: Supabase migrations have not
// been applied to the remote project). `supabase` is therefore nullable, and
// every caller (auth.ts) must treat a missing client as "fall back to the
// existing localStorage path", not as an error.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: true, autoRefreshToken: true },
      })
    : null
