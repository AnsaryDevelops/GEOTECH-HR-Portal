-- Phase 6A.1 — HR Direct Manager = General Manager.
-- Corrective migration on top of 20260906150000_business_helper_functions.sql
-- (already committed) — does not edit that file.
--
-- HR is a normal requester whose Direct Manager is always the current
-- General Manager (profiles.manager_id stays the single source of truth —
-- set_approval_routing, fixed alongside this migration, is what keeps it
-- pointed at the GM). Before this fix, an HR requester whose manager_id was
-- set to the GM would still walk into the ordinary candidate list
-- [direct_manager, technical_manager, general_manager]: stage 1 correctly
-- resolves to the GM (via the direct-manager slot), but stage 2 would then
-- add the Technical Manager as a second, spurious approval stage — the
-- existing "already seen" dedup only catches the exact same PERSON
-- appearing twice, not "this tier does not apply to this requester's role."
-- HR must never route through the Technical Manager tier at all, so that
-- candidate is now omitted outright for an HR requester, producing the
-- required single-stage HR -> General Manager chain.
--
-- Normal (non-HR) requesters are entirely unaffected — same three
-- candidates, same order, same dedup behavior as before.
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
    SELECT manager_id, role INTO v_direct_manager_id, v_employee_role FROM profiles WHERE id = p_employee_id;
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
