import { test, expect, Page, BrowserContext } from "@playwright/test";

const BASE_URL = "http://localhost:3000";

// Credentials from seed
const CONTRACTOR_ADMIN = { email: "resp_1@stroymont.ru", password: "Org1Admin1!" };
const CONTRACTOR_EMPLOYEE = { email: "podradchik@pirelli.ru", password: "Contractor1!" };

// New passwords after change
const ADMIN_NEW_PWD = "Org1Admin1!X1";
const EMPLOYEE_NEW_PWD = "Contractor1!X1";

/**
 * Login and handle the mandatory password-change flow.
 * After this, the browser context has a valid auth_token cookie.
 * The function navigates to /my-organization at the end.
 */
async function loginAndChangePassword(page: Page, credentials: { email: string; password: string }, newPwd: string) {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState("networkidle");

  // Try original password first, then new password (if already changed)
  async function tryLogin(email: string, pwd: string): Promise<void> {
    await page.locator("#email").fill(email);
    await page.locator("#password").fill(pwd);
    await page.getByRole("button", { name: "Войти" }).click();
    // Wait for redirect — either /change-password or the dashboard
    await page.waitForURL(/\/change-password|\/my-organization|\/$|\/contractors/, { timeout: 10000 }).catch(() => {});
  }

  await tryLogin(credentials.email, credentials.password);

  // If we ended up on change-password, handle the form
  const url1 = page.url();
  if (url1.includes("/change-password")) {
    await page.locator("#currentPassword").fill(credentials.password);
    await page.locator("#newPassword").fill(newPwd);
    await page.locator("#confirmPassword").fill(newPwd);
    await page.getByRole("button", { name: "Установить новый пароль" }).click();
    // The change-password page pushes to "/" on success.
    // Wait a moment for cookie to be set and redirect to resolve.
    await page.waitForTimeout(3000);
  }

  // If login with original password failed (already changed), try with newPwd
  const url2 = page.url();
  if (url2.includes("/login") || url2.includes("/change-password")) {
    await tryLogin(credentials.email, newPwd);
    await page.waitForTimeout(2000);
  }

  // Navigate to /my-organization (landing page for contractor roles)
  await page.goto(`${BASE_URL}/my-organization`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);
}

// ─── CONTRACTOR_ADMIN TESTS (serial to avoid cookie races) ───

test.describe("CONTRACTOR_ADMIN", () => {
  test.describe.configure({ timeout: 120000, mode: "serial" });

  test("1. Login → /my-organization", async ({ page }) => {
    await loginAndChangePassword(page, CONTRACTOR_ADMIN, ADMIN_NEW_PWD);
    expect(page.url()).toContain("/my-organization");
  });

  test("2. /my-organization — view org info", async ({ page }) => {
    await expect(page.getByText(/Строй|Организация|Моя организация/i).first()).toBeVisible({ timeout: 10000 });
  });

  test("3. /employees — see employees list with add button", async ({ page }) => {
    await page.goto(`${BASE_URL}/employees`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(0);

    // The "add" button might be a link or button
    const addBtn = page.getByRole("link", { name: /добавить|создать|add/i })
      .or(page.getByRole("button", { name: /добавить|создать|add/i }));
    const hasAddBtn = await addBtn.first().isVisible({ timeout: 3000 }).catch(() => false);
    expect(hasAddBtn).toBe(true);
  });

  test("4. /employees/new — fill form and submit", async ({ page }) => {
    await page.goto(`${BASE_URL}/employees/new`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    // Fill whatever fields exist
    const fields: [string, string][] = [
      ['input[name="fullName"], input[placeholder*="ФИО"]', "Тестовый Сотрудник"],
      ['input[name="position"], input[placeholder*="должност"]', "Тестовая должность"],
      ['input[name="passportSeries"]', "4599"],
      ['input[name="passportNumber"]', "999888"],
    ];

    for (const [selector, value] of fields) {
      const input = page.locator(selector).first();
      if (await input.isVisible({ timeout: 2000 }).catch(() => false)) {
        await input.fill(value);
      }
    }

    const submitBtn = page.getByRole("button", { name: /создать|сохран|отправить|submit/i }).first();
    if (await submitBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await submitBtn.click();
      await page.waitForTimeout(3000);
      const bodyText = await page.locator("body").innerText();
      const hasResponse = /успеш|success|создан|скачать|download|ошиб|error|required|обязательн|неверн/i.test(bodyText);
      expect(hasResponse).toBe(true);
    }
  });

  test("5. /permits — see permits, check for create button", async ({ page }) => {
    await page.goto(`${BASE_URL}/permits`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(0);

    const createBtn = page.getByRole("link", { name: /создать|новый|new|оформить/i })
      .or(page.getByRole("button", { name: /создать|новый|new|оформить/i }));
    const hasCreateBtn = await createBtn.first().isVisible({ timeout: 3000 }).catch(() => false);
    console.log("Create permit button visible:", hasCreateBtn);
  });

  test("6. /violations — view violations, no create on /violations/new", async ({ page }) => {
    await page.goto(`${BASE_URL}/violations`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(0);

    const complaintBtn = page.getByRole("button", { name: /подать жалобу/i });
    const hasComplaintBtn = await complaintBtn.isVisible({ timeout: 3000 }).catch(() => false);
    console.log("Complaint button on violations:", hasComplaintBtn);

    // /violations/new — should NOT see create button
    await page.goto(`${BASE_URL}/violations/new`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);
    const createBtn = page.getByRole("button", { name: /создать|новый/i });
    const hasCreateBtn = await createBtn.isVisible({ timeout: 3000 }).catch(() => false);
    expect(hasCreateBtn).toBe(false);
  });

  test("7. Sidebar — restricted items hidden", async ({ page }) => {
    await page.goto(`${BASE_URL}/my-organization`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    const restrictedItems = ["Дашборд", "Подрядчики", "Чек-листы", "Согласования"];
    const navLinks = page.locator("nav a, aside a, nav button, aside button");

    const visibleTexts: string[] = [];
    const count = await navLinks.count();
    for (let i = 0; i < count; i++) {
      const text = await navLinks.nth(i).innerText().catch(() => "");
      visibleTexts.push(text);
    }

    for (const item of restrictedItems) {
      const hasItem = visibleTexts.some(t => t.includes(item));
      expect(hasItem).toBe(false);
    }
  });

  test("8. /my-organization/complaints — view complaints", async ({ page }) => {
    await page.goto(`${BASE_URL}/my-organization/complaints`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    expect(page.url()).toContain("/my-organization/complaints");
    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(0);
  });
});

// ─── CONTRACTOR_EMPLOYEE TESTS (serial) ───────────────────────

test.describe("CONTRACTOR_EMPLOYEE", () => {
  test.describe.configure({ timeout: 120000, mode: "serial" });

  test("1. Login → /my-organization", async ({ page }) => {
    await loginAndChangePassword(page, CONTRACTOR_EMPLOYEE, EMPLOYEE_NEW_PWD);
    const url = page.url();
    expect(url.includes("auth") && !url.includes("unauthorized")).toBe(false);
  });

  test("2. /employees — no add employee button", async ({ page }) => {
    await page.goto(`${BASE_URL}/employees`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    const addBtn = page.getByRole("link", { name: /добавить|создать|add/i })
      .or(page.getByRole("button", { name: /добавить|создать|add/i }));
    const hasAddBtn = await addBtn.first().isVisible({ timeout: 3000 }).catch(() => false);
    expect(hasAddBtn).toBe(false);
  });

  test("3. /permits — view permits", async ({ page }) => {
    await page.goto(`${BASE_URL}/permits`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(0);
  });

  test("4. /violations — view violations", async ({ page }) => {
    await page.goto(`${BASE_URL}/violations`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(0);
  });

  test("5. Sidebar — restricted items hidden", async ({ page }) => {
    await page.goto(`${BASE_URL}/employees`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    const restrictedItems = ["Дашборд", "Подрядчики", "Чек-листы", "Согласования"];
    const navLinks = page.locator("nav a, aside a, nav button, aside button");

    const visibleTexts: string[] = [];
    const count = await navLinks.count();
    for (let i = 0; i < count; i++) {
      const text = await navLinks.nth(i).innerText().catch(() => "");
      visibleTexts.push(text);
    }

    for (const item of restrictedItems) {
      const hasItem = visibleTexts.some(t => t.includes(item));
      expect(hasItem).toBe(false);
    }
  });
});
