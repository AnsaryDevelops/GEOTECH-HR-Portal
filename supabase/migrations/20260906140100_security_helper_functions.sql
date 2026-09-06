-- Phase 3: RLS helper functions.
--
-- Every helper here is SECURITY DEFINER so its internal query bypasses RLS
-- (it runs as the function owner, not the calling row's policy context) —
-- this is what makes it safe to call from a policy on the very table (or a
-- related table) the helper itself queries, without the recursive-policy
-- trap the plan explicitly warns against. search_path is pinned to `public`
-- only, matching the pattern already established in Phase 2's own trigger
-- functions, so no other schema can shadow an identifier used inside.
--
-- None of these functions accept a client-supplied identity — every one
-- derives "who is calling" exclusively from auth.uid(), the JWT Supabase
-- itself already validated. None of them write anything.

-- is_hr(): true if the caller's own profile carries role = 'HR'.
CREATE FUNCTION is_hr()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'HR'
  );
$$;

COMMENT ON FUNCTION is_hr() IS
    'True if the calling user''s own profile has role = HR. SECURITY DEFINER so the internal '
    'lookup bypasses profiles RLS instead of recursing into it.';

-- is_tech_manager_or_gm(): true if the caller is the sitting Technical
-- Manager or General Manager. Backs their Organization-wide profile read
-- (PRODUCTION-BACKEND-PLAN.md §7) — a data-backed role check on the
-- caller's own row, not a client-asserted claim.
CREATE FUNCTION is_tech_manager_or_gm()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('TECH_MANAGER', 'GM')
  );
$$;

COMMENT ON FUNCTION is_tech_manager_or_gm() IS
    'True if the calling user''s own profile has role TECH_MANAGER or GM.';

-- own_manager_id(): the caller's own profiles.manager_id. Lets a profiles
-- SELECT policy allow "see my own direct manager's row" (id = own_manager_id())
-- without the policy's USING clause re-querying profiles under its own RLS —
-- the classic self-referential recursion this table's policies would
-- otherwise hit.
CREATE FUNCTION own_manager_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT manager_id FROM profiles WHERE id = auth.uid();
$$;

COMMENT ON FUNCTION own_manager_id() IS
    'The calling user''s own profiles.manager_id. SECURITY DEFINER to avoid profiles RLS recursion.';

-- has_approval_role_in(request_id): true if the caller holds any
-- request_approvals row (any stage, any status) for the given request — the
-- RLS equivalent of the frontend's involvesApprover(). Used by requests'
-- SELECT policy; queries request_approvals, so it must not be evaluated
-- under request_approvals' own RLS (which itself calls owns_request(),
-- which queries requests) or the two tables' policies would recurse into
-- each other.
CREATE FUNCTION has_approval_role_in(target_request_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM request_approvals
    WHERE request_id = target_request_id AND approver_id = auth.uid()
  );
$$;

COMMENT ON FUNCTION has_approval_role_in(uuid) IS
    'True if the caller holds any request_approvals row (any stage/status) for this request — '
    'grants read access to current approvers and past approvers alike, matching '
    'PRODUCTION-BACKEND-PLAN.md §7''s "own + any where they hold a request_approvals row".';

-- owns_request(request_id): true if the caller is the employee who submitted
-- the given request. Used by request_approvals' SELECT policy (the mirror
-- image of has_approval_role_in above) so an employee can read the approval
-- history of their own requests without request_approvals' policy querying
-- requests under requests' own RLS.
CREATE FUNCTION owns_request(target_request_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM requests
    WHERE id = target_request_id AND employee_id = auth.uid()
  );
$$;

COMMENT ON FUNCTION owns_request(uuid) IS
    'True if the caller is the employee who submitted this request.';

-- Every RLS policy in the following migrations calls these functions from
-- within `authenticated`'s own query context, so `authenticated` needs
-- EXECUTE on them — but nothing else does. CREATE FUNCTION grants EXECUTE to
-- PUBLIC by default (the baseline migration's blanket revoke ran before
-- these functions existed, so it could not have touched them) — revoke that
-- default explicitly here, in the same migration that creates them, then
-- grant back only to authenticated.
REVOKE EXECUTE ON FUNCTION is_hr() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION is_tech_manager_or_gm() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION own_manager_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION has_approval_role_in(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION owns_request(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION is_hr() TO authenticated;
GRANT EXECUTE ON FUNCTION is_tech_manager_or_gm() TO authenticated;
GRANT EXECUTE ON FUNCTION own_manager_id() TO authenticated;
GRANT EXECUTE ON FUNCTION has_approval_role_in(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION owns_request(uuid) TO authenticated;
