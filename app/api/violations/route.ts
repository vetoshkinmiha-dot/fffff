import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authMiddleware } from "@/lib/api-middleware";
import { createViolationSchema, createViolationTemplateSchema, paginationSchema } from "@/lib/validations";

function isAuthorizedForViolations(user: { role: string }): boolean {
  return ["admin", "factory_hse", "factory_hr", "factory_curator", "security"].includes(user.role);
}

export async function GET(req: NextRequest) {
  const authResult = await authMiddleware(req);
  if (authResult instanceof NextResponse) return authResult;

  const { searchParams } = new URL(req.url);
  const query = paginationSchema.parse(Object.fromEntries(searchParams));
  const severity = searchParams.get("severity");
  const status = searchParams.get("status");
  const contractorId = searchParams.get("contractorId");
  const department = searchParams.get("department");

  const where: any = {};
  if (severity && severity !== "all") where.severity = severity;
  if (status && status !== "all") where.status = status;
  if (contractorId) where.contractorId = contractorId;
  if (department) where.department = department;

  // Contractor users only see their own org's violations
  if (
    authResult.user.role === "contractor_admin" ||
    authResult.user.role === "contractor_user"
  ) {
    where.contractorId = authResult.user.organizationId;
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

    const violation = await prisma.violation.create({
      data: {
        ...validation.data,
        date: new Date(validation.data.date),
        createdById: authResult.user.userId,
      },
      include: {
        contractor: { select: { name: true } },
        createdBy: { select: { fullName: true } },
      },
    });

    return NextResponse.json(violation, { status: 201 });
  } catch (err) {
    console.error("Create violation error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
