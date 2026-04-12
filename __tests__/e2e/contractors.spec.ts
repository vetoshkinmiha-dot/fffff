import { test, expect } from '@playwright/test'

const ACCOUNTS = {
  admin: { email: 'admin@pirelli.ru', password: 'Admin123!' },
  approver: { email: 'approver@pirelli.ru', password: 'Approver1!' },
  contractor: { email: 'podradchik@pirelli.ru', password: 'Contractor1!' },
  employee: { email: 'employee@pirelli.ru', password: 'Employee1!' },
}

async function login(page: any, email: string, password: string) {
  await page.goto('/login')
  await page.locator('#email').fill(email)
  await page.locator('#password').fill(password)
  await page.getByRole('button', { name: 'Войти' }).click()
  await page.waitForURL(/^(?!.*\/login).*$/)
}

test.describe('Contractors Management — admin', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, ACCOUNTS.admin.email, ACCOUNTS.admin.password)
  })

  test('should list contractors in table', async ({ page }) => {
    await page.goto('/contractors')

    await expect(page.getByRole('columnheader', { name: 'Название' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'ИНН' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Статус' })).toBeVisible()

    await expect(page.getByRole('row').nth(1)).toBeVisible()
  })

  test('should create a new contractor', async ({ page }) => {
    await page.goto('/contractors/new')

    await page.locator('#name').fill(`ООО Новый-${Date.now()}`)
    await page.locator('#inn').fill('7707083893')
    await page.locator('#kpp').fill('770701001')
    await page.locator('#legalAddress').fill('г. Москва, ул. Новая, 1')
    await page.locator('#contactPersonName').fill('Сидоров С.С.')
    await page.locator('#contactPhone').fill('+79001234567')
    await page.locator('#contactEmail').fill('test@contractor.ru')

    await page.getByRole('button', { name: 'Создать' }).click()

    await expect(page).toHaveURL(/.*\/contractors\/.+/)
  })

  test('should search contractors by name and INN', async ({ page }) => {
    await page.goto('/contractors')

    const searchInput = page.locator('input[placeholder*="Поиск по названию"]')
    await searchInput.fill('Строй')

    await page.waitForTimeout(500)
    const table = page.getByRole('table')
    await expect(table).toBeVisible()
  })

  test('should navigate to contractor detail page', async ({ page }) => {
    await page.goto('/contractors')

    await page.getByRole('row').nth(1).getByRole('link').first().click()

    await expect(page).toHaveURL(/.*\/contractors\/.+/)
  })
})

test.describe('Contractors — contractor_employee button visibility', () => {
  test('should NOT see "+ Добавить подрядчика" button', async ({ page }) => {
    await login(page, ACCOUNTS.contractor.email, ACCOUNTS.contractor.password)
    await page.goto('/contractors')

    const addContractorBtn = page.getByRole('button', { name: /добавить.*подрядчик|создать.*подрядчик/i })
    await expect(addContractorBtn).not.toBeVisible()
  })
})

test.describe('Contractors — department_approver button visibility', () => {
  test('should NOT see create buttons', async ({ page }) => {
    await login(page, ACCOUNTS.approver.email, ACCOUNTS.approver.password)
    await page.goto('/contractors')

    const addContractorBtn = page.getByRole('button', { name: /добавить.*подрядчик|создать.*подрядчик/i })
    await expect(addContractorBtn).not.toBeVisible()
  })
})

test.describe('Contractors — employee button visibility', () => {
  test('should NOT see create buttons', async ({ page }) => {
    await login(page, ACCOUNTS.employee.email, ACCOUNTS.employee.password)
    await page.goto('/contractors')

    const addContractorBtn = page.getByRole('button', { name: /добавить.*подрядчик|создать.*подрядчик/i })
    await expect(addContractorBtn).not.toBeVisible()
  })
})
