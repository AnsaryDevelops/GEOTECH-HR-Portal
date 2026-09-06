-- Corrective migration on top of 20260906150900_rpc_hr_create_employee.sql
-- (already committed as 425c12a) — does not edit that file.
--
-- Departments are now real, HR-managed data (20260906160000/160100), not
-- free text. This function now requires new_employee->>'department_id' (a
-- real, ACTIVE departments.id) instead of a department name string, and
-- validates it the same way manager_id is already validated — never trusted
-- from the client without a fresh lookup.
--
-- CREATE OR REPLACE preserves the function's existing ownership and EXECUTE
-- grant — neither needs to be repeated here.

CREATE OR REPLACE FUNCTION hr_create_employee(new_employee jsonb)
RETURNS profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id uuid;
    v_employee_code text;
    v_status text;
    v_manager_id uuid;
    v_manager profiles%ROWTYPE;
    v_department_id uuid;
    v_email text;
    v_new_profile profiles%ROWTYPE;
BEGIN
    IF NOT is_hr() THEN
        RAISE EXCEPTION 'Only HR may create employee accounts.';
    END IF;

    v_id := NULLIF(new_employee->>'id', '')::uuid;
    IF v_id IS NULL THEN
        RAISE EXCEPTION 'id is required (the matching auth.users id created by the provisioning Edge Function).';
    END IF;

    -- Canonical form is uppercase, matching the approved Employee Code
    -- implementation (App.tsx createEmployee) exactly — enforced here too,
    -- since this RPC must never trust that a client already canonicalized
    -- its input.
    v_employee_code := upper(btrim(COALESCE(new_employee->>'employee_code', '')));
    IF v_employee_code = '' THEN
        RAISE EXCEPTION 'Employee Code is required.';
    END IF;
    IF EXISTS (SELECT 1 FROM profiles WHERE employee_code = v_employee_code) THEN
        RAISE EXCEPTION 'This Employee Code is already in use.';
    END IF;

    v_status := COALESCE(new_employee->>'status', 'ACTIVE');
    IF v_status <> 'ACTIVE' THEN
        RAISE EXCEPTION 'A newly created employee must be ACTIVE.';
    END IF;

    IF btrim(COALESCE(new_employee->>'first_name', '')) = '' THEN
        RAISE EXCEPTION 'First name is required.';
    END IF;
    IF btrim(COALESCE(new_employee->>'last_name', '')) = '' THEN
        RAISE EXCEPTION 'Last name is required.';
    END IF;
    IF btrim(COALESCE(new_employee->>'position', '')) = '' THEN
        RAISE EXCEPTION 'Position is required.';
    END IF;

    v_department_id := NULLIF(new_employee->>'department_id', '')::uuid;
    IF v_department_id IS NULL THEN
        RAISE EXCEPTION 'Department is required.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM departments WHERE id = v_department_id AND status = 'ACTIVE') THEN
        RAISE EXCEPTION 'Selected department is not available.';
    END IF;

    v_email := lower(btrim(COALESCE(new_employee->>'email', '')));
    IF v_email = '' OR v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN
        RAISE EXCEPTION 'A valid email is required.';
    END IF;
    IF EXISTS (SELECT 1 FROM profiles WHERE email = v_email) THEN
        RAISE EXCEPTION 'This email is already in use.';
    END IF;

    -- A Direct Manager is required for a plain employee (matches the
    -- existing, approved frontend rule: validateEmployeeFields requires
    -- managerId when role === "EMPLOYEE") and must be an active,
    -- approver-tier profile — never trusted from the client without
    -- re-validation here.
    v_manager_id := NULLIF(new_employee->>'manager_id', '')::uuid;
    IF v_manager_id IS NULL THEN
        RAISE EXCEPTION 'A direct manager is required for employees.';
    END IF;
    SELECT * INTO v_manager FROM profiles WHERE id = v_manager_id;
    IF NOT FOUND OR v_manager.status <> 'ACTIVE' OR v_manager.role NOT IN ('MANAGER', 'TECH_MANAGER', 'GM') THEN
        RAISE EXCEPTION 'Selected manager is not in the management chain or is inactive.';
    END IF;

    -- role is intentionally never read from new_employee — this function
    -- only ever creates an EMPLOYEE, regardless of what a client sends.
    INSERT INTO profiles (
        id, employee_code, first_name, last_name, name, position, department_id,
        email, phone, status, role, manager_id, permission_minutes_per_month
    ) VALUES (
        v_id, v_employee_code,
        btrim(new_employee->>'first_name'), btrim(new_employee->>'last_name'),
        btrim(new_employee->>'first_name') || ' ' || btrim(new_employee->>'last_name'),
        btrim(new_employee->>'position'), v_department_id,
        v_email, NULLIF(btrim(new_employee->>'phone'), ''),
        'ACTIVE', 'EMPLOYEE', v_manager_id,
        COALESCE((new_employee->>'permission_minutes_per_month')::int, 240)
    )
    RETURNING * INTO v_new_profile;

    INSERT INTO audit_logs (actor_id, action, table_name, record_id, metadata)
    VALUES (auth.uid(), 'hr_create_employee', 'profiles', v_id, '{}'::jsonb);

    RETURN v_new_profile;
END;
$$;
