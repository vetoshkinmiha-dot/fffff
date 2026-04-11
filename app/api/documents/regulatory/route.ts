import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authMiddleware } from "@/lib/api-middleware";
import { createRegDocumentSchema } from "@/lib/validations";
import { uploadFile } from "@/lib/file-storage";
import { sendRegDocUpdated } from "@/lib/email";
import { createNotification } from "@/lib/notifications";

export async function GET(req: NextRequest) {
  const authResult = await authMiddleware(req);
  if (authResult instanceof NextResponse) return authResult;

  const { searchParams } = new URL(req.url);
  const sectionId = searchParams.get("sectionId");

  const where: any = {};
  if (sectionId) where.sectionId = sectionId;

  const documents = await prisma.regDocument.findMany({
    where,
    include: {
      section: { select: { name: true } },
      createdBy: { select: { fullName: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: documents });
}

export async function POST(req: NextRequest) {
  const authResult = await authMiddleware(req);
  if (authResult instanceof NextResponse) return authResult;

  // Only admin can upload
  if (authResult.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const title = (formData.get("title") as string) || "";
    const sectionId = formData.get("sectionId") as string;
    const fileType = formData.get("fileType") as string;

    if (!file || !sectionId) {
      return NextResponse.json({ error: "File and sectionId required" }, { status: 400 });
    }

    const allowedTypes: Record<string, string> = {
      "application/pdf": "pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    };

    const ft = allowedTypes[file.type] || fileType;
    if (!ft || !["pdf", "docx", "xlsx"].includes(ft)) {
      return NextResponse.json({ error: "Only PDF, DOCX, XLSX allowed" }, { status: 400 });
    }

    const fileUrl = await uploadFile(file, "regulatory");

    const doc = await prisma.regDocument.create({
      data: {
        title,
        sectionId,
        fileUrl,
        fileType: ft as any,
        createdById: authResult.user.userId,
      },
      include: {
        section: { select: { name: true } },
        createdBy: { select: { fullName: true } },
      },
    });

    // Notify all users with active subscriptions
    const subscribers = await prisma.user.findMany({
      where: {
        isActive: true,
        notificationSubscriptions: { some: { emailOnUpdate: true } },
      },
      select: { email: true, fullName: true },
    });

    if (subscribers.length > 0) {
      await sendRegDocUpdated(subscribers, doc.title, `/documents/regulatory/${doc.id}`);
    }

    // Create in-app notification for all active users
    const allActiveUsers = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    for (const user of allActiveUsers) {
      await createNotification({
        userId: user.id,
        type: "document_added",
        title: "Новый нормативный документ",
        message: doc.title,
        link: "/documents",
      });
    }

    return NextResponse.json(doc, { status: 201 });
  } catch (err) {
    console.error("Create regulatory document error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
