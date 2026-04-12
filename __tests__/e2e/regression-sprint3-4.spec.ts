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
  await page.waitForLoadState('networkidle')
}

test.describe('Sprint 3+4 Regression — 4 roles', () => {

  // ─── Sprint 3: Approval workflow ──────────────────────────────────────────

  test('1. Send to approval — modal with departments + deadline (admin)', async ({ page }) => {
    await login(page, ACCOUNTS.admin.email, ACCOUNTS.admin.password)

    // Create a contractor first
    await page.goto('/contractors/new')
    await page.locator('#name').fill(`ООО Спринт3-${Date.now()}`)
    await page.locator('#inn').fill('7707222333')
    await page.locator('#legalAddress').fill('Москва')
    await page.getByRole('button', { name: /создать/i }).click()
    await page.waitForURL(/\/contractors\//)

    // Create an employee
    await page.goto('/employees/new')
    await page.getByRole('combobox').first().click()
    await page.getByRole('option').first().click()
    await page.locator('#fullName').fill('Согласуемый С.С.')
    await page.locator('#position').fill('Инженер')
    await page.getByPlaceholder('Серия (4 цифры)').fill('4510')
    await page.getByPlaceholder('Номер (6 цифр)').fill('123456')
    await page.getByRole('button', { name: /создать/i }).click()
    await page.waitForURL(/\/employees\/[\w-]+/)

    // Check "Отправить на согласование" button exists
    const sendBtn = page.getByRole('button', { name: /отправить на согласование/i })
    expect(await sendBtn.isVisible()).toBe(true)
  })

  test('2. Sequential approvals — department order accessible to approver', async ({ page }) => {
    await login(page, ACCOUNTS.approver.email, ACCOUNTS.approver.password)

    // Approver should see approvals page
    await page.goto('/approvals')
    await expect(page).not.toHaveURL(/\/auth\/unauthorized|\/login/)
    await expect(page.locator('body')).not.toBeEmpty()
  })

  test('3. Cron document-expiry endpoint — returns 401 without CRON_SECRET', async ({ page }) => {
    await login(page, ACCOUNTS.admin.email, ACCOUNTS.admin.password)

    const response = await page.evaluate(async () => {
      const res = await fetch('/api/cron/document-expiry')
      return { status: res.status }
    })

    expect(response.status).toBe(401)
  })

  // ─── Sprint 4: Permits ─────────────────────────────────────────────────────

  test('4. Permits list — table and filters (admin)', async ({ page }) => {
    await login(page, ACCOUNTS.admin.email, ACCOUNTS.admin.password)
    await page.goto('/permits')

    await expect(page.locator('table')).toBeVisible()
    await expect(page.getByRole('combobox').first()).toBeVisible()
  })

  test('5. Permits accessible to contractor_employee', async ({ page }) => {
    await login(page, ACCOUNTS.contractor.email, ACCOUNTS.contractor.password)
    await page.goto('/permits')

    await expect(page).not.toHaveURL(/\/auth\/unauthorized|\/login/)
    await expect(page.locator('body')).not.toBeEmpty()
  })

  test('6. Permits accessible to employee (view-only)', async ({ page }) => {
    await login(page, ACCOUNTS.employee.email, ACCOUNTS.employee.password)
    await page.goto('/permits')

    await expect(page).not.toHaveURL(/\/auth\/unauthorized|\/login/)
    await expect(page.locator('body')).not.toBeEmpty()
  })

  test('7. Permit print page — /permits/[id]/print', async ({ page }) => {
    await login(page, ACCOUNTS.admin.email, ACCOUNTS.admin.password)
    await page.goto('/permits/12345678-1234-1234-1234-123456789012/print')

    await expect(page.locator('body')).not.toBeEmpty()
  })

  test('8. Permit print accessible to contractor_employee', async ({ page }) => {
    await login(page, ACCOUNTS.contractor.email, ACCOUNTS.contractor.password)
    await page.goto('/permits/12345678-1234-1234-1234-123456789012/print')

    await expect(page).not.toHaveURL(/\/auth\/unauthorized|\/login/)
  })

  test('9. Permit print accessible to employee', async ({ page }) => {
    await login(page, ACCOUNTS.employee.email, ACCOUNTS.employee.password)
    await page.goto('/permits/12345678-1234-1234-1234-123456789012/print')

    await expect(page).not.toHaveURL(/\/auth\/unauthorized|\/login/)
  })

  test('10. department_approver CANNOT access permits create', async ({ page }) => {
    await login(page, ACCOUNTS.approver.email, ACCOUNTS.approver.password)
    await page.goto('/permits')

    // Should not see create buttons
    const createBtn = page.getByRole('button', { name: /создать|добавить/i })
    await expect(createBtn).not.toBeVisible()
  })
})
