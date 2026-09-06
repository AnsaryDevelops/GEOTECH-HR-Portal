-- Phase 4: companion protection for company_approval_routing (PRODUCTION-BACKEND-PLAN.md §5.7).
--
-- A BEFORE UPDATE trigger on profiles rejects any attempt to deactivate, or
-- to change the role away from TECH_MANAGER/GM, on a profile that
-- company_approval_routing *currently* references as the Technical Manager
-- or General Manager. This is what actually prevents routing and
-- profiles.role from drifting out of sync — set_approval_routing (a later
-- migration in this phase) always repoints routing away from the old holder
-- *before* touching their role, so its own internal demotion passes this
-- check cleanly; any other, uncoordinated attempt to deactivate or re-role
-- the sitting TM/GM (e.g. HR's ordinary profiles UPDATE grant) is exactly
-- what this trigger exists to block.
--
-- SECURITY DEFINER so the lookup against company_approval_routing does not
-- depend on the calling role's own grants/RLS remaining permissive forever —
-- it runs under the trigger function's owner regardless of who performed the
-- UPDATE.

CREATE FUNCTION protect_active_tm_gm()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM company_approval_routing
        WHERE technical_manager_id = OLD.id OR general_manager_id = OLD.id
    ) THEN
        IF NEW.status = 'INACTIVE' OR NEW.role NOT IN ('TECH_MANAGER', 'GM') THEN
            RAISE EXCEPTION
                'Cannot deactivate or change the role of the currently assigned Technical Manager/General Manager. Assign a replacement via Approval Routing first.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION protect_active_tm_gm() FROM PUBLIC;

CREATE TRIGGER profiles_protect_active_tm_gm
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION protect_active_tm_gm();
