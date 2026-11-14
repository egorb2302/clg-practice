# ARMORIX — release status

Updated 2026-11-14.

## What `main` contains

| Part | State | Where |
| --- | --- | --- |
| Backend release 1 (API, schema, outbox, bot webhook, admin API) | built, tested locally | `apps/api` |
| API contracts | built | `packages/contracts` |
| Public site (`apps/web`) | rebuilt 2026-11-14 to the completed design canvas (home, catalog with URL filters, product, selection, FAQ, about, contacts, privacy, 404); proxies `/api/v1/*` and `/admin/*` to the API project | `apps/web` |
| Admin UI (`/admin/*` pages) | built as a Vite SPA, served by the API project at `/admin` (`pnpm --filter @armorix/admin build:api` copies it to `apps/api/public/admin`); the site project must rewrite `/admin/*` to the API project, like `/api/*` | `apps/admin` |
| Release 2 backend (cabinet, Telegram Login with phone, guest lead claim, welcome bonus ledger, offers, news, subscriptions, campaigns) | on in production since 2026-11-14: all `FEATURE_*` flags `true` in `armorix-api` production env, `TELEGRAM_LOGIN_CLIENT_ID` set | `apps/api` |
| Release 2 pages on the site | live 2026-11-14: `/login` (email code, Telegram), `/account` (leads, purchases, bonus, offers, profile), `/offers`, `/news`, `/subscribe/confirm`, `/unsubscribe` | `apps/web` |

## Deployment

Deployed 2026-11-10. A push to `main` deploys both Vercel projects (Git integration) and runs CI.

| Piece | Where |
| --- | --- |
| Site | `armorix-web` → https://armorix-web.vercel.app (root `apps/web`) |
| API and admin | `armorix-api` → https://armorix-api.vercel.app (root `apps/api`); admin also at https://armorix-web.vercel.app/admin through the site proxy |
| Database and storage | Supabase `armorix-prod` (eu-west-3) for production, `armorix-staging` (eu-west-1) for preview API deployments; both migrated to 0005 |
| Background jobs | `pg_cron` on `armorix-prod` calls `POST /api/v1/internal/jobs/run` every minute (`apps/api/supabase/setup.sql`) |
| Telegram | webhook `https://armorix-api.vercel.app/api/v1/webhooks/telegram` |

Opened on production 2026-11-12 (Egor: «открываем»). This is a hackathon build for the company that wrote the brief, so production carries the demo catalog: products, "from" prices and site illustrations labeled «Иллюстрация», because the company has no product photos or confirmed data yet. Public contacts are the Telegram bot and working hours. Preview deployments of `armorix-api` use the staging database; preview deployments of `armorix-web` run on local mock data (`API_MOCK=1`), so no preview touches production data.

Welcome bonus values (Egor delegated the choice, 2026-11-12): 1000 points, 1 point = 1 ₽, points valid 180 days, at most 20 % of a sale paid with points, guest contact confirmation within 30 days. Stored as `loyalty_rules` version 1 in both databases; active since `FEATURE_LOYALTY` went on 2026-11-14.

Lead retention: contacts and free text of leads older than `LEAD_RETENTION_DAYS` (365) are cleared by the job runner, with their notification jobs; `/privacy` promises this.

In production the API refuses to start with log/local adapters (`NODE_ENV=production` requires SMTP, Telegram HTTP, Supabase storage and secure cookies) unless `ALLOW_DEV_ADAPTERS=true` is set for a staging project.

## Verified on the first deploy (2026-11-10)

- `search_path=app` holds through the Supavisor transaction pooler (port 6543): `apps/api/src/scripts/db-check.ts`.
- Client IP: lead rate-limit keys carry the visitor's IP, not the site function's (`SITE_PROXY_SECRET` set in both projects).
- `@armorix/contracts` on Vercel: the Express runtime cannot load a workspace package from TypeScript source, so the package builds to `dist` (`default` export condition); local tools use the `development` condition. Relative imports in `apps/api/src` end in `.js` (Vercel runs the compiled files as plain Node ESM; `test/imports.test.ts` guards it). The entry is `src/index.ts`, which must import `express` itself; no `src/app.*` file may exist.
- Supabase Storage with an `sb_secret_…` key: signed upload, read and public upload all work (HTTP 200).
- Admin SPA: `public/admin` ships inside the function (`functions.includeFiles` in `apps/api/vercel.json`); `/admin`, deep links and hashed assets return 200, missing files 404, `index.html` is `no-store` and `noindex`.
- Live lead AX-000001 through the site: stored, Telegram staff notice and customer email (Gmail SMTP) sent on the first attempt; the bot answers `/start` through the webhook.

## Verified 2026-11-12

- Backups: `backup.yml` enabled (`BACKUP_ENABLED`, four secrets set), a manual run finished green; the dump, media download and GPG round trip also ran locally against staging.
- Restore drill: the staging dump restored into a scratch database in the staging project, 42 tables with identical row counts, migrations up to date on the copy; scratch database dropped. Procedure in [RUNBOOK.md](RUNBOOK.md).
- Photo upload on production: signed upload of an original to Supabase, processing on the Vercel function (three WebP widths in about 2 s), public WebP served; test media, objects and the temporary editor removed afterwards.
- Daily monitor runs every day (`monitor_runs` rows for 10, 11 and 12 November); it sends a Telegram message only when it finds a problem, and found none.
- Site at 320, 390, 768, 1024 and 1440 px: no horizontal scroll on home, catalog, product, selection, about, contacts, privacy, 404 and admin login; public pages carry title, description, canonical and Open Graph.
- CI runs ESLint (`pnpm lint`) before typecheck and tests.

## Verified 2026-11-14

- Front rebuild: 15 routes at 1440, 820, 390 and 320 px with no horizontal scroll; typecheck, lint and production build clean; API tests 104/104.
- Locally against the real API with release-2 flags on: email code login to the cabinet; a signed-in client's lead appears in the cabinet; a catalog lead asks how to receive the order when several delivery methods are enabled.
- Production after the deploy: `/api/v1/meta` shows all release-2 features on and the VK contact; site pages 200, unknown pages 404; `/auth/telegram/nonce` 200 and the Telegram button shown on `/login`; footer shows VK and Telegram links.
- Not verified on production: a real Telegram login (needs a Telegram account in the popup; BotFather must allow both `/login` and `/account` as redirect URIs) and an email-code login with a real mailbox.

## Verified 2026-11-15

- Front back to the frontender's template: grey photo placeholders, his simple motion, preloader kept.
- Frontender's mandatory list (`devfix`, 19 items) checked against the code. Fonts fixed: only Tektur 500 and Golos Text 400, nothing under 13 px.
- Browser tests: `pnpm --filter @armorix/web e2e` (Playwright, Edge) with the local `api-r2` and `web` dev servers running; 28/28 pass. They mock only `POST /api/v1/leads`. Covered: add to selection, open it and submit from home, catalog and product; the hero button and the quiz take the selection; the car is chosen only in the picker and stays between pages; «Перезвоните мне» sends the car and the selection; the selection survives a reload, removal can be undone; dialog focus, Esc and scroll lock; lead answers 422, 429, a network retry with the same key, 409 catalog changed; type rules on 11 routes; the phone bottom bar; header links by flags; price format.
- Waiting on the client: a phone, email and address in the production contacts (call buttons stay hidden without a phone), real reviews for `/contacts`, and confirmation of the numbers and promises on the site.

## Deliberate deferrals

- Confirming a sale queues no customer notification: release 2 shows purchases in the cabinet; no recipient for a release-1 sale notice is defined in the spec.
- Edits to a published product go live immediately; there is no separate draft copy of an already published card.
- Backup failures are reported by GitHub Actions failure notifications, not by the API's daily Telegram check.
