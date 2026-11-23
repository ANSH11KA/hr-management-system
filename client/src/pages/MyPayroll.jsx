
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReceiptText,
  Wallet,
  Banknote,
  TrendingUp,
  TrendingDown,
  CalendarDays,
  RefreshCw,
  AlertCircle,
  Clock,
  CheckCircle2,
} from "lucide-react";

import api from "../api";
import { errMsg } from "../api";

const formatCurrency = (amount = 0) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0);
};

const formatDate = (date) => {
  if (!date) return "Not specified";

  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const calculateComponents = (components = []) => {
  if (!Array.isArray(components)) return 0;

  return components.reduce(
    (total, item) => total + (Number(item.amount) || 0),
    0
  );
};

const getSalaryStatus = (salary) => {
  if (!salary) return "Not assigned";

  return salary.status || "Active";
};

function SummaryCard({ title, amount, icon: Icon, description }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{title}</p>

        <div className="rounded-xl bg-indigo-50 p-3 text-indigo-600">
          <Icon size={21} />
        </div>
      </div>

      <h2 className="mt-4 text-2xl font-bold text-slate-800">
        {formatCurrency(amount)}
      </h2>

      <p className="mt-1 text-xs text-slate-500">{description}</p>
    </div>
  );
}

export default function MyPayroll() {
  const [salary, setSalary] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadSalary = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get("/payroll/me");

      setSalary(response.data?.currentSalary || null);
      setHistory(
        Array.isArray(response.data?.history)
          ? response.data.history
          : []
      );
    } catch (err) {
      console.error("My payroll loading error:", err);
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSalary();
  }, [loadSalary]);

  const calculations = useMemo(() => {
    if (!salary) {
      return {
        allowances: 0,
        deductions: 0,
        gross: 0,
        net: 0,
      };
    }

    const allowances = calculateComponents(salary.allowances);
    const deductions = calculateComponents(salary.deductions);

    const gross =
      (Number(salary.basicSalary) || 0) +
      (Number(salary.hra) || 0) +
      allowances;

    return {
      allowances,
      deductions,
      gross,
      net: gross - deductions,
    };
  }, [salary]);

  if (loading) {
    return (
      <div className="flex min-h-[350px] items-center justify-center">
        <div className="text-center">
          <RefreshCw
            size={30}
            className="mx-auto animate-spin text-indigo-600"
          />
          <p className="mt-3 text-sm text-slate-500">
            Loading your payroll details...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
        <div className="flex items-center gap-3">
          <AlertCircle className="text-red-600" size={24} />

          <div>
            <h2 className="font-semibold text-red-800">
              Unable to load payroll
            </h2>
            <p className="mt-1 text-sm text-red-700">{error}</p>
          </div>
        </div>

        <button
          onClick={loadSalary}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          <RefreshCw size={16} />
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            My Payroll
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            View your salary structure, earnings and deductions.
          </p>
        </div>

        <button
          onClick={loadSalary}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {/* No salary assigned */}
      {!salary ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-indigo-50 text-indigo-600">
            <ReceiptText size={30} />
          </div>

          <h2 className="text-lg font-semibold text-slate-800">
            No Active Salary Structure
          </h2>

          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
            HR has not assigned an effective salary structure to your
            employee profile yet. Your salary details will appear here
            once HR assigns one.
          </p>

          {history.length > 0 && (
            <p className="mt-4 text-xs text-slate-500">
              You have {history.length} previous salary record(s), but
              none is currently effective.
            </p>
          )}
        </div>
      ) : (
        <>
          {/* Current salary status */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="text-emerald-600" size={23} />

              <div>
                <p className="font-semibold text-emerald-800">
                  Current Salary Structure
                </p>

                <p className="text-xs text-emerald-700">
                  Effective from {formatDate(salary.effectiveFrom)}
                </p>
              </div>
            </div>

            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
              {getSalaryStatus(salary)}
            </span>
          </div>

          {/* Salary summary */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              title="Basic Salary"
              amount={salary.basicSalary}
              icon={Wallet}
              description="Monthly basic pay"
            />

            <SummaryCard
              title="Total Allowances"
              amount={calculations.allowances + (Number(salary.hra) || 0)}
              icon={TrendingUp}
              description="HRA and other allowances"
            />

            <SummaryCard
              title="Total Deductions"
              amount={calculations.deductions}
              icon={TrendingDown}
              description="Configured monthly deductions"
            />

            <SummaryCard
              title="Estimated Net Salary"
              amount={calculations.net}
              icon={Banknote}
              description="Gross salary minus configured deductions"
            />
          </div>

          {/* Salary breakdown */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-800">
                Earnings Breakdown
              </h2>

              <div className="mt-5 space-y-4">
                <div className="flex justify-between gap-3 border-b border-slate-100 pb-3">
                  <span className="text-sm text-slate-600">
                    Basic Salary
                  </span>
                  <span className="font-semibold text-slate-800">
                    {formatCurrency(salary.basicSalary)}
                  </span>
                </div>

                <div className="flex justify-between gap-3 border-b border-slate-100 pb-3">
                  <span className="text-sm text-slate-600">HRA</span>
                  <span className="font-semibold text-slate-800">
                    {formatCurrency(salary.hra)}
                  </span>
                </div>

                {(salary.allowances || []).map((item, index) => (
                  <div
                    key={`${item.name}-${index}`}
                    className="flex justify-between gap-3 border-b border-slate-100 pb-3"
                  >
                    <span className="text-sm text-slate-600">
                      {item.name}
                    </span>

                    <span className="font-semibold text-slate-800">
                      {formatCurrency(item.amount)}
                    </span>
                  </div>
                ))}

                <div className="flex justify-between gap-3 pt-2">
                  <span className="font-semibold text-slate-800">
                    Gross Monthly Salary
                  </span>

                  <span className="font-bold text-emerald-700">
                    {formatCurrency(calculations.gross)}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-800">
                Deductions Breakdown
              </h2>

              <div className="mt-5 space-y-4">
                {salary.deductions?.length > 0 ? (
                  salary.deductions.map((item, index) => (
                    <div
                      key={`${item.name}-${index}`}
                      className="flex justify-between gap-3 border-b border-slate-100 pb-3"
                    >
                      <span className="text-sm text-slate-600">
                        {item.name}
                      </span>

                      <span className="font-semibold text-red-600">
                        {formatCurrency(item.amount)}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                    No deductions have been configured.
                  </p>
                )}

                <div className="flex justify-between gap-3 border-t border-slate-100 pt-4">
                  <span className="font-semibold text-slate-800">
                    Total Deductions
                  </span>

                  <span className="font-bold text-red-600">
                    {formatCurrency(calculations.deductions)}
                  </span>
                </div>

                <div className="flex justify-between gap-3 rounded-xl bg-indigo-50 p-4">
                  <span className="font-semibold text-indigo-900">
                    Estimated Net Salary
                  </span>

                  <span className="font-bold text-indigo-700">
                    {formatCurrency(calculations.net)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Salary information */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-800">
              Salary Information
            </h2>

            <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <p className="text-xs text-slate-500">Salary Frequency</p>
                <p className="mt-1 font-medium text-slate-800">
                  {salary.salaryFrequency || "Monthly"}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500">Currency</p>
                <p className="mt-1 font-medium text-slate-800">
                  {salary.currency || "INR"}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500">Effective From</p>
                <p className="mt-1 flex items-center gap-2 font-medium text-slate-800">
                  <CalendarDays size={16} />
                  {formatDate(salary.effectiveFrom)}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500">Created By</p>
                <p className="mt-1 font-medium text-slate-800">
                  {salary.createdBy?.name || "HR"}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500">Last Updated</p>
                <p className="mt-1 flex items-center gap-2 font-medium text-slate-800">
                  <Clock size={16} />
                  {formatDate(salary.updatedAt)}
                </p>
              </div>
            </div>

            {salary.notes && (
              <div className="mt-5 border-t border-slate-100 pt-4">
                <p className="text-xs text-slate-500">HR Notes</p>
                <p className="mt-1 text-sm text-slate-700">
                  {salary.notes}
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Salary history */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5">
          <h2 className="text-lg font-semibold text-slate-800">
            Salary History
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Your previous and current salary structures.
          </p>
        </div>

        {history.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-500">
            No salary history available.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-4">Effective From</th>
                  <th className="px-5 py-4">Effective To</th>
                  <th className="px-5 py-4">Basic Salary</th>
                  <th className="px-5 py-4">Gross Salary</th>
                  <th className="px-5 py-4">Status</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {history.map((item) => {
                  const gross =
                    (Number(item.basicSalary) || 0) +
                    (Number(item.hra) || 0) +
                    calculateComponents(item.allowances);

                  return (
                    <tr key={item._id} className="hover:bg-slate-50">
                      <td className="px-5 py-4 text-slate-700">
                        {formatDate(item.effectiveFrom)}
                      </td>

                      <td className="px-5 py-4 text-slate-700">
                        {formatDate(item.effectiveTo)}
                      </td>

                      <td className="px-5 py-4 font-medium text-slate-800">
                        {formatCurrency(item.basicSalary)}
                      </td>

                      <td className="px-5 py-4 font-medium text-slate-800">
                        {formatCurrency(gross)}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            item.status === "Active"
                              ? "bg-emerald-50 text-emerald-700"
                              : item.status === "Replaced"
                                ? "bg-slate-100 text-slate-600"
                                : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-slate-400">
        Note: The net salary shown is an estimate based on the salary
        components and deductions configured by HR. It is not a processed
        payslip or final monthly payment calculation.
      </p>
    </div>
  );
}
