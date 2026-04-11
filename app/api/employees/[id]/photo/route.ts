import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authMiddleware } from "@/lib/api-middleware";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { readFileSync } from "fs";

const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads", "employees");

function isAdminRole(role: string): boolean {
  return role === "admin";
}

async function checkEmployeeAccess(authResult: any, employee: { organizationId: string }) {
  if (authResult.user.role === "contractor_employee") {
    if (employee.organizationId !== authResult.user.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else if (!isAdminRole(authResult.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authMiddleware(req);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  const employee = await prisma.employee.findUnique({
    where: { id },
    select: { organizationId: true, photoUrl: true },
  });
  if (!employee) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }

  const accessError = await checkEmployeeAccess(authResult, employee);
  if (accessError) return accessError;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "Only JPEG and PNG images are allowed" }, { status: 400 });
    }

    // Validate file size (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large (max 2MB)" }, { status: 400 });
    }

    const ext = file.type === "image/png" ? "png" : "jpg";
    const photoDir = path.join(UPLOAD_DIR, id);
    await mkdir(photoDir, { recursive: true });

    // Remove old photo if exists
    if (employee.photoUrl) {
      const oldPath = path.join(process.cwd(), employee.photoUrl);
      try {
        const { unlink } = await import("fs/promises");
        await unlink(oldPath);
      } catch {
        // Ignore
      }
    }

    const fileName = `photo.${ext}`;
    const filePath = path.join(photoDir, fileName);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    const photoUrl = `/data/uploads/employees/${id}/${fileName}`;

    await prisma.employee.update({
      where: { id },
      data: { photoUrl },
    });

    return NextResponse.json({ photoUrl });
  } catch (err) {
    console.error("Upload photo error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authMiddleware(req);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  const employee = await prisma.employee.findUnique({
    where: { id },
    select: { photoUrl: true, organizationId: true },
  });
  if (!employee || !employee.photoUrl) {
    return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  }

  const accessError = await checkEmployeeAccess(authResult, employee);
  if (accessError) return accessError;

  const filePath = path.join(process.cwd(), employee.photoUrl);
  if (!existsSync(filePath)) {
    return NextResponse.json({ error: "Photo file not found" }, { status: 404 });
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = ext === ".png" ? "image/png" : "image/jpeg";
  const buffer = readFileSync(filePath);

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
