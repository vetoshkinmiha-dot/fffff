import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authMiddleware } from "@/lib/api-middleware";
import { readFileSync } from "fs";
import { existsSync } from "fs";
import { unlink } from "fs/promises";
import path from "path";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authMiddleware(req);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  const doc = await prisma.regDocument.findUnique({
    where: { id },
    include: {
      section: { select: { name: true } },
      createdBy: { select: { fullName: true } },
    },
  });

  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  // Serve file download
  const filePath = path.join(process.cwd(), doc.fileUrl);
  if (!existsSync(filePath)) {
    return NextResponse.json({ error: "File not found on disk" }, { status: 404 });
  }

  const extMap: Record<string, string> = { pdf: "application/pdf", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
  const contentType = extMap[doc.fileType] || "application/octet-stream";

  const headers = new Headers();
  headers.set("Content-Type", contentType);
  headers.set("Content-Disposition", `attachment; filename="${doc.title}.${doc.fileType}"`);
  headers.set("Cache-Control", "public, max-age=3600");

  return new NextResponse(readFileSync(filePath), { headers });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authMiddleware(req);
  if (authResult instanceof NextResponse) return authResult;

  // Only admin can delete
  if (authResult.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const doc = await prisma.regDocument.findUnique({ where: { id } });
  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  // Remove file from disk
  try {
    const filePath = path.join(process.cwd(), doc.fileUrl);
    await unlink(filePath);
  } catch {
    // File may not exist
  }

  await prisma.regDocument.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
