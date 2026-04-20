import { NextRequest, NextResponse } from "next/server";
import { prisma, $Enums } from "@/lib/prisma";
import { authMiddleware } from "@/lib/api-middleware";
import { decideApprovalSchema } from "@/lib/validations";

const APPROVAL_ORDER = [
  "security",
  "hr",
  "safety",
  "safety_training",
  "permit_bureau",
] as const;

const DEPARTMENT_LABELS: Record<string, string> = {
  security: "Служба безопасности",
  hr: "Отдел кадров",
  safety: "Охрана труда",
  safety_training: "Обучение и аттестация",
  permit_bureau: "Бюро пропусков",
};

async function unblockNextPermitApproval(permitId: string, currentDept: string) {
  const currentIndex = APPROVAL_ORDER.indexOf(currentDept as any);
  if (currentIndex === -1 || currentIndex >= APPROVAL_ORDER.length - 1) return;

  const nextDept = APPROVAL_ORDER[currentIndex + 1];

  const nextApproval = await prisma.permitApproval.findFirst({
    where: {
      permitId,
      department: nextDept,
      status: $Enums.ApprovalStatus.blocked,
    },
  });

  if (nextApproval) {
    await prisma.permitApproval.update({
      where: { id: nextApproval.id },
      data: { status: $Enums.ApprovalStatus.pending },
    });

    const permit = await prisma.permit.findUnique({
      where: { id: permitId },
      include: { contractor: { select: { name: true } } },
    });

    if (permit) {
      const approvers = await prisma.user.findMany({
        where: { isActive: true, department: nextDept },
      });

      for (const approver of approvers) {
        await prisma.notification.create({
          data: {
            userId: approver.id,
            type: "approval_requested",
            title: "Новое согласование наряда-допуска",
            message: `Наряд ${permit.permitNumber} (${permit.contractor.name}) — этап: ${DEPARTMENT_LABELS[nextDept]}`,
            link: "/approvals",
          },
        });
      }
    }
  }
}

async function autoRejectRemainingPermits(permitId: string, currentDept: string) {
  const currentIndex = APPROVAL_ORDER.indexOf(currentDept as any);
  if (currentIndex === -1) return;

  const remainingDepts = APPROVAL_ORDER.slice(currentIndex + 1);
  if (remainingDepts.length === 0) return;

  await prisma.permitApproval.updateMany({
    where: {
      permitId,
      department: { in: remainingDepts as unknown as typeof APPROVAL_ORDER[number][] },
      status: { in: [$Enums.ApprovalStatus.pending, $Enums.ApprovalStatus.blocked] },
    },
    data: {
      status: $Enums.ApprovalStatus.rejected,
      comment: "Автоматически отклонено в связи с отклонением предыдущего этапа",
      decidedAt: new Date(),
    },
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ approvalId: string }> }
) {
  const authResult = await authMiddleware(req);
  if (authResult instanceof NextResponse) return authResult;

  const { approvalId } = await params;

  // Only admin can resolve permit approvals from this route
  if (authResult.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const approval = await prisma.permitApproval.findUnique({
    where: { id: approvalId },
    include: { permit: { include: { contractor: { select: { name: true } } } } },
  });

  if (!approval) {
    return NextResponse.json({ error: "Approval not found" }, { status: 404 });
  }

  if (approval.status !== "pending") {
    return NextResponse.json({ error: "Approval already decided or blocked" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const validation = decideApprovalSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
    }

    if (validation.data.status === "rejected" && !validation.data.comment?.trim()) {
      return NextResponse.json({ error: "Comment required for rejection" }, { status: 400 });
    }

    const updated = await prisma.permitApproval.update({
      where: { id: approvalId },
      data: {
        status: validation.data.status,
        comment: validation.data.comment,
        decidedAt: new Date(),
      },
    });

    const permitId = approval.permitId;

    if (validation.data.status === "approved") {
      await unblockNextPermitApproval(permitId, approval.department);

      // Check if all approvals are approved -> set permit to active
      const allApprovals = await prisma.permitApproval.findMany({
        where: { permitId },
      });

      const allApproved = allApprovals.every((a) => a.status === "approved");
      if (allApproved && allApprovals.length > 0) {
        await prisma.permit.update({
          where: { id: permitId },
          data: { status: $Enums.PermitStatus.active },
        });
      }
    }

    if (validation.data.status === "rejected") {
      await autoRejectRemainingPermits(permitId, approval.department);
      await prisma.permit.update({
        where: { id: permitId },
        data: { status: $Enums.PermitStatus.closed },
      });
    }

    // Notify contractor users of the decision
    const contractorUsers = await prisma.user.findMany({
      where: {
        isActive: true,
        organizationId: approval.permit.contractorId,
        role: { in: ["contractor_employee", "contractor_admin"] },
      },
    });

    const deptLabel = DEPARTMENT_LABELS[approval.department] || approval.department;
    const statusLabel = validation.data.status === "approved" ? "Одобрено" : "Отклонено";
    const permitNumber = approval.permit.permitNumber;

    for (const user of contractorUsers) {
      await prisma.notification.create({
        data: {
          userId: user.id,
          type: "approval_result",
          title: "Решение по согласованию наряда-допуска",
          message: `${deptLabel}: ${statusLabel} — наряд ${permitNumber}`,
          link: `/permits/${permitId}`,
        },
      });
    }

    return NextResponse.json(updated);
  } catch (err) {
    console.error("Decide permit approval error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
