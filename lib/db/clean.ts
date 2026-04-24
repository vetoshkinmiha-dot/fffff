import { prisma } from "../prisma";

async function main() {
  console.log("Cleaning database...");

  // Delete all non-user, non-org data (respect FK order)
  await prisma.checklistItem.deleteMany();
  console.log("  Deleted checklist_items");

  await prisma.checklist.deleteMany();
  console.log("  Deleted checklists");

  await prisma.violationComplaint.deleteMany();
  console.log("  Deleted violation_complaints");

  await prisma.violation.deleteMany();
  console.log("  Deleted violations");

  await prisma.violationTemplate.deleteMany();
  console.log("  Deleted violation_templates");

  await prisma.permitApproval.deleteMany();
  console.log("  Deleted permit_approvals");

  await prisma.permit.deleteMany();
  console.log("  Deleted permits");

  await prisma.approvalRequest.deleteMany();
  console.log("  Deleted approval_requests");

  await prisma.employeeDocument.deleteMany();
  console.log("  Deleted employee_documents");

  await prisma.employeeWorkClass.deleteMany();
  console.log("  Deleted employee_work_classes");

  await prisma.employee.deleteMany();
  console.log("  Deleted employees");

  await prisma.regDocument.deleteMany();
  console.log("  Deleted reg_documents");

  await prisma.regDocumentSection.deleteMany();
  console.log("  Deleted reg_document_sections");

  await prisma.emailLog.deleteMany();
  console.log("  Deleted email_logs");

  await prisma.notification.deleteMany();
  console.log("  Deleted notifications");

  await prisma.notificationSubscription.deleteMany();
  console.log("  Deleted notification_subscriptions");

  await prisma.refreshToken.deleteMany();
  console.log("  Deleted refresh_tokens");

  // Reset sequential numbers
  await prisma.organization.updateMany({ where: { sequentialNumber: { gte: 0 } }, data: { sequentialNumber: 0 } });

  // Delete contractor_employee users without org
  await prisma.user.deleteMany({ where: { role: "contractor_employee", organizationId: null } });
  console.log("  Deleted orphan contractor_employee users");

  console.log("Clean complete!");
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
