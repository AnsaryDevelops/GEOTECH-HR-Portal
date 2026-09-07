-- Phase 6B-8 correction — General-Manager-as-Direct-Manager approval chain.
--
-- INVESTIGATION SUMMARY (see accompanying report for the full trace):
-- build_approval_chain (fixed in 20260906170300_fix_build_approval_chain_gm_final_stage.sql,
-- confirmed live via pg_get_functiondef) already stops the moment a GM-role
-- candidate is added, for every caller (submit_leave_request,
-- submit_mission_request — both confirmed live to call build_approval_chain
-- directly, not a duplicated/stale copy of its logic). decide_request never
-- inserts new request_approvals rows — it only UPDATEs existing ones and
-- reads MIN(stage) WHERE status = 'PENDING' — so it cannot reintroduce a
-- Technical Manager stage after a General Manager stage under any code path
-- available today. Live testing of all four required scenarios (direct
-- manager = plain Manager, = Technical Manager, = General Manager, and HR
-- whose direct manager = General Manager) against build_approval_chain
-- confirms correct output in every case. There is no live bug in the
-- functions covered by this investigation.
--
-- REQ-00003 (Ali Mahmoud, PH6AEMP1) is the one visible example of the
-- wrong [GM, TECH_MANAGER] chain — it predates the 20260906170300 fix and
-- is explicitly preserved as historical data; this migration does not
-- touch it (no UPDATE/DELETE against requests or request_approvals here).
--
-- THIS MIGRATION: the fix above is entirely in application code
-- (build_approval_chain's own PL/pgSQL loop). Per the explicit instruction
-- to make the invariant explicit rather than rely solely on that one
-- function's internal control flow, this adds a schema-level guard: no
-- request_approvals row may ever be inserted for a request that already has
-- a General Manager stage. This converts "the current implementation of
-- build_approval_chain happens to stop at GM" into a constraint the
-- database itself enforces regardless of which function performs the
-- INSERT — a regression introduced by any future change to
-- build_approval_chain, or a wholly different insertion path added later,
-- fails loudly with a clear error instead of silently producing an invalid
-- chain.
--
-- Scope: BEFORE INSERT only. decide_request's own writes are all UPDATEs
-- against already-existing rows, never INSERTs, so this trigger never fires
-- for an approval decision — only at chain-construction time, exactly where
-- the invariant actually needs to hold. Existing historical rows (including
-- REQ-00003's) are never evaluated by this trigger, since it only runs on
-- new inserts.

CREATE FUNCTION enforce_gm_final_approval_stage()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM request_approvals
        WHERE request_id = NEW.request_id
          AND role = 'GM'
          AND stage < NEW.stage
    ) THEN
        RAISE EXCEPTION 'The General Manager must be the final approval stage — no stage may follow it.';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER request_approvals_gm_final_stage
    BEFORE INSERT ON request_approvals
    FOR EACH ROW
    EXECUTE FUNCTION enforce_gm_final_approval_stage();
