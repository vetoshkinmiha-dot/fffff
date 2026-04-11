// Edge-compatible auth utilities for middleware
// Uses jose instead of jsonwebtoken for edge runtime compatibility
import * as jose from "jose";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production";

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  organizationId: string | null;
  department: string | null;
}

export async function verifyAccessToken(token: string): Promise<JWTPayload | null> {
  try {
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jose.jwtVerify(token, secret);
    return {
      userId: payload.userId as string,
      email: payload.email as string,
      role: payload.role as string,
      organizationId: (payload.organizationId as string) || null,
      department: (payload.department as string) || null,
    };
  } catch {
    return null;
  }
}
