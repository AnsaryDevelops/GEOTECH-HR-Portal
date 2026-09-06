-- Phase 3: RLS for request_approvals.
--
-- No INSERT/UPDATE/DELETE grant to authenticated at all, for any role
-- including HR — this table is system-managed, written exclusively by the
-- transactional RPCs (a later phase), never by a direct client call
-- (PRODUCTION-BACKEND-PLAN.md §4.4, §5, §7).

ALTER TABLE request_approvals ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON request_approvals TO authenticated;

-- SELECT: the named approver on this row — a plain column comparison
-- against the candidate row itself, no subquery, no recursion risk.
CREATE POLICY request_approvals_select_approver ON request_approvals
    FOR SELECT
    TO authenticated
    USING (approver_id = auth.uid());

-- SELECT: the employee who submitted the parent request — their own
-- approval history, mirroring requests_select_approver's use of
-- has_approval_role_in above.
CREATE POLICY request_approvals_select_own_request ON request_approvals
    FOR SELECT
    TO authenticated
    USING (owns_request(request_id));

-- SELECT: HR sees every approval record.
CREATE POLICY request_approvals_select_hr ON request_approvals
    FOR SELECT
    TO authenticated
    USING (is_hr());
