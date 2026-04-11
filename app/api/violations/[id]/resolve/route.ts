import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authMiddleware } from "@/lib/api-middleware";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authMiddleware(req);
  if (authResult instanceof NextResponse) return authResult;

  // Only factory roles can resolve violations
  if (!["admin", "factory_hse", "factory_hr", "factory_curator", "security"].includes(authResult.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const violation = await prisma.violation.findUnique({ where: { id } });
  if (!violation) {
    return NextResponse.json({ error: "Violation not found" }, { status: 404 });
  }

  if (violation.status !== "pending") {
    return NextResponse.json({ error: "Violation is not pending" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const status = body.status === "escalated" ? "escalated" : "resolved";
    const notes = body.notes?.trim();

    if (!notes) {
      return NextResponse.json({ error: "Notes are required" }, { status: 400 });
    }

    const updated = await prisma.violation.update({
      where: { id },
      data: {
        status,
        resolvedAt: new Date(),
        resolutionNotes: notes,
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("Resolve violation error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
