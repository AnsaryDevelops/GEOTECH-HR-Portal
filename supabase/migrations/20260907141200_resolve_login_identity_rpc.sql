-- Narrow, anon-callable lookup used only by the client's employee-code login
-- flow (02-SOURCE/frontend/src/lib/auth.ts). The `anon` role has no grants on
-- `profiles` at all (by design — every RLS policy on that table is keyed on
-- auth.uid(), which does not exist before sign-in), so resolving "Employee
-- Code -> Supabase Auth login email" cannot go through a direct table read
-- from the pre-login client. This function exposes exactly the three fields
-- the login flow needs (the profile's Auth UUID, its real Supabase Auth
-- login email, and its status) and nothing else — no name, role, department,
-- manager, or other profile data.
--
-- Real Auth users are not guaranteed to use the synthetic
-- "<employee_code>@auth.internal" email the provision-employee Edge Function
-- assigns to employees it creates — a manually-provisioned account (e.g. the
-- first HR account) may have a real mailbox as its Auth login email instead.
-- This function reads the true auth.users.email for the profile rather than
-- the client guessing/deriving it, which is the actual fix this migration
-- exists for.
--
-- SECURITY DEFINER is required to read auth.users (never otherwise exposed
-- to anon/authenticated) and to bypass profiles' RLS. search_path is pinned
-- to prevent search-path hijacking in a SECURITY DEFINER function.
create or replace function public.resolve_login_identity(p_employee_code text)
returns table (auth_id uuid, login_email text, status text)
language sql
security definer
set search_path = public
as $$
  select p.id, u.email, p.status
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.employee_code = upper(btrim(p_employee_code))
  limit 1;
$$;

revoke all on function public.resolve_login_identity(text) from public;
grant execute on function public.resolve_login_identity(text) to anon, authenticated;
