
import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },

    // Business date in Asia/Kolkata: YYYY-MM-DD
    date: {
      type: String,
      required: true,
      match: [
        /^\d{4}-\d{2}-\d{2}$/,
        "Attendance date must be in YYYY-MM-DD format.",
      ],
    },

    checkInAt: {
      type: Date,
      default: null,
    },

    checkOutAt: {
      type: Date,
      default: null,
      validate: {
        validator: function (value) {
          return (
            !value ||
            !this.checkInAt ||
            value >= this.checkInAt
          );
        },
        message: "Check-out cannot be earlier than check-in.",
      },
    },

    totalMinutes: {
      type: Number,
      default: 0,
      min: [0, "Total minutes cannot be negative."],
      validate: {
        validator: Number.isInteger,
        message: "Total minutes must be a whole number.",
      },
    },

    status: {
      type: String,
      enum: ["Present", "Absent", "Half Day", "Late", "Leave"],
      default: "Present",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// One attendance record per employee per business date.
attendanceSchema.index(
  { employee: 1, date: 1 },
  { unique: true, name: "unique_employee_attendance_date" }
);

// Useful for attendance reports and dashboard queries.
attendanceSchema.index({ date: 1, status: 1 });

export default mongoose.model("Attendance", attendanceSchema);
