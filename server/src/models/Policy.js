
import mongoose from "mongoose";

const policySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },

    // Policy content written by HR
    content: {
      type: String,
      trim: true,
      default: "",
    },

    category: {
      type: String,
      enum: [
        "HR Policies",
        "Leave",
        "Attendance",
        "Code of Conduct",
        "IT & Security",
        "Payroll",
        "Other",
      ],
      default: "Other",
      required: true,
      index: true,
    },

    effectiveDate: {
      type: Date,
      default: null,
    },

    status: {
      type: String,
      enum: ["Draft", "Published", "Inactive"],
      default: "Draft",
      required: true,
      index: true,
    },

    // Optional PDF attachment
    attachment: {
      fileName: {
        type: String,
        default: null,
      },
      filePath: {
        type: String,
        default: null,
      },
      mimeType: {
        type: String,
        default: null,
      },
      fileSize: {
        type: Number,
        default: null,
      },
    },

    publishedAt: {
      type: Date,
      default: null,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Require either written content or a PDF attachment.
policySchema.pre("validate", function () {
  const hasContent = Boolean(this.content?.trim());
  const hasAttachment = Boolean(this.attachment?.filePath);

  if (!hasContent && !hasAttachment) {
    this.invalidate(
      "content",
      "A policy must contain written content or a PDF attachment."
    );
  }
});

policySchema.index({ status: 1, category: 1, publishedAt: -1 });

export default mongoose.model("Policy", policySchema);
