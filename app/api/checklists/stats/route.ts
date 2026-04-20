import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authMiddleware } from "@/lib/api-middleware";

export async function GET(req: NextRequest) {
  const authResult = await authMiddleware(req);
  if (authResult instanceof NextResponse) return authResult;

  const { searchParams } = new URL(req.url);
  const contractorId = searchParams.get("contractorId");

  // Admin can view stats for all contractors; others only for their org
  const where: any = {};
  if (contractorId) {
    where.contractorId = contractorId;
  } else if (authResult.user.role !== "admin" && authResult.user.organizationId) {
    where.contractorId = authResult.user.organizationId;
  }

  const [total, passed, failed, inProgress, allWithScore, checklists] = await Promise.all([
    prisma.checklist.count({ where }),
    prisma.checklist.count({ where: { ...where, status: "passed" } }),
    prisma.checklist.count({ where: { ...where, status: "failed" } }),
    prisma.checklist.count({ where: { ...where, status: "in_progress" } }),
    prisma.checklist.findMany({
      where: { ...where, score: { not: null } },
      select: { score: true },
    }),
    // Fetch last 12 checklists for monthly trend
    prisma.checklist.findMany({
      where,
      select: { date: true, score: true, status: true, inspectorName: true },
      orderBy: { date: "desc" },
      take: 12,
    }),
  ]);

  const avgScore =
    allWithScore.length > 0
      ? Math.round(allWithScore.reduce((sum, c) => sum + (c.score ?? 0), 0) / allWithScore.length)
      : 0;

  // Monthly trend: group by month
  const monthlyData: Record<string, { total: number; avgScore: number; passRate: number }> = {};
  const now = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthlyData[key] = { total: 0, avgScore: 0, passRate: 0 };
  }

  // Gather all items for top-failed analysis
  const itemFailCounts: Record<string, { question: string; failCount: number; totalCount: number }> = {};

  for (const cl of checklists) {
    const monthKey = `${cl.date.getFullYear()}-${String(cl.date.getMonth() + 1).padStart(2, "0")}`;
    if (monthlyData[monthKey]) {
      monthlyData[monthKey].total += 1;
      const arr = monthlyData[monthKey] as any;
      if (cl.score !== null) {
        arr._scoreSum = (arr._scoreSum || 0) + cl.score;
        arr._scoreCount = (arr._scoreCount || 0) + 1;
      }
      if (cl.status === "passed") {
        arr.passed = (arr.passed || 0) + 1;
      }
    }
  }

  // Fetch items for top-failed analysis
  const allItems = await prisma.checklistItem.findMany({
    where: { checklist: { contractorId } },
    select: { question: true, answer: true },
  });

  for (const item of allItems) {
    if (!itemFailCounts[item.question]) {
      itemFailCounts[item.question] = { question: item.question, failCount: 0, totalCount: 0 };
    }
    itemFailCounts[item.question].totalCount += 1;
    if (item.answer === "fail") {
      itemFailCounts[item.question].failCount += 1;
    }
  }

  // Compute monthly aggregates
  const monthlyTrend = Object.entries(monthlyData)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => {
      const arr = data as any;
      const scoreAvg = arr._scoreCount ? Math.round(arr._scoreSum / arr._scoreCount) : 0;
      const pr = data.total ? Math.round(((arr.passed || 0) / data.total) * 100) : 0;
      return {
        month,
        total: data.total,
        avgScore: scoreAvg,
        passRate: pr,
      };
    });

  // Top 5 most-failed items
  const topFailed = Object.values(itemFailCounts)
    .filter((i) => i.failCount > 0)
    .sort((a, b) => b.failCount - a.failCount)
    .slice(0, 5)
    .map((i) => ({
      question: i.question,
      failCount: i.failCount,
      totalCount: i.totalCount,
      failRate: Math.round((i.failCount / i.totalCount) * 100),
    }));

  // Recent inspections
  const recentInspections = checklists.slice(0, 5).map((cl) => ({
    date: cl.date.toISOString(),
    score: cl.score,
    status: cl.status,
    inspector: cl.inspectorName,
  }));

  return NextResponse.json({
    total,
    passed,
    failed,
    inProgress,
    avgScore,
    monthlyTrend,
    topFailed,
    recentInspections,
  });
}
