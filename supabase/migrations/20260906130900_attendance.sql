-- attendance: HR's manual entry; source for the "Present" calendar state and the
-- permission-allowance deduction.
-- 04-DOCS/PRODUCTION-BACKEND-PLAN.md §4.6.

CREATE TABLE attendance (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    date          DATE NOT NULL,
    check_in      TIME,
    check_out     TIME,
    note          TEXT,
    recorded_by   UUID NOT NULL REFERENCES profiles(id),
    recorded_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT attendance_unique_employee_date UNIQUE (employee_id, date)
);

COMMENT ON TABLE attendance IS
    'UNIQUE (employee_id, date) matches "re-entering a date corrects it" (an UPSERT on this key) and '
    'already supports a future bulk Excel import via INSERT ... ON CONFLICT with zero schema change (§4.6).';

CREATE INDEX attendance_employee_id_idx ON attendance (employee_id);
