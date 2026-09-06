# Production Backend Plan — Supabase/PostgreSQL

Status: **Planning document. No SQL has been written or applied. No frontend or existing migration file was modified to produce this document.**

Baseline this plan targets: commit `32d01d0` ("chore: checkpoint approved V1 frontend") plus the approved behavior recorded in [`04-DOCS/V1-BASELINE.md`](./V1-BASELINE.md). Every requirement below is sourced from that document and from direct inspection of `02-SOURCE/frontend/src/lib/store.ts`, `02-SOURCE/frontend/src/app/App.tsx`, and `02-SOURCE/backend/migrations/*.sql` as they exist today — nothing here is speculative.

---

## 1. Current Backend Assessment

Five migrations exist under `02-SOURCE/backend/migrations/`, applied in filename order, **never connected to the frontend** (confirmed again this session: `grep -c supabase src/app/App.tsx` → 0). They describe an **earlier, materially smaller** version of the product than V1.

### 1.1 What exists

| Migration | Content |
|---|---|
| `20260901122001_hr_portal_schema.sql` | Tables `profiles`, `leave_types`, `requests`, `notifications`, `audit_logs`; sequences for `EMP-NNNNN`/`REQ-NNNNN`; `update_updated_at()` trigger function + triggers on `profiles`/`leave_types`; indexes. |
| `20260901122036_hr_portal_rls_and_seed.sql` | RLS enabled on all five tables; `is_hr()` and `is_manager_of()` SECURITY DEFINER helpers; full policy set; seed data (8 profiles, 6 leave types) matching the *original* `DEFAULT_EMPLOYEES`/`DEFAULT_LEAVE_TYPES`. |
| `20260901122108_hr_portal_fix_security_warnings.sql` | Adds `SET search_path = public` to all functions; revokes `EXECUTE` on `is_hr()`/`is_manager_of()` from `anon`/`authenticated`. |
| `20260901122123_hr_portal_revoke_public_execute.sql` | Revokes `EXECUTE` from `PUBLIC` too. Its own header claims it "re-grants only to the authenticated role" — **no such `GRANT` exists in the file.** |
| `20260901122725_hr_portal_phase1_1_corrections.sql` | Adds (`NOT VALID`) FK `profiles.id → auth.users.id`; tightens `audit_logs`/`notifications` INSERT to HR-only; fixes a real tautology bug in `requests_update`'s `WITH CHECK`; locks `employee_number` against self-editing. |

### 1.2 Model captured by this schema (confirmed by re-reading every file)

- **Roles:** `profiles_role_check CHECK (role IN ('EMPLOYEE', 'MANAGER', 'HR'))` — **three roles only.**
- **Request types:** `requests_type_check CHECK (type IN ('LEAVE', 'MISSION'))` — **two types only.**
- **Notification types:** `notifications_type_check CHECK (type IN ('REQUEST_SUBMITTED', 'REQUEST_APPROVED', 'REQUEST_REJECTED'))` — **three types only.**
- **Approval:** a single `requests.manager_id` column — **no concept of a multi-stage chain at all.**
- **No tables** for attendance, public holidays, leave allocations/balances, or company-level approval routing.
- **Triggers:** exactly two, both `update_updated_at` (on `profiles`, `leave_types`). No trigger writes a notification or an audit row anywhere.
- **Functions:** `generate_request_number()`, `generate_employee_number()`, `update_updated_at()`, `is_hr()`, `is_manager_of()` (defined, never called by any policy).

This is not a partially-complete version of V1 — it is a **different, earlier product shape**, confirmed structurally incompatible on three separate hard `CHECK` constraints alone (see §2.9).

---

## 2. Gap Analysis

### 2.1 Authentication (requirement A)
**Gap — total.** Production must run on Supabase Auth (`auth.users`); today's frontend uses a fully custom, client-side credential/session system (`localStorage` keys `hr_portal_credentials_v1`/`hr_portal_session_v1`, salted-hash-in-JS passwords). The existing migrations only stub a `NOT VALID` FK toward `auth.users` — no `auth.users` rows exist, no signup/session flow was ever built. See §6 (Auth Architecture) for the full design.

### 2.2 Profiles / roles (requirement B)
**Gap — hard blocker.** `profiles_role_check` allows only `EMPLOYEE`/`MANAGER`/`HR`. `TECH_MANAGER` and `GM` — two of V1's five roles — **cannot be stored** under the current constraint. A `TECH_MANAGER` or `GM` row would be rejected outright.

### 2.3 Employee hierarchy (requirement C)
**Already correctly modeled.** `profiles.manager_id` (self-referencing FK, `ON DELETE SET NULL`) is exactly the same design as the frontend's `EmployeeProfile.managerId` — no gap here, this part of the schema is sound and should be carried forward as-is.

### 2.4 Company approval routing — singleton TM/GM (requirement D)
**Missing entirely.** Today, `getTechManager()`/`getGeneralManager()` (`store.ts`) find "the one active profile with that role" — there is no database-level guarantee of uniqueness; nothing stops two `TECH_MANAGER` rows existing simultaneously once real users can self-edit or once a second HR admin makes a mistake. Per your explicit instruction, this is **not** to be solved by adding `technical_manager_id`/`general_manager_id` columns to every profile — see §4.9 for the dedicated `company_approval_routing` table design.

### 2.5 Requests — types and structure (requirement E)
**Gap — hard blocker + structural.** `requests_type_check` allows only `LEAVE`/`MISSION` — **`PERMISSION` cannot be stored.** Separately, the single `manager_id` column cannot express "Direct Manager → Technical Manager → General Manager" at all; there is no way to record that a request is currently awaiting stage 2 versus stage 1.

### 2.6 Approval history (requirement F)
**Missing entirely.** With only one `manager_id`/`decided_at`/`decision_comment` triplet per request, a decision at stage 2 would simply overwrite whatever was recorded for stage 1 — there is no way to preserve "the Direct Manager approved on date X with comment Y, then the Technical Manager approved on date Z" as two distinct, permanent records. See §4.6 (`request_approvals`).

### 2.7 Historical snapshots (requirement G)
**Partially present, needs extension.** `employee_name`, `manager_name`, `leave_type_name` are already snapshotted on `requests` — the right pattern, already matching the frontend's own `employeeName`/`managerName`/`leaveType` fields. It needs to extend to: `balance_key`, `working_days`, and — once `request_approvals` exists — each stage's own `approver_name` snapshot (not just stage 1's).

### 2.8 Leave (requirement H)
**Missing:** any table for opening entitlements/allocations (frontend: `EmployeeProfile.entitlements: {ANNUAL, CASUAL}`), and any public-holidays table. **Present but unenforced:** the working-day/overlap/balance rules exist only as client-side JavaScript (`countWorkingDays`, `validateLeaveFields`, `getLeaveBalance` in `store.ts`) — none of this logic exists in SQL. A raw `INSERT` against `requests` today would bypass every one of these rules entirely.

### 2.9 Attendance (requirement I)
**Missing entirely.** No table. The frontend's `AttendanceRecord` (employee, date, check-in/out, note, recorded-by) and its role in charging the monthly permission allowance (`lateMinutes`/`earlyLeaveMinutes`/`getPermissionBalance`) have zero backend representation.

### 2.10 Public holidays (requirement J)
**Missing entirely.** No table. Referenced constantly by working-day math and the dashboard calendar, with zero backend representation.

### 2.11 Notifications (requirement K)
**Structurally close, one hard blocker, one severe functional gap.**
- Hard blocker: `notifications_type_check` allows only `REQUEST_SUBMITTED`/`REQUEST_APPROVED`/`REQUEST_REJECTED` — **`REQUEST_ADVANCED`** (fired whenever a multi-stage request clears an intermediate stage) **is missing**, and this is not a rare path — it fires on every single Leave/Mission approval short of the final GM decision.
- Severe gap, already self-documented in `02-SOURCE/backend/README.md`: the final migration tightened `notifications_insert` to `WITH CHECK (is_hr())`, **but the compensating triggers that were supposed to let the actual workflow write notifications were "never written."** As shipped, no employee could ever be notified their own request was submitted or decided — the write path is completely closed. Read/unread itself (`read boolean default false`, mark-one, mark-all) is otherwise already correctly shaped and matches the frontend's model closely.

### 2.12 HR functionality (requirement L)
**Gap — the "create Direct Manager + assign initial team" feature (implemented on the frontend this session) has no backend equivalent at all**, and cannot be expressed safely as two independent client calls (see §4.3 and §5 for why this needs a single transactional function). Employee lifecycle (create/edit/activate/deactivate) is otherwise well-aligned with the existing `profiles` table shape, modulo the role/routing gaps above.

### 2.13 Summary table

| Area | Status |
|---|---|
| Auth | Missing (custom localStorage today) |
| Profiles / roles | **Hard blocker** — 2 of 5 roles unstorable |
| Hierarchy (`manager_id`) | Already correct |
| TM/GM singleton routing | Missing |
| Request types | **Hard blocker** — `PERMISSION` unstorable |
| Multi-stage approval | Missing (structural) |
| Approval history | Missing |
| Historical snapshots | Partial, needs extension |
| Leave allocations | Missing |
| Working-day/overlap/balance rules | Missing (client-only today) |
| Attendance | Missing |
| Public holidays | Missing |
| Notification types | **Hard blocker** — `REQUEST_ADVANCED` unstorable |
| Notification write path | Broken by design (documented, never fixed) |
| HR manager+team creation | Missing (needs a transactional function) |

---

## 3. Security Assessment (existing migrations)

Findings, all independently re-confirmed against the actual SQL this session (not assumed from prior notes):

1. **`is_hr()`/`is_manager_of()` may be uncallable.** Migration 3 revokes `EXECUTE` from `anon`/`authenticated`; migration 4 revokes it from `PUBLIC` — and its own header comment claims a compensating `GRANT ... TO authenticated` that **does not exist anywhere in the file.** `RLS` policies evaluate `SECURITY DEFINER` functions under the function owner's privileges, not the caller's `EXECUTE` grant, so this is likely harmless for *policy evaluation* — but **must be verified against a live database before reuse**, since a genuinely uncallable helper would make every policy referencing it fail closed with "permission denied for function."
2. **`requests_insert` under-constrains status/ownership.** `WITH CHECK (employee_id = auth.uid() OR is_hr())` restricts nothing about `status`, `manager_id`, or the approval chain — a direct PostgREST call could insert a request that is already `APPROVED`, naming its own submitter as approver. This is fixed in the new design not by patching the `WITH CHECK` clause but by **removing client `INSERT` on `requests` entirely** — see §5.
3. **The tautology bug in `requests_update`** (`requests_1.id = requests_1.id` instead of `requests_1.id = requests.id`) was correctly identified and fixed in migration 5. Confirmed by direct comparison of migrations 2 and 5.
4. **Notifications/audit-log write path is closed with no working alternative** (§2.11) — a real, shipped defect, not a hypothetical.
5. **No `decided_by` column** on `requests` — who decided is not recorded, only when.
6. **No DB-level cycle/self-manager prevention** on `profiles.manager_id` — enforced only in the frontend (`wouldCreateCycle`). A direct API call could still create a cycle or self-management today.
7. **`profiles_select` cannot read upward.** It permits `id = auth.uid()`, direct reports, or HR — an employee cannot read their own manager's profile row, which the "who will approve this" preview needs. Confirmed unresolved in all five migrations.
8. **No `auth.users` rows exist.** Seed profiles carry hand-authored UUIDs that can never equal a real `auth.uid()`. Provisioning real users needs the Admin API, not SQL — addressed in §6.

**Principle carried into the new design:** every one of these is closed by *removing the unsafe surface* (no raw client `INSERT`/`UPDATE` on `requests`/`request_approvals`/`notifications` at all — see §5) rather than by trying to enumerate every column a policy must protect, which is exactly the pattern that produced bug #2 above in the first place.

---

## 4. Final Proposed Schema

Nine tables evaluated against the minimum list in your request; all nine are needed. A tenth, `audit_logs` (present in the old schema), is **approved as an internal backend-only capability** — it is not, and must not become, a V1 frontend feature (§4.10).

### 4.1 `profiles`
**Purpose:** one row per person who can sign in — every role.
**Columns:** `id UUID PK` (= `auth.users.id`, see §6), `employee_code TEXT UNIQUE NOT NULL` (the company's existing Employee Code, e.g. `"ansary34"` — **entered manually by HR at account creation, never auto-generated**; this is the employee's login identifier, §6.1), `first_name`, `last_name`, `name`, `position`, `department`, `email TEXT UNIQUE NULL` (**optional** — see note below), `phone`, `status TEXT` (`ACTIVE`/`INACTIVE`), `role TEXT`, `manager_id UUID REFERENCES profiles(id) ON DELETE SET NULL`, `permission_minutes_per_month INT NOT NULL DEFAULT 240`, `created_at`, `updated_at`.
**Constraints:**
- `role_check CHECK (role IN ('EMPLOYEE','MANAGER','TECH_MANAGER','GM','HR'))` — the corrected version of the existing (broken) constraint.
- `status_check CHECK (status IN ('ACTIVE','INACTIVE'))`.
- `manager_id <> id` (self-manager, DB-level — closes gap §3.6).
- `email` uniqueness, but **nullable** — the existing migration left it both unconstrained *and* implicitly required nothing; the corrected version adds uniqueness (Postgres allows any number of `NULL`s under a unique constraint, so many employees can simply have no email on file) but does not make it `NOT NULL`, per your instruction that **email is not required for V1 authentication** — it is a purely optional contact field, reserved for future use (e.g. a later self-service password-reset channel, §6.5).
- **`profiles_one_active_tech_manager` — `CREATE UNIQUE INDEX ON profiles (role) WHERE role = 'TECH_MANAGER' AND status = 'ACTIVE'`** and **`profiles_one_active_gm` — `CREATE UNIQUE INDEX ON profiles (role) WHERE role = 'GM' AND status = 'ACTIVE'`** (both new). These are **partial unique indexes** — Postgres's native mechanism for "at most one row may satisfy this condition" — and are the actual, unconditional, database-enforced answer to "there must be exactly one active Technical Manager/General Manager": no `INSERT` or `UPDATE`, through any path whatsoever (RPC, direct SQL, a future bug, a careless manual edit in Supabase Studio), can ever leave two profiles simultaneously `ACTIVE` with the same one of these two roles. This is independent of, and stronger than, anything `company_approval_routing` (§4.9) enforces about *routing* — it constrains the *role itself*.
- **No equivalent constraint on `HR`.** Per your instruction, HR is explicitly not a singleton — any number of profiles may carry `role = 'HR'` simultaneously, today (one) or later (several). `is_hr()` (§7) already checks only `role = 'HR'` for whichever profile is calling, so multiple HR users are supported with **zero schema or policy changes** — this was already true of the design and is confirmed here as intentional, not an oversight.
**Indexes:** `employee_code` (via its unique constraint), `manager_id`, `role`, `status`, plus the two partial unique indexes above.
**Security:** see §7.

### 4.2 `leave_allocations` — **APPROVED: dedicated table, year-scoped**
**Purpose:** replaces the frontend's `EmployeeProfile.entitlements` object — one row per employee, per leave-type bucket, per year. Decided against flat columns on `profiles` specifically so future years never require a schema change — a new year is a new row, not a new column.
**Columns:** `id UUID PK`, `profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE` (employee), `bucket TEXT NOT NULL CHECK (bucket IN ('ANNUAL','CASUAL'))` (the "leave type" dimension — V1's two entitlement buckets, labeled "Annual Leave"/"Casual Leave" in the UI today via `BALANCE_LABEL`; see note below), `year SMALLINT NOT NULL` (the calendar year the allocation applies to), `allocated_days INT NOT NULL CHECK (allocated_days >= 0)`, `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`.
**Constraints:** `UNIQUE (profile_id, bucket, year)` — exactly one allocation per employee, per bucket, per year.
**Indexes:** the unique constraint covers `(profile_id, bucket, year)`; add `profile_id` alone for "all of this employee's allocations across years" queries (HR's edit-employee view).
**Note on "leave type" vs. individual `leave_types` rows:** V1 allocates entitlement per **bucket** (Annual/Casual), not per individual leave-type catalogue entry — several `leave_types` rows can share one bucket (e.g. "Emergency Leave" draws from the `CASUAL` bucket alongside any other casual-type entries HR adds), and types with no bucket (Sick/Maternity/Paternity/Unpaid) are deliberately unlimited and never appear here at all. `bucket` is therefore the correct grain for this table, not a `leave_type_id` foreign key — a `leave_type_id` column would incorrectly imply a 1:1 allocation per catalogue entry, which does not match how V1 balances actually work (`getLeaveBalance` keys on `balance_key`, never on the specific leave type chosen).
**How new years get populated:** HR creates the following year's row(s) for each employee — either individually (edit-employee flow, same place opening balances are set today) or via a bulk "roll forward" administrative action performed once a year (a candidate future frontend feature, not part of this plan). Nothing about the schema forces a particular rollover policy (carry-over, reset, or a manually-chosen new figure) — V1's own rule (no accrual, no carry-over, HR sets a figure once) can be preserved simply by HR entering a fresh number each year with no need to interpret last year's rows automatically.
**Security:** SELECT — self or HR; write — HR only (unchanged from the original proposal).

### 4.3 `requests`
**Purpose:** one row per Leave/Mission/Permission request — the same shape as `RequestRecord`, corrected.
**Columns:** `id UUID PK`, `request_number TEXT UNIQUE NOT NULL` (generated), `employee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT`, `employee_name TEXT NOT NULL` (snapshot), `type TEXT NOT NULL`, `status TEXT NOT NULL DEFAULT 'PENDING'`, `submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()`, `decided_at TIMESTAMPTZ`, `decided_by UUID REFERENCES profiles(id)` (new — closes gap §3.5), `decision_comment TEXT`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()` (new, with the same trigger pattern as `profiles`).
*Stage-1 snapshot (display/filter convenience, mirrors `RequestRecord.managerId`/`managerName`):* `manager_id UUID REFERENCES profiles(id)`, `manager_name TEXT`.
*Leave fields:* `leave_type_id UUID REFERENCES leave_types(id) ON DELETE SET NULL`, `leave_type_name TEXT` (snapshot), `balance_key TEXT CHECK (balance_key IN ('ANNUAL','CASUAL'))` (snapshot — new), `working_days INT` (snapshot — new), `start_date DATE`, `end_date DATE`, `reason TEXT`.
*Mission fields:* `start_time TIME`, `end_time TIME`, `location TEXT`, `purpose TEXT`.
*Permission fields (new — entirely absent today):* `permission_kind TEXT CHECK (permission_kind IN ('LATE_ARRIVAL','EARLY_DEPARTURE'))`, `permission_minutes INT`.
**Constraints:** `type_check CHECK (type IN ('LEAVE','MISSION','PERMISSION'))` — the corrected constraint; `status_check CHECK (status IN ('PENDING','APPROVED','REJECTED'))` (unchanged, already correct).
**Indexes:** `employee_id`, `manager_id`, `status`, `type` (new), `submitted_at`.
**Security:** see §5 and §7 — **no direct client `INSERT`/`UPDATE`/`DELETE` grant at all.**
**Employee deactivation preserves history — APPROVED, already guaranteed by the FK direction:** `employee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT` means a `profiles` row can never be hard-deleted while it has any request at all — the only lifecycle action available is setting `status = 'INACTIVE'` (exactly V1's existing behavior; there has never been an employee-delete feature in this product). Every historical request, its full `request_approvals` history, its notifications, and its attendance rows all remain fully intact and queryable after an employee leaves the company — nothing about deactivation cascades or nulls out anything on the `requests` side.

### 4.4 `request_approvals`
**Purpose:** the piece that does not exist today — one row per stage, preserving each decision permanently.
**Columns:** `id UUID PK`, `request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE`, `stage SMALLINT NOT NULL` (1, 2, 3), `role TEXT NOT NULL`, `title TEXT NOT NULL` (snapshot of `ROLE_LABEL`, e.g. "Direct Manager"), `approver_id UUID NOT NULL REFERENCES profiles(id)`, `approver_name TEXT NOT NULL` (snapshot), `status TEXT NOT NULL DEFAULT 'PENDING'`, `decided_at TIMESTAMPTZ`, `comment TEXT`.
**Constraints:** `UNIQUE (request_id, stage)`; `status_check CHECK (status IN ('PENDING','APPROVED','REJECTED'))`.
**Indexes:** `(request_id, stage)` (the unique constraint's index doubles as this); `(approver_id, status)` — the hot path for every Manager/TECH_MANAGER/GM "my requests" list.
**Behavioral note, preserving exact V1 fidelity:** when a request is decided (approved fully or rejected) at some stage, **rows for any later, not-yet-reached stage are left untouched at `status = 'PENDING'`** — this exactly mirrors the current frontend's `decideRequest`, which only ever updates the one stage being decided and never touches the others. "Is this request actually closed" is answered by `requests.status`, never by scanning `request_approvals` alone — the "current" stage is always `MIN(stage) WHERE status = 'PENDING'`, computed on read, with no separate pointer column (mirrors `currentStep()` in `store.ts` exactly).
**Security:** system-managed — no direct client write grant at all (§5).

### 4.5 `notifications`
**Purpose:** unchanged in shape from the existing migration, with the type constraint corrected.
**Columns:** `id UUID PK`, `user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE`, `type TEXT NOT NULL`, `request_id UUID REFERENCES requests(id) ON DELETE CASCADE`, `message TEXT NOT NULL`, `read BOOLEAN NOT NULL DEFAULT false`, `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`.
**Constraints:** `type_check CHECK (type IN ('REQUEST_SUBMITTED','REQUEST_ADVANCED','REQUEST_APPROVED','REQUEST_REJECTED'))` — the corrected constraint (adds the missing value).
**Indexes:** `user_id`, `(user_id, read)` (new — the exact predicate `DashboardShell`'s unread-count query uses on every page load), `created_at`.
**Security:** SELECT/UPDATE via RLS; **no client INSERT grant** — only the transactional functions in §5 write notifications (§7).

### 4.6 `attendance`
**Purpose:** new table — HR's manual entry, and the source for the "Present" calendar state and the permission-allowance deduction.
**Columns:** `id UUID PK`, `employee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE`, `date DATE NOT NULL`, `check_in TIME`, `check_out TIME`, `note TEXT`, `recorded_by UUID NOT NULL REFERENCES profiles(id)`, `recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()`.
**Constraints:** `UNIQUE (employee_id, date)` — matches the frontend's "re-entering a date corrects it" behavior exactly (an `UPSERT` on this key, not an insert-or-duplicate).
**Indexes:** the unique constraint covers `(employee_id, date)`; add `employee_id` alone for month-range scans (permission-balance calculation).
**Security:** SELECT — self or HR; write — HR only (§7).
**Future-proofing for bulk Excel import (not built now):** this table already needs no schema change to support a future "HR uploads a daily attendance spreadsheet" feature. `UNIQUE (employee_id, date)` means a future importer can `INSERT ... ON CONFLICT (employee_id, date) DO UPDATE` for every parsed row — the exact same "re-entering a date corrects it" semantics manual entry already has, applied in bulk. `recorded_by` simply records whichever HR user ran the import (or, if desired later, a dedicated system/import identity — no column addition needed either way, since it's already a plain FK to `profiles`). All Excel-specific work — file parsing, per-row validation, error reporting — belongs entirely in the future import mechanism (an Edge Function or an admin script), sitting *in front of* this table; it writes into the exact same `attendance` rows the manual-entry form writes into today. No Excel upload UI, parser, or import workflow is part of this plan or is being built now.

### 4.7 `public_holidays`
**Purpose:** new table — HR-maintained, fixed dates (Islamic dates move yearly and are entered manually, exactly as today).
**Columns:** `id UUID PK`, `date DATE UNIQUE NOT NULL`, `name TEXT NOT NULL`.
**Security:** SELECT — every authenticated user (needed for working-day math everywhere); write — HR only, add/remove only (no in-place edit — matches the frontend's Settings page exactly).

### 4.8 `leave_types`
**Purpose:** unchanged from the existing migration, extended with the bucket column the frontend already has (`LeaveTypeRecord.balanceKey`) and never made it into SQL.
**Columns:** existing `id`, `name UNIQUE`, `status`, `created_at`, `updated_at`, **plus new** `balance_key TEXT CHECK (balance_key IN ('ANNUAL','CASUAL')) NULL` — nullable, exactly matching `LeaveTypeRecord.balanceKey?: BalanceKey | null` (sick/maternity/paternity/unpaid ship with `NULL`, deliberately unlimited).
**No hard delete in normal operation — APPROVED:** HR archives a leave type by setting `status = 'INACTIVE'` (already the existing, correct pattern — the frontend has never offered a delete action here, only add + status toggle). This is safe by construction, not merely by convention: `requests.leave_type_id` is `ON DELETE SET NULL` and `requests.leave_type_name` is independently snapshotted at submission (§4.3), so even in the hypothetical where a row were deleted, historical requests would still display the correct leave-type name — deactivation is simply the only path exposed, matching V1 exactly.
**Security:** SELECT — everyone; write — HR only, **no `DELETE` grant** (unchanged posture, now explicitly confirmed rather than merely unremarked-upon).

### 4.9 `company_approval_routing`
**Purpose:** the dedicated singleton config table requested in §D — decouples "who currently holds the Technical Manager / General Manager routing slot" from "what role a profile happens to carry," and backs the **Settings → Approval Routing** HR feature (business decision 8, "Approval Routing").
**Columns:** `id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1)` (the standard Postgres singleton-table trick — guarantees exactly one row can ever exist), `technical_manager_id UUID REFERENCES profiles(id)`, `general_manager_id UUID REFERENCES profiles(id)`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`, `updated_by UUID REFERENCES profiles(id)`.
**Constraints:** `technical_manager_id`/`general_manager_id` must reference an `ACTIVE` profile (checked inside the writing RPC below, not a table `CHECK`, since Postgres `CHECK` cannot subquery another table). Unlike the previous draft of this section, there is **no** "referenced profile must already carry the matching role" trigger — that requirement is satisfied differently and more simply by having role-assignment and routing-assignment happen together, in the correct order, inside one RPC (below), which also sidesteps an ordering deadlock a same-time CHECK would create against the partial unique indexes in §4.1.
**How it's used:** `submit_leave_request`/`submit_mission_request` (§5) read this one row to resolve stage 2/3, instead of scanning `profiles` for "the" `TECH_MANAGER`/`GM`. `role = 'TECH_MANAGER'`/`'GM'` on `profiles` continues to govern *general permissions* (Organization visibility, nav, RLS's "is this an approver-tier role" checks) — the two concerns are deliberately kept separate.
**Changing the routing — `set_approval_routing(new_technical_manager_id, new_general_manager_id)` (a seventh transactional function, §5.7):** this is the **only** writer to this table (no plain HR `UPDATE` grant — the ordering guarantees below require the whole operation to happen as one deliberate sequence, not an arbitrary column update). See §5.7 for the exact mechanics and why the *order* of its internal steps is what makes it safe against the partial unique indexes in §4.1.
**Preserving history when routing changes — the exact guarantee requested:** changing `company_approval_routing` **only affects new requests going forward.** Every request already submitted carries its own chain permanently in `request_approvals`, with each row's `approver_id`/`approver_name` snapshotted **at submission time** — those rows are never touched by a later routing change, a later role change, or a later deactivation. Concretely: if Ahmed is the Technical Manager when Employee A's Mission request is submitted, that request's stage-2 `request_approvals` row permanently reads `approver_name = 'Ahmed ...'`, regardless of anything that happens afterward. If HR later runs `set_approval_routing` to make Mohamed the new Technical Manager, Employee A's *existing* request still shows Ahmed as its stage-2 approver (and, if Ahmed already decided it, his decision and comment stand, permanently) — only requests submitted *after* the change resolve their stage 2 to Mohamed. The exact same guarantee applies to `profiles.manager_id`: if Employee A's Direct Manager was Ahmed at submission time and HR later reassigns Employee A to report to Mohamed, the old request's stage-1 approver remains Ahmed on record; only a *new* request Employee A submits afterward routes to Mohamed. Nothing about this requires special-case code — it falls directly out of `request_approvals` snapshotting the approver at submission and never being rewritten by anything other than that one stage's own decision.
**Security:** SELECT — everyone (an employee submitting a request needs to know who's in their chain before submitting, and the Organization page needs it); write — no direct grant to anyone, including HR — exclusively through `set_approval_routing` (§5.7).

### 4.10 `audit_logs` — **APPROVED: internal backend capability only, no frontend surface**
Confirmed decision: there is **no** Audit Log UI anywhere in V1, and this table must not become one. It exists purely as a backend security/traceability capability, invisible to every role in the product. If kept, it carries forward the existing migration's shape largely unchanged — `id`, `actor_id UUID REFERENCES profiles(id)` (nullable, for system actions), `action TEXT`, `table_name TEXT`, `record_id UUID`, `metadata JSONB`, `created_at` — written to exclusively from inside the seven `SECURITY DEFINER` functions in §5 (e.g. logging every `decide_request` call: who, on what, what decision), never by a raw client `INSERT`. **No `SELECT` policy is granted to any application role, including HR** — if this data is ever needed, it is read via the Supabase dashboard/direct database access by whoever administers the production project, not through the product's own UI. This keeps the table genuinely optional: it can be added in the same migration set or skipped entirely with zero impact on any V1 feature, since nothing in `V1-BASELINE.md` depends on it.

---

## 5. Approval Workflow Design — Transactional RPCs

**Core principle, directly answering your instruction:** `requests`, `request_approvals`, and `notifications` receive **no direct client `INSERT`/`UPDATE`/`DELETE` grants at all.** Every mutation on these three tables happens inside a `SECURITY DEFINER` PL/pgSQL function, so validation, chain-building, and notification-writing are always atomic and always run — there is no code path where a client can reach these tables except through a function that has already checked authorization. This is a stronger guarantee than patching individual RLS predicates (the pattern that produced the tautology bug and the under-constrained `INSERT` policy in the existing migrations) and stronger than relying on triggers that, per the existing migration's own comments, were planned and never actually written.

**There are seven such `SECURITY DEFINER` transactional functions in this design.** (An earlier revision of this document said six; this round's business decision to give HR a dedicated **Settings → Approval Routing** action ("Approval Routing," business decision 8) adds `set_approval_routing` as a seventh — the count has changed for a real, named reason, not by further miscounting.)

1. `submit_leave_request` (§5.1)
2. `submit_mission_request` (§5.2)
3. `submit_permission_request` (§5.2)
4. `decide_request` (§5.3)
5. `delete_own_request` (§5.4)
6. `hr_create_manager_with_team` (§5.5)
7. `set_approval_routing` (§5.7)

(Mark-as-read/mark-all-as-read are deliberately **not** on this list — §5.6 explains why plain RLS-gated `UPDATE` statements are sufficient there and an eighth function would be unnecessary ceremony.)

### 5.0 The non-negotiable approval sequence — exactly how each forbidden case is prevented

Every prohibited scenario you listed maps to a specific, named mechanism below — none of these are left to client-side discipline:

| Must never happen | Prevented by |
|---|---|
| Skip Direct Manager (Employee → Technical Manager directly) | `submit_leave_request`/`submit_mission_request` (§5.1–5.2) always resolve stage 1 from `profiles.manager_id` first; `request_approvals` rows are created once, at submission, in fixed stage order — there is no operation that can create a chain missing stage 1 while including stage 2/3. |
| Skip Technical Manager or General Manager | Same — the chain-building step in §5.1 always includes all three roles (subject only to the documented de-dup/inactive-skip rule inherited from `buildApprovalChain`, which is a V1 business rule, not a bypass). |
| Approved by an approver whose stage is not currently active | `decide_request` (§5.3) locks and reads `SELECT ... WHERE status = 'PENDING' ORDER BY stage LIMIT 1 FOR UPDATE`, then rejects unless the caller's `auth.uid()` equals *that specific row's* `approver_id` — an approver holding a future or already-decided stage cannot act, full stop. |
| Multiple active Technical Managers / General Managers | The partial unique indexes in §4.1 (`profiles_one_active_tech_manager`, `profiles_one_active_gm`) make this a database-level impossibility, independent of any application code path. |
| Rejection without a comment | `decide_request` (§5.3, step 3) refuses the call outright if `decision = 'REJECTED'` and `comment` is empty — server-side, not a UI-only requirement. |
| A non-current approver deciding | Same mechanism as "stage not active," above — there is exactly one row per request that is ever eligible to be decided at any moment, and the function checks it by identity, not by client-asserted role. |
| Client-supplied approver identity being trusted | Every function in §5 derives the acting user from `auth.uid()` (the JWT Supabase itself validated), never from a parameter the client passes describing who they claim to be. |
| Direct manipulation of `requests.status` / current approver / approval history | No table in §4.3/§4.4 grants any direct client `INSERT`/`UPDATE`/`DELETE` — the only doors are the seven functions above, each of which enforces every rule in this table before writing anything. |
| Reading or acting on another user's notifications, or another employee's requests, outside the rules | RLS (§7) restricts `SELECT` on `requests`/`notifications` to the owner, involved approvers, or HR — this applies even to a direct API call that never touches the app's UI at all. |
| Historical approver identity lost when a role/routing/manager changes | `request_approvals.approver_id`/`approver_name` and `requests.manager_name` are snapshotted once, at submission or decision time, and are never rewritten by anything other than that row's own decision — see the worked example in §4.9. |

### 5.1 `submit_leave_request(leave_type_id, start_date, end_date, reason)`
Runs as the calling employee (`auth.uid()`). Inside one transaction:
1. Loads the caller's `profiles` row; rejects if `status <> 'ACTIVE'`.
2. Resolves the chain: direct manager (`profiles.manager_id`), then `company_approval_routing.technical_manager_id`, then `.general_manager_id` — each looked up, checked `ACTIVE`, and skipped if inactive or already seen (identical de-dup/self-exclusion rule to `buildApprovalChain`). Rejects if the resulting chain is empty (no manager assigned).
3. Re-validates **server-side**, never trusting client input: leave type exists and is `ACTIVE`; `end_date >= start_date`; no overlapping `PENDING`/`APPROVED` leave request for this employee (`daterange` overlap check — backed transactionally by the database-level `EXCLUDE` constraint in §9/§13.4, not just this check); if the leave type has a `balance_key`, computes `count_working_days(start_date, end_date)` (a SQL port of `countWorkingDays`, reading `public_holidays`) and the current balance via `get_leave_balance(employee_id, balance_key, extract(year from start_date))` (a SQL port of `getLeaveBalance`, reading the matching `leave_allocations` row for that employee/bucket/year) — rejects with the same "X working days, only Y remain" arithmetic the frontend already surfaces.
4. Inserts the `requests` row (snapshotting `employee_name`, `manager_name`, `leave_type_name`, `balance_key`, `working_days`), then inserts one `request_approvals` row per chain stage, then inserts the stage-1 `REQUEST_SUBMITTED` notification.
5. Returns the created request.

### 5.2 `submit_mission_request(...)` / `submit_permission_request(...)`
Same shape. Mission: date/time validation mirrors `validateMissionFields` (end after start); chain identical to leave (3 stages). Permission: chain is **stage 1 only** — resolves the direct manager, builds a single-row chain, and re-validates the 09:00–17:00 window, the 240-minute cap, "one permission per day," and the monthly allowance (`get_permission_balance`, a SQL port of the frontend function of the same name, reading both `attendance` and approved permission requests for that month) — mirrors `validatePermissionFields` exactly.

### 5.3 `decide_request(request_id, decision, comment)`
Runs as the calling approver. Inside one transaction:
1. Locks (`FOR UPDATE`) and reads the request's current stage: `SELECT * FROM request_approvals WHERE request_id = $1 AND status = 'PENDING' ORDER BY stage LIMIT 1`.
2. Rejects unless `requests.status = 'PENDING'` **and** that row's `approver_id = auth.uid()` — the exact rule enforced today by `awaitsDecisionBy` + `decideRequest`'s own re-check, now impossible to bypass since there is no other write path.
3. If `decision = 'REJECTED'`: rejects the call unless `comment` is non-empty (server-side enforcement of a rule the frontend currently only enforces in the UI). Sets that one `request_approvals` row to `REJECTED` with `decided_at`/`comment`; sets `requests.status = 'REJECTED'`, `decided_at`, `decided_by = auth.uid()`, `decision_comment`. **Every other stage row is left untouched** (§4.4). Inserts a `REQUEST_REJECTED` notification to the employee.
4. If `decision = 'APPROVED'`: sets that row to `APPROVED`. If another `PENDING` stage remains, inserts a `REQUEST_ADVANCED` notification to the employee and a `REQUEST_SUBMITTED` notification to the next approver; `requests.status` stays `PENDING`. If none remains, sets `requests.status = 'APPROVED'`, `decided_at`, `decided_by`, and notifies the employee `REQUEST_APPROVED`.

### 5.4 `delete_own_request(request_id)` — **APPROVED policy, no other deletion path exists**
Runs as the calling employee. Deletes only if **all** of: `requests.employee_id = auth.uid()` (the authenticated employee owns the request), `requests.status = 'PENDING'` (still pending), and the current pending stage's `stage = 1` (the Direct Manager has not yet approved or rejected it) — the exact predicate of `canEmployeeDeleteRequest`, re-checked server-side rather than trusted from the client. The instant the Direct Manager decides, `stage = 1`'s row leaves `PENDING`, this function's own check fails, and deletion is refused — matching the approved rule exactly, with no separate "grace period" or override. Deleting the request cascades to its `request_approvals` and `notifications` rows via `ON DELETE CASCADE`, matching the frontend's own behavior of also clearing notifications that referenced the deleted request. **This is the only way a request row is ever removed** — there is no general `DELETE` grant on `requests` for any role, including HR (§7); an administrator wanting to void a request after the fact still goes through `decide_request` (reject it, with a comment) rather than deleting history.

### 5.5 `hr_create_manager_with_team(new_employee jsonb, team_member_ids uuid[])` — **APPROVED: atomic, unchanged from original proposal**
Runs as HR (checked inside the function via `is_hr()`). Creates the new `profiles` row (the `profiles` insert here still assumes an `auth.users` row already exists for this person — see §6.3 for why that step itself cannot live in this function) and, in the **same transaction**, sets `manager_id = new_profile.id` for every id in `team_member_ids` that is currently `role = 'EMPLOYEE'`, `status = 'ACTIVE'`, and `manager_id IS NULL` — mirroring the frontend's own re-validated filter inside `createEmployee`'s single `mutate()` call exactly. This is the one place a genuinely multi-row, all-or-nothing operation is required: the manager's `profiles` row and every selected employee's `manager_id` reassignment either all commit or all roll back together, so there is no possible state where the manager exists with only some of the intended team assigned. It is the reason this cannot be expressed as two separate PostgREST calls, and it is why this function — not a raw client `INSERT` plus a raw client `UPDATE` — is the only path to this operation. The service-role key plays no part in this specific function (it operates purely at the database layer via `SECURITY DEFINER`); the service-role key is only needed one step earlier, for the `auth.users` creation itself (§6.3).

### 5.6 Notification read state — no RPC needed
`mark_notification_read`/`mark_all_notifications_read` are simple, single-table, non-cross-cutting `UPDATE`s fully expressible as plain RLS-gated `UPDATE` statements (§7) — building a function for these would be unnecessary ceremony; they are deliberately **not** included in the transactional-function list above.

### 5.7 `set_approval_routing(new_technical_manager_id uuid, new_general_manager_id uuid)` — backs Settings → Approval Routing
Runs as HR (`is_hr()` checked inside the function). Either parameter may be `NULL` to mean "leave that slot unchanged." For whichever slot *is* being changed, in this exact order, inside one transaction:
1. Validates the target id references a profile with `status = 'ACTIVE'`.
2. Reads the *current* holder of that slot from `company_approval_routing` (if any).
3. **Updates `company_approval_routing` first**, pointing the slot at the new profile.
4. **Only then** demotes the previous holder's `role` (to `'MANAGER'` by default — a sensible, immediately-editable landing spot, not a dead end; HR can change it further afterward like any other profile edit) — this step is safe precisely *because* step 3 already moved routing away from them, so the deactivation/reassignment-protection rule below no longer applies to this profile.
5. Promotes the new holder's `role` to `'TECH_MANAGER'`/`'GM'` as appropriate.

This exact ordering — **repoint routing, then demote the old holder, then promote the new one** — is what avoids two different failure modes at once without needing any special-case bypass flag: it never asks the partial unique indexes (§4.1) to tolerate two simultaneously-active holders of the same role (there is never a moment where both the old and new holder carry the role at once, because the old one is demoted only after routing has already moved off them), and it never trips the following protective rule against itself.

**Companion rule — "cannot leave the company without an active Technical Manager/General Manager":** a `BEFORE UPDATE` trigger on `profiles` rejects any attempt to set `status = 'INACTIVE'`, or to change `role` away from `'TECH_MANAGER'`/`'GM'`, on a profile that `company_approval_routing` **currently** references as the technical or general manager — with a clear error such as *"Cannot deactivate the active Technical Manager — assign a replacement in Approval Routing first."* Because `set_approval_routing` always repoints the routing table *before* touching the old holder's role (step 3 before step 4, above), its own internal demotion step passes this check cleanly; any *other*, uncoordinated attempt to deactivate or re-role the sitting Technical Manager/General Manager — bypassing `set_approval_routing` entirely — is exactly what this trigger exists to block.

Together, the seven-function RPC layer, the two partial unique indexes, and this one trigger are the complete, layered answer to "the system must prevent invalid role/routing states."

## 6. Auth Architecture

**Nothing in this section is implemented by this task.** It is the design that the next phase should follow.

### 6.1 Identity contract — the single most important rule to carry forward correctly
V1-BASELINE.md and the existing backend README both already flag this: the *original* pre-V1 build broke by returning a Supabase UUID from auth while the store was keyed by the employee's human-facing code. The production design must not repeat this: `profiles.id = auth.users.id` (a real, validated FK, not the current `NOT VALID` stub), and `profiles.employee_code` remains the human-facing identifier used throughout the UI — the company's existing Employee Code (e.g. `"ansary34"`), entered manually by HR at account creation, never auto-generated by the database. `auth.uid()` is used **only** inside RLS predicates and RPC bodies — it is never the value shown in a URL, a filter dropdown, or a request record's display fields; those continue to use `employee_code`/`name` exactly as today.

### 6.2 Sign-in UX — **APPROVED: Employee ID + Password, unchanged**
The V1 login screen continues to ask for **Employee ID + Password**, exactly as today — this is a firm decision, not open. The value entered here is matched against `profiles.employee_code`. Supabase Auth's standard flows key on email internally, so this is satisfied by giving every employee an internal, non-mailable, synthetic email identity behind the scenes (e.g. `ansary34@auth.internal`, derived deterministically from `employee_code`), used **only** as Supabase Auth's login handle. It is never shown anywhere in the UI, never used for actual mail delivery, and is fully decoupled from the profile's real, separately-stored contact `email` (the one HR enters on the Add/Edit Employee form and that appears in Employee Details). The frontend's login form, its "Employee ID" label, and its field order do not change at all — only the code behind "sign in" changes, translating the entered Employee ID (matched against `employee_code`) to its synthetic email internally before calling Supabase's password sign-in, then reading the resulting session back into the same `session.user` shape the app already uses.

### 6.3 Account provisioning — required server-side boundary
**Privileged Supabase Auth user creation must happen entirely server-side — never in the React frontend.** The service-role key required for `supabase.auth.admin.createUser()` must never be shipped to, embedded in, or reachable from any browser-loaded code. The required call chain is exactly:

```
HR frontend
    ↓
authenticated server-side function / Edge Function
    ↓
Supabase Auth Admin API
    ↓
auth.users
    ↓
profiles
```

The "authenticated server-side function" is preferably a **Supabase Edge Function** (or an equivalent trusted server-side mechanism — any backend the service-role key can live in without ever being sent to a client), invoked by the HR frontend over an authenticated call that itself proves the caller is signed in as HR (the Edge Function independently re-checks `is_hr()` against the caller's own JWT before doing anything privileged — it does not trust a client-asserted role). Inside that one trusted boundary, provisioning a new employee is a two-part operation:
1. **`auth.users` row** — created via `supabase.auth.admin.createUser({ email: '<synthetic-alias>', password: '<initial-password>', email_confirm: true })`. `email_confirm: true` is required here specifically because the synthetic alias (§6.2) is not a real, checkable mailbox — there is no confirmation email to wait for, and HR is vouching for the account's legitimacy by creating it.
2. **`profiles` row** — created immediately after, with `profiles.id` set to the new `auth.users.id`, and (for a Direct Manager) the initial team assigned in the same step — this is exactly `hr_create_manager_with_team` (§5.5) or its plain-employee equivalent, called by the same Edge Function as its very next step.

Both steps happen inside this one server-side call, so an `auth.users` row is never left without a matching `profiles` row, or vice versa. **Building this Edge Function is a required piece of work before "Add Employee" can go live in production** — it is out of scope for the current planning task (per your explicit constraint not to implement Auth or Edge Functions now) but must be sequenced in (§12).

### 6.4 Password handling
Supabase Auth (GoTrue) owns password storage and verification entirely — passwords are hashed with bcrypt server-side inside Supabase's own infrastructure. None of `lib/auth.ts`'s custom hashing carries forward (§6.8). The **initial password** HR sets when creating an employee is passed once, over an authenticated server-side call, directly into `admin.createUser()`'s `password` field — it is never stored by the application itself in any form (not in `profiles`, not in a log, not in `localStorage`) beyond the one moment HR types it into the Add Employee form and it is transmitted to the server-side function. The existing V1 behavior of showing HR the temporary password once, on the success screen, so it can be handed to the new employee, is preserved unchanged (§4 of `V1-BASELINE.md`) — only how that password reaches storage changes.

**Password policy — APPROVED (simple, V1):** HR assigns an initial temporary password when creating an account. The initial password may be simple because account provisioning is HR-controlled — for example, HR may reasonably use the employee's phone number as the temporary password. There is no minimum-length, character-class, or complexity rule, and no client- or server-side strength validation is implemented for this. The system must never display or store plaintext passwords after creation. This applies identically to HR-initiated password resets (§6.5).

### 6.5 Password reset / recovery
Because the login identity is a synthetic, non-mailable alias, Supabase's standard **self-service** "forgot password" email flow (`resetPasswordForEmail`) is **not usable as-is** — there is no real inbox behind `ansary34@auth.internal` for a reset link to reach. Two compatible options, either or both of which can be adopted without changing the login screen:
- **HR-mediated reset (matches V1's existing trust model most closely):** HR selects the employee and triggers a password reset through the same authenticated server-side function used for provisioning, calling `admin.updateUserById(userId, { password: '<new-temp-password>' })` and displaying the new temporary password to HR exactly as at creation time — no email involved, consistent with how V1 already puts HR in the loop for every account-lifecycle action.
- **Employee self-service, routed through their real email:** if an employee's `profiles.email` (their genuine contact address, already collected today) is later used as a secondary recovery channel, a reset link can be sent there — but this requires deciding to treat `profiles.email` as verified and reachable, which is a separate, later decision, not required for V1 parity and not designed further here.
Recommendation for the production cutover: implement the HR-mediated path first, since it requires no new trust assumptions beyond what V1 already has (HR sets the initial password today; resetting one is the same action, later).

### 6.6 Mapping `auth.users` to `profiles`
`profiles.id` **is** `auth.users.id` — a single, real, validated foreign key (`REFERENCES auth.users(id) ON DELETE CASCADE`), replacing the existing migrations' `NOT VALID`, never-enforced stub. There is exactly one `profiles` row per `auth.users` row, created together in the provisioning step (§6.3) and never independently. `auth.uid()` — the authenticated caller's `auth.users.id` — is used throughout RLS policies and RPC bodies purely as the join key back to `profiles`; it is never surfaced to the UI, never placed in a route, and never compared against anything the client supplies. The human-facing identity everywhere in the UI remains `profiles.employee_code` (the company's existing Employee Code, e.g. `"ansary34"`, entered manually by HR), exactly as `V1-BASELINE.md`'s "Identity contract" section already documents — restated here because getting this backwards is the exact defect that broke an earlier build entirely.

### 6.7 Session
Supabase's client SDK owns session storage, refresh, and expiry — none of the custom `hr_portal_session_v1`/8-hour-TTL logic in `lib/auth.ts` carries forward. One behavior worth deliberately preserving: today, `restoreSession()` re-reads role/status from the employee record on every restore, so a deactivated account's session dies immediately even if its token hasn't expired. The replacement must do the same — re-fetch the caller's `profiles` row (`status`) right after restoring a Supabase session and force sign-out if `INACTIVE`, rather than trusting the JWT's mere validity.

### 6.8 What is deleted outright
`hr_portal_credentials_v1` and every line of `lib/auth.ts`'s custom hashing (explicitly documented in its own comments as not a production KDF) are replaced wholesale by Supabase Auth's own password handling — none of it is migrated or reused.

---

## 7. RLS / Security Architecture

Legend: **S**elect, **I**nsert, **U**pdate, **D**elete. "—" means no grant to that role at all (not even via a policy that always evaluates false — simply no policy, which is RLS's default-deny).

| Table | Employee | Manager | Tech Manager | GM | HR |
|---|---|---|---|---|---|
| `profiles` | S: self, own manager, own `TECH_MANAGER`/`GM` (chain preview), direct reports (none, for a plain employee) · U: self, non-sensitive fields only · **D: —** | S: same rule + own direct reports · U: self, non-sensitive fields · **D: —** | S: same + **all profiles** (Organization) · U: self, non-sensitive · **D: —** | S: same as TM · U: self, non-sensitive · **D: —** | **S/I/U: all · D: — (no one, including HR — deactivate via `status='INACTIVE'` instead, §13.1)** |
| `company_approval_routing` | S | S | S | S | **S · no direct I/U/D — exclusively via `set_approval_routing` (§5.7)** |
| `leave_types` | S (active) | S (active) | S (active) | S (active) | **S/I/U · D: — (archive via `status='INACTIVE'` instead, §4.8, §13.2)** |
| `leave_allocations` | S: self | S: self | S: self | S: self | S/I/U for anyone (no delete feature exists; a mis-entered year's row is corrected via `U`, not removed) |
| `requests` | S: own · **no direct I/U/D for anyone, including HR** (§5.4) | S: own + any where they hold a `request_approvals` row · no direct I/U/D | S: own + all where they hold a row (effectively company-wide) · no direct I/U/D | S: own + all where they hold a row (effectively company-wide) · no direct I/U/D | **S: all** · no direct I/U/D — HR's own requests go through the same `submit_*`/`delete_own_request` functions as anyone else's, and HR has no administrative override to directly edit or delete a request row |
| `request_approvals` | S: rows on requests they own or approve | same | same | same | S: all | 
| `notifications` | S: own · U: own, `read` column only · **D: —** | same | same | same | **S: all · U: own or any · D: — (no one — notification history is preserved permanently, §13.3)** |
| `attendance` | S: own | S: own (no report visibility — no such V1 feature) | S: own | S: own | **S/I/U/D: all** (HR's existing delete-a-record feature is real and kept — distinct from the other tables above, which have no delete feature in V1) |
| `public_holidays` | S | S | S | S | S/I/D (no update — matches "add/remove only") |

**Key predicates, expressed once and reused everywhere via helper functions** (the existing `is_hr()` pattern, extended):
- `is_hr()` — unchanged from the existing migration.
- `is_tech_manager_or_gm()` — new, backs Organization's company-wide `profiles` read and the "effectively company-wide" `requests` visibility for those two roles (since they sit in nearly every chain, this is a close approximation of "all requests," achieved through the same `request_approvals`-membership predicate as everyone else — no special-case "GM sees everything" bypass is needed).
- `has_approval_role_in(request_id)` — `EXISTS (SELECT 1 FROM request_approvals WHERE request_id = $1 AND approver_id = auth.uid())`, the RLS equivalent of the frontend's `involvesApprover()`.

**Never treat the frontend as the boundary:** every one of the checks above is enforced by Postgres itself — a hand-crafted `fetch()` call bypassing the UI entirely is subject to exactly the same restrictions as a button click.

---

## 8. Notification Architecture (backend)

Fully covered by §4.5, §5.3, and §7's table row above. The one point worth restating: **notifications are written exclusively by the `SECURITY DEFINER` functions in §5**, as part of the same transaction that submits or decides a request — this is the fix for the currently-broken write path (§2.11/§3.4), and it means notification delivery can never silently fail to fire the way it does in the shipped-but-disconnected existing schema.

---

## 9. Leave / Attendance / Holiday Architecture (backend)

- **Working-day calculation:** a SQL function `count_working_days(start_date, end_date)` — Sunday–Thursday work week (`EXTRACT(DOW FROM d) NOT IN (5,6)`), excluding any date present in `public_holidays`, inclusive of both ends — a direct port of `countWorkingDays`/`isWorkingDay`.
- **Balances:** `get_leave_balance(profile_id, bucket, year)` and `get_permission_balance(profile_id, month)` — SQL ports of the identically-named frontend functions, **computed on read from `requests`/`leave_allocations`/`attendance`, never stored as a running counter** — carrying forward the frontend's own explicit design principle ("a stored counter drifts the first time a request is corrected; a derived one cannot"). `get_leave_balance`'s `entitlement` figure now comes from the year-matched `leave_allocations` row (§4.2) instead of a flat column on `profiles`; `used`/`held` are still summed from that employee's own `requests` rows for the matching bucket, scoped to the same calendar year as the allocation.
- **Overlap prevention — APPROVED: dual-layer, both required.** Business decision confirms overlap must be blocked "server-side and transactionally," which resolves the earlier open question: this is not optional hardening, it is the requirement. Two layers, both included: (1) the `SELECT`-based check inside `submit_leave_request` (§5.1), which produces the specific, readable rejection message the frontend already surfaces; and (2) a database-level `EXCLUDE` constraint using the `btree_gist` extension — `EXCLUDE USING gist (employee_id WITH =, daterange(start_date, end_date, '[]') WITH &&) WHERE (type = 'LEAVE' AND status IN ('PENDING','APPROVED'))` — which is what actually makes the guarantee airtight under concurrency (two simultaneous submissions racing past the RPC's own `SELECT` check). See §13.4 for the full reasoning and integrity implications.
- **Attendance → permission allowance:** the `get_permission_balance` function nets `attendance`-derived lateness/early-departure against approved `PERMISSION` requests for the same date, exactly as `approvedPermissionMinutesOn`/`getPermissionBalance` do today — "don't double-charge a date already excused by an approved permission" is preserved.

---

## 10. Migration Strategy — **APPROVED**

**Decided: keep the existing five migration files exactly as they are, as historical/reference material. They are not the production schema. A clean, new migration sequence is written for the final architecture instead.**

Reasoning: three separate `CHECK` constraints in the existing schema make it structurally incapable of storing the current product (§2.2, §2.5, §2.11) — this is not a matter of adding a column, it is a matter of the schema rejecting valid V1 data outright. Patching five interdependent files that were never applied to anything live carries real risk of missing an interaction (as already happened once — migration 4's undelivered `GRANT`) and produces a harder-to-audit history than a small number of clean, purpose-built migrations written directly against the V1-BASELINE.

**Disposition of the existing five files:** leave them in place, untouched, under `02-SOURCE/backend/migrations/` — they are a legitimate historical record of the project's design evolution and its own README already documents their known issues honestly. Do **not** apply them to a real Supabase project. See §13.5 for the resolved recommendation on exactly where the new production migration sequence lives.

---

## 11. Data Migration Strategy — **APPROVED**

**Decided: do not migrate the current localStorage/demo data. Production starts with clean data, full stop — including configuration tables.**

The existing seed data (`EMP-00001`…`EMP-00009`, `@company.com` emails, the shared demo password `Geo@123456` printed in this project's own README) is fixture data, not real personnel — migrating it would put fabricated people and a publicly-documented password into a production system. HR (and whoever administers the initial company setup) will populate production from scratch with verified real data across every one of: users, roles, managers, the Technical Manager, the General Manager, HR, leave types, leave allocations, and public holidays. The demo defaults currently in `store.ts` (`DEFAULT_EMPLOYEES`, `DEFAULT_LEAVE_TYPES`, `DEFAULT_HOLIDAYS`) are not carried into production in any form, including as a starting-point convenience — this closes what was previously an open "narrow exception" question; there is no exception.

---

## 12. Implementation Sequence (proposed, not started)

1. **You approve this plan.** Every technical decision is now resolved (§13.1–§13.10); the one remaining item (§13.11 — who builds/hosts the Edge Function) is a staffing assignment, not a design question.
2. Write the new migration set (schema → functions → RLS) against a scratch/local Postgres or a fresh Supabase project — not the current one, since none is currently linked to this repo (confirmed: no `.env`, no `supabase/config.toml` exist anywhere).
3. Exercise every RPC directly (SQL client / Supabase Studio) against the new schema before any frontend involvement — submit/approve/reject/delete/mark-read flows, for all five roles, including the negative cases (wrong-stage approve attempt, reject without comment, double-delete, etc.).
4. Build the Edge Function for employee provisioning (§6.3) and test it in isolation.
5. Wire Supabase Auth into `lib/auth.ts` — a dedicated, carefully-scoped task on its own, explicitly **not** part of this planning task.
6. Migrate `lib/store.ts`'s functions to Supabase calls one feature area at a time, in dependency order: profiles/auth → requests + approvals (the core workflow) → notifications → leave types/allocations → attendance → public holidays → dashboard calendar (last, since it depends on everything above already being live).
7. Re-run the same validation matrix already exercised for each V1 feature across this project's history, now against the real backend, for all five roles.
8. Cut over; retire the `localStorage` code paths.

---

## 13. Technical Decisions — Resolved

All ten items below are standard engineering decisions within an already-approved business direction — each is resolved here with a recommendation, the reasoning behind it, and its security/data-integrity implications, rather than being handed back as an open question.

### 13.1 `DELETE` grants for `profiles`
**Recommendation:** no `DELETE` grant to any role, including HR. Deactivation (`status = 'INACTIVE'`) is the only lifecycle-ending action, exactly as V1 has always worked.
**Reason:** V1 has never had an employee-delete feature — only create/edit/activate/deactivate. There is no requirement this decision would satisfy that deactivation doesn't already.
**Security/integrity implications:** enforced twice over — no `DELETE` policy at all (RLS default-deny), *and* `requests.employee_id ... ON DELETE RESTRICT` would refuse the delete at the foreign-key level even if a policy existed. An employee who leaves the company keeps every historical request, approval, notification, and attendance row fully intact and attributable (§4.3).

### 13.2 `DELETE` grants for `leave_types`
**Recommendation:** no `DELETE` grant to any role. Archiving (`status = 'INACTIVE'`) is the only removal path.
**Reason:** matches the existing frontend exactly (Settings has never offered a delete action, only add + status toggle) and directly satisfies "leave types must not be hard-deleted in normal V1 operation."
**Security/integrity implications:** `requests.leave_type_id ... ON DELETE SET NULL` plus the independently-snapshotted `requests.leave_type_name` mean historical requests display correctly regardless — archiving is simply the only door left open, not a workaround for a fragile FK.

### 13.3 `DELETE` grants for `notifications`
**Recommendation:** no `DELETE` grant to any role, including HR.
**Reason:** directly required — "notification history remains preserved," "no user-facing notification deletion in V1."
**Security/integrity implications:** the only mutation ever permitted on a notification row is flipping `read` (via RLS-gated `UPDATE`, §5.6) — `message`, `type`, `request_id`, and `created_at` are immutable for the row's entire life. A complete, permanent record of every notification ever sent to every user is preserved.

### 13.4 Leave overlap enforcement approach
**Recommendation:** both layers, not one — the RPC-level check inside `submit_leave_request` (§5.1) *and* a database `EXCLUDE` constraint using the `btree_gist` extension (§9).
**Reason:** the business requirement is explicit that this must be enforced "server-side and transactionally." The RPC check alone has a real race window: two requests for the same employee, overlapping dates, submitted at nearly the same instant, could both pass the `SELECT`-based check before either has committed. An `EXCLUDE` constraint is Postgres's native mechanism for "no two rows may simultaneously satisfy this predicate," checked atomically by the database itself regardless of transaction timing.
**Security/integrity implications:** `btree_gist` is a standard, first-party Postgres contrib extension (not a security-sensitive or third-party dependency) — enabling it carries no meaningful risk. Without the constraint, overlap prevention would depend entirely on application discipline, which is exactly the class of guarantee this whole plan is designed to move out of the client's hands.

### 13.5 Final organization of historical migrations
**Recommendation:** the existing five files stay exactly where they are, under `02-SOURCE/backend/migrations/`, completely untouched. The new production schema is written as a fresh set of migration files in a clearly separate location — `02-SOURCE/backend/migrations_production/` — with a short `README.md` in that folder stating plainly that `migrations/` (no suffix) is superseded, historical, and never applied to a real project.
**Reason:** a subfolder (rather than merely later timestamps in the same folder) makes the split visually unmissable to anyone opening the repo later, with no risk of the two sequences being run together by mistake by a migration tool that just globs `*.sql` in one directory.
**Security/integrity implications:** none directly — this is organizational. It does reduce the risk of human error (accidentally applying an old, incompatible migration against a production database) to near zero.

### 13.6 Edge Function implementation
**Recommendation:** one Edge Function (a single Deno/TypeScript function, Supabase's standard Edge Function runtime — e.g. named `provision-employee`) handling every privileged Auth Admin operation: create, password reset, and (if ever needed) deactivation-adjacent Auth operations. Inside it: (1) construct a Supabase client scoped to the *caller's own JWT* and call `is_hr()` (or an equivalent check) to verify the caller is really HR — never trust a client-asserted role; (2) only then construct a second, admin-privileged Supabase client using the service-role key (read from the function's own secret/environment configuration, never from a request payload) to call the Admin API; (3) call the appropriate `SECURITY DEFINER` database function (`hr_create_manager_with_team` or its plain-employee equivalent) for the `profiles`-side work.
**Reason:** one function, one audited boundary, is easier to reason about and secure than several privileged entry points. Deno/TypeScript is Supabase Edge Functions' native, first-party runtime.
**Security/integrity implications:** the service-role key exists in exactly one place — this function's own secret configuration inside Supabase's infrastructure — and is never returned in any response, logged, or passed through to the frontend. The independent `is_hr()` re-check inside the function (not merely relying on the frontend only showing the "Add Employee" button to HR users) is what actually prevents a non-HR user from invoking this function directly against its URL.

### 13.7 `company_approval_routing` management
**Recommendation:** a dedicated HR-only UI area, **Settings → Approval Routing**, calling the `set_approval_routing` RPC (§5.7) — not folded into the general employee-edit form. This is now a firm design decision, not merely schema-compatible with either approach.
**Reason:** given directly — "HR manages company-wide approval routing through Settings → Approval Routing." Keeping it as its own screen also makes the "exactly one active TM/exactly one active GM" invariant visible and explicit to HR (e.g., showing who currently holds each slot and offering a single "replace" action), rather than being an easy-to-miss side effect of editing an unrelated employee's role field.
**Security/integrity implications:** none beyond what §4.1/§4.9/§5.7 already establish — this is a frontend placement decision layered on top of an already-secure backend design; the backend enforces the invariants regardless of which screen calls `set_approval_routing`.

### 13.8 Exact RLS strategy
**Recommendation:** the hybrid design already built out across §5 and §7 — confirmed as final, not one of several options. Plain, declarative RLS policies handle every `SELECT` and every simple, single-row, non-cross-cutting `UPDATE` (marking a notification read, editing one's own non-sensitive profile fields). Every operation that is multi-row, order-dependent, or requires validation logic beyond a single `USING`/`WITH CHECK` predicate (submitting a request, deciding one, deleting one, creating an employee with a team, changing approval routing) has **zero direct grant** and goes exclusively through a `SECURITY DEFINER` function.
**Reason:** this is the dividing line that already closed every concrete bug found in the existing migrations (§3) — RLS predicates are excellent at "can this row be read/written by this identity" and poor at "did five different things happen in the right order with the right side effects." Using each tool where it's strong avoids both an unreadable thicket of ever-more-specific `WITH CHECK` clauses and an over-built RPC layer around trivial reads.
**Security/integrity implications:** this is the core of the entire security model — restated from §7: the frontend is never the boundary; a direct, hand-crafted API call is subject to exactly the same restrictions as a button click, because the restrictions live in Postgres itself.

### 13.9 Exact approval RPC strategy
**Recommendation:** the seven-function design in §5 — confirmed as final. `submit_leave_request`, `submit_mission_request`, `submit_permission_request`, `decide_request`, `delete_own_request`, `hr_create_manager_with_team`, `set_approval_routing`.
**Reason:** each function corresponds to exactly one atomic business operation from `V1-BASELINE.md` that either spans multiple rows/tables or requires authorization logic beyond a row-level predicate. No operation needed two functions; no two operations were merged into one function that would then need internal branching to tell them apart.
**Security/integrity implications:** every one of the "must never happen" cases in §5.0's table is mapped to one of these seven functions (or to the RLS/index layer) — there is no eighth, undocumented write path into `requests`/`request_approvals`/`notifications`/`company_approval_routing`.

### 13.10 Auth/profile creation sequence
**Recommendation:** the exact sequence in §6.3 and §13.6, confirmed as final: **HR frontend → Edge Function (re-verifies `is_hr()`) → Supabase Auth Admin API (`auth.users` created) → `hr_create_manager_with_team`/plain-employee equivalent (`profiles` created, team assigned if applicable)** — all orchestrated by the one Edge Function invocation, so the two halves (`auth.users`, `profiles`) are never left out of sync.
**Reason:** this is the only sequence that satisfies "the service-role key must never reach React" *and* "the manager+team assignment must be atomic" simultaneously — splitting it any other way either exposes the key to the client or breaks the atomicity guarantee for one half of the operation.
**Security/integrity implications:** if the Edge Function's Admin API call succeeds but the subsequent database call fails (or vice versa), the two systems could in principle drift out of sync (an `auth.users` row with no `profiles` row, or the reverse) — this is an inherent property of coordinating two separate systems (Supabase Auth and Postgres) that don't share one transaction. The mitigation is standard for this kind of two-phase operation: the Edge Function should catch a database-side failure and clean up the just-created `auth.users` row before returning an error to HR, so a failed "Add Employee" attempt never leaves an orphaned login with no profile behind it.

### 13.11 What genuinely still requires your decision
Only one item from the original list was not an engineering decision to begin with:
- **Who builds and hosts the Edge Function, and when** — this environment has no Supabase project connected yet (confirmed: no `.env`, no `supabase/config.toml` exist anywhere in this repo). This is a staffing/scheduling question, not an architecture question — §13.6 fully specifies *what* the function does and *how* it must behave; *who* implements it and *which* Supabase project it's deployed against is yours to assign.

---

## 14. Traceability

Every SQL fact cited in §1–§3 was re-read directly from `02-SOURCE/backend/migrations/*.sql` during this session (not recalled from an earlier, unverified summary). Every frontend fact cited in §2 and used to shape §4–§9 was re-read directly from `02-SOURCE/frontend/src/lib/store.ts` in full during this session. No schema decision in §4 contradicts anything recorded as approved V1 behavior in `04-DOCS/V1-BASELINE.md`.

**Revision history:**
- *Round 1:* applied nine explicitly approved decisions (authentication/login UX, `leave_allocations` design, `audit_logs` scope, request-deletion policy, HR manager+team transaction confirmation, clean production data, auth provisioning chain, and the corrected count of six transactional functions). Internal cross-references pointing at the wrong section number were corrected in passing.
- *Round 2:* finalized the non-negotiable Leave/Mission/Permission approval sequence as an explicit enforcement-mapping table (§5.0); added the two partial unique indexes on `profiles` that make "exactly one active Technical Manager/General Manager" a hard database guarantee rather than an implicit assumption (§4.1); added the `set_approval_routing` function backing HR's new **Settings → Approval Routing** screen, correcting the transactional-function count from six to seven for this real, named reason (§5.7); resolved all ten previously-open technical decisions with recommendation/reason/implications each, leaving only the Edge Function staffing assignment genuinely open (§13); confirmed and cross-referenced the already-correct historical-integrity guarantees for both Direct-Manager reassignment and Technical Manager/General Manager routing changes, with the Ahmed/Mohamed worked example (§4.9); confirmed employee-deactivation history preservation (§4.3), leave-type archival (§4.8), multi-HR support (§4.1), and future Excel-import compatibility for `attendance` (§4.6) — all as restatements/confirmations of already-sound design, not schema changes. No previously-resolved decision was reopened or reversed.
- *Round 3:* reverses a since-rejected strict password-complexity policy (minimum length + uppercase/lowercase/number rules, an Edge Function validation step, and a UI requirements checklist) that was briefly approved and documented, then explicitly withdrawn as impractical for HR's manual provisioning workflow. §6.4 now states the simple, final V1 policy: HR may assign any initial/reset password it chooses (a phone number is an explicit acceptable example), with no complexity rule and no strength validation anywhere in the stack; plaintext is still never displayed or stored after creation. §13.6's Edge Function sequence reverts to its original three steps (no password-policy validation step). No code implementing the withdrawn policy ever existed — the frontend password UI (Show/Hide, Edit-Employee blank-means-unchanged) was unaffected by this reversal.
- *Round 4 (this update):* corrects the employee identifier throughout §4.1, §6.1, §6.2, §6.5, and §6.6 from an auto-generated `employee_number` (`"EMP-NNNNN"`) to `employee_code` — the company's pre-existing Employee Code (e.g. `"ansary34"`), entered manually by HR at account creation and never database-generated. This is the same login identifier described throughout §6 (the "Employee ID" field), renamed to match the approved model, not a second identifier alongside it. The historical, untouched migrations described in §1 genuinely used `employee_number`/`EMP-NNNNN`/`generate_employee_number()` — those factual descriptions of `02-SOURCE/backend/migrations/` are unchanged, since that folder itself was not touched.
