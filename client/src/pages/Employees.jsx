import { useEffect, useState } from "react";
import { Plus, Search, Pencil, UserX, ChevronLeft, ChevronRight, X } from "lucide-react";
import api, { errMsg } from "../api";
import StatusBadge from "../components/StatusBadge";

const emptyForm = {
  name: "", email: "", password: "", employeeId: "", phone: "",
  department: "", designation: "", joiningDate: "", employmentStatus: "active", manager: "",
};
const emptyFilters = { department: "", status: "" };
const initials = n => (n || "?").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();

export default function Employees() {
  const [data, setData] = useState({ items: [], pages: 1, total: 0 });
  const [managers, setManagers] = useState([]);
  const [query, setQuery] = useState({ search: "", department: "", status: "", page: 1 });
  const [searchInput, setSearchInput] = useState("");
  const [filterInput, setFilterInput] = useState(emptyFilters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [modal, setModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState("");

  // main table
  useEffect(() => {
    let ignore = false;
    const params = Object.fromEntries(Object.entries(query).filter(([, v]) => v));
    api.get("/employees", { params })
      .then(r => { if (!ignore) { setData(r.data); setError(""); } })
      .catch(e => { if (!ignore) setError(errMsg(e)); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [query, reloadKey]);

  // options for the "Reporting manager" dropdown
  useEffect(() => {
    let ignore = false;
    api.get("/employees", { params: { limit: 50 } })
      .then(r => { if (!ignore) setManagers(r.data.items); })
      .catch(() => {});
    return () => { ignore = true; };
  }, [reloadKey]);

  const openCreate = () => { setEditingId(null); setForm(emptyForm); setFormError(""); setModal(true); };
  const openEdit = emp => {
    setEditingId(emp._id);
    setForm({
      ...emptyForm,
      name: emp.user?.name || "", email: emp.user?.email || "",
      employeeId: emp.employeeId, phone: emp.phone || "",
      department: emp.department, designation: emp.designation || "",
      joiningDate: emp.joiningDate?.slice(0, 10) || "",
      employmentStatus: emp.employmentStatus,
      manager: emp.manager?._id || "",
    });
    setFormError("");
    setModal(true);
  };

  const submit = async e => {
    e.preventDefault();
    setFormError("");
    try {
      if (editingId) {
        const { name, employeeId, phone, department, designation, joiningDate, employmentStatus, manager } = form;
        await api.put(`/employees/${editingId}`, {
          name, employeeId, phone, department, designation, joiningDate, employmentStatus, manager,
        });
      } else {
        await api.post("/employees", form);
      }
      setModal(false);
      setReloadKey(k => k + 1);
    } catch (err) {
      setFormError(errMsg(err));
    }
  };

  const deactivate = async emp => {
    if (!confirm(`Deactivate ${emp.user?.name}? They will no longer be able to log in.`)) return;
    try {
      await api.patch(`/employees/${emp._id}/deactivate`);
      setReloadKey(k => k + 1);
    } catch (err) {
      setError(errMsg(err));
    }
  };

  const applySearch = e => {
    e.preventDefault();
    setQuery({ search: searchInput.trim(), ...filterInput, page: 1 });
  };

  const clearFilters = () => {
    setSearchInput("");
    setFilterInput(emptyFilters);
    setQuery({ search: "", department: "", status: "", page: 1 });
  };

  const field = (label, key, props = {}) => (
    <label className="block text-sm font-medium text-slate-700">{label}
      <input className="mt-1 w-full" value={form[key]}
        onChange={e => setForm({ ...form, [key]: e.target.value })} {...props} />
    </label>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Employees</h1>
          <p className="text-sm text-slate-500">{data.total} total records</p>
        </div>
        <button onClick={openCreate} className="btn-primary"><Plus size={16} /> Add employee</button>
      </div>

      <form onSubmit={applySearch} className="card flex flex-wrap items-end gap-3 p-4">
        <div className="relative min-w-55 flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input aria-label="Search" placeholder="Search name, email or ID" className="w-full pl-9"
            value={searchInput} onChange={e => setSearchInput(e.target.value)} />
        </div>
        <input aria-label="Department" placeholder="Department" className="w-40"
          value={filterInput.department}
          onChange={e => setFilterInput({ ...filterInput, department: e.target.value })} />
        <select aria-label="Status" value={filterInput.status}
          onChange={e => setFilterInput({ ...filterInput, status: e.target.value })}>
          <option value="">All statuses</option>
          {["active", "probation", "inactive", "terminated"].map(s => <option key={s}>{s}</option>)}
        </select>
        <button className="btn-primary">Apply</button>
        <button type="button" onClick={clearFilters} className="btn-secondary">Clear</button>
      </form>

      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              <th className="px-4 py-3">Employee</th><th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">Department</th><th className="px-4 py-3">Designation</th>
              <th className="px-4 py-3">Manager</th>
              <th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td className="animate-pulse px-4 py-8 text-center text-slate-400" colSpan={7}>Loading employees...</td></tr>
            ) : data.items.length === 0 ? (
              <tr><td className="px-4 py-10 text-center text-slate-400" colSpan={7}>No employees found</td></tr>
            ) : data.items.map(emp => (
              <tr key={emp._id}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
                      {initials(emp.user?.name)}
                    </span>
                    <div>
                      <p className="font-medium text-slate-900">{emp.user?.name}</p>
                      <p className="text-xs text-slate-500">{emp.user?.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">{emp.employeeId}</td>
                <td className="px-4 py-3">{emp.department}</td>
                <td className="px-4 py-3">{emp.designation || "-"}</td>
                <td className="px-4 py-3">{emp.manager?.employeeId || "-"}</td>
                <td className="px-4 py-3"><StatusBadge value={emp.employmentStatus} /></td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <button className="rounded-lg p-2 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600"
                      aria-label={`Edit ${emp.user?.name}`} onClick={() => openEdit(emp)}><Pencil size={16} /></button>
                    {emp.user?.isActive && (
                      <button className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600"
                        aria-label={`Deactivate ${emp.user?.name}`} onClick={() => deactivate(emp)}><UserX size={16} /></button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-600">
        <span>Page {query.page} of {data.pages || 1}</span>
        <div className="flex gap-2">
          <button disabled={query.page <= 1} onClick={() => setQuery({ ...query, page: query.page - 1 })}
            className="btn-secondary"><ChevronLeft size={16} /> Prev</button>
          <button disabled={query.page >= data.pages} onClick={() => setQuery({ ...query, page: query.page + 1 })}
            className="btn-secondary">Next <ChevronRight size={16} /></button>
        </div>
      </div>

      {modal && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <form onSubmit={submit} className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">{editingId ? "Edit employee" : "Add employee"}</h3>
              <button type="button" aria-label="Close" onClick={() => setModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
            </div>
            {formError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{formError}</p>}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">{field("Full name", "name", { required: true })}</div>
              {!editingId && <div className="sm:col-span-2">{field("Work email", "email", { type: "email", required: true })}</div>}
              {!editingId && <div className="sm:col-span-2">{field("Password (min 8 chars)", "password", { type: "password", required: true, minLength: 8 })}</div>}
              {field("Employee ID", "employeeId", { required: true })}
              {field("Phone", "phone")}
              {field("Department", "department", { required: true })}
              {field("Designation", "designation")}
              {field("Joining date", "joiningDate", { type: "date", required: true })}

              <label className="block text-sm font-medium text-slate-700">Reporting manager
                <select className="mt-1 w-full" value={form.manager}
                  onChange={e => setForm({ ...form, manager: e.target.value })}>
                  <option value="">None</option>
                  {managers.filter(m => m._id !== editingId).map(m => (
                    <option key={m._id} value={m._id}>{m.user?.name} ({m.employeeId})</option>
                  ))}
                </select>
              </label>

              {editingId && (
                <label className="block text-sm font-medium text-slate-700">Status
                  <select className="mt-1 w-full" value={form.employmentStatus}
                    onChange={e => setForm({ ...form, employmentStatus: e.target.value })}>
                    {["active", "probation", "inactive", "terminated"].map(s => <option key={s}>{s}</option>)}
                  </select>
                </label>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button type="button" onClick={() => setModal(false)} className="btn-secondary">Cancel</button>
              <button className="btn-primary">{editingId ? "Save changes" : "Create employee"}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}  