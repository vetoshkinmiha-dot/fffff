import { describe, it, expect } from 'vitest'
import {
  hashPassword,
  verifyPassword,
  generateAccessToken,
  verifyAccessToken,
  isFactoryRole,
  type JWTPayload,
  UserRole,
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
      role: 'factory_hse',
      organizationId: null,
      department: null,
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
        role: 'contractor_admin',
        organizationId: 'org-123',
        department: null,
      }
      const token = generateAccessToken(payload)
      const decoded = verifyAccessToken(token)!
      expect(decoded.organizationId).toBe('org-123')
      expect(decoded.role).toBe('contractor_admin')
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

  describe('isFactoryRole', () => {
    it('should return true for admin role', () => {
      expect(isFactoryRole(ROLES.admin)).toBe(true)
    })

    it('should return true for factory_hse role', () => {
      expect(isFactoryRole(ROLES.factory_hse)).toBe(true)
    })

    it('should return true for factory_hr role', () => {
      expect(isFactoryRole(ROLES.factory_hr)).toBe(true)
    })

    it('should return true for factory_curator role', () => {
      expect(isFactoryRole(ROLES.factory_curator)).toBe(true)
    })

    it('should return false for contractor_admin role', () => {
      expect(isFactoryRole(ROLES.contractor_admin)).toBe(false)
    })

    it('should return false for contractor_user role', () => {
      expect(isFactoryRole(ROLES.contractor_user)).toBe(false)
    })

    it('should return false for security role', () => {
      expect(isFactoryRole(ROLES.security)).toBe(false)
    })

    it('should return false for permit_bureau role', () => {
      expect(isFactoryRole(ROLES.permit_bureau)).toBe(false)
    })

    it('should return false for unknown role string', () => {
      expect(isFactoryRole('unknown_role')).toBe(false)
    })
  })
})
