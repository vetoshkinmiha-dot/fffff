import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authMiddleware } from "@/lib/api-middleware";
import { createEmployeeSchema, updateEmployeeSchema } from "@/lib/validations";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authMiddleware(req);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  const employee = await prisma.employee.findUnique({
    where: { id },
    include: {
      organization: { select: { id: true, name: true, sequentialNumber: true } },
      documents: { orderBy: { createdAt: "desc" } },
      approvals: { orderBy: { createdAt: "desc" } },
      workClasses: { select: { workClass: true } },
    },
  });

  if (!employee) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }

  // Normalize workClasses to array of strings for frontend
  const result = {
    ...employee,
    workClasses: employee.workClasses.map((wc) => wc.workClass),
  };

  // Contractor users can only see their own org's employees
  if (
    authResult.user.role === "contractor_admin" ||
    authResult.user.role === "contractor_user"
  ) {
    if (employee.organizationId !== authResult.user.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  return NextResponse.json(result);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authMiddleware(req);
  if (authResult instanceof NextResponse) return authResult;

  const { id: orgId } = await params;

  // Only contractor_admin (own org) or factory roles
  const isContractorAdmin = authResult.user.role === "contractor_admin";

  if (isContractorAdmin) {
    if (authResult.user.organizationId !== orgId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else {
    const factoryResult = await requireFactoryRoleFactory(authResult.user);
    if (factoryResult instanceof NextResponse) return factoryResult;
  }

  try {
    const body = await req.json();
    const validation = createEmployeeSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
    }

    const { workClasses, ...employeeData } = validation.data;

    const employee = await prisma.employee.create({
      data: {
        ...employeeData,
        organizationId: orgId,
        passportIssueDate: employeeData.passportIssueDate
          ? new Date(employeeData.passportIssueDate)
          : undefined,
        workClasses: {
          create: workClasses.map((wc) => ({ workClass: wc })),
        },
      },
    });

    return NextResponse.json(employee, { status: 201 });
  } catch (err) {
    console.error("Create employee error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authMiddleware(req);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  const employee = await prisma.employee.findUnique({ where: { id } });
  if (!employee) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }

  // Only contractor_admin can edit their own org's employees
  if (authResult.user.role === "contractor_admin") {
    if (employee.organizationId !== authResult.user.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else if (
    authResult.user.role !== "admin" &&
    authResult.user.role !== "factory_hse" &&
    authResult.user.role !== "factory_hr" &&
    authResult.user.role !== "factory_curator"
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const validation = updateEmployeeSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
    }

    const { workClasses, ...employeeData } = validation.data;

    const updated = await prisma.employee.update({
      where: { id },
      data: {
        ...employeeData,
        passportIssueDate: employeeData.passportIssueDate
          ? new Date(employeeData.passportIssueDate)
          : undefined,
        ...(workClasses && {
          workClasses: {
            deleteMany: {},
            create: workClasses.map((wc) => ({ workClass: wc })),
          },
        }),
      },
      include: {
        workClasses: { select: { workClass: true } },
      },
    });

    return NextResponse.json({
      ...updated,
      workClasses: updated.workClasses.map((wc) => wc.workClass),
    });
  } catch (err) {
    console.error("Update employee error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authMiddleware(req);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  const employee = await prisma.employee.findUnique({ where: { id } });
  if (!employee) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }

  if (authResult.user.role === "contractor_admin") {
    if (employee.organizationId !== authResult.user.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else if (
    authResult.user.role !== "admin" &&
    authResult.user.role !== "factory_hse" &&
    authResult.user.role !== "factory_hr" &&
    authResult.user.role !== "factory_curator"
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.employee.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

async function requireFactoryRoleFactory(user: { role: string }) {
  const factoryRoles = ["admin", "factory_hse", "factory_hr", "factory_curator"];
  if (!factoryRoles.includes(user.role)) {
    return NextResponse.json({ error: "Forbidden: factory access only" }, { status: 403 });
  }
  return true;
}
