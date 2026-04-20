import { NextRequest, NextResponse } from "next/server";
import { clearAuthCookie, clearRefreshTokenCookie, revokeRefreshToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const refreshToken = req.cookies.get("refresh_token")?.value;
  if (refreshToken) {
    await revokeRefreshToken(refreshToken);
  }
  const response = NextResponse.json({ success: true });
  clearAuthCookie(response);
  clearRefreshTokenCookie(response);
  return response;
}
