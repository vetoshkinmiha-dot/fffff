import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authMiddleware, requireAdmin } from "@/lib/api-middleware";
import { orgStatusSchema } from "@/lib/validations";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authMiddleware(req);
  if (authResult instanceof NextResponse) return authResult;

  const roleResult = requireAdmin(authResult.user);
  if (roleResult instanceof NextResponse) return roleResult;

  const { id } = await params;

  try {
    const body = await req.json();
    const validation = orgStatusSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
    }

    const org = await prisma.organization.update({
      where: { id },
      data: { status: validation.data.status },
    });

    return NextResponse.json(org);
  } catch (err: any) {
    if (err.code === "P2025") {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }
    console.error("Update org status error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
