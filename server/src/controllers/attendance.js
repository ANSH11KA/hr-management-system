
import mongoose from "mongoose";

import Attendance from "../models/Attendance.js";
import Employee from "../models/Employee.js";
import LeaveRequest from "../models/LeaveRequest.js";
import { wrap } from "./wrap.js";

import {
  todayStr,
  minutesOfDay,
  isValidDateStr,
  dayOfWeek,
} from "../utils/time.js";

// Business timezone: Asia/Kolkata
// Late: check-in after 09:30
// Half Day: less than 240 minutes worked
// Absent / Leave: calculated at query time

const LATE_AFTER = 9 * 60 + 30;
const INDIA_OFFSET_MINUTES = 330;

const ATTENDANCE_STATUSES = [
  "Present",
  "Absent",
  "Half Day",
  "Late",
  "Leave",
];

const isStr = value => typeof value === "string";

const EMPLOYEE_POPULATE = {
  path: "employee",
  select:
    "employeeId department designation personal.firstName personal.middleName personal.lastName user",
  populate: {
    path: "user",
    select: "name email",
  },
};

// Convert YYYY-MM-DD into the UTC timestamp corresponding
// to midnight in Asia/Kolkata.
const getIndiaDayRange = date => {
  const [year, month, day] = date.split("-").map(Number);

  const start = new Date(
    Date.UTC(year, month - 1, day) -
      INDIA_OFFSET_MINUTES * 60 * 1000
  );

  const nextDay = new Date(
    start.getTime() + 24 * 60 * 60 * 1000
  );

  const end = new Date(nextDay.getTime() - 1);

  return { start, end };
};

// Get all direct and indirect reports of a manager.
const getSubordinateIds = async managerId => {
  const visited = new Set([String(managerId)]);
  const subordinateIds = [];

  let currentLevel = [managerId];

  while (currentLevel.length) {
    const children = await Employee.find({
      manager: { $in: currentLevel },
    }).select("_id");

    const nextLevel = [];

    for (const child of children) {
      const id = String(child._id);

      if (!visited.has(id)) {
        visited.add(id);
        subordinateIds.push(child._id);
        nextLevel.push(child._id);
      }
    }

    currentLevel = nextLevel;
  }

  return subordinateIds;
};

// Check-in
export const checkIn = wrap(async (req, res) => {
  if (!req.employee) {
    return res.status(403).json({
      message: "Employee profile not found.",
    });
  }

  const date = todayStr();
  const now = new Date();
  const late = minutesOfDay(now) > LATE_AFTER;

  try {
    const record = await Attendance.create({
      employee: req.employee._id,
      date,
      checkInAt: now,
      status: late ? "Late" : "Present",
    });

    return res.status(201).json(record);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "Already checked in today.",
      });
    }

    throw error;
  }
});

// Check-out
export const checkOut = wrap(async (req, res) => {
  if (!req.employee) {
    return res.status(403).json({
      message: "Employee profile not found.",
    });
  }

  const record = await Attendance.findOne({
    employee: req.employee._id,
    date: todayStr(),
  });

  if (!record) {
    return res.status(400).json({
      message: "Check in first.",
    });
  }

  if (record.checkOutAt) {
    return res.status(409).json({
      message: "Already checked out.",
    });
  }

  const checkOutAt = new Date();

  if (checkOutAt < record.checkInAt) {
    return res.status(400).json({
      message: "Invalid check-out time.",
    });
  }

  record.checkOutAt = checkOutAt;

  record.totalMinutes = Math.max(
    Math.round(
      (record.checkOutAt.getTime() -
        record.checkInAt.getTime()) /
        60000
    ),
    0
  );

  if (record.totalMinutes < 240) {
    record.status = "Half Day";
  }

  await record.save();

  return res.json(record);
});

// Employee / Manager personal attendance history.
export const myHistory = wrap(async (req, res) => {
  if (!req.employee) {
    return res.status(403).json({
      message: "Employee profile not found.",
    });
  }

  const { month } = req.query;

  if (
    month !== undefined &&
    (
      !isStr(month) ||
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)
    )
  ) {
    return res.status(400).json({
      message: "Month must be in YYYY-MM format.",
    });
  }

  const filter = {
    employee: req.employee._id,
  };

  if (month) {
    const [year, monthNumber] = month.split("-").map(Number);

    const lastDay = new Date(
      Date.UTC(year, monthNumber, 0)
    ).getUTCDate();

    filter.date = {
      $gte: `${month}-01`,
      $lte: `${month}-${String(lastDay).padStart(2, "0")}`,
    };
  }

  const items = await Attendance.find(filter)
    .sort({ date: -1 });

  const summary = {};

  for (const record of items) {
    summary[record.status] =
      (summary[record.status] || 0) + 1;
  }

  return res.json({
    items,
    summary,
  });
});

// Admin: organisation-wide attendance.
// Manager: attendance of complete reporting hierarchy.
export const listAll = wrap(async (req, res) => {
  const { date, employee, status, department } = req.query;

  // Validate filter types.
  if (
    [date, employee, status, department].some(
      value => value !== undefined && !isStr(value)
    )
  ) {
    return res.status(400).json({
      message: "Invalid filter values.",
    });
  }

  if (date && !isValidDateStr(date)) {
    return res.status(400).json({
      message: "Date must be in YYYY-MM-DD format.",
    });
  }

  if (
    status &&
    !ATTENDANCE_STATUSES.includes(status)
  ) {
    return res.status(400).json({
      message: "Invalid attendance status.",
    });
  }

  if (
    employee &&
    !mongoose.isValidObjectId(employee)
  ) {
    return res.status(400).json({
      message: "Invalid employee ID.",
    });
  }

  const isAdmin = req.user.role === "admin";
  const isManager = req.user.role === "manager";

  if (!isAdmin && !isManager) {
    return res.status(403).json({
      message: "You are not allowed to view team attendance.",
    });
  }

  // Build employee access scope.
  let allowedIds = null;

  if (isManager) {
    if (!req.employee) {
      return res.status(403).json({
        message: "Manager employee profile not found.",
      });
    }

    allowedIds = await getSubordinateIds(req.employee._id);
  }

  // Apply department restriction to the allowed employee IDs.
  if (department) {
    const departmentIds = await Employee.find({
      department,
    }).distinct("_id");

    if (allowedIds !== null) {
      const allowedSet = new Set(
        allowedIds.map(String)
      );

      allowedIds = departmentIds.filter(id =>
        allowedSet.has(String(id))
      );
    } else {
      allowedIds = departmentIds;
    }
  }

  // Verify requested employee belongs to the final access scope.
  // This prevents bypassing manager and department restrictions.
  if (
    employee &&
    allowedIds !== null &&
    !allowedIds.some(id => String(id) === employee)
  ) {
    return res.status(403).json({
      message: "You cannot access this employee's attendance.",
    });
  }

  if (
    allowedIds !== null &&
    allowedIds.length === 0
  ) {
    return res.json([]);
  }

  // Build attendance query.
  const filter = {};

  if (date) {
    filter.date = date;
  }

  if (status) {
    filter.status = status;
  }

  if (employee) {
    filter.employee = employee;
  } else if (allowedIds !== null) {
    filter.employee = {
      $in: allowedIds,
    };
  }

  const items = await Attendance.find(filter)
    .populate(EMPLOYEE_POPULATE)
    .sort({ date: -1, checkInAt: -1 })
    .limit(200);

  // Calculate synthetic Absent / Leave records
  // for past or current working days.
  const wantsSynthetic =
    Boolean(date) &&
    !employee &&
    date <= todayStr() &&
    dayOfWeek(date) !== 0 &&
    dayOfWeek(date) !== 6 &&
    (!status || ["Absent", "Leave"].includes(status));

  let extra = [];

  if (wantsSynthetic) {
    const { start, end } = getIndiaDayRange(date);

    const empFilter = {
      employmentStatus: {
        $in: ["active", "probation"],
      },
      joiningDate: {
        $lte: end,
      },
    };

    if (department) {
      empFilter.department = department;
    }

    if (allowedIds !== null) {
      empFilter._id = {
        $in: allowedIds,
      };
    }

    const [
      employees,
      marked,
      onLeave,
    ] = await Promise.all([
      Employee.find(empFilter)
        .select(
          "employeeId department designation personal.firstName personal.middleName personal.lastName user"
        )
        .populate("user", "name email"),

      Attendance.find({
        date,
      }).distinct("employee"),

      LeaveRequest.find({
        status: "Approved",
        startDate: { $lte: end },
        endDate: { $gte: start },
      }).distinct("employee"),
    ]);

    const markedSet = new Set(
      marked.map(String)
    );

    const leaveSet = new Set(
      onLeave.map(String)
    );

    extra = employees
      .filter(employeeRecord =>
        !markedSet.has(String(employeeRecord._id))
      )
      .map(employeeRecord => {
        const isOnLeave = leaveSet.has(
          String(employeeRecord._id)
        );

        return {
          _id: `synthetic-${employeeRecord._id}`,
          employee: {
            _id: employeeRecord._id,
            employeeId: employeeRecord.employeeId,
            department: employeeRecord.department,
            designation: employeeRecord.designation,
            personal: employeeRecord.personal,
            user: {
              name: employeeRecord.user?.name || "-",
              email: employeeRecord.user?.email || "",
            },
          },
          date,
          checkInAt: null,
          checkOutAt: null,
          totalMinutes: 0,
          status: isOnLeave ? "Leave" : "Absent",
        };
      })
      .filter(record =>
        !status || record.status === status
      );
  }

  return res.json([
    ...items,
    ...extra,
  ]);
});
