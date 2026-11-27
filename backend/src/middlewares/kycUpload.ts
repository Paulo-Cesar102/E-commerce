import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import multer from "multer";
import type { NextFunction, Request, Response } from "express";
import { AppError } from "../errors/AppError.js";
import { ClamAvService } from "../services/ClamAvService.js";

export const privateKycDirectory = path.resolve(process.cwd(), "private-kyc");
const clamAv = new ClamAvService();
const diskStorage = multer.diskStorage({
  destination: privateKycDirectory,
  filename: (_req, _file, callback) => callback(null, crypto.randomUUID()),
});

export const uploadSellerKycDocument = multer({
  storage: diskStorage,
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!((ext === ".pdf" && file.mimetype === "application/pdf") || (ext === ".jpg" || ext === ".jpeg") && file.mimetype === "image/jpeg" || ext === ".png" && file.mimetype === "image/png")) return callback(new AppError(400, "Envie um documento PDF, JPG ou PNG"));
    callback(null, true);
  },
}).single("document");

export const verifySellerKycDocument = Object.assign(async (req: Request, res: Response, next: NextFunction) => {
  if (!req.file) return next(new AppError(400, "Envie um documento em PDF, JPG ou PNG"));
  try {
    const bytes = await fs.readFile(req.file.path);
    const valid = req.file.mimetype === "application/pdf"
      ? bytes.subarray(0, 5).toString("ascii") === "%PDF-"
      : req.file.mimetype === "image/jpeg"
        ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
        : bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    if (!valid) {
      await fs.rm(req.file.path, { force: true });
      return next(new AppError(400, "O conteudo do arquivo nao corresponde ao tipo informado"));
    }
    await clamAv.scan(bytes);
    res.locals.kycDocumentFilename = req.file.filename;
    next();
  } catch (error) {
    await fs.rm(req.file.path, { force: true }).catch(() => undefined);
    next(error);
  }
}, {
  remove: async (filename: string) => fs.rm(path.join(privateKycDirectory, path.basename(filename)), { force: true }),
});
