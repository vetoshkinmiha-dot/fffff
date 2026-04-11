import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authMiddleware } from "@/lib/api-middleware";
import { updatePermitSchema, closePermitSchema } from "@/lib/validations";
import { createNotification } from "@/lib/notifications";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authMiddleware(req);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  const permit = await prisma.permit.findUnique({
    where: { id },
    include: {
      contractor: { select: { name: true, sequentialNumber: true } },
      approvals: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!permit) {
    return NextResponse.json({ error: "Permit not found" }, { status: 404 });
  }

  // Contractor employees can only see their own org's permits
  if (authResult.user.role === "contractor_employee") {
    if (permit.contractorId !== authResult.user.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  return NextResponse.json({
    ...permit,
    approvals: permit.approvals.map((a) => ({
      ...a,
      deadline: a.deadline?.toISOString(),
    })),
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authMiddleware(req);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  const permit = await prisma.permit.findUnique({ where: { id } });
  if (!permit) {
    return NextResponse.json({ error: "Permit not found" }, { status: 404 });
  }

  // Contractor employees can only edit their own org's permits
  if (authResult.user.role === "contractor_employee") {
    if (permit.contractorId !== authResult.user.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const body = await req.json();

  // Early close
  if (body.status === "early_closed") {
    const validation = closePermitSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
    }

    const updated = await prisma.permit.update({
      where: { id },
      data: {
        status: "early_closed",
        closeReason: validation.data.closeReason,
        closedAt: new Date(),
      },
      include: {
        contractor: { select: { name: true, sequentialNumber: true } },
        approvals: { orderBy: { createdAt: "asc" } },
      },
    });

    // Notify contractor employees about early closure
    const contractorUsers = await prisma.user.findMany({
      where: { isActive: true, organizationId: updated.contractorId },
      select: { id: true },
    });

    for (const user of contractorUsers) {
      await createNotification({
        userId: user.id,
        type: "permit_closed",
        title: "Наряд-допуск закрыт",
        message: `Наряд ${updated.permitNumber} закрыт досрочно: ${validation.data.closeReason}`,
        link: `/permits/${updated.id}`,
      });
    }

    return NextResponse.json({
      ...updated,
      approvals: updated.approvals.map((a) => ({
        ...a,
        deadline: a.deadline?.toISOString(),
      })),
    });
  }

  // Regular update
  const validation = updatePermitSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
  }

  const updated = await prisma.permit.update({
    where: { id },
    data: {
      ...body,
      openDate: body.openDate ? new Date(body.openDate) : undefined,
      expiryDate: body.expiryDate ? new Date(body.expiryDate) : undefined,
    },
    include: {
      contractor: { select: { name: true, sequentialNumber: true } },
      approvals: { orderBy: { createdAt: "asc" } },
    },
  });

  return NextResponse.json({
    ...updated,
    approvals: updated.approvals.map((a) => ({
      ...a,
      deadline: a.deadline?.toISOString(),
    })),
  });
}
