
import mongoose from "mongoose";

const leaveTransactionSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },

    leaveRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LeaveRequest",
      default: null,
    },

    // Used to connect a reversal to the original transaction.
    originalTransaction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LeaveTransaction",
      default: null,
    },

    type: {
      type: String,
      enum: [
        "OPENING",
        "MONTHLY_CREDIT",
        "PAID_LEAVE",
        "UNPAID_LEAVE",
        "ADJUSTMENT",
        "REVERSAL",
      ],
      required: true,
    },

    direction: {
      type: String,
      enum: ["CREDIT", "DEBIT", "INFO"],
      required: true,
    },

    // Always a positive number. direction determines its meaning.
    days: {
      type: Number,
      required: true,
      min: 0,
    },

    // Actual change to the earned-leave balance.
    // Example: +1 for a credit, -0.5 for paid leave, 0 for unpaid leave.
    balanceChange: {
      type: Number,
      required: true,
    },

    balanceBefore: {
      type: Number,
      required: true,
      min: 0,
    },

    balanceAfter: {
      type: Number,
      required: true,
      min: 0,
    },

    month: {
      type: String,
      default: null,
      match: [/^\d{4}-\d{2}$/, "Month must use YYYY-MM format."],
    },

    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
      default: "",
      maxlength: 500,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

leaveTransactionSchema.index({ employee: 1, createdAt: -1 });
leaveTransactionSchema.index({ leaveRequest: 1, createdAt: -1 });
leaveTransactionSchema.index({ employee: 1, type: 1, month: 1 });

const LeaveTransaction =
  mongoose.models.LeaveTransaction ||
  mongoose.model("LeaveTransaction", leaveTransactionSchema);

export default LeaveTransaction;
