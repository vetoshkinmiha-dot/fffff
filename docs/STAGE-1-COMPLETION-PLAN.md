# Stage 1 Completion Plan

## Current State (2026-04-10)

**Completed:**
- ✅ Prisma schema (6 models + 5 enums) — single SQLite DB
- ✅ Auth system (JWT + httpOnly cookies + 8-role RBAC + middleware.ts)
- ✅ API routes: `/api/organizations/*`, `/api/employees/*`, `/api/approvals/*`, `/api/documents/expiring`
- ✅ Frontend pages wired to API: `/contractors`, `/contractors/new`, `/contractors/[id]`, `/employees`, `/employees/new`, `/employees/[id]`, `/approvals`, `/login`, `/unauthorized`
- ✅ Seed script (`lib/db/seed-prisma.ts`): 8 orgs, 5 users, 3 employees
- ✅ Old SQLite layer cleaned up

**Pages still on mock data (intentionally — these are Stage 2+ modules):**
- `/documents/` — Module 5 (regulatory docs)
- `/permits/` — Module 2 (permit-to-work)
- `/violations/` — Module 3 (violation acts)
- `/checklists/` — Module 4 (checklists)

---

## Remaining Tasks to Complete Stage 1

### 1. Prisma Migration (blocker for everything)

**Task:** Run `prisma migrate dev` to create the migration from the current schema and apply it.

The Prisma client is generated at `lib/generated/prisma/` but there may not be an actual migration file yet. Need to verify:
```bash
npx prisma migrate dev --name init
```

Then run the seed:
```bash
npx prisma db seed
```

### 2. Email Notification Integration

Need to implement:
- Nodemailer setup with SMTP config (`.env` variables)
- Email service at `lib/email.ts` with templates for:
  - Approval requested (to approver)
  - Approval completed (to contractor admin)
  - Document expiring (30 days before)
  - Document expired (on expiry date)
- Wire email sending to:
  - `POST /api/approvals` (when approval is submitted)
  - `PATCH /api/approvals/:id` (when approval decision is made)

### 3. Cron Endpoint for Document Expiry

Create `app/api/cron/document-expiry/route.ts`:
- Protected by `CRON_SECRET` env var
- Checks `EmployeeDocument` for expiry dates
- Updates `status` field (valid → expiring → expired)
- Sends email notifications for affected documents
- Can be triggered daily via external cron

### 4. File Upload Component + Service

**Backend:**
- `POST /api/employees/:empId/documents` — multipart upload endpoint
- File validation: MIME type check, max 10MB, sanitize filenames
- Store in `uploads/employees/{employeeId}/documents/`

**Frontend:**
- Reusable file upload component (drag & drop + browse)
- Integrate into `/employees/[id]` page and `/employees/new` form

### 5. Dev Server Verification

Once all above is done:
- Verify dev server starts cleanly on port 3002
- Test end-to-end flow:
  1. Login as admin@pirelli.ru → dashboard
  2. Create contractor → appears in list
  3. Create employee under contractor
  4. Submit employee for approval → check `/approvals`
  5. Login as security@pirelli.ru → see pending approval → approve
  6. Verify employee card shows approval status
  7. Check document expiry indicators

---

## What's NOT in Stage 1 (correctly deferred)

- Regulatory documents module (Module 5 / Stage 2+)
- Permit-to-work (Module 2 / Stage 2)
- Violation acts (Module 3 / Stage 3)
- Checklists (Module 4 / Stage 3)
- SSO/LDAP integration
- Mobile optimization
- Printable permits/acts

---

## Priority Order

1. **Prisma migration** — blocker, must happen first
2. **Seed verification** — needs migration
3. **File upload** — needed for employee documents
4. **Email notifications** — integration with existing approval flow
5. **Cron endpoint** — automated document expiry
6. **Dev server verification** — final E2E check