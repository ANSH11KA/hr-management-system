import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { LayoutDashboard, Users, Clock, FileText, CalendarDays, User, LogOut, Menu, X } from "lucide-react";
import { useAuth } from "../hooks/useAuth";

const adminLinks = [
  ["/", "Dashboard", LayoutDashboard],
  ["/employees", "Employees", Users],
  ["/attendance", "Attendance", Clock],
  ["/reports", "Daily Reports", FileText],
  ["/leaves", "Leave Requests", CalendarDays],
];
const empLinks = [
  ["/", "Dashboard", LayoutDashboard],
  ["/attendance", "My Attendance", Clock],
  ["/reports", "My Reports", FileText],
  ["/leaves", "My Leaves", CalendarDays],
  ["/profile", "Profile", User],
];

export default function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const links = user.role === "admin" ? adminLinks : empLinks;
  const initials = user.name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();

  const handleLogout = () => {
    if (confirm("Log out of HRMS?")) { logout(); nav("/login"); }
  };

  return (
    <div className="min-h-screen md:flex">
      {open && <div className="fixed inset-0 z-20 bg-slate-900/50 md:hidden" onClick={() => setOpen(false)} />}

      <aside className={`fixed inset-y-0 left-0 z-30 flex w-64 flex-col bg-slate-900 text-slate-300 transition-transform md:sticky md:top-0 md:h-screen md:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between px-5 py-5">
          <div className="flex items-center gap-2 text-white">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-indigo-600 font-bold">H</span>
            <span className="text-lg font-semibold">HRMS</span>
          </div>
          <button className="md:hidden" aria-label="Close menu" onClick={() => setOpen(false)}><X size={20} /></button>
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {links.map(([to, label, Icon]) => (
            <NavLink key={to} to={to} end onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  isActive ? "bg-indigo-600 text-white shadow" : "hover:bg-slate-800 hover:text-white"}`}>
              <Icon size={18} /> {label}
            </NavLink>
          ))}
        </nav>

        <button onClick={handleLogout}
          className="m-3 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 transition hover:bg-slate-800 hover:text-red-400">
          <LogOut size={18} /> Logout
        </button>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur md:px-8">
          <button className="rounded-lg p-2 hover:bg-slate-100 md:hidden" aria-label="Open menu" onClick={() => setOpen(true)}>
            <Menu size={20} />
          </button>
          <p className="hidden text-sm text-slate-500 md:block">Welcome back, <span className="font-medium text-slate-800">{user.name}</span></p>
          <div className="flex items-center gap-3">
            <div className="text-right leading-tight">
              <p className="text-sm font-medium">{user.name}</p>
              <p className="text-xs capitalize text-slate-500">{user.role === "admin" ? "HR / Admin" : "Employee"}</p>
            </div>
            <span className="grid h-9 w-9 place-items-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">{initials}</span>
          </div>
        </header>
        <main className="mx-auto max-w-7xl p-4 md:p-8"><Outlet /></main>
      </div>
    </div>
  );
}