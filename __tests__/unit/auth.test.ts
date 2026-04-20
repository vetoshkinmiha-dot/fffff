import { describe, it, expect } from 'vitest'
import {
  hashPassword,
  verifyPassword,
  generateAccessToken,
  verifyAccessToken,
  isAdminRole,
  isApproverRole,
  type JWTPayload,
  type UserRole,
  ROLES,
} from '../../lib/auth'

describe('Auth Utilities', () => {
  describe('hashPassword', () => {
    it('should hash a password and return a string', async () => {
      const hash = await hashPassword('TestPass123')
      expect(typeof hash).toBe('string')
      expect(hash.length).toBeGreaterThan(30)
    })

    it('should produce different hashes for the same password (salt)', async () => {
      const hash1 = await hashPassword('TestPass123')
      const hash2 = await hashPassword('TestPass123')
      expect(hash1).not.toBe(hash2)
    })
  })

  describe('verifyPassword', () => {
    it('should return true for correct password', async () => {
      const password = 'TestPass123'
      const hash = await hashPassword(password)
      const result = await verifyPassword(password, hash)
      expect(result).toBe(true)
    })

    it('should return false for incorrect password', async () => {
      const hash = await hashPassword('TestPass123')
      const result = await verifyPassword('WrongPass456', hash)
      expect(result).toBe(false)
    })

    it('should return false for empty password against valid hash', async () => {
      const hash = await hashPassword('TestPass123')
      const result = await verifyPassword('', hash)
      expect(result).toBe(false)
    })
  })

  describe('generateAccessToken / verifyAccessToken', () => {
    const validPayload: JWTPayload = {
      userId: '550e8400-e29b-41d4-a716-446655440000',
      email: 'test@example.com',
      fullName: 'Иванов И.И.',
      role: 'department_approver',
      organizationId: null,
      department: 'safety',
      employeeId: null,
      mustChangePwd: false,
    }

    it('should generate and verify a valid token', () => {
      const token = generateAccessToken(validPayload)
      expect(typeof token).toBe('string')

      const decoded = verifyAccessToken(token)
      expect(decoded).not.toBeNull()
      expect(decoded!.userId).toBe(validPayload.userId)
      expect(decoded!.email).toBe(validPayload.email)
      expect(decoded!.role).toBe(validPayload.role)
    })

    it('should preserve all payload fields in the token', () => {
      const payload: JWTPayload = {
        userId: 'test-user-id',
        email: 'user@test.com',
        fullName: 'Петров П.П.',
        role: 'contractor_employee',
        organizationId: 'org-123',
        department: null,
        employeeId: null,
        mustChangePwd: false,
      }
      const token = generateAccessToken(payload)
      const decoded = verifyAccessToken(token)!
      expect(decoded.organizationId).toBe('org-123')
      expect(decoded.role).toBe('contractor_employee')
    })

    it('should return null for tampered token', () => {
      const token = generateAccessToken(validPayload)
      const tampered = token.slice(0, -5) + 'XXXXX'
      expect(verifyAccessToken(tampered)).toBeNull()
    })

    it('should return null for random string', () => {
      expect(verifyAccessToken('not-a-jwt-token')).toBeNull()
    })

    it('should return null for empty string', () => {
      expect(verifyAccessToken('')).toBeNull()
    })
  })

  describe('isAdminRole', () => {
    it('should return true for admin role', () => {
      expect(isAdminRole(ROLES.admin)).toBe(true)
    })

    it('should return false for employee role', () => {
      expect(isAdminRole(ROLES.employee)).toBe(false)
    })

    it('should return false for contractor_employee role', () => {
      expect(isAdminRole(ROLES.contractor_employee)).toBe(false)
    })

    it('should return false for department_approver role', () => {
      expect(isAdminRole(ROLES.department_approver)).toBe(false)
    })

    it('should return false for unknown role string', () => {
      expect(isAdminRole('unknown_role')).toBe(false)
    })
  })

  describe('isApproverRole', () => {
    it('should return true for department_approver role', () => {
      expect(isApproverRole(ROLES.department_approver)).toBe(true)
    })

    it('should return false for admin role', () => {
      expect(isApproverRole(ROLES.admin)).toBe(false)
    })

    it('should return false for employee role', () => {
      expect(isApproverRole(ROLES.employee)).toBe(false)
    })

    it('should return false for unknown role string', () => {
      expect(isApproverRole('unknown_role')).toBe(false)
    })
  })
})
