-- Attendance Excel import: HR bulk-imports a fingerprint-device export
-- (.xls/.xlsx) for one employee. The table comment on `attendance`
-- (20260906130900) already anticipated this: "already supports a future
-- bulk Excel import via INSERT ... ON CONFLICT with zero schema change" —
-- the UNIQUE (employee_id, date) constraint is reused as-is as the
-- idempotency key. Only two additive things are genuinely missing:
--
--   1. A way to tell an imported row apart from a manually-entered one
--      (for the Records table's "Imported" badge and for support/audit
--      questions like "did HR type this or did it come from the device").
--   2. A transactional, HR-authorized entry point that inserts many rows
--      atomically and reports how many were new vs already present — the
--      client must not compute "0 new on re-import" itself and trust that.
--
-- ACCOUNTING DESIGN: get_permission_balance (20260906150000) already derives
-- monthly Permission usage purely from attendance.check_in/check_out vs the
-- fixed TIME '09:00'/'17:00' workday boundaries — see that function's
-- comment. The Excel export's Late/Early columns are the source of truth
-- for lateness/early-departure (never re-derived from Clock In/Clock Out,
-- per the explicit product requirement), so hr_import_attendance stores a
-- SYNTHETIC check_in = 09:00 + late_minutes and check_out = 17:00 -
-- early_minutes for each present day. Feeding the existing unmodified
-- formula these synthetic values reproduces the Excel's exact Late+Early
-- total everywhere that formula is already consumed (header "4h left",
-- dashboard, HR Attendance table, submit_permission_request's balance
-- check) with no changes to that function and no second balance system.
-- Absent days are stored with check_in/check_out both NULL, which the
-- existing formula already treats as a zero contribution — absence is
-- recorded (and shown in the import preview's summary) without being
-- deducted from Permission. Overtime and normal worked time are never
-- represented in check_in/check_out at all, so they are structurally
-- excluded from the deduction with no extra logic required.
--
-- late_minutes/early_minutes are clamped to [0, 719] (under 12h) before
-- being added/subtracted from the day boundary, so no realistic input can
-- wrap a TIME value past midnight and silently corrupt the stored value —
-- not a business rule, purely an arithmetic safety bound.

ALTER TABLE attendance
    ADD COLUMN source TEXT NOT NULL DEFAULT 'MANUAL'
        CHECK (source IN ('MANUAL', 'IMPORT'));

COMMENT ON COLUMN attendance.source IS
    'MANUAL = entered via the Attendance page form. IMPORT = written by hr_import_attendance from an Excel upload.';

CREATE FUNCTION hr_import_attendance(p_employee_id uuid, p_rows jsonb)
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
            LEAST(719, GREATEST(0, COALESCE((r->>'late_minutes')::int, 0))) AS late_minutes,
            LEAST(719, GREATEST(0, COALESCE((r->>'early_minutes')::int, 0))) AS early_minutes,
            COALESCE((r->>'is_absent')::boolean, false) AS is_absent
        FROM jsonb_array_elements(p_rows) AS r
    ),
    ins AS (
        INSERT INTO attendance (employee_id, date, check_in, check_out, source, recorded_by)
        SELECT
            p_employee_id,
            parsed.date,
            CASE WHEN parsed.is_absent THEN NULL
                 ELSE (TIME '09:00' + make_interval(mins => parsed.late_minutes)) END,
            CASE WHEN parsed.is_absent THEN NULL
                 ELSE (TIME '17:00' - make_interval(mins => parsed.early_minutes)) END,
            'IMPORT',
            auth.uid()
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

REVOKE EXECUTE ON FUNCTION hr_import_attendance(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION hr_import_attendance(uuid, jsonb) TO authenticated;
