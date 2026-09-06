-- Corrective migration on top of 20260906150700_rpc_hr_create_manager_with_team.sql
-- (already committed as 387c2a4) — does not edit that file.
--
-- Same department_id change as hr_create_employee (20260906160200) —
-- department_id (a real, ACTIVE departments.id) replaces the old free-text
-- department field.

CREATE OR REPLACE FUNCTION hr_create_manager_with_team(
    new_employee jsonb,
    team_member_ids uuid[] DEFAULT '{}'
)
RETURNS profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id uuid;
    v_employee_code text;
    v_role text;
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

    v_employee_code := upper(btrim(COALESCE(new_employee->>'employee_code', '')));
    IF v_employee_code = '' THEN
        RAISE EXCEPTION 'Employee Code is required.';
    END IF;
    IF EXISTS (SELECT 1 FROM profiles WHERE employee_code = v_employee_code) THEN
        RAISE EXCEPTION 'This Employee Code is already in use.';
    END IF;

    -- This function creates a Direct Manager specifically — an HR/EMPLOYEE/
    -- TECH_MANAGER/GM account is out of scope for it (no such RPC is part of
    -- the seven approved for this phase; noted for review).
    v_role := new_employee->>'role';
    IF v_role IS DISTINCT FROM 'MANAGER' THEN
        RAISE EXCEPTION 'hr_create_manager_with_team creates a Direct Manager; role must be MANAGER.';
    END IF;

    v_status := COALESCE(new_employee->>'status', 'ACTIVE');
    IF v_status <> 'ACTIVE' THEN
        RAISE EXCEPTION 'A newly created manager must be ACTIVE.';
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

    -- The new manager's own Direct Manager, if any, must be an active,
    -- approver-tier profile — the same rule the frontend already applies
    -- when HR assigns anyone's manager (isApprover/getEligibleManagers).
    v_manager_id := NULLIF(new_employee->>'manager_id', '')::uuid;
    IF v_manager_id IS NOT NULL THEN
        SELECT * INTO v_manager FROM profiles WHERE id = v_manager_id;
        IF NOT FOUND OR v_manager.status <> 'ACTIVE' OR v_manager.role NOT IN ('MANAGER', 'TECH_MANAGER', 'GM') THEN
            RAISE EXCEPTION 'Selected manager is not in the management chain or is inactive.';
        END IF;
    END IF;

    INSERT INTO profiles (
        id, employee_code, first_name, last_name, name, position, department_id,
        email, phone, status, role, manager_id, permission_minutes_per_month
    ) VALUES (
        v_id, v_employee_code,
        btrim(new_employee->>'first_name'), btrim(new_employee->>'last_name'),
        btrim(new_employee->>'first_name') || ' ' || btrim(new_employee->>'last_name'),
        btrim(new_employee->>'position'), v_department_id,
        v_email, NULLIF(btrim(new_employee->>'phone'), ''),
        'ACTIVE', 'MANAGER', v_manager_id,
        COALESCE((new_employee->>'permission_minutes_per_month')::int, 240)
    )
    RETURNING * INTO v_new_profile;

    -- Employees already assigned to another manager are never silently
    -- overwritten: only currently-unmanaged, active EMPLOYEE-role profiles
    -- are reassigned, re-validated here rather than trusted from the client
    -- (mirrors the existing frontend's own re-validated filter in
    -- createEmployee exactly).
    UPDATE profiles
        SET manager_id = v_id
        WHERE id = ANY(COALESCE(team_member_ids, '{}'))
          AND role = 'EMPLOYEE' AND status = 'ACTIVE' AND manager_id IS NULL;

    INSERT INTO audit_logs (actor_id, action, table_name, record_id, metadata)
    VALUES (
        auth.uid(), 'hr_create_manager_with_team', 'profiles', v_id,
        jsonb_build_object('team_member_ids', team_member_ids)
    );

    RETURN v_new_profile;
END;
$$;
