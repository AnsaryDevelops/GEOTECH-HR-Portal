-- Phase 3: RLS for profiles.
--
-- No INSERT grant to authenticated at all, at any role: profile creation is
-- exclusively the job of hr_create_manager_with_team (a later, SECURITY
-- DEFINER phase), invoked only after the Edge Function has created the
-- matching auth.users row (PRODUCTION-BACKEND-PLAN.md §5.5, §6.3). No DELETE
-- grant either, to any role including HR — deactivation (status=INACTIVE) is
-- the only lifecycle-ending action (§13.1).
--
-- UPDATE is deliberately narrower than "HR can edit everything": employee_code
-- is excluded from the column grant entirely, for every role including HR.
-- No process yet keeps a changed employee_code in sync with the Supabase Auth
-- identity derived from it at creation time (§6.2) — until that exists,
-- changing it here would silently break sign-in. id/created_at/updated_at are
-- likewise never client-writable.

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON profiles TO authenticated;
GRANT UPDATE (
    first_name, last_name, name, position, department, email, phone,
    status, role, manager_id, permission_minutes_per_month
) ON profiles TO authenticated;

-- SELECT: self.
CREATE POLICY profiles_select_self ON profiles
    FOR SELECT
    TO authenticated
    USING (id = auth.uid());

-- SELECT: an employee may see their own direct manager's row (the "who
-- will approve this" chain preview).
CREATE POLICY profiles_select_own_manager ON profiles
    FOR SELECT
    TO authenticated
    USING (id = own_manager_id());

-- SELECT: a manager (of any approver tier) may see their own direct reports.
-- Plain column comparison against the candidate row itself — no subquery
-- into profiles, so no recursion risk here at all.
CREATE POLICY profiles_select_direct_reports ON profiles
    FOR SELECT
    TO authenticated
    USING (manager_id = auth.uid());

-- SELECT: the sitting Technical Manager / General Manager see every profile
-- (Organization page) — PRODUCTION-BACKEND-PLAN.md §7.
CREATE POLICY profiles_select_org_wide ON profiles
    FOR SELECT
    TO authenticated
    USING (is_tech_manager_or_gm());

-- SELECT: HR sees everyone.
CREATE POLICY profiles_select_hr ON profiles
    FOR SELECT
    TO authenticated
    USING (is_hr());

-- UPDATE: HR only. Deliberately no self-update policy for any other role —
-- V1 has no approved self-service "edit my profile" feature, so no non-HR
-- role gets any UPDATE row at all (the column grant above narrows *what*
-- could ever be changed; this policy is what actually allows changing it,
-- and only HR passes it).
CREATE POLICY profiles_update_hr ON profiles
    FOR UPDATE
    TO authenticated
    USING (is_hr())
    WITH CHECK (is_hr());
