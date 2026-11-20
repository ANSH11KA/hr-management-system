
import { useState } from "react";
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
} from "lucide-react";

import { useAuth } from "../hooks/useAuth";

// Admin / HR Navigation
const adminLinks = [
  ["/", "Dashboard", LayoutDashboard],
  ["/employees", "Employees", Users],
  ["/tasks", "All Tasks", ClipboardList],
  ["/attendance", "Attendance", Clock],
  ["/reports", "Daily Reports", FileText],
  ["/leaves", "Leave Requests", CalendarDays],
];

// Manager Navigation
const managerLinks = [
  ["/", "Dashboard", LayoutDashboard],
  ["/tasks", "Team Tasks", ClipboardList],
  ["/attendance", "Team Attendance", Clock],
  ["/reports", "Review Daily Reports", ClipboardCheck],
  ["/leaves", "Team Leave Requests", CalendarDays],
  ["/profile", "Profile", User],
];

// Employee Navigation
const empLinks = [
  ["/", "Dashboard", LayoutDashboard],
  ["/tasks", "My Tasks", ClipboardList],
  ["/attendance", "My Attendance", Clock],
  ["/reports", "My Reports", FileText],
  ["/leaves", "My Leaves", CalendarDays],
  ["/profile", "Profile", User],
];

export default function Layout() {
  const { user, logout } = useAuth();

  const nav = useNavigate();
  const [open, setOpen] = useState(false);

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
              <p className="text-lg font-bold tracking-wide">HRMS</p>
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
          <p className="text-xs text-slate-400">Logged in as</p>

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

                  <span className="flex-1">{label}</span>

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

          {/* Header Profile */}
          <div className="flex items-center gap-3">
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
