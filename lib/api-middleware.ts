import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "./auth";
import { prisma } from "./prisma";

export interface AuthenticatedUser {
  userId: string;
  email: string;
  fullName: string;
  role: string;
  organizationId: string | null;
  department: string | null;
  employeeId: string | null;
}

export interface AuthResult {
  user: AuthenticatedUser;
}

// ── In-memory rate limiter ──────────────────────────────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 100;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(key);
  }
}, 60 * 60 * 1000);

function getRateLimitKey(req: NextRequest): string {
  return req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
}

function checkRateLimit(key: string): { allowed: boolean } {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }

  if (entry.count >= RATE_LIMIT_MAX) return { allowed: false };

  entry.count++;
  return { allowed: true };
}

export async function authMiddleware(req: NextRequest): Promise<AuthResult | NextResponse> {
  // Apply mutation guards (CSRF + rate limiting) for POST/PATCH/DELETE
  const guardResult = applyMutationGuards(req);
  if (guardResult) return guardResult;

  const token = req.cookies.get("auth_token")?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = verifyAccessToken(token);
  if (!payload) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  }

  // Verify user still exists and is active
  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user || !user.isActive) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return {
    user: {
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      organizationId: user.organizationId,
      department: user.department,
      employeeId: payload.employeeId ?? null,
    },
  };
}

/** Apply rate limiting + basic CSRF to mutation requests (POST/PATCH/DELETE). */
export function applyMutationGuards(req: NextRequest): NextResponse | null {
  const { method } = req;
  if (method !== "POST" && method !== "PATCH" && method !== "DELETE") return null;

  // Content-Type guard for requests with a body (POST/PATCH)
  if ((method === "POST" || method === "PATCH") && !req.headers.get("content-type")) {
    return NextResponse.json({ error: "Forbidden: Content-Type header required" }, { status: 403 });
  }

  // Rate limit per IP per endpoint
  const ip = getRateLimitKey(req);
  const url = new URL(req.url);
  const rateKey = `${ip}:${method}:${url.pathname}`;
  const { allowed } = checkRateLimit(rateKey);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  return null;
}

export function requireRole(
  user: AuthenticatedUser,
  allowedRoles: string[]
): true | NextResponse {
  if (!allowedRoles.includes(user.role)) {
    return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
  }
  return true;
}

export function requireAdmin(
  user: AuthenticatedUser
): true | NextResponse {
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden: admin access required" }, { status: 403 });
  }
  return true;
}

export function requireApproverRole(
  user: AuthenticatedUser
): true | NextResponse {
  if (user.role !== "department_approver") {
    return NextResponse.json({ error: "Forbidden: approver access required" }, { status: 403 });
  }
  return true;
}

export function requireContractorEmployee(
  user: AuthenticatedUser
): true | NextResponse {
  if (user.role !== "contractor_employee") {
    return NextResponse.json({ error: "Forbidden: contractor employee access required" }, { status: 403 });
  }
  return true;
}
