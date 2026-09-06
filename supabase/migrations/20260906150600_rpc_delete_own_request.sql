-- Phase 4: delete_own_request — PRODUCTION-BACKEND-PLAN.md §5.4.
-- The only way a request row is ever removed. Deletes only if the caller
-- owns the request, it is still PENDING, and the currently pending stage is
-- stage 1 (the Direct Manager has not yet acted) — the exact predicate of
-- canEmployeeDeleteRequest, re-checked server-side. request_approvals and
-- notifications referencing this request cascade automatically via their
-- existing ON DELETE CASCADE foreign keys (Phase 2).

CREATE FUNCTION delete_own_request(p_request_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_employee_id uuid := auth.uid();
    v_request requests%ROWTYPE;
    v_stage request_approvals%ROWTYPE;
BEGIN
    IF v_employee_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    SELECT * INTO v_request FROM requests WHERE id = p_request_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Request not found.';
    END IF;

    IF v_request.employee_id <> v_employee_id THEN
        RAISE EXCEPTION 'You may only delete your own requests.';
    END IF;
    IF v_request.status <> 'PENDING' THEN
        RAISE EXCEPTION 'This request has already been decided and can no longer be deleted.';
    END IF;

    SELECT * INTO v_stage
    FROM request_approvals
    WHERE request_id = p_request_id AND status = 'PENDING'
    ORDER BY stage
    LIMIT 1;

    IF NOT FOUND OR v_stage.stage <> 1 THEN
        RAISE EXCEPTION 'Your Direct Manager has already acted on this request. It can no longer be deleted.';
    END IF;

    DELETE FROM requests WHERE id = p_request_id;

    RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION delete_own_request(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delete_own_request(uuid) TO authenticated;
