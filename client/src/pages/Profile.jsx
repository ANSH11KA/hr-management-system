import { useEffect, useState } from "react";
import { Mail, Phone, Building2, Briefcase, CalendarDays, Hash, ShieldCheck } from "lucide-react";
import api, { errMsg } from "../api";
import { useAuth } from "../hooks/useAuth";
import StatusBadge from "../components/StatusBadge";

const Item = ({ icon: Icon, label, value }) => (
  <div className="flex items-start gap-3 rounded-xl border border-slate-100 p-4">
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600"><Icon size={18} /></span>
    <div className="min-w-0">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="truncate font-medium text-slate-900">{value || "-"}</p>
    </div>
  </div>
);

export default function Profile() {
  const { user } = useAuth();
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;
    api.get("/auth/me")
      .then(r => { if (!ignore) setEmployee(r.data.employee); })
      .catch(e => { if (!ignore) setError(errMsg(e)); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, []);

  if (loading) return <div className="card h-64 max-w-3xl animate-pulse bg-slate-100" />;
  if (error) return <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">{error}</p>;
  if (!employee) return <p className="card p-6 text-slate-500">No employee record found for this account.</p>;

  const initials = user.name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="page-title">My Profile</h1>

      <div className="card overflow-hidden">
        <div className="h-24 bg-gradient-to-r from-indigo-600 to-violet-600" />
        <div className="px-6 pb-6">
          <div className="-mt-10 flex flex-wrap items-end gap-4">
            <span className="grid h-20 w-20 place-items-center rounded-2xl border-4 border-white bg-indigo-100 text-2xl font-bold text-indigo-700">
              {initials}
            </span>
            <div className="pb-1">
              <h2 className="text-xl font-bold text-slate-900">{user.name}</h2>
              <p className="text-sm text-slate-500">{employee.designation || "Employee"} · {employee.department}</p>
            </div>
            <div className="ml-auto pb-1"><StatusBadge value={employee.employmentStatus} /></div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Item icon={Mail} label="Work email" value={user.email} />
            <Item icon={Phone} label="Phone" value={employee.phone} />
            <Item icon={Hash} label="Employee ID" value={employee.employeeId} />
            <Item icon={ShieldCheck} label="Role" value={user.role === "admin" ? "HR / Admin" : "Employee"} />
            <Item icon={Building2} label="Department" value={employee.department} />
            <Item icon={Briefcase} label="Designation" value={employee.designation} />
            <Item icon={CalendarDays} label="Joining date"
              value={employee.joiningDate && new Date(employee.joiningDate).toLocaleDateString([], { day: "2-digit", month: "long", year: "numeric" })} />
          </div>

          <p className="mt-6 text-sm text-slate-500">To change employment details, please contact HR.</p>
        </div>
      </div>
    </div>
  );
}