
import mongoose from "mongoose";

const leaveBalanceSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      unique: true,
      index: true,
    },

    // Balance carried into the system when the employee is first registered.
    openingBalance: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Total earned leave credited since the balance record was created.
    totalCredited: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Total paid leave consumed from the earned-leave balance.
    totalPaidUsed: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Total unpaid leave days recorded. This does not reduce availableBalance.
    totalUnpaid: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Current earned-leave balance available to the employee.
    availableBalance: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Prevents the same month's leave credit from being applied twice.
    lastCreditMonth: {
      type: String,
      default: null,
      match: [/^\d{4}-\d{2}$/, "Credit month must use YYYY-MM format."],
    },

    lastCreditDate: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

leaveBalanceSchema.index(
  { employee: 1 },
  { unique: true, name: "unique_employee_leave_balance" }
);

const LeaveBalance =
  mongoose.models.LeaveBalance ||
  mongoose.model("LeaveBalance", leaveBalanceSchema);

export default LeaveBalance;
