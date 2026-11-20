
import { Router } from "express";

import {
  protect,
  authorize,
  requireEmployeeProfile,
} from "../middleware/auth.js";

import * as auth from "../controllers/auth.js";
import * as emp from "../controllers/employee.js";
import * as att from "../controllers/attendance.js";
import * as rep from "../controllers/report.js";
import * as lv from "../controllers/leave.js";
import * as task from "../controllers/task.js";
import * as taskAssignment from "../controllers/taskAssignment.js";

import { dashboard } from "../controllers/dashboard.js";
import { employeeUpload } from "../middleware/employeeUpload.js";

const r = Router();

// =====================================
// ROLE PERMISSIONS
// =====================================

const admin = authorize("admin");
const employeeOnly = authorize("employee");
const managerOnly = authorize("manager");
const managerOrEmployee = authorize("manager", "employee");
const adminOrManager = authorize("admin", "manager");

// Require employee profile for managers.
// Admin accounts do not require an employee profile.
const requireManagerProfile = (req, res, next) => {
  if (req.user?.role === "manager" && !req.employee) {
    return res.status(403).json({
      message: "Manager employee profile not found. Please contact HR.",
    });
  }

  next();
};

// =====================================
// AUTHENTICATION
// =====================================

r.post("/auth/login", auth.login);

r.post("/auth/manager-login", auth.managerLogin);

r.get("/auth/me", protect, auth.me);

// =====================================
// EMPLOYEE MANAGEMENT
// =====================================

// Create employee (Admin)
r.post(
  "/employees",
  protect,
  admin,
  employeeUpload,
  emp.createEmployee
);

// Update employee (Admin)
r.put(
  "/employees/:id",
  protect,
  admin,
  employeeUpload,
  emp.updateEmployee
);

// List employees (Admin / Manager)
r.get(
  "/employees",
  protect,
  adminOrManager,
  requireManagerProfile,
  emp.listEmployees
);

// Employee profile picture
r.get(
  "/employees/:id/profile-picture",
  protect,
  emp.getEmployeeProfilePicture
);

// Download employee documents (Admin)
r.get(
  "/employees/:id/documents/:documentId",
  protect,
  admin,
  emp.downloadEmployeeDocument
);

// Get individual employee
r.get(
  "/employees/:id",
  protect,
  emp.getEmployee
);

// Deactivate employee (Admin)
r.patch(
  "/employees/:id/deactivate",
  protect,
  admin,
  emp.deactivateEmployee
);

// =====================================
// ATTENDANCE MANAGEMENT
// =====================================

// Check in
r.post(
  "/attendance/check-in",
  protect,
  managerOrEmployee,
  requireEmployeeProfile,
  att.checkIn
);

// Check out
r.post(
  "/attendance/check-out",
  protect,
  managerOrEmployee,
  requireEmployeeProfile,
  att.checkOut
);

// Own attendance history
r.get(
  "/attendance/me",
  protect,
  managerOrEmployee,
  requireEmployeeProfile,
  att.myHistory
);

// Organization attendance (Admin / Manager)
r.get(
  "/attendance",
  protect,
  adminOrManager,
  requireManagerProfile,
  att.listAll
);

// =====================================
// TASK TEMPLATES
// =====================================

// Create predefined task template (Admin)
r.post(
  "/tasks",
  protect,
  admin,
  task.createTask
);

// List predefined task templates (Manager / Employee)
r.get(
  "/tasks",
  protect,
  managerOrEmployee,
  requireEmployeeProfile,
  task.listTasks
);

// Update predefined task template (Admin)
r.put(
  "/tasks/:id",
  protect,
  admin,
  task.updateTask
);

// Deactivate predefined task template (Admin)
r.patch(
  "/tasks/:id/deactivate",
  protect,
  admin,
  task.deactivateTask
);

// =====================================
// EMPLOYEE TASK ASSIGNMENTS
// =====================================

// Assign task to employee (Admin / Manager)
r.post(
  "/task-assignments",
  protect,
  adminOrManager,
  requireManagerProfile,
  taskAssignment.createAssignment
);

// List assigned tasks
// Admin: All assignments
// Manager: Direct and indirect reports
// Employee: Own assignments
r.get(
  "/task-assignments",
  protect,
  requireManagerProfile,
  taskAssignment.listAssignments
);

// Update own task progress (Employee)
r.patch(
  "/task-assignments/:id/progress",
  protect,
  employeeOnly,
  requireEmployeeProfile,
  taskAssignment.updateProgress
);

// Deactivate assignment (Admin / Manager)
r.patch(
  "/task-assignments/:id/deactivate",
  protect,
  adminOrManager,
  requireManagerProfile,
  taskAssignment.deactivateAssignment
);

// =====================================
// DAILY ACTIVITY REPORTS (DAR)
// =====================================

// Submit DAR (Employee)
r.post(
  "/reports",
  protect,
  employeeOnly,
  requireEmployeeProfile,
  rep.createReport
);

// Update own DAR (Employee)
r.put(
  "/reports/:id",
  protect,
  employeeOnly,
  requireEmployeeProfile,
  rep.updateReport
);

// Own DAR history
r.get(
  "/reports/me",
  protect,
  employeeOnly,
  requireEmployeeProfile,
  rep.myReports
);

// List DAR reports (Admin / Manager)
r.get(
  "/reports",
  protect,
  adminOrManager,
  requireManagerProfile,
  rep.listReports
);

// Manager reviews individual DAR task
r.patch(
  "/reports/:id/tasks/:taskEntryId/review",
  protect,
  managerOnly,
  requireEmployeeProfile,
  rep.reviewTask
);

// Admin reopens overdue task review
r.patch(
  "/reports/:id/tasks/:taskEntryId/reopen",
  protect,
  admin,
  rep.reopenTaskReview
);

// =====================================
// LEAVE MANAGEMENT
// =====================================

// Apply for leave (Employee)
r.post(
  "/leaves",
  protect,
  employeeOnly,
  requireEmployeeProfile,
  lv.applyLeave
);

// Own leave history (Manager / Employee)
r.get(
  "/leaves/me",
  protect,
  managerOrEmployee,
  requireEmployeeProfile,
  lv.myLeaves
);

// Cancel own pending leave (Employee)
r.patch(
  "/leaves/:id/cancel",
  protect,
  employeeOnly,
  requireEmployeeProfile,
  lv.cancelLeave
);

// List leave requests (Admin / Manager)
r.get(
  "/leaves",
  protect,
  adminOrManager,
  requireManagerProfile,
  lv.listLeaves
);

// Approve leave (Admin)
r.patch(
  "/leaves/:id/approve",
  protect,
  admin,
  (req, res, next) => {
    req.body.status = "Approved";
    return lv.decide(req, res, next);
  }
);

// Reject leave (Admin)
r.patch(
  "/leaves/:id/reject",
  protect,
  admin,
  (req, res, next) => {
    req.body.status = "Rejected";
    return lv.decide(req, res, next);
  }
);

// =====================================
// DASHBOARD
// =====================================

r.get(
  "/dashboard",
  protect,
  requireManagerProfile,
  dashboard
);

export default r;
