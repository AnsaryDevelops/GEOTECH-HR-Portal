-- Phase 4 correction: hr_create_employee — the missing plain-EMPLOYEE
-- provisioning path.
--
-- hr_create_manager_with_team (§5.5) only ever creates a MANAGER profile —
-- V1 also requires HR to create a normal EMPLOYEE account. This is a new,
-- eighth function, not one of the seven originally approved; it exists
-- alongside them under the same security model, added because the product
-- requirement was missing from the approved list, not because the list was
-- wrong to close at seven for the approval workflow itself.
--
-- Same provisioning boundary as hr_create_manager_with_team (§6.3), applied
-- to the EMPLOYEE case: this function creates only the profiles row, and
-- assumes new_employee->>'id' is already a real auth.users.id. No password
-- of any kind is accepted, handled, or stored here or anywhere in Postgres —
-- profiles has no password column and never will (§6.4: Supabase Auth/GoTrue
-- owns password storage entirely). The still-to-be-built Phase 5 boundary is:
--
--     HR frontend
--         -> authenticated Edge Function (re-verifies is_hr() independently)
--         -> Supabase Auth Admin API: admin.createUser({ email: synthetic
--            alias derived from employee_code, password: <HR's one-time
--            entry>, email_confirm: true })   [password touches Postgres
--            nowhere in this path — GoTrue hashes and stores it entirely
--            inside Supabase Auth's own infrastructure]
--         -> hr_create_employee(new_employee)  [this function — profiles
--            row only, using the auth.users.id the previous step just
--            created]
--
-- Building that Edge Function is Phase 5 work and is not implemented here.
-- This function is the database-side half of the boundary, ready for that
-- Edge Function to call once it exists.
--
-- role is not read from the client payload at all — it is hardcoded to
-- 'EMPLOYEE' in the INSERT below, so there is no value a client could send
-- that would change what gets stored.

CREATE FUNCTION hr_create_employee(new_employee jsonb)
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
    IF btrim(COALESCE(new_employee->>'department', '')) = '' THEN
        RAISE EXCEPTION 'Department is required.';
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
        id, employee_code, first_name, last_name, name, position, department,
        email, phone, status, role, manager_id, permission_minutes_per_month
    ) VALUES (
        v_id, v_employee_code,
        btrim(new_employee->>'first_name'), btrim(new_employee->>'last_name'),
        btrim(new_employee->>'first_name') || ' ' || btrim(new_employee->>'last_name'),
        btrim(new_employee->>'position'), btrim(new_employee->>'department'),
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

REVOKE EXECUTE ON FUNCTION hr_create_employee(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION hr_create_employee(jsonb) TO authenticated;
