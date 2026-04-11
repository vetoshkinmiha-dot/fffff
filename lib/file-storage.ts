import { mkdir, writeFile, unlink } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

async function ensureUploadDir() {
  try {
    await mkdir(UPLOAD_DIR, { recursive: true });
  } catch {
    // Already exists
  }
}

export async function uploadFile(file: File, subDir: string): Promise<string> {
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
  try {
    const fullPath = path.join(process.cwd(), url);
    await unlink(fullPath);
  } catch {
    // File may not exist, ignore
  }
}
