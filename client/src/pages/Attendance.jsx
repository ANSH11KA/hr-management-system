
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
  BriefcaseBusiness,
  CheckCircle2,
  AlertCircle,
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
  }).format(new Date()).slice(0, 7);

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

  const value = String(date).slice(0, 10);
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
  const remainingMinutes = value % 60;

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

export default function Attendance() {
  const { user } = useAuth();

  const admin = user?.role === "admin";
  const manager = user?.role === "manager";
  const employee = user?.role === "employee";

  const teamView = admin || manager;

  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({});

  const [month, setMonth] = useState(currentMonth);

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

  // Fetch attendance records according to the logged-in role.
  useEffect(() => {
    let ignore = false;

    const fetchAttendance = async () => {
      setLoading(true);

      try {
        let response;

        if (teamView) {
          const params = Object.fromEntries(
            Object.entries(filters).filter(([, value]) => value)
          );

          response = await api.get("/attendance", { params });

          if (!ignore) {
            const data = response.data;

            setRows(
              Array.isArray(data)
                ? data
                : Array.isArray(data?.items)
                  ? data.items
                  : []
            );

            setSummary({});
          }
        } else {
          response = await api.get("/attendance/me", {
            params: { month },
          });

          if (!ignore) {
            const data = response.data;

            setRows(
              Array.isArray(data?.items)
                ? data.items
                : Array.isArray(data)
                  ? data
                  : []
            );

            setSummary(data?.summary || {});
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
  }, [teamView, filters, month, reloadKey]);

  // Check-in and check-out actions.
  const act = async path => {
    setActionLoading(path);
    setMsg({ type: "", text: "" });

    try {
      await api.post(`/attendance/${path}`);

      setMsg({
        type: "ok",
        text:
          path === "check-in"
            ? "You have successfully checked in."
            : "You have successfully checked out.",
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

  // Client-side search for team records.
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

  // Calculate status counts for the currently loaded team records.
  const teamSummary = useMemo(() => {
    const counts = {};

    SUMMARY_STATUSES.forEach(status => {
      counts[status] = rows.filter(
        record => record.status === status
      ).length;
    });

    return counts;
  }, [rows]);

  const totalRecords = teamView ? rows.length : rows.length;

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
                {user?.role || "User"}
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

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setReloadKey(key => key + 1)}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw
              size={16}
              className={loading ? "animate-spin" : ""}
            />
            Refresh
          </button>

          {!admin && (
            <>
              <button
                type="button"
                onClick={() => act("check-in")}
                disabled={!!actionLoading || loading}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <LogIn size={17} />
                {actionLoading === "check-in"
                  ? "Checking in..."
                  : "Check In"}
              </button>

              <button
                type="button"
                onClick={() => act("check-out")}
                disabled={!!actionLoading || loading}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <LogOut size={17} />
                {actionLoading === "check-out"
                  ? "Checking out..."
                  : "Check Out"}
              </button>
            </>
          )}
        </div>
      </div>

      <Alert msg={msg} />

      {/* ADMIN / MANAGER SUMMARY */}
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

      {/* EMPLOYEE MONTHLY SUMMARY */}
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

      {/* TEAM FILTERS */}
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

      {/* ATTENDANCE RECORDS */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {teamView ? "Employee Attendance Records" : "Attendance History"}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {teamView
                ? "Detailed attendance information for your organisation or team."
                : "Your check-in, check-out and working hour history."}
            </p>
          </div>

          <div className="flex items-center gap-2 self-start rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 sm:self-auto">
            <ClipboardCheck size={14} />
            {loading ? "Loading..." : `${filteredRows.length} records`}
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
              <table className="w-full min-w-[850px] text-left text-sm">
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
                          <div className="flex items-center gap-2 font-semibold text-emerald-700">
                            <LogIn size={15} />
                            {fmt(record.checkInAt)}
                          </div>
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
                            {dur(record.totalMinutes)}
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

            {/* MOBILE CARDS */}
            <div className="grid gap-3 p-4 md:hidden">
              {filteredRows.map(record => {
                const name = getEmployeeName(record);
                const employeeId = getEmployeeId(record);
                const department = getDepartment(record);

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
                        <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
                          <LogIn size={14} />
                          {fmt(record.checkInAt)}
                        </p>
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

                      <div className="col-span-2 border-t border-slate-100 pt-3">
                        <p className="text-xs font-medium text-slate-400">
                          Total Working Hours
                        </p>
                        <p className="mt-1 flex items-center gap-2 text-sm font-bold text-slate-800">
                          <Timer
                            size={15}
                            className="text-indigo-500"
                          />
                          {dur(record.totalMinutes)}
                        </p>
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

      {/* FOOTER NOTE */}
      <div className="flex items-start gap-3 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
        <div className="mt-0.5 text-indigo-600">
          <AlertCircle size={18} />
        </div>

        <div>
          <p className="text-sm font-semibold text-indigo-900">
            Attendance information
          </p>
          <p className="mt-1 text-xs leading-5 text-indigo-700">
            Attendance records are displayed according to your account
            permissions. Check-in and check-out actions are recorded by the
            attendance system using Indian Standard Time (IST).
          </p>
        </div>
      </div>
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
