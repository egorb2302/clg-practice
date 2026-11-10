# apps/web: ARMORIX public site

React Router 7 in framework mode with SSR, TypeScript, Vite, `@vercel/react-router` preset. Release 1 routes from `docs/FRONTEND-BRIEF.md`.

## Run

```bash
cp .env.example .env        # API_MOCK=1 works without the backend
pnpm --filter @armorix/web dev
pnpm --filter @armorix/web typecheck
pnpm --filter @armorix/web build
```

On Windows without a shell that reads `.env`, start the dev server with `node --env-file=.env node_modules/@react-router/dev/bin.js dev`.

## Env

| Name | Use |
| --- | --- |
| `API_ORIGIN` | Server loaders call `${API_ORIGIN}/api/v1/...` |
| `API_MOCK` | `1` swaps in local fixtures with the same shapes. Swapping mock → real API is this one variable |
| `SITE_ORIGIN` | Absolute origin for canonical, Open Graph, sitemap and robots |
| `SITE_PROXY_SECRET` | Same value as the API's `SITE_PROXY_SECRET`; the proxy sends the visitor IP with it so API rate limits see real visitors |

`/admin/*` is proxied to `${API_ORIGIN}/admin/...` (`app/routes/admin.ts`), so the staff panel lives on the site origin next to `/api/*` and its session cookie stays first-party.

## Where things are

- `app/lib/api.server.ts`: the one data-access module for loaders, mock switch, public cache header.
- `app/lib/mock.server.ts`: **mock fixtures**: JAC T9 and Haval H3, 8 products, `haval-h3-rear` without a price («Уточнить цену»), archived variant `…0007` in `jac-t9-kit`, old slug `t9-front` → redirect. Mock-only test hooks: a lead comment or message containing `#429` or `#500`.
- `app/routes/api.ts`: `/api/v1/*` on the site's own origin. Mock mode answers from the fixtures; otherwise it proxies to `API_ORIGIN` with cookies, the idempotency key and the client IP forwarded. A Vercel rewrite in front of it can take over.
- `app/components/LeadForm.tsx`: the one form for `catalog`, `custom`, `general`: client validation with `leadRequestSchema` from `@armorix/contracts`, honeypot `website`, `fillMs` from `performance.now()`, `seenPriceFrom` per item, one `Idempotency-Key` reused on retry, new key after any change, states for 201 / 422 / 409 / 429 / network, `aria-live` status.
- `app/lib/selection.ts`: selection in `localStorage` key `armorix.selection.v1`, works without storage.
- `app/lib/seo.ts`: title, description, canonical, Open Graph, Twitter Card.
- Public loaders send `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`. Unknown URLs and unknown slugs return HTTP 404.

## Design

Visual system from the approved ARMORIX kit (IBM Plex Sans, obsidian ground, pine accent, the shield's chamfer instead of radius, the contour mark). The playbook in `docs/` names Montserrat and Golos; the kit Keelsy approved uses Plex, so the site keeps Plex until Egor decides otherwise. Product photos are stock and marked «Иллюстрация» on every card.
