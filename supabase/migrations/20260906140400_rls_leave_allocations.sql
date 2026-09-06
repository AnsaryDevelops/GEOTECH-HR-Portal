-- Phase 3: RLS for leave_allocations.
--
-- HR gets full CRUD (this phase's instruction is explicit that HR may
-- create/update/delete allocations); every other role is read-only, and
-- only for their own rows — matching PRODUCTION-BACKEND-PLAN.md §7's
-- "SELECT — self or HR" (managers do not see a report's allocations here;
-- no such visibility was approved for this table).

ALTER TABLE leave_allocations ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON leave_allocations TO authenticated;

CREATE POLICY leave_allocations_select_self_or_hr ON leave_allocations
    FOR SELECT
    TO authenticated
    USING (profile_id = auth.uid() OR is_hr());

CREATE POLICY leave_allocations_insert_hr ON leave_allocations
    FOR INSERT
    TO authenticated
    WITH CHECK (is_hr());

CREATE POLICY leave_allocations_update_hr ON leave_allocations
    FOR UPDATE
    TO authenticated
    USING (is_hr())
    WITH CHECK (is_hr());

CREATE POLICY leave_allocations_delete_hr ON leave_allocations
    FOR DELETE
    TO authenticated
    USING (is_hr());
