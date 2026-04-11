-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "organization_id" TEXT,
    "department" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "must_change_pwd" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "user_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "organization" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sequential_number" INTEGER NOT NULL DEFAULT 0,
    "name" TEXT NOT NULL,
    "inn" TEXT NOT NULL,
    "kpp" TEXT,
    "legal_address" TEXT NOT NULL,
    "contact_person_name" TEXT,
    "contact_phone" TEXT,
    "contact_email" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "employee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organization_id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "photo_url" TEXT,
    "passport_series" TEXT NOT NULL,
    "passport_number" TEXT NOT NULL,
    "passport_issued_by" TEXT,
    "passport_issue_date" DATETIME,
    "previously_at_pirelli" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "employee_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "employee_work_class" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employee_id" TEXT NOT NULL,
    "work_class" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "employee_work_class_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "employee_document" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employee_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "file_url" TEXT,
    "issue_date" DATETIME,
    "expiry_date" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'valid',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "employee_document_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "approval_request" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employee_id" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "deadline" DATETIME NOT NULL,
    "comment" TEXT,
    "decided_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "approval_request_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "organization_sequential_number_key" ON "organization"("sequential_number");

-- CreateIndex
CREATE UNIQUE INDEX "organization_inn_key" ON "organization"("inn");

-- CreateIndex
CREATE UNIQUE INDEX "employee_organization_id_passport_series_passport_number_key" ON "employee"("organization_id", "passport_series", "passport_number");

-- CreateIndex
CREATE UNIQUE INDEX "employee_work_class_employee_id_work_class_key" ON "employee_work_class"("employee_id", "work_class");
