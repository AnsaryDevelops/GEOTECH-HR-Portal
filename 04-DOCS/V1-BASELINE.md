# GEOTECH HR Portal — V1 Baseline

Status: **Approved V1 frontend baseline**, captured immediately before the production backend/Supabase migration phase begins.

This document records the **current, approved behavior** of the application as implemented. It is not a proposal, a roadmap, or a wishlist — every item below is either directly observable in the source under `02-SOURCE/frontend/` or already documented in that source's own comments. Where a rule is a deliberate design decision, its rationale is included so it survives the upcoming migration.

Source inspected: `02-SOURCE/frontend/`. `01-DEMO/` is a built artifact and was not touched or used as a reference for this document.

- Entry point: [src/main.tsx](../02-SOURCE/frontend/src/main.tsx) → mounts `<App/>` from [src/app/App.tsx](../02-SOURCE/frontend/src/app/App.tsx).
- `App.tsx` contains the design system, the shell, every page, and the router — one file, by original design (see that file's own section banners).
- Business/data logic lives in [src/lib/store.ts](../02-SOURCE/frontend/src/lib/store.ts); auth in [src/lib/auth.ts](../02-SOURCE/frontend/src/lib/auth.ts).

---

## A. Product Scope

**In scope for V1:**
- Sign-in with persisted session (survives a refresh).
- Three request types: Leave, Mission, Permission.
- Three-stage approval chain for Leave/Mission (Direct Manager → Technical Manager → General Manager); single-stage for Permission (Direct Manager only).
- Employee self-service: submit requests, view own requests, delete a request while it is still at the Direct Manager stage, view notifications.
- Manager/Technical Manager/GM: view and act on requests in their chain, view their own direct reports ("My Team"/"My Teams"), file their own requests as employees.
- Technical Manager and GM additionally: read-only company-wide Organization directory with Employee/Manager/Type filters.
- HR: employee lifecycle management (create/edit/activate/deactivate), including assigning a new Direct Manager's initial team at creation time; company-wide request visibility with a type-aware Request Details view; attendance entry; leave type and public holiday management; company-wide notifications.
- Leave balances (Annual/Casual) computed from request history, never stored as a running counter.
- Monthly permission allowance (240 minutes), netted against attendance lateness/early-departure and approved permission requests.
- A compact "My Calendar" current-month widget on every role's dashboard.
- Per-user notifications with read/unread state, mark-one-as-read, and mark-all-as-read.
- A live, no-sign-in-required component gallery at `/design-system`.

**Explicitly out of scope for V1** (per the project's own README and this session's work — not attempted, not partially built):
- No live backend. All persistence is `localStorage` (see Section 3).
- No request cancellation after it has left the Direct Manager stage, no approval delegation, no attachments, no exports, no Arabic/RTL support.
- No leave accrual or year-end carry-over — HR sets an opening balance once, and it decrements from there.
- No automatic fingerprint/device attendance ingestion — HR types in check-in/check-out.
- No server-side authorization — the client is the only enforcement layer today (see Section 3).
- No month navigation, popups, or interaction on the dashboard calendar — it is a static current-month snapshot by design.
- Editing an existing Direct Manager's team roster is not part of this feature — team assignment only happens at manager-creation time in HR's Add Employee flow; reassigning an existing employee's manager afterward still goes through the normal Edit Employee form.

---

## B. Roles

Five roles, defined in `UserRole` ([store.ts](../02-SOURCE/frontend/src/lib/store.ts)):

| Role | Label shown in UI | Approval chain membership |
|---|---|---|
| `EMPLOYEE` | Employee | Requester only |
| `MANAGER` | Direct Manager | Stage 1 (for their own reports) |
| `TECH_MANAGER` | Technical Manager | Stage 2 (singleton — one active Technical Manager system-wide) |
| `GM` | General Manager | Stage 3 (singleton — one active GM system-wide) |
| `HR` | HR | Not in any approval chain — administrative only |

`ROLE_RANK` and `APPROVER_ROLES = ["MANAGER", "TECH_MANAGER", "GM"]` ([store.ts](../02-SOURCE/frontend/src/lib/store.ts)) formalize this: HR sits on a separate administrative axis and never approves anything. Every role — including MANAGER, TECH_MANAGER, GM, and HR — can also submit their own requests as an employee (`RoleRoute` on the self-service routes allows all five roles).

---

## C. Navigation by Role

Defined once in `NAV_ITEMS` ([App.tsx](../02-SOURCE/frontend/src/app/App.tsx)):

- **EMPLOYEE:** Dashboard · My Requests · Notifications
- **MANAGER:** Dashboard · My Team · My Requests · Requests · Notifications
- **TECH_MANAGER:** Dashboard · **My Teams** · My Requests · Requests · Organization · Notifications
- **GM:** Dashboard · My Team · My Requests · Requests · Organization · Notifications
- **HR:** Dashboard · Employees · My Requests · Requests · Attendance · Notifications · Settings

Note: the Technical Manager's team-overview label is "My Teams" (plural) — a label-only distinction, since a Technical Manager conceptually oversees several department managers' teams at once. The underlying page and data (an approver's own direct reports, via `managerId`) are identical to MANAGER's and GM's "My Team".

`/manager/organization` is gated to `TECH_MANAGER` and `GM` only — a plain MANAGER does not see it.

---

## D. Request Types

Modeled by `RequestType = "LEAVE" | "MISSION" | "PERMISSION"` on `RequestRecord` ([store.ts](../02-SOURCE/frontend/src/lib/store.ts)).

**Leave** — `leaveType` (name, HR-managed catalogue), `startDate`, `endDate`, `reason`, `balanceKey` (which entitlement pot it draws from, snapshotted from the leave type at submission), `workingDays` (snapshotted count, so a later calendar/holiday change never rewrites history).

**Mission** — `startDate`/`startTime`, `endDate`/`endTime`, `location`, `purpose`. Duration (when shown) is computed on the fly from these four fields; it is not stored.

**Permission** — `permissionKind` (`LATE_ARRIVAL` | `EARLY_DEPARTURE`), `startDate` only (a Permission is always same-day — there is no separate end date field), `permissionMinutes`, optional `reason`. A Permission's clock start/end times are not stored; where displayed (HR's Request Details), they are derived from the fixed workday bounds (`WORKDAY_START`/`WORKDAY_END`) and `permissionMinutes`.

All three types share: `id`, `requestNumber` (`REQ-NNNNN`), `employeeId`/`employeeName`, `managerId`/`managerName` (the Direct Manager, snapshotted — see Section E), `approvals[]` (the full chain), `status`, `submittedAt`, and, once decided, `decidedAt`/`decisionComment`.

---

## E. Approval Workflows

**Leave and Mission:**
```
Employee → Direct Manager (stage 1) → Technical Manager (stage 2) → General Manager (stage 3) → APPROVED
```

**Permission:**
```
Employee → Direct Manager → APPROVED
```
A Permission never travels past the Direct Manager — `createPermissionRequest` builds a single-stage chain (`App.tsx`) — because it is a short absence the direct manager can decide alone.

**Chain construction** (`buildApprovalChain`, [store.ts](../02-SOURCE/frontend/src/lib/store.ts)): resolved and **snapshotted onto the request at submission time**, so a later reorganization never re-routes a request already in flight. Two integrity rules apply while building it:
- The requester is never their own approver.
- A person who would appear twice (e.g. a department manager whose own Direct Manager *is* the Technical Manager) is asked only once — their own requests run a two-stage chain, not four.

**Rules enforced by `decideRequest`** ([App.tsx](../02-SOURCE/frontend/src/app/App.tsx)):
- **Rejection at any stage closes the request immediately** — status becomes `REJECTED`; later stages are never notified or asked.
- **Rejection requires a non-empty comment.** Approval's comment is optional.
- **Only the current approver can act.** The Approve/Reject controls are shown only while the request is standing at that user's own stage (`awaitsDecisionBy`), and `decideRequest` re-validates this server-side-style inside the mutation itself — not merely a UI hide, so it cannot be bypassed by, e.g., navigating directly to a request URL.
- **HR is not an approval stage.** HR can read every request and see its full history but has no Approve/Reject affordance anywhere.
- An approver may **read** a request at any point once they appear in its chain (past, present, or future — `involvesApprover`), even before their own stage is reached.

**Request deletion (Employee-only, narrow window):** an employee may delete their own request only while it is `PENDING` **and** still at stage 1 of its own chain (i.e., the Direct Manager has not yet acted) — `canEmployeeDeleteRequest` ([store.ts](../02-SOURCE/frontend/src/lib/store.ts)). The moment the Direct Manager approves or rejects, deletion is no longer offered. The store re-checks ownership and stage independently of the UI, and deleting a request also removes any notifications that referenced it (so a manager is never left with a notification pointing at nothing).

---

## F. Employee Hierarchy

`EmployeeProfile.managerId` (nullable, references another `EmployeeProfile.id`) is the **single source of truth** for the reporting hierarchy. There is no separate "team" data structure anywhere in the codebase.

- `getManagerForEmployee(employees, employeeId)` resolves one level up.
- `getTeamForManager(employees, managerId)` — literally `employees.filter(e => e.managerId === managerId)` — is the entire definition of "team membership" used by every "My Team"/"My Teams" view.
- `getTechManager` / `getGeneralManager` find the single active employee with that role — both are treated as organizational singletons.
- `wouldCreateCycle` guards against assigning a manager that would create a reporting loop; `validateEmployeeFields` additionally blocks self-management, assigning an inactive or non-approver-role manager, and demoting/deactivating a manager who still has active direct reports.
- **HR-time team assignment:** when HR creates a new `MANAGER`-role account, an optional "Team Members" multi-select lets HR pick from currently **unmanaged, active, `EMPLOYEE`-role** accounts only. On successful creation, those employees' `managerId` is set to the new manager's id, in the *same* store mutation that creates the manager (`createEmployee`, [App.tsx](../02-SOURCE/frontend/src/app/App.tsx)) — no window where the manager exists without their team or vice versa. An employee who already has a Direct Manager is shown (with their current manager named) but cannot be selected here, to avoid silently overwriting an existing assignment; reassigning such an employee still goes through the ordinary Edit Employee form, which has always permitted arbitrary manager reassignment.

---

## G. Leave Rules

- **Working-day calendar:** Sunday–Thursday are working days; Friday and Saturday (`WEEKEND_DAYS = [5, 6]`, JS `getDay()`) are the weekend and consume no balance. HR-maintained public holidays also consume no balance. `countWorkingDays(start, end, holidays)` ([store.ts](../02-SOURCE/frontend/src/lib/store.ts)) counts inclusively — a Thursday-to-Sunday leave costs 2 days, not 4.
- **Balance pots:** Annual and Casual, in working days, per employee (`entitlements.ANNUAL` / `entitlements.CASUAL`), set once by HR at employee creation and editable afterward. Balances are **always computed** from the request history (`getLeaveBalance`), never stored as a running total — "a stored counter drifts the first time a request is corrected; a derived one cannot" (source comment).
  - `used` = sum of `workingDays` on the employee's own `APPROVED` leave requests against that bucket.
  - `held` = the same sum over `PENDING` requests — a pending request already reduces what can still be requested, so several overlapping submissions cannot each look affordable and then jointly blow the entitlement once approved.
  - `available` = `entitlement − used − held`, floored at 0.
  - A `REJECTED` request contributes nothing (its days are simply never counted).
- **Leave-type buckets:** each HR-managed leave type carries a nullable `balanceKey` (`ANNUAL` | `CASUAL` | none). Sick, Maternity, Paternity, and Unpaid Leave ship with no bucket — deliberately **not** balance-limited, since they are governed by statute/separate approval rather than an annual allowance.
- **Submission validation** (`validateLeaveFields`): leave type must be selected and currently active; both dates required; end date cannot precede start date; the date range must not overlap another of the same employee's `PENDING` or `APPROVED` leave requests; if the leave type has a balance bucket, the range must contain at least one working day and must fit within the currently `available` balance — the refusal message spells out the arithmetic (e.g. "That is 31 working days, but only 12 of your annual leave days remain (2 more days are awaiting approval).").

---

## H. Notifications

`NotificationRecord` ([store.ts](../02-SOURCE/frontend/src/lib/store.ts)): `id`, `userId`, `type` (`REQUEST_SUBMITTED` | `REQUEST_ADVANCED` | `REQUEST_APPROVED` | `REQUEST_REJECTED`), `requestId`, `message`, `read: boolean`, `createdAt`. Every notification is created with `read: false`; generation happens synchronously inside the same store mutation that submits or decides a request (submit → the stage-1 approver is notified; each decision → the employee is notified of the outcome/advancement, and, on approval short of the final stage, the next approver is notified it's now theirs).

- **User-specific:** every Notifications page filters to `n.userId === session.user.id` before rendering — an employee, manager, technical manager, GM, or HR user only ever sees their own notifications. `ManagerNotificationsPage` is the one shared implementation behind `/manager/notifications` for MANAGER, TECH_MANAGER, and GM.
- **Read/unread visual treatment** (identical pattern across all three Notifications pages — Employee, Manager\[+TM+GM\], HR): unread rows use a tinted background (`bg-accent/50`) and border, `font-medium` message text, and a small unread dot; read rows are visually normal (`bg-card`).
- **Mark one as read:** clicking a notification calls `markNotificationRead(id)` and navigates to the underlying request's detail page — this is the existing "open" interaction, not a separate control.
- **Mark all as read:** a header-level action on each Notifications page calls `markAllNotificationsRead(userId)`, which sets `read: true` on every notification belonging to that exact `userId` in a single store mutation — no other user's notifications are ever touched. The action is disabled (visually muted, non-interactive) whenever there is nothing unread, and carries no confirmation dialog since it is non-destructive.
- **Unread count:** computed once in `DashboardShell` as `notifications.filter(n => n.userId === session.user.id && !n.read).length` and passed down as `notificationCount`, which drives the small red dot on the header bell icon. This is unread-only and user-scoped — never a total notification count, never another user's count.

---

## I. Attendance

`AttendanceRecord` ([store.ts](../02-SOURCE/frontend/src/lib/store.ts)): `id`, `employeeId`, `date`, optional `checkIn`/`checkOut` (`HH:MM`), optional `note`, `recordedBy`, `recordedAt`.

- HR enters attendance manually under **Attendance** (`HRAttendancePage`) — there is no device/fingerprint integration; "recorded by HR from the fingerprint device" describes HR's data-entry source, not an automated feed.
- The workday is fixed at `WORKDAY_START = "09:00"` to `WORKDAY_END = "17:00"`. A check-in after 09:00 or a check-out before 17:00 is converted to minutes late/early (`lateMinutes`/`earlyLeaveMinutes`) and charged automatically against that employee's **monthly permission allowance** — it does not touch leave balance.
- Lateness/early-departure already excused by that employee's own **approved** Permission request on the same date is **not** double-charged (`approvedPermissionMinutesOn`).
- Re-entering an existing date's record corrects it in place rather than creating a duplicate/double charge.
- Attendance also feeds the dashboard calendar's "Present" state (Section K) — a date counts as Present only when *both* `checkIn` and `checkOut` are recorded for it.

---

## J. Public Holidays

`HolidayRecord` ([store.ts](../02-SOURCE/frontend/src/lib/store.ts)): `id`, `date` (`YYYY-MM-DD`, unique), `name`. Managed by HR under **Settings → Public Holidays** (`HRSettingsPage`) — add/remove only, no editing of an existing entry's date/name in place.

Because Islamic calendar dates move year to year, holidays are **not computed** — HR maintains an explicit list. A holiday date never consumes leave balance (`isWorkingDay`/`countWorkingDays` both exclude it) and takes precedence over "Present"/"Normal" in the dashboard calendar (Section K).

---

## K. Dashboard Calendar ("My Calendar")

A single component, `MyCalendarWidget` ([App.tsx](../02-SOURCE/frontend/src/app/App.tsx)), reused unmodified across **all five roles'** dashboards (Employee, Manager/TECH_MANAGER/GM's shared `ManagerDashboardPage`, and HR's `HRDashboardPage`) — one implementation, not five copies.

- **Current month only.** Computed from `new Date()` on every render; there is no month navigation, no popups, no click interaction beyond the passive display.
- **Always the signed-in user's own data**, resolved via `session.user.id` from `useAuth()` — never a role check, never another employee's, manager's, or direct report's attendance/leave. This holds identically for every role, including Manager/TECH_MANAGER/GM/HR viewing their own dashboard.
- **State precedence per date** (highest first): **Annual Leave** → **Public Holiday** → **Present** → **Weekend** (muted) → Normal.
  - *Annual Leave*: the date falls within an `APPROVED` leave request whose `balanceKey === "ANNUAL"` — the same bucket `getLeaveBalance` uses elsewhere. Pending and rejected leave are never shown as Annual Leave.
  - *Public Holiday*: the date matches an entry in the existing `holidays` list.
  - *Present*: an `AttendanceRecord` exists for that date with **both** `checkIn` and `checkOut` set.
  - *Weekend*: Friday/Saturday (`WEEKEND_DAYS`) with none of the above applying — shown muted, never auto-marked Present.
  - A weekend day that falls inside an approved leave's own date range still displays as leave, since the leave genuinely covers it — this does not change how `countWorkingDays` computes what that leave actually *consumes* for balance purposes.
- **Colors** reuse the app's existing semantic palette exactly (green/blue/amber at the same `-50` background / `-700` text pairing already used by `BADGE_CONFIG` and `ALERT_CONFIG`) — no new color was introduced, and the app's primary/accent color is deliberately not used as a calendar fill.
- **Always-visible legend** beneath the grid (Present / Annual Leave / Public Holiday), each entry pairing a color dot with a text label so meaning never depends on color alone.
- **Layout:** placed alongside each dashboard's existing "recent requests" card in a responsive `lg:grid-cols-3` row (`lg:col-span-2` for the requests card, the remaining column for the calendar), collapsing to a single stacked column on narrow screens. No existing dashboard section was resized or removed to make room for it.

---

## L. HR Functionality

**Employee management** (`HREmployeesPage`): search/filter by role, department, status; Add Employee, Edit Employee (same shared `EmployeeForm`), Activate/Deactivate, and a read-only detail view. Deactivating or role-changing a manager who still has active direct reports is refused with a clear message until they are reassigned.

**Manager creation with team assignment**: when the Role field is set to "Direct Manager" on the **Add** form only (not Edit), a "Team Members" section appears, letting HR multi-select from currently unmanaged, active, plain-`EMPLOYEE`-role accounts. Selected employees have their `managerId` set to the new manager's id in the same creation transaction; the post-creation success panel lists exactly who was assigned. See Section F for the full rule set (already-managed employees are shown but not selectable).

**Requests** (`HRRequestsPage` / `HRRequestDetailPage`): company-wide, filterable list (Manager/Employee/Type/Status/date range); HR can open any request and read a **type-aware "Request Details" section** — Leave shows Leave Type/dates/working days/reason; Mission shows dates/times/location/purpose/computed duration; Permission shows its kind, the derived start/end clock times (from `permissionKind` + `permissionMinutes` + the fixed workday bounds — nothing new stored), duration, and reason. HR cannot approve or reject from here; an info banner reiterates that approval stays with the three-stage chain.

**Attendance** (`HRAttendancePage`): record/correct a check-in and check-out per employee per date; delete a record; the page shows what each record cost the employee's permission allowance alongside their remaining balance for that month.

**Leave Types** (`HRSettingsPage`): add/edit a leave type's name, active status, and which balance bucket (Annual/Casual/none) it draws from.

**Public Holidays** (`HRSettingsPage`): add/remove holiday dates and names.

**Notifications** (`HRNotificationsPage`): same read/unread/mark-one/mark-all pattern as every other role (Section H), scoped to HR's own notifications only — HR does not see other users' notifications by virtue of its administrative role.

**Settings** is currently limited to Leave Types and Public Holidays — there is no separate "general settings"/system-configuration area beyond these two.

---

## 3. Current Architecture — Development/Demo Only

> **This entire section describes development/demo architecture — to be replaced during the production backend phase. Nothing here should be assumed to carry forward as-is.**

- **Persistence:** 100% client-side `localStorage`. Confirmed keys, read directly from source:
  - `hr_portal_store_v4` — the entire application dataset (`employees`, `requests`, `notifications`, `leaveTypes`, `attendance`, `holidays`, plus the sequence counters used to mint `EMP-NNNNN`/`REQ-NNNNN` numbers) ([store.ts](../02-SOURCE/frontend/src/lib/store.ts)).
  - `hr_portal_credentials_v1` — salted+hashed demo passwords, keyed by employee number ([auth.ts](../02-SOURCE/frontend/src/lib/auth.ts)).
  - `hr_portal_session_v1` — the current signed-in session, with an 8-hour expiry ([auth.ts](../02-SOURCE/frontend/src/lib/auth.ts)).
  - This `localStorage` plays the role of a shared server database *within one browser*: a request an employee submits is still there when their manager opens the same browser afterward. Two different browsers/devices share nothing — there is no server.
- **Session/auth architecture:** entirely custom, in `lib/auth.ts` — not Supabase Auth, not any external identity provider. Sign-in matches an employee number + password against the locally stored, salted-and-hashed credential record. The password hash is a custom, non-cryptographic construction, explicitly documented in its own source comments as **not a production KDF** — hashing is expected to move server-side (bcrypt/argon2id) in the production phase.
- **Authorization:** enforced entirely in the client (route guards + per-action re-validation inside store mutations, e.g. `decideRequest`, `deleteRequest`, `markAllNotificationsRead`). This is the strongest guarantee this architecture can offer without a server; it is not a substitute for server-side/RLS enforcement, which does not exist yet.
- **Identity contract** (unchanged since the original build, and critical to preserve through migration): `session.user.id === EmployeeProfile.id === "EMP-NNNNN"` — one key space, everywhere. The project's own history records that an earlier build broke this by returning a Supabase UUID from auth while the store was keyed by `EMP-NNNNN`, silently breaking every manager/request lookup. Any future Supabase wiring must map `profiles.employee_number` onto `session.user.id`, not `profiles.id`.
- **Backend schema status (unchanged, not touched by this session's work):** `02-SOURCE/backend/migrations/` contains 5 SQL migrations that were written but **never connected** to this frontend, and which model an earlier, smaller version of the product (3 roles, 2 request types, no three-stage chain, no attendance/permissions/holidays/entitlements). They are a design artifact for the upcoming migration, not a description of anything live. See `02-SOURCE/backend/README.md` for the itemized list of known gaps between that schema and the application documented above.

---

## 4. Traceability

Everything in Sections A–L and Section 3 was verified against the source in this session — `NAV_ITEMS`, the router table, `RequestRecord`/`EmployeeProfile`/`NotificationRecord`/`AttendanceRecord`/`HolidayRecord`, `buildApprovalChain`, `decideRequest`, `canEmployeeDeleteRequest`, `getLeaveBalance`/`countWorkingDays`, `markNotificationRead`/`markAllNotificationsRead`, `MyCalendarWidget`, `createEmployee`'s team-assignment path, and the three `localStorage` key constants were all read directly from `02-SOURCE/frontend/src/app/App.tsx`, `src/lib/store.ts`, and `src/lib/auth.ts` as they exist at this baseline. No fact here is carried over from an earlier, unverified assumption.
