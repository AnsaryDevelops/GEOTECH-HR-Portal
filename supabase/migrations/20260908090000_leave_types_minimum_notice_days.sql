-- Phase 2: minimum advance-notice policy for Leave requests, per Leave Type.
--
-- HR-configurable rather than hardcoded: a new leave_types.minimum_notice_days
-- column (default 0, meaning "no restriction" — Emergency/Sick-style urgent
-- leave). submit_leave_request enforces it server-side against the
-- authoritative leave_types row for the selected type; the frontend mirrors
-- the same check for immediate feedback, but the RPC is the real boundary —
-- a client cannot bypass it by calling the RPC directly with a doctored
-- start date.
--
-- Existing production Leave Types were inspected before assigning values —
-- Annual Leave and Emergency Leave map directly to the stated policy
-- (planned annual leave = 14 days, urgent/exempt = 0 days); Maternity Leave
-- is normally planned as far ahead as Annual Leave; Sick Leave is
-- inherently unplannable and must be exempt like Emergency Leave;
-- Paternity Leave and Unpaid Leave default to the shorter "other normal
-- leave" tier (2 days). No other leave_types data, no requests, no
-- approvals, no attendance, and no approval routing are touched.

ALTER TABLE leave_types
    ADD COLUMN minimum_notice_days integer NOT NULL DEFAULT 0;

ALTER TABLE leave_types
    ADD CONSTRAINT leave_types_minimum_notice_days_check CHECK (minimum_notice_days >= 0);

COMMENT ON COLUMN leave_types.minimum_notice_days IS
    'Minimum whole days required between submission and the leave''s start date, enforced by submit_leave_request. 0 = no advance-notice restriction (e.g. Emergency/Sick Leave).';

-- Backfill existing production rows per the confirmed policy mapping.
UPDATE leave_types SET minimum_notice_days = 14 WHERE name IN ('Annual Leave', 'Maternity Leave');
UPDATE leave_types SET minimum_notice_days = 2 WHERE name IN ('Paternity Leave', 'Unpaid Leave');
UPDATE leave_types SET minimum_notice_days = 0 WHERE name IN ('Emergency Leave', 'Sick Leave');
-- Any other/future leave type keeps the column default (0, unrestricted)
-- until HR explicitly sets a value via the Leave Types settings UI.

-- submit_leave_request: additive notice-period check only. Everything else
-- (manager/account checks, overlap, balance, working-day calculation,
-- approval chain, notifications) is byte-for-byte unchanged from
-- 20260906150200_rpc_submit_leave_request.sql.
CREATE OR REPLACE FUNCTION submit_leave_request(
    p_leave_type_id uuid,
    p_start_date date,
    p_end_date date,
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
    v_leave_type leave_types%ROWTYPE;
    v_working_days integer := NULL;
    v_balance RECORD;
    v_new_request requests%ROWTYPE;
    v_chain RECORD;
    v_stage_count integer := 0;
BEGIN
    IF v_employee_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    SELECT * INTO v_employee FROM profiles WHERE id = v_employee_id;
    IF NOT FOUND OR v_employee.status <> 'ACTIVE' THEN
        RAISE EXCEPTION 'Your account is inactive. Contact HR.';
    END IF;

    -- Active direct manager is required — checked explicitly and separately
    -- from chain-building, matching the existing approved frontend behavior
    -- (createLeaveRequest), not just "chain is non-empty."
    IF v_employee.manager_id IS NULL THEN
        RAISE EXCEPTION 'No active manager assigned. Contact HR.';
    END IF;
    SELECT * INTO v_manager FROM profiles WHERE id = v_employee.manager_id;
    IF NOT FOUND OR v_manager.status <> 'ACTIVE' OR v_manager.role NOT IN ('MANAGER', 'TECH_MANAGER', 'GM') THEN
        RAISE EXCEPTION 'No active manager assigned. Contact HR.';
    END IF;

    IF p_start_date IS NULL OR p_end_date IS NULL THEN
        RAISE EXCEPTION 'Start Date and End Date are required.';
    END IF;
    IF p_end_date < p_start_date THEN
        RAISE EXCEPTION 'End Date cannot be before Start Date.';
    END IF;

    SELECT * INTO v_leave_type FROM leave_types WHERE id = p_leave_type_id AND status = 'ACTIVE';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Selected leave type is not available.';
    END IF;

    -- Minimum advance-notice policy (Phase 2) — applies to the START DATE
    -- only, never the requested duration. 0 means no restriction, so
    -- Emergency/Sick-style urgent leave types are unaffected without
    -- hardcoding their names.
    IF v_leave_type.minimum_notice_days > 0
       AND p_start_date < (CURRENT_DATE + v_leave_type.minimum_notice_days) THEN
        RAISE EXCEPTION '% must be requested at least % days in advance.',
            v_leave_type.name, v_leave_type.minimum_notice_days;
    END IF;

    -- Overlap, layer 1: the readable rejection message, scoped to this
    -- employee's own PENDING/APPROVED leave requests. Layer 2 — the
    -- requests_no_overlapping_leave EXCLUDE constraint (Phase 2) — is the
    -- airtight, race-proof backstop underneath this; both are required by
    -- the approved plan (§9, §13.4).
    IF EXISTS (
        SELECT 1 FROM requests
        WHERE employee_id = v_employee_id
          AND type = 'LEAVE'
          AND status IN ('PENDING', 'APPROVED')
          AND p_start_date <= end_date AND p_end_date >= start_date
    ) THEN
        RAISE EXCEPTION 'Dates overlap with an existing leave request.';
    END IF;

    IF v_leave_type.balance_key IS NOT NULL THEN
        v_working_days := count_working_days(p_start_date, p_end_date);
        IF v_working_days = 0 THEN
            RAISE EXCEPTION 'That range contains no working days. Weekends and public holidays do not count.';
        END IF;

        SELECT * INTO v_balance FROM get_leave_balance(v_employee_id, v_leave_type.balance_key, extract(year FROM p_start_date)::int);
        IF v_working_days > v_balance.remaining THEN
            RAISE EXCEPTION 'That is % working days, but only % of your % balance remain.',
                v_working_days, GREATEST(v_balance.remaining, 0),
                CASE v_leave_type.balance_key WHEN 'ANNUAL' THEN 'annual leave' ELSE 'casual leave' END;
        END IF;
    END IF;

    INSERT INTO requests (
        employee_id, employee_name, type, manager_id, manager_name,
        leave_type_id, leave_type_name, balance_key, working_days,
        start_date, end_date, reason
    ) VALUES (
        v_employee_id, v_employee.name, 'LEAVE', v_manager.id, v_manager.name,
        v_leave_type.id, v_leave_type.name, v_leave_type.balance_key, v_working_days,
        p_start_date, p_end_date, NULLIF(btrim(COALESCE(p_reason, '')), '')
    )
    RETURNING * INTO v_new_request;

    FOR v_chain IN SELECT * FROM build_approval_chain(v_employee_id) LOOP
        v_stage_count := v_stage_count + 1;
        INSERT INTO request_approvals (request_id, stage, role, title, approver_id, approver_name)
        VALUES (v_new_request.id, v_chain.stage, v_chain.role, v_chain.title, v_chain.approver_id, v_chain.approver_name);
    END LOOP;

    IF v_stage_count = 0 THEN
        RAISE EXCEPTION 'No approval chain is configured. Contact HR.';
    END IF;

    INSERT INTO notifications (user_id, type, request_id, message)
    VALUES (
        v_manager.id, 'REQUEST_SUBMITTED', v_new_request.id,
        format('%s submitted a %s request for your approval.', v_employee.name, v_leave_type.name)
    );

    RETURN v_new_request;
END;
$$;
