import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const CRON_SECRET = process.env.CRON_SECRET;

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const results: Array<{ action: string; count: number }> = [];

  // Expire permits where expiryDate has passed and status is still active/approved
  const expiredPermits = await prisma.permit.findMany({
    where: {
      expiryDate: { lte: now },
      status: { in: ["active", "approved", "pending_approval"] },
    },
    include: {
      contractor: { select: { name: true } },
    },
  });

  for (const permit of expiredPermits) {
    await prisma.permit.update({
      where: { id: permit.id },
      data: { status: "expired" },
    });

    // Notify contractor employees and admins
    const targetUsers = await prisma.user.findMany({
      where: {
        isActive: true,
        organizationId: permit.contractorId,
        role: { in: ["contractor_employee", "admin"] },
      },
    });

    for (const user of targetUsers) {
      await prisma.notification.create({
        data: {
          userId: user.id,
          type: "permit_expiring",
          title: "Наряд-допуск истёк",
          message: `Наряд ${permit.permitNumber} для ${permit.contractor.name}`,
          link: `/permits/${permit.id}`,
        },
      });
    }
  }

  results.push({ action: "expired", count: expiredPermits.length });

  return NextResponse.json({ processed: results, timestamp: now.toISOString() });
}
