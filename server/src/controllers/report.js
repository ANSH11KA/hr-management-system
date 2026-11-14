// controllers/report.js
import DailyReport from "../models/DailyReport.js";
import Employee from "../models/Employee.js";
import { wrap } from "./wrap.js";
import { todayStr, isValidDateStr } from "../utils/time.js";

const isStr = v => typeof v === "string";
const OPTIONAL = ["inProgress", "blockers", "nextDayPlan"];

export const createReport = wrap(async (req, res) => {
  const { reportDate, workCompleted, inProgress, blockers, nextDayPlan } = req.body;

  if (!isStr(workCompleted) || !workCompleted.trim())
    return res.status(400).json({ message: "Work completed is required" });
  if (OPTIONAL.some(k => req.body[k] !== undefined && !isStr(req.body[k])))
    return res.status(400).json({ message: "Invalid report fields" });
  if (!isValidDateStr(reportDate) || reportDate > todayStr())
    return res.status(400).json({ message: "Report date must be a valid date that is not in the future" });

  // friendly message; the unique index still protects against simultaneous requests
  if (await DailyReport.exists({ employee: req.employee._id, reportDate }))
    return res.status(409).json({ message: "You have already submitted a report for this date" });

  const r = await DailyReport.create({
    employee: req.employee._id, reportDate,
    workCompleted: workCompleted.trim(), inProgress, blockers, nextDayPlan,
  });
  res.status(201).json(r);
});

// Assumption: a report can be edited only on the day it is for, and only by its owner
export const updateReport = wrap(async (req, res) => {
  const r = await DailyReport.findOne({ _id: req.params.id, employee: req.employee._id });
  if (!r) return res.status(404).json({ message: "Report not found" });
  if (r.reportDate !== todayStr())
    return res.status(403).json({ message: "Only today's report can be edited" });

  const { workCompleted } = req.body;
  if (workCompleted !== undefined) {
    if (!isStr(workCompleted) || !workCompleted.trim())
      return res.status(400).json({ message: "Work completed cannot be empty" });
    r.workCompleted = workCompleted.trim();
  }
  for (const k of OPTIONAL) {
    if (req.body[k] === undefined) continue;
    if (!isStr(req.body[k])) return res.status(400).json({ message: "Invalid report fields" });
    r[k] = req.body[k]; // empty string is allowed, so a field can be cleared
  }
  await r.save();
  res.json(r);
});

export const myReports = wrap(async (req, res) =>
  res.json(await DailyReport.find({ employee: req.employee._id }).sort({ reportDate: -1 })));

export const listReports = wrap(async (req, res) => {
  const { employee, department, from, to } = req.query;

  if ([employee, department, from, to].some(v => v !== undefined && !isStr(v)))
    return res.status(400).json({ message: "Invalid filter values" });
  if ((from && !isValidDateStr(from)) || (to && !isValidDateStr(to)))
    return res.status(400).json({ message: "Dates must be in YYYY-MM-DD format" });

  const filter = {};
  if (employee) filter.employee = employee;
  if (department) {
    const ids = await Employee.find({ department }).distinct("_id");
    if (employee) {
      if (!ids.map(String).includes(employee)) return res.json([]); // employee not in that department
    } else {
      filter.employee = { $in: ids };
    }
  }
  if (from || to) filter.reportDate = { ...(from && { $gte: from }), ...(to && { $lte: to }) };

  res.json(
    await DailyReport.find(filter)
      .populate({ path: "employee", populate: { path: "user", select: "name" } })
      .sort({ reportDate: -1 })
      .limit(200)
  );
});