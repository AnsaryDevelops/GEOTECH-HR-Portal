-- preview_my_approval_chain: narrow, read-only RPC for the pre-submission
-- Leave/Mission "Approval Chain" preview shown in the frontend before the
-- employee submits.
--
-- PROBLEM: the frontend preview previously reconstructed the chain
-- client-side from the `employees` array, itself populated by
-- `SELECT * FROM profiles` under RLS. The profiles SELECT policies
-- (profiles_select_self / _own_manager / _direct_reports —
-- 20260906140200_rls_profiles.sql) intentionally limit a normal EMPLOYEE or
-- MANAGER-tier requester's client to self + their own direct manager (+
-- their own direct reports) — never their manager's manager. So for a
-- requester whose Technical Manager/General Manager sit beyond their direct
-- manager, buildApprovalChain (store.ts) silently ran out of visible
-- profiles and returned a truncated 1-stage preview, even though the real
-- server-side chain has 2 or 3 stages. The actual approval workflow was
-- never affected by this — submit_leave_request/submit_mission_request
-- already call build_approval_chain (20260906170600, the current
-- definition) server-side, which is plain SQL and not RLS-bound — only the
-- client-side "who will approve this" preview was incomplete.
--
-- FIX: reuse build_approval_chain — the exact same source of truth the real
-- submission RPCs already call — for the calling user only, via a thin
-- SECURITY DEFINER wrapper. No approval-chain algorithm is duplicated here;
-- this function contains no business rules of its own beyond "identify the
-- caller and hand off." profiles SELECT policies are untouched by this
-- migration — no employee gains any new ability to read another profile
-- row directly.
--
-- SECURITY: zero parameters, by design. There is no employee id argument to
-- validate against auth.uid(), because there is no employee id argument at
-- all — the only identity this function ever operates on is auth.uid()
-- itself, so "pass someone else's id" is not merely rejected, it is
-- structurally impossible. Returns only the five columns the frontend
-- ApproverInfo component renders (stage, role, title, approver_id,
-- approver_name) — nothing else from profiles is exposed, and no general
-- employee directory is created. REVOKE-then-GRANT mirrors every other
-- client-callable RPC in this schema (e.g. submit_leave_request): no
-- execute for anon, no execute for PUBLIC, only for authenticated.
CREATE FUNCTION preview_my_approval_chain()
RETURNS TABLE (stage smallint, role text, title text, approver_id uuid, approver_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_employee_id uuid := auth.uid();
BEGIN
    IF v_employee_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    RETURN QUERY SELECT * FROM build_approval_chain(v_employee_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION preview_my_approval_chain() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION preview_my_approval_chain() TO authenticated;
