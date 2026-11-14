import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, Lock, Users, Clock, CalendarCheck } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { errMsg } from "../api";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async e => {
    e.preventDefault(); setError(""); setBusy(true);
    try { await login(form.email, form.password); nav("/"); }
    catch (err) { setError(errMsg(err)); }
    finally { setBusy(false); }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-600 p-12 text-white lg:flex">
        <div className="flex items-center gap-2 text-xl font-semibold">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-white/20 font-bold">H</span> HRMS
        </div>
        <div>
          <h1 className="text-4xl font-bold leading-tight">Everything HR,<br />in one place.</h1>
          <p className="mt-3 max-w-md text-indigo-100">Manage employees, track attendance, collect daily reports and review leave requests.</p>
          <ul className="mt-8 space-y-3 text-indigo-50">
            <li className="flex items-center gap-3"><Users size={20} /> Employee records</li>
            <li className="flex items-center gap-3"><Clock size={20} /> Attendance tracking</li>
            <li className="flex items-center gap-3"><CalendarCheck size={20} /> Leave approvals</li>
          </ul>
        </div>
        <p className="text-sm text-indigo-200">© {new Date().getFullYear()} HR Management System</p>
      </div>

      <div className="grid place-items-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm space-y-5">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Sign in</h2>
            <p className="mt-1 text-sm text-slate-500">Enter your work credentials to continue.</p>
          </div>

          {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

          <label className="block text-sm font-medium">Email
            <div className="relative mt-1">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="email" required autoComplete="email" className="w-full pl-9"
                value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            </div>
          </label>

          <label className="block text-sm font-medium">Password
            <div className="relative mt-1">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="password" required autoComplete="current-password" className="w-full pl-9"
                value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
            </div>
          </label>

          <button disabled={busy} className="btn-primary w-full py-2.5">{busy ? "Signing in..." : "Sign in"}</button>

          <div className="rounded-lg bg-slate-100 p-3 text-xs text-slate-600">
            <p className="mb-1 font-medium">Demo accounts</p>
            <p>HR: hr@demo.com · Employee: emp@demo.com</p>
            <p>Password: Password@123</p>
          </div>
        </form>
      </div>
    </div>
  );
}