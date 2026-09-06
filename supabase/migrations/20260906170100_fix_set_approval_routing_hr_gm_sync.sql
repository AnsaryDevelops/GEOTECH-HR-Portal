-- Phase 6A.1 — HR Direct Manager = General Manager.
-- Corrective migration on top of 20260906150800_rpc_set_approval_routing.sql
-- (already committed) — does not edit that file.
--
-- profiles.manager_id remains the single source of truth for "who is HR's
-- Direct Manager" — no new column, no second source of truth. This function
-- is the one and only place the General Manager slot is ever written, so it
-- is also the one and only place that needs to keep every HR-role profile's
-- manager_id pointed at whoever currently holds that slot: immediately after
-- the GM's role is (re)confirmed as 'GM' below, every profile with
-- role = 'HR' is repointed to report to them. An HR account created before
-- any GM is configured simply keeps manager_id NULL until this function is
-- first called with a general_manager_id — the same "no active manager
-- assigned" state an ordinary employee is in before HR assigns one, not a
-- special case.
--
-- Only runs when v_final_gm is not null, so a routing call that leaves the
-- GM slot unchanged (both still NULL) is a no-op here, and a call that only
-- changes the Technical Manager slot safely re-applies the existing GM
-- assignment (idempotent). If the GM is being changed to someone new, this
-- re-points every HR profile to the new GM in the same statement — there is
-- no intermediate state where an HR profile points at a GM who no longer
-- holds the slot.
--
-- No separate HR hierarchy, no hr_manager_id, no second approval system —
-- this is exactly the same profiles.manager_id column every other approver
-- relationship already uses, kept in sync by the one function authorized to
-- change who the GM is. is_hr()'s existing check at the top of this
-- function is unchanged, so only HR may still trigger this sync (indirectly,
-- via changing the GM) — no new privilege is introduced.
--
-- CREATE OR REPLACE preserves the function's existing ownership and EXECUTE
-- grant — neither needs to be repeated here.

CREATE OR REPLACE FUNCTION set_approval_routing(
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

    -- HR's Direct Manager is always the current General Manager
    -- (Phase 6A.1) — profiles.manager_id is the only place this is stored.
    -- Runs after the promotion above so a former-HR account being promoted
    -- to GM has already lost role = 'HR' and is correctly excluded from its
    -- own sync.
    IF v_final_gm IS NOT NULL THEN
        UPDATE profiles SET manager_id = v_final_gm WHERE role = 'HR' AND id <> v_final_gm;
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
