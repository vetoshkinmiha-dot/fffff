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
  requireFactoryRole,
  requireContractorRole,
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
    role: 'factory_hse',
    organizationId: null,
    department: null,
  }

  const activeUser = {
    id: 'user-1',
    email: 'test@example.com',
    role: 'factory_hse',
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
      expect(result.user.role).toBe('factory_hse')
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

  const factoryHseUser: AuthenticatedUser = {
    userId: '2',
    email: 'hse@test.com',
    role: 'factory_hse',
    organizationId: null,
    department: null,
  }

  const contractorAdminUser: AuthenticatedUser = {
    userId: '3',
    email: 'contractor@test.com',
    role: 'contractor_admin',
    organizationId: 'org-123',
    department: null,
  }

  const securityUser: AuthenticatedUser = {
    userId: '4',
    email: 'security@test.com',
    role: 'security',
    organizationId: null,
    department: 'security',
  }

  describe('requireRole', () => {
    it('should allow admin when admin role is required', () => {
      expect(requireRole(adminUser, ['admin'])).toBe(true)
    })

    it('should reject contractor when admin role is required', () => {
      const result = requireRole(contractorAdminUser, ['admin'])
      expect(result).toBeInstanceOf(NextResponse)
      if (result instanceof NextResponse) {
        expect(result.status).toBe(403)
      }
    })

    it('should allow when user role is in allowed list', () => {
      expect(requireRole(factoryHseUser, ['admin', 'factory_hse'])).toBe(true)
    })

    it('should reject when user role is not in allowed list', () => {
      const result = requireRole(securityUser, ['admin'])
      expect(result).toBeInstanceOf(NextResponse)
    })
  })

  describe('requireFactoryRole', () => {
    it('should allow admin', () => {
      expect(requireFactoryRole(adminUser)).toBe(true)
    })

    it('should allow factory_hse', () => {
      expect(requireFactoryRole(factoryHseUser)).toBe(true)
    })

    it('should reject contractor_admin', () => {
      const result = requireFactoryRole(contractorAdminUser)
      expect(result).toBeInstanceOf(NextResponse)
      if (result instanceof NextResponse) {
        expect(result.status).toBe(403)
      }
    })

    it('should reject security', () => {
      const result = requireFactoryRole(securityUser)
      expect(result).toBeInstanceOf(NextResponse)
    })
  })

  describe('requireContractorRole', () => {
    it('should allow contractor_admin', () => {
      expect(requireContractorRole(contractorAdminUser)).toBe(true)
    })

    it('should reject factory_hse', () => {
      const result = requireContractorRole(factoryHseUser)
      expect(result).toBeInstanceOf(NextResponse)
    })

    it('should reject admin (not a contractor role)', () => {
      const result = requireContractorRole(adminUser)
      expect(result).toBeInstanceOf(NextResponse)
    })
  })
})
