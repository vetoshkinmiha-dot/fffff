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
}

export interface AuthResult {
  user: AuthenticatedUser;
}

export async function authMiddleware(req: NextRequest): Promise<AuthResult | NextResponse> {
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
    },
  };
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
