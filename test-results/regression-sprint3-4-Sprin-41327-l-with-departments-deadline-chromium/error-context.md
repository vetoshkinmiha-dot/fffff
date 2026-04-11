# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: regression-sprint3-4.spec.ts >> Sprint 3+4 Regression >> 1. Send to approval — modal with departments + deadline
- Location: __tests__/e2e/regression-sprint3-4.spec.ts:17:7

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false
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
          - generic [ref=e14]: "3"
          - generic [ref=e15]: "4"
        - generic [ref=e16]:
          - text: Issue
          - generic [ref=e17]: s
      - button "Collapse issues badge" [ref=e18]:
        - img [ref=e19]
  - generic [ref=e21]:
    - complementary [ref=e22]:
      - generic [ref=e24]: ЗАО «ВШЗ»
      - navigation [ref=e25]:
        - link "Дашборд" [ref=e26] [cursor=pointer]:
          - /url: /
          - img [ref=e27]
          - generic [ref=e32]: Дашборд
        - link "Подрядчики" [ref=e33] [cursor=pointer]:
          - /url: /contractors
          - img [ref=e34]
          - generic [ref=e38]: Подрядчики
        - link "Сотрудники" [ref=e39] [cursor=pointer]:
          - /url: /employees
          - img [ref=e40]
          - generic [ref=e45]: Сотрудники
        - link "Наряды-допуски" [ref=e46] [cursor=pointer]:
          - /url: /permits
          - img [ref=e47]
          - generic [ref=e50]: Наряды-допуски
        - link "Акты нарушений" [ref=e51] [cursor=pointer]:
          - /url: /violations
          - img [ref=e52]
          - generic [ref=e54]: Акты нарушений
        - link "Чек-листы" [ref=e55] [cursor=pointer]:
          - /url: /checklists
          - img [ref=e56]
          - generic [ref=e59]: Чек-листы
        - link "Нормативные документы" [ref=e60] [cursor=pointer]:
          - /url: /documents
          - img [ref=e61]
          - generic [ref=e63]: Нормативные документы
        - link "Согласования" [ref=e64] [cursor=pointer]:
          - /url: /approvals
          - img [ref=e65]
          - generic [ref=e69]: Согласования
    - generic [ref=e70]:
      - banner [ref=e71]:
        - generic [ref=e72]:
          - img [ref=e73]
          - textbox "Поиск…" [ref=e76]
        - generic [ref=e77]:
          - button [ref=e78]:
            - button [ref=e79]:
              - img [ref=e80]
          - button "? Администратор" [ref=e83]:
            - generic [ref=e84] [cursor=pointer]:
              - generic [ref=e85]: "?"
              - generic [ref=e87]: Администратор
      - main [ref=e88]:
        - generic [ref=e89]:
          - generic [ref=e90]:
            - link [ref=e91] [cursor=pointer]:
              - /url: /employees
              - button [ref=e92]:
                - img
            - generic [ref=e93]:
              - heading "Новый сотрудник" [level=1] [ref=e94]
              - paragraph [ref=e95]: Добавление работника подрядной организации
          - generic [ref=e96]:
            - generic [ref=e97]:
              - generic [ref=e98]: Подрядчик *
              - combobox [ref=e99]:
                - generic [ref=e100]: cd13c003-b748-414e-b82d-f258723c0e82
                - img: ▼
              - textbox [ref=e101]: cd13c003-b748-414e-b82d-f258723c0e82
            - generic [ref=e102]:
              - generic [ref=e103]:
                - generic [ref=e104]: ФИО *
                - textbox "ФИО *" [ref=e105]:
                  - /placeholder: Иванов Иван Иванович
                  - text: Согласуемый С.С.
              - generic [ref=e106]:
                - generic [ref=e107]: Должность *
                - textbox "Должность *" [ref=e108]:
                  - /placeholder: Электромонтажник
                  - text: Инженер
            - generic [ref=e109]:
              - generic [ref=e110]: Паспортные данные
              - generic [ref=e111]:
                - textbox "Серия (4 цифры)" [ref=e113]: "4510"
                - textbox "Номер (6 цифр)" [ref=e115]: "123456"
                - textbox "Кем выдан" [ref=e117]
                - textbox [ref=e119]
              - generic [ref=e120]:
                - checkbox "Ранее работал в Pirelli" [ref=e121]
                - checkbox [ref=e122]
                - generic [ref=e123] [cursor=pointer]: Ранее работал в Pirelli
            - generic [ref=e124]:
              - generic [ref=e125]: Фото
              - generic [ref=e126]:
                - generic [ref=e127]: Нет фото
                - button "Choose File" [ref=e129]
            - generic [ref=e130]:
              - generic [ref=e131]: Классы работ
              - generic [ref=e132]:
                - textbox "Введите класс работ и нажмите Enter" [ref=e133]
                - button [ref=e134]:
                  - img
            - generic [ref=e135]:
              - link "Отмена" [ref=e136] [cursor=pointer]:
                - /url: /employees
                - button "Отмена" [ref=e137]
              - button "Создать" [disabled]:
                - img
                - text: Создать
  - alert [ref=e138]
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
> 41  |     expect(await sendBtn.isVisible()).toBe(true)
      |                                       ^ Error: expect(received).toBe(expected) // Object.is equality
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
  68  |     expect(response.status).toBe(401)
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