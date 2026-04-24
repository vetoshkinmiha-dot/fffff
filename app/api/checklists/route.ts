import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authMiddleware } from "@/lib/api-middleware";
import { createChecklistSchema, paginationSchema } from "@/lib/validations";
import { notifyOrganizationContractors } from "@/lib/notifications";

export async function GET(req: NextRequest) {
  const authResult = await authMiddleware(req);
  if (authResult instanceof NextResponse) return authResult;

  const { searchParams } = new URL(req.url);
  const q = paginationSchema.safeParse(Object.fromEntries(searchParams));
  if (!q.success) {
    return NextResponse.json({ error: "Invalid parameters: " + q.error.issues[0]?.message }, { status: 400 });
  }
  const query = q.data;
  const contractorId = searchParams.get("contractorId");
  const status = searchParams.get("status");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");

  const where: any = {};
  if (contractorId) where.contractorId = contractorId;
  if (status && status !== "all") where.status = status;
  if (dateFrom || dateTo) {
    where.date = {};
    if (dateFrom) where.date.gte = new Date(dateFrom);
    if (dateTo) where.date.lte = new Date(dateTo);
  }

  // Contractor roles only see their own org's checklists
  if (
    (authResult.user.role === "contractor_employee" || authResult.user.role === "contractor_admin") && authResult.user.organizationId
  ) {
    where.contractorId = authResult.user.organizationId;
  }

  const [total, checklists] = await Promise.all([
    prisma.checklist.count({ where }),
    prisma.checklist.findMany({
      where,
      include: {
        contractor: { select: { name: true } },
        createdBy: { select: { fullName: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
  ]);

  return NextResponse.json({
    data: checklists.map((c) => ({
      ...c,
      inspector: c.createdBy?.fullName ?? null,
      passedItems: c.score !== null ? Math.round((c.score / 100) * (c._count?.items ?? 0)) : 0,
      totalItems: c._count?.items ?? 0,
    })),
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

  // Only admin can create checklists
  if (authResult.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const validation = createChecklistSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
    }

    const { items, inspectorId: _inspectorId, ...checklistData } = validation.data;

    // Calculate score
    const passCount = items.filter((i) => i.answer === "pass").length;
    const totalAnswered = items.filter((i) => i.answer !== "n/a").length;
    const score = totalAnswered > 0 ? Math.round((passCount / totalAnswered) * 100) : 0;
    const status = items.some((i) => i.answer === "fail") ? "failed" : "passed";

    const checklist = await prisma.checklist.create({
      data: {
        ...checklistData,
        date: new Date(checklistData.date),
        score,
        status: status as any,
        createdById: authResult.user.userId,
        items: {
          create: items.map((item) => ({
            question: item.question,
            answer: item.answer,
            comment: item.comment || null,
            photoUrl: item.photoUrl || null,
          })),
        },
      },
      include: {
        items: true,
      },
    });

    // Send notification to contractor organization users (if contractorId is set)
    if (checklist.contractorId) {
      await notifyOrganizationContractors(checklist.contractorId, {
        type: "checklist_assigned",
        title: "Назначен чек-лист",
        message: `Создан новый чек-лист проверки для вашей организации`,
        link: `/checklists/${checklist.id}`,
      });
    }

    return NextResponse.json(checklist, { status: 201 });
  } catch (err) {
    console.error("Create checklist error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
