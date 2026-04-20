import { NextRequest, NextResponse } from "next/server";
import { prisma, $Enums } from "@/lib/prisma";
import { authMiddleware } from "@/lib/api-middleware";
import { createApprovalSchema } from "@/lib/validations";
import { sendApprovalNotification } from "@/lib/email";

// Sequential approval order
const APPROVAL_ORDER = [
  "security",
  "hr",
  "safety",
  "safety_training",
  "permit_bureau",
] as const;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authMiddleware(req);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  const employee = await prisma.employee.findUnique({ where: { id } });
  if (!employee) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }

  if (
    (authResult.user.role === "contractor_employee" || authResult.user.role === "contractor_admin") && authResult.user.organizationId
  ) {
    if (employee.organizationId !== authResult.user.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const approvals = await prisma.approvalRequest.findMany({
    where: { employeeId: id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(approvals);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authMiddleware(req);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  const employee = await prisma.employee.findUnique({
    where: { id: id },
    include: { organization: { select: { name: true } } },
  });

  if (!employee) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }

  if (authResult.user.role !== "admin" && authResult.user.role !== "contractor_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (
    authResult.user.role === "contractor_admin" &&
    authResult.user.organizationId &&
    employee.organizationId !== authResult.user.organizationId
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const validation = createApprovalSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
    }

    const { departments, deadline } = validation.data;

    const existing = await prisma.approvalRequest.findMany({
      where: { employeeId: id },
      select: { department: true, status: true },
    });
    const existingDepts = new Set(existing.map((a) => a.department));

    const newDepts = APPROVAL_ORDER.filter((dept) => departments.includes(dept) && !existingDepts.has(dept));
    if (newDepts.length === 0) {
      return NextResponse.json({ error: "Approvals already exist for all requested departments" }, { status: 400 });
    }

    // Determine which of the new departments should be "pending" vs "blocked"
    const allPendingOrBlocked = existing.filter((e) => e.status === "pending" || e.status === "blocked");

    // Sort new departments by approval order
    const sortedNewDepts = [...newDepts].sort(
      (a, b) => APPROVAL_ORDER.indexOf(a as any) - APPROVAL_ORDER.indexOf(b as any)
    );

    const entries: Array<{
      employeeId: string;
      department: typeof APPROVAL_ORDER[number];
      deadline: Date;
      status: $Enums.ApprovalStatus;
    }> = [];

    for (const dept of sortedNewDepts) {
      const decidedDepts = new Set(
        existing.filter((e) => e.status === "approved" || e.status === "rejected").map((e) => e.department)
      );
      const pendingDepts = new Set(
        existing.filter((e) => e.status === "pending" || e.status === "blocked").map((e) => e.department)
      );

      const nextOpenDept = APPROVAL_ORDER.find(
        (d) => !decidedDepts.has(d) && !pendingDepts.has(d)
      );

      const status = nextOpenDept === dept
        ? $Enums.ApprovalStatus.pending
        : $Enums.ApprovalStatus.blocked;

      entries.push({
        employeeId: id,
        department: dept,
        deadline: new Date(deadline),
        status,
      });
    }

    const requests = await prisma.approvalRequest.createManyAndReturn({
      data: entries,
    });

    // Notify ONLY the first pending department's approvers
    const firstPending = requests.find((r) => r.status === "pending");
    if (firstPending) {
      const approvers = await prisma.user.findMany({
        where: { isActive: true, department: firstPending.department },
      });

      for (const approver of approvers) {
        await sendApprovalNotification(
          approver.email,
          approver.fullName,
          employee.fullName,
          employee.organization.name,
          firstPending.department,
          deadline,
        );
        await prisma.notification.create({
          data: {
            userId: approver.id,
            type: "approval_requested",
            title: "Новое согласование",
            message: `Сотрудник ${employee.fullName} (${employee.organization.name})`,
            link: "/approvals",
          },
        });
      }
    }

    return NextResponse.json(requests, { status: 201 });
  } catch (err) {
    console.error("Create approval error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
