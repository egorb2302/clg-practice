import { createSign, generateKeyPairSync, randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { dispatchCampaigns } from "../src/services/campaigns";
import { runJobs } from "../src/services/outbox";
import { as, cookieFrom, createStaff, key, leadBody, loginStaff, makeDeps, resetData, variantId, type Ctx } from "./helpers";

const CLIENT_ID = "7000000001";
const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: "jwk" }), kid: "test-key", alg: "RS256" };

function idToken(claims: Record<string, unknown>) {
  const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const head = enc({ alg: "RS256", kid: "test-key", typ: "JWT" });
  const body = enc({ iss: "https://oauth.telegram.org", aud: CLIENT_ID, exp: Math.floor(Date.now() / 1000) + 300, ...claims });
  const sig = createSign("RSA-SHA256").update(`${head}.${body}`).sign(privateKey).toString("base64url");
  return `${head}.${body}.${sig}`;
}

let ctx: Ctx;
let v1: string;
let manager: { cookie: string; csrf: string };
let admin: { cookie: string; csrf: string };
let editor: { cookie: string; csrf: string };

beforeAll(async () => {
  ctx = makeDeps({
    FEATURE_ACCOUNT: "true",
    FEATURE_LOYALTY: "true",
    FEATURE_OFFERS: "true",
    FEATURE_NEWS: "true",
    FEATURE_CAMPAIGNS: "true",
    TELEGRAM_LOGIN_CLIENT_ID: CLIENT_ID,
  });
  ctx.deps.telegramJwks = async () => [jwk as never];
});
beforeEach(async () => {
  await resetData(ctx);
  ctx.email.sent = [];
  await createStaff(ctx, "m@armorix.test", ["manager"]);
  await createStaff(ctx, "a@armorix.test", ["admin"]);
  await createStaff(ctx, "e@armorix.test", ["editor"]);
  manager = await loginStaff(ctx, "m@armorix.test");
  admin = await loginStaff(ctx, "a@armorix.test");
  editor = await loginStaff(ctx, "e@armorix.test");
  await as(ctx, admin).post("/api/v1/admin/loyalty/rules").send({ points: 500, kopecksPerPoint: 100, redeemLimitPct: 20 });
  v1 = await variantId(ctx, "jac-t9-front-tube", "Без защиты картера");
  await ctx.sql`delete from app.rate_limits`;
});
afterAll(async () => {
  await ctx.sql.end();
});

async function clientLogin(email: string) {
  await ctx.sql`delete from app.rate_limits`;
  const r = await ctx.http().post("/api/v1/auth/email/request").send({ email });
  await ctx.settle();
  const code = ctx.email.sent.filter((m) => m.to === email && m.subject.startsWith("Код входа")).at(-1)!.text.match(/\b(\d{6})\b/)![1];
  const v = await ctx.http().post("/api/v1/auth/email/verify").send({ challengeId: r.body.challengeId, code });
  expect(v.status).toBe(200);
  return { cookie: cookieFrom(v), csrf: v.body.csrfToken as string, userId: v.body.user.id as string };
}

const binderFrom = (res: { headers: Record<string, unknown> }) =>
  ((res.headers["set-cookie"] as string[] | undefined) ?? []).find((x) => x.startsWith("ax_tg_login="))?.split(";")[0] ?? "";

async function loginNonce() {
  const n = await ctx.http().post("/api/v1/auth/telegram/nonce");
  return { nonce: n.body.nonce as string, binder: binderFrom(n) };
}

const telegramPost = (n: { binder: string }) => ctx.http().post("/api/v1/auth/telegram").set("Cookie", n.binder);

async function telegramLogin(claims: Record<string, unknown>) {
  const n = await loginNonce();
  const res = await telegramPost(n).send({ idToken: idToken({ nonce: n.nonce, ...claims }), nonce: n.nonce });
  return { res, nonce: n.nonce };
}

const submit = (s: { cookie: string; csrf: string } | null, extra: Record<string, unknown> = {}) => {
  const r = ctx.http().post("/api/v1/leads").set("Idempotency-Key", key());
  return (s ? r.set("Cookie", s.cookie).set("X-CSRF-Token", s.csrf) : r).send(leadBody([{ variantId: v1, quantity: 1 }], extra));
};

async function confirmSale(ref: string, body: Record<string, unknown>) {
  const draft = await as(ctx, manager).post(`/api/v1/admin/leads/${ref}/sale`);
  const sale = await as(ctx, manager).get(`/api/v1/admin/sales/${draft.body.saleId}`);
  const res = await as(ctx, manager)
    .post(`/api/v1/admin/sales/${draft.body.saleId}/confirm`)
    .send({ version: sale.body.sale.version, amountKopecks: 4_590_000, soldOn: "2026-11-10", externalId: `INV-${randomUUID().slice(0, 8)}`, ...body });
  return { res, saleId: draft.body.saleId as string };
}

describe("release 2 flags", () => {
  it("hides every release-2 route when flags are off", async () => {
    const off = makeDeps();
    for (const url of ["/api/v1/me", "/api/v1/offers", "/api/v1/news", "/api/v1/me/loyalty"]) {
      expect((await off.http().get(url)).status).toBe(404);
    }
    expect((await off.http().post("/api/v1/subscriptions").send({ email: "x@x.test", consent: true })).status).toBe(404);
    expect((await off.http().post("/api/v1/auth/telegram/nonce")).status).toBe(404);
    await createStaff(off, "off-admin@armorix.test", ["admin"]);
    const s = await loginStaff(off, "off-admin@armorix.test");
    for (const url of ["/api/v1/admin/loyalty/rules", "/api/v1/admin/posts", "/api/v1/admin/campaigns"]) {
      expect((await as(off, s).get(url)).status).toBe(404);
    }
    expect((await as(off, s).post("/api/v1/admin/campaigns").send({ subject: "Тест", bodyText: "Текст рассылки" })).status).toBe(404);
    await off.sql.end();
  });
});

describe("customer cabinet and welcome bonus", () => {
  it("credits a logged-in client once and shows own leads only", async () => {
    const c = await clientLogin("client@example.test");
    const first = await submit(c);
    expect(first.body.loyaltyStatus).toBe("credited");
    const second = await submit(c);
    expect(second.body.loyaltyStatus).toBe("ineligible");
    const loyalty = await as(ctx, c).get("/api/v1/me/loyalty");
    expect(loyalty.body.balance).toBe(500);
    const leads = await as(ctx, c).get("/api/v1/me/leads");
    expect(leads.body.items).toHaveLength(2);
    expect(leads.body.items[0].status).toBe("Принята");
    const other = await clientLogin("other@example.test");
    expect((await as(ctx, other).get("/api/v1/me/leads")).body.items).toHaveLength(0);
  });

  it("keeps a guest bonus pending until the client claims the lead by a verified contact", async () => {
    const guest = await submit(null, { contact: { preferred: "email", email: "guest@example.test" } });
    expect(guest.body.loyaltyStatus).toBe("pending");
    const c = await clientLogin("guest@example.test");
    const claimable = await as(ctx, c).get("/api/v1/me/leads/claimable");
    expect(claimable.body.items.map((l: { reference: string }) => l.reference)).toEqual([guest.body.reference]);
    const claim = await as(ctx, c).post("/api/v1/me/leads/claim").send({ references: [guest.body.reference] });
    expect(claim.body.items[0]).toMatchObject({ claimed: true, loyaltyStatus: "credited" });
    expect((await as(ctx, c).get("/api/v1/me/loyalty")).body.balance).toBe(500);
    const stranger = await clientLogin("stranger@example.test");
    const steal = await as(ctx, stranger).post("/api/v1/me/leads/claim").send({ references: [guest.body.reference] });
    expect(steal.body.items[0].claimed).toBe(false);
  });

  it("credits only one bonus when two guest leads are claimed at once", async () => {
    const a = await submit(null, { contact: { preferred: "email", email: "two@example.test" } });
    const b = await submit(null, { contact: { preferred: "email", email: "two@example.test" } });
    const c = await clientLogin("two@example.test");
    await Promise.all([
      as(ctx, c).post("/api/v1/me/leads/claim").send({ references: [a.body.reference] }),
      as(ctx, c).post("/api/v1/me/leads/claim").send({ references: [b.body.reference] }),
    ]);
    expect((await as(ctx, c).get("/api/v1/me/loyalty")).body.balance).toBe(500);
  });

  it("redeems within the balance and the limit, and returns points on a full refund", async () => {
    const c = await clientLogin("buyer@example.test");
    const lead = await submit(c);
    const tooMany = await confirmSale(lead.body.reference, { redeemPoints: 600 });
    expect(tooMany.res.status).toBe(422);
    const ok = await confirmSale(lead.body.reference, { redeemPoints: 400 });
    expect(ok.res.status).toBe(200);
    expect((await as(ctx, c).get("/api/v1/me/loyalty")).body.balance).toBe(100);
    const purchases = await as(ctx, c).get("/api/v1/me/purchases");
    expect(purchases.body.items).toHaveLength(1);
    await as(ctx, manager).post(`/api/v1/admin/sales/${ok.saleId}/refunds`).set("Idempotency-Key", key()).send({ amountKopecks: 4_590_000, reason: "Полный возврат" });
    expect((await as(ctx, c).get("/api/v1/me/loyalty")).body.balance).toBe(500);
  });

  it("does not let two parallel confirms spend the same points", async () => {
    const c = await clientLogin("twice@example.test");
    const a = await submit(c);
    const b = await submit(c);
    const prep = async (ref: string) => {
      const draft = await as(ctx, manager).post(`/api/v1/admin/leads/${ref}/sale`);
      const sale = await as(ctx, manager).get(`/api/v1/admin/sales/${draft.body.saleId}`);
      return { id: draft.body.saleId as string, version: sale.body.sale.version as number };
    };
    const [sa, sb] = await Promise.all([prep(a.body.reference), prep(b.body.reference)]);
    const confirm = (s: { id: string; version: number }, ext: string) =>
      as(ctx, manager).post(`/api/v1/admin/sales/${s.id}/confirm`).send({ version: s.version, amountKopecks: 4_590_000, soldOn: "2026-11-10", externalId: ext, redeemPoints: 400 });
    const results = await Promise.all([confirm(sa, "P-1"), confirm(sb, "P-2")]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 422]);
    expect((await as(ctx, c).get("/api/v1/me/loyalty")).body.balance).toBe(100);
  });

  it("blocks redemption while the balance is negative", async () => {
    const c = await clientLogin("negative@example.test");
    const lead = await submit(c);
    await as(ctx, admin).post(`/api/v1/admin/loyalty/users/${c.userId}/adjust`).set("Idempotency-Key", key()).send({ points: -800, reason: "Корректировка злоупотребления" });
    expect((await as(ctx, c).get("/api/v1/me/loyalty")).body.balance).toBe(-300);
    const r = await confirmSale(lead.body.reference, { redeemPoints: 10 });
    expect(r.res.status).toBe(422);
  });

  it("locks the customer without waiting on a foreign-key share lock held elsewhere", async () => {
    const c = await clientLogin("fk-share@example.test");
    const { lockUser } = await import("../src/services/loyalty");
    await ctx.sql.begin(async (holder) => {
      await holder`select 1 from app.users where id = ${c.userId} for key share`;
      await ctx.sql.begin(async (tx) => {
        await tx`set local lock_timeout = '500ms'`;
        await lockUser(tx, c.userId);
      });
    });
  });

  it("keeps the ledger append-only in the database", async () => {
    const c = await clientLogin("ledger-lock@example.test");
    await as(ctx, admin).post(`/api/v1/admin/loyalty/users/${c.userId}/adjust`).set("Idempotency-Key", key()).send({ points: 50, reason: "Проверка журнала" });
    const [row] = await ctx.sql<{ id: string }[]>`select id from app.loyalty_ledger where user_id = ${c.userId} limit 1`;
    await expect(ctx.sql`update app.loyalty_ledger set points = 5000 where id = ${row!.id}`).rejects.toMatchObject({ code: "55000" });
    await expect(ctx.sql`delete from app.loyalty_ledger where id = ${row!.id}`).rejects.toMatchObject({ code: "55000" });
    await ctx.sql`delete from app.users where id = ${c.userId}`;
    expect(await ctx.sql`select 1 from app.loyalty_ledger where user_id = ${c.userId}`).toHaveLength(0);
  });

  it("expires only the unspent part of the bonus and does not return points after expiry", async () => {
    const c = await clientLogin("expire@example.test");
    const lead = await submit(c);
    const sale = await confirmSale(lead.body.reference, { redeemPoints: 400 });
    expect(sale.res.status).toBe(200);
    await ctx.sql.begin(async (tx) => {
      await tx`alter table app.loyalty_ledger disable trigger loyalty_ledger_append_only`;
      await tx`update app.loyalty_ledger set expires_at = now() - interval '1 minute' where user_id = ${c.userId} and type = 'earn'`;
      await tx`alter table app.loyalty_ledger enable trigger loyalty_ledger_append_only`;
    });
    const { expirePoints } = await import("../src/services/loyalty");
    expect(await expirePoints(ctx.sql)).toBe(1);
    expect((await as(ctx, c).get("/api/v1/me/loyalty")).body.balance).toBe(0);
    await as(ctx, manager).post(`/api/v1/admin/sales/${sale.saleId}/refunds`).set("Idempotency-Key", key()).send({ amountKopecks: 4_590_000, reason: "Полный возврат" });
    expect((await as(ctx, c).get("/api/v1/me/loyalty")).body.balance).toBe(0);
    expect(await expirePoints(ctx.sql)).toBe(0);
  });

  it("attaches the sale of a claimed guest lead to the cabinet", async () => {
    const guest = await submit(null, { contact: { preferred: "email", email: "late-claim@example.test" } });
    const sale = await confirmSale(guest.body.reference, {});
    expect(sale.res.status).toBe(200);
    const c = await clientLogin("late-claim@example.test");
    await as(ctx, c).post("/api/v1/me/leads/claim").send({ references: [guest.body.reference] });
    expect((await as(ctx, c).get("/api/v1/me/purchases")).body.items).toHaveLength(1);
  });

  it("changes the email with a code sent to the new address", async () => {
    const c = await clientLogin("old@example.test");
    const r = await as(ctx, c).post("/api/v1/me/email/request").send({ email: "new@example.test" });
    await ctx.settle();
    const code = ctx.email.sent.filter((m) => m.to === "new@example.test").at(-1)!.text.match(/\b(\d{6})\b/)![1];
    const v = await as(ctx, c).post("/api/v1/me/email/verify").send({ challengeId: r.body.challengeId, code });
    expect(v.status).toBe(200);
    expect((await as(ctx, c).get("/api/v1/me")).body.profile.email).toBe("new@example.test");
  });

  it("reverses the whole bonus on spam even when it was spent, and refuses a confirm replay with other points", async () => {
    const c = await clientLogin("spent@example.test");
    const lead = await submit(c);
    const sale = await confirmSale(lead.body.reference, { redeemPoints: 400 });
    expect(sale.res.status).toBe(200);
    const [row] = await ctx.sql<{ version: number; external_id: string }[]>`select version, external_id from app.sales where id = ${sale.saleId}`;
    const replay = await as(ctx, manager).post(`/api/v1/admin/sales/${sale.saleId}/confirm`)
      .send({ version: row!.version, amountKopecks: 4_590_000, soldOn: "2026-11-10", externalId: row!.external_id, redeemPoints: 100 });
    expect(replay.status).toBe(409);
    const [award] = await ctx.sql<{ id: string }[]>`select id from app.loyalty_awards where user_id = ${c.userId} and status = 'credited'`;
    await as(ctx, admin).post(`/api/v1/admin/loyalty/awards/${award!.id}/reverse`).send({ reason: "Подтверждённое злоупотребление" });
    expect((await as(ctx, c).get("/api/v1/me/loyalty")).body.balance).toBe(-400);
    await as(ctx, manager).post(`/api/v1/admin/sales/${sale.saleId}/refunds`).set("Idempotency-Key", key()).send({ amountKopecks: 4_590_000, reason: "Полный возврат" });
    expect((await as(ctx, c).get("/api/v1/me/loyalty")).body.balance).toBe(0);
  });

  it("keeps staff accounts out of the customer cabinet", async () => {
    const res = await as(ctx, manager).post("/api/v1/me/email/request").send({ email: "takeover@example.test" });
    expect(res.status).toBe(403);
    expect((await as(ctx, manager).get("/api/v1/me")).status).toBe(403);
  });

  it("reverses the bonus when the lead is closed as spam", async () => {
    const c = await clientLogin("spam@example.test");
    const lead = await submit(c);
    const d = await as(ctx, manager).get(`/api/v1/admin/leads/${lead.body.reference}`);
    await as(ctx, manager).post(`/api/v1/admin/leads/${lead.body.reference}/status`).send({ to: "closed", version: d.body.lead.version, reason: "spam" });
    expect((await as(ctx, c).get("/api/v1/me/loyalty")).body.balance).toBe(0);
  });
});

describe("telegram login", () => {
  it("creates a client, takes the verified phone and lets the client claim a phone lead", async () => {
    const guest = await submit(null, { contact: { preferred: "phone", phone: "+79005556677" } });
    const { res } = await telegramLogin({ sub: "tg-42", name: "Тест", phone_number: "79005556677", phone_number_verified: true });
    expect(res.status).toBe(200);
    const s = { cookie: cookieFrom(res), csrf: res.body.csrfToken as string };
    const me = await as(ctx, s).get("/api/v1/me");
    expect(me.body.profile).toMatchObject({ phone: "+79005556677", phoneVerified: true, identities: ["telegram"] });
    const claim = await as(ctx, s).post("/api/v1/me/leads/claim").send({ references: [guest.body.reference] });
    expect(claim.body.items[0].claimed).toBe(true);
    const again = await telegramLogin({ sub: "tg-42" });
    expect(again.res.body.user.id).toBe(res.body.user.id);
  });

  it("links Telegram to an email cabinet and refuses a Telegram already linked elsewhere", async () => {
    await telegramLogin({ sub: "tg-taken" });
    const c = await clientLogin("linker@example.test");
    const nonceFor = async () => (await as(ctx, c).post("/api/v1/auth/telegram/nonce")).body.nonce as string;
    const n1 = await nonceFor();
    const ok = await as(ctx, c).post("/api/v1/me/identities/telegram").send({ idToken: idToken({ sub: "tg-mine", nonce: n1 }), nonce: n1 });
    expect(ok.status).toBe(200);
    const n2 = await nonceFor();
    const taken = await as(ctx, c).post("/api/v1/me/identities/telegram").send({ idToken: idToken({ sub: "tg-taken", nonce: n2 }), nonce: n2 });
    expect(taken.status).toBe(409);
  });

  it("rejects a reused nonce, a foreign audience and a forged signature", async () => {
    const n = await loginNonce();
    const token = idToken({ sub: "tg-1", nonce: n.nonce });
    expect((await telegramPost(n).send({ idToken: token, nonce: n.nonce })).status).toBe(200);
    expect((await telegramPost(n).send({ idToken: token, nonce: n.nonce })).status).toBe(400);
    const n2 = await loginNonce();
    const foreign = idToken({ sub: "tg-2", nonce: n2.nonce, aud: "123" });
    expect((await telegramPost(n2).send({ idToken: foreign, nonce: n2.nonce })).status).toBe(400);
    const n3 = await loginNonce();
    const parts = idToken({ sub: "tg-3", nonce: n3.nonce }).split(".");
    const forged = [parts[0], Buffer.from(JSON.stringify({ iss: "https://oauth.telegram.org", aud: CLIENT_ID, sub: "admin", exp: 9e9, nonce: n3.nonce })).toString("base64url"), parts[2]].join(".");
    expect((await telegramPost(n3).send({ idToken: forged, nonce: n3.nonce })).status).toBe(400);
  });

  it("accepts a login nonce only from the browser that requested it", async () => {
    const n = await loginNonce();
    expect(n.binder).not.toBe("");
    const token = idToken({ sub: "tg-bound", nonce: n.nonce });
    expect((await ctx.http().post("/api/v1/auth/telegram").send({ idToken: token, nonce: n.nonce })).status).toBe(400);
    const other = await loginNonce();
    expect((await telegramPost(other).send({ idToken: token, nonce: n.nonce })).status).toBe(400);
    const ok = await telegramPost(n).send({ idToken: token, nonce: n.nonce });
    expect(ok.status).toBe(200);
    expect(binderFrom(ok)).toBe("ax_tg_login=");
  });

  it("keeps earlier nonces of the same browser valid when another nonce is requested", async () => {
    const first = await loginNonce();
    const second = await ctx.http().post("/api/v1/auth/telegram/nonce").set("Cookie", first.binder);
    expect(binderFrom(second)).toBe(first.binder);
    const a = await telegramPost(first).send({ idToken: idToken({ sub: "tg-tab-1", nonce: first.nonce }), nonce: first.nonce });
    expect(a.status).toBe(200);
    const b = await telegramPost(first).send({ idToken: idToken({ sub: "tg-tab-2", nonce: second.body.nonce }), nonce: second.body.nonce });
    expect(b.status).toBe(200);
  });
});

describe("offers and news", () => {
  async function createOffer(extra: Record<string, unknown> = {}) {
    const created = await as(ctx, editor).post("/api/v1/admin/posts").send({
      type: "offer", slug: `offer-${randomUUID().slice(0, 6)}`, title: "Скидка постоянным", summary: "После первой покупки",
      offer: { minPurchases: 1, benefit: "5% на второй комплект" }, ...extra,
    });
    expect(created.status).toBe(201);
    const pub = await as(ctx, editor).post(`/api/v1/admin/posts/${created.body.id}/status`).send({ version: created.body.version, status: "published" });
    expect(pub.status).toBe(200);
    return created.body.id as string;
  }

  it("publishes an offer and applies it only after enough confirmed purchases", async () => {
    const offerId = await createOffer();
    expect((await ctx.http().get("/api/v1/offers")).body.items).toHaveLength(1);
    const c = await clientLogin("loyal@example.test");
    const first = await submit(c);
    const early = await confirmSale(first.body.reference, { offerId });
    expect(early.res.status).toBe(422);
    expect((await confirmSale(first.body.reference, {})).res.status).toBe(200);
    const second = await submit(c);
    const applied = await confirmSale(second.body.reference, { offerId });
    expect(applied.res.status).toBe(200);
    const [sale] = await ctx.sql`select offer_id, offer_rule_version from app.sales where id = ${applied.saleId}`;
    expect(sale).toEqual({ offer_id: offerId, offer_rule_version: 1 });
    const mine = await as(ctx, c).get("/api/v1/me/offers");
    expect(mine.body.items[0].eligible).toBe(true);
  });

  it("does not apply an expired offer", async () => {
    const offerId = await createOffer({ offer: { minPurchases: null, benefit: "Сезон" } });
    await ctx.sql`update app.posts set starts_at = now() - interval '2 days', ends_at = now() - interval '1 day' where id = ${offerId}`;
    const c = await clientLogin("late@example.test");
    const lead = await submit(c);
    expect((await confirmSale(lead.body.reference, { offerId })).res.status).toBe(422);
    expect((await ctx.http().get("/api/v1/offers")).body.items).toHaveLength(0);
  });

  it("applies an offer only to its variants and refuses unknown variants", async () => {
    const other = await variantId(ctx, "jac-t9-front-tube", "С защитой картера");
    const list = await as(ctx, editor).get("/api/v1/admin/offer-variants");
    expect(list.status).toBe(200);
    expect(list.body.items.map((i: { id: string }) => i.id)).toEqual(expect.arrayContaining([v1, other]));
    const unknown = await as(ctx, editor).post("/api/v1/admin/posts").send({
      type: "offer", slug: "offer-unknown", title: "Нет варианта", offer: { variantIds: [randomUUID()] },
    });
    expect(unknown.status).toBe(422);
    const c = await clientLogin("variant-offer@example.test");
    const wrong = await createOffer({ offer: { minPurchases: null, benefit: "Только с картером", variantIds: [other] } });
    const lead = await submit(c);
    expect((await confirmSale(lead.body.reference, { offerId: wrong })).res.status).toBe(422);
    const right = await createOffer({ offer: { minPurchases: null, benefit: "Без картера", variantIds: [v1, v1] } });
    expect((await as(ctx, editor).get(`/api/v1/admin/posts/${right}`)).body.post.variantIds).toEqual([v1]);
    expect((await confirmSale(lead.body.reference, { offerId: right })).res.status).toBe(200);
  });

  it("keeps omitted offer fields on a partial edit and returns the full post", async () => {
    const offerId = await createOffer({ offer: { minPurchases: 2, benefit: "Старое", variantIds: [] } });
    const [p] = await ctx.sql<{ version: number }[]>`select version from app.posts where id = ${offerId}`;
    const patch = await as(ctx, editor).patch(`/api/v1/admin/posts/${offerId}`).send({ version: p!.version, offer: { benefit: "Новое" } });
    expect(patch.status).toBe(200);
    const full = await as(ctx, editor).get(`/api/v1/admin/posts/${offerId}`);
    expect(full.body.post).toMatchObject({ minPurchases: 2, benefit: "Новое", ruleVersion: 2, summary: "После первой покупки" });
    const clear = await as(ctx, editor).patch(`/api/v1/admin/posts/${offerId}`).send({ version: patch.body.version, offer: { minPurchases: null } });
    expect(clear.status).toBe(200);
    expect((await as(ctx, editor).get(`/api/v1/admin/posts/${offerId}`)).body.post.minPurchases).toBeNull();
    expect((await as(ctx, editor).get(`/api/v1/admin/posts/${randomUUID()}`)).status).toBe(404);
  });

  it("serves published news", async () => {
    const n = await as(ctx, editor).post("/api/v1/admin/posts").send({ type: "news", slug: "new-press", title: "Новый пресс", summary: "Расширили производство" });
    await as(ctx, editor).post(`/api/v1/admin/posts/${n.body.id}/status`).send({ version: n.body.version, status: "published" });
    const res = await ctx.http().get("/api/v1/news/new-press");
    expect(res.body.post.title).toBe("Новый пресс");
  });
});

describe("subscriptions and campaigns", () => {
  async function subscribe(email: string) {
    await ctx.http().post("/api/v1/subscriptions").send({ email, consent: true });
    await ctx.settle();
    const msg = ctx.email.sent.filter((m) => m.to === email).at(-1)!;
    const url = new URL(msg.text.match(/https?:\/\/\S+/)![0]);
    const res = await ctx.http().post("/api/v1/subscriptions/confirm").send({ id: url.searchParams.get("id"), token: url.searchParams.get("token") });
    expect(res.status).toBe(200);
    return url.searchParams.get("id")!;
  }

  it("requires consent, double opt-in, and skips people who unsubscribed before sending", async () => {
    expect((await ctx.http().post("/api/v1/subscriptions").send({ email: "n@example.test", consent: false })).status).toBe(422);
    const a = await subscribe("a@example.test");
    await subscribe("b@example.test");
    const c = await as(ctx, editor).post("/api/v1/admin/campaigns").send({ subject: "Новинки ноября", bodyText: "Мы выпустили новые комплекты для JAC T9." });
    const at = new Date(Date.now() + 1000).toISOString();
    expect((await as(ctx, editor).post(`/api/v1/admin/campaigns/${c.body.id}/schedule`).send({ version: c.body.version, at, confirm: true })).status).toBe(403);
    expect((await as(ctx, admin).post(`/api/v1/admin/campaigns/${c.body.id}/schedule`).send({ version: c.body.version, at, confirm: true })).status).toBe(200);
    await ctx.sql`update app.campaigns set scheduled_at = now() - interval '1 second'`;
    ctx.email.sent = [];
    await dispatchCampaigns(ctx.deps);
    const unsubToken = (await import("../src/services/campaigns")).subscriptionToken(ctx.deps, a, "unsubscribe");
    await ctx.http().post(`/api/v1/subscriptions/one-click?id=${a}&token=${unsubToken}`);
    await runJobs(ctx.deps);
    expect(ctx.email.sent.map((m) => m.to)).toEqual(["b@example.test"]);
    expect(ctx.email.sent[0]!.headers!["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    const list = await as(ctx, editor).get("/api/v1/admin/campaigns");
    expect(list.body.items[0].report).toEqual({ accepted: 1, skipped: 1 });
    const repeat = await ctx.http().post("/api/v1/subscriptions/unsubscribe").send({ id: a, token: unsubToken });
    expect(repeat.status).toBe(200);
  });
});
