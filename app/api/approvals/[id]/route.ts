import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authMiddleware } from "@/lib/api-middleware";
import { decideApprovalSchema } from "@/lib/validations";
import { sendApprovalResult } from "@/lib/email";

const DEPARTMENT_LABELS: Record<string, string> = {
  security: "Служба безопасности",
  hr: "Отдел кадров",
  safety: "Охрана труда",
  safety_training: "Обучение и аттестация",
  permit_bureau: "Бюро пропусков",
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authMiddleware(req);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  const approval = await prisma.approvalRequest.findUnique({ where: { id } });
  if (!approval) {
    return NextResponse.json({ error: "Approval not found" }, { status: 404 });
  }

  if (approval.status !== "pending") {
    return NextResponse.json({ error: "Approval already decided" }, { status: 400 });
  }

  // Department match required
  if (authResult.user.department && approval.department !== authResult.user.department) {
    if (authResult.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden: not your department" }, { status: 403 });
    }
  }

  try {
    const body = await req.json();
    const validation = decideApprovalSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
    }

    // Reject requires a comment
    if (validation.data.status === "rejected" && !validation.data.comment?.trim()) {
      return NextResponse.json({ error: "Comment required for rejection" }, { status: 400 });
    }

    const updated = await prisma.approvalRequest.update({
      where: { id },
      data: {
        status: validation.data.status,
        comment: validation.data.comment,
        decidedAt: new Date(),
      },
      include: {
        employee: { select: { fullName: true, organizationId: true } },
      },
    });

    // Send email notification to contractor admin
    const org = await prisma.organization.findUnique({
      where: { id: updated.employee.organizationId },
      select: { name: true, id: true },
    });

    const contractorAdmins = await prisma.user.findMany({
      where: {
        isActive: true,
        organizationId: updated.employee.organizationId,
        role: { in: ["contractor_admin", "contractor_user"] },
      },
    });

    const deptLabel = DEPARTMENT_LABELS[approval.department] || approval.department;
    const employeeFullName = updated.employee.fullName;
    const orgName = org?.name || "";

    for (const admin of contractorAdmins) {
      await sendApprovalResult(
        admin.email,
        employeeFullName,
        orgName,
        deptLabel,
        validation.data.status,
        validation.data.comment ?? null,
        updated.employee.id,
      );
    }

    return NextResponse.json(updated);
  } catch (err) {
    console.error("Decide approval error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
