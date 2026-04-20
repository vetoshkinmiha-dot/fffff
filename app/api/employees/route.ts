import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authMiddleware, requireAdmin } from "@/lib/api-middleware";
import { paginationSchema, createEmployeeSchema } from "@/lib/validations";

export async function GET(req: NextRequest) {
  const authResult = await authMiddleware(req);
  if (authResult instanceof NextResponse) return authResult;

  const { searchParams } = new URL(req.url);
  const query = paginationSchema.parse(Object.fromEntries(searchParams));
  const orgFilter = searchParams.get("organizationId");

  const where: any = {};

  if (query.search) {
    where.fullName = { contains: query.search };
  }

  if (orgFilter) {
    where.organizationId = orgFilter;
  }

  // contractor_admin sees all employees in their org; contractor_employee only their own
  if (authResult.user.role === "contractor_employee" && authResult.user.employeeId) {
    where.id = authResult.user.employeeId;
  } else if (
    (authResult.user.role === "contractor_admin") && authResult.user.organizationId
  ) {
    where.organizationId = authResult.user.organizationId;
  }

  const [total, employees] = await Promise.all([
    prisma.employee.count({ where }),
    prisma.employee.findMany({
      where,
      include: {
        organization: { select: { name: true, sequentialNumber: true } },
        documents: { select: { id: true, name: true, status: true } },
        approvals: { select: { id: true, department: true, status: true } },
        workClasses: { select: { workClass: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
  ]);

  const data = employees.map((emp) => ({
    ...emp,
    workClasses: emp.workClasses.map((wc: { workClass: string }) => wc.workClass),
    documentCounts: {
      valid: emp.documents.filter((d) => d.status === "valid").length,
      expiring: emp.documents.filter((d) => d.status === "expiring").length,
      expired: emp.documents.filter((d) => d.status === "expired").length,
    },
  }));

  return NextResponse.json({
    data,
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

  const body = await req.json();

  // admin or contractor_admin (own org only) can create employees
  const role = authResult.user.role;
  const bodyOrgId = body.organizationId as string | undefined;

  if (role === "admin") {
    // admin can create for any org
  } else if (role === "contractor_admin" && authResult.user.organizationId) {
    if (bodyOrgId !== authResult.user.organizationId) {
      return NextResponse.json({ error: "Forbidden: can only create employees for your own organization" }, { status: 403 });
    }
  } else {
    return NextResponse.json({ error: "Forbidden: admin or contractor_admin access required" }, { status: 403 });
  }

  try {
    const validation = createEmployeeSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
    }

    const { workClasses, ...employeeData } = validation.data;
    const organizationId = bodyOrgId as string | undefined;
    if (!organizationId) {
      return NextResponse.json({ error: "organizationId is required" }, { status: 400 });
    }

    const employee = await prisma.employee.create({
      data: {
        ...employeeData,
        organizationId,
        passportIssueDate: employeeData.passportIssueDate
          ? new Date(employeeData.passportIssueDate)
          : undefined,
        workClasses: {
          create: workClasses.map((wc) => ({ workClass: wc })),
        },
      },
    });

    return NextResponse.json(employee, { status: 201 });
  } catch (err) {
    console.error("Create employee error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
