import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authMiddleware, requireFactoryRole } from "@/lib/api-middleware";
import { createOrgSchema, paginationSchema } from "@/lib/validations";

export async function GET(req: NextRequest) {
  const authResult = await authMiddleware(req);
  if (authResult instanceof NextResponse) return authResult;

  const { searchParams } = new URL(req.url);
  const query = paginationSchema.parse(Object.fromEntries(searchParams));

  const where: any = {};

  if (query.search) {
    where.OR = [
      { name: { contains: query.search } },
      { inn: { contains: query.search } },
    ];
  }

  if (query.status) {
    where.status = query.status;
  }

  if (authResult.user.role === "contractor_admin" || authResult.user.role === "contractor_user") {
    where.id = authResult.user.organizationId;
  }

  const [total, orgs] = await Promise.all([
    prisma.organization.count({ where }),
    prisma.organization.findMany({
      where,
      include: { _count: { select: { employees: true } } },
      orderBy: { sequentialNumber: "asc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
  ]);

  return NextResponse.json({
    data: orgs,
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

  const roleResult = requireFactoryRole(authResult.user);
  if (roleResult instanceof NextResponse) return roleResult;

  try {
    const body = await req.json();
    const validation = createOrgSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
    }

    const d = validation.data;

    const count = await prisma.organization.count();

    const org = await prisma.organization.create({
      data: {
        name: d.name,
        inn: d.inn,
        legalAddress: d.legalAddress,
        sequentialNumber: count + 1,
        kpp: d.kpp || null,
        contactPersonName: d.contactPersonName || null,
        contactPhone: d.contactPhone || null,
        contactEmail: d.contactEmail || null,
      },
    });

    return NextResponse.json(org, { status: 201 });
  } catch (err: any) {
    if (err.code === "P2002") {
      return NextResponse.json({ error: "ИНН уже используется" }, { status: 409 });
    }
    console.error("Create org error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
