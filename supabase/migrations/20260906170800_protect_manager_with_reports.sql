-- Phase 6B-14 — Security & Production Hardening.
--
-- ROOT CAUSE: HREmployeesPage.updateEmployee already refuses to deactivate a
-- Direct Manager (role = 'MANAGER') who still has direct reports —
-- App.tsx's own comment on that check says plainly "this rule has always
-- been enforced client-side only, on either path" (demo and real). RLS
-- (profiles_update_hr) only checks is_hr() — it has no knowledge of this
-- business rule — so any authenticated HR session bypassing the frontend
-- (a direct supabase-js call, a scripting error, a future UI regression)
-- could set status = 'INACTIVE' on a Manager whose reports still point at
-- them via manager_id, exactly the "orphaned team, frozen pending requests"
-- outcome that check exists to prevent (submit_leave_request/
-- submit_mission_request/submit_permission_request all require an ACTIVE
-- manager and would start rejecting every new submission from that team
-- until HR manually reassigns them).
--
-- This is the same category of gap already closed for the Technical
-- Manager/General Manager singleton roles by protect_active_tm_gm
-- (20260906150100) — that trigger protects the TWO routing seats;
-- this one closes the identical hole for a plain Direct Manager. Mirrors
-- the frontend condition exactly: `target.role === "MANAGER" && reports.length > 0`,
-- where `reports` is every profile whose manager_id equals this one,
-- regardless of that report's own status (the frontend never filters
-- reports by status either).
--
-- Scope is deliberately narrow — only role = 'MANAGER' transitioning to
-- INACTIVE. TECH_MANAGER/GM deactivation is already fully covered by
-- protect_active_tm_gm (which blocks it unconditionally while they hold a
-- routing seat, reports or not). This migration does not touch that
-- trigger, and does not add any new hierarchy rule beyond the one the
-- frontend already enforces — it only makes that existing rule
-- unbypassable.
--
-- No historical data is touched: no UPDATE/DELETE against requests,
-- request_approvals, or profiles appears anywhere in this migration.

CREATE FUNCTION protect_manager_with_reports()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_report_count integer;
BEGIN
    IF OLD.role = 'MANAGER' AND NEW.status = 'INACTIVE' AND OLD.status IS DISTINCT FROM 'INACTIVE' THEN
        SELECT count(*) INTO v_report_count FROM profiles WHERE manager_id = OLD.id;
        IF v_report_count > 0 THEN
            RAISE EXCEPTION
                '% employee% still report to %. Reassign them first.',
                v_report_count, CASE WHEN v_report_count = 1 THEN '' ELSE 's' END, OLD.name;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_protect_manager_with_reports
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION protect_manager_with_reports();
