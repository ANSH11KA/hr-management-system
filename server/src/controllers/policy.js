
import mongoose from "mongoose";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";

import Policy from "../models/Policy.js";
import { wrap } from "./wrap.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadDir = path.resolve(
  __dirname,
  "../../private_uploads/policies"
);

const POLICY_CATEGORIES = [
  "HR Policies",
  "Leave",
  "Attendance",
  "Code of Conduct",
  "IT & Security",
  "Payroll",
  "Other",
];

const POLICY_STATUSES = ["Draft", "Published", "Inactive"];

const isAdmin = (req) => req.user?.role === "admin";

const getFilePath = (filename) =>
  path.join(uploadDir, path.basename(filename));

const removeFile = async (filename) => {
  if (!filename) return;

  try {
    await fs.unlink(getFilePath(filename));
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("Policy file cleanup failed:", error);
    }
  }
};

const removeUploadedFile = async (file) => {
  if (!file?.filename) return;
  await removeFile(file.filename);
};

// Verify the actual PDF signature, not just its extension or MIME type.
const validateUploadedPdf = async (file) => {
  if (!file) return true;

  if (
    file.mimetype !== "application/pdf" ||
    path.extname(file.originalname).toLowerCase() !== ".pdf"
  ) {
    await removeUploadedFile(file);
    return false;
  }

  let handle;

  try {
    handle = await fs.open(file.path, "r");

    const header = Buffer.alloc(5);
    const { bytesRead } = await handle.read(header, 0, 5, 0);

    const isPdf =
      bytesRead === 5 &&
      header.toString("ascii") === "%PDF-";

    if (!isPdf) {
      await removeUploadedFile(file);
    }

    return isPdf;
  } catch {
    await removeUploadedFile(file);
    return false;
  } finally {
    if (handle) await handle.close();
  }
};

const parseDate = (value) => {
  if (value === null || value === "") return null;

  if (typeof value !== "string" && !(value instanceof Date)) {
    return undefined;
  }

  const date =
    typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? new Date(`${value}T00:00:00+05:30`)
      : new Date(value);

  return Number.isNaN(date.getTime()) ? undefined : date;
};

const validatePolicyData = (body, isUpdate = false) => {
  const data = {};

  if (!isUpdate || body.title !== undefined) {
    if (
      typeof body.title !== "string" ||
      !body.title.trim() ||
      body.title.trim().length > 180
    ) {
      return {
        error: "Title is required and must not exceed 180 characters.",
      };
    }

    data.title = body.title.trim();
  }

  if (body.description !== undefined) {
    if (
      typeof body.description !== "string" ||
      body.description.length > 500
    ) {
      return {
        error: "Description must not exceed 500 characters.",
      };
    }

    data.description = body.description.trim();
  }

  if (body.content !== undefined) {
    if (typeof body.content !== "string") {
      return { error: "Policy content must be valid text." };
    }

    data.content = body.content.trim();
  }

  if (!isUpdate || body.category !== undefined) {
    const category = body.category || "Other";

    if (!POLICY_CATEGORIES.includes(category)) {
      return { error: "Invalid policy category." };
    }

    data.category = category;
  }

  if (body.status !== undefined || !isUpdate) {
    const status = body.status || "Draft";

    if (!POLICY_STATUSES.includes(status)) {
      return { error: "Invalid policy status." };
    }

    data.status = status;
  }

  if (body.effectiveDate !== undefined) {
    const date = parseDate(body.effectiveDate);

    if (date === undefined) {
      return { error: "Invalid effective date." };
    }

    data.effectiveDate = date;
  }

  return { data };
};

// =====================================
// CREATE POLICY — HR
// =====================================

export const createPolicy = wrap(async (req, res) => {
  const validPdf = await validateUploadedPdf(req.file);

  if (!validPdf) {
    return res.status(400).json({
      message: "Invalid PDF file. Please upload a valid PDF document.",
    });
  }

  const { data, error } = validatePolicyData(req.body);

  if (error) {
    await removeUploadedFile(req.file);

    return res.status(400).json({ message: error });
  }

  const hasContent = Boolean(data.content?.trim());

  if (!hasContent && !req.file) {
    return res.status(400).json({
      message: "Please provide policy content or upload a PDF document.",
    });
  }

  const attachment = req.file
    ? {
        fileName: path.basename(req.file.originalname),
        filePath: req.file.filename,
        mimeType: "application/pdf",
        fileSize: req.file.size,
      }
    : undefined;

  try {
    const policy = await Policy.create({
      ...data,
      attachment,
      publishedAt:
        data.status === "Published" ? new Date() : null,
      createdBy: req.user._id,
    });

    return res.status(201).json({
      message: "Policy created successfully.",
      policy,
    });
  } catch (error) {
    await removeUploadedFile(req.file);
    throw error;
  }
});

// =====================================
// LIST POLICIES
// =====================================

export const listPolicies = wrap(async (req, res) => {
  const filter = isAdmin(req)
    ? {}
    : {
        status: "Published",
        $or: [
          { effectiveDate: null },
          { effectiveDate: { $lte: new Date() } },
        ],
      };

  const policies = await Policy.find(filter)
    .populate("createdBy", "name email")
    .populate("updatedBy", "name email")
    .sort({ publishedAt: -1, updatedAt: -1 })
    .limit(200)
    .lean();

  return res.json({
    count: policies.length,
    policies,
  });
});

// =====================================
// GET SINGLE POLICY — HR
// =====================================

export const getPolicy = wrap(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      message: "Invalid policy ID.",
    });
  }

  const policy = await Policy.findById(id)
    .populate("createdBy", "name email")
    .populate("updatedBy", "name email");

  if (!policy) {
    return res.status(404).json({
      message: "Policy not found.",
    });
  }

  return res.json({ policy });
});

// =====================================
// UPDATE POLICY — HR
// =====================================

export const updatePolicy = wrap(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    await removeUploadedFile(req.file);

    return res.status(400).json({
      message: "Invalid policy ID.",
    });
  }

  const validPdf = await validateUploadedPdf(req.file);

  if (!validPdf) {
    return res.status(400).json({
      message: "Invalid PDF file. Please upload a valid PDF document.",
    });
  }

  const { data, error } = validatePolicyData(req.body, true);

  if (error) {
    await removeUploadedFile(req.file);

    return res.status(400).json({ message: error });
  }

  if (Object.keys(data).length === 0 && !req.file) {
    return res.status(400).json({
      message: "No changes provided.",
    });
  }

  const policy = await Policy.findById(id);

  if (!policy) {
    await removeUploadedFile(req.file);

    return res.status(404).json({
      message: "Policy not found.",
    });
  }

  const oldFilename = policy.attachment?.filePath;
  const wasPublished = policy.status === "Published";

  Object.assign(policy, data);

  if (req.file) {
    policy.attachment = {
      fileName: path.basename(req.file.originalname),
      filePath: req.file.filename,
      mimeType: "application/pdf",
      fileSize: req.file.size,
    };
  }

  if (data.status === "Published" && !wasPublished) {
    policy.publishedAt = new Date();
  } else if (data.status === "Draft") {
    policy.publishedAt = null;
  }

  policy.updatedBy = req.user._id;

  try {
    await policy.save();
  } catch (error) {
    await removeUploadedFile(req.file);
    throw error;
  }

  // Delete the old PDF only after the database update succeeds.
  if (
    req.file &&
    oldFilename &&
    oldFilename !== req.file.filename
  ) {
    await removeFile(oldFilename);
  }

  return res.json({
    message: "Policy updated successfully.",
    policy,
  });
});

// =====================================
// DEACTIVATE POLICY — HR
// =====================================

export const deactivatePolicy = wrap(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      message: "Invalid policy ID.",
    });
  }

  const policy = await Policy.findById(id);

  if (!policy) {
    return res.status(404).json({
      message: "Policy not found.",
    });
  }

  policy.status = "Inactive";
  policy.updatedBy = req.user._id;

  await policy.save();

  return res.json({
    message: "Policy deactivated successfully.",
    policy,
  });
});

// =====================================
// VIEW / DOWNLOAD POLICY PDF
// HR / Employee / Manager
// =====================================


export const getPolicyDocument = wrap(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      message: "Invalid policy ID.",
    });
  }

  const filter = { _id: id };

  // Only HR can access drafts and inactive policies.
  if (!isAdmin(req)) {
    filter.status = "Published";
    filter.$or = [
      { effectiveDate: null },
      { effectiveDate: { $lte: new Date() } },
    ];
  }

  const policy = await Policy.findOne(filter).lean();

  if (!policy) {
    return res.status(404).json({
      message: "Policy not found or not available.",
    });
  }

  const filename = policy.attachment?.filePath;

  if (!filename) {
    return res.status(404).json({
      message: "This policy has no PDF attachment.",
    });
  }

  const filePath = getFilePath(filename);

  try {
    await fs.access(filePath);
  } catch {
    return res.status(404).json({
      message: "Policy document could not be found.",
    });
  }

  const downloadName = path
    .basename(policy.attachment.fileName || "policy.pdf")
    .replace(/["\\]/g, "_");

  const download = req.query.download === "true";

  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Type", "application/pdf");

  if (download) {
    return res.download(filePath, downloadName, (error) => {
      if (error && !res.headersSent) {
        res.status(500).json({
          message: "Unable to download policy document.",
        });
      }
    });
  }

  // Display the PDF inside the browser instead of forcing a download.
  res.setHeader(
    "Content-Disposition",
    `inline; filename="${downloadName}"`
  );

  return res.sendFile(filePath, (error) => {
    if (error && !res.headersSent) {
      res.status(500).json({
        message: "Unable to display policy document.",
      });
    }
  });
});

