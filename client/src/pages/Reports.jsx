
import { useEffect, useMemo, useState } from "react";
import {
  Send,
  Pencil,
  Plus,
  Trash2,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Search,
  ClipboardCheck,
  CalendarDays,
  Filter,
  RefreshCw,
  X,
  ChevronDown,
  ChevronUp,
  BriefcaseBusiness,
  Timer,
  UserRound,
} from "lucide-react";

import api, { errMsg } from "../api";
import { useAuth } from "../hooks/useAuth";
import Alert from "../components/Alert";
import StatusBadge from "../components/StatusBadge";

// --------------------------------------------------
// Date helpers
// --------------------------------------------------

const todayStr = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
  }).format(new Date());

const formatDateTime = (value) => {
  if (!value) return "Not recorded";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Not recorded";

  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  });
};

const formatReportDate = (value) => {
  if (!value) return "Date not available";

  const parts = String(value).slice(0, 10).split("-");

  if (parts.length !== 3) return value;

  const [year, month, day] = parts;

  if (!year || !month || !day) return value;

  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day)
  ).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const toDateTimeLocal = (value) => {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  const pad = (number) => String(number).padStart(2, "0");

  return [
    date.getFullYear(),
    "-",
    pad(date.getMonth() + 1),
    "-",
    pad(date.getDate()),
    "T",
    pad(date.getHours()),
    ":",
    pad(date.getMinutes()),
  ].join("");
};

// --------------------------------------------------
// Form helpers
// --------------------------------------------------

const makeEmptyTask = () => ({
  mode: "assigned",
  taskAssignment: "",
  task: "",
  taskNameSnapshot: "",
  description: "",
  startTime: "",
  endTime: "",
  hoursSpent: "",
  status: "Completed",
  blockers: [],
});

const makeEmptyForm = () => ({
  reportDate: todayStr(),
  tasks: [makeEmptyTask()],
});

const makeEmptyBlocker = () => ({
  description: "",
  assignedTo: null,
});

const getTaskTitle = (task) =>
  task?.taskAssignment?.title ||
  task?.task?.title ||
  task?.taskNameSnapshot ||
  "Task";

const getReferenceId = (value) =>
  value?._id || value || "";

const getEmployeeName = (report) =>
  report.employee?.user?.name ||
  report.employee?.name ||
  report.employee?.fullName ||
  "Employee";

const getDepartment = (report) =>
  report.employee?.department ||
  report.employee?.employment?.department ||
  "Department not assigned";

const getInitials = (name) =>
  String(name || "Employee")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");

const isResolvedBlocker = (blocker) =>
  ["resolved", "closed", "completed"].includes(
    String(blocker.status || "").toLowerCase()
  );

// --------------------------------------------------
// Reusable UI components
// --------------------------------------------------

const Section = ({ label, value, icon: Icon }) => (
  <div className="min-w-0">
    <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
      {Icon && <Icon size={13} />}
      {label}
    </p>

    <p className="mt-1 whitespace-pre-line break-words text-sm leading-6 text-slate-700">
      {value || "—"}
    </p>
  </div>
);

const StatCard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  tone = "indigo",
}) => {
  const tones = {
    indigo: "bg-indigo-50 text-indigo-600 ring-indigo-100",
    blue: "bg-blue-50 text-blue-600 ring-blue-100",
    amber: "bg-amber-50 text-amber-600 ring-amber-100",
    emerald: "bg-emerald-50 text-emerald-600 ring-emerald-100",
    rose: "bg-rose-50 text-rose-600 ring-rose-100",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">
            {title}
          </p>

          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {value}
          </p>

          <p className="mt-1 text-xs text-slate-400">
            {subtitle}
          </p>
        </div>

        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ${tones[tone]}`}
        >
          <Icon size={21} />
        </div>
      </div>
    </div>
  );
};

const EmptyState = ({
  title,
  description,
  icon: Icon = FileText,
}) => (
  <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-14 text-center">
    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
      <Icon size={25} />
    </div>

    <h3 className="mt-4 font-semibold text-slate-800">
      {title}
    </h3>

    <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-slate-500">
      {description}
    </p>
  </div>
);

// --------------------------------------------------
// Main component
// --------------------------------------------------

export default function Reports() {
  const { user } = useAuth();

  const role = user?.role;
  const admin = role === "admin";
  const manager = role === "manager";
  const reviewer = admin || manager;

  const [rows, setRows] = useState([]);

  // These are TaskAssignment records, not Task templates.
  const [availableTasks, setAvailableTasks] = useState([]);

  const [filters, setFilters] = useState({
    department: "",
    from: "",
    to: "",
  });

  const [search, setSearch] = useState("");
  const [form, setForm] = useState(makeEmptyForm);
  const [editingId, setEditingId] = useState(null);

  const [loading, setLoading] = useState(true);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const [msg, setMsg] = useState({
    type: "",
    text: "",
  });

  const [reloadKey, setReloadKey] = useState(0);
  const [expandedReports, setExpandedReports] = useState({});

  // --------------------------------------------------
  // Fetch employee's TaskAssignment records
  // --------------------------------------------------

  useEffect(() => {
    if (reviewer) return;

    let ignore = false;

    const fetchAssignments = async () => {
      setTasksLoading(true);

      try {
        const response = await api.get("/task-assignments");

        if (!ignore) {
          // Backend returns { count, assignments }.
          const assignments = response.data?.assignments;

          setAvailableTasks(
            Array.isArray(assignments) ? assignments : []
          );
        }
      } catch (error) {
        if (!ignore) {
          setAvailableTasks([]);

          setMsg({
            type: "error",
            text: `Could not load assigned tasks: ${errMsg(error)}`,
          });
        }
      } finally {
        if (!ignore) {
          setTasksLoading(false);
        }
      }
    };

    fetchAssignments();

    return () => {
      ignore = true;
    };
  }, [reviewer]);

  // --------------------------------------------------
  // Fetch DAR reports
  // --------------------------------------------------

  useEffect(() => {
    let ignore = false;

    const fetchReports = async () => {
      setLoading(true);

      const params = Object.fromEntries(
        Object.entries(filters).filter(([, value]) => value)
      );

      try {
        const response = reviewer
          ? await api.get("/reports", { params })
          : await api.get("/reports/me");

        if (!ignore) {
          setRows(
            Array.isArray(response.data) ? response.data : []
          );
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

    fetchReports();

    return () => {
      ignore = true;
    };
  }, [reviewer, filters, reloadKey]);

  // --------------------------------------------------
  // Search reports
  // --------------------------------------------------

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return rows;

    return rows.filter((report) => {
      const employeeName = getEmployeeName(report).toLowerCase();
      const department = getDepartment(report).toLowerCase();
      const reportDate = String(
        report.reportDate || ""
      ).toLowerCase();

      const overallStatus = String(
        report.overallStatus || ""
      ).toLowerCase();

      const taskText = (report.tasks || [])
        .map((task) =>
          [
            getTaskTitle(task),
            task.description,
            task.status,
            ...(task.blockers || []).map(
              (blocker) => blocker.description
            ),
          ]
            .filter(Boolean)
            .join(" ")
        )
        .join(" ")
        .toLowerCase();

      return (
        employeeName.includes(query) ||
        department.includes(query) ||
        reportDate.includes(query) ||
        overallStatus.includes(query) ||
        taskText.includes(query)
      );
    });
  }, [rows, search]);

  // --------------------------------------------------
  // Dashboard statistics
  // --------------------------------------------------

  const stats = useMemo(() => {
    const total = rows.length;

    const pending = rows.filter((report) =>
      ["submitted", "pending", "under review"].includes(
        String(report.overallStatus || "").toLowerCase()
      )
    ).length;

    const approved = rows.filter((report) =>
      ["approved", "completed"].includes(
        String(report.overallStatus || "").toLowerCase()
      )
    ).length;

    const blockers = rows.reduce(
      (count, report) =>
        count +
        (report.tasks || []).reduce(
          (taskCount, task) =>
            taskCount +
            (task.blockers || []).filter(
              (blocker) => !isResolvedBlocker(blocker)
            ).length,
          0
        ),
      0
    );

    const overdueReviews = rows.reduce((count, report) => {
      const overdueTasks = (report.tasks || []).filter((task) => {
        const deadline = task.review?.deadline;

        if (!deadline) return false;

        const deadlineTime = new Date(deadline).getTime();

        if (Number.isNaN(deadlineTime)) return false;

        const reviewStatus = String(
          task.review?.status || ""
        ).toLowerCase();

        return (
          deadlineTime < Date.now() &&
          !["approved", "completed", "reviewed"].includes(
            reviewStatus
          )
        );
      });

      return count + overdueTasks.length;
    }, 0);

    return {
      total,
      pending,
      approved,
      blockers,
      overdueReviews,
    };
  }, [rows]);

  // --------------------------------------------------
  // Form state helpers
  // --------------------------------------------------

  const updateTask = (index, field, value) => {
    setForm((previous) => ({
      ...previous,
      tasks: previous.tasks.map((task, taskIndex) =>
        taskIndex === index
          ? { ...task, [field]: value }
          : task
      ),
    }));
  };

  const changeTaskMode = (index, mode) => {
    setForm((previous) => ({
      ...previous,
      tasks: previous.tasks.map((task, taskIndex) => {
        if (taskIndex !== index) return task;

        return {
          ...task,
          mode,
          taskAssignment: "",
          task: "",
          taskNameSnapshot: "",
        };
      }),
    }));
  };

  const addTask = () => {
    setForm((previous) => ({
      ...previous,
      tasks: [...previous.tasks, makeEmptyTask()],
    }));
  };

  const removeTask = (index) => {
    setForm((previous) => ({
      ...previous,
      tasks: previous.tasks.filter(
        (_, taskIndex) => taskIndex !== index
      ),
    }));
  };

  const addBlocker = (taskIndex) => {
    setForm((previous) => ({
      ...previous,
      tasks: previous.tasks.map((task, index) =>
        index === taskIndex
          ? {
              ...task,
              blockers: [
                ...task.blockers,
                makeEmptyBlocker(),
              ],
            }
          : task
      ),
    }));
  };

  const updateBlocker = (
    taskIndex,
    blockerIndex,
    value
  ) => {
    setForm((previous) => ({
      ...previous,
      tasks: previous.tasks.map((task, index) =>
        index === taskIndex
          ? {
              ...task,
              blockers: task.blockers.map(
                (blocker, currentBlockerIndex) =>
                  currentBlockerIndex === blockerIndex
                    ? {
                        ...blocker,
                        description: value,
                      }
                    : blocker
              ),
            }
          : task
      ),
    }));
  };

  const removeBlocker = (taskIndex, blockerIndex) => {
    setForm((previous) => ({
      ...previous,
      tasks: previous.tasks.map((task, index) =>
        index === taskIndex
          ? {
              ...task,
              blockers: task.blockers.filter(
                (_, currentBlockerIndex) =>
                  currentBlockerIndex !== blockerIndex
              ),
            }
          : task
      ),
    }));
  };

  // --------------------------------------------------
  // Submit or update DAR
  // --------------------------------------------------

  const submit = async (event) => {
    event.preventDefault();

    setMsg({ type: "", text: "" });

    if (!form.reportDate) {
      setMsg({
        type: "error",
        text: "Please select a report date.",
      });
      return;
    }

    if (!form.tasks.length) {
      setMsg({
        type: "error",
        text: "Please add at least one work entry.",
      });
      return;
    }

    // Validate assigned, manual and legacy entries separately.
    const invalidTask = form.tasks.some((task) => {
      if (!task.description.trim()) return true;

      if (task.mode === "assigned" && !task.taskAssignment) {
        return true;
      }

      if (task.mode === "manual" && !task.taskNameSnapshot.trim()) {
        return true;
      }

      if (task.mode === "legacy" && !task.task) {
        return true;
      }

      return false;
    });

    if (invalidTask) {
      setMsg({
        type: "error",
        text: "Please select an assigned task or enter a manual task title, and provide a work description for every entry.",
      });
      return;
    }

    const invalidHours = form.tasks.some((task) => {
      if (task.hoursSpent === "") return false;

      const hours = Number(task.hoursSpent);

      return (
        !Number.isFinite(hours) ||
        hours < 0 ||
        hours > 24
      );
    });

    if (invalidHours) {
      setMsg({
        type: "error",
        text: "Hours spent must be between 0 and 24.",
      });
      return;
    }

    const invalidTime = form.tasks.some((task) => {
      if (!task.startTime || !task.endTime) return false;

      return (
        new Date(task.endTime).getTime() <
        new Date(task.startTime).getTime()
      );
    });

    if (invalidTime) {
      setMsg({
        type: "error",
        text: "A task's end time cannot be earlier than its start time.",
      });
      return;
    }

    // Build a clean payload.
    // Do not send both Task and TaskAssignment references.
    const payload = {
      reportDate: form.reportDate,

      tasks: form.tasks.map((task) => {
        const taskPayload = {
          description: task.description.trim(),
          startTime: task.startTime || null,
          endTime: task.endTime || null,
          hoursSpent:
            task.hoursSpent === ""
              ? 0
              : Number(task.hoursSpent),
          status: task.status,

          blockers: task.blockers
            .filter((blocker) =>
              blocker.description.trim()
            )
            .map((blocker) => ({
              description: blocker.description.trim(),
              assignedTo: blocker.assignedTo || null,
            })),
        };

        if (task.mode === "assigned") {
          taskPayload.taskAssignment = task.taskAssignment;
        } else if (task.mode === "legacy") {
          // Keep old DAR records linked to the Task model.
          taskPayload.task = task.task;
        } else {
          // Manual work does not require an assigned task.
          taskPayload.taskNameSnapshot =
            task.taskNameSnapshot.trim();
        }

        return taskPayload;
      }),
    };

    setBusy(true);

    try {
      if (editingId) {
        await api.put(`/reports/${editingId}`, payload);
      } else {
        await api.post("/reports", payload);
      }

      setMsg({
        type: "ok",
        text: editingId
          ? "Daily report updated successfully."
          : "Daily report submitted successfully.",
      });

      setForm(makeEmptyForm());
      setEditingId(null);
      setReloadKey((key) => key + 1);

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    } catch (error) {
      setMsg({
        type: "error",
        text: errMsg(error),
      });
    } finally {
      setBusy(false);
    }
  };

  // --------------------------------------------------
  // Edit an existing DAR
  // --------------------------------------------------

  const startEdit = (report) => {
    setEditingId(report._id);

    setForm({
      reportDate: String(
        report.reportDate || ""
      ).slice(0, 10),

      tasks: (report.tasks || []).map((task) => {
        const assignmentId = getReferenceId(
          task.taskAssignment
        );

        const legacyTaskId = getReferenceId(task.task);

        let mode = "manual";

        if (assignmentId) {
          mode = "assigned";
        } else if (legacyTaskId) {
          mode = "legacy";
        }

        return {
          mode,
          taskAssignment: assignmentId,
          task: legacyTaskId,
          taskNameSnapshot: task.taskNameSnapshot || "",
          description: task.description || "",
          startTime: toDateTimeLocal(task.startTime),
          endTime: toDateTimeLocal(task.endTime),
          hoursSpent: task.hoursSpent ?? "",
          status: task.status || "Pending",

          blockers: (task.blockers || []).map((blocker) => ({
            description: blocker.description || "",
            assignedTo:
              getReferenceId(blocker.assignedTo) || null,
          })),
        };
      }),
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(makeEmptyForm());
    setMsg({ type: "", text: "" });
  };

  // --------------------------------------------------
  // Filters and refresh
  // --------------------------------------------------

  const clearFilters = () => {
    setFilters({
      department: "",
      from: "",
      to: "",
    });

    setSearch("");
  };

  const toggleReport = (reportId) => {
    setExpandedReports((previous) => ({
      ...previous,
      [reportId]: !previous[reportId],
    }));
  };

  const refreshReports = () => {
    setMsg({ type: "", text: "" });
    setReloadKey((key) => key + 1);
  };

  // --------------------------------------------------
  // Render
  // --------------------------------------------------

  return (
    <div className="min-h-full space-y-6 pb-8">
      {/* Page heading */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
              <ClipboardCheck size={19} />
            </span>

            <span className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-600">
              {reviewer ? "HR Management" : "Employee Workspace"}
            </span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {reviewer
              ? "Daily Activity Reports"
              : "My Daily Reports"}
          </h1>

          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
            {reviewer
              ? "Monitor employee activity, review report submissions and keep track of pending work."
              : "Record your daily activities, track your progress and report any blockers to your manager."}
          </p>
        </div>

        <button
          type="button"
          onClick={refreshReports}
          disabled={loading}
          className="inline-flex w-fit items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw
            size={16}
            className={loading ? "animate-spin" : ""}
          />
          Refresh reports
        </button>
      </div>

      <Alert msg={msg} />

      {/* HR / Manager dashboard */}
      {reviewer && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Total reports"
              value={stats.total}
              subtitle="Reports in the current result"
              icon={FileText}
              tone="indigo"
            />

            <StatCard
              title="Pending review"
              value={stats.pending}
              subtitle="Submitted reports awaiting review"
              icon={Clock}
              tone="amber"
            />

            <StatCard
              title="Approved reports"
              value={stats.approved}
              subtitle="Reports marked as approved"
              icon={CheckCircle2}
              tone="emerald"
            />

            <StatCard
              title="Open blockers"
              value={stats.blockers}
              subtitle="Blockers not yet resolved"
              icon={AlertTriangle}
              tone="rose"
            />
          </div>

          {stats.overdueReviews > 0 && (
            <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                  <Timer size={20} />
                </span>

                <div>
                  <p className="font-semibold text-amber-900">
                    Review deadlines need attention
                  </p>

                  <p className="mt-0.5 text-sm text-amber-800">
                    {stats.overdueReviews} task review deadline(s)
                    have passed and may need follow-up.
                  </p>
                </div>
              </div>

              <span className="w-fit rounded-full bg-white px-3 py-1.5 text-xs font-bold text-amber-800 ring-1 ring-amber-200">
                Action required
              </span>
            </div>
          )}
        </>
      )}

      {/* Employee DAR form */}
      {!reviewer && (
        <form
          onSubmit={submit}
          className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
        >
          <div className="border-b border-slate-100 bg-gradient-to-r from-indigo-50 via-white to-white px-5 py-5 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
                    <FileText size={18} />
                  </span>

                  <h2 className="text-lg font-bold text-slate-900">
                    {editingId
                      ? "Edit Daily Report"
                      : "Create Daily Report"}
                  </h2>
                </div>

                <p className="mt-2 text-sm text-slate-500">
                  Add assigned tasks or manual work, working hours
                  and any challenges faced.
                </p>
              </div>

              <span className="rounded-full border border-indigo-100 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700">
                {form.tasks.length} work entry/entries
              </span>
            </div>
          </div>

          <div className="space-y-5 p-5 sm:p-6">
            {/* Report date */}
            <div className="max-w-xs">
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Report date <span className="text-rose-500">*</span>
              </label>

              <input
                type="date"
                required
                disabled={!!editingId}
                max={todayStr()}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 disabled:bg-slate-100"
                value={form.reportDate}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    reportDate: event.target.value,
                  }))
                }
              />

              {editingId && (
                <p className="mt-1 text-xs text-slate-400">
                  Report date cannot be changed while editing.
                </p>
              )}
            </div>

            {/* Work details heading */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div>
                <h3 className="font-bold text-slate-900">
                  Work details
                </h3>

                <p className="mt-1 text-xs text-slate-500">
                  Add a separate entry for every activity you worked on.
                </p>
              </div>

              <span className="text-xs font-medium text-slate-400">
                {form.tasks.length} added
              </span>
            </div>

            {/* Assignment loading notice */}
            {tasksLoading && (
              <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                <RefreshCw size={16} className="animate-spin" />
                Loading your assigned tasks...
              </div>
            )}

            {/* No assignment notice - manual work is still allowed */}
            {!tasksLoading && availableTasks.length === 0 && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                <div className="flex items-start gap-3">
                  <FileText
                    size={20}
                    className="mt-0.5 shrink-0 text-blue-600"
                  />

                  <div>
                    <p className="font-semibold text-blue-900">
                      No assigned tasks found
                    </p>

                    <p className="mt-1 text-sm leading-6 text-blue-800">
                      You can still submit your daily report by
                      selecting Manual Work and entering the work
                      you completed.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Task entries */}
            {form.tasks.map((task, index) => (
              <div
                key={index}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
              >
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/80 px-4 py-3 sm:px-5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-sm font-bold text-indigo-700">
                      {String(index + 1).padStart(2, "0")}
                    </span>

                    <div>
                      <h3 className="text-sm font-bold text-slate-800">
                        Work entry {index + 1}
                      </h3>

                      <p className="text-xs text-slate-400">
                        Activity details
                      </p>
                    </div>
                  </div>

                  {form.tasks.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeTask(index)}
                      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                    >
                      <Trash2 size={14} />
                      Remove
                    </button>
                  )}
                </div>

                <div className="space-y-4 p-4 sm:p-5">
                  {/* Entry type */}
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                      Work type
                    </label>

                    {task.mode === "legacy" ? (
                      <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                          Existing legacy task
                        </p>

                        <p className="mt-1 text-sm font-semibold text-blue-900">
                          {task.taskNameSnapshot ||
                            "Previously selected task"}
                        </p>

                        <p className="mt-1 text-xs text-blue-700">
                          This existing report entry will remain linked
                          to its original task.
                        </p>
                      </div>
                    ) : (
                      <select
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
                        value={task.mode}
                        onChange={(event) =>
                          changeTaskMode(index, event.target.value)
                        }
                      >
                        <option value="assigned">
                          Assigned Task
                        </option>

                        <option value="manual">
                          Manual Work / Other Activity
                        </option>
                      </select>
                    )}
                  </div>

                  {/* Assigned task selector */}
                  {task.mode === "assigned" && (
                    <div>
                      <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                        Select assigned task{" "}
                        <span className="text-rose-500">*</span>
                      </label>

                      <select
                        required
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
                        value={task.taskAssignment}
                        onChange={(event) =>
                          updateTask(
                            index,
                            "taskAssignment",
                            event.target.value
                          )
                        }
                      >
                        <option value="">
                          Choose an assigned task
                        </option>

                        {availableTasks.map((item) => (
                          <option
                            key={item._id}
                            value={item._id}
                          >
                            {item.title}
                            {item.status
                              ? ` — ${item.status}`
                              : ""}
                          </option>
                        ))}
                      </select>

                      {availableTasks.length === 0 && (
                        <p className="mt-1.5 text-xs text-amber-600">
                          No assigned tasks are available. Select
                          Manual Work to continue.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Manual task title */}
                  {task.mode === "manual" && (
                    <div>
                      <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                        Work title{" "}
                        <span className="text-rose-500">*</span>
                      </label>

                      <input
                        type="text"
                        required
                        maxLength={200}
                        placeholder="e.g. Team meeting, documentation, bug fixing..."
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
                        value={task.taskNameSnapshot}
                        onChange={(event) =>
                          updateTask(
                            index,
                            "taskNameSnapshot",
                            event.target.value
                          )
                        }
                      />

                      <p className="mt-1 text-xs text-slate-400">
                        Use this for work that was not assigned through
                        the Task Management module.
                      </p>
                    </div>
                  )}

                  {/* Description */}
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                      Work description{" "}
                      <span className="text-rose-500">*</span>
                    </label>

                    <textarea
                      required
                      rows={3}
                      maxLength={3000}
                      className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm leading-6 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
                      placeholder="Describe what you worked on, what you completed and the outcome..."
                      value={task.description}
                      onChange={(event) =>
                        updateTask(
                          index,
                          "description",
                          event.target.value
                        )
                      }
                    />

                    <p className="mt-1 text-right text-xs text-slate-400">
                      {task.description.length}/3000
                    </p>
                  </div>

                  {/* Start and end time */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                        Start time
                      </label>

                      <input
                        type="datetime-local"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
                        value={task.startTime}
                        onChange={(event) =>
                          updateTask(
                            index,
                            "startTime",
                            event.target.value
                          )
                        }
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                        End time
                      </label>

                      <input
                        type="datetime-local"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
                        value={task.endTime}
                        onChange={(event) =>
                          updateTask(
                            index,
                            "endTime",
                            event.target.value
                          )
                        }
                      />
                    </div>
                  </div>

                  {/* Hours and status */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                        Hours spent
                      </label>

                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          max="24"
                          step="0.25"
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 pr-16 text-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
                          placeholder="e.g. 3.5"
                          value={task.hoursSpent}
                          onChange={(event) =>
                            updateTask(
                              index,
                              "hoursSpent",
                              event.target.value
                            )
                          }
                        />

                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                          Hours
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                        Task status
                      </label>

                      <select
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
                        value={task.status}
                        onChange={(event) =>
                          updateTask(
                            index,
                            "status",
                            event.target.value
                          )
                        }
                      >
                        <option value="Pending">Pending</option>
                        <option value="In Progress">
                          In Progress
                        </option>
                        <option value="Completed">
                          Completed
                        </option>
                        <option value="On Hold">On Hold</option>
                      </select>
                    </div>
                  </div>

                  {/* Blockers */}
                  <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                          <AlertTriangle size={16} />
                        </span>

                        <div>
                          <h4 className="text-sm font-bold text-amber-900">
                            Blockers & Challenges
                          </h4>

                          <p className="text-xs text-amber-700">
                            Report anything preventing progress.
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => addBlocker(index)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs font-semibold text-amber-800 transition hover:bg-amber-100"
                      >
                        <Plus size={14} />
                        Add blocker
                      </button>
                    </div>

                    {task.blockers.length === 0 ? (
                      <p className="mt-3 rounded-lg border border-dashed border-amber-200 bg-white/70 px-3 py-3 text-xs text-amber-700">
                        No blockers added. You can leave this section
                        empty if your work is progressing normally.
                      </p>
                    ) : (
                      <div className="mt-3 space-y-3">
                        {task.blockers.map(
                          (blocker, blockerIndex) => (
                            <div
                              key={blockerIndex}
                              className="flex items-start gap-2"
                            >
                              <div className="min-w-0 flex-1">
                                <label className="mb-1 block text-xs font-semibold text-amber-900">
                                  Blocker {blockerIndex + 1}
                                </label>

                                <textarea
                                  rows={2}
                                  maxLength={2000}
                                  className="w-full resize-y rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                                  placeholder="Describe the blocker and how it affects your work..."
                                  value={blocker.description}
                                  onChange={(event) =>
                                    updateBlocker(
                                      index,
                                      blockerIndex,
                                      event.target.value
                                    )
                                  }
                                />
                              </div>

                              <button
                                type="button"
                                onClick={() =>
                                  removeBlocker(
                                    index,
                                    blockerIndex
                                  )
                                }
                                className="mt-6 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-rose-500 transition hover:bg-rose-100 hover:text-rose-700"
                                aria-label="Remove blocker"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          )
                        )}
                      </div>
                    )}

                    <p className="mt-3 text-xs text-amber-700">
                      Your manager can review and assign blockers
                      for resolution.
                    </p>
                  </div>
                </div>
              </div>
            ))}

            {/* Add another entry */}
            <button
              type="button"
              onClick={addTask}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-indigo-300 bg-indigo-50/50 px-4 py-3 text-sm font-semibold text-indigo-700 transition hover:border-indigo-400 hover:bg-indigo-50"
            >
              <Plus size={17} />
              Add another work entry
            </button>

            {/* Form actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
              <p className="text-xs text-slate-400">
                Please review your entries before submitting.
              </p>

              <div className="flex flex-wrap gap-2">
                {editingId && (
                  <button
                    type="button"
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                    onClick={cancelEdit}
                    disabled={busy}
                  >
                    Cancel
                  </button>
                )}

                <button
                  type="submit"
                  disabled={busy || tasksLoading}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busy ? (
                    <RefreshCw
                      size={16}
                      className="animate-spin"
                    />
                  ) : (
                    <Send size={16} />
                  )}

                  {busy
                    ? "Saving..."
                    : editingId
                      ? "Update report"
                      : "Submit report"}
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* HR / Manager filters */}
      {reviewer && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                <Filter size={17} />
              </span>

              <div>
                <h2 className="font-bold text-slate-900">
                  Find reports
                </h2>

                <p className="text-xs text-slate-400">
                  Search and narrow down employee submissions.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
            >
              <X size={14} />
              Clear filters
            </button>
          </div>

          <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4">
            <div className="sm:col-span-2 xl:col-span-1">
              <label className="mb-1.5 block text-xs font-semibold text-slate-500">
                Search reports
              </label>

              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  type="search"
                  placeholder="Employee, task, status..."
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                />
              </div>
            </div>

            {admin && (
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-500">
                  Department
                </label>

                <div className="relative">
                  <BriefcaseBusiness
                    size={15}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    placeholder="e.g. Engineering"
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
                    value={filters.department}
                    onChange={(event) =>
                      setFilters((previous) => ({
                        ...previous,
                        department: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-500">
                From date
              </label>

              <div className="relative">
                <CalendarDays
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  type="date"
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
                  value={filters.from}
                  max={filters.to || undefined}
                  onChange={(event) =>
                    setFilters((previous) => ({
                      ...previous,
                      from: event.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-500">
                To date
              </label>

              <div className="relative">
                <CalendarDays
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  type="date"
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
                  value={filters.to}
                  min={filters.from || undefined}
                  onChange={(event) =>
                    setFilters((previous) => ({
                      ...previous,
                      to: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Report list heading */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            {reviewer
              ? "Employee report submissions"
              : "Report history"}
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            {reviewer
              ? "Review submitted daily activities and their progress."
              : "View your previously submitted daily activity reports."}
          </p>
        </div>

        {!loading && (
          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
            {filteredRows.length} report(s)
          </span>
        )}
      </div>

      {/* Report list */}
      <div className="space-y-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5"
            >
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-xl bg-slate-100" />

                <div className="flex-1 space-y-2">
                  <div className="h-4 w-36 rounded bg-slate-100" />
                  <div className="h-3 w-24 rounded bg-slate-100" />
                </div>

                <div className="h-7 w-24 rounded-full bg-slate-100" />
              </div>

              <div className="mt-5 h-20 rounded-xl bg-slate-50" />
            </div>
          ))
        ) : filteredRows.length === 0 ? (
          <EmptyState
            title={
              rows.length === 0
                ? "No reports available"
                : "No matching reports"
            }
            description={
              rows.length === 0
                ? reviewer
                  ? "No employee reports were found for the selected filters."
                  : "You have not submitted any daily activity reports yet."
                : "Try changing your search text or clearing the selected filters."
            }
            icon={FileText}
          />
        ) : (
          filteredRows.map((report) => {
            const employeeName = getEmployeeName(report);
            const department = getDepartment(report);
            const tasks = report.tasks || [];

            const isExpanded =
              expandedReports[report._id] ?? true;

            const totalHours = tasks.reduce(
              (total, task) =>
                total + (Number(task.hoursSpent) || 0),
              0
            );

            const completedTasks = tasks.filter(
              (task) =>
                String(task.status || "").toLowerCase() ===
                "completed"
            ).length;

            const openBlockers = tasks.reduce(
              (total, task) =>
                total +
                (task.blockers || []).filter(
                  (blocker) => !isResolvedBlocker(blocker)
                ).length,
              0
            );

            return (
              <article
                key={report._id}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
              >
                {/* Report header */}
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
                            : formatReportDate(report.reportDate)}
                        </h3>

                        <StatusBadge
                          value={
                            report.overallStatus || "Submitted"
                          }
                        />
                      </div>

                      {reviewer && (
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                          <span className="inline-flex items-center gap-1">
                            <BriefcaseBusiness size={12} />
                            {department}
                          </span>

                          <span className="inline-flex items-center gap-1">
                            <CalendarDays size={12} />
                            {formatReportDate(report.reportDate)}
                          </span>
                        </div>
                      )}

                      <p className="mt-1.5 text-xs text-slate-400">
                        Submitted: {formatDateTime(report.submittedAt)}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="rounded-lg bg-slate-100 px-2.5 py-1.5">
                        {tasks.length} task(s)
                      </span>

                      <span className="rounded-lg bg-slate-100 px-2.5 py-1.5">
                        {totalHours.toFixed(2)} hrs
                      </span>
                    </div>

                    {!reviewer &&
                      String(report.reportDate).slice(0, 10) ===
                        todayStr() &&
                      ["Draft", "Revision Required"].includes(
                        report.overallStatus
                      ) && (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100"
                          onClick={() => startEdit(report)}
                        >
                          <Pencil size={14} />
                          Edit report
                        </button>
                      )}

                    <button
                      type="button"
                      onClick={() => toggleReport(report._id)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                      aria-expanded={isExpanded}
                    >
                      {isExpanded ? (
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

                {/* Quick report metrics */}
                <div className="grid grid-cols-2 border-y border-slate-100 bg-slate-50/70 sm:grid-cols-4">
                  <div className="border-b border-r border-slate-100 px-4 py-3 sm:border-b-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Total tasks
                    </p>

                    <p className="mt-1 text-lg font-bold text-slate-800">
                      {tasks.length}
                    </p>
                  </div>

                  <div className="border-b border-slate-100 px-4 py-3 sm:border-b-0 sm:border-r">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Completed
                    </p>

                    <p className="mt-1 text-lg font-bold text-emerald-600">
                      {completedTasks}
                    </p>
                  </div>

                  <div className="border-r border-slate-100 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Hours spent
                    </p>

                    <p className="mt-1 text-lg font-bold text-slate-800">
                      {totalHours.toFixed(2)}
                    </p>
                  </div>

                  <div className="px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Open blockers
                    </p>

                    <p
                      className={`mt-1 text-lg font-bold ${
                        openBlockers > 0
                          ? "text-amber-600"
                          : "text-emerald-600"
                      }`}
                    >
                      {openBlockers}
                    </p>
                  </div>
                </div>

                {/* Task details */}
                {isExpanded && (
                  <div className="space-y-4 p-4 sm:p-5">
                    {tasks.length === 0 ? (
                      <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                        <FileText size={17} />
                        No task details available.
                      </div>
                    ) : (
                      tasks.map((task, index) => (
                        <div
                          key={task._id || index}
                          className="overflow-hidden rounded-xl border border-slate-200"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-3">
                            <div className="flex min-w-0 items-center gap-2.5">
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-xs font-bold text-indigo-700">
                                {index + 1}
                              </span>

                              <h4 className="truncate text-sm font-bold text-slate-800">
                                {getTaskTitle(task)}
                              </h4>
                            </div>

                            <StatusBadge value={task.status} />
                          </div>

                          <div className="space-y-4 p-4">
                            <Section
                              label="Work description"
                              value={task.description}
                              icon={FileText}
                            />

                            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                              <Section
                                label="Start time"
                                value={formatDateTime(task.startTime)}
                                icon={Clock}
                              />

                              <Section
                                label="End time"
                                value={formatDateTime(task.endTime)}
                                icon={Clock}
                              />

                              <Section
                                label="Hours spent"
                                value={
                                  task.hoursSpent != null
                                    ? `${task.hoursSpent} hours`
                                    : "Not recorded"
                                }
                                icon={Timer}
                              />

                              <Section
                                label="Last updated"
                                value={formatDateTime(
                                  task.lastUpdatedAt
                                )}
                                icon={RefreshCw}
                              />

                              <Section
                                label="Review status"
                                value={
                                  task.review?.status || "Pending"
                                }
                                icon={ClipboardCheck}
                              />

                              <Section
                                label="Review deadline"
                                value={formatDateTime(
                                  task.review?.deadline
                                )}
                                icon={CalendarDays}
                              />
                            </div>

                            {/* Blocker details */}
                            {task.blockers?.length > 0 && (
                              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
                                <div className="mb-3 flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                                      <AlertTriangle size={16} />
                                    </span>

                                    <div>
                                      <h5 className="text-sm font-bold text-amber-900">
                                        Blockers & Challenges
                                      </h5>

                                      <p className="text-xs text-amber-700">
                                        {task.blockers.length} reported
                                      </p>
                                    </div>
                                  </div>
                                </div>

                                <div className="space-y-3">
                                  {task.blockers.map(
                                    (blocker, blockerIndex) => (
                                      <div
                                        key={
                                          blocker._id || blockerIndex
                                        }
                                        className="rounded-lg border border-amber-100 bg-white p-3"
                                      >
                                        <p className="whitespace-pre-line text-sm leading-6 text-slate-700">
                                          {blocker.description}
                                        </p>

                                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-100 pt-2 text-xs text-slate-500">
                                          <span>
                                            Status:{" "}
                                            <strong
                                              className={
                                                isResolvedBlocker(
                                                  blocker
                                                )
                                                  ? "text-emerald-600"
                                                  : "text-amber-700"
                                              }
                                            >
                                              {blocker.status || "Open"}
                                            </strong>
                                          </span>

                                          {blocker.assignedTo?.user
                                            ?.name && (
                                            <span className="inline-flex items-center gap-1">
                                              <UserRound size={12} />
                                              Assigned to:{" "}
                                              {
                                                blocker.assignedTo.user
                                                  .name
                                              }
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    )
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Manager remarks */}
                            {task.review?.remarks && (
                              <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4">
                                <div className="flex items-center gap-2">
                                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                                    <ClipboardCheck size={15} />
                                  </span>

                                  <p className="text-xs font-bold uppercase tracking-wider text-blue-800">
                                    Manager remarks
                                  </p>
                                </div>

                                <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">
                                  {task.review.remarks}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {!isExpanded && (
                  <div className="px-5 py-3 text-xs text-slate-400">
                    Report details are collapsed. Select "View details"
                    to see task descriptions, timings, blockers and
                    review information.
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
