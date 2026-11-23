
import { useEffect, useMemo, useState } from "react";
import {
  LogIn,
  LogOut,
  CalendarDays,
  Users,
  UserCheck,
  Clock3,
  CalendarCheck2,
  CalendarX,
  Search,
  RefreshCw,
  Building2,
  ClipboardCheck,
  Timer,
  Filter,
  X,
  CheckCircle2,
  AlertCircle,
  Coffee,
  Activity,
  Hourglass,
} from "lucide-react";

import api, { errMsg } from "../api";
import { useAuth } from "../hooks/useAuth";
import StatusBadge from "../components/StatusBadge";
import Alert from "../components/Alert";

const TZ = "Asia/Kolkata";

const SUMMARY_STATUSES = [
  "Present",
  "Late",
  "Half Day",
  "Leave",
  "Absent",
];

const currentMonth = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
  })
    .format(new Date())
    .slice(0, 7);

const todayIST = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

const fmt = date => {
  if (!date) return "-";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) return "-";

  return parsed.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: TZ,
  });
};

const fmtDate = date => {
  if (!date) return "-";

  const value =
    typeof date === "string"
      ? date.slice(0, 10)
      : new Date(date).toISOString().slice(0, 10);

  const parsed = new Date(`${value}T00:00:00Z`);

  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
};

const dur = minutes => {
  if (minutes === null || minutes === undefined || minutes === "") {
    return "-";
  }

  const value = Number(minutes);

  if (!Number.isFinite(value) || value < 0) return "-";

  const hours = Math.floor(value / 60);
  const remainingMinutes = Math.floor(value % 60);

  return `${hours}h ${remainingMinutes}m`;
};

const getEmployeeName = record =>
  record.employee?.user?.name ||
  record.employee?.name ||
  "Unknown Employee";

const getEmployeeId = record =>
  record.employee?.employeeId ||
  record.employee?.empId ||
  record.employee?.user?.employeeId ||
  "";

const getDepartment = record =>
  record.employee?.department?.name ||
  record.employee?.department ||
  "";

const getInitials = name =>
  String(name || "U")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0])
    .join("")
    .toUpperCase();

const getStatusIcon = status => {
  switch (status) {
    case "Present":
      return CheckCircle2;
    case "Late":
      return Clock3;
    case "Half Day":
      return Timer;
    case "Leave":
      return CalendarCheck2;
    case "Absent":
      return CalendarX;
    default:
      return ClipboardCheck;
  }
};

// Supports different API response structures.
const getAttendanceItems = data => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.data?.items)) return data.data.items;
  if (Array.isArray(data?.attendance)) return data.attendance;
  if (Array.isArray(data?.data?.attendance)) return data.data.attendance;

  return [];
};

const getRecordDate = record => {
  if (!record?.date) return "";

  if (typeof record.date === "string") {
    return record.date.slice(0, 10);
  }

  return new Date(record.date).toISOString().slice(0, 10);
};

const isLateRecord = record =>
  Boolean(record?.isLate) || record?.status === "Late";

// Calculate live working and lunch duration.
const getLiveAttendance = (record, now = Date.now()) => {
  if (!record?.checkInAt) {
    return {
      workingMinutes: 0,
      lunchMinutes: 0,
    };
  }

  const checkIn = new Date(record.checkInAt).getTime();

  const endTime = record.checkOutAt
    ? new Date(record.checkOutAt).getTime()
    : now;

  let lunchMinutes = 0;

  if (record.lunchOutAt) {
    const lunchStart = new Date(record.lunchOutAt).getTime();

    const lunchEnd = record.lunchInAt
      ? new Date(record.lunchInAt).getTime()
      : endTime;

    lunchMinutes = Math.max(
      0,
      Math.floor((lunchEnd - lunchStart) / 60000)
    );
  }

  const totalMinutes = Math.max(
    0,
    Math.floor((endTime - checkIn) / 60000)
  );

  const workingMinutes = record.checkOutAt
    ? Number(
        record.workingMinutes ??
          Math.max(0, totalMinutes - lunchMinutes)
      )
    : Math.max(0, totalMinutes - lunchMinutes);

  return {
    workingMinutes: Math.max(0, workingMinutes),
    lunchMinutes,
  };
};

function TimeInfo({ label, value }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-xs font-medium text-slate-400">
        {label}
      </p>

      <p className="mt-1 text-sm font-bold text-slate-800">
        {value || "-"}
      </p>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  description,
  icon: Icon,
  color = "indigo",
  loading,
}) {
  const colorClasses = {
    indigo: "bg-indigo-50 text-indigo-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    blue: "bg-blue-50 text-blue-600",
    rose: "bg-rose-50 text-rose-600",
    orange: "bg-orange-50 text-orange-600",
  };

  return (
    <div className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-500">
            {title}
          </p>

          {loading ? (
            <div className="mt-3 h-8 w-14 animate-pulse rounded-lg bg-slate-100" />
          ) : (
            <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
              {value ?? 0}
            </p>
          )}
        </div>

        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
            colorClasses[color] || colorClasses.indigo
          }`}
        >
          <Icon size={23} />
        </div>
      </div>

      <p className="mt-4 text-xs text-slate-400">
        {description}
      </p>
    </div>
  );
}

function AttendanceAction({
  icon: Icon,
  title,
  description,
  color,
  loading,
  disabled,
  onClick,
}) {
  const styles = {
    emerald: {
      wrapper: "border-emerald-200 bg-emerald-50 hover:bg-emerald-100",
      icon: "bg-emerald-600",
      title: "text-emerald-900",
      description: "text-emerald-700",
    },
    sky: {
      wrapper: "border-sky-200 bg-sky-50 hover:bg-sky-100",
      icon: "bg-sky-600",
      title: "text-sky-900",
      description: "text-sky-700",
    },
    indigo: {
      wrapper: "border-indigo-200 bg-indigo-50 hover:bg-indigo-100",
      icon: "bg-indigo-600",
      title: "text-indigo-900",
      description: "text-indigo-700",
    },
    amber: {
      wrapper: "border-amber-200 bg-amber-50 hover:bg-amber-100",
      icon: "bg-amber-500",
      title: "text-amber-900",
      description: "text-amber-700",
    },
  };

  const style = styles[color] || styles.indigo;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex min-h-24 items-center gap-3 rounded-xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${style.wrapper}`}
    >
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white ${style.icon}`}
      >
        <Icon size={21} />
      </div>

      <div>
        <p className={`font-bold ${style.title}`}>
          {loading ? "Please wait..." : title}
        </p>

        <p className={`mt-1 text-xs ${style.description}`}>
          {description}
        </p>
      </div>
    </button>
  );
}

// ==========================================
// LATE ARRIVAL WARNING DIALOG
// ==========================================

function LateArrivalDialog({ lateInfo, onClose }) {
  if (!lateInfo) return null;

  const exceededAllowance = Boolean(lateInfo.exceededAllowance);

  const allowedLates = Number(lateInfo.allowedLates ?? 2);
  const monthlyLateCount = Number(lateInfo.monthlyLateCount ?? 0);

  const remainingLates = Math.max(
    0,
    Number(
      lateInfo.remainingLates ??
        allowedLates - monthlyLateCount
    )
  );

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
      onMouseDown={event => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className={`w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl ${
          exceededAllowance
            ? "border-t-4 border-rose-500"
            : "border-t-4 border-amber-500"
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="late-warning-title"
      >
        <div className="p-6">
          <div
            className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${
              exceededAllowance
                ? "bg-rose-100 text-rose-600"
                : "bg-amber-100 text-amber-600"
            }`}
          >
            <AlertCircle size={32} />
          </div>

          <div className="mt-4 text-center">
            <h2
              id="late-warning-title"
              className={`text-xl font-bold ${
                exceededAllowance
                  ? "text-rose-700"
                  : "text-amber-700"
              }`}
            >
              {exceededAllowance
                ? "Monthly Late Allowance Exceeded"
                : "Late Arrival Warning"}
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              {lateInfo.warningText ||
                (exceededAllowance
                  ? "You have exceeded your monthly allowance of late arrivals. Your attendance has been flagged for HR review."
                  : "Your check-in was recorded after the permitted reporting time. Please try to arrive on time in the future.")}
            </p>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-slate-50 p-4 text-center">
              <p className="text-xs font-medium text-slate-500">
                Late arrivals this month
              </p>

              <p className="mt-1 text-2xl font-bold text-slate-900">
                {monthlyLateCount}
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 p-4 text-center">
              <p className="text-xs font-medium text-slate-500">
                Monthly allowance
              </p>

              <p className="mt-1 text-2xl font-bold text-slate-900">
                {allowedLates}
              </p>
            </div>
          </div>

          {exceededAllowance ? (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4">
              <div className="flex items-start gap-2">
                <AlertCircle
                  size={18}
                  className="mt-0.5 shrink-0 text-rose-600"
                />

                <div>
                  <p className="text-sm font-bold text-rose-800">
                    HR Review Required
                  </p>

                  <p className="mt-1 text-xs leading-5 text-rose-700">
                    Your late arrival has been flagged for HR review.
                    No automatic salary or leave deduction has been applied.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-800">
                Remaining allowance: {remainingLates}
              </p>

              <p className="mt-1 text-xs leading-5 text-amber-700">
                You can have up to {allowedLates} late arrivals per
                calendar month before the record is flagged for HR review.
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            className={`mt-6 w-full rounded-xl px-5 py-3 text-sm font-bold text-white transition ${
              exceededAllowance
                ? "bg-rose-600 hover:bg-rose-700"
                : "bg-amber-500 hover:bg-amber-600"
            }`}
          >
            I Understand
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Attendance() {
  const { user } = useAuth();

  const role = String(user?.role || "").toLowerCase();

  const admin = role === "admin";
  const manager = role === "manager";
  const employee = role === "employee";

  const teamView = admin || manager;

  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({});
  const [month, setMonth] = useState(currentMonth());

  const [filters, setFilters] = useState({
    date: "",
    status: "",
    department: "",
  });

  const [search, setSearch] = useState("");

  const [msg, setMsg] = useState({
    type: "",
    text: "",
  });

  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [actionLoading, setActionLoading] = useState("");
  const [todayRecord, setTodayRecord] = useState(null);

  // Stores late arrival information returned by the backend.
  const [lateWarning, setLateWarning] = useState(null);

  // Refresh the live attendance timer every 30 seconds.
  const [liveTime, setLiveTime] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setLiveTime(Date.now());
    }, 30000);

    return () => clearInterval(timer);
  }, []);

  // ==========================================
  // FETCH ATTENDANCE
  // ==========================================

  useEffect(() => {
    let ignore = false;

    const fetchAttendance = async () => {
      setLoading(true);

      try {
        if (teamView) {
          const params = Object.fromEntries(
            Object.entries(filters).filter(([, value]) => value)
          );

          const response = await api.get("/attendance", { params });

          if (!ignore) {
            setRows(getAttendanceItems(response.data));
            setSummary({});
            setTodayRecord(null);
          }
        } else if (employee) {
          const todayMonth = currentMonth();

          const historyRequest = api.get("/attendance/me", {
            params: { month },
          });

          const todayRequest =
            month === todayMonth
              ? historyRequest
              : api.get("/attendance/me", {
                  params: { month: todayMonth },
                });

          const [historyResponse, todayResponse] = await Promise.all([
            historyRequest,
            todayRequest,
          ]);

          if (!ignore) {
            const historyData = historyResponse.data;
            const todayData = todayResponse.data;

            const historyItems = getAttendanceItems(historyData);
            const todayItems = getAttendanceItems(todayData);

            setRows(historyItems);

            setSummary(
              historyData?.summary ||
                historyData?.data?.summary ||
                {}
            );

            const today = todayIST();

            const record = todayItems.find(
              item => getRecordDate(item) === today
            );

            setTodayRecord(record || null);
          }
        } else {
          if (!ignore) {
            setRows([]);
            setTodayRecord(null);
          }
        }

        if (!ignore) {
          setMsg({ type: "", text: "" });
        }
      } catch (error) {
        if (!ignore) {
          setMsg({
            type: "error",
            text: errMsg(error),
          });
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    fetchAttendance();

    return () => {
      ignore = true;
    };
  }, [teamView, employee, filters, month, reloadKey]);

  // ==========================================
  // ATTENDANCE ACTIONS
  // ==========================================

  const act = async path => {
    if (actionLoading) return;

    setActionLoading(path);
    setMsg({ type: "", text: "" });

    try {
      const response = await api.post(`/attendance/${path}`);

      // Capture lateInfo returned by the backend after check-in.
      if (path === "check-in") {
        const lateInfo = response.data?.lateInfo;

        if (lateInfo?.isLate) {
          setLateWarning(lateInfo);
        } else {
          setLateWarning(null);
        }
      }

      const messages = {
        "check-in": "You have successfully checked in.",
        "lunch-out": "Your lunch break has started.",
        "lunch-in": "Your lunch break has ended.",
        "check-out": "You have successfully checked out.",
      };

      setMsg({
        type: "ok",
        text: messages[path] || "Attendance updated successfully.",
      });

      setReloadKey(key => key + 1);
    } catch (error) {
      setMsg({
        type: "error",
        text: errMsg(error),
      });
    } finally {
      setActionLoading("");
    }
  };

  // ==========================================
  // FILTERS
  // ==========================================

  const updateFilter = (key, value) => {
    setFilters(previous => ({
      ...previous,
      [key]: value,
    }));
  };

  const clearFilters = () => {
    setFilters({
      date: "",
      status: "",
      department: "",
    });

    setSearch("");
  };

  // ==========================================
  // FILTERED RECORDS
  // ==========================================

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query || !teamView) return rows;

    return rows.filter(record => {
      const name = getEmployeeName(record).toLowerCase();
      const employeeId = String(getEmployeeId(record)).toLowerCase();
      const department = String(getDepartment(record)).toLowerCase();

      return (
        name.includes(query) ||
        employeeId.includes(query) ||
        department.includes(query)
      );
    });
  }, [rows, search, teamView]);

  // ==========================================
  // TEAM ATTENDANCE COUNTS
  // ==========================================

  const teamSummary = useMemo(() => {
    const counts = {};

    SUMMARY_STATUSES.forEach(status => {
      counts[status] = rows.filter(record => {
        if (status === "Late") {
          return isLateRecord(record);
        }

        if (status === "Present") {
          return (
            record.status === "Present" &&
            !isLateRecord(record)
          );
        }

        return record.status === status;
      }).length;
    });

    return counts;
  }, [rows]);

  const totalRecords = rows.length;

  const pageTitle = admin
    ? "Attendance Management"
    : manager
      ? "Team Attendance"
      : "My Attendance";

  const pageDescription = admin
    ? "Monitor, review and manage attendance across the organisation."
    : manager
      ? "Track attendance and working hours across your reporting team."
      : "Keep track of your daily attendance and monthly work record.";

  // ==========================================
  // TODAY'S ATTENDANCE STATE
  // ==========================================

  const hasCheckedIn = Boolean(todayRecord?.checkInAt);
  const hasCheckedOut = Boolean(todayRecord?.checkOutAt);
  const hasLunchStarted = Boolean(todayRecord?.lunchOutAt);
  const hasLunchEnded = Boolean(todayRecord?.lunchInAt);

  const onLunch =
    hasLunchStarted &&
    !hasLunchEnded &&
    !hasCheckedOut;

  const canCheckIn = !hasCheckedIn;

  const canTakeLunch =
    hasCheckedIn &&
    !hasCheckedOut &&
    !hasLunchStarted;

  const canReturnFromLunch =
    hasCheckedIn &&
    !hasCheckedOut &&
    onLunch;

  const canCheckOut =
    hasCheckedIn &&
    !hasCheckedOut &&
    !onLunch;

  const liveAttendance = getLiveAttendance(
    todayRecord,
    liveTime
  );

  const workingMinutes = liveAttendance.workingMinutes;
  const lunchMinutes = liveAttendance.lunchMinutes;

  const workingProgress = Math.min(
    100,
    Math.round((workingMinutes / 480) * 100)
  );

  const remainingMinutes = Math.max(
    0,
    480 - workingMinutes
  );

  const attendanceStage = !hasCheckedIn
    ? "Not Started"
    : hasCheckedOut
      ? "Completed"
      : onLunch
        ? "On Lunch Break"
        : "Working";

  const attendanceStatusText = !hasCheckedIn
    ? "You haven't checked in yet."
    : hasCheckedOut
      ? "Your attendance for today is complete."
      : onLunch
        ? "Your lunch break is in progress. Mark Lunch In when you return."
        : "Your working hours are being recorded.";

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <div className="min-h-screen space-y-6 pb-8">

      {/* PAGE HEADER */}

      <div className="flex flex-col justify-between gap-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <CalendarDays size={25} />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                {pageTitle}
              </h1>

              <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold capitalize text-indigo-700">
                {role || "User"}
              </span>
            </div>

            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
              {pageDescription}
            </p>

            <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
              <Clock3 size={14} />
              <span>All attendance times are displayed in IST</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setReloadKey(key => key + 1)}
          disabled={loading || !!actionLoading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw
            size={16}
            className={loading ? "animate-spin" : ""}
          />
          Refresh
        </button>
      </div>

      <Alert msg={msg} />

      {/* LATE ARRIVAL WARNING DIALOG */}

      <LateArrivalDialog
        lateInfo={lateWarning}
        onClose={() => setLateWarning(null)}
      />

      {/* ======================================
          EMPLOYEE ATTENDANCE DASHBOARD
      ====================================== */}

      {employee && (
        <div className="space-y-5">

          {/* TODAY'S STATUS AND LIVE WORKING HOURS */}

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

            <div className="flex flex-col justify-between gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:p-6">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-900">
                    Today's Attendance
                  </h2>

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      attendanceStage === "Completed"
                        ? "bg-slate-100 text-slate-700"
                        : attendanceStage === "On Lunch Break"
                          ? "bg-sky-50 text-sky-700"
                          : attendanceStage === "Working"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {attendanceStage}
                  </span>
                </div>

                <p className="mt-1 text-sm text-slate-500">
                  {fmtDate(todayIST())} · Indian Standard Time
                </p>
              </div>

              {hasCheckedIn && (
                <span
                  className={`inline-flex items-center gap-2 text-sm font-semibold ${
                    isLateRecord(todayRecord)
                      ? "text-rose-600"
                      : "text-emerald-600"
                  }`}
                >
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      isLateRecord(todayRecord)
                        ? "bg-rose-500"
                        : "bg-emerald-500"
                    }`}
                  />

                  {isLateRecord(todayRecord)
                    ? "Late Arrival"
                    : "On Time"}
                </span>
              )}
            </div>

            <div className="p-5 sm:p-6">

              {/* LIVE SUMMARY CARDS */}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">

                <div className="rounded-xl bg-indigo-50 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500">
                      Working Hours
                    </p>

                    <Activity size={18} className="text-indigo-500" />
                  </div>

                  <p className="mt-2 text-3xl font-bold text-indigo-900">
                    {dur(workingMinutes)}
                  </p>

                  <p className="mt-1 text-xs text-indigo-600">
                    Target: 8 hours
                  </p>
                </div>

                <div className="rounded-xl bg-sky-50 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-sky-600">
                      Lunch Duration
                    </p>

                    <Coffee size={18} className="text-sky-600" />
                  </div>

                  <p className="mt-2 text-3xl font-bold text-sky-900">
                    {dur(lunchMinutes)}
                  </p>

                  <p className="mt-1 text-xs text-sky-600">
                    Permitted duration: 1 hour
                  </p>
                </div>

                <div className="rounded-xl bg-emerald-50 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                      Remaining Work
                    </p>

                    <Hourglass size={18} className="text-emerald-600" />
                  </div>

                  <p className="mt-2 text-3xl font-bold text-emerald-900">
                    {hasCheckedOut ? "0h 0m" : dur(remainingMinutes)}
                  </p>

                  <p className="mt-1 text-xs text-emerald-600">
                    To reach 8 working hours
                  </p>
                </div>

              </div>

              {/* WORKING HOUR PROGRESS */}

              <div className="mt-6">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-700">
                    Daily working-hour progress
                  </p>

                  <p className="text-sm font-bold text-indigo-600">
                    {workingProgress}%
                  </p>
                </div>

                <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-indigo-600 transition-all duration-500"
                    style={{
                      width: `${workingProgress}%`,
                    }}
                  />
                </div>

                <div className="mt-2 flex justify-between text-xs text-slate-400">
                  <span>0 hours</span>
                  <span>4 hours - Half Day</span>
                  <span>8 hours - Full Day</span>
                </div>
              </div>

              {/* STATUS MESSAGE */}

              <div
                className={`mt-5 rounded-xl border p-4 ${
                  onLunch
                    ? "border-sky-200 bg-sky-50"
                    : hasCheckedOut
                      ? "border-slate-200 bg-slate-50"
                      : hasCheckedIn
                        ? "border-emerald-200 bg-emerald-50"
                        : "border-amber-200 bg-amber-50"
                }`}
              >
                <div className="flex items-start gap-3">
                  <Clock3
                    size={19}
                    className={
                      onLunch
                        ? "text-sky-600"
                        : hasCheckedIn
                          ? "text-emerald-600"
                          : "text-amber-600"
                    }
                  />

                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      {attendanceStatusText}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      {hasCheckedIn && !hasCheckedOut
                        ? "Your working duration updates automatically."
                        : "Use the attendance controls below to record your activity."}
                    </p>
                  </div>
                </div>
              </div>

              {todayRecord?.lunchOverLimit && (
                <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-700">
                  Your lunch break exceeded the permitted 1-hour duration.
                </div>
              )}

              {onLunch && lunchMinutes > 60 && (
                <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-700">
                  Your lunch break has exceeded one hour. Please return and mark Lunch In.
                </div>
              )}

            </div>
          </div>

          {/* ATTENDANCE ACTION BUTTONS */}

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">

            <div className="mb-5">
              <h2 className="text-base font-bold text-slate-900">
                Attendance Actions
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Record your arrival, lunch break and departure.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">

              <AttendanceAction
                icon={LogIn}
                title="Check In"
                description={
                  hasCheckedIn
                    ? "Already checked in"
                    : "Start your workday"
                }
                color="emerald"
                loading={actionLoading === "check-in"}
                disabled={
                  !canCheckIn ||
                  !!actionLoading ||
                  loading
                }
                onClick={() => act("check-in")}
              />

              <AttendanceAction
                icon={Coffee}
                title="Lunch Out"
                description={
                  hasLunchStarted
                    ? "Lunch already recorded"
                    : "Start lunch break"
                }
                color="sky"
                loading={actionLoading === "lunch-out"}
                disabled={
                  !canTakeLunch ||
                  !!actionLoading ||
                  loading
                }
                onClick={() => act("lunch-out")}
              />

              <AttendanceAction
                icon={Coffee}
                title="Lunch In"
                description={
                  hasLunchEnded
                    ? "Lunch completed"
                    : "Return from lunch"
                }
                color="indigo"
                loading={actionLoading === "lunch-in"}
                disabled={
                  !canReturnFromLunch ||
                  !!actionLoading ||
                  loading
                }
                onClick={() => act("lunch-in")}
              />

              <AttendanceAction
                icon={LogOut}
                title="Check Out"
                description={
                  hasCheckedOut
                    ? "Day completed"
                    : "End your workday"
                }
                color="amber"
                loading={actionLoading === "check-out"}
                disabled={
                  !canCheckOut ||
                  !!actionLoading ||
                  loading
                }
                onClick={() => act("check-out")}
              />

            </div>

            {hasCheckedOut && (
              <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                You have completed today's attendance. You cannot record additional attendance actions for this day.
              </p>
            )}

            {!hasCheckedIn && !loading && (
              <p className="mt-4 text-xs text-slate-400">
                Start by clicking Check In. Your working hours will begin recording after check-in.
              </p>
            )}

          </div>

          {/* TODAY'S ACTIVITY TIMELINE */}

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

            <div className="mb-4">
              <h3 className="font-bold text-slate-900">
                Today's Activity Timeline
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Your attendance activity recorded by the system.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">

              <TimeInfo
                label="Check In"
                value={fmt(todayRecord?.checkInAt)}
              />

              <TimeInfo
                label="Lunch Out"
                value={fmt(todayRecord?.lunchOutAt)}
              />

              <TimeInfo
                label="Lunch In"
                value={fmt(todayRecord?.lunchInAt)}
              />

              <TimeInfo
                label="Check Out"
                value={fmt(todayRecord?.checkOutAt)}
              />

            </div>

          </div>

        </div>
      )}

      {/* ======================================
          ADMIN / MANAGER SUMMARY
      ====================================== */}

      {teamView && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">

          <SummaryCard
            title="Total Records"
            value={totalRecords}
            description="Loaded attendance records"
            icon={Users}
            color="indigo"
            loading={loading}
          />

          <SummaryCard
            title="Present"
            value={teamSummary.Present || 0}
            description="Employees marked present"
            icon={UserCheck}
            color="emerald"
            loading={loading}
          />

          <SummaryCard
            title="Late Arrivals"
            value={teamSummary.Late || 0}
            description="Employees arriving late"
            icon={Clock3}
            color="amber"
            loading={loading}
          />

          <SummaryCard
            title="On Leave"
            value={teamSummary.Leave || 0}
            description="Employees on leave"
            icon={CalendarCheck2}
            color="blue"
            loading={loading}
          />

          <SummaryCard
            title="Absent"
            value={teamSummary.Absent || 0}
            description="Employees marked absent"
            icon={CalendarX}
            color="rose"
            loading={loading}
          />

        </div>
      )}

      {/* ======================================
          EMPLOYEE MONTHLY SUMMARY
      ====================================== */}

      {employee && (
        <>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">

              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Monthly Attendance Overview
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Review your attendance performance for the selected month.
                </p>
              </div>

              <label className="flex items-center gap-3">
                <span className="text-sm font-medium text-slate-500">
                  Select month
                </span>

                <input
                  type="month"
                  max={currentMonth()}
                  value={month}
                  onChange={event => {
                    if (event.target.value) {
                      setMonth(event.target.value);
                    }
                  }}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </label>

            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">

            {SUMMARY_STATUSES.map(status => {
              const Icon = getStatusIcon(status);

              const colors = {
                Present: "emerald",
                Late: "amber",
                "Half Day": "orange",
                Leave: "blue",
                Absent: "rose",
              };

              return (
                <SummaryCard
                  key={status}
                  title={status}
                  value={summary[status] || 0}
                  description={`${status} days this month`}
                  icon={Icon}
                  color={colors[status]}
                  loading={loading}
                />
              );
            })}

          </div>
        </>
      )}

      {/* ======================================
          TEAM FILTERS
      ====================================== */}

      {teamView && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

          <div className="flex flex-col justify-between gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center">

            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <Filter size={19} />
              </div>

              <div>
                <h2 className="font-bold text-slate-900">
                  Attendance Filters
                </h2>

                <p className="text-xs text-slate-500">
                  Narrow down records using the available filters.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 transition hover:text-indigo-800"
            >
              <X size={15} />
              Clear filters
            </button>

          </div>

          <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4">

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Search employee
              </label>

              <div className="relative">
                <Search
                  size={17}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  type="text"
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  placeholder="Name, ID or department"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Attendance date
              </label>

              <input
                type="date"
                value={filters.date}
                onChange={event =>
                  updateFilter("date", event.target.value)
                }
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Attendance status
              </label>

              <select
                value={filters.status}
                onChange={event =>
                  updateFilter("status", event.target.value)
                }
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
              >
                <option value="">All statuses</option>

                {SUMMARY_STATUSES.map(status => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Department
              </label>

              <div className="relative">
                <Building2
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  type="text"
                  value={filters.department}
                  onChange={event =>
                    updateFilter("department", event.target.value)
                  }
                  placeholder="e.g. Engineering"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                />
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ======================================
          ATTENDANCE HISTORY
      ====================================== */}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

        <div className="flex flex-col justify-between gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center">

          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {teamView
                ? "Employee Attendance Records"
                : "Attendance History"}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {teamView
                ? "Detailed attendance information for your organisation or team."
                : "Your check-in, check-out and working hour history."}
            </p>
          </div>

          <div className="flex items-center gap-2 self-start rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 sm:self-auto">
            <ClipboardCheck size={14} />
            {loading
              ? "Loading..."
              : `${filteredRows.length} records`}
          </div>

        </div>

        {loading ? (
          <div className="space-y-4 p-5">

            {[1, 2, 3, 4, 5].map(item => (
              <div
                key={item}
                className="flex animate-pulse items-center gap-4"
              >
                <div className="h-10 w-10 rounded-full bg-slate-100" />

                <div className="flex-1 space-y-2">
                  <div className="h-3 w-1/4 rounded bg-slate-100" />
                  <div className="h-3 w-1/3 rounded bg-slate-100" />
                </div>

                <div className="h-7 w-20 rounded-full bg-slate-100" />
              </div>
            ))}

          </div>
        ) : filteredRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-5 py-16 text-center">

            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <CalendarX size={30} />
            </div>

            <h3 className="mt-5 text-base font-bold text-slate-800">
              No attendance records found
            </h3>

            <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
              {teamView
                ? "There are no records matching your current filters. Try changing or clearing the filters."
                : "Your attendance records for this month will appear here once available."}
            </p>

            {teamView && (
              <button
                type="button"
                onClick={clearFilters}
                className="mt-4 rounded-xl bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100"
              >
                Clear all filters
              </button>
            )}

          </div>
        ) : (
          <>

            {/* DESKTOP TABLE */}

            <div className="hidden overflow-x-auto md:block">

              <table className="w-full min-w-[950px] text-left text-sm">

                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80">

                    {teamView && (
                      <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                        Employee
                      </th>
                    )}

                    <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                      Date
                    </th>

                    <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                      Check In
                    </th>

                    <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                      Lunch
                    </th>

                    <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                      Check Out
                    </th>

                    <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                      Working Hours
                    </th>

                    <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                      Status
                    </th>

                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">

                  {filteredRows.map(record => {
                    const name = getEmployeeName(record);
                    const employeeId = getEmployeeId(record);
                    const department = getDepartment(record);
                    const late = isLateRecord(record);

                    return (
                      <tr
                        key={record._id}
                        className="transition hover:bg-slate-50/80"
                      >

                        {teamView && (
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">

                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-sm font-bold text-indigo-700">
                                {getInitials(name)}
                              </div>

                              <div className="min-w-0">
                                <p className="font-semibold text-slate-800">
                                  {name}
                                </p>

                                <p className="mt-0.5 text-xs text-slate-400">
                                  {employeeId
                                    ? `ID: ${employeeId}`
                                    : department || "Employee"}
                                </p>
                              </div>

                            </div>
                          </td>
                        )}

                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2 font-medium text-slate-700">
                            <CalendarDays
                              size={15}
                              className="text-slate-400"
                            />

                            {fmtDate(record.date)}
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <div
                            className={`flex items-center gap-2 font-semibold ${
                              late
                                ? "text-rose-600"
                                : "text-emerald-700"
                            }`}
                          >
                            <LogIn size={15} />

                            {fmt(record.checkInAt)}

                            {record.checkInAt && (
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                  late
                                    ? "bg-rose-50 text-rose-700"
                                    : "bg-emerald-50 text-emerald-700"
                                }`}
                              >
                                {late ? "Late" : "On Time"}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          {record.lunchOutAt ? (
                            <div className="text-xs font-medium text-slate-600">
                              <p>Out: {fmt(record.lunchOutAt)}</p>

                              <p className="mt-1">
                                In: {fmt(record.lunchInAt)}
                              </p>

                              {record.lunchMinutes != null && (
                                <p className="mt-1 text-slate-400">
                                  {dur(record.lunchMinutes)}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>

                        <td className="px-5 py-4">
                          {record.checkOutAt ? (
                            <div className="flex items-center gap-2 font-semibold text-amber-700">
                              <LogOut size={15} />
                              {fmt(record.checkOutAt)}
                            </div>
                          ) : record.checkInAt ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                              <AlertCircle size={13} />
                              Pending
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2 font-semibold text-slate-700">
                            <Timer
                              size={15}
                              className="text-slate-400"
                            />

                            {dur(
                              record.workingMinutes ?? record.totalMinutes
                            )}
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <StatusBadge value={record.status} />
                        </td>

                      </tr>
                    );
                  })}

                </tbody>
              </table>

            </div>

            {/* MOBILE ATTENDANCE CARDS */}

            <div className="grid gap-3 p-4 md:hidden">

              {filteredRows.map(record => {
                const name = getEmployeeName(record);
                const employeeId = getEmployeeId(record);
                const department = getDepartment(record);
                const late = isLateRecord(record);

                return (
                  <div
                    key={record._id}
                    className="rounded-xl border border-slate-200 bg-white p-4"
                  >

                    {teamView && (
                      <div className="mb-4 flex items-center gap-3">

                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-sm font-bold text-indigo-700">
                          {getInitials(name)}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate font-bold text-slate-800">
                            {name}
                          </p>

                          <p className="mt-0.5 text-xs text-slate-400">
                            {employeeId
                              ? `ID: ${employeeId}`
                              : department || "Employee"}
                          </p>
                        </div>

                        <StatusBadge value={record.status} />

                      </div>
                    )}

                    <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">

                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                        <CalendarDays
                          size={16}
                          className="text-indigo-500"
                        />

                        {fmtDate(record.date)}
                      </div>

                      {!teamView && (
                        <StatusBadge value={record.status} />
                      )}

                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-4">

                      <div>
                        <p className="text-xs font-medium text-slate-400">
                          Check In
                        </p>

                        <p
                          className={`mt-1 flex items-center gap-1.5 text-sm font-semibold ${
                            late
                              ? "text-rose-600"
                              : "text-emerald-700"
                          }`}
                        >
                          <LogIn size={14} />
                          {fmt(record.checkInAt)}
                        </p>

                        {record.checkInAt && (
                          <p
                            className={`mt-1 text-[11px] font-semibold ${
                              late
                                ? "text-rose-600"
                                : "text-emerald-600"
                            }`}
                          >
                            {late ? "Late Arrival" : "On Time"}
                          </p>
                        )}
                      </div>

                      <div>
                        <p className="text-xs font-medium text-slate-400">
                          Check Out
                        </p>

                        <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-amber-700">
                          <LogOut size={14} />

                          {record.checkOutAt
                            ? fmt(record.checkOutAt)
                            : record.checkInAt
                              ? "Pending"
                              : "-"}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-medium text-slate-400">
                          Lunch Out
                        </p>

                        <p className="mt-1 text-sm font-semibold text-slate-700">
                          {fmt(record.lunchOutAt)}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-medium text-slate-400">
                          Lunch In
                        </p>

                        <p className="mt-1 text-sm font-semibold text-slate-700">
                          {fmt(record.lunchInAt)}
                        </p>
                      </div>

                      <div className="col-span-2 border-t border-slate-100 pt-3">

                        <p className="text-xs font-medium text-slate-400">
                          Total Working Hours
                        </p>

                        <p className="mt-1 flex items-center gap-2 text-sm font-bold text-slate-800">
                          <Timer
                            size={15}
                            className="text-indigo-500"
                          />

                          {dur(
                            record.workingMinutes ?? record.totalMinutes
                          )}
                        </p>

                        {record.lunchMinutes != null && (
                          <p className="mt-1 text-xs text-slate-400">
                            Lunch duration: {dur(record.lunchMinutes)}
                          </p>
                        )}

                      </div>

                    </div>

                  </div>
                );
              })}

            </div>

          </>
        )}

        {/* TABLE FOOTER */}

        {!loading && filteredRows.length > 0 && (
          <div className="flex flex-col justify-between gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3 text-xs text-slate-500 sm:flex-row sm:items-center">

            <span>
              Showing {filteredRows.length} of {rows.length} attendance records
            </span>

            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-emerald-500" />
              Attendance data loaded successfully
            </span>

          </div>
        )}

      </div>

      {/* FOOTER INFORMATION */}

      <div className="flex items-start gap-3 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">

        <div className="mt-0.5 text-indigo-600">
          <AlertCircle size={18} />
        </div>

        <div>
          <p className="text-sm font-semibold text-indigo-900">
            Attendance Information
          </p>

          <p className="mt-1 text-xs leading-5 text-indigo-700">
            Attendance records are displayed according to your account
            permissions. Check-in, lunch and check-out actions are recorded
            using Indian Standard Time (IST). Working hours exclude recorded
            lunch duration. Late arrival is calculated separately from
            working-hour completion.
          </p>
        </div>

      </div>

    </div>
  );
}
