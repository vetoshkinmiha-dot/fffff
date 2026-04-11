import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authMiddleware } from "@/lib/api-middleware";

export async function GET(req: NextRequest) {
  const authResult = await authMiddleware(req);
  if (authResult instanceof NextResponse) return authResult;

  const { searchParams } = new URL(req.url);
  const days = parseInt(searchParams.get("days") || "30", 10);

  const now = new Date();
  const threshold = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  // Contract documents that are expiring or already expired
  const where: any = { expiryDate: { lte: threshold } };

  // Contractor employees only see their own org's documents
  if (authResult.user.role === "contractor_employee") {
    where.employee = { organizationId: authResult.user.organizationId };
  }

  const documents = await prisma.employeeDocument.findMany({
    where,
    include: {
      employee: {
        select: { fullName: true, organization: { select: { name: true } } },
      },
    },
    orderBy: { expiryDate: "asc" },
  });

  return NextResponse.json(documents);
}
