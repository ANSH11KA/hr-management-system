// models/Attendance.js
import mongoose from "mongoose";
const attendanceSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true },
  date: { type: String, required: true }, // "YYYY-MM-DD"
  checkInAt: Date,
  checkOutAt: Date,
  totalMinutes: { type: Number, default: 0 },
  status: { type: String, enum: ["Present", "Absent", "Half Day", "Late", "Leave"], default: "Present" },
}, { timestamps: true });
attendanceSchema.index({ employee: 1, date: 1 }, { unique: true }); // blocks duplicate check-ins
export default mongoose.model("Attendance", attendanceSchema);