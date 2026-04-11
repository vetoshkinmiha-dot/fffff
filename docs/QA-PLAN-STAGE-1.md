# Stage 1 QA Test Plan

## Current State Assessment

After reviewing all implementation files, here's what exists and what's missing:

### What's Implemented

**Database:**
- `prisma/schema.prisma` — 5 models (User, Organization, Employee, EmployeeDocument, ApprovalRequest) + enums
- `lib/db/schema.sql` — SQLite schema for contractors, employees, documents, approvals, permits, violations, checklists, norm_documents
- `lib/db/queries.ts` — Prepared statement CRUD for all tables
- `lib/db/migrate.ts` — Migration runner for SQLite schema
- `lib/db/seed.ts` — Seeds SQLite with mock data

**Auth:**
- `lib/auth.ts` — JWT functions (hashPassword, verifyPassword, generateAccessToken, setAuthCookie, clearAuthCookie), role definitions, isFactoryRole()
- `lib/validations.ts` — Zod schemas (loginSchema, registerSchema)
- `lib/api-middleware.ts` — authMiddleware() + requireRole()
- `app/api/auth/login/route.ts` — POST login, validates, sets httpOnly cookie
- `app/api/auth/register/route.ts` — POST register (admin-only), creates user via Prisma
- `app/api/auth/logout/route.ts` — POST logout, clears cookie
- `app/api/auth/me/route.ts` — GET current user from session

**Contractors API:**
- `lib/api/contractors.ts` — Service layer (list, get, add, patch, remove) + getContractorEmployees
- `lib/api/mappers.ts` — DB row → domain type converters
- `app/api/contractors/route.ts` — GET list + POST create

**Frontend (still mock-based):**
- All 7 pages still read from `data/mock.ts` and `app/data/mock/`
- No pages wired to real API yet
- No login page, no forms, no approval dashboard

---

## Critical Issues Found

### ISSUE-1: Dual Database Approach (BLOCKER)

Two separate database systems exist simultaneously:
- **SQLite** (`lib/db/`) — Used by contractors API (`lib/api/contractors.ts`) and all mock-data pages
- **PostgreSQL** (`prisma/schema.prisma`) — Used by auth routes only

These are **not connected**. The contractors API route uses `better-sqlite3` while the auth/login route uses `prisma` (PostgreSQL). This means:
- A user in Prisma can't be linked to a contractor in SQLite
- Employee data is in SQLite, user data is in PostgreSQL
- Migrations run against SQLite, Prisma schema targets PostgreSQL

**Fix required:** Consolidate to a single database. The spec calls for PostgreSQL + Prisma. The SQLite layer (`lib/db/`, `schema.sql`, `migrate.ts`, `seed.ts`, `lib/api/contractors.ts`) needs to be replaced with Prisma queries, or the Prisma schema needs to match the SQLite schema.

### ISSUE-2: Contractors API Route Missing Auth Guard

`app/api/contractors/route.ts` — The POST endpoint (create contractor) has **no authentication check**. Anyone can create a contractor without being logged in.

**Fix required:** Add `authMiddleware` + role check to POST endpoint.

### ISSUE-3: Frontend Pages Still Using Mock Data

All pages (`/contractors`, `/employees`, `/permits`, `/violations`, `/checklists`, `/documents`) read from static mock files. None call the API.

**Fix required:** Wire pages to fetch from `/api/` endpoints. Replace mock data with API responses.

### ISSUE-4: Missing Frontend Pages

Per the spec, these pages don't exist yet:
- `/login` — Auth login page
- `/contractors/new` — Create contractor form
- `/employees/new` — Create employee form
- `/approvals` — Approval dashboard
- `/auth/unauthorized` — Access denied page
- `/modules` — Module management page

### ISSUE-5: Missing API Endpoints

Per the spec, these endpoints don't exist:
- Employees CRUD API
- Employee documents upload/delete API
- Approvals API (submit, approve/reject, list pending)
- Regulatory documents API
- Health check endpoint
- Cron endpoint for document expiry

### ISSUE-6: No RBAC Middleware (`middleware.ts`)

No `middleware.ts` file exists at the project root. Auth is only checked inside individual API routes via `authMiddleware()`, but there's no page-level protection.

**Fix required:** Create `middleware.ts` that checks JWT cookie on protected routes and redirects to `/login`.

### ISSUE-7: Prisma Client Import Path Mismatch

`lib/prisma.ts` imports from `../lib/generated/prisma` but the Prisma schema outputs to `../lib/generated/prisma` (relative to `prisma/` dir = `lib/generated/prisma`). This creates a double-nested path. Need to verify `prisma generate` produces the correct output.

### ISSUE-8: Duplicate/Orphaned Mock Data Files

- `data/mock.ts` — Primary mock data
- `app/data/mock.ts` — Different data, orphaned
- `app/data/mock/employees.ts` — Yet another copy

Should consolidate to one source after API integration.

---

## Test Plan

### Unit Tests

#### 1. Auth Module (`lib/auth.test.ts`)

| Test | Description |
|------|-------------|
| `hashPassword` returns a bcrypt hash | Hash should start with `$2b$` or `$2a$` |
| `verifyPassword` returns true for correct password | Match against generated hash |
| `verifyPassword` returns false for wrong password | Non-matching password should fail |
| `generateAccessToken` returns valid JWT | Token should decode to JWTPayload |
| `verifyAccessToken` returns null for expired token | Expired token (15min) should return null |
| `verifyAccessToken` returns null for tampered token | Modified token should fail verification |
| `setAuthCookie` sets correct cookie string | Should include HttpOnly, Path=/, SameSite=Strict |
| `clearAuthCookie` sets Max-Age=0 | Cookie should be cleared |
| `isFactoryRole` returns true for factory roles | admin, factory_hse, factory_hr, factory_curator |
| `isFactoryRole` returns false for contractor roles | contractor_admin, contractor_user |

#### 2. Validation Schemas (`lib/validations.test.ts`)

| Test | Description |
|------|-------------|
| `loginSchema` rejects missing email | Should return error |
| `loginSchema` rejects missing password | Should return error |
| `loginSchema` rejects invalid email format | "not-an-email" should fail |
| `loginSchema` accepts valid credentials | Proper email + password |
| `registerSchema` rejects missing fullName | Should return error |
| `registerSchema` rejects invalid role | "superadmin" should fail |
| `registerSchema` accepts valid registration data | All fields valid |

#### 3. Mapper Functions (`lib/api/mappers.test.ts`)

| Test | Description |
|------|-------------|
| `toContractor` maps row to domain type | All fields correctly mapped |
| `toEmployee` maps row + docs + classes + approvals | Nested arrays correctly transformed |
| `toContractor` handles null/undefined gracefully | No crashes on partial data |

#### 4. DB Queries (`lib/db/queries.test.ts`)

| Test | Description |
|------|-------------|
| `getAllContractors` returns all rows | Count matches seed data |
| `getContractorById` returns correct row | Match by known ID |
| `getContractorById` returns undefined for missing ID | Non-existent ID |
| `createContractor` inserts new row | Row count increases by 1 |
| `createContractor` rejects duplicate INN | Unique constraint violation |
| `updateContractor` modifies existing row | Fields updated correctly |
| `deleteContractor` cascades to employees | FK cascade verified |
| `getEmployeeFullById` returns employee + docs + classes + approvals | All nested data included |
| `getApprovalsByEmployee` returns correct approvals | Department, status, deadline match |

#### 5. API Middleware (`lib/api-middleware.test.ts`)

| Test | Description |
|------|-------------|
| `authMiddleware` returns 401 without cookie | No auth_token = unauthorized |
| `authMiddleware` returns 401 with invalid token | Tampered JWT |
| `authMiddleware` returns user with valid token | Proper JWTPayload extracted |
| `authMiddleware` returns 401 with expired token | Token past 15min expiry |
| `requireRole` returns 403 for wrong role | Non-admin accessing admin endpoint |
| `requireRole` passes for matching role | Correct role allowed through |

#### 6. API Routes (integration tests)

| Test | Endpoint | Description |
|------|----------|-------------|
| POST /api/auth/login — success | 200 with user + cookie |
| POST /api/auth/login — wrong password | 401 with Russian error message |
| POST /api/auth/login — non-existent email | 401 |
| POST /api/auth/login — inactive user | 401 |
| POST /api/auth/login — missing fields | 400 with validation error |
| POST /api/auth/register — admin creates user | 201 with new user |
| POST /api/auth/register — non-admin attempts | 403 |
| POST /api/auth/register — duplicate email | 409 |
| POST /api/auth/register — missing fields | 400 |
| GET /api/auth/me — with valid session | 200 with user |
| GET /api/auth/me — without session | 401 |
| POST /api/auth/logout | 200, cookie cleared |
| GET /api/contractors — returns list | 200 with contractors array |
| POST /api/contractors — without auth | **Should be 401** (currently 200 — bug!) |
| POST /api/contractors — with auth | 201 with new contractor |
| POST /api/contractors — duplicate INN | 409 or 400 |

---

### E2E Tests

#### 7. Contractor Lifecycle

| Step | Action | Expected |
|------|--------|----------|
| 1 | Admin logs in | Redirected to dashboard, user shown in header |
| 2 | Admin navigates to /contractors | List of contractors shown from API |
| 3 | Admin clicks "Добавить подрядчика" | Form opens |
| 4 | Admin fills form + submits | Contractor created, redirected to detail |
| 5 | Admin searches by name/INN | Results filtered correctly |
| 6 | Admin filters by status | Only matching contractors shown |
| 7 | Admin views contractor detail | Info card + employees list shown |
| 8 | Contractor admin logs in | Sees only own organization |

#### 8. Employee Card + Approval Flow

| Step | Action | Expected |
|------|--------|----------|
| 1 | Contractor admin creates employee | Employee card created with passport data |
| 2 | Upload document with expiry date | File stored, expiry tracked |
| 3 | Submit for approval to Security + Safety | 2 approval requests created |
| 4 | Security user logs in | Sees pending approval in /approvals |
| 5 | Security approves with comment | Status = approved, comment saved |
| 6 | Safety rejects with comment | Status = rejected, comment visible |
| 7 | Employee card shows mixed status | Security ✅, Safety ❌ |

#### 9. Document Expiry Alerts

| Step | Action | Expected |
|------|--------|----------|
| 1 | Create document expiring in 25 days | Status = EXPIRING |
| 2 | Create document expiring today | Status = EXPIRED |
| 3 | Create document expiring in 60 days | Status = VALID |
| 4 | Run cron endpoint | Emails queued for expiring/expired |

#### 10. RBAC

| Role | Can Access | Cannot Access |
|------|-----------|---------------|
| admin | All pages, all API | — |
| factory_hse | All contractors, regulatory docs, safety approvals | User registration |
| contractor_admin | Own contractor + employees | Other contractors |
| contractor_user | Own employee card | Create employees, approvals |
| security | Approvals dashboard, security approvals | Create contractors |

---

### Non-Functional Tests

#### 11. Security

| Test | Description |
|------|-------------|
| Password not returned in any API response | Check login, register, /me responses |
| JWT not accessible to client-side JS | httpOnly cookie, not in localStorage |
| File upload rejects non-image types | .exe, .sh should be rejected |
| File upload rejects oversized files | >10MB should return 413 |
| SQL injection attempt on search input | No errors, proper parameterization |
| XSS in contractor name field | Script tags escaped in HTML output |

#### 12. Data Integrity

| Test | Description |
|------|-------------|
| Deleting contractor cascades to employees | No orphaned employee rows |
| Deleting employee cascades to documents/approvals | No orphaned rows |
| INN uniqueness enforced | Second contractor with same INN fails |
| Passport uniqueness per contractor | Duplicate passport_series+number fails |

---

## Test File Structure

```
__tests__/
  unit/
    auth.test.ts
    validations.test.ts
    mappers.test.ts
    queries.test.ts
    api-middleware.test.ts
  integration/
    auth-routes.test.ts
    contractors-routes.test.ts
  e2e/
    contractor-lifecycle.test.ts
    employee-approval-flow.test.ts
    rbac.test.ts
  helpers/
    test-db.ts        # In-memory SQLite for unit/integration tests
    test-auth.ts      # Helper to create auth tokens for tests
    seed-test.ts      # Test-specific seed data (smaller, deterministic)
```

**Test stack:** Vitest (unit/integration) + Playwright (E2E)

---

## Priority Order

1. **Fix ISSUE-1 (Dual DB)** — Everything else depends on this. Can't test properly until the database layer is unified.
2. **Fix ISSUE-2 (Missing auth guard)** — Security vulnerability, one-line fix.
3. **Write unit tests for auth + validations** — Fast feedback, no DB needed.
4. **Write unit tests for DB queries** — Requires test SQLite DB.
5. **Write integration tests for API routes** — Requires auth + DB working.
6. **Create E2E tests** — After frontend pages are wired to API.
7. **Security + data integrity tests** — After core functionality is stable.

---

## Environment

- **Test DB:** In-memory SQLite (`:memory:`) for unit/integration tests
- **E2E DB:** Separate test PostgreSQL database or Docker container
- **Test runner:** `vitest` for unit/integration, `@playwright/test` for E2E
- **CI:** Run unit + integration on every PR, E2E on merge to main
