// models/Employee.js
import mongoose from "mongoose";
const employeeSchema = new mongoose.Schema({
  employeeId: { type: String, required: true, unique: true, trim: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  phone: { type: String, match: /^[0-9+\-\s]{7,15}$/ },
  department: { type: String, required: true, index: true },
  designation: String,
  joiningDate: { type: Date, required: true },
  manager: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", default: null },
  employmentStatus: { type: String, enum: ["active", "probation", "terminated", "inactive"], default: "active" },
}, { timestamps: true });
employeeSchema.index({ department: 1, employmentStatus: 1 });
export default mongoose.model("Employee", employeeSchema);