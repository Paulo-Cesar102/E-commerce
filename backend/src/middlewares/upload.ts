import crypto from "node:crypto";
import path from "node:path";
import multer from "multer";
import { AppError } from "../errors/AppError.js";
import { env } from "../config/env.js";

export const uploadsDirectory = path.resolve(process.cwd(), "uploads");

const diskStorage = multer.diskStorage({
  destination: uploadsDirectory,
  filename: (_req, file, callback) => {
    callback(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`);
  },
});
const storage = env.STORAGE_DRIVER === "s3" ? multer.memoryStorage() : diskStorage;

export const uploadProductImages = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 6,
  },
  fileFilter: (_req, file, callback) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
      callback(new AppError(400, "Envie imagens JPG, PNG ou WEBP"));
      return;
    }
    callback(null, true);
  },
}).array("images", 6);
