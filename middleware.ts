import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "./lib/auth-edge";

// Routes that don't require authentication
const PUBLIC_ROUTES = ["/login", "/register", "/auth/unauthorized"];

// Routes that bypass auth (static files, API health, etc.)
const PUBLIC_PREFIXES = ["/_next", "/favicon.ico", "/api/health", "/api/auth/"];

// Role → allowed route patterns
// employee: view-only access (no approvals, no admin pages)
const ROLE_ROUTES: Record<string, string[]> = {
  admin: ["/*"],
  employee: ["/", "/contractors", "/contractors/*", "/employees", "/employees/*", "/permits", "/permits/*", "/permits/*/print", "/violations", "/violations/*", "/violations/*/print", "/checklists", "/checklists/*", "/documents", "/documents/*"],
  contractor_employee: ["/contractors", "/contractors/*", "/employees", "/employees/*", "/permits", "/permits/*", "/permits/*/print", "/violations", "/violations/*", "/violations/*/print", "/checklists", "/checklists/*", "/approvals", "/approvals/*", "/"],
  department_approver: ["/contractors", "/contractors/*", "/employees", "/employees/*", "/approvals", "/approvals/*", "/permits", "/permits/*", "/permits/*/print", "/violations", "/violations/*", "/violations/*/print", "/"],
};

export async function middleware(request: NextRequest) {
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

  // admin gets wildcard
  if (allowedPatterns.includes("/*")) {
    // Check exclusions
    const denied = allowedPatterns.filter((p) => p.startsWith("!")).map((p) => p.slice(1));
    if (denied.some((d) => pathname.startsWith(d.replace("*", "")))) {
      return NextResponse.redirect(new URL("/auth/unauthorized", request.url));
    }
    return NextResponse.next();
  }

  // employee, contractor_employee, department_approver: check allowed patterns
  if (allowedPatterns.length > 0) {
    const isAllowed = allowedPatterns.some(
      (pattern) => pattern.endsWith("/*")
        ? pathname.startsWith(pattern.replace("/*", ""))
        : pathname === pattern
    );

    if (!isAllowed) {
      return NextResponse.redirect(new URL("/auth/unauthorized", request.url));
    }

    return NextResponse.next();
  }

  // Default: deny
  return NextResponse.redirect(new URL("/auth/unauthorized", request.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
