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
  }

  results.push({ action: "expired", count: expiredPermits.length });

  return NextResponse.json({ processed: results, timestamp: now.toISOString() });
}
