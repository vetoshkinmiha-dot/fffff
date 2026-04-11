import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authMiddleware } from "@/lib/api-middleware";

export async function GET(req: NextRequest) {
  const authResult = await authMiddleware(req);
  if (authResult instanceof NextResponse) return authResult;

  const { searchParams } = new URL(req.url);
  const statusFilter = searchParams.get("status");

  // Admin sees all. Users without department get 403.
  if (authResult.user.role !== "admin" && !authResult.user.department) {
    return NextResponse.json({ error: "Forbidden: no department assigned" }, { status: 403 });
  }

  const where: any = {};
  if (authResult.user.department && authResult.user.role !== "admin") {
    where.department = authResult.user.department;
  }
  if (statusFilter) {
    where.status = statusFilter;
  }

  const approvals = await prisma.approvalRequest.findMany({
    where,
    include: {
      employee: {
        select: {
          fullName: true,
          organization: { select: { name: true } },
        },
      },
    },
    orderBy: { deadline: "asc" },
  });

  return NextResponse.json({ data: approvals });
}
