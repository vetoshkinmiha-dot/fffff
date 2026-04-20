import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail, sendDocumentExpiryAlert } from "@/lib/email";
import { createNotification } from "@/lib/notifications";

const CRON_SECRET = process.env.CRON_SECRET;

export async function POST(req: NextRequest) {
  if (!CRON_SECRET || CRON_SECRET.length < 16) {
    console.error('CRON_SECRET is not configured or too short');
    return NextResponse.json({ error: 'Cron endpoints unavailable' }, { status: 503 });
  }

  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const expiringThreshold = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const results: Array<{ action: string; count: number }> = [];

  // 1. Mark expiring docs (valid → expiring)
  const expiringDocs = await prisma.employeeDocument.findMany({
    where: {
      expiryDate: { lte: expiringThreshold, gt: now },
      status: "valid",
    },
    include: {
      employee: {
        select: {
          id: true,
          fullName: true,
          organizationId: true,
        },
      },
    },
  });

  for (const doc of expiringDocs) {
    await prisma.employeeDocument.update({
      where: { id: doc.id },
      data: { status: "expiring" },
    });

    // Email contractor admin
    const admins = await prisma.user.findMany({
      where: {
        isActive: true,
        organizationId: doc.employee.organizationId,
        role: { in: ["contractor_employee", "admin"] },
      },
    });

    for (const admin of admins) {
      try {
        await sendDocumentExpiryAlert(
          admin.email,
          doc.employee.fullName,
          doc.name,
          doc.expiryDate!.toISOString(),
        );

        await prisma.emailLog.create({
          data: {
            recipient: admin.email,
            subject: `Истекает срок документа — ${doc.employee.fullName}`,
            template: "document_expiry_expiring",
            status: "SENT",
            sentAt: new Date(),
          },
        });
      } catch (err: any) {
        await prisma.emailLog.create({
          data: {
            recipient: admin.email,
            subject: `Истекает срок документа — ${doc.employee.fullName}`,
            template: "document_expiry_expiring",
            status: "FAILED",
            error: err.message,
          },
        });
      }

      // In-app notification
      await createNotification({
        userId: admin.id,
        type: "document_expiring",
        title: "Истекает документ",
        message: `${doc.employee.fullName} — ${doc.name}`,
        link: `/employees/${doc.employee.id}`,
      });
    }
  }
  results.push({ action: "expiring", count: expiringDocs.length });

  // 2. Mark expired docs (expiring/valid → expired)
  const expiredDocs = await prisma.employeeDocument.findMany({
    where: {
      expiryDate: { lte: now },
      status: { not: "expired" },
    },
    include: {
      employee: {
        select: {
          id: true,
          fullName: true,
          organizationId: true,
        },
      },
    },
  });

  for (const doc of expiredDocs) {
    await prisma.employeeDocument.update({
      where: { id: doc.id },
      data: { status: "expired" },
    });

    // Email contractor employees
    const admins = await prisma.user.findMany({
      where: {
        isActive: true,
        organizationId: doc.employee.organizationId,
        role: { in: ["contractor_employee", "admin"] },
      },
    });

    for (const user of admins) {
      try {
        await sendDocumentExpiryAlert(
          user.email,
          doc.employee.fullName,
          doc.name,
          doc.expiryDate!.toISOString(),
        );

        await prisma.emailLog.create({
          data: {
            recipient: user.email,
            subject: `Истёк срок документа — ${doc.employee.fullName}`,
            template: "document_expiry_expired",
            status: "SENT",
            sentAt: new Date(),
          },
        });
      } catch (err: any) {
        await prisma.emailLog.create({
          data: {
            recipient: user.email,
            subject: `Истёк срок документа — ${doc.employee.fullName}`,
            template: "document_expiry_expired",
            status: "FAILED",
            error: err.message,
          },
        });
      }

      // In-app notification
      await createNotification({
        userId: user.id,
        type: "document_expired",
        title: "Документ истёк",
        message: `${doc.employee.fullName} — ${doc.name}`,
        link: `/employees/${doc.employee.id}`,
      });
    }
  }
  results.push({ action: "expired", count: expiredDocs.length });

  return NextResponse.json({ processed: results, timestamp: now.toISOString() });
}
