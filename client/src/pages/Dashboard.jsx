
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Users,
  UserCheck,
  UserX,
  CalendarClock,
  CalendarOff,
  FileCheck2,
  FileWarning,
  Clock,
  FileText,
  CalendarDays,
  AlertTriangle,
  ClipboardCheck,
  ArrowRight,
  RefreshCw,
  BriefcaseBusiness,
  TrendingUp,
  ShieldCheck,
  Building2,
  CheckCircle2,
  CircleAlert,
  CalendarRange,
  ClipboardList,
  Coffee,
  Megaphone,
  Bell,
  CalendarCheck,
} from "lucide-react";

import api, { errMsg } from "../api";
import { useAuth } from "../hooks/useAuth";
import StatusBadge from "../components/StatusBadge";

// =====================================================
// CONSTANTS & HELPERS
// =====================================================

const MAX_LUNCH_MINUTES = 60;

const tones = {
  indigo: {
    icon: "bg-indigo-50 text-indigo-600",
    accent: "border-l-indigo-500",
  },
  green: {
    icon: "bg-emerald-50 text-emerald-600",
    accent: "border-l-emerald-500",
  },
  red: {
    icon: "bg-rose-50 text-rose-600",
    accent: "border-l-rose-500",
  },
  amber: {
    icon: "bg-amber-50 text-amber-600",
    accent: "border-l-amber-500",
  },
  sky: {
    icon: "bg-sky-50 text-sky-600",
    accent: "border-l-sky-500",
  },
  violet: {
    icon: "bg-violet-50 text-violet-600",
    accent: "border-l-violet-500",
  },
};

const fmtDate = value => {
  if (!value) return "-";

  const dateString = String(value).slice(0, 10);
  const date = new Date(`${dateString}T00:00:00`);

  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const fmtTime = value => {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
};

const fmtDuration = minutes => {
  if (
    minutes === null ||
    minutes === undefined ||
    !Number.isFinite(Number(minutes))
  ) {
    return "-";
  }

  const total = Math.max(0, Math.floor(Number(minutes)));
  const hours = Math.floor(total / 60);
  const mins = total % 60;

  return `${hours}h ${mins}m`;
};

const getFirstName = name =>
  String(name || "User").trim().split(/\s+/)[0];

// Announcement date formatter.
const fmtAnnouncementDate = value => {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
};

// Announcement priority sorting.
const priorityOrder = {
  Urgent: 1,
  High: 2,
  Normal: 3,
};

const getPriorityStyle = priority => {
  switch (priority) {
    case "Urgent":
      return {
        badge: "bg-rose-100 text-rose-700 border-rose-200",
        border: "border-l-rose-500",
        icon: "bg-rose-100 text-rose-600",
        heading: "text-rose-900",
        label: "Urgent Announcement",
      };

    case "High":
      return {
        badge: "bg-amber-100 text-amber-700 border-amber-200",
        border: "border-l-amber-500",
        icon: "bg-amber-100 text-amber-600",
        heading: "text-slate-900",
        label: "High Priority",
      };

    default:
      return {
        badge: "bg-indigo-100 text-indigo-700 border-indigo-200",
        border: "border-l-indigo-500",
        icon: "bg-indigo-100 text-indigo-600",
        heading: "text-slate-900",
        label: "Normal",
      };
  }
};

// Calculate total working time excluding lunch.
const getLiveWorkingMinutes = (attendance, now = Date.now()) => {
  if (!attendance?.checkInAt) return null;

  // Use the finalized backend calculation after checkout.
  if (attendance.checkOutAt) {
    if (attendance.workingMinutes != null) {
      return Number(attendance.workingMinutes);
    }

    if (attendance.totalMinutes != null) {
      return Math.max(
        0,
        Number(attendance.totalMinutes) -
          Number(attendance.lunchMinutes || 0)
      );
    }

    return null;
  }

  const checkIn = new Date(attendance.checkInAt).getTime();

  if (!Number.isFinite(checkIn)) return null;

  const elapsedMinutes = Math.max(
    0,
    Math.floor((now - checkIn) / 60000)
  );

  let lunchMinutes = Number(attendance.lunchMinutes || 0);

  // Subtract the currently running lunch break as well.
  if (attendance.lunchOutAt && !attendance.lunchInAt) {
    const lunchOut = new Date(attendance.lunchOutAt).getTime();

    if (Number.isFinite(lunchOut)) {
      lunchMinutes += Math.max(
        0,
        Math.floor((now - lunchOut) / 60000)
      );
    }
  }

  return Math.max(0, elapsedMinutes - lunchMinutes);
};

// Calculate completed + currently running lunch duration.
const getLiveLunchMinutes = (attendance, now = Date.now()) => {
  if (!attendance?.lunchOutAt) return null;

  let minutes = Number(attendance.lunchMinutes || 0);

  if (!attendance.lunchInAt) {
    const lunchOut = new Date(attendance.lunchOutAt).getTime();

    if (Number.isFinite(lunchOut)) {
      minutes += Math.max(
        0,
        Math.floor((now - lunchOut) / 60000)
      );
    }
  }

  return Math.max(0, minutes);
};

// =====================================================
// SHARED COMPONENTS
// =====================================================

function Stat({
  label,
  value,
  icon: Icon,
  tone = "indigo",
  description,
}) {
  const style = tones[tone] || tones.indigo;

  return (
    <div
      className={`group rounded-2xl border border-slate-200 border-l-4 ${style.accent} bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-md`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">
            {label}
          </p>

          <p className="mt-3 break-words text-3xl font-bold tracking-tight text-slate-900">
            {value ?? 0}
          </p>
        </div>

        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${style.icon}`}
        >
          <Icon size={23} />
        </div>
      </div>

      {description && (
        <p className="mt-4 text-xs leading-5 text-slate-400">
          {description}
        </p>
      )}
    </div>
  );
}

function Skeleton({ count = 6 }) {
  return (
    <div className="space-y-6">
      <div className="animate-pulse space-y-2">
        <div className="h-8 w-56 rounded-lg bg-slate-200" />
        <div className="h-4 w-80 max-w-full rounded bg-slate-100" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: count }).map((_, index) => (
          <div
            key={index}
            className="h-36 animate-pulse rounded-2xl border border-slate-100 bg-white p-5"
          >
            <div className="h-4 w-28 rounded bg-slate-100" />
            <div className="mt-5 h-8 w-16 rounded bg-slate-200" />
            <div className="mt-5 h-3 w-36 rounded bg-slate-100" />
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    </div>
  );
}

function SectionHeader({ title, subtitle, action }) {
  return (
    <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
      <div>
        <h2 className="text-lg font-bold text-slate-900">
          {title}
        </h2>

        {subtitle && (
          <p className="mt-1 text-sm text-slate-500">
            {subtitle}
          </p>
        )}
      </div>

      {action}
    </div>
  );
}

function ListCard({
  title,
  subtitle,
  empty,
  items = [],
  render,
  link,
  linkLabel = "View all",
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="min-w-0">
          <h2 className="font-bold text-slate-900">
            {title}
          </h2>

          {subtitle && (
            <p className="mt-1 text-xs text-slate-500">
              {subtitle}
            </p>
          )}
        </div>

        {link && (
          <Link
            to={link}
            className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-indigo-600 transition hover:text-indigo-800"
          >
            {linkLabel}
            <ArrowRight size={14} />
          </Link>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-5 py-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
            <ClipboardList size={22} />
          </div>

          <p className="mt-3 text-sm font-semibold text-slate-600">
            Nothing to display
          </p>

          <p className="mt-1 text-xs text-slate-400">
            {empty}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 px-5">
          {items.map((item, index) => (
            <li
              key={item._id || index}
              className="flex items-center justify-between gap-3 py-4"
            >
              {render(item)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function QuickAction({
  to,
  icon: Icon,
  title,
  description,
  tone = "indigo",
}) {
  const style = tones[tone] || tones.indigo;

  return (
    <Link
      to={to}
      className="group flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 transition duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md"
    >
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${style.icon}`}
      >
        <Icon size={21} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="font-semibold text-slate-800 transition group-hover:text-indigo-700">
          {title}
        </p>

        <p className="mt-1 text-xs leading-5 text-slate-500">
          {description}
        </p>
      </div>

      <ArrowRight
        size={17}
        className="shrink-0 text-slate-300 transition group-hover:translate-x-1 group-hover:text-indigo-600"
      />
    </Link>
  );
}

function EmployeeAvatar({ name }) {
  const initials = String(name || "E")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0])
    .join("")
    .toUpperCase();

  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-bold text-indigo-700">
      {initials}
    </div>
  );
}

function ErrorState({ message, onRetry }) {
  return (
    <div className="flex min-h-[350px] flex-col items-center justify-center rounded-2xl border border-rose-200 bg-white px-5 py-12 text-center shadow-sm">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
        <CircleAlert size={28} />
      </div>

      <h2 className="mt-4 text-lg font-bold text-slate-900">
        Unable to load dashboard
      </h2>

      <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
        {message ||
          "Something went wrong while fetching dashboard information."}
      </p>

      <button
        type="button"
        onClick={onRetry}
        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
      >
        <RefreshCw size={16} />
        Try again
      </button>
    </div>
  );
}

// =====================================================
// EMPLOYEE ANNOUNCEMENTS
// =====================================================

function AnnouncementSection({
  announcements = [],
  loading,
  error,
  onRetry,
}) {
  const sortedAnnouncements = [...announcements].sort(
    (a, b) =>
      (priorityOrder[a.priority] || 99) -
      (priorityOrder[b.priority] || 99)
  );

  const urgentCount = announcements.filter(
    item => item.priority === "Urgent"
  ).length;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <Megaphone size={22} />
          </div>

          <div>
            <h2 className="font-bold text-slate-900">
              HR Announcements
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Important updates and notices from HR.
            </p>
          </div>
        </div>

        {!loading && announcements.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {urgentCount > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700">
                <AlertTriangle size={13} />
                {urgentCount} Urgent
              </span>
            )}

            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
              {announcements.length}{" "}
              {announcements.length === 1
                ? "Announcement"
                : "Announcements"}
            </span>
          </div>
        )}
      </div>

      <div className="p-5">
        {loading ? (
          <div className="space-y-3">
            {[1, 2].map(item => (
              <div
                key={item}
                className="animate-pulse rounded-xl border border-slate-100 p-4"
              >
                <div className="h-4 w-32 rounded bg-slate-200" />
                <div className="mt-3 h-5 w-2/3 rounded bg-slate-200" />
                <div className="mt-3 h-3 w-full rounded bg-slate-100" />
                <div className="mt-2 h-3 w-4/5 rounded bg-slate-100" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-5">
            <div className="flex items-start gap-3">
              <CircleAlert
                size={20}
                className="mt-0.5 shrink-0 text-rose-600"
              />

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-rose-800">
                  Unable to load announcements
                </p>

                <p className="mt-1 text-xs leading-5 text-rose-700">
                  {error}
                </p>

                <button
                  type="button"
                  onClick={onRetry}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-rose-700"
                >
                  <RefreshCw size={13} />
                  Retry
                </button>
              </div>
            </div>
          </div>
        ) : sortedAnnouncements.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-5 py-9 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-slate-400 shadow-sm">
              <Bell size={22} />
            </div>

            <p className="mt-3 text-sm font-semibold text-slate-700">
              No announcements right now
            </p>

            <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">
              When HR publishes an announcement, it will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedAnnouncements.map(announcement => {
              const style = getPriorityStyle(
                announcement.priority
              );

              return (
                <article
                  key={announcement._id}
                  className={`rounded-xl border border-slate-200 border-l-4 ${style.border} bg-white p-4 transition hover:shadow-sm`}
                >
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                    <div className="flex min-w-0 items-start gap-3">
                      <div
                        className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${style.icon}`}
                      >
                        {announcement.priority === "Urgent" ? (
                          <AlertTriangle size={19} />
                        ) : (
                          <Megaphone size={19} />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${style.badge}`}
                          >
                            {announcement.priority || "Normal"}
                          </span>

                          {announcement.priority === "Urgent" && (
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-rose-600">
                              Important Notice
                            </span>
                          )}
                        </div>

                        <h3
                          className={`break-words text-sm font-bold ${style.heading}`}
                        >
                          {announcement.title}
                        </h3>

                        <p className="mt-2 whitespace-pre-line break-words text-sm leading-6 text-slate-600">
                          {announcement.description}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-100 pt-3 text-[11px] text-slate-500">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarCheck size={13} />
                      Published:{" "}
                      {fmtAnnouncementDate(
                        announcement.publishedAt ||
                          announcement.createdAt
                      )}
                    </span>

                    {announcement.expiresAt && (
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDays size={13} />
                        Valid until:{" "}
                        {fmtAnnouncementDate(
                          announcement.expiresAt
                        )}
                      </span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

// =====================================================
// EMPLOYEE ATTENDANCE CARD
// =====================================================

function EmployeeAttendanceCard({ attendance }) {
  const att = attendance;

  // Keep the clock updated while attendance or lunch is running.
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    if (!att?.checkInAt || att?.checkOutAt) return;

    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 60000);

    return () => clearInterval(interval);
  }, [att?.checkInAt, att?.checkOutAt]);

  const lunchInProgress =
    Boolean(att?.lunchOutAt) && !att?.lunchInAt;

  const workingMinutes = getLiveWorkingMinutes(
    att,
    currentTime
  );

  const lunchMinutes = getLiveLunchMinutes(
    att,
    currentTime
  );

  const lunchExceeded =
    Boolean(att?.lunchOverLimit) ||
    (lunchMinutes !== null &&
      lunchMinutes > MAX_LUNCH_MINUTES);

  const attendanceStatus = !att
    ? "Not Marked"
    : att.status === "Absent"
      ? "Absent"
      : att.status === "Half Day"
        ? "Half Day"
        : att.checkOutAt
          ? "Completed"
          : lunchInProgress
            ? "On Lunch Break"
            : "Working";

  const statusTone =
    attendanceStatus === "Absent"
      ? "text-rose-600"
      : attendanceStatus === "Half Day"
        ? "text-amber-600"
        : attendanceStatus === "Not Marked"
          ? "text-slate-500"
          : "text-emerald-600";

  return (
    <>
      {/* ATTENDANCE DETAILS */}
      <div className="rounded-2xl border border-slate-200 border-l-4 border-l-indigo-500 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-500">
              Today's Attendance
            </p>

            <p className={`mt-3 text-xl font-bold ${statusTone}`}>
              {attendanceStatus}
            </p>
          </div>

          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <Clock size={23} />
          </div>
        </div>

        <div className="mt-4 space-y-3 border-t border-slate-100 pt-3 text-xs">
          <div className="flex justify-between gap-2">
            <span className="text-slate-500">Check In</span>

            <span className="font-semibold text-slate-700">
              {fmtTime(att?.checkInAt)}
            </span>
          </div>

          <div className="flex justify-between gap-2">
            <span className="text-slate-500">Check Out</span>

            <span className="font-semibold text-slate-700">
              {fmtTime(att?.checkOutAt)}
            </span>
          </div>

          <div className="flex justify-between gap-2">
            <span className="text-slate-500">Working Hours</span>

            <span className="font-semibold text-slate-700">
              {workingMinutes !== null
                ? fmtDuration(workingMinutes)
                : "-"}
            </span>
          </div>

          <div className="flex justify-between gap-2">
            <span className="text-slate-500">Attendance Timing</span>

            {!att?.checkInAt ? (
              <span className="text-slate-400">
                Not checked in
              </span>
            ) : att.isLate ? (
              <span className="font-semibold text-rose-600">
                Late
              </span>
            ) : (
              <span className="font-semibold text-emerald-600">
                On Time
              </span>
            )}
          </div>

          {att?.checkOutAt && (
            <div className="flex justify-between gap-2">
              <span className="text-slate-500">Final Status</span>

              <span className="font-semibold text-slate-700">
                {att.status || "-"}
              </span>
            </div>
          )}

          {att?.checkInAt && !att?.checkOutAt && (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-emerald-700">
              Your working hours are updating automatically.
            </p>
          )}
        </div>
      </div>

      {/* LUNCH DETAILS */}
      <div className="rounded-2xl border border-slate-200 border-l-4 border-l-sky-500 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-500">
              Lunch Break
            </p>

            <p className="mt-3 text-xl font-bold text-slate-900">
              {!att?.lunchOutAt
                ? "Not Started"
                : lunchInProgress
                  ? "In Progress"
                  : "Completed"}
            </p>
          </div>

          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
            <Coffee size={23} />
          </div>
        </div>

        <div className="mt-4 space-y-3 border-t border-slate-100 pt-3 text-xs">
          <div className="flex justify-between gap-2">
            <span className="text-slate-500">Lunch Out</span>

            <span className="font-semibold text-slate-700">
              {fmtTime(att?.lunchOutAt)}
            </span>
          </div>

          <div className="flex justify-between gap-2">
            <span className="text-slate-500">Lunch In</span>

            <span className="font-semibold text-slate-700">
              {fmtTime(att?.lunchInAt)}
            </span>
          </div>

          <div className="flex justify-between gap-2">
            <span className="text-slate-500">Lunch Duration</span>

            <span
              className={`font-semibold ${
                lunchExceeded
                  ? "text-rose-600"
                  : "text-slate-700"
              }`}
            >
              {lunchMinutes !== null
                ? fmtDuration(lunchMinutes)
                : "-"}
            </span>
          </div>

          {lunchExceeded && (
            <p className="flex items-center gap-1.5 font-semibold text-rose-600">
              <AlertTriangle size={14} />
              Lunch exceeded 1 hour
            </p>
          )}

          {lunchInProgress && (
            <p className="rounded-lg bg-sky-50 px-3 py-2 text-sky-700">
              Your lunch break is currently running. The duration is
              updating automatically.
            </p>
          )}
        </div>
      </div>
    </>
  );
}

// =====================================================
// MAIN DASHBOARD
// =====================================================

export default function Dashboard() {
  const { user } = useAuth();

  const [d, setD] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  // Employee announcements state.
  const [announcements, setAnnouncements] = useState([]);
  const [announcementsLoading, setAnnouncementsLoading] =
    useState(false);
  const [announcementsError, setAnnouncementsError] =
    useState("");

  const role = user?.role;

  const admin = role === "admin";
  const manager = role === "manager";

  // =====================================================
  // DASHBOARD DATA
  // =====================================================

  useEffect(() => {
    let ignore = false;

    const fetchDashboard = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await api.get("/dashboard");

        if (!ignore) {
          setD(response.data);
        }
      } catch (error) {
        if (!ignore) {
          setError(errMsg(error));
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    fetchDashboard();

    return () => {
      ignore = true;
    };
  }, [reloadKey]);

  // =====================================================
  // EMPLOYEE ANNOUNCEMENTS DATA
  // =====================================================

  useEffect(() => {
    if (role !== "employee") {
      setAnnouncements([]);
      setAnnouncementsLoading(false);
      setAnnouncementsError("");
      return;
    }

    let ignore = false;

    const fetchAnnouncements = async () => {
      setAnnouncementsLoading(true);
      setAnnouncementsError("");

      try {
        const response = await api.get(
          "/announcements/employee"
        );

        if (!ignore) {
          const items = Array.isArray(
            response.data?.announcements
          )
            ? response.data.announcements
            : [];

          setAnnouncements(items);
        }
      } catch (error) {
        if (!ignore) {
          setAnnouncementsError(errMsg(error));
        }
      } finally {
        if (!ignore) {
          setAnnouncementsLoading(false);
        }
      }
    };

    fetchAnnouncements();

    return () => {
      ignore = true;
    };
  }, [role, reloadKey]);

  const refreshDashboard = () => {
    setReloadKey(key => key + 1);
  };

  if (loading && !d) {
    return (
      <div className="space-y-6">
        <Skeleton count={admin ? 7 : manager ? 9 : 4} />
      </div>
    );
  }

  if (error && !d) {
    return (
      <ErrorState
        message={error}
        onRetry={refreshDashboard}
      />
    );
  }

  if (!d) return null;

  // =====================================================
  // HR / ADMIN DASHBOARD
  // =====================================================

  if (admin) {
    return (
      <div className="space-y-7 pb-8">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-indigo-800 p-6 text-white shadow-lg sm:p-8">
          <div className="relative z-10 flex flex-col justify-between gap-6 md:flex-row md:items-center">
            <div className="max-w-2xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-indigo-100">
                <ShieldCheck size={14} />
                HR Administration
              </div>

              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                HR Dashboard
              </h1>

              <p className="mt-2 text-sm leading-6 text-indigo-100/80 sm:text-base">
                Welcome back, {getFirstName(user?.name)}. Here's your
                organisation's workforce overview and today's activity.
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-3 text-xs text-indigo-100/80">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays size={14} />
                  {new Date().toLocaleDateString("en-IN", {
                    weekday: "long",
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                    timeZone: "Asia/Kolkata",
                  })}
                </span>

                <span className="h-1 w-1 rounded-full bg-indigo-200/70" />

                <span className="inline-flex items-center gap-1.5">
                  <Building2 size={14} />
                  Organisation Overview
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={refreshDashboard}
              disabled={loading}
              className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20 disabled:opacity-50 md:self-center"
            >
              <RefreshCw
                size={16}
                className={loading ? "animate-spin" : ""}
              />
              Refresh dashboard
            </button>
          </div>

          <div className="pointer-events-none absolute -right-12 -top-24 h-72 w-72 rounded-full border-[35px] border-white/5" />
          <div className="pointer-events-none absolute -bottom-32 right-40 h-64 w-64 rounded-full bg-indigo-400/10 blur-3xl" />
        </div>

        {error && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Dashboard refresh failed: {error}
          </div>
        )}

        <SectionHeader
          title="Workforce Overview"
          subtitle="A snapshot of your organisation's attendance and daily operations."
        />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Stat
            label="Active Employees"
            value={d.activeEmployees}
            icon={Users}
            tone="indigo"
            description="Currently active employees"
          />

          <Stat
            label="Present Today"
            value={d.presentToday}
            icon={UserCheck}
            tone="green"
            description="Employees marked present"
          />

          <Stat
            label="Absent Today"
            value={d.absentToday}
            icon={UserX}
            tone="red"
            description="Employees marked absent"
          />

          <Stat
            label="On Leave Today"
            value={d.onLeaveToday}
            icon={CalendarOff}
            tone="sky"
            description="Approved leave for today"
          />

          <Stat
            label="Pending Leave Requests"
            value={d.pendingLeaves}
            icon={CalendarClock}
            tone="amber"
            description="Requests awaiting HR review"
          />

          <Stat
            label="DARs Submitted Today"
            value={d.darsToday}
            icon={FileCheck2}
            tone="green"
            description="Daily activity reports received"
          />

          <Stat
            label="DARs Missing"
            value={d.darsMissing}
            icon={FileWarning}
            tone="red"
            description="Reports not submitted today"
          />
        </div>

        <section>
          <SectionHeader
            title="Quick Actions"
            subtitle="Access important HR management sections."
          />

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <QuickAction
              to="/employees"
              icon={Users}
              title="Employee Management"
              description="View and manage employee profiles."
              tone="indigo"
            />

            <QuickAction
              to="/attendance"
              icon={CalendarDays}
              title="Attendance Management"
              description="Review employee attendance records."
              tone="green"
            />

            <QuickAction
              to="/leaves"
              icon={CalendarRange}
              title="Leave Management"
              description="Review and process leave applications."
              tone="sky"
            />

            <QuickAction
              to="/reports"
              icon={ClipboardCheck}
              title="Daily Activity Reports"
              description="Review employee daily work reports."
              tone="violet"
            />
          </div>
        </section>

        <section>
          <SectionHeader
            title="Recent Activities"
            subtitle="Stay updated with the latest employee submissions."
          />

          <div className="grid gap-5 xl:grid-cols-2">
            <ListCard
              title="Recent Leave Requests"
              subtitle="Latest employee leave applications"
              empty="No recent leave requests are available."
              items={d.recentLeaves || []}
              link="/leaves"
              render={leave => (
                <>
                  <div className="flex min-w-0 items-center gap-3">
                    <EmployeeAvatar
                      name={leave.employee?.user?.name || "Employee"}
                    />

                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">
                        {leave.employee?.user?.name || "Employee"}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {leave.leaveType || "Leave"} ·{" "}
                        {fmtDate(leave.startDate)}
                        {leave.endDate && ` – ${fmtDate(leave.endDate)}`}
                      </p>
                    </div>
                  </div>

                  <StatusBadge value={leave.status} />
                </>
              )}
            />

            <ListCard
              title="Recent Daily Reports"
              subtitle="Latest daily activity report submissions"
              empty="No recent daily reports are available."
              items={d.recentReports || []}
              link="/reports"
              render={report => (
                <>
                  <div className="flex min-w-0 items-center gap-3">
                    <EmployeeAvatar
                      name={report.employee?.user?.name || "Employee"}
                    />

                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">
                        {report.employee?.user?.name || "Employee"}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        Report date: {fmtDate(report.reportDate)}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0">
                    <StatusBadge
                      value={report.overallStatus || "Submitted"}
                    />
                  </div>
                </>
              )}
            />
          </div>
        </section>

        <div className="flex items-start gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4">
          <div className="mt-0.5 text-indigo-600">
            <TrendingUp size={19} />
          </div>

          <div>
            <p className="text-sm font-semibold text-indigo-900">
              Organisation overview
            </p>

            <p className="mt-1 text-xs leading-5 text-indigo-700">
              Use the dashboard to monitor workforce attendance, leave
              requests and daily activity report submissions. Detailed
              information is available in the respective management sections.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // =====================================================
  // MANAGER DASHBOARD
  // =====================================================

  if (manager) {
    return (
      <div className="space-y-7 pb-8">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-indigo-800 p-6 text-white shadow-lg sm:p-8">
          <div className="relative z-10 flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-indigo-100">
                <BriefcaseBusiness size={14} />
                Team Management
              </div>

              <h1 className="text-2xl font-bold sm:text-3xl">
                Manager Dashboard
              </h1>

              <p className="mt-2 text-sm leading-6 text-indigo-100/80">
                Welcome back, {getFirstName(user?.name)}. Here's your team's
                performance and daily activity overview.
              </p>
            </div>

            <button
              type="button"
              onClick={refreshDashboard}
              disabled={loading}
              className="inline-flex items-center gap-2 self-start rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20 disabled:opacity-50"
            >
              <RefreshCw
                size={16}
                className={loading ? "animate-spin" : ""}
              />
              Refresh
            </button>
          </div>

          <div className="pointer-events-none absolute -right-12 -top-24 h-72 w-72 rounded-full border-[35px] border-white/5" />
        </div>

        {error && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Dashboard refresh failed: {error}
          </div>
        )}

        <SectionHeader
          title="Team Overview"
          subtitle="Monitor your reporting hierarchy and daily team performance."
        />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Stat
            label="Team Members"
            value={d.teamSize}
            icon={Users}
            tone="indigo"
            description="Employees in your reporting hierarchy"
          />

          <Stat
            label="Present Today"
            value={d.presentToday}
            icon={UserCheck}
            tone="green"
            description="Team members marked present"
          />

          <Stat
            label="Absent Today"
            value={d.absentToday}
            icon={UserX}
            tone="red"
            description="Team members marked absent"
          />

          <Stat
            label="On Leave Today"
            value={d.onLeaveToday}
            icon={CalendarOff}
            tone="sky"
            description="Team members on approved leave"
          />

          <Stat
            label="DARs Submitted"
            value={d.darsSubmittedToday}
            icon={FileCheck2}
            tone="green"
            description="Reports received today"
          />

          <Stat
            label="DARs Missing"
            value={d.darsMissingToday}
            icon={FileWarning}
            tone="red"
            description="Reports not submitted today"
          />

          <Stat
            label="Pending Reviews"
            value={d.pendingReviews}
            icon={ClipboardCheck}
            tone="amber"
            description="Reports waiting for your review"
          />

          <Stat
            label="Overdue Reviews"
            value={d.overdueReviews}
            icon={Clock}
            tone="red"
            description="Reviews past their expected time"
          />

          <Stat
            label="Open Blockers"
            value={d.openBlockers}
            icon={AlertTriangle}
            tone="amber"
            description="Unresolved team blockers"
          />
        </div>

        <section>
          <SectionHeader
            title="Quick Actions"
            subtitle="Manage your team's daily activities."
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <QuickAction
              to="/reports"
              icon={ClipboardCheck}
              title="Review Daily Reports"
              description="Review submitted DARs from your reporting hierarchy."
              tone="indigo"
            />

            <QuickAction
              to="/attendance"
              icon={CalendarDays}
              title="Team Attendance"
              description="Monitor attendance and working hours."
              tone="green"
            />

            <QuickAction
              to="/leaves"
              icon={CalendarRange}
              title="Team Leave Requests"
              description="View leave requests from your team."
              tone="sky"
            />
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-2">
          <ListCard
            title="Recent Team Reports"
            subtitle="Latest daily report submissions"
            empty="No team reports have been submitted yet."
            items={d.recentReports || []}
            link="/reports"
            render={report => (
              <>
                <div className="flex min-w-0 items-center gap-3">
                  <EmployeeAvatar
                    name={report.employee?.user?.name || "Employee"}
                  />

                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">
                      {report.employee?.user?.name || "Employee"}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      {fmtDate(report.reportDate)}
                    </p>
                  </div>
                </div>

                <StatusBadge
                  value={report.overallStatus || "Submitted"}
                />
              </>
            )}
          />

          <ListCard
            title="Recent Team Leave Requests"
            subtitle="Latest leave applications"
            empty="No recent team leave requests."
            items={d.recentLeaves || []}
            link="/leaves"
            render={leave => (
              <>
                <div className="flex min-w-0 items-center gap-3">
                  <EmployeeAvatar
                    name={leave.employee?.user?.name || "Employee"}
                  />

                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">
                      {leave.employee?.user?.name || "Employee"}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      {leave.leaveType || "Leave"} ·{" "}
                      {fmtDate(leave.startDate)}
                    </p>
                  </div>
                </div>

                <StatusBadge value={leave.status} />
              </>
            )}
          />
        </div>
      </div>
    );
  }

  // =====================================================
  // EMPLOYEE DASHBOARD
  // =====================================================

  const att = d.attendance;
  const leave = d.latestLeave;

  return (
    <div className="space-y-7 pb-8">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-indigo-800 p-6 text-white shadow-lg sm:p-8">
        <div className="relative z-10 flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-indigo-100">
              <UserCheck size={14} />
              Employee Workspace
            </div>

            <h1 className="text-2xl font-bold sm:text-3xl">
              Hello, {getFirstName(user?.name)}!
            </h1>

            <p className="mt-2 text-sm leading-6 text-indigo-100/80">
              Welcome to your workspace. Here's your attendance, daily
              reports and leave overview.
            </p>
          </div>

          <button
            type="button"
            onClick={refreshDashboard}
            disabled={loading}
            className="inline-flex items-center gap-2 self-start rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20 disabled:opacity-50"
          >
            <RefreshCw
              size={16}
              className={loading ? "animate-spin" : ""}
            />
            Refresh
          </button>
        </div>

        <div className="pointer-events-none absolute -right-12 -top-24 h-72 w-72 rounded-full border-[35px] border-white/5" />
      </div>

      {error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Dashboard refresh failed: {error}
        </div>
      )}

      {/* HR ANNOUNCEMENTS */}
      <AnnouncementSection
        announcements={announcements}
        loading={announcementsLoading}
        error={announcementsError}
        onRetry={refreshDashboard}
      />

      <SectionHeader
        title="My Overview"
        subtitle="Your latest attendance and work activity."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <EmployeeAttendanceCard attendance={att} />

        <Stat
          label="Today's DAR"
          icon={FileText}
          tone={d.submittedDarToday ? "green" : "amber"}
          value={d.submittedDarToday ? "Submitted" : "Not Submitted"}
          description="Daily activity report status"
        />

        <div className="rounded-2xl border border-slate-200 border-l-4 border-l-indigo-500 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-500">
                Latest Leave Request
              </p>

              <div className="mt-3">
                {leave ? (
                  <StatusBadge value={leave.status} />
                ) : (
                  <p className="text-xl font-bold text-slate-900">
                    No Requests
                  </p>
                )}
              </div>
            </div>

            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <CalendarDays size={23} />
            </div>
          </div>

          <p className="mt-4 text-xs text-slate-400">
            {leave
              ? `${leave.leaveType || "Leave"} · ${fmtDate(leave.startDate)}`
              : "Your leave application history will appear here."}
          </p>
        </div>
      </div>

      {leave?.reviewNote && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="mt-0.5 text-amber-600">
            <CircleAlert size={19} />
          </div>

          <div>
            <p className="text-sm font-semibold text-amber-900">
              HR Review Note
            </p>

            <p className="mt-1 text-sm leading-6 text-amber-800">
              {leave.reviewNote}
            </p>

            {leave.reviewedBy?.name && (
              <p className="mt-2 text-xs text-amber-700">
                Reviewed by {leave.reviewedBy.name}
              </p>
            )}
          </div>
        </div>
      )}

      <section>
        <SectionHeader
          title="Quick Actions"
          subtitle="Access your everyday work activities."
        />

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <QuickAction
            to="/attendance"
            icon={Clock}
            title="My Attendance"
            description="Check in, check out, manage lunch and view attendance history."
            tone="green"
          />

          <QuickAction
            to="/reports"
            icon={FileText}
            title="Daily Activity Report"
            description="Submit and review your daily work reports."
            tone="indigo"
          />

          <QuickAction
            to="/leaves"
            icon={CalendarDays}
            title="Apply for Leave"
            description="Submit and track your leave applications."
            tone="sky"
          />
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <ListCard
          title="My Recent Leave Requests"
          subtitle="Your latest leave applications"
          empty="You haven't submitted any leave requests yet."
          items={d.recentLeaves || []}
          link="/leaves"
          render={item => (
            <>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800">
                  {item.leaveType || "Leave"}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  {fmtDate(item.startDate)} – {fmtDate(item.endDate)}
                </p>
              </div>

              <StatusBadge value={item.status} />
            </>
          )}
        />

        <ListCard
          title="My Recent Daily Reports"
          subtitle="Your latest report submissions"
          empty="You haven't submitted any daily reports yet."
          items={d.recentReports || []}
          link="/reports"
          render={report => (
            <>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800">
                  Daily Activity Report
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  {fmtDate(report.reportDate)}
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs font-medium text-emerald-600">
                <CheckCircle2 size={15} />
                {report.overallStatus || "Submitted"}
              </div>
            </>
          )}
        />
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4">
        <div className="mt-0.5 text-indigo-600">
          <ShieldCheck size={19} />
        </div>

        <div>
          <p className="text-sm font-semibold text-indigo-900">
            Your workspace
          </p>

          <p className="mt-1 text-xs leading-5 text-indigo-700">
            Keep your attendance updated and submit your daily activity
            reports regularly. You can track your leave applications and
            review updates from HR through this dashboard.
          </p>
        </div>
      </div>
    </div>
  );
}
