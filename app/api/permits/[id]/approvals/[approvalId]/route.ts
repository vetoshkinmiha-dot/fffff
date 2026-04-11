import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authMiddleware } from "@/lib/api-middleware";
import { decideApprovalSchema } from "@/lib/validations";

const DEPARTMENT_LABELS: Record<string, string> = {
  security: "Служба безопасности",
  hr: "Отдел кадров",
  safety: "Охрана труда",
  safety_training: "Обучение и аттестация",
  permit_bureau: "Бюро пропусков",
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; approvalId: string }> }
) {
  const authResult = await authMiddleware(req);
  if (authResult instanceof NextResponse) return authResult;

  const { id, approvalId } = await params;

  const permit = await prisma.permit.findUnique({
    where: { id },
    include: { approvals: { where: { id: approvalId } } },
  });

  if (!permit) {
    return NextResponse.json({ error: "Permit not found" }, { status: 404 });
  }

  const approval = permit.approvals[0];
  if (!approval) {
    return NextResponse.json({ error: "Approval not found" }, { status: 404 });
  }

  if (approval.status !== "pending") {
    return NextResponse.json({ error: "Approval already decided" }, { status: 400 });
  }

  // Department match required
  if (authResult.user.department && approval.department !== authResult.user.department) {
    if (authResult.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden: not your department" }, { status: 403 });
    }
  }

  try {
    const body = await req.json();
    const validation = decideApprovalSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
    }

    // Reject requires a comment
    if (validation.data.status === "rejected" && !validation.data.comment?.trim()) {
      return NextResponse.json({ error: "Comment required for rejection" }, { status: 400 });
    }

    const updated = await prisma.permitApproval.update({
      where: { id: approvalId },
      data: {
        status: validation.data.status,
        comment: validation.data.comment,
        decidedAt: new Date(),
      },
    });

    // Check if all approvals are approved → set permit to approved
    if (validation.data.status === "approved") {
      const allApprovals = await prisma.permitApproval.findMany({
        where: { permitId: id },
      });

      const allApproved = allApprovals.every((a) => a.status === "approved");
      if (allApproved && allApprovals.length > 0) {
        await prisma.permit.update({
          where: { id },
          data: { status: "approved" },
        });
      }
    }

    // If any approval is rejected → set permit to expired
    if (validation.data.status === "rejected") {
      await prisma.permit.update({
        where: { id },
        data: { status: "expired" },
      });
    }

    return NextResponse.json(updated);
  } catch (err) {
    console.error("Decide permit approval error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
