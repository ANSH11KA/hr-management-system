
import mongoose from "mongoose";

import Attendance from "../models/Attendance.js";
import Employee from "../models/Employee.js";
import LeaveRequest from "../models/LeaveRequest.js";
import Notification from "../models/Notification.js";

import { wrap } from "./wrap.js";

import {
  todayStr,
  minutesOfDay,
  isValidDateStr,
  dayOfWeek,
} from "../utils/time.js";

// =====================================
// ATTENDANCE POLICY
// =====================================

const LATE_AFTER = 9 * 60 + 45; // 09:45 AM IST
const MAX_LUNCH_MINUTES = 60;

const HALF_DAY_MINUTES = 240;
const FULL_DAY_MINUTES = 480;

const MONTHLY_LATE_ALLOWANCE = 2;

const INDIA_OFFSET_MINUTES = 330;

const ATTENDANCE_STATUSES = [
  "Present",
  "Absent",
  "Half Day",
  "Late",
  "Leave",
];

const isStr = (value) => typeof value === "string";

const EMPLOYEE_POPULATE = {
  path: "employee",
  select:
    "employeeId department designation personal.firstName personal.middleName personal.lastName user",
  populate: {
    path: "user",
    select: "name email",
  },
};

// =====================================
// DATE HELPERS
// =====================================

// Convert YYYY-MM-DD into the UTC timestamp corresponding
// to midnight in Asia/Kolkata.
const getIndiaDayRange = (date) => {
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

const getMinutesBetween = (start, end) => {
  if (!start || !end) return 0;

  return Math.max(
    Math.round(
      (new Date(end) - new Date(start)) / 60000
    ),
    0
  );
};

const getWorkingMinutes = (record, checkOutAt) => {
  const totalMinutes = getMinutesBetween(
    record.checkInAt,
    checkOutAt
  );

  const lunchMinutes = Number(
    record.lunchMinutes || 0
  );

  return Math.max(totalMinutes - lunchMinutes, 0);
};

const getAttendanceStatus = (workingMinutes) => {
  if (workingMinutes >= FULL_DAY_MINUTES) {
    return "Present";
  }

  if (workingMinutes >= HALF_DAY_MINUTES) {
    return "Half Day";
  }

  return "Absent";
};

// =====================================
// MONTHLY LATE ARRIVAL HELPER
// =====================================

const getMonthlyLateCount = async (employeeId, date) => {
  const currentMonth = date.slice(0, 7);

  return Attendance.countDocuments({
    employee: employeeId,
    date: {
      $gte: `${currentMonth}-01`,
      $lte: `${currentMonth}-31`,
    },
    isLate: true,
  });
};

// =====================================
// EMPLOYEE NAME HELPER
// =====================================

const getEmployeeName = (employee) => {
  const personal = employee.personal || {};

  return (
    [
      personal.firstName,
      personal.middleName,
      personal.lastName,
    ]
      .filter(Boolean)
      .join(" ") ||
    employee.user?.name ||
    "Employee"
  );
};

// =====================================
// MANAGER HELPER
// =====================================

// Get all direct and indirect reports of a manager.
const getSubordinateIds = async (managerId) => {
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

// =====================================
// CHECK IN
// POST /api/attendance/check-in
// =====================================

export const checkIn = wrap(async (req, res) => {
  if (!req.employee) {
    return res.status(403).json({
      message: "Employee profile not found.",
    });
  }

  const date = todayStr();
  const now = new Date();

  // Late only after 09:45 AM IST.
  const late = minutesOfDay(now) > LATE_AFTER;

  try {
    // Create attendance first.
    const record = await Attendance.create({
      employee: req.employee._id,
      date,
      checkInAt: now,
      status: "Present",
      isLate: late,
      totalMinutes: 0,
      workingMinutes: 0,
      lunchMinutes: 0,
    });

    // -------------------------------------
    // ON-TIME CHECK-IN
    // -------------------------------------

    if (!late) {
      return res.status(201).json({
        message: "Check-in successful. You are on time.",
        record,
        lateInfo: null,
      });
    }

    // -------------------------------------
    // MONTHLY LATE COUNT
    // -------------------------------------

    const monthlyLateCount = await getMonthlyLateCount(
      req.employee._id,
      date
    );

    const exceededAllowance =
      monthlyLateCount > MONTHLY_LATE_ALLOWANCE;

    const remainingLates = Math.max(
      MONTHLY_LATE_ALLOWANCE - monthlyLateCount,
      0
    );

    // -------------------------------------
    // EMPLOYEE DETAILS
    // -------------------------------------

    const employeeName = getEmployeeName(req.employee);

    const employeeCode =
      req.employee.employeeId || "";

    const department =
      req.employee.department || "";

    // -------------------------------------
    // WARNING MESSAGE
    // -------------------------------------

    let warningText;

    if (exceededAllowance) {
      warningText =
        `You have checked in late ${monthlyLateCount} times this month. ` +
        `Your monthly allowance of ${MONTHLY_LATE_ALLOWANCE} late check-ins has been exceeded. ` +
        "This attendance has been flagged for HR review.";
    } else {
      const ordinal =
        monthlyLateCount === 1 ? "1st" : "2nd";

      warningText =
        `This is your ${ordinal} late check-in this month. ` +
        `${remainingLates} late allowance remaining this month.`;
    }

    // -------------------------------------
    // HR NOTIFICATION
    // -------------------------------------

    let notificationCreated = false;

    try {
      await Notification.findOneAndUpdate(
        {
          recipientRole: "admin",
          type: "LATE_ARRIVAL",
          attendance: record._id,
        },
        {
          $setOnInsert: {
            recipientRole: "admin",
            type: "LATE_ARRIVAL",

            title: exceededAllowance
              ? "Monthly Late Allowance Exceeded"
              : "Employee Late Arrival",

            message:
              `${employeeName} checked in late on ${date}. ` +
              `Monthly late count: ${monthlyLateCount}.`,

            employee: req.employee._id,
            attendance: record._id,

            data: {
              employeeName,
              employeeCode,
              department,
              attendanceDate: date,
              checkInAt: now,
              monthlyLateCount,
              allowedLates: MONTHLY_LATE_ALLOWANCE,
              exceededAllowance,
            },

            isRead: false,
          },
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        }
      );

      notificationCreated = true;
    } catch (notificationError) {
      // Attendance must remain saved even if notification fails.
      console.error(
        "Late arrival notification creation failed:",
        notificationError
      );
    }

    // -------------------------------------
    // RESPONSE FOR EMPLOYEE FRONTEND
    // -------------------------------------

    const lateInfo = {
      isLate: true,
      monthlyLateCount,
      allowedLates: MONTHLY_LATE_ALLOWANCE,
      remainingLates,
      exceededAllowance,
      warningText,
    };

    return res.status(201).json({
      message: "Check-in successful. You are marked late.",
      record,
      lateInfo,
      notificationCreated,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "Already checked in today.",
      });
    }

    throw error;
  }
});

// =====================================
// LUNCH OUT
// POST /api/attendance/lunch-out
// =====================================

export const lunchOut = wrap(async (req, res) => {
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
      message: "Please check in before starting lunch.",
    });
  }

  if (record.checkOutAt) {
    return res.status(400).json({
      message: "You have already checked out today.",
    });
  }

  if (record.lunchOutAt && !record.lunchInAt) {
    return res.status(409).json({
      message: "Your lunch break is already in progress.",
    });
  }

  if (record.lunchInAt) {
    return res.status(409).json({
      message: "You have already completed your lunch break today.",
    });
  }

  const now = new Date();

  if (now < record.checkInAt) {
    return res.status(400).json({
      message: "Invalid lunch start time.",
    });
  }

  record.lunchOutAt = now;

  await record.save();

  return res.json({
    message: "Lunch break started successfully.",
    record,
  });
});

// =====================================
// LUNCH IN
// POST /api/attendance/lunch-in
// =====================================

export const lunchIn = wrap(async (req, res) => {
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
      message: "Attendance record not found.",
    });
  }

  if (record.checkOutAt) {
    return res.status(400).json({
      message: "You have already checked out today.",
    });
  }

  if (!record.lunchOutAt) {
    return res.status(400).json({
      message: "Please start your lunch break first.",
    });
  }

  if (record.lunchInAt) {
    return res.status(409).json({
      message: "Lunch break has already been completed.",
    });
  }

  const now = new Date();

  if (now < record.lunchOutAt) {
    return res.status(400).json({
      message: "Invalid lunch return time.",
    });
  }

  const lunchMinutes = getMinutesBetween(
    record.lunchOutAt,
    now
  );

  record.lunchInAt = now;
  record.lunchMinutes = lunchMinutes;

  // Preserve actual duration.
  // Do not prevent the employee from returning after 60 minutes.
  record.lunchOverLimit =
    lunchMinutes > MAX_LUNCH_MINUTES;

  await record.save();

  return res.json({
    message: record.lunchOverLimit
      ? `Lunch completed in ${lunchMinutes} minutes. The permitted lunch duration is 60 minutes.`
      : "Lunch completed successfully.",
    record,
    lunchOverLimit: record.lunchOverLimit,
  });
});

// =====================================
// CHECK OUT
// POST /api/attendance/check-out
// =====================================

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
      message: "Please check in first.",
    });
  }

  if (record.checkOutAt) {
    return res.status(409).json({
      message: "Already checked out today.",
    });
  }

  if (record.lunchOutAt && !record.lunchInAt) {
    return res.status(400).json({
      message: "Please complete your lunch break before checking out.",
    });
  }

  const checkOutAt = new Date();

  if (checkOutAt < record.checkInAt) {
    return res.status(400).json({
      message: "Invalid check-out time.",
    });
  }

  record.checkOutAt = checkOutAt;

  // Total elapsed duration, including lunch.
  record.totalMinutes = getMinutesBetween(
    record.checkInAt,
    checkOutAt
  );

  // Actual working duration, excluding lunch.
  record.workingMinutes = getWorkingMinutes(
    record,
    checkOutAt
  );

  // Determine attendance from actual working duration.
  record.status = getAttendanceStatus(
    record.workingMinutes
  );

  await record.save();

  return res.json({
    message: "Check-out successful.",
    record,
    attendanceSummary: {
      totalMinutes: record.totalMinutes,
      lunchMinutes: record.lunchMinutes,
      workingMinutes: record.workingMinutes,
      isLate: record.isLate,
      status: record.status,
    },
  });
});

// =====================================
// EMPLOYEE / MANAGER PERSONAL HISTORY
// GET /api/attendance/me
// =====================================

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
    const [year, monthNumber] = month
      .split("-")
      .map(Number);

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

    if (record.isLate) {
      summary.LateArrival =
        (summary.LateArrival || 0) + 1;
    }
  }

  return res.json({
    items,
    summary,
  });
});

// =====================================
// ADMIN / MANAGER ORGANISATION ATTENDANCE
// GET /api/attendance
// =====================================

export const listAll = wrap(async (req, res) => {
  const {
    date,
    employee,
    status,
    department,
  } = req.query;

  // Validate filter types.
  if (
    [date, employee, status, department].some(
      (value) =>
        value !== undefined && !isStr(value)
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

    allowedIds = await getSubordinateIds(
      req.employee._id
    );
  }

  // Apply department restriction.
  if (department) {
    const departmentIds = await Employee.find({
      department,
    }).distinct("_id");

    if (allowedIds !== null) {
      const allowedSet = new Set(
        allowedIds.map(String)
      );

      allowedIds = departmentIds.filter((id) =>
        allowedSet.has(String(id))
      );
    } else {
      allowedIds = departmentIds;
    }
  }

  // Verify requested employee belongs to final access scope.
  if (
    employee &&
    allowedIds !== null &&
    !allowedIds.some(
      (id) => String(id) === employee
    )
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
      .filter(
        (employeeRecord) =>
          !markedSet.has(String(employeeRecord._id))
      )
      .map((employeeRecord) => {
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
          workingMinutes: 0,
          lunchMinutes: 0,
          isLate: false,
          status: isOnLeave ? "Leave" : "Absent",
        };
      })
      .filter(
        (record) =>
          !status || record.status === status
      );
  }

  return res.json([
    ...items,
    ...extra,
  ]);
});
