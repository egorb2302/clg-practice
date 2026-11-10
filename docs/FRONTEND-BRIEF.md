# ARMORIX — frontend brief

For the frontend agent. Full product spec: `docs/SPEC.md` (v0.3, Russian). Visual rules: `docs/ARMORIX-playbook.md`. Site copy is Russian; this brief is English.

## 1. Ownership and repo

- Repo: `https://github.com/egorb2302/clg-practice`, pnpm workspace monorepo.
- **You own `apps/web` only.** Backend team owns `apps/api`, `packages/contracts`, database, emails, Telegram bot and the **admin panel** (`/admin/*`). Do not create or edit files outside `apps/web` (except adding `apps/web` to the workspace if it is not there yet).
- Work on branch `agent/front-web`, open a PR into `main`. Backend reviews the PR before merge.
- Types for API requests and responses will live in `packages/contracts` (zod schemas + TS types). Until it lands, use the shapes in section 5 as the agreement; then switch imports to `@armorix/contracts`.

## 2. Stack (required)

- React Router 7 **framework mode with SSR**, TypeScript, Vite, `@vercel/react-router` preset (`ssr: true`, `presets: [vercelPreset()]`). Deployed as its own Vercel project.
- Public pages are server-rendered from loaders. Loader responses for public pages set `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`. Account pages set `Cache-Control: no-store` and `noindex`.
- Data access goes through one module (`app/lib/api.ts`). Server loaders call `${API_ORIGIN}/api/v1/...` (env `API_ORIGIN`); browser code calls relative `/api/v1/...` (Vercel rewrite proxies it to the API, same origin, cookies first-party, no CORS).
- Until the API is live: `API_MOCK=1` switches `app/lib/api.ts` to local fixtures with the same shapes (JAC T9 and Haval H3, 6–10 demo products, one product with `priceFrom: null`, one archived variant). Swapping mock → real must be a single env change.
- No analytics. OG + Twitter tags + meta description on every public page. Preloader and custom scrollbar per playbook.

## 3. Release 1 — pages and UI

| Route | Sections and behaviour |
| --- | --- |
| `/` | Hero with a clear first action (choose your vehicle → catalog). Vehicle picker (make/model) right on the hero. Ready kits (cards from catalog). Short company story. Advantages. Custom manufacturing block with CTA to the custom form. Current offer block (hidden unless `features.offers` and an offer exists — release 2). Contacts block. |
| `/catalog` | Vehicle filter first (make → model). Second filter group: position (front / rear / kit), material/coating — show a filter only when it has ≥2 values for the chosen vehicle. **All filter state in URL query** (`?vehicle=jac-t9&position=front&material=aisi304&page=2`); reload and Back keep it. Product cards: photo, title, vehicle, position, «от 45 900 ₽» or «Уточнить цену», «В подборку» button. Empty result: «Сбросить фильтры» + CTA «Индивидуальный заказ». |
| `/catalog/:slug` | Gallery (main photo has alt), title, product code, compatibility, position, material, kit composition, installation, status. Variant selector if several variants. Price «от …» with note under it: «Окончательная стоимость зависит от комплектации и подтверждается менеджером». Buttons «В подборку» and «Уточнить комплектацию» (opens catalog-type lead with this product prefilled). Back link returns to the catalog with the same filters. Old slug → loader redirect (API returns `redirect`). Unknown slug → real HTTP 404. |
| `/selection` | List of added variants: photo, title, vehicle, price «от», quantity stepper, remove. Delivery method radio («Самовывоз», «Доставка транспортной компанией», «Установка у нас»; list comes from `/meta`; hide the choice if only one). Lead form (section 4). Empty state with link to catalog. |
| `/about` | Company story, production, materials, installation and delivery. |
| `/contacts` | Contact channels, hours, address if present, form with a switch «Общий вопрос» / «Индивидуальное изготовление». |
| `/privacy` | Static page, text comes later (placeholder on staging). |
| 404 | Branded 404 page with links to home and catalog, HTTP status 404. |
| `/sitemap.xml`, `/robots.txt` | Resource routes. Sitemap built from `GET /api/v1/sitemap`. Robots disallows `/account`, `/admin`, `/api`. |

**Global UI**
- Header: logo, nav (Каталог, О компании, Контакты; Акции/Новости/Кабинет appear when the matching feature flag is on), selection icon with item count, visible on every public page. Mobile: burger menu, full keyboard support, focus trap, Esc closes.
- Footer: contacts, nav, privacy link; subscription form slot (rendered only when `features.campaigns` is on — release 2).
- Selection persists in `localStorage` key `armorix.selection.v1`: `[{ variantId, productSlug, vehicleSlug, quantity, snapshot: { title, priceFrom, imageUrl } }]`. Snapshot is display-only; the server re-validates on submit. Wrap storage access in try/catch, work without it.
- Price formatting: amounts are kopecks (integers). `Intl.NumberFormat('ru-RU')`, display rubles: «от 45 900 ₽». `null` → «Уточнить цену», never «0 ₽».

## 4. Lead forms (the core UX)

Three types share one component: `catalog` (from `/selection`), `custom`, `general` (from `/contacts` and CTAs).

- Fields: name; preferred contact radio «Позвонить» / «Написать на email» — the chosen one is required (phone mask for RU numbers, email validation); comment (optional). `custom` adds make, model, year (optional), «Что нужно изготовить» (required). `general` adds message (required).
- Hidden honeypot field `website` (visually hidden, `tabindex=-1`, `autocomplete=off`) and `fillMs`: milliseconds between the form becoming visible and submit, measured with `performance.now()` (never wall-clock time; client clocks drift).
- Every item sends `seenPriceFrom`: the price «от» the user saw (kopecks), or `null` if they saw «Уточнить цену». The server answers `409 CATALOG_CHANGED` when it differs.
- Submit flow:
  1. Generate `Idempotency-Key` (UUID) when the user presses submit; **reuse the same key** on retry after timeout/network error; generate a new key only after the user changes the selection or form.
  2. Button shows loading, form stays filled, double submit blocked.
  3. `201` → success screen with the reference number «Заявка AX-000123 принята», what happens next, clear only the submitted selection.
  4. `422` → errors next to fields from `fieldErrors`, focus the first invalid field.
  5. `409 CATALOG_CHANGED` → show per-item what changed (unavailable / new price «от»), let the user remove or accept, then resubmit with a new key.
  6. `429` → neutral message «Слишком много попыток, попробуйте через N минут».
  7. Network/5xx → keep the data, «Не удалось отправить, повторить» with the same key.
- Status announcements via `aria-live="polite"`.
- When the user is logged in (release 2), prefill name/contact from `/me`; editing them changes only this lead.

## 5. API shapes (agreement until `packages/contracts` lands)

All under `/api/v1`. Errors: `{ code, message, fieldErrors?, requestId }`.

```ts
GET /meta → {
  features: { account: boolean; loyalty: boolean; offers: boolean; news: boolean; campaigns: boolean };
  deliveryMethods: { code: 'pickup' | 'shipping' | 'install'; label: string }[];
  contacts: { phone?: string; email?: string; telegram?: string; address?: string; hours?: string };
}

GET /vehicles → { items: { slug: string; make: string; model: string; label: string }[] }

GET /catalog?vehicle=&position=&material=&page= → {
  items: ProductCard[];
  filters: { position: Facet[]; material: Facet[] };   // Facet = { value: string; label: string; count: number }
  page: number; pageSize: number; total: number;
}
type ProductCard = {
  slug: string; code: string; title: string;
  vehicle: { slug: string; label: string };
  position: 'front' | 'rear' | 'kit';
  image: { url: string; alt: string; width: number; height: number } | null;
  priceFrom: number | null;           // kopecks
  status: 'available' | 'on_request';
};

GET /catalog/:slug → { product: ProductCard & {
  gallery: { url: string; alt: string; width: number; height: number }[];
  description: string; composition: string[]; material: string | null; installation: string | null;
  compatibility: { vehicleSlug: string; label: string; note?: string }[];
  variants: { id: string; title: string; vehicleSlug: string; priceFrom: number | null; available: boolean }[];
} } | { redirect: string }            // 404 → { code: 'NOT_FOUND' }

GET /sitemap → { urls: { path: string; updatedAt: string }[] }

POST /leads   (header Idempotency-Key)
body: {
  type: 'catalog' | 'custom' | 'general';
  name: string;
  contact: { preferred: 'phone' | 'email'; phone?: string; email?: string };
  items?: { variantId: string; quantity: number; seenPriceFrom: number | null }[];    // catalog
  deliveryMethod?: 'pickup' | 'shipping' | 'install';   // catalog
  vehicle?: { make: string; model: string; year?: number }; request?: string;  // custom
  message?: string;                                      // general
  comment?: string;
  website: string; fillMs: number;                      // anti-bot
}
201 → { reference: string; status: 'received'; loyaltyStatus?: 'pending' | 'credited' | 'ineligible' }
409 → { code: 'CATALOG_CHANGED'; changes: { variantId: string; available: boolean; priceFrom: number | null }[] }
    | { code: 'IDEMPOTENCY_MISMATCH' }
422 → { code: 'VALIDATION'; fieldErrors: Record<string, string> }   // keys like 'contact.phone', 'items.0.quantity'
429 → { code: 'RATE_LIMITED'; retryAfterSec: number }
```

## 6. Release 2 — build behind flags (lower priority)

Render only when the flag from `/meta` is on; routes return 404 when off.

- `/login`: email → 6-digit code step (resend timer 60 s, neutral errors), «Войти через Telegram» (Telegram Login widget; bot name from env).
- `/account`: profile, contacts with «подтверждён / не подтверждён», «Подтвердить телефон в Telegram» (opens `t.me/<bot>?start=<token>` from `POST /me/phone/telegram-link`), logout.
- `/account/leads` (list with simple public status and date, «Привязать заявку» flow by email code), `/account/purchases`, `/account/bonus` (balance + history), `/account/subscription`. Each with an empty state explaining when data appears.
- After a guest lead with `loyaltyStatus: 'pending'`: hint «Баллы станут доступны после входа и подтверждения контакта».
- `/offers`, `/offers/:slug`, `/news`, `/news/:slug`; offer block on the home page.
- Footer subscription form; `/subscribe/confirm?token=` and `/unsubscribe?token=` pages show a confirm button (GET never changes state).
- Exact shapes for release 2 endpoints come with `packages/contracts`.

## 7. Quality bar (definition of done for release 1)

- All release 1 routes work on mocks and against the real API by env switch; `pnpm --filter web typecheck` and `build` pass.
- Widths 320, 390, 768, 1024, 1440: no horizontal scroll, menu, filters and form usable; main actions visible without hover.
- States for every data request: loading, empty, error, success. Visible focus, labelled buttons, full keyboard path through menu, filters and form. `prefers-reduced-motion` gives a static version.
- Every public page: `title`, description, canonical, Open Graph, Twitter Card. Unknown URLs return HTTP 404.
- No secrets or tokens in the client bundle. Nothing from `/account` gets cached or indexed.
- PR description: what is done, screenshots at 390 and 1440 of home, catalog, product, selection (filled + success + 409 state), mock fixture location.
