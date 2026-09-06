-- Phase 6A.1 — HR Direct Manager = General Manager.
-- Corrective migration on top of 20260906170000_fix_build_approval_chain_hr_gm.sql
-- (already applied this same session) — does not edit that file.
--
-- Bug found by direct verification (SELECT * FROM build_approval_chain(...)):
-- "column reference \"role\" is ambiguous". RETURNS TABLE's output columns
-- (stage, role, title, approver_id, approver_name) are in scope as plain
-- PL/pgSQL variables for the whole function body, so the previous
-- migration's `SELECT manager_id, role INTO v_direct_manager_id,
-- v_employee_role FROM profiles ...` collided with the function's own
-- `role` OUT parameter — Postgres cannot tell whether `role` means that
-- variable or profiles.role. This broke build_approval_chain entirely, for
-- every requester, not only HR. Fixed by qualifying the column reference.
--
-- CREATE OR REPLACE preserves the function's existing ownership and (lack
-- of) EXECUTE grant to authenticated/anon — neither needs to be repeated
-- here.

CREATE OR REPLACE FUNCTION build_approval_chain(p_employee_id uuid)
RETURNS TABLE (stage smallint, role text, title text, approver_id uuid, approver_name text)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
    v_seen uuid[] := ARRAY[p_employee_id];
    v_stage smallint := 0;
    v_direct_manager_id uuid;
    v_employee_role text;
    v_tech_manager_id uuid;
    v_gm_id uuid;
    v_candidates uuid[];
    v_candidate_id uuid;
    v_profile profiles%ROWTYPE;
    i integer;
BEGIN
    SELECT manager_id, profiles.role INTO v_direct_manager_id, v_employee_role
        FROM profiles WHERE id = p_employee_id;
    SELECT technical_manager_id, general_manager_id
        INTO v_tech_manager_id, v_gm_id
        FROM company_approval_routing WHERE id = 1;

    IF v_employee_role = 'HR' THEN
        v_candidates := ARRAY[v_direct_manager_id, v_gm_id];
    ELSE
        v_candidates := ARRAY[v_direct_manager_id, v_tech_manager_id, v_gm_id];
    END IF;

    FOR i IN 1 .. array_length(v_candidates, 1) LOOP
        v_candidate_id := v_candidates[i];
        IF v_candidate_id IS NULL OR v_candidate_id = ANY(v_seen) THEN
            CONTINUE;
        END IF;

        SELECT * INTO v_profile FROM profiles WHERE id = v_candidate_id AND status = 'ACTIVE';
        IF NOT FOUND THEN
            CONTINUE;
        END IF;

        v_seen := array_append(v_seen, v_candidate_id);
        v_stage := v_stage + 1;

        stage := v_stage;
        role := v_profile.role;
        title := CASE v_profile.role
                     WHEN 'EMPLOYEE' THEN 'Employee'
                     WHEN 'MANAGER' THEN 'Direct Manager'
                     WHEN 'TECH_MANAGER' THEN 'Technical Manager'
                     WHEN 'GM' THEN 'General Manager'
                     WHEN 'HR' THEN 'HR'
                 END;
        approver_id := v_profile.id;
        approver_name := v_profile.name;
        RETURN NEXT;
    END LOOP;

    RETURN;
END;
$$;
