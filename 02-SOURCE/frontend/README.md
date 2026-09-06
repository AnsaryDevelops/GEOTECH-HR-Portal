# GEOTECH HR Portal

Leave and mission request system with EMPLOYEE / MANAGER / HR roles.

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:5173

Other scripts: `npm run build`, `npm run preview`, `npm run typecheck`.

## Demo accounts

Every seeded account uses the same password: **`Geo@123456`**

| Employee ID    | Name          | Role              | Reports to   |
| -------------- | ------------- | ----------------- | ------------ |
| `EMP-00001`    | Alex Morgan   | Employee          | Jordan Lee   |
| `EMP-00002`    | Jordan Lee    | Direct Manager    | Khaled Nabil |
| `EMP-00003`    | Riley Chen    | HR                | Hesham Fouad |
| `EMP-00004`    | Nour Khalil   | Employee          | Jordan Lee   |
| `EMP-00005`    | Sami Hadid    | Employee          | Jordan Lee   |
| `EMP-00006`    | Sara Mohamed  | Direct Manager    | Khaled Nabil |
| `EMP-00007`    | Omar Hassan   | Employee          | Sara Mohamed |
| `EMP-00008`    | Khaled Nabil  | Technical Manager | Hesham Fouad |
| `EMP-00009`    | Hesham Fouad  | General Manager   | —            |
| `EMP-INACTIVE` | Sam Park      | Employee          | Jordan Lee — inactive, cannot sign in |

These are development credentials only. They are deliberately not shown anywhere in the UI.

To reset all data back to the seed, clear the site's local storage or run this in the browser console:

```js
localStorage.removeItem('hr_portal_store_v4');
localStorage.removeItem('hr_portal_credentials_v1');
localStorage.removeItem('hr_portal_session_v1');
location.reload();
```

## The approval chain

Every request walks three stages in order:

```
Employee -> 1. Direct Manager -> 2. Technical Manager -> 3. General Manager
```

`buildApprovalChain()` in `lib/store.ts` resolves it from the hierarchy and
snapshots it onto the request at submit time, so a later reorganisation cannot
re-route something already in flight. Each `ApprovalStep` records its own
approver, status, timestamp and comment.

Rules worth knowing:

- An approver may **read** any request they appear in, but the Approve and
  Reject buttons only appear while it stands at their stage. `decideRequest()`
  re-checks this, so the guard is not merely visual.
- Rejection at any stage closes the request at once; later stages are never
  asked.
- Nobody approves their own request, and a person who would appear twice is only
  asked once — a department manager reports to the technical manager, so their
  own requests run a two-stage chain.
- Everyone can file their own requests, including the GM and HR.

## Try the full loop

1. Sign in as `EMP-00001` and submit a leave request. The form lists all three
   approvers; you cannot change them.
2. Sign in as `EMP-00002` (stage 1) and approve. Status stays Pending.
3. Sign in as `EMP-00009` (the GM) and open it — readable, but no decision
   buttons yet.
4. Sign in as `EMP-00008` (stage 2) and approve.
5. Sign in as `EMP-00009` and approve. Only now is it Approved.
6. Sign in as `EMP-00001` for the notifications and the completed timeline.

HR (`EMP-00003`) can add employees, edit them, manage leave types, and see every
request across the organisation, but never approves. An employee created by HR
can sign in immediately with the initial password HR sets.

## Balances, permissions and attendance

### Leave balance

Two pots per employee, in **working days**: 14 annual, 7 casual. HR sets the
opening figures once on the Add Employee form; the system does the arithmetic
after that.

- A **pending** request *holds* days, an **approved** one *consumes* them, a
  **rejected** one releases them. Holding matters: without it five overlapping
  requests each look affordable alone and blow the entitlement on approval.
- When the pot cannot cover a request, submission is refused with the sum shown:
  *"That is 31 working days, but only 12 of your annual leave days remain
  (2 more days are awaiting approval)."*

Days are counted **Sunday to Thursday**. Friday and Saturday are the weekend and
never consume balance, and neither do the public holidays HR maintains in
Settings. A Thursday-to-Sunday leave costs 2 days, not 4 —
`countWorkingDays()` in `lib/store.ts`.

Sick, maternity, paternity and unpaid leave are deliberately not balance
limited. Each leave type carries a nullable `balanceKey` that HR controls.

### Permissions

240 minutes a month per employee, reset on the 1st. A permission is a short
absence, so it takes the **short route: the direct manager decides it alone** and
it never travels up the three-stage chain.

Remaining minutes live in a chip in the shell header, visible on every screen —
amber under an hour, red at zero. At zero the request form refuses to open.

### Attendance

HR records the fingerprint under **Attendance**. The workday starts at 09:00, so
a 09:04 check-in charges 4 minutes to that employee's monthly allowance
automatically. Leaving before 17:00 is charged the same way.

Lateness already excused by an approved permission on that date is **not**
charged twice. Re-entering a day corrects it rather than double-charging.

### Design note

Balances are always **computed** from request rows, never stored as a running
total. A stored counter drifts the first time a record is corrected; a derived
one cannot.

## Architecture

```
src/
  main.tsx          entry point
  app/App.tsx       the whole UI: design system, shell, routing, 19 screens
  lib/auth.ts       sign-in, session, credential storage
  lib/store.ts      employees, requests, notifications, leave types, validation
  styles/           Tailwind 4 + design tokens
supabase/migrations/  Postgres schema and RLS — written, not yet wired up
```

### Where data lives

`localStorage`, under `hr_portal_store_v4`. It behaves like a shared database for
everyone using this browser: a request an employee submits is still there when
their manager signs in afterwards.

This is a working demo, not a deployment. Two browsers do not share data, and
nothing is enforced on a server. The `supabase/migrations/` schema is the
intended destination — see the audit for the migration order.

### Identity

One key space everywhere:

```
session.user.id === EmployeeProfile.id === "EMP-00001"
```

The previous build returned a Supabase UUID from the auth layer while the store
was keyed by `EMP-NNNNN`. Nothing ever matched, so no request could be created
and every manager's team was empty. If you wire up Supabase, map
`profiles.employee_number` onto `session.user.id` rather than `profiles.id`.

### Passwords

Salted and hashed in `lib/auth.ts`, never stored in plaintext. The hash is
synchronous by necessity (the HR create-employee handler is synchronous) and is
**not** a production KDF. When the server layer lands, move hashing to the
server and use bcrypt or argon2id.

## Known gaps

No accrual or carry-over — HR sets an opening figure and it decrements from
there. No request cancellation, no approval delegation, no attachments, no
exports, and no Arabic or RTL support. Attendance is typed in by HR; nothing
reads the fingerprint device directly. Authorization is enforced in the client
only. See the audit document for the full list and the roadmap.
