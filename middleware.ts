import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "./lib/auth-edge";

// Routes that don't require authentication
const PUBLIC_ROUTES = ["/login", "/register", "/auth/unauthorized"];

// Routes that bypass auth (static files, API health, etc.)
const PUBLIC_PREFIXES = ["/_next", "/favicon.ico", "/api/health", "/api/auth/"];

// Role → allowed route patterns (based on ролевая модель.docx)
const ROLE_ROUTES: Record<string, string[]> = {
  // Администратор — полный доступ, стартовая = дашборд
  admin: ["/*"],

  // Сотрудник завода обычный — нет дашборда, нет нарядов, нет моя организация, чек-листы только где инспектор, нарушения только свои, нормативные — все
  employee: ["/api/*", "/contractors", "/contractors/*", "/employees", "/employees/*", "/violations", "/violations/*", "/violations/*/print", "/documents", "/documents/*", "/checklists", "/checklists/*", "/change-password"],

  // Сотрудник завода с правом согласования — дашборд стартовая, чек-листы только где инспектор, нарушения свои+создание, согласования
  department_approver: ["/api/*", "/", "/contractors", "/contractors/*", "/employees", "/employees/*", "/permits", "/permits/*", "/permits/*/print", "/violations", "/violations/*", "/violations/*/print", "/documents", "/documents/*", "/checklists", "/checklists/*", "/approvals", "/approvals/*", "/change-password"],

  // Ответственный подрядной организацией — стартовая = Моя организация, нет подрядчики, нет чек-листы, нет согласования, нормативные только скачивание
  contractor_admin: ["/api/*", "/my-organization", "/my-organization/*", "/employees", "/employees/*", "/permits", "/permits/*", "/permits/*/print", "/permits/*/edit", "/violations", "/violations/*", "/violations/*/print", "/documents", "/documents/*", "/change-password"],

  // Сотрудник подрядной организации — стартовая = Моя организация, нет подрядчики, нет чек-листы, нет согласования, нормативные только скачивание, сотрудники — только своя карточка
  contractor_employee: ["/api/*", "/my-organization", "/my-organization/*", "/employees", "/employees/*", "/permits", "/permits/*", "/permits/*/print", "/violations", "/violations/*", "/violations/*/print", "/documents", "/documents/*", "/change-password"],
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

  // Check mustChangePwd — enforce password change on first login
  if (payload.mustChangePwd && pathname !== "/change-password" && pathname !== "/api/auth/change-password") {
    const changePwdUrl = new URL("/change-password", request.url);
    return NextResponse.redirect(changePwdUrl);
  }

  // Check role-based access
  const allowedPatterns = ROLE_ROUTES[payload.role] || [];

  // admin gets wildcard
  if (allowedPatterns.includes("/*")) {
    const denied = allowedPatterns.filter((p) => p.startsWith("!")).map((p) => p.slice(1));
    if (denied.some((d) => pathname.startsWith(d.replace("*", "")))) {
      return NextResponse.redirect(new URL("/auth/unauthorized", request.url));
    }
    return NextResponse.next();
  }

  // Other roles: check allowed patterns
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
