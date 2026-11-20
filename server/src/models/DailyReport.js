
import mongoose from "mongoose";

// =====================================
// DATE VALIDATION
// =====================================

const isValidDate = (value) => {
  if (typeof value !== "string") return false;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

// =====================================
// BLOCKER DETAILS
// =====================================

const blockerSchema = new mongoose.Schema({
  description: {
    type: String,
    required: true,
    maxlength: 2000,
    trim: true,
  },

  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Employee",
    default: null,
  },

  status: {
    type: String,
    enum: ["Open", "In Progress", "Resolved"],
    default: "Open",
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },

  resolvedAt: {
    type: Date,
    default: null,
  },
});

// =====================================
// TASK REVIEW HISTORY
// =====================================

const reviewHistorySchema = new mongoose.Schema({
  action: {
    type: String,
    enum: [
      "Approved",
      "Rejected",
      "Revision Required",
      "Reopened",
    ],
    required: true,
  },

  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Employee",
    default: null,
  },

  remarks: {
    type: String,
    maxlength: 2000,
    default: "",
    trim: true,
  },

  timestamp: {
    type: Date,
    default: Date.now,
  },
});

// =====================================
// MANAGER REVIEW DETAILS
// =====================================

const reviewSchema = new mongoose.Schema({
  status: {
    type: String,
    enum: [
      "Pending",
      "Approved",
      "Rejected",
      "Revision Required",
    ],
    default: "Pending",
  },

  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Employee",
    default: null,
  },

  reviewedAt: {
    type: Date,
    default: null,
  },

  deadline: {
    type: Date,
    default: null,
  },

  reopenedAt: {
    type: Date,
    default: null,
  },

  reopenUntil: {
    type: Date,
    default: null,
  },

  remarks: {
    type: String,
    maxlength: 2000,
    default: "",
    trim: true,
  },

  reviewHistory: {
    type: [reviewHistorySchema],
    default: [],
  },
});

// =====================================
// INDIVIDUAL DAR TASK ENTRY
// =====================================

const taskSchema = new mongoose.Schema({
  // Legacy reference.
  // Existing DAR records continue referencing Task.
  task: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Task",
    default: null,
  },

  // New reference to an actual employee task assignment.
  taskAssignment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "TaskAssignment",
    default: null,
  },

  // Allows employees to report manual/unassigned work.
  // This also preserves the task title if the original
  // task or assignment is later deactivated.
  taskNameSnapshot: {
    type: String,
    required: true,
    trim: true,
    maxlength: 150,
  },

  description: {
    type: String,
    maxlength: 3000,
    default: "",
    trim: true,
  },

  startTime: {
    type: Date,
    default: null,
  },

  endTime: {
    type: Date,
    default: null,
    validate: {
      validator: function (value) {
        if (!value || !this.startTime) return true;
        return value >= this.startTime;
      },
      message: "End time cannot be earlier than start time.",
    },
  },

  hoursSpent: {
    type: Number,
    min: 0,
    max: 24,
    default: 0,
  },

  status: {
    type: String,
    enum: [
      "Pending",
      "In Progress",
      "Completed",
      "On Hold",
    ],
    default: "In Progress",
  },

  lastUpdatedAt: {
    type: Date,
    default: Date.now,
  },

  blockers: {
    type: [blockerSchema],
    default: [],
  },

  review: {
    type: reviewSchema,
    default: () => ({}),
  },
});

// =====================================
// MAIN DAILY REPORT
// =====================================

const reportSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: false,
    },

    reportDate: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: isValidDate,
        message: "Report date must be a valid YYYY-MM-DD date.",
      },
    },

    tasks: {
      type: [taskSchema],
      default: [],
      validate: {
        validator: function (tasks) {
          return Array.isArray(tasks) && tasks.length > 0;
        },
        message: "At least one task is required.",
      },
    },

    overallStatus: {
      type: String,
      enum: [
        "Draft",
        "Submitted",
        "Under Review",
        "Approved",
        "Revision Required",
      ],
      default: "Draft",
    },

    submittedAt: {
      type: Date,
      default: null,
    },

    // Backward-compatible fields.
    workCompleted: {
      type: String,
      maxlength: 3000,
      default: "",
      trim: true,
    },

    inProgress: {
      type: String,
      maxlength: 3000,
      default: "",
      trim: true,
    },

    blockers: {
      type: String,
      maxlength: 3000,
      default: "",
      trim: true,
    },

    nextDayPlan: {
      type: String,
      maxlength: 3000,
      default: "",
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// =====================================
// DATABASE INDEXES
// =====================================

reportSchema.index(
  { employee: 1, reportDate: 1 },
  {
    unique: true,
    name: "unique_employee_daily_report",
  }
);

reportSchema.index(
  { reportDate: -1 },
  { name: "report_date_index" }
);

reportSchema.index(
  { overallStatus: 1, submittedAt: -1 },
  { name: "report_status_submission_index" }
);

// =====================================
// EXPORT MODEL
// =====================================

const DailyReport = mongoose.model(
  "DailyReport",
  reportSchema
);

export default DailyReport;
