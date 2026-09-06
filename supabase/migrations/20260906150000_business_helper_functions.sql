-- Phase 4: internal business-logic helpers used by the transactional RPCs.
--
-- None of these are granted to `authenticated` or `anon` — they are never
-- meant to be called directly by a client, only from inside the SECURITY
-- DEFINER RPCs in later migrations, which already run as an elevated owner
-- and so can call them regardless of grants. Calling get_leave_balance or
-- get_permission_balance directly would let a client probe another
-- employee's balance figures by passing an arbitrary profile id — keeping
-- these ungranted is what prevents that, not anything inside the functions
-- themselves.
--
-- None are SECURITY DEFINER: a function called only from within another
-- SECURITY DEFINER function already executes under that outer function's
-- elevated context (Postgres's ordinary nested-call semantics), so marking
-- these SECURITY DEFINER too would add nothing except a second thing to
-- audit. STABLE throughout — every one is a pure read.

-- count_working_days: Sunday-Thursday work week, excluding public_holidays,
-- inclusive of both ends. Direct SQL port of countWorkingDays/isWorkingDay
-- (02-SOURCE/frontend/src/lib/store.ts).
CREATE FUNCTION count_working_days(p_start date, p_end date)
RETURNS integer
LANGUAGE sql
STABLE
SET search_path = public
AS $$
    SELECT count(*)::int
    FROM generate_series(p_start, p_end, interval '1 day') AS d(day)
    WHERE EXTRACT(DOW FROM d.day) NOT IN (5, 6)
      AND NOT EXISTS (SELECT 1 FROM public_holidays h WHERE h.date = d.day::date);
$$;

REVOKE EXECUTE ON FUNCTION count_working_days(date, date) FROM PUBLIC;

-- get_leave_balance: entitlement from the year-matched leave_allocations row;
-- used/held summed from the employee's own requests for the same bucket and
-- calendar year. Computed on read, never a stored running counter — port of
-- getLeaveBalance (§9).
CREATE FUNCTION get_leave_balance(p_profile_id uuid, p_bucket text, p_year integer)
RETURNS TABLE (entitlement integer, used_days integer, held_days integer, remaining integer)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
    v_entitlement integer;
    v_used integer;
    v_held integer;
BEGIN
    SELECT allocated_days INTO v_entitlement
    FROM leave_allocations
    WHERE profile_id = p_profile_id AND bucket = p_bucket AND year = p_year;
    v_entitlement := COALESCE(v_entitlement, 0);

    SELECT COALESCE(sum(working_days), 0) INTO v_used
    FROM requests
    WHERE employee_id = p_profile_id AND type = 'LEAVE' AND balance_key = p_bucket
      AND status = 'APPROVED' AND extract(year FROM start_date)::int = p_year;

    SELECT COALESCE(sum(working_days), 0) INTO v_held
    FROM requests
    WHERE employee_id = p_profile_id AND type = 'LEAVE' AND balance_key = p_bucket
      AND status = 'PENDING' AND extract(year FROM start_date)::int = p_year;

    RETURN QUERY SELECT v_entitlement, v_used, v_held, (v_entitlement - v_used - v_held);
END;
$$;

REVOKE EXECUTE ON FUNCTION get_leave_balance(uuid, text, integer) FROM PUBLIC;

-- get_permission_balance: nets attendance-derived lateness/early-departure
-- (floored at zero per day, after subtracting minutes already excused by an
-- approved permission on that same date) against the monthly allowance,
-- alongside approved/pending PERMISSION requests for the month. Port of
-- getPermissionBalance/approvedPermissionMinutesOn (§9). p_month is
-- 'YYYY-MM', matching the frontend's monthKey().
CREATE FUNCTION get_permission_balance(p_profile_id uuid, p_month text)
RETURNS TABLE (allowance integer, used_minutes integer, held_minutes integer, remaining integer)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
    v_allowance integer;
    v_from_attendance integer;
    v_from_requests integer;
    v_held integer;
BEGIN
    SELECT permission_minutes_per_month INTO v_allowance FROM profiles WHERE id = p_profile_id;
    v_allowance := COALESCE(v_allowance, 0);

    SELECT COALESCE(sum(
        GREATEST(0,
            GREATEST(0, CASE WHEN a.check_in IS NOT NULL
                             THEN EXTRACT(EPOCH FROM (a.check_in - TIME '09:00')) / 60
                             ELSE 0 END)
          + GREATEST(0, CASE WHEN a.check_out IS NOT NULL
                             THEN EXTRACT(EPOCH FROM (TIME '17:00' - a.check_out)) / 60
                             ELSE 0 END)
          - COALESCE((
                SELECT sum(r.permission_minutes) FROM requests r
                WHERE r.employee_id = p_profile_id AND r.type = 'PERMISSION'
                  AND r.status = 'APPROVED' AND r.start_date = a.date
            ), 0)
        )
    ), 0)::int INTO v_from_attendance
    FROM attendance a
    WHERE a.employee_id = p_profile_id AND to_char(a.date, 'YYYY-MM') = p_month;

    SELECT COALESCE(sum(permission_minutes), 0) INTO v_from_requests
    FROM requests
    WHERE employee_id = p_profile_id AND type = 'PERMISSION' AND status = 'APPROVED'
      AND to_char(start_date, 'YYYY-MM') = p_month;

    SELECT COALESCE(sum(permission_minutes), 0) INTO v_held
    FROM requests
    WHERE employee_id = p_profile_id AND type = 'PERMISSION' AND status = 'PENDING'
      AND to_char(start_date, 'YYYY-MM') = p_month;

    RETURN QUERY SELECT
        v_allowance,
        (v_from_attendance + v_from_requests),
        v_held,
        GREATEST(0, v_allowance - (v_from_attendance + v_from_requests) - v_held);
END;
$$;

REVOKE EXECUTE ON FUNCTION get_permission_balance(uuid, text) FROM PUBLIC;

-- build_approval_chain: direct manager, then company_approval_routing's
-- Technical Manager, then its General Manager — each looked up, required
-- ACTIVE, and skipped if inactive or already seen (a department manager
-- whose own direct manager IS the technical manager is only asked once; the
-- requester is never their own approver). The chain is labeled by each
-- approver's real role (ROLE_LABEL), not by the slot they fill — port of
-- buildApprovalChain (§5.0, §5.1-5.2).
CREATE FUNCTION build_approval_chain(p_employee_id uuid)
RETURNS TABLE (stage smallint, role text, title text, approver_id uuid, approver_name text)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
    v_seen uuid[] := ARRAY[p_employee_id];
    v_stage smallint := 0;
    v_direct_manager_id uuid;
    v_tech_manager_id uuid;
    v_gm_id uuid;
    v_candidates uuid[];
    v_candidate_id uuid;
    v_profile profiles%ROWTYPE;
    i integer;
BEGIN
    SELECT manager_id INTO v_direct_manager_id FROM profiles WHERE id = p_employee_id;
    SELECT technical_manager_id, general_manager_id
        INTO v_tech_manager_id, v_gm_id
        FROM company_approval_routing WHERE id = 1;

    v_candidates := ARRAY[v_direct_manager_id, v_tech_manager_id, v_gm_id];

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

REVOKE EXECUTE ON FUNCTION build_approval_chain(uuid) FROM PUBLIC;
