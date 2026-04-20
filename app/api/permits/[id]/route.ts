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
  if (authResult.user.role === "contractor_employee" && authResult.user.organizationId) {
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

  // Only admin and contractor_admin can edit permits
  if (authResult.user.role === "admin") {
    // Admin can edit any permit — no further check needed
  } else if (
    authResult.user.role === "contractor_admin" && authResult.user.organizationId
  ) {
    if (permit.contractorId !== authResult.user.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else {
    return NextResponse.json({ error: "Forbidden: admin or contractor_admin access required" }, { status: 403 });
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

    // Also notify all admin users
    const admins = await prisma.user.findMany({
      where: { isActive: true, role: "admin" },
      select: { id: true },
    });

    for (const user of admins) {
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
      ...validation.data,
      openDate: validation.data.openDate ? new Date(validation.data.openDate as string) : undefined,
      expiryDate: validation.data.expiryDate ? new Date(validation.data.expiryDate as string) : undefined,
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
