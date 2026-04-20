import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authMiddleware, requireAdmin } from "@/lib/api-middleware";
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

  // contractor_admin can see any employee in their org; contractor_employee can only see themselves
  if (authResult.user.role === "contractor_employee") {
    if (authResult.user.employeeId !== employee.id) {
      return NextResponse.json({ error: "Forbidden: you can only view your own profile" }, { status: 403 });
    }
  } else if (authResult.user.role === "contractor_admin" && authResult.user.organizationId) {
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

  // Only admin or contractor_admin (own org) can create employees
  const role = authResult.user.role;

  if (role === "admin") {
    // admin can create for any org
  } else if (role === "contractor_admin" && authResult.user.organizationId) {
    if (authResult.user.organizationId !== orgId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else {
    return NextResponse.json({ error: "Forbidden: admin or contractor_admin access required" }, { status: 403 });
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

  // Authorization for editing employee
  if (authResult.user.role === "admin") {
    // admin can edit any employee
  } else if (authResult.user.role === "contractor_admin" && authResult.user.organizationId) {
    // contractor_admin can edit employees in their own org
    if (employee.organizationId !== authResult.user.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else if (authResult.user.role === "contractor_employee") {
    // contractor_employee can only edit themselves
    if (authResult.user.employeeId !== id) {
      return NextResponse.json({ error: "Forbidden: can only edit your own profile" }, { status: 403 });
    }
  } else {
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

  // Authorization for deleting employee
  if (authResult.user.role === "admin") {
    // admin can delete any employee
  } else if (authResult.user.role === "contractor_admin" && authResult.user.organizationId) {
    // contractor_admin can delete employees in their own org
    if (employee.organizationId !== authResult.user.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Delete any linked User account before deleting the Employee
  await prisma.$transaction([
    prisma.user.deleteMany({ where: { employeeId: id } }),
    prisma.employee.delete({ where: { id } }),
  ]);
  return NextResponse.json({ success: true });
}

async function requireAdminRole(user: { role: string }) {
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden: factory access only" }, { status: 403 });
  }
  return true;
}
