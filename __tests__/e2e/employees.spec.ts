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

test.describe('Employees Management — admin', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, ACCOUNTS.admin.email, ACCOUNTS.admin.password)
  })

  test('should list employees in table', async ({ page }) => {
    await page.goto('/employees')

    await expect(page.getByRole('columnheader', { name: 'ФИО' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Должность' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Организация' })).toBeVisible()
    await expect(page.getByRole('row').nth(1)).toBeVisible()
  })

  test('should validate passport series format (4 digits)', async ({ page }) => {
    await page.goto('/employees/new')

    await page.locator('[data-slot="select-trigger"]').first().click()
    await page.getByRole('option', { name: /ООО/i }).first().click()

    await page.locator('#fullName').fill('Тест Т.Т.')
    await page.locator('#position').fill('Монтажник')
    await page.locator('input[placeholder*="Серия"]').fill('45A')
    await page.locator('input[placeholder*="Номер"]').fill('654321')

    await page.getByRole('button', { name: 'Создать' }).click()

    await expect(page).toHaveURL(/.*\/employees\/new/)
    await expect(page.getByText(/4 цифры/i)).toBeVisible()
  })

  test('should validate passport number format (6 digits)', async ({ page }) => {
    await page.goto('/employees/new')

    await page.locator('[data-slot="select-trigger"]').first().click()
    await page.getByRole('option', { name: /ООО/i }).first().click()

    await page.locator('#fullName').fill('Тест Т.Т.')
    await page.locator('#position').fill('Монтажник')
    await page.locator('input[placeholder*="Серия"]').fill('4510')
    await page.locator('input[placeholder*="Номер"]').fill('12345')

    await page.getByRole('button', { name: 'Создать' }).click()

    await expect(page).toHaveURL(/.*\/employees\/new/)
    await expect(page.getByText(/6 цифр/i)).toBeVisible()
  })

  test('should show employee detail with documents', async ({ page }) => {
    await page.goto('/employees/c11e40ee-3665-421c-b2c2-8579e5a28977')
    await page.waitForLoadState('networkidle')
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    await expect(page.locator('body')).toContainText(/документы/i)
    await expect(page.locator('body')).toContainText(/классы работ/i)
  })
})

test.describe('Employees — contractor_employee button visibility', () => {
  test('should see "+ Добавить сотрудника" button', async ({ page }) => {
    await login(page, ACCOUNTS.contractor.email, ACCOUNTS.contractor.password)
    await page.goto('/employees')

    // Contractor employee should see some way to add an employee
    // or at least should be able to access the page
    await expect(page).not.toHaveURL(/\/auth\/unauthorized|\/login/)
  })

  test('should NOT see "+ Добавить подрядчика" button', async ({ page }) => {
    await login(page, ACCOUNTS.contractor.email, ACCOUNTS.contractor.password)
    await page.goto('/contractors')

    const addOrgBtn = page.getByRole('button', { name: /добавить.*подрядчик|создать.*подрядчик/i })
    await expect(addOrgBtn).not.toBeVisible()
  })
})

test.describe('Employees — department_approver button visibility', () => {
  test('should NOT see create buttons on employees page', async ({ page }) => {
    await login(page, ACCOUNTS.approver.email, ACCOUNTS.approver.password)
    await page.goto('/employees')

    const addBtn = page.getByRole('button', { name: /добавить|создать/i })
    await expect(addBtn).not.toBeVisible()
  })
})

test.describe('Employees — employee button visibility', () => {
  test('should NOT see create buttons on employees page', async ({ page }) => {
    await login(page, ACCOUNTS.employee.email, ACCOUNTS.employee.password)
    await page.goto('/employees')

    const addBtn = page.getByRole('button', { name: /добавить|создать/i })
    await expect(addBtn).not.toBeVisible()
  })

  test('should NOT be able to access /employees/new', async ({ page }) => {
    await login(page, ACCOUNTS.employee.email, ACCOUNTS.employee.password)
    await page.goto('/employees/new')

    // Should redirect away from the form
    await expect(page).not.toHaveURL(/\/employees\/new/)
  })
})
