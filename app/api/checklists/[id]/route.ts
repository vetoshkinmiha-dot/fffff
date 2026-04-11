import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authMiddleware } from "@/lib/api-middleware";
import { updateChecklistSchema } from "@/lib/validations";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authMiddleware(req);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  const checklist = await prisma.checklist.findUnique({
    where: { id },
    include: {
      items: true,
      contractor: { select: { name: true } },
      createdBy: { select: { fullName: true } },
    },
  });

  if (!checklist) {
    return NextResponse.json({ error: "Checklist not found" }, { status: 404 });
  }

  // Contractor scoping
  if (authResult.user.role === "contractor_employee") {
    if (checklist.contractorId !== authResult.user.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  return NextResponse.json(checklist);
}

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

  const checklist = await prisma.checklist.findUnique({ where: { id } });
  if (!checklist) {
    return NextResponse.json({ error: "Checklist not found" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const validation = updateChecklistSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
    }

    const { items, ...checklistData } = validation.data;

    const updated = await prisma.checklist.update({
      where: { id },
      data: {
        ...checklistData,
        ...(checklistData.date && { date: new Date(checklistData.date) }),
        ...(items && {
          items: {
            deleteMany: {},
            create: items.map((item: any) => ({
              question: item.question,
              answer: item.answer,
              comment: item.comment || null,
              photoUrl: item.photoUrl || null,
            })),
          },
        }),
      },
      include: {
        items: true,
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("Update checklist error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
