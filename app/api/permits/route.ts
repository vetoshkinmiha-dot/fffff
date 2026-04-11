import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authMiddleware, requireAdmin } from "@/lib/api-middleware";
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

  // Contractor employees only see their own org's permits
  if (
    authResult.user.role === "contractor_employee"
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

  const adminResult = requireAdmin(authResult.user);
  if (adminResult instanceof NextResponse) return adminResult;

  try {
    const body = await req.json();
    const validation = createPermitSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
    }

    const { category, contractorId, workSite, responsiblePerson, openDate, expiryDate } = validation.data;

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
      };
      const seq = roleSeqMap[curator.role] ?? 99;
      curatorSeq = String(seq).padStart(3, "0");
    }

    // Per-contractor sequential number using MAX for safety
    const maxPermit = await prisma.permit.aggregate({
      _max: { sequentialNumber: true },
      where: { contractorId },
    });
    const permitSeq = (maxPermit._max.sequentialNumber ?? 0) + 1;
    const permitSeqNumber = String(permitSeq).padStart(4, "0");

    const permitNumber = `${categoryCode}-${contractorSeq}-${curatorSeq}-${permitSeqNumber}`;

    const permit = await prisma.permit.create({
      data: {
        permitNumber,
        category,
        contractorId,
        workSite,
        responsiblePerson,
        openDate: new Date(openDate),
        expiryDate: new Date(expiryDate),
        sequentialNumber: permitSeq,
      },
    });

    return NextResponse.json(permit, { status: 201 });
  } catch (err) {
    console.error("Create permit error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
