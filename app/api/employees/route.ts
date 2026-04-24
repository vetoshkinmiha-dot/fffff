import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authMiddleware, requireAdmin } from "@/lib/api-middleware";
import { paginationSchema, createEmployeeSchema } from "@/lib/validations";
import { hashPassword } from "@/lib/auth";

// Transliterate Cyrillic full name to latin email local-part
// "Иванов Иван Иванович" → "ivanov.ivan"
function transliterateName(fullName: string): string {
  const cyrillicMap: Record<string, string> = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "zh",
    з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o",
    п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts",
    ч: "ch", ш: "sh", щ: "shch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu",
    я: "ya",
  };

  const parts = fullName.trim().toLowerCase().split(/\s+/);
  return parts
    .map((part) =>
      part
        .split("")
        .map((ch) => cyrillicMap[ch] ?? ch)
        .join("")
    )
    .slice(0, 2) // first two words (surname + first name)
    .join(".");
}

// Generate random 12-char password: lowercase + uppercase + digits
function generateRandomPassword(): string {
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const digits = "0123456789";
  const all = lowercase + uppercase + digits;
  const chars: string[] = [];
  // Ensure at least one of each category
  chars.push(lowercase[Math.floor(Math.random() * lowercase.length)]);
  chars.push(uppercase[Math.floor(Math.random() * uppercase.length)]);
  chars.push(digits[Math.floor(Math.random() * digits.length)]);
  for (let i = 3; i < 12; i++) {
    chars.push(all[Math.floor(Math.random() * all.length)]);
  }
  // Shuffle
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

// Find a unique email for the new user
async function findUniqueEmail(baseName: string): Promise<string> {
  let candidate = `${baseName}@vshz.ru`;
  let attempts = 0;
  while (true) {
    const existing = await prisma.user.findUnique({ where: { email: candidate } });
    if (!existing) return candidate;
    attempts++;
    candidate = `${baseName}${attempts}@vshz.ru`;
    if (attempts > 100) {
      // Fallback: use a random suffix
      candidate = `${baseName}${Date.now()}@vshz.ru`;
      return candidate;
    }
  }
}

export async function GET(req: NextRequest) {
  const authResult = await authMiddleware(req);
  if (authResult instanceof NextResponse) return authResult;

  const { searchParams } = new URL(req.url);
  const q = paginationSchema.safeParse(Object.fromEntries(searchParams));
  if (!q.success) {
    return NextResponse.json({ error: "Invalid parameters: " + q.error.issues[0]?.message }, { status: 400 });
  }
  const query = q.data;
  const orgFilter = searchParams.get("organizationId");

  const where: any = {};

  if (query.search) {
    where.fullName = { contains: query.search };
  }

  if (orgFilter) {
    where.organizationId = orgFilter;
  }

  // Both contractor roles see all employees in their org
  if (
    (authResult.user.role === "contractor_employee" || authResult.user.role === "contractor_admin") && authResult.user.organizationId
  ) {
    where.organizationId = authResult.user.organizationId;
  }

  const [total, employees] = await Promise.all([
    prisma.employee.count({ where }),
    prisma.employee.findMany({
      where,
      include: {
        organization: { select: { name: true, sequentialNumber: true } },
        documents: { select: { id: true, name: true, status: true } },
        approvals: { select: { id: true, department: true, status: true } },
        workClasses: { select: { workClass: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
  ]);

  const data = employees.map((emp) => ({
    ...emp,
    workClasses: emp.workClasses.map((wc: { workClass: string }) => wc.workClass),
    documentCounts: {
      valid: emp.documents.filter((d) => d.status === "valid").length,
      expiring: emp.documents.filter((d) => d.status === "expiring").length,
      expired: emp.documents.filter((d) => d.status === "expired").length,
    },
  }));

  return NextResponse.json({
    data,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      pages: Math.ceil(total / query.limit),
    },
  });
}

export async function POST(req: NextRequest) {
  const authResult = await authMiddleware(req);
  if (authResult instanceof NextResponse) return authResult;

  const body = await req.json();

  // admin or contractor_admin (own org only) can create employees
  const role = authResult.user.role;
  const bodyOrgId = body.organizationId as string | undefined;

  if (role === "admin") {
    // admin can create for any org
  } else if (role === "contractor_admin" && authResult.user.organizationId) {
    if (bodyOrgId !== authResult.user.organizationId) {
      return NextResponse.json({ error: "Forbidden: can only create employees for your own organization" }, { status: 403 });
    }
  } else {
    return NextResponse.json({ error: "Forbidden: admin or contractor_admin access required" }, { status: 403 });
  }

  try {
    const validation = createEmployeeSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
    }

    const { workClasses, ...employeeData } = validation.data;
    const organizationId = bodyOrgId as string | undefined;
    if (!organizationId) {
      return NextResponse.json({ error: "organizationId is required" }, { status: 400 });
    }

    // Use a transaction to ensure employee + user are created atomically
    const employee = await prisma.$transaction(async (tx) => {
      const emp = await tx.employee.create({
        data: {
          ...employeeData,
          organizationId,
          passportIssueDate: employeeData.passportIssueDate
            ? new Date(employeeData.passportIssueDate)
            : undefined,
          workClasses: {
            create: workClasses.map((wc) => ({ workClass: wc })),
          },
        },
      });

      // Auto-create a contractor_employee User account
      const emailLocalPart = transliterateName(employeeData.fullName);
      const email = await findUniqueEmail(emailLocalPart);
      const plainPassword = generateRandomPassword();
      const passwordHash = await hashPassword(plainPassword);

      await tx.user.create({
        data: {
          email,
          passwordHash,
          fullName: employeeData.fullName,
          role: "contractor_employee",
          organizationId,
          employeeId: emp.id,
          temporaryPassword: plainPassword,
          mustChangePwd: true,
          isActive: true,
        },
      });

      return { emp, email, password: plainPassword };
    });

    return NextResponse.json(
      {
        id: employee.emp.id,
        fullName: employee.emp.fullName,
        loginCredentials: {
          email: employee.email,
          password: employee.password,
        },
      },
      { status: 201 }
    );
  } catch (err: any) {
    // Unique constraint violation (duplicate passport within org)
    if (err.code === "P2002") {
      return NextResponse.json({ error: "Сотрудник с такими паспортными данными уже существует в этой организации" }, { status: 409 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
