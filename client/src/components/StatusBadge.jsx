const styles = {
  Present: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  Late: "bg-amber-50 text-amber-700 ring-amber-200",
  "Half Day": "bg-orange-50 text-orange-700 ring-orange-200",
  Absent: "bg-red-50 text-red-700 ring-red-200",
  Leave: "bg-sky-50 text-sky-700 ring-sky-200",
  Pending: "bg-amber-50 text-amber-700 ring-amber-200",
  Approved: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  Rejected: "bg-red-50 text-red-700 ring-red-200",
  active: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  probation: "bg-amber-50 text-amber-700 ring-amber-200",
  inactive: "bg-slate-100 text-slate-600 ring-slate-200",
  terminated: "bg-red-50 text-red-700 ring-red-200",
  Cancelled: "bg-slate-100 text-slate-600 ring-slate-200",
};

export default function StatusBadge({ value }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${styles[value] || "bg-slate-100 text-slate-600 ring-slate-200"}`}>
      {value}
    </span>
  );
}