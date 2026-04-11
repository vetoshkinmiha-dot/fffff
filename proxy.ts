import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "./lib/auth-edge";

// Routes that don't require authentication
const PUBLIC_ROUTES = ["/login", "/register"];

// Routes that bypass auth (static files, API health, etc.)
const PUBLIC_PREFIXES = ["/_next", "/favicon.ico", "/api/health", "/api/auth/"];

// Role → allowed route patterns
const ROLE_ROUTES: Record<string, string[]> = {
  admin: ["/*"],
  factory_hse: ["/*"],
  factory_hr: ["/*", "!/documents/sections"],
  factory_curator: ["/*", "!/documents/sections"],
  security: ["/contractors/*", "/employees/*", "/approvals", "/approvals/*", "/"],
  permit_bureau: ["/contractors/*", "/employees/*", "/approvals", "/approvals/*", "/"],
  contractor_admin: ["/contractors", "/contractors/*", "/employees", "/employees/*", "/approvals", "/approvals/*", "/"],
  contractor_user: ["/employees/*", "/"],
};

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip public routes and prefixes
  if (PUBLIC_ROUTES.includes(pathname) || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Extract and verify JWT from httpOnly cookie
  const token = request.cookies.get("auth_token")?.value;
  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const payload = await verifyAccessToken(token);
  if (!payload) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Allow API auth routes (login, register, logout, me)
  if (pathname.startsWith("/api/auth/")) {
    return NextResponse.next();
  }

  // Check role-based access
  const allowedPatterns = ROLE_ROUTES[payload.role] || [];

  // admin and factory roles get wildcard
  if (allowedPatterns.includes("/*")) {
    // Check exclusions
    const denied = allowedPatterns.filter((p) => p.startsWith("!")).map((p) => p.slice(1));
    if (denied.some((d) => pathname.startsWith(d.replace("*", "")))) {
      return NextResponse.redirect(new URL("/unauthorized", request.url));
    }
    return NextResponse.next();
  }

  // Contractor roles: restrict to own organization
  if (payload.role === "contractor_admin" || payload.role === "contractor_user") {
    if (!payload.organizationId) {
      return NextResponse.redirect(new URL("/unauthorized", request.url));
    }

    // For contractor routes, check if accessing own org
    // /contractors or /contractors/:id — allow if orgId matches or just listing
    if (pathname.startsWith("/contractors")) {
      const parts = pathname.split("/").filter(Boolean);
      if (parts.length >= 2 && parts[1] !== "new") {
        const orgId = parts[1];
        // The orgId in the URL is a UUID — we'll verify on the API side
        // Here we just allow access to contractor routes
      }
    }

    // Check allowed patterns
    const isAllowed = allowedPatterns.some(
      (pattern) => pattern.endsWith("/*")
        ? pathname.startsWith(pattern.replace("/*", ""))
        : pathname === pattern
    );

    if (!isAllowed) {
      return NextResponse.redirect(new URL("/unauthorized", request.url));
    }

    return NextResponse.next();
  }

  // Security and permit_bureau: allow specific routes
  if (payload.role === "security" || payload.role === "permit_bureau") {
    const isAllowed = allowedPatterns.some(
      (pattern) => pattern.endsWith("/*")
        ? pathname.startsWith(pattern.replace("/*", ""))
        : pathname === pattern
    );

    if (!isAllowed) {
      return NextResponse.redirect(new URL("/unauthorized", request.url));
    }

    return NextResponse.next();
  }

  // Default: deny
  return NextResponse.redirect(new URL("/unauthorized", request.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
