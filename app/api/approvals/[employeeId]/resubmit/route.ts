import { NextRequest, NextResponse } from "next/server";
import { prisma, $Enums } from "@/lib/prisma";
import { authMiddleware } from "@/lib/api-middleware";
import { z } from "zod";
import { sendApprovalNotification } from "@/lib/email";

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
  { params }: { params: Promise<{ employeeId: string }> }
) {
  const authResult = await authMiddleware(req);
  if (authResult instanceof NextResponse) return authResult;

  const { user } = authResult;

  // Only admin or contractor_admin can resubmit
  if (user.role !== "admin" && user.role !== "contractor_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { employeeId } = await params;

  const body = await req.json();
  const validation = resubmitSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
  }

  const { comment } = validation.data;

  // Fetch employee
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: { organization: { select: { name: true, id: true } } },
  });
  if (!employee) {
    return NextResponse.json({ error: "Сотрудник не найден" }, { status: 404 });
  }

  // contractor_admin can only resubmit employees from their own organization
  if (user.role === "contractor_admin" && employee.organizationId !== user.organizationId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const deadline = new Date();
  deadline.setDate(deadline.getDate() + 14); // 14 days from now

  // Get existing approvals or create full set
  const existingApprovals = await prisma.approvalRequest.findMany({
    where: { employeeId },
  });

  if (existingApprovals.length === 0) {
    // Create full set of 5 approval stages
    await prisma.approvalRequest.createMany({
      data: APPROVAL_ORDER.map((dept, idx) => ({
        employeeId,
        department: dept,
        status: idx === 0 ? $Enums.ApprovalStatus.pending : $Enums.ApprovalStatus.blocked,
        deadline,
        comment,
      })),
    });
  } else {
    // Reset ALL existing approvals: all to pending with the resubmit comment
    await prisma.approvalRequest.updateMany({
      where: { employeeId },
      data: {
        status: $Enums.ApprovalStatus.pending,
        comment,
        decidedAt: null,
      },
    });

    // Block all except the first stage (security)
    const remainingDepts = APPROVAL_ORDER.slice(1);
    await prisma.approvalRequest.updateMany({
      where: {
        employeeId,
        department: { in: remainingDepts as unknown as typeof APPROVAL_ORDER[number][] },
      },
      data: {
        status: $Enums.ApprovalStatus.blocked,
      },
    });
  }

  // Notify first-stage approvers (security)
  const firstDept = APPROVAL_ORDER[0];
  const approvers = await prisma.user.findMany({
    where: { isActive: true, department: firstDept },
  });

  for (const approver of approvers) {
    await sendApprovalNotification(
      approver.email,
      approver.fullName,
      employee.fullName,
      employee.organization.name,
      firstDept,
      deadline.toISOString(),
    );
    await prisma.notification.create({
      data: {
        userId: approver.id,
        type: "approval_requested",
        title: "Повторное согласование",
        message: `Сотрудник ${employee.fullName} (${employee.organization.name}) — отправлен на согласование заново. Этап: ${DEPARTMENT_LABELS[firstDept]}`,
        link: "/approvals",
      },
    });
  }

  // Notify contractor users about resubmit
  const contractorUsers = await prisma.user.findMany({
    where: {
      isActive: true,
      organizationId: employee.organizationId,
      role: { in: ["contractor_employee", "contractor_admin"] },
    },
  });

  for (const cu of contractorUsers) {
    await prisma.notification.create({
      data: {
        userId: cu.id,
        type: "approval_result",
        title: "Отправлено на согласование",
        message: `Сотрудник ${employee.fullName} отправлен на повторное согласование`,
        link: `/employees/${employeeId}`,
      },
    });
  }

  return NextResponse.json({
    message: "Сотрудник отправлен на повторное согласование",
    employeeId,
  });
}
