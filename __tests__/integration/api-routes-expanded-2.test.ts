import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

// Shared UUID for test orgs
const ORG_UUID = '550e8400-e29b-41d4-a716-446655440000'

// ─── Mock all external dependencies ─────────────────────────────

const mockPrisma = vi.hoisted(() => ({
  user: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
    update: vi.fn(),
  },
  organization: {
    findUnique: vi.fn(),
    findMany: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
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
    aggregate: vi.fn(),
  },
  violation: {
    findUnique: vi.fn(),
    findMany: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
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
    updateMany: vi.fn().mockResolvedValue({ count: 0 }),
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
  $transaction: vi.fn().mockImplementation(async (cb) => cb(mockPrisma)),
}))

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma, $Enums: { ApprovalStatus: { pending: 'pending', approved: 'approved', rejected: 'rejected' }, Department: { security: 'security', hr: 'hr', safety: 'safety', safety_training: 'safety_training', permit_bureau: 'permit_bureau' } } }))

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

vi.mock('@/lib/s3-storage', () => ({
  uploadFile: vi.fn().mockResolvedValue('https://s3.example.com/mock.jpg'),
  deleteFile: vi.fn().mockResolvedValue(undefined),
  getFileUrl: vi.fn().mockResolvedValue('https://s3.example.com/mock.jpg'),
}))

const verifyMock = vi.fn().mockImplementation((token: string) => {
  if (token === 'valid-token') {
    return { userId: 'user-1', email: 'admin@pirelli.ru', fullName: 'Admin', role: 'admin', organizationId: null, department: null, employeeId: null }
  }
  if (token === 'contractor-token') {
    return { userId: 'user-2', email: 'contractor@employee.ru', fullName: 'Contractor', role: 'contractor_employee', organizationId: ORG_UUID, department: null, employeeId: null }
  }
  if (token === 'employee-token') {
    return { userId: 'user-4', email: 'employee@test.ru', fullName: 'Employee', role: 'employee', organizationId: null, department: null, employeeId: null }
  }
  if (token === 'approver-token') {
    return { userId: 'user-5', email: 'approver@test.ru', fullName: 'Approver', role: 'department_approver', organizationId: null, department: 'security', employeeId: null }
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
  employeeId: null,
} as any

const CONTRACTOR_MOCK_USER = {
  id: 'user-2',
  email: 'contractor@employee.ru',
  passwordHash: 'hash',
  fullName: 'Contractor',
  role: 'contractor_employee',
  isActive: true,
  organizationId: ORG_UUID,
  department: null,
  mustChangePwd: true,
  employeeId: null,
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
  employeeId: null,
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
  employeeId: null,
} as any

// ============================================================
// Checklists API Routes
// ============================================================

describe('Checklists API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.user.findUnique.mockResolvedValue(ADMIN_MOCK_USER)
  })

  describe('GET /api/checklists', () => {
    it('should return 401 without auth', async () => {
      const { GET } = await import('@/app/api/checklists/route')
      const res = await callRoute(GET, 'GET', 'http://localhost/api/checklists')
      expect(res.status).toBe(401)
    })

    it('should return paginated checklists', async () => {
      mockPrisma.checklist.count.mockResolvedValueOnce(1)
      mockPrisma.checklist.findMany.mockResolvedValueOnce([
        { id: 'cl-1', inspectorName: 'Иванов', date: new Date(), contractorId: '550e8400-e29b-41d4-a716-446655440000', score: 100, status: 'passed' },
      ] as any)

      const { GET } = await import('@/app/api/checklists/route')
      const res = await callRoute(GET, 'GET', 'http://localhost/api/checklists', undefined, { auth_token: 'valid-token' })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.pagination.total).toBe(1)
    })

    it('should filter by contractorId and status', async () => {
      mockPrisma.checklist.count.mockResolvedValueOnce(1)
      mockPrisma.checklist.findMany.mockResolvedValueOnce([])

      const { GET } = await import('@/app/api/checklists/route')
      const res = await callRoute(
        GET, 'GET', 'http://localhost/api/checklists?contractorId=550e8400-e29b-41d4-a716-446655440000&status=passed',
        undefined, { auth_token: 'valid-token' }
      )
      expect(res.status).toBe(200)
    })

    it('should scope checklists to contractor org', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(CONTRACTOR_MOCK_USER)
      mockPrisma.checklist.count.mockResolvedValueOnce(0)
      mockPrisma.checklist.findMany.mockResolvedValueOnce([])

      const { GET } = await import('@/app/api/checklists/route')
      const res = await callRoute(GET, 'GET', 'http://localhost/api/checklists', undefined, { auth_token: 'contractor-token' })
      expect(res.status).toBe(200)
    })
  })

  describe('POST /api/checklists', () => {
    const validChecklistBody = {
      contractorId: ORG_UUID,
      inspectorName: 'Иванов И.И.',
      date: '2024-03-01T10:00:00Z',
      comments: 'Всё в порядке',
      items: [
        { question: 'СИЗ надеты?', answer: 'pass', comment: '' },
        { question: 'Допуск оформлен?', answer: 'pass' },
      ],
    }

    it('should return 401 without auth', async () => {
      const { POST } = await import('@/app/api/checklists/route')
      const res = await callRoute(POST, 'POST', 'http://localhost/api/checklists', validChecklistBody)
      expect(res.status).toBe(401)
    })

    it('should allow admin to create checklist', async () => {
      mockPrisma.checklist.create.mockResolvedValueOnce({
        id: 'cl-1',
        inspectorName: 'Иванов И.И.',
        score: 100,
        status: 'passed',
        contractorId: '550e8400-e29b-41d4-a716-446655440000',
      } as any)

      const { POST } = await import('@/app/api/checklists/route')
      const res = await callRoute(POST, 'POST', 'http://localhost/api/checklists', validChecklistBody, { auth_token: 'valid-token' })
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.status).toBe('passed')
    })

    it('should reject non-admin from creating checklist', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(EMPLOYEE_MOCK_USER)
      const { POST } = await import('@/app/api/checklists/route')
      const res = await callRoute(POST, 'POST', 'http://localhost/api/checklists', validChecklistBody, { auth_token: 'employee-token' })
      expect(res.status).toBe(403)
    })

    it('should reject invalid checklist body', async () => {
      const { POST } = await import('@/app/api/checklists/route')
      const res = await callRoute(POST, 'POST', 'http://localhost/api/checklists', { inspectorName: 'X' }, { auth_token: 'valid-token' })
      expect(res.status).toBe(400)
    })
  })
})

// ============================================================
// Notifications Routes
// ============================================================

describe('Notifications Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.user.findUnique.mockResolvedValue(ADMIN_MOCK_USER)
  })

  describe('GET /api/notifications/me', () => {
    it('should return 401 without auth', async () => {
      const { GET } = await import('@/app/api/notifications/me/route')
      const res = await callRoute(GET, 'GET', 'http://localhost/api/notifications/me')
      expect(res.status).toBe(401)
    })

    it('should return notifications for approver with pending approvals', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(APPROVER_MOCK_USER)
      mockPrisma.approvalRequest.findMany.mockResolvedValueOnce([
        {
          id: 'appr-1',
          department: 'security',
          status: 'pending',
          deadline: new Date('2024-03-01'),
          createdAt: new Date(),
          employee: { fullName: 'Петров П.П.', id: 'emp-1' },
        },
      ] as any)

      const { GET } = await import('@/app/api/notifications/me/route')
      const res = await callRoute(GET, 'GET', 'http://localhost/api/notifications/me', undefined, { auth_token: 'approver-token' })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body).toHaveLength(1)
      expect(body[0].type).toBe('approval_pending')
    })

    it('should return notifications for contractor with expiring docs', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(CONTRACTOR_MOCK_USER)
      mockPrisma.employeeDocument.findMany.mockResolvedValueOnce([
        {
          id: 'doc-1',
          name: 'Удостоверение',
          status: 'expiring',
          expiryDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
          createdAt: new Date(),
          employee: { fullName: 'Петров П.П.', id: 'emp-1' },
        },
      ] as any)

      const { GET } = await import('@/app/api/notifications/me/route')
      const res = await callRoute(GET, 'GET', 'http://localhost/api/notifications/me', undefined, { auth_token: 'contractor-token' })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body).toHaveLength(1)
      expect(body[0].type).toBe('document_expiring')
    })

    it('should return empty list for admin without department', async () => {
      const { GET } = await import('@/app/api/notifications/me/route')
      const res = await callRoute(GET, 'GET', 'http://localhost/api/notifications/me', undefined, { auth_token: 'valid-token' })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body).toEqual([])
    })
  })

  describe('PATCH /api/notifications/read-all', () => {
    it('should return 401 without auth', async () => {
      const { PATCH } = await import('@/app/api/notifications/read-all/route')
      const res = await callRoute(PATCH, 'PATCH', 'http://localhost/api/notifications/read-all')
      expect(res.status).toBe(401)
    })

    it('should mark all notifications as read', async () => {
      mockPrisma.notification.updateMany.mockResolvedValueOnce({ count: 5 })

      const { PATCH } = await import('@/app/api/notifications/read-all/route')
      const res = await callRoute(PATCH, 'PATCH', 'http://localhost/api/notifications/read-all', undefined, { auth_token: 'valid-token' })
      expect(res.status).toBe(200)
    })

    it('should return success even when no unread notifications', async () => {
      mockPrisma.notification.updateMany.mockResolvedValueOnce({ count: 0 })

      const { PATCH } = await import('@/app/api/notifications/read-all/route')
      const res = await callRoute(PATCH, 'PATCH', 'http://localhost/api/notifications/read-all', undefined, { auth_token: 'valid-token' })
      expect(res.status).toBe(200)
    })
  })
})

// ============================================================
// Employee Photo Routes
// ============================================================

describe('Employee Photo Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.user.findUnique.mockResolvedValue(ADMIN_MOCK_USER)
  })

  describe('GET /api/employees/:id/photo', () => {
    it('should return 401 without auth', async () => {
      const { GET } = await import('@/app/api/employees/[id]/photo/route')
      const res = await callRoute(GET, 'GET', 'http://localhost/api/employees/emp-1/photo', undefined, {}, { id: 'emp-1' })
      expect(res.status).toBe(401)
    })

    it('should return 404 for employee without photo', async () => {
      mockPrisma.employee.findUnique.mockResolvedValueOnce({ id: 'emp-1', photoUrl: null, organizationId: '550e8400-e29b-41d4-a716-446655440000' } as any)
      const { GET } = await import('@/app/api/employees/[id]/photo/route')
      const res = await callRoute(GET, 'GET', 'http://localhost/api/employees/emp-1/photo', undefined, { auth_token: 'valid-token' }, { id: 'emp-1' })
      expect(res.status).toBe(404)
    })

    it('should redirect to photo URL', async () => {
      mockPrisma.employee.findUnique.mockResolvedValueOnce({ id: 'emp-1', photoUrl: 'https://s3.example.com/photo.jpg', organizationId: '550e8400-e29b-41d4-a716-446655440000' } as any)
      const { GET } = await import('@/app/api/employees/[id]/photo/route')
      const res = await callRoute(GET, 'GET', 'http://localhost/api/employees/emp-1/photo', undefined, { auth_token: 'valid-token' }, { id: 'emp-1' })
      expect(res.status).toBe(307) // NextResponse.redirect returns 307
    })

    it('should reject contractor viewing other org employee photo', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(CONTRACTOR_MOCK_USER)
      mockPrisma.employee.findUnique.mockResolvedValueOnce({ id: 'emp-1', photoUrl: 'https://s3.example.com/photo.jpg', organizationId: '550e8400-e29b-41d4-a716-446655440001' } as any)
      const { GET } = await import('@/app/api/employees/[id]/photo/route')
      const res = await callRoute(GET, 'GET', 'http://localhost/api/employees/emp-1/photo', undefined, { auth_token: 'contractor-token' }, { id: 'emp-1' })
      expect(res.status).toBe(403)
    })

    it('should reject employee role from viewing photo', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(EMPLOYEE_MOCK_USER)
      mockPrisma.employee.findUnique.mockResolvedValueOnce({ id: 'emp-1', photoUrl: 'https://s3.example.com/photo.jpg', organizationId: '550e8400-e29b-41d4-a716-446655440000' } as any)
      const { GET } = await import('@/app/api/employees/[id]/photo/route')
      const res = await callRoute(GET, 'GET', 'http://localhost/api/employees/emp-1/photo', undefined, { auth_token: 'employee-token' }, { id: 'emp-1' })
      expect(res.status).toBe(403)
    })
  })

  describe('POST /api/employees/:id/photo', () => {
    it('should reject non-admin/non-contractor from uploading', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(EMPLOYEE_MOCK_USER)
      mockPrisma.employee.findUnique.mockResolvedValueOnce({ id: 'emp-1', organizationId: '550e8400-e29b-41d4-a716-446655440000', photoUrl: null } as any)
      const { POST } = await import('@/app/api/employees/[id]/photo/route')
      const res = await callRoute(POST, 'POST', 'http://localhost/api/employees/emp-1/photo', undefined, { auth_token: 'employee-token' }, { id: 'emp-1' })
      expect(res.status).toBe(403)
    })
  })
})

// ============================================================
// Employee Document Delete Route
// ============================================================

describe('Employee Document Delete Route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.user.findUnique.mockResolvedValue(ADMIN_MOCK_USER)
  })

  it('should return 401 without auth', async () => {
    const { DELETE } = await import('@/app/api/employees/[id]/documents/[docId]/route')
    const res = await callRoute(DELETE, 'DELETE', 'http://localhost/api/employees/emp-1/documents/doc-1', undefined, {}, { id: 'emp-1', docId: 'doc-1' })
    expect(res.status).toBe(401)
  })

  it('should allow admin to delete document', async () => {
    mockPrisma.employeeDocument.findUnique.mockResolvedValueOnce({
      id: 'doc-1',
      employeeId: 'emp-1',
      fileUrl: '/uploads/file.pdf',
      employee: { organizationId: '550e8400-e29b-41d4-a716-446655440000' },
    } as any)
    mockPrisma.employeeDocument.delete.mockResolvedValueOnce({})

    const { DELETE } = await import('@/app/api/employees/[id]/documents/[docId]/route')
    const res = await callRoute(DELETE, 'DELETE', 'http://localhost/api/employees/emp-1/documents/doc-1', undefined, { auth_token: 'valid-token' }, { id: 'emp-1', docId: 'doc-1' })
    expect(res.status).toBe(200)
  })

  it('should return 404 for mismatched docId and employee', async () => {
    mockPrisma.employeeDocument.findUnique.mockResolvedValueOnce({
      id: 'doc-1',
      employeeId: 'emp-2',
      fileUrl: null,
      employee: { organizationId: '550e8400-e29b-41d4-a716-446655440000' },
    } as any)

    const { DELETE } = await import('@/app/api/employees/[id]/documents/[docId]/route')
    const res = await callRoute(DELETE, 'DELETE', 'http://localhost/api/employees/emp-1/documents/doc-1', undefined, { auth_token: 'valid-token' }, { id: 'emp-1', docId: 'doc-1' })
    expect(res.status).toBe(404)
  })

  it('should reject contractor deleting other org document', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(CONTRACTOR_MOCK_USER)
    mockPrisma.employeeDocument.findUnique.mockResolvedValueOnce({
      id: 'doc-1',
      employeeId: 'emp-1',
      fileUrl: '/uploads/file.pdf',
      employee: { organizationId: '550e8400-e29b-41d4-a716-446655440001' },
    } as any)

    const { DELETE } = await import('@/app/api/employees/[id]/documents/[docId]/route')
    const res = await callRoute(DELETE, 'DELETE', 'http://localhost/api/employees/emp-1/documents/doc-1', undefined, { auth_token: 'contractor-token' }, { id: 'emp-1', docId: 'doc-1' })
    expect(res.status).toBe(403)
  })

  it('should reject employee role from deleting', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(EMPLOYEE_MOCK_USER)
    mockPrisma.employeeDocument.findUnique.mockResolvedValueOnce({
      id: 'doc-1',
      employeeId: 'emp-1',
      fileUrl: null,
      employee: { organizationId: '550e8400-e29b-41d4-a716-446655440000' },
    } as any)

    const { DELETE } = await import('@/app/api/employees/[id]/documents/[docId]/route')
    const res = await callRoute(DELETE, 'DELETE', 'http://localhost/api/employees/emp-1/documents/doc-1', undefined, { auth_token: 'employee-token' }, { id: 'emp-1', docId: 'doc-1' })
    expect(res.status).toBe(403)
  })
})

// ============================================================
// Employee Approvals Routes
// ============================================================

describe('Employee Approvals Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.user.findUnique.mockResolvedValue(ADMIN_MOCK_USER)
  })

  describe('GET /api/employees/:id/approvals', () => {
    it('should return 401 without auth', async () => {
      const { GET } = await import('@/app/api/employees/[id]/approvals/route')
      const res = await callRoute(GET, 'GET', 'http://localhost/api/employees/emp-1/approvals', undefined, {}, { id: 'emp-1' })
      expect(res.status).toBe(401)
    })

    it('should return approvals list', async () => {
      mockPrisma.employee.findUnique.mockResolvedValueOnce({ id: 'emp-1', organizationId: '550e8400-e29b-41d4-a716-446655440000' } as any)
      mockPrisma.approvalRequest.findMany.mockResolvedValueOnce([
        { id: 'appr-1', department: 'security', status: 'pending', deadline: new Date('2024-03-01') },
      ] as any)

      const { GET } = await import('@/app/api/employees/[id]/approvals/route')
      const res = await callRoute(GET, 'GET', 'http://localhost/api/employees/emp-1/approvals', undefined, { auth_token: 'valid-token' }, { id: 'emp-1' })
      expect(res.status).toBe(200)
    })

    it('should reject contractor viewing other org approvals', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(CONTRACTOR_MOCK_USER)
      mockPrisma.employee.findUnique.mockResolvedValueOnce({ id: 'emp-1', organizationId: '550e8400-e29b-41d4-a716-446655440001' } as any)

      const { GET } = await import('@/app/api/employees/[id]/approvals/route')
      const res = await callRoute(GET, 'GET', 'http://localhost/api/employees/emp-1/approvals', undefined, { auth_token: 'contractor-token' }, { id: 'emp-1' })
      expect(res.status).toBe(403)
    })
  })

  describe('POST /api/employees/:id/approvals', () => {
    const validApprovalBody = {
      departments: ['security', 'hr'],
      deadline: '2024-04-01T10:00:00Z',
    }

    it('should allow admin to create approvals', async () => {
      mockPrisma.employee.findUnique.mockResolvedValueOnce({
        id: 'emp-1',
        organizationId: '550e8400-e29b-41d4-a716-446655440000',
        organization: { name: 'ООО Тест' },
      } as any)
      mockPrisma.approvalRequest.findMany.mockResolvedValueOnce([])
      mockPrisma.approvalRequest.createManyAndReturn.mockResolvedValueOnce([
        { id: 'appr-1', department: 'security', status: 'pending' },
        { id: 'appr-2', department: 'hr', status: 'pending' },
      ] as any)
      mockPrisma.user.findMany.mockResolvedValueOnce([])

      const { POST } = await import('@/app/api/employees/[id]/approvals/route')
      const res = await callRoute(POST, 'POST', 'http://localhost/api/employees/emp-1/approvals', validApprovalBody, { auth_token: 'valid-token' }, { id: 'emp-1' })
      expect(res.status).toBe(201)
    })

    it('should allow contractor_employee to create approvals for own org', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(CONTRACTOR_MOCK_USER)
      mockPrisma.employee.findUnique.mockResolvedValueOnce({
        id: 'emp-1',
        organizationId: '550e8400-e29b-41d4-a716-446655440000',
        organization: { name: 'ООО Тест' },
      } as any)
      mockPrisma.approvalRequest.findMany.mockResolvedValueOnce([])
      mockPrisma.approvalRequest.createManyAndReturn.mockResolvedValueOnce([
        { id: 'appr-1', department: 'security', status: 'pending' },
      ] as any)
      mockPrisma.user.findMany.mockResolvedValueOnce([])

      const { POST } = await import('@/app/api/employees/[id]/approvals/route')
      const res = await callRoute(POST, 'POST', 'http://localhost/api/employees/emp-1/approvals', validApprovalBody, { auth_token: 'contractor-token' }, { id: 'emp-1' })
      expect(res.status).toBe(201)
    })

    it('should reject contractor_employee creating for other org', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(CONTRACTOR_MOCK_USER)
      mockPrisma.employee.findUnique.mockResolvedValueOnce({
        id: 'emp-1',
        organizationId: '550e8400-e29b-41d4-a716-446655440001',
        organization: { name: 'Other Org' },
      } as any)

      const { POST } = await import('@/app/api/employees/[id]/approvals/route')
      const res = await callRoute(POST, 'POST', 'http://localhost/api/employees/emp-1/approvals', validApprovalBody, { auth_token: 'contractor-token' }, { id: 'emp-1' })
      expect(res.status).toBe(403)
    })

    it('should reject employee role from creating approvals', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(EMPLOYEE_MOCK_USER)
      mockPrisma.employee.findUnique.mockResolvedValueOnce({ id: 'emp-1', organizationId: '550e8400-e29b-41d4-a716-446655440000' } as any)

      const { POST } = await import('@/app/api/employees/[id]/approvals/route')
      const res = await callRoute(POST, 'POST', 'http://localhost/api/employees/emp-1/approvals', validApprovalBody, { auth_token: 'employee-token' }, { id: 'emp-1' })
      expect(res.status).toBe(403)
    })

    it('should reject invalid body', async () => {
      mockPrisma.employee.findUnique.mockResolvedValueOnce({ id: 'emp-1', organizationId: '550e8400-e29b-41d4-a716-446655440000' } as any)

      const { POST } = await import('@/app/api/employees/[id]/approvals/route')
      const res = await callRoute(POST, 'POST', 'http://localhost/api/employees/emp-1/approvals', { departments: [] }, { auth_token: 'valid-token' }, { id: 'emp-1' })
      expect(res.status).toBe(400)
    })

    it('should reject duplicate approvals', async () => {
      mockPrisma.employee.findUnique.mockResolvedValueOnce({ id: 'emp-1', organizationId: '550e8400-e29b-41d4-a716-446655440000' } as any)
      mockPrisma.approvalRequest.findMany.mockResolvedValueOnce([
        { department: 'security' },
        { department: 'hr' },
      ] as any)

      const { POST } = await import('@/app/api/employees/[id]/approvals/route')
      const res = await callRoute(POST, 'POST', 'http://localhost/api/employees/emp-1/approvals', validApprovalBody, { auth_token: 'valid-token' }, { id: 'emp-1' })
      expect(res.status).toBe(400)
    })

    it('should reject employee not found', async () => {
      mockPrisma.employee.findUnique.mockResolvedValueOnce(null)

      const { POST } = await import('@/app/api/employees/[id]/approvals/route')
      const res = await callRoute(POST, 'POST', 'http://localhost/api/employees/emp-1/approvals', validApprovalBody, { auth_token: 'valid-token' }, { id: 'emp-1' })
      expect(res.status).toBe(404)
    })
  })
})

// ============================================================
// Violation Template By ID Route
// ============================================================

describe('Violation Template By ID Route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.user.findUnique.mockResolvedValue(ADMIN_MOCK_USER)
  })

  describe('GET /api/violations/templates/:id', () => {
    it('should return 401 without auth', async () => {
      const { GET } = await import('@/app/api/violations/templates/[id]/route')
      const res = await callRoute(GET, 'GET', 'http://localhost/api/violations/templates/tpl-1', undefined, {}, { id: 'tpl-1' })
      expect(res.status).toBe(401)
    })

    it('should return template', async () => {
      mockPrisma.violationTemplate.findUnique.mockResolvedValueOnce({
        id: 'tpl-1',
        title: 'Шаблон ТБ',
        defaultSeverity: 'high',
        department: 'safety',
      } as any)

      const { GET } = await import('@/app/api/violations/templates/[id]/route')
      const res = await callRoute(GET, 'GET', 'http://localhost/api/violations/templates/tpl-1', undefined, { auth_token: 'valid-token' }, { id: 'tpl-1' })
      expect(res.status).toBe(200)
    })
  })

  describe('PATCH /api/violations/templates/:id', () => {
    it('should allow admin to update template', async () => {
      mockPrisma.violationTemplate.findUnique.mockResolvedValueOnce({ id: 'tpl-1', title: 'old' } as any)
      mockPrisma.violationTemplate.update.mockResolvedValueOnce({ id: 'tpl-1', title: 'updated', defaultSeverity: 'high', department: 'safety', description: 'desc' } as any)

      const { PATCH } = await import('@/app/api/violations/templates/[id]/route')
      const res = await callRoute(
        PATCH, 'PATCH', 'http://localhost/api/violations/templates/tpl-1',
        { title: 'updated', description: 'desc', defaultSeverity: 'high', department: 'safety' },
        { auth_token: 'valid-token' }, { id: 'tpl-1' }
      )
      expect(res.status).toBe(200)
    })

    it('should reject non-admin from updating', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(EMPLOYEE_MOCK_USER)
      const { PATCH } = await import('@/app/api/violations/templates/[id]/route')
      const res = await callRoute(
        PATCH, 'PATCH', 'http://localhost/api/violations/templates/tpl-1',
        { title: 'hacked', description: 'desc', defaultSeverity: 'low', department: 'hr' },
        { auth_token: 'employee-token' }, { id: 'tpl-1' }
      )
      expect(res.status).toBe(403)
    })
  })

  describe('DELETE /api/violations/templates/:id', () => {
    it('should allow admin to delete template', async () => {
      mockPrisma.violationTemplate.findUnique.mockResolvedValueOnce({ id: 'tpl-1' } as any)
      mockPrisma.violationTemplate.delete.mockResolvedValueOnce({})

      const { DELETE } = await import('@/app/api/violations/templates/[id]/route')
      const res = await callRoute(DELETE, 'DELETE', 'http://localhost/api/violations/templates/tpl-1', undefined, { auth_token: 'valid-token' }, { id: 'tpl-1' })
      expect(res.status).toBe(200)
    })

    it('should reject non-admin from deleting', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(EMPLOYEE_MOCK_USER)
      const { DELETE } = await import('@/app/api/violations/templates/[id]/route')
      const res = await callRoute(DELETE, 'DELETE', 'http://localhost/api/violations/templates/tpl-1', undefined, { auth_token: 'employee-token' }, { id: 'tpl-1' })
      expect(res.status).toBe(403)
    })
  })
})
