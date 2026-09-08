-- public_holidays currently only supports INSERT (public_holidays_insert_hr)
-- and DELETE (public_holidays_delete_hr) for HR, with no UPDATE policy or
-- grant at all — editing an existing holiday (HR Settings -> Public
-- Holidays -> Edit) has therefore never been possible. This adds the
-- missing UPDATE path only, mirroring the existing insert/delete policies
-- exactly: gated on is_hr(), both at the RLS layer and the table grant.
-- Nothing else about the table changes.
grant update on public.public_holidays to authenticated;

create policy public_holidays_update_hr
  on public.public_holidays
  for update
  using (is_hr())
  with check (is_hr());
