import { hashPassword } from "../auth";
import { prisma } from "../prisma";
import { randomUUID } from "crypto";

async function main() {
  console.log("Seeding database...");

  // ─── Users ──────────────────────────────────────────────────
  const adminHash = await hashPassword("Admin123!");
  const approverHash = await hashPassword("Approver1!");
  const contractorHash = await hashPassword("Contractor1!");
  const employeeHash = await hashPassword("Employee1!");

  const users = await Promise.all([
    prisma.user.upsert({
      where: { email: "admin@pirelli.ru" },
      update: {},
      create: {
        email: "admin@pirelli.ru",
        passwordHash: adminHash,
        fullName: "Администратор",
        role: "admin",
        mustChangePwd: true,
      },
    }),
    prisma.user.upsert({
      where: { email: "security@pirelli.ru" },
      update: {},
      create: {
        email: "security@pirelli.ru",
        passwordHash: approverHash,
        fullName: "Иванов А.С.",
        role: "department_approver",
        department: "security",
        mustChangePwd: true,
      },
    }),
    prisma.user.upsert({
      where: { email: "hr@pirelli.ru" },
      update: {},
      create: {
        email: "hr@pirelli.ru",
        passwordHash: approverHash,
        fullName: "Петрова Е.В.",
        role: "department_approver",
        department: "hr",
        mustChangePwd: true,
      },
    }),
    prisma.user.upsert({
      where: { email: "safety@pirelli.ru" },
      update: {},
      create: {
        email: "safety@pirelli.ru",
        passwordHash: approverHash,
        fullName: "Сидоров К.Н.",
        role: "department_approver",
        department: "safety",
        mustChangePwd: true,
      },
    }),
    prisma.user.upsert({
      where: { email: "safetytraining@pirelli.ru" },
      update: {},
      create: {
        email: "safetytraining@pirelli.ru",
        passwordHash: approverHash,
        fullName: "Козлова М.Р.",
        role: "department_approver",
        department: "safety_training",
        mustChangePwd: true,
      },
    }),
    prisma.user.upsert({
      where: { email: "permitbureau@pirelli.ru" },
      update: {},
      create: {
        email: "permitbureau@pirelli.ru",
        passwordHash: approverHash,
        fullName: "Новиков Д.А.",
        role: "department_approver",
        department: "permit_bureau",
        mustChangePwd: true,
      },
    }),
    prisma.user.upsert({
      where: { email: "podradchik@pirelli.ru" },
      update: {},
      create: {
        email: "podradchik@pirelli.ru",
        passwordHash: contractorHash,
        fullName: "Сидоров П.И.",
        role: "contractor_employee",
        organizationId: null,
        mustChangePwd: true,
      },
    }),
    prisma.user.upsert({
      where: { email: "employee@pirelli.ru" },
      update: {},
      create: {
        email: "employee@pirelli.ru",
        passwordHash: employeeHash,
        fullName: "Просматривающий",
        role: "employee",
        mustChangePwd: true,
      },
    }),
  ]);

  console.log(`  Created ${users.length} users`);

  // ─── Organizations (2 contractors) ──────────────────────────
  const orgData = [
    { id: randomUUID(), name: 'ООО «СтройЭнергоМонтаж»', inn: "7712345678", kpp: "771201001", legalAddress: "г. Москва, ул. Промышленная, д. 15", contactPersonName: "Петров И.С.", contactPhone: "+7(495)123-45-67", contactEmail: "info@stroymont.ru", status: "active" as const },
    { id: randomUUID(), name: 'АО «ТрансТехСервис»', inn: "7723456789", kpp: "772301001", legalAddress: "г. Калуга, пр. Мира, д. 42", contactPersonName: "Сидорова Е.А.", contactPhone: "+7(495)234-56-78", contactEmail: "office@tts-service.ru", status: "active" as const },
  ];

  const orgs = await Promise.all(
    orgData.map((org, idx) =>
      prisma.organization.upsert({
        where: { inn: org.inn },
        update: {},
        create: { ...org, sequentialNumber: idx + 1 },
      })
    )
  );
  console.log(`  Created ${orgs.length} organizations`);

  // ─── Contractor admin users (one per org) ───────────────────
  for (const org of orgs) {
    await prisma.user.upsert({
      where: { email: `resp_${org.sequentialNumber}@stroymont.ru` },
      update: {},
      create: {
        email: `resp_${org.sequentialNumber}@stroymont.ru`,
        passwordHash: await hashPassword(`Org${org.sequentialNumber}Admin1!`),
        fullName: `Ответственный ${org.name}`,
        role: "contractor_admin",
        organizationId: org.id,
        mustChangePwd: true,
      },
    });
  }
  console.log(`  Created ${orgs.length} contractor_admin users`);

  // ─── Employees (8 total, 4 per org) ─────────────────────────
  const now = new Date();

  const employeeData = [
    // Org 1 — СтройЭнергоМонтаж (4 employees)
    {
      orgIndex: 0,
      fullName: "Иванов Сергей Петрович",
      position: "Электромонтажник 4-го разряда",
      passportSeries: "4510",
      passportNumber: "123456",
      previouslyAtPirelli: false,
      workClasses: ["Электромонтажные работы до 1000В", "Работы на высоте", "Пусконаладочные работы", "Земляные работы"],
      documents: [
        { name: "Паспорт РФ", issueDate: new Date("2015-03-12"), expiryDate: new Date("2030-03-12") },
        { name: "Удостоверение электромонтажника", issueDate: new Date("2022-06-15"), expiryDate: new Date("2027-06-15") },
        { name: "Мед. справка форма 086/у", issueDate: new Date("2024-01-20"), expiryDate: new Date("2026-01-20") },
      ],
      approvals: [
        { department: "security" as const, status: "approved" as const, deadline: new Date("2026-04-01"), comment: "Проверка пройдена" },
        { department: "hr" as const, status: "approved" as const, deadline: new Date("2026-04-05"), comment: "Документы в порядке" },
        { department: "safety" as const, status: "pending" as const, deadline: new Date("2026-04-15") },
      ],
    },
    {
      orgIndex: 0,
      fullName: "Петрова Анна Михайловна",
      position: "Инженер по технике безопасности",
      passportSeries: "4511",
      passportNumber: "654321",
      previouslyAtPirelli: false,
      workClasses: ["Контроль охраны труда", "Аудит производственной безопасности"],
      documents: [
        { name: "Паспорт РФ", issueDate: new Date("2018-07-22"), expiryDate: new Date("2033-07-22") },
        { name: "Сертификат по охране труда", issueDate: new Date("2024-02-10"), expiryDate: new Date("2026-05-10") },
      ],
      approvals: [
        { department: "security" as const, status: "approved" as const, deadline: new Date("2026-03-15"), comment: "Проверка пройдена" },
        { department: "hr" as const, status: "approved" as const, deadline: new Date("2026-03-20") },
        { department: "safety" as const, status: "approved" as const, deadline: new Date("2026-03-25"), comment: "Допуск подтверждён" },
        { department: "safety_training" as const, status: "approved" as const, deadline: new Date("2026-03-28"), comment: "Пройден" },
        { department: "permit_bureau" as const, status: "approved" as const, deadline: new Date("2026-04-01"), comment: "Пропуск выдан" },
      ],
    },
    {
      orgIndex: 0,
      fullName: "Сидоров Алексей Владимирович",
      position: "Монтажник-высотник 3-го разряда",
      passportSeries: "4512",
      passportNumber: "111222",
      previouslyAtPirelli: true,
      workClasses: ["Работы на высоте", "Монтаж металлоконструкций"],
      documents: [
        { name: "Паспорт РФ", issueDate: new Date("2016-05-10"), expiryDate: new Date("2031-05-10") },
        { name: "Удостоверение по работе на высоте", issueDate: new Date("2024-03-01"), expiryDate: new Date("2026-06-01") },
      ],
      approvals: [
        { department: "security" as const, status: "approved" as const, deadline: new Date("2026-04-10"), comment: "ОК" },
        { department: "hr" as const, status: "pending" as const, deadline: new Date("2026-04-20") },
      ],
    },
    {
      orgIndex: 0,
      fullName: "Кузнецов Дмитрий Олегович",
      position: "Слесарь-сантехник 4-го разряда",
      passportSeries: "4513",
      passportNumber: "333444",
      previouslyAtPirelli: false,
      workClasses: ["Сантехнические работы", "Работы в confined space"],
      documents: [
        { name: "Паспорт РФ", issueDate: new Date("2019-11-15"), expiryDate: new Date("2034-11-15") },
      ],
      approvals: [
        { department: "security" as const, status: "rejected" as const, deadline: new Date("2026-04-05"), comment: "Неполный пакет документов" },
      ],
    },
    // Org 2 — ТрансТехСервис (4 employees)
    {
      orgIndex: 1,
      fullName: "Козлов Дмитрий Андреевич",
      position: "Сварщик 5-го разряда",
      passportSeries: "4608",
      passportNumber: "789012",
      previouslyAtPirelli: true,
      workClasses: ["Сварочные работы ММА", "Сварочные работы TIG", "Работы на высоте", "Огневые работы"],
      documents: [
        { name: "Паспорт РФ", issueDate: new Date("2010-11-05"), expiryDate: new Date("2025-11-05") },
        { name: "Удостоверение сварщика НАКС", issueDate: new Date("2023-08-14"), expiryDate: new Date("2027-08-14") },
        { name: "Мед. справка форма 086/у", issueDate: new Date("2024-05-01"), expiryDate: new Date("2026-05-01") },
      ],
      approvals: [
        { department: "security" as const, status: "rejected" as const, deadline: new Date("2026-04-10"), comment: "Не пройдена проверка по базам МВД" },
        { department: "hr" as const, status: "pending" as const, deadline: new Date("2026-04-15") },
        { department: "safety" as const, status: "pending" as const, deadline: new Date("2026-04-20") },
      ],
    },
    {
      orgIndex: 1,
      fullName: "Волкова Наталья Геннадьевна",
      position: "Инженер-электрик",
      passportSeries: "4609",
      passportNumber: "456789",
      previouslyAtPirelli: false,
      workClasses: ["Электромонтажные работы до 1000В", "Электролаборатория"],
      documents: [
        { name: "Паспорт РФ", issueDate: new Date("2017-04-20"), expiryDate: new Date("2032-04-20") },
        { name: "Диплом о высшем образовании", issueDate: new Date("2015-06-30"), expiryDate: null },
      ],
      approvals: [
        { department: "security" as const, status: "approved" as const, deadline: new Date("2026-03-20"), comment: "ОК" },
        { department: "hr" as const, status: "approved" as const, deadline: new Date("2026-03-25") },
        { department: "safety" as const, status: "pending" as const, deadline: new Date("2026-04-10") },
      ],
    },
    {
      orgIndex: 1,
      fullName: "Морозов Игорь Сергеевич",
      position: "Машинист крана 6-го разряда",
      passportSeries: "4610",
      passportNumber: "987654",
      previouslyAtPirelli: false,
      workClasses: ["Работы вблизи крановых путей", "Такелажные работы"],
      documents: [
        { name: "Паспорт РФ", issueDate: new Date("2014-09-01"), expiryDate: new Date("2029-09-01") },
        { name: "Удостоверение машиниста крана", issueDate: new Date("2023-01-15"), expiryDate: new Date("2026-07-15") },
      ],
      approvals: [
        { department: "security" as const, status: "approved" as const, deadline: new Date("2026-04-01"), comment: "ОК" },
        { department: "hr" as const, status: "pending" as const, deadline: new Date("2026-04-15") },
      ],
    },
    {
      orgIndex: 1,
      fullName: "Лебедева Ольга Викторовна",
      position: "Маляр строительный 3-го разряда",
      passportSeries: "4611",
      passportNumber: "321654",
      previouslyAtPirelli: false,
      workClasses: ["Покрасочные работы", "Работы на высоте"],
      documents: [
        { name: "Паспорт РФ", issueDate: new Date("2020-02-28"), expiryDate: new Date("2035-02-28") },
      ],
      approvals: [
        { department: "security" as const, status: "pending" as const, deadline: new Date("2026-04-20") },
      ],
    },
  ];

  const createdEmployees = [];

  for (const emp of employeeData) {
    const org = orgs[emp.orgIndex];
    const employee = await prisma.employee.create({
      data: {
        organizationId: org.id,
        fullName: emp.fullName,
        position: emp.position,
        passportSeries: emp.passportSeries,
        passportNumber: emp.passportNumber,
        previouslyAtPirelli: emp.previouslyAtPirelli,
        workClasses: {
          create: emp.workClasses.map((wc) => ({ workClass: wc })),
        },
        documents: {
          create: emp.documents.map((d) => ({
            name: d.name,
            issueDate: d.issueDate,
            expiryDate: d.expiryDate,
            status: d.expiryDate
              ? d.expiryDate < now
                ? "expired"
                : d.expiryDate.getTime() - now.getTime() < 30 * 24 * 60 * 60 * 1000
                ? "expiring"
                : "valid"
              : "valid",
          })),
        },
        approvals: {
          create: (emp.approvals as Array<{ department: "security" | "hr" | "safety" | "safety_training" | "permit_bureau"; status: "approved" | "rejected" | "pending"; deadline: Date; comment?: string | null }>).map((a) => ({
            department: a.department,
            status: a.status,
            deadline: a.deadline,
            comment: a.comment ?? null,
          })),
        },
      },
      include: { documents: true, approvals: true },
    });
    createdEmployees.push(employee);
  }

  console.log(`  Created ${createdEmployees.length} employees`);

  // ─── 5 predefined regulatory document sections ──────────────
  const presetSections = [
    "Безопасность и охрана труда",
    "Нормативные акты и стандарты",
    "Инструкции по эксплуатации",
    "Технические регламенты",
    "Формы и шаблоны документов",
  ];

  const sections = await Promise.all(
    presetSections.map((name, idx) =>
      prisma.regDocumentSection.create({
        data: { name, order: idx },
      }),
    ),
  );
  console.log(`  Created ${sections.length} predefined sections`);

  console.log("Seeding complete!");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
