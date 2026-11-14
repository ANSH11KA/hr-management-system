import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Users, UserCheck, UserX, CalendarClock, CalendarOff, FileCheck2, FileWarning,
  Clock, FileText, CalendarDays,
} from "lucide-react";
import api, { errMsg } from "../api";
import { useAuth } from "../hooks/useAuth";
import StatusBadge from "../components/StatusBadge";

const tones = {
  indigo: "bg-indigo-50 text-indigo-600",
  green: "bg-emerald-50 text-emerald-600",
  red: "bg-red-50 text-red-600",
  amber: "bg-amber-50 text-amber-600",
  sky: "bg-sky-50 text-sky-600",
};

const fmtDate = x =>
  new Date(x).toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" });

const Stat = ({ label, value, icon: Icon, tone = "indigo" }) => (
  <div className="card flex items-center gap-4 p-5">
    <span className={`grid h-12 w-12 place-items-center rounded-xl ${tones[tone]}`}><Icon size={22} /></span>
    <div>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
    </div>
  </div>
);

const Skeleton = ({ count = 6 }) => (
  <div className="space-y-6">
    <div className="h-8 w-48 animate-pulse rounded bg-slate-200" />
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => <div key={i} className="card h-24 animate-pulse bg-slate-100" />)}
    </div>
  </div>
);

const ListCard = ({ title, empty, items, render }) => (
  <div className="card p-5">
    <h2 className="mb-3 font-semibold">{title}</h2>
    {items.length === 0 ? (
      <p className="py-4 text-center text-sm text-slate-400">{empty}</p>
    ) : (
      <ul className="divide-y divide-slate-100">
        {items.map(item => (
          <li key={item._id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
            {render(item)}
          </li>
        ))}
      </ul>
    )}
  </div>
);

export default function Dashboard() {
  const { user } = useAuth();
  const [d, setD] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;
    api.get("/dashboard")
      .then(r => { if (!ignore) setD(r.data); })
      .catch(e => { if (!ignore) setError(errMsg(e)); });
    return () => { ignore = true; };
  }, []);

  if (error) return <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">{error}</p>;
  if (!d) return <Skeleton count={user.role === "admin" ? 7 : 3} />;

  // ---------- HR / Admin ----------
  if (user.role === "admin") return (
    <div className="space-y-6">
      <h1 className="page-title">HR Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat label="Active employees" value={d.activeEmployees} icon={Users} tone="indigo" />
        <Stat label="Present today" value={d.presentToday} icon={UserCheck} tone="green" />
        <Stat label="Absent today" value={d.absentToday} icon={UserX} tone="red" />
        <Stat label="On leave today" value={d.onLeaveToday} icon={CalendarOff} tone="sky" />
        <Stat label="Pending leave requests" value={d.pendingLeaves} icon={CalendarClock} tone="amber" />
        <Stat label="DARs submitted today" value={d.darsToday} icon={FileCheck2} tone="green" />
        <Stat label="DARs missing" value={d.darsMissing} icon={FileWarning} tone="red" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ListCard
          title="Recent leave requests" empty="No leave requests yet"
          items={d.recentLeaves || []}
          render={l => (
            <>
              <span>
                <span className="font-medium">{l.employee?.user?.name}</span>
                <span className="text-slate-500"> · {l.leaveType}</span>
              </span>
              <StatusBadge value={l.status} />
            </>
          )}
        />
        <ListCard
          title="Recent daily reports" empty="No reports yet"
          items={d.recentReports || []}
          render={r => (
            <>
              <span className="font-medium">{r.employee?.user?.name}</span>
              <span className="text-slate-500">{r.reportDate}</span>
            </>
          )}
        />
      </div>
    </div>
  );

  // ---------- Employee ----------
  const att = d.attendance;
  const leave = d.latestLeave;

  return (
    <div className="space-y-6">
      <h1 className="page-title">Hello, {user.name.split(" ")[0]} 👋</h1>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Today's attendance" icon={Clock} tone={att ? "green" : "amber"}
          value={att ? (att.checkOutAt ? "Checked out" : "Checked in") : "Not marked"} />
        <Stat label="Today's DAR" icon={FileText} tone={d.submittedDarToday ? "green" : "amber"}
          value={d.submittedDarToday ? "Submitted" : "Not submitted"} />
        <div className="card flex items-center gap-4 p-5">
          <span className={`grid h-12 w-12 place-items-center rounded-xl ${tones.indigo}`}><CalendarDays size={22} /></span>
          <div>
            <p className="text-sm text-slate-500">Latest leave</p>
            {leave
              ? <StatusBadge value={leave.status} />
              : <p className="text-2xl font-bold text-slate-900">No requests</p>}
          </div>
        </div>
      </div>

      {leave?.reviewNote && (
        <p className="card p-4 text-sm text-slate-600">
          HR note on your last leave{leave.reviewedBy?.name && ` (${leave.reviewedBy.name})`}: {leave.reviewNote}
        </p>
      )}

      <div className="card p-5">
        <h2 className="mb-3 font-semibold">Quick actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link to="/attendance" className="btn-success"><Clock size={16} /> Mark attendance</Link>
          <Link to="/reports" className="btn-primary"><FileText size={16} /> Submit DAR</Link>
          <Link to="/leaves" className="btn-secondary"><CalendarDays size={16} /> Apply for leave</Link>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ListCard
          title="My recent leave requests" empty="You haven't requested any leave"
          items={d.recentLeaves || []}
          render={l => (
            <>
              <span>
                <span className="font-medium">{l.leaveType}</span>
                <span className="text-slate-500"> · {fmtDate(l.startDate)} – {fmtDate(l.endDate)}</span>
              </span>
              <StatusBadge value={l.status} />
            </>
          )}
        />
        <ListCard
          title="My recent reports" empty="You haven't submitted any reports"
          items={d.recentReports || []}
          render={r => (
            <>
              <span className="font-medium">{r.reportDate}</span>
              <span className="text-slate-500">
                {new Date(r.submittedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })}
              </span>
            </>
          )}
        />
      </div>
    </div>
  );
}