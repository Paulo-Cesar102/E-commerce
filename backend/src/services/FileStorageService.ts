import fs from "node:fs/promises";
import path from "node:path";
import { uploadsDirectory } from "../middlewares/upload.js";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import crypto from "node:crypto";
import { env } from "../config/env.js";

export class FileStorageService {
  private readonly s3 = env.STORAGE_DRIVER === "s3" ? new S3Client({ region: env.S3_REGION, ...(env.S3_ENDPOINT ? { endpoint: env.S3_ENDPOINT } : {}), forcePathStyle: true, credentials: { accessKeyId: env.S3_ACCESS_KEY_ID!, secretAccessKey: env.S3_SECRET_ACCESS_KEY! } }) : null;
  async uploadProductFiles(files: Express.Multer.File[], baseUrl: string) {
    if (!this.s3) return files.map((file) => ({ url: `${baseUrl}/uploads/${file.filename}`, alt: file.originalname }));
    return Promise.all(files.map(async (file) => { const key = `products/${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`; await this.s3!.send(new PutObjectCommand({ Bucket: env.S3_BUCKET!, Key: key, Body: file.buffer, ContentType: file.mimetype })); return { url: `${env.S3_PUBLIC_URL!.replace(/\/$/, "")}/${key}`, alt: file.originalname }; }));
  }
  async deleteUploadedFiles(urls: string[]) {
    await Promise.all(urls.map((url) => this.deleteUploadedFile(url)));
  }

  private async deleteUploadedFile(url: string) {
    if (this.s3 && env.S3_PUBLIC_URL && url.startsWith(env.S3_PUBLIC_URL)) {
      const key = url.slice(env.S3_PUBLIC_URL.replace(/\/$/, "").length + 1);
      await this.s3.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET!, Key: key }));
      return;
    }
    const pathname = this.getPathname(url);
    if (!pathname?.startsWith("/uploads/")) {
      return;
    }

    const filename = path.basename(pathname);
    const filePath = path.resolve(uploadsDirectory, filename);
    const uploadsRoot = path.resolve(uploadsDirectory);

    if (!filePath.startsWith(uploadsRoot)) {
      return;
    }

    try {
      await fs.unlink(filePath);
    } catch {
      // The database is the source of truth; missing files should not break product updates.
    }
  }

  private getPathname(url: string) {
    try {
      return new URL(url).pathname;
    } catch {
      return null;
    }
  }
}
