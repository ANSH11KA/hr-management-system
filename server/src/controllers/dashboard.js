// controllers/dashboard.js
import Employee from "../models/Employee.js";
import Attendance from "../models/Attendance.js";
import LeaveRequest from "../models/LeaveRequest.js";
import DailyReport from "../models/DailyReport.js";
import { wrap } from "./wrap.js";
import { todayStr } from "../utils/time.js";

const ACTIVE = ["active", "probation"];
const withName = { path: "employee", populate: { path: "user", select: "name" } };

export const dashboard = wrap(async (req, res) => {
  const date = todayStr(); // business timezone (Asia/Kolkata)
  const day = new Date(`${date}T00:00:00Z`); // leave dates are stored as UTC midnight

  // ---------- HR / Admin ----------
  if (req.user.role === "admin") {
    // Only count people who are currently active
    const activeIds = await Employee.find({ employmentStatus: { $in: ACTIVE } }).distinct("_id");

    const [presentIds, leaveIds, pendingLeaves, dars, recentLeaves, recentReports] = await Promise.all([
      Attendance.find({ date, employee: { $in: activeIds } }).distinct("employee"),
      LeaveRequest.find({
        status: "Approved", employee: { $in: activeIds },
        startDate: { $lte: day }, endDate: { $gte: day },
      }).distinct("employee"),
      LeaveRequest.countDocuments({ status: "Pending" }),
      DailyReport.countDocuments({ reportDate: date, employee: { $in: activeIds } }),
      LeaveRequest.find().populate(withName).sort({ createdAt: -1 }).limit(5),
      DailyReport.find().populate(withName).sort({ submittedAt: -1 }).limit(5),
    ]);

    const active = activeIds.length;
    const present = presentIds.length;
    const presentSet = new Set(presentIds.map(String));
    // on leave = approved leave covering today, and not already checked in
    const onLeave = leaveIds.filter(id => !presentSet.has(String(id))).length;

    return res.json({
      role: "admin",
      activeEmployees: active,
      presentToday: present,
      onLeaveToday: onLeave,
      absentToday: Math.max(active - present - onLeave, 0),
      pendingLeaves,
      darsToday: dars,
      darsMissing: Math.max(active - dars, 0),
      recentLeaves,
      recentReports,
    });
  }

  // ---------- Employee ----------
  if (!req.employee)
    return res.status(404).json({ message: "No employee record found for this account" });

  const id = req.employee._id;
  const [attendance, latestDar, latestLeave, recentLeaves, recentReports] = await Promise.all([
    Attendance.findOne({ employee: id, date }),
    DailyReport.findOne({ employee: id }).sort({ reportDate: -1 }),
    LeaveRequest.findOne({ employee: id }).populate("reviewedBy", "name").sort({ createdAt: -1 }),
    LeaveRequest.find({ employee: id }).sort({ createdAt: -1 }).limit(5),
    DailyReport.find({ employee: id }).sort({ reportDate: -1 }).limit(5),
  ]);

  res.json({
    role: "employee",
    today: date,
    attendance,
    latestDar,
    submittedDarToday: latestDar?.reportDate === date,
    latestLeave,
    recentLeaves,
    recentReports,
  });
});