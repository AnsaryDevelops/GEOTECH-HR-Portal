-- Corrective migration on top of 20260906150300_rpc_submit_mission_request.sql
-- (already committed as 387c2a4) — does not edit that file.
--
-- That function's own datetime check (`(p_end_date + p_end_time) <=
-- (p_start_date + p_start_time)`) was already correct. It also added a
-- second, overly strict check — `p_end_time <= p_start_time` — specifically
-- to pre-empt the (now-corrected, see 20260906151000) defective
-- requests_time_order_check DB constraint, which compared bare TIME values
-- regardless of date. With that constraint corrected to compare full
-- datetimes, this second check is no longer just redundant — it is wrong: it
-- would still reject a valid overnight mission (e.g. 22:00 -> 02:00) that
-- the database now correctly accepts. Removed; the single full-datetime
-- check that was already present is sufficient and correct on its own.
--
-- CREATE OR REPLACE preserves the function's existing ownership and EXECUTE
-- grant (already REVOKEd from PUBLIC / GRANTed to authenticated in the
-- original migration) — neither needs to be repeated here.

CREATE OR REPLACE FUNCTION submit_mission_request(
    p_start_date date,
    p_start_time time,
    p_end_date date,
    p_end_time time,
    p_location text,
    p_purpose text
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

    IF v_employee.manager_id IS NULL THEN
        RAISE EXCEPTION 'No active manager assigned. Contact HR.';
    END IF;
    SELECT * INTO v_manager FROM profiles WHERE id = v_employee.manager_id;
    IF NOT FOUND OR v_manager.status <> 'ACTIVE' OR v_manager.role NOT IN ('MANAGER', 'TECH_MANAGER', 'GM') THEN
        RAISE EXCEPTION 'No active manager assigned. Contact HR.';
    END IF;

    IF p_start_date IS NULL THEN RAISE EXCEPTION 'Start Date is required.'; END IF;
    IF p_start_time IS NULL THEN RAISE EXCEPTION 'Start Time is required.'; END IF;
    IF p_end_date IS NULL THEN RAISE EXCEPTION 'End Date is required.'; END IF;
    IF p_end_time IS NULL THEN RAISE EXCEPTION 'End Time is required.'; END IF;
    IF btrim(COALESCE(p_location, '')) = '' THEN RAISE EXCEPTION 'Location is required.'; END IF;
    IF btrim(COALESCE(p_purpose, '')) = '' THEN RAISE EXCEPTION 'Purpose is required.'; END IF;

    -- Full datetime comparison — correct for a mission spanning midnight,
    -- and matches requests_datetime_order_check (20260906151000) exactly, so
    -- nothing that passes here can fail the DB constraint on insert.
    IF (p_end_date + p_end_time) <= (p_start_date + p_start_time) THEN
        RAISE EXCEPTION 'End date/time must be after Start date/time.';
    END IF;

    INSERT INTO requests (
        employee_id, employee_name, type, manager_id, manager_name,
        start_date, start_time, end_date, end_time, location, purpose
    ) VALUES (
        v_employee_id, v_employee.name, 'MISSION', v_manager.id, v_manager.name,
        p_start_date, p_start_time, p_end_date, p_end_time, btrim(p_location), btrim(p_purpose)
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
        format('%s submitted a Mission request for your approval.', v_employee.name)
    );

    RETURN v_new_request;
END;
$$;
