import React, {
  useState,
  useRef,
  useId,
  useContext,
  createContext,
  useCallback,
  useEffect,
} from "react";
import {
  RouterProvider,
  createBrowserRouter,
  createHashRouter,
  Navigate,
  Outlet,
  useNavigate,
  useParams,
  useLocation,
} from "react-router";
import {
  getManagerForEmployee,
  validateLeaveFields,
  validateMissionFields,
  validateEmployeeFields,
  loadStore,
  saveStore,
  getTeamForManager,
  getEligibleManagers,
  buildApprovalChain,
  currentStep,
  awaitsDecisionBy,
  involvesApprover,
  stageLabel,
  canEmployeeDeleteRequest,
  isApprover,
  ROLE_LABEL,
  BALANCE_LABEL,
  DEFAULT_ENTITLEMENTS,
  DEFAULT_PERMISSION_MINUTES,
  PERMISSION_LABEL,
  WEEKEND_DAYS,
  WORKDAY_START,
  WORKDAY_END,
  countWorkingDays,
  isWorkingDay,
  toISODate,
  monthKey,
  currentMonthKey,
  formatMinutes,
  minutesOfDay,
  lateMinutes,
  earlyLeaveMinutes,
  getLeaveBalance,
  getAllLeaveBalances,
  getPermissionBalance,
  validatePermissionFields,
  empName,
  DEPARTMENTS,
  DEFAULT_LEAVE_TYPES,
} from "../lib/store";
import type {
  ApprovalStep,
  AttendanceRecord,
  BalanceKey,
  HolidayRecord,
  LeaveBalance,
  PermissionKind,
  RequestRecord,
  NotificationRecord,
  StoreData,
  EmployeeProfile,
  LeaveTypeRecord,
  UserRole,
  DepartmentRecord,
  RequestStatus,
  RequestType,
} from "../lib/store";
import {
  signIn as authSignIn,
  getSession,
  restoreSupabaseSession,
  signOut as authSignOut,
  dashboardPath,
  createHRUserCredential,
  updateHRUserCredential,
  subscribeToAuthChanges,
  provisionEmployeeAccount,
  changePassword,
  adminUpdateEmployeePassword,
} from "../lib/auth";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { parseAttendanceWorkbook, namesLikelyMismatch } from "../lib/attendanceImport";
import type { ParsedAttendanceRow, AttendanceRowError } from "../lib/attendanceImport";
import companyLogoSrc from "../imports/GEO_Egypt_LOGO-01.png";
import type { Session } from "../lib/auth";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { Eye, EyeOff, Loader as Loader2, CircleAlert as AlertCircle, CircleCheck as CheckCircle2, Bell, ChevronDown, House as Home, FileText, Users, Settings, LogOut, Menu, X, User, Search, Calendar, Clock, Upload, EllipsisVertical as MoreVertical, Info, Plus, ArrowLeft, ChevronRight, ChevronLeft, Briefcase, Umbrella, Check, CircleX as XCircle, BellRing, CalendarDays } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

// UserRole was previously re-declared here while also being imported from
// store.ts — a TS2440 duplicate-identifier error that shipped because the
// project had no typechecker. store.ts owns the type; re-export it.
export type { UserRole, RequestStatus, RequestType } from "../lib/store";
export type AccountStatus = "ACTIVE" | "INACTIVE";

type LoginState =
  | "idle"
  | "loading"
  | "success"
  | "invalid_credentials"
  | "inactive_account"
  | "system_error";

type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
type ButtonSize = "sm" | "md" | "lg";
type BadgeVariant = "pending" | "approved" | "rejected" | "active" | "inactive";
type AlertVariant = "error" | "success" | "warning" | "info";

// ═══════════════════════════════════════════════════════════════════════════════
// LOGO
// Note: Official company logo not supplied. SVG is a geometric placeholder.
// Replace the SVG paths with the official logo artwork when provided.
// ═══════════════════════════════════════════════════════════════════════════════

interface LogoMarkProps {
  size?: number;
  variant?: "light" | "dark";
  className?: string;
}

export function LogoMark({
  size = 40,
  variant = "light",
  className,
}: LogoMarkProps) {
  if (variant === "dark") {
    // For use on light/white backgrounds
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        aria-hidden="true"
        className={className}
      >
        <rect width="40" height="40" rx="9" className="fill-accent" />
        <rect x="16" y="8" width="8" height="7" rx="1.5" className="fill-primary" />
        <rect
          x="19.5"
          y="15"
          width="1"
          height="5"
          className="fill-primary opacity-40"
        />
        <rect
          x="12"
          y="20"
          width="16"
          height="1"
          className="fill-primary opacity-40"
        />
        <rect
          x="12"
          y="20"
          width="1"
          height="5"
          className="fill-primary opacity-40"
        />
        <rect
          x="27"
          y="20"
          width="1"
          height="5"
          className="fill-primary opacity-40"
        />
        <rect x="8" y="25" width="8" height="7" rx="1.5" className="fill-primary" />
        <rect
          x="24"
          y="25"
          width="8"
          height="7"
          rx="1.5"
          className="fill-primary"
        />
      </svg>
    );
  }

  // Light version — for use on the dark primary background
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <rect
        width="40"
        height="40"
        rx="9"
        fill="white"
        fillOpacity="0.12"
      />
      <rect x="16" y="8" width="8" height="7" rx="1.5" fill="white" />
      <rect
        x="19.5"
        y="15"
        width="1"
        height="5"
        fill="white"
        fillOpacity="0.55"
      />
      <rect
        x="12"
        y="20"
        width="16"
        height="1"
        fill="white"
        fillOpacity="0.55"
      />
      <rect
        x="12"
        y="20"
        width="1"
        height="5"
        fill="white"
        fillOpacity="0.55"
      />
      <rect
        x="27"
        y="20"
        width="1"
        height="5"
        fill="white"
        fillOpacity="0.55"
      />
      <rect x="8" y="25" width="8" height="7" rx="1.5" fill="white" />
      <rect x="24" y="25" width="8" height="7" rx="1.5" fill="white" />
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// BASE COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Button ─────────────────────────────────────────────────────────────────

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children?: React.ReactNode;
  className?: string;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
}

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
  secondary:
    "bg-white text-foreground border border-border hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
  ghost:
    "text-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
  destructive:
    "bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-9 px-4 text-sm gap-2",
  lg: "h-11 px-6 text-sm gap-2",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-[8px] font-medium",
        "transition-colors focus-visible:outline-none",
        "disabled:pointer-events-none disabled:opacity-50",
        "active:scale-[0.98]",
        buttonVariants[variant],
        buttonSizes[size],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

// ─── Input ──────────────────────────────────────────────────────────────────

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  className?: string;
  id?: string;
  type?: string;
  value?: string | number;
  placeholder?: string;
  disabled?: boolean;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
}

const inputBase = [
  "h-10 w-full rounded-[8px] border border-border bg-white px-3 text-sm text-foreground",
  "placeholder:text-muted-foreground/60",
  "transition-colors focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15",
  "disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground",
];

export function Input({ label, error, hint, id, className, ...props }: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-foreground">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={cn(
          ...inputBase,
          error && "border-destructive/60 focus:border-destructive focus:ring-destructive/15",
          className
        )}
        aria-invalid={!!error}
        aria-describedby={
          error ? `${inputId}-err` : hint ? `${inputId}-hint` : undefined
        }
        {...props}
      />
      {error && (
        <p
          id={`${inputId}-err`}
          className="flex items-center gap-1.5 text-xs text-destructive"
          role="alert"
        >
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
          {error}
        </p>
      )}
      {hint && !error && (
        <p id={`${inputId}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

// ─── Password Input ──────────────────────────────────────────────────────────

interface PasswordInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  error?: string;
  hint?: string;
}

export function PasswordInput({
  label,
  error,
  hint,
  id,
  disabled,
  className,
  ...props
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-foreground">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          id={inputId}
          type={visible ? "text" : "password"}
          disabled={disabled}
          className={cn(
            ...inputBase,
            "pr-10",
            error && "border-destructive/60 focus:border-destructive focus:ring-destructive/15",
            className
          )}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-err` : hint ? `${inputId}-hint` : undefined}
          {...props}
        />
        <button
          type="button"
          className={cn(
            "absolute right-3 top-1/2 -translate-y-1/2",
            "text-muted-foreground hover:text-foreground",
            "focus:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded-sm",
            "disabled:pointer-events-none disabled:opacity-40"
          )}
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          disabled={disabled}
          tabIndex={0}
        >
          {visible ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </button>
      </div>
      {error && (
        <p
          id={`${inputId}-err`}
          className="flex items-center gap-1.5 text-xs text-destructive"
          role="alert"
        >
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
          {error}
        </p>
      )}
      {hint && !error && (
        <p id={`${inputId}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

// ─── Textarea ────────────────────────────────────────────────────────────────

interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  className?: string;
  id?: string;
  value?: string;
  placeholder?: string;
  rows?: number;
  onChange?: React.ChangeEventHandler<HTMLTextAreaElement>;
}

export function Textarea({ label, error, hint, id, className, ...props }: TextareaProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-foreground">
          {label}
        </label>
      )}
      <textarea
        id={inputId}
        className={cn(
          "min-h-[96px] w-full rounded-[8px] border border-border bg-white px-3 py-2.5 text-sm text-foreground",
          "placeholder:text-muted-foreground/60 resize-y",
          "transition-colors focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15",
          "disabled:cursor-not-allowed disabled:bg-muted",
          error && "border-destructive/60 focus:border-destructive focus:ring-destructive/15",
          className
        )}
        aria-invalid={!!error}
        {...props}
      />
      {error && (
        <p className="flex items-center gap-1.5 text-xs text-destructive" role="alert">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
          {error}
        </p>
      )}
      {hint && !error && (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

// ─── Select ─────────────────────────────────────────────────────────────────

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  placeholder?: string;
  children?: React.ReactNode;
  className?: string;
  id?: string;
  value?: string | number;
  onChange?: React.ChangeEventHandler<HTMLSelectElement>;
}

export function Select({
  label,
  error,
  placeholder,
  id,
  className,
  children,
  ...props
}: SelectProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-foreground">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          id={inputId}
          className={cn(
            "h-10 w-full appearance-none rounded-[8px] border border-border bg-white px-3 pr-9 text-sm text-foreground",
            "transition-colors focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15",
            "disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground",
            error && "border-destructive/60 focus:border-destructive focus:ring-destructive/15",
            className
          )}
          defaultValue={placeholder ? "" : undefined}
          aria-invalid={!!error}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      </div>
      {error && (
        <p className="flex items-center gap-1.5 text-xs text-destructive" role="alert">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

// ─── Calendar Popover ────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface CalendarPopoverProps {
  value: string; // YYYY-MM-DD or ""
  onChange: (val: string) => void;
  onClose: () => void;
  /** Optional YYYY-MM-DD floor — days before it render disabled/unselectable. Undefined = no restriction (existing behavior, unchanged). */
  minDate?: string;
}

function CalendarPopover({ value, onChange, onClose, minDate }: CalendarPopoverProps) {
  const today = new Date();
  const selected = value ? new Date(value + "T00:00:00") : null;

  const [viewYear, setViewYear] = useState(selected?.getFullYear() ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(selected?.getMonth() ?? today.getMonth());
  const [pickingYear, setPickingYear] = useState(false);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayAdj = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7; // Mon=0
  const totalCells = Math.ceil((firstDayAdj + daysInMonth) / 7) * 7;
  const cells = Array.from({ length: totalCells }, (_, i) => {
    const d = i - firstDayAdj + 1;
    return d >= 1 && d <= daysInMonth ? d : null;
  });

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  }

  function cellISODate(day: number): string {
    const m = String(viewMonth + 1).padStart(2, "0");
    const d = String(day).padStart(2, "0");
    return `${viewYear}-${m}-${d}`;
  }

  const isDisabled = (day: number) => !!minDate && cellISODate(day) < minDate;

  function selectDay(day: number) {
    if (isDisabled(day)) return;
    onChange(cellISODate(day));
    onClose();
  }

  const isSelected = (day: number) =>
    !!selected &&
    selected.getFullYear() === viewYear &&
    selected.getMonth() === viewMonth &&
    selected.getDate() === day;

  const isToday = (day: number) =>
    today.getFullYear() === viewYear &&
    today.getMonth() === viewMonth &&
    today.getDate() === day;

  // Year picker — show decade window
  const decade = Math.floor(viewYear / 10) * 10;
  const years = Array.from({ length: 12 }, (_, i) => decade - 1 + i);

  return (
    <div className="absolute z-50 top-full mt-1 left-0 w-[272px] rounded-[12px] border border-border bg-card shadow-xl p-3 select-none">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={pickingYear ? () => setViewYear((y) => y - 10) : prevMonth}
          className="h-7 w-7 rounded-[6px] flex items-center justify-center hover:bg-muted transition-colors"
        >
          <ChevronLeft className="h-4 w-4 text-muted-foreground" />
        </button>

        <button
          type="button"
          onClick={() => setPickingYear((v) => !v)}
          className="text-sm font-semibold text-foreground hover:text-primary transition-colors px-2 py-0.5 rounded-[6px] hover:bg-muted"
        >
          {pickingYear ? `${decade} – ${decade + 9}` : `${MONTH_NAMES[viewMonth]} ${viewYear}`}
        </button>

        <button
          type="button"
          onClick={pickingYear ? () => setViewYear((y) => y + 10) : nextMonth}
          className="h-7 w-7 rounded-[6px] flex items-center justify-center hover:bg-muted transition-colors"
        >
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {pickingYear ? (
        /* Year grid */
        <div className="grid grid-cols-4 gap-1">
          {years.map((yr) => (
            <button
              key={yr}
              type="button"
              onClick={() => { setViewYear(yr); setPickingYear(false); }}
              className={cn(
                "rounded-[8px] py-1.5 text-sm transition-colors",
                yr === viewYear
                  ? "bg-primary text-white font-semibold"
                  : yr === today.getFullYear()
                  ? "border border-primary/30 text-primary font-medium hover:bg-muted"
                  : "text-foreground hover:bg-muted",
                yr < decade || yr > decade + 9 ? "text-muted-foreground/50" : ""
              )}
            >
              {yr}
            </button>
          ))}
        </div>
      ) : (
        <>
          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAY_NAMES.map((d) => (
              <div key={d} className="text-center text-[10px] font-medium text-muted-foreground/60 py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-y-0.5">
            {cells.map((day, i) => (
              <div key={i} className="flex items-center justify-center">
                {day ? (
                  <button
                    type="button"
                    disabled={isDisabled(day)}
                    onClick={() => selectDay(day)}
                    className={cn(
                      "h-8 w-8 rounded-full text-sm transition-colors",
                      isDisabled(day) && "text-muted-foreground/30 cursor-not-allowed",
                      !isDisabled(day) && isSelected(day) && "bg-primary text-white font-semibold",
                      !isDisabled(day) && !isSelected(day) && isToday(day) &&
                        "font-semibold text-primary ring-1 ring-inset ring-primary/40",
                      !isDisabled(day) && !isSelected(day) && !isToday(day) && "text-foreground hover:bg-muted"
                    )}
                  >
                    {day}
                  </button>
                ) : (
                  <div className="h-8 w-8" />
                )}
              </div>
            ))}
          </div>

          {/* Today shortcut — disabled too when today itself is before minDate */}
          <div className="mt-2 pt-2 border-t border-border flex justify-center">
            <button
              type="button"
              disabled={!!minDate && toISODate(today) < minDate}
              onClick={() => {
                setViewYear(today.getFullYear());
                setViewMonth(today.getMonth());
                selectDay(today.getDate());
              }}
              className={cn(
                "text-xs",
                minDate && toISODate(today) < minDate
                  ? "text-muted-foreground/40 cursor-not-allowed"
                  : "text-primary hover:underline"
              )}
            >
              Today
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Date Picker ─────────────────────────────────────────────────────────────

export function DatePicker({
  label, error, value, onChange, placeholder, className, id: idProp, minDate, ...props
}: InputProps & { /** Optional YYYY-MM-DD floor — earlier dates are disabled in the calendar. Undefined = no restriction (existing behavior, unchanged). */ minDate?: string }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const generatedId = useId();
  const inputId = idProp ?? generatedId;

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  function handleCalendarChange(val: string) {
    if (onChange) {
      onChange({ target: { value: val } } as React.ChangeEvent<HTMLInputElement>);
    }
  }

  const displayValue = value
    ? (() => {
        const [y, m, d] = (value as string).split("-").map(Number);
        return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
          day: "2-digit", month: "short", year: "numeric",
        });
      })()
    : "";

  return (
    <div ref={containerRef} className="relative flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-foreground">
          {label}
        </label>
      )}
      <button
        id={inputId}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "w-full h-10 rounded-[8px] border border-border bg-white px-3 text-sm text-left",
          "flex items-center gap-2 transition-colors",
          "focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15",
          error && "border-destructive/60 focus:border-destructive focus:ring-destructive/15",
          className
        )}
      >
        <CalendarDays className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <span className={cn("flex-1", !displayValue && "text-muted-foreground/60")}>
          {displayValue || (placeholder ?? "Select date")}
        </span>
        <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      </button>

      {/* Hidden input keeps the YYYY-MM-DD value accessible to native form APIs */}
      <input type="date" value={value ?? ""} onChange={onChange} min={minDate} className="sr-only" tabIndex={-1} {...props} />

      {error && (
        <p className="flex items-center gap-1.5 text-xs text-destructive" role="alert">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
          {error}
        </p>
      )}

      {open && (
        <CalendarPopover
          value={(value as string) ?? ""}
          onChange={handleCalendarChange}
          onClose={() => setOpen(false)}
          minDate={minDate}
        />
      )}
    </div>
  );
}

// ─── Time Picker (native) ────────────────────────────────────────────────────

export function TimePicker({ className, ...props }: InputProps) {
  return (
    <Input
      {...props}
      type={"time" as const}
      className={cn("cursor-pointer", className)}
    />
  );
}

// ─── Status Badge ────────────────────────────────────────────────────────────

const BADGE_CONFIG: Record<BadgeVariant, { label: string; className: string }> = {
  pending: {
    label: "Pending",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  approved: {
    label: "Approved",
    className: "bg-green-50 text-green-700 border-green-200",
  },
  rejected: {
    label: "Rejected",
    className: "bg-red-50 text-red-700 border-red-200",
  },
  active: {
    label: "Active",
    className: "bg-green-50 text-green-700 border-green-200",
  },
  inactive: {
    label: "Inactive",
    className: "bg-gray-100 text-gray-500 border-gray-200",
  },
};

interface StatusBadgeProps {
  status: BadgeVariant;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = BADGE_CONFIG[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}

// ─── Card ────────────────────────────────────────────────────────────────────

interface CardProps {
  children?: React.ReactNode;
  className?: string;
  padding?: boolean;
}

export function Card({ children, className, padding = true }: CardProps) {
  return (
    <div
      className={cn(
        "bg-card rounded-[12px] border border-border shadow-sm",
        padding && "p-6",
        className
      )}
    >
      {children}
    </div>
  );
}

// ─── Alert ───────────────────────────────────────────────────────────────────

const ALERT_CONFIG: Record<
  AlertVariant,
  { className: string; iconClassName: string; Icon: React.ElementType }
> = {
  error: {
    className: "bg-red-50 border-red-200",
    iconClassName: "text-red-500",
    Icon: AlertCircle,
  },
  success: {
    className: "bg-green-50 border-green-200",
    iconClassName: "text-green-500",
    Icon: CheckCircle2,
  },
  warning: {
    className: "bg-amber-50 border-amber-200",
    iconClassName: "text-amber-500",
    Icon: AlertCircle,
  },
  info: {
    className: "bg-blue-50 border-blue-200",
    iconClassName: "text-blue-500",
    Icon: Info,
  },
};

interface AlertProps {
  variant: AlertVariant;
  children?: React.ReactNode;
  className?: string;
}

export function Alert({ variant, children, className }: AlertProps) {
  const config = ALERT_CONFIG[variant];
  const Icon = config.Icon;

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-[8px] border p-4",
        config.className,
        className
      )}
      role="alert"
    >
      <Icon className={cn("h-4.5 w-4.5 flex-shrink-0 mt-0.5", config.iconClassName)} />
      <div className="text-sm leading-relaxed">{children}</div>
    </div>
  );
}

// ─── Modal ───────────────────────────────────────────────────────────────────

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
}

const modalSizes = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
};

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: ModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40"
        aria-hidden="true"
        onClick={onClose}
      />
      {/* Panel */}
      <div
        className={cn(
          "relative z-10 w-full rounded-[16px] bg-white border border-border shadow-xl",
          "flex flex-col max-h-[90vh]",
          modalSizes[size]
        )}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-border">
          <div>
            <h3 className="text-base font-semibold text-foreground">{title}</h3>
            {description && (
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            )}
          </div>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-[6px] p-0.5 -mr-0.5 -mt-0.5"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Toast ───────────────────────────────────────────────────────────────────
// Note: Uses Sonner (imported separately). This wrapper provides a design-consistent API.

// ─── Loading State ───────────────────────────────────────────────────────────

interface LoadingStateProps {
  message?: string;
  className?: string;
}

export function LoadingState({
  message = "Loading...",
  className,
}: LoadingStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-16",
        className
      )}
    >
      <Loader2 className="h-7 w-7 text-primary animate-spin" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactElement;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-16 text-center",
        className
      )}
    >
      {icon && (
        <div className="text-muted-foreground/40 mb-1">{icon}</div>
      )}
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground max-w-xs">{description}</p>
        )}
      </div>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

// ─── Error State ─────────────────────────────────────────────────────────────

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  message = "Something went wrong. We couldn't load this content. Please try again.",
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-16 text-center",
        className
      )}
    >
      <AlertCircle className="h-9 w-9 text-destructive/40" />
      <p className="text-sm text-muted-foreground max-w-xs">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try Again
        </Button>
      )}
    </div>
  );
}

// ─── Table ───────────────────────────────────────────────────────────────────

interface TableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  className?: string;
}

interface TableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  onRowClick?: (row: T) => void;
  loading?: boolean;
  emptyState?: React.ReactNode;
  className?: string;
}

export function Table<T>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  loading,
  emptyState,
  className,
}: TableProps<T>) {
  return (
    <div className={cn("w-full overflow-x-auto", className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  "px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide",
                  col.className
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columns.length} className="py-12">
                <LoadingState />
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="py-4">
                {emptyState ?? (
                  <EmptyState
                    title="No results found"
                    description="Try adjusting your filters."
                  />
                )}
              </td>
            </tr>
          ) : (
            data.map((row) => (
              <tr
                key={keyExtractor(row)}
                className={cn(
                  "border-b border-border last:border-0",
                  "transition-colors",
                  onRowClick &&
                    "cursor-pointer hover:bg-muted/50 active:bg-muted"
                )}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((col) => (
                  <td key={col.key} className={cn("px-4 py-3.5", col.className)}>
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─── Avatar ──────────────────────────────────────────────────────────────────

interface AvatarProps {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();
}

const avatarSizes = {
  sm: "h-7 w-7 text-xs",
  md: "h-8 w-8 text-xs",
  lg: "h-10 w-10 text-sm",
};

export function Avatar({ name, size = "md", className }: AvatarProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full bg-primary/10 font-medium text-primary flex-shrink-0",
        avatarSizes[size],
        className
      )}
      aria-hidden="true"
    >
      {getInitials(name)}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// APPLICATION SHELL
// Defined here for architectural completeness. Not rendered in this step.
// Will be wired to the router in subsequent implementation steps.
// ═══════════════════════════════════════════════════════════════════════════════

const NAV_ITEMS: Record<
  UserRole,
  { label: string; icon: React.ElementType; id: string }[]
> = {
  EMPLOYEE: [
    { label: "Dashboard", icon: Home, id: "dashboard" },
    { label: "My Requests", icon: FileText, id: "requests" },
    { label: "Notifications", icon: Bell, id: "notifications" },
    { label: "My Profile", icon: User, id: "profile" },
  ],
  MANAGER: [
    { label: "Dashboard", icon: Home, id: "dashboard" },
    { label: "My Team", icon: Users, id: "team" },
    { label: "My Requests", icon: Umbrella, id: "myrequests" },
    { label: "Requests", icon: FileText, id: "requests" },
    { label: "Notifications", icon: Bell, id: "notifications" },
    { label: "My Profile", icon: User, id: "profile" },
  ],
  TECH_MANAGER: [
    { label: "Dashboard", icon: Home, id: "dashboard" },
    { label: "My Teams", icon: Users, id: "team" },
    { label: "My Requests", icon: Umbrella, id: "myrequests" },
    { label: "Requests", icon: FileText, id: "requests" },
    { label: "Organization", icon: Briefcase, id: "organization" },
    { label: "Notifications", icon: Bell, id: "notifications" },
    { label: "My Profile", icon: User, id: "profile" },
  ],
  GM: [
    { label: "Dashboard", icon: Home, id: "dashboard" },
    { label: "My Team", icon: Users, id: "team" },
    { label: "My Requests", icon: Umbrella, id: "myrequests" },
    { label: "Requests", icon: FileText, id: "requests" },
    { label: "Organization", icon: Briefcase, id: "organization" },
    { label: "Notifications", icon: Bell, id: "notifications" },
    { label: "My Profile", icon: User, id: "profile" },
  ],
  HR: [
    { label: "Dashboard", icon: Home, id: "dashboard" },
    { label: "Employees", icon: Users, id: "employees" },
    { label: "My Requests", icon: Umbrella, id: "myrequests" },
    { label: "Requests", icon: FileText, id: "requests" },
    { label: "Attendance", icon: Clock, id: "attendance" },
    { label: "Notifications", icon: Bell, id: "notifications" },
    { label: "Settings", icon: Settings, id: "settings" },
    { label: "My Profile", icon: User, id: "profile" },
  ],
};

interface SidebarProps {
  role: UserRole;
  activeId?: string;
  onNavigate?: (id: string) => void;
  onLogout?: () => void;
  userName?: string;
  /** The signed-in user's actual position/job title, shown in place of their role. */
  position?: string;
}

export function Sidebar({
  role,
  activeId,
  onNavigate,
  onLogout,
  userName,
  position,
}: SidebarProps) {
  const items = NAV_ITEMS[role];

  return (
    <nav
      className="flex flex-col w-60 flex-shrink-0 bg-card border-r border-border h-full"
      aria-label="Main navigation"
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 h-16 border-b border-border flex-shrink-0">
        <LogoMark size={30} variant="dark" />
        <span className="text-sm font-semibold text-foreground tracking-tight">
          HR Portal
        </span>
      </div>

      {/* Nav items */}
      <div className="flex flex-col flex-1 px-3 py-4 gap-0.5 overflow-y-auto">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeId === item.id;

          return (
            <button
              key={item.id}
              className={cn(
                "flex items-center gap-3 w-full px-3 py-2.5 rounded-[8px] text-sm text-left transition-colors",
                isActive
                  ? "bg-accent text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              onClick={() => onNavigate?.(item.id)}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {item.label}
            </button>
          );
        })}
      </div>

      {/* User + sign out */}
      <div className="px-3 py-3 border-t border-border flex-shrink-0">
        {userName && (
          <div className="flex items-center gap-3 px-3 py-2 mb-1">
            <Avatar name={userName} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground truncate">{userName}</p>
              <p className="text-xs text-muted-foreground truncate">{position || "—"}</p>
            </div>
          </div>
        )}
        <button
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-[8px] text-sm text-destructive hover:bg-muted transition-colors"
          onClick={onLogout}
        >
          <LogOut className="h-4 w-4 flex-shrink-0" />
          Sign Out
        </button>
      </div>
    </nav>
  );
}

interface HeaderProps {
  title?: string;
  userName?: string;
  role?: UserRole;
  notificationCount?: number;
  onNotificationsClick?: () => void;
  accessory?: React.ReactNode;
  onMenuClick?: () => void;
  /** Account menu — "My Profile" item. Reuses the existing profile route/navigation. */
  onProfileClick?: () => void;
  /** Account menu — "Sign Out" item. Opens the shared sign-out confirmation (see AppShell); never signs out directly. */
  onLogoutClick?: () => void;
}

export function Header({
  title,
  userName,
  role,
  notificationCount = 0,
  onNotificationsClick,
  onMenuClick,
  accessory,
  onProfileClick,
  onLogoutClick,
}: HeaderProps) {
  // Same outside-click-close pattern already used by DatePicker's popover.
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [menuOpen]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    if (menuOpen) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [menuOpen]);

  return (
    <header className="h-16 flex items-center justify-between px-6 bg-card border-b border-border flex-shrink-0">
      <div className="flex items-center gap-3">
        {/* Mobile hamburger */}
        <button
          className="lg:hidden text-muted-foreground hover:text-foreground h-8 w-8 flex items-center justify-center rounded-[6px] hover:bg-muted transition-colors"
          onClick={onMenuClick}
          aria-label="Open menu"
        >
          <Menu className="h-4 w-4" />
        </button>

        {title && (
          <h1 className="text-sm font-medium text-foreground">{title}</h1>
        )}
      </div>

      <div className="flex items-center gap-1">
        {accessory}

        {/* Notifications */}
        <button
          className="relative h-9 w-9 flex items-center justify-center rounded-[8px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          onClick={onNotificationsClick}
          aria-label={
            notificationCount > 0
              ? `${notificationCount} unread notifications`
              : "Notifications"
          }
        >
          <Bell className="h-4 w-4" />
          {notificationCount > 0 && (
            <span
              className="absolute top-2 right-2 h-2 w-2 rounded-full bg-destructive"
              aria-hidden="true"
            />
          )}
        </button>

        {/* User menu */}
        {userName && (
          <div ref={menuRef} className="relative">
            <button
              className="flex items-center gap-2.5 h-9 px-3 rounded-[8px] text-sm hover:bg-muted transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <Avatar name={userName} size="sm" />
              <span className="hidden md:block text-sm font-medium text-foreground max-w-[140px] truncate">
                {userName}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </button>

            {menuOpen && (
              <div
                role="menu"
                aria-label="Account menu"
                className="absolute right-0 top-full mt-1 w-44 rounded-[12px] border border-border bg-card shadow-xl py-1 z-50"
              >
                <button
                  role="menuitem"
                  type="button"
                  className="flex w-full items-center px-3 py-2 mx-0 rounded-[6px] text-sm text-foreground hover:bg-muted transition-colors text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                  onClick={() => { setMenuOpen(false); onProfileClick?.(); }}
                >
                  My Profile
                </button>
                <button
                  role="menuitem"
                  type="button"
                  className="flex w-full items-center px-3 py-2 mx-0 rounded-[6px] text-sm text-destructive hover:bg-muted transition-colors text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                  onClick={() => { setMenuOpen(false); onLogoutClick?.(); }}
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}

interface AppShellProps {
  user: {
    name: string;
    role: UserRole;
    employeeNumber?: string;
    /** Actual position/job title, shown in the sidebar in place of the role. */
    position?: string;
  };
  children?: React.ReactNode;
  activeNavId?: string;
  pageTitle?: string;
  notificationCount?: number;
  onNotificationsClick?: () => void;
  accessory?: React.ReactNode;
  onNavigate?: (id: string) => void;
  onLogout?: () => void;
}

export function AppShell({
  user,
  children,
  activeNavId,
  pageTitle,
  notificationCount = 0,
  onNotificationsClick,
  accessory,
  onNavigate,
  onLogout,
}: AppShellProps) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  // Shared by both sign-out entry points (header account menu + sidebar):
  // neither ever calls the real onLogout directly — both only open this
  // confirmation, and only its own "Sign Out" button calls onLogout, so
  // there is exactly one place that can actually end the session.
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

  function requestSignOut() {
    setShowSignOutConfirm(true);
  }
  function confirmSignOut() {
    setShowSignOutConfirm(false);
    onLogout?.();
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex">
        <Sidebar
          role={user.role}
          activeId={activeNavId}
          onNavigate={onNavigate}
          onLogout={requestSignOut}
          userName={user.name}
          position={user.position}
        />
      </div>

      {/* Mobile sidebar overlay */}
      {mobileSidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div
            className="fixed inset-0 bg-black/40"
            onClick={() => setMobileSidebarOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-50 flex">
            <Sidebar
              role={user.role}
              activeId={activeNavId}
              onNavigate={(id) => {
                onNavigate?.(id);
                setMobileSidebarOpen(false);
              }}
              onLogout={requestSignOut}
              userName={user.name}
              position={user.position}
            />
          </div>
        </div>
      )}

      {/* Main column */}
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <Header
          title={pageTitle}
          userName={user.name}
          role={user.role}
          notificationCount={notificationCount}
          onNotificationsClick={onNotificationsClick}
        accessory={accessory}
          onMenuClick={() => setMobileSidebarOpen(true)}
          onProfileClick={() => onNavigate?.("profile")}
          onLogoutClick={requestSignOut}
        />
        <main className="flex-1 overflow-auto p-6 lg:p-8">
          {children}
        </main>
      </div>

      <Modal
        open={showSignOutConfirm}
        onClose={() => setShowSignOutConfirm(false)}
        title="Sign out?"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowSignOutConfirm(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmSignOut}>
              Sign Out
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">Are you sure you want to sign out?</p>
      </Modal>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTH CONTEXT
// ═══════════════════════════════════════════════════════════════════════════════

interface AuthContextValue {
  session: Session | null;
  login: (session: Session) => void;
  logout: () => void;
}

const AuthCtx = createContext<AuthContextValue | null>(null);

function AuthProvider({ children }: { children?: React.ReactNode }) {
  // getSession() rehydrates synchronously from local storage, so a refresh or
  // a deep link for an existing demo-account session lands on the right page
  // instead of bouncing to login — unchanged from before Phase 5. A real
  // Supabase session needs an async check instead (restoreSupabaseSession),
  // so `ready` starts true only when there is nothing further to await: a
  // local session was already found, or Supabase isn't configured in this
  // environment at all (which is this repo's current state — this makes the
  // loading gate below a complete no-op today).
  const [session, setSession] = useState<Session | null>(() => getSession());
  const [ready, setReady] = useState(() => session !== null || !isSupabaseConfigured);

  useEffect(() => {
    if (ready) return;
    let cancelled = false;
    restoreSupabaseSession().then((s) => {
      if (cancelled) return;
      if (s) setSession(s);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
    // Intentionally runs once on mount only — `ready` flips to true exactly
    // once and this effect has nothing left to do afterward.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // subscribeToAuthChanges was exported but never called, so nothing outside
  // this component could ever end a session. HR deactivating the signed-in
  // account, or Supabase silently ending a session (e.g. an expired refresh
  // token), now propagates here immediately.
  useEffect(() => subscribeToAuthChanges(setSession), []);

  const login = useCallback((s: Session) => {
    setSession(s);
  }, []);

  const logout = useCallback(() => {
    void authSignOut();
    setSession(null);
  }, []);

  if (!ready) return null;

  return (
    <AuthCtx.Provider value={{ session, login, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

// ═══════════════════════════════════════════════════════════════════════════════
// STORE CONTEXT
// ═══════════════════════════════════════════════════════════════════════════════

interface CreateEmployeeInput {
  /** Manually entered by HR; becomes the employee's id and login identifier — see createEmployee. */
  employeeCode: string;
  firstName: string; lastName: string; email: string; phone?: string;
  /** A real, ACTIVE departments.id — creation is always a real Supabase employee (Phase 6A). */
  position: string; departmentId: string; role: UserRole;
  managerId: string | null; status: "ACTIVE" | "INACTIVE"; password: string;
  annualDays: number; casualDays: number; permissionMinutes: number;
  /** Only applied when role is MANAGER — see createEmployee. */
  teamMemberIds?: string[];
}

interface StoreContextValue {
  requests: RequestRecord[];
  /**
   * Real, Supabase-backed requests (+ full approval chains) visible to the
   * signed-in session (Phase 6B-7) — see fetchRealRequests. Deliberately
   * separate from `requests`, which stays exactly `store.requests`,
   * unconditionally local/demo. Empty for a demo session or before the
   * fetch resolves — never a fallback to `requests`.
   */
  realRequests: RequestRecord[];
  notifications: NotificationRecord[];
  employees: EmployeeProfile[];
  /** Local/demo leave type catalog — unconditionally `store.leaveTypes`. Leave submission reads this, unchanged since before Phase 6B-1. */
  leaveTypes: LeaveTypeRecord[];
  /** Real, Supabase-backed leave types (Phase 6B-1) — see supabase/migrations/20260906130200_leave_types.sql. Only HRSettingsPage's management UI reads this, for a real HR session. */
  remoteLeaveTypes: LeaveTypeRecord[];
  attendance: AttendanceRecord[];
  /**
   * Real, Supabase-backed attendance (Phase 6B-10) — see
   * supabase/migrations/20260906130900_attendance.sql. RLS
   * (attendance_select_self_or_hr) scopes this to the caller's own records
   * for a real employee, or every record for real HR — the same single
   * fetch serves both MyCalendarWidget/useMyBalances and HRAttendancePage.
   * Deliberately separate from `attendance`, which stays exactly
   * `store.attendance`, unconditionally local/demo.
   */
  realAttendance: AttendanceRecord[];
  /** Local/demo public holidays — unconditionally `store.holidays`. Leave/Permission submission and the calendar widget read this, unchanged since before Phase 6B-2. */
  holidays: HolidayRecord[];
  /** Real, Supabase-backed public holidays (Phase 6B-2) — see supabase/migrations/20260906130500_public_holidays.sql. Only HolidaysSection's management UI reads this, for a real HR session. */
  remoteHolidays: HolidayRecord[];
  /**
   * The signed-in real user's own leave_allocations for the current calendar
   * year (Phase 6B-3) — {ANNUAL:0,CASUAL:0} for a demo session, an
   * unconfigured real employee, or before the fetch resolves. Never another
   * employee's data — always self-scoped, regardless of caller role.
   */
  myLeaveAllocations: { ANNUAL: number; CASUAL: number };
  /**
   * On-demand read of one employee's current-year leave_allocations —
   * HR-only usage (HREmployeesPage's Edit form); leave_allocations_select_self_or_hr
   * RLS re-enforces this server-side (a non-HR caller passing someone else's
   * id simply gets nothing back, not an error). Returns {ANNUAL:0,CASUAL:0}
   * if no allocation has been set yet — never a fabricated default.
   */
  fetchEmployeeLeaveAllocations: (profileId: string) => Promise<{ ANNUAL: number; CASUAL: number }>;
  /** Real, Supabase-backed departments — see supabase/migrations/20260906160000. */
  departments: DepartmentRecord[];
  /** The singleton Technical Manager/General Manager routing slots — null values mean "not yet configured." */
  approvalRouting: { technicalManagerId: string | null; generalManagerId: string | null } | null;
  createLeaveRequest: (
    employeeId: string, employeeName: string,
    data: { leaveType: string; startDate: string; endDate: string; reason?: string }
  ) => { ok: true; request: RequestRecord } | { ok: false; errors: Record<string, string> };
  /**
   * Real employees only (Phase 6B-4) — calls submit_leave_request directly;
   * entirely separate from createLeaveRequest, which stays local/demo-only
   * and untouched. Identity, manager, approval chain, working-day count,
   * overlap, and balance are all derived/validated server-side; the client
   * passes only leave_type_id, start_date, end_date, and an optional reason.
   * The returned RequestRecord is not written into store.requests — it is
   * for the immediate post-submission display only (see LeaveRequestPage).
   */
  submitRealLeaveRequest: (data: {
    leaveTypeId: string;
    startDate: string;
    endDate: string;
    reason?: string;
  }) => Promise<{ ok: true; request: RequestRecord } | { ok: false; error: string }>;
  createMissionRequest: (
    employeeId: string, employeeName: string,
    data: { startDate: string; startTime: string; endDate: string; endTime: string; location: string; purpose: string }
  ) => { ok: true; request: RequestRecord } | { ok: false; errors: Record<string, string> };
  /**
   * Real employees only (Phase 6B-5) — calls submit_mission_request
   * directly; entirely separate from createMissionRequest, which stays
   * local/demo-only. Same shape as submitRealLeaveRequest.
   */
  submitRealMissionRequest: (data: {
    startDate: string;
    startTime: string;
    endDate: string;
    endTime: string;
    location: string;
    purpose: string;
  }) => Promise<{ ok: true; request: RequestRecord } | { ok: false; error: string }>;
  approveRequest: (requestId: string, approverId: string, comment?: string) => { ok: boolean; error?: string };
  rejectRequest: (requestId: string, approverId: string, comment: string) => { ok: boolean; error?: string };
  // employeeId must come from the caller's own session, never from a
  // client-editable field on the request — see canEmployeeDeleteRequest.
  deleteRequest: (requestId: string, employeeId: string) => { ok: boolean; error?: string };
  /**
   * Real employees only (Phase 6B-6) — calls delete_own_request directly;
   * entirely separate from deleteRequest, which stays local/demo-only.
   * Ownership, PENDING status, and stage-1-only are all re-derived and
   * enforced server-side, never trusted from the client.
   */
  deleteRealRequest: (requestId: string) => Promise<{ ok: boolean; error?: string }>;
  /**
   * Real approvers only (Phase 6B-8) — calls decide_request directly;
   * entirely separate from approveRequest/rejectRequest, which stay
   * local/demo-only. Current approver, active stage, sequential advancement
   * and final-stage completion are all re-derived and enforced server-side,
   * never trusted from the client.
   */
  decideRealRequest: (
    requestId: string,
    action: "APPROVE" | "REJECT",
    comment?: string
  ) => Promise<{ ok: boolean; error?: string }>;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: (userId: string) => void;
  /**
   * Real, Supabase-backed notifications visible to the signed-in session
   * (Phase 6B-9) — see fetchRealNotifications. Deliberately separate from
   * `notifications`, which stays exactly `store.notifications`,
   * unconditionally local/demo. Created exclusively by the transactional
   * RPCs (submit_leave_request, submit_mission_request,
   * submit_permission_request, decide_request) as part of the same
   * transaction that submits or decides a request — never inserted from
   * the client, so a refetch or a browser refresh can never duplicate one.
   */
  realNotifications: NotificationRecord[];
  /** Real users only — flips one notification's `read` column via RLS's own-or-HR UPDATE grant. */
  markRealNotificationRead: (id: string) => Promise<{ ok: boolean; error?: string }>;
  /** Real users only — flips every one of the caller's own notifications to read, same isolation rule as markAllNotificationsRead. */
  markAllRealNotificationsRead: () => Promise<{ ok: boolean; error?: string }>;
  // HR-only operations. EMPLOYEE/MANAGER creation goes through the real
  // Supabase provisioning path (provisionEmployeeAccount / Edge Function) —
  // see StoreProvider.createEmployee — so both are async now; every other
  // signature here is unchanged from before Phase 6A.
  createEmployee: (
    data: CreateEmployeeInput
  ) => Promise<
    | { ok: true; employee: EmployeeProfile; password: string; warning?: string }
    | { ok: false; errors: Record<string, string> }
  >;
  updateEmployee: (id: string, data: Partial<EmployeeProfile>) => Promise<{ ok: boolean; error?: string }>;
  /** True once `id` is known to be a real Supabase-backed profile, not a local demo employee. */
  isRemoteEmployee: (id: string) => boolean;
  /**
   * Real path is HR-only (leave_types_insert_hr RLS re-enforces server-side);
   * demo path is unchanged from before Phase 6B-1. `leaveType` is present
   * only on the demo path's success, for callers that used the old
   * synchronous return value.
   */
  createLeaveType: (
    name: string,
    balanceKey: BalanceKey | null,
    minimumNoticeDays?: number
  ) => Promise<{ ok: boolean; error?: string; leaveType?: LeaveTypeRecord }>;
  /** Real path is HR-only (leave_types_update_hr RLS re-enforces server-side); demo path unchanged. */
  updateLeaveType: (id: string, updates: Partial<LeaveTypeRecord>) => Promise<{ ok: boolean; error?: string }>;
  /** HR-only; RLS (departments_insert_hr) re-enforces this server-side. */
  createDepartment: (name: string) => Promise<{ ok: boolean; error?: string }>;
  /** HR-only; covers rename and archive/reactivate. RLS (departments_update_hr) re-enforces server-side. */
  updateDepartment: (id: string, updates: { name?: string; status?: "ACTIVE" | "INACTIVE" }) => Promise<{ ok: boolean; error?: string }>;
  /**
   * HR-only; the only writer of company_approval_routing (Phase 6A.1). Pass
   * null for a slot to leave it unchanged — this can promote but never
   * clear a slot back to unconfigured, matching set_approval_routing's own
   * contract. Also keeps every HR profile's manager_id pointed at whoever
   * ends up holding the General Manager slot.
   */
  setApprovalRouting: (
    technicalManagerId: string | null,
    generalManagerId: string | null
  ) => Promise<{ ok: boolean; error?: string }>;
  createPermissionRequest: (
    employeeId: string, employeeName: string,
    data: { permissionKind: PermissionKind; date: string; minutes: number; reason?: string }
  ) => { ok: true; request: RequestRecord } | { ok: false; errors: Record<string, string> };
  /**
   * Real employees only (Phase 6B-5) — calls submit_permission_request
   * directly; entirely separate from createPermissionRequest, which stays
   * local/demo-only. Same shape as submitRealLeaveRequest.
   */
  submitRealPermissionRequest: (data: {
    permissionKind: PermissionKind;
    date: string;
    minutes: number;
    reason?: string;
  }) => Promise<{ ok: true; request: RequestRecord } | { ok: false; error: string }>;
  /**
   * Real path is HR-only (attendance_insert_hr/attendance_update_hr RLS
   * re-enforces server-side); demo path unchanged since before Phase
   * 6B-10. One record per employee per day either way — the real path
   * upserts on the table's own UNIQUE (employee_id, date) constraint,
   * matching the existing "re-entering a day corrects it" demo behavior.
   */
  recordAttendance: (
    data: { employeeId: string; date: string; checkIn?: string; checkOut?: string; note?: string },
    recordedBy: string
  ) => Promise<{ ok: boolean; error?: string }>;
  /** Real path is HR-only (attendance_delete_hr RLS re-enforces server-side); demo path unchanged. */
  deleteAttendance: (id: string) => Promise<void>;
  /**
   * Excel-import path. Real HR only; no demo equivalent. Delegates to
   * hr_import_attendance (20260909110000), which stores the row's ACTUAL
   * Clock In/Clock Out verbatim (never synthesized) alongside the Excel's
   * own explicit late/early/overtime minutes — never re-derived from
   * Clock In/Clock Out. Idempotent via the table's existing UNIQUE
   * (employee_id, date): re-importing the same rows returns insertedCount: 0.
   */
  importAttendance: (
    employeeId: string,
    rows: {
      date: string;
      clockIn: string | null;
      clockOut: string | null;
      lateMinutes: number;
      earlyMinutes: number;
      overtimeMinutes: number;
    }[]
  ) => Promise<{ ok: true; insertedCount: number; skippedCount: number } | { ok: false; error: string }>;
  /**
   * Real path is HR-only (public_holidays_insert_hr RLS re-enforces
   * server-side); demo path unchanged since before Phase 6B-2. Public
   * Holidays has no archive/inactive concept in either layer — add/remove/
   * edit only.
   */
  createHoliday: (date: string, name: string) => Promise<{ ok: boolean; error?: string }>;
  /** Real path is HR-only (public_holidays_delete_hr RLS re-enforces server-side); demo path unchanged. */
  deleteHoliday: (id: string) => Promise<{ ok: boolean; error?: string }>;
  /** Real path is HR-only (public_holidays_update_hr RLS re-enforces server-side); demo path unchanged. */
  updateHoliday: (id: string, date: string, name: string) => Promise<{ ok: boolean; error?: string }>;
}

// Phase 6A — profiles only. Maps one `profiles` row (Supabase) onto the
// existing EmployeeProfile shape so every page that already reads
// useStore().employees keeps working unchanged. `entitlements` has no
// backing column yet — leave_allocations is a later Phase 6 stage — so real
// employees show 0/0 here rather than a fabricated number; this is the one
// known, deliberate gap, not a bug.
function mapProfileRowToEmployeeProfile(row: {
  id: string;
  employee_code: string | null;
  first_name: string | null;
  last_name: string | null;
  name: string;
  position: string | null;
  department: string | null;
  department_id: string | null;
  departments: { name: string } | { name: string }[] | null;
  email: string | null;
  phone: string | null;
  status: "ACTIVE" | "INACTIVE";
  role: UserRole;
  manager_id: string | null;
  permission_minutes_per_month: number;
  is_production: boolean | null;
}): EmployeeProfile {
  // PostgREST embeds a to-one FK relationship as a single object normally,
  // but the generic client type used here allows either shape — handle both
  // rather than assuming.
  const departmentRow = Array.isArray(row.departments) ? row.departments[0] : row.departments;
  return {
    id: row.id,
    employeeCode: row.employee_code ?? undefined,
    name: row.name,
    firstName: row.first_name ?? "",
    lastName: row.last_name ?? "",
    position: row.position ?? "",
    department: departmentRow?.name ?? row.department ?? "",
    departmentId: row.department_id ?? undefined,
    email: row.email ?? "",
    phone: row.phone ?? undefined,
    status: row.status,
    managerId: row.manager_id,
    role: row.role,
    entitlements: { ANNUAL: 0, CASUAL: 0 },
    permissionMinutesPerMonth: row.permission_minutes_per_month,
    isProduction: row.is_production ?? true,
  };
}

const PROFILE_SELECT_COLUMNS =
  "id, employee_code, first_name, last_name, name, position, department, department_id, departments(name), email, phone, status, role, manager_id, permission_minutes_per_month, is_production";

// Phase 6B-4 — real Leave submission only. Maps one Supabase `request_approvals`
// row onto the existing ApprovalStep shape, and one `requests` row (as
// returned by submit_leave_request, RETURNS requests — every column) plus
// its approval rows onto the existing RequestRecord shape, so the existing
// display components (RequestTimeline, requestLabel, requestPeriod,
// stageLabel, ...) work unchanged against a real, Supabase-created request.
// Used only for the immediate post-submission result — this does not read
// back into store.requests and is not a general Requests-list adapter (see
// LeaveRequestPage's own limitation note).
function mapApprovalRowToApprovalStep(row: {
  stage: number;
  role: string;
  title: string;
  approver_id: string;
  approver_name: string;
  status: string;
  decided_at: string | null;
  comment: string | null;
}): ApprovalStep {
  return {
    stage: row.stage,
    role: row.role as UserRole,
    title: row.title,
    approverId: row.approver_id,
    approverName: row.approver_name,
    status: row.status as RequestStatus,
    decidedAt: row.decided_at ?? undefined,
    comment: row.comment ?? undefined,
  };
}

function mapRequestRowToRequestRecord(
  row: {
    id: string;
    request_number: string;
    employee_id: string;
    employee_name: string;
    manager_id: string | null;
    manager_name: string | null;
    type: string;
    status: string;
    submitted_at: string;
    leave_type_name: string | null;
    balance_key: string | null;
    working_days: number | null;
    start_date: string | null;
    end_date: string | null;
    reason: string | null;
    // Mission fields (Phase 6B-5).
    start_time: string | null;
    end_time: string | null;
    location: string | null;
    purpose: string | null;
    // Permission fields (Phase 6B-5).
    permission_kind: string | null;
    permission_minutes: number | null;
    decided_at: string | null;
    decision_comment: string | null;
  },
  approvals: ApprovalStep[]
): RequestRecord {
  return {
    id: row.id,
    requestNumber: row.request_number,
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    managerId: row.manager_id ?? "",
    managerName: row.manager_name ?? "",
    approvals,
    type: row.type as RequestType,
    status: row.status as RequestStatus,
    submittedAt: row.submitted_at,
    leaveType: row.leave_type_name ?? undefined,
    balanceKey: (row.balance_key as BalanceKey | null) ?? null,
    workingDays: row.working_days ?? undefined,
    startDate: row.start_date ?? undefined,
    endDate: row.end_date ?? undefined,
    reason: row.reason ?? undefined,
    startTime: row.start_time ?? undefined,
    endTime: row.end_time ?? undefined,
    location: row.location ?? undefined,
    purpose: row.purpose ?? undefined,
    permissionKind: (row.permission_kind as PermissionKind | null) ?? undefined,
    permissionMinutes: row.permission_minutes ?? undefined,
    decidedAt: row.decided_at ?? undefined,
    decisionComment: row.decision_comment ?? undefined,
  };
}

// Phase 6B-9 — maps one Supabase `notifications` row onto the existing
// NotificationRecord shape 1:1 (same four-value type union the table's own
// CHECK constraint enforces) so EmployeeNotificationsPage/
// ManagerNotificationsPage/HRNotificationsPage/DashboardShell's unread badge
// work unchanged against real data. request_id is nullable on the table in
// principle, but every INSERT the transactional RPCs perform always sets
// it — the fallback is defensive only, never expected to trigger.
function mapNotificationRowToNotificationRecord(row: {
  id: string;
  user_id: string;
  type: string;
  request_id: string | null;
  message: string;
  read: boolean;
  created_at: string;
}): NotificationRecord {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type as NotificationRecord["type"],
    requestId: row.request_id ?? "",
    message: row.message,
    read: row.read,
    createdAt: row.created_at,
  };
}

// Phase 6B-10 — maps one Supabase `attendance` row onto the existing
// AttendanceRecord shape 1:1. check_in/check_out come back from PostgREST as
// "HH:MM:SS" (Postgres TIME) — sliced to "HH:MM" to match the demo shape
// exactly (minutesOfDay/lateMinutes/earlyLeaveMinutes and every display site
// already assume "HH:MM").
function mapAttendanceRowToAttendanceRecord(row: {
  id: string;
  employee_id: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  note: string | null;
  recorded_by: string;
  recorded_at: string;
  source?: string | null;
  late_minutes?: number | null;
  early_minutes?: number | null;
  overtime_minutes?: number | null;
}): AttendanceRecord {
  return {
    id: row.id,
    employeeId: row.employee_id,
    date: row.date,
    checkIn: row.check_in ? row.check_in.slice(0, 5) : undefined,
    checkOut: row.check_out ? row.check_out.slice(0, 5) : undefined,
    note: row.note ?? undefined,
    recordedBy: row.recorded_by,
    recordedAt: row.recorded_at,
    source: row.source === "IMPORT" ? "IMPORT" : "MANUAL",
    lateMinutes: row.late_minutes ?? 0,
    earlyMinutes: row.early_minutes ?? 0,
    overtimeMinutes: row.overtime_minutes ?? 0,
  };
}

const StoreCtx = createContext<StoreContextValue | null>(null);

function StoreProvider({ children }: { children?: React.ReactNode }) {
  const [store, setStore] = useState<StoreData>(() => loadStore());
  const { session } = useAuth();

  // Profiles/employees only (Phase 6A) — every other domain (requests,
  // notifications, leave types, attendance, holidays) still lives entirely
  // in `store` above and is untouched. Real (Supabase) employees are kept in
  // a separate array and merged with the local demo roster below, rather
  // than replacing it: existing local demo requests/notifications/attendance
  // reference the local demo employee ids by id, and nothing about those
  // records is being migrated in this phase, so the local roster those
  // records depend on must keep existing exactly as it did before.
  const [remoteEmployees, setRemoteEmployees] = useState<EmployeeProfile[]>([]);

  const fetchRemoteEmployees = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      setRemoteEmployees([]);
      return;
    }
    try {
      const { data, error } = await supabase.from("profiles").select(PROFILE_SELECT_COLUMNS);
      if (error || !data) {
        setRemoteEmployees([]);
        return;
      }
      setRemoteEmployees(data.map(mapProfileRowToEmployeeProfile));
    } catch {
      setRemoteEmployees([]);
    }
  }, []);

  // Real, Supabase-backed departments (supabase/migrations/20260906160000) —
  // HR-managed company data, kept separate from the local demo DEPARTMENTS
  // string list exactly like remoteEmployees is kept separate from the local
  // demo roster: no destructive migration, no shared shape.
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);

  const fetchDepartments = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      setDepartments([]);
      return;
    }
    try {
      const { data, error } = await supabase.from("departments").select("id, name, status").order("name");
      if (error || !data) {
        setDepartments([]);
        return;
      }
      setDepartments(data as DepartmentRecord[]);
    } catch {
      setDepartments([]);
    }
  }, []);

  // The singleton TM/GM routing row (Phase 6A.1) — readable by every
  // authenticated user (company_approval_routing_select_all), null slots
  // mean "not yet configured," not an error.
  const [approvalRouting, setApprovalRoutingState] = useState<{
    technicalManagerId: string | null;
    generalManagerId: string | null;
  } | null>(null);

  const fetchApprovalRouting = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      setApprovalRoutingState(null);
      return;
    }
    try {
      const { data, error } = await supabase
        .from("company_approval_routing")
        .select("technical_manager_id, general_manager_id")
        .eq("id", 1)
        .maybeSingle();
      if (error || !data) {
        setApprovalRoutingState(null);
        return;
      }
      setApprovalRoutingState({
        technicalManagerId: data.technical_manager_id,
        generalManagerId: data.general_manager_id,
      });
    } catch {
      setApprovalRoutingState(null);
    }
  }, []);

  // Real, Supabase-backed leave types (Phase 6B-1) — exposed as its own
  // context field, deliberately separate from `leaveTypes` (which stays
  // exactly `store.leaveTypes`, unconditionally local). Leave submission
  // (createLeaveRequest/validateLeaveFields) is NOT part of this phase — it
  // still reads and validates against the local list for every employee,
  // real or demo, exactly as before. Only HRSettingsPage's management UI
  // reads this new field, and only for a real HR session — see
  // HRSettingsPage's own real-vs-demo switch.
  const [remoteLeaveTypes, setRemoteLeaveTypes] = useState<LeaveTypeRecord[]>([]);

  const fetchRemoteLeaveTypes = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      setRemoteLeaveTypes([]);
      return;
    }
    try {
      const { data, error } = await supabase
        .from("leave_types")
        .select("id, name, status, balance_key, minimum_notice_days")
        .order("name");
      if (error || !data) {
        setRemoteLeaveTypes([]);
        return;
      }
      setRemoteLeaveTypes(
        data.map((row) => ({
          id: row.id,
          name: row.name,
          status: row.status,
          balanceKey: row.balance_key,
          minimumNoticeDays: row.minimum_notice_days ?? 0,
        }))
      );
    } catch {
      setRemoteLeaveTypes([]);
    }
  }, []);

  // Real, Supabase-backed public holidays (Phase 6B-2) — exposed as its own
  // context field, deliberately separate from `holidays` (which stays
  // exactly `store.holidays`, unconditionally local). Leave/Permission
  // submission and the calendar widget are NOT part of this phase — they
  // still read the local list for every employee, real or demo, exactly as
  // before. Only HolidaysSection's management UI reads this, and only for a
  // real HR session — see HolidaysSection's own real-vs-demo switch.
  const [remoteHolidays, setRemoteHolidays] = useState<HolidayRecord[]>([]);

  const fetchRemoteHolidays = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      setRemoteHolidays([]);
      return;
    }
    try {
      const { data, error } = await supabase
        .from("public_holidays")
        .select("id, date, name")
        .order("date");
      if (error || !data) {
        setRemoteHolidays([]);
        return;
      }
      setRemoteHolidays(data as HolidayRecord[]);
    } catch {
      setRemoteHolidays([]);
    }
  }, []);

  // The signed-in real user's own leave_allocations for the current calendar
  // year (Phase 6B-3) — always self-scoped via an explicit profile_id
  // filter, even though leave_allocations_select_self_or_hr would also let
  // an HR caller read everyone's: this hook answers "what is MY balance,"
  // never "what is everyone's." {ANNUAL:0,CASUAL:0} means either no
  // allocation has been set yet (real, honest 0 — never fabricated) or the
  // caller is a local demo session (unused there — see useMyBalances/
  // LeaveRequestPage, which only apply this for a real session).
  const [myLeaveAllocations, setMyLeaveAllocations] = useState<{ ANNUAL: number; CASUAL: number }>({
    ANNUAL: 0,
    CASUAL: 0,
  });

  const fetchMyLeaveAllocations = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase || !session) {
      setMyLeaveAllocations({ ANNUAL: 0, CASUAL: 0 });
      return;
    }
    try {
      const year = new Date().getFullYear();
      const { data, error } = await supabase
        .from("leave_allocations")
        .select("bucket, allocated_days")
        .eq("profile_id", session.user.id)
        .eq("year", year);
      if (error || !data) {
        setMyLeaveAllocations({ ANNUAL: 0, CASUAL: 0 });
        return;
      }
      const next = { ANNUAL: 0, CASUAL: 0 };
      for (const row of data as { bucket: string; allocated_days: number }[]) {
        if (row.bucket === "ANNUAL" || row.bucket === "CASUAL") next[row.bucket] = row.allocated_days;
      }
      setMyLeaveAllocations(next);
    } catch {
      setMyLeaveAllocations({ ANNUAL: 0, CASUAL: 0 });
    }
  }, [session]);

  // On-demand, single-employee read — HR's Edit Employee form only, to
  // pre-populate the Opening Balances fields with that employee's real
  // current allocation rather than the hardcoded 0 every remote profile
  // otherwise carries (entitlements has no backing column on profiles
  // itself — see mapProfileRowToEmployeeProfile). Not stored in ongoing
  // state like the fetch above; called imperatively and returned directly.
  const fetchEmployeeLeaveAllocations = useCallback(
    async (profileId: string): Promise<{ ANNUAL: number; CASUAL: number }> => {
      if (!isSupabaseConfigured || !supabase) return { ANNUAL: 0, CASUAL: 0 };
      try {
        const year = new Date().getFullYear();
        const { data, error } = await supabase
          .from("leave_allocations")
          .select("bucket, allocated_days")
          .eq("profile_id", profileId)
          .eq("year", year);
        if (error || !data) return { ANNUAL: 0, CASUAL: 0 };
        const next = { ANNUAL: 0, CASUAL: 0 };
        for (const row of data as { bucket: string; allocated_days: number }[]) {
          if (row.bucket === "ANNUAL" || row.bucket === "CASUAL") next[row.bucket] = row.allocated_days;
        }
        return next;
      } catch {
        return { ANNUAL: 0, CASUAL: 0 };
      }
    },
    []
  );

  // Phase 6B-7 — the real requests (+ their full approval chains) visible to
  // the signed-in session, exposed as its own context field, deliberately
  // separate from `requests` (which stays exactly `store.requests`,
  // unconditionally local — demo pages/logic are entirely untouched). RLS
  // on `requests` alone already scopes exactly what a plain SELECT returns:
  // own (requests_select_own), any request they hold an approval role in at
  // any stage (requests_select_approver), or everything (requests_select_hr)
  // — no client-side WHERE clause is added or needed, RLS is the boundary.
  // One query: PostgREST embeds request_approvals via the existing FK, and
  // the new request_approvals_select_via_request policy (Phase 6B-7) makes
  // that embed return the request's FULL chain — not just the caller's own
  // row — for any approver who can already see the parent request, matching
  // what the existing RequestTimeline/stageLabel/currentStep display logic
  // (all unchanged) already expects.
  const REQUEST_SELECT_COLUMNS =
    "id, request_number, employee_id, employee_name, manager_id, manager_name, type, status, submitted_at, leave_type_name, balance_key, working_days, start_date, end_date, reason, start_time, end_time, location, purpose, permission_kind, permission_minutes, decided_at, decision_comment, request_approvals(stage, role, title, approver_id, approver_name, status, decided_at, comment)";

  const [realRequests, setRealRequests] = useState<RequestRecord[]>([]);

  const fetchRealRequests = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase || !session) {
      setRealRequests([]);
      return;
    }
    try {
      const { data, error } = await supabase
        .from("requests")
        .select(REQUEST_SELECT_COLUMNS)
        // Archived requests (REQ-00003/REQ-00004: protected historical
        // records kept permanently for referential/audit reasons, never
        // deleted) are excluded from every normal request list, dashboard,
        // and count in one place — this is the only `.from("requests")`
        // read site in the app.
        .is("archived_at", null)
        .order("submitted_at", { ascending: false })
        .order("stage", { foreignTable: "request_approvals", ascending: true });
      if (error || !data) {
        setRealRequests([]);
        return;
      }
      setRealRequests(
        data.map((row) => {
          const approvalRows = Array.isArray(row.request_approvals) ? row.request_approvals : [];
          return mapRequestRowToRequestRecord(row, approvalRows.map(mapApprovalRowToApprovalStep));
        })
      );
    } catch {
      setRealRequests([]);
    }
  }, [session]);

  // Phase 6B-9 — the real notifications visible to the signed-in session,
  // exposed as its own context field, deliberately separate from
  // `notifications` (which stays exactly `store.notifications`,
  // unconditionally local/demo). RLS alone scopes what a plain SELECT
  // returns (own, or every notification for HR) — no client-side WHERE
  // clause needed. Every row is created exclusively inside submit_leave_request/
  // submit_mission_request/submit_permission_request/decide_request, as part
  // of the same transaction that submits or decides a request — never from
  // this client, so a refetch (including this one, on session change) can
  // never create a duplicate; it only ever re-reads existing rows.
  const [realNotifications, setRealNotifications] = useState<NotificationRecord[]>([]);

  const fetchRealNotifications = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase || !session) {
      setRealNotifications([]);
      return;
    }
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, user_id, type, request_id, message, read, created_at")
        .order("created_at", { ascending: false });
      if (error || !data) {
        setRealNotifications([]);
        return;
      }
      setRealNotifications(data.map(mapNotificationRowToNotificationRecord));
    } catch {
      setRealNotifications([]);
    }
  }, [session]);

  // Real users only (Phase 6B-9) — UPDATE (read) is the only column grant
  // notifications_update_own_or_hr allows; RLS re-enforces "own row, or HR"
  // server-side regardless of what id is passed.
  async function markRealNotificationRead(id: string): Promise<{ ok: boolean; error?: string }> {
    if (!supabase) return { ok: false, error: "Supabase is not configured in this environment." };
    const { error } = await supabase.from("notifications").update({ read: true }).eq("id", id);
    if (error) return { ok: false, error: error.message };
    await fetchRealNotifications();
    return { ok: true };
  }

  // Real users only — always scoped to the caller's own notifications via
  // auth.uid(), same isolation rule as the demo markAllNotificationsRead
  // (which is likewise only ever called with the caller's own session id).
  async function markAllRealNotificationsRead(): Promise<{ ok: boolean; error?: string }> {
    if (!supabase || !session) return { ok: false, error: "Supabase is not configured in this environment." };
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", session.user.id);
    if (error) return { ok: false, error: error.message };
    await fetchRealNotifications();
    return { ok: true };
  }

  // Phase 6B-10 — the real attendance visible to the signed-in session,
  // exposed as its own context field, deliberately separate from
  // `attendance` (which stays exactly `store.attendance`, unconditionally
  // local/demo). RLS alone scopes what a plain SELECT returns
  // (attendance_select_self_or_hr: own rows for a real employee, every row
  // for real HR) — no client-side WHERE clause needed. The same fetch and
  // field serve both a real employee's own calendar/permission-balance and
  // real HR's management page, exactly like realRequests serves both My
  // Requests and Manager Requests.
  const [realAttendance, setRealAttendance] = useState<AttendanceRecord[]>([]);

  const fetchRealAttendance = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase || !session) {
      setRealAttendance([]);
      return;
    }
    try {
      const { data, error } = await supabase
        .from("attendance")
        .select("id, employee_id, date, check_in, check_out, note, recorded_by, recorded_at, source, late_minutes, early_minutes, overtime_minutes")
        .order("date", { ascending: false });
      if (error || !data) {
        setRealAttendance([]);
        return;
      }
      setRealAttendance(data.map(mapAttendanceRowToAttendanceRecord));
    } catch {
      setRealAttendance([]);
    }
  }, [session]);

  // Re-fetch whenever the signed-in session changes (login/logout/switching
  // accounts) — RLS (Phase 3) scopes what comes back to whatever the current
  // session is actually allowed to see (self/reports/own-manager for a
  // regular employee, everything for HR/TM/GM); a local demo session simply
  // gets an empty result back (no Supabase session token to attach, so the
  // request runs as `anon`, which has zero grants on `profiles`), which
  // fetchRemoteEmployees already treats as "no remote employees" — never a
  // crash. Departments RLS (departments_select_active) and leave_types RLS
  // (leave_types_select_active) similarly return only ACTIVE rows to a
  // non-HR session, all rows to HR. public_holidays has no active/inactive
  // concept at all (public_holidays_select_all is USING (true)) — every row
  // is visible to every authenticated session, real HR included; only
  // INSERT/DELETE are HR-gated. leave_allocations' own RLS (self-or-HR)
  // means a demo session's query (an invalid UUID against profile_id, run
  // as anon regardless) simply errors and falls back to {ANNUAL:0,CASUAL:0}
  // — never a crash, and never applied to a demo employee's own entitlements
  // (see useMyBalances/LeaveRequestPage's real-only guard). requests' own
  // RLS behaves identically for a demo session — anon has zero grants there
  // either, so fetchRealRequests degrades to [] just as gracefully.
  useEffect(() => {
    fetchRemoteEmployees();
    fetchDepartments();
    fetchApprovalRouting();
    fetchRemoteLeaveTypes();
    fetchRemoteHolidays();
    fetchMyLeaveAllocations();
    fetchRealRequests();
    fetchRealNotifications();
    fetchRealAttendance();
  }, [
    session,
    fetchRemoteEmployees,
    fetchDepartments,
    fetchApprovalRouting,
    fetchRemoteLeaveTypes,
    fetchRemoteHolidays,
    fetchMyLeaveAllocations,
    fetchRealRequests,
    fetchRealNotifications,
    fetchRealAttendance,
  ]);

  // The one list every page already reads via useStore().employees — local
  // demo roster first, then real Supabase employees. No id collision is
  // possible (EMP-NNNNN-shaped strings vs. real UUIDs).
  const employees = [...store.employees, ...remoteEmployees];

  function isRemoteEmployee(id: string): boolean {
    return remoteEmployees.some((e) => e.id === id);
  }

  // Persist as an effect rather than inside the updater. Writing to storage from
  // within a state updater is a side effect in a reducer, which React 18
  // StrictMode double-invokes in development.
  useEffect(() => { saveStore(store); }, [store]);

  function mutate(updater: (prev: StoreData) => StoreData) {
    setStore(updater);
  }

  // Phase 6B-4 — real employees only. Entirely separate from
  // createLeaveRequest below (untouched, demo/local-only forever going
  // forward): a real employee is never required to exist in
  // store.employees to submit Leave, which is exactly what previously
  // produced the incorrect "Your account is inactive" message for a real
  // account (a pre-existing Phase 6A gap in the local-only path, not fixed
  // by patching that path — fixed by not routing real submissions through
  // it at all). submit_leave_request derives employee identity from
  // auth.uid(), and is itself authoritative for active-profile, active
  // manager, leave-type validity, date order, working-day count, overlap,
  // and balance — none of that is duplicated or re-checked here.
  async function submitRealLeaveRequest(data: {
    leaveTypeId: string;
    startDate: string;
    endDate: string;
    reason?: string;
  }): Promise<{ ok: true; request: RequestRecord } | { ok: false; error: string }> {
    if (!supabase) return { ok: false, error: "Supabase is not configured in this environment." };

    const { data: row, error } = await supabase.rpc("submit_leave_request", {
      p_leave_type_id: data.leaveTypeId,
      p_start_date: data.startDate,
      p_end_date: data.endDate,
      p_reason: data.reason ?? null,
    });
    if (error) return { ok: false, error: error.message };

    // The request already committed server-side at this point — a failure
    // reading back its approval rows is not a submission failure, just an
    // incomplete chain in the immediate confirmation view.
    const { data: approvalRows, error: approvalError } = await supabase
      .from("request_approvals")
      .select("stage, role, title, approver_id, approver_name, status, decided_at, comment")
      .eq("request_id", row.id)
      .order("stage");

    const request = mapRequestRowToRequestRecord(
      row,
      approvalError || !approvalRows ? [] : approvalRows.map(mapApprovalRowToApprovalStep)
    );
    // Keep realRequests in sync so My Requests/calendar reflect this
    // submission without requiring a manual refresh (Phase 6B-7). The RPC
    // already inserted a REQUEST_SUBMITTED notification for the first-stage
    // approver in the same transaction (Phase 6B-9) — this only re-reads it.
    await fetchRealRequests();
    await fetchRealNotifications();
    return { ok: true, request };
  }

  function createLeaveRequest(
    employeeId: string, employeeName: string,
    data: { leaveType: string; startDate: string; endDate: string; reason?: string }
  ) {
    // An inactive employee must not be able to submit, and an inactive approver
    // must not be able to receive. Both were previously unchecked.
    const author = store.employees.find((e) => e.id === employeeId);
    if (!author || author.status !== "ACTIVE") {
      return { ok: false as const, errors: { _form: "Your account is inactive. Contact HR." } };
    }
    const manager = getManagerForEmployee(store.employees, employeeId);
    if (!manager || manager.status !== "ACTIVE" || !isApprover(manager.role)) {
      return { ok: false as const, errors: { _form: "No active manager assigned. Contact HR." } };
    }
    // Every request walks the same three stages: direct manager, technical
    // manager, general manager. The chain is snapshotted now, so a later
    // reorganisation cannot re-route a request that is already in flight.
    const chain = buildApprovalChain(store.employees, employeeId);
    if (chain.length === 0) {
      return { ok: false as const, errors: { _form: "No approval chain is configured. Contact HR." } };
    }
    const errs = validateLeaveFields(
      data,
      store.requests.filter((r) => r.employeeId === employeeId),
      store.leaveTypes,
      { employee: author, allRequests: store.requests, holidays: store.holidays }
    );
    if (Object.keys(errs).length > 0) return { ok: false as const, errors: errs };

    const leaveTypeRecord = store.leaveTypes.find((lt) => lt.name === data.leaveType);
    const balanceKey = leaveTypeRecord?.balanceKey ?? null;
    const workingDays = countWorkingDays(data.startDate, data.endDate, store.holidays);

    // requestNumber is minted from p.nextSeq inside the updater. Reading
    // store.nextSeq from the render closure made two quick submissions, or two
    // tabs, both mint REQ-00001.
    const id = crypto.randomUUID();
    const submittedAt = new Date().toISOString();
    let created!: RequestRecord;

    mutate((p) => {
      created = {
        id, requestNumber: `REQ-${String(p.nextSeq).padStart(5, "0")}`,
        employeeId, employeeName,
        managerId: chain[0].approverId, managerName: chain[0].approverName,
        approvals: chain,
        type: "LEAVE", status: "PENDING", submittedAt,
        leaveType: data.leaveType, balanceKey, workingDays,
        startDate: data.startDate,
        endDate: data.endDate, reason: data.reason,
      };
      const notif: NotificationRecord = {
        id: `ntf-${id}-stage1`, userId: chain[0].approverId, type: "REQUEST_SUBMITTED",
        requestId: id, message: `${employeeName} submitted a ${data.leaveType} request for your approval.`,
        read: false, createdAt: submittedAt,
      };
      return { ...p, requests: [...p.requests, created], notifications: [...p.notifications, notif], nextSeq: p.nextSeq + 1 };
    });

    return { ok: true as const, request: created };
  }

  // Phase 6B-5 — real employees only, same shape/reasoning as
  // submitRealLeaveRequest: entirely separate from createMissionRequest
  // below (untouched, demo-only). submit_mission_request derives identity
  // from auth.uid() and is itself authoritative for active-profile,
  // active-manager, required fields, full-datetime ordering (already fixed
  // — no raw TIME comparison), and approval-chain construction.
  async function submitRealMissionRequest(data: {
    startDate: string;
    startTime: string;
    endDate: string;
    endTime: string;
    location: string;
    purpose: string;
  }): Promise<{ ok: true; request: RequestRecord } | { ok: false; error: string }> {
    if (!supabase) return { ok: false, error: "Supabase is not configured in this environment." };

    const { data: row, error } = await supabase.rpc("submit_mission_request", {
      p_start_date: data.startDate,
      p_start_time: data.startTime,
      p_end_date: data.endDate,
      p_end_time: data.endTime,
      p_location: data.location,
      p_purpose: data.purpose,
    });
    if (error) return { ok: false, error: error.message };

    const { data: approvalRows, error: approvalError } = await supabase
      .from("request_approvals")
      .select("stage, role, title, approver_id, approver_name, status, decided_at, comment")
      .eq("request_id", row.id)
      .order("stage");

    const request = mapRequestRowToRequestRecord(
      row,
      approvalError || !approvalRows ? [] : approvalRows.map(mapApprovalRowToApprovalStep)
    );
    // Keep realRequests in sync so My Requests/calendar reflect this
    // submission without requiring a manual refresh (Phase 6B-7). The RPC
    // already inserted a REQUEST_SUBMITTED notification for the first-stage
    // approver in the same transaction (Phase 6B-9) — this only re-reads it.
    await fetchRealRequests();
    await fetchRealNotifications();
    return { ok: true, request };
  }

  function createMissionRequest(
    employeeId: string, employeeName: string,
    data: { startDate: string; startTime: string; endDate: string; endTime: string; location: string; purpose: string }
  ) {
    // An inactive employee must not be able to submit, and an inactive approver
    // must not be able to receive. Both were previously unchecked.
    const author = store.employees.find((e) => e.id === employeeId);
    if (!author || author.status !== "ACTIVE") {
      return { ok: false as const, errors: { _form: "Your account is inactive. Contact HR." } };
    }
    const manager = getManagerForEmployee(store.employees, employeeId);
    if (!manager || manager.status !== "ACTIVE" || !isApprover(manager.role)) {
      return { ok: false as const, errors: { _form: "No active manager assigned. Contact HR." } };
    }
    // Every request walks the same three stages: direct manager, technical
    // manager, general manager. The chain is snapshotted now, so a later
    // reorganisation cannot re-route a request that is already in flight.
    const chain = buildApprovalChain(store.employees, employeeId);
    if (chain.length === 0) {
      return { ok: false as const, errors: { _form: "No approval chain is configured. Contact HR." } };
    }
    const errs = validateMissionFields(data);
    if (Object.keys(errs).length > 0) return { ok: false as const, errors: errs };

    const id = crypto.randomUUID();
    const submittedAt = new Date().toISOString();
    let created!: RequestRecord;

    mutate((p) => {
      created = {
        id, requestNumber: `REQ-${String(p.nextSeq).padStart(5, "0")}`,
        employeeId, employeeName,
        managerId: chain[0].approverId, managerName: chain[0].approverName,
        approvals: chain,
        type: "MISSION", status: "PENDING", submittedAt,
        startDate: data.startDate, startTime: data.startTime,
        endDate: data.endDate, endTime: data.endTime,
        location: data.location, purpose: data.purpose,
      };
      const notif: NotificationRecord = {
        id: `ntf-${id}-stage1`, userId: chain[0].approverId, type: "REQUEST_SUBMITTED",
        requestId: id, message: `${employeeName} submitted a Mission request for your approval.`,
        read: false, createdAt: submittedAt,
      };
      return { ...p, requests: [...p.requests, created], notifications: [...p.notifications, notif], nextSeq: p.nextSeq + 1 };
    });

    return { ok: true as const, request: created };
  }

  // Phase 6B-5 — real employees only, same shape/reasoning as
  // submitRealLeaveRequest/submitRealMissionRequest. submit_permission_request
  // is itself authoritative for active-profile, active-manager, the
  // weekend/holiday check, the 240-minute cap, one-per-day (advisory-locked),
  // and balance — none of that is duplicated here.
  async function submitRealPermissionRequest(data: {
    permissionKind: PermissionKind;
    date: string;
    minutes: number;
    reason?: string;
  }): Promise<{ ok: true; request: RequestRecord } | { ok: false; error: string }> {
    if (!supabase) return { ok: false, error: "Supabase is not configured in this environment." };

    const { data: row, error } = await supabase.rpc("submit_permission_request", {
      p_permission_kind: data.permissionKind,
      p_date: data.date,
      p_minutes: data.minutes,
      p_reason: data.reason ?? null,
    });
    if (error) return { ok: false, error: error.message };

    const { data: approvalRows, error: approvalError } = await supabase
      .from("request_approvals")
      .select("stage, role, title, approver_id, approver_name, status, decided_at, comment")
      .eq("request_id", row.id)
      .order("stage");

    const request = mapRequestRowToRequestRecord(
      row,
      approvalError || !approvalRows ? [] : approvalRows.map(mapApprovalRowToApprovalStep)
    );
    // Keep realRequests in sync so My Requests/calendar reflect this
    // submission without requiring a manual refresh (Phase 6B-7). The RPC
    // already inserted a REQUEST_SUBMITTED notification for the Direct
    // Manager in the same transaction (Phase 6B-9) — this only re-reads it.
    await fetchRealRequests();
    await fetchRealNotifications();
    return { ok: true, request };
  }

  // A permission is a short absence measured in minutes, not days, so it takes
  // the short route: the direct manager decides it and nobody above is involved.
  function createPermissionRequest(
    employeeId: string, employeeName: string,
    data: { permissionKind: PermissionKind; date: string; minutes: number; reason?: string }
  ) {
    const author = store.employees.find((e) => e.id === employeeId);
    if (!author || author.status !== "ACTIVE") {
      return { ok: false as const, errors: { _form: "Your account is inactive. Contact HR." } };
    }

    const manager = getManagerForEmployee(store.employees, employeeId);
    if (!manager || manager.status !== "ACTIVE" || !isApprover(manager.role)) {
      return { ok: false as const, errors: { _form: "No active manager assigned. Contact HR." } };
    }

    const errs = validatePermissionFields(data, {
      employee: author,
      allRequests: store.requests,
      attendance: store.attendance,
      holidays: store.holidays,
    });
    if (Object.keys(errs).length > 0) return { ok: false as const, errors: errs };

    const chain: ApprovalStep[] = [{
      stage: 1,
      role: manager.role,
      title: ROLE_LABEL[manager.role],
      approverId: manager.id,
      approverName: manager.name,
      status: "PENDING",
    }];

    const id = crypto.randomUUID();
    const submittedAt = new Date().toISOString();
    let created!: RequestRecord;

    mutate((p) => {
      created = {
        id, requestNumber: `REQ-${String(p.nextSeq).padStart(5, "0")}`,
        employeeId, employeeName,
        managerId: manager.id, managerName: manager.name,
        approvals: chain,
        type: "PERMISSION", status: "PENDING", submittedAt,
        permissionKind: data.permissionKind,
        permissionMinutes: data.minutes,
        startDate: data.date, endDate: data.date,
        reason: data.reason,
      };
      const notif: NotificationRecord = {
        id: `ntf-${id}-stage1`, userId: manager.id, type: "REQUEST_SUBMITTED",
        requestId: id,
        message: `${employeeName} requested ${PERMISSION_LABEL[data.permissionKind].toLowerCase()} (${formatMinutes(data.minutes)}) for your approval.`,
        read: false, createdAt: submittedAt,
      };
      return { ...p, requests: [...p.requests, created], notifications: [...p.notifications, notif], nextSeq: p.nextSeq + 1 };
    });

    return { ok: true as const, request: created };
  }

  // ─── Attendance (HR) ────────────────────────────────────────────────────────
  // Entered from the fingerprint device. Lateness is charged automatically, so
  // there is no separate "deduct" action to forget to run.

  // Real path is HR-only (attendance_insert_hr/attendance_update_hr RLS
  // re-enforces server-side, same as every other HR-authored real write in
  // this app — see createHoliday/deleteHoliday for the identical branching
  // shape). Upserts on the table's own UNIQUE (employee_id, date)
  // constraint, matching the existing "re-entering a day corrects it" demo
  // behavior exactly — no separate update-vs-insert branch needed.
  async function recordAttendance(
    data: { employeeId: string; date: string; checkIn?: string; checkOut?: string; note?: string },
    recordedBy: string
  ): Promise<{ ok: boolean; error?: string }> {
    if (!data.employeeId) return { ok: false, error: "Choose an employee." };
    if (!data.date) return { ok: false, error: "Choose a date." };
    if (!data.checkIn && !data.checkOut) {
      return { ok: false, error: "Enter a check-in time, a check-out time, or both." };
    }
    if (data.checkIn && data.checkOut && minutesOfDay(data.checkOut) <= minutesOfDay(data.checkIn)) {
      return { ok: false, error: "Check-out must be after check-in." };
    }
    // employees (not store.employees) — the picker on HRAttendancePage
    // already offers both demo and real employees together.
    if (!employees.some((e) => e.id === data.employeeId)) {
      return { ok: false, error: "Employee not found." };
    }

    if (session && isRemoteEmployee(recordedBy)) {
      if (!supabase) return { ok: false, error: "Supabase is not configured in this environment." };
      const { error } = await supabase
        .from("attendance")
        .upsert(
          {
            employee_id: data.employeeId,
            date: data.date,
            check_in: data.checkIn || null,
            check_out: data.checkOut || null,
            note: data.note?.trim() || null,
            recorded_by: recordedBy,
          },
          { onConflict: "employee_id,date" }
        );
      if (error) return { ok: false, error: error.message };
      await fetchRealAttendance();
      return { ok: true };
    }

    const recordedAt = new Date().toISOString();

    mutate((p) => {
      // One record per employee per day: re-entering a day corrects it rather
      // than double-charging the allowance.
      const rest = p.attendance.filter(
        (a) => !(a.employeeId === data.employeeId && a.date === data.date)
      );
      const record: AttendanceRecord = {
        id: `att-${data.employeeId}-${data.date}`,
        employeeId: data.employeeId,
        date: data.date,
        checkIn: data.checkIn || undefined,
        checkOut: data.checkOut || undefined,
        note: data.note?.trim() || undefined,
        recordedBy,
        recordedAt,
      };
      return { ...p, attendance: [...rest, record] };
    });

    return { ok: true };
  }

  async function deleteAttendance(id: string): Promise<void> {
    if (session && isRemoteEmployee(session.user.id)) {
      if (!supabase) return;
      const { error } = await supabase.from("attendance").delete().eq("id", id);
      if (!error) await fetchRealAttendance();
      return;
    }
    mutate((p) => ({ ...p, attendance: p.attendance.filter((a) => a.id !== id) }));
  }

  // Attendance Excel import (real HR only — demo mode has no fingerprint
  // export to import). hr_import_attendance (20260909110000) stores each
  // row's ACTUAL clock_in/clock_out verbatim alongside the Excel's own
  // explicit late/early/overtime minutes — nothing here synthesizes a
  // timestamp or trusts a client-side balance total; the RPC's
  // inserted/skipped counts and a fetchRealAttendance() refetch are the
  // only things the caller acts on afterward.
  async function importAttendance(
    employeeId: string,
    rows: {
      date: string;
      clockIn: string | null;
      clockOut: string | null;
      lateMinutes: number;
      earlyMinutes: number;
      overtimeMinutes: number;
    }[]
  ): Promise<{ ok: true; insertedCount: number; skippedCount: number } | { ok: false; error: string }> {
    if (!supabase) return { ok: false, error: "Supabase is not configured in this environment." };
    if (!session || !isRemoteEmployee(session.user.id)) {
      return { ok: false, error: "Attendance import is only available for a signed-in HR account." };
    }

    const { data, error } = await supabase.rpc("hr_import_attendance", {
      p_employee_id: employeeId,
      p_rows: rows.map((r) => ({
        date: r.date,
        clock_in: r.clockIn,
        clock_out: r.clockOut,
        late_minutes: r.lateMinutes,
        early_minutes: r.earlyMinutes,
        overtime_minutes: r.overtimeMinutes,
      })),
    });
    if (error) return { ok: false, error: error.message };

    const result = Array.isArray(data) ? data[0] : data;
    await fetchRealAttendance();
    return { ok: true, insertedCount: result?.inserted_count ?? 0, skippedCount: result?.skipped_count ?? 0 };
  }

  // Real path is HR-only (public_holidays_insert_hr RLS re-checks this
  // server-side too — the frontend is never the security boundary). No
  // status/archive concept exists on either layer — add/remove only,
  // matching public_holidays' own RLS (INSERT/DELETE grants, no UPDATE).
  async function createHoliday(date: string, name: string): Promise<{ ok: boolean; error?: string }> {
    if (!date) return { ok: false, error: "Choose a date." };
    const trimmed = name.trim();
    if (!trimmed) return { ok: false, error: "Give the holiday a name." };

    if (session && isRemoteEmployee(session.user.id)) {
      if (!supabase) return { ok: false, error: "Supabase is not configured in this environment." };
      if (remoteHolidays.some((h) => h.date === date)) {
        return { ok: false, error: "That date is already a public holiday." };
      }
      const { error } = await supabase.from("public_holidays").insert({ date, name: trimmed });
      if (error) {
        return {
          ok: false,
          error: error.code === "23505" ? "That date is already a public holiday." : error.message,
        };
      }
      await fetchRemoteHolidays();
      return { ok: true };
    }

    // Unchanged local demo path.
    if (store.holidays.some((h) => h.date === date)) {
      return { ok: false, error: "That date is already a public holiday." };
    }
    mutate((p) => ({
      ...p,
      holidays: [...p.holidays, { id: `hol-${p.nextHolidaySeq}`, date, name: trimmed }]
        .sort((a, b) => a.date.localeCompare(b.date)),
      nextHolidaySeq: p.nextHolidaySeq + 1,
    }));
    return { ok: true };
  }

  // Real path HR-only (public_holidays_delete_hr RLS re-checks server-side).
  async function deleteHoliday(id: string): Promise<{ ok: boolean; error?: string }> {
    if (session && isRemoteEmployee(session.user.id)) {
      if (!supabase) return { ok: false, error: "Supabase is not configured in this environment." };
      const { error } = await supabase.from("public_holidays").delete().eq("id", id);
      if (error) return { ok: false, error: error.message };
      await fetchRemoteHolidays();
      return { ok: true };
    }

    // Unchanged local demo path.
    mutate((p) => ({ ...p, holidays: p.holidays.filter((h) => h.id !== id) }));
    return { ok: true };
  }

  // Real path is HR-only (public_holidays_update_hr RLS re-checks
  // server-side too). Same validation as createHoliday: a date and a
  // non-empty name are required, and the date must not collide with a
  // different holiday — excluding this row itself, which would otherwise
  // always match its own current date.
  async function updateHoliday(id: string, date: string, name: string): Promise<{ ok: boolean; error?: string }> {
    if (!date) return { ok: false, error: "Choose a date." };
    const trimmed = name.trim();
    if (!trimmed) return { ok: false, error: "Give the holiday a name." };

    if (session && isRemoteEmployee(session.user.id)) {
      if (!supabase) return { ok: false, error: "Supabase is not configured in this environment." };
      if (remoteHolidays.some((h) => h.date === date && h.id !== id)) {
        return { ok: false, error: "That date is already a public holiday." };
      }
      const { error } = await supabase.from("public_holidays").update({ date, name: trimmed }).eq("id", id);
      if (error) {
        return {
          ok: false,
          error: error.code === "23505" ? "That date is already a public holiday." : error.message,
        };
      }
      await fetchRemoteHolidays();
      return { ok: true };
    }

    // Unchanged local demo path.
    if (store.holidays.some((h) => h.date === date && h.id !== id)) {
      return { ok: false, error: "That date is already a public holiday." };
    }
    mutate((p) => ({
      ...p,
      holidays: p.holidays
        .map((h) => (h.id === id ? { ...h, date, name: trimmed } : h))
        .sort((a, b) => a.date.localeCompare(b.date)),
    }));
    return { ok: true };
  }

  // Approving advances the request to the next stage in its snapshotted chain.
  // Only the last stage marks the whole request APPROVED. Rejection at any
  // stage closes the request immediately — there is no partial rejection.
  function decideRequest(
    requestId: string,
    approverId: string,
    decision: "APPROVED" | "REJECTED",
    comment: string
  ): { ok: boolean; error?: string } {
    if (decision === "REJECTED" && !comment.trim()) {
      return { ok: false, error: "A reason is required when rejecting a request." };
    }

    const req = store.requests.find((r) => r.id === requestId);
    if (!req) return { ok: false, error: "Request not found." };
    if (req.status !== "PENDING") return { ok: false, error: "This request has already been decided." };

    const step = currentStep(req);
    if (!step) return { ok: false, error: "This request has already been decided." };
    if (step.approverId !== approverId) {
      return { ok: false, error: `This request is waiting on ${step.approverName} (${step.title}).` };
    }

    const decidedAt = new Date().toISOString();
    const label = requestLabel(req);

    mutate((prev) => {
      const target = prev.requests.find((r) => r.id === requestId);
      if (!target || target.status !== "PENDING") return prev;

      const live = currentStep(target);
      if (!live || live.approverId !== approverId) return prev;

      const approvals = target.approvals.map((a) =>
        a.stage === live.stage
          ? { ...a, status: decision, decidedAt, comment: comment.trim() || undefined }
          : a
      );

      const nextStep = decision === "APPROVED"
        ? approvals.find((a) => a.status === "PENDING") ?? null
        : null;

      const finished = decision === "REJECTED" || nextStep === null;

      const updated: RequestRecord = {
        ...target,
        approvals,
        status: finished ? decision : "PENDING",
        decidedAt: finished ? decidedAt : undefined,
        decisionComment: finished ? (comment.trim() || undefined) : undefined,
      };

      const notifications: NotificationRecord[] = [];

      if (decision === "REJECTED") {
        notifications.push({
          id: `ntf-${requestId}-rejected`, userId: target.employeeId, type: "REQUEST_REJECTED",
          requestId,
          message: `Your ${label} request (${target.requestNumber}) was rejected by ${live.approverName} (${live.title}).`,
          read: false, createdAt: decidedAt,
        });
      } else if (nextStep) {
        // Tell the employee it moved, and tell the next approver it is theirs.
        notifications.push({
          id: `ntf-${requestId}-stage${live.stage}-ok`, userId: target.employeeId, type: "REQUEST_ADVANCED",
          requestId,
          message: `${live.approverName} approved your ${label} request (${target.requestNumber}). Now with ${nextStep.approverName} for ${nextStep.title.toLowerCase()} approval.`,
          read: false, createdAt: decidedAt,
        });
        notifications.push({
          id: `ntf-${requestId}-stage${nextStep.stage}`, userId: nextStep.approverId, type: "REQUEST_SUBMITTED",
          requestId,
          message: `${target.employeeName}'s ${label} request (${target.requestNumber}) is awaiting your approval.`,
          read: false, createdAt: decidedAt,
        });
      } else {
        notifications.push({
          id: `ntf-${requestId}-approved`, userId: target.employeeId, type: "REQUEST_APPROVED",
          requestId,
          message: `Your ${label} request (${target.requestNumber}) has been fully approved.`,
          read: false, createdAt: decidedAt,
        });
      }

      return {
        ...prev,
        requests: prev.requests.map((r) => (r.id === requestId ? updated : r)),
        notifications: [...prev.notifications, ...notifications],
      };
    });

    return { ok: true };
  }

  function approveRequest(requestId: string, approverId: string, comment = "") {
    return decideRequest(requestId, approverId, "APPROVED", comment);
  }

  function rejectRequest(requestId: string, approverId: string, comment: string) {
    return decideRequest(requestId, approverId, "REJECTED", comment);
  }

  // employeeId is always the caller's own session id (see call site), never a
  // value read off the request or supplied by a form — canEmployeeDeleteRequest
  // re-derives ownership and stage from the request itself, so a request
  // cannot be deleted by guessing another employee's id or another request's id.
  function deleteRequest(requestId: string, employeeId: string) {
    const req = store.requests.find((r) => r.id === requestId);
    if (!req) return { ok: false, error: "Request not found." };
    if (!canEmployeeDeleteRequest(req, employeeId)) {
      return {
        ok: false,
        error: req.employeeId !== employeeId
          ? "You can only delete your own requests."
          : "This request can no longer be deleted — your Direct Manager has already acted on it.",
      };
    }

    mutate((prev) => {
      const target = prev.requests.find((r) => r.id === requestId);
      if (!target || !canEmployeeDeleteRequest(target, employeeId)) return prev;

      return {
        ...prev,
        requests: prev.requests.filter((r) => r.id !== requestId),
        // The manager's "awaiting your approval" notification (and any other
        // notification about this request) would otherwise point at nothing.
        notifications: prev.notifications.filter((n) => n.requestId !== requestId),
      };
    });

    return { ok: true };
  }

  // Phase 6B-6 — real employees only. Entirely separate from deleteRequest
  // above (untouched, demo-only): delete_own_request re-derives ownership,
  // PENDING status, and stage-1 (Direct Manager not yet decided) itself
  // from auth.uid() and the actual request/request_approvals rows — nothing
  // here is trusted from the client, this call is a thin pass-through.
  async function deleteRealRequest(requestId: string): Promise<{ ok: boolean; error?: string }> {
    if (!supabase) return { ok: false, error: "Supabase is not configured in this environment." };
    const { error } = await supabase.rpc("delete_own_request", { p_request_id: requestId });
    if (error) return { ok: false, error: error.message };
    // Keep realRequests in sync so it no longer appears (Phase 6B-7).
    // request_id has ON DELETE CASCADE on notifications, so any notification
    // tied to this request is already gone server-side — this just re-reads
    // that (Phase 6B-9).
    await fetchRealRequests();
    await fetchRealNotifications();
    return { ok: true };
  }

  // Phase 6B-8 — real approvers only. Entirely separate from
  // approveRequest/rejectRequest below (untouched, demo-only): decide_request
  // re-derives caller identity, the current pending stage, and its approver
  // from auth.uid() and the actual request_approvals rows — nothing here is
  // trusted from the client except which request, which action, and an
  // optional comment. Sequential advancement, final-GM-stage completion, and
  // rejection are entirely server-side (see the RPC itself).
  async function decideRealRequest(
    requestId: string,
    action: "APPROVE" | "REJECT",
    comment?: string
  ): Promise<{ ok: boolean; error?: string }> {
    if (!supabase) return { ok: false, error: "Supabase is not configured in this environment." };
    const { error } = await supabase.rpc("decide_request", {
      p_request_id: requestId,
      p_action: action,
      p_comment: comment ?? null,
    });
    if (error) return { ok: false, error: error.message };
    // Keep realRequests in sync — moves off this approver's Pending Requests,
    // and (for an APPROVE that advances the chain) becomes visible to the
    // next approver's own next fetch, immediately reflected here for this
    // session's own detail/timeline view. decide_request already inserted
    // the relevant notification(s) — REJECTED to the requester, or
    // ADVANCED+SUBMITTED to requester+next approver, or APPROVED to the
    // requester on final GM approval — in the same transaction (Phase
    // 6B-9); this only re-reads them.
    await fetchRealRequests();
    await fetchRealNotifications();
    return { ok: true };
  }

  function markNotificationRead(id: string) {
    mutate((p) => ({ ...p, notifications: p.notifications.map((n) => n.id === id ? { ...n, read: true } : n) }));
  }

  // Only ever called with the caller's own session id (see call sites) — this
  // touches notifications for that one userId and leaves every other user's
  // notifications untouched, same isolation rule as markNotificationRead.
  function markAllNotificationsRead(userId: string) {
    mutate((p) => ({
      ...p,
      notifications: p.notifications.map((n) => (n.userId === userId ? { ...n, read: true } : n)),
    }));
  }

  // Phase 6A: EMPLOYEE/MANAGER creation goes through the real Edge Function
  // (provisionEmployeeAccount), never the local store — creation is now 100%
  // Supabase. TECH_MANAGER/GM/HR creation is explicitly out of scope (no RPC
  // exists for it yet; see the Phase 6 audit) and is declined with a clear
  // message rather than left to fail confusingly against the server.
  async function createEmployee(data: CreateEmployeeInput) {
    if (data.role !== "EMPLOYEE" && data.role !== "MANAGER") {
      return {
        ok: false as const,
        errors: { role: "Creating this role isn't available yet — only Employee and Direct Manager accounts can be created here." },
      };
    }

    const errs = validateEmployeeFields(data, employees);
    if (Object.keys(errs).length > 0) return { ok: false as const, errors: errs };

    // A locally-seeded demo manager has no matching row in Supabase at all,
    // so it can never be a real employee's manager_id — reject clearly
    // rather than letting the server-side uuid cast fail unreadably.
    if (data.managerId && !isRemoteEmployee(data.managerId)) {
      return {
        ok: false as const,
        errors: { managerId: "Selected manager is a demo account and cannot be assigned to a real employee yet." },
      };
    }
    // Same reasoning for team members offered to a newly created manager —
    // only real candidates are ever sent to the RPC.
    const teamMemberIds = (data.teamMemberIds ?? []).filter((memberId) => isRemoteEmployee(memberId));

    const result = await provisionEmployeeAccount({
      role: data.role,
      employeeCode: data.employeeCode,
      password: data.password,
      firstName: data.firstName,
      lastName: data.lastName,
      position: data.position,
      departmentId: data.departmentId,
      email: data.email,
      phone: data.phone,
      managerId: data.managerId || null,
      permissionMinutesPerMonth: data.permissionMinutes,
      teamMemberIds,
    });

    if (!result.ok) {
      return { ok: false as const, errors: { _form: result.error } };
    }

    // The server is authoritative for id/employee_code (canonicalized
    // uppercase)/role/name; every other field is exactly what HR just typed
    // and the server already accepted.
    const employee: EmployeeProfile = {
      id: result.profile.id,
      employeeCode: result.profile.employee_code,
      name: result.profile.name,
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      position: data.position.trim(),
      department: departments.find((d) => d.id === data.departmentId)?.name ?? "",
      departmentId: data.departmentId,
      email: data.email.trim().toLowerCase(),
      phone: data.phone?.trim() || undefined,
      status: "ACTIVE",
      managerId: data.managerId || null,
      role: result.profile.role,
      entitlements: { ANNUAL: data.annualDays, CASUAL: data.casualDays },
      permissionMinutesPerMonth: data.permissionMinutes,
    };

    // Persist the Opening Balances the form just collected as real
    // leave_allocations rows (Phase 6B-3) — leave_allocations_insert_hr RLS
    // re-checks is_hr() server-side. The Auth account and profile already
    // exist at this point (provisionEmployeeAccount succeeded above); a
    // failure here doesn't undo that, since there is no safe client-side
    // rollback for an already-created Auth user — it is surfaced as a
    // non-blocking warning instead of silently discarded or failing the
    // whole (already-successful) creation.
    let warning: string | undefined;
    if (supabase) {
      const year = new Date().getFullYear();
      const { error: allocError } = await supabase.from("leave_allocations").insert([
        { profile_id: result.profile.id, bucket: "ANNUAL", year, allocated_days: data.annualDays },
        { profile_id: result.profile.id, bucket: "CASUAL", year, allocated_days: data.casualDays },
      ]);
      if (allocError) {
        warning = `Employee created, but the opening leave balance could not be saved: ${allocError.message}`;
      }
    }

    // Re-fetch rather than hand-patch the local cache: creating a manager
    // with a team reassigns those team members' manager_id server-side
    // (hr_create_manager_with_team), and a plain re-fetch is the simplest
    // way to guarantee the local view reflects that immediately rather than
    // only after the next unrelated refresh.
    await fetchRemoteEmployees();

    return { ok: true as const, employee, password: data.password, warning };
  }

  async function updateEmployee(id: string, data: Partial<EmployeeProfile>): Promise<{ ok: boolean; error?: string }> {
    const target = employees.find((e) => e.id === id);
    if (!target) return { ok: false, error: "Employee not found." };

    // Guard the quick Activate/Deactivate action too, not just the edit form
    // — applies the same way to local demo and real employees, since this
    // rule has always been enforced client-side only, on either path.
    const reports = employees.filter((e) => e.managerId === id);
    if (data.status === "INACTIVE" && target.role === "MANAGER" && reports.length > 0) {
      return {
        ok: false,
        error: `${reports.length} employee${reports.length === 1 ? "" : "s"} still report to ${target.name}. Reassign them first.`,
      };
    }

    if (isRemoteEmployee(id)) {
      if (!supabase) return { ok: false, error: "Supabase is not configured in this environment." };

      // setApprovalRouting/set_approval_routing (Phase 6A.1, HR Settings →
      // Approval Routing) is the only safe way to promote someone to
      // Technical Manager/General Manager — a raw profiles UPDATE here would
      // bypass its ordering guarantees against the partial-unique-index
      // (profiles_one_active_tech_manager/profiles_one_active_gm) and would
      // leave company_approval_routing — the actual source build_approval_chain
      // reads — out of sync with profiles.role. Both singleton indexes and
      // the routing RPC already exist and are already in active use; this is
      // a deliberate redirect to that dedicated flow, not a missing feature.
      if ((data.role === "TECH_MANAGER" || data.role === "GM") && target.role !== data.role) {
        return {
          ok: false,
          error: "Promoting to Technical Manager or General Manager isn't done from Edit Employee — use Approval Routing in HR Settings instead, which keeps the role and the approval chain in sync.",
        };
      }
      if (data.managerId && !isRemoteEmployee(data.managerId)) {
        return { ok: false, error: "Selected manager is a demo account and cannot be assigned to a real employee yet." };
      }

      const patch: Record<string, unknown> = {};
      if (data.firstName !== undefined) patch.first_name = data.firstName;
      if (data.lastName !== undefined) patch.last_name = data.lastName;
      if (data.firstName !== undefined || data.lastName !== undefined) {
        patch.name = `${data.firstName ?? target.firstName} ${data.lastName ?? target.lastName}`;
      }
      if (data.position !== undefined) patch.position = data.position;
      if (data.department !== undefined) patch.department = data.department;
      if (data.email !== undefined) patch.email = data.email;
      if (data.phone !== undefined) patch.phone = data.phone ?? null;
      if (data.status !== undefined) patch.status = data.status;
      if (data.role !== undefined) patch.role = data.role;
      if (data.managerId !== undefined) patch.manager_id = data.managerId;
      if (data.permissionMinutesPerMonth !== undefined) patch.permission_minutes_per_month = data.permissionMinutesPerMonth;
      if (data.departmentId !== undefined) patch.department_id = data.departmentId || null;
      // entitlements has no backing column on profiles itself — it is
      // written to leave_allocations separately below (Phase 6B-3).

      const { error } = await supabase.from("profiles").update(patch).eq("id", id);
      if (error) return { ok: false, error: error.message };

      // Opening Balances (Phase 6B-3) — leave_allocations_insert_hr/
      // _update_hr RLS re-check is_hr() server-side. upsert covers both "no
      // allocation yet" (insert) and "already has one for this year"
      // (update) in one call, matching the table's own
      // unique(profile_id, bucket, year) constraint.
      if (data.entitlements !== undefined) {
        const year = new Date().getFullYear();
        const { error: allocError } = await supabase.from("leave_allocations").upsert(
          [
            { profile_id: id, bucket: "ANNUAL", year, allocated_days: data.entitlements.ANNUAL },
            { profile_id: id, bucket: "CASUAL", year, allocated_days: data.entitlements.CASUAL },
          ],
          { onConflict: "profile_id,bucket,year" }
        );
        if (allocError) return { ok: false, error: allocError.message };
      }

      await fetchRemoteEmployees();
      return { ok: true };
    }

    // Unchanged local path for demo employees.
    mutate((p) => {
      const nextEmployees = p.employees.map((e) => {
        if (e.id !== id) return e;
        const updated = { ...e, ...data };
        if (data.firstName || data.lastName) {
          updated.name = `${updated.firstName} ${updated.lastName}`;
        }
        return updated;
      });
      return { ...p, employees: nextEmployees };
    });

    // Role, name and status are re-read from the employee record on every
    // sign-in, so the credential store only needs to know about revocation —
    // which now actually ends the affected user's live session.
    if (data.status !== undefined) {
      updateHRUserCredential(id, { active: data.status === "ACTIVE" });
    }

    return { ok: true };
  }

  // Real path is HR-only (leave_types_insert_hr RLS policy re-checks this
  // server-side too — the frontend is never the security boundary). Unlike
  // departments' name uniqueness, leave_types.name is a plain UNIQUE
  // constraint across every status, not a partial index scoped to ACTIVE —
  // so the duplicate check here matches against every fetched row,
  // including inactive ones, not just active ones.
  async function createLeaveType(
    name: string,
    balanceKey: BalanceKey | null,
    minimumNoticeDays: number = 0
  ): Promise<{ ok: boolean; error?: string; leaveType?: LeaveTypeRecord }> {
    const trimmed = name.trim();
    if (!trimmed) return { ok: false, error: "Name is required." };

    if (session && isRemoteEmployee(session.user.id)) {
      if (!supabase) return { ok: false, error: "Supabase is not configured in this environment." };
      if (remoteLeaveTypes.some((lt) => lt.name.toLowerCase() === trimmed.toLowerCase())) {
        return { ok: false, error: "A leave type with this name already exists." };
      }
      const { error } = await supabase
        .from("leave_types")
        .insert({ name: trimmed, balance_key: balanceKey, minimum_notice_days: minimumNoticeDays });
      if (error) {
        return {
          ok: false,
          error: error.code === "23505" ? "A leave type with this name already exists." : error.message,
        };
      }
      await fetchRemoteLeaveTypes();
      return { ok: true };
    }

    // Unchanged local demo path.
    const id = `lt-${store.nextLeaveTypeSeq}`;
    const lt: LeaveTypeRecord = { id, name: trimmed, status: "ACTIVE", balanceKey, minimumNoticeDays };
    mutate((p) => ({ ...p, leaveTypes: [...p.leaveTypes, lt], nextLeaveTypeSeq: p.nextLeaveTypeSeq + 1 }));
    return { ok: true, leaveType: lt };
  }

  // Covers rename (name/balanceKey) and activate/deactivate (status) —
  // real path HR-only, leave_types_update_hr RLS policy re-checks
  // server-side. No DELETE anywhere, matching leave_types' RLS exactly.
  async function updateLeaveType(
    id: string,
    updates: Partial<LeaveTypeRecord>
  ): Promise<{ ok: boolean; error?: string }> {
    if (session && isRemoteEmployee(session.user.id)) {
      if (!supabase) return { ok: false, error: "Supabase is not configured in this environment." };
      if (updates.name !== undefined) {
        const trimmed = updates.name.trim();
        if (!trimmed) return { ok: false, error: "Name is required." };
        if (remoteLeaveTypes.some((lt) => lt.id !== id && lt.name.toLowerCase() === trimmed.toLowerCase())) {
          return { ok: false, error: "A leave type with this name already exists." };
        }
      }
      const patch: Record<string, unknown> = {};
      if (updates.name !== undefined) patch.name = updates.name.trim();
      if (updates.balanceKey !== undefined) patch.balance_key = updates.balanceKey;
      if (updates.status !== undefined) patch.status = updates.status;
      if (updates.minimumNoticeDays !== undefined) patch.minimum_notice_days = updates.minimumNoticeDays;
      const { error } = await supabase.from("leave_types").update(patch).eq("id", id);
      if (error) {
        return {
          ok: false,
          error: error.code === "23505" ? "A leave type with this name already exists." : error.message,
        };
      }
      await fetchRemoteLeaveTypes();
      return { ok: true };
    }

    // Unchanged local demo path.
    mutate((p) => ({ ...p, leaveTypes: p.leaveTypes.map((lt) => lt.id === id ? { ...lt, ...updates } : lt) }));
    return { ok: true };
  }

  // HR-only (departments_insert_hr RLS policy re-checks this server-side too
  // — the frontend is never the security boundary). The partial unique index
  // on (name) WHERE status = 'ACTIVE' is the real duplicate-name guard; this
  // client-side check only gives a faster, friendlier error.
  async function createDepartment(name: string): Promise<{ ok: boolean; error?: string }> {
    if (!supabase) return { ok: false, error: "Supabase is not configured in this environment." };
    const trimmed = name.trim();
    if (!trimmed) return { ok: false, error: "Name is required." };
    if (departments.some((d) => d.status === "ACTIVE" && d.name.toLowerCase() === trimmed.toLowerCase())) {
      return { ok: false, error: "An active department with this name already exists." };
    }
    const { error } = await supabase.from("departments").insert({ name: trimmed });
    if (error) return { ok: false, error: error.message };
    await fetchDepartments();
    return { ok: true };
  }

  // Covers both rename (name) and archive/reactivate (status) — HR-only,
  // departments_update_hr RLS policy re-checks server-side.
  async function updateDepartment(id: string, updates: { name?: string; status?: "ACTIVE" | "INACTIVE" }): Promise<{ ok: boolean; error?: string }> {
    if (!supabase) return { ok: false, error: "Supabase is not configured in this environment." };
    if (updates.name !== undefined) {
      const trimmed = updates.name.trim();
      if (!trimmed) return { ok: false, error: "Name is required." };
      if (departments.some((d) => d.id !== id && d.status === "ACTIVE" && d.name.toLowerCase() === trimmed.toLowerCase())) {
        return { ok: false, error: "An active department with this name already exists." };
      }
    }
    const patch: Record<string, unknown> = {};
    if (updates.name !== undefined) patch.name = updates.name.trim();
    if (updates.status !== undefined) patch.status = updates.status;
    const { error } = await supabase.from("departments").update(patch).eq("id", id);
    if (error) return { ok: false, error: error.message };
    await fetchDepartments();
    return { ok: true };
  }

  // HR-only (set_approval_routing's own is_hr() check re-enforces this
  // server-side — no direct client write grant exists on
  // company_approval_routing at all, this RPC is the only writer). Also the
  // one place profiles.role and every HR profile's manager_id get kept in
  // sync with the routing slots (Phase 6A.1) — both handled inside the RPC
  // itself, never duplicated here.
  async function setApprovalRouting(
    technicalManagerId: string | null,
    generalManagerId: string | null
  ): Promise<{ ok: boolean; error?: string }> {
    if (!supabase) return { ok: false, error: "Supabase is not configured in this environment." };
    const { error } = await supabase.rpc("set_approval_routing", {
      new_technical_manager_id: technicalManagerId,
      new_general_manager_id: generalManagerId,
    });
    if (error) return { ok: false, error: error.message };
    // Roles and manager_id may have changed for up to four profiles (old/new
    // TM, old/new GM, plus every HR profile) — a plain re-fetch is simplest.
    await Promise.all([fetchApprovalRouting(), fetchRemoteEmployees()]);
    return { ok: true };
  }

  return (
    <StoreCtx.Provider value={{
      requests: store.requests, realRequests, notifications: store.notifications,
      employees, leaveTypes: store.leaveTypes, remoteLeaveTypes,
      attendance: store.attendance, realAttendance, holidays: store.holidays, remoteHolidays,
      myLeaveAllocations, fetchEmployeeLeaveAllocations,
      departments, approvalRouting,
      createLeaveRequest, submitRealLeaveRequest,
      createMissionRequest, submitRealMissionRequest,
      createPermissionRequest, submitRealPermissionRequest,
      recordAttendance, deleteAttendance, importAttendance, createHoliday, deleteHoliday, updateHoliday,
      approveRequest, rejectRequest, deleteRequest, deleteRealRequest, decideRealRequest, markNotificationRead, markAllNotificationsRead,
      realNotifications, markRealNotificationRead, markAllRealNotificationsRead,
      createEmployee, updateEmployee, isRemoteEmployee, createLeaveType, updateLeaveType,
      createDepartment, updateDepartment, setApprovalRouting,
    }}>
      {children}
    </StoreCtx.Provider>
  );
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTE GUARDS
// ═══════════════════════════════════════════════════════════════════════════════

function ProtectedRoute() {
  const { session } = useAuth();
  if (!session) return <Navigate to="/" replace />;
  return <Outlet />;
}

// Accepts one role or several. The management area is shared by MANAGER,
// TECH_MANAGER and GM; each page scopes its own data to what that approver may
// act on and see.
function RoleRoute({ role }: { role: UserRole | UserRole[] }) {
  const { session } = useAuth();
  const allowed = Array.isArray(role) ? role : [role];
  if (!session || !allowed.includes(session.user.role)) {
    return <Navigate to="/access-denied" replace />;
  }
  return <Outlet />;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE: ACCESS DENIED
// ═══════════════════════════════════════════════════════════════════════════════

function AccessDeniedPage() {
  const { session } = useAuth();
  const navigate = useNavigate();

  function handleBack() {
    const dest = session ? dashboardPath(session.user.role) : "/";
    navigate(dest, { replace: true });
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 mb-6">
          <AlertCircle className="h-8 w-8 text-destructive" />
        </div>
        <h1 className="text-xl font-semibold text-foreground">Access Denied</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You don't have permission to view this page.
        </p>
        <Button variant="primary" className="mt-6" onClick={handleBack}>
          Go to My Dashboard
        </Button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD SHELL
// Wraps all authenticated pages with AppShell + auth-aware nav routing
// ═══════════════════════════════════════════════════════════════════════════════

const NAV_ROUTES: Record<UserRole, Record<string, string>> = {
  EMPLOYEE: {
    dashboard: "/employee/dashboard",
    requests: "/employee/requests",
    notifications: "/employee/notifications",
    profile: "/profile",
  },
  MANAGER: {
    dashboard: "/manager/dashboard",
    team: "/manager/team",
    myrequests: "/employee/requests",
    requests: "/manager/requests",
    notifications: "/manager/notifications",
    profile: "/profile",
  },
  TECH_MANAGER: {
    dashboard: "/manager/dashboard",
    team: "/manager/team",
    myrequests: "/employee/requests",
    requests: "/manager/requests",
    organization: "/manager/organization",
    notifications: "/manager/notifications",
    profile: "/profile",
  },
  GM: {
    dashboard: "/manager/dashboard",
    team: "/manager/team",
    myrequests: "/employee/requests",
    requests: "/manager/requests",
    organization: "/manager/organization",
    notifications: "/manager/notifications",
    profile: "/profile",
  },
  HR: {
    dashboard: "/hr/dashboard",
    employees: "/hr/employees",
    myrequests: "/employee/requests",
    requests: "/hr/requests",
    attendance: "/hr/attendance",
    notifications: "/hr/notifications",
    settings: "/hr/settings",
    profile: "/profile",
  },
};

interface DashboardShellProps {
  activeNavId: string;
  pageTitle: string;
  children?: React.ReactNode;
}

// Employees reach their own requests via "My Requests" (nav id "requests").
// Every other role has a separate approvals queue under that label, so their
// self-service pages highlight "myrequests" instead.
function useSelfServiceNavId(): string {
  const { session } = useAuth();
  return session?.user.role === "EMPLOYEE" ? "requests" : "myrequests";
}

function DashboardShell({ activeNavId, pageTitle, children }: DashboardShellProps) {
  const { session, logout } = useAuth();
  const { notifications, realNotifications, employees, isRemoteEmployee } = useStore();
  const navigate = useNavigate();

  // Sidebar shows the signed-in user's actual position/job title, not their
  // role — same employees lookup used elsewhere (e.g. useMyBalances) for
  // "my own profile."
  const me = employees.find((e) => e.id === session!.user.id);

  // Real user: realNotifications (Phase 6B-9), already scoped by RLS to the
  // caller's own rows. Demo user: unchanged, local notifications only.
  const sourceNotifications = isRemoteEmployee(session!.user.id) ? realNotifications : notifications;
  const unreadCount = sourceNotifications.filter(
    (n) => n.userId === session!.user.id && !n.read
  ).length;

  function handleNavigate(id: string) {
    const routes = NAV_ROUTES[session!.user.role];
    const route = routes[id];
    if (route) navigate(route);
  }

  function handleLogout() {
    logout();
    navigate("/", { replace: true });
  }

  return (
    <AppShell
      user={{ ...session!.user, position: me?.position }}
      activeNavId={activeNavId}
      pageTitle={pageTitle}
      notificationCount={unreadCount}
      onNotificationsClick={() => handleNavigate("notifications")}
      accessory={<PermissionChip />}
      onNavigate={handleNavigate}
      onLogout={handleLogout}
    >
      {children}
    </AppShell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED PAGE UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

// Accepts both the "YYYY-MM-DD" calendar dates stored on requests and the full
// ISO timestamps stored in submittedAt / decidedAt. Splitting an ISO string on
// "-" used to yield "02T13:45:12Z" as the day, which became NaN and printed the
// literal text "Invalid Date" across all three HR screens.
function fmtDate(dateStr?: string): string {
  if (!dateStr) return "—";

  const datePart = dateStr.slice(0, 10);
  const [y, m, d] = datePart.split("-").map(Number);

  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return "—";

  const date = new Date(y, m - 1, d);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function fmtDateTime(dateStr?: string, timeStr?: string): string {
  if (!dateStr) return "—";
  if (!timeStr) return fmtDate(dateStr);
  const [y, mo, d] = dateStr.slice(0, 10).split("-").map(Number);
  const [h, mi] = timeStr.split(":").map(Number);
  if (![y, mo, d, h, mi].every(Number.isFinite)) return fmtDate(dateStr);
  return new Date(y, mo - 1, d, h, mi).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtRelative(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(isoStr).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

// One place decides how a request is named, so a new type cannot be added and
// then silently render as "Mission" in half the screens.
function requestLabel(r: RequestRecord): string {
  if (r.type === "LEAVE") return r.leaveType ?? "Leave";
  if (r.type === "PERMISSION") {
    return r.permissionKind ? PERMISSION_LABEL[r.permissionKind] : "Permission";
  }
  return "Mission";
}

/** How a request's period reads in a list or a detail row. */
function requestPeriod(r: RequestRecord): string {
  if (r.type === "PERMISSION") {
    return `${fmtDate(r.startDate)} · ${formatMinutes(r.permissionMinutes ?? 0)}`;
  }
  if (r.type === "MISSION") {
    return `${fmtDateTime(r.startDate, r.startTime)} — ${fmtDateTime(r.endDate, r.endTime)}`;
  }
  return `${fmtDate(r.startDate)} — ${fmtDate(r.endDate)}`;
}

function requestTypeLabel(r: RequestRecord): string {
  if (r.type === "LEAVE") return "Leave";
  if (r.type === "PERMISSION") return "Permission";
  return "Mission";
}

/** "09:00" plus/minus N minutes, wrapped to a 24h clock — e.g. "10:00". */
function addMinutesToClock(time: string, minutes: number): string {
  const total = minutesOfDay(time) + minutes;
  const wrapped = ((total % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * The actual clock window a Permission covers. The model stores only
 * permissionKind + permissionMinutes (a duration), not separate start/end
 * times, so this derives them from the fixed workday bounds — the same
 * numbers lateMinutes()/earlyLeaveMinutes() are computed against.
 */
function permissionWindow(r: RequestRecord): { start: string; end: string } | null {
  if (r.type !== "PERMISSION" || !r.permissionKind || r.permissionMinutes == null) return null;
  return r.permissionKind === "LATE_ARRIVAL"
    ? { start: WORKDAY_START, end: addMinutesToClock(WORKDAY_START, r.permissionMinutes) }
    : { start: addMinutesToClock(WORKDAY_END, -r.permissionMinutes), end: WORKDAY_END };
}

/** Minutes between a Mission's start and end date/time, when both are set. */
function missionDurationMinutes(r: RequestRecord): number | null {
  if (r.type !== "MISSION" || !r.startDate || !r.startTime || !r.endDate || !r.endTime) return null;
  const start = new Date(`${r.startDate}T${r.startTime}`);
  const end = new Date(`${r.endDate}T${r.endTime}`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return null;
  return Math.round((end.getTime() - start.getTime()) / 60000);
}

/**
 * The fields specific to this request's type, for a dedicated "Request
 * Details" section — Leave, Mission and Permission each submit different
 * information, so they are not forced into one shared field list. Every value
 * here already exists on RequestRecord (or, for a Permission's clock times, is
 * derived from fields that do); nothing new is stored.
 */
function requestTypeDetailFields(r: RequestRecord): { label: string; value: string }[] {
  if (r.type === "LEAVE") {
    return [
      { label: "Leave Type", value: r.leaveType ?? "—" },
      { label: "Start Date", value: fmtDate(r.startDate) },
      { label: "End Date", value: fmtDate(r.endDate) },
      ...(r.workingDays != null
        ? [{ label: "Working Days", value: `${r.workingDays} ${r.workingDays === 1 ? "day" : "days"}` }]
        : []),
      { label: "Reason", value: r.reason?.trim() ? r.reason : "—" },
    ];
  }

  if (r.type === "MISSION") {
    const duration = missionDurationMinutes(r);
    return [
      { label: "Start Date", value: fmtDate(r.startDate) },
      { label: "Start Time", value: r.startTime ?? "—" },
      { label: "End Date", value: fmtDate(r.endDate) },
      { label: "End Time", value: r.endTime ?? "—" },
      { label: "Location", value: r.location ?? "—" },
      { label: "Purpose", value: r.purpose?.trim() ? r.purpose : "—" },
      ...(duration != null ? [{ label: "Duration", value: formatMinutes(duration) }] : []),
    ];
  }

  // PERMISSION — a same-day request, so Start Date and End Date are the same
  // stored date; only the derived clock time differs between the two ends.
  const window = permissionWindow(r);
  return [
    { label: "Permission Type", value: r.permissionKind ? PERMISSION_LABEL[r.permissionKind] : "—" },
    { label: "Start Date", value: fmtDate(r.startDate) },
    { label: "Start Time", value: window?.start ?? "—" },
    { label: "End Date", value: fmtDate(r.startDate) },
    { label: "End Time", value: window?.end ?? "—" },
    ...(r.permissionMinutes != null ? [{ label: "Duration", value: formatMinutes(r.permissionMinutes) }] : []),
    { label: "Reason", value: r.reason?.trim() ? r.reason : "—" },
  ];
}

const STATUS_BADGE: Record<"PENDING" | "APPROVED" | "REJECTED", BadgeVariant> = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
};

function RequestTimeline({ request }: { request: RequestRecord }) {
  // One row per stage of the snapshotted chain, so the employee can see exactly
  // how far the request has travelled and who is holding it right now.
  const pendingStep = currentStep(request);

  const steps: {
    label: string;
    sub?: string;
    state: "done" | "current" | "failed" | "future";
    date?: string;
    comment?: string;
  }[] = [
    { label: "Submitted", state: "done", date: request.submittedAt },
    ...request.approvals.map((step) => {
      const state: "done" | "current" | "failed" | "future" =
        step.status === "APPROVED" ? "done"
        : step.status === "REJECTED" ? "failed"
        : pendingStep?.stage === step.stage ? "current"
        : "future";

      const label =
        step.status === "APPROVED" ? `${step.title} approved`
        : step.status === "REJECTED" ? `${step.title} rejected`
        : state === "current" ? `Pending ${step.title.toLowerCase()} approval`
        : `${step.title} approval`;

      return { label, sub: step.approverName, state, date: step.decidedAt, comment: step.comment };
    }),
  ];

  return (
    <div className="flex flex-col">
      {steps.map((step, i) => {
        const isLast = i === steps.length - 1;
        const isDone = step.state === "done";
        const isFailed = step.state === "failed";
        const isCurrent = step.state === "current";
        return (
          <div key={i} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className={cn(
                "h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0",
                isDone && "bg-green-100",
                isFailed && "bg-red-100",
                isCurrent && "bg-primary",
                step.state === "future" && "border-2 border-border bg-background"
              )}>
                {isDone && <Check className="h-3.5 w-3.5 text-green-700" />}
                {isFailed && <X className="h-3.5 w-3.5 text-red-700" />}
                {isCurrent && <span className="h-2 w-2 rounded-full bg-white block" />}
                {step.state === "future" && <span className="h-1.5 w-1.5 rounded-full bg-border block" />}
              </div>
              {!isLast && (
                <div className={cn(
                  "w-px flex-1 my-1 min-h-[20px]",
                  isDone ? "bg-green-200" : "bg-border/50"
                )} />
              )}
            </div>
            <div className={cn("flex-1", isLast ? "pb-0" : "pb-4")}>
              <p className={cn(
                "text-sm leading-6",
                isCurrent && "font-medium text-foreground",
                step.state === "future" && "text-muted-foreground/60",
                (isDone || isFailed) && "text-foreground"
              )}>
                {step.label}
              </p>
              {step.sub && (
                <p className="text-xs text-muted-foreground">{step.sub}</p>
              )}
              {step.comment && (
                <p className="text-xs text-foreground/80 mt-1 italic">"{step.comment}"</p>
              )}
              {step.date && (
                <p className="text-xs text-muted-foreground">
                  {new Date(step.date).toLocaleString("en-GB", {
                    day: "2-digit", month: "short", year: "numeric",
                    hour: "2-digit", minute: "2-digit",
                  })}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Phase 6B-6 — the immediate post-submission confirmation view for a real
// Leave/Mission/Permission request is currently the ONLY place the frontend
// ever holds a reference to a real request at all (the Requests read
// migration hasn't happened yet, so it never appears in My Requests /
// Request Detail after this). This shared card is where Delete lives for
// that reason, reused identically by all three request pages.
//
// canEmployeeDeleteRequest is pure (request + employeeId only, no store
// dependency), so it is safe and correct to reuse unmodified here — it only
// controls whether the button is offered. delete_own_request is
// authoritative regardless: it re-derives ownership, PENDING status, and
// stage-1-only itself, so a stale/manipulated client state can never delete
// a request that has actually moved past the Direct Manager.
function RealRequestSuccessCard({ request }: { request: RequestRecord }) {
  const { session } = useAuth();
  const { deleteRealRequest } = useStore();
  const navigate = useNavigate();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteErr, setDeleteErr] = useState("");
  const [deleting, setDeleting] = useState(false);

  const deletable = canEmployeeDeleteRequest(request, session!.user.id);

  async function handleDelete() {
    setDeleting(true);
    const res = await deleteRealRequest(request.id);
    setDeleting(false);
    if (!res.ok) {
      setDeleteErr(res.error ?? "This request could not be deleted.");
      return;
    }
    navigate("/employee/requests", { replace: true, state: { justDeleted: true } });
  }

  return (
    <Card>
      <Alert variant="success">
        <p className="font-medium text-green-800 text-sm">Request submitted successfully</p>
        <p className="text-sm text-green-700 mt-0.5">
          Your request has been sent to your direct manager for approval.
        </p>
      </Alert>
      <div className="rounded-[10px] border border-border divide-y divide-border mt-4">
        {[
          { label: "Request Number", value: request.requestNumber },
          { label: "Type", value: requestLabel(request) },
          { label: "Period", value: requestPeriod(request) },
          { label: "Status", value: request.status },
        ].map(({ label, value }) => (
          <div key={label} className="flex items-center gap-4 px-4 py-2.5">
            <p className="text-xs text-muted-foreground w-32 flex-shrink-0">{label}</p>
            <p className="text-sm font-medium">{value}</p>
          </div>
        ))}
      </div>
      <div className="mt-5">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Approval chain
        </p>
        <RequestTimeline request={request} />
      </div>
      <div className={cn("mt-5", deletable && "pt-5 border-t border-border")}>
        {deletable ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button variant="destructive" onClick={() => setShowDeleteModal(true)}>
              Delete Request
            </Button>
            <Button variant="primary" onClick={() => navigate("/employee/requests")}>
              Back to My Requests
            </Button>
          </div>
        ) : (
          <Button variant="primary" onClick={() => navigate("/employee/requests")}>
            Back to My Requests
          </Button>
        )}
      </div>

      <Modal
        open={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setDeleteErr(""); }}
        title="Delete request?"
        size="sm"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete request {request.requestNumber}?
            This action cannot be undone.
          </p>
          {deleteErr && (
            <Alert variant="error">
              <p className="text-sm text-red-800">{deleteErr}</p>
            </Alert>
          )}
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              onClick={() => { setShowDeleteModal(false); setDeleteErr(""); }}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} loading={deleting}>
              Delete Request
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}

/**
 * Leave/Mission pre-submission Approval Chain preview, shared by
 * LeaveRequestPage and MissionRequestPage.
 *
 * Real employee: derives the complete chain server-side via the
 * preview_my_approval_chain RPC (20260908080000) — a narrow SECURITY
 * DEFINER wrapper that calls the exact same build_approval_chain the real
 * submission RPCs already use for auth.uid() only. This exists because the
 * client-side reconstruction below is bound by the profiles RLS SELECT
 * policies (self / own manager / own direct reports — 20260906140200),
 * which do not let a normal employee's browser see far enough up the
 * hierarchy to resolve the Technical Manager/General Manager beyond their
 * own direct manager; the RPC has no such limit because it runs server-side
 * as plain SQL, not through PostgREST's row-level security. Demo employee:
 * unchanged — the existing local buildApprovalChain against the full local
 * roster, never RLS-bound to begin with.
 */
function useApprovalChainPreview(): ApprovalStep[] {
  const { session } = useAuth();
  const { employees, isRemoteEmployee } = useStore();
  const isReal = isRemoteEmployee(session!.user.id);
  const [realChain, setRealChain] = useState<ApprovalStep[]>([]);

  useEffect(() => {
    if (!isReal || !isSupabaseConfigured || !supabase) return;
    let cancelled = false;
    supabase.rpc("preview_my_approval_chain").then(({ data, error }) => {
      if (cancelled || error || !data) return;
      const rows = data as { stage: number; role: string; title: string; approver_id: string; approver_name: string }[];
      setRealChain(rows.map((row) => ({
        stage: row.stage,
        role: row.role as UserRole,
        title: row.title,
        approverId: row.approver_id,
        approverName: row.approver_name,
        status: "PENDING",
      })));
    });
    return () => { cancelled = true; };
  }, [isReal, session!.user.id]);

  return isReal ? realChain : buildApprovalChain(employees, session!.user.id);
}

function ApproverInfo({ chain }: { chain: ApprovalStep[] }) {
  return (
    <div className="rounded-[8px] border border-border bg-muted/30 p-4">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        Approval chain
      </p>
      {/* Horizontal process layout — the full chain (already deduped/capped
          at GM by buildApprovalChain) at a glance, contained within the
          card's own width rather than growing the card vertically per stage. */}
      <div className="flex items-start gap-1 overflow-x-auto">
        {chain.map((step, i) => (
          <React.Fragment key={step.stage}>
            {i > 0 && (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 flex-shrink-0 mt-3" aria-hidden="true" />
            )}
            <div className="flex flex-col items-center gap-1 flex-1 min-w-[76px] text-center">
              <div className="flex items-center gap-1">
                <span className="text-xs font-semibold text-muted-foreground tabular-nums">
                  {i + 1}
                </span>
                <Avatar name={step.approverName} size="sm" />
              </div>
              <p className="text-xs font-medium text-foreground truncate w-full">{step.approverName}</p>
              <p className="text-[11px] text-muted-foreground truncate w-full">{step.title}</p>
            </div>
          </React.Fragment>
        ))}
      </div>
      <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
        Assigned automatically from the reporting hierarchy. Each stage is approved in order.
      </p>
    </div>
  );
}

// ─── Balance surfaces ─────────────────────────────────────────────────────────

/** Everything the signed-in employee needs to know about their own allowances. */
function useMyBalances() {
  const { session } = useAuth();
  const { requests, realRequests, employees, attendance, realAttendance, myLeaveAllocations, isRemoteEmployee } = useStore();

  const me = employees.find((e) => e.id === session!.user.id) ?? null;
  const month = currentMonthKey(new Date());
  const isReal = !!me && isRemoteEmployee(session!.user.id);

  // Real employee: entitlements comes from the real leave_allocations fetch
  // (Phase 6B-3), never the hardcoded 0/0 every remote profile otherwise
  // carries (entitlements has no backing column on profiles itself). Demo
  // employee: unchanged — me.entitlements is already a real local field.
  // requests source is likewise swapped for a real employee (Phase 6B-7) —
  // realRequests already contains only requests they are authorized to see,
  // and for an employee that is exactly their own — so approved/pending
  // real Leave and Permission requests now count toward used/held.
  // attendance source is likewise swapped (Phase 6B-10) — realAttendance is
  // already scoped by RLS to this employee's own records, so lateness/early-
  // departure now correctly charges against the real monthly permission
  // allowance, exactly matching what get_permission_balance already computes
  // server-side (submit_permission_request's own balance check).
  const leaveMe = isReal ? { ...me, entitlements: myLeaveAllocations } : me;
  const myRequests = isReal ? realRequests : requests;
  const myAttendance = isReal ? realAttendance : attendance;

  return {
    me,
    month,
    leave: leaveMe ? getAllLeaveBalances(leaveMe, myRequests) : [],
    permission: me ? getPermissionBalance(me, myRequests, myAttendance, month) : null,
  };
}

function BalanceBar({ used, held, entitlement }: { used: number; held: number; entitlement: number }) {
  const pct = (n: number) => (entitlement > 0 ? Math.min(100, (n / entitlement) * 100) : 0);
  return (
    <div className="h-1.5 w-full rounded-full bg-border/70 overflow-hidden flex">
      <div className="bg-primary h-full" style={{ width: `${pct(used)}%` }} />
      <div className="bg-primary/35 h-full" style={{ width: `${pct(held)}%` }} />
    </div>
  );
}

function LeaveBalanceCard({ balance }: { balance: LeaveBalance }) {
  const exhausted = balance.available === 0;
  return (
    <div className="rounded-[12px] border border-border bg-card p-4">
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <p className="text-sm font-medium text-foreground">{balance.label}</p>
        <p className={cn("text-2xl font-semibold tabular-nums", exhausted ? "text-destructive" : "text-foreground")}>
          {balance.available}
        </p>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        {balance.available === 1 ? "day left" : "days left"} of {balance.entitlement}
      </p>
      <BalanceBar used={balance.used} held={balance.held} entitlement={balance.entitlement} />
      <p className="text-xs text-muted-foreground mt-2">
        {balance.used} used
        {balance.held > 0 && <> · {balance.held} awaiting approval</>}
      </p>
      {exhausted && (
        <p className="text-xs text-destructive mt-2 font-medium">
          Exhausted — you cannot request more.
        </p>
      )}
    </div>
  );
}

/**
 * Compact summary shown above the Leave Type field on the leave request form.
 * `balance` is the selected Leave Type's own bucket (via its balanceKey) from
 * getLeaveBalance() — the same figure LeaveBalanceCard shows elsewhere — so
 * the current unsaved form never affects it; null when no type is selected
 * yet or the selected type has no balanceKey. `requestedDays` is
 * countWorkingDays() over the dates currently typed into the form, kept
 * entirely separate from the balance.
 */
function LeaveRequestBalanceSummary({
  leaveTypeName,
  balance,
  requestedDays,
}: {
  /** Selected Leave Type's name, or undefined when none is selected yet. */
  leaveTypeName?: string;
  /** The selected type's balance, or null when it has no balanceKey (or none is selected). */
  balance: LeaveBalance | null;
  requestedDays: number;
}) {
  // Always the same outer card — only its inner content switches between the
  // three states — so it never mounts/unmounts as the user changes Leave Type.
  return (
    <div className="rounded-[8px] border border-border bg-muted/30 p-4">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        {balance ? `${balance.label} Balance` : "Leave Balance"}
      </p>
      {balance ? (
        <div className="flex flex-col sm:flex-row sm:items-baseline gap-3 sm:gap-0 sm:divide-x sm:divide-border">
          <div className="flex items-baseline gap-1.5 sm:pr-5">
            <span className="text-2xl font-semibold tabular-nums text-foreground">
              {balance.available}
            </span>
            <span className="text-sm text-muted-foreground">
              {balance.available === 1 ? "Day" : "Days"} remaining of {balance.entitlement} days allocated
            </span>
          </div>
          <div className="flex items-baseline gap-1.5 sm:pl-5">
            <span className="text-2xl font-semibold tabular-nums text-foreground">
              {requestedDays}
            </span>
            <span className="text-sm text-muted-foreground">
              {requestedDays === 1 ? "Day" : "Days"} on leave requested
            </span>
          </div>
        </div>
      ) : leaveTypeName ? (
        <p className="text-sm text-muted-foreground">{leaveTypeName} is not limited by a leave balance.</p>
      ) : (
        <p className="text-sm text-muted-foreground">Select a leave type to view the applicable balance.</p>
      )}
    </div>
  );
}

/** The small always-on chip. Sits in the shell header on every screen. */
function PermissionChip() {
  const { permission } = useMyBalances();
  const navigate = useNavigate();
  if (!permission) return null;

  const low = permission.available <= 60;
  const none = permission.available === 0;

  return (
    <button
      onClick={() => navigate("/employee/new-request/permission")}
      title={`Permission allowance for ${permission.month}: ${formatMinutes(permission.available)} of ${formatMinutes(permission.allowance)} remaining`}
      className={cn(
        "hidden sm:flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        none
          ? "border-destructive/30 bg-destructive/10 text-destructive"
          : low
            ? "border-amber-300 bg-amber-50 text-amber-800"
            : "border-border bg-muted/50 text-muted-foreground hover:text-foreground"
      )}
    >
      <Clock className="h-3.5 w-3.5" />
      <span className="tabular-nums">{formatMinutes(permission.available)}</span>
      <span className="text-[10px] opacity-70">left</span>
    </button>
  );
}

type CalendarDayState = "LEAVE_ANNUAL" | "LEAVE_OTHER" | "HOLIDAY" | "PRESENT" | "WEEKEND" | "NORMAL";

const CALENDAR_DAY_STYLES: Record<CalendarDayState, string> = {
  LEAVE_ANNUAL: "bg-blue-50 text-blue-700",
  LEAVE_OTHER: "bg-violet-50 text-violet-700",
  HOLIDAY: "bg-amber-50 text-amber-700",
  PRESENT: "bg-green-50 text-green-700",
  WEEKEND: "text-muted-foreground/50",
  NORMAL: "text-foreground",
};

// Mission/Permission are shown as small dots alongside a day's primary state
// rather than a background color — a day can have a mission or permission
// on top of being a leave/holiday/present day, and dots let both coexist
// without touching the existing precedence below. Colors match the ones
// already established for these two request types on the New Request cards
// (Mission = orange, Permission = emerald).
const CALENDAR_LEGEND: { label: string; dot: string }[] = [
  // Same primary token as the Today ring (ring-primary) on the day cell.
  { label: "Today", dot: "bg-primary" },
  { label: "Annual Leave", dot: "bg-blue-500" },
  { label: "Other Leave", dot: "bg-violet-500" },
  { label: "Public Holiday", dot: "bg-amber-500" },
  { label: "Mission", dot: "bg-orange-500" },
  // A deeper shade than Present's own bg-green-500 — same emerald/green
  // identity as the Permission icon on the New Request card, just dark
  // enough that the two are never mistaken for each other as small dots.
  { label: "Permission", dot: "bg-emerald-700" },
];

/**
 * Month-navigable snapshot for the signed-in user's own dashboard. Reuses
 * existing data only — AttendanceRecord for Present, approved LEAVE/MISSION/
 * PERMISSION requests, and the existing HolidayRecord list — filtered to
 * this user's own employeeId exactly as before, whatever role they hold.
 * None of the underlying fetches are month-scoped, so changing the viewed
 * month never re-fetches anything; it only changes which dates the same
 * already-loaded data is checked against.
 *
 * Precedence when more than one applies to the same date is unchanged from
 * before, just with Leave split by its existing balance bucket: Annual
 * Leave, then Other Leave (any approved leave not on the ANNUAL bucket),
 * then Public Holiday, then Present, then the Friday/Saturday weekend
 * (muted). Mission and Permission never override this background — they
 * add a small dot instead, so a day that is also a mission or permission
 * never loses its leave/holiday/present/weekend information.
 */
function MyCalendarWidget() {
  const { session } = useAuth();
  const { requests, realRequests, attendance, realAttendance, holidays, remoteHolidays, isRemoteEmployee } = useStore();

  const employeeId = session!.user.id;
  const isReal = isRemoteEmployee(employeeId);
  // Real employee: real requests + the real public-holiday calendar
  // (Phase 6B-7) + real attendance (Phase 6B-10); demo employee: unchanged
  // local sources throughout.
  const myRequests = isReal ? realRequests : requests;
  const myHolidays = isReal ? remoteHolidays : holidays;
  const myAttendance = isReal ? realAttendance : attendance;

  const today = new Date();
  const todayStr = toISODate(today);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const isCurrentMonth = viewYear === today.getFullYear() && viewMonth === today.getMonth();

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  }
  function goToToday() {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
  }

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  const approvedLeave = myRequests.filter(
    (r): r is RequestRecord & { startDate: string; endDate: string } =>
      r.employeeId === employeeId && r.type === "LEAVE" && r.status === "APPROVED" && !!r.startDate && !!r.endDate
  );
  const approvedMissions = myRequests.filter(
    (r): r is RequestRecord & { startDate: string; endDate: string } =>
      r.employeeId === employeeId && r.type === "MISSION" && r.status === "APPROVED" && !!r.startDate && !!r.endDate
  );
  const approvedPermissions = myRequests.filter(
    (r): r is RequestRecord & { startDate: string } =>
      r.employeeId === employeeId && r.type === "PERMISSION" && r.status === "APPROVED" && !!r.startDate
  );

  function dayState(dateStr: string, weekday: number): CalendarDayState {
    const leave = approvedLeave.find((r) => dateStr >= r.startDate && dateStr <= r.endDate);
    if (leave) return leave.balanceKey === "ANNUAL" ? "LEAVE_ANNUAL" : "LEAVE_OTHER";
    if (myHolidays.some((h) => h.date === dateStr)) return "HOLIDAY";
    const record = myAttendance.find((a) => a.employeeId === employeeId && a.date === dateStr);
    if (record?.checkIn && record?.checkOut) return "PRESENT";
    if (WEEKEND_DAYS.includes(weekday)) return "WEEKEND";
    return "NORMAL";
  }

  const hasMission = (dateStr: string) => approvedMissions.some((r) => dateStr >= r.startDate && dateStr <= r.endDate);
  const hasPermission = (dateStr: string) => approvedPermissions.some((r) => r.startDate === dateStr);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <div className="rounded-[12px] border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold text-foreground flex-shrink-0">My Calendar</h3>
        <div className="flex items-center gap-1">
          {!isCurrentMonth && (
            <button
              type="button"
              onClick={goToToday}
              className="text-[11px] font-medium text-primary hover:underline mr-1 flex-shrink-0"
            >
              Today
            </button>
          )}
          <button
            type="button"
            onClick={prevMonth}
            aria-label="Previous month"
            className="h-6 w-6 rounded-[6px] flex items-center justify-center hover:bg-muted transition-colors flex-shrink-0"
          >
            <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          <p className="text-xs text-muted-foreground text-center tabular-nums min-w-[92px]">{monthLabel}</p>
          <button
            type="button"
            onClick={nextMonth}
            aria-label="Next month"
            className="h-6 w-6 rounded-[6px] flex items-center justify-center hover:bg-muted transition-colors flex-shrink-0"
          >
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-y-1 text-center">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
          <div key={d} className="text-[10px] font-medium text-muted-foreground/70 pb-1">
            {d}
          </div>
        ))}
        {Array.from({ length: firstWeekday }, (_, i) => (
          <div key={`blank-${i}`} />
        ))}
        {days.map((day) => {
          const dateStr = toISODate(new Date(viewYear, viewMonth, day));
          const weekday = new Date(viewYear, viewMonth, day).getDay();
          const state = dayState(dateStr, weekday);
          const isToday = dateStr === todayStr;
          const mission = hasMission(dateStr);
          const permission = hasPermission(dateStr);
          return (
            <div key={dateStr} className="flex flex-col items-center justify-start gap-0.5 py-0.5">
              <span
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-xs tabular-nums",
                  CALENDAR_DAY_STYLES[state],
                  isToday && "ring-1 ring-primary font-semibold"
                )}
              >
                {day}
              </span>
              <span className="flex items-center gap-0.5 h-1.5">
                {mission && <span className="h-1 w-1 rounded-full bg-orange-500" aria-hidden="true" />}
                {permission && <span className="h-1 w-1 rounded-full bg-emerald-700" aria-hidden="true" />}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-3 pt-3 border-t border-border">
        {CALENDAR_LEGEND.map(({ label, dot }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className={cn("h-2 w-2 rounded-full flex-shrink-0", dot)} aria-hidden="true" />
            <span className="text-[11px] text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmployeeDashboardPage() {
  const { session } = useAuth();
  const { requests, realRequests, isRemoteEmployee } = useStore();
  const { leave: myLeave, permission: myPermission } = useMyBalances();
  const navigate = useNavigate();

  // Real employee: realRequests (Phase 6B-13) — already scoped by RLS to
  // this employee's own requests. Demo employee: unchanged, local only.
  const sourceRequests = isRemoteEmployee(session!.user.id) ? realRequests : requests;
  const myRequests = sourceRequests.filter((r) => r.employeeId === session!.user.id);
  const pending = myRequests.filter((r) => r.status === "PENDING").length;
  const approved = myRequests.filter((r) => r.status === "APPROVED").length;
  const recent = [...myRequests]
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
    .slice(0, 5);

  return (
    <DashboardShell activeNavId="dashboard" pageTitle="Dashboard">
      {/* New Request hero */}
      <div className="mb-6 rounded-[12px] bg-primary p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Submit a New Request</h2>
          <p className="text-sm text-white/70 mt-1">
            Request leave or a work mission. Your manager will be notified immediately.
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={() => navigate("/employee/new-request")}
          className="flex-shrink-0 bg-white text-primary hover:bg-white/90 border-0"
        >
          <Plus className="h-4 w-4" />
          New Request
        </Button>
      </div>

      {/* Balances */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {myLeave.map((b) => <LeaveBalanceCard key={b.key} balance={b} />)}
        {myPermission && (
          <div className="rounded-[12px] border border-border bg-card p-4">
            <div className="flex items-baseline justify-between gap-2 mb-1">
              <p className="text-sm font-medium text-foreground">Permissions</p>
              <p className={cn(
                "text-2xl font-semibold tabular-nums",
                myPermission.available === 0 ? "text-destructive" : "text-foreground"
              )}>
                {myPermission.available}
              </p>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              minutes left of {myPermission.allowance} this month
            </p>
            <BalanceBar used={myPermission.used} held={myPermission.held} entitlement={myPermission.allowance} />
            <p className="text-xs text-muted-foreground mt-2">
              {formatMinutes(myPermission.fromAttendance)} from attendance
              {myPermission.fromRequests > 0 && <> · {formatMinutes(myPermission.fromRequests)} approved</>}
            </p>
            {myPermission.available === 0 ? (
              <p className="text-xs text-destructive mt-2 font-medium">
                Exhausted — no more permissions this month.
              </p>
            ) : (
              <button
                onClick={() => navigate("/employee/new-request/permission")}
                className="text-xs text-primary hover:underline mt-2 font-medium"
              >
                Request a permission
              </button>
            )}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Total Requests", value: myRequests.length },
          { label: "Pending", value: pending },
          { label: "Approved", value: approved },
        ].map(({ label, value }) => (
          <div key={label} className="contents">
            <Card padding={false}>
              <div className="p-4">
                <p className="text-2xl font-semibold text-foreground">{value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
              </div>
            </Card>
          </div>
        ))}
      </div>

      {/* Recent requests + calendar snapshot */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">Recent Requests</h3>
            {myRequests.length > 0 && (
              <button
                className="text-xs text-primary hover:underline"
                onClick={() => navigate("/employee/requests")}
              >
                View all
              </button>
            )}
          </div>
          {recent.length === 0 ? (
            <EmptyState
              icon={<FileText className="h-8 w-8 text-muted-foreground/40" />}
              title="No requests yet"
              description="Click New Request above to submit your first request."
            />
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {recent.map((r) => (
                <button
                  key={r.id}
                  className="flex items-center gap-4 py-3 text-left hover:bg-muted/40 -mx-2 px-2 rounded-[6px] transition-colors"
                  onClick={() => navigate(`/employee/requests/${r.id}`)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground">{r.requestNumber}</span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground">
                        {requestLabel(r)}
                      </span>
                    </div>
                    <p className="text-sm text-foreground mt-0.5 truncate">
                      {requestPeriod(r)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <StatusBadge status={STATUS_BADGE[r.status]} />
                    <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>

        <MyCalendarWidget />
      </div>
    </DashboardShell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE: E02 — NEW REQUEST (choose type)
// ═══════════════════════════════════════════════════════════════════════════════

function NewRequestPage() {
  const selfNavId = useSelfServiceNavId();
  const navigate = useNavigate();
  return (
    <DashboardShell activeNavId={selfNavId} pageTitle="New Request">
      <div className="max-w-5xl">
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-foreground">New Request</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Choose the type of request you want to submit.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <button
            className="group flex flex-col items-start gap-4 rounded-[12px] border-2 border-border bg-card p-6 text-left hover:border-primary hover:bg-accent/30 transition-all"
            onClick={() => navigate("/employee/new-request/leave")}
          >
            <div className="h-12 w-12 rounded-[10px] bg-blue-50 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
              <Umbrella className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Leave</p>
              <p className="text-sm text-muted-foreground mt-1">Request time off from work.</p>
            </div>
            <div className="flex items-center gap-1 text-xs font-medium text-primary mt-auto">
              Select <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </div>
          </button>

          <button
            className="group flex flex-col items-start gap-4 rounded-[12px] border-2 border-border bg-card p-6 text-left hover:border-primary hover:bg-accent/30 transition-all"
            onClick={() => navigate("/employee/new-request/mission")}
          >
            <div className="h-12 w-12 rounded-[10px] bg-orange-50 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
              <Briefcase className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Mission</p>
              <p className="text-sm text-muted-foreground mt-1">Request a work mission.</p>
            </div>
            <div className="flex items-center gap-1 text-xs font-medium text-primary mt-auto">
              Select <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </div>
          </button>

          <button
            className="group flex flex-col items-start gap-4 rounded-[12px] border-2 border-border bg-card p-6 text-left hover:border-primary hover:bg-accent/30 transition-all"
            onClick={() => navigate("/employee/new-request/permission")}
          >
            <div className="h-12 w-12 rounded-[10px] bg-emerald-50 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
              <Clock className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Permission</p>
              <p className="text-sm text-muted-foreground mt-1">
                Arrive late or leave early. Charged in minutes.
              </p>
            </div>
            <div className="flex items-center gap-1 text-xs font-medium text-primary mt-auto">
              Select <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </div>
          </button>
        </div>
      </div>
    </DashboardShell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE: E03 — REQUEST LEAVE
// ═══════════════════════════════════════════════════════════════════════════════

function LeaveRequestPage() {
  const selfNavId = useSelfServiceNavId();
  const { session } = useAuth();
  const {
    requests, realRequests, leaveTypes, remoteLeaveTypes, employees, holidays, remoteHolidays,
    createLeaveRequest, submitRealLeaveRequest, myLeaveAllocations, isRemoteEmployee,
  } = useStore();
  const navigate = useNavigate();

  const isReal = isRemoteEmployee(session!.user.id);
  const manager = getManagerForEmployee(employees, session!.user.id);
  // Preview only — see useApprovalChainPreview for why a real requester's
  // complete chain must come from the server (preview_my_approval_chain)
  // rather than the RLS-limited client-side employees list. The actual
  // submission RPC derives the authoritative chain server-side regardless,
  // independent of this preview.
  const chain = useApprovalChainPreview();

  const [leaveType, setLeaveType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  // Real submission only — the Supabase-created request/approval chain for
  // the immediate confirmation view. Never written into store.requests (the
  // Supabase row is the sole source of truth); My Requests/Request Detail
  // cannot show it yet, since the Requests read path is a later checkpoint.
  const [realResult, setRealResult] = useState<RequestRecord | null>(null);

  // requestedDays is a live figure from the existing countWorkingDays(),
  // computed from whatever dates are typed in — independent of which Leave
  // Type is selected. Real employee: entitlements comes from the real
  // leave_allocations fetch (Phase 6B-3) instead of the hardcoded 0/0 every
  // remote profile otherwise carries — display only; the RPC is
  // authoritative for the actual balance check at submission time, never
  // this client-side figure.
  const rawMe = employees.find((e) => e.id === session!.user.id) ?? null;
  const me = rawMe && isReal ? { ...rawMe, entitlements: myLeaveAllocations } : rawMe;
  // Real employee: the real Supabase holiday calendar, so this live preview
  // matches what the server will actually compute — display only, still not
  // used to authorize anything client-side.
  const requestedDays = countWorkingDays(startDate, endDate, isReal ? remoteHolidays : holidays);

  // Minimum advance-notice policy (Phase 2 UX) — the selected Leave Type's
  // own minimumNoticeDays (remoteLeaveTypes, the authoritative catalogue;
  // never a hardcoded per-name mapping), translated into the earliest
  // selectable calendar date: today + N calendar days, not working days.
  // Demo path is unaffected — local leaveTypes never carries
  // minimumNoticeDays, so this stays undefined there, same as before.
  const selectedRealLeaveType = remoteLeaveTypes.find((lt) => lt.id === leaveType);
  const minNoticeDays = selectedRealLeaveType?.minimumNoticeDays ?? 0;
  const minStartDate = minNoticeDays > 0
    ? (() => {
        const d = new Date();
        d.setDate(d.getDate() + minNoticeDays);
        return toISODate(d);
      })()
    : undefined;

  // If the Leave Type changes and the already-selected Start Date is no
  // longer valid under the new notice requirement, clear it rather than
  // leave an impossible selection in place — the calendar itself also
  // disables it going forward (minDate below), so this only handles a date
  // picked before the type changed.
  useEffect(() => {
    if (startDate && minStartDate && startDate < minStartDate) {
      setStartDate("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minStartDate]);

  // The balance card must follow the selected Leave Type's own
  // balance_key/balanceKey — the existing field, already the source of
  // truth for submit_leave_request — never a hardcoded per-name mapping.
  // Demo path: leaveType holds the type's name (see the Select below), so
  // it's looked up in the local leaveTypes catalogue instead of
  // remoteLeaveTypes; both LeaveTypeRecord shapes already carry balanceKey.
  // NULL balanceKey (Maternity/Paternity/Sick/Unpaid) means "not
  // balance-limited" — the existing interpretation submit_leave_request
  // already applies (no balance check at all) — so no card is shown for
  // those, matching that behavior rather than inventing a bucket for them.
  const selectedDemoLeaveType = !isReal ? leaveTypes.find((lt) => lt.name === leaveType) : undefined;
  const selectedLeaveTypeRecord = isReal ? selectedRealLeaveType : selectedDemoLeaveType;
  const selectedBalanceKey = selectedLeaveTypeRecord?.balanceKey ?? null;
  const selectedBalance = me && selectedBalanceKey
    ? getLeaveBalance(me, isReal ? realRequests : requests, selectedBalanceKey)
    : null;

  function clearErr(field: string) {
    setErrors((p) => { const n = { ...p }; delete n[field]; return n; });
  }

  if (!manager) {
    return (
      <DashboardShell activeNavId={selfNavId} pageTitle="Request Leave">
        <Alert variant="error">
          <p className="text-sm text-red-800">
            No direct manager is assigned to your account. Please contact HR before submitting requests.
          </p>
        </Alert>
      </DashboardShell>
    );
  }

  // Real employees only. Minimal, UX-only checks — required fields and date
  // order — mirroring the same checks validateLeaveFields makes before its
  // own overlap/balance checks (deliberately not duplicated here: those are
  // server-authoritative inside submit_leave_request, never re-implemented
  // client-side). Leave type validity is not re-checked either — the
  // dropdown below only ever offers ACTIVE Supabase leave types, so an
  // inactive/invalid one cannot be selected in the first place; the RPC's
  // own check is the real backstop.
  function validateRealLeaveFields(): Record<string, string> {
    const errs: Record<string, string> = {};
    if (!leaveType) errs.leaveType = "Leave Type is required.";
    if (!startDate) errs.startDate = "Start Date is required.";
    if (!endDate) errs.endDate = "End Date is required.";
    if (startDate && endDate && endDate < startDate) {
      errs.endDate = "End Date cannot be before Start Date.";
    }
    // Minimum advance-notice policy (Phase 2), mirrored client-side for
    // immediate feedback — applies to the START DATE only, never the
    // requested duration. The real boundary is submit_leave_request's own
    // identical check; this cannot be bypassed by calling the RPC directly.
    // The calendar already disables invalid dates (minStartDate below), so
    // this mainly guards a value set before the Leave Type changed.
    if (startDate && minStartDate && startDate < minStartDate && selectedRealLeaveType) {
      errs.startDate = `${selectedRealLeaveType.name} must be requested at least ${minNoticeDays} day${minNoticeDays === 1 ? "" : "s"} in advance.`;
    }
    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (isReal) {
      const errs = validateRealLeaveFields();
      if (Object.keys(errs).length > 0) { setErrors(errs); return; }
      setErrors({});
      setSubmitting(true);
      const result = await submitRealLeaveRequest({
        leaveTypeId: leaveType,
        startDate, endDate,
        reason: reason.trim() || undefined,
      });
      setSubmitting(false);
      if (!result.ok) {
        setErrors({ _form: result.error });
        return;
      }
      setRealResult(result.request);
      return;
    }

    // Unchanged demo path.
    const errs = validateLeaveFields(
      { leaveType, startDate, endDate },
      requests.filter((r) => r.employeeId === session!.user.id),
      leaveTypes.filter((lt) => lt.status === "ACTIVE")
    );
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 700));
    const result = createLeaveRequest(session!.user.id, session!.user.name, {
      leaveType,
      startDate, endDate,
      reason: reason.trim() || undefined,
    });
    setSubmitting(false);
    if (!result.ok) {
      setErrors((result as { ok: false; errors: Record<string, string> }).errors);
      return;
    }
    navigate(`/employee/requests/${result.request.id}`, {
      replace: true, state: { justSubmitted: true },
    });
  }

  if (realResult) {
    return (
      <DashboardShell activeNavId={selfNavId} pageTitle="Request Leave">
        <div className="max-w-2xl">
          <RealRequestSuccessCard request={realResult} />
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell activeNavId={selfNavId} pageTitle="Request Leave">
      <div className="max-w-2xl">
        <button
          onClick={() => navigate("/employee/new-request")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Request Type
        </button>
        <Card>
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-foreground">Leave Request</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Complete the form below to submit your leave request.
            </p>
          </div>
          {errors._form && (
            <Alert variant="error" className="mb-5">
              <p className="text-sm text-red-800">{errors._form}</p>
            </Alert>
          )}
          <form onSubmit={handleSubmit} noValidate>
            <div className="flex flex-col gap-5">
              <LeaveRequestBalanceSummary
                leaveTypeName={selectedLeaveTypeRecord?.name}
                balance={selectedBalance}
                requestedDays={requestedDays}
              />
              <Select
                label="Leave Type *"
                value={leaveType}
                onChange={(e) => { setLeaveType(e.target.value); clearErr("leaveType"); }}
                error={errors.leaveType}
              >
                <option value="">Select Leave Type</option>
                {isReal
                  ? remoteLeaveTypes.filter((lt) => lt.status === "ACTIVE").map((lt) => (
                      <option key={lt.id} value={lt.id}>{lt.name}</option>
                    ))
                  : leaveTypes.filter((lt) => lt.status === "ACTIVE").map((lt) => (
                      <option key={lt.id} value={lt.name}>{lt.name}</option>
                    ))}
              </Select>
              {isReal && selectedRealLeaveType && (
                <Alert variant="info">
                  {minStartDate ? (
                    <p>
                      {selectedRealLeaveType.name} requires {minNoticeDays} day{minNoticeDays === 1 ? "" : "s"} advance notice
                      {" · "}Earliest date: {fmtDate(minStartDate)}
                    </p>
                  ) : (
                    <p>No advance notice is required for {selectedRealLeaveType.name}.</p>
                  )}
                </Alert>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <DatePicker
                  label="Start Date *"
                  value={startDate}
                  onChange={(e) => { setStartDate(e.target.value); clearErr("startDate"); }}
                  error={errors.startDate}
                  minDate={minStartDate}
                />
                <DatePicker
                  label="End Date *"
                  value={endDate}
                  onChange={(e) => { setEndDate(e.target.value); clearErr("endDate"); }}
                  error={errors.endDate}
                />
              </div>
              <Textarea
                label="Reason"
                placeholder="Optional: describe the reason for your leave..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
              />
              <ApproverInfo chain={chain} />
              <div className="flex items-center gap-3 pt-1 border-t border-border">
                <Button
                  type="button" variant="secondary"
                  onClick={() => navigate("/employee/new-request")}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" loading={submitting}>
                  {submitting ? "Submitting…" : "Submit Request"}
                </Button>
              </div>
            </div>
          </form>
        </Card>
      </div>
    </DashboardShell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE: E04 — REQUEST MISSION
// ═══════════════════════════════════════════════════════════════════════════════

function MissionRequestPage() {
  const selfNavId = useSelfServiceNavId();
  const { session } = useAuth();
  const { employees, createMissionRequest, submitRealMissionRequest, isRemoteEmployee } = useStore();
  const navigate = useNavigate();

  const isReal = isRemoteEmployee(session!.user.id);
  const manager = getManagerForEmployee(employees, session!.user.id);
  // Preview only — see LeaveRequestPage/useApprovalChainPreview for why a
  // real requester's complete chain must come from the server
  // (preview_my_approval_chain) rather than the RLS-limited client-side
  // employees list.
  const chain = useApprovalChainPreview();

  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [location, setLocation] = useState("");
  const [purpose, setPurpose] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  // Real submission only — see LeaveRequestPage's identical realResult
  // (Phase 6B-4): the Supabase-created request/approval chain for the
  // immediate confirmation view, never written into store.requests.
  const [realResult, setRealResult] = useState<RequestRecord | null>(null);

  function clearErr(field: string) {
    setErrors((p) => { const n = { ...p }; delete n[field]; return n; });
  }

  if (!manager) {
    return (
      <DashboardShell activeNavId={selfNavId} pageTitle="Request Mission">
        <Alert variant="error">
          <p className="text-sm text-red-800">
            No direct manager is assigned to your account. Please contact HR before submitting requests.
          </p>
        </Alert>
      </DashboardShell>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // validateMissionFields is pure/stateless (no store dependency), so it
    // is safe and correct to reuse unchanged for the real path too — unlike
    // Leave/Permission, Mission has no overlap or balance concept to keep
    // server-only.
    const errs = validateMissionFields({ startDate, startTime, endDate, endTime, location, purpose });
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});

    if (isReal) {
      setSubmitting(true);
      const result = await submitRealMissionRequest({ startDate, startTime, endDate, endTime, location, purpose });
      setSubmitting(false);
      if (!result.ok) {
        setErrors({ _form: result.error });
        return;
      }
      setRealResult(result.request);
      return;
    }

    // Unchanged demo path.
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 700));
    const result = createMissionRequest(session!.user.id, session!.user.name, {
      startDate, startTime, endDate, endTime, location, purpose,
    });
    setSubmitting(false);
    if (!result.ok) {
      setErrors((result as { ok: false; errors: Record<string, string> }).errors);
      return;
    }
    navigate(`/employee/requests/${result.request.id}`, {
      replace: true, state: { justSubmitted: true },
    });
  }

  if (realResult) {
    return (
      <DashboardShell activeNavId={selfNavId} pageTitle="Request Mission">
        <div className="max-w-2xl">
          <RealRequestSuccessCard request={realResult} />
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell activeNavId={selfNavId} pageTitle="Request Mission">
      <div className="max-w-2xl">
        <button
          onClick={() => navigate("/employee/new-request")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Request Type
        </button>
        <Card>
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-foreground">Mission Request</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Complete the form below to submit your mission request.
            </p>
          </div>
          {errors._form && (
            <Alert variant="error" className="mb-5">
              <p className="text-sm text-red-800">{errors._form}</p>
            </Alert>
          )}
          <form onSubmit={handleSubmit} noValidate>
            <div className="flex flex-col gap-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <DatePicker
                  label="Start Date *"
                  value={startDate}
                  onChange={(e) => { setStartDate(e.target.value); clearErr("startDate"); }}
                  error={errors.startDate}
                />
                <TimePicker
                  label="Start Time *"
                  value={startTime}
                  onChange={(e) => { setStartTime(e.target.value); clearErr("startTime"); }}
                  error={errors.startTime}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <DatePicker
                  label="End Date *"
                  value={endDate}
                  onChange={(e) => { setEndDate(e.target.value); clearErr("endDate"); }}
                  error={errors.endDate}
                />
                <TimePicker
                  label="End Time *"
                  value={endTime}
                  onChange={(e) => { setEndTime(e.target.value); clearErr("endTime"); }}
                  error={errors.endTime}
                />
              </div>
              <Input
                label="Location *"
                placeholder="e.g. Client Office, Cairo"
                value={location}
                onChange={(e) => { setLocation(e.target.value); clearErr("location"); }}
                error={errors.location}
              />
              <Textarea
                label="Purpose *"
                placeholder="Describe the purpose and objectives of this mission..."
                value={purpose}
                onChange={(e) => { setPurpose(e.target.value); clearErr("purpose"); }}
                error={errors.purpose}
                rows={3}
              />
              <ApproverInfo chain={chain} />
              <div className="flex items-center gap-3 pt-1 border-t border-border">
                <Button
                  type="button" variant="secondary"
                  onClick={() => navigate("/employee/new-request")}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" loading={submitting}>
                  {submitting ? "Submitting…" : "Submit Request"}
                </Button>
              </div>
            </div>
          </form>
        </Card>
      </div>
    </DashboardShell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE: E06 — REQUEST DETAIL (employee view)
// ═══════════════════════════════════════════════════════════════════════════════

// Real employees only (Phase 6B-5) — minimal, UX-only checks: required
// fields and minute bounds. The weekend/holiday check, one-permission-
// per-day (advisory-locked), and balance check are all server-authoritative
// inside submit_permission_request and are deliberately not duplicated
// here — unlike Mission's validateMissionFields, validatePermissionFields
// requires local store.requests/attendance/holidays and so cannot be
// safely reused for a real employee (same reasoning as Leave, Phase 6B-4).
function validateRealPermissionFields(data: { permissionKind: PermissionKind | ""; date: string; minutes: string }): Record<string, string> {
  const errs: Record<string, string> = {};
  if (!data.permissionKind) errs.permissionKind = "Choose late arrival or early departure.";
  if (!data.date) errs.date = "Date is required.";
  const n = Number(data.minutes);
  if (!data.minutes || !Number.isFinite(n) || n <= 0) {
    errs.minutes = "Enter how many minutes you need.";
  } else if (n > 240) {
    errs.minutes = "A single permission cannot exceed 240 minutes.";
  }
  return errs;
}

function PermissionRequestPage() {
  const selfNavId = useSelfServiceNavId();
  const { session } = useAuth();
  const { employees, createPermissionRequest, submitRealPermissionRequest, isRemoteEmployee } = useStore();
  const { permission } = useMyBalances();
  const navigate = useNavigate();

  const isReal = isRemoteEmployee(session!.user.id);

  const [kind, setKind] = useState<PermissionKind | "">("");
  const [date, setDate] = useState("");
  const [minutes, setMinutes] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  // Real submission only — see LeaveRequestPage's identical realResult
  // (Phase 6B-4): the Supabase-created request/approval for the immediate
  // confirmation view, never written into store.requests.
  const [realResult, setRealResult] = useState<RequestRecord | null>(null);

  const manager = getManagerForEmployee(employees, session!.user.id);
  const exhausted = !permission || permission.available === 0;

  // The form is noValidate on purpose. A native min/max on the minutes field
  // blocks submit silently, so the handler never runs and the employee is left
  // staring at a form that will not send with no explanation. Our own validation
  // produces the only messages.
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    if (isReal) {
      const errs = validateRealPermissionFields({ permissionKind: kind, date, minutes });
      if (Object.keys(errs).length > 0) { setErrors(errs); return; }
      setSubmitting(true);
      const result = await submitRealPermissionRequest({
        permissionKind: kind as PermissionKind,
        date,
        minutes: Number(minutes),
        reason: reason.trim() || undefined,
      });
      setSubmitting(false);
      if (!result.ok) {
        setErrors({ _form: result.error });
        return;
      }
      setRealResult(result.request);
      return;
    }

    // Unchanged demo path.
    setSubmitting(true);
    try {
      const result = createPermissionRequest(session!.user.id, session!.user.name, {
        permissionKind: kind as PermissionKind,
        date,
        minutes: Number(minutes),
        reason: reason.trim() || undefined,
      });
      if (!result.ok) {
        setErrors(result.errors);
        return;
      }
      navigate(`/employee/requests/${result.request.id}`, {
        replace: true, state: { justSubmitted: true },
      });
    } catch {
      setErrors({ _form: "Something went wrong. Please try again." });
    } finally {
      setSubmitting(false);
    }
  }

  if (realResult) {
    return (
      <DashboardShell activeNavId={selfNavId} pageTitle="Request Permission">
        <div className="max-w-2xl">
          <RealRequestSuccessCard request={realResult} />
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell activeNavId={selfNavId} pageTitle="Request Permission">
      <div className="max-w-2xl">
        <button
          onClick={() => navigate("/employee/new-request")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Request Type
        </button>

        <Card>
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-foreground">Permission Request</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Arrive late or leave early. Charged against your monthly allowance.
            </p>
          </div>

          {permission && (
            <div className={cn(
              "rounded-[8px] border p-4 mb-5",
              exhausted ? "border-destructive/30 bg-destructive/5" : "border-border bg-muted/30"
            )}>
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-medium text-foreground">
                  Allowance for {permission.month}
                </p>
                <p className={cn(
                  "text-lg font-semibold tabular-nums",
                  exhausted ? "text-destructive" : "text-foreground"
                )}>
                  {formatMinutes(permission.available)}
                </p>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {formatMinutes(permission.used)} of {formatMinutes(permission.allowance)} used
                {permission.fromAttendance > 0 && <> · {formatMinutes(permission.fromAttendance)} charged automatically from attendance</>}
                {permission.held > 0 && <> · {formatMinutes(permission.held)} awaiting approval</>}
              </p>
            </div>
          )}

          {exhausted ? (
            <Alert variant="error">
              Your permission allowance for this month is used up. You cannot request another
              until {permission ? "next month" : "HR sets your allowance"}.
            </Alert>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
              {errors._form && <Alert variant="error">{errors._form}</Alert>}

              <Select
                label="Permission Type *"
                value={kind}
                onChange={(e) => setKind(e.target.value as PermissionKind | "")}
                error={errors.permissionKind}
              >
                <option value="">Select type</option>
                <option value="LATE_ARRIVAL">Late arrival — come in after {WORKDAY_START}</option>
                <option value="EARLY_DEPARTURE">Early departure — leave before {WORKDAY_END}</option>
              </Select>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <DatePicker label="Date *" value={date} onChange={(e) => setDate(e.target.value)} error={errors.date} />
                <Input
                  label="Minutes *"
                  type="number"
                  min={15}
                  max={Math.min(240, permission?.available ?? 240)}
                  step={15}
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                  error={errors.minutes}
                  hint={`Up to ${formatMinutes(permission?.available ?? 0)} remaining`}
                  placeholder="e.g. 60"
                />
              </div>

              <Textarea
                label="Reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="Optional: why do you need this permission?"
              />

              {manager && (
                <div className="rounded-[8px] border border-border bg-muted/30 p-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    Approver
                  </p>
                  <div className="flex items-center gap-3">
                    <Avatar name={manager.name} size="sm" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{manager.name}</p>
                      <p className="text-xs text-muted-foreground">{ROLE_LABEL[manager.role]}</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
                    A permission is decided by your direct manager alone — it does not go up the chain.
                  </p>
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={() => navigate("/employee/new-request")}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" loading={submitting} disabled={submitting}>
                  {submitting ? "Submitting..." : "Submit Request"}
                </Button>
              </div>
            </form>
          )}
        </Card>
      </div>
    </DashboardShell>
  );
}

function EmployeeRequestDetailPage() {
  const selfNavId = useSelfServiceNavId();
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const { requests, realRequests, deleteRequest, deleteRealRequest, isRemoteEmployee } = useStore();
  const { session } = useAuth();
  const navigate = useNavigate();

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteErr, setDeleteErr] = useState("");
  const [deleting, setDeleting] = useState(false);

  const justSubmitted = location.state?.justSubmitted === true;
  // Real employee: real requests (Phase 6B-7) — a real request's UUID is
  // never found in the local `requests`, which previously navigated away
  // before Delete was ever reachable except from the post-submission card.
  const isReal = isRemoteEmployee(session!.user.id);
  const request = (isReal ? realRequests : requests).find((r) => r.id === id);

  if (!request) return <Navigate to="/employee/requests" replace />;

  // Ownership guard. Without it, changing the id in the URL exposed any other
  // employee's request — including the free-text reason, which for sick and
  // maternity leave is health data. ManagerRequestDetailPage already had the
  // equivalent check; this page did not.
  if (request.employeeId !== session!.user.id) {
    return <Navigate to="/access-denied" replace />;
  }

  // Same rule deleteRequest() re-checks server-side (i.e. inside the store
  // mutation itself) — this only controls whether the button is offered.
  const deletable = canEmployeeDeleteRequest(request, session!.user.id);

  async function handleDelete() {
    setDeleting(true);
    const res = isReal
      ? await deleteRealRequest(request!.id)
      : await (async () => {
          await new Promise((r) => setTimeout(r, 500));
          return deleteRequest(request!.id, session!.user.id);
        })();
    if (!res.ok) {
      setDeleteErr(res.error ?? "This request could not be deleted.");
      setDeleting(false);
      return;
    }
    navigate("/employee/requests", { replace: true, state: { justDeleted: true } });
  }

  return (
    <DashboardShell activeNavId={selfNavId} pageTitle="Request Details">
      <div className="max-w-2xl">
        <button
          onClick={() => navigate("/employee/requests")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to My Requests
        </button>

        {justSubmitted && (
          <Alert variant="success" className="mb-5">
            <p className="font-medium text-green-800 text-sm">Request submitted successfully</p>
            <p className="text-sm text-green-700 mt-0.5">
              Your request has been sent to your direct manager for approval.
            </p>
          </Alert>
        )}

        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <p className="text-xs font-medium text-muted-foreground">{request.requestNumber}</p>
            <h2 className="text-lg font-semibold text-foreground mt-0.5">
              {`${requestLabel(request)} Request`}
            </h2>
          </div>
          <StatusBadge status={STATUS_BADGE[request.status]} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Card className="lg:col-span-2">
            <h3 className="text-sm font-semibold text-foreground mb-4">Details</h3>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
              <div>
                <dt className="text-xs text-muted-foreground">Employee</dt>
                <dd className="text-sm text-foreground mt-0.5">{request.employeeName}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Direct Manager</dt>
                <dd className="text-sm text-foreground mt-0.5">{request.managerName}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Request Type</dt>
                <dd className="text-sm text-foreground mt-0.5">
                  {requestTypeLabel(request)}
                </dd>
              </div>
              {request.type === "LEAVE" && (
                <div>
                  <dt className="text-xs text-muted-foreground">Leave Type</dt>
                  <dd className="text-sm text-foreground mt-0.5">{request.leaveType}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-muted-foreground">
                  {request.type === "MISSION" ? "Start" : "Period"}
                </dt>
                <dd className="text-sm text-foreground mt-0.5">
                  {request.type === "LEAVE"
                    ? `${fmtDate(request.startDate)} — ${fmtDate(request.endDate)}`
                    : fmtDateTime(request.startDate, request.startTime)}
                </dd>
              </div>
              {request.type === "MISSION" && (
                <div>
                  <dt className="text-xs text-muted-foreground">End</dt>
                  <dd className="text-sm text-foreground mt-0.5">
                    {fmtDateTime(request.endDate, request.endTime)}
                  </dd>
                </div>
              )}
              {request.type === "MISSION" && request.location && (
                <div className="col-span-2">
                  <dt className="text-xs text-muted-foreground">Location</dt>
                  <dd className="text-sm text-foreground mt-0.5">{request.location}</dd>
                </div>
              )}
              {(request.reason || request.purpose) && (
                <div className="col-span-2">
                  <dt className="text-xs text-muted-foreground">
                    {request.type === "MISSION" ? "Purpose" : "Reason"}
                  </dt>
                  <dd className="text-sm text-foreground mt-0.5">
                    {request.reason ?? request.purpose}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-muted-foreground">Submitted</dt>
                <dd className="text-sm text-foreground mt-0.5">
                  {new Date(request.submittedAt).toLocaleDateString("en-GB", {
                    day: "2-digit", month: "short", year: "numeric",
                  })}
                </dd>
              </div>
            </dl>
            {request.status === "REJECTED" && request.decisionComment && (
              <div className="mt-5 pt-5 border-t border-border">
                <p className="text-xs font-semibold text-muted-foreground mb-1">
                  Manager Comment
                </p>
                <div className="rounded-[8px] bg-red-50 border border-red-200 px-4 py-3">
                  <p className="text-sm text-red-800">{request.decisionComment}</p>
                </div>
              </div>
            )}
            {deletable && (
              <div className="mt-5 pt-5 border-t border-border">
                <Button variant="destructive" onClick={() => setShowDeleteModal(true)}>
                  Delete Request
                </Button>
              </div>
            )}
          </Card>

          <div className="flex flex-col gap-4">
            <Card>
              <h3 className="text-sm font-semibold text-foreground mb-4">Timeline</h3>
              <RequestTimeline request={request} />
            </Card>
            {justSubmitted && (
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => navigate("/employee/dashboard")}
              >
                Back to Dashboard
              </Button>
            )}
          </div>
        </div>
      </div>

      <Modal
        open={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setDeleteErr(""); }}
        title="Delete request?"
        size="sm"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete request {request.requestNumber}?
            This action cannot be undone.
          </p>
          {deleteErr && (
            <Alert variant="error">
              <p className="text-sm text-red-800">{deleteErr}</p>
            </Alert>
          )}
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              onClick={() => { setShowDeleteModal(false); setDeleteErr(""); }}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} loading={deleting}>
              Delete Request
            </Button>
          </div>
        </div>
      </Modal>
    </DashboardShell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE: E05 — MY REQUESTS
// ═══════════════════════════════════════════════════════════════════════════════

function EmployeeRequestsPage() {
  const selfNavId = useSelfServiceNavId();
  const { session } = useAuth();
  const { requests, realRequests, isRemoteEmployee } = useStore();
  const navigate = useNavigate();
  const location = useLocation();

  const justDeleted = location.state?.justDeleted === true;

  // Real employee: realRequests (Phase 6B-7) — already scoped by RLS to
  // exactly what this session can see, but the existing employeeId filter
  // below is kept anyway since a Manager/TM/GM/HR viewer's own realRequests
  // set can be broader than just their own requests.
  const isReal = isRemoteEmployee(session!.user.id);
  const sourceRequests = isReal ? realRequests : requests;
  const myRequests = [...sourceRequests.filter((r) => r.employeeId === session!.user.id)].sort(
    (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
  );

  return (
    <DashboardShell activeNavId={selfNavId} pageTitle="My Requests">
      {justDeleted && (
        <Alert variant="success" className="mb-5">
          <p className="font-medium text-green-800 text-sm">Request deleted</p>
          <p className="text-sm text-green-700 mt-0.5">
            Your request has been removed.
          </p>
        </Alert>
      )}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-semibold text-foreground">My Requests</h2>
        <Button variant="primary" onClick={() => navigate("/employee/new-request")}>
          <Plus className="h-4 w-4" />
          New Request
        </Button>
      </div>
      {myRequests.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FileText className="h-8 w-8 text-muted-foreground/40" />}
            title="No requests yet"
            description="Submit a leave or mission request to get started."
            action={
              <Button variant="primary" onClick={() => navigate("/employee/new-request")}>
                <Plus className="h-4 w-4" />
                New Request
              </Button>
            }
          />
        </Card>
      ) : (
        <Table
          data={myRequests}
          columns={[
            {
              key: "requestNumber",
              header: "Request #",
              render: (r) => <span className="font-medium text-sm">{r.requestNumber}</span>,
            },
            {
              key: "type",
              header: "Type",
              render: (r) => (
                <span className="text-sm text-foreground">
                  {requestLabel(r)}
                </span>
              ),
            },
            {
              key: "startDate",
              header: "Period",
              render: (r) => (
                <span className="text-sm text-muted-foreground">
                  {requestPeriod(r)}
                </span>
              ),
            },
            {
              key: "submittedAt",
              header: "Submitted",
              render: (r) => (
                <span className="text-sm text-muted-foreground">{fmtRelative(r.submittedAt)}</span>
              ),
            },
            {
              key: "status",
              header: "Status",
              render: (r) => <StatusBadge status={STATUS_BADGE[r.status]} />,
            },
          ]}
          onRowClick={(r) => navigate(`/employee/requests/${r.id}`)}
          keyExtractor={(r) => r.id}
        />
      )}
    </DashboardShell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE: EMPLOYEE NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════════

function EmployeeNotificationsPage() {
  const { session } = useAuth();
  const {
    notifications, realNotifications, markNotificationRead, markAllNotificationsRead,
    markRealNotificationRead, markAllRealNotificationsRead, isRemoteEmployee,
  } = useStore();
  const navigate = useNavigate();

  // Real employee: realNotifications (Phase 6B-9), already scoped by RLS to
  // the caller's own rows; the employeeId filter below is kept anyway for
  // consistency with every other real-data page in this app.
  const isReal = isRemoteEmployee(session!.user.id);
  const sourceNotifications = isReal ? realNotifications : notifications;
  const myNotifs = [...sourceNotifications.filter((n) => n.userId === session!.user.id)].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const hasUnread = myNotifs.some((n) => !n.read);

  function handleClick(n: NotificationRecord) {
    if (isReal) markRealNotificationRead(n.id);
    else markNotificationRead(n.id);
    navigate(`/employee/requests/${n.requestId}`);
  }

  return (
    <DashboardShell activeNavId="notifications" pageTitle="Notifications">
      <div className="max-w-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-foreground">Notifications</h2>
          {myNotifs.length > 0 && (
            <button
              onClick={() => (isReal ? markAllRealNotificationsRead() : markAllNotificationsRead(session!.user.id))}
              disabled={!hasUnread}
              className="text-xs font-medium text-primary hover:underline disabled:text-muted-foreground disabled:no-underline disabled:cursor-not-allowed"
            >
              Mark all as read
            </button>
          )}
        </div>
        {myNotifs.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Bell className="h-8 w-8 text-muted-foreground/40" />}
              title="No notifications"
              description="You'll be notified here when your requests are approved or rejected."
            />
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {myNotifs.map((n) => (
              <button
                key={n.id}
                className={cn(
                  "flex items-start gap-4 rounded-[10px] border p-4 text-left transition-colors w-full",
                  n.read
                    ? "border-border bg-card hover:bg-muted/30"
                    : "border-primary/20 bg-accent/50 hover:bg-accent"
                )}
                onClick={() => handleClick(n)}
              >
                <div className={cn(
                  "mt-0.5 h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0",
                  n.type === "REQUEST_APPROVED" ? "bg-green-100" :
                  n.type === "REQUEST_REJECTED" ? "bg-red-100" : "bg-primary/10"
                )}>
                  {n.type === "REQUEST_APPROVED" ? (
                    <CheckCircle2 className="h-4 w-4 text-green-700" />
                  ) : n.type === "REQUEST_REJECTED" ? (
                    <XCircle className="h-4 w-4 text-red-600" />
                  ) : (
                    <BellRing className="h-4 w-4 text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm", !n.read && "font-medium")}>{n.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">{fmtRelative(n.createdAt)}</p>
                </div>
                {!n.read && <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-2" />}
              </button>
            ))}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE: MANAGER DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════

function ManagerDashboardPage() {
  const { session } = useAuth();
  const { requests, realRequests, isRemoteEmployee } = useStore();
  const navigate = useNavigate();

  // Real approver (Phase 6B-8): realRequests, already scoped by RLS
  // (requests_select_approver — any stage) to exactly what this session may
  // see. Demo approver: unchanged, local requests only.
  const sourceRequests = isRemoteEmployee(session!.user.id) ? realRequests : requests;

  // Visible: every request this approver sits in the chain of, at any stage.
  // For the technical manager and the GM that is the whole organisation,
  // because they are in every chain. Actionable: only what is waiting on them
  // right now.
  const myRequests = sourceRequests.filter((r) => involvesApprover(r, session!.user.id));
  const pending = myRequests.filter((r) => awaitsDecisionBy(r, session!.user.id));
  const recentPending = [...pending]
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
    .slice(0, 5);

  return (
    <DashboardShell activeNavId="dashboard" pageTitle="Dashboard">
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Pending Approval", value: pending.length, highlight: pending.length > 0 },
          { label: "Total Requests", value: myRequests.length, highlight: false },
          {
            label: "Approved",
            value: myRequests.filter((r) => r.status === "APPROVED").length,
            highlight: false,
          },
        ].map(({ label, value, highlight }) => (
          <div key={label} className="contents">
            <Card padding={false}>
              <div className="p-4">
                <p className={cn("text-2xl font-semibold", highlight && value > 0 ? "text-primary" : "text-foreground")}>
                  {value}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
              </div>
            </Card>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">Pending Requests</h3>
            {myRequests.length > 0 && (
              <button className="text-xs text-primary hover:underline" onClick={() => navigate("/manager/requests")}>
                View all
              </button>
            )}
          </div>
          {recentPending.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 className="h-8 w-8 text-muted-foreground/40" />}
              title="No pending requests"
              description="New requests from your team will appear here."
            />
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {recentPending.map((r) => (
                <button
                  key={r.id}
                  className="flex items-center gap-4 py-3 text-left hover:bg-muted/40 -mx-2 px-2 rounded-[6px] transition-colors"
                  onClick={() => navigate(`/manager/requests/${r.id}`)}
                >
                  <Avatar name={r.employeeName} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{r.employeeName}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {requestLabel(r)} ·{" "}
                      {requestPeriod(r)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <StatusBadge status="pending" />
                    <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>

        <MyCalendarWidget />
      </div>
    </DashboardShell>
  );
}

// ─── Employee detail view (inside modal) ──────────────────────────────────────

function EmployeeDetailView({
  employee,
  managerName,
}: {
  employee: EmployeeProfile;
  managerName: string;
}) {
  const rows: { label: string; value: string }[] = [
    { label: "Employee ID", value: employee.employeeCode ?? employee.id },
    { label: "Position", value: employee.position },
    { label: "Department", value: employee.department },
    { label: "Email", value: employee.email },
    ...(employee.phone ? [{ label: "Phone", value: employee.phone }] : []),
    { label: "Direct Manager", value: managerName },
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* Profile header */}
      <div className="flex items-center gap-4">
        <Avatar name={employee.name} size="lg" />
        <div>
          <p className="text-base font-semibold text-foreground">{employee.name}</p>
          <p className="text-sm text-muted-foreground">{employee.position} · {employee.department}</p>
          <div className="mt-1.5">
            <StatusBadge status={employee.status === "ACTIVE" ? "active" : "inactive"} />
          </div>
        </div>
      </div>

      {/* Detail rows */}
      <div className="rounded-[10px] border border-border divide-y divide-border">
        {rows.map(({ label, value }) => (
          <div key={label} className="flex items-center gap-4 px-4 py-3">
            <p className="text-xs text-muted-foreground w-28 flex-shrink-0">{label}</p>
            <p className="text-sm text-foreground">{value}</p>
          </div>
        ))}
      </div>

      <p className="text-center text-xs text-muted-foreground/60">
        Employee details are view-only. Contact HR to make changes.
      </p>
    </div>
  );
}

// ─── Manager Team Page ────────────────────────────────────────────────────────

function ManagerTeamPage() {
  const { session } = useAuth();
  const { employees } = useStore();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<EmployeeProfile | null>(null);
  const [team, setTeam] = useState<EmployeeProfile[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "done" | "error">("loading");
  // Retry token. Previously "Try Again" only set loadState back to "loading",
  // but the effect did not depend on it, so it never re-ran and the page hung
  // on the spinner forever.
  const [retry, setRetry] = useState(0);

  // Label only — the Technical Manager oversees several department managers'
  // teams at once, so the plural reads more accurately there. Functionality
  // (still just this approver's own direct reports) is unchanged for everyone.
  const pageLabel = session!.user.role === "TECH_MANAGER" ? "My Teams" : "My Team";

  useEffect(() => {
    setLoadState("loading");
    const timer = setTimeout(() => {
      try {
        // Security: manager ID always comes from the authenticated session, never from a URL param.
        const members = getTeamForManager(employees, session!.user.id);
        setTeam(members);
        setLoadState("done");
      } catch {
        setLoadState("error");
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [session, employees, retry]);

  if (loadState === "loading") {
    return (
      <DashboardShell activeNavId="team" pageTitle={pageLabel}>
        <LoadingState message="Loading your team..." />
      </DashboardShell>
    );
  }

  if (loadState === "error") {
    return (
      <DashboardShell activeNavId="team" pageTitle={pageLabel}>
        <ErrorState
          message="Something went wrong. We couldn't load your team."
          onRetry={() => setRetry((n) => n + 1)}
        />
      </DashboardShell>
    );
  }

  const activeCount = team.filter((e) => e.status === "ACTIVE").length;
  const q = search.toLowerCase().trim();
  const filtered = q
    ? team.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.id.toLowerCase().includes(q) ||
          (e.employeeCode?.toLowerCase().includes(q) ?? false)
      )
    : team;

  return (
    <DashboardShell activeNavId="team" pageTitle={pageLabel}>
      {/* Page header */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-foreground">{pageLabel}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Employees who report directly to you.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        <Card padding={false}>
          <div className="p-4">
            <p className="text-2xl font-semibold text-foreground">{team.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Direct Reports</p>
          </div>
        </Card>
        <Card padding={false}>
          <div className="p-4">
            <p className="text-2xl font-semibold text-foreground">{activeCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Active</p>
          </div>
        </Card>
      </div>

      {team.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Users className="h-8 w-8 text-muted-foreground/40" />}
            title="No team members yet"
            description="Employees assigned to you will appear here."
          />
        </Card>
      ) : (
        <>
          {/* Search */}
          <div className="mb-4">
            <Input
              placeholder="Search team members..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {filtered.length === 0 ? (
            <Card>
              <EmptyState
                icon={<Search className="h-6 w-6 text-muted-foreground/40" />}
                title="No results"
                description={`No team members match "${search}".`}
              />
            </Card>
          ) : (
            <Table
              data={filtered}
              columns={[
                {
                  key: "name",
                  header: "Name",
                  render: (e) => (
                    <div className="flex items-center gap-3">
                      <Avatar name={e.name} size="sm" />
                      <span className="text-sm font-medium text-foreground">{e.name}</span>
                    </div>
                  ),
                },
                {
                  key: "id",
                  header: "Employee ID",
                  render: (e) => (
                    <span className="text-sm text-muted-foreground font-mono">{e.employeeCode ?? e.id}</span>
                  ),
                },
                {
                  key: "position",
                  header: "Position",
                  render: (e) => <span className="text-sm text-foreground">{e.position}</span>,
                },
                {
                  key: "department",
                  header: "Department",
                  render: (e) => <span className="text-sm text-muted-foreground">{e.department}</span>,
                },
                {
                  key: "status",
                  header: "Status",
                  render: (e) => (
                    <StatusBadge status={e.status === "ACTIVE" ? "active" : "inactive"} />
                  ),
                },
              ]}
              onRowClick={(e) => setSelected(e)}
              keyExtractor={(e) => e.id}
            />
          )}
        </>
      )}

      {/* Employee detail modal */}
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Employee Details"
        size="md"
      >
        {selected && (
          <EmployeeDetailView
            employee={selected}
            managerName={employees.find((e) => e.id === selected.managerId)?.name ?? "—"}
          />
        )}
      </Modal>
    </DashboardShell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE: MANAGER REQUESTS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Organisation directory (read-only) ───────────────────────────────────────
// Available to the technical manager and the GM. Deliberately has no edit,
// activate or role controls: changing people stays with HR.

function OrganizationPage() {
  const { session } = useAuth();
  const { employees, requests, realRequests, isRemoteEmployee } = useStore();
  // Real TM/GM: realRequests (Phase 6B-13) — already scoped by RLS to
  // whatever this viewer is authorized to see (every Leave/Mission chain
  // they're in, which for TM/GM is effectively the whole organisation; a
  // Permission request stays visible only if their own direct-manager
  // relationship put them on it — the same RLS boundary every other real
  // page already respects). Demo TM/GM: unchanged, local only.
  const sourceRequests = isRemoteEmployee(session!.user.id) ? realRequests : requests;
  // Same production-visibility rule as HREmployeesPage's directoryEmployees,
  // HRAttendancePage's activeEmployees, and HRDashboardPage's employee
  // counts: a real session only sees production-visible real profiles
  // (legacy/test profiles stay in the database, just excluded from this
  // view); a demo session is unaffected.
  const productionVisibleEmployees = session && isRemoteEmployee(session.user.id)
    ? employees.filter((e) => isRemoteEmployee(e.id) && e.isProduction !== false)
    : employees.filter((e) => !isRemoteEmployee(e.id));
  const [filterEmployee, setFilterEmployee] = useState("");
  const [filterManager, setFilterManager] = useState("");
  const [filterType, setFilterType] = useState<"" | "LEAVE" | "MISSION" | "PERMISSION">("");
  const [selected, setSelected] = useState<EmployeeProfile | null>(null);

  const managerName = (e: EmployeeProfile) =>
    productionVisibleEmployees.find((m) => m.id === e.managerId)?.name ?? "—";

  // Same options pattern as the Requests filter bar: unique names, sorted.
  const employeeOptions = Array.from(new Set(productionVisibleEmployees.map((e) => e.name))).sort();
  // Manager filter: the employee's Direct Manager (managerId), not an
  // approval-stage/current-approver concept.
  const managerOptions = Array.from(
    new Set(productionVisibleEmployees.map((e) => managerName(e)).filter((name) => name !== "—"))
  ).sort();

  const hasFilters = !!(filterEmployee || filterManager || filterType);

  function clearFilters() {
    setFilterEmployee("");
    setFilterManager("");
    setFilterType("");
  }

  // An employee has no "type" field of their own — Leave/Mission/Permission
  // is a property of a request. So the Type filter matches employees who have
  // at least one request of the selected type, using the existing requests
  // data rather than inventing a new employee-level field.
  const rows = productionVisibleEmployees.filter((e) => {
    if (filterEmployee && e.name !== filterEmployee) return false;
    if (filterManager && managerName(e) !== filterManager) return false;
    if (filterType && !sourceRequests.some((r) => r.employeeId === e.id && r.type === filterType)) return false;
    return true;
  });

  return (
    <DashboardShell activeNavId="organization" pageTitle="Organization">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Organization</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Everyone in the company, with their place in the reporting chain. View only.
          </p>
        </div>
        {hasFilters && (
          <p className="text-xs text-muted-foreground">
            Showing {rows.length} of {productionVisibleEmployees.length}
          </p>
        )}
      </div>

      {/* Filter bar — same pattern as the Requests filter bar, minus the date range */}
      <div className="rounded-[12px] border border-border bg-card shadow-sm p-4 mb-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <Select
            label="Employee"
            value={filterEmployee}
            onChange={(e) => setFilterEmployee(e.target.value)}
          >
            <option value="">All Employees</option>
            {employeeOptions.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </Select>

          <Select
            label="Manager"
            value={filterManager}
            onChange={(e) => setFilterManager(e.target.value)}
          >
            <option value="">All Managers</option>
            {managerOptions.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </Select>

          <Select
            label="Type"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as "" | "LEAVE" | "MISSION" | "PERMISSION")}
          >
            <option value="">All Types</option>
            <option value="LEAVE">Leave</option>
            <option value="MISSION">Mission</option>
            <option value="PERMISSION">Permission</option>
          </Select>
        </div>

        {hasFilters && (
          <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {rows.length === productionVisibleEmployees.length
                ? "Showing all employees"
                : `${rows.length} of ${productionVisibleEmployees.length} employees match`}
            </p>
            <button
              onClick={clearFilters}
              className="flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              <X className="h-3 w-3" />
              Clear filters
            </button>
          </div>
        )}
      </div>

      <Card padding={false}>
        {rows.length === 0 ? (
          <EmptyState
            icon={<Search className="h-8 w-8 text-muted-foreground/40" />}
            title="No matching employees"
            description="Try adjusting your filters to find what you're looking for."
            action={
              <Button variant="secondary" onClick={clearFilters}>
                Clear Filters
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-4 py-3 font-medium text-muted-foreground">Employee</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Employee ID</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Position</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Department</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Reports to</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Role</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr
                    key={e.id}
                    onClick={() => setSelected(e)}
                    className="border-b border-border/60 last:border-0 hover:bg-muted/40 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={e.name} size="sm" />
                        <span className="font-medium text-foreground">{e.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{e.employeeCode ?? e.id}</td>
                    <td className="px-4 py-3 text-muted-foreground">{e.position}</td>
                    <td className="px-4 py-3 text-muted-foreground">{e.department}</td>
                    <td className="px-4 py-3 text-muted-foreground">{managerName(e)}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{ROLE_LABEL[e.role]}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={e.status === "ACTIVE" ? "active" : "inactive"} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Employee Details">
        {selected && <EmployeeDetailView employee={selected} managerName={managerName(selected)} />}
      </Modal>
    </DashboardShell>
  );
}

function ManagerRequestsPage() {
  const { session } = useAuth();
  const { requests, realRequests, isRemoteEmployee } = useStore();
  const navigate = useNavigate();

  // Real approver (Manager/TM/GM): realRequests is already scoped by RLS
  // (requests_select_approver — any stage, any role — or requests_select_hr)
  // to exactly what this session may see; involvesApprover below is the
  // same existing pure filter demo data already uses, re-applied on top for
  // consistency, not as the security boundary (Phase 6B-7).
  const sourceRequests = isRemoteEmployee(session!.user.id) ? realRequests : requests;

  const [filterEmployee, setFilterEmployee] = useState("");
  const [filterManager, setFilterManager] = useState("");
  const [filterType, setFilterType] = useState<"" | "LEAVE" | "MISSION">("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  // The Technical Manager and GM both see requests across every department
  // (they appear in nearly every chain), so filtering by the requester's
  // Direct Manager is useful there. A department Manager's own accessible
  // requests already share a single Direct Manager — themselves — so the
  // filter would offer exactly one, always-selected option and is skipped.
  const showManagerFilter = session!.user.role === "TECH_MANAGER" || session!.user.role === "GM";

  const myRequests = [...sourceRequests.filter((r) => involvesApprover(r, session!.user.id))].sort(
    (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
  );

  const employeeOptions = Array.from(new Set(myRequests.map((r) => r.employeeName))).sort();
  // managerName is the request's stage-1 approver — the requester's Direct
  // Manager, snapshotted at submission — not an approval-stage/current-approver
  // concept, per RequestRecord's own "Kept for display and filters" comment.
  const managerOptions = Array.from(new Set(myRequests.map((r) => r.managerName))).sort();

  const hasFilters = !!(filterEmployee || filterManager || filterType || filterDateFrom || filterDateTo);

  function clearFilters() {
    setFilterEmployee("");
    setFilterManager("");
    setFilterType("");
    setFilterDateFrom("");
    setFilterDateTo("");
  }

  const filtered = myRequests.filter((r) => {
    if (filterEmployee && r.employeeName !== filterEmployee) return false;
    if (filterManager && r.managerName !== filterManager) return false;
    if (filterType && r.type !== filterType) return false;
    // Date range filters against the request's start date
    if (filterDateFrom && r.startDate && r.startDate < filterDateFrom) return false;
    if (filterDateTo && r.startDate && r.startDate > filterDateTo) return false;
    return true;
  });

  const tableColumns = [
    {
      key: "requestNumber",
      header: "Request #",
      render: (r: RequestRecord) => <span className="font-medium text-sm">{r.requestNumber}</span>,
    },
    {
      key: "employeeName",
      header: "Employee",
      render: (r: RequestRecord) => (
        <div className="flex items-center gap-2">
          <Avatar name={r.employeeName} size="sm" />
          <span className="text-sm">{r.employeeName}</span>
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      render: (r: RequestRecord) => (
        <span className="text-sm text-foreground">
          {requestLabel(r)}
        </span>
      ),
    },
    {
      key: "startDate",
      header: "Period",
      render: (r: RequestRecord) => (
        <span className="text-sm text-muted-foreground">
          {requestPeriod(r)}
        </span>
      ),
    },
    {
      key: "submittedAt",
      header: "Submitted",
      render: (r: RequestRecord) => (
        <span className="text-sm text-muted-foreground">{fmtRelative(r.submittedAt)}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (r: RequestRecord) => <StatusBadge status={STATUS_BADGE[r.status]} />,
    },
  ];

  return (
    <DashboardShell activeNavId="requests" pageTitle="Requests">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-semibold text-foreground">Requests</h2>
        {hasFilters && (
          <p className="text-xs text-muted-foreground">
            Showing {filtered.length} of {myRequests.length}
          </p>
        )}
      </div>

      {/* Filter bar — only shown when there are requests to filter */}
      {myRequests.length > 0 && (
        <div className="rounded-[12px] border border-border bg-card shadow-sm p-4 mb-5">
          <div className={cn(
            "grid grid-cols-1 sm:grid-cols-2 gap-3",
            showManagerFilter ? "lg:grid-cols-5" : "lg:grid-cols-4"
          )}>
            <Select
              label="Employee"
              value={filterEmployee}
              onChange={(e) => setFilterEmployee(e.target.value)}
            >
              <option value="">All Employees</option>
              {employeeOptions.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </Select>

            {showManagerFilter && (
              <Select
                label="Manager"
                value={filterManager}
                onChange={(e) => setFilterManager(e.target.value)}
              >
                <option value="">All Managers</option>
                {managerOptions.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </Select>
            )}

            <Select
              label="Type"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as "" | "LEAVE" | "MISSION")}
            >
              <option value="">All Types</option>
              <option value="LEAVE">Leave</option>
              <option value="MISSION">Mission</option>
            </Select>

            <DatePicker
              label="Date From"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              placeholder="Start of range"
            />

            <DatePicker
              label="Date To"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              placeholder="End of range"
            />
          </div>

          {hasFilters && (
            <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {filtered.length === myRequests.length
                  ? "Showing all requests"
                  : `${filtered.length} of ${myRequests.length} requests match`}
              </p>
              <button
                onClick={clearFilters}
                className="flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                <X className="h-3 w-3" />
                Clear filters
              </button>
            </div>
          )}
        </div>
      )}

      {myRequests.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FileText className="h-8 w-8 text-muted-foreground/40" />}
            title="No requests yet"
            description="Requests from your team will appear here once they are submitted."
          />
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Search className="h-8 w-8 text-muted-foreground/40" />}
            title="No matching requests"
            description="Try adjusting your filters to find what you're looking for."
            action={
              <Button variant="secondary" onClick={clearFilters}>
                Clear Filters
              </Button>
            }
          />
        </Card>
      ) : (
        <Table
          data={filtered}
          columns={tableColumns}
          onRowClick={(r) => navigate(`/manager/requests/${r.id}`)}
          keyExtractor={(r) => r.id}
        />
      )}
    </DashboardShell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE: MANAGER REQUEST DETAIL (approve / reject)
// ═══════════════════════════════════════════════════════════════════════════════

function ManagerRequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { requests, realRequests, approveRequest, rejectRequest, decideRealRequest, isRemoteEmployee } = useStore();
  const { session } = useAuth();
  const navigate = useNavigate();

  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectComment, setRejectComment] = useState("");
  const [rejectErr, setRejectErr] = useState("");
  const [actionErr, setActionErr] = useState("");
  const [loading, setLoading] = useState(false);

  // Real approver: realRequests (Phase 6B-7); Approve/Reject call
  // decide_request via decideRealRequest (Phase 6B-8) — entirely separate
  // from approveRequest/rejectRequest, which stay local/demo-only.
  const isReal = isRemoteEmployee(session!.user.id);
  const request = (isReal ? realRequests : requests).find((r) => r.id === id);
  if (!request) return <Navigate to="/manager/requests" replace />;
  // An approver may open any request they appear in, but may only act on it
  // while it is standing at their own stage.
  if (!involvesApprover(request, session!.user.id)) return <Navigate to="/access-denied" replace />;

  // The action buttons appear only for the approver whose stage is live. A
  // later approver can read the request while it is still upstream of them,
  // but cannot decide it out of turn — same rule for real and demo data;
  // decide_request re-enforces this identically server-side.
  const isPending = awaitsDecisionBy(request, session!.user.id);
  const waitingOn = currentStep(request);

  async function handleApprove() {
    setLoading(true);
    if (isReal) {
      const res = await decideRealRequest(request!.id, "APPROVE");
      if (!res.ok) setActionErr(res.error ?? "Could not record your decision.");
      setLoading(false);
      return;
    }
    await new Promise((r) => setTimeout(r, 500));
    const res = approveRequest(request!.id, session!.user.id);
    if (!res.ok) setActionErr(res.error ?? "Could not record your decision.");
    setLoading(false);
  }

  async function handleReject() {
    if (!rejectComment.trim()) {
      setRejectErr("A comment is required when rejecting a request.");
      return;
    }
    setLoading(true);
    if (isReal) {
      const res = await decideRealRequest(request!.id, "REJECT", rejectComment.trim());
      if (!res.ok) setActionErr(res.error ?? "Could not record your decision.");
      setShowRejectModal(false);
      setRejectComment("");
      setLoading(false);
      return;
    }
    await new Promise((r) => setTimeout(r, 500));
    const res = rejectRequest(request!.id, session!.user.id, rejectComment.trim());
    if (!res.ok) setActionErr(res.error ?? "Could not record your decision.");
    setShowRejectModal(false);
    setRejectComment("");
    setLoading(false);
  }

  return (
    <DashboardShell activeNavId="requests" pageTitle="Request Details">
      <div className="max-w-2xl">
        <button
          onClick={() => navigate("/manager/requests")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Requests
        </button>

        {actionErr && <Alert variant="error" className="mb-5">{actionErr}</Alert>}

        {!isPending && waitingOn && (
          <Alert variant="info" className="mb-5">
            This request is at stage {waitingOn.stage} of {request.approvals.length}, waiting on{" "}
            {waitingOn.approverName} ({waitingOn.title.toLowerCase()}). You will be notified when it reaches you.
          </Alert>
        )}

        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <p className="text-xs font-medium text-muted-foreground">{request.requestNumber}</p>
            <h2 className="text-lg font-semibold text-foreground mt-0.5">
              {`${requestLabel(request)} Request`}
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Submitted by {request.employeeName} · {fmtRelative(request.submittedAt)}
            </p>
          </div>
          <StatusBadge status={STATUS_BADGE[request.status]} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Card className="lg:col-span-2">
            <h3 className="text-sm font-semibold text-foreground mb-4">Details</h3>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
              <div>
                <dt className="text-xs text-muted-foreground">Employee</dt>
                <dd className="text-sm text-foreground mt-0.5">
                  <div className="flex items-center gap-2">
                    <Avatar name={request.employeeName} size="sm" />
                    {request.employeeName}
                  </div>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Request Type</dt>
                <dd className="text-sm text-foreground mt-0.5">
                  {requestTypeLabel(request)}
                </dd>
              </div>
              {request.type === "LEAVE" && (
                <div>
                  <dt className="text-xs text-muted-foreground">Leave Type</dt>
                  <dd className="text-sm text-foreground mt-0.5">{request.leaveType}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-muted-foreground">
                  {request.type === "MISSION" ? "Start" : "Period"}
                </dt>
                <dd className="text-sm text-foreground mt-0.5">
                  {request.type === "LEAVE"
                    ? `${fmtDate(request.startDate)} — ${fmtDate(request.endDate)}`
                    : fmtDateTime(request.startDate, request.startTime)}
                </dd>
              </div>
              {request.type === "MISSION" && (
                <div>
                  <dt className="text-xs text-muted-foreground">End</dt>
                  <dd className="text-sm text-foreground mt-0.5">
                    {fmtDateTime(request.endDate, request.endTime)}
                  </dd>
                </div>
              )}
              {request.type === "MISSION" && request.location && (
                <div className="col-span-2">
                  <dt className="text-xs text-muted-foreground">Location</dt>
                  <dd className="text-sm text-foreground mt-0.5">{request.location}</dd>
                </div>
              )}
              {(request.reason || request.purpose) && (
                <div className="col-span-2">
                  <dt className="text-xs text-muted-foreground">
                    {request.type === "MISSION" ? "Purpose" : "Reason"}
                  </dt>
                  <dd className="text-sm text-foreground mt-0.5">
                    {request.reason ?? request.purpose}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-muted-foreground">Submitted</dt>
                <dd className="text-sm text-foreground mt-0.5">
                  {new Date(request.submittedAt).toLocaleDateString("en-GB", {
                    day: "2-digit", month: "short", year: "numeric",
                  })}
                </dd>
              </div>
            </dl>

            {request.status === "REJECTED" && request.decisionComment && (
              <div className="mt-5 pt-5 border-t border-border">
                <p className="text-xs font-semibold text-muted-foreground mb-1">Your Comment</p>
                <div className="rounded-[8px] bg-red-50 border border-red-200 px-4 py-3">
                  <p className="text-sm text-red-800">{request.decisionComment}</p>
                </div>
              </div>
            )}

            {isPending && (
              <div className="mt-5 pt-5 border-t border-border flex items-center gap-3">
                <Button variant="primary" onClick={handleApprove} loading={loading}>
                  <Check className="h-4 w-4" />
                  Approve
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setShowRejectModal(true)}
                  disabled={loading}
                >
                  <X className="h-4 w-4" />
                  Reject
                </Button>
              </div>
            )}
          </Card>

          <Card>
            <h3 className="text-sm font-semibold text-foreground mb-4">Timeline</h3>
            <RequestTimeline request={request} />
          </Card>
        </div>
      </div>

      <Modal
        open={showRejectModal}
        onClose={() => { setShowRejectModal(false); setRejectComment(""); setRejectErr(""); }}
        title="Reject Request"
        size="sm"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Provide a reason for rejection. The employee will see your comment.
          </p>
          <Textarea
            label="Comment *"
            placeholder="Explain the reason for rejection..."
            value={rejectComment}
            onChange={(e) => { setRejectComment(e.target.value); if (rejectErr) setRejectErr(""); }}
            error={rejectErr}
            rows={4}
          />
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              onClick={() => { setShowRejectModal(false); setRejectComment(""); setRejectErr(""); }}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReject} loading={loading}>
              Confirm Rejection
            </Button>
          </div>
        </div>
      </Modal>
    </DashboardShell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE: MANAGER NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════════

function ManagerNotificationsPage() {
  const { session } = useAuth();
  const {
    requests, realRequests, notifications, realNotifications,
    markNotificationRead, markAllNotificationsRead,
    markRealNotificationRead, markAllRealNotificationsRead, isRemoteEmployee,
  } = useStore();
  const navigate = useNavigate();

  const isReal = isRemoteEmployee(session!.user.id);
  const sourceRequests = isReal ? realRequests : requests;
  const sourceNotifications = isReal ? realNotifications : notifications;
  const myNotifs = [...sourceNotifications.filter((n) => n.userId === session!.user.id)].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const hasUnread = myNotifs.some((n) => !n.read);

  // A Manager/TM/GM is also an employee who can submit their own requests —
  // a notification about the recipient's OWN request (e.g. "your request
  // was approved") must open the employee-facing detail page (ownership-
  // gated), not the approver-facing one (involvesApprover-gated): the
  // recipient is never an approver on their own request (self-approval is
  // excluded from the chain), so routing every notification to
  // /manager/requests/:id sent an approver-only guard a request the viewer
  // does not appear in as an approver, producing Access Denied.
  function handleClick(n: NotificationRecord) {
    if (isReal) markRealNotificationRead(n.id);
    else markNotificationRead(n.id);
    const request = sourceRequests.find((r) => r.id === n.requestId);
    if (request && request.employeeId === session!.user.id) {
      navigate(`/employee/requests/${n.requestId}`);
    } else {
      navigate(`/manager/requests/${n.requestId}`);
    }
  }

  return (
    <DashboardShell activeNavId="notifications" pageTitle="Notifications">
      <div className="max-w-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-foreground">Notifications</h2>
          {myNotifs.length > 0 && (
            <button
              onClick={() => (isReal ? markAllRealNotificationsRead() : markAllNotificationsRead(session!.user.id))}
              disabled={!hasUnread}
              className="text-xs font-medium text-primary hover:underline disabled:text-muted-foreground disabled:no-underline disabled:cursor-not-allowed"
            >
              Mark all as read
            </button>
          )}
        </div>
        {myNotifs.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Bell className="h-8 w-8 text-muted-foreground/40" />}
              title="No notifications"
              description="You'll be notified here when team members submit requests."
            />
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {myNotifs.map((n) => (
              <button
                key={n.id}
                className={cn(
                  "flex items-start gap-4 rounded-[10px] border p-4 text-left transition-colors w-full",
                  n.read
                    ? "border-border bg-card hover:bg-muted/30"
                    : "border-primary/20 bg-accent/50 hover:bg-accent"
                )}
                onClick={() => handleClick(n)}
              >
                <div className="mt-0.5 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <BellRing className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm", !n.read && "font-medium")}>{n.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">{fmtRelative(n.createdAt)}</p>
                </div>
                {!n.read && <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-2" />}
              </button>
            ))}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGES: HR ADMINISTRATION
// ═══════════════════════════════════════════════════════════════════════════════

// ─── H01 — HR Dashboard ───────────────────────────────────────────────────────

function HRDashboardPage() {
  const { session } = useAuth();
  const { requests, realRequests, employees, notifications, isRemoteEmployee } = useStore();
  const navigate = useNavigate();

  // Real HR: realRequests (Phase 6B-13) — already scoped by RLS
  // (requests_select_hr) to every request in the system. Demo HR:
  // unchanged, local only.
  const sourceRequests = isRemoteEmployee(session!.user.id) ? realRequests : requests;

  // Same production-visibility rule as HREmployeesPage's directoryEmployees
  // and HRAttendancePage's activeEmployees: a real HR session only counts
  // production-visible real profiles; a demo session is unaffected.
  const productionVisibleEmployees = session && isRemoteEmployee(session.user.id)
    ? employees.filter((e) => isRemoteEmployee(e.id) && e.isProduction !== false)
    : employees.filter((e) => !isRemoteEmployee(e.id));
  const totalEmp = productionVisibleEmployees.length;
  const activeEmp = productionVisibleEmployees.filter((e) => e.status === "ACTIVE").length;
  const totalReq = sourceRequests.length;
  const pending = sourceRequests.filter((r) => r.status === "PENDING").length;
  const approved = sourceRequests.filter((r) => r.status === "APPROVED").length;
  const rejected = sourceRequests.filter((r) => r.status === "REJECTED").length;

  const recent = [...sourceRequests]
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
    .slice(0, 8);

  const stats = [
    { label: "Total Employees", value: totalEmp, highlight: false },
    { label: "Active Employees", value: activeEmp, highlight: false },
    { label: "Total Requests", value: totalReq, highlight: false },
    { label: "Pending", value: pending, highlight: pending > 0 },
    { label: "Approved", value: approved, highlight: false },
    { label: "Rejected", value: rejected, highlight: false },
  ];

  return (
    <DashboardShell activeNavId="dashboard" pageTitle="Dashboard">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        {stats.map(({ label, value, highlight }) => (
          <div key={label} className="contents">
            <Card padding={false}>
              <div className="p-4">
                <p className={cn("text-2xl font-semibold", highlight && value > 0 ? "text-primary" : "text-foreground")}>{value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
              </div>
            </Card>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-3 mb-6">
        <Button variant="primary" onClick={() => navigate("/hr/employees")} className="gap-1.5">
          <Plus className="h-4 w-4" /> Add Employee
        </Button>
        <Button variant="secondary" onClick={() => navigate("/hr/requests")}>
          View All Requests
        </Button>
        <Button variant="secondary" onClick={() => navigate("/hr/employees")}>
          View Employees
        </Button>
      </div>

      {/* Recent requests */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">Recent Requests</h3>
            {sourceRequests.length > 0 && (
              <button className="text-xs text-primary hover:underline" onClick={() => navigate("/hr/requests")}>
                View all
              </button>
            )}
          </div>
          {recent.length === 0 ? (
            <EmptyState
              icon={<FileText className="h-8 w-8 text-muted-foreground/40" />}
              title="No requests yet"
              description="Employee requests will appear here."
            />
          ) : (
            <div className="overflow-x-auto -mx-6 px-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {["Request #", "Employee", "Type", "Period", "Manager", "Status", "Submitted"].map((h) => (
                      <th key={h} className="text-left text-xs font-medium text-muted-foreground pb-2 pr-4 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recent.map((r) => (
                    <tr
                      key={r.id}
                      className="hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => navigate(`/hr/requests/${r.id}`)}
                    >
                      <td className="py-2.5 pr-4 font-mono text-xs text-muted-foreground">{r.requestNumber}</td>
                      <td className="py-2.5 pr-4 font-medium">{r.employeeName}</td>
                      <td className="py-2.5 pr-4 text-muted-foreground">{requestLabel(r)}</td>
                      <td className="py-2.5 pr-4 text-muted-foreground whitespace-nowrap">
                        {r.type === "MISSION" ? `${fmtDate(r.startDate)} ${r.startTime ?? ""}` : `${fmtDate(r.startDate)} – ${fmtDate(r.endDate)}`}
                      </td>
                      <td className="py-2.5 pr-4 text-muted-foreground">{r.managerName}</td>
                      <td className="py-2.5 pr-4"><StatusBadge status={STATUS_BADGE[r.status]} /></td>
                      <td className="py-2.5 text-muted-foreground whitespace-nowrap">{fmtDate(r.submittedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <MyCalendarWidget />
      </div>
    </DashboardShell>
  );
}

// ─── Employee form (used by Add and Edit) ─────────────────────────────────────

interface EmployeeFormData {
  /** Add-only: manually entered by HR, becomes the new employee's login identifier. */
  employeeCode: string;
  firstName: string; lastName: string; email: string; phone: string;
  position: string; role: UserRole;
  /** Local demo employee edits only (EmployeeForm's isRealDepartments = false). */
  department: string;
  /** Real department, id-based: Add (always) and editing a real employee. */
  departmentId: string;
  managerId: string; status: "ACTIVE" | "INACTIVE"; password: string;
  annualDays: string;
  casualDays: string;
  permissionMinutes: string;
  /** Add-only: who should report to this employee once created. Role MANAGER only. */
  teamMemberIds: string[];
}

// Add-only: lets HR pick who should report to a new Direct Manager at
// creation time. Reuses the existing managerId hierarchy as the only source
// of truth — this never introduces a separate "team" structure, it just sets
// managerId on the selected employees at submission (see createEmployee).
function TeamMembersField({
  candidates,
  allEmployees,
  selectedIds,
  onChange,
}: {
  candidates: EmployeeProfile[];
  allEmployees: EmployeeProfile[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  function toggle(id: string, alreadyManaged: boolean) {
    if (alreadyManaged) return;
    onChange(
      selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]
    );
  }

  const selected = candidates.filter((e) => selectedIds.includes(e.id));

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-foreground">Team Members</label>
      <p className="text-xs text-muted-foreground -mt-1">
        Optional. Selected employees will report directly to this manager once the account is created.
      </p>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((e) => (
            <span
              key={e.id}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium pl-2.5 pr-1.5 py-1"
            >
              {e.name}
              <button
                type="button"
                onClick={() => toggle(e.id, false)}
                className="hover:bg-primary/20 rounded-full p-0.5"
                aria-label={`Remove ${e.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="rounded-[8px] border border-border max-h-56 overflow-y-auto divide-y divide-border">
        {candidates.length === 0 ? (
          <p className="text-sm text-muted-foreground p-3">No unassigned employees available.</p>
        ) : (
          candidates.map((e) => {
            // Employees who already report to someone are shown, not hidden,
            // so HR can see why — but are not selectable here. HR already has
            // a dedicated, explicit reassignment path (Edit Employee); this
            // bulk picker never silently moves someone off their current manager.
            const alreadyManaged = !!e.managerId;
            const currentManagerName = alreadyManaged
              ? allEmployees.find((m) => m.id === e.managerId)?.name ?? "another manager"
              : null;
            const checked = selectedIds.includes(e.id);
            return (
              <label
                key={e.id}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 text-sm",
                  alreadyManaged ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-muted/40"
                )}
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border flex-shrink-0"
                  checked={checked}
                  disabled={alreadyManaged}
                  onChange={() => toggle(e.id, alreadyManaged)}
                />
                <span className="flex-1 min-w-0 truncate">
                  <span className="font-medium text-foreground">{e.name}</span>
                  <span className="text-muted-foreground"> · {e.employeeCode ?? e.id} · {e.department}</span>
                </span>
                {alreadyManaged && (
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    Reports to {currentManagerName}
                  </span>
                )}
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}

function EmployeeForm({
  initial,
  managers,
  allEmployees,
  departments,
  errors,
  onChange,
  isEdit,
  useRealDepartments,
}: {
  initial: EmployeeFormData;
  managers: EmployeeProfile[];
  allEmployees: EmployeeProfile[];
  departments: DepartmentRecord[];
  errors: Record<string, string>;
  onChange: (next: EmployeeFormData) => void;
  isEdit: boolean;
  /** True for Add (always real) and for editing an existing real employee; false only when editing a local demo employee. */
  useRealDepartments: boolean;
}) {
  function field<K extends keyof EmployeeFormData>(key: K) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      onChange({ ...initial, [key]: e.target.value });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input label="First Name *" value={initial.firstName} onChange={field("firstName")} error={errors.firstName} placeholder="First name" />
        <Input label="Last Name *" value={initial.lastName} onChange={field("lastName")} error={errors.lastName} placeholder="Last name" />
      </div>
      <Input label="Email *" type="email" value={initial.email} onChange={field("email")} error={errors.email} placeholder="email@company.com" />
      <Input label="Phone" value={initial.phone} onChange={field("phone")} placeholder="+20 10 0000 0000" />
      <Input label="Position *" value={initial.position} onChange={field("position")} error={errors.position} placeholder="e.g. Frontend Developer" />
      {useRealDepartments ? (
        <Select
          label="Department *"
          value={initial.departmentId}
          onChange={(e) => onChange({ ...initial, departmentId: e.target.value })}
          error={errors.department}
        >
          <option value="">Select Department</option>
          {departments
            .filter((d) => d.status === "ACTIVE" || d.id === initial.departmentId)
            .map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}{d.status === "INACTIVE" ? " (archived)" : ""}
              </option>
            ))}
        </Select>
      ) : (
        <Select label="Department *" value={initial.department} onChange={field("department")} error={errors.department}>
          <option value="">Select Department</option>
          {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
        </Select>
      )}
      <Select label="Role *" value={initial.role} onChange={field("role")} error={errors.role}>
        <option value="">Select Role</option>
        <option value="EMPLOYEE">Employee</option>
        <option value="MANAGER">Direct Manager</option>
        {/* Technical Manager/General Manager are singleton roles assigned via
            Approval Routing (HR Settings), not created here — createEmployee
            rejects them; only offer what Add can actually create. Editing an
            existing employee still needs every role: HR is a plain, safe
            profiles.role reassignment (no singleton constraint), and
            TECH_MANAGER/GM are shown so selecting one surfaces the redirect
            to Approval Routing rather than silently vanishing as an option. */}
        {isEdit && (
          <>
            <option value="TECH_MANAGER">Technical Manager</option>
            <option value="GM">General Manager</option>
            <option value="HR">HR</option>
          </>
        )}
      </Select>
      {!isEdit && initial.role === "MANAGER" && (
        <TeamMembersField
          candidates={allEmployees.filter((e) => e.role === "EMPLOYEE" && e.status === "ACTIVE")}
          allEmployees={allEmployees}
          selectedIds={initial.teamMemberIds}
          onChange={(ids) => onChange({ ...initial, teamMemberIds: ids })}
        />
      )}
      <Select label="Direct Manager" value={initial.managerId} onChange={field("managerId")} error={errors.managerId}>
        <option value="">None</option>
        {managers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
      </Select>
      <Select label="Account Status" value={initial.status} onChange={field("status")} error={errors.status}>
        <option value="ACTIVE">Active</option>
        <option value="INACTIVE">Inactive</option>
      </Select>
      <div className="rounded-[8px] border border-border bg-muted/30 p-4 flex flex-col gap-3">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Opening balances
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Set once, here. The system decrements them automatically as leave is approved.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            label="Annual (days) *" type="number" min={0} max={365}
            value={initial.annualDays} onChange={field("annualDays")} error={errors.annualDays}
          />
          <Input
            label="Casual (days) *" type="number" min={0} max={365}
            value={initial.casualDays} onChange={field("casualDays")} error={errors.casualDays}
          />
          <Input
            label="Permission (min/month) *" type="number" min={0} max={2400} step={15}
            value={initial.permissionMinutes} onChange={field("permissionMinutes")} error={errors.permissionMinutes}
          />
        </div>
      </div>

      {isEdit ? (
        <PasswordInput
          label="Password"
          value={initial.password}
          onChange={field("password")}
          error={errors.password}
          hint="Leave blank to keep the current password."
          placeholder="Leave blank to keep the current password"
          autoComplete="new-password"
        />
      ) : (
        <>
          <Input
            label="Employee Code *"
            value={initial.employeeCode}
            onChange={field("employeeCode")}
            error={errors.employeeCode}
            placeholder="e.g. ansary34"
            hint="This is the code the employee will use to sign in."
          />
          <PasswordInput
            label="Initial Password *"
            value={initial.password}
            onChange={field("password")}
            error={errors.password}
            hint="The employee signs in with their Employee Code and this password."
            placeholder="Temporary password for this employee"
            autoComplete="new-password"
          />
        </>
      )}
    </div>
  );
}

// ─── H02 — HR Employees ───────────────────────────────────────────────────────

// Balance fields are text inputs, so they need their own numeric check.
function validateBalanceFields(form: EmployeeFormData): Record<string, string> {
  const errors: Record<string, string> = {};
  const check = (raw: string, key: string, label: string, max: number) => {
    const n = Number(raw);
    if (raw.trim() === "" || !Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
      errors[key] = `${label} must be a whole number of 0 or more.`;
    } else if (n > max) {
      errors[key] = `${label} cannot exceed ${max}.`;
    }
  };
  check(form.annualDays, "annualDays", "Annual days", 365);
  check(form.casualDays, "casualDays", "Casual days", 365);
  check(form.permissionMinutes, "permissionMinutes", "Permission minutes", 2400);
  return errors;
}

const EMPTY_FORM: EmployeeFormData = {
  employeeCode: "",
  firstName: "", lastName: "", email: "", phone: "",
  position: "", department: "", departmentId: "", role: "EMPLOYEE" as UserRole,
  managerId: "", status: "ACTIVE", password: "",
  annualDays: "14", casualDays: "7", permissionMinutes: "240",
  teamMemberIds: [],
};

function HREmployeesPage() {
  const { session } = useAuth();
  const { employees, createEmployee, updateEmployee, isRemoteEmployee, departments, fetchEmployeeLeaveAllocations } = useStore();
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<"" | UserRole>("");
  const [filterDept, setFilterDept] = useState("");
  const [filterStatus, setFilterStatus] = useState<"" | "ACTIVE" | "INACTIVE">("");

  // The directory shown here is real-vs-demo isolated exactly like every
  // other HR section (Holidays, Leave Types, Departments...) already is: a
  // real HR session sees only real Supabase profiles, a local demo HR
  // session sees only the local demo roster. Among real profiles, only
  // is_production ones are shown — legacy/test profiles (kept only because
  // protected historical requests reference them) are excluded from the
  // normal directory without being deleted or deactivated. `employees`
  // itself (the combined list) is left untouched — eligibleManagers below,
  // and every other consumer of useStore().employees (including a
  // legacy/test account finding its own profile), still reads the full list.
  const directoryEmployees = session && isRemoteEmployee(session.user.id)
    ? employees.filter((e) => isRemoteEmployee(e.id) && e.isProduction !== false)
    : employees.filter((e) => !isRemoteEmployee(e.id));

  // Add employee modal
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<EmployeeFormData>(EMPTY_FORM);
  const [addErrors, setAddErrors] = useState<Record<string, string>>({});
  const [addResult, setAddResult] = useState<{ employee: EmployeeProfile; password: string; warning?: string } | null>(null);
  const [addSaving, setAddSaving] = useState(false);

  // Edit employee modal
  const [editTarget, setEditTarget] = useState<EmployeeProfile | null>(null);
  const [editForm, setEditForm] = useState<EmployeeFormData>(EMPTY_FORM);
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [editSaving, setEditSaving] = useState(false);

  // View detail modal
  const [viewTarget, setViewTarget] = useState<EmployeeProfile | null>(null);

  // Surfaces a refused Activate/Deactivate instead of failing silently.
  const [actionError, setActionError] = useState("");

  // Same production-visibility list as the directory above — Team Members
  // and Direct Manager must only offer production-visible candidates, not
  // the raw combined employees list (which also carries demo profiles for
  // a real session, and legacy/test real profiles regardless of session).
  const eligibleManagers = getEligibleManagers(directoryEmployees);

  // Filtering
  const q = search.toLowerCase().trim();
  const filtered = directoryEmployees.filter((e) => {
    if (q && !e.name.toLowerCase().includes(q) && !e.id.toLowerCase().includes(q) && !(e.employeeCode?.toLowerCase().includes(q) ?? false)) return false;
    if (filterRole && e.role !== filterRole) return false;
    if (filterDept && e.department !== filterDept) return false;
    if (filterStatus && e.status !== filterStatus) return false;
    return true;
  });

  function openEdit(emp: EmployeeProfile) {
    setEditTarget(emp);
    setEditForm({
      // Add-only field, unused in Edit — see EmployeeForm's isEdit guard.
      employeeCode: "",
      firstName: emp.firstName, lastName: emp.lastName, email: emp.email,
      phone: emp.phone ?? "", position: emp.position, department: emp.department,
      departmentId: emp.departmentId ?? "",
      role: emp.role, managerId: emp.managerId ?? "", status: emp.status, password: "",
      annualDays: String(emp.entitlements?.ANNUAL ?? DEFAULT_ENTITLEMENTS.ANNUAL),
      casualDays: String(emp.entitlements?.CASUAL ?? DEFAULT_ENTITLEMENTS.CASUAL),
      permissionMinutes: String(emp.permissionMinutesPerMonth ?? DEFAULT_PERMISSION_MINUTES),
      // Team Members is an add-only field — editing a manager's team happens
      // by editing each report's own Direct Manager, unchanged by this feature.
      teamMemberIds: [],
    });
    setEditErrors({});

    // Real employee: the form above opens immediately with a same-as-today
    // placeholder (emp.entitlements is hardcoded 0/0 for every remote
    // profile — see mapProfileRowToEmployeeProfile), then quietly replaces
    // Annual/Casual Days with that employee's actual current-year
    // leave_allocations once the fetch resolves — never a stale previous
    // employee's numbers, and never a fabricated non-zero default.
    if (isRemoteEmployee(emp.id)) {
      fetchEmployeeLeaveAllocations(emp.id).then((real) => {
        setEditForm((prev) => ({
          ...prev,
          annualDays: String(real.ANNUAL),
          casualDays: String(real.CASUAL),
        }));
      });
    }
  }

  async function handleAdd() {
    const errs = validateEmployeeFields(
      { ...addForm, managerId: addForm.managerId || undefined },
      employees
    );
    if (!addForm.password.trim()) errs.password = "Initial password is required.";
    Object.assign(errs, validateBalanceFields(addForm));
    if (Object.keys(errs).length > 0) { setAddErrors(errs); return; }
    setAddSaving(true);
    const result = await createEmployee({
      employeeCode: addForm.employeeCode,
      firstName: addForm.firstName,
      lastName: addForm.lastName,
      email: addForm.email,
      position: addForm.position,
      role: addForm.role,
      status: addForm.status,
      password: addForm.password,
      teamMemberIds: addForm.teamMemberIds,
      departmentId: addForm.departmentId,
      managerId: addForm.managerId || null,
      phone: addForm.phone || undefined,
      annualDays: Number(addForm.annualDays),
      casualDays: Number(addForm.casualDays),
      permissionMinutes: Number(addForm.permissionMinutes),
    });
    setAddSaving(false);
    if (!result.ok) { setAddErrors((result as { ok: false; errors: Record<string, string> }).errors); return; }
    setAddResult({ employee: result.employee, password: result.password, warning: result.warning });
  }

  async function handleEdit() {
    if (!editTarget) return;
    const errs = validateEmployeeFields(
      { ...editForm, managerId: editForm.managerId || undefined },
      employees, editTarget.id
    );
    Object.assign(errs, validateBalanceFields(editForm));
    if (Object.keys(errs).length > 0) { setEditErrors(errs); return; }
    setEditSaving(true);
    const isReal = isRemoteEmployee(editTarget.id);

    // A real employee's password lives in Supabase Auth, not the profile
    // row — changed first, and gated on, so a failure here never leaves HR
    // thinking the password changed when the rest of the form saved (or
    // vice versa). Left blank, the existing password is untouched: HR is
    // never shown it and never asked to re-enter it. Local demo employees
    // are unaffected — their password stays in the existing local
    // credential store, updated after the save below, exactly as before.
    const newPassword = editForm.password.trim();
    if (newPassword && isReal) {
      const pwResult = await adminUpdateEmployeePassword(editTarget.id, newPassword);
      if (!pwResult.ok) {
        setEditErrors({ password: pwResult.error });
        setEditSaving(false);
        return;
      }
      setEditForm((f) => ({ ...f, password: "" }));
    }

    const result = await updateEmployee(editTarget.id, {
      firstName: editForm.firstName.trim(),
      lastName: editForm.lastName.trim(),
      name: `${editForm.firstName.trim()} ${editForm.lastName.trim()}`,
      email: editForm.email.trim().toLowerCase(),
      phone: editForm.phone.trim() || undefined,
      position: editForm.position.trim(),
      // Local demo employees keep the plain department string unchanged;
      // a real employee's department is only ever set via departmentId —
      // see updateEmployee's remote branch.
      ...(isReal ? { departmentId: editForm.departmentId } : { department: editForm.department }),
      role: editForm.role,
      managerId: editForm.managerId || null,
      status: editForm.status,
      entitlements: { ANNUAL: Number(editForm.annualDays), CASUAL: Number(editForm.casualDays) },
      permissionMinutesPerMonth: Number(editForm.permissionMinutes),
    });
    if (!result.ok) {
      setEditErrors({ _form: result.error ?? "Could not save changes." });
      setEditSaving(false);
      return;
    }
    // Local demo employees only — the real-employee case was already handled
    // above via Supabase Auth and its password field already cleared.
    if (newPassword && !isReal) {
      updateHRUserCredential(editTarget.id, { password: newPassword });
    }
    setEditSaving(false);
    setEditTarget(null);
  }

  return (
    <DashboardShell activeNavId="employees" pageTitle="Employees">
      {/* Toolbar */}
      {actionError && (
        <Alert variant="error" className="mb-4">{actionError}</Alert>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            className="w-full pl-9 pr-3 py-2 rounded-[8px] border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="Search employees..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="px-3 py-2 rounded-[8px] border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value as "" | UserRole)}
        >
          <option value="">All Roles</option>
          <option value="EMPLOYEE">Employee</option>
          <option value="MANAGER">Direct Manager</option>
          <option value="TECH_MANAGER">Technical Manager</option>
          <option value="GM">General Manager</option>
          <option value="HR">HR</option>
        </select>
        <select
          className="px-3 py-2 rounded-[8px] border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          value={filterDept}
          onChange={(e) => setFilterDept(e.target.value)}
        >
          <option value="">All Departments</option>
          {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
          {departments
            .filter((d) => !(DEPARTMENTS as readonly string[]).includes(d.name))
            .map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
        </select>
        <select
          className="px-3 py-2 rounded-[8px] border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as "" | "ACTIVE" | "INACTIVE")}
        >
          <option value="">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
        <Button variant="primary" onClick={() => { setShowAdd(true); setAddForm(EMPTY_FORM); setAddErrors({}); setAddResult(null); }} className="gap-1.5 flex-shrink-0">
          <Plus className="h-4 w-4" /> Add Employee
        </Button>
      </div>

      {/* Count — against directoryEmployees (the same production-visible list
          `filtered` is derived from), not the raw combined `employees`,
          which also holds local demo employees and hidden historical/test
          profiles that never appear in this directory. */}
      <p className="text-xs text-muted-foreground mb-3">
        {filtered.length === directoryEmployees.length
          ? `${directoryEmployees.length} employee${directoryEmployees.length === 1 ? "" : "s"}`
          : `${filtered.length} of ${directoryEmployees.length} employees`}
      </p>

      {/* Table */}
      <Card padding={false}>
        {filtered.length === 0 ? (
          <div className="p-6">
            <EmptyState icon={<Users className="h-8 w-8 text-muted-foreground/40" />} title="No employees found" description="Try adjusting your search or filters." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {["Employee", "Employee ID", "Position", "Department", "Manager", "Role", "Status", "Actions"].map((h) => (
                    <th key={h} className="text-left text-xs font-medium text-muted-foreground px-4 py-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((emp) => {
                  const mgr = employees.find((e) => e.id === emp.managerId);
                  return (
                    <tr key={emp.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={emp.name} size="sm" />
                          <button className="font-medium hover:text-primary transition-colors" onClick={() => setViewTarget(emp)}>
                            {emp.name}
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{emp.employeeCode ?? emp.id}</td>
                      <td className="px-4 py-3 text-muted-foreground">{emp.position}</td>
                      <td className="px-4 py-3 text-muted-foreground">{emp.department}</td>
                      <td className="px-4 py-3 text-muted-foreground">{mgr ? mgr.name : "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{ROLE_LABEL[emp.role]}</td>
                      <td className="px-4 py-3"><StatusBadge status={emp.status === "ACTIVE" ? "active" : "inactive"} /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEdit(emp)}
                            className="text-xs text-primary hover:underline font-medium"
                          >
                            Edit
                          </button>
                          <button
                            onClick={async () => {
                              const res = await updateEmployee(emp.id, { status: emp.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" });
                              setActionError(res.ok ? "" : res.error ?? "");
                            }}
                            className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                          >
                            {emp.status === "ACTIVE" ? "Deactivate" : "Activate"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Add Employee Modal */}
      <Modal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        title="Add Employee"
        size="lg"
        footer={
          addResult ? (
            <div className="flex gap-3">
              <Button variant="primary" onClick={() => { setShowAdd(false); setAddResult(null); }}>Back to Employees</Button>
            </div>
          ) : (
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setShowAdd(false)} disabled={addSaving}>Cancel</Button>
              <Button variant="primary" onClick={handleAdd} loading={addSaving}>{addSaving ? "Creating…" : "Create Employee"}</Button>
            </div>
          )
        }
      >
        {addResult ? (
          <div className="flex flex-col gap-4">
            <Alert variant="success">
              <p className="text-sm font-medium">Employee created successfully.</p>
            </Alert>
            {addResult.warning && (
              <Alert variant="warning">
                <p className="text-sm">{addResult.warning}</p>
              </Alert>
            )}
            <div className="rounded-[10px] border border-border divide-y divide-border">
              {[
                { label: "Employee ID", value: addResult.employee.employeeCode ?? addResult.employee.id },
                { label: "Name", value: addResult.employee.name },
                { label: "Role", value: addResult.employee.role },
                { label: "Manager", value: employees.find((e) => e.id === addResult.employee.managerId)?.name ?? "None" },
                { label: "Status", value: addResult.employee.status },
                { label: "Temp Password", value: addResult.password },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center gap-4 px-4 py-2.5">
                  <p className="text-xs text-muted-foreground w-28 flex-shrink-0">{label}</p>
                  <p className="text-sm font-medium">{value}</p>
                </div>
              ))}
            </div>
            {addResult.employee.role === "MANAGER" && (() => {
              // employees is already the post-creation state (StoreProvider's
              // mutate() re-renders synchronously), so this reflects exactly
              // who now reports to the new manager — not just what was requested.
              const team = employees.filter((e) => e.managerId === addResult.employee.id);
              return team.length > 0 ? (
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">
                    Team Members ({team.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {team.map((e) => (
                      <span key={e.id} className="inline-flex items-center rounded-full bg-primary/10 text-primary text-xs font-medium px-2.5 py-1">
                        {e.name}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No team members assigned yet.</p>
              );
            })()}
            <p className="text-xs text-muted-foreground">Share the temporary password with the employee so they can log in.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {addErrors._form && <Alert variant="error">{addErrors._form}</Alert>}
            <EmployeeForm
              initial={addForm}
              managers={eligibleManagers}
              allEmployees={directoryEmployees}
              departments={departments}
              errors={addErrors}
              onChange={setAddForm}
              isEdit={false}
              useRealDepartments={true}
            />
          </div>
        )}
      </Modal>

      {/* Edit Employee Modal */}
      <Modal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        title={`Edit Employee — ${editTarget?.name ?? ""}`}
        size="lg"
        footer={
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setEditTarget(null)} disabled={editSaving}>Cancel</Button>
            <Button variant="primary" onClick={handleEdit} loading={editSaving}>{editSaving ? "Saving…" : "Save Changes"}</Button>
          </div>
        }
      >
        <EmployeeForm
          initial={editForm}
          managers={eligibleManagers.filter((m) => m.id !== editTarget?.id)}
          allEmployees={directoryEmployees}
          departments={departments}
          errors={editErrors}
          onChange={setEditForm}
          isEdit={true}
          useRealDepartments={!!editTarget && isRemoteEmployee(editTarget.id)}
        />
      </Modal>

      {/* View Employee Modal */}
      <Modal open={!!viewTarget} onClose={() => setViewTarget(null)} title="Employee Details" size="md"
        footer={
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setViewTarget(null)}>Close</Button>
            <Button variant="primary" onClick={() => { if (viewTarget) { openEdit(viewTarget); setViewTarget(null); } }}>Edit Employee</Button>
          </div>
        }
      >
        {viewTarget && (
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-4">
              <Avatar name={viewTarget.name} size="lg" />
              <div>
                <p className="text-base font-semibold">{viewTarget.name}</p>
                <p className="text-sm text-muted-foreground">{viewTarget.position} · {viewTarget.department}</p>
                <div className="mt-1.5"><StatusBadge status={viewTarget.status === "ACTIVE" ? "active" : "inactive"} /></div>
              </div>
            </div>
            <div className="rounded-[10px] border border-border divide-y divide-border">
              {[
                { label: "Employee ID", value: viewTarget.employeeCode ?? viewTarget.id },
                { label: "Email", value: viewTarget.email },
                ...(viewTarget.phone ? [{ label: "Phone", value: viewTarget.phone }] : []),
                { label: "Role", value: viewTarget.role.charAt(0) + viewTarget.role.slice(1).toLowerCase() },
                { label: "Department", value: viewTarget.department },
                { label: "Direct Manager", value: employees.find((e) => e.id === viewTarget.managerId)?.name ?? "None" },
                { label: "Direct Reports", value: String(employees.filter((e) => e.managerId === viewTarget.id).length) },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center gap-4 px-4 py-2.5">
                  <p className="text-xs text-muted-foreground w-28 flex-shrink-0">{label}</p>
                  <p className="text-sm">{value}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </DashboardShell>
  );
}

// ─── H04 — HR Requests ────────────────────────────────────────────────────────

function HRRequestsPage() {
  const { session } = useAuth();
  const { requests, realRequests, employees, isRemoteEmployee } = useStore();
  const navigate = useNavigate();

  // Real HR: realRequests (Phase 6B-7) — request_approvals RLS's is_hr()
  // grants a real HR session every request, matching requests_select_hr.
  // Demo HR: unchanged, local requests only — never merged with real data.
  const requests_ = isRemoteEmployee(session!.user.id) ? realRequests : requests;

  const [filterManager, setFilterManager] = useState("");
  const [filterEmployee, setFilterEmployee] = useState("");
  const [filterType, setFilterType] = useState<"" | "LEAVE" | "MISSION">("");
  const [filterStatus, setFilterStatus] = useState<"" | "PENDING" | "APPROVED" | "REJECTED">("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  // Build unique manager list from actual request data (preserves historical)
  const allManagers = Array.from(
    new Map(requests_.map((r) => [r.managerId, r.managerName])).entries()
  ).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));

  const allEmployees = Array.from(
    new Map(requests_.map((r) => [r.employeeId, r.employeeName])).entries()
  ).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));

  const hasFilters = !!(filterManager || filterEmployee || filterType || filterStatus || filterFrom || filterTo);

  function clearFilters() {
    setFilterManager(""); setFilterEmployee(""); setFilterType(""); setFilterStatus(""); setFilterFrom(""); setFilterTo("");
  }

  const filtered = requests_.filter((r) => {
    if (filterManager && r.managerId !== filterManager) return false;
    if (filterEmployee && r.employeeId !== filterEmployee) return false;
    if (filterType && r.type !== filterType) return false;
    if (filterStatus && r.status !== filterStatus) return false;
    if (filterFrom && r.submittedAt < filterFrom) return false;
    if (filterTo && r.submittedAt.slice(0, 10) > filterTo) return false;
    return true;
  }).sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

  return (
    <DashboardShell activeNavId="requests" pageTitle="All Requests">
      {/* Filter bar */}
      <Card className="mb-5">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <select className="px-3 py-2 rounded-[8px] border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" value={filterManager} onChange={(e) => setFilterManager(e.target.value)}>
            <option value="">All Managers</option>
            {allManagers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <select className="px-3 py-2 rounded-[8px] border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" value={filterEmployee} onChange={(e) => setFilterEmployee(e.target.value)}>
            <option value="">All Employees</option>
            {allEmployees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <select className="px-3 py-2 rounded-[8px] border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" value={filterType} onChange={(e) => setFilterType(e.target.value as "" | "LEAVE" | "MISSION")}>
            <option value="">All Types</option>
            <option value="LEAVE">Leave</option>
            <option value="MISSION">Mission</option>
          </select>
          <select className="px-3 py-2 rounded-[8px] border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as "" | "PENDING" | "APPROVED" | "REJECTED")}>
            <option value="">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
          <input type="date" className="px-3 py-2 rounded-[8px] border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} placeholder="From" />
          <input type="date" className="px-3 py-2 rounded-[8px] border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} placeholder="To" />
        </div>
        {hasFilters && (
          <div className="mt-3 flex items-center gap-2">
            <p className="text-xs text-muted-foreground">{filtered.length} of {requests_.length} requests</p>
            <button onClick={clearFilters} className="text-xs text-primary hover:underline flex items-center gap-1">
              <X className="h-3 w-3" /> Clear Filters
            </button>
          </div>
        )}
      </Card>

      <Card padding={false}>
        {filtered.length === 0 ? (
          <div className="p-6">
            <EmptyState icon={<FileText className="h-8 w-8 text-muted-foreground/40" />} title="No requests found" description={hasFilters ? "Try adjusting your filters." : "No requests have been submitted yet."} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {["Request #", "Employee", "Type", "Leave Type", "Period", "Manager", "Status", "Submitted"].map((h) => (
                    <th key={h} className="text-left text-xs font-medium text-muted-foreground px-4 py-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/30 cursor-pointer transition-colors" onClick={() => navigate(`/hr/requests/${r.id}`)}>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{r.requestNumber}</td>
                    <td className="px-4 py-3 font-medium">{r.employeeName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.type}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.leaveType ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {requestPeriod(r)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{r.managerName}</td>
                    <td className="px-4 py-3"><StatusBadge status={STATUS_BADGE[r.status]} /></td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{fmtDate(r.submittedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </DashboardShell>
  );
}

// ─── H05 — HR Request Detail ──────────────────────────────────────────────────

function HRRequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { session } = useAuth();
  const { requests, realRequests, employees, isRemoteEmployee } = useStore();
  const navigate = useNavigate();

  // Real HR: realRequests (Phase 6B-7); demo HR: unchanged, local only.
  const request = (isRemoteEmployee(session!.user.id) ? realRequests : requests).find((r) => r.id === id);

  if (!request) {
    return (
      <DashboardShell activeNavId="requests" pageTitle="Request Detail">
        <Alert variant="error">
          <p className="text-sm">Request not found.</p>
        </Alert>
      </DashboardShell>
    );
  }

  const emp = employees.find((e) => e.id === request.employeeId);
  const decidingStep = [...request.approvals].reverse().find((a) => a.status !== "PENDING");
  const decidedByName = decidingStep ? `${decidingStep.approverName} (${decidingStep.title})` : "";

  // Common to every request type. Type-specific fields (dates, times, leave
  // type, location, purpose, reason, ...) live in typeDetails below instead —
  // Leave, Mission and Permission each submit different information, so they
  // are no longer forced into one shared field list.
  const details: { label: string; value: string }[] = [
    { label: "Request Number", value: request.requestNumber },
    { label: "Employee", value: request.employeeName },
    { label: "Employee ID", value: request.employeeId },
    { label: "Department", value: emp?.department ?? "—" },
    { label: "Approval Stage", value: stageLabel(request) },
    { label: "Request Type", value: requestTypeLabel(request) },
    { label: "Submitted", value: fmtDate(request.submittedAt) },
    ...(request.decidedAt ? [{ label: "Decided", value: fmtDate(request.decidedAt) }] : []),
    ...(request.decisionComment
      ? [{
          label: "Decision Comment",
          value: `${request.decisionComment}${decidedByName ? ` — ${decidedByName}` : ""}`,
        }]
      : []),
  ];

  const typeDetails = requestTypeDetailFields(request);

  return (
    <DashboardShell activeNavId="requests" pageTitle="Request Detail">
      <div className="max-w-2xl">
        <button
          onClick={() => navigate("/hr/requests")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to All Requests
        </button>

        <Card>
          <div className="flex items-start justify-between mb-5">
            <div>
              <h2 className="text-lg font-semibold text-foreground">{request.requestNumber}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {requestLabel(request)} · {request.employeeName}
              </p>
            </div>
            <StatusBadge status={STATUS_BADGE[request.status]} />
          </div>

          <div className="rounded-[10px] border border-border divide-y divide-border mb-5">
            {details.map(({ label, value }) => (
              <div key={label} className="flex items-start gap-4 px-4 py-2.5">
                <p className="text-xs text-muted-foreground w-32 flex-shrink-0 pt-0.5">{label}</p>
                <p className="text-sm text-foreground">{value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-[10px] border border-border p-4 mb-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              Request Details
            </p>
            <div className="divide-y divide-border -mx-4">
              {typeDetails.map(({ label, value }) => (
                <div key={label} className="flex items-start gap-4 px-4 py-2.5">
                  <p className="text-xs text-muted-foreground w-32 flex-shrink-0 pt-0.5">{label}</p>
                  <p className="text-sm text-foreground">{value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[10px] border border-border p-4 mb-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              Approval chain
            </p>
            <RequestTimeline request={request} />
          </div>

          <Alert variant="info">
            <p className="text-sm text-blue-800">
              HR can view request details. Approval stays with the three-stage management chain: direct manager, technical manager, then general manager.
            </p>
          </Alert>
        </Card>
      </div>
    </DashboardShell>
  );
}

// ─── H06 — HR Notifications ───────────────────────────────────────────────────

function HRNotificationsPage() {
  const { session } = useAuth();
  const {
    notifications, realNotifications, markNotificationRead, markAllNotificationsRead,
    markRealNotificationRead, markAllRealNotificationsRead, isRemoteEmployee,
  } = useStore();
  const navigate = useNavigate();

  const isReal = isRemoteEmployee(session!.user.id);
  const sourceNotifications = isReal ? realNotifications : notifications;
  const myNotifs = [...sourceNotifications.filter((n) => n.userId === session!.user.id)].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const hasUnread = myNotifs.some((n) => !n.read);

  return (
    <DashboardShell activeNavId="notifications" pageTitle="Notifications">
      <div className="max-w-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-foreground">Notifications</h2>
          {myNotifs.length > 0 && (
            <button
              onClick={() => (isReal ? markAllRealNotificationsRead() : markAllNotificationsRead(session!.user.id))}
              disabled={!hasUnread}
              className="text-xs font-medium text-primary hover:underline disabled:text-muted-foreground disabled:no-underline disabled:cursor-not-allowed"
            >
              Mark all as read
            </button>
          )}
        </div>
        {myNotifs.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Bell className="h-8 w-8 text-muted-foreground/40" />}
              title="No notifications"
              description="Administrative notifications will appear here."
            />
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {myNotifs.map((n) => (
              <button
                key={n.id}
                className={cn(
                  "flex items-start gap-4 rounded-[10px] border p-4 text-left transition-colors w-full",
                  n.read ? "border-border bg-card hover:bg-muted/30" : "border-primary/20 bg-accent/50 hover:bg-accent"
                )}
                onClick={() => {
                  if (isReal) markRealNotificationRead(n.id);
                  else markNotificationRead(n.id);
                  navigate(`/hr/requests/${n.requestId}`);
                }}
              >
                <div className="mt-0.5 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <BellRing className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm", !n.read && "font-medium")}>{n.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">{fmtRelative(n.createdAt)}</p>
                </div>
                {!n.read && <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-2" />}
              </button>
            ))}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

// ─── HR Settings — Leave Types ────────────────────────────────────────────────

// ─── HR — Attendance ──────────────────────────────────────────────────────────
// HR enters what the fingerprint device recorded. Lateness and early departure
// are charged to the employee's monthly permission allowance automatically, so
// there is nothing to remember to run afterwards.

function HRAttendancePage() {
  const { employees, attendance, realAttendance, requests, realRequests, recordAttendance, deleteAttendance, importAttendance, isRemoteEmployee } = useStore();
  const { session } = useAuth();

  // Real HR: realAttendance (Phase 6B-10), already scoped by RLS to every
  // employee's records (attendance_select_self_or_hr's is_hr() branch).
  // Demo HR: unchanged, local records only. sourceRequests follows the same
  // split, for the per-row permission-balance figure below.
  const isReal = isRemoteEmployee(session!.user.id);
  const sourceAttendance = isReal ? realAttendance : attendance;
  const sourceRequests = isReal ? realRequests : requests;

  const today = toISODate(new Date());
  const [employeeId, setEmployeeId] = useState("");
  const [date, setDate] = useState(today);
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [saving, setSaving] = useState(false);
  const [filterMonth, setFilterMonth] = useState(currentMonthKey(new Date()));

  // Attendance Excel upload/import. Accepts .xls/.xlsx by extension and by
  // the two standard Excel MIME types (browsers/OSes are inconsistent about
  // which MIME type they report for .xls, so the extension check is the
  // primary signal and the MIME check is a secondary corroboration, not a
  // gate). Selecting a file parses it immediately (client-side, via
  // attendanceImport.ts) to build the preview below — nothing is persisted
  // until HR confirms with "Import Attendance", and even then the server
  // (hr_import_attendance) — not this preview — decides what's actually new.
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelFileError, setExcelFileError] = useState("");
  const excelFileInputRef = useRef<HTMLInputElement>(null);
  const EXCEL_MIME_TYPES = [
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ];

  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState("");
  const [parsedRows, setParsedRows] = useState<ParsedAttendanceRow[] | null>(null);
  const [invalidRows, setInvalidRows] = useState<AttendanceRowError[]>([]);
  const [detectedName, setDetectedName] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importErrorMsg, setImportErrorMsg] = useState("");
  const [importResult, setImportResult] = useState<{ inserted: number; skipped: number; who: string } | null>(null);

  function resetImportPreview() {
    setParsedRows(null);
    setInvalidRows([]);
    setDetectedName(null);
    setParseError("");
    setImportErrorMsg("");
    setImportResult(null);
  }

  async function handleExcelFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file after clearing
    if (!file) return;
    resetImportPreview();
    const isXlsExt = /\.(xls|xlsx)$/i.test(file.name);
    const isExcelMime = file.type === "" || EXCEL_MIME_TYPES.includes(file.type);
    if (!isXlsExt || !isExcelMime) {
      setExcelFileError(`Unsupported file type: ${file.name}. Please select an .xls or .xlsx attendance file.`);
      setExcelFile(null);
      return;
    }
    setExcelFileError("");
    setExcelFile(file);

    setParsing(true);
    try {
      const buffer = await file.arrayBuffer();
      const result = parseAttendanceWorkbook(buffer);
      if (!result.ok) {
        setParseError(result.error);
      } else if (result.rows.length === 0) {
        setParseError("No valid attendance rows were found in this file.");
        setInvalidRows(result.invalidRows);
      } else {
        setParsedRows(result.rows);
        setInvalidRows(result.invalidRows);
        setDetectedName(result.detectedName);
      }
    } catch {
      setParseError("Could not read this file. Please make sure it's a valid .xls or .xlsx attendance export.");
    } finally {
      setParsing(false);
    }
  }

  function clearExcelFile() {
    setExcelFile(null);
    setExcelFileError("");
    resetImportPreview();
  }

  // Same production-visibility rule as HREmployeesPage's directoryEmployees:
  // a real HR session only sees production-visible real profiles (legacy/test
  // profiles stay in the database, just excluded from this picker); a demo
  // session is unaffected. `employees` itself (used elsewhere, e.g.
  // recordAttendance's existence check) is left untouched.
  const productionVisibleEmployees = session && isRemoteEmployee(session.user.id)
    ? employees.filter((e) => isRemoteEmployee(e.id) && e.isProduction !== false)
    : employees.filter((e) => !isRemoteEmployee(e.id));
  const activeEmployees = productionVisibleEmployees.filter((e) => e.status === "ACTIVE");

  // Import preview — every figure here is a client-side estimate for HR to
  // review before confirming. None of it is trusted for final accounting:
  // the actual insert/skip counts always come back from hr_import_attendance
  // after HR clicks "Import Attendance" (handleImportConfirm below).
  const importTargetEmployee = employees.find((e) => e.id === employeeId);
  const nameMismatch = !!parsedRows && !!importTargetEmployee && namesLikelyMismatch(importTargetEmployee.name, detectedName);

  const periodStart = parsedRows?.length ? parsedRows.reduce((min, r) => (r.date < min ? r.date : min), parsedRows[0].date) : null;
  const periodEnd = parsedRows?.length ? parsedRows.reduce((max, r) => (r.date > max ? r.date : max), parsedRows[0].date) : null;

  const existingDatesForEmployee = new Set(
    sourceAttendance.filter((a) => a.employeeId === employeeId).map((a) => a.date)
  );
  const newRows = parsedRows?.filter((r) => !existingDatesForEmployee.has(r.date)) ?? [];
  const alreadyImportedCount = (parsedRows?.length ?? 0) - newRows.length;

  const summaryLate = parsedRows?.reduce((s, r) => s + r.lateMinutes, 0) ?? 0;
  const summaryEarly = parsedRows?.reduce((s, r) => s + r.earlyMinutes, 0) ?? 0;
  const summaryOvertime = parsedRows?.reduce((s, r) => s + r.overtimeMinutes, 0) ?? 0;
  const summaryAbsentDays = parsedRows?.filter((r) => r.isAbsent).length ?? 0;

  // Simulated post-import Permission balance: feeds the exact same
  // getPermissionBalance the rest of the app already uses (header,
  // dashboard, Records table) a merged array of real attendance + not-yet-
  // persisted new rows. The preview rows carry the file's actual
  // checkIn/checkOut (never synthesized) plus its explicit lateMinutes/
  // earlyMinutes — lateMinutes()/earlyLeaveMinutes() read those stored
  // fields directly (store.ts), so this is the same one formula the server
  // uses, just evaluated against not-yet-persisted rows. Preview-only — the
  // real number always comes from a fresh fetchRealAttendance() after import.
  const previewMonth = periodStart ? monthKey(periodStart) : null;
  const previewBalance =
    importTargetEmployee && previewMonth
      ? getPermissionBalance(
          importTargetEmployee,
          sourceRequests,
          [
            ...sourceAttendance,
            ...newRows.map((r, i): AttendanceRecord => ({
              id: `import-preview-${i}`,
              employeeId,
              date: r.date,
              checkIn: r.clockIn ?? undefined,
              checkOut: r.clockOut ?? undefined,
              lateMinutes: r.lateMinutes,
              earlyMinutes: r.earlyMinutes,
              overtimeMinutes: r.overtimeMinutes,
              source: "IMPORT",
              recordedBy: session!.user.id,
              recordedAt: new Date().toISOString(),
            })),
          ],
          previewMonth
        )
      : null;
  const previewOverBy = previewBalance ? Math.max(0, previewBalance.used + previewBalance.held - previewBalance.allowance) : 0;

  async function handleImportConfirm() {
    if (!parsedRows || !employeeId || !importTargetEmployee) return;
    setImporting(true);
    setImportErrorMsg("");
    const res = await importAttendance(
      employeeId,
      parsedRows.map((r) => ({
        date: r.date,
        clockIn: r.clockIn,
        clockOut: r.clockOut,
        lateMinutes: r.lateMinutes,
        earlyMinutes: r.earlyMinutes,
        overtimeMinutes: r.overtimeMinutes,
      }))
    );
    setImporting(false);
    if (!res.ok) { setImportErrorMsg(res.error); return; }
    setImportResult({ inserted: res.insertedCount, skipped: res.skippedCount, who: importTargetEmployee.name });
    setExcelFile(null);
    setParsedRows(null);
    setInvalidRows([]);
    setDetectedName(null);
    setParseError("");
  }

  async function handleSave() {
    setSaved("");
    setSaving(true);
    const res = await recordAttendance({ employeeId, date, checkIn, checkOut, note }, session!.user.id);
    setSaving(false);
    if (!res.ok) { setError(res.error ?? "Could not save."); return; }
    const who = employees.find((e) => e.id === employeeId)?.name ?? employeeId;
    setError("");
    setSaved(`Saved ${who} for ${fmtDate(date)}.`);
    setCheckIn(""); setCheckOut(""); setNote("");
  }

  const rows = [...sourceAttendance]
    .filter((a) => monthKey(a.date) === filterMonth)
    .sort((a, b) => b.date.localeCompare(a.date) || a.employeeId.localeCompare(b.employeeId));

  const months = Array.from(new Set([filterMonth, ...sourceAttendance.map((a) => monthKey(a.date))])).sort().reverse();

  return (
    <DashboardShell activeNavId="attendance" pageTitle="Attendance">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-foreground">Attendance</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Enter the fingerprint record. Anything after {WORKDAY_START} is charged to the
          employee's monthly permission allowance automatically.
        </p>
      </div>

      <Card className="mb-6">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Select label="Employee *" value={employeeId} onChange={(e) => { setEmployeeId(e.target.value); setError(""); }}>
              <option value="">Select employee</option>
              {activeEmployees.map((e) => (
                <option key={e.id} value={e.id}>{e.name} — {e.employeeCode ?? e.id}</option>
              ))}
            </Select>
            <DatePicker label="Date *" value={date} onChange={(e) => { setDate(e.target.value); setError(""); }} />
            <TimePicker label="Check in" value={checkIn} onChange={(e) => { setCheckIn(e.target.value); setError(""); }} />
            <TimePicker label="Check out" value={checkOut} onChange={(e) => { setCheckOut(e.target.value); setError(""); }} />
          </div>
          <Input label="Note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
          {error && <Alert variant="error">{error}</Alert>}
          {saved && <Alert variant="success">{saved}</Alert>}
          <div>
            <Button variant="primary" onClick={handleSave} loading={saving}>Save Record</Button>
          </div>
        </div>
      </Card>

      <Card className="mb-6">
        <div className="flex flex-col gap-3">
          <div>
            <h3 className="text-base font-semibold text-foreground">Upload Attendance Excel</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Upload the fingerprint attendance export (.xls or .xlsx) to calculate attendance and monthly Permission usage.
            </p>
          </div>
          {!employeeId && (
            <p className="text-sm text-muted-foreground">Select an employee above first.</p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={excelFileInputRef}
              type="file"
              accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={handleExcelFileChange}
              className="sr-only"
              id="attendance-excel-file"
              disabled={!employeeId}
            />
            <Button
              variant="secondary"
              onClick={() => excelFileInputRef.current?.click()}
              className="gap-1.5"
              disabled={!employeeId || parsing}
            >
              <Upload className="h-4 w-4" /> Choose File
            </Button>
            {excelFile ? (
              <span className="flex items-center gap-2 text-sm text-foreground break-all">
                {excelFile.name}
                <button
                  type="button"
                  onClick={clearExcelFile}
                  className="text-muted-foreground hover:text-foreground rounded-full p-0.5 hover:bg-muted transition-colors flex-shrink-0"
                  aria-label={`Remove ${excelFile.name}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">No file selected</span>
            )}
            {parsing && (
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Reading attendance file…
              </span>
            )}
          </div>
          {excelFileError && <Alert variant="error">{excelFileError}</Alert>}
          {parseError && <Alert variant="error">{parseError}</Alert>}
          {importResult && (
            <Alert variant="success">
              Imported {importResult.inserted} attendance record{importResult.inserted === 1 ? "" : "s"} for {importResult.who}.
              {importResult.skipped > 0 && ` ${importResult.skipped} already existed and ${importResult.skipped === 1 ? "was" : "were"} skipped.`}
            </Alert>
          )}
          {importErrorMsg && <Alert variant="error">{importErrorMsg}</Alert>}

          {parsedRows && parsedRows.length > 0 && importTargetEmployee && (
            <div className="mt-2 rounded-[8px] border border-border p-4 flex flex-col gap-4">
              <h4 className="text-sm font-semibold text-foreground">Import Attendance</h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Employee</span>{" "}
                  <span className="font-medium text-foreground">{importTargetEmployee.name}</span>
                </div>
                <div className="break-all">
                  <span className="text-muted-foreground">File</span>{" "}
                  <span className="font-medium text-foreground">{excelFile?.name}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Attendance period</span>{" "}
                  <span className="font-medium text-foreground">
                    {periodStart && fmtDate(periodStart)} – {periodEnd && fmtDate(periodEnd)}
                  </span>
                </div>
              </div>

              {nameMismatch && (
                <Alert variant="warning">
                  <strong>⚠ Employee name mismatch.</strong> The file's Name column says "{detectedName}", but you're
                  importing for {importTargetEmployee.name}. The selected employee above will be used — this file will
                  not create or affect any other employee's record.
                </Alert>
              )}

              {invalidRows.length > 0 && (
                <Alert variant="warning">
                  <strong>{invalidRows.length} row{invalidRows.length === 1 ? "" : "s"} could not be read</strong> and
                  will be skipped: {invalidRows.slice(0, 5).map((r) => r.message).join(" ")}
                  {invalidRows.length > 5 && ` (+${invalidRows.length - 5} more)`}
                </Alert>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                <div className="rounded-[6px] bg-muted/50 p-3">
                  <div className="text-muted-foreground">Records detected</div>
                  <div className="font-semibold text-foreground tabular-nums">{parsedRows.length}</div>
                </div>
                <div className="rounded-[6px] bg-muted/50 p-3">
                  <div className="text-muted-foreground">New records</div>
                  <div className="font-semibold text-foreground tabular-nums">{newRows.length}</div>
                </div>
                <div className="rounded-[6px] bg-muted/50 p-3">
                  <div className="text-muted-foreground">Already imported</div>
                  <div className="font-semibold text-foreground tabular-nums">{alreadyImportedCount}</div>
                </div>
              </div>

              <div>
                <div className="text-sm font-medium text-foreground mb-2">Attendance summary</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <div>
                    <div className="text-muted-foreground">Late</div>
                    <div className={cn("font-medium tabular-nums", summaryLate > 0 && "text-destructive")}>{formatMinutes(summaryLate)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Early</div>
                    <div className={cn("font-medium tabular-nums", summaryEarly > 0 && "text-destructive")}>{formatMinutes(summaryEarly)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Overtime</div>
                    <div className="font-medium tabular-nums text-foreground">{formatMinutes(summaryOvertime)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Absent</div>
                    <div className="font-medium tabular-nums text-foreground">{summaryAbsentDays} day{summaryAbsentDays === 1 ? "" : "s"}</div>
                  </div>
                </div>
              </div>

              {previewBalance && (
                <div>
                  <div className="text-sm font-medium text-foreground mb-2">Permission impact ({previewMonth})</div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                    <div>
                      <div className="text-muted-foreground">Allowance</div>
                      <div className="font-medium tabular-nums text-foreground">{formatMinutes(previewBalance.allowance)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Usage</div>
                      <div className="font-medium tabular-nums text-foreground">{formatMinutes(previewBalance.used + previewBalance.held)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Remaining</div>
                      <div className={cn("font-medium tabular-nums", previewOverBy > 0 ? "text-destructive" : "text-foreground")}>
                        {formatMinutes(previewBalance.available)}
                      </div>
                    </div>
                  </div>
                  {previewOverBy > 0 && (
                    <p className="text-sm text-destructive mt-2">Over allowance by {formatMinutes(previewOverBy)}.</p>
                  )}
                </div>
              )}

              <div className="flex items-center gap-3">
                <Button variant="primary" onClick={handleImportConfirm} loading={importing}>
                  {importing ? "Importing attendance…" : "Import Attendance"}
                </Button>
                <Button variant="secondary" onClick={clearExcelFile} disabled={importing}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      <div className="flex items-center justify-between mb-3 gap-3">
        <h3 className="text-base font-semibold text-foreground">Records</h3>
        <select
          className="px-3 py-2 rounded-[8px] border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          value={filterMonth}
          onChange={(e) => setFilterMonth(e.target.value)}
        >
          {months.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      <Card padding={false}>
        {rows.length === 0 ? (
          <div className="p-6">
            <EmptyState title="No records for this month" description="Add a record above to get started." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-4 py-3 font-medium text-muted-foreground">Date</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Employee</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">In</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Out</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Charged</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Remaining</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => {
                  const emp = employees.find((e) => e.id === a.employeeId);
                  const charged = lateMinutes(a) + earlyLeaveMinutes(a);
                  const balance = emp ? getPermissionBalance(emp, sourceRequests, sourceAttendance, monthKey(a.date)) : null;
                  return (
                    <tr key={a.id} className="border-b border-border/60 last:border-0">
                      <td className="px-4 py-3 whitespace-nowrap tabular-nums">{fmtDate(a.date)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={emp?.name ?? a.employeeId} size="sm" />
                          <span className="font-medium text-foreground">{emp?.name ?? a.employeeId}</span>
                          {a.source === "IMPORT" && (
                            <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-full border border-border bg-muted text-muted-foreground flex-shrink-0">
                              Imported
                            </span>
                          )}
                        </div>
                      </td>
                      <td className={cn("px-4 py-3 tabular-nums", lateMinutes(a) > 0 && "text-destructive font-medium")}>
                        {a.checkIn ?? "—"}
                      </td>
                      <td className={cn("px-4 py-3 tabular-nums", earlyLeaveMinutes(a) > 0 && "text-destructive font-medium")}>
                        {a.checkOut ?? "—"}
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {charged > 0 ? (
                          <span className="text-destructive font-medium">{formatMinutes(charged)}</span>
                        ) : (
                          <span className="text-muted-foreground">On time</span>
                        )}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-muted-foreground">
                        {balance ? formatMinutes(balance.available) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => deleteAttendance(a.id)}
                          className="text-xs text-destructive hover:underline"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </DashboardShell>
  );
}

function HRSettingsPage() {
  const { session } = useAuth();
  const { leaveTypes: localLeaveTypes, remoteLeaveTypes, createLeaveType, updateLeaveType, isRemoteEmployee } = useStore();
  // TESTHR01-style real HR sees/manages the real Supabase catalog; a local
  // demo HR account (e.g. Riley Chen) keeps managing the existing local
  // list, completely unaffected — same isolation rule as every other
  // Phase 6A/6A.1 real-vs-demo split.
  const leaveTypes = session && isRemoteEmployee(session.user.id) ? remoteLeaveTypes : localLeaveTypes;

  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [addError, setAddError] = useState("");

  const [editTarget, setEditTarget] = useState<LeaveTypeRecord | null>(null);
  const [editName, setEditName] = useState("");
  const [editError, setEditError] = useState("");
  const [newBalanceKey, setNewBalanceKey] = useState<BalanceKey | "">("");
  const [editBalanceKey, setEditBalanceKey] = useState<BalanceKey | "">("");
  // Minimum advance-notice policy (Phase 2) — 0 (the field's default) means
  // no restriction, matching leave_types.minimum_notice_days' own default.
  const [newMinNotice, setNewMinNotice] = useState("0");
  const [editMinNotice, setEditMinNotice] = useState("0");
  const [saving, setSaving] = useState(false);
  const [toggleError, setToggleError] = useState("");

  async function handleAdd() {
    const trimmed = newName.trim();
    if (!trimmed) { setAddError("Name is required."); return; }
    if (leaveTypes.some((lt) => lt.name.toLowerCase() === trimmed.toLowerCase())) {
      setAddError("A leave type with this name already exists."); return;
    }
    setSaving(true);
    const res = await createLeaveType(trimmed, newBalanceKey || null, Math.max(0, Number(newMinNotice) || 0));
    setSaving(false);
    if (!res.ok) { setAddError(res.error ?? "Could not add that leave type."); return; }
    setNewName(""); setNewBalanceKey(""); setNewMinNotice("0"); setShowAdd(false); setAddError("");
  }

  async function handleEdit() {
    if (!editTarget) return;
    const trimmed = editName.trim();
    if (!trimmed) { setEditError("Name is required."); return; }
    if (leaveTypes.some((lt) => lt.name.toLowerCase() === trimmed.toLowerCase() && lt.id !== editTarget.id)) {
      setEditError("A leave type with this name already exists."); return;
    }
    setSaving(true);
    const res = await updateLeaveType(editTarget.id, {
      name: trimmed, balanceKey: editBalanceKey || null,
      minimumNoticeDays: Math.max(0, Number(editMinNotice) || 0),
    });
    setSaving(false);
    if (!res.ok) { setEditError(res.error ?? "Could not save changes."); return; }
    setEditTarget(null); setEditName(""); setEditBalanceKey(""); setEditMinNotice("0"); setEditError("");
  }

  async function handleToggleStatus(lt: LeaveTypeRecord) {
    setToggleError("");
    const res = await updateLeaveType(lt.id, { status: lt.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" });
    if (!res.ok) setToggleError(res.error ?? "Could not update that leave type.");
  }

  return (
    <DashboardShell activeNavId="settings" pageTitle="Settings">
      <div className="max-w-2xl">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Leave Types</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Manage the leave types available to employees.</p>
          </div>
          <Button variant="primary" onClick={() => { setShowAdd(true); setNewName(""); setNewMinNotice("0"); setAddError(""); }} className="gap-1.5">
            <Plus className="h-4 w-4" /> Add Leave Type
          </Button>
        </div>

        {/* Add form inline */}
        {showAdd && (
          <Card className="mb-4">
            <p className="text-sm font-medium mb-3">New Leave Type</p>
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <Input
                  placeholder="Leave type name"
                  value={newName}
                  onChange={(e) => { setNewName(e.target.value); setAddError(""); }}
                  error={addError}
                />
              </div>
              <div className="w-full sm:w-52">
                <Select
                  value={newBalanceKey}
                  onChange={(e) => setNewBalanceKey(e.target.value as BalanceKey | "")}
                >
                  <option value="">No balance limit</option>
                  <option value="ANNUAL">Charge annual balance</option>
                  <option value="CASUAL">Charge casual balance</option>
                </Select>
              </div>
              <div className="w-full sm:w-40">
                <Input
                  type="number"
                  min={0}
                  step={1}
                  placeholder="Notice (days)"
                  value={newMinNotice}
                  onChange={(e) => setNewMinNotice(e.target.value)}
                />
              </div>
              <div className="flex gap-2 pt-0.5">
                <Button variant="primary" onClick={handleAdd} loading={saving}>Save</Button>
                <Button variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button>
              </div>
            </div>
          </Card>
        )}

        {toggleError && <Alert variant="error" className="mb-4">{toggleError}</Alert>}

        <Card padding={false}>
          {leaveTypes.length === 0 ? (
            <div className="p-6">
              <EmptyState icon={<Settings className="h-8 w-8 text-muted-foreground/40" />} title="No leave types" description="Add a leave type to get started." />
            </div>
          ) : (
            <div className="divide-y divide-border">
              {leaveTypes.map((lt) => (
                <div key={lt.id} className="flex items-center gap-4 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    {editTarget?.id === lt.id ? (
                      <div className="flex items-start gap-3">
                        <div className="flex-1">
                          <Input
                            value={editName}
                            onChange={(e) => { setEditName(e.target.value); setEditError(""); }}
                            error={editError}
                            placeholder="Leave type name"
                          />
                        </div>
                        <div className="w-52">
                          <Select
                            value={editBalanceKey}
                            onChange={(e) => setEditBalanceKey(e.target.value as BalanceKey | "")}
                          >
                            <option value="">No balance limit</option>
                            <option value="ANNUAL">Charge annual balance</option>
                            <option value="CASUAL">Charge casual balance</option>
                          </Select>
                        </div>
                        <div className="w-40">
                          <Input
                            type="number"
                            min={0}
                            step={1}
                            placeholder="Notice (days)"
                            value={editMinNotice}
                            onChange={(e) => setEditMinNotice(e.target.value)}
                          />
                        </div>
                        <div className="flex gap-2 pt-0.5">
                          <Button variant="primary" onClick={handleEdit} loading={saving}>Save</Button>
                          <Button variant="secondary" onClick={() => setEditTarget(null)}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm font-medium">{lt.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {lt.balanceKey
                            ? `Charged to ${BALANCE_LABEL[lt.balanceKey].toLowerCase()} balance`
                            : "Not balance-limited"}
                          {" · "}
                          {lt.minimumNoticeDays
                            ? `${lt.minimumNoticeDays} day${lt.minimumNoticeDays === 1 ? "" : "s"} minimum notice`
                            : "No advance-notice requirement"}
                        </p>
                      </div>
                    )}
                  </div>
                  {editTarget?.id !== lt.id && (
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <StatusBadge status={lt.status === "ACTIVE" ? "active" : "inactive"} />
                      <button
                        onClick={() => { setEditTarget(lt); setEditName(lt.name); setEditBalanceKey(lt.balanceKey ?? ""); setEditMinNotice(String(lt.minimumNoticeDays ?? 0)); setEditError(""); }}
                        className="text-xs text-primary hover:underline font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleToggleStatus(lt)}
                        className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                      >
                        {lt.status === "ACTIVE" ? "Deactivate" : "Activate"}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        <HolidaysSection />
        <DepartmentsSection />
        <ApprovalRoutingSection />
      </div>
    </DashboardShell>
  );
}

// Public holidays drive the working-day count, so they belong to HR alongside
// leave types. Islamic dates shift every year, which is why they are data.
function HolidaysSection() {
  const { session } = useAuth();
  const { holidays: localHolidays, remoteHolidays, createHoliday, deleteHoliday, updateHoliday, isRemoteEmployee } = useStore();
  // Real HR (e.g. TESTHR01) manages the real Supabase list; a local demo HR
  // account keeps managing the existing local one, unaffected — same
  // isolation rule as Phase 6B-1 Leave Types.
  const holidays = session && isRemoteEmployee(session.user.id) ? remoteHolidays : localHolidays;

  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removeError, setRemoveError] = useState("");
  const [removingId, setRemovingId] = useState("");

  const [editTarget, setEditTarget] = useState<HolidayRecord | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editName, setEditName] = useState("");
  const [editError, setEditError] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  async function handleAdd() {
    setSaving(true);
    const res = await createHoliday(date, name);
    setSaving(false);
    if (!res.ok) { setError(res.error ?? "Could not add that holiday."); return; }
    setDate(""); setName(""); setError(""); setOpen(false);
  }

  async function handleRemove(id: string) {
    setRemoveError("");
    setRemovingId(id);
    const res = await deleteHoliday(id);
    setRemovingId("");
    if (!res.ok) setRemoveError(res.error ?? "Could not remove that holiday.");
  }

  function openEdit(h: HolidayRecord) {
    setEditTarget(h);
    setEditDate(h.date);
    setEditName(h.name);
    setEditError("");
  }

  async function handleEditSave() {
    if (!editTarget) return;
    setEditSaving(true);
    const res = await updateHoliday(editTarget.id, editDate, editName);
    setEditSaving(false);
    if (!res.ok) { setEditError(res.error ?? "Could not save changes."); return; }
    setEditTarget(null); setEditDate(""); setEditName(""); setEditError("");
  }

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">Public Holidays</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Weekends are Friday and Saturday. These days, and weekends, never consume leave balance.
          </p>
        </div>
        <Button variant="secondary" onClick={() => setOpen((v) => !v)}>
          <Plus className="h-4 w-4" /> Add Holiday
        </Button>
      </div>

      {open && (
        <Card className="mb-3">
          <div className="flex flex-col sm:flex-row gap-3 items-start">
            <div className="w-full sm:w-48">
              <DatePicker value={date} onChange={(e) => { setDate(e.target.value); setError(""); }} />
            </div>
            <div className="flex-1 w-full">
              <Input placeholder="Holiday name" value={name} onChange={(e) => { setName(e.target.value); setError(""); }} error={error} />
            </div>
            <div className="flex gap-2 pt-0.5">
              <Button variant="primary" onClick={handleAdd} loading={saving}>Save</Button>
              <Button variant="secondary" onClick={() => { setOpen(false); setError(""); }}>Cancel</Button>
            </div>
          </div>
        </Card>
      )}

      {removeError && <Alert variant="error" className="mb-3">{removeError}</Alert>}

      <Card padding={false}>
        {holidays.length === 0 ? (
          <div className="p-6">
            <EmptyState title="No public holidays" description="Add the days your office is closed." />
          </div>
        ) : (
          <div className="divide-y divide-border">
            {holidays.map((h) =>
              editTarget?.id === h.id ? (
                <div key={h.id} className="flex flex-col sm:flex-row gap-3 items-start px-4 py-3">
                  <div className="w-full sm:w-48">
                    <DatePicker value={editDate} onChange={(e) => { setEditDate(e.target.value); setEditError(""); }} />
                  </div>
                  <div className="flex-1 w-full">
                    <Input
                      placeholder="Holiday name"
                      value={editName}
                      onChange={(e) => { setEditName(e.target.value); setEditError(""); }}
                      error={editError}
                    />
                  </div>
                  <div className="flex gap-2 pt-0.5">
                    <Button variant="primary" onClick={handleEditSave} loading={editSaving}>Save</Button>
                    <Button variant="secondary" onClick={() => { setEditTarget(null); setEditError(""); }}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div key={h.id} className="flex items-center gap-4 px-4 py-3">
                  <p className="text-sm font-medium text-foreground w-32 flex-shrink-0 tabular-nums">{fmtDate(h.date)}</p>
                  <p className="text-sm text-muted-foreground flex-1 min-w-0 truncate">{h.name}</p>
                  <button
                    onClick={() => openEdit(h)}
                    className="text-xs text-primary hover:underline font-medium flex-shrink-0"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleRemove(h.id)}
                    disabled={removingId === h.id}
                    className="text-xs text-destructive hover:underline flex-shrink-0 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    {removingId === h.id ? "Removing…" : "Remove"}
                  </button>
                </div>
              )
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

// Real, Supabase-backed departments (supabase/migrations/20260906160000) — HR
// controls employee department assignment; employees never edit their own
// (see My Profile). No hard delete: archiving (status = INACTIVE) keeps
// historical employee/profile references intact and just removes the
// department from future assignment.
function DepartmentsSection() {
  const { departments, createDepartment, updateDepartment } = useStore();
  const [newName, setNewName] = useState("");
  const [addError, setAddError] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [editTarget, setEditTarget] = useState<DepartmentRecord | null>(null);
  const [editName, setEditName] = useState("");
  const [editError, setEditError] = useState("");

  async function handleAdd() {
    setSaving(true);
    const res = await createDepartment(newName);
    setSaving(false);
    if (!res.ok) { setAddError(res.error ?? "Could not add that department."); return; }
    setNewName(""); setAddError(""); setOpen(false);
  }

  async function handleEdit() {
    if (!editTarget) return;
    setSaving(true);
    const res = await updateDepartment(editTarget.id, { name: editName });
    setSaving(false);
    if (!res.ok) { setEditError(res.error ?? "Could not save changes."); return; }
    setEditTarget(null); setEditName(""); setEditError("");
  }

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">Departments</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage the departments employees can be assigned to.
          </p>
        </div>
        <Button variant="secondary" onClick={() => { setOpen((v) => !v); setNewName(""); setAddError(""); }}>
          <Plus className="h-4 w-4" /> Add Department
        </Button>
      </div>

      {open && (
        <Card className="mb-3">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <Input
                placeholder="Department name"
                value={newName}
                onChange={(e) => { setNewName(e.target.value); setAddError(""); }}
                error={addError}
              />
            </div>
            <div className="flex gap-2 pt-0.5">
              <Button variant="primary" onClick={handleAdd} loading={saving}>Save</Button>
              <Button variant="secondary" onClick={() => { setOpen(false); setAddError(""); }}>Cancel</Button>
            </div>
          </div>
        </Card>
      )}

      <Card padding={false}>
        {departments.length === 0 ? (
          <div className="p-6">
            <EmptyState icon={<Settings className="h-8 w-8 text-muted-foreground/40" />} title="No departments" description="Add a department to get started." />
          </div>
        ) : (
          <div className="divide-y divide-border">
            {departments.map((d) => (
              <div key={d.id} className="flex items-center gap-4 px-4 py-3">
                <div className="flex-1 min-w-0">
                  {editTarget?.id === d.id ? (
                    <div className="flex items-start gap-3">
                      <div className="flex-1">
                        <Input
                          value={editName}
                          onChange={(e) => { setEditName(e.target.value); setEditError(""); }}
                          error={editError}
                          placeholder="Department name"
                        />
                      </div>
                      <div className="flex gap-2 pt-0.5">
                        <Button variant="primary" onClick={handleEdit} loading={saving}>Save</Button>
                        <Button variant="secondary" onClick={() => setEditTarget(null)}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm font-medium">{d.name}</p>
                  )}
                </div>
                {editTarget?.id !== d.id && (
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <StatusBadge status={d.status === "ACTIVE" ? "active" : "inactive"} />
                    <button
                      onClick={() => { setEditTarget(d); setEditName(d.name); setEditError(""); }}
                      className="text-xs text-primary hover:underline font-medium"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => updateDepartment(d.id, { status: d.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" })}
                      className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                    >
                      {d.status === "ACTIVE" ? "Archive" : "Activate"}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// The Technical Manager and General Manager are singleton roles that sit at
// the top of every approval chain (company_approval_routing) — set once via
// set_approval_routing, the only writer for that table. Setting the General
// Manager also keeps every HR profile's Direct Manager (profiles.manager_id)
// pointed at them automatically (Phase 6A.1) — nothing here writes that
// relationship directly, it is entirely a side effect of the RPC call.
// Candidates are restricted to real (Supabase-backed) active employees —
// company_approval_routing references profiles.id, which a local demo
// employee has no row for.
function ApprovalRoutingSection() {
  const { employees, approvalRouting, setApprovalRouting, isRemoteEmployee } = useStore();
  const [tmId, setTmId] = useState(approvalRouting?.technicalManagerId ?? "");
  const [gmId, setGmId] = useState(approvalRouting?.generalManagerId ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setTmId(approvalRouting?.technicalManagerId ?? "");
    setGmId(approvalRouting?.generalManagerId ?? "");
  }, [approvalRouting]);

  // Same production-visibility rule already established for HREmployeesPage,
  // HRAttendancePage, OrganizationPage, and HRDashboardPage — Technical
  // Manager/General Manager candidates must be production-visible real
  // employees, not the raw combined list (legacy/test real profiles stay in
  // the database, just excluded from this selector).
  const candidates = employees.filter((e) => isRemoteEmployee(e.id) && e.isProduction !== false && e.status === "ACTIVE");

  async function handleSave() {
    if (tmId && gmId && tmId === gmId) {
      setError("The Technical Manager and General Manager must be different people.");
      return;
    }
    setSaving(true);
    setSaved(false);
    const res = await setApprovalRouting(tmId || null, gmId || null);
    setSaving(false);
    if (!res.ok) { setError(res.error ?? "Could not save approval routing."); return; }
    setError("");
    setSaved(true);
  }

  return (
    <div className="mt-8">
      <div className="mb-3">
        <h3 className="text-base font-semibold text-foreground">Approval Routing</h3>
        <p className="text-sm text-muted-foreground mt-0.5">
          The Technical Manager and General Manager sit at the top of every approval chain. HR's own Direct Manager is kept in sync with the General Manager automatically.
        </p>
      </div>
      <Card>
        {error && <Alert variant="error" className="mb-4">{error}</Alert>}
        {saved && <Alert variant="success" className="mb-4">Approval routing updated.</Alert>}
        <div className="flex flex-col gap-4">
          <Select
            label="Technical Manager"
            value={tmId}
            onChange={(e) => { setTmId(e.target.value); setSaved(false); }}
          >
            <option value="">Not yet configured</option>
            {candidates.filter((e) => e.id !== gmId).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </Select>
          <Select
            label="General Manager"
            value={gmId}
            onChange={(e) => { setGmId(e.target.value); setSaved(false); }}
          >
            <option value="">Not yet configured</option>
            {candidates.filter((e) => e.id !== tmId).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </Select>
          <div>
            <Button variant="primary" onClick={handleSave} loading={saving}>{saving ? "Saving…" : "Save Routing"}</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE: MY PROFILE
// Every authenticated role (Phase 6A Extension). A user may edit their own
// first name, last name, email, and phone — nothing else. Employee Code,
// Role, Direct Manager, Status, Department and Position are organizational
// identity/hierarchy, never editable here, shown read-only with a locked
// visual treatment (disabled Input/Select). The database is the actual
// security boundary — see profiles_protect_self_edit_fields
// (20260906160400_profiles_self_update.sql); this form simply never offers
// those fields as editable, for any role including HR.
// ═══════════════════════════════════════════════════════════════════════════════

// Real Supabase accounts only — password change goes straight through
// Supabase Auth (see changePassword() in lib/auth.ts). Demo/local accounts
// never render this section; their passwords stay in the existing seeded
// local credential store, untouched.
function ChangePasswordCard() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit() {
    if (submitting) return;
    setSuccess(false);

    const errs: Record<string, string> = {};
    if (!currentPassword) errs.currentPassword = "Current password is required.";
    if (!newPassword) errs.newPassword = "New password is required.";
    if (!confirmPassword) errs.confirmPassword = "Please confirm your new password.";
    if (newPassword && confirmPassword && newPassword !== confirmPassword) {
      errs.confirmPassword = "New password and confirmation do not match.";
    }
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setSubmitting(true);
    const result = await changePassword(currentPassword, newPassword);
    setSubmitting(false);

    if (!result.ok) {
      const field =
        result.error === "CURRENT_PASSWORD_INCORRECT"
          ? "currentPassword"
          : result.error === "SAME_AS_CURRENT" || result.error === "WEAK_PASSWORD"
          ? "newPassword"
          : "_form";
      setErrors({ [field]: result.message });
      return;
    }

    setErrors({});
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setSuccess(true);
  }

  return (
    <Card className="mt-6">
      <p className="text-sm font-medium mb-1">Security</p>
      <p className="text-xs text-muted-foreground mb-4">
        Change the password used to sign in to this account.
      </p>
      {success && (
        <Alert variant="success" className="mb-4">
          Password changed successfully.
        </Alert>
      )}
      {errors._form && (
        <Alert variant="error" className="mb-4">
          {errors._form}
        </Alert>
      )}
      <div className="flex flex-col gap-4 max-w-md">
        <PasswordInput
          label="Current Password *"
          value={currentPassword}
          onChange={(e) => { setCurrentPassword(e.target.value); setSuccess(false); }}
          error={errors.currentPassword}
          autoComplete="current-password"
        />
        <PasswordInput
          label="New Password *"
          value={newPassword}
          onChange={(e) => { setNewPassword(e.target.value); setSuccess(false); }}
          error={errors.newPassword}
          autoComplete="new-password"
        />
        <PasswordInput
          label="Confirm New Password *"
          value={confirmPassword}
          onChange={(e) => { setConfirmPassword(e.target.value); setSuccess(false); }}
          error={errors.confirmPassword}
          autoComplete="new-password"
        />
        <div>
          <Button variant="primary" onClick={handleSubmit} loading={submitting} disabled={submitting}>
            {submitting ? "Changing…" : "Change Password"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function MyProfilePage() {
  const { session } = useAuth();
  const { employees, updateEmployee, isRemoteEmployee } = useStore();
  const me = employees.find((e) => e.id === session!.user.id) ?? null;

  const [firstName, setFirstName] = useState(me?.firstName ?? "");
  const [lastName, setLastName] = useState(me?.lastName ?? "");
  const [email, setEmail] = useState(me?.email ?? "");
  const [phone, setPhone] = useState(me?.phone ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const manager = me?.managerId ? employees.find((e) => e.id === me.managerId) ?? null : null;

  async function handleSave() {
    const errs: Record<string, string> = {};
    if (!firstName.trim()) errs.firstName = "First name is required.";
    if (!lastName.trim()) errs.lastName = "Last name is required.";
    if (!email.trim()) {
      errs.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errs.email = "Enter a valid email address.";
    }
    if (Object.keys(errs).length > 0) { setErrors(errs); setSaved(false); return; }

    setSaving(true);
    setSaved(false);
    const result = await updateEmployee(me!.id, {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      name: `${firstName.trim()} ${lastName.trim()}`,
      email: email.trim().toLowerCase(),
      phone: phone.trim() || undefined,
    });
    setSaving(false);
    if (!result.ok) {
      setErrors({ _form: result.error ?? "Could not save changes." });
      return;
    }
    setErrors({});
    setSaved(true);
  }

  if (!me) {
    return (
      <DashboardShell activeNavId="profile" pageTitle="My Profile">
        <Alert variant="error">Your profile could not be loaded.</Alert>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell activeNavId="profile" pageTitle="My Profile">
      <div className="max-w-2xl">
        {saved && <Alert variant="success" className="mb-4">Your profile has been updated.</Alert>}
        {errors._form && <Alert variant="error" className="mb-4">{errors._form}</Alert>}

        <Card className="mb-6">
          <p className="text-sm font-medium mb-1">Personal Information</p>
          <p className="text-xs text-muted-foreground mb-4">You can update these yourself.</p>
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="First Name *"
                value={firstName}
                onChange={(e) => { setFirstName(e.target.value); setSaved(false); }}
                error={errors.firstName}
              />
              <Input
                label="Last Name *"
                value={lastName}
                onChange={(e) => { setLastName(e.target.value); setSaved(false); }}
                error={errors.lastName}
              />
            </div>
            <Input
              label="Email *"
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setSaved(false); }}
              error={errors.email}
            />
            <Input
              label="Phone"
              value={phone}
              onChange={(e) => { setPhone(e.target.value); setSaved(false); }}
              placeholder="+20 10 0000 0000"
            />
            <div>
              <Button variant="primary" onClick={handleSave} loading={saving}>
                {saving ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          </div>
        </Card>

        <Card>
          <p className="text-sm font-medium mb-1">Organizational Details</p>
          <p className="text-xs text-muted-foreground mb-4">
            Set and controlled by HR. Contact HR to request a change.
          </p>
          <div className="flex flex-col gap-4">
            <Input label="Employee Code" value={me.employeeCode ?? me.id} disabled hint="Assigned at account creation and cannot be changed." />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Role" value={ROLE_LABEL[me.role]} disabled />
              <Input label="Status" value={me.status === "ACTIVE" ? "Active" : "Inactive"} disabled />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Department" value={me.department || "—"} disabled />
              <Input label="Position" value={me.position || "—"} disabled />
            </div>
            <Input label="Direct Manager" value={manager?.name ?? "None"} disabled />
          </div>
        </Card>

        {isRemoteEmployee(me.id) && <ChangePasswordCard />}
      </div>
    </DashboardShell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE: A01 — LOGIN
// ═══════════════════════════════════════════════════════════════════════════════

// -----------------------------------------------------------------------------
// PAGE: DESIGN SYSTEM
// A living gallery of every primitive, in every state. It renders the same
// components the product uses, so it cannot drift the way a separate Storybook
// or a static mockup would. Public on purpose: a designer opens /design-system
// without needing an account.
// -----------------------------------------------------------------------------

const TOKEN_GROUPS: { label: string; note: string; tokens: [string, string][] }[] = [
  {
    label: "Implemented",
    note: "What the application renders today.",
    tokens: [
      ["background", "#F5F7FA"], ["foreground", "#14181F"], ["card", "#FFFFFF"],
      ["primary", "#1D4E89"], ["secondary", "#F1F4F8"], ["muted", "#F1F4F8"],
      ["muted-foreground", "#64748B"], ["accent", "#EDF2FB"],
      ["destructive", "#B91C1C"], ["border", "#E2E8F0"],
    ],
  },
  {
    label: "GEOTECH brand",
    note: "The official identity, taken from the logo artwork. Not applied yet.",
    tokens: [
      ["gold", "#A0840D"], ["gold-dark", "#6D5B07"], ["graphite", "#626366"],
      ["charcoal", "#231F20"], ["silver", "#929497"],
    ],
  },
];

const TYPE_SCALE: { name: string; className: string; spec: string }[] = [
  { name: "Display 2xl", className: "text-2xl font-semibold", spec: "24 / 32 - 600" },
  { name: "Heading xl", className: "text-xl font-semibold", spec: "20 / 28 - 600" },
  { name: "Heading lg", className: "text-lg font-semibold", spec: "18 / 26 - 600" },
  { name: "Body base", className: "text-base", spec: "16 / 24 - 400" },
  { name: "Body sm", className: "text-sm", spec: "14 / 20 - 400" },
  { name: "Label sm", className: "text-sm font-medium", spec: "14 / 20 - 500" },
  { name: "Caption xs", className: "text-xs", spec: "12 / 16 - 400" },
];

function Spec({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="mb-14">
      <h2 className="text-xl font-semibold text-foreground">{title}</h2>
      {note && <p className="text-sm text-muted-foreground mt-1 mb-5 max-w-2xl">{note}</p>}
      <div className={note ? "" : "mt-5"}>{children}</div>
    </section>
  );
}

function SpecRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 py-4 border-b border-border last:border-0">
      <p className="text-xs font-medium text-muted-foreground w-40 flex-shrink-0 uppercase tracking-wider">
        {label}
      </p>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

function DesignSystemPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [date, setDate] = useState("");

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="flex items-center gap-3 mb-4">
            <LogoMark size={36} />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                GEOTECH HR Portal
              </p>
              <h1 className="text-2xl font-semibold text-foreground">Design System</h1>
            </div>
          </div>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Every primitive the product uses, in every state. These are the real
            components, not screenshots, so this page cannot go stale.
          </p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <Spec
          title="Colour"
          note="Two palettes. The application renders the blue one today; gold and graphite is the official GEOTECH identity. They disagree, and that is a decision waiting to be made."
        >
          {TOKEN_GROUPS.map((group) => (
            <div key={group.label} className="mb-6">
              <p className="text-sm font-medium text-foreground">{group.label}</p>
              <p className="text-xs text-muted-foreground mb-3">{group.note}</p>
              <div className="flex flex-wrap gap-3">
                {group.tokens.map(([name, hex]) => (
                  <div key={name} className="w-28">
                    <div
                      className="h-16 w-full rounded-[6px] border border-border"
                      style={{ backgroundColor: hex }}
                    />
                    <p className="text-[11px] font-medium text-foreground mt-1.5 truncate">{name}</p>
                    <p className="text-[10px] text-muted-foreground tabular-nums">{hex}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </Spec>

        <Spec
          title="Typography"
          note="Loaded as Inter. The brand faces are Graphik and Neo Sans Arabic; neither is wired up yet."
        >
          <div className="rounded-[12px] border border-border bg-card divide-y divide-border">
            {TYPE_SCALE.map((t) => (
              <div key={t.name} className="flex items-baseline gap-6 px-5 py-4">
                <span className="text-xs text-muted-foreground w-28 flex-shrink-0">{t.name}</span>
                <span className={cn("text-foreground flex-1 min-w-0 truncate", t.className)}>
                  Leave and mission requests
                </span>
                <span className="text-xs text-muted-foreground tabular-nums flex-shrink-0">{t.spec}</span>
              </div>
            ))}
          </div>
        </Spec>

        <Spec title="Buttons" note="Four variants, three sizes, plus loading and disabled.">
          <div className="rounded-[12px] border border-border bg-card px-5">
            <SpecRow label="Primary">
              <Button variant="primary" size="sm">Small</Button>
              <Button variant="primary" size="md">Medium</Button>
              <Button variant="primary" size="lg">Large</Button>
            </SpecRow>
            <SpecRow label="Secondary">
              <Button variant="secondary" size="sm">Small</Button>
              <Button variant="secondary" size="md">Medium</Button>
              <Button variant="secondary" size="lg">Large</Button>
            </SpecRow>
            <SpecRow label="Ghost">
              <Button variant="ghost" size="md">Ghost</Button>
            </SpecRow>
            <SpecRow label="Destructive">
              <Button variant="destructive" size="md">Reject</Button>
            </SpecRow>
            <SpecRow label="States">
              <Button variant="primary" loading>Submitting</Button>
              <Button variant="primary" disabled>Disabled</Button>
            </SpecRow>
          </div>
        </Spec>

        <Spec title="Form controls" note="Every field renders its own label, hint and error.">
          <div className="rounded-[12px] border border-border bg-card p-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Input label="Employee ID" placeholder="e.g. EMP-00125" />
            <Input label="Employee ID" defaultValue="EMP-00001" hint="Your ID as printed on your badge." />
            <Input label="Employee ID" defaultValue="" error="Employee ID is required." />
            <PasswordInput label="Password" placeholder="Enter your password" />
            <Select label="Leave Type">
              <option>Annual Leave</option>
              <option>Sick Leave</option>
            </Select>
            <Select label="Leave Type" error="Leave Type is required.">
              <option value="">Select Leave Type</option>
            </Select>
            <DatePicker label="Start Date" value={date} onChange={(e) => setDate(e.target.value)} />
            <TimePicker label="Check in" />
            <div className="sm:col-span-2">
              <Textarea label="Reason" rows={3} placeholder="Optional: describe the reason for your leave..." />
            </div>
          </div>
        </Spec>

        <Spec title="Status badges" note="Request status and account status share one component.">
          <div className="rounded-[12px] border border-border bg-card px-5">
            <SpecRow label="Request">
              <StatusBadge status="pending" />
              <StatusBadge status="approved" />
              <StatusBadge status="rejected" />
            </SpecRow>
            <SpecRow label="Account">
              <StatusBadge status="active" />
              <StatusBadge status="inactive" />
            </SpecRow>
          </div>
        </Spec>

        <Spec title="Alerts" note="The copy shown is the real copy from the application.">
          <div className="flex flex-col gap-3">
            <Alert variant="error">Invalid Employee ID or password. Please check your credentials and try again.</Alert>
            <Alert variant="success">Request submitted successfully.</Alert>
            <Alert variant="warning">4 employees still report to Jordan Lee. Reassign them first.</Alert>
            <Alert variant="info">Approval stays with the three-stage management chain.</Alert>
          </div>
        </Spec>

        <Spec title="Feedback states" note="Loading, empty and error. Every list uses these rather than a blank screen.">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card><LoadingState message="Loading your team..." /></Card>
            <Card><EmptyState title="No requests yet" description="Click New Request to submit your first one." /></Card>
            <Card><ErrorState message="Something went wrong. We could not load your team." onRetry={() => undefined} /></Card>
          </div>
        </Spec>

        <Spec title="Avatars">
          <div className="rounded-[12px] border border-border bg-card px-5">
            <SpecRow label="Sizes">
              <Avatar name="Alex Morgan" size="sm" />
              <Avatar name="Jordan Lee" size="md" />
              <Avatar name="Khaled Nabil" size="lg" />
            </SpecRow>
          </div>
        </Spec>

        <Spec title="Modal" note="Used for Add Employee, Employee Details and the rejection dialog.">
          <Button variant="secondary" onClick={() => setModalOpen(true)}>Open modal</Button>
          <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Reject Request">
            <div className="flex flex-col gap-4">
              <Textarea label="Reason for rejection *" rows={3} placeholder="Explain why this request is being rejected..." />
              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
                <Button variant="destructive" onClick={() => setModalOpen(false)}>Reject Request</Button>
              </div>
            </div>
          </Modal>
        </Spec>

        <footer className="border-t border-border pt-6 mt-4">
          <p className="text-xs text-muted-foreground">
            Rendered from the live components in src/app/App.tsx. Tokens are in
            05-DESIGN/design-tokens.json; the Figma builder is in 05-DESIGN/figma-plugin.
          </p>
        </footer>
      </main>
    </div>
  );
}

const LOGIN_ERROR_MESSAGES: Partial<Record<LoginState, string>> = {
  invalid_credentials:
    "Invalid Employee Code or password. Please check your credentials and try again.",
  inactive_account:
    "Your account is inactive. Please contact HR for assistance.",
  system_error:
    "Something went wrong. Please try again or contact HR if the problem persists.",
};

function LoginPage() {
  const { session, login } = useAuth();
  const navigate = useNavigate();

  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [loginState, setLoginState] = useState<LoginState>("idle");
  const [fieldErrors, setFieldErrors] = useState<{
    employeeId?: string;
    password?: string;
  }>({});

  // Already authenticated → redirect immediately
  useEffect(() => {
    if (session) {
      navigate(dashboardPath(session.user.role), { replace: true });
    }
  }, [session, navigate]);

  const isSubmitting = loginState === "loading";
  const isSuccess = loginState === "success";
  const accountErrorMsg = LOGIN_ERROR_MESSAGES[loginState];

  function clearAccountError() {
    if (loginState !== "idle" && loginState !== "loading" && loginState !== "success") {
      setLoginState("idle");
    }
  }

  function validate() {
    const errors: { employeeId?: string; password?: string } = {};
    if (!employeeId.trim()) errors.employeeId = "Employee Code is required.";
    if (!password) errors.password = "Password is required.";
    return errors;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setLoginState("loading");

    const result = await authSignIn(employeeId, password);

    if (!result.ok) {
      const err = (result as { ok: false; error: "INVALID_CREDENTIALS" | "INACTIVE_ACCOUNT" | "SYSTEM_ERROR" }).error;
      const errorState: LoginState =
        err === "INACTIVE_ACCOUNT"
          ? "inactive_account"
          : err === "SYSTEM_ERROR"
          ? "system_error"
          : "invalid_credentials";
      setLoginState(errorState);
      return;
    }

    login(result.session);
    setLoginState("success");
    // Brief success moment before the router redirects via the useEffect above
    await new Promise((r) => setTimeout(r, 700));
    navigate(dashboardPath(result.session.user.role), { replace: true });
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* ── Brand panel ─────────────────────────────────────────────────────── */}
      <div className="relative flex flex-col lg:w-[54%] overflow-hidden">
        {/* Background photo */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              "url(https://images.unsplash.com/photo-1546628484-186b26f3e572?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080)",
          }}
        />
        {/* Dark blue overlay — 50% opacity */}
        <div className="absolute inset-0" style={{ background: "rgba(10, 37, 71, 0.50)" }} />

        {/* Mobile top bar (when photo panel is collapsed) */}
        <div className="relative z-10 flex items-center gap-3 px-8 py-6 lg:hidden">
          <img src={companyLogoSrc} alt="GEO Egypt Geospatial Hub logo" className="h-8 w-auto object-contain" />
          <span className="text-sm font-medium text-white/80 tracking-wide">HR Portal</span>
        </div>

        {/* Desktop: centered logo block */}
        <div className="relative z-10 hidden lg:flex flex-col flex-1 items-center justify-center px-10">
          <div className="flex flex-col items-center text-center">
            <img
              src={companyLogoSrc}
              alt="GEO Egypt Geospatial Hub logo"
              className="h-20 w-auto object-contain mb-5"
            />
            <p className="text-lg font-semibold text-white tracking-wide">HR Portal</p>
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 hidden lg:block px-10 py-5 border-t border-white/10">
          <p className="text-xs text-white/40">
            Internal use only. Unauthorized access is prohibited.
          </p>
        </div>
      </div>

      {/* ── Form panel ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col items-center justify-center flex-1 px-6 py-10 lg:px-16 bg-white">
        <div className="w-full max-w-[388px]">
          <div className="mb-8">
            <h2 className="text-[1.625rem] font-semibold text-foreground tracking-tight">
              Welcome back
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
              Sign in with your employee credentials to access the portal.
            </p>
          </div>

          {isSuccess && (
            <Alert variant="success" className="mb-6">
              <p className="font-medium text-green-800 text-sm">Sign-in successful</p>
              <p className="mt-0.5 text-sm text-green-700">
                Redirecting to your dashboard…
              </p>
            </Alert>
          )}

          {accountErrorMsg && (
            <Alert variant="error" className="mb-6">
              <p className="text-sm text-red-800">{accountErrorMsg}</p>
            </Alert>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="flex flex-col gap-5">
              <Input
                label="Employee Code"
                type="text"
                placeholder="e.g. ansary34"
                value={employeeId}
                onChange={(e) => {
                  setEmployeeId(e.target.value);
                  clearAccountError();
                  if (fieldErrors.employeeId)
                    setFieldErrors((p) => ({ ...p, employeeId: undefined }));
                }}
                error={fieldErrors.employeeId}
                disabled={isSubmitting || isSuccess}
                autoComplete="username"
                spellCheck={false}
                autoFocus
              />

              <PasswordInput
                label="Password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  clearAccountError();
                  if (fieldErrors.password)
                    setFieldErrors((p) => ({ ...p, password: undefined }));
                }}
                error={fieldErrors.password}
                disabled={isSubmitting || isSuccess}
                autoComplete="current-password"
              />

              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={isSubmitting}
                disabled={isSuccess}
                className="w-full mt-1"
              >
                {isSubmitting ? "Signing in…" : "Sign In"}
              </Button>
            </div>
          </form>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            Need help accessing your account?{" "}
            <button
              type="button"
              className="text-primary font-medium hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded-sm"
            >
              Contact HR
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTER
// ═══════════════════════════════════════════════════════════════════════════════

// Opened from a web server we use real paths. Opened straight off disk
// (file://) the History API has no origin to work against, so the standalone
// demo build falls back to hash routing and still navigates correctly.
const createRouter =
  typeof window !== "undefined" && window.location.protocol === "file:"
    ? createHashRouter
    : createBrowserRouter;

const router = createRouter([
  { path: "/", element: <LoginPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        // Managers, the technical manager, the GM and HR are all employees in
        // the hierarchy too, and must be able to file their own requests
        // (hr-admin-v1 §2). Self-service is open to every signed-in role.
        element: <RoleRoute role={["EMPLOYEE", "MANAGER", "TECH_MANAGER", "GM", "HR"]} />,
        children: [
          { path: "/employee/dashboard", element: <EmployeeDashboardPage /> },
          { path: "/employee/new-request", element: <NewRequestPage /> },
          { path: "/employee/new-request/leave", element: <LeaveRequestPage /> },
          { path: "/employee/new-request/mission", element: <MissionRequestPage /> },
          { path: "/employee/new-request/permission", element: <PermissionRequestPage /> },
          { path: "/employee/requests", element: <EmployeeRequestsPage /> },
          { path: "/employee/requests/:id", element: <EmployeeRequestDetailPage /> },
          { path: "/employee/notifications", element: <EmployeeNotificationsPage /> },
          { path: "/profile", element: <MyProfilePage /> },
          { path: "/employee/*", element: <Navigate to="/employee/dashboard" replace /> },
        ],
      },
      {
        element: <RoleRoute role={["MANAGER", "TECH_MANAGER", "GM"]} />,
        children: [
          { path: "/manager/dashboard", element: <ManagerDashboardPage /> },
          { path: "/manager/team", element: <ManagerTeamPage /> },
          { path: "/manager/requests", element: <ManagerRequestsPage /> },
          { path: "/manager/requests/:id", element: <ManagerRequestDetailPage /> },
          { path: "/manager/notifications", element: <ManagerNotificationsPage /> },
          { path: "/manager/*", element: <Navigate to="/manager/dashboard" replace /> },
        ],
      },
      {
        // Read-only organisation directory. The GM's remit is final approval
        // and visibility, so this view has no editing affordances at all.
        element: <RoleRoute role={["TECH_MANAGER", "GM"]} />,
        children: [
          { path: "/manager/organization", element: <OrganizationPage /> },
        ],
      },
      {
        element: <RoleRoute role="HR" />,
        children: [
          { path: "/hr/dashboard", element: <HRDashboardPage /> },
          { path: "/hr/employees", element: <HREmployeesPage /> },
          { path: "/hr/requests", element: <HRRequestsPage /> },
          { path: "/hr/requests/:id", element: <HRRequestDetailPage /> },
          { path: "/hr/notifications", element: <HRNotificationsPage /> },
          { path: "/hr/attendance", element: <HRAttendancePage /> },
          { path: "/hr/settings", element: <HRSettingsPage /> },
          { path: "/hr/*", element: <Navigate to="/hr/dashboard" replace /> },
        ],
      },
    ],
  },
  { path: "/design-system", element: <DesignSystemPage /> },
  { path: "/access-denied", element: <AccessDeniedPage /> },
  { path: "*", element: <Navigate to="/" replace /> },
]);

// ═══════════════════════════════════════════════════════════════════════════════
// APP ROOT
// ═══════════════════════════════════════════════════════════════════════════════

export default function App() {
  return (
    <AuthProvider>
      <StoreProvider>
        <RouterProvider router={router} />
      </StoreProvider>
    </AuthProvider>
  );
}
