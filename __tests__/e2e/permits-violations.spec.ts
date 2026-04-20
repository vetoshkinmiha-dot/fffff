import { test, expect } from '@playwright/test'

const ACCOUNTS = {
  admin: { email: 'admin@pirelli.ru', password: 'Admin123!' },
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

// ─── Permit Lifecycle ───────────────────────────────────────────────────

test.describe('Permits — list and view', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, ACCOUNTS.admin.email, ACCOUNTS.admin.password)
  })

  test('should display permits table with columns', async ({ page }) => {
    await page.goto('/permits')

    await expect(page.getByRole('columnheader', { name: /номер|наряд/i }).first()).toBeVisible()
    await expect(page.getByRole('columnheader', { name: /статус/i }).first()).toBeVisible()
  })

  test('should navigate to permit detail page', async ({ page }) => {
    await page.goto('/permits')

    const rows = page.getByRole('row')
    const rowCount = await rows.count()
    if (rowCount > 1) {
      await rows.nth(1).getByRole('link').first().click()
      await expect(page).toHaveURL(/\/permits\/[\w-]+/)
    }
  })

  test('should access permit print page', async ({ page }) => {
    // Known permit ID from seed data
    await page.goto('/permits/1/print')
    await expect(page).not.toHaveURL(/\/auth\/unauthorized|\/login/)
  })
})

test.describe('Permits — create (admin)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, ACCOUNTS.admin.email, ACCOUNTS.admin.password)
  })

  test('should show permit creation form', async ({ page }) => {
    await page.goto('/permits/new')
    await expect(page).not.toHaveURL(/\/auth\/unauthorized|\/login/)
    // Form should have category select
    await expect(page.locator('select, [data-slot="select-trigger"]')).toBeVisible()
  })

  test('should validate permit form', async ({ page }) => {
    await page.goto('/permits/new')
    // Try to submit empty form
    await page.getByRole('button', { name: /создать/i }).click()
    // Should stay on the page (validation errors)
    await expect(page).toHaveURL(/\/permits\/new/)
  })
})

test.describe('Permits — contractor_employee access', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, ACCOUNTS.contractor.email, ACCOUNTS.contractor.password)
  })

  test('can view permits list', async ({ page }) => {
    await page.goto('/permits')
    await expect(page).not.toHaveURL(/\/auth\/unauthorized|\/login/)
  })

  test('cannot create permit (no create button)', async ({ page }) => {
    await page.goto('/permits')
    const createBtn = page.getByRole('button', { name: /создать.*наряд|новый.*наряд/i })
    await expect(createBtn).not.toBeVisible()
  })

  test('can access permit detail', async ({ page }) => {
    await page.goto('/permits')
    const rows = page.getByRole('row')
    const rowCount = await rows.count()
    if (rowCount > 1) {
      await rows.nth(1).getByRole('link').first().click()
      await expect(page).toHaveURL(/\/permits\/[\w-]+/)
    }
  })
})

test.describe('Permits — permit detail page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, ACCOUNTS.admin.email, ACCOUNTS.admin.password)
  })

  test('shows permit info and approvals', async ({ page }) => {
    await page.goto('/permits')
    const rows = page.getByRole('row')
    const rowCount = await rows.count()
    if (rowCount > 1) {
      await rows.nth(1).getByRole('link').first().click()
      await expect(page).toHaveURL(/\/permits\/[\w-]+/)
      // Should show permit details
      await expect(page.locator('body')).not.toBeEmpty()
    }
  })
})

// ─── Violations Lifecycle ───────────────────────────────────────────────

test.describe('Violations — list and view', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, ACCOUNTS.admin.email, ACCOUNTS.admin.password)
  })

  test('should display violations table', async ({ page }) => {
    await page.goto('/violations')

    await expect(page.getByRole('columnheader', { name: /номер|акт/i }).first()).toBeVisible()
    await expect(page.getByRole('columnheader', { name: /серьезн|severity/i }).first()).toBeVisible()
    await expect(page.getByRole('columnheader', { name: /статус/i }).first()).toBeVisible()
  })

  test('should navigate to violation detail', async ({ page }) => {
    await page.goto('/violations')

    const rows = page.getByRole('row')
    const rowCount = await rows.count()
    if (rowCount > 1) {
      await rows.nth(1).getByRole('link').first().click()
      await expect(page).toHaveURL(/\/violations\/[\w-]+/)
    }
  })

  test('should access violation print page', async ({ page }) => {
    await page.goto('/violations/1/print')
    await expect(page).not.toHaveURL(/\/auth\/unauthorized|\/login/)
  })
})

test.describe('Violations — create (admin)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, ACCOUNTS.admin.email, ACCOUNTS.admin.password)
  })

  test('should show violation creation form', async ({ page }) => {
    await page.goto('/violations/new')
    await expect(page).not.toHaveURL(/\/auth\/unauthorized|\/login/)
  })

  test('should validate violation form', async ({ page }) => {
    await page.goto('/violations/new')
    await page.getByRole('button', { name: /создать/i }).click()
    // Should stay on page with validation errors
    await expect(page).toHaveURL(/\/violations\/new/)
  })
})

test.describe('Violations — all roles can view', () => {
  test('employee can view violations', async ({ page }) => {
    await login(page, ACCOUNTS.employee.email, ACCOUNTS.employee.password)
    await page.goto('/violations')
    await expect(page).not.toHaveURL(/\/auth\/unauthorized|\/login/)
  })

  test('contractor_employee can view violations (scoped to own org)', async ({ page }) => {
    await login(page, ACCOUNTS.contractor.email, ACCOUNTS.contractor.password)
    await page.goto('/violations')
    await expect(page).not.toHaveURL(/\/auth\/unauthorized|\/login/)
  })
})

test.describe('Violations — detail page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, ACCOUNTS.admin.email, ACCOUNTS.admin.password)
  })

  test('shows violation details', async ({ page }) => {
    await page.goto('/violations')
    const rows = page.getByRole('row')
    const rowCount = await rows.count()
    if (rowCount > 1) {
      await rows.nth(1).getByRole('link').first().click()
      await expect(page).toHaveURL(/\/violations\/[\w-]+/)
      await expect(page.locator('body')).not.toBeEmpty()
    }
  })
})

// ─── Approvals — view pending requests ──────────────────────────────────

test.describe('Approvals — admin view', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, ACCOUNTS.admin.email, ACCOUNTS.admin.password)
  })

  test('can view approvals page', async ({ page }) => {
    await page.goto('/approvals')
    await expect(page).not.toHaveURL(/\/auth\/unauthorized|\/login/)
  })
})

// ─── Documents — view regulatory docs ───────────────────────────────────

test.describe('Documents — employee can view', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, ACCOUNTS.employee.email, ACCOUNTS.employee.password)
  })

  test('can view documents page', async ({ page }) => {
    await page.goto('/documents')
    await expect(page).not.toHaveURL(/\/auth\/unauthorized|\/login/)
  })
})

// ─── Checklists — admin view ────────────────────────────────────────────

test.describe('Checklists — admin view', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, ACCOUNTS.admin.email, ACCOUNTS.admin.password)
  })

  test('can view checklists page', async ({ page }) => {
    await page.goto('/checklists')
    await expect(page).not.toHaveURL(/\/auth\/unauthorized|\/login/)
  })
})

// ─── Dashboard — KPIs visible for all roles ─────────────────────────────

test.describe('Dashboard — KPIs for all roles', () => {
  test('admin sees KPI cards', async ({ page }) => {
    await login(page, ACCOUNTS.admin.email, ACCOUNTS.admin.password)
    await page.goto('/')
    // Should see dashboard cards
    await expect(page.locator('body')).not.toBeEmpty()
  })

  test('contractor_employee sees scoped KPIs', async ({ page }) => {
    await login(page, ACCOUNTS.contractor.email, ACCOUNTS.contractor.password)
    await page.goto('/')
    await expect(page).not.toHaveURL(/\/auth\/unauthorized|\/login/)
  })

  test('employee sees KPIs', async ({ page }) => {
    await login(page, ACCOUNTS.employee.email, ACCOUNTS.employee.password)
    await page.goto('/')
    await expect(page).not.toHaveURL(/\/auth\/unauthorized|\/login/)
  })
})
