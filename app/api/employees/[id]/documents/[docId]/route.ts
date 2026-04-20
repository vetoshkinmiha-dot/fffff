import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authMiddleware } from "@/lib/api-middleware";
import { deleteFile } from "@/lib/file-storage";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const authResult = await authMiddleware(req);
  if (authResult instanceof NextResponse) return authResult;

  const { id, docId } = await params;

  const doc = await prisma.employeeDocument.findUnique({
    where: { id: docId },
    include: { employee: { select: { organizationId: true } } },
  });

  if (!doc || doc.employeeId !== id) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  // Admin or contractor_admin can delete documents
  if (authResult.user.role === "admin") {
    // admin can delete any document
  } else if (authResult.user.role === "contractor_admin" && authResult.user.organizationId) {
    if (doc.employee.organizationId !== authResult.user.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (doc.fileUrl) {
    await deleteFile(doc.fileUrl);
  }

  await prisma.employeeDocument.delete({ where: { id: docId } });
  return NextResponse.json({ success: true });
}
