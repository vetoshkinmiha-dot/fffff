import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authMiddleware } from "@/lib/api-middleware";
import { updateViolationSchema, updateContractorCommentSchema } from "@/lib/validations";

function isAuthorizedForViolations(role: string): boolean {
  return role === "admin" || role === "department_approver";
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authMiddleware(req);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  const violation = await prisma.violation.findUnique({
    where: { id },
    include: {
      contractor: { select: { name: true, sequentialNumber: true } },
      createdBy: { select: { fullName: true, id: true } },
    },
  });

  if (!violation) {
    return NextResponse.json({ error: "Violation not found" }, { status: 404 });
  }

  // Contractor scoping
  if (
    (authResult.user.role === "contractor_employee" || authResult.user.role === "contractor_admin") && authResult.user.organizationId
  ) {
    if (violation.contractorId !== authResult.user.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  return NextResponse.json(violation);
}

export async function PATCH(
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

  // Admin can edit any field
  if (authResult.user.role === "admin") {
    try {
      const body = await req.json();
      const validation = updateViolationSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
      }

      const updated = await prisma.violation.update({
        where: { id },
        data: validation.data,
      });

      return NextResponse.json(updated);
    } catch (err) {
      console.error("Update violation error:", err);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  }

  // Contractor roles can update ONLY contractorComment field for their org's violations
  if (authResult.user.role === "contractor_admin" || authResult.user.role === "contractor_employee") {
    if (violation.contractorId !== authResult.user.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
      const body = await req.json();
      const validation = updateContractorCommentSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
      }

      const updated = await prisma.violation.update({
        where: { id },
        data: { contractorComment: validation.data.contractorComment },
      });

      return NextResponse.json(updated);
    } catch (err) {
      console.error("Update violation contractorComment error:", err);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  }

  // department_approver and employee can only edit their own violations
  if (authResult.user.role === "department_approver" || authResult.user.role === "employee") {
    if (violation.createdById !== authResult.user.userId) {
      return NextResponse.json({ error: "Forbidden: can only edit your own violations" }, { status: 403 });
    }

    try {
      const body = await req.json();
      const validation = updateViolationSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
      }

      const updated = await prisma.violation.update({
        where: { id },
        data: validation.data,
      });

      return NextResponse.json(updated);
    } catch (err) {
      console.error("Update violation error:", err);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

  const violation = await prisma.violation.findUnique({ where: { id } });
  if (!violation) {
    return NextResponse.json({ error: "Violation not found" }, { status: 404 });
  }

  await prisma.violation.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
