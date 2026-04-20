import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { randomBytes } from "crypto";
import { prisma } from "./prisma";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production";
const BCRYPT_ROUNDS = 12;
const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY_DAYS = 7;

export interface JWTPayload {
  userId: string;
  email: string;
  fullName: string;
  role: string;
  organizationId: string | null;
  department: string | null;
  employeeId: string | null;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateAccessToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

export function verifyAccessToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

export function setAuthCookie(res: Response, token: string) {
  res.headers.set(
    "Set-Cookie",
    `auth_token=${token}; HttpOnly; Path=/; Max-Age=900; SameSite=Strict; ${
      process.env.NODE_ENV === "production" ? "Secure;" : ""
    }`
  );
}

export function clearAuthCookie(res: Response) {
  res.headers.set("Set-Cookie", "auth_token=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict");
}

export const ROLES = {
  admin: "admin",
  employee: "employee",
  contractor_employee: "contractor_employee",
  department_approver: "department_approver",
} as const;

export type UserRole = (typeof ROLES)[keyof typeof ROLES];

// Roles that can see all organizations (admin-level access)
const ADMIN_ROLES = [ROLES.admin];

// Roles that have department-based approval access
const APPROVER_ROLES = [ROLES.department_approver];

export function isAdminRole(role: string): boolean {
  return ADMIN_ROLES.includes(role as typeof ADMIN_ROLES[number]);
}

export function isApproverRole(role: string): boolean {
  return APPROVER_ROLES.includes(role as typeof APPROVER_ROLES[number]);
}

export async function generateRefreshToken(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(48).toString("hex");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

  await prisma.refreshToken.create({
    data: { userId, token, expiresAt },
  });

  return { token, expiresAt };
}

export async function verifyRefreshToken(
  token: string,
): Promise<{ userId: string; expiresAt: Date } | null> {
  const stored = await prisma.refreshToken.findUnique({ where: { token } });
  if (!stored || stored.revoked || stored.expiresAt < new Date()) return null;
  return { userId: stored.userId, expiresAt: stored.expiresAt };
}

export async function revokeRefreshToken(token: string): Promise<void> {
  await prisma.refreshToken.updateMany({ where: { token }, data: { revoked: true } });
}

export function setRefreshTokenCookie(res: Response, token: string) {
  const current = res.headers.get("Set-Cookie") || "";
  const cookie = `refresh_token=${token}; HttpOnly; Path=/; Max-Age=604800; SameSite=Strict; ${
    process.env.NODE_ENV === "production" ? "Secure;" : ""
  }`;
  res.headers.set("Set-Cookie", current ? `${current}, ${cookie}` : cookie);
}

export function clearRefreshTokenCookie(res: Response) {
  const current = res.headers.get("Set-Cookie") || "";
  const cookie = "refresh_token=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict";
  res.headers.set("Set-Cookie", current ? `${current}, ${cookie}` : cookie);
}

export function setAuthAndRefreshCookies(res: Response, authToken: string, refreshToken: string) {
  const accessCookie = `auth_token=${authToken}; HttpOnly; Path=/; Max-Age=900; SameSite=Strict; ${
    process.env.NODE_ENV === "production" ? "Secure;" : ""
  }`;
  const refreshCookie = `refresh_token=${refreshToken}; HttpOnly; Path=/; Max-Age=604800; SameSite=Strict; ${
    process.env.NODE_ENV === "production" ? "Secure;" : ""
  }`;
  res.headers.append("Set-Cookie", accessCookie);
  res.headers.append("Set-Cookie", refreshCookie);
}
