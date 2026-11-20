
import Task from "../models/Task.js";
import { wrap } from "./wrap.js";

const isStr = value => typeof value === "string";

// Create a predefined task (Admin only)
export const createTask = wrap(async (req, res) => {
  const {
    title,
    description,
    departments,
    designations,
  } = req.body || {};

  if (!isStr(title) || !title.trim()) {
    return res.status(400).json({
      message: "Task title is required",
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
    departments !== undefined &&
    (!Array.isArray(departments) ||
      !departments.every(isStr))
  ) {
    return res.status(400).json({
      message: "Departments must be an array of strings",
    });
  }

  if (
    designations !== undefined &&
    (!Array.isArray(designations) ||
      !designations.every(isStr))
  ) {
    return res.status(400).json({
      message: "Designations must be an array of strings",
    });
  }

  const task = await Task.create({
    title: title.trim(),
    description: description?.trim() || "",
    departments: departments?.map(value => value.trim()) || [],
    designations: designations?.map(value => value.trim()) || [],
    createdBy: req.user._id,
  });

  res.status(201).json({
    message: "Task created successfully",
    task,
  });
});

// Get tasks applicable to the logged-in employee.
// Empty department/designation arrays mean available to everyone.
export const listTasks = wrap(async (req, res) => {
  const filter = { isActive: true };

  if (req.user.role === "employee" || req.user.role === "manager") {
    if (!req.employee) {
      return res.status(403).json({
        message: "Employee profile not found",
      });
    }

    filter.$and = [
      {
        $or: [
          { departments: { $size: 0 } },
          { departments: req.employee.department },
        ],
      },
      {
        $or: [
          { designations: { $size: 0 } },
          { designations: req.employee.designation || "" },
        ],
      },
    ];
  }

  const tasks = await Task.find(filter)
    .sort({ title: 1 })
    .select("title description departments designations");

  res.json(tasks);
});

// Update a predefined task (Admin only)
export const updateTask = wrap(async (req, res) => {
  const {
    title,
    description,
    departments,
    designations,
    isActive,
  } = req.body || {};

  const updates = {};

  if (title !== undefined) {
    if (!isStr(title) || !title.trim()) {
      return res.status(400).json({
        message: "Invalid task title",
      });
    }
    updates.title = title.trim();
  }

  if (description !== undefined) {
    if (!isStr(description)) {
      return res.status(400).json({
        message: "Invalid description",
      });
    }
    updates.description = description.trim();
  }

  if (departments !== undefined) {
    if (!Array.isArray(departments) || !departments.every(isStr)) {
      return res.status(400).json({
        message: "Invalid departments",
      });
    }
    updates.departments = departments.map(value => value.trim());
  }

  if (designations !== undefined) {
    if (!Array.isArray(designations) || !designations.every(isStr)) {
      return res.status(400).json({
        message: "Invalid designations",
      });
    }
    updates.designations = designations.map(value => value.trim());
  }

  if (isActive !== undefined) {
    if (typeof isActive !== "boolean") {
      return res.status(400).json({
        message: "isActive must be true or false",
      });
    }
    updates.isActive = isActive;
  }

  const task = await Task.findByIdAndUpdate(
    req.params.id,
    { $set: updates },
    { new: true, runValidators: true }
  );

  if (!task) {
    return res.status(404).json({
      message: "Task not found",
    });
  }

  res.json({
    message: "Task updated successfully",
    task,
  });
});

// Deactivate a task without deleting historical references
export const deactivateTask = wrap(async (req, res) => {
  const task = await Task.findByIdAndUpdate(
    req.params.id,
    { $set: { isActive: false } },
    { new: true }
  );

  if (!task) {
    return res.status(404).json({
      message: "Task not found",
    });
  }

  res.json({
    message: "Task deactivated successfully",
    task,
  });
});
