// models/LeaveRequest.js
import mongoose from "mongoose";
const leaveSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true, index: true },
  leaveType: { type: String, enum: ["Casual", "Sick", "Earned", "Unpaid"], required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  reason: { type: String, required: true, maxlength: 500 },
  status: { type: String, enum: ["Pending", "Approved", "Rejected", "Cancelled"], default: "Pending", index: true },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  reviewNote: String,
}, { timestamps: true });
export default mongoose.model("LeaveRequest", leaveSchema);