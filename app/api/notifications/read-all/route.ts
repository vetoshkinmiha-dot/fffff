import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authMiddleware } from "@/lib/api-middleware";

export async function PATCH(req: NextRequest) {
  const authResult = await authMiddleware(req);
  if (authResult instanceof NextResponse) return authResult;

  await prisma.notification.updateMany({
    where: { userId: authResult.user.userId, isRead: false },
    data: { isRead: true },
  });

  return NextResponse.json({ success: true });
}
