-- leave_allocations: year-scoped opening balances, replacing EmployeeProfile.entitlements.
-- 04-DOCS/PRODUCTION-BACKEND-PLAN.md §4.2.
-- A new year is a new row, never a new column.

CREATE TABLE leave_allocations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    bucket          TEXT NOT NULL,
    year            SMALLINT NOT NULL,
    allocated_days  INT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT leave_allocations_bucket_check CHECK (bucket IN ('ANNUAL', 'CASUAL')),
    CONSTRAINT leave_allocations_allocated_days_check CHECK (allocated_days >= 0),
    CONSTRAINT leave_allocations_unique_profile_bucket_year UNIQUE (profile_id, bucket, year)
);

COMMENT ON TABLE leave_allocations IS
    'One row per employee, per leave-type bucket, per year. bucket is the grain, not a leave_type_id FK (§4.2).';

CREATE INDEX leave_allocations_profile_id_idx ON leave_allocations (profile_id);

CREATE TRIGGER leave_allocations_set_updated_at
    BEFORE UPDATE ON leave_allocations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();
