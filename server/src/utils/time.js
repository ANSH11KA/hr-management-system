// server/src/utils/time.js
const TZ = "Asia/Kolkata"; // business timezone

// "YYYY-MM-DD" in the business timezone
export const todayStr = (d = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);

// minutes since midnight in the business timezone
export const minutesOfDay = (d = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(d);
  const get = t => Number(parts.find(p => p.type === t).value);
  return (get("hour") % 24) * 60 + get("minute"); // % 24 guards the "24:00" midnight quirk
};

// true for a valid "YYYY-MM-DD" string that is a real calendar date
export const isValidDateStr = s => {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !isNaN(d) && d.toISOString().slice(0, 10) === s;
};

// day of week (0 = Sunday ... 6 = Saturday) for a "YYYY-MM-DD" string
export const dayOfWeek = s => new Date(`${s}T00:00:00Z`).getUTCDay();