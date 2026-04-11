# Stage 1 Technical Architecture — Contractor Management System

## 1. Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Framework** | Next.js 16 (App Router) | Already in use, supports API Routes + frontend in one codebase |
| **Language** | TypeScript 5 | Type safety across full stack |
| **Database** | PostgreSQL 16 | Relational model, JSONB support for flexible fields |
| **ORM** | Prisma 6 | Type-safe queries, migrations, excellent TS integration |
| **Auth** | NextAuth.js v5 (Auth.js) | Credentials provider, session management, role middleware |
| **UI** | shadcn/ui + Tailwind v4 | Already implemented, consistent design system |
| **File Storage** | Local FS → abstract `StorageProvider` | Swappable to S3/MinIO later |
| **Email** | Nodemailer | SMTP-based, templates with react-email |
| **Validation** | Zod | Runtime validation for API inputs, shares types with frontend |

---

## 2. Modular Plugin Architecture

### 2.1. Core Concept

The system consists of a **Kernel** (core infrastructure) and **Modules** (feature plugins).

```
┌─────────────────────────────────────────────────┐
│                   KERNEL                         │
│  ┌──────────┬──────────┬───────────┬──────────┐ │
│  │ Auth     │ Module   │ API Router│ Storage  │ │
│  │ System   │ Registry │ (dynamic) │ Provider │ │ │
│  └──────────┴──────────┴───────────┴──────────┘ │
│  ┌──────────────────────────────────────────┐   │
│  │         Module Discovery & Loading        │   │
│  │  1. Scan modules/ for module.json         │   │
│  │  2. Validate version compatibility        │   │
│  │  3. Load enabled modules into registry    │   │
│  │  4. Register routes per module manifest   │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
        │              │              │
   ┌────▼────┐  ┌─────▼─────┐  ┌────▼────┐
   │Module 1 │  │ Module 2  │  │Module N │
   │Contractors│ │ Permits  │  │Violations│
   └─────────┘  └───────────┘  └─────────┘
```

### 2.2. Module Structure

Each module lives in `modules/{module-id}/`:

```
modules/contractors/
├── module.json              # Manifest
├── routes.ts                # API route handlers
├── frontend-routes.ts       # Frontend route registrations
├── permissions.ts           # Role-based permissions for this module
├── emails/
│   ├── approval-requested.tsx
│   └── document-expiring.tsx
└── prisma/
    └── schema.prisma        # Module's Prisma extensions (partial)
```

### 2.3. Module Manifest (module.json)

```json
{
  "id": "contractors",
  "name": "База данных подрядчиков",
  "version": "1.0.0",
  "kernelVersion": ">=1.0.0",
  "description": "Управление подрядными организациями и сотрудниками",
  "dependencies": [],
  "requiresRestart": false,
  "hasApiRoutes": true,
  "hasFrontendRoutes": true,
  "hasPrismaExtensions": true,
  "hasEmailTemplates": true,
  "hasPermissions": true
}
```

### 2.4. Module Enable/Disable Config

`modules.config.ts` — single file to control which modules are active:

```typescript
export const modulesConfig = {
  contractors: { enabled: true },
  regulatoryDocs: { enabled: true },
  permits: { enabled: false },
  violations: { enabled: false },
  checklists: { enabled: false },
} as const;
```

Changing this file and restarting the server enables/disables modules — no code changes required.

### 2.5. API Route Registration

Kernel provides a dynamic router that mounts module routes:

```typescript
// In app/api/modules/[...modulePath]/route.ts:
// A catch-all route handler that dispatches to the appropriate module handler
// Module routes are served under /api/modules/{module-id}/*
```

### 2.6. Frontend Route Registration

Modules declare their navigation entries:

```typescript
// modules/contractors/frontend-routes.ts
export const navEntries: NavEntry[] = [
  { href: '/contractors', label: 'Подрядчики', icon: Building2, order: 10 },
  { href: '/employees', label: 'Сотрудники', icon: Users, order: 11 },
];
```

The sidebar reads from the module registry to build navigation dynamically.

### 2.7. Version Compatibility Check

On module load, the kernel checks:
- `kernelVersion` in manifest matches current kernel version (using semver ranges)
- All `dependencies` are loaded and enabled
- No conflicting route paths between modules

---

## 3. Database Schema (Prisma)

### 3.1. Kernel Tables

**User** — system users with roles
- id, email, passwordHash, firstName, lastName, role, contractorId (nullable), isActive, createdAt, updatedAt, lastLoginAt

**Role** enum: ADMIN, HSE, HR, SECURITY, SUPERVISOR, CONTRACTOR_ADMIN, CONTRACTOR_EMPLOYEE

**Session** — auth sessions
- id, userId, token, expiresAt, createdAt

### 3.2. Module: Contractors

**Contractor** — contractor organizations
- id, contractorNumber (sequential, unique), name, inn (unique), kpp, legalAddress, actualAddress, phone, email, status (PENDING/ACTIVE/BLOCKED/TERMINATED), contactPerson, contactPhone, contactEmail, createdAt, updatedAt

**Employee** — employee cards
- id, contractorId (FK), fullName, position, photoPath, passportSeries, passportNumber, passportIssuedBy, passportIssueDate, workClasses (array), createdAt, updatedAt
- Unique: [contractorId, passportSeries, passportNumber]

**EmployeeDocument** — uploaded documents
- id, employeeId (FK), name, docType, fileUrl, issueDate, expiryDate, status (VALID/EXPIRING/EXPIRED), createdAt
- docType: PASSPORT, MEDICAL_BOOK, SAFETY_CERTIFICATE, QUALIFICATION_CERT, TRAINING_CERT, OTHER

**Approval** — approval workflow
- id, employeeId (FK), department, status (PENDING/APPROVED/REJECTED), assignedToId (FK User), deadline, comment, createdAt, reviewedAt
- department: SECURITY, HR, SAFETY, SAFETY_TRAINING, PERMIT_BUREAU

### 3.3. Module: Regulatory Docs (Stage 1)

**RegDocument** — regulatory documents
- id, title, category, section, fileUrl, fileType (PDF/DOCX/XLSX), version, createdAt, updatedAt, createdBy (FK User)

**RegDocumentSection** — hierarchical sections
- id, name, parentId (self-ref, for nesting), order, createdAt, updatedAt

### 3.4. Future Modules (Schema prepared, not activated)

**Permit** (Stage 2) — permitNumber (format: `{category}-{contractorNumber}-{curatorNumber}-{seq}`), category, contractorId, workSite, responsiblePerson, openDate, expiryDate, status (OPEN/CLOSED/EARLY_CLOSED), closeReason, createdBy

**Violation** (Stage 3) — contractorId, date, description, severity (LOW/MEDIUM/HIGH/CRITICAL), status (PENDING/RESOLVED), department, createdBy

**Checklist** (Stage 4) — contractorId, date, inspector, items (JSON), score, status (PASSED/FAILED/IN_PROGRESS), createdBy

### 3.5. Email Log

**EmailLog** — notification tracking
- id, recipient, subject, template, status (SENT/FAILED/PENDING), sentAt, error

### 3.6. Document Expiry Alert

Cron job runs daily checking `EmployeeDocument.expiryDate`:
- 30 days before → status = EXPIRING, email to contractor admin
- On expiry → status = EXPIRED, email to contractor admin + security

---

## 4. API Routes

### 4.1. Route Structure

```
app/api/
├── auth/[...nextauth]/route.ts       # NextAuth handler
├── modules/[...modulePath]/route.ts  # Dynamic module dispatcher
├── cron/document-expiry/route.ts     # Cron endpoint (secret-protected)
└── health/route.ts                   # Health check + loaded modules list
```

### 4.2. Module API Routes

**Contractors** (`/api/modules/contractors/*`):
```
GET    /api/modules/contractors                     # List contractors
POST   /api/modules/contractors                     # Create contractor
GET    /api/modules/contractors/{id}                # Get contractor detail
PATCH  /api/modules/contractors/{id}                # Update contractor
DELETE /api/modules/contractors/{id}                # Delete contractor

GET    /api/modules/contractors/{id}/employees      # List employees
POST   /api/modules/contractors/{id}/employees      # Create employee
GET    /api/modules/contractors/{id}/employees/{eid} # Employee detail
PATCH  /api/modules/contractors/{id}/employees/{eid} # Update employee

POST   /api/modules/contractors/employees/{id}/documents      # Upload document
DELETE /api/modules/contractors/employees/{id}/documents/{did} # Delete document

POST   /api/modules/contractors/employees/{id}/approvals       # Submit for approval
PATCH  /api/modules/contractors/approvals/{id}                 # Approve/reject
GET    /api/modules/contractors/approvals/pending              # My pending approvals
```

**Regulatory Docs** (`/api/modules/regulatory-docs/*`):
```
GET    /api/modules/regulatory-docs/sections           # List sections
POST   /api/modules/regulatory-docs/sections            # Create section (HSE only)
PATCH  /api/modules/regulatory-docs/sections/{id}       # Rename section (HSE only)

GET    /api/modules/regulatory-docs/documents            # List documents
POST   /api/modules/regulatory-docs/documents            # Upload document (HSE only)
GET    /api/modules/regulatory-docs/documents/{id}       # Get/download document
DELETE /api/modules/regulatory-docs/documents/{id}       # Delete document (HSE only)
```

### 4.3. Auth & RBAC

**NextAuth.js:** Credentials provider (email + password), JWT sessions in httpOnly cookie

**Role-Permission Matrix:**

| Permission | ADMIN | HSE | HR | SECURITY | SUPERVISOR | CONTRACTOR_ADMIN | CONTRACTOR_EMPLOYEE |
|---|---|---|---|---|---|---|---|
| View all contractors | ✅ | ✅ | ✅ | ✅ | ✅ | Own only |
| Create contractor | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Approve contractor | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| View all employees | ✅ | ✅ | ✅ | ✅ | ✅ | Own only | Own card |
| Create employee | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ |
| Upload documents | ✅ | ❌ | ❌ | ❌ | ✅ | Own company | ❌ |
| HR approval | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Security approval | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Safety approval | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Safety training approval | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Permit bureau approval | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| View regulatory docs | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Upload regulatory docs | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Manage sections | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

**Middleware:** Check session → extract role → check route against permission matrix → redirect to /unauthorized if denied

---

## 5. File Storage

Abstract `StorageProvider` interface:

```typescript
interface StorageProvider {
  upload(file: Buffer, path: string): Promise<string>;
  download(path: string): Promise<Buffer>;
  delete(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
}
```

Stage 1: `LocalStorageProvider` stores in `./data/uploads/`:
- `employees/{employeeId}/photos/`
- `employees/{employeeId}/documents/`
- `regulatory-docs/{sectionId}/`

---

## 6. Email System

Templates (react-email):
1. **Approval Requested** — to approver: employee name, contractor, department, deadline, link
2. **Approval Completed** — to contractor admin: result, comment
3. **Document Expiring** — 30 days before: employee name, doc type, expiry date
4. **Document Expired** — on expiry: employee name, doc type, date

Email service methods:
- `sendApprovalRequest(to, approval, employee)`
- `sendApprovalResult(to, approval)`
- `sendDocumentExpiring(to, doc, employee)`
- `sendDocumentExpired(to, doc, employee)`
- `sendRegDocUpdated(to[], doc)`

---

## 7. File Structure (Stage 1)

```
contractor-demo/
├── app/
│   ├── layout.tsx
│   ├── globals.css
│   ├── page.tsx
│   ├── types.ts
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts
│   │   ├── modules/[...modulePath]/route.ts
│   │   ├── cron/document-expiry/route.ts
│   │   └── health/route.ts
│   ├── contractors/
│   │   ├── page.tsx
│   │   ├── [id]/page.tsx
│   │   └── new/page.tsx
│   ├── employees/
│   │   ├── page.tsx
│   │   └── [id]/page.tsx
│   ├── documents/
│   │   ├── page.tsx
│   │   └── sections/page.tsx
│   ├── auth/
│   │   ├── login/page.tsx
│   │   └── unauthorized/page.tsx
│   └── modules/
│       └── page.tsx
├── components/
│   ├── layout/
│   ├── ui/
│   ├── contractors/
│   ├── employees/
│   └── documents/
├── lib/
│   ├── auth.ts
│   ├── prisma.ts
│   ├── email.ts
│   ├── storage.ts
│   └── modules/
│       ├── registry.ts
│       ├── router.ts
│       ├── middleware.ts
│       └── types.ts
├── modules/
│   ├── contractors/
│   │   ├── module.json
│   │   ├── routes.ts
│   │   ├── frontend-routes.ts
│   │   ├── permissions.ts
│   │   └── emails/
│   └── regulatory-docs/
│       ├── module.json
│       ├── routes.ts
│       ├── frontend-routes.ts
│       └── permissions.ts
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── data/
│   └── seed.ts
├── middleware.ts
├── modules.config.ts
└── .env.example
```

---

## 8. Implementation Order

**Phase 1: Foundation (Week 1)**
1. Install dependencies (prisma, next-auth, nodemailer, zod, node-cron)
2. Set up PostgreSQL, write Prisma schema, run initial migration
3. Implement NextAuth credentials provider
4. Implement RBAC middleware
5. Create seed script with test users and data
6. Implement StorageProvider (local FS)
7. Implement ModuleRegistry and module discovery

**Phase 2: Contractors Module (Week 2)**
8. Contractor CRUD API + employee CRUD API
9. Employee document upload/delete API
10. Approval workflow API
11. Wire contractor list/detail UI to API
12. Wire employee list/detail UI to API
13. Build approval workflow UI
14. Implement email templates + sending

**Phase 3: Regulatory Docs Module (Week 3)**
15. Regulatory docs CRUD API + section management API
16. Wire regulatory docs list UI to API
17. Build document upload UI + section management UI (HSE only)

**Phase 4: Polish & Testing (Week 4)**
18. Document expiry cron job
19. Login page
20. Module management page (list installed modules)
21. End-to-end testing
22. Performance optimization
23. Documentation

---

## 9. Acceptance Criteria for Stage 1

1. **Contractor Registration:** Create, view, update, delete contractors with INN/KPP validation
2. **Employee Cards:** Create cards with photo, passport data, work classes, documents
3. **Document Upload:** Upload files to employee cards (certificates, medical books, etc.)
4. **Expiry Alerts:** Auto-detect expiring/expired documents, send email notifications
5. **Approval Workflow:** Submit employee card for approval to Security, HR, Safety, Training, Permit Bureau
6. **Role-Based Access:** 7 roles with different permissions enforced via middleware
7. **Regulatory Documents:** HSE creates sections/uploads docs; all users can view
8. **Modular Architecture:** Modules enabled/disabled via config; module list page shows status
9. **Multi-User:** Multiple simultaneous users without conflicts
10. **Email Notifications:** Approvers get emails for new requests; contractors get expiry emails

---

## 10. Environment Variables

```env
DATABASE_URL="postgresql://user:password@localhost:5432/contractor_system"
NEXTAUTH_SECRET="<generate with openssl rand -base64 32>"
NEXTAUTH_URL="http://localhost:3002"
SMTP_HOST="smtp.example.com"
SMTP_PORT=587
SMTP_USER="notifications@example.com"
SMTP_PASSWORD="password"
SMTP_FROM="Contractor System <noreply@example.com>"
UPLOAD_DIR="./data/uploads"
CRON_SECRET="<random string for cron endpoint protection>"
```

---

## 11. Security Considerations

1. Password hashing: bcrypt (salt rounds >= 12)
2. Sessions: JWT with httpOnly cookies, 8-hour expiry
3. File upload: MIME type validation, 10MB max, sanitized filenames
4. API input: Zod schemas on all endpoints
5. CORS: Same-origin only
6. Rate limiting: express-rate-limit on auth endpoints
7. CSP headers: next-secure
8. SQL injection: prevented by Prisma parameterized queries
9. XSS: React auto-escaping + CSP headers

---

## 12. Deployment Notes (Stage 1)

- **Local dev:** `pnpm dev` on port 3002
- **Database:** Local PostgreSQL via Docker (`docker run -e POSTGRES_PASSWORD=... postgres:16`)
- **Production:** `next build --standalone`, reverse proxy via nginx
- **Cron:** External cron (systemd timer or cloud scheduler) hitting `/api/cron/document-expiry` with `CRON_SECRET`
