
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Employee from "../models/Employee.js";

// Authenticate user using JWT
export const protect = async (req, res, next) => {
  try {
    const header = req.headers.authorization;

    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Not authenticated. Token is required.",
      });
    }

    const token = header.slice(7).trim();

    if (!token) {
      return res.status(401).json({
        message: "Authentication token is missing.",
      });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        message: "Authentication configuration error.",
      });
    }

    let decoded;

    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      return res.status(401).json({
        message: "Invalid or expired token.",
      });
    }

    // Ensure token contains a valid user ID
    if (!decoded || typeof decoded !== "object" || !decoded.id) {
      return res.status(401).json({
        message: "Invalid authentication token.",
      });
    }

    // Find authenticated user
    const user = await User.findById(decoded.id);

    if (!user || user.isActive === false) {
      return res.status(401).json({
        message: "Account inactive or not found.",
      });
    }

    req.user = user;

    // Get employee profile linked to authenticated user
    // Sensitive fields remain excluded by the Employee schema.
    req.employee = await Employee.findOne({
      user: user._id,
    });

    next();
  } catch (error) {
    next(error);
  }
};

// Role-based authorization
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        message: "Authentication required.",
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: "Forbidden: insufficient permissions.",
      });
    }

    next();
  };
};

// Require employee profile
export const requireEmployeeProfile = (req, res, next) => {
  if (!req.employee) {
    return res.status(403).json({
      message: "Employee profile not found. Please contact HR.",
    });
  }

  next();
};
