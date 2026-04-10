import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authMiddleware } from "@/lib/api-middleware";
import { updateViolationSchema, resolveViolationSchema } from "@/lib/validations";

function isAuthorizedForViolations(user: { role: string }): boolean {
  return ["admin", "factory_hse", "factory_hr", "factory_curator", "security"].includes(user.role);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authMiddleware(req);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  const violation = await prisma.violation.findUnique({
    where: { id },
    include: {
      contractor: { select: { name: true, sequentialNumber: true } },
      createdBy: { select: { fullName: true } },
    },
  });

  if (!violation) {
    return NextResponse.json({ error: "Violation not found" }, { status: 404 });
  }

  // Contractor scoping
  if (
    authResult.user.role === "contractor_admin" ||
    authResult.user.role === "contractor_user"
  ) {
    if (violation.contractorId !== authResult.user.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  return NextResponse.json(violation);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authMiddleware(req);
  if (authResult instanceof NextResponse) return authResult;

  if (!isAuthorizedForViolations(authResult.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const violation = await prisma.violation.findUnique({ where: { id } });
  if (!violation) {
    return NextResponse.json({ error: "Violation not found" }, { status: 404 });
  }

  // Check if resolving
  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  try {
    if (action === "resolve") {
      const body = await req.json();
      const validation = resolveViolationSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
      }

      const updated = await prisma.violation.update({
        where: { id },
        data: {
          status: "resolved",
          resolvedAt: new Date(),
          resolutionNotes: validation.data.resolutionNotes,
        },
      });

      return NextResponse.json(updated);
    }

    const body = await req.json();
    const validation = updateViolationSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
    }

    const updated = await prisma.violation.update({
      where: { id },
      data: validation.data,
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("Update violation error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authMiddleware(req);
  if (authResult instanceof NextResponse) return authResult;

  // Only factory roles can delete
  if (!["admin", "factory_hse"].includes(authResult.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const violation = await prisma.violation.findUnique({ where: { id } });
  if (!violation) {
    return NextResponse.json({ error: "Violation not found" }, { status: 404 });
  }

  await prisma.violation.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
