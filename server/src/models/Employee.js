
import mongoose from "mongoose";

// Address details
const addressSchema = new mongoose.Schema(
  {
    addressLine: {
      type: String,
      trim: true,
      maxlength: 300,
      default: "",
    },
    city: { type: String, trim: true, default: "" },
    state: { type: String, trim: true, default: "" },
    country: { type: String, trim: true, default: "India" },
    pincode: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

// Educational qualifications
const educationSchema = new mongoose.Schema(
  {
    qualification: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    institution: { type: String, trim: true, default: "" },
    boardOrUniversity: { type: String, trim: true, default: "" },
    specialization: { type: String, trim: true, default: "" },
    passingYear: {
      type: Number,
      min: 1950,
      max: 2100,
    },
    marks: { type: String, trim: true, default: "" },
  },
  { _id: true }
);

// Employee documents
const documentSchema = new mongoose.Schema(
  {
    documentType: {
      type: String,
      enum: [
        "Resume",
        "10th Certificate",
        "12th Certificate",
        "Diploma Certificate",
        "Degree Certificate",
        "Offer Letter",
        "Joining Letter",
        "Employment Agreement",
        "Other",
      ],
      default: "Other",
    },
    originalName: { type: String, required: true },
    filename: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

// Main employee schema
const employeeSchema = new mongoose.Schema(
  {
    // Basic employee information
    employeeId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    // Profile picture metadata
    profilePicture: {
      filename: { type: String, default: "" },
      originalName: { type: String, default: "" },
      mimeType: { type: String, default: "" },
    },

    // Personal information
    personal: {
      firstName: { type: String, trim: true, default: "" },
      middleName: { type: String, trim: true, default: "" },
      lastName: { type: String, trim: true, default: "" },
      dateOfBirth: { type: Date, default: null },
      gender: { type: String, default: "" },
      nationality: { type: String, default: "Indian" },
      bloodGroup: { type: String, default: "" },
      maritalStatus: { type: String, default: "" },

      // Encrypted identity information
      panNumber: {
        type: String,
        select: false,
        default: "",
      },
      aadhaarNumber: {
        type: String,
        select: false,
        default: "",
      },
      voterIdNumber: {
        type: String,
        select: false,
        default: "",
      },
      passportNumber: {
        type: String,
        select: false,
        default: "",
      },
    },

    // Contact information
    contact: {
      personalEmail: {
        type: String,
        lowercase: true,
        trim: true,
        default: "",
      },
      alternatePhone: { type: String, default: "" },
      currentAddress: {
        type: addressSchema,
        default: () => ({}),
      },
      permanentAddress: {
        type: addressSchema,
        default: () => ({}),
      },
    },

    phone: {
      type: String,
      match: /^[0-9+\-\s]{7,15}$/,
    },

    // Employment information
    department: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },

    designation: {
      type: String,
      trim: true,
      default: "",
    },

    joiningDate: {
      type: Date,
      required: true,
    },

    manager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },

    employmentStatus: {
      type: String,
      enum: ["active", "probation", "terminated", "inactive"],
      default: "active",
    },

    employmentType: {
      type: String,
      enum: [
        "Full-time",
        "Part-time",
        "Contract",
        "Intern",
        "Temporary",
      ],
      default: "Full-time",
    },

    workLocation: { type: String, default: "" },

    probationMonths: {
      type: Number,
      min: 0,
      max: 24,
      default: 0,
    },

    // Salary hidden by default
    salary: {
      type: Number,
      min: 0,
      default: null,
      select: false,
    },

    // Education
    education: {
      type: [educationSchema],
      default: [],
    },

    // Bank information
    bank: {
      accountHolderName: {
        type: String,
        trim: true,
        default: "",
      },
      bankName: {
        type: String,
        trim: true,
        default: "",
      },
      branchName: {
        type: String,
        trim: true,
        default: "",
      },
      branchAddress: {
        type: String,
        trim: true,
        default: "",
      },

      // Encrypted bank account number
      accountNumber: {
        type: String,
        select: false,
        default: "",
      },

      ifscCode: {
        type: String,
        trim: true,
        uppercase: true,
        default: "",
      },

      accountType: { type: String, default: "" },
    },

    // Social media profiles
    socialMedia: {
      facebook: { type: String, default: "" },
      linkedin: { type: String, default: "" },
      instagram: { type: String, default: "" },
      youtube: { type: String, default: "" },
    },

    // Emergency contact
    emergencyContact: {
      name: { type: String, default: "" },
      relationship: { type: String, default: "" },
      phone: { type: String, default: "" },
      alternatePhone: { type: String, default: "" },
    },

    // Previous employment
    previousEmployment: {
      companyName: { type: String, default: "" },
      designation: { type: String, default: "" },
      experienceYears: {
        type: Number,
        min: 0,
        default: 0,
      },
    },

    // Uploaded documents
    documents: {
      type: [documentSchema],
      default: [],
    },
  },
  { timestamps: true }
);

// Indexes
employeeSchema.index({
  department: 1,
  employmentStatus: 1,
});

employeeSchema.index({
  "personal.firstName": 1,
  "personal.lastName": 1,
});

export default mongoose.model("Employee", employeeSchema);
