-- Phase 3: RLS for company_approval_routing.
--
-- SECURITY DECISION — flagged for review: no write grant is given to any
-- role in this phase, including HR. PRODUCTION-BACKEND-PLAN.md §4.9/§5.7 is
-- explicit that this table has "no direct grant to anyone, including HR —
-- exclusively through set_approval_routing", because that function's safety
-- depends on a specific internal ordering (repoint routing, then demote the
-- old holder, then promote the new one) that a raw column UPDATE cannot
-- reproduce, plus a companion trigger (not yet built — it belongs with
-- set_approval_routing in the RPC phase) that blocks deactivating the
-- sitting Technical Manager/General Manager out from under this table. A
-- raw HR UPDATE grant today would let this table and profiles.role drift out
-- of sync with neither safeguard in place. Read access is open to every
-- authenticated user, matching the plan (an employee submitting a request
-- needs to know who is in their chain before submitting).

ALTER TABLE company_approval_routing ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON company_approval_routing TO authenticated;

CREATE POLICY company_approval_routing_select_all ON company_approval_routing
    FOR SELECT
    TO authenticated
    USING (true);
