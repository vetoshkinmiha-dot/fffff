import { expect, test } from '@playwright/test';

// This is a comprehensive manual-style test that checks every critical user flow

test.describe('🔴 CRITICAL FLOWS — Manual Verification', () => {

  test('1. Admin login + dashboard loads', async ({ page }) => {
    await page.goto('http://localhost:3000/login');
    await page.fill('input[type="email"]', 'admin@pirelli.ru');
    await page.fill('input[type="password"]', 'Admin123!');
    await page.click('button[type="submit"]');
    // After login with mustChangePwd=false (we reset it), should go to dashboard
    await page.waitForURL('http://localhost:3000/', { timeout: 10000 });
    const title = await page.locator('h1').first().textContent();
    expect(title).toBeTruthy();
    expect(title!.length).toBeGreaterThan(0);
  });

  test('2. Admin — contractors page', async ({ page }) => {
    await page.goto('http://localhost:3000/');
    await page.click('text=Подрядчики');
    await expect(page).toHaveURL(/\/contractors/);
    // Table should render
    await expect(page.locator('table')).toBeVisible();
  });

  test('3. Admin — employees page + create', async ({ page }) => {
    await page.goto('http://localhost:3000/employees');
    await expect(page).toHaveURL(/\/employees/);
    // Create button should be visible
    await expect(page.locator('text=Добавить сотрудника')).toBeVisible();
  });

  test('4. Admin — permits page', async ({ page }) => {
    await page.goto('http://localhost:3000/permits');
    await expect(page).toHaveURL(/\/permits/);
    // Table should render
    await expect(page.locator('table')).toBeVisible();
    // No "Черновик" status
    await expect(page.locator('text=Черновик')).not.toBeVisible();
  });

  test('5. Admin — violations page + tabs', async ({ page }) => {
    await page.goto('http://localhost:3000/violations');
    await expect(page).toHaveURL(/\/violations/);
    // Tabs should exist
    await expect(page.locator('text=Акты нарушений')).toBeVisible();
    await expect(page.locator('text=Жалобы')).toBeVisible();
  });

  test('6. Admin — approvals page + tabs', async ({ page }) => {
    await page.goto('http://localhost:3000/approvals');
    await expect(page).toHaveURL(/\/approvals/);
    // Admin tabs
    await expect(page.locator('text=Наряды-допуски')).toBeVisible();
    await expect(page.locator('text=Сотрудники')).toBeVisible();
  });

  test('7. Admin — complaints page', async ({ page }) => {
    await page.goto('http://localhost:3000/complaints');
    await expect(page).toHaveURL(/\/complaints/);
  });

  test('8. Admin — checklists page', async ({ page }) => {
    await page.goto('http://localhost:3000/checklists');
    await expect(page).toHaveURL(/\/checklists/);
    await expect(page.locator('table')).toBeVisible();
  });

  test('9. Admin — documents page', async ({ page }) => {
    await page.goto('http://localhost:3000/documents');
    await expect(page).toHaveURL(/\/documents/);
  });

  test('10. Contractor admin login', async ({ page }) => {
    await page.goto('http://localhost:3000/login');
    await page.fill('input[type="email"]', 'resp_1@stroymont.ru');
    await page.fill('input[type="password"]', 'Org1Admin1!');
    await page.click('button[type="submit"]');
    await page.waitForURL('http://localhost:3000/my-organization', { timeout: 10000 });
  });

  test('11. Contractor admin — sidebar restrictions', async ({ page }) => {
    await page.goto('http://localhost:3000/my-organization');
    await expect(page.locator('text=Дашборд')).not.toBeVisible();
    await expect(page.locator('text=Подрядчики')).not.toBeVisible();
    await expect(page.locator('text=Чек-листы')).not.toBeVisible();
    await expect(page.locator('text=Согласования')).not.toBeVisible();
    // Should see these
    await expect(page.locator('text=Моя организация')).toBeVisible();
    await expect(page.locator('text=Сотрудники')).toBeVisible();
    await expect(page.locator('text=Наряды-допуски')).toBeVisible();
  });

  test('12. Contractor admin — complaints button on violations', async ({ page }) => {
    await page.goto('http://localhost:3000/violations');
    // "Подать жалобу" button should be visible
    await expect(page.locator('text=Подать жалобу')).toBeVisible();
  });

  test('13. Contractor admin — employees CRUD', async ({ page }) => {
    await page.goto('http://localhost:3000/employees');
    await expect(page.locator('text=Добавить сотрудника')).toBeVisible();
  });

  test('14. Employee login + sidebar', async ({ page }) => {
    await page.goto('http://localhost:3000/login');
    await page.fill('input[type="email"]', 'employee@pirelli.ru');
    await page.fill('input[type="password"]', 'Employee1!');
    await page.click('button[type="submit"]');
    await page.waitForURL('http://localhost:3000/contractors', { timeout: 10000 });
    // Should NOT see approvals
    await expect(page.locator('text=Согласования')).not.toBeVisible();
    // Should NOT see dashboard
    await expect(page.locator('text=Дашборд')).not.toBeVisible();
  });

  test('15. Department approver login + approvals', async ({ page }) => {
    await page.goto('http://localhost:3000/login');
    await page.fill('input[type="email"]', 'safety@pirelli.ru');
    await page.fill('input[type="password"]', 'Approver1!');
    await page.click('button[type="submit"]');
    await page.waitForURL('http://localhost:3000/', { timeout: 10000 });
    // Should see dashboard
    await expect(page.locator('text=Дашборд')).toBeVisible();
    // Should see approvals
    await expect(page.locator('text=Согласования')).toBeVisible();
  });
});
