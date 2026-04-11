import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock Prisma — new generated client uses import.meta.url (ESM-only) incompatible with Vitest Node env
vi.mock('../../lib/prisma', () => {
  let stores: Record<string, any[]> = {}

  function resetStores() {
    stores = {}
  }

  function getStore(key: string): any[] {
    if (!stores[key]) stores[key] = []
    return stores[key]
  }

  function modelFor(_name: string) {
    const name = _name as string
    return {
      create: vi.fn().mockImplementation(async ({ data }: any) => {
        const entry = { id: `mock-${crypto.randomUUID()}`, ...data, createdAt: new Date(), updatedAt: new Date() }
        getStore(name).push(entry)
        return entry
      }),
      createMany: vi.fn().mockImplementation(async ({ data }: any) => {
        const items = (Array.isArray(data) ? data : [data]).map((d: any, i: number) => ({
          id: `mock-${name}-${i}`,
          ...d,
          createdAt: new Date(),
          updatedAt: new Date(),
        }))
        stores[name] = [...(stores[name] || []), ...items]
        return { count: items.length }
      }),
      findMany: vi.fn().mockImplementation(async ({ where, orderBy, skip, take }: any = {}) => {
        let results = [...(stores[name] || [])]
        if (where) {
          results = results.filter((r: any) => {
            for (const [key, value] of Object.entries(where)) {
              if (typeof value === 'object' && value !== null) {
                if ('lte' in value && r[key] && new Date(r[key]) > new Date(value.lte)) return false
                if ('lt' in value && r[key] && new Date(r[key]) >= new Date(value.lt)) return false
                if ('contains' in value) {
                  const actual = String(r[key] || '').toLowerCase()
                  const search = String(value.contains).toLowerCase()
                  if (!actual.includes(search)) return false
                }
              } else if (r[key] !== value) {
                return false
              }
            }
            return true
          })
        }
        if (orderBy && typeof orderBy === 'object') {
          const [field, dir] = Object.entries(orderBy)[0]
          results.sort((a: any, b: any) => {
            const av = a[field] instanceof Date ? a[field].getTime() : a[field]
            const bv = b[field] instanceof Date ? b[field].getTime() : b[field]
            if (av < bv) return dir === 'asc' ? -1 : 1
            if (av > bv) return dir === 'asc' ? 1 : -1
            return 0
          })
        }
        if (skip !== undefined) results = results.slice(skip)
        if (take !== undefined) results = results.slice(0, take)
        return results
      }),
      findUnique: vi.fn().mockImplementation(async ({ where }: any) => {
        return (getStore(name) || []).find((r: any) => r.id === where.id) || null
      }),
      update: vi.fn().mockImplementation(async ({ where, data }: any) => {
        const idx = getStore(name).findIndex((r: any) => r.id === where.id)
        if (idx === -1) throw new Error('Not found')
        stores[name][idx] = { ...stores[name][idx], ...data }
        return stores[name][idx]
      }),
      delete: vi.fn().mockImplementation(async ({ where }: any) => {
        stores[name] = getStore(name).filter((r: any) => r.id !== where.id)
        return {}
      }),
      count: vi.fn().mockImplementation(async () => getStore(name).length),
    }
  }

  // Expose reset on global so test files can call it
  ;(globalThis as any).__resetPrismaStores = resetStores

  return {
    prisma: {
      organization: modelFor('organization'),
      employee: modelFor('employee'),
      employeeDocument: modelFor('employeeDocument'),
      approvalRequest: modelFor('approvalRequest'),
      user: modelFor('user'),
    },
  }
})

import { prisma } from '../../lib/prisma'

describe('Prisma Query Operations (Mocked with in-memory store)', () => {
  afterEach(() => {
    ;(globalThis as any).__resetPrismaStores?.()
  })

  describe('Organization Queries', () => {
    it('should return empty list when no organizations exist', async () => {
      const orgs = await prisma.organization.findMany()
      expect(orgs).toEqual([])
    })

    it('should create and retrieve organization by id', async () => {
      const org = await prisma.organization.create({
        data: { name: 'ООО Тест', inn: '7707083893', legalAddress: 'Адрес' },
      })

      const found = await prisma.organization.findUnique({ where: { id: org.id } })
      expect(found).toBeDefined()
      expect(found!.name).toBe('ООО Тест')
      expect(found!.inn).toBe('7707083893')
    })

    it('should update organization fields', async () => {
      const org = await prisma.organization.create({
        data: { name: 'Старое', inn: '7707083894', legalAddress: 'Адрес' },
      })

      const updated = await prisma.organization.update({
        where: { id: org.id },
        data: { name: 'Новое', status: 'blocked' },
      })

      expect(updated.name).toBe('Новое')
      expect(updated.status).toBe('blocked')
    })

    it('should support case-insensitive search by name', async () => {
      await prisma.organization.createMany({
        data: [
          { name: 'ООО Альфа', inn: '7707083895', legalAddress: 'Адрес 1' },
          { name: 'ООО Бета', inn: '7707083896', legalAddress: 'Адрес 2' },
          { name: 'ИП Альфаев', inn: '7707083897', legalAddress: 'Адрес 3' },
        ],
      })

      const results = await prisma.organization.findMany({
        where: { name: { contains: 'альфа' } },
      })

      expect(results).toHaveLength(2)
    })

    it('should filter by status', async () => {
      await prisma.organization.createMany({
        data: [
          { name: 'Активная', inn: '7707083900', legalAddress: 'Адрес', status: 'active' },
          { name: 'Ожидающая', inn: '7707083901', legalAddress: 'Адрес', status: 'pending' },
        ],
      })

      const active = await prisma.organization.findMany({ where: { status: 'active' } })
      expect(active).toHaveLength(1)
      expect(active[0].name).toBe('Активная')
    })
  })

  describe('Employee Queries', () => {
    let orgId: string

    beforeEach(async () => {
      const org = await prisma.organization.create({
        data: { name: 'ООО Тест', inn: '7707083898', legalAddress: 'Адрес' },
      })
      orgId = org.id
    })

    it('should create employee with full data', async () => {
      const emp = await prisma.employee.create({
        data: {
          organizationId: orgId,
          fullName: 'Петров П.П.',
          position: 'Инженер',
          passportSeries: '4510',
          passportNumber: '123456',
          workClasses: ['Высота', 'Электрика'],
          previouslyAtPirelli: true,
        },
      })

      expect(emp.fullName).toBe('Петров П.П.')
      expect(emp.passportSeries).toBe('4510')
      expect(emp.workClasses).toEqual(['Высота', 'Электрика'])
      expect(emp.previouslyAtPirelli).toBe(true)
    })

    it('should filter employees by organization', async () => {
      await prisma.employee.create({
        data: { organizationId: orgId, fullName: 'А', position: 'Инж', passportSeries: '4510', passportNumber: '111111' },
      })

      const org2 = await prisma.organization.create({
        data: { name: 'ООО Второй', inn: '7707083899', legalAddress: 'Адрес 2' },
      })
      await prisma.employee.create({
        data: { organizationId: org2.id, fullName: 'Б', position: 'Инж', passportSeries: '4510', passportNumber: '222222' },
      })

      const filtered = await prisma.employee.findMany({ where: { organizationId: orgId } })
      expect(filtered).toHaveLength(1)
      expect(filtered[0].fullName).toBe('А')
    })

    it('should delete employee', async () => {
      const emp = await prisma.employee.create({
        data: { organizationId: orgId, fullName: 'Петров П.П.', position: 'Инженер', passportSeries: '4510', passportNumber: '123456' },
      })

      await prisma.employee.delete({ where: { id: emp.id } })

      const found = await prisma.employee.findUnique({ where: { id: emp.id } })
      expect(found).toBeNull()
    })
  })

  describe('Pagination', () => {
    beforeEach(async () => {
      await prisma.organization.createMany({
        data: Array.from({ length: 25 }, (_, i) => ({
          name: `Орг ${i + 1}`,
          inn: `770708${4000 + i}`,
          legalAddress: `Адрес ${i + 1}`,
          sequentialNumber: i + 1,
        })),
      })
    })

    it('should paginate with default page/limit', async () => {
      const page1 = await prisma.organization.findMany({
        orderBy: { sequentialNumber: 'asc' },
        skip: 0,
        take: 20,
      })
      expect(page1).toHaveLength(20)
    })

    it('should paginate with custom page/limit', async () => {
      const page2 = await prisma.organization.findMany({
        orderBy: { sequentialNumber: 'asc' },
        skip: 20,
        take: 10,
      })
      expect(page2).toHaveLength(5)
    })

    it('should return correct total count', async () => {
      const total = await prisma.organization.count()
      expect(total).toBe(25)
    })
  })

  describe('Document Expiry Queries', () => {
    let empId: string

    beforeEach(async () => {
      const org = await prisma.organization.create({
        data: { name: 'ООО Тест', inn: '7707083999', legalAddress: 'Адрес' },
      })
      const emp = await prisma.employee.create({
        data: { organizationId: org.id, fullName: 'Петров П.П.', position: 'Инженер', passportSeries: '4510', passportNumber: '123456' },
      })
      empId = emp.id

      const now = new Date()
      await prisma.employeeDocument.create({
        data: { employeeId: empId, name: 'Старый', status: 'expired', expiryDate: new Date(now.getTime() - 86400000) },
      })
      await prisma.employeeDocument.create({
        data: { employeeId: empId, name: 'Скоро', status: 'expiring', expiryDate: new Date(now.getTime() + 15 * 86400000) },
      })
      await prisma.employeeDocument.create({
        data: { employeeId: empId, name: 'Валидный', status: 'valid', expiryDate: new Date(now.getTime() + 60 * 86400000) },
      })
    })

    it('should find documents expiring within N days', async () => {
      const threshold = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      const expiring = await prisma.employeeDocument.findMany({
        where: { expiryDate: { lte: threshold } },
        orderBy: { expiryDate: 'asc' },
      })

      expect(expiring).toHaveLength(2)
    })

    it('should find only expired documents', async () => {
      const expired = await prisma.employeeDocument.findMany({
        where: { expiryDate: { lt: new Date() } },
      })
      expect(expired).toHaveLength(1)
      expect(expired[0].name).toBe('Старый')
    })
  })
})
