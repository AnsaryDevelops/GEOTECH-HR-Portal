-- profiles: one row per person who can sign in, every role.
-- 04-DOCS/PRODUCTION-BACKEND-PLAN.md §4.1.
-- profiles.id = auth.users.id (a real, validated FK) is the identity contract (§6.1, §6.6).

CREATE TABLE profiles (
    id                              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    employee_number                 TEXT NOT NULL,
    first_name                      TEXT,
    last_name                       TEXT,
    name                            TEXT NOT NULL,
    position                        TEXT,
    department                      TEXT,
    email                           TEXT,
    phone                           TEXT,
    status                          TEXT NOT NULL DEFAULT 'ACTIVE',
    role                            TEXT NOT NULL,
    manager_id                      UUID REFERENCES profiles(id) ON DELETE SET NULL,
    permission_minutes_per_month    INT NOT NULL DEFAULT 240,
    created_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT profiles_employee_number_key UNIQUE (employee_number),
    CONSTRAINT profiles_email_key UNIQUE (email),
    CONSTRAINT profiles_role_check CHECK (role IN ('EMPLOYEE', 'MANAGER', 'TECH_MANAGER', 'GM', 'HR')),
    CONSTRAINT profiles_status_check CHECK (status IN ('ACTIVE', 'INACTIVE')),
    CONSTRAINT profiles_not_own_manager CHECK (manager_id IS NULL OR manager_id <> id)
);

COMMENT ON TABLE profiles IS
    'One row per person who can sign in, every role. profiles.id = auth.users.id (PRODUCTION-BACKEND-PLAN.md §6.1).';
COMMENT ON COLUMN profiles.manager_id IS
    'Single source of truth for the Direct Manager relationship. No separate team table (§4).';
COMMENT ON COLUMN profiles.email IS
    'Optional contact field, not the login identifier. Nullable and unique (many NULLs allowed) (§4.1).';

CREATE INDEX profiles_manager_id_idx ON profiles (manager_id);
CREATE INDEX profiles_role_idx ON profiles (role);
CREATE INDEX profiles_status_idx ON profiles (status);

-- Exactly one ACTIVE Technical Manager / General Manager company-wide.
-- Partial unique indexes are the unconditional, database-enforced guarantee: no INSERT or
-- UPDATE through any path can ever leave two profiles simultaneously ACTIVE with the same role.
CREATE UNIQUE INDEX profiles_one_active_tech_manager ON profiles (role) WHERE role = 'TECH_MANAGER' AND status = 'ACTIVE';
CREATE UNIQUE INDEX profiles_one_active_gm ON profiles (role) WHERE role = 'GM' AND status = 'ACTIVE';
-- Deliberately no equivalent constraint on HR: HR is explicitly not a singleton (§4.1).

-- employee_number generator: EMP-NNNNN.
CREATE SEQUENCE profiles_employee_number_seq;

CREATE FUNCTION generate_employee_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF NEW.employee_number IS NULL THEN
        NEW.employee_number := 'EMP-' || lpad(nextval('profiles_employee_number_seq')::text, 5, '0');
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_generate_employee_number
    BEFORE INSERT ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION generate_employee_number();

-- Shared updated_at housekeeping trigger, reused by every table below that has the column.
CREATE FUNCTION update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_set_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();
