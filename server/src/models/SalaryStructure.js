
import mongoose from "mongoose";

const componentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
  },
  { _id: false }
);

const salaryStructureSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },

    // Salary is maintained monthly in INR.
    currency: {
      type: String,
      default: "INR",
      enum: ["INR"],
    },

    salaryFrequency: {
      type: String,
      enum: ["Monthly"],
      default: "Monthly",
    },

    // Fixed monthly earnings
    basicSalary: {
      type: Number,
      required: true,
      min: 0,
    },

    hra: {
      type: Number,
      default: 0,
      min: 0,
    },

    allowances: {
      type: [componentSchema],
      default: [],
    },

    // Fixed monthly deductions, if applicable
    deductions: {
      type: [componentSchema],
      default: [],
    },

    effectiveFrom: {
      type: Date,
      required: true,
    },

    effectiveTo: {
      type: Date,
      default: null,
    },

    status: {
      type: String,
      enum: ["Active", "Replaced", "Inactive"],
      default: "Active",
      index: true,
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

salaryStructureSchema.pre("validate", function () {
  if (
    this.effectiveTo &&
    this.effectiveFrom &&
    this.effectiveTo < this.effectiveFrom
  ) {
    this.invalidate(
      "effectiveTo",
      "Effective end date cannot be before start date."
    );
  }
});

// Find salary structures for an employee efficiently
salaryStructureSchema.index({
  employee: 1,
  effectiveFrom: -1,
});

salaryStructureSchema.index({
  employee: 1,
  status: 1,
});

export default mongoose.model(
  "SalaryStructure",
  salaryStructureSchema
);
