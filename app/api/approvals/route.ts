import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authMiddleware } from "@/lib/api-middleware";

export async function GET(req: NextRequest) {
  const authResult = await authMiddleware(req);
  if (authResult instanceof NextResponse) return authResult;

  const { searchParams } = new URL(req.url);
  const statusFilter = searchParams.get("status");
  const typeFilter = searchParams.get("type"); // "employee" | "permit"

  const role = authResult.user.role;

  // employee: no access to approvals
  if (role === "employee") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // contractor_employee / contractor_admin: no decision capability — they just view status
  if (role === "contractor_employee" || role === "contractor_admin") {
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
            id: true,
            fullName: true,
            organization: { select: { name: true } },
          },
        },
      },
      orderBy: { deadline: "asc" },
    });

    return NextResponse.json({ data: approvals });
  }

  // department_approver: only pending approvals of their department (employee only, no permit access)
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
            id: true,
            fullName: true,
            organization: { select: { name: true } },
            position: true,
            workClasses: { select: { workClass: true } },
          },
        },
      },
      orderBy: { deadline: "asc" },
    });

    return NextResponse.json({ data: approvals });
  }

  // admin: see all approvals, with optional type filter
  if (typeFilter === "permit") {
    const permitsWhere: any = {};
    if (statusFilter && statusFilter !== "all") {
      permitsWhere.status = statusFilter;
    }

    const permits = await prisma.permit.findMany({
      where: permitsWhere,
      include: {
        contractor: { select: { id: true, name: true } },
        approvals: { orderBy: { createdAt: "asc" } },
      },
      orderBy: { openDate: "desc" },
    });

    return NextResponse.json({ data: permits });
  }

  // type=employee or not specified: return employee approvals
  const where: any = {};
  if (statusFilter && statusFilter !== "all") {
    where.status = statusFilter;
  }

  const approvals = await prisma.approvalRequest.findMany({
    where,
    include: {
      employee: {
        select: {
          id: true,
          fullName: true,
          organization: { select: { name: true } },
          position: true,
          workClasses: { select: { workClass: true } },
        },
      },
    },
    orderBy: { deadline: "asc" },
  });

  return NextResponse.json({ data: approvals });
}
