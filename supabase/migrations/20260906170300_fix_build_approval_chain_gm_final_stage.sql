-- Phase 6B-4 — real Leave submission exposed a defect in build_approval_chain.
-- Corrective migration on top of 20260906170200_fix_build_approval_chain_ambiguous_role.sql
-- (already committed) — does not edit that file.
--
-- Confirmed live via a real submission (REQ-00003, Ali Mahmoud / PH6AEMP1,
-- whose direct manager is Hassan Ahmed, the current General Manager):
-- candidates are iterated in slot order [direct_manager, technical_manager,
-- general_manager] (or [direct_manager, general_manager] for HR), deduping
-- only by exact person via v_seen. When the direct manager already IS the
-- General Manager, stage 1 correctly resolves to them — but the loop kept
-- going: the Technical Manager slot holds a different, distinct person, not
-- yet in v_seen, so it was wrongly appended as stage 2, AFTER the General
-- Manager. Observed result: [GM, TECH_MANAGER] instead of [GM] alone.
--
-- Dedup-by-person alone cannot express "the chain has already reached the
-- top of the hierarchy" — only "this exact individual was already added."
-- The fix adds that missing rule directly: once a candidate whose actual
-- role is GM has been added, stop. This is sufficient on its own to satisfy
-- every required case:
--   - Direct Manager = General Manager: stage 1 is the GM, loop exits
--     immediately — no Technical Manager stage.
--   - Direct Manager = Technical Manager: stage 1 is the TM (not GM, loop
--     continues), the TM slot's candidate is now the same person (already
--     in v_seen, skipped), stage 2 is the GM — loop exits.
--   - Technical Manager = General Manager: cannot actually occur as
--     persisted state (set_approval_routing rejects assigning the same
--     person to both slots), but is handled correctly regardless — whichever
--     slot's candidate resolves to the GM's actual role ends the loop, and
--     the same person can never be added twice via v_seen either way.
--   - HR: unaffected — HR's candidate list never included the Technical
--     Manager to begin with (Phase 6A.1); this only changes what happens
--     once the (already GM-only) chain reaches the GM, which is a no-op
--     here since GM was already the last candidate.
--   - Normal 3-tier chain (Direct Manager, Technical Manager, General
--     Manager all distinct people): unaffected — the loop naturally
--     reaches GM last already, so exiting there changes nothing.
--
-- General Manager remains the only role that ever ends the chain early —
-- Technical Manager reaching the end of the candidate list on its own
-- (i.e. no General Manager configured yet) still correctly produces a
-- Technical-Manager-only chain, exactly as before.
--
-- Only ever affects requests submitted after this migration — existing
-- request_approvals rows (including REQ-00002 and REQ-00003's already-
-- created rows) are historical snapshots and are not touched by this
-- migration; it contains no UPDATE/DELETE against requests or
-- request_approvals whatsoever.
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

        -- General Manager is always the final stage — see header.
        IF v_profile.role = 'GM' THEN
            EXIT;
        END IF;
    END LOOP;

    RETURN;
END;
$$;
