
import { useEffect, useMemo, useState } from "react";
import {
  Award,
  Star,
  RefreshCw,
  Save,
  Users,
  CalendarDays,
  AlertCircle,
  CheckCircle2,
  ClipboardList,
} from "lucide-react";
import api from "../api";

const getToday = () => {
  const date = new Date();
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000)
    .toISOString()
    .slice(0, 10);
};

const getEmployeeName = (employee) =>
  [
    employee?.personal?.firstName,
    employee?.personal?.middleName,
    employee?.personal?.lastName,
  ]
    .filter(Boolean)
    .join(" ") || "Employee";

const formatDate = (date) => {
  if (!date) return "-";
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export default function ManagerPerformance() {
  const [employees, setEmployees] = useState([]);
  const [reviews, setReviews] = useState([]);

  const [employeeId, setEmployeeId] = useState("");
  const [date, setDate] = useState(getToday());
  const [rating, setRating] = useState(8);
  const [reasoning, setReasoning] = useState("");
  const [strengths, setStrengths] = useState("");
  const [improvementAreas, setImprovementAreas] = useState("");
  const [actionPlan, setActionPlan] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selectedEmployee = useMemo(
    () => employees.find((employee) => employee._id === employeeId),
    [employees, employeeId]
  );

  const fetchData = async () => {
    setLoading(true);
    setError("");

    try {
      const [teamResponse, reviewResponse] = await Promise.all([
        api.get("/performance/manager/team"),
        api.get("/performance/manager/team-reviews"),
      ]);

      const team = teamResponse.data?.employees || [];
      const teamReviews = reviewResponse.data?.reviews || [];

      setEmployees(team);
      setReviews(teamReviews);

      setEmployeeId((current) =>
        team.some((employee) => employee._id === current)
          ? current
          : team[0]?._id || ""
      );
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to load your team performance data."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Load an existing review when employee or date changes.
  useEffect(() => {
    const existing = reviews.find(
      (review) =>
        review.employee?._id === employeeId &&
        review.periodKey === date
    );

    if (existing) {
      setRating(existing.rating);
      setReasoning(existing.reasoning || "");
      setStrengths(existing.strengths || "");
      setImprovementAreas(existing.improvementAreas || "");
      setActionPlan(existing.actionPlan || "");
    } else {
      setRating(8);
      setReasoning("");
      setStrengths("");
      setImprovementAreas("");
      setActionPlan("");
    }
  }, [employeeId, date, reviews]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!employeeId) {
      setError("Please select an employee.");
      return;
    }

    if (!reasoning.trim() || reasoning.trim().length < 10) {
      setError("Please provide reasoning of at least 10 characters.");
      return;
    }

    setSaving(true);

    try {
      await api.post("/performance/manager/daily", {
        employeeId,
        date,
        rating,
        reasoning,
        strengths,
        improvementAreas,
        actionPlan,
      });

      setSuccess("Daily performance review saved successfully.");
      await fetchData();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to save the performance review."
      );
    } finally {
      setSaving(false);
    }
  };

  const selectedReviews = reviews
    .filter((review) => review.employee?._id === employeeId)
    .sort((a, b) => b.periodKey.localeCompare(a.periodKey));

  const existingReview = reviews.find(
    (review) =>
      review.employee?._id === employeeId &&
      review.periodKey === date
  );

  const averageRating = selectedReviews.length
    ? (
        selectedReviews.reduce((sum, item) => sum + item.rating, 0) /
        selectedReviews.length
      ).toFixed(1)
    : "-";

  if (loading) {
    return (
      <div className="flex min-h-64 items-center justify-center gap-3 text-slate-500">
        <RefreshCw className="animate-spin" size={20} />
        Loading performance data...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page heading */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <Award className="text-indigo-600" size={25} />
            <h1 className="text-2xl font-bold text-slate-800">
              Daily Performance
            </h1>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Evaluate your team members and provide constructive feedback.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchData}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <Users className="text-indigo-600" size={22} />
          <p className="mt-3 text-sm text-slate-500">Team members</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">
            {employees.length}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <ClipboardList className="text-emerald-600" size={22} />
          <p className="mt-3 text-sm text-slate-500">Submitted reviews</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">
            {reviews.length}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <Star className="text-amber-500" size={22} />
          <p className="mt-3 text-sm text-slate-500">
            Selected employee average
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-800">
            {averageRating}
            {averageRating !== "-" && (
              <span className="text-sm font-medium text-slate-400">
                /10
              </span>
            )}
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle size={19} className="shrink-0" />
          {error}
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          <CheckCircle2 size={19} />
          {success}
        </div>
      )}

      {employees.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
          <Users className="mx-auto text-slate-300" size={40} />
          <h2 className="mt-4 font-semibold text-slate-800">
            No team members found
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            HR needs to assign employees to your manager profile first.
          </p>
        </div>
      ) : (
        <>
          {/* Review form */}
          <form
            onSubmit={handleSubmit}
            className="space-y-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"
          >
            <div>
              <h2 className="text-lg font-bold text-slate-800">
                Submit Daily Review
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Provide a fair rating and actionable feedback.
              </p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Select employee *
                </label>
                <select
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                >
                  {employees.map((employee) => (
                    <option key={employee._id} value={employee._id}>
                      {getEmployeeName(employee)} ({employee.employeeId})
                    </option>
                  ))}
                </select>

                {selectedEmployee && (
                  <p className="mt-2 text-xs text-slate-500">
                    {selectedEmployee.department} ·{" "}
                    {selectedEmployee.designation || "Employee"}
                  </p>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Review date *
                </label>
                <input
                  type="date"
                  value={date}
                  max={getToday()}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </div>
            </div>

            <div className="rounded-2xl bg-slate-50 p-5">
              <div className="flex items-center justify-between gap-3">
                <label className="text-sm font-bold text-slate-800">
                  Performance rating *
                </label>
                <span className="text-2xl font-bold text-indigo-600">
                  {rating}/10
                </span>
              </div>

              <div className="mt-5 grid grid-cols-5 gap-2 sm:grid-cols-10">
                {Array.from({ length: 10 }, (_, index) => index + 1).map(
                  (number) => (
                    <button
                      key={number}
                      type="button"
                      onClick={() => setRating(number)}
                      className={`rounded-lg py-3 text-sm font-bold transition ${
                        rating === number
                          ? "bg-indigo-600 text-white shadow-md"
                          : "border border-slate-200 bg-white text-slate-600 hover:border-indigo-400"
                      }`}
                    >
                      {number}
                    </button>
                  )
                )}
              </div>
              <p className="mt-3 text-xs text-slate-500">
                1 = Needs significant improvement · 10 = Outstanding
                performance
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Reason for this rating *
              </label>
              <textarea
                value={reasoning}
                onChange={(e) => setReasoning(e.target.value)}
                minLength={10}
                maxLength={2000}
                rows={4}
                required
                placeholder="Explain the employee's performance, work quality, productivity, and contributions today..."
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
              <p className="mt-1 text-right text-xs text-slate-400">
                {reasoning.length}/2000
              </p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Strengths
                </label>
                <textarea
                  value={strengths}
                  onChange={(e) => setStrengths(e.target.value)}
                  rows={3}
                  maxLength={1500}
                  placeholder="What did the employee do well?"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Improvement areas
                </label>
                <textarea
                  value={improvementAreas}
                  onChange={(e) => setImprovementAreas(e.target.value)}
                  rows={3}
                  maxLength={1500}
                  placeholder="Which skills or work areas need improvement?"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Recommended action plan
              </label>
              <textarea
                value={actionPlan}
                onChange={(e) => setActionPlan(e.target.value)}
                rows={3}
                maxLength={1500}
                placeholder="What specific steps should the employee take to improve?"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            {existingReview && (
              <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                A review already exists for this employee and date.
                Saving will update that review.
              </p>
            )}

            <div className="flex justify-end border-t border-slate-100 pt-5">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? (
                  <RefreshCw className="animate-spin" size={17} />
                ) : (
                  <Save size={17} />
                )}
                {saving ? "Saving..." : "Save Daily Review"}
              </button>
            </div>
          </form>

          {/* Review history */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="mb-5">
              <h2 className="text-lg font-bold text-slate-800">
                Daily Review History
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Previous ratings and feedback for the selected employee.
              </p>
            </div>

            {selectedReviews.length === 0 ? (
              <p className="rounded-xl bg-slate-50 p-8 text-center text-sm text-slate-500">
                No daily reviews submitted for this employee yet.
              </p>
            ) : (
              <div className="space-y-4">
                {selectedReviews.map((review) => (
                  <div
                    key={review._id}
                    className="rounded-xl border border-slate-200 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                        <CalendarDays size={17} />
                        {formatDate(review.periodKey)}
                      </div>

                      <span className="rounded-lg bg-indigo-50 px-3 py-1.5 text-sm font-bold text-indigo-700">
                        {review.rating}/10
                      </span>
                    </div>

                    <p className="mt-4 text-sm leading-6 text-slate-700">
                      {review.reasoning}
                    </p>

                    {review.strengths && (
                      <p className="mt-3 text-sm text-emerald-700">
                        <strong>Strengths:</strong> {review.strengths}
                      </p>
                    )}

                    {review.improvementAreas && (
                      <p className="mt-2 text-sm text-amber-700">
                        <strong>Improvement:</strong>{" "}
                        {review.improvementAreas}
                      </p>
                    )}

                    {review.actionPlan && (
                      <p className="mt-2 text-sm text-slate-600">
                        <strong>Action plan:</strong> {review.actionPlan}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
