import { catalogQuery, type MetaResponse } from "@armorix/contracts";
import { Router } from "express";
import type { Deps } from "../deps";
import { notFound, parse } from "../http/errors";
import { getProduct, listCatalog } from "../services/catalog";

const publicCache = "public, s-maxage=60, stale-while-revalidate=300";

export async function loadMeta(deps: Deps): Promise<MetaResponse> {
  const methods = await deps.sql<{ code: MetaResponse["deliveryMethods"][number]["code"]; label: string }[]>`
    select code, label from delivery_methods where enabled order by sort, code`;
  const [contacts] = await deps.sql<{ value: MetaResponse["contacts"] }[]>`
    select value from site_settings where key = 'contacts'`;
  return {
    features: {
      account: deps.cfg.FEATURE_ACCOUNT,
      loyalty: deps.cfg.FEATURE_LOYALTY,
      offers: deps.cfg.FEATURE_OFFERS,
      news: deps.cfg.FEATURE_NEWS,
      campaigns: deps.cfg.FEATURE_CAMPAIGNS,
    },
    deliveryMethods: methods,
    contacts: contacts?.value ?? {},
  };
}

export function publicRoutes(deps: Deps) {
  const r = Router();

  r.get("/meta", async (_req, res) => {
    res.set("Cache-Control", publicCache).json(await loadMeta(deps));
  });

  r.get("/vehicles", async (_req, res) => {
    const items = await deps.sql<{ slug: string; make: string; model: string }[]>`
      select v.slug, v.make, v.model from vehicle_models v
      where v.published and exists (
        select 1 from compatibilities c join products p on p.id = c.product_id
        where c.vehicle_model_id = v.id and p.status = 'published')
      order by v.sort, v.slug`;
    res.set("Cache-Control", publicCache).json({ items: items.map((v) => ({ ...v, label: `${v.make} ${v.model}` })) });
  });

  r.get("/catalog", async (req, res) => {
    const q = parse(catalogQuery, req.query);
    res.set("Cache-Control", publicCache).json(await listCatalog(deps.sql, q));
  });

  r.get("/catalog/:slug", async (req, res) => {
    const vehicle = typeof req.query.vehicle === "string" ? req.query.vehicle.slice(0, 80) : undefined;
    const result = await getProduct(deps.sql, String(req.params.slug).slice(0, 80), vehicle);
    if (!result) throw notFound("Товар не найден");
    res.set("Cache-Control", publicCache);
    res.json("redirect" in result ? result : { product: result });
  });

  r.get("/sitemap", async (_req, res) => {
    const products = await deps.sql<{ slug: string; updated_at: Date }[]>`
      select slug, updated_at from products where status = 'published' order by slug`;
    const statics = ["/", "/catalog", "/about", "/contacts", "/privacy"];
    const now = new Date().toISOString();
    res.set("Cache-Control", publicCache).json({
      urls: [
        ...statics.map((path) => ({ path, updatedAt: now })),
        ...products.map((p) => ({ path: `/catalog/${p.slug}`, updatedAt: p.updated_at.toISOString() })),
      ],
    });
  });

  return r;
}
