
import mongoose from "mongoose";

import DailyReport from "../models/DailyReport.js";
import Employee from "../models/Employee.js";
import Task from "../models/Task.js";
import TaskAssignment from "../models/TaskAssignment.js";

import { wrap } from "./wrap.js";
import { todayStr, isValidDateStr } from "../utils/time.js";

// =====================================
// CONSTANTS
// =====================================

const isStr = value => typeof value === "string";

const TASK_STATUSES = [
  "Pending",
  "In Progress",
  "Completed",
  "On Hold",
];

const REVIEW_ACTIONS = [
  "Approved",
  "Rejected",
  "Revision Required",
];

const REPORT_REVIEWABLE_STATUSES = [
  "Submitted",
  "Under Review",
  "Revision Required",
];

// =====================================
// REVIEW DEADLINE
// =====================================

const getReviewDeadline = () => {
  const hours = Number(process.env.DAR_REVIEW_HOURS || 24);

  const validHours =
    Number.isFinite(hours) && hours > 0
      ? hours
      : 24;

  return new Date(
    Date.now() + validHours * 60 * 60 * 1000
  );
};

// =====================================
// MANAGER HIERARCHY
// =====================================

const getSubordinateIds = async managerId => {
  const managerObjectId = new mongoose.Types.ObjectId(
    managerId
  );

  const allIds = new Set();
  const visited = new Set([
    managerObjectId.toString(),
  ]);

  let currentLevel = [managerObjectId];

  while (currentLevel.length > 0) {
    const employees = await Employee.find({
      manager: {
        $in: currentLevel,
      },
    }).select("_id");

    const nextLevel = [];

    for (const employee of employees) {
      const id = employee._id.toString();

      if (!visited.has(id)) {
        visited.add(id);
        allIds.add(id);
        nextLevel.push(employee._id);
      }
    }

    currentLevel = nextLevel;
  }

  return [...allIds].map(
    id => new mongoose.Types.ObjectId(id)
  );
};

// =====================================
// DATE PARSER
// =====================================

const parseDate = value => {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? false
    : date;
};

// =====================================
// BLOCKER PREPARATION
// =====================================

const prepareBlockers = async (
  blockers,
  oldTask = null
) => {
  if (
    blockers !== undefined &&
    !Array.isArray(blockers)
  ) {
    return {
      error: "Invalid blockers.",
    };
  }

  const oldBlockers = oldTask?.blockers || [];
  const preparedBlockers = [];

  for (const blocker of blockers || []) {
    if (
      !blocker ||
      typeof blocker !== "object" ||
      Array.isArray(blocker) ||
      !isStr(blocker.description) ||
      !blocker.description.trim()
    ) {
      return {
        error: "Blocker description is required.",
      };
    }

    const description = blocker.description.trim();

    if (description.length > 2000) {
      return {
        error: "Blocker description cannot exceed 2000 characters.",
      };
    }

    let assignedTo = null;

    if (blocker.assignedTo) {
      if (
        !mongoose.isValidObjectId(blocker.assignedTo)
      ) {
        return {
          error: "Invalid blocker assignee.",
        };
      }

      const assignedEmployee = await Employee.findById(
        blocker.assignedTo
      ).select("_id");

      if (!assignedEmployee) {
        return {
          error: "Blocker assignee not found.",
        };
      }

      assignedTo = assignedEmployee._id;
    }

    const existingBlocker = oldBlockers.find(old => {
      const sameDescription =
        old.description.trim().toLowerCase() ===
        description.toLowerCase();

      const oldAssignee = old.assignedTo
        ? old.assignedTo.toString()
        : "";

      const newAssignee = assignedTo
        ? assignedTo.toString()
        : "";

      return (
        sameDescription &&
        oldAssignee === newAssignee
      );
    });

    preparedBlockers.push({
      description,
      assignedTo,
      status: existingBlocker?.status || "Open",
      createdAt:
        existingBlocker?.createdAt || new Date(),
      resolvedAt:
        existingBlocker?.resolvedAt || null,
    });
  }

  return {
    blockers: preparedBlockers,
  };
};

// =====================================
// FIND OLD TASK ENTRY
// =====================================

const findOldTaskEntry = (
  oldTasks,
  referenceType,
  referenceId,
  taskName
) => {
  if (referenceId) {
    const match = oldTasks.find(old => {
      const oldReference =
        referenceType === "assignment"
          ? old.taskAssignment
          : old.task;

      return (
        oldReference &&
        String(oldReference) === String(referenceId)
      );
    });

    if (match) return match;
  }

  // Manual work can retain its review history when
  // the same title is submitted again.
  if (referenceType === "manual") {
    return oldTasks.find(old =>
      !old.task &&
      !old.taskAssignment &&
      old.taskNameSnapshot?.trim().toLowerCase() ===
        taskName.trim().toLowerCase()
    ) || null;
  }

  return null;
};

// =====================================
// TASK PREPARATION
//
// Supports:
// 1. TaskAssignment - actual assigned employee task.
// 2. Task - legacy predefined task.
// 3. Manual work - no database task reference.
// =====================================

const prepareTasks = async (
  tasks,
  employee,
  oldTasks = []
) => {
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return {
      error: "At least one task is required.",
    };
  }

  if (!employee) {
    return {
      error: "Employee profile not found.",
    };
  }

  for (const item of tasks) {
    if (
      !item ||
      typeof item !== "object" ||
      Array.isArray(item)
    ) {
      return {
        error: "Invalid task entry.",
      };
    }
  }

  const seenReferences = new Set();
  const prepared = [];

  for (const item of tasks) {
    const assignmentId = item.taskAssignment || null;
    const legacyTaskId = item.task || null;

    if (assignmentId && legacyTaskId) {
      return {
        error: "A DAR entry cannot reference two different task types.",
      };
    }

    if (
      assignmentId &&
      !mongoose.isValidObjectId(assignmentId)
    ) {
      return {
        error: "Invalid assigned task ID.",
      };
    }

    if (
      legacyTaskId &&
      !mongoose.isValidObjectId(legacyTaskId)
    ) {
      return {
        error: "Invalid predefined task ID.",
      };
    }

    const referenceId =
      assignmentId || legacyTaskId;

    if (referenceId) {
      const referenceKey = String(referenceId);

      if (seenReferences.has(referenceKey)) {
        return {
          error: "Duplicate tasks are not allowed in one DAR.",
        };
      }

      seenReferences.add(referenceKey);
    }

    let taskAssignment = null;
    let predefinedTask = null;
    let taskNameSnapshot = "";
    let referenceType = "manual";

    // ---------------------------------
    // ACTUAL ASSIGNED TASK
    // ---------------------------------

    if (assignmentId) {
      taskAssignment = await TaskAssignment.findOne({
        _id: assignmentId,
        assignedTo: employee._id,
      });

      if (!taskAssignment) {
        return {
          error: "This assigned task does not belong to you or could not be found.",
        };
      }

      taskNameSnapshot = taskAssignment.title;
      referenceType = "assignment";
    }

    // ---------------------------------
    // LEGACY PREDEFINED TASK
    // ---------------------------------

    else if (legacyTaskId) {
      predefinedTask = await Task.findOne({
        _id: legacyTaskId,
        isActive: true,
      });

      if (!predefinedTask) {
        return {
          error: "One or more selected predefined tasks are unavailable.",
        };
      }

      if (
        predefinedTask.departments?.length &&
        !predefinedTask.departments.includes(
          employee.department
        )
      ) {
        return {
          error: `Task "${predefinedTask.title}" is not available for your department.`,
        };
      }

      if (
        predefinedTask.designations?.length &&
        !predefinedTask.designations.includes(
          employee.designation || ""
        )
      ) {
        return {
          error: `Task "${predefinedTask.title}" is not available for your designation.`,
        };
      }

      taskNameSnapshot = predefinedTask.title;
      referenceType = "legacy";
    }

    // ---------------------------------
    // MANUAL / UNASSIGNED WORK
    // ---------------------------------

    else {
      const manualTitle =
        item.taskNameSnapshot ??
        item.manualTaskTitle ??
        item.title;

      if (
        !isStr(manualTitle) ||
        !manualTitle.trim()
      ) {
        return {
          error: "Task title is required for manual work.",
        };
      }

      if (manualTitle.trim().length > 150) {
        return {
          error: "Task title cannot exceed 150 characters.",
        };
      }

      taskNameSnapshot = manualTitle.trim();
      referenceType = "manual";
    }

    // ---------------------------------
    // DESCRIPTION VALIDATION
    // ---------------------------------

    if (
      item.description !== undefined &&
      !isStr(item.description)
    ) {
      return {
        error: "Invalid task description.",
      };
    }

    if (
      isStr(item.description) &&
      item.description.length > 3000
    ) {
      return {
        error: "Task description cannot exceed 3000 characters.",
      };
    }

    // ---------------------------------
    // STATUS VALIDATION
    // ---------------------------------

    if (
      item.status !== undefined &&
      !TASK_STATUSES.includes(item.status)
    ) {
      return {
        error: "Invalid task status.",
      };
    }

    // ---------------------------------
    // HOURS VALIDATION
    // ---------------------------------

    const hoursSpent =
      item.hoursSpent === undefined ||
      item.hoursSpent === ""
        ? 0
        : Number(item.hoursSpent);

    if (
      !Number.isFinite(hoursSpent) ||
      hoursSpent < 0 ||
      hoursSpent > 24
    ) {
      return {
        error: "Hours spent must be between 0 and 24.",
      };
    }

    // ---------------------------------
    // TIME VALIDATION
    // ---------------------------------

    const startTime = parseDate(item.startTime);
    const endTime = parseDate(item.endTime);

    if (
      startTime === false ||
      endTime === false
    ) {
      return {
        error: "Invalid task start or end time.",
      };
    }

    if (
      startTime &&
      endTime &&
      endTime < startTime
    ) {
      return {
        error: "Task end time cannot be before start time.",
      };
    }

    // ---------------------------------
    // PRESERVE OLD ENTRY STATE
    // ---------------------------------

    const oldTask = findOldTaskEntry(
      oldTasks,
      referenceType,
      referenceId,
      taskNameSnapshot
    );

    const blockerResult = await prepareBlockers(
      item.blockers,
      oldTask
    );

    if (blockerResult.error) {
      return blockerResult;
    }

    const now = new Date();

    prepared.push({
      // Legacy reference stays null for new assignment/manual entries.
      task: predefinedTask?._id || null,

      // Actual employee assignment reference.
      taskAssignment: taskAssignment?._id || null,

      // Snapshot protects report history if source task changes.
      taskNameSnapshot,

      description:
        item.description?.trim() || "",

      startTime,
      endTime,
      hoursSpent,

      status:
        item.status || "In Progress",

      lastUpdatedAt: now,

      blockers: blockerResult.blockers,

      review: {
        status: "Pending",
        reviewedBy: null,
        reviewedAt: null,
        deadline: getReviewDeadline(),
        reopenedAt: null,
        reopenUntil: null,
        remarks: "",

        reviewHistory:
          oldTask?.review?.reviewHistory || [],
      },
    });
  }

  return {
    tasks: prepared,
  };
};

// =====================================
// UPDATE OVERALL DAR STATUS
// =====================================

const updateOverallStatus = report => {
  const statuses = report.tasks.map(
    task => task.review?.status || "Pending"
  );

  if (
    statuses.some(status =>
      [
        "Rejected",
        "Revision Required",
      ].includes(status)
    )
  ) {
    report.overallStatus = "Revision Required";
  } else if (
    statuses.length > 0 &&
    statuses.every(status => status === "Approved")
  ) {
    report.overallStatus = "Approved";
  } else if (
    statuses.some(status => status !== "Pending")
  ) {
    report.overallStatus = "Under Review";
  } else {
    report.overallStatus = "Submitted";
  }
};

// =====================================
// SAFE POPULATION
// =====================================

const employeePopulate = {
  path: "employee",
  select:
    "employeeId department designation personal.firstName personal.middleName personal.lastName user",
  populate: {
    path: "user",
    select: "name email",
  },
};

const reportPopulateOptions = [
  employeePopulate,

  {
    path: "tasks.task",
  },

  {
    path: "tasks.taskAssignment",
  },

  {
    path: "tasks.blockers.assignedTo",
    select: "employeeId department designation",
  },

  {
    path: "tasks.review.reviewedBy",
    select: "employeeId",
  },

  {
    path: "tasks.review.reviewHistory.performedBy",
    select: "employeeId",
  },
];

const populateReport = async report => {
  await report.populate(reportPopulateOptions);
  return report;
};

// =====================================
// CREATE AND SUBMIT DAR
// =====================================

export const createReport = wrap(async (req, res) => {
  const { reportDate, tasks } = req.body || {};

  if (
    !isValidDateStr(reportDate) ||
    reportDate > todayStr()
  ) {
    return res.status(400).json({
      message:
        "Report date must be valid and cannot be in the future.",
    });
  }

  if (!req.employee) {
    return res.status(403).json({
      message: "Employee profile not found.",
    });
  }

  const result = await prepareTasks(
    tasks,
    req.employee
  );

  if (result.error) {
    return res.status(400).json({
      message: result.error,
    });
  }

  try {
    const report = await DailyReport.create({
      employee: req.employee._id,
      reportDate,
      tasks: result.tasks,
      overallStatus: "Submitted",
      submittedAt: new Date(),
    });

    await populateReport(report);

    return res.status(201).json({
      message: "DAR submitted successfully.",
      report,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message:
          "You have already submitted a DAR for this date.",
      });
    }

    throw error;
  }
});

// =====================================
// UPDATE DAR
// =====================================

export const updateReport = wrap(async (req, res) => {
  if (!req.employee) {
    return res.status(403).json({
      message: "Employee profile not found.",
    });
  }

  if (
    !mongoose.isValidObjectId(req.params.id)
  ) {
    return res.status(400).json({
      message: "Invalid report ID.",
    });
  }

  const report = await DailyReport.findOne({
    _id: req.params.id,
    employee: req.employee._id,
  });

  if (!report) {
    return res.status(404).json({
      message: "Report not found.",
    });
  }

  if (report.reportDate !== todayStr()) {
    return res.status(403).json({
      message: "Only today's DAR can be edited.",
    });
  }

  if (
    !["Draft", "Revision Required"].includes(
      report.overallStatus
    )
  ) {
    return res.status(403).json({
      message: "This DAR cannot currently be edited.",
    });
  }

  const result = await prepareTasks(
    req.body?.tasks,
    req.employee,
    report.tasks
  );

  if (result.error) {
    return res.status(400).json({
      message: result.error,
    });
  }

  report.tasks = result.tasks;
  report.overallStatus = "Submitted";
  report.submittedAt = new Date();

  await report.save();
  await populateReport(report);

  return res.json({
    message: "DAR updated and submitted successfully.",
    report,
  });
});

// =====================================
// EMPLOYEE'S OWN DAR HISTORY
// =====================================

export const myReports = wrap(async (req, res) => {
  if (!req.employee) {
    return res.status(403).json({
      message: "Employee profile not found.",
    });
  }

  const reports = await DailyReport.find({
    employee: req.employee._id,
  })
    .populate("tasks.task")
    .populate("tasks.taskAssignment")
    .populate(
      "tasks.blockers.assignedTo",
      "employeeId department designation"
    )
    .populate(
      "tasks.review.reviewedBy",
      "employeeId"
    )
    .populate(
      "tasks.review.reviewHistory.performedBy",
      "employeeId"
    )
    .sort({
      reportDate: -1,
    });

  return res.json(reports);
});

// =====================================
// LIST DAR REPORTS
// =====================================

export const listReports = wrap(async (req, res) => {
  const {
    employee,
    department,
    from,
    to,
  } = req.query;

  if (
    [employee, department, from, to].some(
      value =>
        value !== undefined &&
        !isStr(value)
    )
  ) {
    return res.status(400).json({
      message: "Invalid filter values.",
    });
  }

  if (
    (from && !isValidDateStr(from)) ||
    (to && !isValidDateStr(to))
  ) {
    return res.status(400).json({
      message: "Dates must be in YYYY-MM-DD format.",
    });
  }

  if (from && to && from > to) {
    return res.status(400).json({
      message: "Start date cannot be after end date.",
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

  if (
    department &&
    department.trim().length > 100
  ) {
    return res.status(400).json({
      message: "Invalid department filter.",
    });
  }

  const filter = {};

  if (from || to) {
    filter.reportDate = {
      ...(from && { $gte: from }),
      ...(to && { $lte: to }),
    };
  }

  // ---------------------------------
  // ROLE AND EMPLOYEE FILTERS
  // ---------------------------------

  if (req.user.role === "manager") {
    if (!req.employee) {
      return res.status(403).json({
        message: "Manager employee profile not found.",
      });
    }

    const allowedEmployeeIds = await getSubordinateIds(
      req.employee._id
    );

    if (employee) {
      const allowed = allowedEmployeeIds.some(
        id => id.toString() === employee
      );

      if (!allowed) {
        return res.status(403).json({
          message:
            "You cannot access reports outside your reporting hierarchy.",
        });
      }

      filter.employee =
        new mongoose.Types.ObjectId(employee);
    } else {
      filter.employee = {
        $in: allowedEmployeeIds,
      };
    }
  } else if (req.user.role === "admin") {
    if (employee) {
      filter.employee =
        new mongoose.Types.ObjectId(employee);
    }
  } else {
    return res.status(403).json({
      message: "Access denied.",
    });
  }

  // ---------------------------------
  // DEPARTMENT FILTER
  // ---------------------------------

  if (department) {
    const departmentIds = await Employee.find({
      department: department.trim(),
    }).distinct("_id");

    if (filter.employee) {
      if (filter.employee.$in) {
        const currentIds = filter.employee.$in;

        filter.employee = {
          $in: departmentIds.filter(id =>
            currentIds.some(
              currentId =>
                currentId.toString() === id.toString()
            )
          ),
        };
      } else {
        const matches = departmentIds.some(
          id =>
            id.toString() ===
            filter.employee.toString()
        );

        if (!matches) {
          return res.json([]);
        }
      }
    } else {
      filter.employee = {
        $in: departmentIds,
      };
    }
  }

  const reports = await DailyReport.find(filter)
    .populate(employeePopulate)
    .populate("tasks.task")
    .populate("tasks.taskAssignment")
    .populate(
      "tasks.blockers.assignedTo",
      "employeeId department designation"
    )
    .populate(
      "tasks.review.reviewedBy",
      "employeeId"
    )
    .populate(
      "tasks.review.reviewHistory.performedBy",
      "employeeId"
    )
    .sort({
      reportDate: -1,
      createdAt: -1,
    })
    .limit(200);

  return res.json(reports);
});

// =====================================
// MANAGER REVIEWS A TASK
// =====================================

export const reviewTask = wrap(async (req, res) => {
  if (req.user.role !== "manager") {
    return res.status(403).json({
      message: "Only managers can review DAR tasks.",
    });
  }

  if (!req.employee) {
    return res.status(403).json({
      message: "Manager employee profile not found.",
    });
  }

  const {
    action,
    remarks = "",
  } = req.body || {};

  const {
    id,
    taskEntryId,
  } = req.params;

  if (!REVIEW_ACTIONS.includes(action)) {
    return res.status(400).json({
      message: "Invalid review action.",
    });
  }

  if (
    !isStr(remarks) ||
    remarks.length > 1000
  ) {
    return res.status(400).json({
      message:
        "Review remarks must be a string of maximum 1000 characters.",
    });
  }

  if (
    !mongoose.isValidObjectId(id) ||
    !mongoose.isValidObjectId(taskEntryId)
  ) {
    return res.status(400).json({
      message: "Invalid report or task ID.",
    });
  }

  const report = await DailyReport.findById(id);

  if (!report) {
    return res.status(404).json({
      message: "DAR not found.",
    });
  }

  if (
    !REPORT_REVIEWABLE_STATUSES.includes(
      report.overallStatus
    )
  ) {
    return res.status(400).json({
      message:
        "This DAR is not currently available for review.",
    });
  }

  const subordinateIds = await getSubordinateIds(
    req.employee._id
  );

  const belongsToTeam = subordinateIds.some(
    employeeId =>
      employeeId.toString() ===
      report.employee.toString()
  );

  if (!belongsToTeam) {
    return res.status(403).json({
      message:
        "You cannot review reports outside your reporting hierarchy.",
    });
  }

  const taskEntry = report.tasks.id(taskEntryId);

  if (!taskEntry) {
    return res.status(404).json({
      message: "Task entry not found in this DAR.",
    });
  }

  const review = taskEntry.review;
  const now = new Date();

  if (
    !review ||
    review.status !== "Pending"
  ) {
    return res.status(400).json({
      message:
        "This task has already been reviewed or is not pending.",
    });
  }

  if (
    review.deadline &&
    now > review.deadline
  ) {
    return res.status(403).json({
      message:
        "Review deadline expired. HR must reopen this review.",
    });
  }

  if (
    review.reopenUntil &&
    now > review.reopenUntil
  ) {
    return res.status(403).json({
      message:
        "The HR reopening period has expired.",
    });
  }

  review.status = action;
  review.reviewedBy = req.employee._id;
  review.reviewedAt = now;
  review.remarks = remarks.trim();

  review.reviewHistory.push({
    action,
    performedBy: req.employee._id,
    remarks: remarks.trim(),
    timestamp: now,
  });

  updateOverallStatus(report);

  await report.save();
  await populateReport(report);

  return res.json({
    message:
      `Task review ${action.toLowerCase()} successfully.`,
    report,
  });
});

// =====================================
// HR/ADMIN REOPENS AN OVERDUE REVIEW
// =====================================

export const reopenTaskReview = wrap(
  async (req, res) => {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        message:
          "Only HR/Admin can reopen a DAR review.",
      });
    }

    const {
      id,
      taskEntryId,
    } = req.params;

    if (
      !mongoose.isValidObjectId(id) ||
      !mongoose.isValidObjectId(taskEntryId)
    ) {
      return res.status(400).json({
        message: "Invalid report or task ID.",
      });
    }

    const report = await DailyReport.findById(id);

    if (!report) {
      return res.status(404).json({
        message: "DAR not found.",
      });
    }

    if (
      !REPORT_REVIEWABLE_STATUSES.includes(
        report.overallStatus
      )
    ) {
      return res.status(400).json({
        message:
          "Only submitted, under-review or revision-required DARs can be reopened.",
      });
    }

    const taskEntry = report.tasks.id(taskEntryId);

    if (!taskEntry) {
      return res.status(404).json({
        message: "Task entry not found in this DAR.",
      });
    }

    const review = taskEntry.review;
    const now = new Date();

    if (
      !review ||
      review.status !== "Pending"
    ) {
      return res.status(400).json({
        message: "Only pending reviews can be reopened.",
      });
    }

    if (
      !review.deadline ||
      now <= review.deadline
    ) {
      return res.status(400).json({
        message:
          "This review deadline has not expired yet.",
      });
    }

    const requestedHours = Number(
      req.body?.hours ??
      process.env.DAR_REOPEN_HOURS ??
      24
    );

    if (
      !Number.isFinite(requestedHours) ||
      requestedHours <= 0 ||
      requestedHours > 168
    ) {
      return res.status(400).json({
        message:
          "Reopen duration must be between 1 and 168 hours.",
      });
    }

    const reopenUntil = new Date(
      now.getTime() +
      requestedHours * 60 * 60 * 1000
    );

    review.reopenedAt = now;
    review.reopenUntil = reopenUntil;
    review.deadline = reopenUntil;

    review.reviewHistory.push({
      action: "Reopened",
      performedBy: req.employee?._id || null,
      remarks:
        `HR reopened review for ${requestedHours} hours.`,
      timestamp: now,
    });

    await report.save();
    await populateReport(report);

    return res.json({
      message: "DAR review reopened successfully.",
      reopenUntil,
      report,
    });
  }
);
