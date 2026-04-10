import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authMiddleware } from "@/lib/api-middleware";

export async function GET(req: NextRequest) {
  const authResult = await authMiddleware(req);
  if (authResult instanceof NextResponse) return authResult;

  const { searchParams } = new URL(req.url);
  const contractorId = searchParams.get("contractorId");

  if (!contractorId) {
    return NextResponse.json({ error: "contractorId is required" }, { status: 400 });
  }

  const where: any = { contractorId };

  const [total, passed, failed, allWithScore] = await Promise.all([
    prisma.checklist.count({ where }),
    prisma.checklist.count({ where: { ...where, status: "passed" } }),
    prisma.checklist.count({ where: { ...where, status: "failed" } }),
    prisma.checklist.findMany({
      where: { ...where, score: { not: null } },
      select: { score: true },
    }),
  ]);

  const avgScore =
    allWithScore.length > 0
      ? Math.round(allWithScore.reduce((sum, c) => sum + (c.score ?? 0), 0) / allWithScore.length)
      : 0;

  return NextResponse.json({
    total,
    passed,
    failed,
    avgScore,
  });
}
