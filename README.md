# GEOTECH HR Portal — Complete Package

نظام إدارة طلبات الإجازات والمأموريات
Leave, mission and permission requests with a three-stage approval chain
(direct manager, technical manager, general manager), leave balances in working
days, and a monthly permission allowance charged automatically from attendance.

Packaged 3 September 2026.

---

## ابدأ من هنا / Start here

**عايز تشوفه شغال بس؟**
افتح فولدر `01-DEMO` واضغط دبل كليك على **`START-DEMO.bat`**
هيفتح المتصفح لوحده على النظام.

ادخل بأي حساب من دول، والباسورد واحد لكلهم: **`Geo@123456`**

| المرحلة | الدور | الرقم |
|---|---|---|
| — | موظف | `EMP-00001` |
| ١ | مدير مباشر | `EMP-00002` |
| ٢ | مدير فني | `EMP-00008` |
| ٣ | مدير عام | `EMP-00009` |
| — | HR | `EMP-00003` |

كل طلب بيعدي على تلات مراحل بالترتيب: المدير المباشر، بعده المدير الفني، بعده المدير العام.

التفاصيل الكاملة في `03-ACCOUNTS/GEOTECH-HR-Accounts.xlsx`

---

## What is in this folder

```
GEOTECH-HR-Package/
│
├── 01-DEMO/                    ← ready to run, nothing to install
│   ├── START-DEMO.bat            double-click this
│   ├── index.html                the built application
│   ├── serve.mjs                 tiny offline server (no dependencies)
│   └── assets/
│
├── 02-SOURCE/
│   ├── frontend/               ← the application source
│   │   ├── src/app/App.tsx       the whole UI: design system, shell, 20 screens
│   │   ├── src/lib/auth.ts       sign-in, session, credential storage
│   │   ├── src/lib/store.ts      people, requests, and the approval-chain model
│   │   ├── src/styles/           Tailwind 4 + design tokens
│   │   └── README.md             how to run and develop
│   │
│   └── backend/                ← PostgreSQL schema + row-level security
│       ├── migrations/           5 SQL migrations
│       └── README.md             status, known issues, wiring steps
│
│       └── (attendance, balances and holidays are not in the SQL schema yet)
│
├── 03-ACCOUNTS/
│   └── GEOTECH-HR-Accounts.xlsx  demo accounts, full roster, permissions matrix
│
├── 04-DOCS/
    ├── audit.html                full technical and HR audit — open in a browser
    ├── specs/                    the five original requirement specs
    └── design-guidelines/        design system reference
│
└── 05-DESIGN/                  ← for the UI/UX designer
    ├── README.md                 start here
    ├── figma-plugin/             run once in Figma; it builds the design system
    ├── design-tokens.json        W3C tokens, imports into Tokens Studio
    └── screens/                  22 full-page screenshots at 2x
```

A live component gallery is also served by the app itself at **`/design-system`**
— no sign-in needed. It renders the real components, so it never goes stale.

---

## Running the demo

### Option 1 — the launcher (recommended)

Double-click `01-DEMO/START-DEMO.bat`. It starts a small local server on
`http://localhost:4173` and opens your browser. Requires Node.js, which is
already on this machine. Close the black window to stop it.

### Option 2 — open the file directly

Open `01-DEMO/index.html` in a browser. The build uses relative paths and
switches to hash-based routing when it detects `file://`, so it works — but
browsers restrict local storage on `file://`, so Option 1 is more reliable.

### Option 3 — run from source

```bash
cd 02-SOURCE/frontend
npm install
npm run dev
```

Then open `http://localhost:5173`.
Other scripts: `npm run build`, `npm run preview`, `npm run typecheck`.

---

## The approval chain

```
        Employee
           |
    1. Direct Manager        one per department
           |
    2. Technical Manager     one, all department managers report to them
           |
    3. General Manager       one, the final word
```

The chain is snapshotted onto the request when it is submitted, so a later
reorganisation never re-routes a request that is already in flight. An approver
can read a request at any point, but the Approve and Reject buttons appear only
while it is standing at their own stage. Rejection at any stage closes the
request immediately and tells the employee who rejected it and why.

Two rules keep small orgs sane: nobody approves their own request, and a person
who would appear twice in a chain is only asked once. A department manager
reports to the technical manager, so their own requests run a two-stage chain.

## Try the full loop

1. Sign in as **`EMP-00001`** and submit a leave request. The form lists all
   three approvers before you send it, and you cannot change them.
2. Sign in as **`EMP-00002`** (stage 1) and approve. The request stays Pending
   and moves to stage 2.
3. Sign in as **`EMP-00009`** (the GM) and open the same request. You can read
   it, but there are no Approve or Reject buttons — it is not your turn.
4. Sign in as **`EMP-00008`** (stage 2) and approve.
5. Sign in as **`EMP-00009`** again and approve. Only now is it **Approved**.
6. Sign in as **`EMP-00001`** to see a notification from every stage and the
   completed timeline.
7. Sign in as **`EMP-00003`** and add an employee. The account you create can
   sign in immediately with the initial password you set.

To reset everything back to the seed data, open the browser console and run:

```js
localStorage.removeItem('hr_portal_store_v4');
localStorage.removeItem('hr_portal_credentials_v1');
localStorage.removeItem('hr_portal_session_v1');
location.reload();
```

---

## Balances, permissions and attendance

### Leave balance

Every employee carries two pots, in **working days**:

| Pot | Opening | Fed by |
|---|---|---|
| Annual | 14 | Leave types mapped to the annual bucket |
| Casual | 7 | Leave types mapped to the casual bucket |

HR sets the opening figures once, on the Add Employee form. After that the
system does the arithmetic:

- A **pending** request *holds* days. A submitted-but-undecided leave is already
  subtracted from what you can request, so five overlapping requests cannot each
  look affordable and then blow the entitlement on approval.
- An **approved** request *consumes* them.
- A **rejected** request releases them.
- When the pot cannot cover a request, submission is refused with the arithmetic
  spelled out: *"That is 31 working days, but only 12 of your annual leave days
  remain (2 more days are awaiting approval)."*

Days are counted **Sunday to Thursday**. Friday and Saturday are the weekend and
never consume balance, and neither do the public holidays HR maintains in
Settings. A Thursday-to-Sunday leave costs two days, not four.

Sick, maternity, paternity and unpaid leave are deliberately **not** balance
limited — they are governed by statute, not by an annual allowance. HR controls
which bucket each leave type draws on, in Settings.

### Permissions

Each employee gets **240 minutes a month** — four hours — to arrive late or leave
early. The allowance resets on the first of each month.

A permission is a short absence, so it takes the **short route: the direct
manager decides it alone.** It does not travel up the three-stage chain.

The remaining minutes sit in a small chip in the header, visible on every screen,
and turn amber under an hour and red at zero. When the allowance is gone, the
request form refuses to open a new one.

### Attendance

HR enters the fingerprint record under **Attendance**. The workday starts at
**09:00**: clock in at 09:04 and 4 minutes are charged to that employee's monthly
permission allowance automatically. Leaving before 17:00 is charged the same way.

Lateness already covered by an approved permission for that date is **not**
charged twice.

Re-entering a day corrects it rather than double-charging, and the table shows
what each record cost alongside the employee's remaining balance.


---

## What is real, and what is not

**Working end to end:** sign-in, sessions that survive a refresh, the complete
three-stage submit → notify → approve or reject → notify loop, out-of-turn
decisions blocked, My Team driven by the real hierarchy, a read-only
Organization directory for the technical manager and GM, HR employee management
where a created account can actually sign in, and hierarchy guards (no
self-manager, no reporting loops, cannot demote or deactivate a manager who
still has direct reports). Managers, the technical manager, the GM and HR can
all file their own requests — they are employees too.

**Not real yet:**

- Data lives in the browser's `localStorage`. Two different browsers do not
  share anything. This is a demo, not a deployment.
- All authorization is enforced in the client. The PostgreSQL schema with
  row-level security exists in `02-SOURCE/backend` but is not connected.
- Passwords are salted and hashed, never stored in plaintext, but the hash is a
  synchronous fallback — not a production KDF. Hashing belongs on a server.
- No request cancellation, no approval delegation, no attachments, no exports,
  and no Arabic or RTL support.
- Leave balances do not accrue over time and do not carry over at year end —
  HR sets an opening figure and it decrements from there.
- Attendance is typed in by HR. Nothing reads the fingerprint device directly.

`04-DOCS/audit.html` covers all of this in detail, with a three-horizon roadmap.
Read it before adding features — the ordering there matters.

---

## Identity contract

One key space, everywhere:

```
session.user.id === EmployeeProfile.id === "EMP-00001"
```

The original build returned a Supabase UUID from the auth layer while the data
store was keyed by `EMP-NNNNN`. Nothing ever matched, so no request could be
created and every manager's team was permanently empty. If you connect Supabase,
map `profiles.employee_number` onto `session.user.id` — not `profiles.id`.
