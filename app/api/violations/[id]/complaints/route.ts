import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authMiddleware } from "@/lib/api-middleware";
import { createComplaintSchema } from "@/lib/validations";
import { createNotificationsForRole } from "@/lib/notifications";

const CONTRACTOR_COMPLAINT_ROLES = ["contractor_admin", "contractor_employee"];

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authMiddleware(req);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  const violation = await prisma.violation.findUnique({ where: { id } });
  if (!violation) {
    return NextResponse.json({ error: "Violation not found" }, { status: 404 });
  }

  const complaints = await prisma.violationComplaint.findMany({
    where: { violationId: id },
    include: {
      createdBy: { select: { fullName: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: complaints });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authMiddleware(req);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  const violation = await prisma.violation.findUnique({ where: { id } });
  if (!violation) {
    return NextResponse.json({ error: "Violation not found" }, { status: 404 });
  }

  // Only contractor roles can file complaints
  if (!CONTRACTOR_COMPLAINT_ROLES.includes(authResult.user.role)) {
    return NextResponse.json({ error: "Forbidden: only contractors can file complaints" }, { status: 403 });
  }

  // Must be the same organization
  if (!authResult.user.organizationId || violation.contractorId !== authResult.user.organizationId) {
    return NextResponse.json({ error: "Forbidden: not your organization's violation" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { text, department } = body;

    if (!text || !text.trim()) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    const VALID_DEPARTMENTS = ["hse", "curator", "procurement", "quality", "legal", "finance", "hr_department"];
    if (!VALID_DEPARTMENTS.includes(department)) {
      return NextResponse.json({ error: "Invalid department" }, { status: 400 });
    }

    // Create a proper violation complaint record with required fields
    await prisma.violationComplaint.create({
      data: {
        violationId: id,
        complaintText: text.trim(),
        department,
        contractorId: violation.contractorId,
        createdById: authResult.user.userId,
        status: "pending",
      },
    });

    // Notify all admin users about the new complaint
    await createNotificationsForRole("admin", {
      type: "complaint_submitted",
      title: "Подана жалоба",
      message: `Жалоба на нарушение ${violation.violationNumber}`,
      link: `/violations/${id}`,
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    console.error("Create violation complaint error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
