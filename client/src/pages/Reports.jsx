import { useEffect, useState } from "react";
import { Send, Pencil, CheckCircle2, Loader2, AlertTriangle, ArrowRightCircle } from "lucide-react";
import api, { errMsg } from "../api";
import { useAuth } from "../hooks/useAuth";
import Alert from "../components/Alert";

// Must match the server's business timezone (Asia/Kolkata)
const todayStr = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
const makeEmptyForm = () => ({ reportDate: todayStr(), workCompleted: "", inProgress: "", blockers: "", nextDayPlan: "" });

const Section = ({ icon: Icon, tone, label, text }) =>
  text ? (
    <div className="flex gap-3">
      <Icon size={18} className={`mt-0.5 shrink-0 ${tone}`} />
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
        <p className="whitespace-pre-line text-sm text-slate-700">{text}</p>
      </div>
    </div>
  ) : null;

export default function Reports() {
  const { user } = useAuth();
  const admin = user.role === "admin";
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState({ department: "", from: "", to: "" });
  const [form, setForm] = useState(makeEmptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState({ type: "", text: "" });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let ignore = false;
    const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
    const request = admin ? api.get("/reports", { params }) : api.get("/reports/me");
    request
      .then(r => { if (!ignore) setRows(r.data); })
      .catch(e => { if (!ignore) setMsg({ type: "error", text: errMsg(e) }); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [admin, filters, reloadKey]);

  const submit = async e => {
    e.preventDefault();
    try {
      if (editingId) await api.put(`/reports/${editingId}`, form);
      else await api.post("/reports", form);
      setMsg({ type: "ok", text: editingId ? "Report updated" : "Report submitted" });
      setForm(makeEmptyForm());
      setEditingId(null);
      setReloadKey(k => k + 1);
    } catch (err) {
      setMsg({ type: "error", text: errMsg(err) });
    }
  };

  const startEdit = r => {
    setEditingId(r._id);
    setForm({
      reportDate: r.reportDate, workCompleted: r.workCompleted,
      inProgress: r.inProgress || "", blockers: r.blockers || "", nextDayPlan: r.nextDayPlan || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const area = (label, key, required = false) => (
    <label className="block text-sm font-medium text-slate-700">{label}
      <textarea rows={3} required={required} maxLength={3000} className="mt-1 w-full"
        value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} />
    </label>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">{admin ? "Daily Activity Reports" : "My Daily Reports"}</h1>
        <p className="text-sm text-slate-500">
          {admin ? "Review what your team worked on." : "One report per day. You can edit today's report until the day ends."}
        </p>
      </div>

      {!admin && (
        <form onSubmit={submit} className="card space-y-4 p-5">
          <h2 className="font-semibold">{editingId ? "Edit today's report" : "Submit daily report"}</h2>
          <label className="block text-sm font-medium text-slate-700">Report date
            <input type="date" required disabled={!!editingId} max={todayStr()} className="mt-1 block"
              value={form.reportDate} onChange={e => setForm({ ...form, reportDate: e.target.value })} />
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            {area("Work completed", "workCompleted", true)}
            {area("Tasks in progress", "inProgress")}
            {area("Blockers / issues", "blockers")}
            {area("Next-day plan", "nextDayPlan")}
          </div>
          <div className="flex gap-2">
            <button className="btn-primary"><Send size={16} /> {editingId ? "Update report" : "Submit report"}</button>
            {editingId && (
              <button type="button" className="btn-secondary"
                onClick={() => { setEditingId(null); setForm(makeEmptyForm()); }}>Cancel</button>
            )}
          </div>
        </form>
      )}

      {admin && (
        <div className="card grid gap-3 p-4 sm:grid-cols-3">
          <label className="text-xs font-medium text-slate-500">Department
            <input placeholder="e.g. Engineering" className="mt-1 w-full"
              onBlur={e => setFilters({ ...filters, department: e.target.value })} />
          </label>
          <label className="text-xs font-medium text-slate-500">From
            <input type="date" className="mt-1 w-full" onChange={e => setFilters({ ...filters, from: e.target.value })} />
          </label>
          <label className="text-xs font-medium text-slate-500">To
            <input type="date" className="mt-1 w-full" onChange={e => setFilters({ ...filters, to: e.target.value })} />
          </label>
        </div>
      )}

      <Alert msg={msg} />

      <div className="space-y-4">
        {loading ? (
          Array.from({ length: 2 }).map((_, i) => <div key={i} className="card h-32 animate-pulse bg-slate-100" />)
        ) : rows.length === 0 ? (
          <div className="card p-10 text-center text-slate-400">No reports found</div>
        ) : rows.map(r => (
          <article key={r._id} className="card space-y-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-semibold text-slate-900">{r.reportDate}</h3>
                {admin && <p className="text-sm text-slate-500">{r.employee?.user?.name}</p>}
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
                  Submitted {new Date(r.submittedAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                </span>
                {!admin && r.reportDate === todayStr() && (
                  <button className="btn-secondary px-3 py-1.5" onClick={() => startEdit(r)}><Pencil size={14} /> Edit</button>
                )}
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Section icon={CheckCircle2} tone="text-emerald-500" label="Completed" text={r.workCompleted} />
              <Section icon={Loader2} tone="text-sky-500" label="In progress" text={r.inProgress} />
              <Section icon={AlertTriangle} tone="text-amber-500" label="Blockers" text={r.blockers} />
              <Section icon={ArrowRightCircle} tone="text-indigo-500" label="Next day" text={r.nextDayPlan} />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}