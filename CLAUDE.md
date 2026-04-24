# CLAUDE.md — Система управления подрядными организациями

> Читайте этот файл перед началом работы над проектом. Он даёт полный контекст новым агентам.

## О проекте

Система учёта подрядных организаций, сотрудников, наряд-допусков, нарушений и нормативных документов для завода (ВШЗ). Все интерфейсы на русском языке.

## Технологический стек

| Слой | Технология |
|---|---|
| Фреймворк | Next.js 16.2.3 (App Router) |
| Язык | TypeScript 5 (strict mode) |
| React | React 19.2.4 |
| БД | PostgreSQL (через `@prisma/adapter-pg`) |
| ORM | Prisma 7.7.0 |
| Auth | JWT (jsonwebtoken) + jose (edge), bcrypt 12 rounds, httpOnly cookies |
| Валидация | Zod 4.3.6 |
| Стилизация | Tailwind CSS 4, shadcn/ui (base-ui) |
| Иконки | Lucide React |
| Графики | Recharts |
| Email | Nodemailer |
| Файлы | Local FS (dev) / S3 (production) |
| Тесты | Vitest 4 (unit/integration), Playwright 1.59 (E2E) |

## Структура проекта

```
contractor-demo/
├── app/
│   ├── layout.tsx                    # Root layout (Inter font, ru)
│   ├── page.tsx                      # Dashboard (KPI карточки)
│   ├── types.ts                      # TypeScript интерфейсы
│   ├── globals.css
│   ├── middleware.ts                 # Edge auth — route protection + role gating
│   ├── login/page.tsx
│   ├── auth/unauthorized/page.tsx
│   ├── change-password/page.tsx
│   ├── admin/users/page.tsx
│   ├── contractors/                  # Подрядчики: list, new, [id], [id]/edit
│   ├── employees/                    # Сотрудники: list, new, [id]
│   ├── approvals/page.tsx            # Согласования (сотрудники + наряды)
│   ├── permits/                      # Наряды-допуски: list, new, [id], edit, print
│   ├── violations/                   # Нарушения: list, new, [id], print, templates
│   ├── complaints/                   # Жалобы подрядчиков
│   ├── checklists/                   # Чек-листы проверок
│   ├── documents/                    # Нормативные документы ВШЗ
│   ├── my-organization/              # Портал подрядчика
│   └── api/                          # API маршруты (37+ route.ts файлов)
│       ├── auth/                     # login, register, logout, me, refresh, change-password
│       ├── organizations/            # CRUD подрядчиков
│       ├── employees/                # CRUD сотрудников, документы, фото, согласования
│       ├── approvals/                # Решения по согласованиям
│       ├── permits/                  # CRUD нарядов, согласования нарядов
│       ├── violations/               # Нарушения, шаблоны, жалобы
│       ├── complaints/               # Жалобы подрядчиков
│       ├── checklists/               # Чек-листы + статистика
│       ├── documents/                # Нормативные документы + разделы
│       ├── cron/                     # document-expiry, permit-expiry, permit-warning
│       ├── notifications/            # Внутренние уведомления
│       ├── users/                    # Управление пользователями (admin)
│       ├── inspectors/               # Список инспекторов
│       └── dashboard/                # KPI данные
├── components/
│   ├── layout/                       # header, sidebar, root-layout
│   ├── ui/                           # shadcn/ui компоненты (15 файлов)
│   └── employees/file-upload.tsx     # Drag-and-drop загрузка файлов
├── lib/
│   ├── api-middleware.ts             # authMiddleware, requireRole, rate limiter
│   ├── auth.ts                       # bcrypt, JWT, refresh tokens
│   ├── auth-edge.ts                  # Edge JWT verify (jose)
│   ├── email.ts                      # Nodemailer + шаблоны
│   ├── file-storage.ts               # Local / S3 file upload
│   ├── notifications.ts              # In-app уведомления
│   ├── prisma.ts                     # Prisma client singleton
│   ├── s3-storage.ts                 # S3 client, presigned URLs
│   ├── utils.ts                      # cn(), sanitize()
│   ├── validations.ts                # Zod schemas для всех API
│   └── db/seed-prisma.ts             # Seed скрипт
├── prisma/
│   ├── schema.prisma                 # 20 моделей, 16 enum
│   └── migrations/20260412215501_init/
├── __tests__/                        # E2E, integration, unit тесты
└── docs/                             # ARCHITECTURE, SPEC, QA plans
```

## Ролевая модель (5 ролей)

| Роль | Рус. название | Доступ |
|---|---|---|
| `admin` | Администратор | Полный доступ ко всему |
| `employee` | Сотрудник | Просмотр: подрядчики, сотрудники, нарушения (свои), документы, чек-листы (где инспектор). НЕТ: dashboard, наряды, согласования, моя организация |
| `department_approver` | Согласующий | Согласование сотрудников и нарядов (свой департамент). Просмотр: dashboard, подрядчики, сотрудники, наряды, нарушения (свои), документы, чек-листы |
| `contractor_admin` | Ответственный подрядчика | Управление своей организацией: сотрудники, наряды, нарушения (просмотр+коммент), документы (скачивание), моя организация. НЕТ: dashboard, список подрядчиков, чек-листы, согласования |
| `contractor_employee` | Сотрудник подрядчика | Чтение: своя организация, только своя карточка сотрудника, наряды, нарушения (просмотр+коммент), документы (скачивание). НЕТ: всё остальное |

### Двухуровневая авторизация

1. **Edge Middleware** (`middleware.ts`): проверяет JWT из httpOnly cookie, фильтрует маршруты по ролям (`ROLE_ROUTES`), редиректит на `/login` или `/auth/unauthorized`
2. **API Middleware** (`lib/api-middleware.ts`): `authMiddleware()` верифицирует JWT + проверяет user active, `requireRole()` / `requireAdmin()` для проверки прав

### Департаменты согласования (последовательные)

Порядок: `security` → `hr` → `safety` → `safety_training` → `permit_bureau`

При создании: первый департамент = `pending`, остальные = `blocked`. При approval: следующий разблокируется. При rejection: все оставшиеся автоматически отклоняются.

## Модели данных (ключевые)

**User**: id, email, passwordHash, fullName, role, organizationId?, department?, isActive, mustChangePwd, employeeId?

**Organization**: id, sequentialNumber (автоинкремент), name, inn (unique), kpp?, legalAddress, status (pending/active/blocked)

**Employee**: id, organizationId, fullName, position, photoUrl?, passportSeries, passportNumber, previouslyAtPirelli. Unique: [orgId, series, number]

**EmployeeWorkClass**: id, employeeId, workClass (множественные классы работ)

**EmployeeDocument**: id, employeeId, name, fileUrl?, issueDate, expiryDate, status (valid/expiring/expired)

**ApprovalRequest**: id, employeeId, department, status (pending/approved/rejected/blocked), deadline, comment, decidedAt

**Permit**: id, permitNumber (unique: `{CAT}-{orgSeq}-{curatorSeq}-{permitSeq}`), category, contractorId, workSite, responsiblePerson, openDate, expiryDate, status, closeReason

**PermitApproval**: id, permitId, department, status, deadline, comment (та же логика что ApprovalRequest)

**Violation**: id, violationNumber (VIO-XXXXX), contractorId, date, description, severity, status, department, createdById, photoUrl, contractorComment

**ViolationComplaint**: id, contractorId, complaintText, department, violationId?, status, createdById, resolvedById

**ViolationTemplate**: id, title, description, defaultSeverity, department, isActive

**Checklist**: id, contractorId, inspectorName, date, score (0-100), status, comments

**ChecklistItem**: id, checklistId, question, answer (pass/fail/n/a), comment, photoUrl

**RegDocumentSection**: id, name, parentId? (вложенность), order

**RegDocument**: id, title, sectionId, fileUrl, fileType (pdf/docx/xlsx), version, createdById

**Notification**: id, userId, type, title, message, link?, isRead

**RefreshToken**: id, userId, token, expiresAt, revoked

## Ключевые паттерны

- **Нумерация нарядов**: `{CATEGORY_CODE}-{contractorSeq}-{curatorSeq}-{permitSeq}`. Коды: HW, HT, CS, EL, EX, OT
- **Нумерация нарушений**: `VIO-XXXXX` (атомарная последовательная)
- **Авто-создание User**: при создании сотрудника автоматически создаётся `contractor_employee` User с транслитерированным email и случайным 12-символьным паролем
- **Cron Jobs**: защищены `CRON_SECRET` header. Три эндпоинта: истечение документов, истечение нарядов, предупреждение за 30 дней
- **Уведомления**: двойная система — in-app (Notification таблица) + email (Nodemailer с EmailLog)
- **Валидация**: все API входы через Zod, HTML stripping через `stripHtmlTags`
- **Файлы**: 10MB лимит для документов, 2MB для фото. Локально в dev, S3 в production

## Скрипты

```
pnpm dev           # Запуск dev сервера
pnpm build         # Продакшн сборка
pnpm db:migrate    # Применить миграции
pnpm db:seed:prisma  # Засидить БД
pnpm db:setup      # Миграции + seed
```

## Тестовые данные (seed)

- Admin: `admin@pirelli.ru` / `Admin123!` (mustChangePwd)
- 5 department_approver: security@, hr@, safety@, safetytraining@, permitbureau@
- 2 организации: ООО "СтройЭнергоМонтаж" (seq=1), АО "ТрансТехСервис" (seq=2)
- contractor_admin для каждой организации
- 8 сотрудников (4 на организацию) с документами и согласованиями
- 5 разделов нормативных документов

## Важные файлы для агентов

| Файл | Зачем |
|---|---|
| `prisma/schema.prisma` | Единственный источник истины для всех моделей |
| `middleware.ts` | Edge auth + роутинг по ролям |
| `lib/api-middleware.ts` | API auth guard + role checkers |
| `lib/validations.ts` | Все Zod схемы валидации |
| `lib/auth.ts` | JWT, bcrypt, refresh tokens |
| `lib/notifications.ts` | Создание in-app уведомлений |
| `lib/email.ts` | Email шаблоны |
| `components/layout/sidebar.tsx` | Ролевая фильтрация навигации |
| `app/types.ts` | TypeScript интерфейсы для фронтенда |
| `lib/db/seed-prisma.ts` | Seed данные |

## Договорённости

- Следовать существующим паттернам аутентификации и авторизации
- При добавлении новых моделей — обновлять schema.prisma и запускать `pnpm db:migrate`
- Все новые API роуты должны использовать `authMiddleware` + `requireRole`
- Zod валидация на всех мутациях
- Интерфейсы на русском языке
- Следовать существующей структуре папок: `app/{feature}/`, `app/api/{feature}/`

## Известные критичные баги (из экспертизы)

⚠️ **Миграция не соответствует схеме** — `prisma/migrations/20260412215501_init/migration.sql` не содержит полей которые есть в `schema.prisma`:
- `User.employee_id`, `User.temporary_password`
- `Violation.contractor_comment`
- `ViolationComplaint.contractor_id`, `status`, `resolution_notes`, `created_by_id`, `resolved_by_id`, `resolved_at`, `updated_at`
- `ApprovalStatus.blocked`
- Новые `NotificationType`: `violation_created`, `violation_resolved`, `checklist_assigned`
- Таблица `refresh_token`
- Fresh deploy сломается — нужна генерация новой миграции

⚠️ **`employeeId` при логине** — `app/api/auth/login/route.ts:79` берёт `findFirst()` первого сотрудника организации вместо привязанного к `user.employeeId`. Та же проблема в `app/api/auth/refresh/route.ts:35-36`.

⚠️ **Неполный organization scoping** в некоторых API: `/api/employees/[id]/documents`, `/api/documents/expiring`, `/api/checklists/stats`, `/api/violations/[id]/complaints` — подрядчик может видеть данные чужой организации.
