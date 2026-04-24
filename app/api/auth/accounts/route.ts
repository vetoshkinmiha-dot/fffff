import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authMiddleware } from "@/lib/api-middleware";

export async function GET(req: NextRequest) {
  const authResult = await authMiddleware(req);
  if (authResult instanceof NextResponse) return authResult;

  // Only admin can see temporary passwords
  const role = authResult.user.role;
  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden: admin access required" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    where: { role: "contractor_employee", isActive: true },
    select: {
      fullName: true,
      email: true,
      temporaryPassword: true,
      organizationId: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: users });
}
