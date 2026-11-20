
import mongoose from "mongoose";

import TaskAssignment from "../models/TaskAssignment.js";
import Employee from "../models/Employee.js";
import { wrap } from "./wrap.js";

const isStr = (value) => typeof value === "string";

const PRIORITIES = ["Low", "Medium", "High", "Urgent"];

const STATUSES = [
  "Pending",
  "In Progress",
  "Completed",
  "On Hold",
];

// =====================================
// GET ALL DIRECT AND INDIRECT REPORTS
// =====================================

const getSubordinateIds = async (managerId) => {
  const visited = new Set([String(managerId)]);
  const subordinateIds = [];

  let currentLevel = [managerId];

  while (currentLevel.length > 0) {
    const employees = await Employee.find({
      manager: { $in: currentLevel },
      employmentStatus: { $in: ["active", "probation"] },
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

// =====================================
// CREATE TASK ASSIGNMENT
// Admin: Any employee
// Manager: Direct and indirect reports
// =====================================

export const createAssignment = wrap(async (req, res) => {
  const {
    title,
    description,
    assignedTo,
    dueDate,
    priority = "Medium",
  } = req.body || {};

  if (!isStr(title) || !title.trim()) {
    return res.status(400).json({
      message: "Task title is required",
    });
  }

  if (title.trim().length > 150) {
    return res.status(400).json({
      message: "Task title cannot exceed 150 characters",
    });
  }

  if (
    description !== undefined &&
    !isStr(description)
  ) {
    return res.status(400).json({
      message: "Invalid task description",
    });
  }

  if (
    isStr(description) &&
    description.trim().length > 2000
  ) {
    return res.status(400).json({
      message: "Description cannot exceed 2000 characters",
    });
  }

  if (
    !assignedTo ||
    !mongoose.Types.ObjectId.isValid(assignedTo)
  ) {
    return res.status(400).json({
      message: "A valid employee must be selected",
    });
  }

  if (!dueDate || !Number.isFinite(new Date(dueDate).getTime())) {
    return res.status(400).json({
      message: "A valid task deadline is required",
    });
  }

  if (!PRIORITIES.includes(priority)) {
    return res.status(400).json({
      message: "Invalid task priority",
    });
  }

  const employee = await Employee.findById(assignedTo);

  if (
    !employee ||
    !["active", "probation"].includes(employee.employmentStatus)
  ) {
    return res.status(404).json({
      message: "Active employee not found",
    });
  }

  // Manager can assign only to their reporting hierarchy.
  if (req.user.role === "manager") {
    if (!req.employee) {
      return res.status(403).json({
        message: "Manager employee profile not found",
      });
    }

    const subordinateIds = await getSubordinateIds(
      req.employee._id
    );

    const isSubordinate = subordinateIds.some(
      (id) => String(id) === String(employee._id)
    );

    if (!isSubordinate) {
      return res.status(403).json({
        message: "You can assign tasks only to your team members",
      });
    }
  }

  const assignment = await TaskAssignment.create({
    title: title.trim(),
    description: description?.trim() || "",
    assignedTo: employee._id,
    assignedBy: req.user._id,
    dueDate: new Date(dueDate),
    priority,
  });

  const populatedAssignment = await TaskAssignment.findById(
    assignment._id
  )
    .populate({
      path: "assignedTo",
      select: "employeeId personal department designation user",
      populate: {
        path: "user",
        select: "name email",
      },
    })
    .populate("assignedBy", "name email");

  return res.status(201).json({
    message: "Task assigned successfully",
    assignment: populatedAssignment,
  });
});

// =====================================
// LIST TASK ASSIGNMENTS
// Admin: All assignments
// Manager: Team assignments
// Employee: Own assignments
// =====================================

export const listAssignments = wrap(async (req, res) => {
  const filter = {
    isActive: true,
  };

  if (req.user.role === "employee") {
    if (!req.employee) {
      return res.status(403).json({
        message: "Employee profile not found",
      });
    }

    filter.assignedTo = req.employee._id;
  }

  else if (req.user.role === "manager") {
    if (!req.employee) {
      return res.status(403).json({
        message: "Manager employee profile not found",
      });
    }

    const subordinateIds = await getSubordinateIds(
      req.employee._id
    );

    filter.assignedTo = {
      $in: subordinateIds,
    };
  }

  else if (req.user.role !== "admin") {
    return res.status(403).json({
      message: "You are not authorized to view task assignments",
    });
  }

  // Optional status filter
  if (req.query.status) {
    if (!STATUSES.includes(req.query.status)) {
      return res.status(400).json({
        message: "Invalid task status filter",
      });
    }

    filter.status = req.query.status;
  }

  const assignments = await TaskAssignment.find(filter)
    .populate({
      path: "assignedTo",
      select: "employeeId personal department designation user",
      populate: {
        path: "user",
        select: "name email",
      },
    })
    .populate("assignedBy", "name email")
    .sort({
      dueDate: 1,
      createdAt: -1,
    });

  return res.status(200).json({
    count: assignments.length,
    assignments,
  });
});

// =====================================
// UPDATE EMPLOYEE TASK PROGRESS
// Employee can update only own tasks
// =====================================

export const updateProgress = wrap(async (req, res) => {
  if (!req.employee) {
    return res.status(403).json({
      message: "Employee profile not found",
    });
  }

  const {
    status,
    progress,
    employeeRemarks,
  } = req.body || {};

  if (
    status === undefined &&
    progress === undefined &&
    employeeRemarks === undefined
  ) {
    return res.status(400).json({
      message: "At least one field is required to update",
    });
  }

  if (
    status !== undefined &&
    !STATUSES.includes(status)
  ) {
    return res.status(400).json({
      message: "Invalid task status",
    });
  }

  if (
    progress !== undefined &&
    (
      !Number.isInteger(progress) ||
      progress < 0 ||
      progress > 100
    )
  ) {
    return res.status(400).json({
      message: "Progress must be an integer between 0 and 100",
    });
  }

  if (
    employeeRemarks !== undefined &&
    !isStr(employeeRemarks)
  ) {
    return res.status(400).json({
      message: "Invalid employee remarks",
    });
  }

  if (
    isStr(employeeRemarks) &&
    employeeRemarks.trim().length > 1000
  ) {
    return res.status(400).json({
      message: "Remarks cannot exceed 1000 characters",
    });
  }

  const assignment = await TaskAssignment.findOne({
    _id: req.params.id,
    assignedTo: req.employee._id,
    isActive: true,
  });

  if (!assignment) {
    return res.status(404).json({
      message: "Assigned task not found",
    });
  }

  if (assignment.status === "Completed") {
    return res.status(400).json({
      message: "Completed tasks cannot be modified",
    });
  }

  if (status !== undefined) {
    assignment.status = status;
  }

  if (progress !== undefined) {
    assignment.progress = progress;
  }

  if (employeeRemarks !== undefined) {
    assignment.employeeRemarks = employeeRemarks.trim();
  }

  // Keep status and progress consistent.
  if (assignment.status === "Completed") {
    assignment.progress = 100;
    assignment.completedAt = new Date();
  } else {
    assignment.completedAt = null;
  }

  if (
    assignment.progress === 100 &&
    assignment.status !== "Completed"
  ) {
    return res.status(400).json({
      message: "Set task status to Completed when progress reaches 100%",
    });
  }

  await assignment.save();

  const updatedAssignment = await TaskAssignment.findById(
    assignment._id
  )
    .populate({
      path: "assignedTo",
      select: "employeeId personal department designation user",
      populate: {
        path: "user",
        select: "name email",
      },
    })
    .populate("assignedBy", "name email");

  return res.status(200).json({
    message: "Task progress updated successfully",
    assignment: updatedAssignment,
  });
});

// =====================================
// DEACTIVATE TASK ASSIGNMENT
// Admin: Any assignment
// Manager: Their reporting hierarchy only
// =====================================

export const deactivateAssignment = wrap(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({
      message: "Invalid task assignment ID",
    });
  }

  const assignment = await TaskAssignment.findById(
    req.params.id
  );

  if (!assignment || !assignment.isActive) {
    return res.status(404).json({
      message: "Active task assignment not found",
    });
  }

  if (req.user.role === "manager") {
    if (!req.employee) {
      return res.status(403).json({
        message: "Manager employee profile not found",
      });
    }

    const subordinateIds = await getSubordinateIds(
      req.employee._id
    );

    const isSubordinate = subordinateIds.some(
      (id) => String(id) === String(assignment.assignedTo)
    );

    if (!isSubordinate) {
      return res.status(403).json({
        message: "You can deactivate tasks only for your team members",
      });
    }
  }

  assignment.isActive = false;
  await assignment.save();

  return res.status(200).json({
    message: "Task assignment deactivated successfully",
    assignment,
  });
});
