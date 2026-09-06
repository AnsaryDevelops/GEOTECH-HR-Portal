-- Phase 4: decide_request — PRODUCTION-BACKEND-PLAN.md §5.3.
--
-- Client supplies only request_id, action (APPROVE/REJECT), and an optional
-- comment (required on rejection). Everything else — who the current
-- approver is, which stage is active, what happens next — is derived from
-- request_approvals/requests, never trusted from the client.
--
-- Locks the parent requests row FOR UPDATE for the whole decision: since
-- this function is the only writer to request_approvals and to requests'
-- decision fields, that one lock fully serializes any concurrent decide_request
-- calls against the same request — a second caller blocks until the first
-- transaction commits or rolls back, then re-reads a request that is already
-- no longer PENDING (or already at the next stage), so it fails cleanly on
-- the ordinary status/approver checks below rather than racing.
--
-- There is no current_approver_id column to clear on a final decision — by
-- design (Phase 2), "current approver" is computed on read as
-- MIN(stage) WHERE status = 'PENDING' in request_approvals, never a stored
-- pointer. Once every stage is APPROVED (or one is REJECTED), that query
-- naturally returns no row — the requirement is satisfied by the schema's
-- own design, not by an explicit column write.

CREATE FUNCTION decide_request(
    p_request_id uuid,
    p_action text,
    p_comment text DEFAULT NULL
)
RETURNS requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_approver_id uuid := auth.uid();
    v_request requests%ROWTYPE;
    v_stage request_approvals%ROWTYPE;
    v_next request_approvals%ROWTYPE;
    v_label text;
    v_now timestamptz := now();
BEGIN
    IF v_approver_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    IF p_action NOT IN ('APPROVE', 'REJECT') THEN
        RAISE EXCEPTION 'Invalid action: must be APPROVE or REJECT.';
    END IF;

    SELECT * INTO v_request FROM requests WHERE id = p_request_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Request not found.';
    END IF;

    IF v_request.status <> 'PENDING' THEN
        RAISE EXCEPTION 'This request has already been decided.';
    END IF;

    SELECT * INTO v_stage
    FROM request_approvals
    WHERE request_id = p_request_id AND status = 'PENDING'
    ORDER BY stage
    LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'This request has already been decided.';
    END IF;

    -- Only the current approver may act — checked by identity against this
    -- specific pending stage row, never by client-asserted role.
    IF v_stage.approver_id <> v_approver_id THEN
        RAISE EXCEPTION 'This request is waiting on % (%).', v_stage.approver_name, v_stage.title;
    END IF;

    IF p_action = 'REJECT' AND btrim(COALESCE(p_comment, '')) = '' THEN
        RAISE EXCEPTION 'A reason is required when rejecting a request.';
    END IF;

    v_label := CASE
        WHEN v_request.type = 'LEAVE' THEN COALESCE(v_request.leave_type_name, 'Leave')
        WHEN v_request.type = 'PERMISSION' THEN
            CASE v_request.permission_kind
                WHEN 'LATE_ARRIVAL' THEN 'Late arrival'
                WHEN 'EARLY_DEPARTURE' THEN 'Early departure'
                ELSE 'Permission'
            END
        ELSE 'Mission'
    END;

    IF p_action = 'REJECT' THEN
        UPDATE request_approvals
            SET status = 'REJECTED', decided_at = v_now, comment = btrim(p_comment)
            WHERE request_id = p_request_id AND stage = v_stage.stage;

        -- Every other stage row is left untouched at PENDING — matching the
        -- existing frontend's decideRequest exactly (§4.4).
        UPDATE requests
            SET status = 'REJECTED', decided_at = v_now, decided_by = v_approver_id,
                decision_comment = btrim(p_comment)
            WHERE id = p_request_id
            RETURNING * INTO v_request;

        INSERT INTO notifications (user_id, type, request_id, message)
        VALUES (
            v_request.employee_id, 'REQUEST_REJECTED', p_request_id,
            format('Your %s request (%s) was rejected by %s (%s).',
                   v_label, v_request.request_number, v_stage.approver_name, v_stage.title)
        );

        INSERT INTO audit_logs (actor_id, action, table_name, record_id, metadata)
        VALUES (
            v_approver_id, 'decide_request', 'requests', p_request_id,
            jsonb_build_object('action', 'REJECT', 'stage', v_stage.stage, 'comment', btrim(p_comment))
        );

        RETURN v_request;
    END IF;

    -- APPROVE.
    UPDATE request_approvals
        SET status = 'APPROVED', decided_at = v_now,
            comment = NULLIF(btrim(COALESCE(p_comment, '')), '')
        WHERE request_id = p_request_id AND stage = v_stage.stage;

    SELECT * INTO v_next
    FROM request_approvals
    WHERE request_id = p_request_id AND status = 'PENDING'
    ORDER BY stage
    LIMIT 1;

    IF FOUND THEN
        -- Another stage remains: Leave/Mission advance to the next approver
        -- (Technical Manager, then General Manager); a Permission's
        -- single-stage chain never reaches this branch at all. requests.status
        -- stays PENDING — nothing on the requests row changes here.
        INSERT INTO notifications (user_id, type, request_id, message) VALUES
            (v_request.employee_id, 'REQUEST_ADVANCED', p_request_id,
             format('%s approved your %s request (%s). Now with %s for %s approval.',
                    v_stage.approver_name, v_label, v_request.request_number,
                    v_next.approver_name, lower(v_next.title))),
            (v_next.approver_id, 'REQUEST_SUBMITTED', p_request_id,
             format('%s''s %s request (%s) is awaiting your approval.',
                    v_request.employee_name, v_label, v_request.request_number));

        INSERT INTO audit_logs (actor_id, action, table_name, record_id, metadata)
        VALUES (
            v_approver_id, 'decide_request', 'requests', p_request_id,
            jsonb_build_object('action', 'APPROVE', 'stage', v_stage.stage, 'advanced_to_stage', v_next.stage)
        );

        RETURN v_request;
    END IF;

    -- No further stage: on Direct Manager approval for a Permission, or on
    -- General Manager approval for a Leave/Mission, this is the final
    -- decision.
    UPDATE requests
        SET status = 'APPROVED', decided_at = v_now, decided_by = v_approver_id,
            decision_comment = NULLIF(btrim(COALESCE(p_comment, '')), '')
        WHERE id = p_request_id
        RETURNING * INTO v_request;

    INSERT INTO notifications (user_id, type, request_id, message)
    VALUES (
        v_request.employee_id, 'REQUEST_APPROVED', p_request_id,
        format('Your %s request (%s) has been fully approved.', v_label, v_request.request_number)
    );

    INSERT INTO audit_logs (actor_id, action, table_name, record_id, metadata)
    VALUES (
        v_approver_id, 'decide_request', 'requests', p_request_id,
        jsonb_build_object('action', 'APPROVE', 'stage', v_stage.stage, 'final', true)
    );

    RETURN v_request;
END;
$$;

REVOKE EXECUTE ON FUNCTION decide_request(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION decide_request(uuid, text, text) TO authenticated;
