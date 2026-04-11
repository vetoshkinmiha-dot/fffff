import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authMiddleware } from "@/lib/api-middleware";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authMiddleware(req);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  const violation = await prisma.violation.findUnique({ where: { id } });
  if (!violation) {
    return NextResponse.json({ error: "Violation not found" }, { status: 404 });
  }

  // Only contractor employees can file complaints
  if (authResult.user.role !== "contractor_employee") {
    return NextResponse.json({ error: "Forbidden: only contractors can file complaints" }, { status: 403 });
  }

  // Must be the same organization
  if (violation.contractorId !== authResult.user.organizationId) {
    return NextResponse.json({ error: "Forbidden: not your organization's violation" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { text, department } = body;

    if (!text || !text.trim()) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    // Create a proper violation complaint record
    await prisma.violationComplaint.create({
      data: {
        violationId: id,
        complaintText: text.trim(),
        department,
      },
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    console.error("Create violation complaint error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
