
import multer from "multer";
import path from "path";
import crypto from "crypto";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Stores files in: server/private_uploads
const uploadDir = path.resolve(__dirname, "../../private_uploads");

fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },

  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    cb(null, `${crypto.randomUUID()}${extension}`);
  },
});

const allowedTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];

const fileFilter = (req, file, cb) => {
  if (!allowedTypes.includes(file.mimetype)) {
    return cb(
      new Error("Only JPG, PNG, WEBP and PDF files are allowed.")
    );
  }

  if (
    file.fieldname === "profilePicture" &&
    !["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)
  ) {
    return cb(new Error("Profile picture must be an image."));
  }

  cb(null, true);
};

export const employeeUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB per file
    files: 11, // 1 profile picture + 10 documents
  },
}).fields([
  { name: "profilePicture", maxCount: 1 },
  { name: "documents", maxCount: 10 },
]);
