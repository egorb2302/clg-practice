import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { makeDeps, resetData, type Ctx } from "./helpers";

let ctx: Ctx;
beforeAll(async () => {
  ctx = makeDeps();
  await resetData(ctx);
});
afterAll(async () => {
  await ctx.sql.end();
});

describe("public catalog", () => {
  it("returns only products compatible with the chosen vehicle", async () => {
    const res = await ctx.http().get("/api/v1/catalog?vehicle=jac-t9");
    expect(res.status).toBe(200);
    const slugs = res.body.items.map((i: { slug: string }) => i.slug);
    expect(slugs).toContain("jac-t9-front-tube");
    expect(slugs).toContain("universal-steps");
    expect(slugs).not.toContain("haval-h3-front-double");
    expect(res.body.items.every((i: { vehicle: { slug: string } }) => i.vehicle.slug === "jac-t9")).toBe(true);
    expect(res.headers["cache-control"]).toContain("s-maxage=60");
  });

  it("computes the from price per vehicle and never borrows another vehicle's price", async () => {
    const jac = await ctx.http().get("/api/v1/catalog?vehicle=jac-t9");
    const haval = await ctx.http().get("/api/v1/catalog?vehicle=haval-h3");
    const pick = (body: { items: { slug: string; priceFrom: number | null }[] }, slug: string) =>
      body.items.find((i) => i.slug === slug);
    expect(pick(jac.body, "universal-steps")!.priceFrom).toBe(6_490_000);
    expect(pick(haval.body, "universal-steps")!.priceFrom).toBe(6_190_000);
    expect(pick(jac.body, "jac-t9-front-tube")!.priceFrom).toBe(4_590_000);
  });

  it("ignores unavailable variants and keeps a missing price as null", async () => {
    const haval = await ctx.http().get("/api/v1/catalog?vehicle=haval-h3");
    const front = haval.body.items.find((i: { slug: string }) => i.slug === "haval-h3-front-double");
    expect(front.priceFrom).toBe(5_190_000);
    const jac = await ctx.http().get("/api/v1/catalog?vehicle=jac-t9");
    const kit = jac.body.items.find((i: { slug: string }) => i.slug === "jac-t9-kit-black");
    expect(kit.priceFrom).toBeNull();
    expect(kit.status).toBe("on_request");
  });

  it("returns facets and filters by position", async () => {
    const res = await ctx.http().get("/api/v1/catalog?vehicle=jac-t9&position=front");
    expect(res.body.items.map((i: { slug: string }) => i.slug)).toEqual(["jac-t9-front-tube"]);
    const values = res.body.filters.position.map((f: { value: string }) => f.value).sort();
    expect(values).toEqual(["front", "kit", "rear"]);
    expect(res.body.filters.material.map((f: { value: string }) => f.value)).toEqual(["aisi304"]);
    const all = await ctx.http().get("/api/v1/catalog?vehicle=jac-t9");
    expect(all.body.filters.material.map((f: { value: string }) => f.value).sort()).toEqual(["aisi304", "powder"]);
  });

  it("rejects invalid filters with 422", async () => {
    const res = await ctx.http().get("/api/v1/catalog?position=side");
    expect(res.status).toBe(422);
    expect(res.body.code).toBe("VALIDATION");
    expect(res.body.requestId).toBeTruthy();
  });

  it("serves product detail in the vehicle context", async () => {
    const res = await ctx.http().get("/api/v1/catalog/universal-steps?vehicle=haval-h3");
    expect(res.status).toBe(200);
    expect(res.body.product.vehicle.slug).toBe("haval-h3");
    expect(res.body.product.priceFrom).toBe(6_190_000);
    expect(res.body.product.variants).toHaveLength(2);
  });

  it("returns 404 for unknown products and a redirect for old slugs", async () => {
    expect((await ctx.http().get("/api/v1/catalog/nope")).status).toBe(404);
    const [p] = await ctx.sql<{ id: string }[]>`select id from app.products where slug = 'jac-t9-rear-corners'`;
    await ctx.sql`insert into app.slug_redirects (old_slug, product_id) values ('old-rear', ${p!.id})`;
    const res = await ctx.http().get("/api/v1/catalog/old-rear");
    expect(res.body).toEqual({ redirect: "jac-t9-rear-corners" });
  });

  it("hides archived products from the catalog and the sitemap", async () => {
    await ctx.sql`update app.products set status = 'archived' where slug = 'haval-h3-rear-tube'`;
    const res = await ctx.http().get("/api/v1/catalog?vehicle=haval-h3");
    expect(res.body.items.map((i: { slug: string }) => i.slug)).not.toContain("haval-h3-rear-tube");
    expect((await ctx.http().get("/api/v1/catalog/haval-h3-rear-tube")).status).toBe(404);
    const sm = await ctx.http().get("/api/v1/sitemap");
    expect(sm.body.urls.map((u: { path: string }) => u.path)).not.toContain("/catalog/haval-h3-rear-tube");
  });

  it("exposes meta with delivery methods and disabled release-2 flags", async () => {
    const res = await ctx.http().get("/api/v1/meta");
    expect(res.body.features).toEqual({ account: false, loyalty: false, offers: false, news: false, campaigns: false });
    expect(res.body.deliveryMethods.map((d: { code: string }) => d.code)).toEqual(["pickup", "shipping", "install"]);
  });

  it("returns a JSON 404 for unknown API routes", async () => {
    const res = await ctx.http().get("/api/v1/whatever");
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("NOT_FOUND");
  });
});
