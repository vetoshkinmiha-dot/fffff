import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authMiddleware } from "@/lib/api-middleware";

export async function GET(req: NextRequest) {
  const authResult = await authMiddleware(req);
  if (authResult instanceof NextResponse) return authResult;

  const user = authResult.user;

  // Total contractors (organizations) — factory roles see all, contractors see their org
  let totalContractors: number;
  if (user.role === "contractor_admin" || user.role === "contractor_user") {
    totalContractors = user.organizationId ? 1 : 0;
  } else {
    totalContractors = await prisma.organization.count();
  }

  // Pending approvals for user's department (or 0 if no dept)
  let pendingApprovals = 0;
  if (user.department) {
    pendingApprovals = await prisma.approvalRequest.count({
      where: {
        department: user.department,
        status: "pending",
      },
    });
  }

  return NextResponse.json({
    totalContractors,
    activePermits: 0,
    pendingApprovals,
    monthlyViolations: 0,
  });
}
