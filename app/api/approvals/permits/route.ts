import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authMiddleware } from "@/lib/api-middleware";

export async function GET(req: NextRequest) {
  const authResult = await authMiddleware(req);
  if (authResult instanceof NextResponse) return authResult;

  // Only admin can access permit approvals
  if (authResult.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const statusFilter = searchParams.get("status");

  const where: any = {};
  if (statusFilter && statusFilter !== "all") {
    where.status = statusFilter;
  }

  const permits = await prisma.permit.findMany({
    where,
    include: {
      contractor: { select: { id: true, name: true } },
      approvals: {
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { openDate: "desc" },
  });

  return NextResponse.json({ data: permits });
}
