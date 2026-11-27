import crypto from "node:crypto";
import path from "node:path";
import multer from "multer";
import fs from "node:fs/promises";
import { ClamAvService } from "../services/ClamAvService.js";
import { AppError } from "../errors/AppError.js";
import { env } from "../config/env.js";

export const uploadsDirectory = path.resolve(process.cwd(), "uploads");
export const uploadsStagingDirectory = path.resolve(process.cwd(), ".upload-staging");
const clamAv = new ClamAvService();

const diskStorage = multer.diskStorage({
  destination: uploadsStagingDirectory,
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

function actualImageMime(buffer: Buffer): string | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

export async function verifyUploadedImageContent(req: import("express").Request, _res: import("express").Response, next: import("express").NextFunction) {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  try {
    for (const file of files) {
      const buffer = file.buffer ?? await fs.readFile(file.path);
      if (actualImageMime(buffer) !== file.mimetype) {
        await Promise.all(files.filter((candidate) => candidate.path).map((candidate) => fs.rm(candidate.path, { force: true })));
        throw new AppError(400, "O conteudo de uma imagem nao corresponde ao formato informado");
      }
      await clamAv.scan(buffer);
    }
    for (const file of files) {
      if (file.path) {
        const finalPath = path.join(uploadsDirectory, path.basename(file.filename));
        await fs.rename(file.path, finalPath);
        file.path = finalPath;
      }
    }
    next();
  } catch (error) {
    await Promise.all(files.filter((file) => file.path).map((file) => fs.rm(file.path, { force: true }).catch(() => undefined)));
    next(error);
  }
}
