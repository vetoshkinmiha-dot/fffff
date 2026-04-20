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

  // Check if fileUrl is an S3 URL (starts with http)
  if (doc.fileUrl.startsWith("http://") || doc.fileUrl.startsWith("https://")) {
    return NextResponse.redirect(doc.fileUrl);
  }

  // Local file — fileUrl is like /uploads/regulatory/{uuid}.pdf, file is in public/uploads/
  const relativePath = doc.fileUrl.startsWith("/uploads/")
    ? doc.fileUrl.slice(1)
    : doc.fileUrl;
  const uploadsDir = path.join(process.cwd(), "public/uploads");
  const filePath = path.normalize(path.join(process.cwd(), "public", relativePath));
  if (!filePath.startsWith(uploadsDir)) {
    return NextResponse.json({ error: "Invalid file path" }, { status: 400 });
  }
  if (!existsSync(filePath)) {
    return NextResponse.json({ error: "File not found on disk" }, { status: 404 });
  }

  const extMap: Record<string, { mime: string; ext: string }> = {
    pdf: { mime: "application/pdf", ext: "pdf" },
    docx: { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ext: "docx" },
    xlsx: { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ext: "xlsx" },
  };

  const info = extMap[doc.fileType] || { mime: "application/octet-stream", ext: doc.fileType || "bin" };
  const contentType = info.mime;
  const fileExt = info.ext;

  const safeFilename = encodeURIComponent(doc.title);
  const headers = new Headers();
  headers.set("Content-Type", contentType);
  headers.set("Content-Disposition", `attachment; filename="${safeFilename}.${fileExt}"; filename*=UTF-8''${safeFilename}.${fileExt}`);
  headers.set("Cache-Control", "public, max-age=3600");

  return new NextResponse(readFileSync(filePath), { headers });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authMiddleware(req);
  if (authResult instanceof NextResponse) return authResult;

  if (authResult.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const doc = await prisma.regDocument.findUnique({ where: { id } });
  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  // Remove file from disk (only if local)
  if (!doc.fileUrl.startsWith("http")) {
    try {
      const filePath = path.join(process.cwd(), doc.fileUrl);
      await unlink(filePath);
    } catch {
      // File may not exist
    }
  }

  await prisma.regDocument.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authMiddleware(req);
  if (authResult instanceof NextResponse) return authResult;

  if (authResult.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const doc = await prisma.regDocument.findUnique({ where: { id } });
  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const { title, sectionId } = body;

    const updateData: Record<string, unknown> = {};
    if (title !== undefined) {
      if (typeof title !== "string" || title.trim().length === 0) {
        return NextResponse.json({ error: "Title is required" }, { status: 400 });
      }
      updateData.title = title.trim();
    }
    if (sectionId !== undefined) {
      if (sectionId !== null && sectionId !== "") {
        const section = await prisma.regDocumentSection.findUnique({ where: { id: sectionId } });
        if (!section) {
          return NextResponse.json({ error: "Section not found" }, { status: 404 });
        }
        updateData.sectionId = sectionId;
      } else {
        updateData.sectionId = null;
      }
    }

    const updated = await prisma.regDocument.update({
      where: { id },
      data: updateData,
      include: {
        section: { select: { name: true } },
        createdBy: { select: { fullName: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("Update document error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
