import { mkdir, writeFile, unlink, readFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const UPLOAD_DIR = path.join(process.cwd(), "public/uploads");

async function ensureUploadDir() {
  try {
    await mkdir(UPLOAD_DIR, { recursive: true });
  } catch {
    // Already exists
  }
}

// Note: s3Client is imported from S3 config when available.
// For now, we check env vars to determine if S3 is configured.
const s3Client = process.env.S3_ENDPOINT ? true : false;

export async function uploadFile(file: File, subDir: string): Promise<string> {
  if (!s3Client && process.env.NODE_ENV === "production") {
    throw new Error("S3 storage is required in production but is not configured");
  }

  await ensureUploadDir();

  const targetDir = path.join(UPLOAD_DIR, subDir);
  await mkdir(targetDir, { recursive: true });

  const ext = file.name.split(".").pop() || "bin";
  const fileName = `${randomUUID()}.${ext}`;
  const filePath = path.join(targetDir, fileName);

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, buffer);

  return path.posix.join("/uploads", subDir, fileName);
}

export async function deleteFile(url: string): Promise<void> {
  if (process.env.NODE_ENV === "production" && !s3Client) {
    throw new Error("S3 storage is required in production but is not configured");
  }

  try {
    const fullPath = path.join(process.cwd(), url);
    await unlink(fullPath);
  } catch {
    // File may not exist, ignoring
  }
}

export async function getFile(url: string): Promise<Buffer> {
  if (process.env.NODE_ENV === "production" && !s3Client) {
    throw new Error("S3 storage is required in production but is not configured");
  }

  const fullPath = path.join(process.cwd(), url);
  return readFile(fullPath);
}
