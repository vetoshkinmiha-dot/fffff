import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authMiddleware } from "@/lib/api-middleware";
import { updateSectionSchema } from "@/lib/validations";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authMiddleware(req);
  if (authResult instanceof NextResponse) return authResult;

  if (authResult.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const section = await prisma.regDocumentSection.findUnique({ where: { id } });
  if (!section) {
    return NextResponse.json({ error: "Section not found" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const validation = updateSectionSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
    }

    const updated = await prisma.regDocumentSection.update({
      where: { id },
      data: validation.data,
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("Update section error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authMiddleware(req);
  if (authResult instanceof NextResponse) return authResult;

  if (authResult.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const section = await prisma.regDocumentSection.findUnique({ where: { id } });
  if (!section) {
    return NextResponse.json({ error: "Section not found" }, { status: 404 });
  }

  // Check if section has children
  const children = await prisma.regDocumentSection.findMany({
    where: { parentId: id },
  });
  if (children.length > 0) {
    return NextResponse.json({ error: "Cannot delete section with child sections" }, { status: 400 });
  }

  // Check if section has documents
  const docCount = await prisma.regDocument.count({ where: { sectionId: id } });
  if (docCount > 0) {
    return NextResponse.json({ error: "Cannot delete section with documents" }, { status: 400 });
  }

  await prisma.regDocumentSection.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
