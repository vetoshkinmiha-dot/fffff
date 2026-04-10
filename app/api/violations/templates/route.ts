import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authMiddleware } from "@/lib/api-middleware";
import { createViolationTemplateSchema } from "@/lib/validations";

export async function GET(req: NextRequest) {
  const authResult = await authMiddleware(req);
  if (authResult instanceof NextResponse) return authResult;

  const { searchParams } = new URL(req.url);
  const department = searchParams.get("department");
  const isActive = searchParams.get("isActive");

  const where: any = {};
  if (department) where.department = department;
  if (isActive !== null && isActive !== undefined) where.isActive = isActive === "true";

  const templates = await prisma.violationTemplate.findMany({
    where,
    include: { createdBy: { select: { fullName: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: templates });
}

export async function POST(req: NextRequest) {
  const authResult = await authMiddleware(req);
  if (authResult instanceof NextResponse) return authResult;

  if (!["admin", "factory_hse"].includes(authResult.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const validation = createViolationTemplateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
    }

    const template = await prisma.violationTemplate.create({
      data: {
        ...validation.data,
        createdById: authResult.user.userId,
      },
    });

    return NextResponse.json(template, { status: 201 });
  } catch (err) {
    console.error("Create template error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
