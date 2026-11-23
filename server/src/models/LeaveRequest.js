
import mongoose from "mongoose";

const leaveSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },

    leaveType: {
      type: String,
      enum: ["Casual", "Sick", "Earned", "Unpaid"],
      required: true,
    },

    startDate: {
      type: Date,
      required: true,
    },

    endDate: {
      type: Date,
      required: true,
      validate: {
        validator: function (value) {
          return !this.startDate || value >= this.startDate;
        },
        message: "End date cannot be earlier than start date.",
      },
    },

    // FullDay = normal leave; HalfDay = 0.5 working day.
    dayType: {
      type: String,
      enum: ["FullDay", "HalfDay"],
      default: "FullDay",
    },

    // Relevant only for half-day requests.
    halfDaySession: {
      type: String,
      enum: ["FirstHalf", "SecondHalf", null],
      default: null,
    },

    reason: {
      type: String,
      required: true,
      maxlength: 500,
      trim: true,
    },

    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected", "Cancelled"],
      default: "Pending",
      index: true,
    },

    // Set when an approved request is allocated against leave balance.
    requestedDays: {
      type: Number,
      default: 0,
      min: 0,
    },

    paidDays: {
      type: Number,
      default: 0,
      min: 0,
    },

    unpaidDays: {
      type: Number,
      default: 0,
      min: 0,
    },

    allocationStatus: {
      type: String,
      enum: ["Pending", "Allocated", "Reversed"],
      default: "Pending",
    },

    allocatedAt: {
      type: Date,
      default: null,
    },

    allocatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    reviewedAt: {
      type: Date,
      default: null,
    },

    reviewNote: {
      type: String,
      maxlength: 1000,
      trim: true,
      default: "",
    },
  },
  { timestamps: true }
);

leaveSchema.index({ employee: 1, startDate: 1, endDate: 1 });
leaveSchema.index({ status: 1, startDate: 1, endDate: 1 });
leaveSchema.index({ employee: 1, allocationStatus: 1 });

const LeaveRequest =
  mongoose.models.LeaveRequest ||
  mongoose.model("LeaveRequest", leaveSchema);

export default LeaveRequest;
