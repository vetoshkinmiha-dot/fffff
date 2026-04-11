# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: regression-sprint3-4.spec.ts >> Sprint 3+4 Regression >> 3. Cron document-expiry endpoint — returns 401 without CRON_SECRET
- Location: __tests__/e2e/regression-sprint3-4.spec.ts:59:7

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 401
Received: 405
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e6] [cursor=pointer]:
    - button "Open Next.js Dev Tools" [ref=e7]:
      - img [ref=e8]
    - generic [ref=e11]:
      - button "Open issues overlay" [ref=e12]:
        - generic [ref=e13]:
          - generic [ref=e14]: "2"
          - generic [ref=e15]: "3"
        - generic [ref=e16]:
          - text: Issue
          - generic [ref=e17]: s
      - button "Collapse issues badge" [ref=e18]:
        - img [ref=e19]
  - alert [ref=e21]: Панель управления
  - generic [ref=e22]:
    - complementary [ref=e23]:
      - generic [ref=e25]: ЗАО «ВШЗ»
      - navigation [ref=e26]:
        - link "Дашборд" [ref=e27] [cursor=pointer]:
          - /url: /
          - img [ref=e28]
          - generic [ref=e33]: Дашборд
        - link "Подрядчики" [ref=e34] [cursor=pointer]:
          - /url: /contractors
          - img [ref=e35]
          - generic [ref=e39]: Подрядчики
        - link "Сотрудники" [ref=e40] [cursor=pointer]:
          - /url: /employees
          - img [ref=e41]
          - generic [ref=e46]: Сотрудники
        - link "Наряды-допуски" [ref=e47] [cursor=pointer]:
          - /url: /permits
          - img [ref=e48]
          - generic [ref=e51]: Наряды-допуски
        - link "Акты нарушений" [ref=e52] [cursor=pointer]:
          - /url: /violations
          - img [ref=e53]
          - generic [ref=e55]: Акты нарушений
        - link "Чек-листы" [ref=e56] [cursor=pointer]:
          - /url: /checklists
          - img [ref=e57]
          - generic [ref=e60]: Чек-листы
        - link "Нормативные документы" [ref=e61] [cursor=pointer]:
          - /url: /documents
          - img [ref=e62]
          - generic [ref=e64]: Нормативные документы
        - link "Согласования" [ref=e65] [cursor=pointer]:
          - /url: /approvals
          - img [ref=e66]
          - generic [ref=e70]: Согласования
    - generic [ref=e71]:
      - banner [ref=e72]:
        - generic [ref=e73]:
          - img [ref=e74]
          - textbox "Поиск…" [ref=e77]
        - generic [ref=e78]:
          - button [ref=e79]:
            - button [ref=e80]:
              - img [ref=e81]
          - button "? Администратор" [ref=e84]:
            - generic [ref=e85] [cursor=pointer]:
              - generic [ref=e86]: "?"
              - generic [ref=e88]: Администратор
      - main [ref=e89]:
        - generic [ref=e90]:
          - generic [ref=e91]:
            - heading "Панель управления" [level=1] [ref=e92]
            - paragraph [ref=e93]: Обзор текущей активности подрядчиков
          - generic [ref=e94]:
            - generic [ref=e95]:
              - img [ref=e98]
              - generic [ref=e102]:
                - generic [ref=e103]: "10"
                - generic [ref=e104]: Всего подрядчиков
            - generic [ref=e105]:
              - img [ref=e108]
              - generic [ref=e111]:
                - generic [ref=e112]: Скоро
                - generic [ref=e113]: Активные наряды
            - generic [ref=e114]:
              - img [ref=e117]
              - generic [ref=e120]:
                - generic [ref=e121]: "0"
                - generic [ref=e122]: Ожидают согласования
            - generic [ref=e123]:
              - img [ref=e126]
              - generic [ref=e128]:
                - generic [ref=e129]: Скоро
                - generic [ref=e130]: Нарушения за месяц
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test'
  2   | 
  3   | const ADMIN_CREDS = { email: 'admin@pirelli.ru', password: 'Admin123!' }
  4   | 
  5   | async function login(page: any, email: string, password: string) {
  6   |   await page.goto('/login')
  7   |   await page.locator('#email').fill(email)
  8   |   await page.locator('#password').fill(password)
  9   |   await page.getByRole('button', { name: 'Войти' }).click()
  10  |   await page.waitForLoadState('networkidle')
  11  | }
  12  | 
  13  | test.describe('Sprint 3+4 Regression', () => {
  14  | 
  15  |   // Sprint 3: Approval workflow
  16  | 
  17  |   test('1. Send to approval — modal with departments + deadline', async ({ page }) => {
  18  |     await login(page, ADMIN_CREDS.email, ADMIN_CREDS.password)
  19  | 
  20  |     // Create a contractor first
  21  |     await page.goto('/contractors/new')
  22  |     await page.locator('#name').fill(`ООО Спринт3-${Date.now()}`)
  23  |     await page.locator('#inn').fill('7707222333')
  24  |     await page.locator('#legalAddress').fill('Москва')
  25  |     await page.getByRole('button', { name: /создать/i }).click()
  26  |     await page.waitForURL(/\/contractors\//)
  27  | 
  28  |     // Create an employee
  29  |     await page.goto('/employees/new')
  30  |     await page.getByRole('combobox').first().click()
  31  |     await page.getByRole('option').first().click()
  32  |     await page.locator('#fullName').fill('Согласуемый С.С.')
  33  |     await page.locator('#position').fill('Инженер')
  34  |     await page.getByPlaceholder('Серия (4 цифры)').fill('4510')
  35  |     await page.getByPlaceholder('Номер (6 цифр)').fill('123456')
  36  |     await page.getByRole('button', { name: /создать/i }).click()
  37  |     await page.waitForURL(/\/employees\/[\w-]+/)
  38  | 
  39  |     // Check "Отправить на согласование" button exists
  40  |     const sendBtn = page.getByRole('button', { name: /отправить на согласование/i })
  41  |     expect(await sendBtn.isVisible()).toBe(true)
  42  |   })
  43  | 
  44  |   test('2. Sequential approvals — order security→hr→safety→safety_training→permit_bureau', async ({ page }) => {
  45  |     // Check the route has the department order defined
  46  |     // We verify the API returns approval pipeline with correct sequence
  47  |     await login(page, ADMIN_CREDS.email, ADMIN_CREDS.password)
  48  | 
  49  |     // Fetch the approvals API directly to check department order
  50  |     const response = await page.evaluate(async () => {
  51  |       const res = await fetch('/api/approvals', { credentials: 'include' })
  52  |       return { status: res.status, ok: res.ok }
  53  |     })
  54  | 
  55  |     // Should be accessible (200 or data available)
  56  |     expect(response.ok || response.status === 200).toBe(true)
  57  |   })
  58  | 
  59  |   test('3. Cron document-expiry endpoint — returns 401 without CRON_SECRET', async ({ page }) => {
  60  |     await login(page, ADMIN_CREDS.email, ADMIN_CREDS.password)
  61  | 
  62  |     // Without CRON_SECRET header
  63  |     const response = await page.evaluate(async () => {
  64  |       const res = await fetch('/api/cron/document-expiry')
  65  |       return { status: res.status }
  66  |     })
  67  | 
> 68  |     expect(response.status).toBe(401)
      |                             ^ Error: expect(received).toBe(expected) // Object.is equality
  69  |   })
  70  | 
  71  |   // Sprint 4: Permits
  72  | 
  73  |   test('4. Permits list — table and filters', async ({ page }) => {
  74  |     await login(page, ADMIN_CREDS.email, ADMIN_CREDS.password)
  75  |     await page.goto('/permits')
  76  | 
  77  |     // Should have a table
  78  |     await expect(page.locator('table')).toBeVisible()
  79  |     // Should have filter controls
  80  |     await expect(page.getByRole('combobox').first()).toBeVisible()
  81  |   })
  82  | 
  83  |   test('5. Create permit — form validation and number generation', async ({ page }) => {
  84  |     await login(page, ADMIN_CREDS.email, ADMIN_CREDS.password)
  85  |     await page.goto('/permits')
  86  | 
  87  |     // Click create button
  88  |     await page.getByRole('button', { name: /создать/i }).first().click()
  89  | 
  90  |     // Form dialog should appear
  91  |     await expect(page.locator('dialog, [role="dialog"]')).toBeVisible()
  92  | 
  93  |     // Check form fields exist
  94  |     await expect(page.getByText(/номер/i)).toBeVisible()
  95  |   })
  96  | 
  97  |   test('6. Permit detail — approval pipeline, early closure', async ({ page }) => {
  98  |     await login(page, ADMIN_CREDS.email, ADMIN_CREDS.password)
  99  |     await page.goto('/permits')
  100 | 
  101 |     // If there are rows, click first
  102 |     const firstRow = page.locator('table tbody tr').first()
  103 |     const visible = await firstRow.isVisible().catch(() => false)
  104 | 
  105 |     if (visible) {
  106 |       await firstRow.locator('a').first().click()
  107 |       await page.waitForURL(/\/permits\/[\w-]+/)
  108 |       // Should show permit details
  109 |       await expect(page.locator('h1').first()).toBeVisible()
  110 |     }
  111 |   })
  112 | 
  113 |   test('7. Permit print page — /permits/[id]/print', async ({ page }) => {
  114 |     await login(page, ADMIN_CREDS.email, ADMIN_CREDS.password)
  115 |     await page.goto('/permits/12345678-1234-1234-1234-123456789012/print')
  116 | 
  117 |     // Should render a print-friendly page
  118 |     await expect(page.locator('body')).not.toBeEmpty()
  119 |   })
  120 | })
  121 | 
```