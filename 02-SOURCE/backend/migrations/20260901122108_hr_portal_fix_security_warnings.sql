/*
# HR Portal — Fix Security Advisor Warnings

## Changes
1. Add `SET search_path = public` to all helper functions to prevent
   search path manipulation attacks.
2. Revoke EXECUTE on `is_hr()` and `is_manager_of()` from anon and
   authenticated roles. These functions are used internally by RLS
   policies and should not be callable directly via the REST API.
   RLS policy evaluation uses the function's SECURITY DEFINER context,
   not the caller's EXECUTE privilege, so revoking EXECUTE does not
   break the policies.

## Important Notes
- These functions must remain SECURITY DEFINER because they query the
  `profiles` table, which has RLS enabled. Without SECURITY DEFINER,
  the functions would be subject to RLS themselves, creating a circular
  dependency (the policy checks is_hr(), which queries profiles, which
  is subject to RLS, which calls is_hr()...).
- `is_manager_of()` is currently unused in policies but kept for
  potential future use. Its EXECUTE is revoked for the same reason.
*/

-- Fix search_path on all functions
CREATE OR REPLACE FUNCTION generate_request_number()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN 'REQ-' || LPAD(nextval('request_number_seq')::TEXT, 5, '0');
END;
$$;

CREATE OR REPLACE FUNCTION generate_employee_number()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN 'EMP-' || LPAD(nextval('employee_number_seq')::TEXT, 5, '0');
END;
$$;

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

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

-- Revoke direct execution from anon and authenticated
REVOKE EXECUTE ON FUNCTION is_hr() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION is_manager_of(UUID) FROM anon, authenticated;
