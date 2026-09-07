-- Fix: a requester must never appear as an approver in their own request.
--
-- INVESTIGATION: build_approval_chain's dedup array (v_seen) has always
-- been seeded as `ARRAY[p_employee_id]` (unchanged since its original
-- migration, 20260906130700), so the requester's own id is already present
-- in v_seen before the candidate loop ever runs. Direct live verification
-- against the real Technical Manager profile (TEST001, whose own direct
-- manager is the General Manager) confirms build_approval_chain currently
-- already returns [General Manager] only for that account, with no
-- Technical Manager stage — the literal "Technical Manager → General
-- Manager → Technical Manager" chain described could not be reproduced
-- against the current live function and current live data. The frontend
-- mirror (buildApprovalChain in store.ts) has the identical protection —
-- `seen = new Set([employeeId])`.
--
-- However, that protection is IMPLICIT: it exists only because v_seen
-- happens to be seeded with the requester's id, a detail a future change to
-- the dedup mechanism could silently drop without anyone noticing the
-- self-approval protection went with it. Per the non-negotiable rule that a
-- requester must never be their own approver, this migration makes the
-- exclusion an explicit, independent guard clause — not merely a side
-- effect of how deduplication happens to be implemented — and backs it
-- with a schema-level trigger so the invariant holds regardless of which
-- function inserts request_approvals rows in the future. This mirrors the
-- same defense-in-depth approach as request_approvals_gm_final_stage
-- (20260906170500, left entirely unmodified by this migration).
--
-- Three changes:
--
-- 1. build_approval_chain: an explicit
--        IF v_candidate_id = p_employee_id THEN CONTINUE; END IF;
--    immediately after the NULL check, before the v_seen dedup check —
--    matching the requested algorithm shape exactly (skip NULL, skip self,
--    skip duplicate, add, stop at GM). v_seen keeps its existing seed and
--    the existing GM-final-stage EXIT rule (20260906170300) is untouched.
--    No signature change — p_employee_id already *is* the requester id;
--    every caller (submit_leave_request, submit_mission_request) already
--    passes it and needs no change.
--
-- 2. submit_permission_request: Permission is single-stage and never calls
--    build_approval_chain — its one approval row is built directly from
--    v_employee.manager_id. A requester who is somehow their own manager_id
--    (a data-integrity anomaly; nothing in this schema prevents
--    profiles.manager_id = profiles.id, and set_approval_routing/
--    hr_create_employee do not check for it) would otherwise produce
--    exactly the forbidden approver_id = requester_id row. Adds an
--    explicit guard raising a clear error instead. This is the "at
--    minimum" guarantee requested for Permission.
--
-- 3. New trigger request_approvals_no_self_approval (BEFORE INSERT on
--    request_approvals, alongside the existing request_approvals_gm_final_stage
--    trigger — both additive, neither alters the other): rejects any
--    inserted row whose approver_id equals the parent request's
--    employee_id. This is the hard, schema-level backstop — it holds even
--    for a hypothetical future insertion path that bypasses
--    build_approval_chain and submit_permission_request entirely.
--
-- GM self-submission (investigated separately, see report): submit_leave_request,
-- submit_mission_request and submit_permission_request all already
-- RAISE EXCEPTION 'No active manager assigned. Contact HR.' before ever
-- reaching chain construction, whenever v_employee.manager_id IS NULL — and
-- the General Manager is the one role in this schema whose manager_id is
-- always NULL (confirmed live: PH6AMGR1/Hassan Ahmed, manager_id = NULL).
-- So a GM's self-submission already fails cleanly today, for every request
-- type, without ever creating a GM → GM row — no code change was needed for
-- that path, and none is made here. No new approver role is introduced.
--
-- No historical data is touched: no UPDATE/DELETE against requests or
-- request_approvals appears anywhere in this migration. REQ-00003 and
-- REQ-00004 are unaffected.

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

        IF v_candidate_id IS NULL THEN
            CONTINUE;
        END IF;

        -- Non-negotiable: a requester must never appear as an approver in
        -- their own request. Explicit and independent of the v_seen dedup
        -- below — this holds even if a future change alters how v_seen is
        -- seeded or initialized.
        IF v_candidate_id = p_employee_id THEN
            CONTINUE;
        END IF;

        IF v_candidate_id = ANY(v_seen) THEN
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

        -- General Manager is always the final stage — see 20260906170300.
        IF v_profile.role = 'GM' THEN
            EXIT;
        END IF;
    END LOOP;

    RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION submit_permission_request(
    p_permission_kind text,
    p_date date,
    p_minutes integer,
    p_reason text DEFAULT NULL
)
RETURNS requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_employee_id uuid := auth.uid();
    v_employee profiles%ROWTYPE;
    v_manager profiles%ROWTYPE;
    v_new_request requests%ROWTYPE;
    v_balance RECORD;
    v_title text;
BEGIN
    IF v_employee_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    SELECT * INTO v_employee FROM profiles WHERE id = v_employee_id;
    IF NOT FOUND OR v_employee.status <> 'ACTIVE' THEN
        RAISE EXCEPTION 'Your account is inactive. Contact HR.';
    END IF;

    IF v_employee.manager_id IS NULL THEN
        RAISE EXCEPTION 'No active manager assigned. Contact HR.';
    END IF;
    SELECT * INTO v_manager FROM profiles WHERE id = v_employee.manager_id;
    IF NOT FOUND OR v_manager.status <> 'ACTIVE' OR v_manager.role NOT IN ('MANAGER', 'TECH_MANAGER', 'GM') THEN
        RAISE EXCEPTION 'No active manager assigned. Contact HR.';
    END IF;

    -- Non-negotiable: a requester must never be their own approver.
    -- Permission is single-stage and never calls build_approval_chain, so
    -- this is not covered by that function's own exclusion above — it is
    -- possible only via a data-integrity anomaly (profiles.manager_id
    -- pointing at the same row), but the guard costs nothing and closes
    -- the "at minimum, approver_id = requester_id must never be creatable"
    -- requirement explicitly for this path.
    IF v_manager.id = v_employee_id THEN
        RAISE EXCEPTION 'You cannot be your own approver. Contact HR to correct your manager assignment.';
    END IF;

    IF p_permission_kind NOT IN ('LATE_ARRIVAL', 'EARLY_DEPARTURE') THEN
        RAISE EXCEPTION 'Choose late arrival or early departure.';
    END IF;
    IF p_date IS NULL THEN
        RAISE EXCEPTION 'Date is required.';
    END IF;
    IF p_minutes IS NULL OR p_minutes <= 0 THEN
        RAISE EXCEPTION 'Enter how many minutes you need.';
    END IF;
    IF p_minutes > 240 THEN
        RAISE EXCEPTION 'A single permission cannot exceed 240 minutes.';
    END IF;

    -- Serializes concurrent submissions for the same employee/date. There is
    -- no DB-level exclusion constraint for permission requests (only leave
    -- has one, per the approved plan) — this advisory lock is what actually
    -- closes the "one permission per day" race under concurrency.
    PERFORM pg_advisory_xact_lock(hashtext(v_employee_id::text), hashtext(p_date::text));

    IF EXTRACT(DOW FROM p_date) IN (5, 6) OR EXISTS (SELECT 1 FROM public_holidays WHERE date = p_date) THEN
        RAISE EXCEPTION 'That day is a weekend or a public holiday.';
    END IF;

    IF EXISTS (
        SELECT 1 FROM requests
        WHERE employee_id = v_employee_id AND type = 'PERMISSION'
          AND status IN ('PENDING', 'APPROVED') AND start_date = p_date
    ) THEN
        RAISE EXCEPTION 'You already have a permission for that day.';
    END IF;

    SELECT * INTO v_balance FROM get_permission_balance(v_employee_id, to_char(p_date, 'YYYY-MM'));
    IF v_balance.remaining <= 0 THEN
        RAISE EXCEPTION 'Your permission allowance for % is used up. You cannot request more this month.', to_char(p_date, 'YYYY-MM');
    ELSIF p_minutes > v_balance.remaining THEN
        RAISE EXCEPTION 'Only % minutes of your monthly permission allowance remain.', v_balance.remaining;
    END IF;

    INSERT INTO requests (
        employee_id, employee_name, type, manager_id, manager_name,
        permission_kind, permission_minutes, start_date, end_date, reason
    ) VALUES (
        v_employee_id, v_employee.name, 'PERMISSION', v_manager.id, v_manager.name,
        p_permission_kind, p_minutes, p_date, p_date, NULLIF(btrim(COALESCE(p_reason, '')), '')
    )
    RETURNING * INTO v_new_request;

    -- Single-stage chain: the direct manager only, labeled by their real
    -- role, same convention as build_approval_chain.
    v_title := CASE v_manager.role
                   WHEN 'MANAGER' THEN 'Direct Manager'
                   WHEN 'TECH_MANAGER' THEN 'Technical Manager'
                   WHEN 'GM' THEN 'General Manager'
                   ELSE v_manager.role
               END;

    INSERT INTO request_approvals (request_id, stage, role, title, approver_id, approver_name)
    VALUES (v_new_request.id, 1, v_manager.role, v_title, v_manager.id, v_manager.name);

    INSERT INTO notifications (user_id, type, request_id, message)
    VALUES (
        v_manager.id, 'REQUEST_SUBMITTED', v_new_request.id,
        format('%s requested %s (%s minutes) for your approval.',
               v_employee.name,
               lower(CASE p_permission_kind WHEN 'LATE_ARRIVAL' THEN 'Late arrival' ELSE 'Early departure' END),
               p_minutes)
    );

    RETURN v_new_request;
END;
$$;

-- Schema-level backstop: no request_approvals row may ever be inserted
-- whose approver_id equals the parent request's own employee_id, for any
-- reason, regardless of which function performs the insert. Purely
-- additive alongside request_approvals_gm_final_stage (20260906170500) —
-- neither trigger touches what the other guards.
CREATE FUNCTION enforce_no_self_approval()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_employee_id uuid;
BEGIN
    SELECT employee_id INTO v_employee_id FROM requests WHERE id = NEW.request_id;
    IF v_employee_id = NEW.approver_id THEN
        RAISE EXCEPTION 'A requester cannot be an approver of their own request.';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER request_approvals_no_self_approval
    BEFORE INSERT ON request_approvals
    FOR EACH ROW
    EXECUTE FUNCTION enforce_no_self_approval();
