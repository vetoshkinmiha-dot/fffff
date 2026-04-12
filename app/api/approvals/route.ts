import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authMiddleware } from "@/lib/api-middleware";

export async function GET(req: NextRequest) {
  const authResult = await authMiddleware(req);
  if (authResult instanceof NextResponse) return authResult;

  const { searchParams } = new URL(req.url);
  const statusFilter = searchParams.get("status");

  const role = authResult.user.role;

  // employee: no access to approvals
  if (role === "employee") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // contractor_employee: no decision capability — they just view status
  if (role === "contractor_employee") {
    // Return all approvals for employees of their organization
    const employees = await prisma.employee.findMany({
      where: { organizationId: authResult.user.organizationId! },
      select: { id: true },
    });
    const employeeIds = employees.map((e) => e.id);

    const where: any = { employeeId: { in: employeeIds } };
    if (statusFilter && statusFilter !== "all") {
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

  // department_approver: only pending approvals of their department
  if (role === "department_approver") {
    const where: any = {
      department: authResult.user.department,
      status: "pending",
    };

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

  // admin: see all approvals
  const where: any = {};
  if (statusFilter && statusFilter !== "all") {
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
