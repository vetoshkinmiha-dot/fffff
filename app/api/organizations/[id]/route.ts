import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authMiddleware } from "@/lib/api-middleware";
import { updateOrgSchema } from "@/lib/validations";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authMiddleware(req);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  if (
    (authResult.user.role === "contractor_employee" || authResult.user.role === "contractor_admin") && authResult.user.organizationId
  ) {
    if (authResult.user.organizationId !== id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const org = await prisma.organization.findUnique({
    where: { id },
    include: { _count: { select: { employees: true } } },
  });

  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  return NextResponse.json(org);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authMiddleware(req);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  // Admin can update any org; contractor_admin can only update their own org
  if (authResult.user.role === "contractor_admin") {
    if (authResult.user.organizationId !== id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else if (authResult.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const validation = updateOrgSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
    }

    const org = await prisma.organization.update({
      where: { id },
      data: validation.data,
    });

    return NextResponse.json(org);
  } catch (err: any) {
    if (err.code === "P2025") {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }
    if (err.code === "P2002") {
      return NextResponse.json({ error: "ИНН уже используется" }, { status: 409 });
    }
    console.error("Update org error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
