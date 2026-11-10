# ARMORIX — release status

Updated 2026-11-10.

## What `main` contains

| Part | State | Where |
| --- | --- | --- |
| Backend release 1 (API, schema, outbox, bot webhook, admin API) | built, tested locally | `apps/api` |
| API contracts | built | `packages/contracts` |
| Public site (`apps/web`) | in progress by the frontend teammate on branch `agent/front-web`, merged by PR | not in `main` yet |
| Admin UI (`/admin/*` pages) | built as a Vite SPA, served by the API project at `/admin` (`pnpm --filter @armorix/admin build:api` copies it to `apps/api/public/admin`); the site project must rewrite `/admin/*` to the API project, like `/api/*` | `apps/admin` |
| Release 2 backend (cabinet, Telegram Login with phone, guest lead claim, welcome bonus ledger, offers, news, subscriptions, campaigns) | built and tested locally; every route returns 404 while its `FEATURE_*` flag is `false` (the default) | `apps/api` |
| Release 2 pages on the site | frontend teammate, after release 1 | — |

## Deployment

Nothing in this repository is connected to Vercel or Supabase yet. A push to `main` runs CI only (typecheck and API tests against a throwaway Postgres); it deploys nothing and touches no real data, mailboxes or Telegram chats. The public release happens only after `apps/web`, the admin UI and the staging checks from `docs/SPEC.md` section 9 are done.

In production the API refuses to start with log/local adapters (`NODE_ENV=production` requires SMTP, Telegram HTTP, Supabase storage and secure cookies) unless `ALLOW_DEV_ADAPTERS=true` is set for a staging project.

## To verify on the first staging deploy

- `search_path=app` through the Supavisor transaction pooler (port 6543); fallback: `alter role <api role> set search_path = app, public`.
- Client IP seen by the API behind the site's `/api/*` rewrite (`x-vercel-forwarded-for`); rate limits depend on it.
- Vercel bundling of the workspace package `@armorix/contracts`.
- Vercel serving `apps/api/public/admin` next to the Express function, and the SPA fallback rewrite in `apps/api/vercel.json`.

## Deliberate deferrals

- Confirming a sale queues no customer notification: release 2 shows purchases in the cabinet; no recipient for a release-1 sale notice is defined in the spec.
- Edits to a published product go live immediately; there is no separate draft copy of an already published card.
- Backup failures are reported by GitHub Actions failure notifications, not by the API's daily Telegram check.
