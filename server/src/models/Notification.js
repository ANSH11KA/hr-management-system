
import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    recipientRole: {
      type: String,
      enum: ["admin"],
      required: true,
      default: "admin",
      index: true,
    },

    type: {
      type: String,
      enum: ["LATE_ARRIVAL"],
      required: true,
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    message: {
      type: String,
      required: true,
      trim: true,
    },

    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },

    attendance: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Attendance",
      required: true,
      index: true,
    },

    data: {
      employeeName: {
        type: String,
        default: "",
      },
      employeeCode: {
        type: String,
        default: "",
      },
      department: {
        type: String,
        default: "",
      },
      attendanceDate: {
        type: String,
        required: true,
      },
      checkInAt: {
        type: Date,
        required: true,
      },
      monthlyLateCount: {
        type: Number,
        required: true,
        min: 1,
      },
      allowedLates: {
        type: Number,
        default: 2,
      },
      exceededAllowance: {
        type: Boolean,
        default: false,
      },
    },

    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },

    readAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate HR notifications for the same late attendance.
notificationSchema.index(
  {
    recipientRole: 1,
    type: 1,
    attendance: 1,
  },
  {
    unique: true,
    name: "unique_late_arrival_notification",
  }
);

export default mongoose.model("Notification", notificationSchema);
