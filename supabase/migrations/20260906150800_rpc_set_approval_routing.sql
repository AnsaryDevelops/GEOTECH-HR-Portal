-- Phase 4: set_approval_routing — PRODUCTION-BACKEND-PLAN.md §5.7.
--
-- Either parameter may be NULL to mean "leave that slot unchanged." The
-- singleton routing row is locked FOR UPDATE for the whole operation,
-- serializing concurrent routing changes.
--
-- Ordering: routing is repointed to its FULL final state in one statement
-- first; only then is anyone demoted, and only if they are leaving BOTH
-- slots entirely; promotions to the final roles happen last. This is what
-- lets every demotion pass the profiles_protect_active_tm_gm trigger (by
-- the time a demotion runs, routing no longer references that person in any
-- slot) and is also what makes a same-call swap unsafe: if a candidate for
-- one slot is the *current* holder of the other slot, the partial unique
-- indexes on profiles (profiles_one_active_tech_manager/_gm, Phase 2) would
-- transiently see two people claiming the same role within the same
-- transaction, and there is no live database available this phase to verify
-- a same-statement multi-row workaround is actually race-free — so it is
-- explicitly rejected instead, with a message telling HR how to do it
-- safely in two calls. Every other combination (independent new candidates
-- for either or both slots, or changing only one slot) is unaffected.

CREATE FUNCTION set_approval_routing(
    new_technical_manager_id uuid,
    new_general_manager_id uuid
)
RETURNS company_approval_routing
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_current_tm uuid;
    v_current_gm uuid;
    v_final_tm uuid;
    v_final_gm uuid;
    v_candidate profiles%ROWTYPE;
    v_routing company_approval_routing%ROWTYPE;
BEGIN
    IF NOT is_hr() THEN
        RAISE EXCEPTION 'Only HR may change approval routing.';
    END IF;

    SELECT technical_manager_id, general_manager_id INTO v_current_tm, v_current_gm
    FROM company_approval_routing WHERE id = 1 FOR UPDATE;

    -- Same-call cross-slot reassignment is not supported — see header.
    IF new_technical_manager_id IS NOT NULL AND v_current_gm IS NOT NULL
       AND new_technical_manager_id = v_current_gm THEN
        RAISE EXCEPTION
            'The selected Technical Manager is the current General Manager. Change the General Manager to someone else first, then retry.';
    END IF;
    IF new_general_manager_id IS NOT NULL AND v_current_tm IS NOT NULL
       AND new_general_manager_id = v_current_tm THEN
        RAISE EXCEPTION
            'The selected General Manager is the current Technical Manager. Change the Technical Manager to someone else first, then retry.';
    END IF;

    v_final_tm := COALESCE(new_technical_manager_id, v_current_tm);
    v_final_gm := COALESCE(new_general_manager_id, v_current_gm);

    IF v_final_tm IS NOT NULL AND v_final_gm IS NOT NULL AND v_final_tm = v_final_gm THEN
        RAISE EXCEPTION 'The Technical Manager and General Manager must be different people.';
    END IF;

    IF new_technical_manager_id IS NOT NULL THEN
        SELECT * INTO v_candidate FROM profiles WHERE id = new_technical_manager_id;
        IF NOT FOUND OR v_candidate.status <> 'ACTIVE' THEN
            RAISE EXCEPTION 'The selected Technical Manager must be an active profile.';
        END IF;
    END IF;

    IF new_general_manager_id IS NOT NULL THEN
        SELECT * INTO v_candidate FROM profiles WHERE id = new_general_manager_id;
        IF NOT FOUND OR v_candidate.status <> 'ACTIVE' THEN
            RAISE EXCEPTION 'The selected General Manager must be an active profile.';
        END IF;
    END IF;

    -- Repoint routing to its final state in one statement — no transient
    -- half-updated routing row exists at any point.
    UPDATE company_approval_routing
        SET technical_manager_id = v_final_tm,
            general_manager_id = v_final_gm,
            updated_at = now(),
            updated_by = auth.uid()
        WHERE id = 1;

    -- Demote only whoever is leaving BOTH slots entirely — routing above no
    -- longer references them, so this passes the companion trigger.
    IF v_current_tm IS NOT NULL AND v_current_tm <> v_final_tm AND v_current_tm <> v_final_gm THEN
        UPDATE profiles SET role = 'MANAGER' WHERE id = v_current_tm;
    END IF;
    IF v_current_gm IS NOT NULL AND v_current_gm <> v_final_tm AND v_current_gm <> v_final_gm THEN
        UPDATE profiles SET role = 'MANAGER' WHERE id = v_current_gm;
    END IF;

    IF v_final_tm IS NOT NULL THEN
        UPDATE profiles SET role = 'TECH_MANAGER' WHERE id = v_final_tm;
    END IF;
    IF v_final_gm IS NOT NULL THEN
        UPDATE profiles SET role = 'GM' WHERE id = v_final_gm;
    END IF;

    INSERT INTO audit_logs (actor_id, action, table_name, record_id, metadata)
    VALUES (
        auth.uid(), 'set_approval_routing', 'company_approval_routing', NULL,
        jsonb_build_object(
            'new_technical_manager_id', v_final_tm,
            'new_general_manager_id', v_final_gm,
            'previous_technical_manager_id', v_current_tm,
            'previous_general_manager_id', v_current_gm
        )
    );

    SELECT * INTO v_routing FROM company_approval_routing WHERE id = 1;
    RETURN v_routing;
END;
$$;

REVOKE EXECUTE ON FUNCTION set_approval_routing(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION set_approval_routing(uuid, uuid) TO authenticated;
