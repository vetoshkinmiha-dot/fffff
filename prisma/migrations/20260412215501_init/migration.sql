-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'employee', 'contractor_employee', 'department_approver');

-- CreateEnum
CREATE TYPE "ApprovalDepartment" AS ENUM ('security', 'hr', 'safety', 'safety_training', 'permit_bureau');

-- CreateEnum
CREATE TYPE "OrgStatus" AS ENUM ('pending', 'active', 'blocked');

-- CreateEnum
CREATE TYPE "DocStatus" AS ENUM ('valid', 'expiring', 'expired');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "PermitWorkCategory" AS ENUM ('hot_work', 'height_work', 'confined_space', 'electrical', 'excavation', 'other');

-- CreateEnum
CREATE TYPE "PermitStatus" AS ENUM ('draft', 'pending_approval', 'approved', 'active', 'early_closed', 'closed', 'expired');

-- CreateEnum
CREATE TYPE "ViolationSeverity" AS ENUM ('low', 'medium', 'high', 'critical');

-- CreateEnum
CREATE TYPE "ViolationStatus" AS ENUM ('pending', 'resolved', 'escalated');

-- CreateEnum
CREATE TYPE "ChecklistStatus" AS ENUM ('in_progress', 'passed', 'failed');

-- CreateEnum
CREATE TYPE "FileType" AS ENUM ('pdf', 'docx', 'xlsx');

-- CreateEnum
CREATE TYPE "EmailLogStatus" AS ENUM ('SENT', 'FAILED', 'PENDING');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('approval_requested', 'approval_result', 'document_added', 'document_expiring', 'document_expired', 'permit_expiring', 'permit_closed', 'complaint_submitted');

-- CreateTable
CREATE TABLE "notification" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "organization_id" TEXT,
    "department" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "must_change_pwd" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization" (
    "id" TEXT NOT NULL,
    "sequential_number" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "inn" TEXT NOT NULL,
    "kpp" TEXT,
    "legal_address" TEXT NOT NULL,
    "contact_person_name" TEXT,
    "contact_phone" TEXT,
    "contact_email" TEXT,
    "status" "OrgStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "photo_url" TEXT,
    "passport_series" TEXT NOT NULL,
    "passport_number" TEXT NOT NULL,
    "passport_issued_by" TEXT,
    "passport_issue_date" TIMESTAMP(3),
    "previously_at_pirelli" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_work_class" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "work_class" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_work_class_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_document" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "file_url" TEXT,
    "issue_date" TIMESTAMP(3),
    "expiry_date" TIMESTAMP(3),
    "status" "DocStatus" NOT NULL DEFAULT 'valid',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_request" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "department" "ApprovalDepartment" NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'pending',
    "deadline" TIMESTAMP(3) NOT NULL,
    "comment" TEXT,
    "decided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_log" (
    "id" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "message" TEXT,
    "status" "EmailLogStatus" NOT NULL DEFAULT 'PENDING',
    "sent_at" TIMESTAMP(3),
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permit" (
    "id" TEXT NOT NULL,
    "permit_number" TEXT NOT NULL,
    "category" "PermitWorkCategory" NOT NULL,
    "contractor_id" TEXT NOT NULL,
    "work_site" TEXT NOT NULL,
    "responsible_person" TEXT NOT NULL,
    "open_date" TIMESTAMP(3) NOT NULL,
    "expiry_date" TIMESTAMP(3) NOT NULL,
    "status" "PermitStatus" NOT NULL DEFAULT 'draft',
    "close_reason" TEXT,
    "closed_at" TIMESTAMP(3),
    "sequential_number" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permit_approval" (
    "id" TEXT NOT NULL,
    "permit_id" TEXT NOT NULL,
    "department" "ApprovalDepartment" NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'pending',
    "deadline" TIMESTAMP(3) NOT NULL,
    "comment" TEXT,
    "decided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permit_approval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "violation" (
    "id" TEXT NOT NULL,
    "violation_number" TEXT NOT NULL,
    "contractor_id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "ViolationSeverity" NOT NULL,
    "status" "ViolationStatus" NOT NULL DEFAULT 'pending',
    "department" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "photo_url" TEXT,
    "resolved_at" TIMESTAMP(3),
    "resolution_notes" TEXT,
    "sequential_number" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "violation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "violation_complaint" (
    "id" TEXT NOT NULL,
    "violation_id" TEXT NOT NULL,
    "complaint_text" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "violation_complaint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "violation_template" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "default_severity" "ViolationSeverity" NOT NULL DEFAULT 'medium',
    "department" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "violation_template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist" (
    "id" TEXT NOT NULL,
    "contractor_id" TEXT NOT NULL,
    "inspector_name" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "score" INTEGER,
    "status" "ChecklistStatus" NOT NULL DEFAULT 'in_progress',
    "comments" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "checklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_item" (
    "id" TEXT NOT NULL,
    "checklist_id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "comment" TEXT,
    "photo_url" TEXT,

    CONSTRAINT "checklist_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reg_document_section" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parent_id" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reg_document_section_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reg_document" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "section_id" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "fileType" "FileType" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reg_document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_subscription" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "email_on_update" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_subscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notification_user_id_idx" ON "notification"("user_id");

-- CreateIndex
CREATE INDEX "notification_is_read_idx" ON "notification"("is_read");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "user_role_idx" ON "user"("role");

-- CreateIndex
CREATE INDEX "user_organization_id_idx" ON "user"("organization_id");

-- CreateIndex
CREATE INDEX "user_department_idx" ON "user"("department");

-- CreateIndex
CREATE UNIQUE INDEX "organization_sequential_number_key" ON "organization"("sequential_number");

-- CreateIndex
CREATE UNIQUE INDEX "organization_inn_key" ON "organization"("inn");

-- CreateIndex
CREATE INDEX "organization_status_idx" ON "organization"("status");

-- CreateIndex
CREATE INDEX "organization_sequential_number_idx" ON "organization"("sequential_number");

-- CreateIndex
CREATE INDEX "employee_organization_id_idx" ON "employee"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "employee_organization_id_passport_series_passport_number_key" ON "employee"("organization_id", "passport_series", "passport_number");

-- CreateIndex
CREATE UNIQUE INDEX "employee_work_class_employee_id_work_class_key" ON "employee_work_class"("employee_id", "work_class");

-- CreateIndex
CREATE INDEX "employee_document_status_idx" ON "employee_document"("status");

-- CreateIndex
CREATE INDEX "employee_document_expiry_date_idx" ON "employee_document"("expiry_date");

-- CreateIndex
CREATE INDEX "approval_request_employee_id_idx" ON "approval_request"("employee_id");

-- CreateIndex
CREATE INDEX "approval_request_department_status_idx" ON "approval_request"("department", "status");

-- CreateIndex
CREATE INDEX "email_log_recipient_idx" ON "email_log"("recipient");

-- CreateIndex
CREATE INDEX "email_log_status_idx" ON "email_log"("status");

-- CreateIndex
CREATE UNIQUE INDEX "permit_permit_number_key" ON "permit"("permit_number");

-- CreateIndex
CREATE INDEX "permit_contractor_id_idx" ON "permit"("contractor_id");

-- CreateIndex
CREATE INDEX "permit_status_idx" ON "permit"("status");

-- CreateIndex
CREATE INDEX "permit_expiry_date_idx" ON "permit"("expiry_date");

-- CreateIndex
CREATE INDEX "permit_approval_permit_id_idx" ON "permit_approval"("permit_id");

-- CreateIndex
CREATE INDEX "permit_approval_department_status_idx" ON "permit_approval"("department", "status");

-- CreateIndex
CREATE UNIQUE INDEX "violation_violation_number_key" ON "violation"("violation_number");

-- CreateIndex
CREATE INDEX "violation_contractor_id_idx" ON "violation"("contractor_id");

-- CreateIndex
CREATE INDEX "violation_status_idx" ON "violation"("status");

-- CreateIndex
CREATE INDEX "violation_severity_idx" ON "violation"("severity");

-- CreateIndex
CREATE INDEX "violation_date_idx" ON "violation"("date");

-- CreateIndex
CREATE INDEX "violation_complaint_violation_id_idx" ON "violation_complaint"("violation_id");

-- CreateIndex
CREATE INDEX "violation_template_is_active_idx" ON "violation_template"("is_active");

-- CreateIndex
CREATE INDEX "checklist_contractor_id_idx" ON "checklist"("contractor_id");

-- CreateIndex
CREATE INDEX "checklist_date_idx" ON "checklist"("date");

-- CreateIndex
CREATE INDEX "checklist_status_idx" ON "checklist"("status");

-- CreateIndex
CREATE INDEX "checklist_item_checklist_id_idx" ON "checklist_item"("checklist_id");

-- CreateIndex
CREATE INDEX "reg_document_section_parent_id_idx" ON "reg_document_section"("parent_id");

-- CreateIndex
CREATE INDEX "reg_document_section_order_idx" ON "reg_document_section"("order");

-- CreateIndex
CREATE INDEX "reg_document_section_id_idx" ON "reg_document"("section_id");

-- CreateIndex
CREATE INDEX "reg_document_fileType_idx" ON "reg_document"("fileType");

-- CreateIndex
CREATE UNIQUE INDEX "notification_subscription_user_id_key" ON "notification_subscription"("user_id");

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee" ADD CONSTRAINT "employee_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_work_class" ADD CONSTRAINT "employee_work_class_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_document" ADD CONSTRAINT "employee_document_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_request" ADD CONSTRAINT "approval_request_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permit" ADD CONSTRAINT "permit_contractor_id_fkey" FOREIGN KEY ("contractor_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permit_approval" ADD CONSTRAINT "permit_approval_permit_id_fkey" FOREIGN KEY ("permit_id") REFERENCES "permit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "violation" ADD CONSTRAINT "violation_contractor_id_fkey" FOREIGN KEY ("contractor_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "violation" ADD CONSTRAINT "violation_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "violation_complaint" ADD CONSTRAINT "violation_complaint_violation_id_fkey" FOREIGN KEY ("violation_id") REFERENCES "violation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "violation_template" ADD CONSTRAINT "violation_template_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist" ADD CONSTRAINT "checklist_contractor_id_fkey" FOREIGN KEY ("contractor_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist" ADD CONSTRAINT "checklist_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_item" ADD CONSTRAINT "checklist_item_checklist_id_fkey" FOREIGN KEY ("checklist_id") REFERENCES "checklist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reg_document_section" ADD CONSTRAINT "reg_document_section_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "reg_document_section"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reg_document" ADD CONSTRAINT "reg_document_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "reg_document_section"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reg_document" ADD CONSTRAINT "reg_document_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_subscription" ADD CONSTRAINT "notification_subscription_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
