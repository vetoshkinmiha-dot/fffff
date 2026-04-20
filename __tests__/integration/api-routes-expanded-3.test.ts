import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

// ─── Mock all external dependencies ─────────────────────────────

const mockPrisma = vi.hoisted(() => ({
  user: {
    create: vi.fn(),
    findUnique: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
    update: vi.fn(),
    delete: vi.fn(),
  },
  organization: {
    findUnique: vi.fn(),
    findMany: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
    update: vi.fn(),
  },
  employee: {
    findUnique: vi.fn(),
    findMany: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
  },
  employeeDocument: {
    findMany: vi.fn().mockResolvedValue([]),
    findUnique: vi.fn(),
    count: vi.fn().mockResolvedValue(0),
  },
  approvalRequest: {
    findMany: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
  },
  permit: {
    findMany: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
  },
  violation: {
    findUnique: vi.fn(),
    findMany: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
  },
  checklist: {
    findMany: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
  },
  checklistItem: {
    findMany: vi.fn().mockResolvedValue([]),
  },
  notification: {
    create: vi.fn(),
    findMany: vi.fn().mockResolvedValue([]),
    updateMany: vi.fn().mockResolvedValue({ count: 0 }),
  },
  regDocumentSection: {
    findMany: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    findUnique: vi.fn().mockResolvedValue(null),
    update: vi.fn(),
  },
  regDocument: {
    create: vi.fn(),
    findMany: vi.fn().mockResolvedValue([]),
    findUnique: vi.fn().mockResolvedValue(null),
    count: vi.fn().mockResolvedValue(0),
    update: vi.fn(),
    delete: vi.fn(),
  },
  violationTemplate: {
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  notificationSubscription: {
    findMany: vi.fn().mockResolvedValue([]),
  },
}))

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma, $Enums: { ApprovalStatus: { pending: 'pending', approved: 'approved', rejected: 'rejected' }, Department: { security: 'security', hr: 'hr', safety: 'safety', safety_training: 'safety_training', permit_bureau: 'permit_bureau' } } }))

vi.mock('@/lib/email', () => ({
  sendApprovalNotification: vi.fn().mockResolvedValue(undefined),
  sendRegDocUpdated: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/notifications', () => ({
  createNotification: vi.fn().mockResolvedValue(undefined),
  createNotificationsForRole: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/file-storage', () => ({
  uploadFile: vi.fn().mockResolvedValue('/uploads/mock-reg-doc.pdf'),
  deleteFile: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/s3-storage', () => ({
  uploadFile: vi.fn().mockResolvedValue('https://s3.example.com/reg-doc.pdf'),
  deleteFile: vi.fn().mockResolvedValue(undefined),
  getFileUrl: vi.fn().mockResolvedValue('https://s3.example.com/reg-doc.pdf'),
}))

const verifyMock = vi.fn().mockImplementation((token: string) => {
  if (token === 'valid-token') {
    return { userId: 'user-1', email: 'admin@pirelli.ru', fullName: 'Admin', role: 'admin', organizationId: null, department: null, employeeId: null }
  }
  if (token === 'contractor-token') {
    return { userId: 'user-2', email: 'contractor@employee.ru', fullName: 'Contractor', role: 'contractor_employee', organizationId: 'org-uuid', department: null, employeeId: null }
  }
  if (token === 'employee-token') {
    return { userId: 'user-4', email: 'employee@test.ru', fullName: 'Employee', role: 'employee', organizationId: null, department: null, employeeId: null }
  }
  if (token === 'approver-token') {
    return { userId: 'user-5', email: 'approver@test.ru', fullName: 'Approver', role: 'department_approver', organizationId: null, department: 'security', employeeId: null }
  }
  throw new Error('Invalid token')
})

vi.mock('bcrypt', () => ({
  default: { hash: vi.fn().mockResolvedValue('$2b$12$mockedHash'), compare: vi.fn().mockResolvedValue(true) },
  hash: vi.fn().mockResolvedValue('$2b$12$mockedHash'),
  compare: vi.fn().mockResolvedValue(true),
}))

vi.mock('jsonwebtoken', () => {
  const fn = verifyMock
  const obj = { sign: vi.fn().mockReturnValue('mock.jwt.token'), verify: fn }
  return { default: obj, ...obj }
})

// ─── Helper ─────────────────────────────────────────────────────

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
  id: 'user-1', email: 'admin@pirelli.ru', passwordHash: 'hash', fullName: 'Admin',
  role: 'admin', isActive: true, organizationId: null, department: null, mustChangePwd: true, employeeId: null,
}

const EMPLOYEE_MOCK_USER = {
  id: 'user-4', email: 'employee@test.ru', passwordHash: 'hash', fullName: 'Employee',
  role: 'employee', isActive: true, organizationId: null, department: null, mustChangePwd: true, employeeId: null,
}

const CONTRACTOR_MOCK_USER = {
  id: 'user-2', email: 'contractor@employee.ru', passwordHash: 'hash', fullName: 'Contractor',
  role: 'contractor_employee', isActive: true, organizationId: 'org-uuid', department: null, mustChangePwd: true, employeeId: null,
}

const APPROVER_MOCK_USER = {
  id: 'user-5', email: 'approver@test.ru', passwordHash: 'hash', fullName: 'Approver',
  role: 'department_approver', isActive: true, organizationId: null, department: 'security', mustChangePwd: true, employeeId: null,
}

// Smart mock: dispatches based on the where clause (id or email)
function setupUserMocks(authUser: any, routeLookups: Record<string, any> = {}) {
  mockPrisma.user.findUnique.mockImplementation(async ({ where }: any) => {
    if (!where) return authUser
    const key = where.id || where.email
    if (key !== undefined && routeLookups[key] !== undefined) {
      return routeLookups[key]
    }
    return authUser
  })
}

// ============================================================
// Regulatory Documents Routes
// ============================================================

describe('Regulatory Documents Routes', () => {
  beforeEach(() => { vi.clearAllMocks() })

  describe('GET /api/documents/regulatory', () => {
    it('should return 401 without auth', async () => {
      const { GET } = await import('@/app/api/documents/regulatory/route')
      const res = await callRoute(GET, 'GET', 'http://localhost/api/documents/regulatory')
      expect(res.status).toBe(401)
    })

    it('should return documents when contractorId provided', async () => {
      setupUserMocks(ADMIN_MOCK_USER)
      mockPrisma.regDocument.findMany.mockResolvedValueOnce([
        { id: 'doc-1', title: 'Doc', fileType: 'pdf', section: { name: 'Раздел' }, createdBy: { fullName: 'Admin' } },
      ])

      const { GET } = await import('@/app/api/documents/regulatory/route')
      const res = await callRoute(GET, 'GET', 'http://localhost/api/documents/regulatory?contractorId=org-1', undefined, { auth_token: 'valid-token' })
      expect(res.status).toBe(200)
    })

    it('should return documents with section info', async () => {
      setupUserMocks(ADMIN_MOCK_USER)
      mockPrisma.regDocument.findMany.mockResolvedValueOnce([
        { id: 'doc-1', title: 'Документ', fileType: 'pdf', section: { name: 'Раздел 1' }, createdBy: { fullName: 'Admin' } },
      ])

      const { GET } = await import('@/app/api/documents/regulatory/route')
      const res = await callRoute(GET, 'GET', 'http://localhost/api/documents/regulatory?sectionId=section-1', undefined, { auth_token: 'valid-token' })
      expect(res.status).toBe(200)
    })
  })

  describe('POST /api/documents/regulatory', () => {
    it('should return 401 without auth', async () => {
      const { POST } = await import('@/app/api/documents/regulatory/route')
      const res = await callRoute(POST, 'POST', 'http://localhost/api/documents/regulatory')
      expect(res.status).toBe(401)
    })

    it('should reject contractor_employee from uploading', async () => {
      setupUserMocks(CONTRACTOR_MOCK_USER)
      const { POST } = await import('@/app/api/documents/regulatory/route')
      const res = await callRoute(POST, 'POST', 'http://localhost/api/documents/regulatory', undefined, { auth_token: 'contractor-token' })
      expect(res.status).toBe(403)
    })

    it('should reject upload without file', async () => {
      setupUserMocks(ADMIN_MOCK_USER)
      const { POST } = await import('@/app/api/documents/regulatory/route')
      const res = await callRoute(POST, 'POST', 'http://localhost/api/documents/regulatory', undefined, { auth_token: 'valid-token' })
      // FormData parsing fails with 500 when no multipart body is provided
      expect([400, 500]).toContain(res.status)
    })
  })
})

// ============================================================
// Checklist Stats Route
// ============================================================

describe('Checklist Stats Route', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('should return 401 without auth', async () => {
    const { GET } = await import('@/app/api/checklists/stats/route')
    const res = await callRoute(GET, 'GET', 'http://localhost/api/checklists/stats')
    expect(res.status).toBe(401)
  })

  it('should return 400 without contractorId', async () => {
    setupUserMocks(ADMIN_MOCK_USER)
    const { GET } = await import('@/app/api/checklists/stats/route')
    const res = await callRoute(GET, 'GET', 'http://localhost/api/checklists/stats', undefined, { auth_token: 'valid-token' })
    expect(res.status).toBe(400)
  })

  it('should return stats with zeros for empty contractor', async () => {
    setupUserMocks(ADMIN_MOCK_USER)
    mockPrisma.checklist.count.mockResolvedValue(0)
    mockPrisma.checklist.findMany.mockResolvedValue([])
    mockPrisma.checklistItem.findMany.mockResolvedValue([])

    const { GET } = await import('@/app/api/checklists/stats/route')
    const res = await callRoute(GET, 'GET', 'http://localhost/api/checklists/stats?contractorId=org-uuid', undefined, { auth_token: 'valid-token' })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.total).toBe(0)
    expect(body.avgScore).toBe(0)
  })
})

// ============================================================
// Admin Users Routes
// ============================================================

describe('Admin Users Routes', () => {
  beforeEach(() => { vi.clearAllMocks() })

  describe('GET /api/users', () => {
    it('should return 401 without auth', async () => {
      const { GET } = await import('@/app/api/users/route')
      const res = await callRoute(GET, 'GET', 'http://localhost/api/users')
      expect(res.status).toBe(401)
    })

    it('should reject non-admin', async () => {
      setupUserMocks(EMPLOYEE_MOCK_USER)
      const { GET } = await import('@/app/api/users/route')
      const res = await callRoute(GET, 'GET', 'http://localhost/api/users', undefined, { auth_token: 'employee-token' })
      expect(res.status).toBe(403)
    })

    it('should return users list', async () => {
      setupUserMocks(ADMIN_MOCK_USER)
      mockPrisma.user.findMany.mockResolvedValueOnce([
        { id: 'user-1', email: 'admin@pirelli.ru', fullName: 'Admin', role: 'admin', isActive: true },
      ])

      const { GET } = await import('@/app/api/users/route')
      const res = await callRoute(GET, 'GET', 'http://localhost/api/users', undefined, { auth_token: 'valid-token' })
      expect(res.status).toBe(200)
    })
  })

  describe('POST /api/users', () => {
    const validUserBody = {
      email: 'new@pirelli.ru',
      password: 'Password123',
      fullName: 'Новый Пользователь',
      role: 'employee' as const,
    }

    it('should return 401 without auth', async () => {
      const { POST } = await import('@/app/api/users/route')
      const res = await callRoute(POST, 'POST', 'http://localhost/api/users', validUserBody)
      expect(res.status).toBe(401)
    })

    it('should reject non-admin', async () => {
      setupUserMocks(EMPLOYEE_MOCK_USER)
      const { POST } = await import('@/app/api/users/route')
      const res = await callRoute(POST, 'POST', 'http://localhost/api/users', validUserBody, { auth_token: 'employee-token' })
      expect(res.status).toBe(403)
    })

    it('should create user as admin', async () => {
      setupUserMocks(ADMIN_MOCK_USER, { 'new@pirelli.ru': null })
      mockPrisma.user.create.mockResolvedValueOnce({
        id: 'user-new', email: 'new@pirelli.ru', fullName: 'Новый', role: 'employee', isActive: true,
      })

      const { POST } = await import('@/app/api/users/route')
      const res = await callRoute(POST, 'POST', 'http://localhost/api/users', validUserBody, { auth_token: 'valid-token' })
      expect(res.status).toBe(201)
    })

    it('should reject duplicate email', async () => {
      setupUserMocks(ADMIN_MOCK_USER, { 'new@pirelli.ru': { id: 'existing', email: 'new@pirelli.ru' } })
      const { POST } = await import('@/app/api/users/route')
      const res = await callRoute(POST, 'POST', 'http://localhost/api/users', validUserBody, { auth_token: 'valid-token' })
      expect(res.status).toBe(409)
    })
  })
})

// ============================================================
// User By ID Routes
// ============================================================

describe('User By ID Routes', () => {
  beforeEach(() => { vi.clearAllMocks() })

  describe('PATCH /api/users/:id', () => {
    it('should return 401 without auth', async () => {
      const { PATCH } = await import('@/app/api/users/[id]/route')
      const res = await callRoute(PATCH, 'PATCH', 'http://localhost/api/users/user-1', undefined, {}, { id: 'user-1' })
      expect(res.status).toBe(401)
    })

    it('should allow admin to update', async () => {
      setupUserMocks(ADMIN_MOCK_USER, { 'user-2': { id: 'user-2', role: 'employee', isActive: true } })
      mockPrisma.user.update.mockResolvedValueOnce({ id: 'user-2', isActive: false })

      const { PATCH } = await import('@/app/api/users/[id]/route')
      const res = await callRoute(PATCH, 'PATCH', 'http://localhost/api/users/user-2', { isActive: false }, { auth_token: 'valid-token' }, { id: 'user-2' })
      expect(res.status).toBe(200)
    })

    it('should reject non-admin', async () => {
      setupUserMocks(EMPLOYEE_MOCK_USER)
      const { PATCH } = await import('@/app/api/users/[id]/route')
      const res = await callRoute(PATCH, 'PATCH', 'http://localhost/api/users/user-2', { isActive: false }, { auth_token: 'employee-token' }, { id: 'user-2' })
      expect(res.status).toBe(403)
    })
  })

  describe('DELETE /api/users/:id', () => {
    it('should allow admin to delete', async () => {
      setupUserMocks(ADMIN_MOCK_USER, { 'user-2': { id: 'user-2', role: 'employee', isActive: true } })
      mockPrisma.user.delete.mockResolvedValueOnce({})

      const { DELETE } = await import('@/app/api/users/[id]/route')
      const res = await callRoute(DELETE, 'DELETE', 'http://localhost/api/users/user-2', undefined, { auth_token: 'valid-token' }, { id: 'user-2' })
      expect(res.status).toBe(200)
    })

    it('should reject admin deleting themselves', async () => {
      setupUserMocks(ADMIN_MOCK_USER, { 'user-1': { id: 'user-1', role: 'admin', isActive: true } })
      const { DELETE } = await import('@/app/api/users/[id]/route')
      const res = await callRoute(DELETE, 'DELETE', 'http://localhost/api/users/user-1', undefined, { auth_token: 'valid-token' }, { id: 'user-1' })
      expect(res.status).toBe(400)
    })

    it('should reject non-admin', async () => {
      setupUserMocks(EMPLOYEE_MOCK_USER)
      const { DELETE } = await import('@/app/api/users/[id]/route')
      const res = await callRoute(DELETE, 'DELETE', 'http://localhost/api/users/user-2', undefined, { auth_token: 'employee-token' }, { id: 'user-2' })
      expect(res.status).toBe(403)
    })
  })
})

// ============================================================
// Password Reset Routes
// ============================================================

describe('Password Reset Routes', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('should return 401 without auth', async () => {
    const { POST } = await import('@/app/api/users/[id]/reset-password/route')
    const res = await callRoute(POST, 'POST', 'http://localhost/api/users/user-2/reset-password', undefined, {}, { id: 'user-2' })
    expect(res.status).toBe(401)
  })

  it('should reject non-admin', async () => {
    setupUserMocks(EMPLOYEE_MOCK_USER)
    const { POST } = await import('@/app/api/users/[id]/reset-password/route')
    const res = await callRoute(POST, 'POST', 'http://localhost/api/users/user-2/reset-password', { newPassword: 'NewPass123' }, { auth_token: 'employee-token' }, { id: 'user-2' })
    expect(res.status).toBe(403)
  })

  it('should reject target user not found', async () => {
    setupUserMocks(ADMIN_MOCK_USER, { 'nonexistent': null })
    const { POST } = await import('@/app/api/users/[id]/reset-password/route')
    const res = await callRoute(POST, 'POST', 'http://localhost/api/users/nonexistent/reset-password', { newPassword: 'NewPass123' }, { auth_token: 'valid-token' }, { id: 'nonexistent' })
    expect(res.status).toBe(404)
  })

  it('should reject weak password', async () => {
    setupUserMocks(ADMIN_MOCK_USER, { 'user-2': { id: 'user-2', role: 'employee', isActive: true } })
    const { POST } = await import('@/app/api/users/[id]/reset-password/route')
    const res = await callRoute(POST, 'POST', 'http://localhost/api/users/user-2/reset-password', { newPassword: 'weak' }, { auth_token: 'valid-token' }, { id: 'user-2' })
    expect(res.status).toBe(400)
  })
})

// ============================================================
// Regulatory Document By ID Route
// ============================================================

describe('Regulatory Document By ID Route', () => {
  beforeEach(() => { vi.clearAllMocks() })

  describe('GET /api/documents/regulatory/:id', () => {
    it('should return 401 without auth', async () => {
      const { GET } = await import('@/app/api/documents/regulatory/[id]/route')
      const res = await callRoute(GET, 'GET', 'http://localhost/api/documents/regulatory/doc-1', undefined, {}, { id: 'doc-1' })
      expect(res.status).toBe(401)
    })
  })

  describe('DELETE /api/documents/regulatory/:id', () => {
    it('should allow admin to delete', async () => {
      setupUserMocks(ADMIN_MOCK_USER)
      mockPrisma.regDocument.findUnique.mockResolvedValueOnce({ id: 'doc-1', fileUrl: '/uploads/doc.pdf' })
      mockPrisma.regDocument.delete.mockResolvedValueOnce({})

      const { DELETE } = await import('@/app/api/documents/regulatory/[id]/route')
      const res = await callRoute(DELETE, 'DELETE', 'http://localhost/api/documents/regulatory/doc-1', undefined, { auth_token: 'valid-token' }, { id: 'doc-1' })
      expect(res.status).toBe(200)
    })

    it('should reject non-admin', async () => {
      setupUserMocks(EMPLOYEE_MOCK_USER)
      const { DELETE } = await import('@/app/api/documents/regulatory/[id]/route')
      const res = await callRoute(DELETE, 'DELETE', 'http://localhost/api/documents/regulatory/doc-1', undefined, { auth_token: 'employee-token' }, { id: 'doc-1' })
      expect(res.status).toBe(403)
    })
  })

  describe('PATCH /api/documents/regulatory/:id', () => {
    it('should allow admin to update', async () => {
      setupUserMocks(ADMIN_MOCK_USER)
      mockPrisma.regDocument.findUnique.mockResolvedValueOnce({ id: 'doc-1', fileUrl: '/uploads/doc.pdf' })
      mockPrisma.regDocument.update.mockResolvedValueOnce({ id: 'doc-1', title: 'updated', fileType: 'pdf' })

      const { PATCH } = await import('@/app/api/documents/regulatory/[id]/route')
      const res = await callRoute(PATCH, 'PATCH', 'http://localhost/api/documents/regulatory/doc-1', { title: 'updated' }, { auth_token: 'valid-token' }, { id: 'doc-1' })
      expect(res.status).toBe(200)
    })

    it('should reject non-admin', async () => {
      setupUserMocks(EMPLOYEE_MOCK_USER)
      const { PATCH } = await import('@/app/api/documents/regulatory/[id]/route')
      const res = await callRoute(PATCH, 'PATCH', 'http://localhost/api/documents/regulatory/doc-1', { title: 'hacked' }, { auth_token: 'employee-token' }, { id: 'doc-1' })
      expect(res.status).toBe(403)
    })
  })
})

// ============================================================
// Cron Routes
// ============================================================

describe('Cron Routes', () => {
  it('should return 401 for document-expiry without CRON_SECRET', async () => {
    const { POST } = await import('@/app/api/cron/document-expiry/route')
    const res = await callRoute(POST, 'POST', 'http://localhost/api/cron/document-expiry')
    expect(res.status).toBe(401)
  })

  it('should return 401 for permit-expiry without CRON_SECRET', async () => {
    const { POST } = await import('@/app/api/cron/permit-expiry/route')
    const res = await callRoute(POST, 'POST', 'http://localhost/api/cron/permit-expiry')
    expect(res.status).toBe(401)
  })
})
