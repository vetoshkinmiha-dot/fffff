import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { createNotification } from "@/lib/notifications";

const CRON_SECRET = process.env.CRON_SECRET;

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const warningThreshold = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const results: Array<{ action: string; count: number }> = [];

  // Find active permits expiring within 30 days that haven't been warned yet
  // We use a subquery to exclude permits that already have a permit_expiring notification
  // from this cron run (to avoid duplicate notifications)
  const expiringPermits = await prisma.permit.findMany({
    where: {
      expiryDate: { lte: warningThreshold, gt: now },
      status: "active",
    },
    include: {
      contractor: { select: { name: true } },
    },
  });

  let warnedCount = 0;

  for (const permit of expiringPermits) {
    // Check if we already sent a warning for this permit in the last 24 hours
    const recentWarning = await prisma.notification.findFirst({
      where: {
        type: "permit_expiring",
        title: "Наряд-допуск истекает — предупреждение",
        link: `/permits/${permit.id}`,
        createdAt: { gt: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
      },
    });

    if (recentWarning) {
      continue;
    }

    // Get contractor users and admins to notify
    const targetUsers = await prisma.user.findMany({
      where: {
        isActive: true,
        organizationId: permit.contractorId,
        role: { in: ["contractor_employee", "employee", "admin"] },
      },
    });

    for (const user of targetUsers) {
      // In-app notification
      await createNotification({
        userId: user.id,
        type: "permit_expiring",
        title: "Наряд-допуск истекает — предупреждение",
        message: `Наряд ${permit.permitNumber} для ${permit.contractor.name} истекает ${permit.expiryDate.toLocaleDateString("ru-RU")}. Обновите или закройте наряд.`,
        link: `/permits/${permit.id}`,
      });

      // Email notification
      try {
        const expiryStr = permit.expiryDate.toLocaleDateString("ru-RU");
        await sendEmail(
          user.email,
          `Предупреждение: наряд-допуск ${permit.permitNumber} истекает ${expiryStr}`,
          `
            <p>Здравствуйте!</p>
            <p>Наряд-допуск <strong>${permit.permitNumber}</strong> (${permit.contractor.name}) истекает <strong>${expiryStr}</strong>.</p>
            <p>Пожалуйста, своевременно обновите или закройте наряд-допуск.</p>
            <p><a href="${process.env.APP_URL || "http://localhost:3000"}/permits/${permit.id}">Перейти к наряду-допуску</a></p>
          `,
        );

        await prisma.emailLog.create({
          data: {
            recipient: user.email,
            subject: `Предупреждение: наряд-допуск ${permit.permitNumber} истекает ${expiryStr}`,
            template: "permit_expiry_warning",
            status: "SENT",
            sentAt: new Date(),
          },
        });
      } catch (err: any) {
        await prisma.emailLog.create({
          data: {
            recipient: user.email,
            subject: `Предупреждение: наряд-допуск ${permit.permitNumber} истекает`,
            template: "permit_expiry_warning",
            status: "FAILED",
            error: err.message,
          },
        });
      }
    }

    warnedCount++;
  }

  results.push({ action: "warning_30_days", count: warnedCount });

  return NextResponse.json({ processed: results, timestamp: now.toISOString() });
}
