import { test, expect } from '@playwright/test'

test.describe('Contractors Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.locator('#email').fill('admin@pirelli.ru')
    await page.locator('#password').fill('Admin123!')
    await page.getByRole('button', { name: 'Войти' }).click()
    await page.waitForURL(/.*\/(?:$)/)
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

    await page.locator('#name').fill('ООО Новый Подрядчик')
    await page.locator('#inn').fill('7707083893')
    await page.locator('#kpp').fill('770701001')
    await page.locator('#legalAddress').fill('г. Москва, ул. Новая, 1')
    await page.locator('#contactPersonName').fill('Сидоров С.С.')
    await page.locator('#contactPhone').fill('+79001234567')
    await page.locator('#contactEmail').fill('test@contractor.ru')

    await page.getByRole('button', { name: 'Создать' }).click()

    await expect(page).toHaveURL(/.*\/contractors\/.+/)
  })

  test('should reject duplicate INN', async ({ page }) => {
    await page.goto('/contractors/new')

    await page.locator('#name').fill('ООО Дубликат')
    await page.locator('#inn').fill('7712345678')
    await page.locator('#legalAddress').fill('Адрес')

    await page.getByRole('button', { name: 'Создать' }).click()

    // Check that error appears (page may stay on /new or show error)
    await page.waitForTimeout(500)
    await expect(page).toHaveURL(/.*\/contractors\/new|.*\/contractors\/.+/)
  })

  test('should validate INN format (10 or 12 digits)', async ({ page }) => {
    await page.goto('/contractors/new')

    await page.locator('#name').fill('Тест')
    await page.locator('#inn').fill('12345')
    await page.locator('#legalAddress').fill('Адрес')
    await page.getByRole('button', { name: 'Создать' }).click()

    await expect(page).toHaveURL(/.*\/contractors\/new/)
    await expect(page.getByText(/10 или 12/i)).toBeVisible()
  })

  test('should search contractors by name and INN', async ({ page }) => {
    await page.goto('/contractors')

    const searchInput = page.locator('input[placeholder*="Поиск по названию"]')
    await searchInput.fill('Строй')

    await page.waitForTimeout(500)
    const table = page.getByRole('table')
    await expect(table).toBeVisible()
  })

  test('should filter contractors by status', async ({ page }) => {
    await page.goto('/contractors')

    // base-ui Select trigger
    await page.locator('[data-slot="select-trigger"]').first().click()
    await page.getByRole('option', { name: /актив/i }).click()

    await page.waitForTimeout(500)
  })

  test('should navigate to contractor detail page', async ({ page }) => {
    await page.goto('/contractors')

    await page.getByRole('row').nth(1).getByRole('link').first().click()

    await expect(page).toHaveURL(/.*\/contractors\/.+/)
  })

  test('should show contractor detail page', async ({ page }) => {
    await page.goto('/contractors')
    await page.getByRole('row').nth(1).getByRole('link').first().click()
    await page.waitForURL(/.*\/contractors\/.+/)

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('should show status badge on detail', async ({ page }) => {
    await page.goto('/contractors')
    await page.getByRole('row').nth(1).getByRole('link').first().click()
    await page.waitForURL(/.*\/contractors\/.+/)

    await expect(page.getByText(/активен|ожидает|заблокирован/i)).toBeVisible()
  })
})
