-- Phase 3: RLS for public_holidays.
--
-- Add/remove only, no in-place edit — matches the frontend Settings page
-- exactly (PRODUCTION-BACKEND-PLAN.md §4.7). No UPDATE grant at all.

ALTER TABLE public_holidays ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, DELETE ON public_holidays TO authenticated;

-- SELECT: every authenticated user — needed by working-day math and the
-- dashboard calendar everywhere, not just for HR.
CREATE POLICY public_holidays_select_all ON public_holidays
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY public_holidays_insert_hr ON public_holidays
    FOR INSERT
    TO authenticated
    WITH CHECK (is_hr());

CREATE POLICY public_holidays_delete_hr ON public_holidays
    FOR DELETE
    TO authenticated
    USING (is_hr());
