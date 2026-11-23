// server/src/utils/rules.js
// One place for the attendance policy. Change a number here and the controller,
// the API response and the employee page all follow.
import { dayOfWeek } from "./time.js";

export const RULES = {
  OFFICE_START_MINUTES: 9 * 60 + 30,  // 9:30 AM
  LATE_AFTER_MINUTES: 9 * 60 + 45,    // checking in after 9:45 AM is late
  OFFICE_END_MINUTES: 18 * 60 + 30,   // 6:30 PM
  MAX_LUNCH_MINUTES: 60,
  HALF_DAY_MINUTES: 240,              // at least 4 hours of actual work
  FULL_DAY_MINUTES: 480,              // at least 8 hours of actual work
  LATE_ALLOWANCE_PER_MONTH: 2,        // the 3rd late arrival in a month is over the limit
  WEEKLY_OFF_DAYS: [0],               // 0 = Sunday. Monday to Saturday are working days.
};

export const isWeeklyOff = date => RULES.WEEKLY_OFF_DAYS.includes(dayOfWeek(date));

const hhmm = m => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

// the policy as the page needs to show it
export const publicRules = () => ({
  officeStart: hhmm(RULES.OFFICE_START_MINUTES),
  lateAfter: hhmm(RULES.LATE_AFTER_MINUTES),
  officeEnd: hhmm(RULES.OFFICE_END_MINUTES),
  lunchMaxMinutes: RULES.MAX_LUNCH_MINUTES,
  halfDayMinutes: RULES.HALF_DAY_MINUTES,
  fullDayMinutes: RULES.FULL_DAY_MINUTES,
  lateAllowancePerMonth: RULES.LATE_ALLOWANCE_PER_MONTH,
  weeklyOffDays: [...RULES.WEEKLY_OFF_DAYS],
});

// ---------- late arrivals ----------
// count = late arrivals this month INCLUDING the one just recorded
export const lateInfo = count => ({
  lateNumber: count,
  allowed: RULES.LATE_ALLOWANCE_PER_MONTH,
  remaining: Math.max(RULES.LATE_ALLOWANCE_PER_MONTH - count, 0),
  overLimit: count > RULES.LATE_ALLOWANCE_PER_MONTH,
});

// ---------- date helpers (all "YYYY-MM-DD" strings) ----------
export const addDays = (dateStr, n) => {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export const lastDayOfMonth = month => {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};

export const monthBounds = month => ({
  start: `${month}-01`,
  end: `${month}-${String(lastDayOfMonth(month)).padStart(2, "0")}`,
});

// Every date covered by approved leaves, limited to one month
export const expandLeaveDates = (leaves, month) => {
  const { start, end } = monthBounds(month);
  const dates = new Set();
  for (const l of leaves) {
    let d = l.startDate.toISOString().slice(0, 10);
    const to = l.endDate.toISOString().slice(0, 10);
    if (d < start) d = start;
    const stop = to < end ? to : end;
    for (; d <= stop; d = addDays(d, 1)) dates.add(d);
  }
  return dates;
};

// Working days in the month so far with no attendance record: Leave if an approved leave
// covers the day, otherwise Absent. Today is never counted (the day is not over), and
// weekly offs and days before the joining date are skipped.
// TODO: once the Holiday model exists, skip holidays here too.
export const computeMissedDays = ({ month, today, joiningDate, recordedDates, leaveDates }) => {
  const { start, end } = monthBounds(month);
  const yesterday = addDays(today, -1);
  const last = yesterday < end ? yesterday : end;
  const missed = [];
  let workingDaysElapsed = 0;
  let weeklyOffDays = 0;
  for (let d = start; d <= last; d = addDays(d, 1)) {
    if (d < joiningDate) continue;
    if (isWeeklyOff(d)) { weeklyOffDays++; continue; }
    workingDaysElapsed++;
    if (recordedDates.has(d)) continue;
    missed.push({ date: d, status: leaveDates.has(d) ? "Leave" : "Absent" });
  }
  return { missed: missed.reverse(), workingDaysElapsed, weeklyOffDays };
};