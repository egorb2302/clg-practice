import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { runJobs } from "../src/services/outbox";
import { key, leadBody, makeDeps, resetData, variantId, type Ctx } from "./helpers";

let ctx: Ctx;
let v1: string;
let v2: string;
beforeAll(async () => {
  ctx = makeDeps();
});
beforeEach(async () => {
  await resetData(ctx);
  ctx.email.sent = [];
  ctx.email.failWith = null;
  ctx.telegram.calls = [];
  v1 = await variantId(ctx, "jac-t9-front-tube", "Без защиты картера");
  v2 = await variantId(ctx, "jac-t9-rear-corners", "Уголки 63 мм");
});
afterAll(async () => {
  await ctx.sql.end();
});

const post = (k: string | null, body: unknown) => {
  const r = ctx.http().post("/api/v1/leads");
  return (k ? r.set("Idempotency-Key", k) : r).send(body as object);
};

describe("POST /leads", () => {
  it("creates a catalog lead with a snapshot, an event and queued notifications", async () => {
    const res = await post(key(), leadBody([{ variantId: v1, quantity: 2, seenPriceFrom: 4_590_000 }]));
    expect(res.status).toBe(201);
    expect(res.body.reference).toMatch(/^AX-\d{6}$/);
    expect(res.body.status).toBe("received");
    const [lead] = await ctx.sql<{ id: string; phone: string; status: string }[]>`
      select id, phone, status from app.leads where reference = ${res.body.reference}`;
    expect(lead!.phone).toBe("+79001234567");
    expect(lead!.status).toBe("new");
    const items = await ctx.sql`select product_title, price_from_kopecks, quantity from app.lead_items where lead_id = ${lead!.id}`;
    expect(items).toEqual([{ product_title: "Защита переднего бампера, труба 63 мм", price_from_kopecks: 4_590_000, quantity: 2 }]);
    const jobs = await ctx.sql`select channel, topic from app.outbox order by topic, channel`;
    expect(jobs).toHaveLength(3);
    await ctx.settle();
    expect(ctx.telegram.calls[0]!.params.text).toContain(res.body.reference);
    expect(String(ctx.telegram.calls[0]!.params.text)).not.toContain("+7900");
    expect(ctx.email.sent.map((m) => m.to).sort()).toEqual(["ivan@example.test", "staff@armorix.test"]);
  });

  it("returns the same reference for a retry with the same key and creates one lead", async () => {
    const k = key();
    const body = leadBody([{ variantId: v1, quantity: 1 }]);
    const a = await post(k, body);
    const b = await post(k, { ...body, fillMs: body.fillMs + 5 });
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(b.body.reference).toBe(a.body.reference);
    const [{ n }] = (await ctx.sql`select count(*)::int as n from app.leads`) as unknown as [{ n: number }];
    expect(n).toBe(1);
  });

  it("handles concurrent submissions with the same key as one lead", async () => {
    const k = key();
    const body = leadBody([{ variantId: v1, quantity: 1 }]);
    const results = await Promise.all([post(k, body), post(k, body), post(k, body)]);
    const ok = results.filter((r) => r.status === 201);
    expect(ok.length).toBeGreaterThanOrEqual(1);
    expect(new Set(ok.map((r) => r.body.reference)).size).toBe(1);
    for (const r of results) expect([201, 409]).toContain(r.status);
    const [{ n }] = (await ctx.sql`select count(*)::int as n from app.leads`) as unknown as [{ n: number }];
    expect(n).toBe(1);
  });

  it("rejects the same key with a different body", async () => {
    const k = key();
    await post(k, leadBody([{ variantId: v1, quantity: 1 }]));
    const res = await post(k, leadBody([{ variantId: v1, quantity: 3 }]));
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("IDEMPOTENCY_MISMATCH");
  });

  it("requires an idempotency key", async () => {
    const res = await post(null, leadBody([{ variantId: v1, quantity: 1 }]));
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("IDEMPOTENCY_KEY_REQUIRED");
  });

  it("reports catalog changes and creates nothing", async () => {
    await ctx.sql`update app.variants set status = 'archived' where id = ${v2}`;
    const res = await post(key(), leadBody([
      { variantId: v1, quantity: 1, seenPriceFrom: 4_000_000 },
      { variantId: v2, quantity: 1 },
    ]));
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("CATALOG_CHANGED");
    expect(res.body.changes).toEqual([
      { variantId: v1, available: true, priceFrom: 4_590_000 },
      { variantId: v2, available: false, priceFrom: null },
    ]);
    const [{ n }] = (await ctx.sql`select (select count(*) from app.leads) + (select count(*) from app.outbox) as n`) as unknown as [{ n: number }];
    expect(n).toBe(0);
  });

  it("returns field errors next to the fields", async () => {
    const res = await post(key(), {
      ...leadBody([{ variantId: v1, quantity: 0 }]),
      contact: { preferred: "phone" },
      name: "",
    });
    expect(res.status).toBe(422);
    expect(res.body.fieldErrors).toMatchObject({
      name: expect.any(String),
      "contact.phone": "Укажите телефон",
      "items.0.quantity": expect.any(String),
    });
  });

  it("rejects an invalid phone number", async () => {
    const res = await post(key(), leadBody([{ variantId: v1, quantity: 1 }], { contact: { preferred: "phone", phone: "12345" } }));
    expect(res.status).toBe(422);
    expect(res.body.fieldErrors["contact.phone"]).toBe("Проверьте номер телефона");
  });

  it("requires a delivery method when several are enabled", async () => {
    const body = leadBody([{ variantId: v1, quantity: 1 }]);
    delete (body as Record<string, unknown>).deliveryMethod;
    const res = await post(key(), body);
    expect(res.status).toBe(422);
    expect(res.body.fieldErrors.deliveryMethod).toBeTruthy();
    await ctx.sql`update app.delivery_methods set enabled = false where code <> 'pickup'`;
    const ok = await post(key(), body);
    expect(ok.status).toBe(201);
  });

  it("answers bots with a fake success and stores nothing", async () => {
    const trap = await post(key(), leadBody([{ variantId: v1, quantity: 1 }], { website: "http://spam" }));
    const fast = await post(key(), leadBody([{ variantId: v1, quantity: 1 }], { fillMs: 200 }));
    expect(trap.status).toBe(201);
    expect(fast.status).toBe(201);
    const [{ n }] = (await ctx.sql`select count(*)::int as n from app.leads`) as unknown as [{ n: number }];
    expect(n).toBe(0);
  });

  it("accepts custom and general requests", async () => {
    const custom = await post(key(), {
      type: "custom",
      name: "Пётр",
      contact: { preferred: "email", email: "Petr@Example.test" },
      vehicle: { make: "Toyota", model: "Land Cruiser 300", year: 2023 },
      request: "Нужна защита переднего бампера с лебёдкой",
      website: "",
      fillMs: 5000,
    });
    expect(custom.status).toBe(201);
    const general = await post(key(), {
      type: "general",
      name: "Анна",
      contact: { preferred: "phone", phone: "+7 912 000 11 22" },
      message: "Есть ли установка в выходные?",
      website: "",
      fillMs: 5000,
    });
    expect(general.status).toBe(201);
    const rows = await ctx.sql`select type, email, vehicle_model from app.leads order by number`;
    expect(rows).toEqual([
      { type: "custom", email: "petr@example.test", vehicle_model: "Land Cruiser 300" },
      { type: "general", email: null, vehicle_model: null },
    ]);
  });

  it("keeps the lead when email delivery is down and retries later", async () => {
    ctx.email.failWith = new Error("smtp down");
    const res = await post(key(), leadBody([{ variantId: v1, quantity: 1 }]));
    expect(res.status).toBe(201);
    await ctx.settle();
    const pending = await ctx.sql<{ status: string; attempts: number }[]>`
      select status, attempts from app.outbox where channel = 'email'`;
    expect(pending.every((j) => j.status === "pending" && j.attempts === 1)).toBe(true);
    ctx.email.failWith = null;
    await ctx.sql`update app.outbox set run_after = now() where status = 'pending'`;
    const r = await runJobs(ctx.deps);
    expect(r.sent).toBe(2);
    expect(ctx.email.sent).toHaveLength(2);
  });

  it("keeps old lead items when the product is archived", async () => {
    const res = await post(key(), leadBody([{ variantId: v1, quantity: 1 }]));
    await ctx.sql`update app.products set status = 'archived', title = 'Переименовано' where slug = 'jac-t9-front-tube'`;
    const [item] = await ctx.sql`
      select i.product_title from app.lead_items i join app.leads l on l.id = i.lead_id where l.reference = ${res.body.reference}`;
    expect(item!.product_title).toBe("Защита переднего бампера, труба 63 мм");
  });

  it("rate-limits by IP", async () => {
    const limited = makeDeps({ LEAD_LIMIT_IP_PER_HOUR: "2" });
    const send = () =>
      limited.http().post("/api/v1/leads").set("Idempotency-Key", key()).set("X-Forwarded-For", "203.0.113.9")
        .send(leadBody([{ variantId: v1, quantity: 1 }]));
    expect((await send()).status).toBe(201);
    expect((await send()).status).toBe(201);
    const third = await send();
    expect(third.status).toBe(429);
    expect(third.body.retryAfterSec).toBeGreaterThan(0);
    await limited.settle();
    await limited.sql.end();
  });

  it("treats a slow fill as human regardless of the client clock", async () => {
    const res = await post(key(), leadBody([{ variantId: v1, quantity: 1 }], { fillMs: 4000, formStartedAt: Date.now() + 3_600_000 }));
    expect(res.status).toBe(201);
    const [{ n }] = (await ctx.sql`select count(*)::int as n from app.leads`) as unknown as [{ n: number }];
    expect(n).toBe(1);
  });

  it("requires the price the user saw for each item", async () => {
    const body = leadBody([{ variantId: v1, quantity: 1 }]);
    const res = await post(key(), { ...body, items: [{ variantId: v1, quantity: 1 }] });
    expect(res.status).toBe(422);
    expect(res.body.fieldErrors["items.0.seenPriceFrom"]).toBeTruthy();
  });

  it("limits every contact separately", async () => {
    const limited = makeDeps({ LEAD_LIMIT_CONTACT_PER_HOUR: "1" });
    const send = (phone: string) =>
      limited.http().post("/api/v1/leads").set("Idempotency-Key", key())
        .send(leadBody([{ variantId: v1, quantity: 1 }], { contact: { preferred: "email", email: "same@example.test", phone } }));
    expect((await send("+79001110001")).status).toBe(201);
    expect((await send("+79001110002")).status).toBe(429);
    await limited.settle();
    await limited.sql.end();
  });

  it("accepts a public lead from a browser that also holds a staff session, as an anonymous lead", async () => {
    const { createStaff, loginStaff } = await import("./helpers");
    await createStaff(ctx, "busy@armorix.test", ["manager"]);
    const s = await loginStaff(ctx, "busy@armorix.test");
    const res = await ctx.http().post("/api/v1/leads").set("Cookie", s.cookie).set("Idempotency-Key", key())
      .send(leadBody([{ variantId: v1, quantity: 1 }]));
    expect(res.status).toBe(201);
    const [lead] = await ctx.sql`select owner_user_id from app.leads where reference = ${res.body.reference}`;
    expect(lead!.owner_user_id).toBeNull();
    const admin = await ctx.http().post("/api/v1/admin/leads/AX-000001/notes").set("Cookie", s.cookie).send({ text: "x" });
    expect(admin.status).toBe(403);
  });

  it("trusts the visitor IP from the site proxy only with the shared secret", async () => {
    const proxied = makeDeps({ LEAD_LIMIT_IP_PER_HOUR: "1", SITE_PROXY_SECRET: "proxy-secret-for-tests-0123456789" });
    const send = (ip: string, secret: string) =>
      proxied.http().post("/api/v1/leads").set("Idempotency-Key", key())
        .set("X-Forwarded-For", "10.0.0.1").set("x-armorix-client-ip", ip).set("x-armorix-proxy-secret", secret)
        .send(leadBody([{ variantId: v1, quantity: 1 }], { contact: { preferred: "email", email: `${ip}@example.test` } }));
    expect((await send("198.51.100.1", "proxy-secret-for-tests-0123456789")).status).toBe(201);
    expect((await send("198.51.100.2", "proxy-secret-for-tests-0123456789")).status).toBe(201);
    expect((await send("198.51.100.3", "wrong-secret-wrong-secret-000000")).status).toBe(201);
    expect((await send("198.51.100.4", "wrong-secret-wrong-secret-000000")).status).toBe(429);
    await proxied.settle();
    await proxied.sql.end();
  });

  it("rejects foreign origins", async () => {
    const res = await ctx.http().post("/api/v1/leads").set("Origin", "https://evil.test").set("Idempotency-Key", key())
      .send(leadBody([{ variantId: v1, quantity: 1 }]));
    expect(res.status).toBe(403);
  });
});
