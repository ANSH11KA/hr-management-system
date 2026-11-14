import { useEffect, useState } from "react";
import { LogIn, LogOut } from "lucide-react";
import api, { errMsg } from "../api";
import { useAuth } from "../hooks/useAuth";
import StatusBadge from "../components/StatusBadge";
import Alert from "../components/Alert";

const TZ = "Asia/Kolkata";
const fmt = d =>
  d ? new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZone: TZ }) : "-";
const dur = m => (m ? `${Math.floor(m / 60)}h ${m % 60}m` : "-");
const currentMonth = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date()).slice(0, 7);

const SUMMARY_STATUSES = ["Present", "Late", "Half Day", "Leave", "Absent"];

export default function Attendance() {
  const { user } = useAuth();
  const admin = user.role === "admin";
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({});
  const [month, setMonth] = useState(currentMonth);
  const [filters, setFilters] = useState({ date: "", status: "", department: "" });
  const [msg, setMsg] = useState({ type: "", text: "" });
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let ignore = false;
    const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
    const request = admin
      ? api.get("/attendance", { params })
      : api.get("/attendance/me", { params: { month } });
    request
      .then(({ data }) => {
        if (ignore) return;
        if (admin) {
          setRows(data);
        } else {
          setRows(data.items);
          setSummary(data.summary || {});
        }
      })
      .catch(e => { if (!ignore) setMsg({ type: "error", text: errMsg(e) }); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [admin, filters, month, reloadKey]);

  const act = async path => {
    try {
      await api.post(`/attendance/${path}`);
      setMsg({ type: "ok", text: path === "check-in" ? "Checked in successfully" : "Checked out successfully" });
      setReloadKey(k => k + 1);
    } catch (e) {
      setMsg({ type: "error", text: errMsg(e) });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">{admin ? "Attendance Records" : "My Attendance"}</h1>
          <p className="text-sm text-slate-500">
            {admin ? "Organisation-wide attendance with filters." : "Mark your day and review your history."}
          </p>
        </div>
        {!admin && (
          <div className="flex gap-3">
            <button onClick={() => act("check-in")} className="btn-success"><LogIn size={16} /> Check in</button>
            <button onClick={() => act("check-out")} className="btn-warning"><LogOut size={16} /> Check out</button>
          </div>
        )}
      </div>

      {admin && (
        <div className="card grid gap-3 p-4 sm:grid-cols-3">
          <label className="text-xs font-medium text-slate-500">Date
            <input type="date" className="mt-1 w-full" onChange={e => setFilters({ ...filters, date: e.target.value })} />
          </label>
          <label className="text-xs font-medium text-slate-500">Status
            <select className="mt-1 w-full" onChange={e => setFilters({ ...filters, status: e.target.value })}>
              <option value="">All statuses</option>
              {SUMMARY_STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
          </label>
          <label className="text-xs font-medium text-slate-500">Department
            <input placeholder="e.g. Engineering" className="mt-1 w-full"
              onBlur={e => setFilters({ ...filters, department: e.target.value })} />
          </label>
        </div>
      )}

      {!admin && (
        <div className="card flex flex-wrap items-center gap-x-5 gap-y-3 p-4">
          <label className="text-xs font-medium text-slate-500">Month
            <input type="month" className="mt-1 block" value={month} max={currentMonth()}
              onChange={e => e.target.value && setMonth(e.target.value)} />
          </label>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className="font-medium text-slate-500">Monthly summary:</span>
            {SUMMARY_STATUSES.map(s => (
              <span key={s} className="flex items-center gap-1.5">
                <StatusBadge value={s} />
                <span className="font-semibold text-slate-800">{summary[s] || 0}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <Alert msg={msg} />

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              {admin && <th className="px-4 py-3">Employee</th>}
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Check in</th>
              <th className="px-4 py-3">Check out</th>
              <th className="px-4 py-3">Duration</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td className="animate-pulse px-4 py-8 text-center text-slate-400" colSpan={6}>Loading records...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td className="px-4 py-10 text-center text-slate-400" colSpan={6}>No attendance records found</td></tr>
            ) : rows.map(r => (
              <tr key={r._id}>
                {admin && <td className="px-4 py-3 font-medium">{r.employee?.user?.name}</td>}
                <td className="px-4 py-3">{r.date}</td>
                <td className="px-4 py-3">{fmt(r.checkInAt)}</td>
                <td className="px-4 py-3">
                  {r.checkOutAt
                    ? fmt(r.checkOutAt)
                    : r.checkInAt
                      ? <span className="text-amber-600">Missing</span>
                      : "-"}
                </td>
                <td className="px-4 py-3">{dur(r.totalMinutes)}</td>
                <td className="px-4 py-3"><StatusBadge value={r.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}