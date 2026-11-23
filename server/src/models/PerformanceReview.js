
import mongoose from "mongoose";

const performanceReviewSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },

    // ManagerDaily = daily manager review
    // HRMonthly = monthly HR review
    reviewType: {
      type: String,
      enum: ["ManagerDaily", "HRMonthly"],
      required: true,
    },

    // Daily: YYYY-MM-DD
    // Monthly: YYYY-MM
    periodKey: {
      type: String,
      required: true,
      trim: true,
    },

    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 10,
      validate: {
        validator: Number.isInteger,
        message: "Rating must be a whole number from 1 to 10.",
      },
    },

    reasoning: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      maxlength: 2000,
    },

    strengths: {
      type: String,
      trim: true,
      maxlength: 1500,
      default: "",
    },

    improvementAreas: {
      type: String,
      trim: true,
      maxlength: 1500,
      default: "",
    },

    actionPlan: {
      type: String,
      trim: true,
      maxlength: 1500,
      default: "",
    },

    reviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Used for manager reviews to identify the manager's Employee profile.
    reviewerEmployee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },
  },
  { timestamps: true }
);

// Only one daily manager review per employee per day,
// and one monthly HR review per employee per month.
performanceReviewSchema.index(
  { employee: 1, reviewType: 1, periodKey: 1 },
  { unique: true }
);

performanceReviewSchema.index({
  reviewer: 1,
  reviewType: 1,
  createdAt: -1,
});

export default mongoose.model("PerformanceReview", performanceReviewSchema);
