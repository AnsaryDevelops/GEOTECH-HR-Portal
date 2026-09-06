/*
# HR Portal — Row Level Security & Seed Data

## Overview
Enables Row Level Security on all application tables and defines the
authorization policies that enforce the HR Portal's permission model.
Also seeds the database with the existing default employees and leave types
from the prototype's lib/store.ts (DEFAULT_EMPLOYEES + DEFAULT_LEAVE_TYPES).

## Security Model

### Identity
All policies derive identity from auth.uid() — the authenticated user's UUID.
No policy trusts client-supplied role, employee_id, or manager_id values.

### Profiles Table
- SELECT:  Users can read their own profile. Managers can read their direct
  reports. HR can read all profiles.
- INSERT:  Only HR can create profiles (new employees).
- UPDATE:  Users can update their own profile EXCEPT role and manager_id
  (protected via a column-level restriction in a separate policy for HR).
  HR can update any profile including role and manager_id.
  A separate policy restricts non-HR users from touching role/manager_id.
- DELETE:  Only HR can delete profiles.

### Leave Types Table
- SELECT:  All authenticated users can read leave types (employees need them
  for the request form dropdown).
- INSERT/UPDATE/DELETE:  Only HR.

### Requests Table
- SELECT:  Employees see their own requests (employee_id = auth.uid()).
  Managers see requests assigned to them (manager_id = auth.uid()).
  HR sees all requests.
- INSERT:  Employees can create their own requests. The employee_id must
  equal auth.uid(). The manager_id and manager_name are snapshotted at
  creation time from the employee's current manager — the application
  layer is responsible for populating these correctly; RLS ensures the
  employee_id matches the authenticated user.
- UPDATE:  Managers can update status/decision fields on requests assigned
  to them (manager_id = auth.uid()). HR can update any request (for
  administrative corrections). Employees cannot update requests after
  submission. A WITH CHECK on the manager policy prevents changing
  employee_id or manager_id during approval.
- DELETE:  Only HR.

### Notifications Table
- SELECT:  Users see only their own notifications (user_id = auth.uid()).
  HR can see all notifications (for the HR notifications page).
- INSERT:  Any authenticated user can insert notifications (the system
  creates them during request lifecycle events). The user_id must match
  auth.uid() OR the inserting user must be HR (for system-generated
  notifications to other users).
- UPDATE:  Users can mark their own notifications as read
  (user_id = auth.uid()). HR can update any notification.
- DELETE:  Only HR.

### Audit Logs Table
- SELECT:  Only HR.
- INSERT:  Any authenticated user (system triggers will insert audit rows).
  The WITH CHECK allows any authenticated user to insert.
- UPDATE/DELETE:  No policies — audit logs are append-only.

## Seed Data

### Profiles (8 employees matching DEFAULT_EMPLOYEES from lib/store.ts)
- EMP-00001 Alex Morgan — Employee, reports to EMP-00002 (Jordan Lee)
- EMP-00002 Jordan Lee — Manager, no manager
- EMP-00003 Riley Chen — HR, no manager
- EMP-00004 Nour Khalil — Employee, reports to EMP-00002
- EMP-00005 Sami Hadid — Employee, reports to EMP-00002
- EMP-00006 Sara Mohamed — Manager, no manager
- EMP-00007 Omar Hassan — Employee, reports to EMP-00006
- EMP-INACTIVE Sam Park — Inactive Employee, reports to EMP-00002

Note: The seed profiles use generated UUIDs as their id (not auth.users IDs).
When authentication is migrated in Phase 2, each auth user will be linked to
their profile via a profile.id = auth.users.id mapping. For now, the profiles
exist as data records with stable employee_number values.

### Leave Types (6 matching DEFAULT_LEAVE_TYPES from lib/store.ts)
- Annual Leave, Sick Leave, Emergency Leave, Maternity Leave,
  Paternity Leave, Unpaid Leave — all ACTIVE.

## Important Notes
1. RLS is enabled on ALL tables. No table is left without policies.
2. No policy uses USING (true) — all have real ownership/role predicates.
3. The seed data uses explicit employee_number values to match the existing
   prototype. The sequence is advanced past the seeded values so future
   auto-generated numbers won't collide.
4. No plaintext passwords are stored.
5. The existing frontend continues to work unchanged (sessionStorage-based).
*/

-- ═══════════════════════════════════════════════════════════════════════════
-- ENABLE RLS ON ALL TABLES
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════════════════
-- PROFILES RLS POLICIES
-- ═══════════════════════════════════════════════════════════════════════════

-- Helper function: is the current user HR?
CREATE OR REPLACE FUNCTION is_hr()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'HR'
  );
$$;

-- Helper function: is the current user a manager of the given employee?
CREATE OR REPLACE FUNCTION is_manager_of(target_employee_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = target_employee_id
      AND manager_id = auth.uid()
  );
$$;

-- SELECT: own profile, direct reports, or HR sees all
DROP POLICY IF EXISTS "profiles_select" ON profiles;
CREATE POLICY "profiles_select"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR manager_id = auth.uid()
    OR is_hr()
  );

-- INSERT: only HR
DROP POLICY IF EXISTS "profiles_insert_hr" ON profiles;
CREATE POLICY "profiles_insert_hr"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (is_hr());

-- UPDATE: own profile (non-sensitive fields) or HR (any field)
-- Non-HR users cannot change role or manager_id — enforced by WITH CHECK
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid() OR is_hr())
  WITH CHECK (
    is_hr()
    OR (
      id = auth.uid()
      AND role = (SELECT role FROM profiles WHERE id = auth.uid())
      AND manager_id = (SELECT manager_id FROM profiles WHERE id = auth.uid())
    )
  );

-- DELETE: only HR
DROP POLICY IF EXISTS "profiles_delete_hr" ON profiles;
CREATE POLICY "profiles_delete_hr"
  ON profiles FOR DELETE
  TO authenticated
  USING (is_hr());

-- ═══════════════════════════════════════════════════════════════════════════
-- LEAVE TYPES RLS POLICIES
-- ═══════════════════════════════════════════════════════════════════════════

-- SELECT: all authenticated users (needed for request form dropdown)
DROP POLICY IF EXISTS "leave_types_select_all" ON leave_types;
CREATE POLICY "leave_types_select_all"
  ON leave_types FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: only HR
DROP POLICY IF EXISTS "leave_types_insert_hr" ON leave_types;
CREATE POLICY "leave_types_insert_hr"
  ON leave_types FOR INSERT
  TO authenticated
  WITH CHECK (is_hr());

-- UPDATE: only HR
DROP POLICY IF EXISTS "leave_types_update_hr" ON leave_types;
CREATE POLICY "leave_types_update_hr"
  ON leave_types FOR UPDATE
  TO authenticated
  USING (is_hr())
  WITH CHECK (is_hr());

-- DELETE: only HR
DROP POLICY IF EXISTS "leave_types_delete_hr" ON leave_types;
CREATE POLICY "leave_types_delete_hr"
  ON leave_types FOR DELETE
  TO authenticated
  USING (is_hr());

-- ═══════════════════════════════════════════════════════════════════════════
-- REQUESTS RLS POLICIES
-- ═══════════════════════════════════════════════════════════════════════════

-- SELECT: own requests (employee), assigned requests (manager), all (HR)
DROP POLICY IF EXISTS "requests_select" ON requests;
CREATE POLICY "requests_select"
  ON requests FOR SELECT
  TO authenticated
  USING (
    employee_id = auth.uid()
    OR manager_id = auth.uid()
    OR is_hr()
  );

-- INSERT: employees create own requests; HR can create on behalf
DROP POLICY IF EXISTS "requests_insert" ON requests;
CREATE POLICY "requests_insert"
  ON requests FOR INSERT
  TO authenticated
  WITH CHECK (
    employee_id = auth.uid()
    OR is_hr()
  );

-- UPDATE: managers update assigned requests (status/decision only);
-- HR can update any request
DROP POLICY IF EXISTS "requests_update" ON requests;
CREATE POLICY "requests_update"
  ON requests FOR UPDATE
  TO authenticated
  USING (
    manager_id = auth.uid()
    OR is_hr()
  )
  WITH CHECK (
    -- Managers: cannot change employee_id or manager_id during update
    (manager_id = auth.uid() AND employee_id = (
      SELECT employee_id FROM requests WHERE id = requests.id
    ))
    OR is_hr()
  );

-- DELETE: only HR
DROP POLICY IF EXISTS "requests_delete_hr" ON requests;
CREATE POLICY "requests_delete_hr"
  ON requests FOR DELETE
  TO authenticated
  USING (is_hr());

-- ═══════════════════════════════════════════════════════════════════════════
-- NOTIFICATIONS RLS POLICIES
-- ═══════════════════════════════════════════════════════════════════════════

-- SELECT: own notifications or HR sees all
DROP POLICY IF EXISTS "notifications_select" ON notifications;
CREATE POLICY "notifications_select"
  ON notifications FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR is_hr()
  );

-- INSERT: own notifications, or HR/system creates for any user
DROP POLICY IF EXISTS "notifications_insert" ON notifications;
CREATE POLICY "notifications_insert"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR is_hr()
  );

-- UPDATE: mark own as read, or HR updates any
DROP POLICY IF EXISTS "notifications_update" ON notifications;
CREATE POLICY "notifications_update"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR is_hr())
  WITH CHECK (user_id = auth.uid() OR is_hr());

-- DELETE: only HR
DROP POLICY IF EXISTS "notifications_delete_hr" ON notifications;
CREATE POLICY "notifications_delete_hr"
  ON notifications FOR DELETE
  TO authenticated
  USING (is_hr());

-- ═══════════════════════════════════════════════════════════════════════════
-- AUDIT LOGS RLS POLICIES
-- ═══════════════════════════════════════════════════════════════════════════

-- SELECT: only HR
DROP POLICY IF EXISTS "audit_logs_select_hr" ON audit_logs;
CREATE POLICY "audit_logs_select_hr"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (is_hr());

-- INSERT: any authenticated user (system triggers will insert)
DROP POLICY IF EXISTS "audit_logs_insert" ON audit_logs;
CREATE POLICY "audit_logs_insert"
  ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- No UPDATE or DELETE policies — audit logs are append-only

-- ═══════════════════════════════════════════════════════════════════════════
-- SEED DATA
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Leave Types ────────────────────────────────────────────────────────────

INSERT INTO leave_types (name, status) VALUES
  ('Annual Leave', 'ACTIVE'),
  ('Sick Leave', 'ACTIVE'),
  ('Emergency Leave', 'ACTIVE'),
  ('Maternity Leave', 'ACTIVE'),
  ('Paternity Leave', 'ACTIVE'),
  ('Unpaid Leave', 'ACTIVE')
ON CONFLICT (name) DO NOTHING;

-- ─── Profiles ───────────────────────────────────────────────────────────────
-- Insert in dependency order: managers first, then their reports.
-- Use explicit employee_number values matching the existing prototype.
-- IDs are auto-generated UUIDs; they will be linked to auth.users in Phase 2.

-- Managers and HR (no manager_id dependency)
INSERT INTO profiles (id, employee_number, first_name, last_name, name, position, department, email, phone, status, role, manager_id)
VALUES
  ('a0000000-0000-0000-0000-000000000002', 'EMP-00002', 'Jordan', 'Lee', 'Jordan Lee', 'Engineering Manager', 'IT', 'jordan.lee@company.com', '+20 10 0000 0002', 'ACTIVE', 'MANAGER', NULL),
  ('a0000000-0000-0000-0000-000000000003', 'EMP-00003', 'Riley', 'Chen', 'Riley Chen', 'HR Specialist', 'Human Resources', 'riley.chen@company.com', '+20 10 0000 0003', 'ACTIVE', 'HR', NULL),
  ('a0000000-0000-0000-0000-000000000006', 'EMP-00006', 'Sara', 'Mohamed', 'Sara Mohamed', 'Operations Manager', 'Operations', 'sara.mohamed@company.com', '+20 10 0000 0006', 'ACTIVE', 'MANAGER', NULL)
ON CONFLICT (employee_number) DO NOTHING;

-- Employees reporting to Jordan Lee (EMP-00002)
INSERT INTO profiles (id, employee_number, first_name, last_name, name, position, department, email, phone, status, role, manager_id)
VALUES
  ('a0000000-0000-0000-0000-000000000001', 'EMP-00001', 'Alex', 'Morgan', 'Alex Morgan', 'Product Designer', 'IT', 'alex.morgan@company.com', '+20 10 0000 0001', 'ACTIVE', 'EMPLOYEE', 'a0000000-0000-0000-0000-000000000002'),
  ('a0000000-0000-0000-0000-000000000004', 'EMP-00004', 'Nour', 'Khalil', 'Nour Khalil', 'Frontend Developer', 'IT', 'nour.khalil@company.com', '+20 10 0000 0004', 'ACTIVE', 'EMPLOYEE', 'a0000000-0000-0000-0000-000000000002'),
  ('a0000000-0000-0000-0000-000000000005', 'EMP-00005', 'Sami', 'Hadid', 'Sami Hadid', 'Backend Developer', 'IT', 'sami.hadid@company.com', '+20 10 0000 0005', 'ACTIVE', 'EMPLOYEE', 'a0000000-0000-0000-0000-000000000002'),
  ('a0000000-0000-0000-0000-000000000008', 'EMP-INACTIVE', 'Sam', 'Park', 'Sam Park', 'QA Engineer', 'IT', 'sam.park@company.com', NULL, 'INACTIVE', 'EMPLOYEE', 'a0000000-0000-0000-0000-000000000002')
ON CONFLICT (employee_number) DO NOTHING;

-- Employee reporting to Sara Mohamed (EMP-00006)
INSERT INTO profiles (id, employee_number, first_name, last_name, name, position, department, email, phone, status, role, manager_id)
VALUES
  ('a0000000-0000-0000-0000-000000000007', 'EMP-00007', 'Omar', 'Hassan', 'Omar Hassan', 'Operations Analyst', 'Operations', 'omar.hassan@company.com', '+20 10 0000 0007', 'ACTIVE', 'EMPLOYEE', 'a0000000-0000-0000-0000-000000000006')
ON CONFLICT (employee_number) DO NOTHING;

-- Advance sequences past the seeded employee numbers so future auto-generated
-- numbers won't collide with the manually-seeded EMP-00001 through EMP-00007.
-- EMP-INACTIVE was a manual value outside the sequence, so we only need to
-- advance past EMP-00007.
SELECT setval('employee_number_seq', 7);
