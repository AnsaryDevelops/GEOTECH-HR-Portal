-- profiles has RLS policies profiles_update_self and profiles_update_hr,
-- and the protect_profile_self_edit_fields trigger, all already correct —
-- but no UPDATE grant to authenticated was ever added, so every UPDATE on
-- profiles is rejected at the table-grant layer before RLS is even
-- evaluated. This breaks HR's Edit Employee (including the quick
-- Activate/Deactivate toggle) and every user's My Profile self-edit for
-- all real accounts. This migration adds only the missing grant; no
-- policy or trigger is touched.
grant update on public.profiles to authenticated;
