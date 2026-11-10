# ARMORIX

Сайт подбора защиты бамперов: витрина, каталог, заявки, админка. ТЗ — [docs/SPEC.md](docs/SPEC.md), бриф фронтенда — [docs/FRONTEND-BRIEF.md](docs/FRONTEND-BRIEF.md), что готово и что нет — [docs/STATUS.md](docs/STATUS.md).

## Структура

| Папка | Что внутри | Кто ведёт |
| --- | --- | --- |
| `apps/web` | Сайт: React Router 7 с SSR на Vercel | фронтенд |
| `apps/api` | API: Express 5 на Vercel, Postgres в Supabase | бэкенд |
| `packages/contracts` | Общие схемы запросов и ответов API (zod + типы) | бэкенд |

## Локальный запуск API

Нужны Node.js 24, pnpm 12 и Postgres 15+.

```bash
pnpm install
```

Создать `.env.local` в корне по образцу `apps/api/.env.example` (для локалки: `EMAIL_TRANSPORT=log`, `TELEGRAM_TRANSPORT=log`, `STORAGE_DRIVER=local`, `COOKIE_SECURE=false`), затем:

```bash
pnpm --filter @armorix/api migrate
```

```bash
pnpm --filter @armorix/api seed
```

```bash
pnpm --filter @armorix/api create-admin you@example.com "Имя"
```

```bash
pnpm --filter @armorix/api dev
```

Письма с кодами входа в локальном режиме печатаются в консоль API.

Тесты (нужна отдельная пустая база, адрес в `DATABASE_URL_TEST`):

```bash
pnpm --filter @armorix/api test
```

## Деплой API

1. Supabase: создать проект, в Vercel-переменные API положить `DATABASE_URL` (пулер, порт 6543) и для миграций `DATABASE_MIGRATION_URL` (порт 5432).
2. Применить миграции: `pnpm --filter @armorix/api migrate` с `DATABASE_MIGRATION_URL`.
3. Выполнить `apps/api/supabase/setup.sql` в SQL-редакторе Supabase (cron очереди и бакеты).
4. Vercel: проект с корнем `apps/api`, переменные из `apps/api/.env.example`.
5. Проект сайта на Vercel проксирует `/api/*` в проект API (rewrite).
6. Telegram: `setWebhook` на `https://<сайт>/api/v1/webhooks/telegram` с `secret_token` = `TELEGRAM_WEBHOOK_SECRET`.
7. Бэкап: в GitHub задать секреты `DATABASE_BACKUP_URL`, `BACKUP_PASSPHRASE` и переменную `BACKUP_ENABLED=true`.
