
import Employee from "../models/Employee.js";
import Attendance from "../models/Attendance.js";
import LeaveRequest from "../models/LeaveRequest.js";
import DailyReport from "../models/DailyReport.js";

import { wrap } from "./wrap.js";
import { todayStr } from "../utils/time.js";

// ==========================================
// CONSTANTS
// ==========================================

const ACTIVE = ["active", "probation"];

const PRESENT_ATTENDANCE_STATUSES = [
  "Present",
  "Half Day",
  "Late",
];

const SUBMITTED_REPORT_STATUSES = [
  "Submitted",
  "Under Review",
  "Approved",
  "Revision Required",
];

const REVIEWABLE_REPORT_STATUSES = [
  "Submitted",
  "Under Review",
  "Revision Required",
];

// ==========================================
// SAFE EMPLOYEE POPULATION
// ==========================================

const withName = {
  path: "employee",
  select:
    "employeeId department designation personal.firstName personal.middleName personal.lastName user",
  populate: {
    path: "user",
    select: "name email",
  },
};

// ==========================================
// INDIA-LOCAL DATE RANGE
// ==========================================

const getTodayRange = date => {
  const start = new Date(`${date}T00:00:00+05:30`);

  const nextDay = new Date(
    start.getTime() + 24 * 60 * 60 * 1000
  );

  return {
    start,
    nextDay,
  };
};

// ==========================================
// MANAGER HIERARCHY
// ==========================================

const getSubordinateIds = async managerId => {
  const allIds = [];

  const visited = new Set([
    String(managerId),
  ]);

  let currentLevel = [managerId];

  while (currentLevel.length > 0) {
    const employees = await Employee.find({
      manager: {
        $in: currentLevel,
      },
    }).select("_id");

    const nextLevel = [];

    for (const employee of employees) {
      const id = String(employee._id);

      if (!visited.has(id)) {
        visited.add(id);
        allIds.push(employee._id);
        nextLevel.push(employee._id);
      }
    }

    currentLevel = nextLevel;
  }

  return allIds;
};

// ==========================================
// ATTENDANCE PRESENT EMPLOYEE IDS
// ==========================================

const getPresentEmployeeIds = async (employeeIds, date) => {
  if (!employeeIds.length) {
    return [];
  }

  return Attendance.find({
    date,

    employee: {
      $in: employeeIds,
    },

    status: {
      $in: PRESENT_ATTENDANCE_STATUSES,
    },

    checkInAt: {
      $ne: null,
    },
  }).distinct("employee");
};

// ==========================================
// APPROVED LEAVE EMPLOYEE IDS
// ==========================================

const getOnLeaveEmployeeIds = async (
  employeeIds,
  start,
  nextDay
) => {
  if (!employeeIds.length) {
    return [];
  }

  return LeaveRequest.find({
    status: "Approved",

    employee: {
      $in: employeeIds,
    },

    startDate: {
      $lt: nextDay,
    },

    endDate: {
      $gte: start,
    },
  }).distinct("employee");
};

// ==========================================
// SUBMITTED DAR EMPLOYEE IDS
// ==========================================

const getSubmittedDarEmployeeIds = async (
  employeeIds,
  date
) => {
  if (!employeeIds.length) {
    return [];
  }

  return DailyReport.find({
    reportDate: date,

    employee: {
      $in: employeeIds,
    },

    overallStatus: {
      $in: SUBMITTED_REPORT_STATUSES,
    },
  }).distinct("employee");
};

// ==========================================
// REMOVE EMPLOYEES WHO ARE ALSO PRESENT
// ==========================================

const countEmployeesOnLeave = (
  leaveIds,
  presentIds
) => {
  const presentSet = new Set(
    presentIds.map(id => String(id))
  );

  return leaveIds.filter(
    id => !presentSet.has(String(id))
  ).length;
};

// ==========================================
// DASHBOARD
// ==========================================

export const dashboard = wrap(async (req, res) => {
  const date = todayStr();

  const { start, nextDay } = getTodayRange(date);

  const now = new Date();

  // ==========================================
  // ADMIN / HR DASHBOARD
  // ==========================================

  if (req.user.role === "admin") {
    const activeIds = await Employee.find({
      employmentStatus: {
        $in: ACTIVE,
      },
    }).distinct("_id");

    const [
      presentIds,
      leaveIds,
      pendingLeaves,
      darEmployeeIds,
      recentLeaves,
      recentReports,
    ] = await Promise.all([

      // Employees with valid present attendance.
      getPresentEmployeeIds(activeIds, date),

      // Employees on approved leave today.
      getOnLeaveEmployeeIds(
        activeIds,
        start,
        nextDay
      ),

      // Pending leave requests.
      LeaveRequest.countDocuments({
        status: "Pending",
      }),

      // Distinct employees who submitted DAR today.
      getSubmittedDarEmployeeIds(activeIds, date),

      // Latest leave requests.
      LeaveRequest.find()
        .populate(withName)
        .sort({
          createdAt: -1,
        })
        .limit(5),

      // Latest submitted DARs.
      DailyReport.find({
        overallStatus: {
          $in: SUBMITTED_REPORT_STATUSES,
        },

        submittedAt: {
          $ne: null,
        },
      })
        .populate(withName)
        .sort({
          submittedAt: -1,
        })
        .limit(5),
    ]);

    const active = activeIds.length;
    const present = presentIds.length;
    const darsToday = darEmployeeIds.length;

    const onLeave = countEmployeesOnLeave(
      leaveIds,
      presentIds
    );

    const absent = Math.max(
      active - present - onLeave,
      0
    );

    return res.json({
      role: "admin",

      activeEmployees: active,

      presentToday: present,

      onLeaveToday: onLeave,

      absentToday: absent,

      pendingLeaves,

      darsToday,

      darsMissing: Math.max(
        active - darsToday,
        0
      ),

      recentLeaves,

      recentReports,
    });
  }

  // ==========================================
  // MANAGER DASHBOARD
  // ==========================================

  if (req.user.role === "manager") {
    if (!req.employee) {
      return res.status(404).json({
        message: "Manager employee profile not found.",
      });
    }

    const subordinateIds = await getSubordinateIds(
      req.employee._id
    );

    // No employees reporting to this manager.
    if (subordinateIds.length === 0) {
      return res.json({
        role: "manager",

        teamSize: 0,

        presentToday: 0,

        onLeaveToday: 0,

        absentToday: 0,

        darsSubmittedToday: 0,

        darsMissingToday: 0,

        pendingReviews: 0,

        overdueReviews: 0,

        openBlockers: 0,

        recentReports: [],

        recentLeaves: [],
      });
    }

    // Only active employees are used for team statistics.
    const activeIds = await Employee.find({
      _id: {
        $in: subordinateIds,
      },

      employmentStatus: {
        $in: ACTIVE,
      },
    }).distinct("_id");

    const [
      presentIds,
      leaveIds,
      darEmployeeIds,
      recentReports,
      recentLeaves,
      reviewStats,
      blockerStats,
    ] = await Promise.all([

      // Present team members.
      getPresentEmployeeIds(activeIds, date),

      // Team members on approved leave today.
      getOnLeaveEmployeeIds(
        activeIds,
        start,
        nextDay
      ),

      // Distinct team members who submitted DAR today.
      getSubmittedDarEmployeeIds(activeIds, date),

      // Latest submitted team DARs.
      DailyReport.find({
        employee: {
          $in: subordinateIds,
        },

        overallStatus: {
          $in: SUBMITTED_REPORT_STATUSES,
        },

        submittedAt: {
          $ne: null,
        },
      })
        .populate(withName)
        .populate("tasks.task", "title")
        .sort({
          submittedAt: -1,
        })
        .limit(5),

      // Latest team leave requests.
      LeaveRequest.find({
        employee: {
          $in: subordinateIds,
        },
      })
        .populate(withName)
        .sort({
          createdAt: -1,
        })
        .limit(5),

      // Pending and overdue task reviews.
      DailyReport.aggregate([
        {
          $match: {
            employee: {
              $in: activeIds,
            },

            overallStatus: {
              $in: REVIEWABLE_REPORT_STATUSES,
            },
          },
        },

        {
          $unwind: "$tasks",
        },

        {
          $match: {
            "tasks.review.status": "Pending",
          },
        },

        {
          $group: {
            _id: null,

            pendingReviews: {
              $sum: 1,
            },

            overdueReviews: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      {
                        $ne: [
                          "$tasks.review.deadline",
                          null,
                        ],
                      },

                      {
                        $lt: [
                          "$tasks.review.deadline",
                          now,
                        ],
                      },
                    ],
                  },

                  1,
                  0,
                ],
              },
            },
          },
        },
      ]),

      // Open blockers from submitted DARs.
      DailyReport.aggregate([
        {
          $match: {
            employee: {
              $in: activeIds,
            },

            overallStatus: {
              $in: SUBMITTED_REPORT_STATUSES,
            },
          },
        },

        {
          $unwind: "$tasks",
        },

        {
          $unwind: "$tasks.blockers",
        },

        {
          $match: {
            "tasks.blockers.status": {
              $in: [
                "Open",
                "In Progress",
              ],
            },
          },
        },

        {
          $count: "openBlockers",
        },
      ]),
    ]);

    const active = activeIds.length;
    const present = presentIds.length;
    const darsToday = darEmployeeIds.length;

    const onLeave = countEmployeesOnLeave(
      leaveIds,
      presentIds
    );

    const absent = Math.max(
      active - present - onLeave,
      0
    );

    const reviewData = reviewStats[0] || {};
    const blockerData = blockerStats[0] || {};

    return res.json({
      role: "manager",

      teamSize: active,

      presentToday: present,

      onLeaveToday: onLeave,

      absentToday: absent,

      darsSubmittedToday: darsToday,

      darsMissingToday: Math.max(
        active - darsToday,
        0
      ),

      pendingReviews:
        reviewData.pendingReviews || 0,

      overdueReviews:
        reviewData.overdueReviews || 0,

      openBlockers:
        blockerData.openBlockers || 0,

      recentReports,

      recentLeaves,
    });
  }

  // ==========================================
  // EMPLOYEE DASHBOARD
  // ==========================================

  if (req.user.role !== "employee") {
    return res.status(403).json({
      message: "Dashboard access denied.",
    });
  }

  if (!req.employee) {
    return res.status(404).json({
      message: "No employee record found for this account.",
    });
  }

  const employeeId = req.employee._id;

  const [
    attendance,
    latestDar,
    latestLeave,
    recentLeaves,
    recentReports,
    submittedDarRecord,
  ] = await Promise.all([

    // Today's attendance.
    Attendance.findOne({
      employee: employeeId,
      date,
    }),

    // Latest DAR, including a draft if one exists.
    DailyReport.findOne({
      employee: employeeId,
    })
      .populate("tasks.task", "title")
      .sort({
        reportDate: -1,
        updatedAt: -1,
      }),

    // Latest leave request.
    LeaveRequest.findOne({
      employee: employeeId,
    })
      .populate("reviewedBy", "name")
      .sort({
        createdAt: -1,
      }),

    // Recent leave requests.
    LeaveRequest.find({
      employee: employeeId,
    })
      .sort({
        createdAt: -1,
      })
      .limit(5),

    // Recent DAR history.
    DailyReport.find({
      employee: employeeId,
    })
      .populate("tasks.task", "title")
      .sort({
        reportDate: -1,
        updatedAt: -1,
      })
      .limit(5),

    // Check whether any DAR was submitted today.
    DailyReport.exists({
      employee: employeeId,
      reportDate: date,
      overallStatus: {
        $in: SUBMITTED_REPORT_STATUSES,
      },
    }),
  ]);

  const submittedDarToday = Boolean(
    submittedDarRecord
  );

  return res.json({
    role: "employee",

    today: date,

    attendance,

    latestDar,

    submittedDarToday,

    latestLeave,

    recentLeaves,

    recentReports,
  });
});
