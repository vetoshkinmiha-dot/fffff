import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authMiddleware } from "@/lib/api-middleware";

export async function GET(req: NextRequest) {
  const authResult = await authMiddleware(req);
  if (authResult instanceof NextResponse) return authResult;

  const user = authResult.user;

  // Total contractors (organizations) — factory roles see all, contractors see their org
  let totalContractors: number;
  if (user.role === "contractor_employee") {
    totalContractors = user.organizationId ? 1 : 0;
  } else {
    totalContractors = await prisma.organization.count();
  }

  // Pending approvals for user's department (or 0 if no dept)
  let pendingApprovals = 0;
  if (user.department) {
    pendingApprovals = await prisma.approvalRequest.count({
      where: {
        department: user.department as any,
        status: "pending",
      },
    });
  }

  // Active permits — permits with status 'active' or 'approved'
  let activePermits: number;
  if (user.role === "contractor_employee") {
    activePermits = await prisma.permit.count({
      where: {
        contractorId: user.organizationId ?? "",
        status: { in: ["active", "approved"] },
      },
    });
  } else {
    activePermits = await prisma.permit.count({
      where: {
        status: { in: ["active", "approved"] },
      },
    });
  }

  // Violations this month
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  let monthlyViolations: number;
  if (user.role === "contractor_employee") {
    monthlyViolations = await prisma.violation.count({
      where: {
        contractorId: user.organizationId ?? "",
        createdAt: { gte: startOfMonth, lte: endOfMonth },
      },
    });
  } else {
    monthlyViolations = await prisma.violation.count({
      where: {
        createdAt: { gte: startOfMonth, lte: endOfMonth },
      },
    });
  }

  return NextResponse.json({
    totalContractors,
    activePermits,
    pendingApprovals,
    monthlyViolations,
  });
}
