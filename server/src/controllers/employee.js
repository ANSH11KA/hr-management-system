// controllers/employee.js
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import Employee from "../models/Employee.js";
import { wrap } from "./wrap.js";

const isStr = v => typeof v === "string";
const ACTIVE_STATUSES = ["active", "probation"];

export const createEmployee = wrap(async (req, res) => {
  const { name, email, password, role, employeeId, phone, department, designation, joiningDate, manager } = req.body;

  if (![name, email, password, employeeId, department].every(isStr) || !joiningDate ||
      !name.trim() || !employeeId.trim() || !department.trim() || password.length < 8)
    return res.status(400).json({ message: "Missing or invalid fields (password min 8 chars)" });

  const user = await User.create({
    name: name.trim(),
    email,
    role: role === "admin" ? "admin" : "employee",
    passwordHash: await bcrypt.hash(password, 10),
  });

  try {
    const emp = await Employee.create({
      employeeId: employeeId.trim(), user: user._id, phone, department: department.trim(),
      designation, joiningDate, manager: manager || null,
    });
    res.status(201).json(emp);
  } catch (e) {
    await User.findByIdAndDelete(user._id); // rollback so no orphan user remains
    throw e;
  }
});

export const listEmployees = wrap(async (req, res) => {
  const { search, department, status } = req.query;

  // reject object/array query values (e.g. ?department[$ne]=x)
  if ([search, department, status].some(v => v !== undefined && !isStr(v)))
    return res.status(400).json({ message: "Invalid filter values" });

  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 50);

  const filter = {};
  if (department) filter.department = department;
  if (status) filter.employmentStatus = status;
  if (search) {
    const s = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // escape regex input
    const users = await User.find({
      $or: [{ name: new RegExp(s, "i") }, { email: new RegExp(s, "i") }],
    }).select("_id");
    filter.$or = [{ employeeId: new RegExp(s, "i") }, { user: { $in: users.map(u => u._id) } }];
  }

  const [items, total] = await Promise.all([
    Employee.find(filter)
      .populate("user", "name email role isActive")
      .populate("manager", "employeeId")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Employee.countDocuments(filter),
  ]);
  res.json({ items, total, page, pages: Math.ceil(total / limit) });
});

export const getEmployee = wrap(async (req, res) => {
  const emp = await Employee.findById(req.params.id)
    .populate("user", "name email role isActive")
    .populate("manager", "employeeId");
  if (!emp) return res.status(404).json({ message: "Employee not found" });
  // ownership check for non-admins
  if (req.user.role !== "admin" && String(emp._id) !== String(req.employee?._id))
    return res.status(403).json({ message: "Forbidden" });
  res.json(emp);
});

export const updateEmployee = wrap(async (req, res) => {
  const allowed = ["phone", "department", "designation", "joiningDate", "manager", "employmentStatus", "employeeId"];
  const update = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));

  if ("manager" in update) {
    update.manager = update.manager || null; // "" from the form means "no manager"
    if (update.manager && String(update.manager) === req.params.id)
      return res.status(400).json({ message: "An employee cannot be their own manager" });
  }

  // an admin must not lock themselves out by changing their own status
  if (update.employmentStatus && !ACTIVE_STATUSES.includes(update.employmentStatus) &&
      String(req.employee?._id) === req.params.id)
    return res.status(400).json({ message: "You cannot deactivate your own account" });

  const emp = await Employee.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
  if (!emp) return res.status(404).json({ message: "Employee not found" });

  // keep the login account in sync with the employee record
  const userUpdate = {};
  if (isStr(req.body.name) && req.body.name.trim()) userUpdate.name = req.body.name.trim();
  if (update.employmentStatus) userUpdate.isActive = ACTIVE_STATUSES.includes(update.employmentStatus);
  if (Object.keys(userUpdate).length) await User.findByIdAndUpdate(emp.user, userUpdate);

  res.json(emp);
});

export const deactivateEmployee = wrap(async (req, res) => {
  const emp = await Employee.findById(req.params.id);
  if (!emp) return res.status(404).json({ message: "Employee not found" });
  if (String(emp.user) === String(req.user._id))
    return res.status(400).json({ message: "You cannot deactivate your own account" });

  emp.employmentStatus = "inactive";
  await emp.save();
  await User.findByIdAndUpdate(emp.user, { isActive: false });
  res.json({ message: "Employee deactivated" });
});