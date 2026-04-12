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

test.describe('Authentication', () => {
  test('should display login page when unauthenticated', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/.*\/login/)
  })

  test('should login with valid credentials and show dashboard', async ({ page }) => {
    await login(page, ACCOUNTS.admin.email, ACCOUNTS.admin.password)
    await expect(page).toHaveURL(/.*\/(?:$)/)
    // Admin's fullName is "Администратор" and role label is also "Администратор" — check the header user area
    await expect(page.getByRole('button', { name: /А Администратор/i })).toBeVisible()
  })

  test('should reject invalid credentials', async ({ page }) => {
    await page.goto('/login')

    await page.locator('#email').fill('admin@pirelli.ru')
    await page.locator('#password').fill('WrongPassword')
    await page.getByRole('button', { name: 'Войти' }).click()

    // After failed login, error div with red border should appear
    await expect(page.locator('.bg-red-50').first()).toBeVisible()
  })

  test('should validate login form fields', async ({ page }) => {
    await page.goto('/login')

    await page.locator('#email').fill('not-an-email')
    await page.locator('#password').fill('anything')
    await page.getByRole('button', { name: 'Войти' }).click()

    // After submitting invalid credentials, the page stays on /login
    // The form has no visible error — server just returns 401
    await expect(page).toHaveURL(/.*\/login/)
  })

  test('should logout and redirect to login', async ({ page }) => {
    await login(page, ACCOUNTS.admin.email, ACCOUNTS.admin.password)
    await expect(page).toHaveURL(/.*\/(?:$)/)

    // Call logout API directly and verify
    await page.evaluate(async () => {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    })
    await page.goto('/contractors')
    await expect(page).toHaveURL(/.*\/login/)
  })

  // Multi-role login tests

  test('should login as department_approver and see correct name', async ({ page }) => {
    await login(page, ACCOUNTS.approver.email, ACCOUNTS.approver.password)
    await expect(page).toHaveURL(/.*\/(?:$)/)
    await expect(page.getByText('Иванов А.С.')).toBeVisible()
  })

  test('should login as contractor_employee and see correct name', async ({ page }) => {
    await login(page, ACCOUNTS.contractor.email, ACCOUNTS.contractor.password)
    await expect(page).toHaveURL(/.*\/(?:$)/)
    await expect(page.getByText('Сидоров П.И.')).toBeVisible()
  })

  test('should login as employee and see correct name', async ({ page }) => {
    await login(page, ACCOUNTS.employee.email, ACCOUNTS.employee.password)
    await expect(page).toHaveURL(/.*\/(?:$)/)
    await expect(page.getByText('Просматривающий')).toBeVisible()
  })
})
