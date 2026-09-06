-- Corrective/extension migration on top of 20260906130100_profiles.sql
-- (already committed) — does not edit that file.
--
-- Adds profiles.department_id as the real, FK-backed source of truth for an
-- employee's department, alongside (not replacing) the existing
-- profiles.department TEXT column. The old column is deliberately left in
-- place, unused going forward, rather than dropped: dropping it is a
-- destructive operation this migration does not need to perform, and the
-- task's own instruction is to stay backward-compatible with existing data,
-- not to force a cleanup. New profiles created after this migration get
-- department_id only; department stays NULL for them.
--
-- Backfill is fully data-driven — it creates a department row for whatever
-- distinct, non-empty `department` text values already exist on real
-- profiles (verified before writing this: "IT" and "Human Resources" exist
-- on the linked project today from Phase 6A testing) and points each
-- profile at the matching row. Nothing is hardcoded from a specific
-- environment's data, so this is safe to run against any environment,
-- including one with zero rows.

ALTER TABLE profiles ADD COLUMN department_id UUID REFERENCES departments(id);

CREATE INDEX profiles_department_id_idx ON profiles (department_id);

COMMENT ON COLUMN profiles.department_id IS
    'The source of truth for an employee''s department. profiles.department (TEXT) is legacy —'
    ' left in place for existing rows, not written to by any code path after this migration.';

-- Column-scoped grant, additive to the existing UPDATE grant from
-- 20260906140200_rls_profiles.sql (a new column is not covered by an old
-- GRANT UPDATE (...) statement naming specific columns — this is the
-- missing piece, not a replacement of it). Actual write access is still
-- gated entirely by RLS (profiles_update_hr today; profiles_update_self
-- explicitly excludes this column — see 20260906160400).
GRANT UPDATE (department_id) ON profiles TO authenticated;

-- Data-driven backfill: one department per distinct existing text value,
-- then point matching profiles at it.
INSERT INTO departments (name)
SELECT DISTINCT department
FROM profiles
WHERE department IS NOT NULL AND btrim(department) <> ''
ON CONFLICT DO NOTHING;

UPDATE profiles
SET department_id = d.id
FROM departments d
WHERE profiles.department = d.name
  AND profiles.department_id IS NULL;
