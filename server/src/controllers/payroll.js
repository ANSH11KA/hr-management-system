import mongoose from "mongoose";
import Employee from "../models/Employee.js";
import SalaryStructure from "../models/SalaryStructure.js";

// =====================================
// HELPER
// =====================================

const sendError = (res, status, message) => {
  return res.status(status).json({ message });
};

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

const getSalaryData = (body) => ({
  basicSalary: body.basicSalary,
  hra: body.hra ?? 0,
  allowances: Array.isArray(body.allowances) ? body.allowances : [],
  deductions: Array.isArray(body.deductions) ? body.deductions : [],
  notes: body.notes ?? "",
});

// =====================================
// LIST ALL SALARY STRUCTURES (HR)
// GET /api/payroll
// =====================================

export const listSalaryStructures = async (req, res, next) => {
  try {
    const salaries = await SalaryStructure.find()
      .populate({
        path: "employee",
        select: "employeeId department designation user",
        populate: {
          path: "user",
          select: "name email",
        },
      })
      .populate("createdBy", "name email")
      .sort({ effectiveFrom: -1 });

    return res.status(200).json({
      count: salaries.length,
      salaries,
    });
  } catch (error) {
    next(error);
  }
};

// =====================================
// GET SALARY HISTORY FOR ONE EMPLOYEE (HR)
// GET /api/payroll/employees/:employeeId
// =====================================

export const getEmployeeSalaryHistory = async (req, res, next) => {
  try {
    const { employeeId } = req.params;

    if (!isValidId(employeeId)) {
      return sendError(res, 400, "Invalid employee ID.");
    }

    const employee = await Employee.findById(employeeId).populate(
      "user",
      "name email"
    );

    if (!employee) {
      return sendError(res, 404, "Employee not found.");
    }

    const salaries = await SalaryStructure.find({
      employee: employee._id,
    })
      .populate("createdBy", "name email")
      .sort({ effectiveFrom: -1 });

    return res.status(200).json({
      employee,
      salaries,
    });
  } catch (error) {
    next(error);
  }
};

// =====================================
// GET OWN SALARY (EMPLOYEE)
// GET /api/payroll/me
// =====================================

export const getMySalary = async (req, res, next) => {
  try {
    if (!req.employee) {
      return sendError(res, 404, "Employee profile not found.");
    }

    const today = new Date();

    const salaries = await SalaryStructure.find({
      employee: req.employee._id,
    })
      .populate("createdBy", "name email")
      .sort({ effectiveFrom: -1 });

    const currentSalary = salaries.find((salary) => {
      const startDate = new Date(salary.effectiveFrom);
      const endDate = salary.effectiveTo
        ? new Date(salary.effectiveTo)
        : null;

      return (
        startDate <= today &&
        (!endDate || endDate >= today) &&
        salary.status !== "Inactive"
      );
    });

    return res.status(200).json({
      currentSalary: currentSalary || null,
      history: salaries,
    });
  } catch (error) {
    next(error);
  }
};

// =====================================
// CREATE SALARY STRUCTURE (HR)
// POST /api/payroll/salary-structures
// =====================================

export const createSalaryStructure = async (req, res, next) => {
  try {
    const { employeeId, effectiveFrom } = req.body;

    if (!employeeId || !isValidId(employeeId)) {
      return sendError(res, 400, "A valid employee ID is required.");
    }

    if (
      req.body.basicSalary === undefined ||
      req.body.basicSalary === null ||
      req.body.basicSalary === "" ||
      !Number.isFinite(Number(req.body.basicSalary)) ||
      Number(req.body.basicSalary) < 0
    ) {
      return sendError(res, 400, "Please provide a valid basic salary.");
    }

    if (!effectiveFrom || Number.isNaN(new Date(effectiveFrom).getTime())) {
      return sendError(res, 400, "A valid effective-from date is required.");
    }

    const employee = await Employee.findById(employeeId);

    if (!employee) {
      return sendError(res, 404, "Employee not found.");
    }

    if (employee.employmentStatus === "terminated") {
      return sendError(
        res,
        400,
        "Cannot create a salary structure for a terminated employee."
      );
    }

    const newStartDate = new Date(effectiveFrom);

    // Find the currently active salary structure.
    const oldSalary = await SalaryStructure.findOne({
      employee: employee._id,
      status: "Active",
      effectiveTo: null,
    }).sort({ effectiveFrom: -1 });

    if (oldSalary) {
      const oldStartDate = new Date(oldSalary.effectiveFrom);

      if (newStartDate <= oldStartDate) {
        return sendError(
          res,
          400,
          "The new effective date must be later than the existing salary's effective date."
        );
      }

      // Close the previous salary one day before the new salary starts.
      const previousEndDate = new Date(newStartDate);
      previousEndDate.setDate(previousEndDate.getDate() - 1);
      previousEndDate.setHours(23, 59, 59, 999);

      oldSalary.effectiveTo = previousEndDate;
      oldSalary.status = "Replaced";

      await oldSalary.save();
    }

    const salary = await SalaryStructure.create({
      employee: employee._id,
      ...getSalaryData(req.body),
      effectiveFrom: newStartDate,
      currency: "INR",
      salaryFrequency: "Monthly",
      status: "Active",
      createdBy: req.user._id,
    });

    return res.status(201).json({
      message: "Salary structure created successfully.",
      salary,
    });
  } catch (error) {
    next(error);
  }
};

// =====================================
// UPDATE ACTIVE SALARY STRUCTURE (HR)
// PUT /api/payroll/salary-structures/:id
// =====================================

export const updateSalaryStructure = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return sendError(res, 400, "Invalid salary structure ID.");
    }

    const salary = await SalaryStructure.findById(id);

    if (!salary) {
      return sendError(res, 404, "Salary structure not found.");
    }

    if (salary.status !== "Active" || salary.effectiveTo) {
      return sendError(
        res,
        400,
        "Only the active salary structure can be updated."
      );
    }

    const allowedFields = [
      "basicSalary",
      "hra",
      "allowances",
      "deductions",
      "notes",
    ];

    for (const field of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        salary[field] = req.body[field];
      }
    }

    if (
      !Number.isFinite(Number(salary.basicSalary)) ||
      Number(salary.basicSalary) < 0
    ) {
      return sendError(res, 400, "Please provide a valid basic salary.");
    }

    await salary.save();

    return res.status(200).json({
      message: "Salary structure updated successfully.",
      salary,
    });
  } catch (error) {
    next(error);
  }
};