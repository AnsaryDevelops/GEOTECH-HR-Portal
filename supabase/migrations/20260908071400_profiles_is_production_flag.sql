-- No existing column, relationship, or convention reliably distinguishes
-- the real production organization from legacy/test/historical profiles:
-- department_id is shared (HR-001 sits in the same "Human Resources" row as
-- three test profiles), role spans both sets, the synthetic @auth.internal
-- email scheme is used by both, and the manager_id hierarchy is currently
-- unreliable for this purpose (TESTHR01.manager_id still points at the
-- production GM, a known leftover from an earlier routing bug). This adds
-- the single minimal flag needed for the HR Employees directory to show
-- only real production profiles, per explicit confirmation that no
-- existing field is suitable.
--
-- Defaults to true so every profile created going forward through the
-- existing HR-only paths (hr_create_employee, hr_create_manager_with_team,
-- provision-employee) is automatically visible in the directory with no
-- extra step — none of those paths need to change, since they never list
-- this column explicitly and simply take the default. Only the five known
-- legacy/test profiles are backfilled to false here, once.
alter table public.profiles
  add column is_production boolean not null default true;

comment on column public.profiles.is_production is
  'Whether this profile belongs to the real production organization (shown in the HR Employees directory) rather than a legacy/test/historical profile kept only for referential reasons (e.g. protected historical requests REQ-00003/REQ-00004). Defaults to true for every new profile; set to false only for known legacy/test accounts.';

update public.profiles
  set is_production = false
  where employee_code in ('TESTHR01', 'PH6AMGR1', 'PH6AEMP1', 'TESTEMP', 'TEST001');
