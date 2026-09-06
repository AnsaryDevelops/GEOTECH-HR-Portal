// Application data layer — requests, notifications, employees, leave types.
// In production, replace with API calls and a real database.

export type RequestStatus = "PENDING" | "APPROVED" | "REJECTED";
export type RequestType = "LEAVE" | "MISSION" | "PERMISSION";

/** A permission is either arriving late or leaving early, priced in minutes. */
export type PermissionKind = "LATE_ARRIVAL" | "EARLY_DEPARTURE";

export const PERMISSION_LABEL: Record<PermissionKind, string> = {
  LATE_ARRIVAL: "Late arrival",
  EARLY_DEPARTURE: "Early departure",
};

// Five roles. The three approver roles form a single chain of command:
//   EMPLOYEE -> MANAGER (per department) -> TECH_MANAGER (one) -> GM (one)
// HR sits on a separate, administrative axis: it manages people and leave
// types, and never approves requests.
export type UserRole = "EMPLOYEE" | "MANAGER" | "TECH_MANAGER" | "GM" | "HR";

/** Ranking used for permission checks. Higher outranks lower. */
export const ROLE_RANK: Record<UserRole, number> = {
  EMPLOYEE: 1,
  MANAGER: 2,
  HR: 3,
  TECH_MANAGER: 3,
  GM: 4,
};

export const ROLE_LABEL: Record<UserRole, string> = {
  EMPLOYEE: "Employee",
  MANAGER: "Direct Manager",
  TECH_MANAGER: "Technical Manager",
  GM: "General Manager",
  HR: "HR",
};

/** Roles that sit in the approval chain, in the order they approve. */
export const APPROVER_ROLES: UserRole[] = ["MANAGER", "TECH_MANAGER", "GM"];

export function isApprover(role: UserRole): boolean {
  return APPROVER_ROLES.includes(role);
}

// ─── Leave Types ───────────────────────────────────────────────────────────────

// Which entitlement pot a leave type draws from. A type with no bucket is not
// balance-limited: sick, maternity and unpaid leave are governed by statute or
// by separate approval, not by an annual allowance.
export type BalanceKey = "ANNUAL" | "CASUAL";

export const BALANCE_LABEL: Record<BalanceKey, string> = {
  ANNUAL: "Annual Leave",
  CASUAL: "Casual Leave",
};

/** Opening entitlements HR assigns to a new employee, in working days. */
export const DEFAULT_ENTITLEMENTS: Record<BalanceKey, number> = {
  ANNUAL: 14,
  CASUAL: 7,
};

/** Monthly permission allowance, in minutes. Four hours. */
export const DEFAULT_PERMISSION_MINUTES = 240;

/** Latest permitted check-in. A later check-in is deducted minute for minute. */
export const WORKDAY_START = "09:00";
export const WORKDAY_END = "17:00";

export interface LeaveTypeRecord {
  id: string;
  name: string;
  status: "ACTIVE" | "INACTIVE";
  balanceKey?: BalanceKey | null;
}

export const DEFAULT_LEAVE_TYPES: LeaveTypeRecord[] = [
  { id: "lt-1", name: "Annual Leave", status: "ACTIVE", balanceKey: "ANNUAL" },
  { id: "lt-2", name: "Sick Leave", status: "ACTIVE", balanceKey: null },
  { id: "lt-3", name: "Emergency Leave", status: "ACTIVE", balanceKey: "CASUAL" },
  { id: "lt-4", name: "Maternity Leave", status: "ACTIVE", balanceKey: null },
  { id: "lt-5", name: "Paternity Leave", status: "ACTIVE", balanceKey: null },
  { id: "lt-6", name: "Unpaid Leave", status: "ACTIVE", balanceKey: null },
];

// ─── Employee Profiles ────────────────────────────────────────────────────────
// Single source of truth. managerId drives My Team, request routing, and approval.

export interface EmployeeProfile {
  id: string;
  name: string;       // "Jordan Lee" — canonical display name
  firstName: string;
  lastName: string;
  position: string;
  department: string;
  email: string;
  phone?: string;
  status: "ACTIVE" | "INACTIVE";
  managerId: string | null;
  role: UserRole;
  /** Opening balances, in working days. HR sets these once, at creation. */
  entitlements: Record<BalanceKey, number>;
  /** Monthly permission allowance, in minutes. */
  permissionMinutesPerMonth: number;
}

export function empName(e: EmployeeProfile): string {
  return e.name;
}

export const DEPARTMENTS = [
  "IT",
  "Human Resources",
  "Finance",
  "Operations",
  "Sales",
  "Marketing",
] as const;
export type Department = (typeof DEPARTMENTS)[number];

export const DEFAULT_EMPLOYEES: EmployeeProfile[] = [
  { id: "EMP-00001", name: "Alex Morgan", firstName: "Alex", lastName: "Morgan", position: "Product Designer", department: "IT", email: "alex.morgan@company.com", phone: "+20 10 0000 0001", status: "ACTIVE", managerId: "EMP-00002", role: "EMPLOYEE", entitlements: { ANNUAL: 14, CASUAL: 7 }, permissionMinutesPerMonth: 240 },
  { id: "EMP-00002", name: "Jordan Lee", firstName: "Jordan", lastName: "Lee", position: "Engineering Manager", department: "IT", email: "jordan.lee@company.com", phone: "+20 10 0000 0002", status: "ACTIVE", managerId: "EMP-00008", role: "MANAGER", entitlements: { ANNUAL: 14, CASUAL: 7 }, permissionMinutesPerMonth: 240 },
  { id: "EMP-00003", name: "Riley Chen", firstName: "Riley", lastName: "Chen", position: "HR Specialist", department: "Human Resources", email: "riley.chen@company.com", phone: "+20 10 0000 0003", status: "ACTIVE", managerId: "EMP-00009", role: "HR", entitlements: { ANNUAL: 14, CASUAL: 7 }, permissionMinutesPerMonth: 240 },
  { id: "EMP-00004", name: "Nour Khalil", firstName: "Nour", lastName: "Khalil", position: "Frontend Developer", department: "IT", email: "nour.khalil@company.com", phone: "+20 10 0000 0004", status: "ACTIVE", managerId: "EMP-00002", role: "EMPLOYEE", entitlements: { ANNUAL: 14, CASUAL: 7 }, permissionMinutesPerMonth: 240 },
  { id: "EMP-00005", name: "Sami Hadid", firstName: "Sami", lastName: "Hadid", position: "Backend Developer", department: "IT", email: "sami.hadid@company.com", phone: "+20 10 0000 0005", status: "ACTIVE", managerId: "EMP-00002", role: "EMPLOYEE", entitlements: { ANNUAL: 14, CASUAL: 7 }, permissionMinutesPerMonth: 240 },
  { id: "EMP-00006", name: "Sara Mohamed", firstName: "Sara", lastName: "Mohamed", position: "Operations Manager", department: "Operations", email: "sara.mohamed@company.com", phone: "+20 10 0000 0006", status: "ACTIVE", managerId: "EMP-00008", role: "MANAGER", entitlements: { ANNUAL: 14, CASUAL: 7 }, permissionMinutesPerMonth: 240 },
  { id: "EMP-00007", name: "Omar Hassan", firstName: "Omar", lastName: "Hassan", position: "Operations Analyst", department: "Operations", email: "omar.hassan@company.com", phone: "+20 10 0000 0007", status: "ACTIVE", managerId: "EMP-00006", role: "EMPLOYEE", entitlements: { ANNUAL: 14, CASUAL: 7 }, permissionMinutesPerMonth: 240 },
  { id: "EMP-00008", name: "Khaled Nabil", firstName: "Khaled", lastName: "Nabil", position: "Technical Director", department: "Operations", email: "khaled.nabil@company.com", phone: "+20 10 0000 0008", status: "ACTIVE", managerId: "EMP-00009", role: "TECH_MANAGER", entitlements: { ANNUAL: 14, CASUAL: 7 }, permissionMinutesPerMonth: 240 },
  { id: "EMP-00009", name: "Hesham Fouad", firstName: "Hesham", lastName: "Fouad", position: "General Manager", department: "Operations", email: "hesham.fouad@company.com", phone: "+20 10 0000 0009", status: "ACTIVE", managerId: null, role: "GM", entitlements: { ANNUAL: 14, CASUAL: 7 }, permissionMinutesPerMonth: 240 },
  { id: "EMP-INACTIVE", name: "Sam Park", firstName: "Sam", lastName: "Park", position: "QA Engineer", department: "IT", email: "sam.park@company.com", status: "INACTIVE", managerId: "EMP-00002", role: "EMPLOYEE", entitlements: { ANNUAL: 14, CASUAL: 7 }, permissionMinutesPerMonth: 240 },
];

/** The single active Technical Manager. Everyone routes through this person. */
export function getTechManager(employees: EmployeeProfile[]): EmployeeProfile | null {
  return employees.find((e) => e.role === "TECH_MANAGER" && e.status === "ACTIVE") ?? null;
}

/** The single active General Manager — the final approver for every request. */
export function getGeneralManager(employees: EmployeeProfile[]): EmployeeProfile | null {
  return employees.find((e) => e.role === "GM" && e.status === "ACTIVE") ?? null;
}

// Security: managerId always comes from session, never from client input.
export function getTeamForManager(employees: EmployeeProfile[], managerId: string): EmployeeProfile[] {
  return employees.filter((e) => e.managerId === managerId);
}

export function getManagerForEmployee(
  employees: EmployeeProfile[],
  employeeId: string
): EmployeeProfile | null {
  const emp = employees.find((e) => e.id === employeeId);
  if (!emp?.managerId) return null;
  return employees.find((e) => e.id === emp.managerId) ?? null;
}

/**
 * Who HR may pick as someone's direct manager. Department managers report to
 * the technical manager, who reports to the GM, so all three approver roles are
 * eligible — not just MANAGER.
 */
export function getEligibleManagers(employees: EmployeeProfile[], excludeId?: string): EmployeeProfile[] {
  return employees.filter(
    (e) => isApprover(e.role) && e.status === "ACTIVE" && e.id !== excludeId
  );
}

// ─── Working calendar ─────────────────────────────────────────────────────────
// Egypt works Sunday to Thursday. Friday and Saturday are the weekend, so they
// never consume leave balance, and neither do public holidays.

/** JS getDay() values: 0 = Sunday ... 5 = Friday, 6 = Saturday. */
export const WEEKEND_DAYS = [5, 6];

export interface HolidayRecord {
  id: string;
  date: string; // YYYY-MM-DD
  name: string;
}

// Fixed-date Egyptian public holidays. Islamic dates move each year, so HR
// maintains this list in Settings rather than the app computing it.
export const DEFAULT_HOLIDAYS: HolidayRecord[] = [
  { id: "hol-1", date: "2026-01-07", name: "Coptic Christmas" },
  { id: "hol-2", date: "2026-01-25", name: "Revolution Day / Police Day" },
  { id: "hol-3", date: "2026-04-25", name: "Sinai Liberation Day" },
  { id: "hol-4", date: "2026-05-01", name: "Labour Day" },
  { id: "hol-5", date: "2026-06-30", name: "June 30 Revolution" },
  { id: "hol-6", date: "2026-07-23", name: "Revolution Day" },
  { id: "hol-7", date: "2026-10-06", name: "Armed Forces Day" },
];

function parseISODate(value: string): Date | null {
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function toISODate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function isWorkingDay(dateStr: string, holidays: HolidayRecord[]): boolean {
  const date = parseISODate(dateStr);
  if (!date) return false;
  if (WEEKEND_DAYS.includes(date.getDay())) return false;
  return !holidays.some((h) => h.date === dateStr.slice(0, 10));
}

/**
 * Working days between two dates, inclusive of both ends. This is the unit the
 * 14-day and 7-day entitlements are measured in — a Thursday-to-Sunday leave
 * costs two days, not four.
 */
export function countWorkingDays(
  startDate: string,
  endDate: string,
  holidays: HolidayRecord[]
): number {
  const start = parseISODate(startDate);
  const end = parseISODate(endDate);
  if (!start || !end || end < start) return 0;

  let count = 0;
  const cursor = new Date(start);
  // Bounded so a malformed range cannot spin forever.
  for (let guard = 0; guard < 366 * 3 && cursor <= end; guard++) {
    if (isWorkingDay(toISODate(cursor), holidays)) count++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

// ─── Attendance ───────────────────────────────────────────────────────────────
// Recorded by HR from the fingerprint device. Lateness and early departure are
// converted to minutes and charged against the monthly permission allowance.

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  date: string;       // YYYY-MM-DD
  checkIn?: string;   // HH:MM
  checkOut?: string;  // HH:MM
  note?: string;
  recordedBy: string;
  recordedAt: string;
}

export function minutesOfDay(time: string): number {
  const [h, m] = time.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

export function formatMinutes(total: number): string {
  const sign = total < 0 ? "-" : "";
  const abs = Math.abs(Math.round(total));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (h === 0) return `${sign}${m}m`;
  if (m === 0) return `${sign}${h}h`;
  return `${sign}${h}h ${m}m`;
}

/** Minutes late past WORKDAY_START. Clock in at 09:04 and this returns 4. */
export function lateMinutes(record: AttendanceRecord): number {
  if (!record.checkIn) return 0;
  return Math.max(0, minutesOfDay(record.checkIn) - minutesOfDay(WORKDAY_START));
}

/** Minutes left before WORKDAY_END. */
export function earlyLeaveMinutes(record: AttendanceRecord): number {
  if (!record.checkOut) return 0;
  return Math.max(0, minutesOfDay(WORKDAY_END) - minutesOfDay(record.checkOut));
}

/** "2026-09" — the bucket a date belongs to. Allowances reset every month. */
export function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7);
}

export function currentMonthKey(now: Date): string {
  return toISODate(now).slice(0, 7);
}

// ─── Request Records ──────────────────────────────────────────────────────────

// ─── Approval chain ───────────────────────────────────────────────────────────

export interface ApprovalStep {
  stage: number;                 // 1, 2, 3 — the order the step is decided in
  role: UserRole;                // MANAGER | TECH_MANAGER | GM
  title: string;                 // "Direct Manager", "Technical Manager", ...
  approverId: string;
  approverName: string;
  status: RequestStatus;
  decidedAt?: string;
  comment?: string;
}

/**
 * Builds the approval chain for one employee: direct manager, then the
 * technical manager, then the general manager.
 *
 * Two rules keep the chain sane in a small organisation:
 *   - the requester is never their own approver, and
 *   - a person who appears twice (a department manager whose own direct
 *     manager IS the technical manager, for example) is only asked once.
 *
 * Inactive approvers are dropped rather than blocking the request; the caller
 * decides what to do with an empty chain.
 */
export function buildApprovalChain(
  employees: EmployeeProfile[],
  employeeId: string
): ApprovalStep[] {
  const directManager = getManagerForEmployee(employees, employeeId);
  const candidates: Array<{ role: UserRole; person: EmployeeProfile | null }> = [
    { role: "MANAGER", person: directManager },
    { role: "TECH_MANAGER", person: getTechManager(employees) },
    { role: "GM", person: getGeneralManager(employees) },
  ];

  const chain: ApprovalStep[] = [];
  const seen = new Set<string>([employeeId]);

  for (const { person } of candidates) {
    if (!person || person.status !== "ACTIVE" || seen.has(person.id)) continue;
    seen.add(person.id);
    // Label the step by the approver's real role, not by the slot they happen
    // to fill. A department manager reports to the technical manager, so that
    // person occupies slot 1 of the manager's own chain — calling them
    // "Direct Manager" there would misname them everywhere it is displayed.
    chain.push({
      stage: chain.length + 1,
      role: person.role,
      title: ROLE_LABEL[person.role],
      approverId: person.id,
      approverName: person.name,
      status: "PENDING",
    });
  }

  return chain;
}

/** The step currently awaiting a decision, or null when the request is closed. */
export function currentStep(request: RequestRecord): ApprovalStep | null {
  if (request.status !== "PENDING") return null;
  return request.approvals.find((a) => a.status === "PENDING") ?? null;
}

/** True when this user is the person the request is waiting on right now. */
export function awaitsDecisionBy(request: RequestRecord, userId: string): boolean {
  return currentStep(request)?.approverId === userId;
}

/** True when this user appears anywhere in the chain — past, present or future. */
export function involvesApprover(request: RequestRecord, userId: string): boolean {
  return request.approvals.some((a) => a.approverId === userId);
}

/** Short progress label, e.g. "Stage 2 of 3 — Technical Manager". */
export function stageLabel(request: RequestRecord): string {
  const step = currentStep(request);
  if (!step) return request.status === "APPROVED" ? "Fully approved" : "Closed";
  return `Stage ${step.stage} of ${request.approvals.length} — ${step.title}`;
}

export interface RequestRecord {
  id: string;
  requestNumber: string;
  employeeId: string;
  employeeName: string;
  /** Stage-1 approver, snapshotted at creation. Kept for display and filters. */
  managerId: string;
  managerName: string;
  /** The full three-stage chain, snapshotted at creation. */
  approvals: ApprovalStep[];
  type: RequestType;
  status: RequestStatus;
  submittedAt: string; // ISO
  leaveType?: string;  // stored string (leave type name at time of request)
  /** Which entitlement the leave was charged to, snapshotted at creation. */
  balanceKey?: BalanceKey | null;
  /** Working days this leave consumes, snapshotted so the calendar can change. */
  workingDays?: number;
  /** Permission fields. */
  permissionKind?: PermissionKind;
  permissionMinutes?: number;
  startDate?: string;  // YYYY-MM-DD
  endDate?: string;
  reason?: string;
  startTime?: string;  // HH:MM
  endTime?: string;
  location?: string;
  purpose?: string;
  decidedAt?: string;
  decisionComment?: string;
}

export interface NotificationRecord {
  id: string;
  userId: string;
  type: "REQUEST_SUBMITTED" | "REQUEST_ADVANCED" | "REQUEST_APPROVED" | "REQUEST_REJECTED";
  requestId: string;
  message: string;
  read: boolean;
  createdAt: string;
}

// ─── Balances ─────────────────────────────────────────────────────────────────
// A pending request HOLDS balance and an approved one CONSUMES it. Holding
// matters: without it an employee could submit five overlapping requests that
// each look affordable on their own and blow the entitlement once approved.

export interface LeaveBalance {
  key: BalanceKey;
  label: string;
  entitlement: number;
  used: number;      // approved
  held: number;      // pending, not yet decided
  available: number; // what can still be requested
}

export function getLeaveBalance(
  employee: EmployeeProfile,
  requests: RequestRecord[],
  key: BalanceKey
): LeaveBalance {
  const entitlement = employee.entitlements?.[key] ?? DEFAULT_ENTITLEMENTS[key];

  const mine = requests.filter(
    (r) => r.employeeId === employee.id && r.type === "LEAVE" && r.balanceKey === key
  );

  const sumDays = (list: RequestRecord[]) =>
    list.reduce((total, r) => total + (r.workingDays ?? 0), 0);

  const used = sumDays(mine.filter((r) => r.status === "APPROVED"));
  const held = sumDays(mine.filter((r) => r.status === "PENDING"));

  return {
    key,
    label: BALANCE_LABEL[key],
    entitlement,
    used,
    held,
    available: Math.max(0, entitlement - used - held),
  };
}

export function getAllLeaveBalances(
  employee: EmployeeProfile,
  requests: RequestRecord[]
): LeaveBalance[] {
  return (Object.keys(BALANCE_LABEL) as BalanceKey[]).map((key) =>
    getLeaveBalance(employee, requests, key)
  );
}

export interface PermissionBalance {
  month: string;
  allowance: number;
  /** Charged automatically from the fingerprint record. */
  fromAttendance: number;
  /** Charged from approved late-arrival / early-departure requests. */
  fromRequests: number;
  held: number;
  used: number;
  available: number;
}

/**
 * Minutes already excused by an approved permission on a given date. Lateness
 * covered by a permission the employee actually asked for is not charged twice.
 */
function approvedPermissionMinutesOn(
  requests: RequestRecord[],
  employeeId: string,
  date: string
): number {
  return requests
    .filter(
      (r) =>
        r.employeeId === employeeId &&
        r.type === "PERMISSION" &&
        r.status === "APPROVED" &&
        r.startDate === date
    )
    .reduce((total, r) => total + (r.permissionMinutes ?? 0), 0);
}

export function getPermissionBalance(
  employee: EmployeeProfile,
  requests: RequestRecord[],
  attendance: AttendanceRecord[],
  month: string
): PermissionBalance {
  const allowance = employee.permissionMinutesPerMonth ?? DEFAULT_PERMISSION_MINUTES;

  const fromAttendance = attendance
    .filter((a) => a.employeeId === employee.id && monthKey(a.date) === month)
    .reduce((total, record) => {
      const raw = lateMinutes(record) + earlyLeaveMinutes(record);
      const excused = approvedPermissionMinutesOn(requests, employee.id, record.date);
      return total + Math.max(0, raw - excused);
    }, 0);

  const permissions = requests.filter(
    (r) =>
      r.employeeId === employee.id &&
      r.type === "PERMISSION" &&
      r.startDate &&
      monthKey(r.startDate) === month
  );

  const sumMinutes = (list: RequestRecord[]) =>
    list.reduce((total, r) => total + (r.permissionMinutes ?? 0), 0);

  const fromRequests = sumMinutes(permissions.filter((r) => r.status === "APPROVED"));
  const held = sumMinutes(permissions.filter((r) => r.status === "PENDING"));
  const used = fromAttendance + fromRequests;

  return {
    month,
    allowance,
    fromAttendance,
    fromRequests,
    held,
    used,
    available: Math.max(0, allowance - used - held),
  };
}

// ─── Store Data ───────────────────────────────────────────────────────────────

export interface StoreData {
  requests: RequestRecord[];
  notifications: NotificationRecord[];
  employees: EmployeeProfile[];
  leaveTypes: LeaveTypeRecord[];
  attendance: AttendanceRecord[];
  holidays: HolidayRecord[];
  nextSeq: number;
  nextEmpSeq: number;
  nextLeaveTypeSeq: number;
  nextHolidaySeq: number;
}

// ─── Persistence ──────────────────────────────────────────────────────────────

// localStorage, not sessionStorage. In this build the store plays the role of
// the shared server database: it must survive a refresh, and a request created
// by an employee must still be there when their manager signs in afterwards.
// sessionStorage is per-tab and cleared on close, which made the whole
// submit → approve → notify loop impossible to observe.
// v3: three-stage approval chain, plus the TECH_MANAGER and GM roles. Records
// written by v2 have no `approvals` array and no chain above the direct
// manager, so the key is bumped rather than migrated — old data would produce
// requests that can never reach a final decision.
const STORE_KEY = "hr_portal_store_v4";

export function loadStore(): StoreData {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const data = JSON.parse(raw) as StoreData;
      if (!data.employees) data.employees = DEFAULT_EMPLOYEES;
      if (!data.leaveTypes) data.leaveTypes = DEFAULT_LEAVE_TYPES;
      if (!data.attendance) data.attendance = [];
      if (!data.holidays) data.holidays = DEFAULT_HOLIDAYS;
      if (!data.nextEmpSeq) data.nextEmpSeq = 10;
      if (!data.nextLeaveTypeSeq) data.nextLeaveTypeSeq = 7;
      if (!data.nextHolidaySeq) data.nextHolidaySeq = DEFAULT_HOLIDAYS.length + 1;
      return data;
    }
  } catch {}
  return {
    requests: [],
    notifications: [],
    employees: DEFAULT_EMPLOYEES,
    leaveTypes: DEFAULT_LEAVE_TYPES,
    attendance: [],
    holidays: DEFAULT_HOLIDAYS,
    nextSeq: 1,
    nextEmpSeq: 10,
    nextLeaveTypeSeq: 7,
    nextHolidaySeq: DEFAULT_HOLIDAYS.length + 1,
  };
}

export function saveStore(data: StoreData): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(data));
  } catch {}
}

// ─── Hierarchy integrity ──────────────────────────────────────────────────────

/**
 * Walks up from `managerId` to see whether it eventually reports back to
 * `employeeId`. Assigning that manager would close a loop, which would hang any
 * recursive org-chart traversal. Also guards against a corrupt pre-existing
 * cycle by bounding the walk to the number of employees.
 */
export function wouldCreateCycle(
  employees: EmployeeProfile[],
  employeeId: string,
  managerId: string | null
): boolean {
  if (!managerId) return false;
  if (managerId === employeeId) return true;

  let cursor: string | null = managerId;
  for (let steps = 0; steps <= employees.length && cursor; steps++) {
    if (cursor === employeeId) return true;
    cursor = employees.find((e) => e.id === cursor)?.managerId ?? null;
  }

  return false;
}

// ─── Employee creation validation ─────────────────────────────────────────────

export function validateEmployeeFields(
  data: {
    firstName?: string;
    lastName?: string;
    email?: string;
    position?: string;
    department?: string;
    role?: string;
    managerId?: string | null;
    status?: string;
  },
  employees: EmployeeProfile[],
  editingId?: string
): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!data.firstName?.trim()) errors.firstName = "First name is required.";
  if (!data.lastName?.trim()) errors.lastName = "Last name is required.";
  if (!data.email?.trim()) {
    errors.email = "Email is required.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.email = "Enter a valid email address.";
  } else {
    const dup = employees.find(
      (e) => e.email.toLowerCase() === data.email!.toLowerCase() && e.id !== editingId
    );
    if (dup) errors.email = "This email is already in use.";
  }
  if (!data.position?.trim()) errors.position = "Position is required.";
  if (!data.department?.trim()) errors.department = "Department is required.";
  if (!data.role) errors.role = "Role is required.";

  if (data.role === "EMPLOYEE" && !data.managerId) {
    errors.managerId = "A direct manager is required for employees.";
  }

  // The manager dropdown is populated from active managers, but the value still
  // has to be re-checked here: it can go stale while the form is open, and edit
  // mode can carry a manager who has since been demoted or deactivated.
  if (data.managerId) {
    const manager = employees.find((e) => e.id === data.managerId);

    if (!manager) {
      errors.managerId = "Selected manager no longer exists.";
    } else if (editingId && data.managerId === editingId) {
      errors.managerId = "An employee cannot be their own manager.";
    } else if (!isApprover(manager.role)) {
      errors.managerId = `${manager.name} is not in the management chain. Choose another.`;
    } else if (manager.status !== "ACTIVE") {
      errors.managerId = `${manager.name} is inactive and cannot be assigned as a manager.`;
    } else if (editingId && wouldCreateCycle(employees, editingId, data.managerId)) {
      errors.managerId = `${manager.name} reports to this employee. That would create a reporting loop.`;
    }
  }

  // Demoting or deactivating a manager who still has direct reports used to
  // succeed silently, orphaning the team and freezing their pending requests
  // with no way out. Surface the conflict to HR instead (hr-admin-v1 §9).
  if (editingId) {
    const current = employees.find((e) => e.id === editingId);
    const reports = employees.filter((e) => e.managerId === editingId);

    if (current && isApprover(current.role) && reports.length > 0) {
      const who = `${reports.length} employee${reports.length === 1 ? "" : "s"}`;

      if (data.role && !isApprover(data.role as UserRole)) {
        errors.role = `${who} still report to this manager. Reassign them before changing the role.`;
      } else if (data.status === "INACTIVE") {
        errors.status = `${who} still report to this manager. Reassign them before deactivating.`;
      }
    }
  }

  return errors;
}

// ─── Request validation ────────────────────────────────────────────────────────

export function validateLeaveFields(
  data: { leaveType?: string; startDate?: string; endDate?: string },
  existingRequests: RequestRecord[],
  activeLeaveTypes: LeaveTypeRecord[],
  /** Omit to skip the balance check — the form calls it with both. */
  balanceContext?: { employee: EmployeeProfile; allRequests: RequestRecord[]; holidays: HolidayRecord[] }
): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!data.leaveType) {
    errors.leaveType = "Leave Type is required.";
  } else if (!activeLeaveTypes.some((lt) => lt.name === data.leaveType && lt.status === "ACTIVE")) {
    errors.leaveType = "Selected leave type is not available.";
  }
  if (!data.startDate) errors.startDate = "Start Date is required.";
  if (!data.endDate) errors.endDate = "End Date is required.";

  if (data.startDate && data.endDate && data.endDate < data.startDate) {
    errors.endDate = "End Date cannot be before Start Date.";
  }

  if (data.startDate && data.endDate && !errors.startDate && !errors.endDate) {
    const conflict = existingRequests.find(
      (r) =>
        r.type === "LEAVE" &&
        (r.status === "PENDING" || r.status === "APPROVED") &&
        data.startDate! <= r.endDate! &&
        data.endDate! >= r.startDate!
    );
    if (conflict) {
      errors.startDate = `Dates overlap with existing request ${conflict.requestNumber}.`;
    }
  }

  // Balance check. Runs last so a date error is reported before an affordability
  // error the employee cannot act on yet.
  if (balanceContext && data.leaveType && data.startDate && data.endDate && !errors.startDate && !errors.endDate) {
    const type = activeLeaveTypes.find((lt) => lt.name === data.leaveType);
    const key = type?.balanceKey ?? null;

    if (key) {
      const days = countWorkingDays(data.startDate, data.endDate, balanceContext.holidays);

      if (days === 0) {
        errors.startDate = "That range contains no working days. Weekends and public holidays do not count.";
      } else {
        const balance = getLeaveBalance(balanceContext.employee, balanceContext.allRequests, key);
        if (days > balance.available) {
          const held = balance.held > 0 ? ` (${balance.held} more ${balance.held === 1 ? "day is" : "days are"} awaiting approval)` : "";
          errors.leaveType =
            balance.available === 0
              ? `Your ${balance.label.toLowerCase()} balance is exhausted${held}. You cannot request more.`
              : `That is ${days} working ${days === 1 ? "day" : "days"}, but only ${balance.available} of your ${balance.label.toLowerCase()} ${balance.available === 1 ? "day remains" : "days remain"}${held}.`;
        }
      }
    }
  }

  return errors;
}

// ─── Permission validation ────────────────────────────────────────────────────

export function validatePermissionFields(
  data: { permissionKind?: string; date?: string; minutes?: number },
  balanceContext: { employee: EmployeeProfile; allRequests: RequestRecord[]; attendance: AttendanceRecord[]; holidays: HolidayRecord[] }
): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!data.permissionKind) errors.permissionKind = "Choose late arrival or early departure.";
  if (!data.date) errors.date = "Date is required.";

  if (!data.minutes || data.minutes <= 0) {
    errors.minutes = "Enter how many minutes you need.";
  } else if (data.minutes > 240) {
    errors.minutes = "A single permission cannot exceed 240 minutes.";
  }

  if (data.date && !errors.date) {
    if (!isWorkingDay(data.date, balanceContext.holidays)) {
      errors.date = "That day is a weekend or a public holiday.";
    } else if (
      balanceContext.allRequests.some(
        (r) =>
          r.employeeId === balanceContext.employee.id &&
          r.type === "PERMISSION" &&
          (r.status === "PENDING" || r.status === "APPROVED") &&
          r.startDate === data.date
      )
    ) {
      errors.date = "You already have a permission for that day.";
    }
  }

  if (data.minutes && data.minutes > 0 && data.date && !errors.date && !errors.minutes) {
    const balance = getPermissionBalance(
      balanceContext.employee,
      balanceContext.allRequests,
      balanceContext.attendance,
      monthKey(data.date)
    );

    if (balance.available <= 0) {
      errors.minutes = `Your permission allowance for ${data.date.slice(0, 7)} is used up. You cannot request more this month.`;
    } else if (data.minutes > balance.available) {
      errors.minutes = `Only ${formatMinutes(balance.available)} of your monthly permission allowance remains.`;
    }
  }

  return errors;
}

export function validateMissionFields(data: {
  startDate?: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
  location?: string;
  purpose?: string;
}): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!data.startDate) errors.startDate = "Start Date is required.";
  if (!data.startTime) errors.startTime = "Start Time is required.";
  if (!data.endDate) errors.endDate = "End Date is required.";
  if (!data.endTime) errors.endTime = "End Time is required.";
  if (!data.location?.trim()) errors.location = "Location is required.";
  if (!data.purpose?.trim()) errors.purpose = "Purpose is required.";

  if (
    data.startDate && data.startTime && data.endDate && data.endTime &&
    !errors.startDate && !errors.startTime && !errors.endDate && !errors.endTime
  ) {
    const start = new Date(`${data.startDate}T${data.startTime}`);
    const end = new Date(`${data.endDate}T${data.endTime}`);
    if (end <= start) errors.endTime = "End date/time must be after Start date/time.";
  }

  return errors;
}
