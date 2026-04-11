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
  factory_hse: "factory_hse",
  factory_hr: "factory_hr",
  factory_curator: "factory_curator",
  contractor_admin: "contractor_admin",
  contractor_user: "contractor_user",
  security: "security",
  permit_bureau: "permit_bureau",
} as const;

export type UserRole = (typeof ROLES)[keyof typeof ROLES];

// Roles that can see all organizations (factory-level access)
const FACTORY_ROLES = [ROLES.admin, ROLES.factory_hse, ROLES.factory_hr, ROLES.factory_curator];

export function isFactoryRole(role: string): boolean {
  return FACTORY_ROLES.includes(role as typeof FACTORY_ROLES[number]);
}
