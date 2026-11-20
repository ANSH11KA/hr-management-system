
import { useState } from "react";
import {
  useNavigate,
  Link,
  Navigate,
  useLocation,
} from "react-router-dom";

import {
  Mail,
  Lock,
  Users,
  Clock,
  CalendarCheck,
  ShieldCheck,
} from "lucide-react";

import { useAuth } from "../hooks/useAuth";
import { errMsg } from "../api";

export default function Login() {
  const {
    login,
    managerLogin,
    logout,
    user,
    loading,
  } = useAuth();

  const nav = useNavigate();
  const location = useLocation();

  const isManagerLogin =
    location.pathname === "/manager-login";

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50">
        <p className="text-sm text-slate-500">
          Checking authentication...
        </p>
      </div>
    );
  }

  if (user) {
    if (isManagerLogin && user.role !== "manager") {
      return <Navigate to="/" replace />;
    }

    return <Navigate to="/" replace />;
  }

  const submit = async (e) => {
    e.preventDefault();

    setError("");
    setBusy(true);

    try {
      let loggedInUser;

      if (isManagerLogin) {
        // Use the separate manager login API
        loggedInUser = await managerLogin(
          form.email.trim(),
          form.password
        );

        // Only managers can use the manager login page
        if (loggedInUser?.role !== "manager") {
          logout();
          setError(
            "This account is not registered as a manager."
          );
          return;
        }
      } else {
        // Regular Admin / Employee login
        loggedInUser = await login(
          form.email.trim(),
          form.password
        );
      }

      nav("/", { replace: true });
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen bg-slate-50 lg:grid-cols-2">

      {/* Left Section */}
      <div className="hidden flex-col justify-between bg-gradient-to-br from-indigo-800 via-indigo-700 to-violet-700 p-12 text-white lg:flex">

        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/15 text-xl font-bold">
            H
          </span>

          <div>
            <h2 className="text-xl font-bold">HRMS</h2>
            <p className="text-xs text-indigo-200">
              Human Resource Management
            </p>
          </div>
        </div>

        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-indigo-100">
            <ShieldCheck size={16} />
            Secure employee workspace
          </span>

          <h1 className="mt-6 text-5xl font-bold leading-tight">
            Everything HR,
            <br />
            in one place.
          </h1>

          <p className="mt-4 max-w-md leading-7 text-indigo-100">
            Manage employees, track attendance, collect
            daily reports, assign tasks and review leave
            requests from one platform.
          </p>

          <div className="mt-9 space-y-5">
            <div className="flex items-center gap-4">
              <Users size={21} />
              Employee management
            </div>

            <div className="flex items-center gap-4">
              <Clock size={21} />
              Attendance tracking
            </div>

            <div className="flex items-center gap-4">
              <CalendarCheck size={21} />
              Leave and daily report management
            </div>
          </div>
        </div>

        <p className="text-sm text-indigo-200">
          © {new Date().getFullYear()} HR Management System
        </p>
      </div>

      {/* Right Section */}
      <div className="flex items-center justify-center p-6 sm:p-10">

        <form
          onSubmit={submit}
          className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-200/50 sm:p-9"
        >

          <div className="mb-8">
            <div className="mb-5 grid h-12 w-12 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
              {isManagerLogin ? (
                <Users size={24} />
              ) : (
                <ShieldCheck size={24} />
              )}
            </div>

            <h2 className="text-3xl font-bold tracking-tight text-slate-900">
              {isManagerLogin
                ? "Manager Login"
                : "Welcome Back"}
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              {isManagerLogin
                ? "Sign in with your manager account to access your team workspace."
                : "Enter your work credentials to access your HRMS account."}
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          <div className="space-y-5">

            {/* Email */}
            <label className="block text-sm font-semibold text-slate-700">
              Work Email

              <div className="relative mt-2">
                <Mail
                  size={18}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  type="email"
                  required
                  autoComplete="username"
                  placeholder="name@company.com"
                  value={form.email}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      email: e.target.value,
                    })
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-11 pr-4 text-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                />
              </div>
            </label>

            {/* Password */}
            <label className="block text-sm font-semibold text-slate-700">
              Password

              <div className="relative mt-2">
                <Lock
                  size={18}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      password: e.target.value,
                    })
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-11 pr-4 text-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                />
              </div>
            </label>

            {/* Submit */}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "Signing in..." : "Sign in"}
            </button>

          </div>

          {/* Login Switch */}
          <div className="mt-7 border-t border-slate-100 pt-6 text-center text-sm">

            {isManagerLogin ? (
              <>
                <span className="text-slate-500">
                  Not a manager?
                </span>{" "}

                <Link
                  to="/login"
                  className="font-semibold text-indigo-600 hover:text-indigo-700"
                >
                  Regular Login
                </Link>
              </>
            ) : (
              <>
                <span className="text-slate-500">
                  Are you a manager?
                </span>{" "}

                <Link
                  to="/manager-login"
                  className="font-semibold text-indigo-600 hover:text-indigo-700"
                >
                  Manager Login
                </Link>
              </>
            )}

          </div>
        </form>
      </div>
    </div>
  );
}
