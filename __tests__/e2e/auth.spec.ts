import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test('should display login page when unauthenticated', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/.*\/login/)
  })

  test('should login with valid credentials and show dashboard', async ({ page }) => {
    await page.goto('/login')

    await page.locator('#email').fill('admin@pirelli.ru')
    await page.locator('#password').fill('Admin123!')
    await page.getByRole('button', { name: 'Войти' }).click()

    await expect(page).toHaveURL(/.*\/(?:$)/)
    await expect(page.getByText('Администратор')).toBeVisible()
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
    await page.goto('/login')
    await page.locator('#email').fill('admin@pirelli.ru')
    await page.locator('#password').fill('Admin123!')
    await page.getByRole('button', { name: 'Войти' }).click()
    await expect(page).toHaveURL(/.*\/(?:$)/)

    // Call logout API directly and verify
    await page.evaluate(async () => {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    })
    await page.goto('/contractors')
    await expect(page).toHaveURL(/.*\/login/)
  })
})
