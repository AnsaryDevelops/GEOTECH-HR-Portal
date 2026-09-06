/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Public Supabase project URL. Safe to expose to the browser. */
  readonly VITE_SUPABASE_URL?: string
  /** Public anon key — RLS is the security boundary, not this key. Safe to expose to the browser. */
  readonly VITE_SUPABASE_ANON_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
