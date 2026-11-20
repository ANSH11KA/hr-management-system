
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ClipboardList,
  Plus,
  Search,
  RefreshCw,
  CalendarDays,
  User,
  Users,
  Clock,
  CheckCircle2,
  CircleAlert,
  X,
  Loader2,
  Flag,
  TrendingUp,
  Filter,
  Trash2,
  FileText,
  BriefcaseBusiness,
} from "lucide-react";

import api from "../api";
import { useAuth } from "../hooks/useAuth";

// =====================================
// CONSTANTS
// =====================================

const PRIORITIES = ["Low", "Medium", "High", "Urgent"];

const STATUSES = [
  "Pending",
  "In Progress",
  "Completed",
  "On Hold",
];

const priorityStyles = {
  Low: "bg-slate-100 text-slate-700",
  Medium: "bg-blue-100 text-blue-700",
  High: "bg-orange-100 text-orange-700",
  Urgent: "bg-red-100 text-red-700",
};

const statusStyles = {
  Pending: "bg-amber-100 text-amber-700",
  "In Progress": "bg-blue-100 text-blue-700",
  Completed: "bg-emerald-100 text-emerald-700",
  "On Hold": "bg-slate-100 text-slate-700",
};

// =====================================
// HELPER FUNCTIONS
// =====================================

const getErrorMessage = (error) => {
  return (
    error?.response?.data?.message ||
    error?.message ||
    "Something went wrong. Please try again."
  );
};

const getEmployeeName = (employee) => {
  if (!employee) return "Unknown Employee";

  if (typeof employee === "string") return employee;

  return (
    employee.user?.name ||
    employee.user?.fullName ||
    employee.name ||
    employee.fullName ||
    employee.employeeName ||
    "Employee"
  );
};

const getUserName = (user) => {
  if (!user) return "Unknown";

  if (typeof user === "string") return user;

  return user.name || user.fullName || user.email || "User";
};

const formatDate = (date) => {
  if (!date) return "Not specified";

  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const isOverdue = (task) => {
  if (!task?.dueDate || task.status === "Completed") return false;

  const due = new Date(task.dueDate);
  due.setHours(23, 59, 59, 999);

  return due < new Date();
};

// =====================================
// MAIN COMPONENT
// =====================================

export default function Tasks() {
  const { user } = useAuth();

  const role = user?.role;

  const isAdmin = role === "admin";
  const isManager = role === "manager";
  const isEmployee = role === "employee";

  const canAssign = isAdmin || isManager;
  const canDeactivate = isAdmin || isManager;

  // =====================================
  // STATES
  // =====================================

  const [tasks, setTasks] = useState([]);
  const [employees, setEmployees] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState(false);

  const [selectedTask, setSelectedTask] = useState(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState({
    title: "",
    description: "",
    assignedTo: "",
    dueDate: "",
    priority: "Medium",
  });

  const [progressForm, setProgressForm] = useState({
    status: "Pending",
    progress: 0,
    employeeRemarks: "",
  });

  // =====================================
  // FETCH TASK ASSIGNMENTS
  // =====================================

  const fetchTasks = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      setError("");

      const response = await api.get("/task-assignments");

      const assignments =
        response.data?.assignments ||
        response.data?.data?.assignments ||
        [];

      setTasks(assignments);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // =====================================
  // FETCH EMPLOYEES FOR ASSIGNMENT
  // =====================================

  const fetchEmployees = useCallback(async () => {
    if (!canAssign) {
      setEmployees([]);
      return;
    }

    try {
      // The employees endpoint is paginated. Its normal response is
      // { items: [...], pagination: {...} }, so read `items` first.
      const response = await api.get("/employees", {
        params: { page: 1, limit: 100 },
      });

      const payload = response.data;
      const list =
        (Array.isArray(payload) && payload) ||
        (Array.isArray(payload?.items) && payload.items) ||
        (Array.isArray(payload?.employees) && payload.employees) ||
        (Array.isArray(payload?.data?.items) && payload.data.items) ||
        (Array.isArray(payload?.data?.employees) && payload.data.employees) ||
        (Array.isArray(payload?.data) && payload.data) ||
        [];

      // Do not show inactive or terminated employees in the assignment list.
      const activeEmployees = list.filter(
        (employee) =>
          employee &&
          employee._id &&
          employee.employmentStatus !== "terminated" &&
          employee.employmentStatus !== "inactive" &&
          employee.user?.isActive !== false
      );

      setEmployees(activeEmployees);
    } catch (err) {
      console.error("Employee loading error:", err);
      setEmployees([]);
      setError(getErrorMessage(err));
    }
  }, [canAssign]);

  useEffect(() => {
    fetchTasks();
    fetchEmployees();
  }, [fetchTasks, fetchEmployees]);

  // =====================================
  // STATISTICS
  // =====================================

  const stats = useMemo(() => {
    return {
      total: tasks.length,

      pending: tasks.filter(
        (task) => task.status === "Pending"
      ).length,

      inProgress: tasks.filter(
        (task) => task.status === "In Progress"
      ).length,

      completed: tasks.filter(
        (task) => task.status === "Completed"
      ).length,

      overdue: tasks.filter(isOverdue).length,
    };
  }, [tasks]);

  // =====================================
  // SEARCH AND FILTER
  // =====================================

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const employeeName = getEmployeeName(task.assignedTo);

      const matchesSearch =
        task.title?.toLowerCase().includes(search.toLowerCase()) ||
        task.description?.toLowerCase().includes(search.toLowerCase()) ||
        employeeName.toLowerCase().includes(search.toLowerCase());

      const matchesStatus =
        statusFilter === "All" || task.status === statusFilter;

      const matchesPriority =
        priorityFilter === "All" || task.priority === priorityFilter;

      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [tasks, search, statusFilter, priorityFilter]);

  // =====================================
  // CREATE TASK ASSIGNMENT
  // =====================================

  const handleCreateTask = async (e) => {
    e.preventDefault();

    if (!form.title.trim()) {
      setError("Please enter a task title.");
      return;
    }

    if (!form.assignedTo) {
      setError("Please select an employee.");
      return;
    }

    if (!form.dueDate) {
      setError("Please select a due date.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      setSuccess("");

      await api.post("/task-assignments", {
        title: form.title.trim(),
        description: form.description.trim(),
        assignedTo: form.assignedTo,
        dueDate: form.dueDate,
        priority: form.priority,
      });

      setSuccess("Task assigned successfully!");

      setForm({
        title: "",
        description: "",
        assignedTo: "",
        dueDate: "",
        priority: "Medium",
      });

      setShowCreateModal(false);

      await fetchTasks(false);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  // =====================================
  // OPEN PROGRESS MODAL
  // =====================================

  const openProgressModal = (task) => {
    setSelectedTask(task);

    setProgressForm({
      status: task.status || "Pending",
      progress: task.progress ?? 0,
      employeeRemarks: task.employeeRemarks || "",
    });

    setShowProgressModal(true);
    setError("");
  };

  // =====================================
  // UPDATE TASK PROGRESS
  // =====================================

  const handleUpdateProgress = async (e) => {
    e.preventDefault();

    if (!selectedTask) return;

    if (
      progressForm.progress < 0 ||
      progressForm.progress > 100
    ) {
      setError("Progress must be between 0 and 100.");
      return;
    }

    if (
      progressForm.status === "Completed" &&
      Number(progressForm.progress) !== 100
    ) {
      setError("Completed tasks must have 100% progress.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      await api.patch(
        `/task-assignments/${selectedTask._id}/progress`,
        {
          status: progressForm.status,
          progress: Number(progressForm.progress),
          employeeRemarks: progressForm.employeeRemarks.trim(),
        }
      );

      setShowProgressModal(false);
      setSelectedTask(null);
      setSuccess("Task progress updated successfully!");

      await fetchTasks(false);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  // =====================================
  // DEACTIVATE TASK ASSIGNMENT
  // =====================================

  const handleDeactivate = async (task) => {
    const confirmed = window.confirm(
      `Are you sure you want to deactivate "${task.title}"?`
    );

    if (!confirmed) return;

    try {
      setError("");
      setSuccess("");

      await api.patch(
        `/task-assignments/${task._id}/deactivate`
      );

      setSuccess("Task deactivated successfully!");

      await fetchTasks(false);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  // =====================================
  // PROGRESS BAR
  // =====================================

  const ProgressBar = ({ value = 0 }) => (
    <div className="w-full">
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-medium text-slate-500">Progress</span>
        <span className="font-semibold text-slate-700">
          {value}%
        </span>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-blue-600 transition-all"
          style={{
            width: `${Math.min(100, Math.max(0, value))}%`,
          }}
        />
      </div>
    </div>
  );

  // =====================================
  // STAT CARD
  // =====================================

  const StatCard = ({
    title,
    value,
    icon: Icon,
    color,
    description,
  }) => (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">
            {title}
          </p>

          <h3 className="mt-2 text-3xl font-bold text-slate-800">
            {value}
          </h3>

          <p className="mt-1 text-xs text-slate-400">
            {description}
          </p>
        </div>

        <div className={`rounded-xl p-3 ${color}`}>
          <Icon size={22} />
        </div>
      </div>
    </div>
  );

  // =====================================
  // LOADING SCREEN
  // =====================================

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <Loader2
            size={36}
            className="mx-auto animate-spin text-blue-600"
          />
          <p className="mt-3 text-sm text-slate-500">
            Loading tasks...
          </p>
        </div>
      </div>
    );
  }

  // =====================================
  // MAIN UI
  // =====================================

  return (
    <div className="space-y-6 pb-10">

      {/* PAGE HEADER */}

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-blue-100 p-2.5 text-blue-700">
              <ClipboardList size={24} />
            </div>

            <div>
              <h1 className="text-2xl font-bold text-slate-800">
                {isAdmin
                  ? "Task Management"
                  : isManager
                  ? "Team Tasks"
                  : "My Tasks"}
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                {isAdmin
                  ? "Manage and assign tasks across your organization."
                  : isManager
                  ? "Assign and monitor tasks for your team."
                  : "View your assigned work and update your progress."}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => fetchTasks(false)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw
              size={16}
              className={refreshing ? "animate-spin" : ""}
            />
            Refresh
          </button>

          {canAssign && (
            <button
              onClick={() => {
                setError("");
                setShowCreateModal(true);
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              <Plus size={18} />
              Assign Task
            </button>
          )}
        </div>
      </div>

      {/* ALERTS */}

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <CircleAlert size={18} className="mt-0.5 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError("")}>
            <X size={17} />
          </button>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          <CheckCircle2 size={18} />
          <span className="flex-1">{success}</span>
          <button onClick={() => setSuccess("")}>
            <X size={17} />
          </button>
        </div>
      )}

      {/* STATISTICS */}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          title="Total Tasks"
          value={stats.total}
          icon={ClipboardList}
          color="bg-blue-100 text-blue-700"
          description="All active assignments"
        />

        <StatCard
          title="Pending"
          value={stats.pending}
          icon={Clock}
          color="bg-amber-100 text-amber-700"
          description="Waiting to start"
        />

        <StatCard
          title="In Progress"
          value={stats.inProgress}
          icon={TrendingUp}
          color="bg-indigo-100 text-indigo-700"
          description="Currently being worked on"
        />

        <StatCard
          title="Completed"
          value={stats.completed}
          icon={CheckCircle2}
          color="bg-emerald-100 text-emerald-700"
          description="Successfully completed"
        />

        <StatCard
          title="Overdue"
          value={stats.overdue}
          icon={CircleAlert}
          color="bg-red-100 text-red-700"
          description="Past their due date"
        />
      </div>

      {/* FILTERS */}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Filter size={17} />
          Search and Filters
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              type="text"
              placeholder="Search tasks or employees..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
          >
            <option value="All">All Statuses</option>
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
          >
            <option value="All">All Priorities</option>
            {PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* TASK LIST */}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

        <div className="flex flex-col justify-between gap-2 border-b border-slate-100 p-5 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-bold text-slate-800">
              {isEmployee ? "Assigned Tasks" : "Task Assignments"}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Showing {filteredTasks.length} of {tasks.length} tasks
            </p>
          </div>

          <span className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
            {isEmployee ? "My Work" : isManager ? "Team Work" : "Organization Work"}
          </span>
        </div>

        {filteredTasks.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <ClipboardList size={30} />
            </div>

            <h3 className="mt-4 text-lg font-semibold text-slate-800">
              No tasks found
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              {tasks.length === 0
                ? "There are no active task assignments yet."
                : "Try changing your search or filter settings."}
            </p>

            {canAssign && tasks.length === 0 && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
              >
                <Plus size={17} />
                Assign First Task
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 bg-slate-50/60 p-4 lg:grid-cols-2">

            {filteredTasks.map((task) => {
              const overdue = isOverdue(task);
              const employeeName = getEmployeeName(task.assignedTo);
              const assignedByName = getUserName(task.assignedBy);

              return (
                <div
                  key={task._id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-200 hover:shadow-md"
                >
                  {/* CARD HEADER */}

                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="break-words text-base font-bold text-slate-800">
                        {task.title}
                      </h3>

                      <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                        {task.description || "No description provided."}
                      </p>
                    </div>

                    <span
                      className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold ${
                        priorityStyles[task.priority] ||
                        priorityStyles.Medium
                      }`}
                    >
                      <Flag size={12} className="mr-1 inline" />
                      {task.priority || "Medium"}
                    </span>
                  </div>

                  {/* STATUS */}

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                        statusStyles[task.status] ||
                        statusStyles.Pending
                      }`}
                    >
                      {task.status || "Pending"}
                    </span>

                    {overdue && (
                      <span className="rounded-lg bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
                        Overdue
                      </span>
                    )}
                  </div>

                  {/* EMPLOYEE DETAILS */}

                  <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="flex items-center gap-2">
                      <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
                        <User size={16} />
                      </div>

                      <div className="min-w-0">
                        <p className="text-xs text-slate-400">
                          Assigned To
                        </p>
                        <p className="truncate text-sm font-semibold text-slate-700">
                          {employeeName}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="rounded-lg bg-violet-50 p-2 text-violet-600">
                        <BriefcaseBusiness size={16} />
                      </div>

                      <div className="min-w-0">
                        <p className="text-xs text-slate-400">
                          Assigned By
                        </p>
                        <p className="truncate text-sm font-semibold text-slate-700">
                          {assignedByName}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="rounded-lg bg-amber-50 p-2 text-amber-600">
                        <CalendarDays size={16} />
                      </div>

                      <div>
                        <p className="text-xs text-slate-400">
                          Due Date
                        </p>
                        <p
                          className={`text-sm font-semibold ${
                            overdue ? "text-red-600" : "text-slate-700"
                          }`}
                        >
                          {formatDate(task.dueDate)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
                        <Clock size={16} />
                      </div>

                      <div>
                        <p className="text-xs text-slate-400">
                          Created On
                        </p>
                        <p className="text-sm font-semibold text-slate-700">
                          {formatDate(task.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* PROGRESS */}

                  <div className="mt-5 border-t border-slate-100 pt-4">
                    <ProgressBar value={task.progress ?? 0} />
                  </div>

                  {/* EMPLOYEE REMARKS */}

                  {task.employeeRemarks && (
                    <div className="mt-4 rounded-xl bg-slate-50 p-3">
                      <p className="mb-1 flex items-center gap-2 text-xs font-semibold text-slate-500">
                        <FileText size={14} />
                        Employee Remarks
                      </p>

                      <p className="text-sm text-slate-700">
                        {task.employeeRemarks}
                      </p>
                    </div>
                  )}

                  {/* ACTIONS */}

                  <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                    {isEmployee && task.status !== "Completed" && (
                      <button
                        onClick={() => openProgressModal(task)}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                      >
                        <TrendingUp size={16} />
                        Update Progress
                      </button>
                    )}

                    {canDeactivate && (
                      <button
                        onClick={() => handleDeactivate(task)}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 px-3 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50"
                      >
                        <Trash2 size={15} />
                        Deactivate
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* =====================================
          CREATE TASK MODAL
      ===================================== */}

      {showCreateModal && canAssign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="my-auto w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl">

            <div className="flex items-center justify-between border-b border-slate-100 p-5">
              <div>
                <h2 className="text-lg font-bold text-slate-800">
                  Assign New Task
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Create an assignment for an employee.
                </p>
              </div>

              <button
                onClick={() => setShowCreateModal(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-4 p-5">

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Task Title *
                </label>

                <input
                  type="text"
                  maxLength={150}
                  required
                  value={form.title}
                  onChange={(e) =>
                    setForm({ ...form, title: e.target.value })
                  }
                  placeholder="Enter task title"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Description
                </label>

                <textarea
                  rows={3}
                  maxLength={2000}
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  placeholder="Describe the task..."
                  className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Assign To *
                </label>

                <select
                  required
                  value={form.assignedTo}
                  onChange={(e) =>
                    setForm({ ...form, assignedTo: e.target.value })
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500"
                >
                  <option value="">Select Employee</option>

                  {employees
                    .filter(
                      (employee) =>
                        employee.employmentStatus !== "terminated" &&
                        employee.employmentStatus !== "inactive"
                    )
                    .map((employee) => (
                      <option
                        key={employee._id}
                        value={employee._id}
                      >
                        {getEmployeeName(employee)}
                        {employee.employeeId
                          ? ` (${employee.employeeId})`
                          : ""}
                      </option>
                    ))}
                </select>

                {employees.length === 0 && (
                  <p className="mt-1 text-xs text-amber-600">
                    No employees available. Check your employee API response.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                    Due Date *
                  </label>

                  <input
                    type="date"
                    required
                    value={form.dueDate}
                    onChange={(e) =>
                      setForm({ ...form, dueDate: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                    Priority *
                  </label>

                  <select
                    value={form.priority}
                    onChange={(e) =>
                      setForm({ ...form, priority: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500"
                  >
                    {PRIORITIES.map((priority) => (
                      <option key={priority} value={priority}>
                        {priority}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {submitting && (
                    <Loader2 size={16} className="animate-spin" />
                  )}
                  Assign Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================
          UPDATE PROGRESS MODAL
      ===================================== */}

      {showProgressModal && selectedTask && isEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="my-auto w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">

            <div className="flex items-center justify-between border-b border-slate-100 p-5">
              <div>
                <h2 className="text-lg font-bold text-slate-800">
                  Update Task Progress
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {selectedTask.title}
                </p>
              </div>

              <button
                onClick={() => setShowProgressModal(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={handleUpdateProgress}
              className="space-y-4 p-5"
            >
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Task Status
                </label>

                <select
                  value={progressForm.status}
                  onChange={(e) =>
                    setProgressForm({
                      ...progressForm,
                      status: e.target.value,
                      progress:
                        e.target.value === "Completed"
                          ? 100
                          : progressForm.progress,
                    })
                  }
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
                >
                  {STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-semibold text-slate-700">
                    Completion Progress
                  </label>

                  <span className="text-sm font-bold text-blue-600">
                    {progressForm.progress}%
                  </span>
                </div>

                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  disabled={progressForm.status === "Completed"}
                  value={progressForm.progress}
                  onChange={(e) =>
                    setProgressForm({
                      ...progressForm,
                      progress: Number(e.target.value),
                    })
                  }
                  className="w-full accent-blue-600"
                />

                <div className="flex justify-between text-xs text-slate-400">
                  <span>0%</span>
                  <span>25%</span>
                  <span>50%</span>
                  <span>75%</span>
                  <span>100%</span>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Remarks
                </label>

                <textarea
                  rows={3}
                  maxLength={1000}
                  value={progressForm.employeeRemarks}
                  onChange={(e) =>
                    setProgressForm({
                      ...progressForm,
                      employeeRemarks: e.target.value,
                    })
                  }
                  placeholder="Add an update about your work..."
                  className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setShowProgressModal(false)}
                  className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {submitting && (
                    <Loader2 size={16} className="animate-spin" />
                  )}
                  Save Progress
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
