/*
# HR Portal — Database Schema Foundation

## Overview
Creates the complete PostgreSQL schema for the HR Portal application, replacing
the existing sessionStorage-based data layer with persistent database tables.
This is Phase 1: database foundation only. No frontend changes are made.
Authentication users are NOT created in this phase.

## New Tables

### 1. profiles
- Stores employee/manager/HR user profiles.
- id (UUID) will correspond to auth.users(id) in Phase 2 (FK to auth.users
  is deferred until authentication migration to allow seeding without auth users).
- Self-referencing manager_id establishes the employee→manager hierarchy.
- employee_number has a DEFAULT that auto-generates EMP-NNNNN formatted values.
- role and status are constrained via CHECK constraints.
- Employees and managers cannot modify their own role or manager_id (enforced via RLS).

### 2. leave_types
- Configurable leave categories managed by HR (e.g., Annual Leave, Sick Leave).
- Unique name constraint prevents duplicates.
- status is constrained to ACTIVE/INACTIVE.

### 3. requests
- Leave and mission requests with historical snapshot fields.
- employee_name, manager_name, leave_type_name are stored at creation time
  for historical integrity (if manager changes later, old requests keep original manager).
- employee_id, manager_id are FKs to profiles(id).
- leave_type_id is FK to leave_types(id); leave_type_name is a historical snapshot.
- request_number has a DEFAULT that auto-generates REQ-NNNNN formatted values.
- type constrained to LEAVE/MISSION; status constrained to PENDING/APPROVED/REJECTED.

### 4. notifications
- User-specific notifications for request lifecycle events.
- user_id is FK to profiles(id); request_id is FK to requests(id).
- type constrained to REQUEST_SUBMITTED/REQUEST_APPROVED/REQUEST_REJECTED.
- read defaults to false.

### 5. audit_logs
- Append-only audit trail for security-sensitive operations.
- actor_id is FK to profiles(id) (nullable for system actions).
- metadata is JSONB for flexible structured data.
- No INSERT/UPDATE/DELETE policies created yet — triggers will be added
  in the security-hardening phase. Only HR SELECT is enabled.

## Sequences
- request_number_seq: backs the REQ-00001, REQ-00002, ... format.
- employee_number_seq: backs the EMP-00001, EMP-00002, ... format.

## Functions
- generate_request_number(): formats nextval as REQ-NNNNN.
- generate_employee_number(): formats nextval as EMP-NNNNN.
- update_updated_at(): trigger function to auto-set updated_at on row update.

## Triggers
- trg_profiles_updated_at: calls update_updated_at() before UPDATE on profiles.
- trg_leave_types_updated_at: calls update_updated_at() before UPDATE on leave_types.

## Indexes
- profiles: employee_number, manager_id, role, status
- requests: employee_id, manager_id, status, submitted_at
- notifications: user_id, read, created_at
- audit_logs: actor_id, created_at

## Important Notes
1. No FK to auth.users(id) is added yet — it will be added in Phase 2
   when authentication users are created. This allows seeding profiles
   without requiring auth.users rows to exist.
2. No plaintext passwords are stored anywhere in the database.
3. The existing frontend (sessionStorage-based) continues to work unchanged.
4. All tables have RLS enabled in a separate migration (hr_portal_rls_and_seed).
*/

-- ─── Sequences ──────────────────────────────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS request_number_seq START 1;
CREATE SEQUENCE IF NOT EXISTS employee_number_seq START 1;

-- ─── Helper Functions for ID Generation ─────────────────────────────────────

CREATE OR REPLACE FUNCTION generate_request_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN 'REQ-' || LPAD(nextval('request_number_seq')::TEXT, 5, '0');
END;
$$;

CREATE OR REPLACE FUNCTION generate_employee_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN 'EMP-' || LPAD(nextval('employee_number_seq')::TEXT, 5, '0');
END;
$$;

-- ─── Trigger Function for updated_at ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ─── 1. Profiles Table ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_number TEXT NOT NULL DEFAULT generate_employee_number(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  name TEXT,
  position TEXT,
  department TEXT,
  email TEXT,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  role TEXT NOT NULL DEFAULT 'EMPLOYEE',
  manager_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT profiles_employee_number_unique UNIQUE (employee_number),
  CONSTRAINT profiles_role_check CHECK (role IN ('EMPLOYEE', 'MANAGER', 'HR')),
  CONSTRAINT profiles_status_check CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

CREATE INDEX IF NOT EXISTS idx_profiles_employee_number ON profiles(employee_number);
CREATE INDEX IF NOT EXISTS idx_profiles_manager_id ON profiles(manager_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON profiles(status);

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── 2. Leave Types Table ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS leave_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT leave_types_name_unique UNIQUE (name),
  CONSTRAINT leave_types_status_check CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

DROP TRIGGER IF EXISTS trg_leave_types_updated_at ON leave_types;
CREATE TRIGGER trg_leave_types_updated_at
  BEFORE UPDATE ON leave_types
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── 3. Requests Table ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number TEXT NOT NULL DEFAULT generate_request_number(),
  employee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  employee_name TEXT NOT NULL,
  manager_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  manager_name TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Leave-specific fields
  leave_type_id UUID REFERENCES leave_types(id) ON DELETE SET NULL,
  leave_type_name TEXT,
  start_date DATE,
  end_date DATE,
  reason TEXT,

  -- Mission-specific fields
  start_time TIME,
  end_time TIME,
  location TEXT,
  purpose TEXT,

  -- Decision fields
  decided_at TIMESTAMPTZ,
  decision_comment TEXT,

  CONSTRAINT requests_request_number_unique UNIQUE (request_number),
  CONSTRAINT requests_type_check CHECK (type IN ('LEAVE', 'MISSION')),
  CONSTRAINT requests_status_check CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED'))
);

CREATE INDEX IF NOT EXISTS idx_requests_employee_id ON requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_requests_manager_id ON requests(manager_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_submitted_at ON requests(submitted_at);

-- ─── 4. Notifications Table ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  request_id UUID REFERENCES requests(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT notifications_type_check CHECK (
    type IN ('REQUEST_SUBMITTED', 'REQUEST_APPROVED', 'REQUEST_REJECTED')
  )
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

-- ─── 5. Audit Logs Table ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
