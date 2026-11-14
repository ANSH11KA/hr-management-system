// middleware/auth.js
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Employee from "../models/Employee.js";

export const protect = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) return res.status(401).json({ message: "Not authenticated" });
    const { id } = jwt.verify(header.split(" ")[1], process.env.JWT_SECRET);
    const user = await User.findById(id);
    if (!user || !user.isActive) return res.status(401).json({ message: "Account inactive or not found" });
    req.user = user;
    req.employee = await Employee.findOne({ user: user._id }); // identity comes from the token, never the body
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
  }
};

export const authorize = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : res.status(403).json({ message: "Forbidden: insufficient permissions" });