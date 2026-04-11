import { NextRequest, NextResponse } from "next/server";
import { authMiddleware } from "@/lib/api-middleware";

export async function GET(req: NextRequest) {
  const authResult = await authMiddleware(req);
  if (authResult instanceof NextResponse) return authResult;

  return NextResponse.json({
    user: authResult.user,
  });
}
