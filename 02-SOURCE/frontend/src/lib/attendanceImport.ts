// Attendance Excel import — parsing only. No Supabase calls, no React,
// no knowledge of the selected employee: this module turns a fingerprint
// device export (.xls/.xlsx) into typed rows and hands the accounting
// question (what does this mean for this employee's Permission balance)
// back to the caller. Kept separate from App.tsx so the parsing logic can
// be reasoned about — and unit-tested — on its own.
//
// Uses the SheetJS `xlsx` package (see package.json — installed from
// SheetJS's own CDN, not the npm registry, because the npm-registry
// version has unpatched vulnerabilities SheetJS only fixes on their CDN
// builds). `.xls` (legacy BIFF) and `.xlsx` (OOXML) are both handled by
// the same `XLSX.read` call — SheetJS auto-detects the format from the
// file's bytes.
import * as XLSX from "xlsx";

export interface ParsedAttendanceRow {
  date: string; // YYYY-MM-DD
  clockIn: string | null; // HH:MM — display only, never used for accounting
  clockOut: string | null; // HH:MM — display only, never used for accounting
  /** Minutes late, taken verbatim from the file's own "Late" column — never re-derived from Clock In. */
  lateMinutes: number;
  /** Minutes left early, taken verbatim from the file's own "Early" column — never re-derived from Clock Out. */
  earlyMinutes: number;
  /** From "OT Time" — display/summary only. Never deducted from Permission. */
  overtimeMinutes: number;
  /** From "Absent" — display/summary only. Never deducted from Permission. */
  isAbsent: boolean;
}

export interface AttendanceRowError {
  /** 1-based row number as it appears in the source file's data rows (header excluded), for a message a non-technical HR user can act on. */
  row: number;
  message: string;
}

export type AttendanceParseResult =
  | {
      ok: true;
      rows: ParsedAttendanceRow[];
      invalidRows: AttendanceRowError[];
      /** The file's own "Name" column value (first non-blank occurrence), for the employee-mismatch check. Null if the column is absent or every row is blank. */
      detectedName: string | null;
    }
  | { ok: false; error: string };

const REQUIRED_COLUMNS = ["date", "clockin", "clockout", "late", "early"] as const;
const MISSING_COLUMNS_MESSAGE =
  "Unsupported attendance format. Required columns are Date, Clock In, Clock Out, Late and Early.";

function normalizeHeader(cell: unknown): string {
  return String(cell ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

const HEADER_ALIASES: Record<string, string> = {
  date: "date",
  clockin: "clockin",
  clockout: "clockout",
  late: "late",
  early: "early",
  absent: "absent",
  ottime: "overtime",
  name: "name",
};

/** Scans the first few rows for the header row (title/logo rows sometimes precede it in real exports). */
function findHeaderRow(rows: unknown[][]): { headerIndex: number; columns: Map<string, number> } | null {
  const scanLimit = Math.min(rows.length, 10);
  for (let i = 0; i < scanLimit; i++) {
    const row = rows[i];
    if (!row) continue;
    const columns = new Map<string, number>();
    row.forEach((cell, colIndex) => {
      const norm = normalizeHeader(cell);
      const key = HEADER_ALIASES[norm];
      if (key && !columns.has(key)) columns.set(key, colIndex);
    });
    if (REQUIRED_COLUMNS.every((c) => columns.has(HEADER_ALIASES[c] ?? c))) {
      return { headerIndex: i, columns };
    }
  }
  return null;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** y/m/d -> "YYYY-MM-DD", validated via UTC-only Date arithmetic so no timezone shift can ever move the calendar day. */
function toIsoDate(y: number, m: number, d: number): string | null {
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  const check = new Date(Date.UTC(y, m - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) return null;
  return `${String(y).padStart(4, "0")}-${pad2(m)}-${pad2(d)}`;
}

/** Excel serial date (days since 1899-12-30) -> calendar y/m/d, via SheetJS's own date-code parser — pure arithmetic, no Date/UTC/local conversion, so it can never shift by a timezone. */
function isoDateFromSerial(serial: number): string | null {
  const parsed = XLSX.SSF.parse_date_code(serial);
  if (!parsed) return null;
  return toIsoDate(parsed.y, parsed.m, parsed.d);
}

function isoDateFromString(raw: string): string | null {
  const s = raw.trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (m) return toIsoDate(Number(m[1]), Number(m[2]), Number(m[3]));
  // DD/MM/YYYY or DD-MM-YYYY — the export's own locale (confirmed by dates
  // like 25/08 and 31/08 in the documented fixture, which are impossible
  // as a month, so day-first is the only valid reading).
  m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(s);
  if (m) return toIsoDate(Number(m[3]), Number(m[2]), Number(m[1]));
  return null;
}

function readDateCell(cell: unknown): string | null {
  if (cell === null || cell === undefined || cell === "") return null;
  if (typeof cell === "number") return isoDateFromSerial(cell);
  if (cell instanceof Date) {
    // Only reachable if a caller passes cellDates-parsed input; read via
    // UTC getters exclusively so no local-timezone conversion can occur.
    return toIsoDate(cell.getUTCFullYear(), cell.getUTCMonth() + 1, cell.getUTCDate());
  }
  return isoDateFromString(String(cell));
}

/** Duration/time-of-day cell -> whole minutes. Handles a literal "HH:MM[:SS]" string, an Excel time-fraction serial, and blank/"-" as zero. Returns null (not zero) when the cell has non-blank content that still couldn't be read, so the caller can tell "no lateness" apart from "malformed cell." */
function readMinutesCell(cell: unknown): number | null {
  if (cell === null || cell === undefined) return 0;
  if (typeof cell === "number") {
    if (!Number.isFinite(cell)) return null;
    // Fractional part only: safe whether the cell is a pure time fraction
    // (0 <= v < 1) or a full date+time serial with an integer date part.
    const frac = cell - Math.floor(cell);
    return Math.round(frac * 24 * 60);
  }
  const s = String(cell).trim();
  if (s === "" || s === "-" || s === "--") return 0;
  const hm = /^(\d{1,3}):(\d{2})(?::(\d{2}))?$/.exec(s);
  if (hm) {
    const h = Number(hm[1]);
    const min = Number(hm[2]);
    const sec = hm[3] ? Number(hm[3]) : 0;
    return h * 60 + min + Math.round(sec / 60);
  }
  const asNumber = Number(s);
  if (Number.isFinite(asNumber) && s !== "") {
    const frac = asNumber - Math.floor(asNumber);
    return Math.round(frac * 24 * 60);
  }
  return null;
}

function minutesToHHMM(minutes: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, minutes));
  return `${pad2(Math.floor(clamped / 60))}:${pad2(clamped % 60)}`;
}

function readClockCell(cell: unknown): string | null {
  const minutes = readMinutesCell(cell);
  if (minutes === null) return null;
  if (cell === null || cell === undefined || String(cell).trim() === "" || String(cell).trim() === "-") return null;
  return minutesToHHMM(minutes);
}

function readAbsentCell(cell: unknown): boolean {
  const s = String(cell ?? "").trim().toLowerCase();
  if (s === "") return false;
  return ["absent", "a", "yes", "y", "true", "1"].includes(s);
}

export function parseAttendanceWorkbook(buffer: ArrayBuffer): AttendanceParseResult {
  let rows: unknown[][];
  try {
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return { ok: false, error: "This file has no sheets to read." };
    const sheet = workbook.Sheets[sheetName];
    rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: "" });
  } catch {
    return { ok: false, error: "Could not read this file. Please make sure it's a valid .xls or .xlsx attendance export." };
  }

  const header = findHeaderRow(rows);
  if (!header) return { ok: false, error: MISSING_COLUMNS_MESSAGE };
  const { headerIndex, columns } = header;

  const parsedRows: ParsedAttendanceRow[] = [];
  const invalidRows: AttendanceRowError[] = [];
  let detectedName: string | null = null;

  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    const dataRowNumber = i - headerIndex;
    if (!row || row.every((cell) => cell === "" || cell === null || cell === undefined)) continue;

    const get = (key: string) => (columns.has(key) ? row[columns.get(key)!] : undefined);

    const date = readDateCell(get("date"));
    if (!date) {
      invalidRows.push({ row: dataRowNumber, message: `Row ${dataRowNumber}: missing or unreadable Date.` });
      continue;
    }

    const lateMinutes = readMinutesCell(get("late"));
    if (lateMinutes === null) {
      invalidRows.push({ row: dataRowNumber, message: `Row ${dataRowNumber} (${date}): the Late column could not be read.` });
      continue;
    }
    const earlyMinutes = readMinutesCell(get("early"));
    if (earlyMinutes === null) {
      invalidRows.push({ row: dataRowNumber, message: `Row ${dataRowNumber} (${date}): the Early column could not be read.` });
      continue;
    }

    const overtimeRaw = columns.has("overtime") ? readMinutesCell(get("overtime")) : 0;
    const overtimeMinutes = overtimeRaw ?? 0;
    const isAbsent = columns.has("absent") ? readAbsentCell(get("absent")) : false;

    if (!detectedName && columns.has("name")) {
      const nameCell = String(get("name") ?? "").trim();
      if (nameCell) detectedName = nameCell;
    }

    parsedRows.push({
      date,
      clockIn: readClockCell(get("clockin")),
      clockOut: readClockCell(get("clockout")),
      lateMinutes,
      earlyMinutes,
      overtimeMinutes,
      isAbsent,
    });
  }

  return { ok: true, rows: parsedRows, invalidRows, detectedName };
}

/** Case/whitespace-insensitive comparison for the non-blocking mismatch warning. Selected employee ID always wins regardless of this result — see HRAttendancePage. */
export function namesLikelyMismatch(selectedName: string, detectedName: string | null): boolean {
  if (!detectedName) return false;
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  return norm(selectedName) !== norm(detectedName);
}
