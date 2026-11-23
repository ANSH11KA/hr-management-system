
import mongoose from "mongoose";
import Employee from "../models/Employee.js";
import PerformanceReview from "../models/PerformanceReview.js";
import { wrap } from "./wrap.js";

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// Get today's date in India Standard Time
const getIndiaToday = () => {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
};

// Get the last calendar day of a given month
const getMonthEnd = (month) => {
  const [year, monthNumber] = month.split("-").map(Number);

  return new Date(Date.UTC(year, monthNumber, 0))
    .toISOString()
    .slice(0, 10);
};

// Get the last calendar day of the following month
const getSubmissionDeadline = (month) => {
  const [year, monthNumber] = month.split("-").map(Number);

  return new Date(Date.UTC(year, monthNumber + 1, 0))
    .toISOString()
    .slice(0, 10);
};

// Check whether HR monthly review submission is allowed
const isHRReviewWindowOpen = (month) => {
  const today = getIndiaToday();
  const availableFrom = getMonthEnd(month);
  const deadline = getSubmissionDeadline(month);

  return today >= availableFrom && today <= deadline;
};

// Validate performance review details
const validateReview = (body) => {
  const rating = Number(body.rating);
  const reasoning = String(body.reasoning || "").trim();

  if (!Number.isInteger(rating) || rating < 1 || rating > 10) {
    return {
      error: "Rating must be a whole number between 1 and 10.",
    };
  }

  if (reasoning.length < 10 || reasoning.length > 2000) {
    return {
      error: "Reasoning must contain between 10 and 2000 characters.",
    };
  }

  const optionalFields = [
    "strengths",
    "improvementAreas",
    "actionPlan",
  ];

  for (const field of optionalFields) {
    if (String(body[field] || "").trim().length > 1500) {
      return {
        error: `${field} cannot exceed 1500 characters.`,
      };
    }
  }

  return {
    rating,
    reasoning,
    strengths: String(body.strengths || "").trim(),
    improvementAreas: String(body.improvementAreas || "").trim(),
    actionPlan: String(body.actionPlan || "").trim(),
  };
};

// =====================================================
// MANAGER: GET ASSIGNED TEAM MEMBERS
// =====================================================

export const getManagerTeam = wrap(async (req, res) => {
  if (!req.employee) {
    return res.status(403).json({
      message: "Manager employee profile not found.",
    });
  }

  const employees = await Employee.find({
    manager: req.employee._id,
    employmentStatus: {
      $in: ["active", "probation"],
    },
  })
    .select(
      "employeeId personal.firstName personal.lastName department designation"
    )
    .sort({
      "personal.firstName": 1,
    })
    .lean();

  res.json({ employees });
});

// =====================================================
// MANAGER: SUBMIT OR UPDATE DAILY PERFORMANCE REVIEW
// =====================================================

export const submitManagerDailyReview = wrap(async (req, res) => {
  if (!req.employee) {
    return res.status(403).json({
      message: "Manager employee profile not found.",
    });
  }

  const { employeeId, date } = req.body;

  if (!isValidId(employeeId)) {
    return res.status(400).json({
      message: "Valid employee ID is required.",
    });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ""))) {
    return res.status(400).json({
      message: "Date must be in YYYY-MM-DD format.",
    });
  }

  const targetEmployee = await Employee.findOne({
    _id: employeeId,
    manager: req.employee._id,
    employmentStatus: {
      $in: ["active", "probation"],
    },
  });

  if (!targetEmployee) {
    return res.status(403).json({
      message: "You can only rate employees assigned to you.",
    });
  }

  const review = validateReview(req.body);

  if (review.error) {
    return res.status(400).json({
      message: review.error,
    });
  }

  const savedReview = await PerformanceReview.findOneAndUpdate(
    {
      employee: targetEmployee._id,
      reviewType: "ManagerDaily",
      periodKey: date,
    },
    {
      $set: {
        ...review,
        reviewer: req.user._id,
        reviewerEmployee: req.employee._id,
      },
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    }
  );

  res.status(200).json({
    message: "Daily performance review saved successfully.",
    review: savedReview,
  });
});

// =====================================================
// MANAGER: VIEW DAILY REVIEWS FOR ASSIGNED TEAM
// =====================================================

export const getManagerTeamReviews = wrap(async (req, res) => {
  if (!req.employee) {
    return res.status(403).json({
      message: "Manager employee profile not found.",
    });
  }

  const team = await Employee.find({
    manager: req.employee._id,
  }).select("_id");

  const teamIds = team.map((employee) => employee._id);

  const filter = {
    employee: {
      $in: teamIds,
    },
    reviewType: "ManagerDaily",
  };

  if (req.query.date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(req.query.date)) {
      return res.status(400).json({
        message: "Invalid date format.",
      });
    }

    filter.periodKey = req.query.date;
  }

  const reviews = await PerformanceReview.find(filter)
    .populate(
      "employee",
      "employeeId personal.firstName personal.lastName department designation"
    )
    .sort({
      periodKey: -1,
      createdAt: -1,
    })
    .lean();

  res.json({ reviews });
});

// =====================================================
// HR: GET ALL ACTIVE EMPLOYEES INCLUDING MANAGERS
// =====================================================

export const getHREmployees = wrap(async (req, res) => {
  const employees = await Employee.find({
    employmentStatus: {
      $in: ["active", "probation"],
    },
  })
    .select(
      "employeeId personal.firstName personal.lastName department designation"
    )
    .sort({
      department: 1,
      "personal.firstName": 1,
    })
    .lean();

  res.json({ employees });
});

// =====================================================
// HR: SUBMIT OR UPDATE MONTHLY PERFORMANCE REVIEW
// MONTH-END SUBMISSION WINDOW ENFORCED
// =====================================================

export const submitHRMonthlyReview = wrap(async (req, res) => {
  const { employeeId, month } = req.body;

  if (!isValidId(employeeId)) {
    return res.status(400).json({
      message: "Valid employee ID is required.",
    });
  }

  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(month || ""))) {
    return res.status(400).json({
      message: "Month must be in YYYY-MM format.",
    });
  }

  const availableFrom = getMonthEnd(month);
  const submissionDeadline = getSubmissionDeadline(month);
  const today = getIndiaToday();

  // Prevent early submission and late submission
  if (!isHRReviewWindowOpen(month)) {
    if (today < availableFrom) {
      return res.status(403).json({
        message: `HR monthly reviews for ${month} can only be submitted from ${availableFrom}.`,
        reviewMonth: month,
        availableFrom,
        submissionDeadline,
      });
    }

    return res.status(403).json({
      message: `The submission deadline for ${month} reviews was ${submissionDeadline}. You can no longer submit or update this review.`,
      reviewMonth: month,
      availableFrom,
      submissionDeadline,
    });
  }

  // Only active and probation employees can receive HR reviews
  // This includes managers as they are also employees
  const targetEmployee = await Employee.findOne({
    _id: employeeId,
    employmentStatus: {
      $in: ["active", "probation"],
    },
  });

  if (!targetEmployee) {
    return res.status(404).json({
      message: "Active employee not found.",
    });
  }

  const review = validateReview(req.body);

  if (review.error) {
    return res.status(400).json({
      message: review.error,
    });
  }

  const savedReview = await PerformanceReview.findOneAndUpdate(
    {
      employee: targetEmployee._id,
      reviewType: "HRMonthly",
      periodKey: month,
    },
    {
      $set: {
        ...review,
        reviewer: req.user._id,
        reviewerEmployee: null,
      },
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    }
  );

  res.status(200).json({
    message: "Monthly HR performance review saved successfully.",
    review: savedReview,
    reviewMonth: month,
    availableFrom,
    submissionDeadline,
  });
});

// =====================================================
// HR: VIEW MONTHLY REVIEWS
// =====================================================

export const getHRMonthlyReviews = wrap(async (req, res) => {
  const filter = {
    reviewType: "HRMonthly",
  };

  if (req.query.month) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(req.query.month)) {
      return res.status(400).json({
        message: "Invalid month format.",
      });
    }

    filter.periodKey = req.query.month;
  }

  if (req.query.employeeId) {
    if (!isValidId(req.query.employeeId)) {
      return res.status(400).json({
        message: "Invalid employee ID.",
      });
    }

    filter.employee = req.query.employeeId;
  }

  const reviews = await PerformanceReview.find(filter)
    .populate(
      "employee",
      "employeeId personal.firstName personal.lastName department designation"
    )
    .populate("reviewer", "name email")
    .sort({
      periodKey: -1,
      createdAt: -1,
    })
    .lean();

  res.json({ reviews });
});


// =====================================================
// HR: VIEW MANAGER'S DAILY REVIEWS FOR A MONTH
// =====================================================

export const getHRDailyReviews = wrap(async (req, res) => {
  const { month, employeeId } = req.query;

  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(month || ""))) {
    return res.status(400).json({
      message: "Month is required in YYYY-MM format.",
    });
  }

  const filter = {
    reviewType: "ManagerDaily",
    periodKey: {
      $gte: `${month}-01`,
      $lte: getMonthEnd(month),
    },
  };

  if (employeeId) {
    if (!isValidId(employeeId)) {
      return res.status(400).json({
        message: "Invalid employee ID.",
      });
    }

    filter.employee = employeeId;
  }

  const reviews = await PerformanceReview.find(filter)
    .populate(
      "employee",
      "employeeId personal.firstName personal.lastName department designation"
    )
    .populate("reviewer", "name email")
    .populate(
      "reviewerEmployee",
      "employeeId personal.firstName personal.lastName"
    )
    .sort({
      periodKey: -1,
      createdAt: -1,
    })
    .lean();

  res.json({
    month,
    totalReviews: reviews.length,
    reviews,
  });
});


// =====================================================
// EMPLOYEE: VIEW OWN DAILY AND MONTHLY PERFORMANCE
// =====================================================

export const getMyPerformance = wrap(async (req, res) => {
  if (!req.employee) {
    return res.status(403).json({
      message: "Employee profile not found.",
    });
  }

  const reviews = await PerformanceReview.find({
    employee: req.employee._id,
  })
    .populate("reviewer", "name email")
    .sort({
      periodKey: -1,
      createdAt: -1,
    })
    .lean();

  const dailyReviews = reviews.filter(
    (review) => review.reviewType === "ManagerDaily"
  );

  const monthlyReviews = reviews.filter(
    (review) => review.reviewType === "HRMonthly"
  );

  const averageDailyRating = dailyReviews.length
    ? Number(
        (
          dailyReviews.reduce(
            (sum, review) => sum + review.rating,
            0
          ) / dailyReviews.length
        ).toFixed(2)
      )
    : null;

  res.json({
    dailyReviews,
    monthlyReviews,
    averageDailyRating,
    totalDailyReviews: dailyReviews.length,
  });
});
