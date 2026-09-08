# GEOTECH HR Portal

## 1. Product Overview

The GEOTECH HR Portal is a leave, mission and permission request system for a
small-to-mid-size organization. Employees submit requests through a
role-based approval chain (Direct Manager → Technical Manager → General
Manager for Leave and Mission; Direct Manager only for Permission), HR
manages the employee directory, departments, leave types, public holidays
and approval routing, and attendance is recorded by HR and automatically
converted into permission-minute deductions.

The application is a single-page React/TypeScript frontend backed by a real
Supabase project (Postgres, Auth, Row-Level Security, and SECURITY DEFINER
RPCs). It is not a static demo — real authentication, real data, and real
server-side authorization are live for the current production organization.

## 2. Current V1 Status

The application is feature-complete for V1 and is running against live
Supabase data:

- Real Supabase Auth sign-in (Employee Code + password), resolved to the
  correct Auth account server-side.
- A real production organization (5 active profiles) with a real
  hierarchy, real approval routing, and real departments.
- Leave, Mission and Permission submission, the full multi-stage approval
  workflow, notifications, and HR employee/department/leave-type/public
  holiday management are all implemented against the live database, not a
  local mock.
- A production-vs-historical data separation (`is_production`) keeps
  legacy/test accounts that must be retained for referential integrity out
  of the normal HR Employees directory, without deleting them.

The most recent stable checkpoint is commit `b52a1e1` — *"feat: finalize HR
production cleanup and controls"* — committed locally, **not pushed to any
remote**.

## 3. User Roles

The system has five roles, stored in `profiles.role`:

| Role | Summary |
|---|---|
| **EMPLOYEE** | Submits their own Leave/Mission/Permission requests, views their own request history, notifications, calendar, and profile. No approval authority. |
| **MANAGER** | Everything EMPLOYEE has, plus: approves requests from direct reports at the Direct Manager stage, views **My Team** (their direct reports). |
| **TECH_MANAGER** | Everything MANAGER has, plus: the singleton Technical Manager approval stage for every Leave/Mission chain in the company, and a read-only **Organization** directory. Exactly one active TECH_MANAGER can exist at a time. |
| **GM** | Everything TECH_MANAGER has (organization-wide view), plus: the singleton General Manager stage — always the final approval stage on any chain that includes one. Exactly one active GM can exist at a time. |
| **HR** | Employee directory (add/edit/activate/deactivate/assign manager & department/change password), Departments, Leave Types, Public Holidays, Approval Routing, company-wide Attendance entry, and a company-wide Requests view. HR also files requests for themselves like any other employee — **HR is never an approval stage**. |

Every role also has: My Requests (self-service submission history), Request
Details, Notifications, My Calendar, and My Profile (including a
self-service Change Password for real accounts).

## 4. Organization Hierarchy

`profiles.manager_id` (surfaced to the frontend as `EmployeeProfile.managerId`)
is the **single source of truth** for direct-manager relationships. There is
no separate hierarchy table — every "who reports to whom," "My Team,"
approval-chain, and authorization decision is derived directly from this one
column.

**Current production hierarchy** (5 active profiles):

```
HR Department (HR-001, HR)
        |
Mona Mohamed Ahmed Hassan (MONAHASSAN, GM)          ← no manager; top of the chain
        |
Abd El Rahman Ahmed Soliman Hassan (ASOLIMAN, TECH_MANAGER)
        |
Hassan Ahmed Hassan Ahmed (HASSANAHMED, MANAGER)
        |
Yasmin Abdeljawad Zied Abdeljawad (YASMINZIED, EMPLOYEE)
```

HR's own `manager_id` is kept in sync with whoever holds the GM seat by the
`set_approval_routing` RPC (HR's Direct Manager is always the current
General Manager). Employee Code, name, role, and department for each of
these five are documented in §11; no passwords or secrets are recorded
anywhere in this repository.

- **My Team** (MANAGER/TECH_MANAGER/GM): the profiles whose `manager_id`
  equals the signed-in user's own id — their direct reports only.
- **Direct manager**: read directly off `profiles.manager_id`; required for
  every real employee before they can submit anything (Leave/Mission/
  Permission submission is refused with "No active manager assigned" if it
  is null or points at an inactive/wrong-role profile).
- **Manager-based authorization**: every approval-chain stage, `My Team`
  membership check, and the singleton TM/GM promotion/demotion logic is
  computed live from `manager_id` and `company_approval_routing` — never
  cached or duplicated elsewhere.
- **Historical request snapshots**: a request stores its own
  `employee_id`/`manager_id`/`employee_name`/`manager_name` at submission
  time. A later reorganization (a manager reassignment, a routing change)
  never rewrites a request already in flight or already decided — see §15.

## 5. Request Types

### Leave

- Leave type (`leave_types`, HR-managed; e.g. Annual Leave, Emergency
  Leave, Sick Leave, Maternity Leave, Paternity Leave, Unpaid Leave)
- Start date / End date
- Reason (optional free text)
- **Working-day calculation**: `count_working_days()` counts every day in
  the range that is not Friday/Saturday and not a public holiday.
- **Working week is Sunday–Thursday**; **Friday and Saturday are the
  weekend** and never consume balance.
- **Balance**: only leave types with a `balance_key` (`ANNUAL` or `CASUAL`)
  are checked against `leave_allocations`; a **pending** request already
  holds its working-day count against the remaining balance (so several
  overlapping pending requests can't each look affordable), an **approved**
  request consumes it, and a **rejected** request releases it. Leave types
  with no `balance_key` (Sick/Maternity/Paternity/Unpaid) are not
  balance-limited.
- **Overlap protection**: enforced twice — a readable rejection message at
  submission time, and a real Postgres `EXCLUDE` constraint
  (`requests_no_overlapping_leave`) on the table itself, so no race
  condition can ever create two overlapping PENDING/APPROVED leave requests
  for the same employee.
- **Deletion rule**: see §7.

### Mission

- Start date/time, End date/time
- Location, Purpose (both required)
- **Overnight missions are supported** — the end datetime only needs to be
  strictly after the start datetime (`(end_date + end_time) >
  (start_date + start_time)`), it does not need to be the same calendar day.
- **End > start validation** is enforced identically in the submission RPC
  and as a database `CHECK` constraint, so nothing that passes one can fail
  the other.

### Permission

- Permission kind: **Late arrival** or **Early departure**
- Minutes (must be > 0)
- Date
- **09:00–17:00 model**: the workday starts at 09:00 and ends at 17:00.
  Attendance clock-ins after 09:00 or clock-outs before 17:00 automatically
  consume minutes from the same monthly allowance (see §9), and an approved
  Permission request for that exact date is subtracted so the same minutes
  are never charged twice.
- **240-minute cap**: a single Permission request cannot exceed 240 minutes,
  and the request is refused if it would exceed the employee's remaining
  monthly allowance (`permission_minutes_per_month`, 240 by default).
- **One-per-day rule**: an employee cannot hold two PENDING/APPROVED
  Permission requests for the same date; concurrent submissions are
  serialized with an advisory lock so this can't race.
- Weekends and public holidays are rejected outright ("That day is a
  weekend or a public holiday").
- **Direct-manager-only approval**: Permission never travels through the
  Technical Manager or General Manager — see §6.

## 6. Approval Workflow

**Leave / Mission:**

```
EMPLOYEE → DIRECT MANAGER → TECHNICAL MANAGER → GENERAL MANAGER → APPROVED
```

**Permission:**

```
EMPLOYEE → DIRECT MANAGER → APPROVED
```

The chain for Leave/Mission is built once, at submission, by
`build_approval_chain()`: Direct Manager, then the singleton Technical
Manager, then the singleton General Manager, skipping anyone who is
inactive, missing, or would appear a second time. It is snapshotted onto
the request's `request_approvals` rows — a later reorganization never
re-routes a request already in flight.

Documented, exact behavior:

- **Rejection immediately stops the chain.** The current stage is marked
  REJECTED, the request's own status becomes REJECTED, and every other
  stage row is left untouched at PENDING (never silently advanced or
  cancelled).
- **Rejection requires a comment.** Enforced server-side; an empty reason
  is refused.
- **Only the current approver can act.** Enforced by comparing the caller's
  identity against the specific pending stage row — never by client-
  asserted role. Anyone else attempting to approve/reject a request not at
  their stage is refused, and can only ever read it.
- **Previous decisions are preserved.** Approving stage 2 never touches
  stage 1's already-recorded decision, timestamp, or comment.
- **Historical approver identity is preserved.** Each `request_approvals`
  row stores the approver's name at decision time, independent of any
  later name/role change to that profile.
- **Duplicate approvers are removed from the chain.** If a person would
  appear twice (e.g. a manager whose own request routes to themself as
  Technical Manager), they are asked only once.
- **The workflow stops at GM. GM is always the final stage** on any chain
  that reaches it — enforced by both the chain-building logic and a
  database trigger invariant.
- **A requester cannot approve their own request** — enforced explicitly
  and independently in chain-building, and separately in the
  single-stage Permission path.
- **A Technical Manager's own Leave/Mission request goes directly to
  GM** — it does not return to the Technical Manager seat, since the
  duplicate-approver rule removes the TM from their own chain.
- **HR is not an approval stage.** No chain ever routes through the HR
  role; HR's own Leave/Mission requests route Direct Manager → GM only
  (their Direct Manager is always the GM, so this is effectively a single
  stage in the current organization).

## 7. Request Lifecycle

1. **Submission** — validated and inserted by the relevant
   `submit_*_request` RPC; the approval chain is built and snapshotted in
   the same transaction; the first approver is notified.
2. **Pending approval** — the request sits at whichever stage is currently
   PENDING; every other future stage row exists but is not yet actionable.
3. **Approval progression** — each APPROVE advances to the next pending
   stage (Leave/Mission only; Permission has one stage) and notifies both
   the employee and the next approver. `requests.status` stays PENDING
   until the final stage.
4. **Rejection** — closes the request immediately (§6) and notifies the
   employee with who rejected it and why.
5. **Final approval** — the last stage's APPROVE sets `requests.status =
   APPROVED`, records `decided_at`/`decided_by`, and notifies the employee.
6. **Request deletion** — **employees may delete their own request only
   while it is waiting for the Direct Manager and before the Direct
   Manager has decided** (status PENDING, stage 1 still PENDING). Once the
   Direct Manager has acted, deletion is refused ("Your Direct Manager has
   already acted on this request. It can no longer be deleted."), enforced
   server-side by `delete_own_request()` regardless of what the UI offers.
7. **Notifications generated during the lifecycle**: submission (to the
   first approver), advancement (to the employee and the next approver),
   rejection (to the employee), final approval (to the employee) — see §8.

## 8. Notifications

Four notification types exist, all inserted server-side by the request
RPCs (never fabricated client-side):

- `REQUEST_SUBMITTED` — sent to an approver when a request reaches their
  stage (including the very first stage at submission).
- `REQUEST_ADVANCED` — sent to the employee when their request moves to
  the next stage.
- `REQUEST_APPROVED` — sent to the employee when a request is fully
  approved.
- `REQUEST_REJECTED` — sent to the employee when a request is rejected.

Each notification is read/unread (`read` boolean), can be marked read
individually or all-at-once, and clicking one navigates to the underlying
request. The header notification bell is global across every role and
routes to the correct role-specific Notifications page
(`/employee/notifications`, `/manager/notifications`, or
`/hr/notifications`), showing an unread-count badge.

## 9. Attendance

Current V1 implementation:

- **HR manages attendance** — Attendance is an HR-only page
  (`/hr/attendance`); it does not appear in the navigation for any other
  role.
- **Check-in / check-out records**, plus an optional note, entered by HR
  per employee per date.
- **One attendance record per employee per date** — re-entering a date
  updates the existing row rather than creating a duplicate.
- **Employee calendar integration** — an employee's own attendance feeds
  their My Calendar widget (§10).
- **"Present" requires both a check-in and a check-out** for that date;
  a record with only one of the two does not count as Present on the
  calendar.
- **Employees do not self check-in/out in V1** — there is no employee-
  facing clock-in action anywhere in the app.
- **Managers/TM/GM do not have attendance-management pages in V1** — only
  HR can view or record attendance.
- A check-in after 09:00 or a check-out before 17:00 automatically
  deducts the late/early minutes from that employee's monthly Permission
  allowance (minus any approved Permission request already covering that
  date, so nothing is charged twice) — see §5, Permission.

## 10. Employee Calendar

"My Calendar" (shown on the Employee dashboard and available to every
role for their own record) renders the current month with one state per
day, using the actual implemented precedence, checked in this order:

```
Annual Leave → Public Holiday → Present → Weekend → Normal
```

- **Annual Leave** — the day falls inside an APPROVED leave request whose
  leave type's balance bucket is ANNUAL.
- **Public Holiday** — the day is in `public_holidays`.
- **Present** — an attendance record exists for that day with both
  check-in and check-out.
- **Weekend** — Friday or Saturday.
- **Normal** — none of the above.

The calendar shows a legend for each state and rings today's date.

## 11. HR Employee Management

HR → Employees provides:

- **Employee directory** — the production employee list (see the
  production-directory rule below).
- **Search** — by name, id, or employee code.
- **Filter** — by role, department, status.
- **Add Employee** — creates a real Supabase Auth user (via the
  `provision-employee` Edge Function) and its matching `profiles` row in
  one operation; the account can sign in immediately with the initial
  password HR sets.
- **Edit Employee** — updates the profile's name/email/phone/position/
  department/role/manager/status/leave-opening-balances/permission
  allowance.
- **Role assignment** — HR can assign EMPLOYEE/MANAGER roles directly;
  promoting someone to TECH_MANAGER or GM is done only through Approval
  Routing (§12), which keeps `profiles.role` and
  `company_approval_routing` in sync and respects the TM/GM singleton
  constraint.
- **Department assignment** — from the live `departments` table.
- **Manager assignment** — any active MANAGER/TECH_MANAGER/GM profile;
  guarded against self-management and reporting loops.
- **Activation / deactivation** — deactivating a MANAGER who still has
  active direct reports is refused ("N employees still report to X.
  Reassign them first."), enforced both client-side and by a database
  trigger.
- **HR-managed password change** — the same Edit Employee "Password"
  field now calls a dedicated, HR-authorized Edge Function
  (`hr-update-employee-password`) that updates the target employee's real
  Supabase Auth password server-side; HR is never shown or asked for the
  employee's existing password.
- **Manager/team assignment** — Add Employee (Manager) supports assigning
  an initial set of direct reports in the same step.

**Production-directory rule**: the normal Employees directory shows only
profiles where `is_production = true`. This is a boolean column on
`profiles`, evaluated by the frontend directory query — it is **not**
implemented as a hard-coded list of employee IDs, and it does not affect
Add Employee, Edit Employee, manager/team selectors, Approval Routing, or
any approval/authorization logic, all of which continue to see every
profile. See §16.

## 12. HR Settings

### Leave Types

Full CRUD by HR: create a leave type with a name and an optional balance
bucket (ANNUAL/CASUAL, or none for unlimited-by-policy types), edit its
name/bucket, and activate/deactivate it. Only ACTIVE leave types are
selectable when submitting a Leave request.

### Public Holidays

- **Add** — HR sets a date and a name.
- **Edit** — HR can change an existing holiday's Name and Date; the
  existing row is updated in place by its id (no new row is created, no
  other field changes).
- **Remove** — HR can delete a holiday.
- **HR-only**, enforced both by RLS (`public_holidays_insert_hr`,
  `public_holidays_update_hr`, `public_holidays_delete_hr`, each gated on
  `is_hr()`) and by the table grants themselves.
- **Fields are Name + Date only** — there is no Description field, on
  either the form or the underlying table.

Current production public-holiday data contains **13 records** and is
considered finalized at this checkpoint.

### Approval Routing

- **Singleton Technical Manager** and **singleton General Manager** —
  enforced by partial unique indexes on `profiles` (`role = 'TECH_MANAGER'
  AND status = 'ACTIVE'`, `role = 'GM' AND status = 'ACTIVE'`), so at most
  one active profile can hold each seat at any time.
- **HR-managed** — only HR can call `set_approval_routing()`; it validates
  the two candidates are active, distinct people, promotes them to the
  right role, demotes whoever is fully vacating a seat back to MANAGER,
  and keeps every HR profile's `manager_id` pointed at the current GM.
- **Current production routing**: Technical Manager = Abd El Rahman Ahmed
  Soliman Hassan (ASOLIMAN); General Manager = Mona Mohamed Ahmed Hassan
  (MONAHASSAN).

### Departments

HR can add a department and rename/archive an existing one (archiving sets
`status = INACTIVE` rather than deleting — no hard delete, so historical
employee/profile department references stay intact). The current
production environment contains **8 active departments**: Human Resources,
Information Technology, Consulting Services Department, GIS & Spatial
Intelligence Department, Survey & Reality Capture Department, Remote
Sensing & Mapping Department, Data Management & Analytics Department, and
Product & Solutions Department.

## 13. Dashboards

- **Employee** — a "Submit a New Request" call to action, Leave/Permission
  balance cards, pending/approved request counts, the 5 most recent
  requests, and My Calendar.
- **Manager / Technical Manager / GM** — request counts scoped to what the
  signed-in approver can act on, a recent-requests list, My Team (direct
  reports), and (Technical Manager/GM only) a read-only company-wide
  Organization directory.
- **HR** — total/active employee counts, total/pending/approved/rejected
  request counts, Add Employee and View Employees shortcuts, a
  recent-requests list, and My Calendar for HR's own record.

Only functionality actually present in the current build is described
above — no dashboard widget beyond what is listed here exists in V1.

## 14. Security & Authorization

- **Supabase Auth** is the authentication authority for every real
  account — passwords are never handled, hashed, or stored by this
  codebase (see the auth architecture note in §19).
- **Employee-code → Auth identity resolution**: the login form only ever
  asks for Employee Code + password. A narrow, `SECURITY DEFINER` RPC
  (`resolve_login_identity`) resolves the entered code to that profile's
  real Supabase Auth email — never a client-side guess — before
  `signInWithPassword` is called.
- **Role-based access** — route access and page content are gated on
  `session.user.role`.
- **Row-Level Security (RLS)** is enabled on every application table;
  every table's policies are scoped by `auth.uid()`, `is_hr()`, or an
  equivalent server-side check — never trusted from the client.
- **SECURITY DEFINER RPCs** are the only way real data is created,
  submitted, decided, or reassigned: `submit_leave_request`,
  `submit_mission_request`, `submit_permission_request`, `decide_request`,
  `delete_own_request`, `hr_create_employee`,
  `hr_create_manager_with_team`, `set_approval_routing`, among others —
  each independently re-verifies the caller's identity and authorization
  rather than trusting the RLS policy alone.
- **Server-side HR authorization** — every HR-only action (employee
  creation, password reset, routing, departments, leave types, public
  holidays) is re-checked by `is_hr()` inside the RPC/Edge Function
  itself, not just by RLS or the UI.
- **Approval authorization** — `decide_request()` checks the caller's
  identity against the specific pending stage row before allowing an
  APPROVE/REJECT.
- **Self-approval protection** — a requester can never appear as an
  approver on their own request, enforced in both the chain-building
  function and the single-stage Permission path independently.
- **GM final-stage invariant** — enforced by both `build_approval_chain()`
  and a database trigger, so no chain can be constructed or mutated to
  place a stage after GM.
- **Manager-with-reports protection** — a MANAGER-role profile with active
  direct reports cannot be deactivated, enforced by both the frontend and
  a database trigger (`protect_manager_with_reports`).
- **Request overlap protection** — a real Postgres `EXCLUDE` constraint
  backs the Leave overlap check described in §5, independent of
  application-level validation.
- **Historical snapshots** — request rows and their approval rows never
  change to reflect a later reorganization (§4, §15).
- **Service-role credentials are never exposed to the frontend.** The
  service-role key exists only inside the two Edge Functions
  (`provision-employee`, `hr-update-employee-password`), read from their
  own server-side environment; every privileged action they perform is
  gated on independently re-verifying the caller is HR via their own JWT
  first.

## 15. Data Integrity & Historical Records

- **Request snapshots** — `employee_id`, `manager_id`,
  `employee_name`, `manager_name` are captured on the request row at
  submission time and never rewritten afterward.
- **Approval history** — every `request_approvals` row keeps its own
  `status`, `decided_at`, and `comment` permanently once decided.
- **Historical approver identity** — `approver_name` is stored on the
  approval row itself, so a later name or role change never alters what
  the historical record shows.
- **Manager relationships** — `profiles.manager_id` reflects the *current*
  org chart; historical requests are unaffected by later changes to it,
  since they carry their own snapshot fields instead of deriving from it.
- **Archival mechanism** — `requests.archived_at` / `requests.archived_by`
  mark a request as retained-but-hidden. Archived requests are excluded
  from every normal request list, dashboard, and count in the app (a
  single shared fetch query filters `archived_at IS NULL`); archiving
  never deletes or alters any of the request's own data, approval rows,
  notifications, or audit log entries.
- Two requests (**REQ-00003**, **REQ-00004**) are retained in the database
  as protected historical records — kept for referential integrity rather
  than deleted — and are archived (excluded from normal production
  request UI) rather than removed. This README intentionally does not
  restate the personal details of the historical accounts involved.

## 16. Production/Test Data Policy

- **Production profiles**: `is_production = true`.
- **Historical/test profiles that must remain for referential integrity**:
  `is_production = false`. These profiles cannot be safely deleted while
  they are still referenced by protected historical requests, their
  approval rows, or audit records (Postgres foreign keys on those tables
  are `RESTRICT`, not cascading) — so they are retained, most deactivated,
  rather than removed.
- The normal production Employees directory (§11) excludes non-production
  profiles. This flag defaults to `true` for every new profile created
  going forward, so normal HR usage requires no extra step.

**This is a directory-visibility mechanism, not a security boundary.**
`is_production` has no bearing on RLS, authentication, or authorization —
a non-production profile that is still ACTIVE is still a fully functional
account with whatever role/permissions its `role` column grants; the flag
only controls whether it appears in the normal HR Employees list.

## 17. Repository Structure

```
GEOTECH-HR-Portal/
│
├── 01-DEMO/                       standalone offline build (see its own docs)
├── 02-SOURCE/
│   ├── frontend/                  the application source — run this
│   │   ├── src/app/App.tsx          the whole UI: design system, shell, every page
│   │   ├── src/lib/store.ts         data types, the StoreProvider, request/approval model
│   │   ├── src/lib/auth.ts          Supabase Auth sign-in, session, HR password ops
│   │   ├── src/lib/supabase.ts      the Supabase client (anon key only)
│   │   └── package.json
│   │
│   └── backend/                   early prototype schema (5 migrations, Sept 1) —
│                                   superseded by supabase/migrations below; kept
│                                   for history, not the current source of truth.
│
├── 03-ACCOUNTS/                   account/roster reference material
├── 04-DOCS/                       specs, design guidelines, audit notes
├── 05-DESIGN/                     Figma/design-token source
│
├── supabase/
│   ├── migrations/                the current, live database schema — 55 migrations,
│   │                               applied to the linked Supabase project
│   └── functions/
│       ├── provision-employee/            creates a real Auth user + profile (HR-only)
│       └── hr-update-employee-password/   HR-authorized real password reset (HR-only)
│
└── README.md                      this file
```

`supabase/migrations/` and `supabase/functions/` are the **current, active
backend** — not `02-SOURCE/backend`, which predates the real Supabase
integration.

## 18. Local Development

The project is run locally from `02-SOURCE/frontend/`:

```bash
cd 02-SOURCE/frontend
npm install
npm run dev        # starts Vite on http://localhost:5173 (or the next free port)
```

Other scripts (from `package.json`):

```bash
npm run build       # production build (vite build)
npm run preview     # preview a production build locally
npm run typecheck   # tsc --noEmit
```

A `.env.local` file (not committed) supplies `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY`; without it the app falls back to local demo-mode
storage rather than talking to Supabase — see §19.

## 19. Database / Supabase

- **Postgres + Supabase Auth (GoTrue)** — every real account is a
  Supabase Auth user; `profiles.id` is a foreign key straight into
  `auth.users.id`.
- **Row-Level Security** is the enforcement boundary for every table read
  or write the frontend performs directly; every write the frontend
  cannot safely perform itself (creating an Auth user, resetting another
  user's password) goes through a narrowly-scoped Edge Function instead.
- **SECURITY DEFINER RPCs** (Postgres functions, `SET search_path =
  public`) are how requests are submitted/decided/deleted and how HR
  performs employee/routing/holiday/department management — see §14 for
  the authorization model.
- **Edge Functions** (`provision-employee`, `hr-update-employee-password`)
  are the only places the service-role key is ever used, read from their
  own server environment — never from a request body, never returned to
  the caller, never present in any frontend file or build output.
- The frontend's only Supabase credential is the **anon key**
  (`VITE_SUPABASE_ANON_KEY`), which is safe to ship in a client bundle by
  design — it has no authority beyond what RLS and the RPCs above grant it.

This README does not include, and this repository should never contain,
project secrets, service-role keys, passwords, JWT secrets, or other
private credentials.

## 20. Recent Implementation History

Major completed milestones, most recent first:

- Production cleanup and controls finalized — historical/test accounts
  retained only where required, deactivated where possible, production
  directory verified — `b52a1e1` *(local checkpoint, not pushed)*.
- Public Holiday Edit (Name + Date, HR-only, updates by id).
- Production employee visibility via `is_production`.
- Request archival mechanism (`archived_at`/`archived_by`), applied to the
  two protected historical requests.
- Approval-routing HR-manager-sync hardening (routing changes only sync
  the acting HR caller's own manager field, not every HR profile).
- HR-managed password change for real employee accounts, via a dedicated
  server-side Edge Function.
- Employee-code → real Supabase Auth login identity resolution (replacing
  an earlier synthetic-email-guessing approach).
- Real Supabase authentication end to end (sign-in, session persistence,
  sign-out) for real accounts, alongside the still-supported local demo
  accounts.
- Complete approval-chain hardening: GM final-stage invariant,
  self-approval protection, duplicate-approver removal, manager-with-
  reports deactivation guard.
- Production request workflow (Leave/Mission/Permission submission,
  multi-stage approval, notifications) connected to real Supabase data.
- Real attendance entry and calendar integration.
- Employee management (add/edit/activate/deactivate, department and
  manager assignment) connected to real Supabase data.

## 21. Current V1 Completion Status

**DONE**

- Authentication (real Supabase Auth + local demo mode)
- Roles (EMPLOYEE, MANAGER, TECH_MANAGER, GM, HR)
- Employee management (add/edit/activate/deactivate, HR password reset)
- Organization hierarchy (manager_id-driven, My Team, Organization view)
- Leave requests (balances, overlap protection, working-day calculation)
- Mission requests (overnight support, datetime validation)
- Permission requests (240-minute cap, one-per-day, attendance integration)
- Approval workflow (multi-stage, self-approval protection, GM invariant)
- Notifications (submitted/advanced/approved/rejected, global bell)
- Attendance (HR-entered, permission-minute deduction)
- Employee Calendar (leave/holiday/present/weekend precedence)
- Public Holidays (add/edit/remove, HR-only)
- Request archival (protected historical requests hidden from normal UI)
- Production employee directory (`is_production` visibility)

**PARTIALLY COMPLETE / FINAL QA**

- Dashboard visual polish
- Final role-by-role QA pass across the production organization
- Final Settings verification (Departments, Leave Types) under real data
- Minor UI polish

## 22. Known Limitations / Future Work

- No request cancellation after the Direct Manager stage (by design —
  see §7), no approval delegation, no attachments, no exports.
- Leave balances do not accrue over time or carry over at year end — HR
  sets an opening figure and it decrements from there.
- Attendance is entered by HR; there is no employee self-service clock-in
  and no manager/TM/GM attendance page in V1.
- The historical/test profiles retained for referential integrity
  (`is_production = false`) cannot currently be fully removed — Postgres
  `RESTRICT` foreign keys from the two protected historical requests block
  their deletion, and the remaining ones are deactivated rather than
  deleted.
- `02-SOURCE/backend` contains an early, superseded schema draft and
  should not be used as a reference for the current database — see §17.
