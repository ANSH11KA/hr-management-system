
import mongoose from "mongoose";

const taskAssignmentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },

    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },

    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    dueDate: {
      type: Date,
      required: true,
    },

    priority: {
      type: String,
      enum: ["Low", "Medium", "High", "Urgent"],
      default: "Medium",
    },

    status: {
      type: String,
      enum: [
        "Pending",
        "In Progress",
        "Completed",
        "On Hold",
      ],
      default: "Pending",
    },

    progress: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },

    employeeRemarks: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },

    completedAt: {
      type: Date,
      default: null,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

taskAssignmentSchema.index({
  assignedTo: 1,
  status: 1,
  dueDate: 1,
});

taskAssignmentSchema.index({
  assignedBy: 1,
  createdAt: -1,
});

export default mongoose.model(
  "TaskAssignment",
  taskAssignmentSchema
);
