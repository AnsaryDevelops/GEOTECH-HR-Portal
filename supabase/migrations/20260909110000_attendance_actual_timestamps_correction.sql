-- Corrective migration for 20260909100000_attendance_excel_import.sql.
--
-- PROBLEM: that migration made hr_import_attendance synthesize
-- check_in = 09:00 + late / check_out = 17:00 - early, discarding the
-- Excel's actual Clock In/Clock Out and its OT Time column entirely.
-- attendance.check_in/check_out must always be the real punch time —
-- Attendance is the source of truth for attendance; Permission accounting
-- is a derived calculation, not something attendance timestamps should be
-- distorted to serve.
--
-- Live attendance table has 0 rows and 0 hr_import_attendance audit_logs
-- entries (verified before writing this migration) — nothing to backfill,
-- nothing to roll back. This migration only ADDs columns and REPLACEs two
-- function bodies; the additive `source` column from 20260909100000 is
-- correct and untouched.
--
-- FIX: attendance now stores late_minutes/early_minutes/overtime_minutes
-- explicitly, alongside real check_in/check_out:
--   - IMPORT rows: late_minutes/early_minutes/overtime_minutes come
--     verbatim from the Excel's own Late/Early/OT Time columns (never
--     re-derived from Clock In/Clock Out) — set by hr_import_attendance,
--     itself SECURITY DEFINER + is_hr()-gated, the trusted authority for
--     that path.
--   - MANUAL rows: late_minutes/early_minutes must be authoritative and
--     server-derived from check_in/check_out vs the fixed 09:00/17:00
--     workday, so a client cannot submit check_in=09:30, late_minutes=0
--     and dodge the deduction. recordAttendance's real path is a plain
--     RLS-protected table upsert, not an RPC — the smallest mechanism that
--     makes the server (not the client) authoritative there is a BEFORE
--     INSERT OR UPDATE trigger that recomputes late_minutes/early_minutes
--     from NEW.check_in/NEW.check_out whenever NEW.source = 'MANUAL',
--     overwriting anything the client tried to send. IMPORT rows are
--     untouched by the trigger (source <> 'MANUAL').
--
-- get_permission_balance's per-day "raw" lateness/early-departure figure
-- changes from deriving off check_in/check_out vs fixed times, to reading
-- late_minutes + early_minutes directly. Every other part of that
-- function — the per-day floor at 0, subtracting same-date approved-
-- Permission-request minutes, the monthly sum, combining with
-- fromRequests/held, the final GREATEST(0, allowance - used - held) — is
-- byte-for-byte unchanged. Still the one authoritative Permission balance
-- calculation; still called from the same places (submit_permission_request
-- included) with no changes needed there.

ALTER TABLE attendance
    ADD COLUMN late_minutes     INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN early_minutes    INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN overtime_minutes INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN attendance.late_minutes IS
    'Authoritative Permission-accounting input. IMPORT rows: verbatim from the Excel Late column. MANUAL rows: server-derived by attendance_derive_manual_minutes_trg from check_in vs 09:00 — never client-supplied.';
COMMENT ON COLUMN attendance.early_minutes IS
    'Authoritative Permission-accounting input. IMPORT rows: verbatim from the Excel Early column. MANUAL rows: server-derived by attendance_derive_manual_minutes_trg from check_out vs 17:00 — never client-supplied.';
COMMENT ON COLUMN attendance.overtime_minutes IS
    'Reporting only. Never read by get_permission_balance. Always 0 for MANUAL rows (no overtime concept in manual entry).';

-- Server-side authority for MANUAL late/early — see migration header.
CREATE FUNCTION attendance_derive_manual_minutes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF NEW.source = 'MANUAL' THEN
        NEW.late_minutes := GREATEST(0, CASE WHEN NEW.check_in IS NOT NULL
            THEN ROUND(EXTRACT(EPOCH FROM (NEW.check_in - TIME '09:00')) / 60)::int
            ELSE 0 END);
        NEW.early_minutes := GREATEST(0, CASE WHEN NEW.check_out IS NOT NULL
            THEN ROUND(EXTRACT(EPOCH FROM (TIME '17:00' - NEW.check_out)) / 60)::int
            ELSE 0 END);
        NEW.overtime_minutes := 0;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER attendance_derive_manual_minutes_trg
    BEFORE INSERT OR UPDATE ON attendance
    FOR EACH ROW
    EXECUTE FUNCTION attendance_derive_manual_minutes();

-- hr_import_attendance: now stores actual Clock In/Clock Out plus the
-- Excel's explicit late/early/overtime minutes, instead of synthesizing
-- timestamps. is_hr() gate, ON CONFLICT (employee_id, date) DO NOTHING,
-- audit_logs entry, and REVOKE/GRANT are all unchanged from
-- 20260909100000 — only the per-row INSERT payload and the jsonb row
-- shape change.
CREATE OR REPLACE FUNCTION hr_import_attendance(p_employee_id uuid, p_rows jsonb)
RETURNS TABLE (inserted_count integer, skipped_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_total integer;
    v_inserted integer;
BEGIN
    IF NOT is_hr() THEN
        RAISE EXCEPTION 'Only HR can import attendance.';
    END IF;

    IF p_employee_id IS NULL OR NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_employee_id) THEN
        RAISE EXCEPTION 'Employee not found.';
    END IF;

    IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
        RAISE EXCEPTION 'No attendance rows to import.';
    END IF;

    v_total := jsonb_array_length(p_rows);
    IF v_total = 0 THEN
        RETURN QUERY SELECT 0, 0;
        RETURN;
    END IF;

    WITH parsed AS (
        SELECT
            (r->>'date')::date AS date,
            NULLIF(r->>'clock_in', '')::time AS clock_in,
            NULLIF(r->>'clock_out', '')::time AS clock_out,
            GREATEST(0, COALESCE((r->>'late_minutes')::int, 0)) AS late_minutes,
            GREATEST(0, COALESCE((r->>'early_minutes')::int, 0)) AS early_minutes,
            GREATEST(0, COALESCE((r->>'overtime_minutes')::int, 0)) AS overtime_minutes
        FROM jsonb_array_elements(p_rows) AS r
    ),
    ins AS (
        INSERT INTO attendance (
            employee_id, date, check_in, check_out,
            late_minutes, early_minutes, overtime_minutes,
            source, recorded_by
        )
        SELECT
            p_employee_id, parsed.date, parsed.clock_in, parsed.clock_out,
            parsed.late_minutes, parsed.early_minutes, parsed.overtime_minutes,
            'IMPORT', auth.uid()
        FROM parsed
        ON CONFLICT (employee_id, date) DO NOTHING
        RETURNING id
    )
    SELECT count(*) INTO v_inserted FROM ins;

    INSERT INTO audit_logs (actor_id, action, table_name, record_id, metadata)
    VALUES (
        auth.uid(), 'hr_import_attendance', 'attendance', p_employee_id,
        jsonb_build_object('rows_in_file', v_total, 'inserted', v_inserted, 'skipped', v_total - v_inserted)
    );

    RETURN QUERY SELECT v_inserted, (v_total - v_inserted);
END;
$$;

-- get_permission_balance: raw lateness/early-departure now reads the
-- stored late_minutes/early_minutes columns directly instead of deriving
-- them from check_in/check_out vs fixed 09:00/17:00. Everything else
-- (per-day floor, approved-Permission-request offset, monthly sum,
-- fromRequests/held, final remaining) is unchanged from 20260906150000.
CREATE OR REPLACE FUNCTION get_permission_balance(p_profile_id uuid, p_month text)
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
            COALESCE(a.late_minutes, 0) + COALESCE(a.early_minutes, 0)
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
