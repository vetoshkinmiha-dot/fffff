import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authMiddleware } from "@/lib/api-middleware";
import { createApprovalSchema } from "@/lib/validations";
import { sendApprovalNotification } from "@/lib/email";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authMiddleware(req);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  // Check employee exists and enforce org-scoping for contractors
  const employee = await prisma.employee.findUnique({ where: { id } });
  if (!employee) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }

  if (
    authResult.user.role === "contractor_admin" ||
    authResult.user.role === "contractor_user"
  ) {
    if (employee.organizationId !== authResult.user.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const approvals = await prisma.approvalRequest.findMany({
    where: { employeeId: id },
    orderBy: { createdAt: "desc" },
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

  try {
    const body = await req.json();
    const validation = createApprovalSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
    }

    const { departments, deadline } = validation.data;

    const requests = await prisma.approvalRequest.createManyAndReturn({
      data: departments.map((dept) => ({
        employeeId: id,
        department: dept,
        deadline: new Date(deadline),
      })),
    });

    // Send email notifications to approvers
    const approvers = await prisma.user.findMany({
      where: {
        isActive: true,
        department: { in: departments },
      },
    });

    for (const approver of approvers) {
      await sendApprovalNotification(
        approver.email,
        approver.fullName,
        employee.fullName,
        employee.organization.name,
        departments.join(", "),
        deadline,
      );
    }

    return NextResponse.json(requests, { status: 201 });
  } catch (err) {
    console.error("Create approval error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
