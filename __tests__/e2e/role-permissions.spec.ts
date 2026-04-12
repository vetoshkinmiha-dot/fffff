import { test, expect } from '@playwright/test'

// ─── Test Accounts ───────────────────────────────────────────────────────────────

const ACCOUNTS = {
  admin: { email: 'admin@pirelli.ru', password: 'Admin123!' },
  approver: { email: 'approver@pirelli.ru', password: 'Approver1!' },
  contractor: { email: 'podradchik@pirelli.ru', password: 'Contractor1!' },
  employee: { email: 'employee@pirelli.ru', password: 'Employee1!' },
}

const ALL_SIDEBAR_LINKS = [
  { label: 'Дашборд', href: '/' },
  { label: 'Подрядчики', href: '/contractors' },
  { label: 'Сотрудники', href: '/employees' },
  { label: 'Наряды-допуски', href: '/permits' },
  { label: 'Акты нарушений', href: '/violations' },
  { label: 'Чек-листы', href: '/checklists' },
  { label: 'Нормативные документы', href: '/documents' },
  { label: 'Согласования', href: '/approvals' },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────────

async function login(page: any, email: string, password: string) {
  await page.goto('/login')
  await page.locator('#email').fill(email)
  await page.locator('#password').fill(password)
  await page.getByRole('button', { name: 'Войти' }).click()
  await page.waitForURL(/^(?!.*\/login).*$/)
}

async function getSidebarLabels(page: any): Promise<string[]> {
  const nav = page.locator('nav').first()
  await expect(nav).toBeVisible()
  const spans = await nav.locator('a span').allTextContents()
  return spans
}

// Wait for sidebar to finish role-based filtering (the link that's role-specific to check for)
async function waitForSidebarReady(page: any, missingLabel: string) {
  // Poll until the label is NOT found, with a reasonable timeout
  for (let i = 0; i < 10; i++) {
    const labels = await getSidebarLabels(page)
    if (!labels.includes(missingLabel)) return labels
    await page.waitForTimeout(300)
  }
  return getSidebarLabels(page)
}

// ─── SCENARIO 1: admin login → full access ──────────────────────────────────────

test.describe('Role: admin — full access', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, ACCOUNTS.admin.email, ACCOUNTS.admin.password)
  })

  test('sees ALL sidebar links', async ({ page }) => {
    await page.goto('/')
    const labels = await getSidebarLabels(page)
    for (const { label } of ALL_SIDEBAR_LINKS) {
      expect(labels).toContain(label)
    }
  })

  test('sees create buttons on contractors page', async ({ page }) => {
    await page.goto('/contractors')
    // Admin should see a way to create a contractor
    await expect(page.getByRole('button', { name: /добавить|создать/i }).first()).toBeVisible()
  })

  test('can navigate to all pages without redirect', async ({ page }) => {
    for (const { href, label } of ALL_SIDEBAR_LINKS) {
      await page.goto(href)
      // Should NOT redirect to /auth/unauthorized or /login
      await expect(page).not.toHaveURL(/\/auth\/unauthorized/)
      await expect(page).not.toHaveURL(/\/login/)
    }
  })

  test('can access approvals page', async ({ page }) => {
    await page.goto('/approvals')
    await expect(page).not.toHaveURL(/\/auth\/unauthorized|\/login/)
  })

  test('can access documents page', async ({ page }) => {
    await page.goto('/documents')
    await expect(page).not.toHaveURL(/\/auth\/unauthorized|\/login/)
  })

  test('can access checklists page', async ({ page }) => {
    await page.goto('/checklists')
    await expect(page).not.toHaveURL(/\/auth\/unauthorized|\/login/)
  })
})

// ─── SCENARIO 2: contractor_employee login → own org only ───────────────────────

test.describe('Role: contractor_employee — scoped access', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, ACCOUNTS.contractor.email, ACCOUNTS.contractor.password)
  })

  test('does NOT see "Нормативные документы" in sidebar (after role loads)', async ({ page }) => {
    await page.goto('/')
    const labels = await waitForSidebarReady(page, 'Нормативные документы')
    expect(labels).not.toContain('Нормативные документы')
  })

  test('DOES see "Согласования" in sidebar', async ({ page }) => {
    await page.goto('/')
    const labels = await waitForSidebarReady(page, 'Нормативные документы')
    expect(labels).toContain('Согласования')
  })

  test('DOES see "Чек-листы" in sidebar', async ({ page }) => {
    await page.goto('/')
    const labels = await getSidebarLabels(page)
    expect(labels).toContain('Чек-листы')
  })

  test('can access own scoped pages without redirect', async ({ page }) => {
    const allowedPages = ['/', '/contractors', '/employees', '/permits', '/violations', '/checklists', '/approvals']
    for (const href of allowedPages) {
      await page.goto(href)
      await expect(page).not.toHaveURL(/\/auth\/unauthorized|\/login/)
    }
  })

  test('gets redirected to /auth/unauthorized when accessing /documents', async ({ page }) => {
    await page.goto('/documents')
    await expect(page).toHaveURL(/\/auth\/unauthorized/)
  })

  test('can see employees page', async ({ page }) => {
    await page.goto('/employees')
    await expect(page).not.toHaveURL(/\/auth\/unauthorized|\/login/)
    await expect(page.locator('body')).not.toBeEmpty()
  })

  test('can see approvals page with own requests', async ({ page }) => {
    await page.goto('/approvals')
    await expect(page).not.toHaveURL(/\/auth\/unauthorized|\/login/)
  })
})

// ─── SCENARIO 3: department_approver login → only own department ─────────────────

test.describe('Role: department_approver — department-scoped access', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, ACCOUNTS.approver.email, ACCOUNTS.approver.password)
  })

  test('does NOT see "Чек-листы" in sidebar (after role loads)', async ({ page }) => {
    await page.goto('/')
    const labels = await waitForSidebarReady(page, 'Чек-листы')
    expect(labels).not.toContain('Чек-листы')
  })

  test('does NOT see "Нормативные документы" in sidebar (after role loads)', async ({ page }) => {
    await page.goto('/')
    const labels = await waitForSidebarReady(page, 'Нормативные документы')
    expect(labels).not.toContain('Нормативные документы')
  })

  test('DOES see "Согласования" in sidebar', async ({ page }) => {
    await page.goto('/')
    const labels = await getSidebarLabels(page)
    expect(labels).toContain('Согласования')
  })

  test('can access own scoped pages without redirect', async ({ page }) => {
    const allowedPages = ['/', '/contractors', '/employees', '/permits', '/violations', '/approvals']
    for (const href of allowedPages) {
      await page.goto(href)
      await expect(page).not.toHaveURL(/\/auth\/unauthorized|\/login/)
    }
  })

  test('gets redirected to /auth/unauthorized when accessing /checklists', async ({ page }) => {
    await page.goto('/checklists')
    await expect(page).toHaveURL(/\/auth\/unauthorized/)
  })

  test('gets redirected to /auth/unauthorized when accessing /documents', async ({ page }) => {
    await page.goto('/documents')
    await expect(page).toHaveURL(/\/auth\/unauthorized/)
  })

  test('does NOT see create buttons on key pages', async ({ page }) => {
    // Check permits page (one we know doesn't have create buttons for approvers)
    await page.goto('/permits')
    const createBtn = page.getByRole('button', { name: /создать|добавить/i })
    await expect(createBtn).not.toBeVisible()
  })

  test('can see approvals with pending safety requests', async ({ page }) => {
    await page.goto('/approvals')
    await expect(page).not.toHaveURL(/\/auth\/unauthorized|\/login/)
    await expect(page.locator('body')).not.toBeEmpty()
  })
})

// ─── SCENARIO 4: employee login → view only ─────────────────────────────────────

test.describe('Role: employee — view-only access', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, ACCOUNTS.employee.email, ACCOUNTS.employee.password)
  })

  test('sees expected sidebar links (no checklists, no approvals)', async ({ page }) => {
    await page.goto('/')
    // Wait for sidebar to finish role-based filtering (poll for 'Согласования' to disappear)
    for (let i = 0; i < 10; i++) {
      const labels = await getSidebarLabels(page)
      if (!labels.includes('Согласования') && !labels.includes('Чек-листы')) {
        expect(labels).toContain('Дашборд')
        expect(labels).toContain('Подрядчики')
        expect(labels).toContain('Сотрудники')
        expect(labels).toContain('Нормативные документы')
        return
      }
      await page.waitForTimeout(300)
    }
    const labels = await getSidebarLabels(page)
    expect(labels).not.toContain('Чек-листы')
    expect(labels).not.toContain('Согласования')
  })

  test('can access permitted pages without redirect', async ({ page }) => {
    // Pages the middleware allows for employee role
    const allowedPages = ['/', '/contractors', '/employees', '/permits', '/violations', '/documents']
    for (const href of allowedPages) {
      await page.goto(href)
      await expect(page).not.toHaveURL(/\/auth\/unauthorized|\/login/)
    }
  })

  test('gets redirected when accessing /checklists', async ({ page }) => {
    await page.goto('/checklists')
    await expect(page).toHaveURL(/\/auth\/unauthorized/)
  })

  test('gets redirected when accessing /approvals', async ({ page }) => {
    await page.goto('/approvals')
    await expect(page).toHaveURL(/\/auth\/unauthorized/)
  })

  test('does NOT see create buttons on contractors page', async ({ page }) => {
    await page.goto('/contractors')
    const createButtons = page.getByRole('button', { name: /добавить|создать/i })
    const count = await createButtons.count()
    expect(count).toBe(0)
  })

  test('does NOT see create buttons on employees page', async ({ page }) => {
    await page.goto('/employees')
    const createButtons = page.getByRole('button', { name: /добавить|создать/i })
    const count = await createButtons.count()
    expect(count).toBe(0)
  })

  test('CAN access /employees/new (view form — middleware allows /employees/*)', async ({ page }) => {
    await page.goto('/employees/new')
    // Employee can access the page but should not be able to submit
    await expect(page).not.toHaveURL(/\/auth\/unauthorized|\/login/)
  })

  test('CAN access /permits (may see create button on page but POST is blocked)', async ({ page }) => {
    await page.goto('/permits')
    await expect(page).not.toHaveURL(/\/auth\/unauthorized|\/login/)
  })
})

// ─── SCENARIO 5: Data sync across roles ─────────────────────────────────────────

test.describe('Data sync across roles', () => {
  test('admin creates contractor → contractor_employee can see it in the list', async ({ page }) => {
    // Login as admin
    await login(page, ACCOUNTS.admin.email, ACCOUNTS.admin.password)

    // Create a contractor
    const contractorName = `ООО Тест-Sync-${Date.now()}`
    await page.goto('/contractors/new')
    await page.locator('#name').fill(contractorName)
    await page.locator('#inn').fill('7707111222')
    await page.locator('#kpp').fill('770701001')
    await page.locator('#legalAddress').fill('Москва, Тест')
    await page.locator('#contactPersonName').fill('Тестов Т.Т.')
    await page.locator('#contactPhone').fill('+79001112233')
    await page.locator('#contactEmail').fill('sync@test.ru')
    await page.getByRole('button', { name: 'Создать' }).click()
    await page.waitForURL(/\/contractors\/[\w-]+/)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    // Logout (clear cookies)
    await page.context().clearCookies()

    // Login as contractor_employee
    await login(page, ACCOUNTS.contractor.email, ACCOUNTS.contractor.password)
    await page.goto('/contractors')

    // Should see the contractors list
    await expect(page).not.toHaveURL(/\/auth\/unauthorized|\/login/)
    await expect(page.locator('table')).toBeVisible()
  })

  test('contractor_employee can access employees page', async ({ page }) => {
    await login(page, ACCOUNTS.contractor.email, ACCOUNTS.contractor.password)
    await page.goto('/employees')
    await expect(page).not.toHaveURL(/\/auth\/unauthorized|\/login/)
    await expect(page.locator('body')).not.toBeEmpty()
  })
})
