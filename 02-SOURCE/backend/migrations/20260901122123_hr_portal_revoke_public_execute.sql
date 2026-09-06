/*
# HR Portal — Revoke PUBLIC Execute on Helper Functions

## Changes
PostgreSQL grants EXECUTE on functions to PUBLIC by default. The previous
migration revoked from anon and authenticated specifically, but PUBLIC
still grants access. This migration revokes from PUBLIC and re-grants
only to the `authenticated` role (since RLS policies run as the caller,
and only authenticated users have meaningful RLS policies).

## Important Notes
- RLS policy evaluation uses SECURITY DEFINER context, so the caller's
  EXECUTE privilege on the function does not affect whether the policy
  works. Revoking PUBLIC EXECUTE is safe for RLS.
- `is_manager_of()` is unused in current policies but kept for future use.
*/

REVOKE EXECUTE ON FUNCTION is_hr() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION is_manager_of(UUID) FROM PUBLIC;
