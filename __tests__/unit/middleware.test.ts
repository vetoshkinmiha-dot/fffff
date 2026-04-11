import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

vi.mock('../../lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock('../../lib/auth', () => ({
  verifyAccessToken: vi.fn(),
}))

import { prisma } from '../../lib/prisma'
import { verifyAccessToken } from '../../lib/auth'
import {
  authMiddleware,
  requireRole,
  requireAdmin,
  requireContractorEmployee,
  type AuthenticatedUser,
} from '../../lib/api-middleware'

const mockVerify = vi.mocked(verifyAccessToken)
const mockFindUnique = vi.mocked(prisma.user.findUnique)

function makeNextRequest(cookies: Record<string, string>): NextRequest {
  const cookieHeader = Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ')
  return new NextRequest('http://localhost/api/test', {
    headers: { cookie: cookieHeader },
  })
}

describe('Auth Middleware', () => {
  const validPayload = {
    userId: 'user-1',
    email: 'test@example.com',
    role: 'employee',
    organizationId: null,
    department: null,
  }

  const activeUser = {
    id: 'user-1',
    email: 'test@example.com',
    role: 'employee',
    organizationId: null,
    department: null,
    isActive: true,
  }

  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('should return 401 when no auth_token cookie', async () => {
    const req = makeNextRequest({})
    const result = await authMiddleware(req)
    expect(result).toBeInstanceOf(NextResponse)
    if (result instanceof NextResponse) {
      expect(result.status).toBe(401)
    }
  })

  it('should return 401 when token is invalid', async () => {
    mockVerify.mockReturnValue(null)
    const req = makeNextRequest({ auth_token: 'bad-token' })
    const result = await authMiddleware(req)
    expect(result).toBeInstanceOf(NextResponse)
    if (result instanceof NextResponse) {
      expect(result.status).toBe(401)
    }
  })

  it('should return 401 when user does not exist', async () => {
    mockVerify.mockReturnValue(validPayload)
    mockFindUnique.mockResolvedValue(null)
    const req = makeNextRequest({ auth_token: 'good-token' })
    const result = await authMiddleware(req)
    expect(result).toBeInstanceOf(NextResponse)
    if (result instanceof NextResponse) {
      expect(result.status).toBe(401)
    }
  })

  it('should return 401 when user is inactive', async () => {
    mockVerify.mockReturnValue(validPayload)
    mockFindUnique.mockResolvedValue({ ...activeUser, isActive: false })
    const req = makeNextRequest({ auth_token: 'good-token' })
    const result = await authMiddleware(req)
    expect(result).toBeInstanceOf(NextResponse)
    if (result instanceof NextResponse) {
      expect(result.status).toBe(401)
    }
  })

  it('should return authenticated user when token is valid and user is active', async () => {
    mockVerify.mockReturnValue(validPayload)
    mockFindUnique.mockResolvedValue(activeUser)
    const req = makeNextRequest({ auth_token: 'good-token' })
    const result = await authMiddleware(req)
    expect(result).not.toBeInstanceOf(NextResponse)
    if (!(result instanceof NextResponse)) {
      expect(result.user.userId).toBe('user-1')
      expect(result.user.email).toBe('test@example.com')
      expect(result.user.role).toBe('employee')
    }
  })
})

describe('Role Guards', () => {
  const adminUser: AuthenticatedUser = {
    userId: '1',
    email: 'admin@test.com',
    role: 'admin',
    organizationId: null,
    department: null,
  }

  const employeeUser: AuthenticatedUser = {
    userId: '2',
    email: 'employee@test.com',
    role: 'employee',
    organizationId: null,
    department: null,
  }

  const contractorEmployeeUser: AuthenticatedUser = {
    userId: '3',
    email: 'contractor@test.com',
    role: 'contractor_employee',
    organizationId: 'org-123',
    department: null,
  }

  const approverUser: AuthenticatedUser = {
    userId: '4',
    email: 'approver@test.com',
    role: 'department_approver',
    organizationId: null,
    department: 'safety',
  }

  describe('requireRole', () => {
    it('should allow admin when admin role is required', () => {
      expect(requireRole(adminUser, ['admin'])).toBe(true)
    })

    it('should reject contractor when admin role is required', () => {
      const result = requireRole(contractorEmployeeUser, ['admin'])
      expect(result).toBeInstanceOf(NextResponse)
      if (result instanceof NextResponse) {
        expect(result.status).toBe(403)
      }
    })

    it('should allow when user role is in allowed list', () => {
      expect(requireRole(employeeUser, ['admin', 'employee'])).toBe(true)
    })

    it('should reject when user role is not in allowed list', () => {
      const result = requireRole(approverUser, ['admin'])
      expect(result).toBeInstanceOf(NextResponse)
    })
  })

  describe('requireAdmin', () => {
    it('should allow admin', () => {
      expect(requireAdmin(adminUser)).toBe(true)
    })

    it('should reject employee', () => {
      const result = requireAdmin(employeeUser)
      expect(result).toBeInstanceOf(NextResponse)
      if (result instanceof NextResponse) {
        expect(result.status).toBe(403)
      }
    })

    it('should reject contractor_employee', () => {
      const result = requireAdmin(contractorEmployeeUser)
      expect(result).toBeInstanceOf(NextResponse)
      if (result instanceof NextResponse) {
        expect(result.status).toBe(403)
      }
    })

    it('should reject department_approver', () => {
      const result = requireAdmin(approverUser)
      expect(result).toBeInstanceOf(NextResponse)
    })
  })

  describe('requireContractorEmployee', () => {
    it('should allow contractor_employee', () => {
      expect(requireContractorEmployee(contractorEmployeeUser)).toBe(true)
    })

    it('should reject employee', () => {
      const result = requireContractorEmployee(employeeUser)
      expect(result).toBeInstanceOf(NextResponse)
    })

    it('should reject admin (not a contractor employee role)', () => {
      const result = requireContractorEmployee(adminUser)
      expect(result).toBeInstanceOf(NextResponse)
    })
  })
})
