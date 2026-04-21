import { NextRequest, NextResponse } from "next/server";
import { prisma, $Enums } from "@/lib/prisma";
import { authMiddleware } from "@/lib/api-middleware";
import { z } from "zod";

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

const resubmitSchema = z.object({
  comment: z.string().min(1, "Комментарий обязателен"),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authMiddleware(req);
  if (authResult instanceof NextResponse) return authResult;

  // Only admin can resubmit permits
  if (authResult.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: permitId } = await params;

  const body = await req.json();
  const validation = resubmitSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
  }

  const { comment } = validation.data;

  // Fetch permit
  const permit = await prisma.permit.findUnique({
    where: { id: permitId },
    include: { contractor: { select: { name: true } } },
  });
  if (!permit) {
    return NextResponse.json({ error: "Наряд-допуск не найден" }, { status: 404 });
  }

  const deadline = new Date();
  deadline.setDate(deadline.getDate() + 14);

  // Get existing approvals or create full set
  const existingApprovals = await prisma.permitApproval.findMany({
    where: { permitId },
  });

  if (existingApprovals.length === 0) {
    await prisma.permitApproval.createMany({
      data: APPROVAL_ORDER.map((dept, idx) => ({
        permitId,
        department: dept,
        status: idx === 0 ? $Enums.ApprovalStatus.pending : $Enums.ApprovalStatus.blocked,
        deadline,
        comment,
      })),
    });
  } else {
    // Reset ALL to pending with resubmit comment
    await prisma.permitApproval.updateMany({
      where: { permitId },
      data: {
        status: $Enums.ApprovalStatus.pending,
        comment,
        decidedAt: null,
      },
    });

    // Block all except first stage
    const remainingDepts = APPROVAL_ORDER.slice(1);
    await prisma.permitApproval.updateMany({
      where: {
        permitId,
        department: { in: remainingDepts as unknown as typeof APPROVAL_ORDER[number][] },
      },
      data: {
        status: $Enums.ApprovalStatus.blocked,
      },
    });
  }

  // Set permit status to pending_approval
  await prisma.permit.update({
    where: { id: permitId },
    data: { status: $Enums.PermitStatus.pending_approval },
  });

  // Notify first-stage approvers
  const firstDept = APPROVAL_ORDER[0];
  const approvers = await prisma.user.findMany({
    where: { isActive: true, department: firstDept },
  });

  for (const approver of approvers) {
    await prisma.notification.create({
      data: {
        userId: approver.id,
        type: "approval_requested",
        title: "Повторное согласование наряда-допуска",
        message: `Наряд ${permit.permitNumber} (${permit.contractor.name}) — отправлен на согласование заново. Этап: ${DEPARTMENT_LABELS[firstDept]}`,
        link: "/approvals",
      },
    });
  }

  // Notify contractor users
  const contractorUsers = await prisma.user.findMany({
    where: {
      isActive: true,
      organizationId: permit.contractorId,
      role: { in: ["contractor_employee", "contractor_admin"] },
    },
  });

  for (const cu of contractorUsers) {
    await prisma.notification.create({
      data: {
        userId: cu.id,
        type: "approval_result",
        title: "Отправлено на согласование",
        message: `Наряд-допуск ${permit.permitNumber} отправлен на повторное согласование`,
        link: `/permits/${permitId}`,
      },
    });
  }

  return NextResponse.json({
    message: "Наряд-допуск отправлен на повторное согласование",
    permitId,
  });
}
