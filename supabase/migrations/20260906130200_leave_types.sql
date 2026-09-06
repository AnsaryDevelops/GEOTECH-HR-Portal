-- leave_types: HR-managed leave type catalogue.
-- 04-DOCS/PRODUCTION-BACKEND-PLAN.md §4.8.

CREATE TABLE leave_types (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name         TEXT NOT NULL,
    status       TEXT NOT NULL DEFAULT 'ACTIVE',
    balance_key  TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT leave_types_name_key UNIQUE (name),
    CONSTRAINT leave_types_status_check CHECK (status IN ('ACTIVE', 'INACTIVE')),
    CONSTRAINT leave_types_balance_key_check CHECK (balance_key IS NULL OR balance_key IN ('ANNUAL', 'CASUAL'))
);

COMMENT ON TABLE leave_types IS
    'Archived via status = INACTIVE, never hard-deleted; no DELETE grant is ever added (PRODUCTION-BACKEND-PLAN.md §4.8, §13.2).';
COMMENT ON COLUMN leave_types.balance_key IS
    'NULL means unlimited (Sick/Maternity/Paternity/Unpaid). ANNUAL/CASUAL draw from the matching leave_allocations bucket.';

CREATE TRIGGER leave_types_set_updated_at
    BEFORE UPDATE ON leave_types
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();
