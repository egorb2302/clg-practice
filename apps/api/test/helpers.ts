import { randomBytes, randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { MemoryEmail } from "../src/adapters/email";
import { LocalStorage } from "../src/adapters/storage";
import { MemoryTelegram } from "../src/adapters/telegram";
import { createApp } from "../src/app";
import { loadConfig } from "../src/config";
import { createDb } from "../src/db";
import type { Deps } from "../src/deps";
import { hotp, totpStep } from "../src/security/totp";
import { seed } from "../src/seed";
import { TEST_DB } from "./global-setup";

export const SITE = "http://localhost:3351";

export function makeDeps(env: Record<string, string> = {}) {
  const cfg = loadConfig({
    NODE_ENV: "test",
    DATABASE_URL: TEST_DB,
    SITE_URL: SITE,
    APP_SECRET: randomBytes(32).toString("base64url"),
    TOTP_ENC_KEY: randomBytes(32).toString("base64"),
    JOBS_SECRET: "jobs-secret-for-tests-0123456789",
    COOKIE_SECURE: "false",
    TELEGRAM_WEBHOOK_SECRET: "tg-secret-for-tests-0123",
    TELEGRAM_STAFF_CHAT_IDS: "1001",
    STAFF_NOTIFY_EMAILS: "staff@armorix.test",
    LEAD_MIN_FILL_MS: "1000",
    LEAD_LIMIT_IP_PER_HOUR: "1000",
    LEAD_LIMIT_CONTACT_PER_HOUR: "1000",
    ...env,
  });
  const sql = createDb(TEST_DB, { max: 6 });
  const pending: Promise<unknown>[] = [];
  const email = new MemoryEmail();
  const telegram = new MemoryTelegram();
  const deps: Deps = {
    cfg,
    sql,
    email,
    telegram,
    storage: new LocalStorage(mkdtempSync(join(tmpdir(), "armorix-media-")), "http://localhost:3350"),
    waitUntil: (p) => {
      pending.push(p);
    },
  };
  const app = createApp(deps);
  return {
    deps,
    sql,
    email,
    telegram,
    app,
    http: () => request(app),
    settle: async () => {
      while (pending.length) await pending.shift();
    },
  };
}

export type Ctx = ReturnType<typeof makeDeps>;

export async function resetData(ctx: Ctx) {
  await ctx.sql`
    truncate app.audit_events, app.outbox, app.idempotency_keys, app.rate_limits, app.telegram_updates,
      app.email_budget, app.monitor_runs, app.campaign_deliveries, app.campaigns, app.consent_events, app.subscriptions,
      app.offer_rules, app.posts, app.loyalty_expiry_checks, app.loyalty_ledger, app.loyalty_program_claims,
      app.loyalty_awards, app.loyalty_rules, app.oidc_nonces, app.identities,
      app.sale_events, app.sale_items, app.sales, app.lead_events, app.lead_items, app.leads,
      app.recovery_codes, app.totp_factors, app.login_challenges, app.sessions, app.user_roles, app.users,
      app.slug_redirects, app.media, app.variants, app.compatibilities, app.products, app.vehicle_models,
      app.materials, app.delivery_methods, app.site_settings cascade`;
  await seed(ctx.sql);
}

const seenPrices = new Map<string, number | null>();

export async function variantId(ctx: Ctx, productSlug: string, title: string) {
  const [v] = await ctx.sql<{ id: string; price: number | null }[]>`
    select x.id, x.price_kopecks as price from app.variants x join app.products p on p.id = x.product_id
    where p.slug = ${productSlug} and x.title = ${title}`;
  if (!v) throw new Error(`no variant ${productSlug}/${title}`);
  seenPrices.set(v.id, v.price);
  return v.id;
}

export function leadBody(items: { variantId: string; quantity: number; seenPriceFrom?: number | null }[], extra: Record<string, unknown> = {}) {
  return {
    type: "catalog",
    name: "Иван",
    contact: { preferred: "phone", phone: "8 (900) 123-45-67", email: "ivan@example.test" },
    items: items.map((i) => ({ seenPriceFrom: seenPrices.get(i.variantId) ?? null, ...i })),
    deliveryMethod: "pickup",
    website: "",
    fillMs: 10_000,
    ...extra,
  };
}

export const key = () => randomUUID();

export function cookieFrom(res: { headers: Record<string, unknown> }) {
  const raw = res.headers["set-cookie"] as string[] | undefined;
  const c = raw?.find((x) => x.startsWith("ax_session="));
  return c ? c.split(";")[0]! : "";
}

export async function createStaff(ctx: Ctx, email: string, roles: string[]) {
  const [u] = await ctx.sql<{ id: string }[]>`
    insert into app.users (email, name, is_staff) values (${email}, ${email.split("@")[0]!}, true) returning id`;
  for (const r of roles) await ctx.sql`insert into app.user_roles (user_id, role) values (${u!.id}, ${r})`;
  return u!.id;
}

export async function loginStaff(ctx: Ctx, email: string) {
  const req1 = await ctx.http().post("/api/v1/auth/email/request").send({ email });
  await ctx.settle();
  const msg = ctx.email.sent.filter((m) => m.to === email).at(-1);
  const code = msg?.text.match(/\b(\d{6})\b/)?.[1];
  if (!code) throw new Error("no code email");
  const v = await ctx.http().post("/api/v1/auth/email/verify").send({ challengeId: req1.body.challengeId, code });
  let cookie = cookieFrom(v);
  let csrf = v.body.csrfToken as string;
  const enroll = await ctx.http().post("/api/v1/auth/totp/enroll").set("Cookie", cookie).set("X-CSRF-Token", csrf);
  const secret = enroll.body.secret as string;
  const t = await ctx
    .http()
    .post("/api/v1/auth/totp/verify")
    .set("Cookie", cookie)
    .set("X-CSRF-Token", csrf)
    .send({ code: hotp(secret, totpStep(Date.now())) });
  cookie = cookieFrom(t);
  csrf = t.body.csrfToken;
  return { cookie, csrf, secret, recoveryCodes: t.body.recoveryCodes as string[] };
}

export function as(ctx: Ctx, s: { cookie: string; csrf: string }) {
  const h = ctx.http();
  return {
    get: (url: string) => h.get(url).set("Cookie", s.cookie),
    post: (url: string) => ctx.http().post(url).set("Cookie", s.cookie).set("X-CSRF-Token", s.csrf),
    patch: (url: string) => ctx.http().patch(url).set("Cookie", s.cookie).set("X-CSRF-Token", s.csrf),
    put: (url: string) => ctx.http().put(url).set("Cookie", s.cookie).set("X-CSRF-Token", s.csrf),
  };
}
