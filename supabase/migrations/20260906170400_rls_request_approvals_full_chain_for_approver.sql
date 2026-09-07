-- Phase 6B-7 — Real Requests Read Path.
-- Corrective migration on top of 20260906140800_rls_request_approvals.sql
-- (already committed) — does not edit that file.
--
-- ROOT CAUSE: request_approvals_select_approver only grants a caller
-- visibility into the exact row where they are approver_id — a plain,
-- single-row comparison, deliberately scoped that way at Phase 3 (see that
-- migration's own comment: "no subquery, no recursion risk"). At the time,
-- no UI need had been identified for an approver to see the FULL chain of a
-- request they only hold one stage of.
--
-- That need is now concrete: the existing frontend (RequestTimeline,
-- stageLabel, currentStep — all unchanged, all already correct for demo
-- data) renders the ENTIRE approvals array for any request it can see,
-- expecting to show "Direct Manager (done) -> Technical Manager (current)
-- -> General Manager (future)" to whichever approver is looking. Under the
-- current policy, a Technical Manager who is stage 2 of a 3-stage request
-- can only see their OWN row via SELECT — the Direct Manager's (stage 1)
-- and General Manager's (stage 3) rows are invisible to them, breaking the
-- timeline display even though requests_select_approver already correctly
-- grants them visibility into the PARENT request itself.
--
-- FIX: add one purely additive SELECT policy — if the caller is an approver
-- at ANY stage of a request (has_approval_role_in(request_id), the exact
-- same condition requests_select_approver already uses to grant visibility
-- into the parent row), they may see ALL of that request's approval rows,
-- not just their own. This does not widen which REQUESTS a caller can
-- discover — has_approval_role_in(request_id) can only be true for a
-- request they could already see via requests_select_approver — it only
-- makes the child table's visibility consistent with the parent's, which
-- request_approvals_select_own_request and request_approvals_select_hr
-- already do for the employee-owner and HR cases respectively. The existing
-- request_approvals_select_approver policy is left in place (redundant for
-- an approver's own row once this is added, but harmless — RLS policies are
-- OR'd together, and removing it is not necessary to fix the gap).
--
-- No recursion risk: has_approval_role_in is SECURITY DEFINER, owned by the
-- same role that owns request_approvals (postgres) — its internal query
-- bypasses RLS via Postgres's standard table-owner exemption (relforcerowsecurity
-- is false on this table), exactly the same mechanism that already makes it
-- safe to call from requests_select_approver today.
--
-- No write grant, no schema change, no existing policy altered or removed.

CREATE POLICY request_approvals_select_via_request ON request_approvals
    FOR SELECT
    TO authenticated
    USING (has_approval_role_in(request_id));
