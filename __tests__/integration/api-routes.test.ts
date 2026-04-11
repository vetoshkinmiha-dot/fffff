import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

// ─── Mock all external dependencies ─────────────────────────────

const mockPrisma = vi.hoisted(() => ({
  user: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
  },
  organization: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
    update: vi.fn(),
    delete: vi.fn(),
  },
  employee: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
    update: vi.fn(),
    delete: vi.fn(),
  },
  employeeDocument: {
    create: vi.fn(),
    findMany: vi.fn().mockResolvedValue([]),
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn().mockResolvedValue(0),
  },
  approvalRequest: {
    create: vi.fn(),
    createMany: vi.fn().mockResolvedValue({ count: 0 }),
    createManyAndReturn: vi.fn().mockResolvedValue([]),
    findUnique: vi.fn(),
    findFirst: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
    update: vi.fn(),
    updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    delete: vi.fn(),
  },
}))

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))

vi.mock('@/lib/email', () => ({
  sendApprovalNotification: vi.fn().mockResolvedValue(undefined),
}))

const verifyMock = vi.fn().mockImplementation((token: string) => {
    if (token === 'valid-token') {
      return { userId: 'user-1', email: 'admin@pirelli.ru', role: 'admin', organizationId: null, department: null }
    }
    if (token === 'contractor-token') {
      return { userId: 'user-2', email: 'contractor@employee.ru', role: 'contractor_employee', organizationId: 'org-1', department: null }
    }
    if (token === 'security-token') {
      return { userId: 'user-3', email: 'security@test.ru', role: 'security', organizationId: null, department: 'security' }
    }
    throw new Error('Invalid token')
  })

vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('$2b$12$mockedHash'),
    compare: vi.fn().mockImplementation(async (pw: string) => pw === 'Admin123!'),
  },
  hash: vi.fn().mockResolvedValue('$2b$12$mockedHash'),
  compare: vi.fn().mockImplementation(async (pw: string) => pw === 'Admin123!'),
}))

vi.mock('jsonwebtoken', () => {
  const fn = verifyMock
  const obj = {
    sign: vi.fn().mockReturnValue('mock.jwt.token'),
    verify: fn,
  }
  return { default: obj, ...obj }
})

// ─── Helper to call route handlers with proper NextRequest ──────────

async function callRoute(
  handler: (req: NextRequest, ctx?: any) => Promise<NextResponse>,
  method: string,
  url: string,
  body?: any,
  cookies: Record<string, string> = {},
  params?: Record<string, string>,
) {
  const init: RequestInit = { method }
  const headers: Record<string, string> = {}
  if (body) {
    headers['Content-Type'] = 'application/json'
    init.body = JSON.stringify(body)
  }
  // Set cookies as header (NextRequest parses from Cookie header)
  const cookieHeader = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ')
  if (cookieHeader) headers['Cookie'] = cookieHeader
  init.headers = headers

  const req = new NextRequest(url, init)
  const ctx = params ? { params: Promise.resolve(params) } : undefined
  return handler(req, ctx)
}

// Import route handlers
import { prisma } from '@/lib/prisma'

const ADMIN_MOCK_USER = {
  id: 'user-1',
  email: 'admin@pirelli.ru',
  passwordHash: 'hash',
  fullName: 'Admin',
  role: 'admin',
  isActive: true,
  organizationId: null,
  department: null,
  mustChangePwd: true,
} as any

const CONTRACTOR_MOCK_USER = {
  id: 'user-2',
  email: 'contractor@employee.ru',
  passwordHash: 'hash',
  fullName: 'Contractor',
  role: 'contractor_employee',
  isActive: true,
  organizationId: 'org-1',
  department: null,
  mustChangePwd: true,
} as any

const SECURITY_MOCK_USER = {
  id: 'user-3',
  email: 'security@test.ru',
  passwordHash: 'hash',
  fullName: 'Security',
  role: 'security',
  isActive: true,
  organizationId: null,
  department: 'security',
  mustChangePwd: true,
} as any

describe('Auth API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.user.findUnique.mockResolvedValue(ADMIN_MOCK_USER)
  })

  describe('POST /api/auth/login', () => {
    it('should reject invalid email format', async () => {
      const { POST } = await import('@/app/api/auth/login/route')
      const res = await callRoute(POST, 'POST', 'http://localhost/api/auth/login', {
        email: 'not-email',
        password: 'Admin123!',
      })
      expect(res.status).toBe(400)
    })

    it('should reject missing password', async () => {
      const { POST } = await import('@/app/api/auth/login/route')
      const res = await callRoute(POST, 'POST', 'http://localhost/api/auth/login', {
        email: 'admin@pirelli.ru',
      })
      expect(res.status).toBe(400)
    })

    it('should return 401 for non-existent user', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null)
      const { POST } = await import('@/app/api/auth/login/route')
      const res = await callRoute(POST, 'POST', 'http://localhost/api/auth/login', {
        email: 'nobody@pirelli.ru',
        password: 'Admin123!',
      })
      expect(res.status).toBe(401)
    })

    it('should return 401 for inactive user', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-1',
        email: 'admin@pirelli.ru',
        passwordHash: '$2b$12$mockedHash',
        fullName: 'Admin',
        role: 'admin',
        isActive: false,
        organizationId: null,
        department: null,
        mustChangePwd: true,
      } as any)
      const { POST } = await import('@/app/api/auth/login/route')
      const res = await callRoute(POST, 'POST', 'http://localhost/api/auth/login', {
        email: 'admin@pirelli.ru',
        password: 'WrongPass',
      })
      expect(res.status).toBe(401)
    })
  })

  describe('POST /api/auth/register', () => {
    it('should return 401 without authentication', async () => {
      const { POST } = await import('@/app/api/auth/register/route')
      const res = await callRoute(POST, 'POST', 'http://localhost/api/auth/register', {
        email: 'new@test.ru',
        password: 'Password1',
        fullName: 'Test User',
        role: 'admin',
      })
      expect(res.status).toBe(401)
    })

    it('should return 403 for non-admin user', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(CONTRACTOR_MOCK_USER)
      const { POST } = await import('@/app/api/auth/register/route')
      const res = await callRoute(
        POST,
        'POST',
        'http://localhost/api/auth/register',
        { email: 'new@test.ru', password: 'Password1', fullName: 'Test', role: 'admin' },
        { auth_token: 'contractor-token' },
      )
      expect(res.status).toBe(403)
    })

    it('should reject duplicate email with 409', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'existing',
        email: 'existing@test.ru',
        passwordHash: 'hash',
        fullName: 'Existing',
        role: 'admin',
        isActive: true,
        organizationId: null,
        department: null,
        mustChangePwd: true,
      } as any)
      const { POST } = await import('@/app/api/auth/register/route')
      const res = await callRoute(
        POST,
        'POST',
        'http://localhost/api/auth/register',
        { email: 'existing@test.ru', password: 'Password1', fullName: 'Test', role: 'admin' },
        { auth_token: 'valid-token' },
      )
      expect(res.status).toBe(409)
    })
  })

  describe('GET /api/auth/me', () => {
    it('should return 401 without session', async () => {
      const { GET } = await import('@/app/api/auth/me/route')
      const res = await callRoute(GET, 'GET', 'http://localhost/api/auth/me')
      expect(res.status).toBe(401)
    })
  })

  describe('POST /api/auth/logout', () => {
    it('should return 200 with success', async () => {
      const { POST } = await import('@/app/api/auth/logout/route')
      const res = await callRoute(POST, 'POST', 'http://localhost/api/auth/logout')
      expect(res.status).toBe(200)
    })
  })
})

describe('Organizations API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.user.findUnique.mockResolvedValue(ADMIN_MOCK_USER)
  })

  describe('GET /api/organizations', () => {
    it('should return 401 without auth', async () => {
      const { GET } = await import('@/app/api/organizations/route')
      const res = await callRoute(GET, 'GET', 'http://localhost/api/organizations')
      expect(res.status).toBe(401)
    })

    it('should return paginated list with auth', async () => {
      mockPrisma.organization.count.mockResolvedValueOnce(2)
      mockPrisma.organization.findMany.mockResolvedValueOnce([
        {
          id: 'org-1',
          name: 'ООО Тест',
          inn: '7707083893',
          sequentialNumber: 1,
          status: 'active',
          _count: { employees: 3 },
        },
        {
          id: 'org-2',
          name: 'ООО Второй',
          inn: '7707083894',
          sequentialNumber: 2,
          status: 'pending',
          _count: { employees: 0 },
        },
      ] as any)

      const { GET } = await import('@/app/api/organizations/route')
      const res = await callRoute(
        GET,
        'GET',
        'http://localhost/api/organizations?page=1&limit=20',
        undefined,
        { auth_token: 'valid-token' },
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(2)
      expect(body.pagination.total).toBe(2)
    })

    it('should search organizations by name/INN', async () => {
      mockPrisma.organization.count.mockResolvedValueOnce(1)
      mockPrisma.organization.findMany.mockResolvedValueOnce([
        { id: 'org-1', name: 'ООО Тест', inn: '7707083893', sequentialNumber: 1, status: 'active', _count: { employees: 3 } },
      ] as any)

      const { GET } = await import('@/app/api/organizations/route')
      const res = await callRoute(
        GET,
        'GET',
        'http://localhost/api/organizations?search=7707083893',
        undefined,
        { auth_token: 'valid-token' },
      )
      expect(res.status).toBe(200)
    })
  })

  describe('POST /api/organizations', () => {
    it('should return 401 without auth', async () => {
      const { POST } = await import('@/app/api/organizations/route')
      const res = await callRoute(POST, 'POST', 'http://localhost/api/organizations', {
        name: 'ООО Тест',
        inn: '7707083893',
        legalAddress: 'Адрес',
      })
      expect(res.status).toBe(401)
    })

    it('should reject contractor role from creating org', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(CONTRACTOR_MOCK_USER)
      const { POST } = await import('@/app/api/organizations/route')
      const res = await callRoute(
        POST,
        'POST',
        'http://localhost/api/organizations',
        { name: 'ООО Тест', inn: '7707083893', legalAddress: 'Адрес' },
        { auth_token: 'contractor-token' },
      )
      expect(res.status).toBe(403)
    })

    it('should create organization with factory role', async () => {
      mockPrisma.organization.create.mockResolvedValueOnce({
        id: 'org-1',
        name: 'ООО Тест',
        inn: '7707083893',
        legalAddress: 'Адрес',
        status: 'pending',
        sequentialNumber: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)

      const { POST } = await import('@/app/api/organizations/route')
      const res = await callRoute(
        POST,
        'POST',
        'http://localhost/api/organizations',
        { name: 'ООО Тест', inn: '7707083893', legalAddress: 'Адрес' },
        { auth_token: 'valid-token' },
      )
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.name).toBe('ООО Тест')
    })
  })
})

describe('Employees API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.user.findUnique.mockResolvedValue(ADMIN_MOCK_USER)
  })

  describe('GET /api/employees/:id', () => {
    it('should return 404 for non-existent employee', async () => {
      mockPrisma.employee.findUnique.mockResolvedValueOnce(null)
      const { GET } = await import('@/app/api/employees/[id]/route')
      const res = await callRoute(GET, 'GET', 'http://localhost/api/employees/nonexistent', undefined, { auth_token: 'valid-token' }, {
        id: 'nonexistent',
      })
      expect(res.status).toBe(404)
    })

    it('should return employee with nested data', async () => {
      mockPrisma.employee.findUnique.mockResolvedValueOnce({
        id: 'emp-1',
        fullName: 'Петров П.П.',
        position: 'Инженер',
        organizationId: 'org-1',
        organization: { id: 'org-1', name: 'ООО Тест', sequentialNumber: 1 },
        documents: [{ id: 'doc-1', name: 'Удостоверение', status: 'valid' }],
        approvals: [{ id: 'appr-1', department: 'security', status: 'pending' }],
        workClasses: [{ workClass: 'Высотные работы' }],
      } as any)

      const { GET } = await import('@/app/api/employees/[id]/route')
      const res = await callRoute(GET, 'GET', 'http://localhost/api/employees/emp-1', undefined, { auth_token: 'valid-token' }, {
        id: 'emp-1',
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.fullName).toBe('Петров П.П.')
      expect(body.organization.name).toBe('ООО Тест')
    })

    it('should return 403 when contractor_employee views other org employee', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(CONTRACTOR_MOCK_USER)
      mockPrisma.employee.findUnique.mockResolvedValueOnce({
        id: 'emp-1',
        fullName: 'Петров П.П.',
        position: 'Инженер',
        organizationId: 'org-2',
        organization: { id: 'org-2', name: 'Other Org' },
        documents: [],
        approvals: [],
        workClasses: [],
      } as any)

      const { GET } = await import('@/app/api/employees/[id]/route')
      const res = await callRoute(GET, 'GET', 'http://localhost/api/employees/emp-1', undefined, { auth_token: 'contractor-token' }, {
        id: 'emp-1',
      })
      expect(res.status).toBe(403)
    })
  })

  describe('POST /api/organizations/:orgId/employees', () => {
    it('should create employee for own org (contractor_employee)', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(CONTRACTOR_MOCK_USER)
      mockPrisma.employee.create.mockResolvedValueOnce({
        id: 'emp-1',
        organizationId: 'org-1',
        fullName: 'Новиков Н.Н.',
        position: 'Монтажник',
        passportSeries: '4510',
        passportNumber: '654321',
        workClasses: [],
        previouslyAtPirelli: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)

      const { POST } = await import('@/app/api/employees/[id]/route')
      const res = await callRoute(
        POST,
        'POST',
        'http://localhost/api/employees/org-1',
        { fullName: 'Новиков Н.Н.', position: 'Монтажник', passportSeries: '4510', passportNumber: '654321' },
        { auth_token: 'contractor-token' },
        { id: 'org-1' },
      )
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.fullName).toBe('Новиков Н.Н.')
    })

    it('should reject passport series not 4 digits', async () => {
      const { POST } = await import('@/app/api/employees/[id]/route')
      const res = await callRoute(
        POST,
        'POST',
        'http://localhost/api/employees/org-1',
        { fullName: 'Новиков Н.Н.', position: 'Монтажник', passportSeries: '45A', passportNumber: '654321' },
        { auth_token: 'valid-token' },
        { id: 'org-1' },
      )
      expect(res.status).toBe(400)
    })

    it('should reject passport number not 6 digits', async () => {
      const { POST } = await import('@/app/api/employees/[id]/route')
      const res = await callRoute(
        POST,
        'POST',
        'http://localhost/api/employees/org-1',
        { fullName: 'Новиков Н.Н.', position: 'Монтажник', passportSeries: '4510', passportNumber: '12345' },
        { auth_token: 'valid-token' },
        { id: 'org-1' },
      )
      expect(res.status).toBe(400)
    })
  })
})

describe('Approvals API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.user.findUnique.mockResolvedValue(ADMIN_MOCK_USER)
  })

  describe('GET /api/approvals', () => {
    it('should return 401 without auth', async () => {
      const { GET } = await import('@/app/api/approvals/route')
      const res = await callRoute(GET, 'GET', 'http://localhost/api/approvals')
      expect(res.status).toBe(401)
    })

    it('should return approvals filtered by user department', async () => {
      mockPrisma.approvalRequest.findMany.mockResolvedValueOnce([
        {
          id: 'appr-1',
          employeeId: 'emp-1',
          department: 'security',
          status: 'pending',
          deadline: new Date('2024-02-01'),
          employee: { fullName: 'Петров П.П.', organization: { name: 'ООО Тест' } },
        },
      ] as any)

      const { GET } = await import('@/app/api/approvals/route')
      const res = await callRoute(GET, 'GET', 'http://localhost/api/approvals', undefined, { auth_token: 'security-token' })
      expect(res.status).toBe(200)
    })
  })

  describe('PATCH /api/approvals/:id', () => {
    it('should approve with optional comment', async () => {
      mockPrisma.approvalRequest.findUnique.mockResolvedValueOnce({
        id: 'appr-1',
        employeeId: 'emp-1',
        department: 'security',
        status: 'pending',
        deadline: new Date('2024-02-01'),
      } as any)
      mockPrisma.approvalRequest.update.mockResolvedValueOnce({
        id: 'appr-1',
        status: 'approved',
        comment: 'Всё в порядке',
        decidedAt: new Date(),
        employee: { fullName: 'Петров П.П.' },
      } as any)

      const { PATCH } = await import('@/app/api/approvals/[id]/route')
      const res = await callRoute(
        PATCH,
        'PATCH',
        'http://localhost/api/approvals/appr-1',
        { status: 'approved', comment: 'Всё в порядке' },
        { auth_token: 'security-token' },
        { id: 'appr-1' },
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.status).toBe('approved')
    })

    it('should reject without comment — 400', async () => {
      mockPrisma.approvalRequest.findUnique.mockResolvedValueOnce({
        id: 'appr-1',
        status: 'pending',
        department: 'security',
        employeeId: 'emp-1',
        deadline: new Date('2024-02-01'),
      } as any)

      const { PATCH } = await import('@/app/api/approvals/[id]/route')
      const res = await callRoute(
        PATCH,
        'PATCH',
        'http://localhost/api/approvals/appr-1',
        { status: 'rejected' },
        { auth_token: 'security-token' },
        { id: 'appr-1' },
      )
      expect(res.status).toBe(400)
    })

    it('should reject already-decided approval — 400', async () => {
      mockPrisma.approvalRequest.findUnique.mockResolvedValueOnce({
        id: 'appr-1',
        status: 'approved',
        department: 'security',
        employeeId: 'emp-1',
        deadline: new Date('2024-02-01'),
      } as any)

      const { PATCH } = await import('@/app/api/approvals/[id]/route')
      const res = await callRoute(
        PATCH,
        'PATCH',
        'http://localhost/api/approvals/appr-1',
        { status: 'rejected', comment: 'Changed mind' },
        { auth_token: 'security-token' },
        { id: 'appr-1' },
      )
      expect(res.status).toBe(400)
    })

    it('should reject approval from wrong department — 403', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(SECURITY_MOCK_USER)
      mockPrisma.approvalRequest.findUnique.mockResolvedValueOnce({
        id: 'appr-1',
        status: 'pending',
        department: 'hr',
        employeeId: 'emp-1',
        deadline: new Date('2024-02-01'),
      } as any)

      const { PATCH } = await import('@/app/api/approvals/[id]/route')
      const res = await callRoute(
        PATCH,
        'PATCH',
        'http://localhost/api/approvals/appr-1',
        { status: 'approved' },
        { auth_token: 'security-token' },
        { id: 'appr-1' },
      )
      expect(res.status).toBe(403)
    })

    it('should allow admin to approve any department', async () => {
      mockPrisma.approvalRequest.findUnique.mockResolvedValueOnce({
        id: 'appr-1',
        status: 'pending',
        department: 'hr',
        employeeId: 'emp-1',
        deadline: new Date('2024-02-01'),
      } as any)
      // Mock previous department approval (sequential check)
      mockPrisma.approvalRequest.findFirst.mockResolvedValueOnce({
        id: 'appr-prev',
        status: 'approved',
        department: 'security',
        employeeId: 'emp-1',
      } as any)
      mockPrisma.approvalRequest.update.mockResolvedValueOnce({
        id: 'appr-1',
        status: 'approved',
        comment: 'Admin override',
        decidedAt: new Date(),
        employee: { fullName: 'Петров П.П.' },
      } as any)

      const { PATCH } = await import('@/app/api/approvals/[id]/route')
      const res = await callRoute(
        PATCH,
        'PATCH',
        'http://localhost/api/approvals/appr-1',
        { status: 'approved', comment: 'Admin override' },
        { auth_token: 'valid-token' },
        { id: 'appr-1' },
      )
      expect(res.status).toBe(200)
    })
  })
})

describe('Documents API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.user.findUnique.mockResolvedValue(ADMIN_MOCK_USER)
  })

  describe('GET /api/employees/:empId/documents', () => {
    it('should return 404 for non-existent employee', async () => {
      mockPrisma.employee.findUnique.mockResolvedValueOnce(null)
      const { GET } = await import('@/app/api/employees/[id]/documents/route')
      const res = await callRoute(
        GET,
        'GET',
        'http://localhost/api/employees/nonexistent/documents',
        undefined,
        { auth_token: 'valid-token' },
        { id: 'nonexistent' },
      )
      expect(res.status).toBe(404)
    })
  })

  describe('GET /api/documents/expiring', () => {
    it('should return documents expiring within default 30 days', async () => {
      mockPrisma.employeeDocument.findMany.mockResolvedValueOnce([
        {
          id: 'doc-1',
          name: 'Старое удостоверение',
          status: 'expired',
          expiryDate: new Date(Date.now() - 86400000),
          employee: { fullName: 'Петров П.П.', organization: { name: 'ООО Тест' } },
        },
      ] as any)

      const { GET } = await import('@/app/api/documents/expiring/route')
      const res = await callRoute(GET, 'GET', 'http://localhost/api/documents/expiring', undefined, { auth_token: 'valid-token' })
      expect(res.status).toBe(200)
    })

    it('should accept custom days parameter', async () => {
      mockPrisma.employeeDocument.findMany.mockResolvedValueOnce([
        {
          id: 'doc-1',
          name: 'Скоро истекает',
          status: 'expiring',
          expiryDate: new Date(Date.now() + 7 * 86400000),
          employee: { fullName: 'Петров П.П.', organization: { name: 'ООО Тест' } },
        },
      ] as any)

      const { GET } = await import('@/app/api/documents/expiring/route')
      const res = await callRoute(
        GET,
        'GET',
        'http://localhost/api/documents/expiring?days=7',
        undefined,
        { auth_token: 'valid-token' },
      )
      expect(res.status).toBe(200)
    })
  })
})
