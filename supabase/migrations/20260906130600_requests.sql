-- requests: one row per Leave/Mission/Permission request.
-- 04-DOCS/PRODUCTION-BACKEND-PLAN.md §4.3.
-- No direct client INSERT/UPDATE/DELETE grant is ever added — writes happen exclusively
-- through the transactional RPCs (submit_*, decide_request, delete_own_request), a later phase (§5).

CREATE TABLE requests (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_number       TEXT NOT NULL,
    employee_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    employee_name        TEXT NOT NULL,
    type                 TEXT NOT NULL,
    status               TEXT NOT NULL DEFAULT 'PENDING',
    submitted_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    decided_at           TIMESTAMPTZ,
    decided_by           UUID REFERENCES profiles(id),
    decision_comment     TEXT,
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Stage-1 snapshot (display/filter convenience, mirrors RequestRecord.managerId/managerName).
    manager_id           UUID REFERENCES profiles(id),
    manager_name         TEXT,

    -- Leave fields.
    leave_type_id        UUID REFERENCES leave_types(id) ON DELETE SET NULL,
    leave_type_name      TEXT,
    balance_key          TEXT,
    working_days         INT,
    start_date           DATE,
    end_date             DATE,
    reason               TEXT,

    -- Mission fields.
    start_time           TIME,
    end_time             TIME,
    location             TEXT,
    purpose              TEXT,

    -- Permission fields.
    permission_kind      TEXT,
    permission_minutes   INT,

    CONSTRAINT requests_request_number_key UNIQUE (request_number),
    CONSTRAINT requests_type_check CHECK (type IN ('LEAVE', 'MISSION', 'PERMISSION')),
    CONSTRAINT requests_status_check CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    CONSTRAINT requests_balance_key_check CHECK (balance_key IS NULL OR balance_key IN ('ANNUAL', 'CASUAL')),
    CONSTRAINT requests_permission_kind_check CHECK (permission_kind IS NULL OR permission_kind IN ('LATE_ARRIVAL', 'EARLY_DEPARTURE')),
    -- Required for the leave-overlap EXCLUDE constraint below to behave correctly: a NULL bound
    -- in daterange() is unbounded/infinite, which would otherwise make one bad row conflict with every other.
    CONSTRAINT requests_leave_dates_check CHECK (type <> 'LEAVE' OR (start_date IS NOT NULL AND end_date IS NOT NULL)),
    CONSTRAINT requests_date_order_check CHECK (start_date IS NULL OR end_date IS NULL OR end_date >= start_date),
    CONSTRAINT requests_time_order_check CHECK (start_time IS NULL OR end_time IS NULL OR end_time > start_time)
);

COMMENT ON TABLE requests IS
    'employee_id ... ON DELETE RESTRICT means a profile can never be hard-deleted while it has any '
    'request at all — deactivation (status = INACTIVE) is the only lifecycle action (§4.3, §13.1).';

CREATE INDEX requests_employee_id_idx ON requests (employee_id);
CREATE INDEX requests_manager_id_idx ON requests (manager_id);
CREATE INDEX requests_status_idx ON requests (status);
CREATE INDEX requests_type_idx ON requests (type);
CREATE INDEX requests_submitted_at_idx ON requests (submitted_at);

-- request_number generator: REQ-NNNNN.
CREATE SEQUENCE requests_request_number_seq;

CREATE FUNCTION generate_request_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF NEW.request_number IS NULL THEN
        NEW.request_number := 'REQ-' || lpad(nextval('requests_request_number_seq')::text, 5, '0');
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER requests_generate_request_number
    BEFORE INSERT ON requests
    FOR EACH ROW
    EXECUTE FUNCTION generate_request_number();

CREATE TRIGGER requests_set_updated_at
    BEFORE UPDATE ON requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Leave overlap protection, database layer (airtight under concurrency; §9, §13.4).
-- The companion readable-rejection-message check inside submit_leave_request is a later phase.
ALTER TABLE requests
    ADD CONSTRAINT requests_no_overlapping_leave
    EXCLUDE USING gist (
        employee_id WITH =,
        daterange(start_date, end_date, '[]') WITH &&
    )
    WHERE (type = 'LEAVE' AND status IN ('PENDING', 'APPROVED'));
