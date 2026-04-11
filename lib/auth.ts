import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production";
const BCRYPT_ROUNDS = 12;
const ACCESS_TOKEN_EXPIRY = "15m";

export interface JWTPayload {
  userId: string;
  email: string;
  fullName: string;
  role: string;
  organizationId: string | null;
  department: string | null;
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
