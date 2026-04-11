import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authMiddleware } from "@/lib/api-middleware";
import { createViolationTemplateSchema } from "@/lib/validations";

async function requireHSE(req: NextRequest) {
  const authResult = await authMiddleware(req);
  if (authResult instanceof NextResponse) return authResult;
  if (authResult.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return authResult;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authMiddleware(req);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  const template = await prisma.violationTemplate.findUnique({
    where: { id },
    include: { createdBy: { select: { fullName: true } } },
  });

  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  return NextResponse.json(template);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireHSE(req);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  const existing = await prisma.violationTemplate.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const validation = createViolationTemplateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
    }

    const template = await prisma.violationTemplate.update({
      where: { id },
      data: validation.data,
    });

    return NextResponse.json(template);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireHSE(req);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  const existing = await prisma.violationTemplate.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  await prisma.violationTemplate.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
