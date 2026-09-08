-- set_approval_routing()'s "HR's Direct Manager is always the current
-- General Manager" step used a blanket
--   UPDATE profiles SET manager_id = v_final_gm WHERE role = 'HR' AND id <> v_final_gm
-- which repoints EVERY HR-role profile in the table, not just the HR account
-- that actually performed the routing change. In practice this meant any
-- other HR profile that exists for any reason (a second real HR account, or
-- in this project's current transitional state, a leftover seeded/test HR
-- profile) silently gets its manager_id rewritten to the new GM the moment
-- any HR user reassigns routing — an unrelated-row write the caller never
-- asked for and has no reason to expect.
--
-- The intended rule is narrower: the HR account that just configured
-- routing should report to the GM it configured. is_hr() (already the
-- function's own entry gate, right above) establishes that auth.uid() is
-- the authenticated caller's id and that that profile has role = 'HR', so
-- the sync only needs to target that one row.
create or replace function public.set_approval_routing(new_technical_manager_id uuid, new_general_manager_id uuid)
returns company_approval_routing
language plpgsql
security definer
set search_path = public
as $$
declare
    v_current_tm uuid;
    v_current_gm uuid;
    v_final_tm uuid;
    v_final_gm uuid;
    v_candidate profiles%rowtype;
    v_routing company_approval_routing%rowtype;
begin
    if not is_hr() then
        raise exception 'Only HR may change approval routing.';
    end if;

    select technical_manager_id, general_manager_id into v_current_tm, v_current_gm
    from company_approval_routing where id = 1 for update;

    -- Same-call cross-slot reassignment is not supported — see header.
    if new_technical_manager_id is not null and v_current_gm is not null
       and new_technical_manager_id = v_current_gm then
        raise exception
            'The selected Technical Manager is the current General Manager. Change the General Manager to someone else first, then retry.';
    end if;
    if new_general_manager_id is not null and v_current_tm is not null
       and new_general_manager_id = v_current_tm then
        raise exception
            'The selected General Manager is the current Technical Manager. Change the Technical Manager to someone else first, then retry.';
    end if;

    v_final_tm := coalesce(new_technical_manager_id, v_current_tm);
    v_final_gm := coalesce(new_general_manager_id, v_current_gm);

    if v_final_tm is not null and v_final_gm is not null and v_final_tm = v_final_gm then
        raise exception 'The Technical Manager and General Manager must be different people.';
    end if;

    if new_technical_manager_id is not null then
        select * into v_candidate from profiles where id = new_technical_manager_id;
        if not found or v_candidate.status <> 'ACTIVE' then
            raise exception 'The selected Technical Manager must be an active profile.';
        end if;
    end if;

    if new_general_manager_id is not null then
        select * into v_candidate from profiles where id = new_general_manager_id;
        if not found or v_candidate.status <> 'ACTIVE' then
            raise exception 'The selected General Manager must be an active profile.';
        end if;
    end if;

    -- Repoint routing to its final state in one statement — no transient
    -- half-updated routing row exists at any point.
    update company_approval_routing
        set technical_manager_id = v_final_tm,
            general_manager_id = v_final_gm,
            updated_at = now(),
            updated_by = auth.uid()
        where id = 1;

    -- Demote only whoever is leaving BOTH slots entirely — routing above no
    -- longer references them, so this passes the companion trigger.
    if v_current_tm is not null and v_current_tm <> v_final_tm and v_current_tm <> v_final_gm then
        update profiles set role = 'MANAGER' where id = v_current_tm;
    end if;
    if v_current_gm is not null and v_current_gm <> v_final_tm and v_current_gm <> v_final_gm then
        update profiles set role = 'MANAGER' where id = v_current_gm;
    end if;

    if v_final_tm is not null then
        update profiles set role = 'TECH_MANAGER' where id = v_final_tm;
    end if;
    if v_final_gm is not null then
        update profiles set role = 'GM' where id = v_final_gm;
    end if;

    -- The authenticated HR caller's Direct Manager is always the current
    -- General Manager (Phase 6A.1) — profiles.manager_id is the only place
    -- this is stored. Scoped to auth.uid() (the caller is_hr() already
    -- proved is an HR profile) so this never touches any other HR profile.
    -- Runs after the promotion above so a former-HR account being promoted
    -- to GM has already lost role = 'HR' and is correctly excluded from its
    -- own sync.
    if v_final_gm is not null then
        update profiles set manager_id = v_final_gm where id = auth.uid() and role = 'HR' and id <> v_final_gm;
    end if;

    insert into audit_logs (actor_id, action, table_name, record_id, metadata)
    values (
        auth.uid(), 'set_approval_routing', 'company_approval_routing', null,
        jsonb_build_object(
            'new_technical_manager_id', v_final_tm,
            'new_general_manager_id', v_final_gm,
            'previous_technical_manager_id', v_current_tm,
            'previous_general_manager_id', v_current_gm
        )
    );

    select * into v_routing from company_approval_routing where id = 1;
    return v_routing;
end;
$$;
