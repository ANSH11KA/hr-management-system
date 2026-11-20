
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Employee from "../models/Employee.js";
import { wrap } from "./wrap.js";

const isStr = value => typeof value === "string";

// Dummy hash to reduce timing differences for unknown emails
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

// Safe public user response
const publicUser = user => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
});

// Generate JWT
const generateToken = user => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured.");
  }

  return jwt.sign(
    { id: user._id.toString() },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );
};

// Shared login validation
const validateCredentials = async (email, password) => {
  if (
    !isStr(email) ||
    !isStr(password) ||
    !email.trim() ||
    !password
  ) {
    return {
      error: "Email and password are required",
      status: 400,
    };
  }

  const normalizedEmail = email.trim().toLowerCase();

  const user = await User.findOne({
    email: normalizedEmail,
  }).select("+passwordHash");

  const valid = await bcrypt.compare(
    password,
    user ? user.passwordHash : DUMMY_HASH
  );

  if (!user || !valid) {
    return {
      error: "Invalid email or password",
      status: 401,
    };
  }

  if (user.isActive === false) {
    return {
      error: "Account deactivated. Please contact HR.",
      status: 403,
    };
  }

  return { user };
};

// Employee and Admin login
export const login = wrap(async (req, res) => {
  const { email, password } = req.body || {};

  const result = await validateCredentials(email, password);

  if (result.error) {
    return res.status(result.status).json({
      message: result.error,
    });
  }

  const { user } = result;

  // Managers must use the separate manager login
  if (user.role === "manager") {
    return res.status(403).json({
      message: "Please use the Manager Login portal.",
    });
  }

  const token = generateToken(user);

  return res.status(200).json({
    token,
    user: publicUser(user),
  });
});

// Separate Manager login
export const managerLogin = wrap(async (req, res) => {
  const { email, password } = req.body || {};

  const result = await validateCredentials(email, password);

  if (result.error) {
    return res.status(result.status).json({
      message: result.error,
    });
  }

  const { user } = result;

  if (user.role !== "manager") {
    return res.status(403).json({
      message: "This login is only for manager accounts.",
    });
  }

  // Manager must have an Employee profile
  const employee = await Employee.findOne({
    user: user._id,
  });

  if (!employee) {
    return res.status(403).json({
      message: "Manager profile not found. Please contact HR.",
    });
  }

  const token = generateToken(user);

  return res.status(200).json({
    token,
    user: publicUser(user),
  });
});

// Get currently logged-in user details
export const me = wrap(async (req, res) => {
  // Employee profile was already loaded by protect middleware
  const employee = req.employee;

  if (employee) {
    await employee.populate({
      path: "manager",
      populate: {
        path: "user",
        select: "name email",
      },
    });
  }

  return res.status(200).json({
    user: publicUser(req.user),
    employee: employee || null,
  });
});
