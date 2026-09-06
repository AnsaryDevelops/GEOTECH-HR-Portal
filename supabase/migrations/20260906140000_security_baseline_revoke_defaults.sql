-- Phase 3: RLS & Database Security — baseline.
--
-- Supabase's default schema privileges grant anon/authenticated broad access
-- to every table created in `public` unless explicitly revoked. Every table
-- from Phase 2 currently carries those defaults with RLS not yet enabled —
-- i.e. wide open. Reset to zero first, then each following migration grants
-- back only the exact privilege each table needs; RLS policies then narrow
-- those grants to the correct rows.
--
-- This does not change default privileges for schema objects created later
-- (Phase 4+ tables/sequences) — each future migration must repeat this
-- explicit revoke-then-grant pattern for anything new it creates.
--
-- Deliberately scoped to tables and sequences only, not "ALL FUNCTIONS IN
-- SCHEMA public": btree_gist (§9/§13.4) was installed without a target
-- schema, so its GiST support functions likely live in `public` too, and a
-- blanket function revoke risks stripping privileges those functions need
-- from under an extension this migration set does not own or fully control
-- the internals of — with no local database available this phase to verify
-- the blast radius against. The functions that actually matter for security
-- here are the five helper functions this phase creates itself; those each
-- get their own explicit, narrowly-scoped REVOKE/GRANT in the migration
-- that defines them, which does not depend on this blanket statement.

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
