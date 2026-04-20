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
    count: vi.fn().mockResolvedValue(0),
  },
  permit: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
    update: vi.fn(),
    delete: vi.fn(),
    aggregate: vi.fn(),
  },
  violation: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
    update: vi.fn(),
    delete: vi.fn(),
    aggregate: vi.fn(),
  },
  $transaction: vi.fn().mockImplementation(async (cb) => cb(mockPrisma)),
  violationComplaint: {
    create: vi.fn(),
    findMany: vi.fn().mockResolvedValue([]),
  },
  violationTemplate: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
    update: vi.fn(),
    delete: vi.fn(),
  },
  regDocumentSection: {
    findMany: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    findUnique: vi.fn(),
  },
  regulatoryDocument: {
    create: vi.fn(),
    findMany: vi.fn().mockResolvedValue([]),
    findUnique: vi.fn(),
    count: vi.fn().mockResolvedValue(0),
    update: vi.fn(),
    delete: vi.fn(),
  },
  checklist: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
    update: vi.fn(),
    delete: vi.fn(),
    aggregate: vi.fn(),
  },
  notification: {
    create: vi.fn(),
    findMany: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockResolvedValue({}),
  },
}))

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma, $Enums: {} }))

vi.mock('@/lib/email', () => ({
  sendApprovalNotification: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/notifications', () => ({
  createNotification: vi.fn().mockResolvedValue(undefined),
  createNotificationsForRole: vi.fn().mockResolvedValue(undefined),
  notifyOrganizationContractors: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/file-storage', () => ({
  uploadFile: vi.fn().mockResolvedValue('/uploads/mock-file.jpg'),
  deleteFile: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('$2b$12$mockedHash'),
    compare: vi.fn().mockImplementation(async (pw: string) => pw === 'Admin123!'),
  },
  hash: vi.fn().mockResolvedValue('$2b$12$mockedHash'),
  compare: vi.fn().mockImplementation(async (pw: string) => pw === 'Admin123!'),
}))

const verifyMock = vi.fn().mockImplementation((token: string) => {
  if (token === 'valid-token') {
    return { userId: 'user-1', email: 'admin@pirelli.ru', fullName: 'Admin', role: 'admin', organizationId: null, department: null }
  }
  if (token === 'contractor-token') {
    return { userId: 'user-2', email: 'contractor@employee.ru', fullName: 'Contractor', role: 'contractor_employee', organizationId: 'org-1', department: null }
  }
  if (token === 'employee-token') {
    return { userId: 'user-4', email: 'employee@test.ru', fullName: 'Employee', role: 'employee', organizationId: null, department: null }
  }
  if (token === 'approver-token') {
    return { userId: 'user-5', email: 'approver@test.ru', fullName: 'Approver', role: 'department_approver', organizationId: null, department: 'security' }
  }
  throw new Error('Invalid token')
})

vi.mock('jsonwebtoken', () => {
  const fn = verifyMock
  const obj = {
    sign: vi.fn().mockReturnValue('mock.jwt.token'),
    verify: fn,
  }
  return { default: obj, ...obj }
})

// ─── Helper to call route handlers ──────────────────────────────

async function callRoute(
  handler: (req: NextRequest, ctx?: any) => Promise<NextResponse>,
  method: string,
  url: string,
  body?: any,
  cookies: Record<string, string> = {},
  params?: Record<string, string>,
) {
  const init: any = { method }
  const headers: Record<string, string> = {}
  if (body) {
    headers['Content-Type'] = 'application/json'
    init.body = JSON.stringify(body)
  }
  const cookieHeader = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ')
  if (cookieHeader) headers['Cookie'] = cookieHeader
  init.headers = headers

  const req = new NextRequest(url, init)
  const ctx = params ? { params: Promise.resolve(params) } : undefined
  return handler(req, ctx)
}

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

const CONTRACTOR_ORG_UUID = '550e8400-e29b-41d4-a716-446655440000'
const OTHER_ORG_UUID = '550e8400-e29b-41d4-a716-446655440001'

const CONTRACTOR_MOCK_USER = {
  id: 'user-2',
  email: 'contractor@employee.ru',
  passwordHash: 'hash',
  fullName: 'Contractor',
  role: 'contractor_employee',
  isActive: true,
  organizationId: CONTRACTOR_ORG_UUID,
  department: null,
  mustChangePwd: true,
} as any

const EMPLOYEE_MOCK_USER = {
  id: 'user-4',
  email: 'employee@test.ru',
  passwordHash: 'hash',
  fullName: 'Employee',
  role: 'employee',
  isActive: true,
  organizationId: null,
  department: null,
  mustChangePwd: true,
} as any

const APPROVER_MOCK_USER = {
  id: 'user-5',
  email: 'approver@test.ru',
  passwordHash: 'hash',
  fullName: 'Approver',
  role: 'department_approver',
  isActive: true,
  organizationId: null,
  department: 'security',
  mustChangePwd: true,
} as any

// ============================================================
// Permits API Routes
// ============================================================

describe('Permits API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.user.findUnique.mockResolvedValue(ADMIN_MOCK_USER)
  })

  describe('GET /api/permits', () => {
    it('should return 401 without auth', async () => {
      const { GET } = await import('@/app/api/permits/route')
      const res = await callRoute(GET, 'GET', 'http://localhost/api/permits')
      expect(res.status).toBe(401)
    })

    it('should return paginated list with auth', async () => {
      mockPrisma.permit.count.mockResolvedValueOnce(1)
      mockPrisma.permit.findMany.mockResolvedValueOnce([
        { id: 'permit-1', category: 'hot_work', status: 'active', sequentialNumber: 1, contractorId: 'org-1' },
      ] as any)

      const { GET } = await import('@/app/api/permits/route')
      const res = await callRoute(GET, 'GET', 'http://localhost/api/permits', undefined, { auth_token: 'valid-token' })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.pagination.total).toBe(1)
    })

    it('should filter by status', async () => {
      mockPrisma.permit.count.mockResolvedValueOnce(1)
      mockPrisma.permit.findMany.mockResolvedValueOnce([
        { id: 'permit-1', status: 'approved', contractorId: 'org-1' },
      ] as any)

      const { GET } = await import('@/app/api/permits/route')
      const res = await callRoute(
        GET, 'GET', 'http://localhost/api/permits?status=approved',
        undefined, { auth_token: 'valid-token' }
      )
      expect(res.status).toBe(200)
    })

    it('should scope permits to contractor org', async () => {
      mockPrisma.permit.count.mockResolvedValueOnce(1)
      mockPrisma.permit.findMany.mockResolvedValueOnce([
        { id: 'permit-1', contractorId: CONTRACTOR_ORG_UUID, status: 'active' },
      ] as any)

      const { GET } = await import('@/app/api/permits/route')
      const res = await callRoute(GET, 'GET', 'http://localhost/api/permits', undefined, { auth_token: 'contractor-token' })
      expect(res.status).toBe(200)
    })

    it('should allow employee role to view permits', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(EMPLOYEE_MOCK_USER)
      mockPrisma.permit.count.mockResolvedValueOnce(0)
      mockPrisma.permit.findMany.mockResolvedValueOnce([])

      const { GET } = await import('@/app/api/permits/route')
      const res = await callRoute(GET, 'GET', 'http://localhost/api/permits', undefined, { auth_token: 'employee-token' })
      expect(res.status).toBe(200)
    })
  })

  describe('POST /api/permits', () => {
    const CONTRACTOR_ORG_UUID = '550e8400-e29b-41d4-a716-446655440000'
    const OTHER_ORG_UUID = '550e8400-e29b-41d4-a716-446655440001'
    const validPermitBody = {
      category: 'hot_work',
      contractorId: CONTRACTOR_ORG_UUID,
      workSite: 'Цех 1',
      responsiblePerson: 'Иванов И.И.',
      openDate: '2024-03-01T10:00:00Z',
      expiryDate: '2024-03-02T10:00:00Z',
    }

    it('should return 401 without auth', async () => {
      const { POST } = await import('@/app/api/permits/route')
      const res = await callRoute(POST, 'POST', 'http://localhost/api/permits', validPermitBody)
      expect(res.status).toBe(401)
    })

    it('should reject employee role from creating permits', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(EMPLOYEE_MOCK_USER)
      const { POST } = await import('@/app/api/permits/route')
      const res = await callRoute(POST, 'POST', 'http://localhost/api/permits', validPermitBody, { auth_token: 'employee-token' })
      expect(res.status).toBe(403)
    })

    it('should reject department_approver from creating permits', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(APPROVER_MOCK_USER)
      const { POST } = await import('@/app/api/permits/route')
      const res = await callRoute(POST, 'POST', 'http://localhost/api/permits', validPermitBody, { auth_token: 'approver-token' })
      expect(res.status).toBe(403)
    })

    it('should create permit as admin', async () => {
      mockPrisma.organization.findUnique.mockResolvedValueOnce({ id: CONTRACTOR_ORG_UUID, sequentialNumber: 1 } as any)
      mockPrisma.permit.aggregate.mockResolvedValueOnce({ _max: { sequentialNumber: 0 } })
      mockPrisma.permit.create.mockResolvedValueOnce({
        id: 'permit-1',
        permitNumber: 'HW-001-001-0001',
        category: 'hot_work',
        contractorId: CONTRACTOR_ORG_UUID,
        status: 'active',
        sequentialNumber: 1,
      } as any)

      const { POST } = await import('@/app/api/permits/route')
      const res = await callRoute(POST, 'POST', 'http://localhost/api/permits', validPermitBody, { auth_token: 'valid-token' })
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.permitNumber).toBe('HW-001-001-0001')
    })

    it('should reject contractor_employee from creating permits', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(CONTRACTOR_MOCK_USER)
      const { POST } = await import('@/app/api/permits/route')
      const res = await callRoute(POST, 'POST', 'http://localhost/api/permits', validPermitBody, { auth_token: 'contractor-token' })
      expect(res.status).toBe(403)
    })

    it('should reject contractor not found', async () => {
      mockPrisma.organization.findUnique.mockResolvedValueOnce(null)
      const { POST } = await import('@/app/api/permits/route')
      const res = await callRoute(POST, 'POST', 'http://localhost/api/permits', validPermitBody, { auth_token: 'valid-token' })
      expect(res.status).toBe(404)
    })

    it('should reject invalid body', async () => {
      const { POST } = await import('@/app/api/permits/route')
      const res = await callRoute(POST, 'POST', 'http://localhost/api/permits', { category: 'invalid' }, { auth_token: 'valid-token' })
      expect(res.status).toBe(400)
    })
  })

  describe('GET /api/permits/:id', () => {
    it('should return 404 for non-existent permit', async () => {
      mockPrisma.permit.findUnique.mockResolvedValueOnce(null)
      const { GET } = await import('@/app/api/permits/[id]/route')
      const res = await callRoute(GET, 'GET', 'http://localhost/api/permits/not-found', undefined, { auth_token: 'valid-token' }, { id: 'not-found' })
      expect(res.status).toBe(404)
    })

    it('should return permit with approvals', async () => {
      mockPrisma.permit.findUnique.mockResolvedValueOnce({
        id: 'permit-1',
        category: 'hot_work',
        status: 'active',
        contractorId: 'org-1',
        approvals: [{ id: 'appr-1', department: 'security', status: 'pending', deadline: new Date('2024-03-01') }],
      } as any)

      const { GET } = await import('@/app/api/permits/[id]/route')
      const res = await callRoute(GET, 'GET', 'http://localhost/api/permits/permit-1', undefined, { auth_token: 'valid-token' }, { id: 'permit-1' })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.id).toBe('permit-1')
    })

    it('should reject contractor viewing other org permit', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(CONTRACTOR_MOCK_USER)
      mockPrisma.permit.findUnique.mockResolvedValueOnce({
        id: 'permit-1',
        category: 'hot_work',
        contractorId: 'org-2',
        approvals: [],
      } as any)

      const { GET } = await import('@/app/api/permits/[id]/route')
      const res = await callRoute(GET, 'GET', 'http://localhost/api/permits/permit-1', undefined, { auth_token: 'contractor-token' }, { id: 'permit-1' })
      expect(res.status).toBe(403)
    })
  })

  describe('PATCH /api/permits/:id', () => {
    it('should early-close permit with reason', async () => {
      mockPrisma.permit.findUnique.mockResolvedValueOnce({
        id: 'permit-1',
        category: 'hot_work',
        status: 'active',
        contractorId: 'org-1',
        permitNumber: 'HW-001-001-0001',
      } as any)
      mockPrisma.user.findMany.mockResolvedValueOnce([]) // contractor users
      mockPrisma.user.findMany.mockResolvedValueOnce([]) // admins
      mockPrisma.permit.update.mockResolvedValueOnce({
        id: 'permit-1',
        status: 'early_closed',
        closeReason: 'Завершены работы',
        closedAt: new Date(),
        contractorId: 'org-1',
        permitNumber: 'HW-001-001-0001',
        approvals: [],
      } as any)

      const { PATCH } = await import('@/app/api/permits/[id]/route')
      const res = await callRoute(
        PATCH, 'PATCH', 'http://localhost/api/permits/permit-1',
        { status: 'early_closed', closeReason: 'Завершены работы' },
        { auth_token: 'valid-token' }, { id: 'permit-1' }
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.status).toBe('early_closed')
    })

    it('should reject early-close without reason', async () => {
      mockPrisma.permit.findUnique.mockResolvedValueOnce({
        id: 'permit-1',
        status: 'active',
        contractorId: 'org-1',
      } as any)

      const { PATCH } = await import('@/app/api/permits/[id]/route')
      const res = await callRoute(
        PATCH, 'PATCH', 'http://localhost/api/permits/permit-1',
        { status: 'early_closed' },
        { auth_token: 'valid-token' }, { id: 'permit-1' }
      )
      expect(res.status).toBe(400)
    })

    it('should allow partial update', async () => {
      mockPrisma.permit.findUnique.mockResolvedValueOnce({
        id: 'permit-1',
        category: 'hot_work',
        status: 'active',
        contractorId: 'org-1',
      } as any)
      mockPrisma.permit.update.mockResolvedValueOnce({
        id: 'permit-1',
        workSite: 'Новое место',
        status: 'active',
        contractorId: 'org-1',
        approvals: [],
      } as any)

      const { PATCH } = await import('@/app/api/permits/[id]/route')
      const res = await callRoute(
        PATCH, 'PATCH', 'http://localhost/api/permits/permit-1',
        { workSite: 'Новое место' },
        { auth_token: 'valid-token' }, { id: 'permit-1' }
      )
      expect(res.status).toBe(200)
    })

    it('should reject contractor editing other org permit', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(CONTRACTOR_MOCK_USER)
      mockPrisma.permit.findUnique.mockResolvedValueOnce({
        id: 'permit-1',
        contractorId: 'org-2',
        status: 'active',
      } as any)

      const { PATCH } = await import('@/app/api/permits/[id]/route')
      const res = await callRoute(
        PATCH, 'PATCH', 'http://localhost/api/permits/permit-1',
        { workSite: 'New site' },
        { auth_token: 'contractor-token' }, { id: 'permit-1' }
      )
      expect(res.status).toBe(403)
    })
  })
})

// ============================================================
// Violations API Routes (expanded)
// ============================================================

describe('Violations API Routes (expanded)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.user.findUnique.mockResolvedValue(ADMIN_MOCK_USER)
  })

  describe('GET /api/violations', () => {
    it('should return 401 without auth', async () => {
      const { GET } = await import('@/app/api/violations/route')
      const res = await callRoute(GET, 'GET', 'http://localhost/api/violations')
      expect(res.status).toBe(401)
    })

    it('should return paginated violations', async () => {
      mockPrisma.violation.count.mockResolvedValueOnce(1)
      mockPrisma.violation.findMany.mockResolvedValueOnce([
        { id: 'vio-1', violationNumber: 'VIO-00001', description: 'test', contractorId: 'org-1' },
      ] as any)

      const { GET } = await import('@/app/api/violations/route')
      const res = await callRoute(GET, 'GET', 'http://localhost/api/violations', undefined, { auth_token: 'valid-token' })
      expect(res.status).toBe(200)
    })

    it('should filter by severity', async () => {
      mockPrisma.violation.count.mockResolvedValueOnce(1)
      mockPrisma.violation.findMany.mockResolvedValueOnce([])

      const { GET } = await import('@/app/api/violations/route')
      const res = await callRoute(GET, 'GET', 'http://localhost/api/violations?severity=high', undefined, { auth_token: 'valid-token' })
      expect(res.status).toBe(200)
    })

    it('should scope to contractor org', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(CONTRACTOR_MOCK_USER)
      mockPrisma.violation.count.mockResolvedValueOnce(0)
      mockPrisma.violation.findMany.mockResolvedValueOnce([])

      const { GET } = await import('@/app/api/violations/route')
      const res = await callRoute(GET, 'GET', 'http://localhost/api/violations', undefined, { auth_token: 'contractor-token' })
      expect(res.status).toBe(200)
    })
  })

  describe('POST /api/violations', () => {
    const validViolationBody = {
      contractorId: CONTRACTOR_ORG_UUID,
      date: '2024-03-01T10:00:00Z',
      description: 'Нарушение ТБ',
      severity: 'high',
      department: 'safety',
    }

    it('should return 401 without auth', async () => {
      const { POST } = await import('@/app/api/violations/route')
      const res = await callRoute(POST, 'POST', 'http://localhost/api/violations', validViolationBody)
      expect(res.status).toBe(401)
    })

    it('should allow employee to create violations', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(EMPLOYEE_MOCK_USER)
      mockPrisma.violation.aggregate.mockResolvedValueOnce({ _max: { sequentialNumber: 0 } })
      mockPrisma.violation.create.mockResolvedValueOnce({
        id: 'vio-1',
        violationNumber: 'VIO-00001',
        contractorId: CONTRACTOR_ORG_UUID,
        description: 'test',
      } as any)

      const { POST } = await import('@/app/api/violations/route')
      const res = await callRoute(POST, 'POST', 'http://localhost/api/violations', validViolationBody, { auth_token: 'employee-token' })
      expect(res.status).toBe(201)
    })

    it('should reject contractor_employee from creating violations', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(CONTRACTOR_MOCK_USER)
      const { POST } = await import('@/app/api/violations/route')
      const res = await callRoute(POST, 'POST', 'http://localhost/api/violations', validViolationBody, { auth_token: 'contractor-token' })
      expect(res.status).toBe(403)
    })

    it('should reject invalid violation body', async () => {
      const { POST } = await import('@/app/api/violations/route')
      const res = await callRoute(POST, 'POST', 'http://localhost/api/violations', { description: 'no severity' }, { auth_token: 'valid-token' })
      expect(res.status).toBe(400)
    })
  })

  describe('GET /api/violations/:id', () => {
    it('should return 404 for non-existent violation', async () => {
      mockPrisma.violation.findUnique.mockResolvedValueOnce(null)
      const { GET } = await import('@/app/api/violations/[id]/route')
      const res = await callRoute(GET, 'GET', 'http://localhost/api/violations/not-found', undefined, { auth_token: 'valid-token' }, { id: 'not-found' })
      expect(res.status).toBe(404)
    })

    it('should return violation with contractor info', async () => {
      mockPrisma.violation.findUnique.mockResolvedValueOnce({
        id: 'vio-1',
        violationNumber: 'VIO-00001',
        description: 'test',
        contractorId: 'org-1',
        contractor: { name: 'ООО Тест', sequentialNumber: 1 },
        createdBy: { fullName: 'Иванов И.И.' },
      } as any)

      const { GET } = await import('@/app/api/violations/[id]/route')
      const res = await callRoute(GET, 'GET', 'http://localhost/api/violations/vio-1', undefined, { auth_token: 'valid-token' }, { id: 'vio-1' })
      expect(res.status).toBe(200)
    })

    it('should reject contractor viewing other org violation', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(CONTRACTOR_MOCK_USER)
      mockPrisma.violation.findUnique.mockResolvedValueOnce({
        id: 'vio-1',
        contractorId: 'org-2',
      } as any)

      const { GET } = await import('@/app/api/violations/[id]/route')
      const res = await callRoute(GET, 'GET', 'http://localhost/api/violations/vio-1', undefined, { auth_token: 'contractor-token' }, { id: 'vio-1' })
      expect(res.status).toBe(403)
    })
  })

  describe('PATCH /api/violations/:id', () => {
    it('should allow admin to update violation', async () => {
      mockPrisma.violation.findUnique.mockResolvedValueOnce({
        id: 'vio-1',
        description: 'old',
        contractorId: 'org-1',
      } as any)
      mockPrisma.violation.update.mockResolvedValueOnce({
        id: 'vio-1',
        description: 'updated',
      } as any)

      const { PATCH } = await import('@/app/api/violations/[id]/route')
      const res = await callRoute(
        PATCH, 'PATCH', 'http://localhost/api/violations/vio-1',
        { description: 'updated' },
        { auth_token: 'valid-token' }, { id: 'vio-1' }
      )
      expect(res.status).toBe(200)
    })

    it('should reject non-admin from updating', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(EMPLOYEE_MOCK_USER)
      const { PATCH } = await import('@/app/api/violations/[id]/route')
      const res = await callRoute(
        PATCH, 'PATCH', 'http://localhost/api/violations/vio-1',
        { description: 'hacked' },
        { auth_token: 'employee-token' }, { id: 'vio-1' }
      )
      expect(res.status).toBe(403)
    })

    it('should reject contractor_employee from updating', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(CONTRACTOR_MOCK_USER)
      const { PATCH } = await import('@/app/api/violations/[id]/route')
      const res = await callRoute(
        PATCH, 'PATCH', 'http://localhost/api/violations/vio-1',
        { description: 'hacked' },
        { auth_token: 'contractor-token' }, { id: 'vio-1' }
      )
      expect(res.status).toBe(403)
    })
  })

  describe('DELETE /api/violations/:id', () => {
    it('should allow admin to delete violation', async () => {
      mockPrisma.violation.findUnique.mockResolvedValueOnce({ id: 'vio-1' } as any)
      mockPrisma.violation.delete.mockResolvedValueOnce({})

      const { DELETE } = await import('@/app/api/violations/[id]/route')
      const res = await callRoute(DELETE, 'DELETE', 'http://localhost/api/violations/vio-1', undefined, { auth_token: 'valid-token' }, { id: 'vio-1' })
      expect(res.status).toBe(200)
    })

    it('should reject non-admin from deleting', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(EMPLOYEE_MOCK_USER)
      const { DELETE } = await import('@/app/api/violations/[id]/route')
      const res = await callRoute(DELETE, 'DELETE', 'http://localhost/api/violations/vio-1', undefined, { auth_token: 'employee-token' }, { id: 'vio-1' })
      expect(res.status).toBe(403)
    })
  })
})

// ============================================================
// Violation Resolve Route
// ============================================================

describe('Violation Resolve Route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.user.findUnique.mockResolvedValue(ADMIN_MOCK_USER)
  })

  it('should allow admin to resolve violation', async () => {
    mockPrisma.violation.findUnique.mockResolvedValueOnce({
      id: 'vio-1',
      status: 'pending',
      contractorId: 'org-1',
    } as any)
    mockPrisma.violation.update.mockResolvedValueOnce({
      id: 'vio-1',
      status: 'resolved',
      resolvedAt: new Date(),
      resolutionNotes: 'Исправлено',
    } as any)

    const { PATCH } = await import('@/app/api/violations/[id]/resolve/route')
    const res = await callRoute(
      PATCH, 'PATCH', 'http://localhost/api/violations/vio-1/resolve',
      { notes: 'Исправлено', status: 'resolved' },
      { auth_token: 'valid-token' }, { id: 'vio-1' }
    )
    expect(res.status).toBe(200)
  })

  it('should allow admin to escalate violation', async () => {
    mockPrisma.violation.findUnique.mockResolvedValueOnce({
      id: 'vio-1',
      status: 'pending',
    } as any)
    mockPrisma.violation.update.mockResolvedValueOnce({
      id: 'vio-1',
      status: 'escalated',
      resolvedAt: new Date(),
      resolutionNotes: 'Эскалация',
    } as any)

    const { PATCH } = await import('@/app/api/violations/[id]/resolve/route')
    const res = await callRoute(
      PATCH, 'PATCH', 'http://localhost/api/violations/vio-1/resolve',
      { notes: 'Эскалация', status: 'escalated' },
      { auth_token: 'valid-token' }, { id: 'vio-1' }
    )
    expect(res.status).toBe(200)
  })

  it('should reject non-admin from resolving', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(EMPLOYEE_MOCK_USER)
    const { PATCH } = await import('@/app/api/violations/[id]/resolve/route')
    const res = await callRoute(
      PATCH, 'PATCH', 'http://localhost/api/violations/vio-1/resolve',
      { notes: 'Resolved' },
      { auth_token: 'employee-token' }, { id: 'vio-1' }
    )
    expect(res.status).toBe(403)
  })

  it('should reject resolving non-pending violation', async () => {
    mockPrisma.violation.findUnique.mockResolvedValueOnce({
      id: 'vio-1',
      status: 'resolved',
    } as any)

    const { PATCH } = await import('@/app/api/violations/[id]/resolve/route')
    const res = await callRoute(
      PATCH, 'PATCH', 'http://localhost/api/violations/vio-1/resolve',
      { notes: 'Already resolved' },
      { auth_token: 'valid-token' }, { id: 'vio-1' }
    )
    expect(res.status).toBe(400)
  })

  it('should reject resolve without notes', async () => {
    mockPrisma.violation.findUnique.mockResolvedValueOnce({
      id: 'vio-1',
      status: 'pending',
    } as any)

    const { PATCH } = await import('@/app/api/violations/[id]/resolve/route')
    const res = await callRoute(
      PATCH, 'PATCH', 'http://localhost/api/violations/vio-1/resolve',
      {},
      { auth_token: 'valid-token' }, { id: 'vio-1' }
    )
    expect(res.status).toBe(400)
  })
})

// ============================================================
// Violation Complaints Route
// ============================================================

describe('Violation Complaints Route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.user.findUnique.mockResolvedValue(CONTRACTOR_MOCK_USER)
  })

  it('should allow contractor_employee to file complaint', async () => {
    mockPrisma.violation.findUnique.mockResolvedValueOnce({
      id: 'vio-1',
      violationNumber: 'VIO-00001',
      contractorId: CONTRACTOR_ORG_UUID,
    } as any)
    mockPrisma.violationComplaint.create.mockResolvedValueOnce({
      id: 'complaint-1',
      violationId: 'vio-1',
      complaintText: 'Жалоба',
    } as any)

    const { POST } = await import('@/app/api/violations/[id]/complaints/route')
    const res = await callRoute(
      POST, 'POST', 'http://localhost/api/violations/vio-1/complaints',
      { text: 'Жалоба на нарушение', department: 'safety' },
      { auth_token: 'contractor-token' }, { id: 'vio-1' }
    )
    expect(res.status).toBe(201)
  })

  it('should reject non-contractor from filing complaint', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(ADMIN_MOCK_USER)
    mockPrisma.violation.findUnique.mockResolvedValueOnce({ id: 'vio-1' } as any)

    const { POST } = await import('@/app/api/violations/[id]/complaints/route')
    const res = await callRoute(
      POST, 'POST', 'http://localhost/api/violations/vio-1/complaints',
      { text: 'Жалоба' },
      { auth_token: 'valid-token' }, { id: 'vio-1' }
    )
    expect(res.status).toBe(403)
  })

  it('should reject complaint for other org violation', async () => {
    mockPrisma.violation.findUnique.mockResolvedValueOnce({
      id: 'vio-1',
      contractorId: 'org-2',
    } as any)

    const { POST } = await import('@/app/api/violations/[id]/complaints/route')
    const res = await callRoute(
      POST, 'POST', 'http://localhost/api/violations/vio-1/complaints',
      { text: 'Жалоба' },
      { auth_token: 'contractor-token' }, { id: 'vio-1' }
    )
    expect(res.status).toBe(403)
  })

  it('should reject complaint without text', async () => {
    mockPrisma.violation.findUnique.mockResolvedValueOnce({
      id: 'vio-1',
      contractorId: CONTRACTOR_ORG_UUID,
    } as any)

    const { POST } = await import('@/app/api/violations/[id]/complaints/route')
    const res = await callRoute(
      POST, 'POST', 'http://localhost/api/violations/vio-1/complaints',
      { text: '' },
      { auth_token: 'contractor-token' }, { id: 'vio-1' }
    )
    expect(res.status).toBe(400)
  })
})

// ============================================================
// Dashboard Route
// ============================================================

describe('Dashboard API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.user.findUnique.mockResolvedValue(ADMIN_MOCK_USER)
  })

  it('should return 401 without auth', async () => {
    const { GET } = await import('@/app/api/dashboard/route')
    const res = await callRoute(GET, 'GET', 'http://localhost/api/dashboard')
    expect(res.status).toBe(401)
  })

  it('should return KPIs for admin user', async () => {
    mockPrisma.organization.count.mockResolvedValueOnce(5)
    mockPrisma.approvalRequest.count.mockResolvedValueOnce(3)
    mockPrisma.permit.count.mockResolvedValueOnce(10)
    mockPrisma.violation.count.mockResolvedValueOnce(2)

    const { GET } = await import('@/app/api/dashboard/route')
    const res = await callRoute(GET, 'GET', 'http://localhost/api/dashboard', undefined, { auth_token: 'valid-token' })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.totalContractors).toBe(5)
    expect(body.pendingApprovals).toBe(3)
    expect(body.activePermits).toBe(10)
    expect(body.monthlyViolations).toBe(2)
  })

  it('should return scoped KPIs for contractor_employee', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(CONTRACTOR_MOCK_USER)
    mockPrisma.permit.count.mockResolvedValueOnce(2)
    mockPrisma.violation.count.mockResolvedValueOnce(1)
    mockPrisma.employee.findMany.mockResolvedValueOnce([{ id: 'emp-1' }])
    mockPrisma.approvalRequest.count.mockResolvedValueOnce(1)

    const { GET } = await import('@/app/api/dashboard/route')
    const res = await callRoute(GET, 'GET', 'http://localhost/api/dashboard', undefined, { auth_token: 'contractor-token' })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.totalContractors).toBe(1)
  })

  it('should include active and pending_approval permits in active count', async () => {
    mockPrisma.permit.count.mockResolvedValueOnce(10)

    const { GET } = await import('@/app/api/dashboard/route')
    const res = await callRoute(GET, 'GET', 'http://localhost/api/dashboard', undefined, { auth_token: 'valid-token' })
    expect(res.status).toBe(200)
    // Verify permit count includes draft/pending_approval states
    expect(mockPrisma.permit.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: expect.objectContaining({ in: expect.arrayContaining(['active', 'pending_approval']) })
        })
      })
    )
  })
})

// ============================================================
// Document Sections Route
// ============================================================

describe('Document Sections Route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.user.findUnique.mockResolvedValue(ADMIN_MOCK_USER)
  })

  describe('GET /api/documents/sections', () => {
    it('should return 401 without auth', async () => {
      const { GET } = await import('@/app/api/documents/sections/route')
      const res = await callRoute(GET, 'GET', 'http://localhost/api/documents/sections')
      expect(res.status).toBe(401)
    })

    it('should return sections list', async () => {
      mockPrisma.regDocumentSection.findMany.mockResolvedValueOnce([
        { id: 'section-1', name: 'Раздел 1', order: 1, _count: { documents: 5 } },
        { id: 'section-2', name: 'Раздел 2', order: 2, _count: { documents: 0 } },
      ] as any)

      const { GET } = await import('@/app/api/documents/sections/route')
      const res = await callRoute(GET, 'GET', 'http://localhost/api/documents/sections', undefined, { auth_token: 'valid-token' })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(2)
    })

    it('should allow contractor to view sections', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(CONTRACTOR_MOCK_USER)
      mockPrisma.regDocumentSection.findMany.mockResolvedValueOnce([])

      const { GET } = await import('@/app/api/documents/sections/route')
      const res = await callRoute(GET, 'GET', 'http://localhost/api/documents/sections', undefined, { auth_token: 'contractor-token' })
      expect(res.status).toBe(200)
    })
  })

  describe('POST /api/documents/sections', () => {
    it('should allow admin to create section', async () => {
      mockPrisma.regDocumentSection.create.mockResolvedValueOnce({
        id: 'section-new',
        name: 'Новый раздел',
        order: 3,
        parentId: null,
      } as any)

      const { POST } = await import('@/app/api/documents/sections/route')
      const res = await callRoute(
        POST, 'POST', 'http://localhost/api/documents/sections',
        { name: 'Новый раздел', order: 3 },
        { auth_token: 'valid-token' }
      )
      expect(res.status).toBe(201)
    })

    it('should reject non-admin from creating section', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(EMPLOYEE_MOCK_USER)
      const { POST } = await import('@/app/api/documents/sections/route')
      const res = await callRoute(
        POST, 'POST', 'http://localhost/api/documents/sections',
        { name: 'Хак раздел', order: 99 },
        { auth_token: 'employee-token' }
      )
      expect(res.status).toBe(403)
    })

    it('should reject invalid section body', async () => {
      const { POST } = await import('@/app/api/documents/sections/route')
      const res = await callRoute(
        POST, 'POST', 'http://localhost/api/documents/sections',
        { name: '', order: -1 },
        { auth_token: 'valid-token' }
      )
      expect(res.status).toBe(400)
    })
  })
})

// ============================================================
// Employees List Route (expanded)
// ============================================================

describe('Employees List Route (expanded)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.user.findUnique.mockResolvedValue(ADMIN_MOCK_USER)
  })

  describe('GET /api/employees', () => {
    it('should return employees with document/approval counts', async () => {
      mockPrisma.employee.count.mockResolvedValueOnce(1)
      mockPrisma.employee.findMany.mockResolvedValueOnce([
        {
          id: 'emp-1',
          fullName: 'Петров П.П.',
          position: 'Инженер',
          organizationId: 'org-1',
          organization: { name: 'ООО Тест', sequentialNumber: 1 },
          documents: [
            { id: 'doc-1', name: 'Удостоверение', status: 'valid' },
            { id: 'doc-2', name: 'Старое', status: 'expired' },
          ],
          approvals: [{ id: 'appr-1', department: 'security', status: 'pending' }],
          workClasses: [{ workClass: 'Высотные работы' }],
        } as any,
      ])

      const { GET } = await import('@/app/api/employees/route')
      const res = await callRoute(GET, 'GET', 'http://localhost/api/employees', undefined, { auth_token: 'valid-token' })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data[0].fullName).toBe('Петров П.П.')
      expect(body.data[0].workClasses).toEqual(['Высотные работы'])
      expect(body.data[0].documentCounts).toEqual({ valid: 1, expiring: 0, expired: 1 })
    })

    it('should scope employees to contractor org', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(CONTRACTOR_MOCK_USER)
      mockPrisma.employee.count.mockResolvedValueOnce(1)
      mockPrisma.employee.findMany.mockResolvedValueOnce([
        { id: 'emp-1', fullName: 'Свой', organizationId: 'org-1', documents: [], approvals: [], workClasses: [] },
      ] as any)

      const { GET } = await import('@/app/api/employees/route')
      const res = await callRoute(GET, 'GET', 'http://localhost/api/employees', undefined, { auth_token: 'contractor-token' })
      expect(res.status).toBe(200)
    })

    it('should return empty list for contractor with no org employees', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(CONTRACTOR_MOCK_USER)
      mockPrisma.employee.count.mockResolvedValueOnce(0)
      mockPrisma.employee.findMany.mockResolvedValueOnce([])

      const { GET } = await import('@/app/api/employees/route')
      const res = await callRoute(GET, 'GET', 'http://localhost/api/employees', undefined, { auth_token: 'contractor-token' })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(0)
    })
  })

  describe('POST /api/employees', () => {
    it('should require admin for creating employees on the list endpoint', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(CONTRACTOR_MOCK_USER)
      const { POST } = await import('@/app/api/employees/route')
      const res = await callRoute(
        POST, 'POST', 'http://localhost/api/employees',
        { fullName: 'Новый', position: 'Инж', passportSeries: '4510', passportNumber: '123456' },
        { auth_token: 'contractor-token' }
      )
      expect(res.status).toBe(403)
    })
  })
})

// ============================================================
// Violation Templates Routes
// ============================================================

describe('Violation Templates Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.user.findUnique.mockResolvedValue(ADMIN_MOCK_USER)
  })

  describe('GET /api/violations/templates', () => {
    it('should return 401 without auth', async () => {
      const { GET } = await import('@/app/api/violations/templates/route')
      const res = await callRoute(GET, 'GET', 'http://localhost/api/violations/templates')
      expect(res.status).toBe(401)
    })

    it('should return templates list', async () => {
      mockPrisma.violationTemplate.findMany.mockResolvedValueOnce([
        { id: 'tpl-1', title: 'Шаблон ТБ', defaultSeverity: 'high', department: 'safety' },
      ] as any)

      const { GET } = await import('@/app/api/violations/templates/route')
      const res = await callRoute(GET, 'GET', 'http://localhost/api/violations/templates', undefined, { auth_token: 'valid-token' })
      expect(res.status).toBe(200)
    })
  })

  describe('POST /api/violations/templates', () => {
    it('should allow admin to create template', async () => {
      mockPrisma.violationTemplate.create.mockResolvedValueOnce({
        id: 'tpl-new',
        title: 'Новый шаблон',
        defaultSeverity: 'critical',
        department: 'hr',
      } as any)

      const { POST } = await import('@/app/api/violations/templates/route')
      const res = await callRoute(
        POST, 'POST', 'http://localhost/api/violations/templates',
        { title: 'Новый шаблон', description: 'Описание', defaultSeverity: 'critical', department: 'hr' },
        { auth_token: 'valid-token' }
      )
      expect(res.status).toBe(201)
    })

    it('should reject non-admin from creating template', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(EMPLOYEE_MOCK_USER)
      const { POST } = await import('@/app/api/violations/templates/route')
      const res = await callRoute(
        POST, 'POST', 'http://localhost/api/violations/templates',
        { title: 'Хак', description: 'Хак', defaultSeverity: 'low', department: 'hr' },
        { auth_token: 'employee-token' }
      )
      expect(res.status).toBe(403)
    })
  })
})
