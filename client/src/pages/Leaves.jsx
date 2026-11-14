import { useEffect, useState } from "react";
import { Send, Check, X, Ban, ClipboardList, Clock, CheckCircle2, XCircle } from "lucide-react";
import api, { errMsg } from "../api";
import { useAuth } from "../hooks/useAuth";
import StatusBadge from "../components/StatusBadge";
import Alert from "../components/Alert";

const emptyForm = { leaveType: "Casual", startDate: "", endDate: "", reason: "" };
const d = x => new Date(x).toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" });
const days = (s, e) => Math.round((new Date(e) - new Date(s)) / 86400000) + 1;
const TABS = ["All", "Pending", "Approved", "Rejected", "Cancelled"];

const Summary = ({ label, value, icon: Icon, tone }) => (
  <div className="card flex items-center gap-3 p-4">
    <span className={`grid h-10 w-10 place-items-center rounded-lg ${tone}`}><Icon size={18} /></span>
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-xl font-bold text-slate-900">{value}</p>
    </div>
  </div>
);

export default function Leaves() {
  const { user } = useAuth();
  const admin = user.role === "admin";
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("");      // admin server-side filter
  const [tab, setTab] = useState("All");          // employee client-side filter
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState({ type: "", text: "" });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let ignore = false;
    const request = admin
      ? api.get("/leaves", { params: status ? { status } : {} })
      : api.get("/leaves/me");
    request
      .then(r => { if (!ignore) setRows(r.data); })
      .catch(e => { if (!ignore) setMsg({ type: "error", text: errMsg(e) }); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [admin, status, reloadKey]);

  const apply = async e => {
    e.preventDefault();
    try {
      await api.post("/leaves", form);
      setMsg({ type: "ok", text: "Leave request submitted. It is now pending HR review." });
      setForm(emptyForm);
      setReloadKey(k => k + 1);
    } catch (err) {
      setMsg({ type: "error", text: errMsg(err) });
    }
  };

  const decide = async (id, action) => {
    const note = prompt(`Add a note for this ${action} (optional):`);
    if (note === null) return;
    try {
      await api.patch(`/leaves/${id}/${action}`, { note });
      setMsg({ type: "ok", text: `Request ${action}d` });
      setReloadKey(k => k + 1);
    } catch (err) {
      setMsg({ type: "error", text: errMsg(err) });
    }
  };

  const cancel = async id => {
    if (!confirm("Cancel this leave request?")) return;
    try {
      await api.patch(`/leaves/${id}/cancel`);
      setMsg({ type: "ok", text: "Leave request cancelled" });
      setReloadKey(k => k + 1);
    } catch (err) {
      setMsg({ type: "error", text: errMsg(err) });
    }
  };

  const count = s => rows.filter(r => r.status === s).length;
  const visible = admin || tab === "All" ? rows : rows.filter(r => r.status === tab);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">{admin ? "Leave Requests" : "My Leaves"}</h1>
          <p className="text-sm text-slate-500">
            {admin ? "Approve or reject requests from your team." : "Apply for leave and track your requests."}
          </p>
        </div>
        {admin && (
          <select aria-label="Filter by status" onChange={e => setStatus(e.target.value)}>
            <option value="">All requests</option>
            {["Pending", "Approved", "Rejected", "Cancelled"].map(s => <option key={s}>{s}</option>)}
          </select>
        )}
      </div>

      {!admin && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Summary label="Total requests" value={rows.length} icon={ClipboardList} tone="bg-indigo-50 text-indigo-600" />
            <Summary label="Pending" value={count("Pending")} icon={Clock} tone="bg-amber-50 text-amber-600" />
            <Summary label="Approved" value={count("Approved")} icon={CheckCircle2} tone="bg-emerald-50 text-emerald-600" />
            <Summary label="Rejected" value={count("Rejected")} icon={XCircle} tone="bg-red-50 text-red-600" />
          </div>

          <form onSubmit={apply} className="card grid gap-4 p-5 sm:grid-cols-3">
            <h2 className="font-semibold sm:col-span-3">Apply for leave</h2>
            <label className="block text-sm font-medium text-slate-700">Leave type
              <select className="mt-1 w-full" value={form.leaveType}
                onChange={e => setForm({ ...form, leaveType: e.target.value })}>
                {["Casual", "Sick", "Earned", "Unpaid"].map(t => <option key={t}>{t}</option>)}
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-700">Start date
              <input type="date" required className="mt-1 w-full" value={form.startDate}
                onChange={e => setForm({ ...form, startDate: e.target.value })} />
            </label>
            <label className="block text-sm font-medium text-slate-700">End date
              <input type="date" required min={form.startDate} className="mt-1 w-full" value={form.endDate}
                onChange={e => setForm({ ...form, endDate: e.target.value })} />
            </label>
            <label className="block text-sm font-medium text-slate-700 sm:col-span-3">Reason
              <textarea required maxLength={500} rows={3} className="mt-1 w-full" value={form.reason}
                onChange={e => setForm({ ...form, reason: e.target.value })} />
            </label>
            <div className="sm:col-span-3">
              <button className="btn-primary"><Send size={16} /> Submit request</button>
            </div>
          </form>

          <div className="flex flex-wrap gap-2">
            {TABS.map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                  tab === t ? "bg-indigo-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}>
                {t}
              </button>
            ))}
          </div>
        </>
      )}

      <Alert msg={msg} />

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              {admin && <th className="px-4 py-3">Employee</th>}
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Dates</th>
              <th className="px-4 py-3">Reason</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Decision</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td className="animate-pulse px-4 py-8 text-center text-slate-400" colSpan={7}>Loading requests...</td></tr>
            ) : visible.length === 0 ? (
              <tr><td className="px-4 py-10 text-center text-slate-400" colSpan={7}>No leave requests</td></tr>
            ) : visible.map(r => (
              <tr key={r._id}>
                {admin && <td className="px-4 py-3 font-medium">{r.employee?.user?.name}</td>}
                <td className="px-4 py-3">{r.leaveType}</td>
                <td className="whitespace-nowrap px-4 py-3">
                  {d(r.startDate)} – {d(r.endDate)}
                  <span className="ml-2 text-xs text-slate-400">({days(r.startDate, r.endDate)}d)</span>
                </td>
                <td className="max-w-xs px-4 py-3 text-slate-600">{r.reason}</td>
                <td className="px-4 py-3"><StatusBadge value={r.status} /></td>
                <td className="px-4 py-3 text-slate-600">
                  {r.reviewedBy ? (
                    <>
                      <p className="text-xs text-slate-400">
                        by {r.reviewedBy.name}{r.reviewedAt && ` · ${d(r.reviewedAt)}`}
                      </p>
                      <p>{r.reviewNote || "No note"}</p>
                    </>
                  ) : "-"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    {admin && r.status === "Pending" && (
                      <>
                        <button className="btn-success px-3 py-1.5" onClick={() => decide(r._id, "approve")}><Check size={14} /> Approve</button>
                        <button className="btn-danger px-3 py-1.5" onClick={() => decide(r._id, "reject")}><X size={14} /> Reject</button>
                      </>
                    )}
                    {!admin && r.status === "Pending" && (
                      <button className="btn-secondary px-3 py-1.5" onClick={() => cancel(r._id)}><Ban size={14} /> Cancel</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}