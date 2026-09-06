-- Phase 6A Extension — My Profile: every authenticated user may edit their
-- own first name, last name, email, and phone. Everything else on profiles
-- stays HR-only, exactly as before.
--
-- Why this needs both a new RLS policy AND a trigger, not just a policy:
-- the column-level GRANT UPDATE (...) ON profiles TO authenticated
-- (20260906140200_rls_profiles.sql) already includes first_name, last_name,
-- email, phone — but it ALSO includes role, status, manager_id, and
-- position, because that same grant has to cover HR editing *other*
-- people's profiles. GRANT is not aware of which RLS policy admitted a row,
-- so a self-row-matching policy alone (`id = auth.uid()`) would let a
-- non-HR user overwrite their own role/status/manager_id/department_id too,
-- through the very same already-granted columns — exactly the outcome this
-- feature must prevent. RLS/GRANT cannot express "these columns, but only
-- for this policy" — a BEFORE UPDATE trigger is the correct mechanism for
-- that, the same pattern already used for the equally cross-cutting
-- TM/GM-protection rule (protect_active_tm_gm, 20260906150100).
--
-- HR is exempt from the trigger's check, not because HR should be able to
-- self-promote through My Profile, but because HR already has a separate,
-- pre-existing, approved capability to edit any profile including their own
-- through the Edit Employee admin flow (profiles_update_hr) — this
-- migration must not accidentally narrow that. The new My Profile screen
-- itself simply never offers role/status/manager/department/employee_code
-- as editable fields to any role, HR included, which is what actually
-- enforces the "personal info only" principle at the UI layer; the trigger
-- is the backstop for everyone the UI restriction doesn't apply to (i.e.
-- any other authenticated client).

CREATE POLICY profiles_update_self ON profiles
    FOR UPDATE
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

CREATE FUNCTION protect_profile_self_edit_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT is_hr() THEN
        IF NEW.employee_code IS DISTINCT FROM OLD.employee_code
           OR NEW.role IS DISTINCT FROM OLD.role
           OR NEW.manager_id IS DISTINCT FROM OLD.manager_id
           OR NEW.status IS DISTINCT FROM OLD.status
           OR NEW.department_id IS DISTINCT FROM OLD.department_id
           OR NEW.position IS DISTINCT FROM OLD.position
        THEN
            RAISE EXCEPTION 'You may only update your own first name, last name, email, and phone.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION protect_profile_self_edit_fields() FROM PUBLIC;

CREATE TRIGGER profiles_protect_self_edit_fields
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION protect_profile_self_edit_fields();
