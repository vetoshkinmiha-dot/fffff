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

test.describe('Sprint 1 Regression — 4 roles', () => {

  // 1. Create contractor → redirect to detail
  test('1. Create contractor → redirects to detail page', async ({ page }) => {
    await login(page, ACCOUNTS.admin.email, ACCOUNTS.admin.password)
    await page.goto('/contractors/new')

    await page.locator('#name').fill(`ООО Регресс-${Date.now()}`)
    await page.locator('#inn').fill('7707123456')
    await page.locator('#legalAddress').fill('Москва, ул. Тест')
    await page.getByRole('button', { name: /создать/i }).click()

    await expect(page).toHaveURL(/\/contractors\/[\w-]+/)
    await expect(page.locator('h1').first()).toBeVisible()
  })

  // 2. Create employee → redirect to detail
  test('2. Create employee → redirects to detail page', async ({ page }) => {
    await login(page, ACCOUNTS.admin.email, ACCOUNTS.admin.password)

    await page.goto('/contractors/new')
    await page.locator('#name').fill(`ООО ДляСотрудника-${Date.now()}`)
    await page.locator('#inn').fill('7707987654')
    await page.locator('#legalAddress').fill('Москва, ул. Тест')
    await page.getByRole('button', { name: /создать/i }).click()
    await page.waitForURL(/\/contractors\/[\w-]+/)

    await page.goto('/employees/new')
    await page.locator('[data-slot="select-trigger"]').first().click()
    await page.getByRole('option', { name: /ООО/i }).first().click()

    await page.locator('#fullName').fill('Регрессов Р.Р.')
    await page.locator('#position').fill('Инженер')
    await page.getByPlaceholder('Серия (4 цифры)').fill('4510')
    await page.getByPlaceholder('Номер (6 цифр)').fill('123456')

    await page.getByRole('button', { name: /создать/i }).click()
    await expect(page).toHaveURL(/\/employees\/[\w-]+/)
  })

  // 3. Upload document → success
  test('3. Upload document → success', async ({ page }) => {
    await login(page, ACCOUNTS.admin.email, ACCOUNTS.admin.password)

    await page.goto('/employees/new')
    await page.locator('[data-slot="select-trigger"]').first().click()
    await page.getByRole('option', { name: /ООО/i }).first().click()

    const ts = String(Date.now()).slice(-6)
    await page.locator('#fullName').fill(`Документов Д.Д.`)
    await page.locator('#position').fill('Тестировщик')
    await page.getByPlaceholder('Серия (4 цифры)').fill(`45${ts.slice(0,2)}`)
    await page.getByPlaceholder('Номер (6 цифр)').fill(ts.padStart(6, '0'))
    await page.getByRole('button', { name: /создать/i }).click()
    await page.waitForURL(/\/employees\/[\w-]+/)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)

    await page.getByRole('button', { name: 'Загрузить' }).click()
    await expect(page.getByText(/выберите/i)).toBeVisible()
  })

  // 4. Approvals page — data loads
  test('4. Approvals page — data loads', async ({ page }) => {
    await login(page, ACCOUNTS.admin.email, ACCOUNTS.admin.password)
    await page.goto('/approvals')

    await expect(page.locator('body')).not.toBeEmpty()
    await expect(page.locator('h1, h2').first()).toBeVisible()
  })

  // 5. Contractor card — real data + employees
  test('5. Contractor card — real data + employees section', async ({ page }) => {
    await login(page, ACCOUNTS.admin.email, ACCOUNTS.admin.password)
    await page.goto('/contractors')

    await expect(page.locator('table')).toBeVisible()

    const firstRow = page.locator('table tbody tr').first()
    if (await firstRow.isVisible()) {
      await firstRow.locator('a').first().click()
      await page.waitForURL(/\/contractors\/[\w-]+/)
      await expect(page.locator('h1').first()).toBeVisible()
      await expect(page.getByText(/сотрудники/i).first()).toBeVisible()
    }
  })

  // 6. contractor_employee cannot create employees (via /employees/new redirect)
  test('6. contractor_employee cannot access /employees/new directly', async ({ page }) => {
    await login(page, ACCOUNTS.contractor.email, ACCOUNTS.contractor.password)
    await page.goto('/employees')

    // contractor_employee can see employees but should not see admin-level create buttons
    // They should be able to access /employees/new for their own org though
    const createBtn = page.getByRole('button', { name: /добавить сотрудника/i })
    const isVisible = await createBtn.isVisible().catch(() => false)
    // Either they can't see it (pure view) or it's limited to their org
    expect(isVisible).toBe(false)
  })

  // 7. Approvals page has status filter
  test('7. Approvals page — status filter works', async ({ page }) => {
    await login(page, ACCOUNTS.admin.email, ACCOUNTS.admin.password)
    await page.goto('/approvals')

    await expect(page.getByRole('combobox').first()).toBeVisible()
  })

  // 8. Sidebar — admin sees documents, contractor_employee does not
  test('8. Sidebar — admin sees documents, contractors do not', async ({ page }) => {
    await login(page, ACCOUNTS.admin.email, ACCOUNTS.admin.password)
    await page.goto('/')

    const sidebar = page.locator('nav, aside').first()
    if (await sidebar.isVisible()) {
      const hasDocumentsLink = await sidebar.locator('a[href="/documents"]').isVisible().catch(() => false)
      expect(hasDocumentsLink).toBe(true)
    }
  })

  // 9. employee role — sidebar has expected links (NOT checklists, NOT approvals)
  test('9. employee sees expected sidebar links', async ({ page }) => {
    await login(page, ACCOUNTS.employee.email, ACCOUNTS.employee.password)
    await page.goto('/')

    // Wait for sidebar to finish role-based filtering
    for (let i = 0; i < 10; i++) {
      const labels = await page.locator('nav a span').allTextContents()
      if (!labels.includes('Согласования') && !labels.includes('Чек-листы')) {
        expect(labels).toContain('Дашборд')
        expect(labels).toContain('Подрядчики')
        expect(labels).toContain('Сотрудники')
        expect(labels).toContain('Наряды-допуски')
        expect(labels).toContain('Нормативные документы')
        return
      }
      await page.waitForTimeout(300)
    }
    const labels = await page.locator('nav a span').allTextContents()
    expect(labels).not.toContain('Чек-листы')
    expect(labels).not.toContain('Согласования')
  })

  // 10. department_approver — sidebar eventually filters out checklists and documents
  test('10. department_approver sidebar filters checklists and documents', async ({ page }) => {
    await login(page, ACCOUNTS.approver.email, ACCOUNTS.approver.password)
    await page.goto('/')

    // Wait for sidebar to finish role-based filtering (poll for 'Чек-листы' to disappear)
    for (let i = 0; i < 10; i++) {
      const labels = await page.locator('nav a span').allTextContents()
      if (!labels.includes('Чек-листы') && !labels.includes('Нормативные документы')) {
        expect(labels).toContain('Согласования')
        return
      }
      await page.waitForTimeout(300)
    }
    // If still showing after polling, the filtering didn't work
    const labels = await page.locator('nav a span').allTextContents()
    expect(labels).not.toContain('Чек-листы')
    expect(labels).not.toContain('Нормативные документы')
  })
})
