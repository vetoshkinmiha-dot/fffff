import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authMiddleware } from "@/lib/api-middleware";

export async function GET(req: NextRequest) {
  const authResult = await authMiddleware(req);
  if (authResult instanceof NextResponse) return authResult;

  const user = authResult.user;
  const notifications: Array<{
    id: string;
    type: string;
    title: string;
    message: string;
    link: string;
    createdAt: string;
    read: boolean;
  }> = [];

  // Factory roles: pending approvals in their department
  if (user.department && !["admin"].includes(user.role)) {
    const pendingApprovals = await prisma.approvalRequest.findMany({
      where: {
        department: user.department as any,
        status: "pending",
      },
      include: {
        employee: {
          select: { fullName: true, id: true },
        },
      },
      orderBy: { deadline: "asc" },
      take: 20,
    });

    for (const approval of pendingApprovals) {
      notifications.push({
        id: `approval_${approval.id}`,
        type: "approval_pending",
        title: "Новое согласование",
        message: `${approval.employee.fullName} — ${departmentLabel(approval.department)}`,
        link: `/approvals`,
        createdAt: approval.createdAt.toISOString(),
        read: false,
      });
    }
  }

  // Contractor employee: expiring documents in their organization
  if (user.role === "contractor_employee" && user.organizationId) {
    const now = new Date();
    const threshold = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const expiringDocs = await prisma.employeeDocument.findMany({
      where: {
        status: { in: ["expiring", "expired"] },
        expiryDate: { lte: threshold },
        employee: { organizationId: user.organizationId },
      },
      include: {
        employee: {
          select: { fullName: true, id: true },
        },
      },
      orderBy: { expiryDate: "asc" },
      take: 20,
    });

    for (const doc of expiringDocs) {
      const isExpired = doc.expiryDate && doc.expiryDate < now;
      notifications.push({
        id: `doc_${doc.id}`,
        type: "document_expiring",
        title: isExpired ? "Документ истёк" : "Документ истекает",
        message: `${doc.employee.fullName} — ${doc.name}${doc.expiryDate ? ` (до ${doc.expiryDate.toLocaleDateString("ru-RU")})` : ""}`,
        link: `/employees/${doc.employee.id}`,
        createdAt: doc.createdAt.toISOString(),
        read: false,
      });
    }
  }

  // Stored notifications from the database (checklist_assigned, approval_result, etc.)
  const storedNotifications = await prisma.notification.findMany({
    where: { userId: user.userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  for (const n of storedNotifications) {
    notifications.push({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      link: n.link ?? "",
      createdAt: n.createdAt.toISOString(),
      read: n.isRead,
    });
  }

  return NextResponse.json(notifications);
}

export async function POST(req: NextRequest) {
  const authResult = await authMiddleware(req);
  if (authResult instanceof NextResponse) return authResult;

  await prisma.notification.updateMany({
    where: { userId: authResult.user.userId, isRead: false },
    data: { isRead: true },
  });

  return NextResponse.json({ success: true });
}

function departmentLabel(dept: string): string {
  const labels: Record<string, string> = {
    security: "Служба безопасности",
    hr: "Отдел кадров",
    safety: "Охрана труда",
    safety_training: "Обучение и аттестация",
    permit_bureau: "Бюро пропусков",
  };
  return labels[dept] || dept;
}
