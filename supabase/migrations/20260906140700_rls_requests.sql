-- Phase 3: RLS for requests.
--
-- No INSERT/UPDATE/DELETE grant to authenticated at all, for any role
-- including HR (PRODUCTION-BACKEND-PLAN.md §5, §7: "no direct client
-- INSERT/UPDATE/DELETE grant at all... HR's own requests go through the
-- same submit_*/delete_own_request functions as anyone else's"). This alone
-- makes status, approval stage, current-approver identity, decided_at,
-- decision_comment, and every snapshot column impossible for any client to
-- touch directly — there is nothing to bypass via RLS because there is no
-- write privilege to begin with. Those columns become writable only once
-- the SECURITY DEFINER transactional RPCs exist (a later phase), and even
-- then only through them, never via a direct table grant.

ALTER TABLE requests ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON requests TO authenticated;

-- SELECT: the submitting employee.
CREATE POLICY requests_select_own ON requests
    FOR SELECT
    TO authenticated
    USING (employee_id = auth.uid());

-- SELECT: any approver who holds a request_approvals row for this request —
-- current or past stage, so approval history remains visible after a
-- decision, not just while a stage is still pending. This is a data-backed
-- relationship (has_approval_role_in checks actual request_approvals rows),
-- not a role-based shortcut, per this phase's explicit instruction.
CREATE POLICY requests_select_approver ON requests
    FOR SELECT
    TO authenticated
    USING (has_approval_role_in(id));

-- SELECT: HR sees every request.
CREATE POLICY requests_select_hr ON requests
    FOR SELECT
    TO authenticated
    USING (is_hr());
