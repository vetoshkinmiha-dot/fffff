import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authMiddleware } from "@/lib/api-middleware";
import { decideApprovalSchema } from "@/lib/validations";
import { sendApprovalResult, sendApprovalNotification } from "@/lib/email";

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

async function notifyNextApproval(employeeId: string, currentDept: string) {
  const currentIndex = APPROVAL_ORDER.indexOf(currentDept as any);
  if (currentIndex === -1 || currentIndex >= APPROVAL_ORDER.length - 1) return;

  const nextDept = APPROVAL_ORDER[currentIndex + 1];

  // Next approvals are already in "pending" status — just notify approvers
  const nextApproval = await prisma.approvalRequest.findFirst({
    where: {
      employeeId,
      department: nextDept,
      status: "pending",
    },
  });

  if (nextApproval) {
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: { organization: { select: { name: true } } },
    });

    if (employee) {
      const approvers = await prisma.user.findMany({
        where: { isActive: true, department: nextDept },
      });

      const deadline = nextApproval.deadline.toISOString();
      for (const approver of approvers) {
        await sendApprovalNotification(
          approver.email,
          approver.fullName,
          employee.fullName,
          employee.organization.name,
          nextDept,
          deadline,
        );
      }
    }
  }
}

async function autoRejectRemaining(employeeId: string, currentDept: string) {
  const currentIndex = APPROVAL_ORDER.indexOf(currentDept as any);
  if (currentIndex === -1) return;

  const remainingDepts = APPROVAL_ORDER.slice(currentIndex + 1);
  if (remainingDepts.length === 0) return;

  await prisma.approvalRequest.updateMany({
    where: {
      employeeId,
      department: { in: remainingDepts as unknown as typeof APPROVAL_ORDER[number][] },
      status: "pending",
    },
    data: {
      status: "rejected",
      comment: "Автоматически отклонено в связи с отклонением предыдущего этапа",
      decidedAt: new Date(),
    },
  });
}

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
    return NextResponse.json({ error: "Approval already decided or blocked" }, { status: 400 });
  }

  // Department match required
  if (authResult.user.department && approval.department !== authResult.user.department) {
    if (authResult.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden: not your department" }, { status: 403 });
    }
  }

  // Sequential check: previous department must be approved
  const currentIdx = APPROVAL_ORDER.indexOf(approval.department as any);
  if (currentIdx > 0) {
    const prevDept = APPROVAL_ORDER[currentIdx - 1];
    const prevApproval = await prisma.approvalRequest.findFirst({
      where: {
        employeeId: approval.employeeId,
        department: prevDept,
        status: "approved",
      },
    });

    if (!prevApproval) {
      return NextResponse.json({
        error: `Сначала необходимо согласование от ${DEPARTMENT_LABELS[prevDept] || prevDept}`,
      }, { status: 400 });
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
        employee: { select: { id: true, fullName: true, organizationId: true } },
      },
    });

    // If approved — unblock next department
    if (validation.data.status === "approved") {
      await notifyNextApproval(updated.employeeId, approval.department);
    }

    // If rejected — auto-reject remaining
    if (validation.data.status === "rejected") {
      await autoRejectRemaining(updated.employeeId, approval.department);
    }

    // Send email notification to contractor admin
    const org = await prisma.organization.findUnique({
      where: { id: updated.employee.organizationId },
      select: { name: true, id: true },
    });

    const contractorAdmins = await prisma.user.findMany({
      where: {
        isActive: true,
        organizationId: updated.employee.organizationId,
        role: "contractor_employee",
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
      // In-app notification
      await prisma.notification.create({
        data: {
          userId: admin.id,
          type: "approval_result",
          title: "Решение по согласованию",
          message: `${deptLabel}: ${validation.data.status === "approved" ? "Одобрено" : "Отклонено"} — ${employeeFullName}`,
          link: `/employees/${updated.employee.id}`,
        },
      });
    }

    // Notify organization owner (admin tied to this organization)
    const orgOwners = await prisma.user.findMany({
      where: {
        isActive: true,
        organizationId: updated.employee.organizationId,
        role: "admin",
      },
    });

    for (const owner of orgOwners) {
      await prisma.notification.create({
        data: {
          userId: owner.id,
          type: "approval_result",
          title: "Решение по согласованию",
          message: `${deptLabel}: ${validation.data.status === "approved" ? "Одобрено" : "Отклонено"} — ${employeeFullName}`,
          link: `/employees/${updated.employee.id}`,
        },
      });
    }

    return NextResponse.json(updated);
  } catch (err) {
    console.error("Decide approval error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
