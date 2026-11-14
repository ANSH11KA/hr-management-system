// controllers/auth.js
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Employee from "../models/Employee.js";
import { wrap } from "./wrap.js";

const isStr = v => typeof v === "string";

// Pre-computed hash used to keep response time similar when the email doesn't exist,
// so attackers can't tell which emails are registered by timing.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

const publicUser = u => ({ id: u._id, name: u.name, email: u.email, role: u.role });

export const login = wrap(async (req, res) => {
  const { email, password } = req.body || {};

  if (!isStr(email) || !isStr(password) || !email.trim() || !password)
    return res.status(400).json({ message: "Email and password are required" });

  const user = await User.findOne({ email: email.trim().toLowerCase() }).select("+passwordHash");
  const valid = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);

  if (!user || !valid)
    return res.status(401).json({ message: "Invalid email or password" });

  // only revealed after the password is verified
  if (!user.isActive)
    return res.status(403).json({ message: "Account deactivated. Please contact HR." });

  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1d" });
  res.json({ token, user: publicUser(user) });
});

export const me = wrap(async (req, res) => {
  const employee = await Employee.findOne({ user: req.user._id }).populate("manager", "employeeId");
  res.json({ user: publicUser(req.user), employee });
});