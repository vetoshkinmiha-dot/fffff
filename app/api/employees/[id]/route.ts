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

  // Contractor employees can only see their own org's employees
  if (authResult.user.role === "contractor_employee") {
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

  // Only contractor_employee (own org) or admin
  const isContractorEmployee = authResult.user.role === "contractor_employee";

  if (isContractorEmployee) {
    if (authResult.user.organizationId !== orgId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else {
    const adminResult = requireAdmin(authResult.user);
    if (adminResult instanceof NextResponse) return adminResult;
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

  // Only contractor_employee can edit their own org's employees
  if (authResult.user.role === "contractor_employee") {
    if (employee.organizationId !== authResult.user.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else if (authResult.user.role !== "admin") {
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

  if (authResult.user.role === "contractor_employee") {
    if (employee.organizationId !== authResult.user.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else if (authResult.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.employee.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

async function requireAdminRole(user: { role: string }) {
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden: factory access only" }, { status: 403 });
  }
  return true;
}
