import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authMiddleware } from "@/lib/api-middleware";
import { uploadFile, deleteFile, getFile } from "@/lib/file-storage";

function isAdminRole(role: string): boolean {
  return role === "admin";
}

async function checkEmployeeAccess(authResult: any, employee: { organizationId: string }) {
  const role = authResult.user.role;
  if (role === "contractor_admin" || role === "contractor_employee") {
    if (employee.organizationId !== authResult.user.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else if (!isAdminRole(role)) {
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

    // Remove old photo if exists
    if (employee.photoUrl) {
      await deleteFile(employee.photoUrl);
    }

    const photoUrl = await uploadFile(file, `employees/${id}`);

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

  try {
    const buffer = await getFile(employee.photoUrl);
    const ext = employee.photoUrl.split(".").pop() || "jpeg";
    const contentType = ext === "png" ? "image/png" : "image/jpeg";

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Photo file not found" }, { status: 404 });
  }
}
