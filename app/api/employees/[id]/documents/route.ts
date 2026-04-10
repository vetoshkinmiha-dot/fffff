import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authMiddleware } from "@/lib/api-middleware";
import { uploadFile } from "@/lib/file-storage";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authMiddleware(req);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  const employee = await prisma.employee.findUnique({ where: { id: id } });
  if (!employee) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }

  // Contractor scoping
  if (
    authResult.user.role === "contractor_admin" ||
    authResult.user.role === "contractor_user"
  ) {
    if (employee.organizationId !== authResult.user.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const documents = await prisma.employeeDocument.findMany({
    where: { employeeId: id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(documents);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authMiddleware(req);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  const employee = await prisma.employee.findUnique({ where: { id: id } });
  if (!employee) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }

  // Only contractor_admin can upload for their own org's employees
  if (authResult.user.role === "contractor_admin") {
    if (employee.organizationId !== authResult.user.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else if (
    authResult.user.role !== "admin" &&
    authResult.user.role !== "factory_hse" &&
    authResult.user.role !== "factory_hr" &&
    authResult.user.role !== "factory_curator"
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const name = (formData.get("name") as string) || file?.name || "document";
    const issueDate = formData.get("issueDate") as string | null;
    const expiryDate = formData.get("expiryDate") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ["application/pdf", "image/jpeg", "image/png"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "Only PDF, JPG, PNG allowed" }, { status: 400 });
    }

    const fileUrl = await uploadFile(file, `employees/${id}`);

    // Compute status from expiry date
    let status = "valid";
    if (expiryDate) {
      const expiry = new Date(expiryDate);
      const now = new Date();
      const daysUntilExpiry = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      if (daysUntilExpiry < 0) status = "expired";
      else if (daysUntilExpiry <= 30) status = "expiring";
    }

    const doc = await prisma.employeeDocument.create({
      data: {
        employeeId: id,
        name,
        fileUrl,
        issueDate: issueDate ? new Date(issueDate) : null,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        status: status as any,
      },
    });

    return NextResponse.json(doc, { status: 201 });
  } catch (err) {
    console.error("Upload document error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
