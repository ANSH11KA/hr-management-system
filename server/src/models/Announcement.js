
import mongoose from "mongoose";

const announcementSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },

    priority: {
      type: String,
      enum: ["Urgent", "High", "Normal"],
      default: "Normal",
      required: true,
    },

    status: {
      type: String,
      enum: ["Draft", "Published", "Inactive"],
      default: "Draft",
      required: true,
      index: true,
    },

    publishedAt: {
      type: Date,
      default: null,
    },

    expiresAt: {
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
  { timestamps: true }
);

announcementSchema.index({ status: 1, publishedAt: -1 });

export default mongoose.model("Announcement", announcementSchema);
