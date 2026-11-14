// routes/index.js
import { Router } from "express";
import { protect, authorize } from "../middleware/auth.js";
import * as auth from "../controllers/auth.js";
import * as emp from "../controllers/employee.js";
import * as att from "../controllers/attendance.js";
import * as rep from "../controllers/report.js";
import * as lv from "../controllers/leave.js";
import { dashboard } from "../controllers/dashboard.js";

const r = Router();
const admin = authorize("admin");
const employeeOnly = authorize("employee");

// Auth
r.post("/auth/login", auth.login);
r.get("/auth/me", protect, auth.me);

// Employees (HR/Admin only, except viewing own record)
r.post("/employees", protect, admin, emp.createEmployee);
r.get("/employees", protect, admin, emp.listEmployees);
r.get("/employees/:id", protect, emp.getEmployee);
r.put("/employees/:id", protect, admin, emp.updateEmployee);
r.patch("/employees/:id/deactivate", protect, admin, emp.deactivateEmployee);

// Attendance
r.post("/attendance/check-in", protect, employeeOnly, att.checkIn);
r.post("/attendance/check-out", protect, employeeOnly, att.checkOut);
r.get("/attendance/me", protect, employeeOnly, att.myHistory);
r.get("/attendance", protect, admin, att.listAll);

// Daily Activity Reports
r.post("/reports", protect, employeeOnly, rep.createReport);
r.put("/reports/:id", protect, employeeOnly, rep.updateReport);
r.get("/reports/me", protect, employeeOnly, rep.myReports);
r.get("/reports", protect, admin, rep.listReports);

// Leaves
r.post("/leaves", protect, employeeOnly, lv.applyLeave);
r.get("/leaves/me", protect, employeeOnly, lv.myLeaves);
r.patch("/leaves/:id/cancel", protect, employeeOnly, lv.cancelLeave);
r.get("/leaves", protect, admin, lv.listLeaves);
r.patch("/leaves/:id/approve", protect, admin, lv.decide("Approved"));
r.patch("/leaves/:id/reject", protect, admin, lv.decide("Rejected"));

// Dashboard (role-specific data is chosen inside the controller)
r.get("/dashboard", protect, dashboard);

export default r;