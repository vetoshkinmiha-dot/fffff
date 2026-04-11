import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
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

    // Create approval entries — all as "pending"
    // Sequential order is enforced in PATCH handler (autoRejectRemaining)
    const allRequests: Array<{
      employeeId: string;
      department: typeof APPROVAL_ORDER[number];
      deadline: Date;
      status: "pending";
    }> = APPROVAL_ORDER
      .filter((dept) => departments.includes(dept))
      .map((dept) => ({
        employeeId: id,
        department: dept,
        deadline: new Date(deadline),
        status: "pending" as const,
      }));

    // Check if any approvals already exist
    const existing = await prisma.approvalRequest.findMany({
      where: { employeeId: id },
      select: { department: true },
    });
    const existingDepts = new Set(existing.map((a) => a.department));
    const newRequests = allRequests.filter((r): r is NonNullable<typeof r> => !existingDepts.has(r.department));

    if (newRequests.length === 0) {
      return NextResponse.json({ error: "Approvals already exist for all departments" }, { status: 400 });
    }

    const requests = await prisma.approvalRequest.createManyAndReturn({
      data: newRequests,
    });

    // Send email only to the first pending department's approvers
    const firstPending = requests.find((r) => r.status === "pending");
    if (firstPending) {
      const approvers = await prisma.user.findMany({
        where: {
          isActive: true,
          department: firstPending.department,
        },
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
      }
    }

    return NextResponse.json(requests, { status: 201 });
  } catch (err) {
    console.error("Create approval error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
