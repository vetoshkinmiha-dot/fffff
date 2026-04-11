import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authMiddleware } from "@/lib/api-middleware";
import { createSectionSchema } from "@/lib/validations";

export async function GET(req: NextRequest) {
  const authResult = await authMiddleware(req);
  if (authResult instanceof NextResponse) return authResult;

  const sections = await prisma.regDocumentSection.findMany({
    include: {
      _count: { select: { documents: true } },
    },
    orderBy: { order: "asc" },
  });

  return NextResponse.json({ data: sections });
}

export async function POST(req: NextRequest) {
  const authResult = await authMiddleware(req);
  if (authResult instanceof NextResponse) return authResult;

  // Only admin can create sections
  if (authResult.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const validation = createSectionSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
    }

    const section = await prisma.regDocumentSection.create({
      data: validation.data,
    });

    return NextResponse.json(section, { status: 201 });
  } catch (err) {
    console.error("Create section error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
