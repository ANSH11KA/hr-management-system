
import mongoose from "mongoose";

import Announcement from "../models/Announcement.js";
import { wrap } from "./wrap.js";

// Validate and normalize announcement fields.
const validateAnnouncementData = (body, isUpdate = false) => {
  const errors = {};
  const data = {};

  if (!isUpdate || body.title !== undefined) {
    if (
      typeof body.title !== "string" ||
      !body.title.trim()
    ) {
      errors.title = "Announcement title is required.";
    } else if (body.title.trim().length > 150) {
      errors.title = "Title cannot exceed 150 characters.";
    } else {
      data.title = body.title.trim();
    }
  }

  if (!isUpdate || body.description !== undefined) {
    if (
      typeof body.description !== "string" ||
      !body.description.trim()
    ) {
      errors.description = "Announcement description is required.";
    } else {
      data.description = body.description.trim();
    }
  }

  if (body.priority !== undefined || !isUpdate) {
    const priority = body.priority || "Normal";

    if (!["Urgent", "High", "Normal"].includes(priority)) {
      errors.priority = "Invalid announcement priority.";
    } else {
      data.priority = priority;
    }
  }

  if (body.status !== undefined || !isUpdate) {
    const status = body.status || "Draft";

    if (!["Draft", "Published", "Inactive"].includes(status)) {
      errors.status = "Invalid announcement status.";
    } else {
      data.status = status;
    }
  }

  if (body.expiresAt !== undefined || !isUpdate) {
    if (
      body.expiresAt === null ||
      body.expiresAt === ""
    ) {
      data.expiresAt = null;
    } else {
      const expiry = new Date(body.expiresAt);

      if (Number.isNaN(expiry.getTime())) {
        errors.expiresAt = "Invalid expiry date.";
      } else {
        data.expiresAt = expiry;
      }
    }
  }

  return { data, errors };
};

// HR creates an announcement.
export const createAnnouncement = wrap(async (req, res) => {
  const { data, errors } = validateAnnouncementData(
    req.body
  );

  if (Object.keys(errors).length) {
    return res.status(400).json({
      message: "Please correct the announcement details.",
      errors,
    });
  }

  if (
    data.expiresAt &&
    data.expiresAt <= new Date()
  ) {
    return res.status(400).json({
      message: "Expiry date must be in the future.",
    });
  }

  const announcement = await Announcement.create({
    ...data,
    publishedAt:
      data.status === "Published" ? new Date() : null,
    createdBy: req.user._id,
  });

  return res.status(201).json({
    message: "Announcement created successfully.",
    announcement,
  });
});

// HR views all announcements.
export const listAnnouncements = wrap(async (req, res) => {
  const isAdmin = req.user.role === "admin";

  const filter = {};

  if (!isAdmin) {
    filter.status = "Published";
    filter.$or = [
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } },
    ];
  }

  const announcements = await Announcement.find(filter)
    .populate("createdBy", "name email")
    .populate("updatedBy", "name email")
    .sort({
      publishedAt: -1,
      createdAt: -1,
    })
    .limit(200)
    .lean();

  return res.json({
    announcements,
    total: announcements.length,
  });
});

// View a single announcement.
export const getAnnouncement = wrap(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({
      message: "Invalid announcement ID.",
    });
  }

  const filter = { _id: id };

  if (req.user.role !== "admin") {
    filter.status = "Published";
    filter.$or = [
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } },
    ];
  }

  const announcement = await Announcement.findOne(filter)
    .populate("createdBy", "name email")
    .populate("updatedBy", "name email");

  if (!announcement) {
    return res.status(404).json({
      message: "Announcement not found.",
    });
  }

  return res.json({ announcement });
});

// HR edits an existing announcement.
export const updateAnnouncement = wrap(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({
      message: "Invalid announcement ID.",
    });
  }

  const { data, errors } = validateAnnouncementData(
    req.body,
    true
  );

  if (Object.keys(errors).length) {
    return res.status(400).json({
      message: "Please correct the announcement details.",
      errors,
    });
  }

  const announcement = await Announcement.findById(id);

  if (!announcement) {
    return res.status(404).json({
      message: "Announcement not found.",
    });
  }

  if (
    data.expiresAt &&
    data.expiresAt <= new Date() &&
    (data.status || announcement.status) === "Published"
  ) {
    return res.status(400).json({
      message: "A published announcement must have a future expiry date.",
    });
  }

  const wasPublished = announcement.status === "Published";

  Object.assign(announcement, data);

  if (
    data.status === "Published" &&
    !wasPublished
  ) {
    announcement.publishedAt = new Date();
  }

  if (data.status === "Draft") {
    announcement.publishedAt = null;
  }

  announcement.updatedBy = req.user._id;

  await announcement.save();

  return res.json({
    message: "Announcement updated successfully.",
    announcement,
  });
});

// HR deactivates an announcement.
export const deactivateAnnouncement = wrap(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({
      message: "Invalid announcement ID.",
    });
  }

  const announcement = await Announcement.findById(id);

  if (!announcement) {
    return res.status(404).json({
      message: "Announcement not found.",
    });
  }

  announcement.status = "Inactive";
  announcement.updatedBy = req.user._id;

  await announcement.save();

  return res.json({
    message: "Announcement deactivated successfully.",
    announcement,
  });
});
