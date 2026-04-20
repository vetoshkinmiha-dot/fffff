import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authMiddleware } from "@/lib/api-middleware";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; complaintId: string }> }
) {
  const authResult = await authMiddleware(req);
  if (authResult instanceof NextResponse) return authResult;

  const { id, complaintId } = await params;

  // Verify violation exists and user has access
  const violation = await prisma.violation.findUnique({
    where: { id },
    select: { contractorId: true },
  });
  if (!violation) {
    return NextResponse.json({ error: "Violation not found" }, { status: 404 });
  }

  const complaint = await prisma.violationComplaint.findUnique({
    where: { id: complaintId },
    include: {
      createdBy: { select: { fullName: true } },
    },
  });
  if (!complaint || complaint.violationId !== id) {
    return NextResponse.json({ error: "Complaint not found" }, { status: 404 });
  }

  // Contractor roles can only see complaints on their org's violations
  if (
    (authResult.user.role === "contractor_employee" || authResult.user.role === "contractor_admin") &&
    authResult.user.organizationId
  ) {
    if (violation.contractorId !== authResult.user.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  return NextResponse.json(complaint);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; complaintId: string }> }
) {
  const authResult = await authMiddleware(req);
  if (authResult instanceof NextResponse) return authResult;

  const { id, complaintId } = await params;

  const complaint = await prisma.violationComplaint.findUnique({
    where: { id: complaintId },
  });
  if (!complaint || complaint.violationId !== id) {
    return NextResponse.json({ error: "Complaint not found" }, { status: 404 });
  }

  // Only the creator can edit their complaint
  if (complaint.createdById !== authResult.user.userId) {
    return NextResponse.json({ error: "Forbidden: can only edit your own complaints" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { text, department } = body;

    const updateData: Record<string, unknown> = {};
    if (text !== undefined && typeof text === "string" && text.trim()) {
      updateData.complaintText = text.trim();
    }
    if (department !== undefined && typeof department === "string") {
      updateData.department = department;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const updated = await prisma.violationComplaint.update({
      where: { id: complaintId },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("Update complaint error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; complaintId: string }> }
) {
  const authResult = await authMiddleware(req);
  if (authResult instanceof NextResponse) return authResult;

  const { id, complaintId } = await params;

  const complaint = await prisma.violationComplaint.findUnique({
    where: { id: complaintId },
  });
  if (!complaint || complaint.violationId !== id) {
    return NextResponse.json({ error: "Complaint not found" }, { status: 404 });
  }

  // Only the creator or admin can delete
  if (complaint.createdById !== authResult.user.userId && authResult.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden: can only delete your own complaints" }, { status: 403 });
  }

  await prisma.violationComplaint.delete({ where: { id: complaintId } });
  return NextResponse.json({ success: true });
}
