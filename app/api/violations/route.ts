import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authMiddleware } from "@/lib/api-middleware";
import { createViolationSchema, paginationSchema } from "@/lib/validations";
import { createNotificationsForRole, notifyOrganizationContractors } from "@/lib/notifications";

// Admin, employee, department_approver can create violations; contractor roles cannot
function isAuthorizedForViolations(role: string): boolean {
  return role === "admin" || role === "employee" || role === "department_approver";
}

export async function GET(req: NextRequest) {
  const authResult = await authMiddleware(req);
  if (authResult instanceof NextResponse) return authResult;

  const { searchParams } = new URL(req.url);
  const q = paginationSchema.safeParse(Object.fromEntries(searchParams));
  if (!q.success) {
    return NextResponse.json({ error: "Invalid parameters: " + q.error.issues[0]?.message }, { status: 400 });
  }
  const query = q.data;
  const severity = searchParams.get("severity");
  const status = searchParams.get("status");
  const contractorId = searchParams.get("contractorId");
  const department = searchParams.get("department");

  const where: any = {};
  if (severity && severity !== "all") where.severity = severity;
  if (status && status !== "all") where.status = status;
  if (contractorId) where.contractorId = contractorId;
  if (department) where.department = department;

  // Contractor roles only see their own org's violations
  if (
    (authResult.user.role === "contractor_employee" || authResult.user.role === "contractor_admin") && authResult.user.organizationId
  ) {
    where.contractorId = authResult.user.organizationId;
  }

  // Employee (ВШЗ) only sees violations they created
  if (authResult.user.role === "employee") {
    where.createdById = authResult.user.userId;
  }

  // department_approver only sees violations they created
  if (authResult.user.role === "department_approver") {
    where.createdById = authResult.user.userId;
  }

  const [total, violations] = await Promise.all([
    prisma.violation.count({ where }),
    prisma.violation.findMany({
      where,
      include: {
        contractor: { select: { name: true, sequentialNumber: true } },
        createdBy: { select: { fullName: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
  ]);

  return NextResponse.json({
    data: violations,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      pages: Math.ceil(total / query.limit),
    },
  });
}

export async function POST(req: NextRequest) {
  const authResult = await authMiddleware(req);
  if (authResult instanceof NextResponse) return authResult;

  if (!isAuthorizedForViolations(authResult.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const validation = createViolationSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
    }

    const violation = await prisma.$transaction(async (tx) => {
      const maxSeq = await tx.violation.aggregate({
        _max: { sequentialNumber: true },
      });
      const nextSeq = (maxSeq._max.sequentialNumber ?? 0) + 1;
      const violationNumber = `VIO-${String(nextSeq).padStart(5, "0")}`;

      return tx.violation.create({
        data: {
          ...validation.data,
          violationNumber,
          date: new Date(validation.data.date),
          sequentialNumber: nextSeq,
          createdById: authResult.user.userId,
        },
        include: {
          contractor: { select: { name: true } },
          createdBy: { select: { fullName: true } },
        },
      });
    }, { isolationLevel: "Serializable" });

    // Notify admin users about the new violation
    await createNotificationsForRole("admin", {
      type: "violation_created",
      title: "Новое нарушение",
      message: `Создан акт ${violation.violationNumber}`,
      link: `/violations/${violation.id}`,
    });

    // Notify all contractor employees and admins of the affected organization
    await notifyOrganizationContractors(violation.contractorId, {
      type: "violation_created",
      title: "Создан акт о нарушении",
      message: `На вашу организацию создан акт ${violation.violationNumber}`,
      link: `/violations/${violation.id}`,
    });

    return NextResponse.json(violation, { status: 201 });
  } catch (err) {
    console.error("Create violation error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
