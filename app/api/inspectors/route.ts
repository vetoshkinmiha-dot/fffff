import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authMiddleware } from "@/lib/api-middleware";

/**
 * GET /api/inspectors
 * Returns list of active contractor_employee and contractor_admin users
 * who can be assigned as inspectors on checklists.
 * Admin sees all; contractor roles only see users in their own organization.
 */
export async function GET(req: NextRequest) {
  const authResult = await authMiddleware(req);
  if (authResult instanceof NextResponse) return authResult;

  const where: Record<string, unknown> = {
    isActive: true,
    role: { in: ["contractor_employee", "contractor_admin"] },
  };

  // Contractor roles only see inspectors in their own org
  if (
    (authResult.user.role === "contractor_employee" || authResult.user.role === "contractor_admin") &&
    authResult.user.organizationId
  ) {
    where.organizationId = authResult.user.organizationId;
  }

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      fullName: true,
      role: true,
      organizationId: true,
    },
    orderBy: { fullName: "asc" },
  });

  return NextResponse.json({ data: users });
}
