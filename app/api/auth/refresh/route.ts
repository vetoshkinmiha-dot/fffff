import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  verifyRefreshToken,
  generateAccessToken,
  generateRefreshToken,
  revokeRefreshToken,
  setAuthAndRefreshCookies,
} from "@/lib/auth";

export async function POST(req: NextRequest) {
  const refreshToken = req.cookies.get("refresh_token")?.value;
  if (!refreshToken) {
    return NextResponse.json({ error: "No refresh token" }, { status: 401 });
  }

  const stored = await verifyRefreshToken(refreshToken);
  if (!stored) {
    await revokeRefreshToken(refreshToken);
    return NextResponse.json({ error: "Invalid or expired refresh token" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { id: stored.userId } });
  if (!user || !user.isActive) {
    return NextResponse.json({ error: "User not found" }, { status: 401 });
  }

  // Rotate: revoke old token, issue new one
  await revokeRefreshToken(refreshToken);
  const { token: newRefresh } = await generateRefreshToken(user.id);

  // Use the employeeId linked to the user account for contractor_employee users
  const employeeId: string | null =
    user.role === "contractor_employee" ? user.employeeId ?? null : null;

  const payload: Parameters<typeof generateAccessToken>[0] = {
    userId: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    organizationId: user.organizationId,
    department: user.department,
    employeeId,
    mustChangePwd: user.mustChangePwd,
  };
  const newAccess = generateAccessToken(payload);

  const response = NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    },
  });
  setAuthAndRefreshCookies(response, newAccess, newRefresh);
  return response;
}
