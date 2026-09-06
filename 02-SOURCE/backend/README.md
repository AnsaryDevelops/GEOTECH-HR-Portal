# Backend — Supabase / PostgreSQL

## Honest status

**These migrations are written but not wired up.** The running application never
calls them. Every employee, request, notification, leave type, attendance record and
holiday currently lives
in the browser's `localStorage` under `hr_portal_store_v4`.

Proof, from the frontend source:

```bash
grep -c supabase 02-SOURCE/frontend/src/app/App.tsx     # -> 0
```

Four of the five tables (`requests`, `notifications`, `leave_types`,
`audit_logs`) are never read or written by any code. Treat this folder as the
**destination**, not as something already in service.

## What the schema defines

| Table | Purpose |
|---|---|
| `profiles` | Employees. Self-referencing `manager_id` is the org hierarchy. |
| `leave_types` | HR-managed leave catalogue. |
| `requests` | Leave and mission requests, with `employee_name` / `manager_name` / `leave_type_name` snapshotted at creation so a later reorg does not rewrite history. |
| `notifications` | Per-user request lifecycle events. |
| `audit_logs` | Append-only trail. |

Row-level security is enabled on all five, deriving identity from `auth.uid()`.
Helper functions `is_hr()` and `is_manager_of()` are `SECURITY DEFINER` with
`SET search_path = public`, which correctly breaks the RLS recursion that
would otherwise occur when a policy on `profiles` queries `profiles`.

## Migration order

Apply in filename order:

1. `20260901122001_hr_portal_schema.sql` — tables, sequences, functions, triggers, indexes
2. `20260901122036_hr_portal_rls_and_seed.sql` — all RLS policies, 8 seed profiles, 6 leave types
3. `20260901122108_hr_portal_fix_security_warnings.sql` — `search_path` hardening, revokes EXECUTE
4. `20260901122123_hr_portal_revoke_public_execute.sql` — revokes EXECUTE from PUBLIC
5. `20260901122725_hr_portal_phase1_1_corrections.sql` — auth FK, tightens four policies

## Known issues to resolve before wiring this up

These came out of the audit (`04-DOCS/audit.html`). Verify each against a live
database before relying on the schema.

1. **`is_hr()` may be uncallable.** Migration 3 revokes EXECUTE from `anon` and
   `authenticated`; migration 4 revokes it from `PUBLIC`. Migration 4's header
   says it "re-grants only to the `authenticated` role" — **that GRANT is not in
   the file**, and `grep "^GRANT" *.sql` returns nothing. RLS policy expressions
   are evaluated as the querying user, so every policy that calls `is_hr()`
   risks failing with *permission denied for function*. Test this first.

2. **Notifications and audit logs cannot be written by the workflow.**
   Migration 5 narrows both INSERT policies to `WITH CHECK (is_hr())` and defers
   writes to triggers "added in the security-hardening phase". Those triggers
   were never written — only two `CREATE TRIGGER` statements exist in the whole
   schema, both `update_updated_at`. An employee cannot notify their manager on
   submit, and a manager cannot notify the employee on decision.

3. **`requests_insert` is too permissive.** `WITH CHECK (employee_id = auth.uid()
   OR is_hr())` constrains neither `manager_id` nor `status`. A direct PostgREST
   call can create a request that is already `APPROVED` with the employee named
   as their own approver.

4. **`requests_update` does not lock what its header claims.** It says only
   `status`, `decided_at` and `decision_comment` are writable by the assigned
   manager. It locks four columns and leaves roughly fifteen writable, including
   `start_date`, `end_date` and `leave_type_name`.

5. **No `decided_by`, no `updated_at` on `requests`.** The schema records when a
   decision happened but not who made it.

6. **No self-manager check and no cycle prevention** on `profiles.manager_id`.
   The frontend now guards both; the database does not.

7. **An employee cannot read their own manager's profile.** `profiles_select`
   allows reading downward, not upward, so the required Direct Manager display
   is unreadable under the policy as written.

8. **No `auth.users` rows are created.** The seed profiles carry hand-written
   UUIDs (`a0000000-…`) that can never equal a real `auth.uid()`. Creating auth
   users needs the Auth Admin API or the Supabase dashboard; plain SQL cannot do
   it safely.


## Not in the schema yet

The following now exist in the running application but have **no SQL
counterpart**. Model them before the frontend is switched to Postgres, or the
migration will silently lose them:

| Feature | Where it lives now | What the schema needs |
|---|---|---|
| Three-stage approval | `requests.approvals[]` in localStorage | A `request_approvals` table: request_id, stage, role, approver_id, approver_name, status, decided_at, comment. A single `manager_id` column cannot express it. |
| Leave entitlements | `profiles.entitlements` | Columns or a per-employee entitlement table keyed by bucket (ANNUAL, CASUAL), with the balance derived from approved requests rather than stored. |
| Leave-type buckets | `leave_types.balanceKey` | A nullable `balance_key` column on `leave_types`. |
| Working-day cost | `requests.workingDays` | A `working_days` column, snapshotted at creation so a later calendar change does not rewrite history. |
| Permission requests | `requests.type = 'PERMISSION'` | Extend the `type` CHECK constraint, and add `permission_kind` and `permission_minutes`. |
| Permission allowance | `profiles.permissionMinutesPerMonth` | A column, plus a monthly view or query that nets attendance against approved permissions. |
| Attendance | `attendance[]` | An `attendance` table: employee_id, date, check_in, check_out, note, recorded_by, recorded_at, unique on (employee_id, date). |
| Public holidays | `holidays[]` | A `holidays` table: date (unique), name. |

Balances should be **computed**, never stored as a running total. A stored
counter drifts the first time a request is corrected; deriving it from the
request rows cannot.

## Wiring it up

1. Create a Supabase project, then apply the five migrations in order.
2. Provision `auth.users` rows and set each `profiles.id` to the matching auth
   user id.
3. Add `.env` to the frontend:
   ```
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_ANON_KEY=...
   ```
4. Replace the `localStorage` reads and writes in
   `02-SOURCE/frontend/src/lib/store.ts` with Supabase queries.
5. **Keep the identity contract.** The application joins on `EMP-NNNNN`, so map
   `profiles.employee_number` onto `session.user.id` — not `profiles.id`. Getting
   this wrong is exactly the defect that made the original build non-functional.
6. Fix items 1 through 7 above, then re-test authorization by signing in as each
   role and attempting to read another user's data directly.
