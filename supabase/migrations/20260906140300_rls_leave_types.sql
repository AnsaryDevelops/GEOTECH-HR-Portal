-- Phase 3: RLS for leave_types.
--
-- No DELETE grant at any role, including HR — archiving via status =
-- INACTIVE is the only removal path (PRODUCTION-BACKEND-PLAN.md §13.2).

ALTER TABLE leave_types ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON leave_types TO authenticated;

-- SELECT: every authenticated user sees active leave types (needed to
-- submit a leave request); HR additionally sees archived ones too, so the
-- Settings page can still list and manage them.
CREATE POLICY leave_types_select_active ON leave_types
    FOR SELECT
    TO authenticated
    USING (status = 'ACTIVE' OR is_hr());

CREATE POLICY leave_types_insert_hr ON leave_types
    FOR INSERT
    TO authenticated
    WITH CHECK (is_hr());

CREATE POLICY leave_types_update_hr ON leave_types
    FOR UPDATE
    TO authenticated
    USING (is_hr())
    WITH CHECK (is_hr());
