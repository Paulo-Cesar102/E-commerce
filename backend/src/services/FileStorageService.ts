import fs from "node:fs/promises";
import path from "node:path";
import { uploadsDirectory } from "../middlewares/upload.js";

export class FileStorageService {
  async deleteUploadedFiles(urls: string[]) {
    await Promise.all(urls.map((url) => this.deleteUploadedFile(url)));
  }

  private async deleteUploadedFile(url: string) {
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
