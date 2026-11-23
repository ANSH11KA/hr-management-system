
import { useEffect, useState } from "react";
import {
  Award,
  Star,
  CalendarDays,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  ClipboardList,
} from "lucide-react";
import api from "../api";

const formatDate = (value, type) => {
  if (!value) return "-";

  if (type === "month") {
    const [year, month] = value.split("-");
    return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString(
      "en-IN",
      { month: "long", year: "numeric" }
    );
  }

  return new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

function ReviewCard({ review, type }) {
  const isDaily = type === "daily";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <CalendarDays size={17} className="text-indigo-600" />
          {formatDate(review.periodKey, isDaily ? "date" : "month")}
        </div>

        <div className="flex items-center gap-2 rounded-xl bg-indigo-50 px-4 py-2">
          <Star size={17} className="text-amber-500" />
          <span className="font-bold text-indigo-700">
            {review.rating}/10
          </span>
        </div>
      </div>

      <div className="mt-5">
        <h3 className="text-sm font-bold text-slate-800">
          Reason for this rating
        </h3>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
          {review.reasoning || "No reasoning provided."}
        </p>
      </div>

      {review.strengths && (
        <div className="mt-4 rounded-xl bg-emerald-50 p-4">
          <p className="text-sm font-semibold text-emerald-800">
            <CheckCircle2 size={16} className="mr-2 inline" />
            Strengths
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-emerald-700">
            {review.strengths}
          </p>
        </div>
      )}

      {review.improvementAreas && (
        <div className="mt-4 rounded-xl bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-800">
            <TrendingUp size={16} className="mr-2 inline" />
            Areas to improve
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-amber-700">
            {review.improvementAreas}
          </p>
        </div>
      )}

      {review.actionPlan && (
        <div className="mt-4 rounded-xl bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-800">
            Recommended action plan
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
            {review.actionPlan}
          </p>
        </div>
      )}
    </div>
  );
}

export default function EmployeePerformance() {
  const [dailyReviews, setDailyReviews] = useState([]);
  const [monthlyReviews, setMonthlyReviews] = useState([]);
  const [averageDailyRating, setAverageDailyRating] = useState(null);
  const [totalDailyReviews, setTotalDailyReviews] = useState(0);

  const [activeTab, setActiveTab] = useState("daily");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchPerformance = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/performance/me");
      const data = response.data;

      setDailyReviews(data.dailyReviews || []);
      setMonthlyReviews(data.monthlyReviews || []);
      setAverageDailyRating(data.averageDailyRating ?? null);
      setTotalDailyReviews(data.totalDailyReviews || 0);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to load your performance records."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPerformance();
  }, []);

  const reviews = activeTab === "daily" ? dailyReviews : monthlyReviews;

  if (loading) {
    return (
      <div className="flex min-h-64 items-center justify-center gap-3 text-slate-500">
        <RefreshCw className="animate-spin" size={20} />
        Loading your performance...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <Award size={26} className="text-indigo-600" />
            <h1 className="text-2xl font-bold text-slate-800">
              My Performance
            </h1>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Track your performance, understand feedback, and identify areas
            where you can improve.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchPerformance}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle size={19} className="shrink-0" />
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <ClipboardList size={22} className="text-indigo-600" />
          <p className="mt-3 text-sm text-slate-500">Daily reviews received</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">
            {totalDailyReviews}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <Star size={22} className="text-amber-500" />
          <p className="mt-3 text-sm text-slate-500">Average daily rating</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">
            {averageDailyRating ?? "-"}
            {averageDailyRating !== null && (
              <span className="text-sm font-medium text-slate-400">/10</span>
            )}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <Award size={22} className="text-emerald-600" />
          <p className="mt-3 text-sm text-slate-500">Monthly HR reviews</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">
            {monthlyReviews.length}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setActiveTab("daily")}
          className={`rounded-xl px-5 py-3 text-sm font-semibold ${
            activeTab === "daily"
              ? "bg-indigo-600 text-white"
              : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          }`}
        >
          Daily Manager Reviews ({dailyReviews.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("monthly")}
          className={`rounded-xl px-5 py-3 text-sm font-semibold ${
            activeTab === "monthly"
              ? "bg-indigo-600 text-white"
              : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          }`}
        >
          Monthly HR Reviews ({monthlyReviews.length})
        </button>
      </div>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800">
            {activeTab === "daily"
              ? "Daily Performance History"
              : "Monthly HR Performance History"}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {activeTab === "daily"
              ? "Feedback and ratings provided by your reporting manager."
              : "Monthly performance evaluation and feedback provided by HR."}
          </p>
        </div>

        {reviews.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
            <ClipboardList
              size={40}
              className="mx-auto text-slate-300"
            />
            <h3 className="mt-4 font-semibold text-slate-800">
              No reviews available
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              {activeTab === "daily"
                ? "Your manager has not submitted any daily performance reviews yet."
                : "HR has not submitted your monthly performance review yet."}
            </p>
          </div>
        ) : (
          reviews.map((review) => (
            <ReviewCard
              key={review._id}
              review={review}
              type={activeTab === "daily" ? "daily" : "monthly"}
            />
          ))
        )}
      </section>
    </div>
  );
}
