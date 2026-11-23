
import mongoose from "mongoose";

import LeaveRequest from "../models/LeaveRequest.js";
import LeaveBalance from "../models/LeaveBalance.js";
import LeaveTransaction from "../models/LeaveTransaction.js";
import Holiday from "../models/Holiday.js";
import Employee from "../models/Employee.js";

import { wrap } from "./wrap.js";

// Business timezone: Asia/Kolkata.
const TIME_ZONE = "Asia/Kolkata";

const VALID_LEAVE_TYPES = ["Casual", "Sick", "Earned", "Unpaid"];

const VALID_STATUSES = [
  "Pending",
  "Approved",
  "Rejected",
  "Cancelled",
];

// Convert YYYY-MM-DD into India-local day boundaries.
const parseLocalDate = (value, endOfDay = false) => {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
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
    `${value}T${
      endOfDay ? "23:59:59.999" : "00:00:00.000"
    }+05:30`
  );
};

// Convert a Date into YYYY-MM-DD in the business timezone.
const getLocalDateKey = (date) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day}`;
};

// Add one calendar day to a YYYY-MM-DD string.
const addCalendarDay = (dateString) => {
  const [year, month, day] = dateString.split("-").map(Number);

  const date = new Date(
    Date.UTC(year, month - 1, day + 1)
  );

  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
};

// Calculate working leave days.
// Sunday and configured holidays are excluded.
// Saturday remains a working day.
const calculateWorkingLeaveDays = async (
  startDate,
  endDate,
  dayType,
  session
) => {
  const startKey = getLocalDateKey(startDate);
  const endKey = getLocalDateKey(endDate);

  const holidays = await Holiday.find({
    isActive: true,
    date: {
      $gte: startKey,
      $lte: endKey,
    },
  })
    .select("date")
    .session(session || null)
    .lean();

  const holidayDates = new Set(
    holidays.map((holiday) => holiday.date)
  );

  if (dayType === "HalfDay") {
    if (startKey !== endKey) {
      throw new Error(
        "Half-day leave must have the same start and end date."
      );
    }

    // A half-day cannot be counted on a Sunday or holiday.
    const [year, month, day] = startKey.split("-").map(Number);

    const weekday = new Date(
      Date.UTC(year, month - 1, day)
    ).getUTCDay();

    if (weekday === 0 || holidayDates.has(startKey)) {
      return 0;
    }

    return 0.5;
  }

  let totalDays = 0;
  let currentDate = startKey;

  while (currentDate <= endKey) {
    const [year, month, day] = currentDate
      .split("-")
      .map(Number);

    const weekday = new Date(
      Date.UTC(year, month - 1, day)
    ).getUTCDay();

    const isSunday = weekday === 0;
    const isHoliday = holidayDates.has(currentDate);

    if (!isSunday && !isHoliday) {
      totalDays += 1;
    }

    currentDate = addCalendarDay(currentDate);
  }

  return totalDays;
};

// Get all active/probation employees reporting to a manager,
// including indirect reports.
const getSubordinateIds = async (managerId) => {
  const visited = new Set([String(managerId)]);
  const subordinateIds = [];

  let currentLevel = [managerId];

  while (currentLevel.length) {
    const employees = await Employee.find({
      manager: { $in: currentLevel },
      employmentStatus: {
        $in: ["active", "probation"],
      },
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
  const {
    leaveType,
    startDate,
    endDate,
    reason,
    dayType = "FullDay",
    halfDaySession = null,
  } = req.body;

  if (!VALID_LEAVE_TYPES.includes(leaveType)) {
    return res.status(400).json({
      message: "Invalid leave type.",
    });
  }

  if (!["FullDay", "HalfDay"].includes(dayType)) {
    return res.status(400).json({
      message: "Invalid leave duration.",
    });
  }

  if (
    dayType === "HalfDay" &&
    !["FirstHalf", "SecondHalf"].includes(halfDaySession)
  ) {
    return res.status(400).json({
      message:
        "Select FirstHalf or SecondHalf for half-day leave.",
    });
  }

  if (dayType === "FullDay" && halfDaySession) {
    return res.status(400).json({
      message:
        "Half-day session is not allowed for full-day leave.",
    });
  }

  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate, true);

  if (!start || !end) {
    return res.status(400).json({
      message:
        "Enter valid start and end dates in YYYY-MM-DD format.",
    });
  }

  if (end < start) {
    return res.status(400).json({
      message: "End date cannot be earlier than start date.",
    });
  }

  if (
    dayType === "HalfDay" &&
    startDate !== endDate
  ) {
    return res.status(400).json({
      message:
        "Half-day leave must have the same start and end date.",
    });
  }

  if (
    typeof reason !== "string" ||
    !reason.trim()
  ) {
    return res.status(400).json({
      message: "Leave reason is required.",
    });
  }

  if (reason.trim().length > 500) {
    return res.status(400).json({
      message:
        "Leave reason cannot exceed 500 characters.",
    });
  }

  const requestedDays = await calculateWorkingLeaveDays(
    start,
    end,
    dayType
  );

  if (requestedDays <= 0) {
    return res.status(400).json({
      message:
        "The selected dates do not contain any working leave days.",
    });
  }

  const overlappingLeave = await LeaveRequest.findOne({
    employee: req.employee._id,
    status: {
      $in: ["Pending", "Approved"],
    },
    startDate: { $lte: end },
    endDate: { $gte: start },
  });

  if (overlappingLeave) {
    return res.status(409).json({
      message:
        "You already have a pending or approved leave for these dates.",
    });
  }

  const leave = await LeaveRequest.create({
    employee: req.employee._id,
    leaveType,
    startDate: start,
    endDate: end,
    dayType,
    halfDaySession:
      dayType === "HalfDay" ? halfDaySession : null,
    reason: reason.trim(),
    requestedDays,
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
    .populate("allocatedBy", "name email")
    .sort({ createdAt: -1 });

  return res.json(leaves);
});

// Admin views all leaves; manager views their reporting hierarchy.
export const listLeaves = wrap(async (req, res) => {
  const filter = {};

  const { status, employeeId } = req.query;

  if (status) {
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        message: "Invalid leave status.",
      });
    }

    filter.status = status;
  }

  if (req.user.role === "manager") {
    const subordinateIds = await getSubordinateIds(
      req.employee._id
    );

    filter.employee = {
      $in: subordinateIds,
    };
  }

  if (employeeId) {
    if (!mongoose.isValidObjectId(employeeId)) {
      return res.status(400).json({
        message: "Invalid employee ID.",
      });
    }

    if (filter.employee) {
      const allowedIds = new Set(
        filter.employee.$in.map(String)
      );

      if (!allowedIds.has(String(employeeId))) {
        return res.status(403).json({
          message:
            "You cannot view this employee's leave requests.",
        });
      }
    }

    filter.employee = employeeId;
  }

  const leaves = await LeaveRequest.find(filter)
    .populate({
      path: "employee",
      select:
        "employeeId department designation personal user manager employmentStatus",
      populate: {
        path: "user",
        select: "name email",
      },
    })
    .populate("reviewedBy", "name email")
    .populate("allocatedBy", "name email")
    .sort({ createdAt: -1 })
    .limit(200);

  return res.json(leaves);
});

// Admin approves or rejects a leave request.
export const decide = wrap(async (req, res) => {
  const { id } = req.params;

  const {
    status,
    reviewNote = "",
  } = req.body;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({
      message: "Invalid leave request ID.",
    });
  }

  if (!["Approved", "Rejected"].includes(status)) {
    return res.status(400).json({
      message: "Status must be Approved or Rejected.",
    });
  }

  if (
    typeof reviewNote !== "string" ||
    reviewNote.length > 1000
  ) {
    return res.status(400).json({
      message:
        "Review note must be a string of at most 1000 characters.",
    });
  }

  const session = await mongoose.startSession();

  let updatedLeave;

  try {
    await session.withTransaction(async () => {
      const leave = await LeaveRequest.findById(id).session(
        session
      );

      if (!leave) {
        const error = new Error("Leave request not found.");
        error.statusCode = 404;
        throw error;
      }

      if (leave.status !== "Pending") {
        const error = new Error(
          "Only pending leave requests can be reviewed."
        );
        error.statusCode = 409;
        throw error;
      }

      if (status === "Approved") {
        const requestedDays =
          await calculateWorkingLeaveDays(
            leave.startDate,
            leave.endDate,
            leave.dayType || "FullDay",
            session
          );

        if (requestedDays <= 0) {
          const error = new Error(
            "This leave request contains no working leave days."
          );
          error.statusCode = 400;
          throw error;
        }

        // Ensure that every employee has a balance record.
        await LeaveBalance.findOneAndUpdate(
          { employee: leave.employee },
          {
            $setOnInsert: {
              employee: leave.employee,
              openingBalance: 0,
              totalCredited: 0,
              totalPaidUsed: 0,
              totalUnpaid: 0,
              availableBalance: 0,
            },
          },
          {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true,
            session,
          }
        );

        const balance = await LeaveBalance.findOne({
          employee: leave.employee,
        }).session(session);

        if (!balance) {
          throw new Error(
            "Unable to initialize employee leave balance."
          );
        }

        // Explicit Unpaid requests do not consume earned leave.
        // All other leave types use the combined earned balance.
        const paidDays =
          leave.leaveType === "Unpaid"
            ? 0
            : Math.min(
                balance.availableBalance,
                requestedDays
              );

        const unpaidDays = Number(
          (requestedDays - paidDays).toFixed(2)
        );

        const balanceBefore = balance.availableBalance;

        const balanceAfter = Number(
          (balanceBefore - paidDays).toFixed(2)
        );

        // Update balance atomically inside the transaction.
        const updatedBalance =
          await LeaveBalance.findOneAndUpdate(
            {
              _id: balance._id,
              availableBalance: {
                $gte: paidDays,
              },
            },
            {
              $inc: {
                availableBalance: -paidDays,
                totalPaidUsed: paidDays,
                totalUnpaid: unpaidDays,
              },
            },
            {
              new: true,
              session,
            }
          );

        if (!updatedBalance) {
          throw new Error(
            "Leave balance changed during approval. Please try again."
          );
        }

        // Record the paid-leave transaction.
        if (paidDays > 0) {
          await LeaveTransaction.create(
            [
              {
                employee: leave.employee,
                leaveRequest: leave._id,
                type: "PAID_LEAVE",
                direction: "DEBIT",
                days: paidDays,
                balanceChange: -paidDays,
                balanceBefore,
                balanceAfter,
                idempotencyKey: `leave:${leave._id}:paid`,
                description:
                  "Earned leave used for approved leave request.",
                createdBy: req.user._id,
              },
            ],
            { session }
          );
        }

        // Record unpaid days separately.
        // They do not reduce the earned-leave balance.
        if (unpaidDays > 0) {
          await LeaveTransaction.create(
            [
              {
                employee: leave.employee,
                leaveRequest: leave._id,
                type: "UNPAID_LEAVE",
                direction: "INFO",
                days: unpaidDays,
                balanceChange: 0,
                balanceBefore: balanceAfter,
                balanceAfter,
                idempotencyKey: `leave:${leave._id}:unpaid`,
                description:
                  "Unpaid portion of approved leave request.",
                createdBy: req.user._id,
              },
            ],
            { session }
          );
        }

        leave.requestedDays = requestedDays;
        leave.paidDays = paidDays;
        leave.unpaidDays = unpaidDays;
        leave.allocationStatus = "Allocated";
        leave.allocatedAt = new Date();
        leave.allocatedBy = req.user._id;
      }

      leave.status = status;
      leave.reviewedBy = req.user._id;
      leave.reviewedAt = new Date();
      leave.reviewNote = reviewNote.trim();

      await leave.save({ session });

      updatedLeave = leave;
    });

    return res.json({
      message: `Leave request ${status.toLowerCase()} successfully.`,
      leave: updatedLeave,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        message: error.message,
      });
    }

    throw error;
  } finally {
    await session.endSession();
  }
});

// Employee cancels their own pending leave request.
export const cancelLeave = wrap(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({
      message: "Invalid leave request ID.",
    });
  }

  const leave = await LeaveRequest.findOne({
    _id: id,
    employee: req.employee._id,
  });

  if (!leave) {
    return res.status(404).json({
      message: "Leave request not found.",
    });
  }

  if (leave.status !== "Pending") {
    return res.status(409).json({
      message:
        "Only pending leave requests can be cancelled.",
    });
  }

  leave.status = "Cancelled";

  await leave.save();

  return res.json({
    message: "Leave request cancelled successfully.",
    leave,
  });
});
