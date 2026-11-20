
const TZ = "Asia/Kolkata";

// Validate YYYY-MM-DD and ensure it is a real calendar date.
export const isValidDateStr = value => {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);

  const date = new Date(
    Date.UTC(year, month - 1, day)
  );

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

// YYYY-MM-DD in the business timezone.
export const todayStr = (date = new Date()) => {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
};

// Minutes since midnight in the business timezone.
export const minutesOfDay = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const get = type =>
    Number(parts.find(part => part.type === type)?.value);

  return get("hour") * 60 + get("minute");
};

// Day of week for YYYY-MM-DD.
// 0 = Sunday, 1 = Monday ... 6 = Saturday.
export const dayOfWeek = dateStr => {
  if (!isValidDateStr(dateStr)) {
    throw new Error("Invalid date. Expected YYYY-MM-DD.");
  }

  const [year, month, day] = dateStr.split("-").map(Number);

  return new Date(
    Date.UTC(year, month - 1, day)
  ).getUTCDay();
};
