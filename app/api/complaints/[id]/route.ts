import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authMiddleware } from "@/lib/api-middleware";
import { resolveComplaintSchema } from "@/lib/validations";
import { createNotification } from "@/lib/notifications";

const CONTRACTOR_COMPLAINT_ROLES = ["contractor_admin", "contractor_employee"];

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authMiddleware(req);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  const complaint = await prisma.violationComplaint.findUnique({
    where: { id },
    include: {
      createdBy: { select: { fullName: true, id: true } },
      violation: { select: { id: true, violationNumber: true } },
    },
  });

  if (!complaint) {
    return NextResponse.json({ error: "Complaint not found" }, { status: 404 });
  }

  // Admin can see any complaint
  if (authResult.user.role === "admin") {
    return NextResponse.json(complaint);
  }

  // Contractor roles can see only complaints from their org
  if (CONTRACTOR_COMPLAINT_ROLES.includes(authResult.user.role)) {
    if (complaint.contractorId !== authResult.user.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json(complaint);
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authMiddleware(req);
  if (authResult instanceof NextResponse) return authResult;

  // Only admin can resolve/reject complaints
  if (authResult.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden: only admins can resolve complaints" }, { status: 403 });
  }

  const { id } = await params;

  const complaint = await prisma.violationComplaint.findUnique({ where: { id } });
  if (!complaint) {
    return NextResponse.json({ error: "Complaint not found" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const validation = resolveComplaintSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
    }

    const updated = await prisma.violationComplaint.update({
      where: { id },
      data: {
        status: validation.data.status,
        resolutionNotes: validation.data.resolutionNotes,
        resolvedAt: new Date(),
        resolvedById: authResult.user.userId,
      },
      include: {
        createdBy: { select: { fullName: true } },
      },
    });

    // Notify the contractor who filed the complaint
    await createNotification({
      userId: complaint.createdById,
      type: "complaint_submitted",
      title: `Жалоба ${validation.data.status === "resolved" ? "рассмотрена" : "отклонена"}`,
      message: validation.data.status === "resolved"
        ? "Ваша жалоба рассмотрена и принята."
        : "Ваша жалоба отклонена.",
      link: `/complaints`,
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("Resolve complaint error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
