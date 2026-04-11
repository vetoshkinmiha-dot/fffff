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
      where: { email: "approver@pirelli.ru" },
      update: {},
      create: {
        email: "approver@pirelli.ru",
        passwordHash: approverHash,
        fullName: "Иванов А.С.",
        role: "department_approver",
        department: "safety",
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

  // ─── Organizations ──────────────────────────────────────────
  const orgData = [
    { id: randomUUID(), name: 'ООО «СтройЭнергоМонтаж»', inn: "7712345678", kpp: "771201001", legalAddress: "г. Москва, ул. Промышленная, д. 15", contactPersonName: "Петров И.С.", contactPhone: "+7(495)123-45-67", contactEmail: "info@stroymont.ru", status: "active" as const },
    { id: randomUUID(), name: 'АО «ТрансТехСервис»', inn: "7723456789", kpp: "772301001", legalAddress: "г. Калуга, пр. Мира, д. 42", contactPersonName: "Сидорова Е.А.", contactPhone: "+7(495)234-56-78", contactEmail: "office@tts-service.ru", status: "active" as const },
    { id: randomUUID(), name: 'ООО «ПромВентиляция»', inn: "7734567890", kpp: "773401001", legalAddress: "г. Нижний Новгород, ул. Свободы, д. 8", contactPersonName: "Козлов Д.М.", contactPhone: "+7(495)345-67-89", contactEmail: "zakaz@promvent.ru", status: "pending" as const },
    { id: randomUUID(), name: "ИП Козлов А.В.", inn: "404512345678", kpp: "", legalAddress: "г. Обнинск, ул. Ленина, д. 3", contactPersonName: "Козлов А.В.", contactPhone: "+7(495)456-78-90", contactEmail: "kozlov.av@mail.ru", status: "active" as const },
    { id: randomUUID(), name: 'ООО «КлиматКонтроль»', inn: "7745678901", kpp: "774501001", legalAddress: "г. Москва, ул. Академика Королёва, д. 21", contactPersonName: "Волкова Н.Г.", contactPhone: "+7(495)567-89-01", contactEmail: "support@climatcontrol.ru", status: "blocked" as const },
    { id: randomUUID(), name: 'ЗАО «ИнжСистемы»', inn: "7756789012", kpp: "775601001", legalAddress: "г. Санкт-Петербург, Невский пр., д. 100", contactPersonName: "Михайлов С.В.", contactPhone: "+7(495)678-90-12", contactEmail: "info@engsystems.ru", status: "active" as const },
    { id: randomUUID(), name: 'ООО «ЭлектроЩит»', inn: "7767890123", kpp: "776701001", legalAddress: "г. Тула, ул. Октябрьская, д. 56", contactPersonName: "Новиков П.Л.", contactPhone: "+7(495)789-01-23", contactEmail: "sales@electroshield.ru", status: "pending" as const },
    { id: randomUUID(), name: 'ООО «АльфаЛогистик»', inn: "7778901234", kpp: "777801001", legalAddress: "г. Москва, Варшавское ш., д. 129", contactPersonName: "Кузнецов Р.А.", contactPhone: "+7(495)890-12-34", contactEmail: "info@alfalog.ru", status: "active" as const },
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

  // ─── Contractor admin user ──────────────────────────────────
  const contractorAdmin = await prisma.user.upsert({
    where: { email: "admin@stroymont.ru" },
    update: {},
    create: {
      email: "admin@stroymont.ru",
      passwordHash: contractorHash,
      fullName: "Петров И.С.",
      role: "contractor_employee",
      organizationId: orgs[0].id,
      mustChangePwd: true,
    },
  });
  console.log(`  Created contractor admin for ${orgs[0].name}`);

  // ─── Employees ──────────────────────────────────────────────
  const now = new Date();

  const employeeData = [
    {
      orgIndex: 0,
      fullName: "Иванов Сергей Петрович",
      position: "Электромонтажник 4-го разряда",
      passportSeries: "45 10",
      passportNumber: "123456",
      previouslyAtPirelli: false,
      workClasses: ["Электромонтажные работы до 1000В", "Работы на высоте", "Пусконаладочные работы", "Земляные работы"],
      documents: [
        { name: "Паспорт РФ", issueDate: new Date("2015-03-12"), expiryDate: new Date("2030-03-12") },
        { name: "Удостоверение электромонтажника", issueDate: new Date("2022-06-15"), expiryDate: new Date("2025-06-15") },
        { name: "Мед. справка форма 086/у", issueDate: new Date("2023-01-20"), expiryDate: new Date("2025-01-20") },
        { name: "Протокол по охране труда", issueDate: new Date("2024-09-01"), expiryDate: new Date("2025-09-01") },
      ],
      approvals: [
        { department: "security" as const, status: "approved" as const, deadline: new Date("2025-04-01"), comment: "Проверка пройдена, замечаний нет" },
        { department: "hr" as const, status: "approved" as const, deadline: new Date("2025-04-05"), comment: "Трудовая книжка проверена" },
        { department: "safety" as const, status: "pending" as const, deadline: new Date("2025-04-15") },
        { department: "safety_training" as const, status: "pending" as const, deadline: new Date("2025-04-20") },
        { department: "permit_bureau" as const, status: "pending" as const, deadline: new Date("2025-04-25") },
      ],
    },
    {
      orgIndex: 0,
      fullName: "Петрова Анна Михайловна",
      position: "Инженер по технике безопасности",
      passportSeries: "45 11",
      passportNumber: "654321",
      previouslyAtPirelli: false,
      workClasses: ["Контроль охраны труда", "Аудит производственной безопасности"],
      documents: [
        { name: "Паспорт РФ", issueDate: new Date("2018-07-22"), expiryDate: new Date("2033-07-22") },
        { name: "Диплом о высшем образовании", issueDate: new Date("2016-06-30"), expiryDate: null },
        { name: "Сертификат по охране труда", issueDate: new Date("2024-02-10"), expiryDate: new Date("2025-02-10") },
      ],
      approvals: [
        { department: "security" as const, status: "approved" as const, deadline: new Date("2025-03-15"), comment: "Проверка пройдена" },
        { department: "hr" as const, status: "approved" as const, deadline: new Date("2025-03-20") },
        { department: "safety" as const, status: "approved" as const, deadline: new Date("2025-03-25"), comment: "Допуск подтверждён" },
        { department: "safety_training" as const, status: "approved" as const, deadline: new Date("2025-03-28"), comment: "Пройден 25.03.2025" },
        { department: "permit_bureau" as const, status: "approved" as const, deadline: new Date("2025-04-01"), comment: "Пропуск №П-0042 выдан" },
      ],
    },
    {
      orgIndex: 1,
      fullName: "Козлов Дмитрий Андреевич",
      position: "Сварщик 5-го разряда",
      passportSeries: "46 08",
      passportNumber: "789012",
      previouslyAtPirelli: true,
      workClasses: ["Сварочные работы ММА", "Сварочные работы TIG", "Работы на высоте", "Огневые работы"],
      documents: [
        { name: "Паспорт РФ", issueDate: new Date("2010-11-05"), expiryDate: new Date("2025-11-05") },
        { name: "Удостоверение сварщика НАКС", issueDate: new Date("2023-08-14"), expiryDate: new Date("2027-08-14") },
        { name: "Мед. справка форма 086/у", issueDate: new Date("2024-05-01"), expiryDate: new Date("2025-05-01") },
      ],
      approvals: [
        { department: "security" as const, status: "rejected" as const, deadline: new Date("2025-04-10"), comment: "Не пройдена проверка по базам МВД" },
        { department: "hr" as const, status: "pending" as const, deadline: new Date("2025-04-15") },
        { department: "safety" as const, status: "pending" as const, deadline: new Date("2025-04-20") },
        { department: "safety_training" as const, status: "pending" as const, deadline: new Date("2025-04-25") },
        { department: "permit_bureau" as const, status: "pending" as const, deadline: new Date("2025-04-30") },
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
          create: emp.approvals.map((a) => ({
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
