import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authMiddleware } from "@/lib/api-middleware";
import { createPermitSchema, paginationSchema } from "@/lib/validations";

const CATEGORY_CODES: Record<string, string> = {
  hot_work: "HW",
  height_work: "HT",
  confined_space: "CS",
  electrical: "EL",
  excavation: "EX",
  other: "OT",
};

export async function GET(req: NextRequest) {
  const authResult = await authMiddleware(req);
  if (authResult instanceof NextResponse) return authResult;

  const { searchParams } = new URL(req.url);
  const query = paginationSchema.parse(Object.fromEntries(searchParams));
  const statusFilter = searchParams.get("status");
  const contractorFilter = searchParams.get("contractorId");

  const where: any = {};

  if (statusFilter && statusFilter !== "all") {
    where.status = statusFilter;
  }
  if (contractorFilter) {
    where.contractorId = contractorFilter;
  }

  // Contractor roles only see their own org's permits
  if (
    (authResult.user.role === "contractor_employee" || authResult.user.role === "contractor_admin") && authResult.user.organizationId
  ) {
    where.contractorId = authResult.user.organizationId;
  }

  const [total, permits] = await Promise.all([
    prisma.permit.count({ where }),
    prisma.permit.findMany({
      where,
      include: {
        contractor: { select: { name: true, sequentialNumber: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
  ]);

  return NextResponse.json({
    data: permits,
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

  // Only admin, contractor_admin, and department_approver can create permits
  const { role, organizationId } = authResult.user;
  if (role !== "admin" && role !== "contractor_admin" && role !== "department_approver") {
    return NextResponse.json({ error: "Forbidden: admin, contractor_admin, or department_approver access required" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const validation = createPermitSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
    }

    const { category, contractorId, workSite, responsiblePerson, openDate, expiryDate } = validation.data;

    // contractor_admin can only create permits for their own organization
    if (role === "contractor_admin" && contractorId !== organizationId) {
      return NextResponse.json({ error: "Forbidden: can only create permits for your own organization" }, { status: 403 });
    }

    // Determine permit status based on creator role
    const permitStatus = role === "admin" ? "active" : "pending_approval";

    // Generate permitNumber: {CATEGORY_CODE}-{contractorSeq}-{curatorSeq}-{permitSeqNumber}
    const categoryCode = CATEGORY_CODES[category] || "OT";

    const contractor = await prisma.organization.findUnique({ where: { id: contractorId } });
    if (!contractor) {
      return NextResponse.json({ error: "Contractor not found" }, { status: 404 });
    }
    const contractorSeq = String(contractor.sequentialNumber).padStart(3, "0");

    // Get curator sequential number based on user role
    const curator = await prisma.user.findUnique({ where: { id: authResult.user.userId } });
    let curatorSeq = "000";
    if (curator) {
      const roleSeqMap: Record<string, number> = {
        admin: 1,
        employee: 2,
        department_approver: 3,
        contractor_admin: 4,
        contractor_employee: 4,
      };
      const seq = roleSeqMap[curator.role] ?? 99;
      curatorSeq = String(seq).padStart(3, "0");
    }

    const permit = await prisma.$transaction(async (tx) => {
      const maxPermit = await tx.permit.aggregate({
        _max: { sequentialNumber: true },
        where: { contractorId },
      });
      const permitSeq = (maxPermit._max.sequentialNumber ?? 0) + 1;
      const permitSeqNumber = String(permitSeq).padStart(4, "0");

      const permitNumber = `${categoryCode}-${contractorSeq}-${curatorSeq}-${permitSeqNumber}`;

      return tx.permit.create({
        data: {
          permitNumber,
          category,
          contractorId,
          workSite,
          responsiblePerson,
          openDate: new Date(openDate),
          expiryDate: new Date(expiryDate),
          status: permitStatus,
          sequentialNumber: permitSeq,
        },
      });
    }, { isolationLevel: "Serializable" });

    return NextResponse.json(permit, { status: 201 });
  } catch (err) {
    console.error("Create permit error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
