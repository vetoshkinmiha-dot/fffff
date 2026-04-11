import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authMiddleware } from "@/lib/api-middleware";
import { createUserSchema } from "@/lib/validations";
import { hashPassword } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const authResult = await authMiddleware(req);
  if (authResult instanceof NextResponse) return authResult;

  // Admin only
  if (authResult.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const role = searchParams.get("role");
  const organizationId = searchParams.get("organizationId");
  const isActive = searchParams.get("isActive");
  const search = searchParams.get("search");

  const where: any = {};
  if (role) where.role = role;
  if (organizationId) where.organizationId = organizationId;
  if (isActive !== null && isActive !== undefined) where.isActive = isActive === "true";
  if (search) {
    where.OR = [
      { email: { contains: search } },
      { fullName: { contains: search } },
    ];
  }

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      organizationId: true,
      department: true,
      isActive: true,
      mustChangePwd: true,
      createdAt: true,
      organization: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: users, pagination: { total: users.length, pages: 1 } });
}

export async function POST(req: NextRequest) {
  const authResult = await authMiddleware(req);
  if (authResult instanceof NextResponse) return authResult;

  if (authResult.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const validation = createUserSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
    }

    const { email, password, fullName, role, organizationId, department } = validation.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "User with this email already exists" }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        fullName,
        role,
        organizationId,
        department,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        organizationId: true,
        department: true,
        isActive: true,
      },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (err) {
    console.error("Create user error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
