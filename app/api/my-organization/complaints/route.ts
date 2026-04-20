import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authMiddleware } from "@/lib/api-middleware";

export async function GET(req: NextRequest) {
  const authResult = await authMiddleware(req);
  if (authResult instanceof NextResponse) return authResult;

  if (!authResult.user.organizationId) {
    return NextResponse.json({ error: "No organization" }, { status: 403 });
  }

  const complaints = await prisma.violationComplaint.findMany({
    where: {
      violation: {
        contractorId: authResult.user.organizationId,
      },
    },
    include: {
      violation: {
        select: {
          id: true,
          violationNumber: true,
          description: true,
          createdAt: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    data: complaints.map((c) => ({
      id: c.id,
      violationId: c.violationId,
      violationNumber: c.violation?.violationNumber ?? null,
      department: c.department,
      complaintText: c.complaintText,
      createdAt: c.createdAt.toISOString(),
    })),
  });
}
