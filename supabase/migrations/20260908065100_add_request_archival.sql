-- Adds a request-level archival/visibility concept so a historical record
-- (REQ-00003/REQ-00004: protected test-era requests kept permanently for
-- referential/audit reasons) can be hidden from normal production request
-- lists without touching any of its actual historical data — status,
-- timestamps, employee/manager snapshots, approval rows, notifications, and
-- audit logs are all completely untouched by this migration.
--
-- archived_at is nullable and defaults to NULL, so every existing and
-- future normal request is unaffected and remains visible exactly as
-- before; only a row with archived_at set is excluded from the single
-- fetch query the frontend uses for every request list, dashboard, and
-- count (fetchRealRequests in App.tsx — there is only one `.from("requests")`
-- read site in the whole app, so filtering there covers Employee/Manager/
-- TM/GM/HR requests, dashboards, and counts in one place).
alter table public.requests
  add column archived_at timestamptz,
  add column archived_by uuid references public.profiles(id);

comment on column public.requests.archived_at is
  'When set, this request is excluded from normal production request lists while its historical data remains fully intact and queryable. NULL = visible normally (the default for every request).';
comment on column public.requests.archived_by is
  'The profile that performed the archival, when done through an authenticated action. NULL when archival was applied directly as part of a one-time administrative/migration operation, as with REQ-00003/REQ-00004.';

-- REQ-00003 and REQ-00004 are the two protected historical test requests —
-- archived here as a one-time administrative operation (no HR user
-- performed this through the UI), hence archived_by is left NULL. Nothing
-- else about either row is touched.
update public.requests
  set archived_at = now()
  where request_number in ('REQ-00003', 'REQ-00004');
