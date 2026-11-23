
import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

import {
  LayoutDashboard,
  Users,
  Clock,
  FileText,
  CalendarDays,
  User,
  LogOut,
  Menu,
  X,
  ClipboardCheck,
  ClipboardList,
  Wallet,
  ReceiptText,
  Bell,
  CheckCheck,
  AlertTriangle,
  RefreshCw,
  Check,
  Megaphone,
  BookOpen,
  Award,
} from "lucide-react";

import { useAuth } from "../hooks/useAuth";
import api from "../api";

// HR / Admin Navigation
const adminLinks = [
  ["/", "Dashboard", LayoutDashboard],
  ["/employees", "Employees", Users],
  ["/tasks", "All Tasks", ClipboardList],
  ["/attendance", "Attendance", Clock],
  ["/reports", "Daily Reports", FileText],
  ["/leaves", "Leave Requests", CalendarDays],
  ["/payroll", "Payroll Management", Wallet],
  ["/announcements", "Announcements", Megaphone],
  ["/policies", "Company Policies", FileText],
  ["/hr-performance", "Performance Management", Award],
 
];

// Manager Navigation
const managerLinks = [
  ["/", "Dashboard", LayoutDashboard],
  ["/tasks", "Team Tasks", ClipboardList],
  ["/attendance", "Team Attendance", Clock],
  ["/reports", "Review Daily Reports", ClipboardCheck],
  ["/leaves", "Team Leave Requests", CalendarDays],
  ["/manager-performance", "Daily Performance", Award],
  ["/profile", "Profile", User],
];

// Employee Navigation
const empLinks = [
  ["/", "Dashboard", LayoutDashboard],
  ["/tasks", "My Tasks", ClipboardList],
  ["/attendance", "My Attendance", Clock],
  ["/reports", "My Reports", FileText],
  ["/leaves", "My Leaves", CalendarDays],
  ["/my-payroll", "My Payroll", ReceiptText],
  ["/profile", "Profile", User],
   ["/company-policies", "Company Policies", BookOpen],
   ["/my-performance", "My Performance", Award],
];

// =====================================
// DATE FORMATTERS
// =====================================

const formatDate = (date) => {
  if (!date) return "-";

  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatTime = (date) => {
  if (!date) return "-";

  return new Date(date).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

// =====================================
// NOTIFICATION ITEM
// =====================================

function NotificationItem({
  notification,
  onMarkRead,
  marking,
}) {
  const employee = notification.employee || {};
  const data = notification.data || {};

  const employeeName =
    data.employeeName ||
    [
      employee.personal?.firstName,
      employee.personal?.middleName,
      employee.personal?.lastName,
    ]
      .filter(Boolean)
      .join(" ") ||
    "Employee";

  const employeeCode =
    data.employeeCode ||
    employee.employeeId ||
    "-";

  const department =
    data.department ||
    employee.department ||
    "-";

  const attendanceDate =
    data.attendanceDate ||
    formatDate(notification.createdAt);

  const checkInAt =
    data.checkInAt ||
    notification.createdAt;

  const monthlyLateCount =
    data.monthlyLateCount || 0;

  const allowedLates =
    data.allowedLates ?? 2;

  const exceededAllowance =
    Boolean(data.exceededAllowance);

  return (
    <div
      className={`border-b border-slate-100 p-4 transition hover:bg-slate-50 ${
        !notification.isRead ? "bg-indigo-50/40" : "bg-white"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
            exceededAllowance
              ? "bg-red-100 text-red-600"
              : "bg-amber-100 text-amber-600"
          }`}
        >
          {exceededAllowance ? (
            <AlertTriangle size={18} />
          ) : (
            <Clock size={18} />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-slate-800">
                {notification.title || "Employee Late Arrival"}
              </p>

              <p className="mt-1 text-xs text-slate-500">
                {formatDate(notification.createdAt)}
              </p>
            </div>

            {!notification.isRead && (
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-indigo-600" />
            )}
          </div>

          <p className="mt-2 text-sm leading-5 text-slate-600">
            {notification.message}
          </p>

          <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-sm font-semibold text-slate-800">
              {employeeName}
            </p>

            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-slate-400">
                  Employee ID
                </p>
                <p className="text-xs font-medium text-slate-700">
                  {employeeCode}
                </p>
              </div>

              <div>
                <p className="text-[10px] uppercase tracking-wide text-slate-400">
                  Department
                </p>
                <p className="text-xs font-medium text-slate-700">
                  {department}
                </p>
              </div>

              <div>
                <p className="text-[10px] uppercase tracking-wide text-slate-400">
                  Check-in date
                </p>
                <p className="text-xs font-medium text-slate-700">
                  {attendanceDate}
                </p>
              </div>

              <div>
                <p className="text-[10px] uppercase tracking-wide text-slate-400">
                  Check-in time
                </p>
                <p className="text-xs font-medium text-slate-700">
                  {formatTime(checkInAt)}
                </p>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-slate-400">
                  Monthly late count
                </p>

                <p className="mt-1 text-sm font-bold text-slate-800">
                  {monthlyLateCount} / {allowedLates}
                </p>
              </div>

              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                  exceededAllowance
                    ? "bg-red-100 text-red-700"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                {exceededAllowance
                  ? "Allowance exceeded"
                  : "Within allowance"}
              </span>
            </div>
          </div>

          {!notification.isRead && (
            <button
              type="button"
              disabled={marking}
              onClick={() => onMarkRead(notification._id)}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg text-xs font-semibold text-indigo-600 transition hover:text-indigo-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Check size={14} />
              {marking ? "Updating..." : "Mark as read"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// =====================================
// MAIN LAYOUT
// =====================================

export default function Layout() {
  const { user, logout } = useAuth();

  const nav = useNavigate();

  const [open, setOpen] = useState(false);

  // Notification states
  const [notificationsOpen, setNotificationsOpen] =
    useState(false);

  const [notifications, setNotifications] =
    useState([]);

  const [unreadCount, setUnreadCount] =
    useState(0);

  const [notificationsLoading, setNotificationsLoading] =
    useState(false);

  const [notificationError, setNotificationError] =
    useState("");

  const [markingId, setMarkingId] =
    useState(null);

  const isAdmin = user?.role === "admin";

  // =====================================
  // FETCH NOTIFICATIONS
  // =====================================

  const fetchNotifications = async (showLoader = false) => {
    if (!isAdmin) return;

    if (showLoader) {
      setNotificationsLoading(true);
    }

    try {
      const response = await api.get("/notifications");

      const data = response.data;

      setNotifications(
        Array.isArray(data.notifications)
          ? data.notifications
          : []
      );

      setUnreadCount(
        Number(data.unreadCount || 0)
      );

      setNotificationError("");
    } catch (error) {
      console.error(
        "Failed to load notifications:",
        error
      );

      setNotificationError(
        error.response?.data?.message ||
          "Unable to load notifications."
      );
    } finally {
      if (showLoader) {
        setNotificationsLoading(false);
      }
    }
  };

  // Fetch on admin login and refresh every 60 seconds.
  useEffect(() => {
    if (!isAdmin) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    fetchNotifications(true);

    const interval = setInterval(() => {
      fetchNotifications(false);
    }, 60000);

    return () => clearInterval(interval);
  }, [isAdmin]);

  // =====================================
  // MARK NOTIFICATION AS READ
  // =====================================

  const handleMarkRead = async (id) => {
    if (!id || markingId) return;

    setMarkingId(id);

    try {
      await api.patch(`/notifications/${id}/read`);

      setNotifications((previous) =>
        previous.map((item) =>
          item._id === id
            ? {
                ...item,
                isRead: true,
                readAt: new Date().toISOString(),
              }
            : item
        )
      );

      setUnreadCount((previous) =>
        Math.max(previous - 1, 0)
      );
    } catch (error) {
      console.error(
        "Failed to mark notification as read:",
        error
      );

      setNotificationError(
        error.response?.data?.message ||
          "Unable to update notification."
      );
    } finally {
      setMarkingId(null);
    }
  };

  // =====================================
  // USER NAVIGATION
  // =====================================

  if (!user) return null;

  const links =
    user.role === "admin"
      ? adminLinks
      : user.role === "manager"
        ? managerLinks
        : empLinks;

  const initials = (user.name || "User")
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const roleLabel = {
    admin: "HR / Admin",
    manager: "Manager",
    employee: "Employee",
  };

  const handleLogout = () => {
    if (window.confirm("Log out of HRMS?")) {
      const manager = user.role === "manager";

      logout();

      nav(manager ? "/manager-login" : "/login", {
        replace: true,
      });
    }
  };

  // =====================================
  // RENDER
  // =====================================

  return (
    <div className="min-h-screen bg-slate-50 md:flex">
      {/* Mobile Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-20 bg-slate-900/50 backdrop-blur-sm md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-64 flex-col bg-slate-900 text-slate-300 shadow-xl transition-transform duration-300 md:sticky md:top-0 md:h-screen md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-5">
          <div className="flex items-center gap-3 text-white">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-600 text-lg font-bold shadow-lg shadow-indigo-900/30">
              H
            </span>

            <div>
              <p className="text-lg font-bold tracking-wide">
                HRMS
              </p>

              <p className="text-[10px] uppercase tracking-widest text-slate-400">
                Management System
              </p>
            </div>
          </div>

          <button
            className="rounded-lg p-2 transition hover:bg-slate-800 md:hidden"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        {/* User Role */}
        <div className="mx-4 mt-5 rounded-xl border border-white/10 bg-white/5 p-3">
          <p className="text-xs text-slate-400">
            Logged in as
          </p>

          <div className="mt-2 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />

            <p className="font-semibold text-white">
              {roleLabel[user.role] || user.role}
            </p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-5">
          <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
            Main Menu
          </p>

          {links.map(([to, label, Icon]) => (
            <NavLink
              key={to}
              to={to}
              end
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-950/30"
                    : "text-slate-400 hover:bg-white/10 hover:text-white"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    size={19}
                    className={
                      isActive
                        ? "text-white"
                        : "text-slate-400 group-hover:text-white"
                    }
                  />

                  <span className="flex-1">
                    {label}
                  </span>

                  {isActive && (
                    <span className="h-1.5 w-1.5 rounded-full bg-white" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Sidebar Footer */}
        <div className="border-t border-white/10 p-4">
          <div className="mb-3 flex items-center gap-3 rounded-xl bg-white/5 p-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-indigo-500/20 text-sm font-bold text-indigo-300">
              {initials}
            </span>

            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">
                {user.name || "User"}
              </p>

              <p className="text-xs text-slate-400">
                {roleLabel[user.role] || user.role}
              </p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-400 transition hover:bg-red-500/10 hover:text-red-400"
          >
            <LogOut size={19} />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="min-w-0 flex-1">
        {/* Header */}
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-4 backdrop-blur md:px-8">
          <div className="flex items-center gap-3">
            <button
              className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 md:hidden"
              aria-label="Open menu"
              onClick={() => setOpen(true)}
            >
              <Menu size={21} />
            </button>

            <div>
              <p className="hidden text-xs font-medium tracking-wider text-slate-400 sm:block">
                HR MANAGEMENT SYSTEM
              </p>

              <p className="text-sm font-semibold text-slate-800">
                Welcome back, {user.name || "User"}
              </p>
            </div>
          </div>

          {/* Header Actions */}
          <div className="flex items-center gap-3">
            {/* ADMIN NOTIFICATION BELL */}
            {isAdmin && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    const next = !notificationsOpen;

                    setNotificationsOpen(next);

                    if (next) {
                      fetchNotifications(true);
                    }
                  }}
                  className="relative grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-indigo-600"
                  aria-label="Notifications"
                  title="HR Notifications"
                >
                  <Bell size={20} />

                  {unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full border-2 border-white bg-red-500 px-1 text-[10px] font-bold text-white">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </button>

                {/* NOTIFICATION DROPDOWN */}
                {notificationsOpen && (
                  <>
                    <button
                      type="button"
                      aria-label="Close notifications"
                      className="fixed inset-0 z-30 cursor-default"
                      onClick={() =>
                        setNotificationsOpen(false)
                      }
                    />

                    <div className="absolute right-0 top-14 z-40 w-[min(420px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
                      {/* Dropdown Header */}
                      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4">
                        <div>
                          <h3 className="text-sm font-bold text-slate-800">
                            HR Notifications
                          </h3>

                          <p className="mt-1 text-xs text-slate-500">
                            {unreadCount} unread notification
                            {unreadCount !== 1 ? "s" : ""}
                          </p>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              fetchNotifications(true)
                            }
                            disabled={notificationsLoading}
                            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-indigo-600 disabled:opacity-50"
                            title="Refresh notifications"
                          >
                            <RefreshCw
                              size={17}
                              className={
                                notificationsLoading
                                  ? "animate-spin"
                                  : ""
                              }
                            />
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              setNotificationsOpen(false)
                            }
                            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100"
                            title="Close"
                          >
                            <X size={17} />
                          </button>
                        </div>
                      </div>

                      {/* Notification List */}
                      <div className="max-h-[65vh] overflow-y-auto">
                        {notificationsLoading &&
                        notifications.length === 0 ? (
                          <div className="flex flex-col items-center justify-center px-4 py-12 text-slate-400">
                            <RefreshCw
                              size={24}
                              className="animate-spin"
                            />

                            <p className="mt-3 text-sm">
                              Loading notifications...
                            </p>
                          </div>
                        ) : notificationError &&
                          notifications.length === 0 ? (
                          <div className="px-5 py-10 text-center">
                            <AlertTriangle
                              size={28}
                              className="mx-auto text-red-400"
                            />

                            <p className="mt-3 text-sm font-medium text-slate-700">
                              {notificationError}
                            </p>

                            <button
                              type="button"
                              onClick={() =>
                                fetchNotifications(true)
                              }
                              className="mt-3 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                            >
                              Try again
                            </button>
                          </div>
                        ) : notifications.length === 0 ? (
                          <div className="px-5 py-12 text-center">
                            <CheckCheck
                              size={32}
                              className="mx-auto text-emerald-500"
                            />

                            <p className="mt-3 text-sm font-semibold text-slate-700">
                              All caught up!
                            </p>

                            <p className="mt-1 text-xs text-slate-400">
                              No HR notifications available.
                            </p>
                          </div>
                        ) : (
                          notifications.map((notification) => (
                            <NotificationItem
                              key={notification._id}
                              notification={notification}
                              onMarkRead={handleMarkRead}
                              marking={
                                markingId === notification._id
                              }
                            />
                          ))
                        )}
                      </div>

                      {/* Dropdown Footer */}
                      {notifications.length > 0 && (
                        <div className="border-t border-slate-100 bg-slate-50 px-4 py-3">
                          <p className="text-center text-[11px] text-slate-500">
                            Showing latest {notifications.length} notifications
                          </p>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Header Profile */}
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-slate-800">
                {user.name || "User"}
              </p>

              <p className="text-xs text-slate-500">
                {roleLabel[user.role] || user.role}
              </p>
            </div>

            <span className="grid h-10 w-10 place-items-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700 ring-2 ring-indigo-50">
              {initials}
            </span>
          </div>
        </header>

        {/* Page Content */}
        <main className="mx-auto max-w-7xl p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
