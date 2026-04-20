import { describe, it, expect } from 'vitest'
import {
  loginSchema,
  registerSchema,
  createOrgSchema,
  updateOrgSchema,
  orgStatusSchema,
  createEmployeeSchema,
  updateEmployeeSchema,
  createApprovalSchema,
  decideApprovalSchema,
  paginationSchema,
} from '../../lib/validations'

describe('Validation Schemas', () => {
  describe('loginSchema', () => {
    it('should accept valid email and password', () => {
      const result = loginSchema.safeParse({ email: 'test@example.com', password: 'Password1' })
      expect(result.success).toBe(true)
    })

    it('should reject invalid email', () => {
      const result = loginSchema.safeParse({ email: 'not-an-email', password: 'Password1' })
      expect(result.success).toBe(false)
    })

    it('should reject short password (< 8 chars)', () => {
      const result = loginSchema.safeParse({ email: 'test@example.com', password: 'abc' })
      expect(result.success).toBe(false)
    })
  })

  describe('registerSchema', () => {
    const validInput = {
      email: 'user@example.com',
      password: 'Password1',
      fullName: 'Ivanov Ivan',
      role: 'admin' as const,
    }

    it('should accept valid registration data', () => {
      const result = registerSchema.safeParse(validInput)
      expect(result.success).toBe(true)
    })

    it('should accept optional organizationId', () => {
      const result = registerSchema.safeParse({
        ...validInput,
        organizationId: '550e8400-e29b-41d4-a716-446655440000',
      })
      expect(result.success).toBe(true)
    })

    it('should accept optional department', () => {
      const result = registerSchema.safeParse({
        ...validInput,
        department: 'safety',
      })
      expect(result.success).toBe(true)
    })

    it('should reject password without uppercase letter', () => {
      const result = registerSchema.safeParse({ ...validInput, password: 'password1' })
      expect(result.success).toBe(false)
    })

    it('should reject password without number', () => {
      const result = registerSchema.safeParse({ ...validInput, password: 'Password' })
      expect(result.success).toBe(false)
    })

    it('should reject password shorter than 8 chars', () => {
      const result = registerSchema.safeParse({ ...validInput, password: 'Pass1' })
      expect(result.success).toBe(false)
    })

    it('should reject invalid role', () => {
      const result = registerSchema.safeParse({ ...validInput, role: 'super_admin' })
      expect(result.success).toBe(false)
    })

    it('should reject invalid organizationId UUID', () => {
      const result = registerSchema.safeParse({ ...validInput, organizationId: 'not-a-uuid' })
      expect(result.success).toBe(false)
    })
  })

  describe('createOrgSchema', () => {
    it('should accept valid organization data', () => {
      const result = createOrgSchema.safeParse({
        name: 'ООО Тест',
        inn: '7707083893',
        kpp: '770701001',
        legalAddress: 'г. Москва, ул. Тестовая, 1',
        contactPersonName: 'Иванов И.И.',
        contactPhone: '+79001234567',
        contactEmail: 'test@example.com',
      })
      expect(result.success).toBe(true)
    })

    it('should accept 12-digit INN', () => {
      const result = createOrgSchema.safeParse({
        name: 'ООО Тест',
        inn: '770708389301',
        legalAddress: 'Адрес',
      })
      expect(result.success).toBe(true)
    })

    it('should reject 11-digit INN (neither 10 nor 12)', () => {
      const result = createOrgSchema.safeParse({
        name: 'ООО Тест',
        inn: '77070838930',
        legalAddress: 'Адрес',
      })
      expect(result.success).toBe(false)
    })

    it('should reject empty name', () => {
      const result = createOrgSchema.safeParse({
        name: '',
        inn: '7707083893',
        legalAddress: 'Адрес',
      })
      expect(result.success).toBe(false)
    })

    it('should reject invalid email for contactEmail', () => {
      const result = createOrgSchema.safeParse({
        name: 'ООО Тест',
        inn: '7707083893',
        legalAddress: 'Адрес',
        contactEmail: 'not-an-email',
      })
      expect(result.success).toBe(false)
    })

    it('should accept empty string for contactEmail', () => {
      const result = createOrgSchema.safeParse({
        name: 'ООО Тест',
        inn: '7707083893',
        legalAddress: 'Адрес',
        contactEmail: '',
      })
      expect(result.success).toBe(true)
    })

    it('should reject missing legalAddress', () => {
      const result = createOrgSchema.safeParse({
        name: 'ООО Тест',
        inn: '7707083893',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('updateOrgSchema', () => {
    it('should accept partial data', () => {
      const result = updateOrgSchema.safeParse({ name: 'Новое имя' })
      expect(result.success).toBe(true)
    })

    it('should accept empty object', () => {
      const result = updateOrgSchema.safeParse({})
      expect(result.success).toBe(true)
    })

    it('should still validate inn format if provided', () => {
      const result = updateOrgSchema.safeParse({ inn: '123' })
      expect(result.success).toBe(false)
    })
  })

  describe('orgStatusSchema', () => {
    it('should accept valid statuses', () => {
      for (const status of ['pending', 'active', 'blocked']) {
        const result = orgStatusSchema.safeParse({ status })
        expect(result.success).toBe(true)
      }
    })

    it('should reject invalid status', () => {
      const result = orgStatusSchema.safeParse({ status: 'deleted' })
      expect(result.success).toBe(false)
    })
  })

  describe('createEmployeeSchema', () => {
    it('should accept valid employee data', () => {
      const result = createEmployeeSchema.safeParse({
        fullName: 'Петров П.П.',
        position: 'Инженер',
        passportSeries: '4510',
        passportNumber: '123456',
        workClasses: ['Высота', 'Электрика'],
      })
      expect(result.success).toBe(true)
    })

    it('should reject passport series not 4 digits', () => {
      const result = createEmployeeSchema.safeParse({
        fullName: 'Петров П.П.',
        position: 'Инженер',
        passportSeries: '451',
        passportNumber: '123456',
      })
      expect(result.success).toBe(false)
    })

    it('should reject passport number not 6 digits', () => {
      const result = createEmployeeSchema.safeParse({
        fullName: 'Петров П.П.',
        position: 'Инженер',
        passportSeries: '4510',
        passportNumber: '12345',
      })
      expect(result.success).toBe(false)
    })

    it('should default workClasses to empty array', () => {
      const result = createEmployeeSchema.safeParse({
        fullName: 'Петров П.П.',
        position: 'Инженер',
        passportSeries: '4510',
        passportNumber: '123456',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.workClasses).toEqual([])
      }
    })

    it('should default previouslyAtPirelli to false', () => {
      const result = createEmployeeSchema.safeParse({
        fullName: 'Петров П.П.',
        position: 'Инженер',
        passportSeries: '4510',
        passportNumber: '123456',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.previouslyAtPirelli).toBe(false)
      }
    })

    it('should reject fullName shorter than 2 chars', () => {
      const result = createEmployeeSchema.safeParse({
        fullName: 'А',
        position: 'Инженер',
        passportSeries: '4510',
        passportNumber: '123456',
      })
      expect(result.success).toBe(false)
    })

    it('should reject empty position', () => {
      const result = createEmployeeSchema.safeParse({
        fullName: 'Петров П.П.',
        position: '',
        passportSeries: '4510',
        passportNumber: '123456',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('updateEmployeeSchema', () => {
    it('should accept partial employee data', () => {
      const result = updateEmployeeSchema.safeParse({ position: 'Старший инженер' })
      expect(result.success).toBe(true)
    })
  })

  describe('createApprovalSchema', () => {
    it('should accept valid approval creation data', () => {
      const result = createApprovalSchema.safeParse({
        departments: ['security', 'hr'],
        deadline: '2024-03-01T00:00:00Z',
      })
      expect(result.success).toBe(true)
    })

    it('should reject empty departments array', () => {
      const result = createApprovalSchema.safeParse({
        departments: [],
        deadline: '2024-03-01T00:00:00Z',
      })
      expect(result.success).toBe(false)
    })

    it('should reject invalid department', () => {
      const result = createApprovalSchema.safeParse({
        departments: ['unknown_dept'],
        deadline: '2024-03-01T00:00:00Z',
      })
      expect(result.success).toBe(false)
    })

    it('should reject invalid datetime', () => {
      const result = createApprovalSchema.safeParse({
        departments: ['security'],
        deadline: 'not-a-date',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('decideApprovalSchema', () => {
    it('should accept approved status', () => {
      const result = decideApprovalSchema.safeParse({ status: 'approved' })
      expect(result.success).toBe(true)
    })

    it('should accept rejected status with comment', () => {
      const result = decideApprovalSchema.safeParse({ status: 'rejected', comment: 'Документы не в порядке' })
      expect(result.success).toBe(true)
    })

    it('should reject invalid status', () => {
      const result = decideApprovalSchema.safeParse({ status: 'pending' })
      expect(result.success).toBe(false)
    })
  })

  describe('paginationSchema', () => {
    it('should use defaults for empty input', () => {
      const result = paginationSchema.parse({})
      expect(result.page).toBe(1)
      expect(result.limit).toBe(20)
    })

    it('should parse page and limit from string values', () => {
      const result = paginationSchema.parse({ page: '2', limit: '10' })
      expect(result.page).toBe(2)
      expect(result.limit).toBe(10)
    })

    it('should reject page less than 1', () => {
      const result = paginationSchema.safeParse({ page: '0' })
      expect(result.success).toBe(false)
    })

    it('should reject limit greater than 100', () => {
      const result = paginationSchema.safeParse({ limit: '200' })
      expect(result.success).toBe(false)
    })
  })
})
