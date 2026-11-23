
import { useEffect, useMemo, useState } from "react";
import {
  Send,
  Check,
  X,
  Ban,
  ClipboardList,
  Clock,
  CheckCircle2,
  XCircle,
  CalendarDays,
  Search,
  RefreshCw,
  Filter,
  FileText,
  UserRound,
  CalendarCheck,
  CalendarClock,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  BriefcaseBusiness,
  Hourglass,
  Wallet,
} from "lucide-react";

import api, { errMsg } from "../api";
import { useAuth } from "../hooks/useAuth";
import StatusBadge from "../components/StatusBadge";
import Alert from "../components/Alert";

const emptyForm = {
  leaveType: "Casual",
  startDate: "",
  endDate: "",
  dayType: "FullDay",
  halfDaySession: "",
  reason: "",
};

const TABS = ["All", "Pending", "Approved", "Rejected", "Cancelled"];

const leaveTypes = ["Casual", "Sick", "Earned", "Unpaid"];

const formatDate = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
};

// Calculate calendar days for legacy requests and preview only.
// The backend's requestedDays is authoritative because it excludes Sundays and holidays.
const calculateDays = (start, end) => {
  if (!start || !end) return 0;

  const startDate = new Date(`${String(start).slice(0, 10)}T00:00:00Z`);
  const endDate = new Date(`${String(end).slice(0, 10)}T00:00:00Z`);

  if (
    Number.isNaN(startDate.getTime()) ||
    Number.isNaN(endDate.getTime()) ||
    endDate < startDate
  ) {
    return 0;
  }

  return (
    Math.round(
      (endDate.getTime() - startDate.getTime()) / 86400000
    ) + 1
  );
};

const getRequestedDays = (row) => {
  if (typeof row.requestedDays === "number") {
    return row.requestedDays;
  }

  if (row.dayType === "HalfDay") {
    return 0.5;
  }

  return calculateDays(row.startDate, row.endDate);
};

const getEmployeeName = (row) =>
  row.employee?.personal
    ? [
        row.employee.personal.firstName,
        row.employee.personal.middleName,
        row.employee.personal.lastName,
      ]
        .filter(Boolean)
        .join(" ") ||
      row.employee?.user?.name ||
      row.employee?.name ||
      "Employee"
    : row.employee?.user?.name ||
      row.employee?.name ||
      "Employee";

const getEmployeeId = (row) =>
  row.employee?.employeeId ||
  row.employee?.empId ||
  "";

const getDepartment = (row) =>
  row.employee?.department ||
  row.employee?.employment?.department ||
  "Department not assigned";

const getInitials = (name) =>
  String(name || "Employee")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");

const getStatus = (status) =>
  String(status || "Pending").toLowerCase();

const SummaryCard = ({
  label,
  value,
  subtitle,
  icon: Icon,
  tone,
}) => {
  const styles = {
    indigo: "bg-indigo-50 text-indigo-600 ring-indigo-100",
    amber: "bg-amber-50 text-amber-600 ring-amber-100",
    emerald: "bg-emerald-50 text-emerald-600 ring-emerald-100",
    rose: "bg-rose-50 text-rose-600 ring-rose-100",
    blue: "bg-blue-50 text-blue-600 ring-blue-100",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">
            {label}
          </p>

          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {value}
          </p>

          <p className="mt-1 text-xs text-slate-400">
            {subtitle}
          </p>
        </div>

        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ${styles[tone]}`}
        >
          <Icon size={21} />
        </span>
      </div>
    </div>
  );
};

const EmptyState = ({ title, description }) => (
  <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-14 text-center">
    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
      <CalendarDays size={25} />
    </div>

    <h3 className="mt-4 font-semibold text-slate-800">
      {title}
    </h3>

    <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-slate-500">
      {description}
    </p>
  </div>
);

const DetailItem = ({ label, value, icon: Icon }) => (
  <div className="min-w-0">
    <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
      {Icon && <Icon size={13} />}
      {label}
    </p>

    <p className="mt-1 break-words text-sm font-medium leading-6 text-slate-700">
      {value || "—"}
    </p>
  </div>
);

// Displays paid and unpaid allocation after approval.
const AllocationDetails = ({ row }) => {
  if (
    row.status !== "Approved" ||
    row.allocationStatus !== "Allocated"
  ) {
    return null;
  }

  const paidDays = Number(row.paidDays || 0);
  const unpaidDays = Number(row.unpaidDays || 0);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
          <Wallet size={16} />
        </span>

        <div>
          <p className="text-sm font-bold text-slate-800">
            Leave allocation
          </p>
          <p className="text-xs text-slate-400">
            Final allocation after HR approval
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-emerald-50 p-3">
          <p className="text-xs font-semibold text-emerald-700">
            Paid from earned leave
          </p>

          <p className="mt-1 text-xl font-bold text-emerald-800">
            {paidDays} {paidDays === 1 ? "day" : "days"}
          </p>
        </div>

        <div className="rounded-xl bg-orange-50 p-3">
          <p className="text-xs font-semibold text-orange-700">
            Unpaid leave
          </p>

          <p className="mt-1 text-xl font-bold text-orange-800">
            {unpaidDays} {unpaidDays === 1 ? "day" : "days"}
          </p>
        </div>
      </div>
    </div>
  );
};

export default function Leaves() {
  const { user } = useAuth();

  const admin = user?.role === "admin";
  const manager = user?.role === "manager";
  const reviewer = admin || manager;

  const [rows, setRows] = useState([]);

  const [status, setStatus] = useState("");
  const [tab, setTab] = useState("All");
  const [search, setSearch] = useState("");

  const [form, setForm] = useState(emptyForm);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const [msg, setMsg] = useState({
    type: "",
    text: "",
  });

  const [reloadKey, setReloadKey] = useState(0);
  const [expandedRows, setExpandedRows] = useState({});

  // Fetch leave requests according to the logged-in role.
  useEffect(() => {
    let ignore = false;

    setLoading(true);

    const request = reviewer
      ? api.get("/leaves", {
          params: status ? { status } : {},
        })
      : api.get("/leaves/me");

    request
      .then((response) => {
        if (!ignore) {
          setRows(
            Array.isArray(response.data) ? response.data : []
          );
        }
      })
      .catch((error) => {
        if (!ignore) {
          setMsg({
            type: "error",
            text: errMsg(error),
          });
        }
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [reviewer, status, reloadKey]);

  // Summary calculations.
  const stats = useMemo(() => {
    const count = (value) =>
      rows.filter(
        (row) => getStatus(row.status) === value.toLowerCase()
      ).length;

    return {
      total: rows.length,
      pending: count("Pending"),
      approved: count("Approved"),
      rejected: count("Rejected"),
      cancelled: count("Cancelled"),
    };
  }, [rows]);

  // Client-side search and employee status tabs.
  const visibleRows = useMemo(() => {
    let result = rows;

    if (!reviewer && tab !== "All") {
      result = result.filter(
        (row) => getStatus(row.status) === tab.toLowerCase()
      );
    }

    const query = search.trim().toLowerCase();

    if (query) {
      result = result.filter((row) => {
        const employeeName = getEmployeeName(row).toLowerCase();
        const department = getDepartment(row).toLowerCase();
        const employeeId = getEmployeeId(row).toLowerCase();

        const searchable = [
          row.leaveType,
          row.reason,
          row.status,
          row.reviewNote,
          employeeName,
          department,
          employeeId,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchable.includes(query);
      });
    }

    return result;
  }, [rows, reviewer, tab, search]);

  const count = (value) =>
    rows.filter(
      (row) => getStatus(row.status) === value.toLowerCase()
    ).length;

  // Keep half-day end date equal to start date.
  const updateForm = (field, value) => {
    setForm((previous) => {
      const updated = {
        ...previous,
        [field]: value,
      };

      if (field === "dayType") {
        if (value === "HalfDay") {
          updated.endDate = updated.startDate;
        } else {
          updated.halfDaySession = "";
        }
      }

      if (
        field === "startDate" &&
        previous.dayType === "HalfDay"
      ) {
        updated.endDate = value;
      }

      if (
        field === "startDate" &&
        previous.dayType === "FullDay" &&
        previous.endDate &&
        value > previous.endDate
      ) {
        updated.endDate = "";
      }

      return updated;
    });
  };

  // Submit employee leave request.
  const apply = async (event) => {
    event.preventDefault();

    setMsg({
      type: "",
      text: "",
    });

    if (!form.startDate || !form.endDate) {
      setMsg({
        type: "error",
        text: "Please select the leave date or date range.",
      });
      return;
    }

    if (form.endDate < form.startDate) {
      setMsg({
        type: "error",
        text: "End date cannot be earlier than start date.",
      });
      return;
    }

    if (!form.reason.trim()) {
      setMsg({
        type: "error",
        text: "Please enter a reason for your leave.",
      });
      return;
    }

    if (
      form.dayType === "HalfDay" &&
      !form.halfDaySession
    ) {
      setMsg({
        type: "error",
        text: "Please select First Half or Second Half.",
      });
      return;
    }

    if (
      form.dayType === "HalfDay" &&
      form.startDate !== form.endDate
    ) {
      setMsg({
        type: "error",
        text: "Half-day leave must be requested for a single date.",
      });
      return;
    }

    setSubmitting(true);

    try {
      await api.post("/leaves", {
        leaveType: form.leaveType,
        startDate: form.startDate,
        endDate: form.endDate,
        dayType: form.dayType,
        halfDaySession:
          form.dayType === "HalfDay"
            ? form.halfDaySession
            : null,
        reason: form.reason.trim(),
      });

      setMsg({
        type: "ok",
        text: "Leave request submitted successfully. It is pending review.",
      });

      setForm(emptyForm);
      setTab("All");
      setReloadKey((key) => key + 1);
    } catch (error) {
      setMsg({
        type: "error",
        text: errMsg(error),
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Admin decision: approve or reject.
  const decide = async (id, action) => {
    if (!admin || busyId) return;

    const actionLabel =
      action === "approve" ? "approval" : "rejection";

    const note = window.prompt(
      `Add a note for this ${actionLabel} (optional):`
    );

    if (note === null) return;

    setBusyId(id);
    setMsg({
      type: "",
      text: "",
    });

    try {
      await api.patch(`/leaves/${id}/${action}`, {
        reviewNote: note.trim(),
      });

      setMsg({
        type: "ok",
        text:
          action === "approve"
            ? "Leave request approved and allocation processed successfully."
            : "Leave request rejected successfully.",
      });

      setReloadKey((key) => key + 1);
    } catch (error) {
      setMsg({
        type: "error",
        text: errMsg(error),
      });
    } finally {
      setBusyId(null);
    }
  };

  // Employee cancellation.
  const cancel = async (id) => {
    if (busyId) return;

    const confirmed = window.confirm(
      "Are you sure you want to cancel this leave request?"
    );

    if (!confirmed) return;

    setBusyId(id);
    setMsg({
      type: "",
      text: "",
    });

    try {
      await api.patch(`/leaves/${id}/cancel`);

      setMsg({
        type: "ok",
        text: "Leave request cancelled successfully.",
      });

      setReloadKey((key) => key + 1);
    } catch (error) {
      setMsg({
        type: "error",
        text: errMsg(error),
      });
    } finally {
      setBusyId(null);
    }
  };

  const toggleRow = (id) => {
    setExpandedRows((previous) => ({
      ...previous,
      [id]: !previous[id],
    }));
  };

  const refresh = () => {
    setMsg({
      type: "",
      text: "",
    });

    setReloadKey((key) => key + 1);
  };

  const clearSearch = () => {
    setSearch("");
    setTab("All");

    if (reviewer) {
      setStatus("");
    }
  };

  const heading = admin
    ? "Leave Management"
    : manager
      ? "Team Leave Requests"
      : "My Leave Requests";

  const description = admin
    ? "Manage employee leave applications and monitor leave decisions across the organization."
    : manager
      ? "Monitor leave requests submitted by employees in your reporting hierarchy."
      : "Apply for leave, review your application history and track request status.";

  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Kolkata",
  });

  return (
    <div className="min-h-full space-y-6 pb-8">
      {/* Page header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
              <CalendarCheck size={19} />
            </span>

            <span className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-600">
              {reviewer ? "HR Management" : "Employee Workspace"}
            </span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {heading}
          </h1>

          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
            {description}
          </p>
        </div>

        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="inline-flex w-fit items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw
            size={16}
            className={loading ? "animate-spin" : ""}
          />
          Refresh
        </button>
      </div>

      <Alert msg={msg} />

      {/* HR / Manager summary */}
      {reviewer && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              label="Total requests"
              value={stats.total}
              subtitle="Requests in current results"
              icon={ClipboardList}
              tone="indigo"
            />

            <SummaryCard
              label="Pending requests"
              value={stats.pending}
              subtitle="Waiting for HR decision"
              icon={Hourglass}
              tone="amber"
            />

            <SummaryCard
              label="Approved requests"
              value={stats.approved}
              subtitle="Successfully approved"
              icon={CheckCircle2}
              tone="emerald"
            />

            <SummaryCard
              label="Rejected requests"
              value={stats.rejected}
              subtitle="Requests not approved"
              icon={XCircle}
              tone="rose"
            />
          </div>

          {stats.pending > 0 && admin && (
            <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                  <AlertCircle size={20} />
                </span>

                <div>
                  <p className="font-semibold text-amber-900">
                    Pending leave decisions
                  </p>

                  <p className="mt-0.5 text-sm text-amber-800">
                    There {stats.pending === 1 ? "is" : "are"}{" "}
                    {stats.pending} request(s) awaiting your review.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setStatus("Pending")}
                className="w-fit rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs font-semibold text-amber-800 transition hover:bg-amber-100"
              >
                View pending requests
              </button>
            </div>
          )}
        </>
      )}

      {/* Employee dashboard */}
      {!reviewer && (
        <>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <SummaryCard
              label="Total requests"
              value={stats.total}
              subtitle="All your applications"
              icon={ClipboardList}
              tone="indigo"
            />

            <SummaryCard
              label="Pending"
              value={stats.pending}
              subtitle="Awaiting decision"
              icon={Clock}
              tone="amber"
            />

            <SummaryCard
              label="Approved"
              value={stats.approved}
              subtitle="Leave approved"
              icon={CheckCircle2}
              tone="emerald"
            />

            <SummaryCard
              label="Rejected"
              value={stats.rejected}
              subtitle="Not approved"
              icon={XCircle}
              tone="rose"
            />
          </div>

          {/* Earned leave policy */}
          <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-indigo-600">
                <Wallet size={20} />
              </span>

              <div>
                <h3 className="font-bold text-indigo-900">
                  Earned Leave Policy
                </h3>

                <p className="mt-1 text-sm leading-6 text-indigo-800">
                  Employees receive 1 earned leave day per month.
                  Unused earned leave carries forward without a
                  balance cap. If approved leave exceeds the available
                  earned leave balance, the remaining days are unpaid.
                </p>

                <p className="mt-2 text-xs text-indigo-700">
                  Your live leave balance will be displayed here after
                  the leave-balance API is connected.
                </p>
              </div>
            </div>
          </div>

          {/* Apply leave form */}
          <form
            onSubmit={apply}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
          >
            <div className="border-b border-slate-100 bg-gradient-to-r from-indigo-50 via-white to-white px-5 py-5 sm:px-6">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
                  <CalendarCheck size={19} />
                </span>

                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Apply for leave
                  </h2>

                  <p className="mt-0.5 text-sm text-slate-500">
                    Submit your leave application for review.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-5 p-5 sm:grid-cols-2 lg:grid-cols-3 sm:p-6">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Leave type{" "}
                  <span className="text-rose-500">*</span>
                </label>

                <select
                  required
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
                  value={form.leaveType}
                  onChange={(event) =>
                    updateForm("leaveType", event.target.value)
                  }
                >
                  {leaveTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Leave duration{" "}
                  <span className="text-rose-500">*</span>
                </label>

                <select
                  required
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
                  value={form.dayType}
                  onChange={(event) =>
                    updateForm("dayType", event.target.value)
                  }
                >
                  <option value="FullDay">Full Day</option>
                  <option value="HalfDay">Half Day</option>
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Start date{" "}
                  <span className="text-rose-500">*</span>
                </label>

                <input
                  type="date"
                  required
                  min={today}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
                  value={form.startDate}
                  onChange={(event) =>
                    updateForm("startDate", event.target.value)
                  }
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  End date{" "}
                  <span className="text-rose-500">*</span>
                </label>

                <input
                  type="date"
                  required
                  min={form.startDate || today}
                  disabled={form.dayType === "HalfDay"}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 disabled:cursor-not-allowed disabled:bg-slate-100"
                  value={form.endDate}
                  onChange={(event) =>
                    updateForm("endDate", event.target.value)
                  }
                />

                {form.dayType === "HalfDay" && (
                  <p className="mt-1 text-xs text-slate-400">
                    Half-day leave is for one date only.
                  </p>
                )}
              </div>

              {form.dayType === "HalfDay" && (
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                    Half-day session{" "}
                    <span className="text-rose-500">*</span>
                  </label>

                  <select
                    required
                    value={form.halfDaySession}
                    onChange={(event) =>
                      updateForm(
                        "halfDaySession",
                        event.target.value
                      )
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
                  >
                    <option value="">Select session</option>
                    <option value="FirstHalf">First Half</option>
                    <option value="SecondHalf">Second Half</option>
                  </select>
                </div>
              )}

              {form.startDate &&
                form.endDate &&
                form.dayType === "FullDay" && (
                  <div className="flex items-center rounded-xl border border-indigo-100 bg-indigo-50 p-3">
                    <div>
                      <p className="text-xs font-semibold text-indigo-600">
                        Calendar date range
                      </p>

                      <p className="mt-1 text-sm font-bold text-indigo-900">
                        {calculateDays(
                          form.startDate,
                          form.endDate
                        )}{" "}
                        calendar day(s)
                      </p>
                    </div>
                  </div>
                )}

              {form.dayType === "HalfDay" && (
                <div className="flex items-center rounded-xl border border-purple-100 bg-purple-50 p-3">
                  <div>
                    <p className="text-xs font-semibold text-purple-700">
                      Requested duration
                    </p>

                    <p className="mt-1 text-sm font-bold text-purple-900">
                      0.5 day
                    </p>
                  </div>
                </div>
              )}

              <div className="sm:col-span-2 lg:col-span-3">
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Reason for leave{" "}
                  <span className="text-rose-500">*</span>
                </label>

                <textarea
                  required
                  maxLength={500}
                  rows={4}
                  className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm leading-6 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
                  placeholder="Explain why you need leave..."
                  value={form.reason}
                  onChange={(event) =>
                    updateForm("reason", event.target.value)
                  }
                />

                <p className="mt-1 text-right text-xs text-slate-400">
                  {form.reason.length}/500 characters
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 sm:col-span-2 lg:col-span-3">
                <p className="text-xs text-slate-400">
                  Your application will be sent for HR review.
                </p>

                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? (
                    <RefreshCw
                      size={16}
                      className="animate-spin"
                    />
                  ) : (
                    <Send size={16} />
                  )}

                  {submitting ? "Submitting..." : "Submit request"}
                </button>
              </div>
            </div>
          </form>
        </>
      )}

      {/* Filters */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
              <Filter size={17} />
            </span>

            <div>
              <h2 className="font-bold text-slate-900">
                {reviewer
                  ? "Manage leave requests"
                  : "Leave history"}
              </h2>

              <p className="text-xs text-slate-400">
                Search and filter leave applications.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={clearSearch}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
          >
            <X size={14} />
            Clear filters
          </button>
        </div>

        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-500">
              Search requests
            </label>

            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                type="search"
                placeholder={
                  reviewer
                    ? "Employee, department, reason..."
                    : "Search leave type or reason..."
                }
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
              />
            </div>
          </div>

          {reviewer && (
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-500">
                Request status
              </label>

              <select
                aria-label="Filter by status"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value)
                }
              >
                <option value="">All requests</option>

                {TABS.filter((value) => value !== "All").map(
                  (value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  )
                )}
              </select>
            </div>
          )}
        </div>
      </section>

      {/* Employee status tabs */}
      {!reviewer && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {TABS.map((value) => {
            const active = tab === value;

            return (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value)}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  active
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {value}

                <span
                  className={`ml-2 text-xs ${
                    active ? "text-indigo-100" : "text-slate-400"
                  }`}
                >
                  {value === "All" ? rows.length : count(value)}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Results heading */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            {reviewer
              ? "Leave applications"
              : "Your leave applications"}
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            {reviewer
              ? "Review employee leave details and available actions."
              : "Track the status and decision details of your requests."}
          </p>
        </div>

        {!loading && (
          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
            {visibleRows.length} request(s)
          </span>
        )}
      </div>

      {/* Leave request cards */}
      <div className="space-y-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5"
            >
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-slate-100" />

                <div className="flex-1 space-y-2">
                  <div className="h-4 w-36 rounded bg-slate-100" />
                  <div className="h-3 w-24 rounded bg-slate-100" />
                </div>

                <div className="h-7 w-24 rounded-full bg-slate-100" />
              </div>

              <div className="mt-5 h-20 rounded-xl bg-slate-50" />
            </div>
          ))
        ) : visibleRows.length === 0 ? (
          <EmptyState
            title={
              rows.length === 0
                ? "No leave requests found"
                : "No matching requests"
            }
            description={
              rows.length === 0
                ? reviewer
                  ? "There are no leave applications available for the selected status."
                  : "You have not submitted any leave applications yet."
                : "Try another search term or clear the selected filters."
            }
          />
        ) : (
          visibleRows.map((row) => {
            const employeeName = getEmployeeName(row);
            const department = getDepartment(row);
            const employeeId = getEmployeeId(row);
            const leaveDays = getRequestedDays(row);

            const expanded =
              expandedRows[row._id] ?? true;

            const isPending =
              getStatus(row.status) === "pending";

            const isBusy = busyId === row._id;

            return (
              <article
                key={row._id}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
              >
                {/* Request header */}
                <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    {reviewer ? (
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-100 to-violet-100 text-sm font-bold text-indigo-700">
                        {getInitials(employeeName)}
                      </div>
                    ) : (
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                        <CalendarDays size={21} />
                      </div>
                    )}

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold text-slate-900">
                          {reviewer
                            ? employeeName
                            : `${row.leaveType} Leave`}
                        </h3>

                        <StatusBadge value={row.status || "Pending"} />

                        {row.dayType === "HalfDay" && (
                          <span className="rounded-full bg-purple-100 px-2.5 py-1 text-xs font-semibold text-purple-700">
                            Half Day
                          </span>
                        )}
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                        {reviewer && (
                          <>
                            <span className="inline-flex items-center gap-1">
                              <BriefcaseBusiness size={12} />
                              {department}
                            </span>

                            {employeeId && (
                              <span className="inline-flex items-center gap-1">
                                <UserRound size={12} />
                                {employeeId}
                              </span>
                            )}
                          </>
                        )}

                        <span className="inline-flex items-center gap-1">
                          <CalendarDays size={12} />
                          {formatDate(row.startDate)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                    <span className="rounded-lg bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700">
                      {row.leaveType} leave
                    </span>

                    <span className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">
                      {leaveDays} day(s)
                    </span>

                    <button
                      type="button"
                      onClick={() => toggleRow(row._id)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                      aria-expanded={expanded}
                    >
                      {expanded ? (
                        <>
                          <ChevronUp size={15} />
                          Hide details
                        </>
                      ) : (
                        <>
                          <ChevronDown size={15} />
                          View details
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Quick information */}
                <div className="grid grid-cols-2 border-y border-slate-100 bg-slate-50/70 sm:grid-cols-4">
                  <div className="border-b border-r border-slate-100 px-4 py-3 sm:border-b-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Leave type
                    </p>
                    <p className="mt-1 text-sm font-bold text-slate-800">
                      {row.leaveType}
                    </p>
                  </div>

                  <div className="border-b border-slate-100 px-4 py-3 sm:border-b-0 sm:border-r">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Requested duration
                    </p>
                    <p className="mt-1 text-sm font-bold text-slate-800">
                      {leaveDays} day(s)
                    </p>
                  </div>

                  <div className="border-r border-slate-100 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Start date
                    </p>
                    <p className="mt-1 text-sm font-bold text-slate-800">
                      {formatDate(row.startDate)}
                    </p>
                  </div>

                  <div className="px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      End date
                    </p>
                    <p className="mt-1 text-sm font-bold text-slate-800">
                      {formatDate(row.endDate)}
                    </p>
                  </div>
                </div>

                {/* Expanded details */}
                {expanded && (
                  <div className="space-y-4 p-4 sm:p-5">
                    <div>
                      <p className="mb-1.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                        <FileText size={14} />
                        Reason for leave
                      </p>

                      <p className="whitespace-pre-line rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                        {row.reason || "No reason provided."}
                      </p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {reviewer && (
                        <DetailItem
                          label="Employee"
                          value={employeeName}
                          icon={UserRound}
                        />
                      )}

                      {reviewer && (
                        <DetailItem
                          label="Department"
                          value={department}
                          icon={BriefcaseBusiness}
                        />
                      )}

                      <DetailItem
                        label="Leave duration"
                        value={
                          row.dayType === "HalfDay"
                            ? `Half Day (${
                                row.halfDaySession === "FirstHalf"
                                  ? "First Half"
                                  : row.halfDaySession === "SecondHalf"
                                    ? "Second Half"
                                    : "Session not specified"
                              })`
                            : `${leaveDays} day(s)`
                        }
                        icon={CalendarClock}
                      />

                      <DetailItem
                        label="Submitted on"
                        value={formatDate(row.createdAt)}
                        icon={CalendarDays}
                      />

                      {row.reviewedAt && (
                        <DetailItem
                          label="Decision date"
                          value={formatDate(row.reviewedAt)}
                          icon={CalendarCheck}
                        />
                      )}
                    </div>

                    {/* Paid / unpaid allocation */}
                    <AllocationDetails row={row} />

                    {row.status === "Approved" &&
                      row.allocationStatus !== "Allocated" && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                          <p className="text-sm font-semibold text-amber-800">
                            Allocation information unavailable
                          </p>
                          <p className="mt-1 text-xs leading-5 text-amber-700">
                            This request is approved, but its paid and
                            unpaid leave allocation has not been recorded.
                          </p>
                        </div>
                      )}

                    {/* Decision note */}
                    {row.reviewNote && (
                      <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4">
                        <div className="flex items-center gap-2">
                          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                            <MessageSquare size={15} />
                          </span>

                          <p className="text-xs font-bold uppercase tracking-wider text-blue-800">
                            HR decision note
                          </p>
                        </div>

                        <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">
                          {row.reviewNote}
                        </p>
                      </div>
                    )}

                    {row.status === "Approved" &&
                      row.allocationStatus === "Allocated" &&
                      Number(row.unpaidDays || 0) > 0 && (
                        <div className="rounded-xl border border-orange-100 bg-orange-50 p-3">
                          <p className="text-sm font-semibold text-orange-800">
                            Unpaid leave recorded
                          </p>
                          <p className="mt-1 text-xs leading-5 text-orange-700">
                            The unpaid portion will be considered during
                            payroll calculation. The actual deduction
                            amount will be calculated by payroll.
                          </p>
                        </div>
                      )}
                  </div>
                )}

                {/* Action footer */}
                {(admin && isPending) ||
                (!reviewer && isPending) ||
                (manager && isPending) ? (
                  <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/60 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                    <div className="text-xs text-slate-500">
                      {admin
                        ? "Review this application and record your decision."
                        : manager
                          ? "This request is awaiting HR review."
                          : "You can cancel this request while it is pending."}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {admin && isPending && (
                        <>
                          <button
                            type="button"
                            disabled={isBusy || !!busyId}
                            onClick={() =>
                              decide(row._id, "approve")
                            }
                            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isBusy ? (
                              <RefreshCw
                                size={14}
                                className="animate-spin"
                              />
                            ) : (
                              <Check size={15} />
                            )}
                            Approve
                          </button>

                          <button
                            type="button"
                            disabled={isBusy || !!busyId}
                            onClick={() =>
                              decide(row._id, "reject")
                            }
                            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <X size={15} />
                            Reject
                          </button>
                        </>
                      )}

                      {!reviewer && isPending && (
                        <button
                          type="button"
                          disabled={isBusy || !!busyId}
                          onClick={() => cancel(row._id)}
                          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isBusy ? (
                            <RefreshCw
                              size={14}
                              className="animate-spin"
                            />
                          ) : (
                            <Ban size={15} />
                          )}
                          Cancel request
                        </button>
                      )}

                      {manager && isPending && (
                        <span className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                          HR review required
                        </span>
                      )}
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
