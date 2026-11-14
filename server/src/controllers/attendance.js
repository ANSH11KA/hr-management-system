// server/src/controllers/attendance.js
import Attendance from "../models/Attendance.js";
import Employee from "../models/Employee.js";
import LeaveRequest from "../models/LeaveRequest.js";
import { wrap } from "./wrap.js";
import { todayStr, minutesOfDay, isValidDateStr, dayOfWeek } from "../utils/time.js";

// Assumptions (business timezone: Asia/Kolkata):
// - Late = check-in after 09:30
// - Under 240 minutes worked = Half Day
// - Absent / Leave are computed at query time (not stored)

const LATE_AFTER = 9 * 60 + 30;
const isStr = v => typeof v === "string";

export const checkIn = wrap(async (req, res) => {
  const date = todayStr();
  if (await Attendance.exists({ employee: req.employee._id, date }))
    return res.status(409).json({ message: "Already checked in today" });

  const now = new Date();
  const late = minutesOfDay(now) > LATE_AFTER;
  const rec = await Attendance.create({
    employee: req.employee._id,
    date,
    checkInAt: now,
    status: late ? "Late" : "Present",
  });
  res.status(201).json(rec);
});

export const checkOut = wrap(async (req, res) => {
  const rec = await Attendance.findOne({ employee: req.employee._id, date: todayStr() });
  if (!rec) return res.status(400).json({ message: "Check in first" });
  if (rec.checkOutAt) return res.status(409).json({ message: "Already checked out" });

  rec.checkOutAt = new Date();
  rec.totalMinutes = Math.max(Math.round((rec.checkOutAt - rec.checkInAt) / 60000), 0);
  if (rec.totalMinutes < 240) rec.status = "Half Day";
  await rec.save();
  res.json(rec);
});

export const myHistory = wrap(async (req, res) => {
  const { month } = req.query; // e.g. "2026-11"
  if (month !== undefined && (!isStr(month) || !/^\d{4}-\d{2}$/.test(month)))
    return res.status(400).json({ message: "Month must be in YYYY-MM format" });

  const filter = { employee: req.employee._id };
  if (month) filter.date = { $gte: `${month}-01`, $lte: `${month}-31` }; // string range, no regex needed

  const items = await Attendance.find(filter).sort({ date: -1 });
  const summary = items.reduce((a, r) => ({ ...a, [r.status]: (a[r.status] || 0) + 1 }), {});
  res.json({ items, summary });
});

export const listAll = wrap(async (req, res) => {
  const { date, employee, status, department } = req.query;

  if ([date, employee, status, department].some(v => v !== undefined && !isStr(v)))
    return res.status(400).json({ message: "Invalid filter values" });
  if (date && !isValidDateStr(date))
    return res.status(400).json({ message: "Date must be in YYYY-MM-DD format" });

  const filter = {};
  if (date) filter.date = date;
  if (status) filter.status = status;
  if (employee) filter.employee = employee;

  if (department) {
    const ids = await Employee.find({ department }).distinct("_id");
    if (employee) {
      if (!ids.map(String).includes(employee)) return res.json([]);
    } else {
      filter.employee = { $in: ids };
    }
  }

  const items = await Attendance.find(filter)
    .populate({ path: "employee", populate: { path: "user", select: "name" } })
    .sort({ date: -1 })
    .limit(200);

  // Absent / Leave: only for one specific past-or-today weekday, across employees
  const dow = date ? dayOfWeek(date) : null;
  const wantsSynthetic =
    date && !employee && date <= todayStr() && dow !== 0 && dow !== 6 &&
    (!status || ["Absent", "Leave"].includes(status));

  let extra = [];
  if (wantsSynthetic) {
    const day = new Date(`${date}T00:00:00Z`);
    const empFilter = {
      employmentStatus: { $in: ["active", "probation"] },
      joiningDate: { $lte: day },
    };
    if (department) empFilter.department = department;

    const [emps, marked, onLeave] = await Promise.all([
      Employee.find(empFilter).populate("user", "name"),
      Attendance.find({ date }).distinct("employee"),
      LeaveRequest.find({ status: "Approved", startDate: { $lte: day }, endDate: { $gte: day } })
        .distinct("employee"),
    ]);
    const markedSet = new Set(marked.map(String));
    const leaveSet = new Set(onLeave.map(String));

    extra = emps
      .filter(e => !markedSet.has(String(e._id)))
      .map(e => ({
        _id: `synthetic-${e._id}`,
        employee: { user: { name: e.user?.name } },
        date,
        totalMinutes: 0,
        status: leaveSet.has(String(e._id)) ? "Leave" : "Absent",
      }))
      .filter(r => !status || r.status === status);
  }

  res.json([...items, ...extra]);
});