// models/DailyReport.js
import mongoose from "mongoose";
const reportSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true },
  reportDate: { type: String, required: true },
  workCompleted: { type: String, required: true, maxlength: 3000 },
  inProgress: { type: String, maxlength: 3000 },
  blockers: { type: String, maxlength: 3000 },
  nextDayPlan: { type: String, maxlength: 3000 },
  submittedAt: { type: Date, default: Date.now },
}, { timestamps: true });
reportSchema.index({ employee: 1, reportDate: 1 }, { unique: true }); // one DAR per day
export default mongoose.model("DailyReport", reportSchema);