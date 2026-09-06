-- Phase 3: RLS for audit_logs.
--
-- No grant of any kind to anon or authenticated — the baseline migration
-- already revoked the default privileges Supabase applies to new tables,
-- and this migration deliberately does not re-grant anything. No SELECT,
-- INSERT, UPDATE, or DELETE is reachable through PostgREST for this table,
-- for any application role including HR (PRODUCTION-BACKEND-PLAN.md §4.10:
-- "No SELECT policy is granted to any application role, including HR").
-- There is no V1 Audit Log UI and none is planned. RLS is enabled with no
-- policies purely as defense in depth — even if a grant were mistakenly
-- added later, an empty policy set still denies every row by default. The
-- only path to this table is the service-role key (trusted backend/RPC
-- writes in a later phase) or direct database/dashboard access.

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
