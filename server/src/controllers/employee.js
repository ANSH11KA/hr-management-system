
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import User from "../models/User.js";
import Employee from "../models/Employee.js";
import { wrap } from "./wrap.js";

// --------------------------------------------------
// CONSTANTS AND PRIVATE UPLOAD DIRECTORY
// --------------------------------------------------

const ACTIVE_STATUSES = ["active", "probation"];

const EMPLOYMENT_STATUSES = [
  "active",
  "probation",
  "terminated",
  "inactive",
];

const USER_ROLES = ["admin", "manager", "employee"];

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const PRIVATE_UPLOAD_DIR = path.resolve(
  __dirname,
  "../../private_uploads"
);

fs.mkdirSync(PRIVATE_UPLOAD_DIR, { recursive: true });

// --------------------------------------------------
// COMMON HELPERS
// --------------------------------------------------

const isStr = value => typeof value === "string";

const hasOwn = (object, key) =>
  Object.prototype.hasOwnProperty.call(object, key);

const cleanText = value =>
  typeof value === "string" ? value.trim() : "";

const parseObject = value => {
  if (!value) return {};

  if (
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value;
  }

  try {
    const parsed = JSON.parse(value);

    return parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
};

const parseArray = value => {
  if (Array.isArray(value)) return value;

  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const getUploadedFile = (files, fieldName) =>
  files?.[fieldName]?.[0] || null;

const getUploadedDocuments = files =>
  files?.documents || [];

const cleanupUploadedFiles = async files => {
  const uploaded = Object.values(files || {}).flat();

  await Promise.all(
    uploaded.map(async file => {
      if (!file?.path) return;

      try {
        await fs.promises.unlink(file.path);
      } catch (error) {
        if (error.code !== "ENOENT") {
          console.error(
            "Could not remove uploaded file:",
            error.message
          );
        }
      }
    })
  );
};

const removePrivateFile = async filename => {
  if (!filename) return;

  const safeFilename = path.basename(filename);

  const filePath = path.resolve(
    PRIVATE_UPLOAD_DIR,
    safeFilename
  );

  if (!filePath.startsWith(PRIVATE_UPLOAD_DIR + path.sep)) {
    return;
  }

  try {
    await fs.promises.unlink(filePath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error(
        "Could not remove private file:",
        error.message
      );
    }
  }
};

const uploadedFileMetadata = file => ({
  filename: file.filename,
  originalName: file.originalname,
  mimeType: file.mimetype,
});

const uploadedDocumentMetadata = (file, documentType) => ({
  documentType: cleanText(documentType) || "Other",
  originalName: file.originalname,
  filename: file.filename,
  mimeType: file.mimetype,
  size: file.size,
});

const rejectWithCleanup = async (
  req,
  res,
  status,
  message
) => {
  await cleanupUploadedFiles(req.files);

  return res.status(status).json({ message });
};

// --------------------------------------------------
// ENCRYPTION / DECRYPTION
// --------------------------------------------------

const getEncryptionKey = () => {
  const key = process.env.EMPLOYEE_DATA_KEY;

  if (!key) {
    throw new Error(
      "EMPLOYEE_DATA_KEY is not configured."
    );
  }

  const buffer = Buffer.from(key, "base64");

  if (buffer.length !== 32) {
    throw new Error(
      "EMPLOYEE_DATA_KEY must be a base64 encoded 32-byte key."
    );
  }

  return buffer;
};

const encrypt = value => {
  if (!value) return "";

  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    iv
  );

  const encrypted = Buffer.concat([
    cipher.update(String(value), "utf8"),
    cipher.final(),
  ]);

  const tag = cipher.getAuthTag();

  return [
    iv.toString("hex"),
    tag.toString("hex"),
    encrypted.toString("hex"),
  ].join(":");
};

const decrypt = value => {
  if (!value) return "";

  try {
    const parts = String(value).split(":");

    if (parts.length !== 3) return "";

    const [ivHex, tagHex, encryptedHex] = parts;

    if (!ivHex || !tagHex || !encryptedHex) {
      return "";
    }

    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      getEncryptionKey(),
      Buffer.from(ivHex, "hex")
    );

    decipher.setAuthTag(
      Buffer.from(tagHex, "hex")
    );

    return Buffer.concat([
      decipher.update(
        Buffer.from(encryptedHex, "hex")
      ),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    console.error(
      "Could not decrypt an employee field."
    );

    return "";
  }
};

// --------------------------------------------------
// NORMALIZATION
// --------------------------------------------------

const normalizePersonal = personal => ({
  ...personal,
  firstName: cleanText(personal.firstName),
  middleName: cleanText(personal.middleName),
  lastName: cleanText(personal.lastName),
  panNumber: cleanText(personal.panNumber).toUpperCase(),
  aadhaarNumber: cleanText(personal.aadhaarNumber)
    .replace(/\s/g, ""),
  voterIdNumber: cleanText(personal.voterIdNumber)
    .toUpperCase(),
  passportNumber: cleanText(personal.passportNumber)
    .toUpperCase(),
});

const normalizeBank = bank => ({
  ...bank,
  accountHolderName: cleanText(bank.accountHolderName),
  bankName: cleanText(bank.bankName),
  branchName: cleanText(bank.branchName),
  branchAddress: cleanText(bank.branchAddress),
  ifscCode: cleanText(bank.ifscCode).toUpperCase(),
  accountNumber: cleanText(bank.accountNumber)
    .replace(/\s/g, ""),
});

const normalizePersonalPatch = personal => {
  const result = { ...personal };

  const fields = [
    "firstName",
    "middleName",
    "lastName",
  ];

  for (const key of fields) {
    if (hasOwn(personal, key)) {
      result[key] = cleanText(personal[key]);
    }
  }

  if (hasOwn(personal, "panNumber")) {
    result.panNumber = cleanText(
      personal.panNumber
    ).toUpperCase();
  }

  if (hasOwn(personal, "aadhaarNumber")) {
    result.aadhaarNumber = cleanText(
      personal.aadhaarNumber
    ).replace(/\s/g, "");
  }

  if (hasOwn(personal, "voterIdNumber")) {
    result.voterIdNumber = cleanText(
      personal.voterIdNumber
    ).toUpperCase();
  }

  if (hasOwn(personal, "passportNumber")) {
    result.passportNumber = cleanText(
      personal.passportNumber
    ).toUpperCase();
  }

  return result;
};

const normalizeBankPatch = bank => {
  const result = { ...bank };

  for (const key of [
    "accountHolderName",
    "bankName",
    "branchName",
    "branchAddress",
  ]) {
    if (hasOwn(bank, key)) {
      result[key] = cleanText(bank[key]);
    }
  }

  if (hasOwn(bank, "ifscCode")) {
    result.ifscCode = cleanText(
      bank.ifscCode
    ).toUpperCase();
  }

  if (hasOwn(bank, "accountNumber")) {
    result.accountNumber = cleanText(
      bank.accountNumber
    ).replace(/\s/g, "");
  }

  return result;
};

const prepareSensitiveFields = (personal, bank) => ({
  personal: {
    ...personal,
    panNumber: encrypt(personal.panNumber),
    aadhaarNumber: encrypt(personal.aadhaarNumber),
    voterIdNumber: encrypt(personal.voterIdNumber),
    passportNumber: encrypt(personal.passportNumber),
  },

  bank: {
    ...bank,
    accountNumber: encrypt(bank.accountNumber),
  },
});

const decryptPrivateFields = employee => {
  const result = employee.toObject();

  result.personal = {
    ...result.personal,
    panNumber: decrypt(result.personal?.panNumber),
    aadhaarNumber: decrypt(
      result.personal?.aadhaarNumber
    ),
    voterIdNumber: decrypt(
      result.personal?.voterIdNumber
    ),
    passportNumber: decrypt(
      result.personal?.passportNumber
    ),
  };

  result.bank = {
    ...result.bank,
    accountNumber: decrypt(
      result.bank?.accountNumber
    ),
  };

  return result;
};

const decryptEmployeeSubdocuments = employee => {
  const result = employee.toObject();

  result.personal = {
    ...result.personal,
    panNumber: "",
    aadhaarNumber: "",
    voterIdNumber: "",
    passportNumber: "",
  };

  result.bank = {
    ...result.bank,
    accountNumber: "",
  };

  delete result.salary;

  return result;
};

const makeEmployeeName = personal =>
  [
    cleanText(personal.firstName),
    cleanText(personal.middleName),
    cleanText(personal.lastName),
  ]
    .filter(Boolean)
    .join(" ");

// --------------------------------------------------
// VALIDATION
// --------------------------------------------------

const validateProfile = (personal, bank, education) => {
  if (
    !cleanText(personal.firstName) ||
    !cleanText(personal.lastName)
  ) {
    return "First name and last name are required.";
  }

  if (
    personal.panNumber &&
    !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(
      personal.panNumber
    )
  ) {
    return "Invalid PAN number.";
  }

  if (
    personal.aadhaarNumber &&
    !/^[0-9]{12}$/.test(
      personal.aadhaarNumber
    )
  ) {
    return "Aadhaar number must contain 12 digits.";
  }

  if (
    bank.ifscCode &&
    !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(
      bank.ifscCode
    )
  ) {
    return "Invalid IFSC code.";
  }

  if (!Array.isArray(education)) {
    return "Education must be an array.";
  }

  if (education.length > 20) {
    return "You can add a maximum of 20 qualifications.";
  }

  for (const item of education) {
    if (
      !item ||
      !cleanText(item.qualification)
    ) {
      return "Every education entry needs a qualification.";
    }
  }

  return null;
};

const validatePhone = phone =>
  !phone ||
  (
    isStr(phone) &&
    /^[0-9+\-\s]{7,15}$/.test(phone)
  );

const validateJoiningDate = value =>
  Boolean(
    value &&
    !Number.isNaN(new Date(value).getTime())
  );

// --------------------------------------------------
// MANAGER HIERARCHY
// --------------------------------------------------

const validateManager = async (
  employeeId,
  managerId
) => {
  if (!managerId) return null;

  if (!mongoose.isValidObjectId(managerId)) {
    return "Invalid manager ID.";
  }

  if (
    employeeId &&
    String(employeeId) === String(managerId)
  ) {
    return "An employee cannot be their own manager.";
  }

  const managerEmployee = await Employee.findById(
    managerId
  ).populate("user", "role isActive");

  if (
    !managerEmployee ||
    managerEmployee.user?.role !== "manager" ||
    !managerEmployee.user?.isActive
  ) {
    return "The selected employee is not an active manager.";
  }

  let current = managerEmployee;
  const visited = new Set();

  while (current?.manager) {
    const parentId = String(current.manager);

    if (
      employeeId &&
      parentId === String(employeeId)
    ) {
      return "This manager assignment would create a reporting cycle.";
    }

    if (visited.has(parentId)) {
      return "An existing reporting cycle was detected.";
    }

    visited.add(parentId);

    current = await Employee.findById(
      parentId
    ).select("_id manager");
  }

  return null;
};

const belongsToManager = async (
  targetEmployee,
  managerId
) => {
  let current = targetEmployee;
  const visited = new Set();

  while (current?.manager) {
    const parentId = String(current.manager);

    if (parentId === String(managerId)) {
      return true;
    }

    if (visited.has(parentId)) {
      return false;
    }

    visited.add(parentId);

    current = await Employee.findById(
      parentId
    ).select("_id manager");
  }

  return false;
};

const getManagerHierarchy = async managerId => {
  const allEmployees = await Employee.find({
    manager: { $ne: null },
  }).select("_id manager");

  const allowed = new Set();
  let parents = [String(managerId)];

  while (parents.length) {
    const next = [];

    for (const employee of allEmployees) {
      const parentId = String(employee.manager);
      const employeeId = String(employee._id);

      if (
        parents.includes(parentId) &&
        !allowed.has(employeeId)
      ) {
        allowed.add(employeeId);
        next.push(employeeId);
      }
    }

    parents = next;
  }

  return [...allowed].map(
    id => new mongoose.Types.ObjectId(id)
  );
};

// --------------------------------------------------
// POPULATION
// Supports both Mongoose queries and documents.
// --------------------------------------------------

const safeEmployeePopulate = async value => {
  const populateOptions = [
    {
      path: "user",
      select: "name email role",
    },
    {
      path: "manager",
      select: "employeeId",
    },
  ];

  if (value instanceof mongoose.Query) {
    return await value.populate(populateOptions);
  }

  await value.populate(populateOptions);

  return value;
};

// --------------------------------------------------
// CREATE EMPLOYEE / MANAGER
// --------------------------------------------------

export const createEmployee = wrap(async (req, res) => {
  const body = req.body || {};

  const personal = normalizePersonal(
    parseObject(body.personal)
  );

  const contact = parseObject(body.contact);
  const bank = normalizeBank(
    parseObject(body.bank)
  );

  const socialMedia = parseObject(
    body.socialMedia
  );

  const emergencyContact = parseObject(
    body.emergencyContact
  );

  const previousEmployment = parseObject(
    body.previousEmployment
  );

  const education = parseArray(body.education);

  const {
    email,
    password,
    role,
    employeeId,
    phone,
    department,
    designation,
    joiningDate,
    manager,
    employmentType,
    workLocation,
    probationMonths,
    salary,
  } = body;

  if (
    !isStr(email) ||
    !email.trim() ||
    !isStr(password) ||
    password.length < 8 ||
    !isStr(employeeId) ||
    !employeeId.trim() ||
    !isStr(department) ||
    !department.trim() ||
    !joiningDate
  ) {
    return rejectWithCleanup(
      req,
      res,
      400,
      "Name, email, password, employee ID, department and joining date are required."
    );
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return rejectWithCleanup(
      req,
      res,
      400,
      "Invalid email address."
    );
  }

  const name = makeEmployeeName(personal);

  if (!name) {
    return rejectWithCleanup(
      req,
      res,
      400,
      "Employee first name and last name are required."
    );
  }

  const profileError = validateProfile(
    personal,
    bank,
    education
  );

  if (profileError) {
    return rejectWithCleanup(
      req,
      res,
      400,
      profileError
    );
  }

  if (!validateJoiningDate(joiningDate)) {
    return rejectWithCleanup(
      req,
      res,
      400,
      "Invalid joining date."
    );
  }

  if (!validatePhone(phone)) {
    return rejectWithCleanup(
      req,
      res,
      400,
      "Invalid phone number."
    );
  }

  if (
    salary !== "" &&
    salary != null &&
    (
      !Number.isFinite(Number(salary)) ||
      Number(salary) < 0
    )
  ) {
    return rejectWithCleanup(
      req,
      res,
      400,
      "Invalid salary."
    );
  }

  if (probationMonths !== "" &&
      probationMonths != null &&
      (
        !Number.isInteger(Number(probationMonths)) ||
        Number(probationMonths) < 0
      )
  ) {
    return rejectWithCleanup(
      req,
      res,
      400,
      "Invalid probation duration."
    );
  }

  if (manager) {
    const managerError = await validateManager(
      null,
      manager
    );

    if (managerError) {
      return rejectWithCleanup(
        req,
        res,
        400,
        managerError
      );
    }
  }

  const accountRole =
    USER_ROLES.includes(role) && role !== "admin"
      ? role
      : "employee";

  const encrypted = prepareSensitiveFields(
    personal,
    bank
  );

  const profileFile = getUploadedFile(
    req.files,
    "profilePicture"
  );

  const documentFiles = getUploadedDocuments(
    req.files
  );

  const documentTypes = parseArray(
    body.documentTypes
  );

  let user;
  let employee;

  try {
    user = await User.create({
      name,
      email: email.trim().toLowerCase(),
      role: accountRole,
      passwordHash: await bcrypt.hash(
        password,
        10
      ),
    });

    employee = await Employee.create({
      employeeId: employeeId.trim(),
      user: user._id,

      phone: cleanText(phone) || undefined,
      department: department.trim(),
      designation: cleanText(designation),
      joiningDate: new Date(joiningDate),
      manager: manager || null,

      personal: encrypted.personal,
      contact,
      bank: encrypted.bank,
      socialMedia,
      education,
      emergencyContact,
      previousEmployment,

      employmentType:
        employmentType || "Full-time",

      workLocation: cleanText(workLocation),

      probationMonths:
        Number(probationMonths) || 0,

      salary:
        salary === "" || salary == null
          ? null
          : Number(salary),

      profilePicture: profileFile
        ? uploadedFileMetadata(profileFile)
        : undefined,

      documents: documentFiles.map(
        (file, index) =>
          uploadedDocumentMetadata(
            file,
            documentTypes[index]
          )
      ),
    });

    await safeEmployeePopulate(employee);

    return res.status(201).json({
      message: "Employee created successfully.",
      employee: decryptPrivateFields(employee),
    });
  } catch (error) {
    if (employee?._id) {
      await Employee.findByIdAndDelete(
        employee._id
      );
    }

    if (user?._id) {
      await User.findByIdAndDelete(user._id);
    }

    await cleanupUploadedFiles(req.files);

    throw error;
  }
});

// --------------------------------------------------
// LIST EMPLOYEES
// --------------------------------------------------

export const listEmployees = wrap(async (req, res) => {
  const { search, department, status } = req.query;

  const page = Math.max(
    parseInt(req.query.page, 10) || 1,
    1
  );

  const limit = Math.min(
    Math.max(
      parseInt(req.query.limit, 10) || 10,
      1
    ),
    50
  );

  const filter = {};

  if (department) {
    filter.department = department;
  }

  if (status) {
    if (!EMPLOYMENT_STATUSES.includes(status)) {
      return res.status(400).json({
        message: "Invalid employment status.",
      });
    }

    filter.employmentStatus = status;
  }

  if (search) {
    const escaped = String(search).replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );

    const regex = new RegExp(escaped, "i");

    const users = await User.find({
      $or: [
        { name: regex },
        { email: regex },
      ],
    }).select("_id");

    filter.$or = [
      { employeeId: regex },
      {
        user: {
          $in: users.map(user => user._id),
        },
      },
    ];
  }

  if (req.user.role === "manager") {
    if (!req.employee) {
      return res.status(403).json({
        message: "Manager profile not found.",
      });
    }

    filter._id = {
      $in: await getManagerHierarchy(
        req.employee._id
      ),
    };
  }

  let employeeQuery = Employee.find(filter).select(
    "-personal.panNumber " +
    "-personal.aadhaarNumber " +
    "-personal.voterIdNumber " +
    "-personal.passportNumber " +
    "-bank.accountNumber"
  );

  if (req.user.role === "admin") {
    employeeQuery = employeeQuery.select(
      "+salary"
    );
  } else {
    employeeQuery = employeeQuery.select(
      "-salary"
    );
  }

  const [items, total] = await Promise.all([
    employeeQuery
      .populate("user", "name email role isActive")
      .populate("manager", "employeeId")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),

    Employee.countDocuments(filter),
  ]);

  return res.json({
    items,
    total,
    page,
    pages: Math.ceil(total / limit),
  });
});

// --------------------------------------------------
// GET SINGLE EMPLOYEE
// --------------------------------------------------

export const getEmployee = wrap(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({
      message: "Invalid employee ID.",
    });
  }

  let query = Employee.findById(req.params.id);

  if (req.user.role === "admin") {
    query = query.select(
      "+personal.panNumber " +
      "+personal.aadhaarNumber " +
      "+personal.voterIdNumber " +
      "+personal.passportNumber " +
      "+bank.accountNumber " +
      "+salary"
    );
  }

  const employee = await safeEmployeePopulate(query);

  if (!employee) {
    return res.status(404).json({
      message: "Employee not found.",
    });
  }

  if (req.user.role !== "admin") {
    if (!req.employee) {
      return res.status(403).json({
        message: "Employee profile not found.",
      });
    }

    const isSelf =
      String(employee._id) ===
      String(req.employee._id);

    const isSubordinate =
      req.user.role === "manager" &&
      await belongsToManager(
        employee,
        req.employee._id
      );

    if (!isSelf && !isSubordinate) {
      return res.status(403).json({
        message: "You cannot access this employee profile.",
      });
    }

    return res.json(
      decryptEmployeeSubdocuments(employee)
    );
  }

  return res.json(
    decryptPrivateFields(employee)
  );
});

// --------------------------------------------------
// UPDATE EMPLOYEE
// --------------------------------------------------

export const updateEmployee = wrap(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return rejectWithCleanup(
      req,
      res,
      400,
      "Invalid employee ID."
    );
  }

  const employee = await Employee.findById(
    req.params.id
  ).select(
    "+personal.panNumber " +
    "+personal.aadhaarNumber " +
    "+personal.voterIdNumber " +
    "+personal.passportNumber " +
    "+bank.accountNumber " +
    "+salary"
  );

  if (!employee) {
    return rejectWithCleanup(
      req,
      res,
      404,
      "Employee not found."
    );
  }

  const body = req.body || {};

  const currentPersonal = employee.personal?.toObject
    ? employee.personal.toObject()
    : { ...(employee.personal || {}) };

  const currentBank = employee.bank?.toObject
    ? employee.bank.toObject()
    : { ...(employee.bank || {}) };

  // Decrypt existing values before merging.
  currentPersonal.panNumber = decrypt(
    currentPersonal.panNumber
  );

  currentPersonal.aadhaarNumber = decrypt(
    currentPersonal.aadhaarNumber
  );

  currentPersonal.voterIdNumber = decrypt(
    currentPersonal.voterIdNumber
  );

  currentPersonal.passportNumber = decrypt(
    currentPersonal.passportNumber
  );

  currentBank.accountNumber = decrypt(
    currentBank.accountNumber
  );

  const incomingPersonal =
    body.personal !== undefined
      ? normalizePersonalPatch(
          parseObject(body.personal)
        )
      : {};

  const incomingBank =
    body.bank !== undefined
      ? normalizeBankPatch(
          parseObject(body.bank)
        )
      : {};

  const mergedPersonal = {
    ...currentPersonal,
    ...incomingPersonal,
  };

  const mergedBank = {
    ...currentBank,
    ...incomingBank,
  };

  const education =
    body.education !== undefined
      ? parseArray(body.education)
      : employee.education || [];

  // Validate the complete profile whenever
  // personal, bank or education data changes.
  if (
    body.personal !== undefined ||
    body.bank !== undefined ||
    body.education !== undefined
  ) {
    const profileError = validateProfile(
      mergedPersonal,
      mergedBank,
      education
    );

    if (profileError) {
      return rejectWithCleanup(
        req,
        res,
        400,
        profileError
      );
    }

    const encrypted = prepareSensitiveFields(
      mergedPersonal,
      mergedBank
    );

    employee.personal = encrypted.personal;
    employee.bank = encrypted.bank;
  }

  if (body.contact !== undefined) {
    employee.contact = parseObject(
      body.contact
    );
  }

  if (body.socialMedia !== undefined) {
    employee.socialMedia = parseObject(
      body.socialMedia
    );
  }

  if (body.education !== undefined) {
    employee.education = education;
  }

  if (body.emergencyContact !== undefined) {
    employee.emergencyContact = parseObject(
      body.emergencyContact
    );
  }

  if (body.previousEmployment !== undefined) {
    employee.previousEmployment = parseObject(
      body.previousEmployment
    );
  }

  // ------------------------------------------------
  // BASIC EMPLOYEE INFORMATION
  // ------------------------------------------------

  const allowed = [
    "phone",
    "department",
    "designation",
    "joiningDate",
    "manager",
    "employmentStatus",
    "employeeId",
    "employmentType",
    "workLocation",
    "probationMonths",
    "salary",
  ];

  for (const key of allowed) {
    if (body[key] === undefined) continue;

    if (key === "manager") {
      employee.manager = body.manager || null;
    } else if (key === "salary") {
      employee.salary =
        body.salary === "" || body.salary === null
          ? null
          : Number(body.salary);
    } else if (key === "probationMonths") {
      employee.probationMonths =
        Number(body.probationMonths);
    } else {
      employee[key] = body[key];
    }
  }

  // ------------------------------------------------
  // VALIDATION
  // ------------------------------------------------

  if (!validatePhone(employee.phone)) {
    return rejectWithCleanup(
      req,
      res,
      400,
      "Invalid phone number."
    );
  }

  if (
    employee.joiningDate &&
    !validateJoiningDate(employee.joiningDate)
  ) {
    return rejectWithCleanup(
      req,
      res,
      400,
      "Invalid joining date."
    );
  }

  if (
    !EMPLOYMENT_STATUSES.includes(
      employee.employmentStatus
    )
  ) {
    return rejectWithCleanup(
      req,
      res,
      400,
      "Invalid employment status."
    );
  }

  if (
    employee.salary !== null &&
    employee.salary !== undefined &&
    (
      !Number.isFinite(Number(employee.salary)) ||
      Number(employee.salary) < 0
    )
  ) {
    return rejectWithCleanup(
      req,
      res,
      400,
      "Invalid salary."
    );
  }

  if (
    !Number.isInteger(employee.probationMonths) ||
    employee.probationMonths < 0
  ) {
    return rejectWithCleanup(
      req,
      res,
      400,
      "Invalid probation duration."
    );
  }

  if (employee.manager) {
    const managerError = await validateManager(
      employee._id,
      employee.manager
    );

    if (managerError) {
      return rejectWithCleanup(
        req,
        res,
        400,
        managerError
      );
    }
  }

  if (
    !ACTIVE_STATUSES.includes(
      employee.employmentStatus
    ) &&
    req.employee &&
    String(req.employee._id) === String(employee._id)
  ) {
    return rejectWithCleanup(
      req,
      res,
      400,
      "You cannot deactivate your own account."
    );
  }

  // ------------------------------------------------
  // FILE UPLOADS
  // ------------------------------------------------

  const profileFile = getUploadedFile(
    req.files,
    "profilePicture"
  );

  const documentFiles = getUploadedDocuments(
    req.files
  );

  const documentTypes = parseArray(
    body.documentTypes
  );

  const oldProfileFilename =
    employee.profilePicture?.filename;

  if (profileFile) {
    employee.profilePicture =
      uploadedFileMetadata(profileFile);
  }

  for (
    let index = 0;
    index < documentFiles.length;
    index++
  ) {
    employee.documents.push(
      uploadedDocumentMetadata(
        documentFiles[index],
        documentTypes[index]
      )
    );
  }

  // ------------------------------------------------
  // SAVE EMPLOYEE
  // ------------------------------------------------

  try {
    await employee.save();
  } catch (error) {
    await cleanupUploadedFiles(req.files);
    throw error;
  }

  // Update associated login account.
  await User.findByIdAndUpdate(
    employee.user,
    {
      isActive: ACTIVE_STATUSES.includes(
        employee.employmentStatus
      ),
      ...(body.personal !== undefined
        ? {
            name: makeEmployeeName(
              mergedPersonal
            ),
          }
        : {}),
    }
  );

  await safeEmployeePopulate(employee);

  // Remove old profile picture only after
  // the new picture has been successfully saved.
  if (
    profileFile &&
    oldProfileFilename &&
    oldProfileFilename !== profileFile.filename
  ) {
    await removePrivateFile(
      oldProfileFilename
    );
  }

  return res.json({
    message: "Employee updated successfully.",
    employee: decryptPrivateFields(employee),
  });
});

// --------------------------------------------------
// DEACTIVATE EMPLOYEE
// --------------------------------------------------

export const deactivateEmployee = wrap(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({
      message: "Invalid employee ID.",
    });
  }

  const employee = await Employee.findById(
    req.params.id
  );

  if (!employee) {
    return res.status(404).json({
      message: "Employee not found.",
    });
  }

  if (
    String(employee.user) ===
    String(req.user._id)
  ) {
    return res.status(400).json({
      message: "You cannot deactivate your own account.",
    });
  }

  employee.employmentStatus = "inactive";

  await employee.save();

  await User.findByIdAndUpdate(
    employee.user,
    {
      isActive: false,
    }
  );

  return res.json({
    message: "Employee deactivated successfully.",
  });
});

// --------------------------------------------------
// GET EMPLOYEE PROFILE PICTURE
// --------------------------------------------------

export const getEmployeeProfilePicture = wrap(
  async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid employee ID.",
      });
    }

    const employee = await Employee.findById(
      req.params.id
    );

    if (!employee) {
      return res.status(404).json({
        message: "Employee not found.",
      });
    }

    if (req.user.role !== "admin") {
      if (!req.employee) {
        return res.status(403).json({
          message: "Employee profile not found.",
        });
      }

      const isSelf =
        String(employee._id) ===
        String(req.employee._id);

      const isSubordinate =
        req.user.role === "manager" &&
        await belongsToManager(
          employee,
          req.employee._id
        );

      if (!isSelf && !isSubordinate) {
        return res.status(403).json({
          message: "You cannot access this profile picture.",
        });
      }
    }

    const filename =
      employee.profilePicture?.filename;

    if (!filename) {
      return res.status(404).json({
        message: "Profile picture not found.",
      });
    }

    const safeFilename = path.basename(filename);

    const filePath = path.resolve(
      PRIVATE_UPLOAD_DIR,
      safeFilename
    );

    if (
      !filePath.startsWith(
        PRIVATE_UPLOAD_DIR + path.sep
      )
    ) {
      return res.status(400).json({
        message: "Invalid file path.",
      });
    }

    try {
      await fs.promises.access(
        filePath,
        fs.constants.R_OK
      );
    } catch {
      return res.status(404).json({
        message: "Profile picture file not found.",
      });
    }

    res.setHeader(
      "Content-Type",
      employee.profilePicture.mimeType ||
        "application/octet-stream"
    );

    res.setHeader(
      "Cache-Control",
      "private, no-store"
    );

    return res.sendFile(filePath);
  }
);

// --------------------------------------------------
// DOWNLOAD EMPLOYEE DOCUMENT - ADMIN ONLY
// --------------------------------------------------

export const downloadEmployeeDocument = wrap(
  async (req, res) => {
    const { id, documentId } = req.params;

    if (
      !mongoose.isValidObjectId(id) ||
      !mongoose.isValidObjectId(documentId)
    ) {
      return res.status(400).json({
        message: "Invalid employee or document ID.",
      });
    }

    const employee = await Employee.findById(id);

    if (!employee) {
      return res.status(404).json({
        message: "Employee not found.",
      });
    }

    const document = employee.documents.id(
      documentId
    );

    if (!document) {
      return res.status(404).json({
        message: "Document not found.",
      });
    }

    const safeFilename = path.basename(
      document.filename
    );

    const filePath = path.resolve(
      PRIVATE_UPLOAD_DIR,
      safeFilename
    );

    if (
      !filePath.startsWith(
        PRIVATE_UPLOAD_DIR + path.sep
      )
    ) {
      return res.status(400).json({
        message: "Invalid file path.",
      });
    }

    try {
      await fs.promises.access(
        filePath,
        fs.constants.R_OK
      );
    } catch {
      return res.status(404).json({
        message: "Document file not found.",
      });
    }

    res.setHeader(
      "Content-Type",
      document.mimeType ||
        "application/octet-stream"
    );

    res.setHeader(
      "Cache-Control",
      "private, no-store"
    );

    return res.download(
      filePath,
      path.basename(document.originalName)
    );
  }
);
