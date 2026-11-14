import "dotenv/config";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import User from "./models/User.js";
import Employee from "./models/Employee.js";
import "./config/dns.js";
import "dotenv/config";
// ...rest of your existing imports

await mongoose.connect(process.env.MONGO_URI);
await Promise.all([User.deleteMany(), Employee.deleteMany()]);
const hash = await bcrypt.hash("Password@123", 10);
const mk = async (name, email, role, employeeId, department) => {
  const u = await User.create({ name, email, role, passwordHash: hash });
  await Employee.create({ employeeId, user: u._id, department, designation: role === "admin" ? "HR Manager" : "Developer", joiningDate: new Date("2025-01-15") });
};
await mk("Demo HR", "hr@demo.com", "admin", "EMP001", "HR");
await mk("Demo Employee", "emp@demo.com", "employee", "EMP002", "Engineering");
console.log("Seeded"); process.exit();