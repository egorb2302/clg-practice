# ARMORIX — release status

Updated 2026-11-12.

## What `main` contains

| Part | State | Where |
| --- | --- | --- |
| Backend release 1 (API, schema, outbox, bot webhook, admin API) | built, tested locally | `apps/api` |
| API contracts | built | `packages/contracts` |
| Public site (`apps/web`) | release 1 by the frontend teammate (PR #1, merged 2026-11-10); proxies `/api/v1/*` and `/admin/*` to the API project; checked locally against the real API (catalog, selection, lead AX-000002, admin on the site origin) | `apps/web` |
| Admin UI (`/admin/*` pages) | built as a Vite SPA, served by the API project at `/admin` (`pnpm --filter @armorix/admin build:api` copies it to `apps/api/public/admin`); the site project must rewrite `/admin/*` to the API project, like `/api/*` | `apps/admin` |
| Release 2 backend (cabinet, Telegram Login with phone, guest lead claim, welcome bonus ledger, offers, news, subscriptions, campaigns) | built and tested locally; every route returns 404 while its `FEATURE_*` flag is `false` (the default) | `apps/api` |
| Release 2 pages on the site | frontend teammate, after release 1 | — |

## Deployment

Deployed 2026-11-10. A push to `main` deploys both Vercel projects (Git integration) and runs CI.

| Piece | Where |
| --- | --- |
| Site | `armorix-web` → https://armorix-web.vercel.app (root `apps/web`) |
| API and admin | `armorix-api` → https://armorix-api.vercel.app (root `apps/api`); admin also at https://armorix-web.vercel.app/admin through the site proxy |
| Database and storage | Supabase `armorix-staging` (eu-west-1) and `armorix-prod` (eu-west-3), both migrated to 0004; staging has the demo catalog |
| Background jobs | `pg_cron` on staging calls `POST /api/v1/internal/jobs/run` every minute (`apps/api/supabase/setup.sql`) |
| Telegram | webhook `https://armorix-api.vercel.app/api/v1/webhooks/telegram` |

Until the `/privacy` text exists and the staging checks pass, the Vercel production environment points at the **staging** database. Switching to `armorix-prod` means: seed reference data there (without demo products), run `setup.sql` against it, swap the Vercel env vars, redeploy.

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

## Deliberate deferrals

- Confirming a sale queues no customer notification: release 2 shows purchases in the cabinet; no recipient for a release-1 sale notice is defined in the spec.
- Edits to a published product go live immediately; there is no separate draft copy of an already published card.
- Backup failures are reported by GitHub Actions failure notifications, not by the API's daily Telegram check.
