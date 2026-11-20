// server/src/seed.js
// Resets the database to a clean demo state. DESTRUCTIVE: it deletes every document in
// all five collections, so the old attendance, DAR and leave records can never be left
// pointing at employees that no longer exist.
//
//   npm run seed                 asks you to type the database name before deleting
//   npm run seed -- --yes        skips the question (still prints what it will delete)
//   NODE_ENV=production          refused unless you also pass --force
import "./config/dns.js";
import "dotenv/config";
import readline from "node:readline/promises";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import User from "./models/User.js";
import Employee from "./models/Employee.js";
import Attendance from "./models/Attendance.js";
import DailyReport from "./models/DailyReport.js";
import LeaveRequest from "./models/LeaveRequest.js";

const args = process.argv.slice(2);
const force = args.includes("--force");
const yes = args.includes("--yes");

if (process.env.NODE_ENV === "production" && !force) {
  console.error("Refusing to seed: NODE_ENV is production. Pass --force only if you really mean it.");
  process.exit(1);
}

await mongoose.connect(process.env.MONGO_URI);
const dbName = mongoose.connection.name;

// children first, then employees, then users
const models = [Attendance, DailyReport, LeaveRequest, Employee, User];
const counts = await Promise.all(models.map(m => m.countDocuments()));
console.log(`Database: ${dbName}`);
models.forEach((m, i) => console.log(`  ${m.modelName}: ${counts[i]} documents`));

if (!yes) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`This deletes ALL of the above from "${dbName}". Type the database name to continue: `);
  rl.close();
  if (answer.trim() !== dbName) {
    console.log("Cancelled. Nothing was deleted.");
    await mongoose.disconnect();
    process.exit(0);
  }
}

await Promise.all(models.map(m => m.deleteMany({})));

const hash = await bcrypt.hash("Password@123", 10);
const mk = async (name, email, role, employeeId, department) => {
  const u = await User.create({ name, email, role, passwordHash: hash });
  await Employee.create({
    employeeId, user: u._id, department,
    designation: role === "admin" ? "HR Manager" : "Developer",
    joiningDate: new Date("2025-01-15"),
  });
};
await mk("Demo HR", "hr@demo.com", "admin", "EMP001", "HR");
await mk("Demo Employee", "emp@demo.com", "employee", "EMP002", "Engineering");

console.log("Seeded");
await mongoose.disconnect();