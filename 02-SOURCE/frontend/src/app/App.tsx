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
  isApprover,
  ROLE_LABEL,
  BALANCE_LABEL,
  DEFAULT_ENTITLEMENTS,
  DEFAULT_PERMISSION_MINUTES,
  PERMISSION_LABEL,
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
} from "../lib/store";
import {
  signIn as authSignIn,
  getSession,
  signOut as authSignOut,
  dashboardPath,
  createHRUserCredential,
  updateHRUserCredential,
  subscribeToAuthChanges,
} from "../lib/auth";
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
}

export function PasswordInput({
  label,
  error,
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
          aria-describedby={error ? `${inputId}-err` : undefined}
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
}

function CalendarPopover({ value, onChange, onClose }: CalendarPopoverProps) {
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

  function selectDay(day: number) {
    const m = String(viewMonth + 1).padStart(2, "0");
    const d = String(day).padStart(2, "0");
    onChange(`${viewYear}-${m}-${d}`);
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
                    onClick={() => selectDay(day)}
                    className={cn(
                      "h-8 w-8 rounded-full text-sm transition-colors",
                      isSelected(day) && "bg-primary text-white font-semibold",
                      !isSelected(day) && isToday(day) &&
                        "font-semibold text-primary ring-1 ring-inset ring-primary/40",
                      !isSelected(day) && !isToday(day) && "text-foreground hover:bg-muted"
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

          {/* Today shortcut */}
          <div className="mt-2 pt-2 border-t border-border flex justify-center">
            <button
              type="button"
              onClick={() => {
                setViewYear(today.getFullYear());
                setViewMonth(today.getMonth());
                selectDay(today.getDate());
              }}
              className="text-xs text-primary hover:underline"
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
  label, error, value, onChange, placeholder, className, id: idProp, ...props
}: InputProps) {
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
      <input type="date" value={value ?? ""} onChange={onChange} className="sr-only" tabIndex={-1} {...props} />

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
  ],
  MANAGER: [
    { label: "Dashboard", icon: Home, id: "dashboard" },
    { label: "My Team", icon: Users, id: "team" },
    { label: "My Requests", icon: Umbrella, id: "myrequests" },
    { label: "Requests", icon: FileText, id: "requests" },
    { label: "Notifications", icon: Bell, id: "notifications" },
  ],
  TECH_MANAGER: [
    { label: "Dashboard", icon: Home, id: "dashboard" },
    { label: "My Team", icon: Users, id: "team" },
    { label: "My Requests", icon: Umbrella, id: "myrequests" },
    { label: "Requests", icon: FileText, id: "requests" },
    { label: "Organization", icon: Briefcase, id: "organization" },
    { label: "Notifications", icon: Bell, id: "notifications" },
  ],
  GM: [
    { label: "Dashboard", icon: Home, id: "dashboard" },
    { label: "My Team", icon: Users, id: "team" },
    { label: "My Requests", icon: Umbrella, id: "myrequests" },
    { label: "Requests", icon: FileText, id: "requests" },
    { label: "Organization", icon: Briefcase, id: "organization" },
    { label: "Notifications", icon: Bell, id: "notifications" },
  ],
  HR: [
    { label: "Dashboard", icon: Home, id: "dashboard" },
    { label: "Employees", icon: Users, id: "employees" },
    { label: "My Requests", icon: Umbrella, id: "myrequests" },
    { label: "Requests", icon: FileText, id: "requests" },
    { label: "Attendance", icon: Clock, id: "attendance" },
    { label: "Notifications", icon: Bell, id: "notifications" },
    { label: "Settings", icon: Settings, id: "settings" },
  ],
};

interface SidebarProps {
  role: UserRole;
  activeId?: string;
  onNavigate?: (id: string) => void;
  onLogout?: () => void;
  userName?: string;
}

export function Sidebar({
  role,
  activeId,
  onNavigate,
  onLogout,
  userName,
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
              <p className="text-xs text-muted-foreground">{role}</p>
            </div>
          </div>
        )}
        <button
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-[8px] text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
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
}

export function Header({
  title,
  userName,
  role,
  notificationCount = 0,
  onNotificationsClick,
  onMenuClick,
  accessory,
}: HeaderProps) {
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
          <button className="flex items-center gap-2.5 h-9 px-3 rounded-[8px] text-sm hover:bg-muted transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <Avatar name={userName} size="sm" />
            <span className="hidden md:block text-sm font-medium text-foreground max-w-[140px] truncate">
              {userName}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
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
  };
  children?: React.ReactNode;
  activeNavId?: string;
  pageTitle?: string;
  notificationCount?: number;
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
  accessory,
  onNavigate,
  onLogout,
}: AppShellProps) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex">
        <Sidebar
          role={user.role}
          activeId={activeNavId}
          onNavigate={onNavigate}
          onLogout={onLogout}
          userName={user.name}
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
              onLogout={onLogout}
              userName={user.name}
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
        accessory={accessory}
          onMenuClick={() => setMobileSidebarOpen(true)}
        />
        <main className="flex-1 overflow-auto p-6 lg:p-8">
          {children}
        </main>
      </div>
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
  // getSession() rehydrates synchronously from storage, so a refresh or a deep
  // link lands on the right page instead of bouncing to login. Because it is
  // synchronous, ProtectedRoute needs no pending state.
  const [session, setSession] = useState<Session | null>(() => getSession());

  // subscribeToAuthChanges was exported but never called, so nothing outside
  // this component could ever end a session. HR deactivating the signed-in
  // account now propagates here immediately.
  useEffect(() => subscribeToAuthChanges(setSession), []);

  const login = useCallback((s: Session) => {
    setSession(s);
  }, []);

  const logout = useCallback(() => {
    authSignOut();
    setSession(null);
  }, []);

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
  firstName: string; lastName: string; email: string; phone?: string;
  position: string; department: string; role: UserRole;
  managerId: string | null; status: "ACTIVE" | "INACTIVE"; password: string;
  annualDays: number; casualDays: number; permissionMinutes: number;
}

interface StoreContextValue {
  requests: RequestRecord[];
  notifications: NotificationRecord[];
  employees: EmployeeProfile[];
  leaveTypes: LeaveTypeRecord[];
  attendance: AttendanceRecord[];
  holidays: HolidayRecord[];
  createLeaveRequest: (
    employeeId: string, employeeName: string,
    data: { leaveType: string; startDate: string; endDate: string; reason?: string }
  ) => { ok: true; request: RequestRecord } | { ok: false; errors: Record<string, string> };
  createMissionRequest: (
    employeeId: string, employeeName: string,
    data: { startDate: string; startTime: string; endDate: string; endTime: string; location: string; purpose: string }
  ) => { ok: true; request: RequestRecord } | { ok: false; errors: Record<string, string> };
  approveRequest: (requestId: string, approverId: string, comment?: string) => { ok: boolean; error?: string };
  rejectRequest: (requestId: string, approverId: string, comment: string) => { ok: boolean; error?: string };
  markNotificationRead: (id: string) => void;
  // HR-only operations
  createEmployee: (
    data: CreateEmployeeInput
  ) => { ok: true; employee: EmployeeProfile; password: string } | { ok: false; errors: Record<string, string> };
  updateEmployee: (id: string, data: Partial<EmployeeProfile>) => { ok: boolean; error?: string };
  createLeaveType: (name: string, balanceKey: BalanceKey | null) => LeaveTypeRecord;
  updateLeaveType: (id: string, updates: Partial<LeaveTypeRecord>) => void;
  createPermissionRequest: (
    employeeId: string, employeeName: string,
    data: { permissionKind: PermissionKind; date: string; minutes: number; reason?: string }
  ) => { ok: true; request: RequestRecord } | { ok: false; errors: Record<string, string> };
  recordAttendance: (
    data: { employeeId: string; date: string; checkIn?: string; checkOut?: string; note?: string },
    recordedBy: string
  ) => { ok: boolean; error?: string };
  deleteAttendance: (id: string) => void;
  createHoliday: (date: string, name: string) => { ok: boolean; error?: string };
  deleteHoliday: (id: string) => void;
}

const StoreCtx = createContext<StoreContextValue | null>(null);

function StoreProvider({ children }: { children?: React.ReactNode }) {
  const [store, setStore] = useState<StoreData>(() => loadStore());

  // Persist as an effect rather than inside the updater. Writing to storage from
  // within a state updater is a side effect in a reducer, which React 18
  // StrictMode double-invokes in development.
  useEffect(() => { saveStore(store); }, [store]);

  function mutate(updater: (prev: StoreData) => StoreData) {
    setStore(updater);
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

  function recordAttendance(
    data: { employeeId: string; date: string; checkIn?: string; checkOut?: string; note?: string },
    recordedBy: string
  ): { ok: boolean; error?: string } {
    if (!data.employeeId) return { ok: false, error: "Choose an employee." };
    if (!data.date) return { ok: false, error: "Choose a date." };
    if (!data.checkIn && !data.checkOut) {
      return { ok: false, error: "Enter a check-in time, a check-out time, or both." };
    }
    if (data.checkIn && data.checkOut && minutesOfDay(data.checkOut) <= minutesOfDay(data.checkIn)) {
      return { ok: false, error: "Check-out must be after check-in." };
    }
    if (!store.employees.some((e) => e.id === data.employeeId)) {
      return { ok: false, error: "Employee not found." };
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

  function deleteAttendance(id: string) {
    mutate((p) => ({ ...p, attendance: p.attendance.filter((a) => a.id !== id) }));
  }

  function createHoliday(date: string, name: string): { ok: boolean; error?: string } {
    if (!date) return { ok: false, error: "Choose a date." };
    if (!name.trim()) return { ok: false, error: "Give the holiday a name." };
    if (store.holidays.some((h) => h.date === date)) {
      return { ok: false, error: "That date is already a public holiday." };
    }

    mutate((p) => ({
      ...p,
      holidays: [...p.holidays, { id: `hol-${p.nextHolidaySeq}`, date, name: name.trim() }]
        .sort((a, b) => a.date.localeCompare(b.date)),
      nextHolidaySeq: p.nextHolidaySeq + 1,
    }));
    return { ok: true };
  }

  function deleteHoliday(id: string) {
    mutate((p) => ({ ...p, holidays: p.holidays.filter((h) => h.id !== id) }));
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

  function markNotificationRead(id: string) {
    mutate((p) => ({ ...p, notifications: p.notifications.map((n) => n.id === id ? { ...n, read: true } : n) }));
  }

  function createEmployee(data: CreateEmployeeInput) {
    const errs = validateEmployeeFields(data, store.employees);
    if (Object.keys(errs).length > 0) return { ok: false as const, errors: errs };

    const seq = String(store.nextEmpSeq).padStart(5, "0");
    const id = `EMP-${seq}`;
    const name = `${data.firstName.trim()} ${data.lastName.trim()}`;
    const employee: EmployeeProfile = {
      id, name, firstName: data.firstName.trim(), lastName: data.lastName.trim(),
      position: data.position.trim(), department: data.department,
      email: data.email.trim().toLowerCase(),
      phone: data.phone?.trim() || undefined,
      status: data.status, managerId: data.managerId || null, role: data.role,
      entitlements: { ANNUAL: data.annualDays, CASUAL: data.casualDays },
      permissionMinutesPerMonth: data.permissionMinutes,
    };
    createHRUserCredential({ employeeNumber: id, name, role: data.role, password: data.password });
    mutate((p) => ({ ...p, employees: [...p.employees, employee], nextEmpSeq: p.nextEmpSeq + 1 }));
    return { ok: true as const, employee, password: data.password };
  }

  function updateEmployee(id: string, data: Partial<EmployeeProfile>): { ok: boolean; error?: string } {
    const target = store.employees.find((e) => e.id === id);
    if (!target) return { ok: false, error: "Employee not found." };

    // Guard the quick Activate/Deactivate action too, not just the edit form.
    const reports = store.employees.filter((e) => e.managerId === id);
    if (data.status === "INACTIVE" && target.role === "MANAGER" && reports.length > 0) {
      return {
        ok: false,
        error: `${reports.length} employee${reports.length === 1 ? "" : "s"} still report to ${target.name}. Reassign them first.`,
      };
    }

    mutate((p) => {
      const employees = p.employees.map((e) => {
        if (e.id !== id) return e;
        const updated = { ...e, ...data };
        if (data.firstName || data.lastName) {
          updated.name = `${updated.firstName} ${updated.lastName}`;
        }
        return updated;
      });
      return { ...p, employees };
    });

    // Role, name and status are re-read from the employee record on every
    // sign-in, so the credential store only needs to know about revocation —
    // which now actually ends the affected user's live session.
    if (data.status !== undefined) {
      updateHRUserCredential(id, { active: data.status === "ACTIVE" });
    }

    return { ok: true };
  }

  function createLeaveType(name: string, balanceKey: BalanceKey | null): LeaveTypeRecord {
    const id = `lt-${store.nextLeaveTypeSeq}`;
    const lt: LeaveTypeRecord = { id, name: name.trim(), status: "ACTIVE", balanceKey };
    mutate((p) => ({ ...p, leaveTypes: [...p.leaveTypes, lt], nextLeaveTypeSeq: p.nextLeaveTypeSeq + 1 }));
    return lt;
  }

  function updateLeaveType(id: string, updates: Partial<LeaveTypeRecord>) {
    mutate((p) => ({ ...p, leaveTypes: p.leaveTypes.map((lt) => lt.id === id ? { ...lt, ...updates } : lt) }));
  }

  return (
    <StoreCtx.Provider value={{
      requests: store.requests, notifications: store.notifications,
      employees: store.employees, leaveTypes: store.leaveTypes,
      attendance: store.attendance, holidays: store.holidays,
      createLeaveRequest, createMissionRequest, createPermissionRequest,
      recordAttendance, deleteAttendance, createHoliday, deleteHoliday,
      approveRequest, rejectRequest, markNotificationRead,
      createEmployee, updateEmployee, createLeaveType, updateLeaveType,
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
  },
  MANAGER: {
    dashboard: "/manager/dashboard",
    team: "/manager/team",
    myrequests: "/employee/requests",
    requests: "/manager/requests",
    notifications: "/manager/notifications",
  },
  TECH_MANAGER: {
    dashboard: "/manager/dashboard",
    team: "/manager/team",
    myrequests: "/employee/requests",
    requests: "/manager/requests",
    organization: "/manager/organization",
    notifications: "/manager/notifications",
  },
  GM: {
    dashboard: "/manager/dashboard",
    team: "/manager/team",
    myrequests: "/employee/requests",
    requests: "/manager/requests",
    organization: "/manager/organization",
    notifications: "/manager/notifications",
  },
  HR: {
    dashboard: "/hr/dashboard",
    employees: "/hr/employees",
    myrequests: "/employee/requests",
    requests: "/hr/requests",
    attendance: "/hr/attendance",
    notifications: "/hr/notifications",
    settings: "/hr/settings",
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
  const { notifications } = useStore();
  const navigate = useNavigate();

  const unreadCount = notifications.filter(
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
      user={session!.user}
      activeNavId={activeNavId}
      pageTitle={pageTitle}
      notificationCount={unreadCount}
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

function ApproverInfo({ chain }: { chain: ApprovalStep[] }) {
  return (
    <div className="rounded-[8px] border border-border bg-muted/30 p-4">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        Approval chain
      </p>
      <div className="flex flex-col gap-3">
        {chain.map((step, i) => (
          <div key={step.stage} className="flex items-center gap-3">
            <span className="text-xs font-semibold text-muted-foreground w-4 flex-shrink-0 tabular-nums">
              {i + 1}
            </span>
            <Avatar name={step.approverName} size="sm" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{step.approverName}</p>
              <p className="text-xs text-muted-foreground">{step.title}</p>
            </div>
          </div>
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
  const { requests, employees, attendance } = useStore();

  const me = employees.find((e) => e.id === session!.user.id) ?? null;
  const month = currentMonthKey(new Date());

  return {
    me,
    month,
    leave: me ? getAllLeaveBalances(me, requests) : [],
    permission: me ? getPermissionBalance(me, requests, attendance, month) : null,
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

function EmployeeDashboardPage() {
  const { session } = useAuth();
  const { requests } = useStore();
  const { leave: myLeave, permission: myPermission } = useMyBalances();
  const navigate = useNavigate();

  const myRequests = requests.filter((r) => r.employeeId === session!.user.id);
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

      {/* Recent requests */}
      <Card>
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
      <div className="max-w-2xl">
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-foreground">New Request</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Choose the type of request you want to submit.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              Select <ChevronRight className="h-3.5 w-3.5" />
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
              Select <ChevronRight className="h-3.5 w-3.5" />
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
              Select <ChevronRight className="h-3.5 w-3.5" />
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
  const { requests, leaveTypes, employees, createLeaveRequest } = useStore();
  const navigate = useNavigate();

  const manager = getManagerForEmployee(employees, session!.user.id);
  const chain = buildApprovalChain(employees, session!.user.id);

  const [leaveType, setLeaveType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
              <Select
                label="Leave Type *"
                value={leaveType}
                onChange={(e) => { setLeaveType(e.target.value); clearErr("leaveType"); }}
                error={errors.leaveType}
              >
                <option value="">Select Leave Type</option>
                {leaveTypes.filter((lt) => lt.status === "ACTIVE").map((lt) => (
                  <option key={lt.id} value={lt.name}>{lt.name}</option>
                ))}
              </Select>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <DatePicker
                  label="Start Date *"
                  value={startDate}
                  onChange={(e) => { setStartDate(e.target.value); clearErr("startDate"); }}
                  error={errors.startDate}
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
  const { employees, createMissionRequest } = useStore();
  const navigate = useNavigate();

  const manager = getManagerForEmployee(employees, session!.user.id);
  const chain = buildApprovalChain(employees, session!.user.id);

  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [location, setLocation] = useState("");
  const [purpose, setPurpose] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

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
    const errs = validateMissionFields({ startDate, startTime, endDate, endTime, location, purpose });
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});
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

function PermissionRequestPage() {
  const selfNavId = useSelfServiceNavId();
  const { session } = useAuth();
  const { employees, createPermissionRequest } = useStore();
  const { permission } = useMyBalances();
  const navigate = useNavigate();

  const [kind, setKind] = useState<PermissionKind | "">("");
  const [date, setDate] = useState("");
  const [minutes, setMinutes] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const manager = getManagerForEmployee(employees, session!.user.id);
  const exhausted = !permission || permission.available === 0;

  // The form is noValidate on purpose. A native min/max on the minutes field
  // blocks submit silently, so the handler never runs and the employee is left
  // staring at a form that will not send with no explanation. Our own validation
  // produces the only messages.
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
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
  const { requests } = useStore();
  const { session } = useAuth();
  const navigate = useNavigate();

  const justSubmitted = location.state?.justSubmitted === true;
  const request = requests.find((r) => r.id === id);

  if (!request) return <Navigate to="/employee/requests" replace />;

  // Ownership guard. Without it, changing the id in the URL exposed any other
  // employee's request — including the free-text reason, which for sick and
  // maternity leave is health data. ManagerRequestDetailPage already had the
  // equivalent check; this page did not.
  if (request.employeeId !== session!.user.id) {
    return <Navigate to="/access-denied" replace />;
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
    </DashboardShell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE: E05 — MY REQUESTS
// ═══════════════════════════════════════════════════════════════════════════════

function EmployeeRequestsPage() {
  const selfNavId = useSelfServiceNavId();
  const { session } = useAuth();
  const { requests } = useStore();
  const navigate = useNavigate();

  const myRequests = [...requests.filter((r) => r.employeeId === session!.user.id)].sort(
    (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
  );

  return (
    <DashboardShell activeNavId={selfNavId} pageTitle="My Requests">
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
  const { notifications, markNotificationRead } = useStore();
  const navigate = useNavigate();

  const myNotifs = [...notifications.filter((n) => n.userId === session!.user.id)].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  function handleClick(n: NotificationRecord) {
    markNotificationRead(n.id);
    navigate(`/employee/requests/${n.requestId}`);
  }

  return (
    <DashboardShell activeNavId="notifications" pageTitle="Notifications">
      <div className="max-w-2xl">
        <h2 className="text-lg font-semibold text-foreground mb-5">Notifications</h2>
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
  const { requests } = useStore();
  const navigate = useNavigate();

  // Visible: every request this approver sits in the chain of, at any stage.
  // For the technical manager and the GM that is the whole organisation,
  // because they are in every chain. Actionable: only what is waiting on them
  // right now.
  const myRequests = requests.filter((r) => involvesApprover(r, session!.user.id));
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

      <Card>
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
    { label: "Employee ID", value: employee.id },
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
      <DashboardShell activeNavId="team" pageTitle="My Team">
        <LoadingState message="Loading your team..." />
      </DashboardShell>
    );
  }

  if (loadState === "error") {
    return (
      <DashboardShell activeNavId="team" pageTitle="My Team">
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
          e.id.toLowerCase().includes(q)
      )
    : team;

  return (
    <DashboardShell activeNavId="team" pageTitle="My Team">
      {/* Page header */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-foreground">My Team</h2>
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
                    <span className="text-sm text-muted-foreground font-mono">{e.id}</span>
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
  const { employees } = useStore();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<EmployeeProfile | null>(null);

  const q = search.toLowerCase().trim();
  const rows = employees.filter(
    (e) =>
      !q ||
      e.name.toLowerCase().includes(q) ||
      e.id.toLowerCase().includes(q) ||
      e.department.toLowerCase().includes(q)
  );

  const managerName = (e: EmployeeProfile) =>
    employees.find((m) => m.id === e.managerId)?.name ?? "—";

  return (
    <DashboardShell activeNavId="organization" pageTitle="Organization">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-foreground">Organization</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Everyone in the company, with their place in the reporting chain. View only.
        </p>
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          className="w-full pl-9 pr-3 py-2 rounded-[8px] border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          placeholder="Search by name, ID or department..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card padding={false}>
        {rows.length === 0 ? (
          <EmptyState title="No matches" description="Try a different name, ID or department." />
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
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{e.id}</td>
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
  const { requests } = useStore();
  const navigate = useNavigate();

  const [filterEmployee, setFilterEmployee] = useState("");
  const [filterType, setFilterType] = useState<"" | "LEAVE" | "MISSION">("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  const myRequests = [...requests.filter((r) => involvesApprover(r, session!.user.id))].sort(
    (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
  );

  const employeeOptions = Array.from(new Set(myRequests.map((r) => r.employeeName))).sort();

  const hasFilters = !!(filterEmployee || filterType || filterDateFrom || filterDateTo);

  function clearFilters() {
    setFilterEmployee("");
    setFilterType("");
    setFilterDateFrom("");
    setFilterDateTo("");
  }

  const filtered = myRequests.filter((r) => {
    if (filterEmployee && r.employeeName !== filterEmployee) return false;
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
  const { requests, approveRequest, rejectRequest } = useStore();
  const { session } = useAuth();
  const navigate = useNavigate();

  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectComment, setRejectComment] = useState("");
  const [rejectErr, setRejectErr] = useState("");
  const [actionErr, setActionErr] = useState("");
  const [loading, setLoading] = useState(false);

  const request = requests.find((r) => r.id === id);
  if (!request) return <Navigate to="/manager/requests" replace />;
  // An approver may open any request they appear in, but may only act on it
  // while it is standing at their own stage.
  if (!involvesApprover(request, session!.user.id)) return <Navigate to="/access-denied" replace />;

  // The action buttons appear only for the approver whose stage is live. A
  // later approver can read the request while it is still upstream of them, but
  // cannot decide it out of turn.
  const isPending = awaitsDecisionBy(request, session!.user.id);
  const waitingOn = currentStep(request);

  async function handleApprove() {
    setLoading(true);
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
  const { notifications, markNotificationRead } = useStore();
  const navigate = useNavigate();

  const myNotifs = [...notifications.filter((n) => n.userId === session!.user.id)].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  function handleClick(n: NotificationRecord) {
    markNotificationRead(n.id);
    navigate(`/manager/requests/${n.requestId}`);
  }

  return (
    <DashboardShell activeNavId="notifications" pageTitle="Notifications">
      <div className="max-w-2xl">
        <h2 className="text-lg font-semibold text-foreground mb-5">Notifications</h2>
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
  const { requests, employees, notifications } = useStore();
  const navigate = useNavigate();

  const totalEmp = employees.length;
  const activeEmp = employees.filter((e) => e.status === "ACTIVE").length;
  const totalReq = requests.length;
  const pending = requests.filter((r) => r.status === "PENDING").length;
  const approved = requests.filter((r) => r.status === "APPROVED").length;
  const rejected = requests.filter((r) => r.status === "REJECTED").length;

  const recent = [...requests]
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
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground">Recent Requests</h3>
          {requests.length > 0 && (
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
    </DashboardShell>
  );
}

// ─── Employee form (used by Add and Edit) ─────────────────────────────────────

interface EmployeeFormData {
  firstName: string; lastName: string; email: string; phone: string;
  position: string; department: string; role: UserRole;
  managerId: string; status: "ACTIVE" | "INACTIVE"; password: string;
  annualDays: string;
  casualDays: string;
  permissionMinutes: string;
}

function EmployeeForm({
  initial,
  managers,
  errors,
  onChange,
  isEdit,
}: {
  initial: EmployeeFormData;
  managers: EmployeeProfile[];
  errors: Record<string, string>;
  onChange: (next: EmployeeFormData) => void;
  isEdit: boolean;
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
      <Select label="Department *" value={initial.department} onChange={field("department")} error={errors.department}>
        <option value="">Select Department</option>
        {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
      </Select>
      <Select label="Role *" value={initial.role} onChange={field("role")} error={errors.role}>
        <option value="">Select Role</option>
        <option value="EMPLOYEE">Employee</option>
        <option value="MANAGER">Direct Manager</option>
        <option value="TECH_MANAGER">Technical Manager</option>
        <option value="GM">General Manager</option>
        <option value="HR">HR</option>
      </Select>
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

      {!isEdit && (
        <Input label="Initial Password *" type="password" value={initial.password} onChange={field("password")} error={errors.password} hint="The employee signs in with their Employee ID and this password." placeholder="Temporary password for this employee" />
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
  firstName: "", lastName: "", email: "", phone: "",
  position: "", department: "", role: "EMPLOYEE" as UserRole,
  managerId: "", status: "ACTIVE", password: "",
  annualDays: "14", casualDays: "7", permissionMinutes: "240",
};

function HREmployeesPage() {
  const { employees, createEmployee, updateEmployee } = useStore();
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<"" | UserRole>("");
  const [filterDept, setFilterDept] = useState("");
  const [filterStatus, setFilterStatus] = useState<"" | "ACTIVE" | "INACTIVE">("");

  // Add employee modal
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<EmployeeFormData>(EMPTY_FORM);
  const [addErrors, setAddErrors] = useState<Record<string, string>>({});
  const [addResult, setAddResult] = useState<{ employee: EmployeeProfile; password: string } | null>(null);
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

  const eligibleManagers = getEligibleManagers(employees);

  // Filtering
  const q = search.toLowerCase().trim();
  const filtered = employees.filter((e) => {
    if (q && !e.name.toLowerCase().includes(q) && !e.id.toLowerCase().includes(q)) return false;
    if (filterRole && e.role !== filterRole) return false;
    if (filterDept && e.department !== filterDept) return false;
    if (filterStatus && e.status !== filterStatus) return false;
    return true;
  });

  function openEdit(emp: EmployeeProfile) {
    setEditTarget(emp);
    setEditForm({
      firstName: emp.firstName, lastName: emp.lastName, email: emp.email,
      phone: emp.phone ?? "", position: emp.position, department: emp.department,
      role: emp.role, managerId: emp.managerId ?? "", status: emp.status, password: "",
      annualDays: String(emp.entitlements?.ANNUAL ?? DEFAULT_ENTITLEMENTS.ANNUAL),
      casualDays: String(emp.entitlements?.CASUAL ?? DEFAULT_ENTITLEMENTS.CASUAL),
      permissionMinutes: String(emp.permissionMinutesPerMonth ?? DEFAULT_PERMISSION_MINUTES),
    });
    setEditErrors({});
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
    await new Promise((r) => setTimeout(r, 600));
    const result = createEmployee({
      ...addForm,
      managerId: addForm.managerId || null,
      phone: addForm.phone || undefined,
      annualDays: Number(addForm.annualDays),
      casualDays: Number(addForm.casualDays),
      permissionMinutes: Number(addForm.permissionMinutes),
    });
    setAddSaving(false);
    if (!result.ok) { setAddErrors((result as { ok: false; errors: Record<string, string> }).errors); return; }
    setAddResult({ employee: result.employee, password: result.password });
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
    await new Promise((r) => setTimeout(r, 500));
    updateEmployee(editTarget.id, {
      firstName: editForm.firstName.trim(),
      lastName: editForm.lastName.trim(),
      name: `${editForm.firstName.trim()} ${editForm.lastName.trim()}`,
      email: editForm.email.trim().toLowerCase(),
      phone: editForm.phone.trim() || undefined,
      position: editForm.position.trim(),
      department: editForm.department,
      role: editForm.role,
      managerId: editForm.managerId || null,
      status: editForm.status,
      entitlements: { ANNUAL: Number(editForm.annualDays), CASUAL: Number(editForm.casualDays) },
      permissionMinutesPerMonth: Number(editForm.permissionMinutes),
    });
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

      {/* Count */}
      <p className="text-xs text-muted-foreground mb-3">{filtered.length} of {employees.length} employees</p>

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
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{emp.id}</td>
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
                            onClick={() => {
                              const res = updateEmployee(emp.id, { status: emp.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" });
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
            <div className="rounded-[10px] border border-border divide-y divide-border">
              {[
                { label: "Employee ID", value: addResult.employee.id },
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
            <p className="text-xs text-muted-foreground">Share the temporary password with the employee so they can log in.</p>
          </div>
        ) : (
          <EmployeeForm
            initial={addForm}
            managers={eligibleManagers}
            errors={addErrors}
            onChange={setAddForm}
            isEdit={false}
          />
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
          errors={editErrors}
          onChange={setEditForm}
          isEdit={true}
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
                { label: "Employee ID", value: viewTarget.id },
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
  const { requests, employees } = useStore();
  const navigate = useNavigate();

  const [filterManager, setFilterManager] = useState("");
  const [filterEmployee, setFilterEmployee] = useState("");
  const [filterType, setFilterType] = useState<"" | "LEAVE" | "MISSION">("");
  const [filterStatus, setFilterStatus] = useState<"" | "PENDING" | "APPROVED" | "REJECTED">("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  // Build unique manager list from actual request data (preserves historical)
  const allManagers = Array.from(
    new Map(requests.map((r) => [r.managerId, r.managerName])).entries()
  ).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));

  const allEmployees = Array.from(
    new Map(requests.map((r) => [r.employeeId, r.employeeName])).entries()
  ).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));

  const hasFilters = !!(filterManager || filterEmployee || filterType || filterStatus || filterFrom || filterTo);

  function clearFilters() {
    setFilterManager(""); setFilterEmployee(""); setFilterType(""); setFilterStatus(""); setFilterFrom(""); setFilterTo("");
  }

  const filtered = requests.filter((r) => {
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
            <p className="text-xs text-muted-foreground">{filtered.length} of {requests.length} requests</p>
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
  const { requests, employees } = useStore();
  const navigate = useNavigate();

  const request = requests.find((r) => r.id === id);

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

  const details: { label: string; value: string }[] = [
    { label: "Request Number", value: request.requestNumber },
    { label: "Employee", value: request.employeeName },
    { label: "Employee ID", value: request.employeeId },
    { label: "Department", value: emp?.department ?? "—" },
    { label: "Approval Stage", value: stageLabel(request) },
    { label: "Request Type", value: request.type },
    ...(request.leaveType ? [{ label: "Leave Type", value: request.leaveType }] : []),
    { label: "Start Date", value: fmtDate(request.startDate) },
    ...(request.startTime ? [{ label: "Start Time", value: request.startTime }] : []),
    { label: "End Date", value: fmtDate(request.endDate) },
    ...(request.endTime ? [{ label: "End Time", value: request.endTime }] : []),
    ...(request.location ? [{ label: "Location", value: request.location }] : []),
    ...(request.reason ? [{ label: "Reason", value: request.reason }] : []),
    ...(request.purpose ? [{ label: "Purpose", value: request.purpose }] : []),
    { label: "Submitted", value: fmtDate(request.submittedAt) },
    ...(request.decidedAt ? [{ label: "Decided", value: fmtDate(request.decidedAt) }] : []),
    ...(request.decisionComment
      ? [{
          label: "Decision Comment",
          value: `${request.decisionComment}${decidedByName ? ` — ${decidedByName}` : ""}`,
        }]
      : []),
  ];

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
  const { notifications, markNotificationRead } = useStore();
  const navigate = useNavigate();

  const myNotifs = [...notifications.filter((n) => n.userId === session!.user.id)].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <DashboardShell activeNavId="notifications" pageTitle="Notifications">
      <div className="max-w-2xl">
        <h2 className="text-lg font-semibold text-foreground mb-5">Notifications</h2>
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
                onClick={() => { markNotificationRead(n.id); navigate(`/hr/requests/${n.requestId}`); }}
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
  const { employees, attendance, requests, recordAttendance, deleteAttendance } = useStore();
  const { session } = useAuth();

  const today = toISODate(new Date());
  const [employeeId, setEmployeeId] = useState("");
  const [date, setDate] = useState(today);
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [filterMonth, setFilterMonth] = useState(currentMonthKey(new Date()));

  const activeEmployees = employees.filter((e) => e.status === "ACTIVE");

  function handleSave() {
    setSaved("");
    const res = recordAttendance({ employeeId, date, checkIn, checkOut, note }, session!.user.id);
    if (!res.ok) { setError(res.error ?? "Could not save."); return; }
    const who = employees.find((e) => e.id === employeeId)?.name ?? employeeId;
    setError("");
    setSaved(`Saved ${who} for ${fmtDate(date)}.`);
    setCheckIn(""); setCheckOut(""); setNote("");
  }

  const rows = [...attendance]
    .filter((a) => monthKey(a.date) === filterMonth)
    .sort((a, b) => b.date.localeCompare(a.date) || a.employeeId.localeCompare(b.employeeId));

  const months = Array.from(new Set([filterMonth, ...attendance.map((a) => monthKey(a.date))])).sort().reverse();

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
                <option key={e.id} value={e.id}>{e.name} — {e.id}</option>
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
            <Button variant="primary" onClick={handleSave}>Save Record</Button>
          </div>
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
                  const balance = emp ? getPermissionBalance(emp, requests, attendance, monthKey(a.date)) : null;
                  return (
                    <tr key={a.id} className="border-b border-border/60 last:border-0">
                      <td className="px-4 py-3 whitespace-nowrap tabular-nums">{fmtDate(a.date)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={emp?.name ?? a.employeeId} size="sm" />
                          <span className="font-medium text-foreground">{emp?.name ?? a.employeeId}</span>
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
  const { leaveTypes, createLeaveType, updateLeaveType } = useStore();

  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [addError, setAddError] = useState("");

  const [editTarget, setEditTarget] = useState<LeaveTypeRecord | null>(null);
  const [editName, setEditName] = useState("");
  const [editError, setEditError] = useState("");
  const [newBalanceKey, setNewBalanceKey] = useState<BalanceKey | "">("");
  const [editBalanceKey, setEditBalanceKey] = useState<BalanceKey | "">("");

  function handleAdd() {
    const trimmed = newName.trim();
    if (!trimmed) { setAddError("Name is required."); return; }
    if (leaveTypes.some((lt) => lt.name.toLowerCase() === trimmed.toLowerCase())) {
      setAddError("A leave type with this name already exists."); return;
    }
    createLeaveType(trimmed, newBalanceKey || null);
    setNewName(""); setNewBalanceKey(""); setShowAdd(false); setAddError("");
  }

  function handleEdit() {
    if (!editTarget) return;
    const trimmed = editName.trim();
    if (!trimmed) { setEditError("Name is required."); return; }
    if (leaveTypes.some((lt) => lt.name.toLowerCase() === trimmed.toLowerCase() && lt.id !== editTarget.id)) {
      setEditError("A leave type with this name already exists."); return;
    }
    updateLeaveType(editTarget.id, { name: trimmed, balanceKey: editBalanceKey || null });
    setEditTarget(null); setEditName(""); setEditBalanceKey(""); setEditError("");
  }

  return (
    <DashboardShell activeNavId="settings" pageTitle="Settings">
      <div className="max-w-2xl">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Leave Types</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Manage the leave types available to employees.</p>
          </div>
          <Button variant="primary" onClick={() => { setShowAdd(true); setNewName(""); setAddError(""); }} className="gap-1.5">
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
              <div className="flex gap-2 pt-0.5">
                <Button variant="primary" onClick={handleAdd}>Save</Button>
                <Button variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button>
              </div>
            </div>
          </Card>
        )}

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
                        <div className="flex gap-2 pt-0.5">
                          <Button variant="primary" onClick={handleEdit}>Save</Button>
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
                        </p>
                      </div>
                    )}
                  </div>
                  {editTarget?.id !== lt.id && (
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <StatusBadge status={lt.status === "ACTIVE" ? "active" : "inactive"} />
                      <button
                        onClick={() => { setEditTarget(lt); setEditName(lt.name); setEditBalanceKey(lt.balanceKey ?? ""); setEditError(""); }}
                        className="text-xs text-primary hover:underline font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => updateLeaveType(lt.id, { status: lt.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" })}
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
      </div>
    </DashboardShell>
  );
}

// Public holidays drive the working-day count, so they belong to HR alongside
// leave types. Islamic dates shift every year, which is why they are data.
function HolidaysSection() {
  const { holidays, createHoliday, deleteHoliday } = useStore();
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);

  function handleAdd() {
    const res = createHoliday(date, name);
    if (!res.ok) { setError(res.error ?? "Could not add that holiday."); return; }
    setDate(""); setName(""); setError(""); setOpen(false);
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
              <Button variant="primary" onClick={handleAdd}>Save</Button>
              <Button variant="secondary" onClick={() => { setOpen(false); setError(""); }}>Cancel</Button>
            </div>
          </div>
        </Card>
      )}

      <Card padding={false}>
        {holidays.length === 0 ? (
          <div className="p-6">
            <EmptyState title="No public holidays" description="Add the days your office is closed." />
          </div>
        ) : (
          <div className="divide-y divide-border">
            {holidays.map((h) => (
              <div key={h.id} className="flex items-center gap-4 px-4 py-3">
                <p className="text-sm font-medium text-foreground w-32 flex-shrink-0 tabular-nums">{fmtDate(h.date)}</p>
                <p className="text-sm text-muted-foreground flex-1 min-w-0 truncate">{h.name}</p>
                <button
                  onClick={() => deleteHoliday(h.id)}
                  className="text-xs text-destructive hover:underline flex-shrink-0"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
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
    "Invalid Employee ID or password. Please check your credentials and try again.",
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
    if (!employeeId.trim()) errors.employeeId = "Employee ID is required.";
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
                label="Employee ID"
                type="text"
                placeholder="e.g. EMP-00125"
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
