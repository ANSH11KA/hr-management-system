
import mongoose from "mongoose";
import LeaveRequest from "../models/LeaveRequest.js";
import Employee from "../models/Employee.js";
import { wrap } from "./wrap.js";

// Convert YYYY-MM-DD into India-local day boundaries.
const parseLocalDate = (value, endOfDay = false) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);
  const check = new Date(Date.UTC(year, month - 1, day));

  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }

  return new Date(
    `${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}+05:30`
  );
};

const getSubordinateIds = async (managerId) => {
  const visited = new Set([String(managerId)]);
  const subordinateIds = [];
  let currentLevel = [managerId];

  while (currentLevel.length) {
    const employees = await Employee.find({
      reportingManager: { $in: currentLevel },
      isActive: true,
    }).select("_id");

    const nextLevel = [];

    for (const employee of employees) {
      const id = String(employee._id);

      if (!visited.has(id)) {
        visited.add(id);
        subordinateIds.push(employee._id);
        nextLevel.push(employee._id);
      }
    }

    currentLevel = nextLevel;
  }

  return subordinateIds;
};

// Employee applies for leave.
export const applyLeave = wrap(async (req, res) => {
  const { leaveType, startDate, endDate, reason } = req.body;

  const validTypes = ["Casual", "Sick", "Earned", "Unpaid"];

  if (!validTypes.includes(leaveType)) {
    return res.status(400).json({ message: "Invalid leave type." });
  }

  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate, true);

  if (!start || !end) {
    return res.status(400).json({
      message: "Enter valid start and end dates in YYYY-MM-DD format.",
    });
  }

  if (end < start) {
    return res.status(400).json({
      message: "End date cannot be earlier than start date.",
    });
  }

  if (typeof reason !== "string" || !reason.trim()) {
    return res.status(400).json({ message: "Leave reason is required." });
  }

  if (reason.trim().length > 500) {
    return res.status(400).json({
      message: "Leave reason cannot exceed 500 characters.",
    });
  }

  const overlappingLeave = await LeaveRequest.findOne({
    employee: req.employee._id,
    status: { $in: ["Pending", "Approved"] },
    startDate: { $lte: end },
    endDate: { $gte: start },
  });

  if (overlappingLeave) {
    return res.status(409).json({
      message: "You already have a pending or approved leave for these dates.",
    });
  }

  const leave = await LeaveRequest.create({
    employee: req.employee._id,
    leaveType,
    startDate: start,
    endDate: end,
    reason: reason.trim(),
  });

  return res.status(201).json({
    message: "Leave request submitted successfully.",
    leave,
  });
});

// Employee views their own leave requests.
export const myLeaves = wrap(async (req, res) => {
  const leaves = await LeaveRequest.find({
    employee: req.employee._id,
  })
    .populate("reviewedBy", "name email")
    .sort({ createdAt: -1 });

  return res.json(leaves);
});

// Admin views all leaves; manager views their reporting hierarchy.
export const listLeaves = wrap(async (req, res) => {
  const filter = {};
  const { status, employeeId } = req.query;

  if (status) {
    const allowedStatuses = [
      "Pending",
      "Approved",
      "Rejected",
      "Cancelled",
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid leave status." });
    }

    filter.status = status;
  }

  if (req.user.role === "manager") {
    const subordinateIds = await getSubordinateIds(req.employee._id);

    filter.employee = { $in: subordinateIds };
  }

  if (employeeId) {
    if (!mongoose.isValidObjectId(employeeId)) {
      return res.status(400).json({ message: "Invalid employee ID." });
    }

    if (filter.employee) {
      const allowedIds = new Set(filter.employee.$in.map(String));

      if (!allowedIds.has(String(employeeId))) {
        return res.status(403).json({
          message: "You cannot view this employee's leave requests.",
        });
      }
    }

    filter.employee = employeeId;
  }

  const leaves = await LeaveRequest.find(filter)
    .populate({
      path: "employee",
      select: "employeeCode department designation user",
      populate: {
        path: "user",
        select: "name email",
      },
    })
    .populate("reviewedBy", "name email")
    .sort({ createdAt: -1 })
    .limit(200);

  return res.json(leaves);
});

// Admin approves or rejects a leave request.
export const decide = wrap(async (req, res) => {
  const { id } = req.params;
  const { status, reviewNote = "" } = req.body;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ message: "Invalid leave request ID." });
  }

  if (!["Approved", "Rejected"].includes(status)) {
    return res.status(400).json({
      message: "Status must be Approved or Rejected.",
    });
  }

  if (typeof reviewNote !== "string" || reviewNote.length > 1000) {
    return res.status(400).json({
      message: "Review note must be a string of at most 1000 characters.",
    });
  }

  const leave = await LeaveRequest.findById(id);

  if (!leave) {
    return res.status(404).json({ message: "Leave request not found." });
  }

  if (leave.status !== "Pending") {
    return res.status(409).json({
      message: "Only pending leave requests can be reviewed.",
    });
  }

  leave.status = status;
  leave.reviewedBy = req.user._id;
  leave.reviewedAt = new Date();
  leave.reviewNote = reviewNote.trim();

  await leave.save();

  return res.json({
    message: `Leave request ${status.toLowerCase()} successfully.`,
    leave,
  });
});

// Employee cancels their own pending leave request.
export const cancelLeave = wrap(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ message: "Invalid leave request ID." });
  }

  const leave = await LeaveRequest.findOne({
    _id: id,
    employee: req.employee._id,
  });

  if (!leave) {
    return res.status(404).json({ message: "Leave request not found." });
  }

  if (leave.status !== "Pending") {
    return res.status(409).json({
      message: "Only pending leave requests can be cancelled.",
    });
  }

  leave.status = "Cancelled";
  await leave.save();

  return res.json({
    message: "Leave request cancelled successfully.",
    leave,
  });
});
