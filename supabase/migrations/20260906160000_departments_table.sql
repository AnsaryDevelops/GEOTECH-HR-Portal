-- Phase 6A Extension — Departments become real, HR-managed company data
-- instead of free text on profiles.
--
-- No previous migration created a departments table (confirmed by direct
-- inspection of the linked project before writing this). Archived rather
-- than hard-deleted (status = INACTIVE), matching the exact pattern already
-- established for leave_types (§4.8) and public_holidays (§4.7) — same
-- reasoning: historical profile references must survive a department being
-- retired.
--
-- Deliberately no seed rows: matches the "production starts clean" principle
-- already applied to every other HR-configurable table (leave_types shipped
-- with zero rows too) — HR creates real departments through Settings, this
-- migration does not fabricate any.

CREATE TABLE departments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'ACTIVE',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT departments_status_check CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

COMMENT ON TABLE departments IS
    'Archived via status = INACTIVE, never hard-deleted — a department with historical profile '
    'references must survive being retired, same reasoning as leave_types (§4.8).';

-- "Duplicate ACTIVE department names cannot be created" — a partial unique
-- index, not a blanket one: if HR archives "Marketing" and later creates a
-- new active "Marketing", the archived row (kept for history) must not
-- block that.
CREATE UNIQUE INDEX departments_unique_active_name ON departments (name) WHERE status = 'ACTIVE';

CREATE TRIGGER departments_set_updated_at
    BEFORE UPDATE ON departments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON departments TO authenticated;
-- No DELETE grant — archiving is the only removal path, matching leave_types/public_holidays.

-- SELECT: every authenticated user sees active departments (needed to
-- display/assign one); HR additionally sees archived ones for management.
CREATE POLICY departments_select_active ON departments
    FOR SELECT
    TO authenticated
    USING (status = 'ACTIVE' OR is_hr());

CREATE POLICY departments_insert_hr ON departments
    FOR INSERT
    TO authenticated
    WITH CHECK (is_hr());

CREATE POLICY departments_update_hr ON departments
    FOR UPDATE
    TO authenticated
    USING (is_hr())
    WITH CHECK (is_hr());
