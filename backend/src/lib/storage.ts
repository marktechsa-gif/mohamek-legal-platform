import fs from "node:fs";
import path from "node:path";
import { env } from "../config/env";

/**
 * تخزين محلي على القرص لملفات المستندات الداعمة والمستندات المولَّدة (.docx).
 * نقطة الامتداد للإنتاج: استبدل هذه الدوال بتنفيذ يرفع/يقرأ من تخزين متوافق مع S3
 * (Supabase Storage, S3, R2...) دون تغيير أي كود مستدعٍ لها.
 */

export function ensureUploadsDir(): string {
  const dir = path.resolve(env.UPLOADS_DIR);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function absoluteStoragePath(relativePath: string): string {
  return path.join(ensureUploadsDir(), relativePath);
}
