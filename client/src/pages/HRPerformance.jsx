
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Award,
  CalendarDays,
  Star,
  Users,
  Search,
  RefreshCw,
  Save,
  ClipboardList,
  MessageSquare,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  UserRound,
} from "lucide-react";
import api, { errMsg } from "../api";

const getTodayIST = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day}`;
};

const getMonthEnd = (month) => {
  const [year, monthNumber] = month.split("-").map(Number);

  return new Date(Date.UTC(year, monthNumber, 0))
    .toISOString()
    .slice(0, 10);
};

const getSubmissionDeadline = (month) => {
  const [year, monthNumber] = month.split("-").map(Number);

  return new Date(Date.UTC(year, monthNumber + 1, 0))
    .toISOString()
    .slice(0, 10);
};

const isReviewWindowOpen = (month) => {
  const today = getTodayIST();

  return (
    today >= getMonthEnd(month) &&
    today <= getSubmissionDeadline(month)
  );
};

const getPreviousMonth = () => {
  const today = getTodayIST();
  const [year, month] = today.slice(0, 7).split("-").map(Number);

  const date = new Date(Date.UTC(year, month - 2, 1));

  return `${date.getUTCFullYear()}-${String(
    date.getUTCMonth() + 1
  ).padStart(2, "0")}`;
};

const getAvailableReviewMonths = () => {
  const today = getTodayIST();
  const [year, month] = today.slice(0, 7).split("-").map(Number);

  const months = [];

  for (let offset = 0; offset < 12; offset += 1) {
    const date = new Date(Date.UTC(year, month - 1 - offset, 1));
    const key = `${date.getUTCFullYear()}-${String(
      date.getUTCMonth() + 1
    ).padStart(2, "0")}`;

    if (isReviewWindowOpen(key)) {
      months.push(key);
    }
  }

  return months;
};

const formatMonth = (month) => {
  if (!month) return "";

  const [year, monthNumber] = month.split("-").map(Number);

  return new Date(Date.UTC(year, monthNumber - 1, 1)).toLocaleDateString(
    "en-IN",
    {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }
  );
};

const formatDate = (date) => {
  if (!date) return "—";

  const parsed = new Date(`${date}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) return date;

  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const getEmployeeName = (employee) => {
  if (!employee) return "Unknown employee";

  const firstName = employee.personal?.firstName || "";
  const lastName = employee.personal?.lastName || "";

  return `${firstName} ${lastName}`.trim() || "Employee";
};

const getReviewerName = (review) => {
  const reviewerEmployee = review?.reviewerEmployee;

  if (reviewerEmployee) {
    const name = getEmployeeName(reviewerEmployee);

    if (name !== "Employee" && name !== "Unknown employee") {
      return name;
    }
  }

  return (
    review?.reviewer?.name ||
    review?.reviewer?.email ||
    "Manager"
  );
};

const getInitials = (name) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");

const emptyForm = {
  rating: "",
  reasoning: "",
  strengths: "",
  improvementAreas: "",
  actionPlan: "",
};

export default function HRPerformance() {
  const availableMonths = useMemo(() => getAvailableReviewMonths(), []);

  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(
    availableMonths[0] || getPreviousMonth()
  );

  const [dailyReviews, setDailyReviews] = useState([]);
  const [monthlyReviews, setMonthlyReviews] = useState([]);
  const [form, setForm] = useState(emptyForm);

  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selectedEmployeeData = useMemo(
    () => employees.find((employee) => employee._id === selectedEmployee),
    [employees, selectedEmployee]
  );

  const selectedMonthlyReview = useMemo(
    () =>
      monthlyReviews.find(
        (review) => review.employee?._id === selectedEmployee
      ),
    [monthlyReviews, selectedEmployee]
  );

  const reviewWindowOpen = isReviewWindowOpen(selectedMonth);
  const availableFrom = getMonthEnd(selectedMonth);
  const submissionDeadline = getSubmissionDeadline(selectedMonth);

  const fetchEmployees = useCallback(async () => {
    setLoadingEmployees(true);
    setError("");

    try {
      const response = await api.get("/performance/hr/employees");
      const list = response.data?.employees || [];

      setEmployees(list);

      setSelectedEmployee((current) => {
        if (current && list.some((employee) => employee._id === current)) {
          return current;
        }

        return list[0]?._id || "";
      });
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoadingEmployees(false);
    }
  }, []);

  const fetchReviews = useCallback(async () => {
    if (!selectedMonth) return;

    setLoadingReviews(true);
    setError("");

    try {
      const params = { month: selectedMonth };

      if (selectedEmployee) {
        params.employeeId = selectedEmployee;
      }

      const [dailyResponse, monthlyResponse] = await Promise.all([
        api.get("/performance/hr/daily", { params }),
        api.get("/performance/hr/monthly", { params }),
      ]);

      setDailyReviews(dailyResponse.data?.reviews || []);
      setMonthlyReviews(monthlyResponse.data?.reviews || []);
    } catch (err) {
      setError(errMsg(err));
      setDailyReviews([]);
      setMonthlyReviews([]);
    } finally {
      setLoadingReviews(false);
    }
  }, [selectedMonth, selectedEmployee]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  useEffect(() => {
    if (!selectedEmployee) {
      setForm(emptyForm);
      return;
    }

    if (selectedMonthlyReview) {
      setForm({
        rating: String(selectedMonthlyReview.rating ?? ""),
        reasoning: selectedMonthlyReview.reasoning || "",
        strengths: selectedMonthlyReview.strengths || "",
        improvementAreas: selectedMonthlyReview.improvementAreas || "",
        actionPlan: selectedMonthlyReview.actionPlan || "",
      });
    } else {
      setForm(emptyForm);
    }
  }, [selectedEmployee, selectedMonth, selectedMonthlyReview]);

  const handleFormChange = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleSaveReview = async (event) => {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!selectedEmployee) {
      setError("Please select an employee.");
      return;
    }

    if (!reviewWindowOpen) {
      setError(
        `The review window is closed. You can submit this review from ${formatDate(
          availableFrom
        )} to ${formatDate(submissionDeadline)}.`
      );
      return;
    }

    const rating = Number(form.rating);

    if (!Number.isInteger(rating) || rating < 1 || rating > 10) {
      setError("Please enter a whole-number rating between 1 and 10.");
      return;
    }

    if (form.reasoning.trim().length < 10) {
      setError("Reasoning must contain at least 10 characters.");
      return;
    }

    if (
      form.strengths.trim().length > 1500 ||
      form.improvementAreas.trim().length > 1500 ||
      form.actionPlan.trim().length > 1500
    ) {
      setError("Each optional feedback field must be 1500 characters or less.");
      return;
    }

    setSaving(true);

    try {
      await api.post("/performance/hr/monthly", {
        employeeId: selectedEmployee,
        month: selectedMonth,
        rating,
        reasoning: form.reasoning.trim(),
        strengths: form.strengths.trim(),
        improvementAreas: form.improvementAreas.trim(),
        actionPlan: form.actionPlan.trim(),
      });

      setSuccess(
        selectedMonthlyReview
          ? "Monthly HR performance review updated successfully."
          : "Monthly HR performance review submitted successfully."
      );

      await fetchReviews();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  const handleRefresh = async () => {
    await Promise.all([fetchEmployees(), fetchReviews()]);
  };

  const fullName = getEmployeeName(selectedEmployeeData);

  const averageDailyRating = dailyReviews.length
    ? (
        dailyReviews.reduce((sum, review) => sum + review.rating, 0) /
        dailyReviews.length
      ).toFixed(1)
    : "—";

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-indigo-600">
              <Award size={17} />
              Human Resources
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Performance Management
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Review daily manager feedback and submit independent monthly HR
              evaluations.
            </p>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={loadingEmployees || loadingReviews}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw
              size={16}
              className={
                loadingEmployees || loadingReviews ? "animate-spin" : ""
              }
            />
            Refresh
          </button>
        </div>

        {/* Alerts */}
        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle size={19} className="mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {success && (
          <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            <CheckCircle2 size={19} className="mt-0.5 shrink-0" />
            <p>{success}</p>
          </div>
        )}

        {/* Filters */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Search size={18} className="text-indigo-600" />
            <h2 className="font-semibold text-slate-900">
              Select employee and review month
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label
                htmlFor="performanceEmployee"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Employee
              </label>

              <select
                id="performanceEmployee"
                value={selectedEmployee}
                onChange={(event) => {
                  setSelectedEmployee(event.target.value);
                  setError("");
                  setSuccess("");
                }}
                disabled={loadingEmployees || employees.length === 0}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100"
              >
                {employees.length === 0 && (
                  <option value="">No active employees found</option>
                )}

                {employees.map((employee) => (
                  <option key={employee._id} value={employee._id}>
                    {getEmployeeName(employee)}
                    {employee.employeeId ? ` (${employee.employeeId})` : ""}
                    {employee.department ? ` - ${employee.department}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="performanceMonth"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Review month
              </label>

              <select
                id="performanceMonth"
                value={selectedMonth}
                onChange={(event) => {
                  setSelectedMonth(event.target.value);
                  setError("");
                  setSuccess("");
                }}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              >
                {availableMonths.length === 0 && (
                  <option value={selectedMonth}>
                    {formatMonth(selectedMonth)}
                  </option>
                )}

                {availableMonths.map((month) => (
                  <option key={month} value={month}>
                    {formatMonth(month)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedEmployeeData && (
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
              <span className="inline-flex items-center gap-2">
                <UserRound size={15} />
                <strong className="text-slate-800">{fullName}</strong>
              </span>

              {selectedEmployeeData.employeeId && (
                <span>
                  ID:{" "}
                  <strong className="text-slate-800">
                    {selectedEmployeeData.employeeId}
                  </strong>
                </span>
              )}

              {selectedEmployeeData.department && (
                <span>
                  Department:{" "}
                  <strong className="text-slate-800">
                    {selectedEmployeeData.department}
                  </strong>
                </span>
              )}

              {selectedEmployeeData.designation && (
                <span>
                  Designation:{" "}
                  <strong className="text-slate-800">
                    {selectedEmployeeData.designation}
                  </strong>
                </span>
              )}
            </div>
          )}
        </section>

        {/* Summary cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">
                Active employees
              </p>
              <Users className="text-indigo-600" size={20} />
            </div>
            <p className="mt-3 text-3xl font-bold text-slate-900">
              {loadingEmployees ? "—" : employees.length}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Including managers
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">
                Daily manager reviews
              </p>
              <ClipboardList className="text-blue-600" size={20} />
            </div>
            <p className="mt-3 text-3xl font-bold text-slate-900">
              {loadingReviews ? "—" : dailyReviews.length}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              For selected employee and month
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">
                Average daily rating
              </p>
              <Star className="text-amber-500" size={20} />
            </div>
            <p className="mt-3 text-3xl font-bold text-slate-900">
              {loadingReviews ? "—" : averageDailyRating}
              {averageDailyRating !== "—" && (
                <span className="ml-1 text-base font-medium text-slate-400">
                  / 10
                </span>
              )}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Informational only; not used to calculate HR rating
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">
                HR monthly review
              </p>
              <Award className="text-emerald-600" size={20} />
            </div>
            <p className="mt-3 text-3xl font-bold text-slate-900">
              {loadingReviews
                ? "—"
                : selectedMonthlyReview
                  ? `${selectedMonthlyReview.rating}/10`
                  : "Pending"}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {selectedMonthlyReview
                ? "Review submitted"
                : "Not submitted for this month"}
            </p>
          </div>
        </div>

        {/* Submission window */}
        <section
          className={`rounded-2xl border p-5 shadow-sm ${
            reviewWindowOpen
              ? "border-emerald-200 bg-emerald-50"
              : "border-amber-200 bg-amber-50"
          }`}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              {reviewWindowOpen ? (
                <CheckCircle2
                  size={21}
                  className="mt-0.5 shrink-0 text-emerald-700"
                />
              ) : (
                <Clock
                  size={21}
                  className="mt-0.5 shrink-0 text-amber-700"
                />
              )}

              <div>
                <h3
                  className={`font-semibold ${
                    reviewWindowOpen ? "text-emerald-900" : "text-amber-900"
                  }`}
                >
                  {reviewWindowOpen
                    ? "Monthly review submission window is open"
                    : "Monthly review submission window is closed"}
                </h3>

                <p
                  className={`mt-1 text-sm ${
                    reviewWindowOpen
                      ? "text-emerald-800"
                      : "text-amber-800"
                  }`}
                >
                  {formatMonth(selectedMonth)} reviews can be submitted from{" "}
                  <strong>{formatDate(availableFrom)}</strong> until{" "}
                  <strong>{formatDate(submissionDeadline)}</strong>.
                </p>
              </div>
            </div>

            <span
              className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${
                reviewWindowOpen
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {reviewWindowOpen ? "Open" : "Closed"}
            </span>
          </div>
        </section>

        {/* Manager daily reviews */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col justify-between gap-3 border-b border-slate-200 p-5 sm:flex-row sm:items-center">
            <div>
              <div className="flex items-center gap-2">
                <ClipboardList size={20} className="text-indigo-600" />
                <h2 className="text-lg font-bold text-slate-900">
                  Manager Daily Performance Reviews
                </h2>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                Daily ratings and feedback submitted by the employee's manager.
              </p>
            </div>

            <span className="w-fit rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
              {dailyReviews.length} reviews
            </span>
          </div>

          {loadingReviews ? (
            <div className="p-10 text-center text-sm text-slate-500">
              Loading daily performance reviews...
            </div>
          ) : dailyReviews.length === 0 ? (
            <div className="p-10 text-center">
              <ClipboardList
                size={34}
                className="mx-auto text-slate-300"
              />
              <p className="mt-3 font-semibold text-slate-700">
                No daily reviews found
              </p>
              <p className="mt-1 text-sm text-slate-500">
                No manager ratings are available for this employee and month.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {dailyReviews.map((review) => {
                const employeeName = getEmployeeName(review.employee);
                const managerName = getReviewerName(review);

                return (
                  <article key={review._id} className="p-5">
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
                          {getInitials(managerName || "M")}
                        </div>

                        <div>
                          <p className="font-semibold text-slate-900">
                            {employeeName}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            Reviewed by {managerName}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="inline-flex items-center gap-1 text-sm text-slate-500">
                          <CalendarDays size={15} />
                          {formatDate(review.periodKey)}
                        </span>

                        <span className="inline-flex items-center gap-1 rounded-xl bg-amber-50 px-3 py-2 text-sm font-bold text-amber-700">
                          <Star size={15} />
                          {review.rating}/10
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 lg:grid-cols-2">
                      <div className="rounded-xl bg-slate-50 p-4">
                        <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                          <MessageSquare size={14} />
                          Reasoning
                        </p>
                        <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                          {review.reasoning || "No reasoning provided."}
                        </p>
                      </div>

                      <div className="space-y-3">
                        {review.strengths && (
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
                              Strengths
                            </p>
                            <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                              {review.strengths}
                            </p>
                          </div>
                        )}

                        {review.improvementAreas && (
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wide text-amber-700">
                              Improvement areas
                            </p>
                            <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                              {review.improvementAreas}
                            </p>
                          </div>
                        )}

                        {review.actionPlan && (
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wide text-indigo-700">
                              Action plan
                            </p>
                            <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                              {review.actionPlan}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* HR monthly review form */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <div className="flex items-center gap-2">
              <Award size={21} className="text-emerald-600" />
              <h2 className="text-lg font-bold text-slate-900">
                HR Monthly Performance Evaluation
              </h2>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Submit an independent monthly rating and constructive feedback
              for the selected employee.
            </p>
          </div>

          <form onSubmit={handleSaveReview} className="space-y-5 p-5">
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label
                  htmlFor="hrRating"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Monthly rating (1–10) *
                </label>

                <input
                  id="hrRating"
                  name="rating"
                  type="number"
                  min="1"
                  max="10"
                  step="1"
                  required
                  value={form.rating}
                  onChange={handleFormChange}
                  disabled={!reviewWindowOpen || !selectedEmployee}
                  placeholder="Enter rating from 1 to 10"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                />

                <p className="mt-1 text-xs text-slate-500">
                  Enter a whole number between 1 and 10.
                </p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Review period
                </label>

                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                  <CalendarDays size={17} className="text-indigo-600" />
                  {formatMonth(selectedMonth)}
                </div>

                <p className="mt-1 text-xs text-slate-500">
                  The selected review month is controlled by the HR submission
                  window.
                </p>
              </div>
            </div>

            <div>
              <label
                htmlFor="hrReasoning"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Overall reasoning *
              </label>

              <textarea
                id="hrReasoning"
                name="reasoning"
                rows="4"
                required
                minLength="10"
                maxLength="2000"
                value={form.reasoning}
                onChange={handleFormChange}
                disabled={!reviewWindowOpen || !selectedEmployee}
                placeholder="Explain the reasons behind the monthly rating. Include performance, responsibilities, quality of work, consistency, and contribution."
                className="w-full resize-y rounded-xl border border-slate-300 px-4 py-3 text-sm leading-6 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-100"
              />

              <p className="mt-1 text-right text-xs text-slate-400">
                {form.reasoning.length}/2000 characters · Minimum 10
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label
                  htmlFor="hrStrengths"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Strengths
                </label>

                <textarea
                  id="hrStrengths"
                  name="strengths"
                  rows="3"
                  maxLength="1500"
                  value={form.strengths}
                  onChange={handleFormChange}
                  disabled={!reviewWindowOpen || !selectedEmployee}
                  placeholder="Mention the employee's key strengths and positive contributions."
                  className="w-full resize-y rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                />
              </div>

              <div>
                <label
                  htmlFor="hrImprovement"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Areas for improvement
                </label>

                <textarea
                  id="hrImprovement"
                  name="improvementAreas"
                  rows="3"
                  maxLength="1500"
                  value={form.improvementAreas}
                  onChange={handleFormChange}
                  disabled={!reviewWindowOpen || !selectedEmployee}
                  placeholder="Explain what the employee should improve and why."
                  className="w-full resize-y rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="hrActionPlan"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Guidance and action plan
              </label>

              <textarea
                id="hrActionPlan"
                name="actionPlan"
                rows="3"
                maxLength="1500"
                value={form.actionPlan}
                onChange={handleFormChange}
                disabled={!reviewWindowOpen || !selectedEmployee}
                placeholder="Give practical guidance, goals, training suggestions, or steps the employee should follow next month."
                className="w-full resize-y rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-100"
              />
            </div>

            <div className="flex flex-col justify-between gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center">
              <p className="max-w-xl text-xs leading-5 text-slate-500">
                The HR monthly rating is an independent evaluation. Manager
                daily ratings are displayed above for reference and are not
                automatically used to calculate this score.
              </p>

              <button
                type="submit"
                disabled={
                  saving ||
                  loadingReviews ||
                  !reviewWindowOpen ||
                  !selectedEmployee
                }
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {saving ? (
                  <RefreshCw size={17} className="animate-spin" />
                ) : (
                  <Save size={17} />
                )}

                {saving
                  ? "Saving..."
                  : selectedMonthlyReview
                    ? "Update Monthly Review"
                    : "Submit Monthly Review"}
              </button>
            </div>
          </form>
        </section>

        {/* Existing HR review */}
        {selectedMonthlyReview && (
          <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={19} className="text-emerald-600" />
                  <h2 className="font-bold text-slate-900">
                    Existing HR Monthly Review
                  </h2>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  A monthly HR review already exists for this employee.
                </p>
              </div>

              <span className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-2 text-lg font-bold text-emerald-700">
                <Star size={17} />
                {selectedMonthlyReview.rating}/10
              </span>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  HR reasoning
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                  {selectedMonthlyReview.reasoning}
                </p>
              </div>

              <div className="space-y-3">
                {selectedMonthlyReview.strengths && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
                      Strengths
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                      {selectedMonthlyReview.strengths}
                    </p>
                  </div>
                )}

                {selectedMonthlyReview.improvementAreas && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-amber-700">
                      Improvement areas
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                      {selectedMonthlyReview.improvementAreas}
                    </p>
                  </div>
                )}

                {selectedMonthlyReview.actionPlan && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-indigo-700">
                      Action plan
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                      {selectedMonthlyReview.actionPlan}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
