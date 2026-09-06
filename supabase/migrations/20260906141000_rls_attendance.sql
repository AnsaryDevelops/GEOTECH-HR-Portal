-- Phase 3: RLS for attendance.
--
-- Matches PRODUCTION-BACKEND-PLAN.md §4.6/§7 exactly: SELECT is self-or-HR
-- only — a manager does not see a report's attendance here, since no such
-- V1 feature was ever approved (report visibility for Manager/TECH_MANAGER/
-- GM is explicitly "S: own... no report visibility"). All writes are HR
-- only; employees never modify attendance themselves.

ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON attendance TO authenticated;

CREATE POLICY attendance_select_self_or_hr ON attendance
    FOR SELECT
    TO authenticated
    USING (employee_id = auth.uid() OR is_hr());

CREATE POLICY attendance_insert_hr ON attendance
    FOR INSERT
    TO authenticated
    WITH CHECK (is_hr());

CREATE POLICY attendance_update_hr ON attendance
    FOR UPDATE
    TO authenticated
    USING (is_hr())
    WITH CHECK (is_hr());

CREATE POLICY attendance_delete_hr ON attendance
    FOR DELETE
    TO authenticated
    USING (is_hr());
