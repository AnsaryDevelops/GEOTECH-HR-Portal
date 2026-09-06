-- Phase 4: submit_permission_request — PRODUCTION-BACKEND-PLAN.md §5.2.
-- One-stage workflow only: EMPLOYEE -> DIRECT MANAGER -> APPROVED/REJECTED.
-- Never routed through Technical Manager or General Manager.

CREATE FUNCTION submit_permission_request(
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

REVOKE EXECUTE ON FUNCTION submit_permission_request(text, date, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION submit_permission_request(text, date, integer, text) TO authenticated;
