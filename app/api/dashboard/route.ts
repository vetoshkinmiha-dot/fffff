import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authMiddleware } from "@/lib/api-middleware";

export async function GET(req: NextRequest) {
  const authResult = await authMiddleware(req);
  if (authResult instanceof NextResponse) return authResult;

  const user = authResult.user;

  // Total contractors (organizations) — factory roles see all, contractors see their org
  let totalContractors: number;
  if ((user.role === "contractor_employee" || user.role === "contractor_admin") && user.organizationId) {
    totalContractors = 1;
  } else {
    totalContractors = await prisma.organization.count();
  }

  // Pending approvals — depends on role
  let pendingApprovals: number;
  if (user.role === "department_approver" && user.department) {
    // Approver sees only their department
    pendingApprovals = await prisma.approvalRequest.count({
      where: {
        department: user.department as any,
        status: "pending",
      },
    });
  } else if ((user.role === "contractor_employee" || user.role === "contractor_admin") && user.organizationId) {
    // Contractor sees approvals for their org's employees
    const empIds = (await prisma.employee.findMany({
      where: { organizationId: user.organizationId },
      select: { id: true },
    })).map((e) => e.id);
    pendingApprovals = empIds.length > 0
      ? await prisma.approvalRequest.count({ where: { employeeId: { in: empIds }, status: "pending" } })
      : 0;
  } else {
    // Admin sees all pending approvals
    pendingApprovals = await prisma.approvalRequest.count({
      where: { status: "pending" },
    });
  }

  // Active permits or total employees — depends on role
  let activePermits: number;
  if (user.role === "department_approver") {
    // Approvers see total employees count
    activePermits = await prisma.employee.count();
  } else if ((user.role === "contractor_employee" || user.role === "contractor_admin") && user.organizationId) {
    activePermits = await prisma.permit.count({
      where: {
        contractorId: user.organizationId,
        status: { in: ["active", "pending_approval"] },
      },
    });
  } else {
    activePermits = await prisma.permit.count({
      where: {
        status: { in: ["active", "pending_approval"] },
      },
    });
  }

  // Violations this month
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  let monthlyViolations: number;
  if ((user.role === "contractor_employee" || user.role === "contractor_admin") && user.organizationId) {
    monthlyViolations = await prisma.violation.count({
      where: {
        contractorId: user.organizationId,
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
