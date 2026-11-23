
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
import * as payroll from "../controllers/payroll.js";
import * as notification from "../controllers/notification.js";
import * as announcement from "../controllers/announcement.js";
import * as policy from "../controllers/policy.js";
import * as performance from "../controllers/performance.js";
import { policyUpload } from "../middleware/policyUpload.js";
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

// Start lunch break
r.post(
  "/attendance/lunch-out",
  protect,
  managerOrEmployee,
  requireEmployeeProfile,
  att.lunchOut
);

// End lunch break
r.post(
  "/attendance/lunch-in",
  protect,
  managerOrEmployee,
  requireEmployeeProfile,
  att.lunchIn
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
// PAYROLL MANAGEMENT
// =====================================

// HR: View all employee salary structures
r.get(
  "/payroll",
  protect,
  admin,
  payroll.listSalaryStructures
);

// HR: View one employee's salary history
r.get(
  "/payroll/employees/:employeeId",
  protect,
  admin,
  payroll.getEmployeeSalaryHistory
);

// HR: Create a salary structure
r.post(
  "/payroll/salary-structures",
  protect,
  admin,
  payroll.createSalaryStructure
);

// HR: Update the active salary structure
r.put(
  "/payroll/salary-structures/:id",
  protect,
  admin,
  payroll.updateSalaryStructure
);

// Employee: View own salary and salary history
r.get(
  "/payroll/me",
  protect,
  employeeOnly,
  requireEmployeeProfile,
  payroll.getMySalary
);

// =====================================
// HR NOTIFICATIONS
// =====================================

// HR: Get all notifications and unread count
r.get(
  "/notifications",
  protect,
  admin,
  notification.getNotifications
);

// HR: Mark notification as read
r.patch(
  "/notifications/:id/read",
  protect,
  admin,
  notification.markNotificationRead
);

// =====================================
// HR ANNOUNCEMENTS
// =====================================

// HR: Create announcement
r.post(
  "/announcements",
  protect,
  admin,
  announcement.createAnnouncement
);

// HR: View all announcements (including drafts)
r.get(
  "/announcements",
  protect,
  admin,
  announcement.listAnnouncements
);

// Employee / Manager: View published announcements only
r.get(
  "/announcements/employee",
  protect,
  managerOrEmployee,
  requireManagerProfile,
  announcement.listAnnouncements
);

// HR: View individual announcement
r.get(
  "/announcements/:id",
  protect,
  admin,
  announcement.getAnnouncement
);

// HR: Edit announcement
r.put(
  "/announcements/:id",
  protect,
  admin,
  announcement.updateAnnouncement
);

// HR: Deactivate announcement
r.patch(
  "/announcements/:id/deactivate",
  protect,
  admin,
  announcement.deactivateAnnouncement
);

// =====================================
// COMPANY POLICIES
// =====================================

// HR: Create policy with optional PDF
r.post(
  "/policies",
  protect,
  admin,
  policyUpload,
  policy.createPolicy
);

// HR: View all policies
r.get(
  "/policies",
  protect,
  admin,
  policy.listPolicies
);

// Employee / Manager: View published policies
r.get(
  "/policies/employee",
  protect,
  managerOrEmployee,
  requireManagerProfile,
  policy.listPolicies
);

// HR / Employee / Manager: View or download policy PDF
r.get(
  "/policies/:id/document",
  protect,
  authorize("admin", "manager", "employee"),
  requireManagerProfile,
  policy.getPolicyDocument
);

// HR: View individual policy
r.get(
  "/policies/:id",
  protect,
  admin,
  policy.getPolicy
);

// HR: Edit policy and optionally replace PDF
r.put(
  "/policies/:id",
  protect,
  admin,
  policyUpload,
  policy.updatePolicy
);

// HR: Deactivate policy
r.patch(
  "/policies/:id/deactivate",
  protect,
  admin,
  policy.deactivatePolicy
);

// =====================================
// PERFORMANCE MANAGEMENT
// =====================================

// Manager: Get employees assigned to this manager
r.get(
  "/performance/manager/team",
  protect,
  managerOnly,
  requireEmployeeProfile,
  performance.getManagerTeam
);

// Manager: Submit or update daily employee rating
r.post(
  "/performance/manager/daily",
  protect,
  managerOnly,
  requireEmployeeProfile,
  performance.submitManagerDailyReview
);

// Manager: View daily ratings given to their team
r.get(
  "/performance/manager/team-reviews",
  protect,
  managerOnly,
  requireEmployeeProfile,
  performance.getManagerTeamReviews
);

// HR: Get all active employees, including managers
r.get(
  "/performance/hr/employees",
  protect,
  admin,
  performance.getHREmployees
);

// HR: Submit or update monthly employee rating
r.post(
  "/performance/hr/monthly",
  protect,
  admin,
  performance.submitHRMonthlyReview
);

// HR: View monthly performance reviews
r.get(
  "/performance/hr/monthly",
  protect,
  admin,
  performance.getHRMonthlyReviews
);

// HR: View manager daily reviews for a selected month
r.get(
  "/performance/hr/daily",
  protect,
  admin,
  performance.getHRDailyReviews
);

// Employee / Manager: View own performance history
r.get(
  "/performance/me",
  protect,
  managerOrEmployee,
  requireEmployeeProfile,
  performance.getMyPerformance
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
