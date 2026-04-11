# Stage 1 Specification: Contractor Registry & Employee Cards

**Aligned with:** `docs/ARCHITECTURE_STAGE1.md` (architect's doc)

## Scope

Implement core **Module 1** (Contractor DB + Employee Cards + Approval Workflow) + **Regulatory Documents Module** as part of Stage 1, built on a modular plugin architecture.

## What's Already Done (Demo UI)

The project has a frontend demo with:
- Next.js 16 app router, shadcn/ui, Tailwind CSS v4, TypeScript
- Read-only listing + detail pages for contractors, employees, permits, violations, checklists, documents
- Mock data in multiple inconsistent files (needs cleanup)
- Hardcoded single user in header ("Иванов А.С.", Safety Manager)
- No API routes, no database, no auth, no CRUD operations, no forms

---

## Epic 1: Foundation

### 1.1 Database Schema (Prisma)

**Stack:** PostgreSQL 16 + Prisma 6

#### Kernel Tables

**`User`** — System users (multi-user access, ТЗ 1.4)
| Column | Type | Notes |
|---|---|---|
| id | String (UUID) | @default(uuid()) |
| email | String | @unique |
| passwordHash | String | bcrypt, salt rounds >= 12 |
| firstName | String | |
| lastName | String | |
| role | Role enum | @default(CONTRACTOR_EMPLOYEE) |
| contractorId | String? | NULL for plant employees, FK → Contractor |
| isActive | Boolean | @default(true) |
| createdAt | DateTime | @default(now()) |
| updatedAt | DateTime | @updatedAt |
| lastLoginAt | DateTime? | |

**`Session`** — Session management
| Column | Type | Notes |
|---|---|---|
| id | String (UUID) | @default(uuid()) |
| userId | String | FK → User, onDelete: Cascade |
| token | String | @unique |
| expiresAt | DateTime | |
| createdAt | DateTime | @default(now()) |

**Role Enum:**
| Role | Description |
|---|---|
| `ADMIN` | System admin — full access |
| `HSE` | Safety/Охрана труда — approve safety, manage regulatory docs |
| `HR` | HR department — approve employee history |
| `SECURITY` | Security service — approve access, check permits |
| `SUPERVISOR` | Plant curator/куратор — oversee contractors |
| `CONTRACTOR_ADMIN` | Contractor company admin — manage own org |
| `CONTRACTOR_EMPLOYEE` | Contractor employee — view own data |

#### Contractors Module Tables

**`Contractor`** — Legal entities (ТЗ 1.1)
| Column | Type | Notes |
|---|---|---|
| id | String (UUID) | @default(uuid()) |
| contractorNumber | String | @unique — sequential number for permit format (ТЗ 1.3) |
| name | String | Legal entity name |
| inn | String | @unique — Tax ID |
| kpp | String | |
| legalAddress | String | |
| actualAddress | String? | |
| phone | String? | |
| email | String? | |
| status | ContractorStatus | @default(PENDING) |
| contactPerson | String? | |
| contactPhone | String? | |
| contactEmail | String? | |
| createdAt | DateTime | @default(now()) |
| updatedAt | DateTime | @updatedAt |

**ContractorStatus:** `PENDING`, `ACTIVE`, `BLOCKED`, `TERMINATED`

**`Employee`** — Employee cards (ТЗ 1.2)
| Column | Type | Notes |
|---|---|---|
| id | String (UUID) | @default(uuid()) |
| contractorId | String | FK → Contractor, onDelete: Cascade |
| fullName | String | |
| position | String? | |
| photoPath | String? | Path to stored photo |
| passportSeries | String | Passport series |
| passportNumber | String | Passport number |
| passportIssuedBy | String? | |
| passportIssueDate | DateTime? | |
| workClasses | String[] | Перечень/класс работ (ТЗ 1.2.1) |
| createdAt | DateTime | @default(now()) |
| updatedAt | DateTime | @updatedAt |

Unique constraint: `[contractorId, passportSeries, passportNumber]`

**`EmployeeDocument`** — Documents with expiry (ТЗ 1.2)
| Column | Type | Notes |
|---|---|---|
| id | String (UUID) | @default(uuid()) |
| employeeId | String | FK → Employee, onDelete: Cascade |
| name | String | Document type name |
| docType | DocumentType | |
| fileUrl | String | Path to stored file |
| issueDate | DateTime? | |
| expiryDate | DateTime? | For expiry alerts |
| status | DocumentStatus | @default(VALID) |
| createdAt | DateTime | @default(now()) |

**DocumentType:** `PASSPORT`, `MEDICAL_BOOK`, `SAFETY_CERTIFICATE`, `QUALIFICATION_CERT`, `TRAINING_CERT`, `OTHER`

**DocumentStatus:** `VALID`, `EXPIRING` (within 30 days), `EXPIRED`

**`Approval`** — Approval routing (ТЗ 1.2.2)
| Column | Type | Notes |
|---|---|---|
| id | String (UUID) | @default(uuid()) |
| employeeId | String | FK → Employee, onDelete: Cascade |
| department | ApprovalDepartment | |
| status | ApprovalStatus | @default(PENDING) |
| assignedToId | String? | FK → User |
| deadline | DateTime | Конкретный срок (ТЗ 1.2.2) |
| comment | String? | |
| createdAt | DateTime | @default(now()) |
| reviewedAt | DateTime? | |

**ApprovalDepartment:** `SECURITY` (СБ), `HR` (ОК), `SAFETY` (ОТ допуск), `SAFETY_TRAINING` (ОТ вводный), `PERMIT_BUREAU` (Бюро пропусков)

**ApprovalStatus:** `PENDING`, `APPROVED`, `REJECTED`

#### Regulatory Docs Module Tables

**`RegDocument`** — Normative documents (ТЗ 5)
| Column | Type | Notes |
|---|---|---|
| id | String (UUID) | @default(uuid()) |
| title | String | |
| category | String | Section/group name |
| section | String? | Sub-section |
| fileUrl | String | Path to stored file |
| fileType | FileType | PDF / DOCX / XLSX |
| version | Int | @default(1) |
| createdAt | DateTime | @default(now()) |
| updatedAt | DateTime | @updatedAt |
| createdBy | String | FK → User |

**`RegDocumentSection`** — Editable section hierarchy (ТЗ 5.2)
| Column | Type | Notes |
|---|---|---|
| id | String (UUID) | @default(uuid()) |
| name | String | Section display name |
| parentId | String? | Self-referencing FK → RegDocumentSection (nested hierarchy) |
| order | Int | @default(0) |
| createdAt | DateTime | @default(now()) |
| updatedAt | DateTime | @updatedAt |

**`EmailLog`** — Notification tracking
| Column | Type | Notes |
|---|---|---|
| id | String (UUID) | @default(uuid()) |
| recipient | String | |
| subject | String | |
| template | String | |
| status | EmailStatus | @default(SENT) |
| sentAt | DateTime | @default(now()) |
| error | String? | |

---

### 1.2 API Routes

**Route pattern:** `/api/modules/{module-id}/*` (modular plugin architecture)

**Contractors Module** (`/api/modules/contractors/*`):
```
GET    /api/modules/contractors                          # List all contractors
POST   /api/modules/contractors                          # Create contractor
GET    /api/modules/contractors/{id}                     # Contractor detail
PATCH  /api/modules/contractors/{id}                     # Update contractor
DELETE /api/modules/contractors/{id}                     # Delete contractor

GET    /api/modules/contractors/{id}/employees            # List employees
POST   /api/modules/contractors/{id}/employees            # Create employee
PATCH  /api/modules/contractors/{id}/employees/{eid}      # Update employee

POST   /api/modules/contractors/employees/{eid}/documents          # Upload document
DELETE /api/modules/contractors/employees/{eid}/documents/{did}    # Delete document

POST   /api/modules/contractors/employees/{eid}/approvals          # Submit for approval
PATCH  /api/modules/contractors/approvals/{id}                     # Approve/reject
GET    /api/modules/contractors/approvals/pending                  # My pending approvals
```

**Regulatory Docs Module** (`/api/modules/regulatory-docs/*`):
```
GET    /api/modules/regulatory-docs/sections              # List sections
POST   /api/modules/regulatory-docs/sections              # Create section (HSE only)
PATCH  /api/modules/regulatory-docs/sections/{id}         # Rename section (HSE only)
GET    /api/modules/regulatory-docs/documents             # List documents
POST   /api/modules/regulatory-docs/documents             # Upload (HSE only)
GET    /api/modules/regulatory-docs/documents/{id}        # Get/download
DELETE /api/modules/regulatory-docs/documents/{id}        # Delete (HSE only)
```

**Auth & Infrastructure:**
```
POST   /api/auth/[...nextauth]          # NextAuth handler
GET    /api/auth/me                     # Current user (from session)
GET    /api/health                      # Health check + loaded modules
POST   /api/cron/document-expiry        # Cron endpoint (CRON_SECRET-protected)
```

### 1.3 Role-Permission Matrix

| Permission | ADMIN | HSE | HR | SECURITY | SUPERVISOR | CONTRACTOR_ADMIN | CONTRACTOR_EMPLOYEE |
|---|---|---|---|---|---|---|---|
| View all contractors | ✅ | ✅ | ✅ | ✅ | ✅ | Own only | ❌ |
| Create contractor | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| View employees | ✅ | ✅ | ✅ | ✅ | ✅ | Own only | Own card |
| Create employee | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ |
| Upload employee docs | ✅ | ❌ | ❌ | ❌ | ✅ | Own company | ❌ |
| HR approval | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Security approval | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Safety approval | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Safety training approval | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Permit bureau approval | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| View regulatory docs | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Upload regulatory docs | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Manage sections | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| View module list | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

### 1.4 File Upload

**Abstract `StorageProvider` interface** with `LocalStorageProvider` implementation for Stage 1:
```
/upload/
  employees/{employeeId}/photos/
  employees/{employeeId}/documents/
  regulatory-docs/{sectionId}/
```
Swappable to S3/MinIO later. Max file size: 10MB. Validate MIME type, sanitize filenames.

### 1.5 Email Notifications

**Nodemailer** with SMTP. Email templates via react-email:

1. **Approval Requested** — to approver when employee submitted (employee name, contractor, department, deadline, review link)
2. **Approval Completed** — to contractor admin (result + comment)
3. **Document Expiring** — 30 days before expiry (employee name, doc type, expiry date)
4. **Document Expired** — on expiry date (employee name, doc type)
5. **Reg Doc Updated** — when new regulatory doc added (email blast to all users)

**Cron job** (daily) via `node-cron` or external cron hitting `/api/cron/document-expiry` (protected by `CRON_SECRET`):
- Check `EmployeeDocument.expiryDate`
- 30 days before → status = EXPIRING, email to contractor admin
- On expiry → status = EXPIRED, email to contractor admin + security

### 1.6 Seed Data

Prisma seed script with:
- 7 users: 1 ADMIN, 1 HSE, 1 HR, 1 SECURITY, 1 SUPERVISOR, 1 CONTRACTOR_ADMIN, 1 CONTRACTOR_EMPLOYEE
- Default admin: `admin@pirelli.ru` / `Admin123!` (force change on first login)
- 8 contractor organizations (match existing mock data names)
- 15-20 employees across various orgs
- Sample approvals in various states (pending/approved/rejected)
- 2-3 regulatory document sections with 5-7 documents

---

## Epic 2: Frontend — Contractor Management

### 2.1 Contractor Organization Pages

**`/contractors`** — List (update existing)
- Columns: № (contractorNumber), Название, ИНН, КПП, Статус, Кол-во сотрудников, Дата регистрации
- Search by name/INN
- Filter by status (pending/active/blocked/terminated)
- "Создать" button → `/contractors/new`
- Click row → `/contractors/{id}`

**`/contractors/new`** — Create form (new)
- Fields: Legal name, INN, KPP, Legal address, Actual address, Contact person, Phone, Email
- Validation: INN (10/12 digits), required fields via Zod
- On submit → POST /api/modules/contractors → redirect to detail

**`/contractors/{id}`** — Detail (update existing)
- Info card with edit button
- Tab: Сотрудники — employee table with quick actions
- Tab: Статус — view/change status (PENDING → ACTIVE → BLOCKED → TERMINATED)

### 2.2 Employee Card Pages

**`/employees`** — List (update existing)
- Columns: ФИО, Должность, Подрядчик, Классы работ, Документы (✓/⚠/✗), Согласования
- Search by name
- Filter by organization, work class
- "Добавить" button → form with org selector

**`/employees/{id}`** — Detail card (update existing)
- Photo + basic info section
- Passport details section
- Documents table: name, type, issue date, expiry date, status badge (VALID=green, EXPIRING=amber, EXPIRED=red), upload/delete actions
- Work classes as tags
- Approval pipeline timeline: each department status (pending→approved/rejected), deadline, comments
- Action: "Отправить на согласование" → multi-select departments → create approval requests

### 2.3 Approval Dashboard

**`/approvals`** — New page
- Shows approval requests for current user's department
- Table: Сотрудник, Подрядчик, Департамент, Срок, Статус, Действия
- Actions: Approve (optional comment), Reject (required comment)
- Filter: pending/approved/rejected

### 2.4 Regulatory Documents

**`/documents`** — List (update existing)
- Grouped by sections (hierarchical)
- Columns: Наименование, Раздел, Тип (PDF/DOCX/XLSX), Дата обновления
- HSE users see "Добавить документ" and "Управление разделами" buttons

**`/documents/sections`** — Section management (HSE only)
- Tree view of sections with add/rename/reorder/delete
- Nested sections supported (ТЗ 5.2)

### 2.5 Notifications

- Header notification bell shows count of pending approvals for current user
- Visual document expiry indicators throughout UI

---

## Epic 3: Infrastructure

### 3.1 Authentication

**NextAuth.js v5 (Auth.js)** — Credentials provider
- Login page at `/login`
- JWT sessions in httpOnly cookies
- Session callback includes user role and contractorId
- `middleware.ts` — checks session, extracts role, validates against permission matrix, redirects to `/unauthorized` if denied
- Password hashing: bcrypt, salt rounds >= 12

### 3.2 Modular Plugin Architecture

- `modules/` directory — each module has `module.json` manifest, routes, frontend routes, permissions
- `ModuleRegistry` (lib/modules/registry.ts) — discovers, validates, loads modules
- `modules.config.ts` — enable/disable modules without code changes
- Dynamic route dispatcher at `/api/modules/[...modulePath]/route.ts`
- Sidebar builds navigation from module registry
- `/modules` admin page shows installed/enabled modules list

### 3.3 Data Cleanup

- Remove duplicate mock data files (keep only `data/mock.ts`)
- All pages switch from mock data to real API calls
- Add seed script for database

---

## Acceptance Criteria

### AC-1: Contractor Registration
- [ ] Factory user can create a new contractor organization with legal details
- [ ] System assigns a unique sequential contractor number automatically
- [ ] INN uniqueness is enforced (duplicate INN shows error)
- [ ] Organization appears in the list immediately after creation

### AC-2: Employee Cards
- [ ] Contractor admin can add employees to their organization
- [ ] Employee card stores: ФИО, photo, passport details, work classes
- [ ] Documents can be uploaded with file attachment
- [ ] System marks documents as VALID/EXPIRING/EXPIRED based on expiry date
- [ ] Expiring (30 days) and expired documents are visually flagged

### AC-3: Approval Workflow
- [ ] User can submit an employee card for approval to one or more departments
- [ ] Approvers in the target department receive an email notification
- [ ] Approvers see pending requests in their `/approvals` dashboard
- [ ] Approvers can approve (optional comment) or reject (required comment)
- [ ] Employee card shows real-time approval pipeline status

### AC-4: Multi-User Access & RBAC
- [ ] Multiple users can log in simultaneously
- [ ] Factory roles see all organizations; contractor roles see only own org
- [ ] Unauthenticated users are redirected to `/login`
- [ ] 7 roles with permission matrix enforced via middleware

### AC-5: Regulatory Documents
- [ ] HSE can create/rename document sections (nested hierarchy)
- [ ] HSE can upload documents (PDF/DOCX/XLSX)
- [ ] All users can view and download regulatory documents
- [ ] Email notification sent to all users when new document added

### AC-6: Modular Architecture
- [ ] Modules can be enabled/disabled via `modules.config.ts`
- [ ] `/modules` page shows installed modules with status
- [ ] Version compatibility checked on module load
- [ ] Sidebar navigation reflects active modules

### AC-7: Data Integrity
- [ ] Deleting a contractor cascades to employees and documents
- [ ] INN unique across all contractors
- [ ] Passport series/number unique within a contractor
- [ ] File uploads validated (MIME type, max 10MB, sanitized filenames)

---

## Out of Scope for Stage 1

- Permit-to-work (Module 2 / Stage 2)
- Violation acts (Module 3 / Stage 3)
- Contractor checklists (Module 4 / Stage 3)
- Mobile-responsive optimization (Stage 2)
- SSO / LDAP integration (Stage 3)
- Printable permit/act generation (Stage 2)

---

## Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) + React 19 + TypeScript 5 |
| Database | PostgreSQL 16 + Prisma 6 |
| Auth | NextAuth.js v5 (Auth.js) — credentials provider, httpOnly JWT |
| Validation | Zod (runtime validation for API inputs) |
| File Storage | Local FS → abstract `StorageProvider` (swappable to S3) |
| Email | Nodemailer + react-email templates |
| Cron | node-cron or external cron → `/api/cron/document-expiry` |
| UI | shadcn/ui + Tailwind CSS v4 (already in place) |

## Implementation Order

**Phase 1 — Foundation (Week 1)**
1. Install dependencies: prisma, @prisma/client, next-auth, nodemailer, zod, node-cron
2. Set up PostgreSQL (local via Docker: `postgres:16`)
3. Write Prisma schema, run initial migration
4. Implement NextAuth credentials provider + session config
5. Implement middleware.ts for RBAC
6. Create seed script with test users and data
7. Implement StorageProvider (local FS)
8. Implement ModuleRegistry and module discovery

**Phase 2 — Contractors Module (Week 2)**
9. Create contractor CRUD API routes
10. Create employee CRUD API routes
11. Create employee document upload/delete API
12. Implement approval workflow API
13. Build contractor list/detail UI (wire to API)
14. Build employee list/detail UI (wire to API)
15. Build approval workflow UI
16. Implement email templates + sending

**Phase 3 — Regulatory Docs Module (Week 3)**
17. Create regulatory docs CRUD API
18. Create section management API
19. Build regulatory docs list UI (wire to API)
20. Build document upload UI
21. Build section management UI (HSE only)

**Phase 4 — Polish & Testing (Week 4)**
22. Document expiry cron job
23. Login page + unauthorized page
24. Module management page (list installed modules)
25. End-to-end testing
26. Performance optimization
