
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Wallet,
  Users,
  IndianRupee,
  Plus,
  Pencil,
  RefreshCw,
  Search,
  X,
  CalendarDays,
  CheckCircle2,
  AlertCircle,
  Clock,
  FileText,
} from "lucide-react";

import api, { errMsg } from "../api";

// =====================================
// HELPERS
// =====================================

const today = () => {
  const date = new Date();

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
};

const emptyForm = {
  employeeId: "",
  basicSalary: "",
  hra: "",
  allowanceName: "",
  allowanceAmount: "",
  deductionName: "",
  deductionAmount: "",
  effectiveFrom: today(),
  notes: "",
};

const formatCurrency = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(amount) || 0);

const formatDate = (date) => {
  if (!date) return "—";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) return "—";

  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

// Extract an array from common API response structures.
const extractArray = (value, depth = 0) => {
  if (Array.isArray(value)) return value;

  if (!value || typeof value !== "object" || depth > 6) {
    return null;
  }

  const possibleKeys = [
    "employees",
    "salaries",
    "data",
    "results",
    "items",
    "docs",
    "records",
  ];

  for (const key of possibleKeys) {
    if (value[key] !== undefined) {
      const result = extractArray(value[key], depth + 1);

      if (result !== null) return result;
    }
  }

  return null;
};

const getArray = (response) => {
  return extractArray(response?.data) || [];
};

const getEmployeeName = (employee) => {
  if (!employee) return "Unknown employee";

  return (
    employee.user?.name ||
    employee.name ||
    employee.fullName ||
    employee.employeeName ||
    employee.employeeId ||
    "Unknown employee"
  );
};

const getEmployeeCode = (employee) => {
  return employee?.employeeId || "No employee ID";
};

const getSalaryTotal = (salary) => {
  const allowances = (salary?.allowances || []).reduce(
    (total, item) => total + Number(item.amount || 0),
    0
  );

  const deductions = (salary?.deductions || []).reduce(
    (total, item) => total + Number(item.amount || 0),
    0
  );

  return (
    Number(salary?.basicSalary || 0) +
    Number(salary?.hra || 0) +
    allowances -
    deductions
  );
};

// =====================================
// MAIN COMPONENT
// =====================================

export default function Payroll() {
  const [employees, setEmployees] = useState([]);
  const [salaries, setSalaries] = useState([]);

  const [loading, setLoading] = useState(true);
  const [employeeLoading, setEmployeeLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [employeeError, setEmployeeError] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingSalary, setEditingSalary] = useState(null);

  const [form, setForm] = useState(emptyForm);

  // =====================================
  // LOAD EMPLOYEES
  // =====================================

  const loadEmployees = useCallback(async () => {
    setEmployeeLoading(true);
    setEmployeeError("");

    try {
      const response = await api.get("/employees");

      console.log("Employees API response:", response.data);

      const employeeList = getArray(response);

      console.log("Extracted employee list:", employeeList);

      // Keep only valid employee records.
      const validEmployees = employeeList.filter(
        (employee) => employee && employee._id
      );

      setEmployees(validEmployees);

      if (validEmployees.length === 0) {
        setEmployeeError(
          "No employee records were returned by the employees API."
        );
      }

      return validEmployees;
    } catch (err) {
      console.error("Employees API error:", err);

      setEmployees([]);
      setEmployeeError(errMsg(err));

      return [];
    } finally {
      setEmployeeLoading(false);
    }
  }, []);

  // =====================================
  // LOAD SALARY STRUCTURES
  // =====================================

  const loadSalaries = useCallback(async () => {
    try {
      const response = await api.get("/payroll");

      console.log("Payroll API response:", response.data);

      const salaryList = getArray(response);

      setSalaries(salaryList);
    } catch (err) {
      console.error("Payroll API error:", err);
      throw err;
    }
  }, []);

  // =====================================
  // LOAD ALL DATA
  // =====================================

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    const results = await Promise.allSettled([
      loadEmployees(),
      loadSalaries(),
    ]);

    if (results[1].status === "rejected") {
      setError(errMsg(results[1].reason));
    }

    setLoading(false);
  }, [loadEmployees, loadSalaries]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // =====================================
  // DERIVED DATA
  // =====================================

  const activeSalaries = useMemo(
    () => salaries.filter((salary) => salary.status === "Active"),
    [salaries]
  );

  const totalMonthlyPayroll = useMemo(
    () =>
      activeSalaries.reduce(
        (total, salary) => total + getSalaryTotal(salary),
        0
      ),
    [activeSalaries]
  );

  const filteredSalaries = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return salaries;

    return salaries.filter((salary) => {
      const employee = salary.employee;

      return (
        getEmployeeName(employee).toLowerCase().includes(query) ||
        getEmployeeCode(employee).toLowerCase().includes(query) ||
        String(employee?.department || "").toLowerCase().includes(query) ||
        String(employee?.designation || "").toLowerCase().includes(query)
      );
    });
  }, [salaries, search]);

  // =====================================
  // FORM HELPERS
  // =====================================

  const updateField = (field, value) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const openCreateForm = async () => {
    setEditingSalary(null);

    setForm({
      ...emptyForm,
      effectiveFrom: today(),
    });

    setError("");
    setSuccess("");
    setShowForm(true);

    // Retry employee loading when opening the form.
    if (employees.length === 0) {
      await loadEmployees();
    }
  };

  const openEditForm = (salary) => {
    setEditingSalary(salary);

    const allowance = salary.allowances?.[0] || {};
    const deduction = salary.deductions?.[0] || {};

    setForm({
      employeeId: salary.employee?._id || "",
      basicSalary: salary.basicSalary ?? "",
      hra: salary.hra ?? "",
      allowanceName: allowance.name || "",
      allowanceAmount: allowance.amount ?? "",
      deductionName: deduction.name || "",
      deductionAmount: deduction.amount ?? "",
      effectiveFrom: today(),
      notes: salary.notes || "",
    });

    setError("");
    setSuccess("");
    setShowForm(true);
  };

  const closeForm = () => {
    if (saving) return;

    setShowForm(false);
    setEditingSalary(null);
    setForm({
      ...emptyForm,
      effectiveFrom: today(),
    });

    setError("");
  };

  // =====================================
  // BUILD SALARY PAYLOAD
  // =====================================

  const buildSalaryPayload = () => {
    const allowances =
      form.allowanceName.trim() && Number(form.allowanceAmount) > 0
        ? [
            {
              name: form.allowanceName.trim(),
              amount: Number(form.allowanceAmount),
            },
          ]
        : [];

    const deductions =
      form.deductionName.trim() && Number(form.deductionAmount) > 0
        ? [
            {
              name: form.deductionName.trim(),
              amount: Number(form.deductionAmount),
            },
          ]
        : [];

    return {
      basicSalary: Number(form.basicSalary),
      hra: Number(form.hra || 0),
      allowances,
      deductions,
      notes: form.notes.trim(),
    };
  };

  // =====================================
  // VALIDATE AND SAVE SALARY
  // =====================================

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (
      form.basicSalary === "" ||
      !Number.isFinite(Number(form.basicSalary)) ||
      Number(form.basicSalary) < 0
    ) {
      setError("Please enter a valid basic salary.");
      return;
    }

    if (
      form.hra !== "" &&
      (!Number.isFinite(Number(form.hra)) || Number(form.hra) < 0)
    ) {
      setError("Please enter a valid HRA amount.");
      return;
    }

    if (!editingSalary && !form.employeeId) {
      setError("Please select an employee.");
      return;
    }

    if (!editingSalary && !form.effectiveFrom) {
      setError("Please select an effective date.");
      return;
    }

    if (
      (form.allowanceName.trim() &&
        (!Number.isFinite(Number(form.allowanceAmount)) ||
          Number(form.allowanceAmount) < 0)) ||
      (form.deductionName.trim() &&
        (!Number.isFinite(Number(form.deductionAmount)) ||
          Number(form.deductionAmount) < 0))
    ) {
      setError("Please enter valid allowance and deduction amounts.");
      return;
    }

    const payload = buildSalaryPayload();

    setSaving(true);

    try {
      if (editingSalary) {
        await api.put(
          `/payroll/salary-structures/${editingSalary._id}`,
          payload
        );

        setSuccess("Salary structure updated successfully.");
      } else {
        await api.post("/payroll/salary-structures", {
          ...payload,
          employeeId: form.employeeId,
          effectiveFrom: form.effectiveFrom,
        });

        setSuccess("Salary structure created successfully.");
      }

      setShowForm(false);
      setEditingSalary(null);

      setForm({
        ...emptyForm,
        effectiveFrom: today(),
      });

      await Promise.allSettled([loadEmployees(), loadSalaries()]);
    } catch (err) {
      console.error("Save salary error:", err);
      setError(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  // =====================================
  // UI
  // =====================================

  return (
    <div className="space-y-6">
      {/* HEADER */}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-indigo-100 text-indigo-600">
            <Wallet size={23} />
          </div>

          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              Payroll Management
            </h1>

            <p className="text-sm text-slate-500">
              Manage employee salary structures and salary history.
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw
              size={16}
              className={loading ? "animate-spin" : ""}
            />
            Refresh
          </button>

          <button
            type="button"
            onClick={openCreateForm}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            <Plus size={17} />
            Add Salary
          </button>
        </div>
      </div>

      {/* GLOBAL ERROR */}

      {error && !showForm && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {/* SUCCESS */}

      {success && (
        <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          <CheckCircle2 size={18} />
          {success}

          <button
            type="button"
            onClick={() => setSuccess("")}
            className="ml-auto"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* SUMMARY CARDS */}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Total Employees</p>

              <h2 className="mt-2 text-2xl font-bold text-slate-800">
                {loading ? "—" : employees.length}
              </h2>
            </div>

            <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
              <Users size={23} />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">
                Active Salary Structures
              </p>

              <h2 className="mt-2 text-2xl font-bold text-slate-800">
                {loading ? "—" : activeSalaries.length}
              </h2>
            </div>

            <div className="rounded-xl bg-green-50 p-3 text-green-600">
              <FileText size={23} />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">
                Current Monthly Net Structure
              </p>

              <h2 className="mt-2 text-2xl font-bold text-slate-800">
                {loading ? "—" : formatCurrency(totalMonthlyPayroll)}
              </h2>
            </div>

            <div className="rounded-xl bg-indigo-50 p-3 text-indigo-600">
              <IndianRupee size={23} />
            </div>
          </div>

          <p className="mt-2 text-xs text-slate-400">
            Based on active salary structures, before attendance adjustments.
          </p>
        </div>
      </div>

      {/* SALARY FORM */}

      {showForm && (
        <div className="rounded-2xl border border-indigo-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-800">
                {editingSalary
                  ? "Update Salary Structure"
                  : "Create Salary Structure"}
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                {editingSalary
                  ? "Update the current active salary components."
                  : "Enter the employee's monthly salary details."}
              </p>
            </div>

            <button
              type="button"
              onClick={closeForm}
              disabled={saving}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            >
              <X size={20} />
            </button>
          </div>

          {/* FORM ERROR */}

          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* EMPLOYEE SELECT */}

            {!editingSalary && (
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Select Employee *
                </label>

                <select
                  value={form.employeeId}
                  onChange={(e) =>
                    updateField("employeeId", e.target.value)
                  }
                  required
                  disabled={employeeLoading || employees.length === 0}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                >
                  <option value="">
                    {employeeLoading
                      ? "Loading employees..."
                      : employees.length === 0
                        ? "No employees available"
                        : "Choose an employee"}
                  </option>

                  {employees.map((employee) => (
                    <option key={employee._id} value={employee._id}>
                      {getEmployeeName(employee)} — {getEmployeeCode(employee)}
                      {employee.department
                        ? ` — ${employee.department}`
                        : ""}
                    </option>
                  ))}
                </select>

                {employeeLoading && (
                  <p className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                    <RefreshCw size={13} className="animate-spin" />
                    Fetching employee records...
                  </p>
                )}

                {!employeeLoading && employeeError && (
                  <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                    <p>{employeeError}</p>

                    <button
                      type="button"
                      onClick={loadEmployees}
                      className="mt-2 font-semibold underline"
                    >
                      Retry loading employees
                    </button>
                  </div>
                )}

                {!employeeLoading &&
                  !employeeError &&
                  employees.length === 0 && (
                    <p className="mt-2 text-xs text-amber-600">
                      No employee records found. Check your employee
                      management page.
                    </p>
                  )}
              </div>
            )}

            {/* EDIT EMPLOYEE NAME */}

            {editingSalary && (
              <div className="rounded-xl bg-slate-50 p-3 text-sm">
                <span className="text-slate-500">Employee: </span>

                <strong className="text-slate-800">
                  {getEmployeeName(editingSalary.employee)}
                </strong>
              </div>
            )}

            {/* BASIC SALARY AND HRA */}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Basic Salary (₹) *
                </label>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.basicSalary}
                  onChange={(e) =>
                    updateField("basicSalary", e.target.value)
                  }
                  required
                  placeholder="25000"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  HRA (₹)
                </label>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.hra}
                  onChange={(e) => updateField("hra", e.target.value)}
                  placeholder="5000"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* ALLOWANCES AND DEDUCTIONS */}

            <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 p-4 sm:grid-cols-2">
              <div>
                <h3 className="mb-3 text-sm font-bold text-slate-800">
                  Allowance
                </h3>

                <input
                  value={form.allowanceName}
                  onChange={(e) =>
                    updateField("allowanceName", e.target.value)
                  }
                  placeholder="Allowance name"
                  className="mb-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
                />

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.allowanceAmount}
                  onChange={(e) =>
                    updateField("allowanceAmount", e.target.value)
                  }
                  placeholder="Amount in ₹"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <h3 className="mb-3 text-sm font-bold text-slate-800">
                  Deduction
                </h3>

                <input
                  value={form.deductionName}
                  onChange={(e) =>
                    updateField("deductionName", e.target.value)
                  }
                  placeholder="Deduction name"
                  className="mb-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
                />

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.deductionAmount}
                  onChange={(e) =>
                    updateField("deductionAmount", e.target.value)
                  }
                  placeholder="Amount in ₹"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* EFFECTIVE DATE */}

            {!editingSalary && (
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Effective From *
                </label>

                <input
                  type="date"
                  value={form.effectiveFrom}
                  onChange={(e) =>
                    updateField("effectiveFrom", e.target.value)
                  }
                  required
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 sm:max-w-xs"
                />
              </div>
            )}

            {/* NOTES */}

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Notes
              </label>

              <textarea
                rows="2"
                value={form.notes}
                onChange={(e) => updateField("notes", e.target.value)}
                placeholder="Optional notes about this salary structure..."
                className="w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
              />
            </div>

            {/* BUTTONS */}

            <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={
                  saving ||
                  (!editingSalary &&
                    (employeeLoading || employees.length === 0))
                }
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving && (
                  <RefreshCw size={16} className="animate-spin" />
                )}

                {saving
                  ? "Saving..."
                  : editingSalary
                    ? "Update Salary"
                    : "Save Salary"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* SALARY TABLE */}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-bold text-slate-800">
              Employee Salary Structures
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Current and previous salary records.
            </p>
          </div>

          <div className="relative w-full sm:max-w-xs">
            <Search
              size={17}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search employee..."
              className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 p-12 text-sm text-slate-500">
            <RefreshCw size={18} className="animate-spin" />
            Loading payroll data...
          </div>
        ) : filteredSalaries.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-400">
              <Wallet size={25} />
            </div>

            <h3 className="font-semibold text-slate-700">
              No salary records found
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              {search
                ? "Try another employee name or ID."
                : "Add a salary structure to get started."}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Employee</th>
                    <th className="px-5 py-3 font-semibold">Basic Salary</th>
                    <th className="px-5 py-3 font-semibold">HRA</th>
                    <th className="px-5 py-3 font-semibold">Net Structure</th>
                    <th className="px-5 py-3 font-semibold">Effective From</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 text-right font-semibold">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredSalaries.map((salary) => (
                    <tr
                      key={salary._id}
                      className="hover:bg-slate-50/70"
                    >
                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-800">
                          {getEmployeeName(salary.employee)}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          {getEmployeeCode(salary.employee)}
                        </p>
                      </td>

                      <td className="px-5 py-4 font-medium text-slate-700">
                        {formatCurrency(salary.basicSalary)}
                      </td>

                      <td className="px-5 py-4 text-slate-600">
                        {formatCurrency(salary.hra)}
                      </td>

                      <td className="px-5 py-4 font-semibold text-slate-800">
                        {formatCurrency(getSalaryTotal(salary))}
                      </td>

                      <td className="px-5 py-4 text-slate-600">
                        <div className="flex items-center gap-2">
                          <CalendarDays
                            size={15}
                            className="text-slate-400"
                          />
                          {formatDate(salary.effectiveFrom)}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                            salary.status === "Active"
                              ? "bg-green-50 text-green-700"
                              : salary.status === "Replaced"
                                ? "bg-blue-50 text-blue-700"
                                : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {salary.status}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-right">
                        {salary.status === "Active" &&
                        !salary.effectiveTo ? (
                          <button
                            type="button"
                            onClick={() => openEditForm(salary)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                          >
                            <Pencil size={14} />
                            Edit
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">
                            History
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
              Showing {filteredSalaries.length} of {salaries.length} salary
              records
            </div>
          </>
        )}
      </div>

      {/* INFORMATION */}

      <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        <Clock size={18} className="mt-0.5 shrink-0" />

        <p>
          <strong>Note:</strong> These amounts represent salary structures.
          Monthly payroll processing, attendance-based deductions,
          unpaid-leave calculations and payslip generation will be
          implemented separately.
        </p>
      </div>
    </div>
  );
}
