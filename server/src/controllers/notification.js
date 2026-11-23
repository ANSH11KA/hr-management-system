
import mongoose from "mongoose";

import Notification from "../models/Notification.js";
import { wrap } from "./wrap.js";

// =====================================
// GET HR NOTIFICATIONS
// GET /api/notifications
// =====================================

export const getNotifications = wrap(async (req, res) => {
  const limit = Math.min(
    Math.max(Number(req.query.limit) || 50, 1),
    100
  );

  const [notifications, unreadCount, totalCount] =
    await Promise.all([
      Notification.find({
        recipientRole: "admin",
      })
        .populate({
          path: "employee",
          select:
            "employeeId department designation personal.firstName personal.middleName personal.lastName",
        })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean(),

      Notification.countDocuments({
        recipientRole: "admin",
        isRead: false,
      }),

      Notification.countDocuments({
        recipientRole: "admin",
      }),
    ]);

  return res.json({
    notifications,
    unreadCount,
    totalCount,
  });
});

// =====================================
// MARK NOTIFICATION AS READ
// PATCH /api/notifications/:id/read
// =====================================

export const markNotificationRead = wrap(
  async (req, res) => {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        message: "Invalid notification ID.",
      });
    }

    const notification =
      await Notification.findOneAndUpdate(
        {
          _id: id,
          recipientRole: "admin",
        },
        {
          $set: {
            isRead: true,
            readAt: new Date(),
          },
        },
        {
          new: true,
        }
      ).lean();

    if (!notification) {
      return res.status(404).json({
        message: "Notification not found.",
      });
    }

    return res.json({
      message: "Notification marked as read.",
      notification,
    });
  }
);
