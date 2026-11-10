import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { as, createStaff, key, leadBody, loginStaff, makeDeps, resetData, variantId, type Ctx } from "./helpers";

let ctx: Ctx;
let manager: { cookie: string; csrf: string };
let editor: { cookie: string; csrf: string };
let admin: { cookie: string; csrf: string };
let ref: string;

beforeAll(async () => {
  ctx = makeDeps();
});
beforeEach(async () => {
  await resetData(ctx);
  await createStaff(ctx, "m@armorix.test", ["manager"]);
  await createStaff(ctx, "e@armorix.test", ["editor"]);
  await createStaff(ctx, "a@armorix.test", ["admin"]);
  manager = await loginStaff(ctx, "m@armorix.test");
  editor = await loginStaff(ctx, "e@armorix.test");
  admin = await loginStaff(ctx, "a@armorix.test");
  const v1 = await variantId(ctx, "jac-t9-front-tube", "Без защиты картера");
  const res = await ctx.http().post("/api/v1/leads").set("Idempotency-Key", key()).send(leadBody([{ variantId: v1, quantity: 1 }]));
  ref = res.body.reference;
  await ctx.settle();
});
afterAll(async () => {
  await ctx.sql.end();
});

describe("admin leads", () => {
  it("lists and finds a lead by number and phone", async () => {
    const byNum = await as(ctx, manager).get(`/api/v1/admin/leads?q=${ref.slice(3)}`);
    expect(byNum.body.items.map((l: { reference: string }) => l.reference)).toEqual([ref]);
    const byPhone = await as(ctx, manager).get("/api/v1/admin/leads?q=89001234567");
    expect(byPhone.body.total).toBe(1);
    expect(byPhone.body.items[0].phone).toBe("+79001234567");
  });

  it("keeps editors out of the lead queue", async () => {
    expect((await as(ctx, editor).get("/api/v1/admin/leads")).status).toBe(403);
  });

  it("moves through statuses with version checks and records events", async () => {
    const d = await as(ctx, manager).get(`/api/v1/admin/leads/${ref}`);
    const v = d.body.lead.version;
    const ok = await as(ctx, manager).post(`/api/v1/admin/leads/${ref}/status`).send({ to: "in_progress", version: v });
    expect(ok.status).toBe(200);
    const stale = await as(ctx, manager).post(`/api/v1/admin/leads/${ref}/status`).send({ to: "offer_agreed", version: v });
    expect(stale.status).toBe(409);
    expect(stale.body.code).toBe("VERSION_CONFLICT");
    const bad = await as(ctx, manager).post(`/api/v1/admin/leads/${ref}/status`).send({ to: "sale_confirmed", version: ok.body.version });
    expect(bad.body.code).toBe("INVALID_TRANSITION");
    const noReason = await as(ctx, manager).post(`/api/v1/admin/leads/${ref}/status`).send({ to: "closed", version: ok.body.version });
    expect(noReason.status).toBe(422);
    const closed = await as(ctx, manager)
      .post(`/api/v1/admin/leads/${ref}/status`)
      .send({ to: "closed", version: ok.body.version, reason: "price" });
    expect(closed.status).toBe(200);
    const after = await as(ctx, manager).get(`/api/v1/admin/leads/${ref}`);
    expect(after.body.events.map((e: { type: string }) => e.type)).toEqual(["created", "status", "status"]);
    expect(after.body.notifications.every((n: { status: string }) => n.status === "sent")).toBe(true);
  });

  it("confirms a sale once, links it to the lead and refunds idempotently", async () => {
    const draft = await as(ctx, manager).post(`/api/v1/admin/leads/${ref}/sale`);
    expect(draft.status).toBe(201);
    const again = await as(ctx, manager).post(`/api/v1/admin/leads/${ref}/sale`);
    expect(again.body.saleId).toBe(draft.body.saleId);
    const id = draft.body.saleId;
    const sv = (await as(ctx, manager).get(`/api/v1/admin/sales/${id}`)).body.sale.version;
    const body = { version: sv, amountKopecks: 4_800_000, soldOn: "2026-11-10", externalId: "INV-1" };
    expect((await as(ctx, manager).post(`/api/v1/admin/sales/${id}/confirm`).send(body)).status).toBe(200);
    const repeat = await as(ctx, manager).post(`/api/v1/admin/sales/${id}/confirm`).send(body);
    expect(repeat.body.alreadyConfirmed).toBe(true);
    const other = await as(ctx, manager).post(`/api/v1/admin/sales/${id}/confirm`).send({ ...body, externalId: "INV-2" });
    expect(other.status).toBe(409);
    const [{ n }] = (await ctx.sql`select count(*)::int as n from app.sales where status <> 'draft'`) as unknown as [{ n: number }];
    expect(n).toBe(1);
    const lead = await as(ctx, manager).get(`/api/v1/admin/leads/${ref}`);
    expect(lead.body.lead.status).toBe("sale_confirmed");

    const offline = await as(ctx, manager).post("/api/v1/admin/sales").send({ items: [{ title: "Пороги", quantity: 1 }] });
    const dupExternal = await as(ctx, manager).post(`/api/v1/admin/sales/${offline.body.saleId}/confirm`).send({ ...body, version: 1 });
    expect(dupExternal.status).toBe(409);
    expect(dupExternal.body.fieldErrors.externalId).toBeTruthy();

    const k = key();
    const r1 = await as(ctx, manager).post(`/api/v1/admin/sales/${id}/refunds`).set("Idempotency-Key", k).send({ amountKopecks: 800_000, reason: "Возврат крепежа" });
    const r2 = await as(ctx, manager).post(`/api/v1/admin/sales/${id}/refunds`).set("Idempotency-Key", k).send({ amountKopecks: 800_000, reason: "Возврат крепежа" });
    expect(r1.status).toBe(201);
    expect(r2.status).toBe(200);
    expect(r2.body.refunded).toBe(800_000);
    const tooMuch = await as(ctx, manager).post(`/api/v1/admin/sales/${id}/refunds`).set("Idempotency-Key", key()).send({ amountKopecks: 4_100_000, reason: "Слишком много" });
    expect(tooMuch.status).toBe(422);
  });

  it("does not let an editor confirm sales", async () => {
    const draft = await as(ctx, manager).post(`/api/v1/admin/leads/${ref}/sale`);
    const res = await as(ctx, editor).post(`/api/v1/admin/sales/${draft.body.saleId}/confirm`).send({ version: 1, amountKopecks: 1, soldOn: "2026-11-10", externalId: "X" });
    expect(res.status).toBe(403);
  });

  it("rejects confirming a sale edited after the screen was loaded", async () => {
    const draft = await as(ctx, manager).post(`/api/v1/admin/leads/${ref}/sale`);
    const id = draft.body.saleId;
    const edited = await as(ctx, manager).patch(`/api/v1/admin/sales/${id}`).send({ version: 1, items: [{ title: "Другой состав", quantity: 2 }] });
    expect(edited.status).toBe(200);
    const stale = await as(ctx, manager).post(`/api/v1/admin/sales/${id}/confirm`).send({ version: 1, amountKopecks: 100, soldOn: "2026-11-10", externalId: "S-1" });
    expect(stale.status).toBe(409);
    expect(stale.body.code).toBe("VERSION_CONFLICT");
  });

  it("does not allow a sale draft on a lead whose sale is already confirmed", async () => {
    const draft = await as(ctx, manager).post(`/api/v1/admin/leads/${ref}/sale`);
    await as(ctx, manager).post(`/api/v1/admin/sales/${draft.body.saleId}/confirm`).send({ version: 1, amountKopecks: 100, soldOn: "2026-11-10", externalId: "S-2" });
    const second = await as(ctx, manager).post(`/api/v1/admin/leads/${ref}/sale`);
    expect(second.status).toBe(409);
  });

  it("masks contacts for staff with a sales grant but no contacts grant", async () => {
    await createStaff(ctx, "seller@armorix.test", ["editor", "sales_confirm"]);
    const seller = await loginStaff(ctx, "seller@armorix.test");
    const res = await as(ctx, seller).get(`/api/v1/admin/leads/${ref}`);
    expect(res.status).toBe(200);
    expect(res.body.lead.phone).toBe("+7***4567");
    expect(res.body.lead.email).toBe("i***@example.test");
    const change = await as(ctx, seller).post(`/api/v1/admin/leads/${ref}/status`).send({ to: "in_progress", version: 1 });
    expect(change.status).toBe(403);
  });
});

describe("admin catalog", () => {
  it("creates a product, blocks publishing without photos, redirects the old slug", async () => {
    const [jac] = await ctx.sql<{ id: string }[]>`select id from app.vehicle_models where slug = 'jac-t9'`;
    const created = await as(ctx, editor).post("/api/v1/admin/catalog").send({
      slug: "new-guard", code: "T9-NEW", title: "Новая защита", position: "front", description: "Описание", material: "aisi304",
    });
    expect(created.status).toBe(201);
    const id = created.body.id;
    const wrongVehicle = await as(ctx, editor).post(`/api/v1/admin/catalog/${id}/variants`).send({ vehicleModelId: jac!.id, title: "Базовый", priceKopecks: 100_000 });
    expect(wrongVehicle.status).toBe(409);
    const c = await as(ctx, editor).put(`/api/v1/admin/catalog/${id}/compatibilities`).send({ version: created.body.version, items: [{ vehicleModelId: jac!.id }] });
    expect(c.status).toBe(200);
    expect((await as(ctx, editor).post(`/api/v1/admin/catalog/${id}/variants`).send({ vehicleModelId: jac!.id, title: "Базовый", priceKopecks: 100_000 })).status).toBe(201);
    const pub = await as(ctx, editor).post(`/api/v1/admin/catalog/${id}/publish`).send({ version: c.body.version });
    expect(pub.status).toBe(422);
    expect(pub.body.fieldErrors.media).toBeTruthy();

    const [existing] = await ctx.sql<{ id: string; version: number }[]>`select id, version from app.products where slug = 'jac-t9-rear-corners'`;
    const ren = await as(ctx, editor).patch(`/api/v1/admin/catalog/${existing!.id}`).send({ version: existing!.version, slug: "jac-t9-rear-corners-v2" });
    expect(ren.status).toBe(200);
    const old = await ctx.http().get("/api/v1/catalog/jac-t9-rear-corners");
    expect(old.body).toEqual({ redirect: "jac-t9-rear-corners-v2" });
  });

  it("uploads, validates and processes a photo locally", async () => {
    const sharp = (await import("sharp")).default;
    const [p] = await ctx.sql<{ id: string }[]>`select id from app.products where slug = 'jac-t9-front-tube'`;
    const up = await as(ctx, editor).post("/api/v1/admin/media/upload-url").send({ productId: p!.id, contentType: "image/png" });
    expect(up.status).toBe(201);
    const path = new URL(up.body.uploadUrl).pathname;
    const tiny = await sharp({ create: { width: 100, height: 100, channels: 3, background: "#888" } }).png().toBuffer();
    await as(ctx, editor).put(path).set("Content-Type", "application/octet-stream").send(tiny);
    const rejected = await as(ctx, editor).post(`/api/v1/admin/media/${up.body.mediaId}/process`);
    expect(rejected.status).toBe(422);

    const up2 = await as(ctx, editor).post("/api/v1/admin/media/upload-url").send({ productId: p!.id, contentType: "image/png" });
    const big = await sharp({ create: { width: 2000, height: 1200, channels: 3, background: "#456" } }).png().toBuffer();
    await as(ctx, editor).put(new URL(up2.body.uploadUrl).pathname).set("Content-Type", "application/octet-stream").send(big);
    const done = await as(ctx, editor).post(`/api/v1/admin/media/${up2.body.mediaId}/process`);
    expect(done.status).toBe(200);
    expect(done.body.width).toBe(1600);
    expect(done.body.variants.map((v: { width: number }) => v.width)).toEqual([480, 960, 1600]);
  });

  it("keeps other fields on a partial product edit", async () => {
    const [p] = await ctx.sql<{ id: string; version: number }[]>`select id, version from app.products where slug = 'jac-t9-front-tube'`;
    const res = await as(ctx, editor).patch(`/api/v1/admin/catalog/${p!.id}`).send({ version: p!.version, title: "Новое название" });
    expect(res.status).toBe(200);
    const [after] = await ctx.sql`select title, description, composition, material, installation from app.products where id = ${p!.id}`;
    expect(after!.title).toBe("Новое название");
    expect(after!.description).toContain("Демонстрационная");
    expect(after!.composition).toHaveLength(3);
    expect(after!.material).toBe("aisi304");
    expect(after!.installation).toBeTruthy();
  });

  it("removes a vehicle from compatibility even when it has variants, and hides it publicly", async () => {
    const [p] = await ctx.sql<{ id: string; version: number }[]>`select id, version from app.products where slug = 'universal-steps'`;
    const [haval] = await ctx.sql<{ id: string }[]>`select id from app.vehicle_models where slug = 'haval-h3'`;
    const [jac] = await ctx.sql<{ id: string }[]>`select id from app.vehicle_models where slug = 'jac-t9'`;
    const res = await as(ctx, editor).put(`/api/v1/admin/catalog/${p!.id}/compatibilities`).send({ version: p!.version, items: [{ vehicleModelId: jac!.id }] });
    expect(res.status).toBe(200);
    const list = await ctx.http().get("/api/v1/catalog?vehicle=haval-h3");
    expect(list.body.items.map((i: { slug: string }) => i.slug)).not.toContain("universal-steps");
    const detail = await ctx.http().get("/api/v1/catalog/universal-steps");
    expect(detail.body.product.variants.every((v: { vehicleSlug: string }) => v.vehicleSlug === "jac-t9")).toBe(true);
    const variant = await as(ctx, editor).post(`/api/v1/admin/catalog/${p!.id}/variants`).send({ vehicleModelId: haval!.id, title: "Снова", priceKopecks: 1000 });
    expect(variant.status).toBe(409);
  });

  it("keeps managers from editing the catalog", async () => {
    const res = await as(ctx, manager).post("/api/v1/admin/catalog").send({ slug: "x", code: "X", title: "X", position: "front" });
    expect(res.status).toBe(403);
  });
});

describe("admin system", () => {
  it("invites staff and queues an invite email", async () => {
    const res = await as(ctx, admin).post("/api/v1/admin/users").send({ email: "new@armorix.test", name: "Новый", roles: ["manager"] });
    expect(res.status).toBe(201);
    await ctx.settle();
    expect(ctx.email.sent.some((m) => m.to === "new@armorix.test")).toBe(true);
    expect((await as(ctx, manager).post("/api/v1/admin/users").send({ email: "n2@armorix.test", name: "N", roles: ["admin"] })).status).toBe(403);
  });

  it("records an audit trail", async () => {
    const d = await as(ctx, manager).get(`/api/v1/admin/leads/${ref}`);
    await as(ctx, manager).post(`/api/v1/admin/leads/${ref}/status`).send({ to: "in_progress", version: d.body.lead.version });
    const a = await as(ctx, admin).get(`/api/v1/admin/audit?entity=lead&entityId=${ref}`);
    expect(a.body.items.map((x: { action: string }) => x.action)).toContain("lead.status");
  });
});
