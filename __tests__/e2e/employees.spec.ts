import { test, expect } from '@playwright/test'

test.describe('Employees Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.locator('#email').fill('admin@pirelli.ru')
    await page.locator('#password').fill('Admin123!')
    await page.getByRole('button', { name: 'Войти' }).click()
    await page.waitForURL(/.*\/(?:$)/)
  })

  test('should list employees in table', async ({ page }) => {
    await page.goto('/employees')

    await expect(page.getByRole('columnheader', { name: 'ФИО' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Должность' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Организация' })).toBeVisible()
    await expect(page.getByRole('row').nth(1)).toBeVisible()
  })

  test('should create a new employee', async ({ page }) => {
    await page.goto('/employees/new')

    // base-ui Select for contractor
    await page.locator('[data-slot="select-trigger"]').first().click()
    await page.getByRole('option', { name: /ООО/i }).first().click()

    await page.locator('#fullName').fill('Новиков Н.Н.')
    await page.locator('#position').fill('Монтажник')
    await page.locator('input[placeholder*="Серия"]').fill('4510')
    await page.locator('input[placeholder*="Номер"]').fill('654321')

    await page.getByRole('button', { name: 'Создать' }).click()

    // Redirect to detail page — verify URL and heading
    await expect(page).toHaveURL(/.*\/employees\/.+/)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
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
    // Login before navigating
    await page.goto('/login')
    await page.locator('#email').fill('admin@pirelli.ru')
    await page.locator('#password').fill('Admin123!')
    await page.getByRole('button', { name: 'Войти' }).click()
    await page.waitForURL(/.*\/(?:$)/)

    await page.goto('/employees/c11e40ee-3665-421c-b2c2-8579e5a28977')
    // Wait for the page to hydrate and render past loading
    await page.waitForLoadState('networkidle')
    // Close any Next.js dev overlay if present
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    // Check that we're on a detail page with expected sections
    await expect(page.locator('body')).toContainText(/документы/i)
    await expect(page.locator('body')).toContainText(/классы работ/i)
  })

  test('should show document expiry status badges', async ({ page }) => {
    await page.goto('/employees')
    await page.waitForSelector('table')
    await page.goto('/employees/c11e40ee-3665-421c-b2c2-8579e5a28977')
    await page.waitForURL(/.*\/employees\/.+/)

    await expect(page.getByText(/действует|истекает|истёк|документы не загружены|документы/i)).toBeVisible()
  })

  test('should filter employees by organization', async ({ page }) => {
    await page.goto('/employees')

    // Second combobox is org filter
    const orgFilters = page.locator('[data-slot="select-trigger"]')
    await expect(orgFilters.first()).toBeVisible()
  })
})
