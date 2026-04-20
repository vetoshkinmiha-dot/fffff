import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authMiddleware } from "@/lib/api-middleware";
import { createComplaintSchema, paginationSchema } from "@/lib/validations";
import { createNotificationsForRole } from "@/lib/notifications";

const CONTRACTOR_COMPLAINT_ROLES = ["contractor_admin", "contractor_employee"];

export async function GET(req: NextRequest) {
  const authResult = await authMiddleware(req);
  if (authResult instanceof NextResponse) return authResult;

  const { user } = authResult;

  // employee and department_approver cannot see complaints
  if (user.role === "employee" || user.role === "department_approver") {
    return NextResponse.json({ data: [], pagination: { page: 1, limit: 20, total: 0, pages: 0 } });
  }

  const { searchParams } = new URL(req.url);
  const query = paginationSchema.parse(Object.fromEntries(searchParams));
  const contractorId = searchParams.get("contractorId");
  const statusFilter = searchParams.get("status");

  const where: any = {};

  // Admin: sees ALL complaints, with optional contractorId filter
  if (user.role === "admin") {
    if (contractorId) where.contractorId = contractorId;
  }

  // Contractor roles: see only complaints from their organization
  if (CONTRACTOR_COMPLAINT_ROLES.includes(user.role) && user.organizationId) {
    where.contractorId = user.organizationId;
  }

  if (statusFilter && statusFilter !== "all") {
    where.status = statusFilter;
  }

  const [total, complaints] = await Promise.all([
    prisma.violationComplaint.count({ where }),
    prisma.violationComplaint.findMany({
      where,
      include: {
        createdBy: { select: { fullName: true, id: true } },
        violation: { select: { id: true, violationNumber: true } },
        contractor: { select: { name: true, sequentialNumber: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
  ]);

  return NextResponse.json({
    data: complaints,
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

  // Only contractor_admin and contractor_employee can create complaints
  if (!CONTRACTOR_COMPLAINT_ROLES.includes(authResult.user.role)) {
    return NextResponse.json({ error: "Forbidden: only contractors can create complaints" }, { status: 403 });
  }

  if (!authResult.user.organizationId) {
    return NextResponse.json({ error: "Forbidden: no organization associated" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const validation = createComplaintSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
    }

    const complaint = await prisma.violationComplaint.create({
      data: {
        complaintText: validation.data.complaintText,
        department: validation.data.department,
        contractorId: authResult.user.organizationId,
        createdById: authResult.user.userId,
        violationId: validation.data.violationId || null,
        status: "pending",
      },
      include: {
        createdBy: { select: { fullName: true } },
        contractor: { select: { name: true } },
      },
    });

    // Notify all admin users
    await createNotificationsForRole("admin", {
      type: "complaint_submitted",
      title: "Подана жалоба",
      message: `Жалоба от подрядчика: ${complaint.complaintText.substring(0, 50)}...`,
      link: `/complaints`,
    });

    return NextResponse.json(complaint, { status: 201 });
  } catch (err) {
    console.error("Create complaint error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
