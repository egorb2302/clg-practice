import type { CatalogQuery, CatalogResponse, Facet, Image, Position, ProductDetail } from "@armorix/contracts";
import type { Db } from "../db";

export const PAGE_SIZE = 24;

const vehicleLabel = (make: string, model: string) => `${make} ${model}`;

type CardRow = {
  slug: string;
  code: string;
  title: string;
  position: Position;
  material: string | null;
  vehicle_slug: string;
  vehicle_make: string;
  vehicle_model: string;
  price_from: number | null;
  image: Image | null;
  total: number;
};

export async function listCatalog(db: Db, q: CatalogQuery): Promise<CatalogResponse> {
  const offset = (q.page - 1) * PAGE_SIZE;
  const base = db`
    from products p
    join compatibilities c on c.product_id = p.id and c.active
    join vehicle_models v on v.id = c.vehicle_model_id and v.published
    where p.status = 'published'
      and exists (select 1 from variants x where x.product_id = p.id and x.vehicle_model_id = v.id and x.status = 'active')
      ${q.vehicle ? db`and v.slug = ${q.vehicle}` : db``}`;

  const rows = await db<CardRow[]>`
    select p.slug, p.code, p.title, p.position, p.material,
      v.slug as vehicle_slug, v.make as vehicle_make, v.model as vehicle_model,
      (select min(x.price_kopecks) from variants x
        where x.product_id = p.id and x.vehicle_model_id = v.id and x.status = 'active'
          and x.available and x.price_kopecks is not null) as price_from,
      (select json_build_object('url', m.url, 'alt', m.alt, 'width', m.width, 'height', m.height)
        from media m where m.product_id = p.id and m.status = 'ready' order by m.sort, m.created_at limit 1) as image,
      count(*) over () as total
    ${base}
      ${q.position ? db`and p.position = ${q.position}` : db``}
      ${q.material ? db`and p.material = ${q.material}` : db``}
    order by v.sort, v.slug, p.position, p.title
    limit ${PAGE_SIZE} offset ${offset}`;

  const positionFacets = await db<Facet[]>`
    select p.position as value, p.position as label, count(distinct p.id)::int as count
    ${base}
      ${q.material ? db`and p.material = ${q.material}` : db``}
    group by p.position order by p.position`;

  const materialFacets = await db<Facet[]>`
    select p.material as value, (select label from materials where code = p.material) as label,
      count(distinct p.id)::int as count
    ${base}
      and p.material is not null
      ${q.position ? db`and p.position = ${q.position}` : db``}
    group by p.material order by 2`;

  return {
    items: rows.map((r) => ({
      slug: r.slug,
      code: r.code,
      title: r.title,
      vehicle: { slug: r.vehicle_slug, label: vehicleLabel(r.vehicle_make, r.vehicle_model) },
      position: r.position,
      image: r.image,
      priceFrom: r.price_from,
      status: r.price_from === null ? "on_request" : "available",
    })),
    filters: {
      position: positionFacets.map((f) => ({ ...f, label: positionLabels[f.value as Position] ?? f.value })),
      material: materialFacets,
    },
    page: q.page,
    pageSize: PAGE_SIZE,
    total: rows[0]?.total ?? 0,
  };
}

export const positionLabels: Record<Position, string> = {
  front: "Передняя защита",
  rear: "Задняя защита",
  kit: "Комплект",
};

export async function getProduct(db: Db, slug: string, vehicleSlug?: string): Promise<ProductDetail | { redirect: string } | null> {
  const [p] = await db<
    { id: string; slug: string; code: string; title: string; position: Position; description: string; composition: string[]; material: string | null; material_label: string | null; installation: string | null }[]
  >`
    select p.id, p.slug, p.code, p.title, p.position, p.description, p.composition, p.material,
      mt.label as material_label, p.installation
    from products p left join materials mt on mt.code = p.material
    where p.slug = ${slug} and p.status = 'published'`;

  if (!p) {
    const [r] = await db<{ slug: string }[]>`
      select p.slug from slug_redirects s join products p on p.id = s.product_id
      where s.old_slug = ${slug} and p.status = 'published'`;
    return r ? { redirect: r.slug } : null;
  }

  const compat = await db<{ id: string; slug: string; make: string; model: string; note: string | null }[]>`
    select v.id, v.slug, v.make, v.model, c.note
    from compatibilities c join vehicle_models v on v.id = c.vehicle_model_id and v.published
    where c.product_id = ${p.id} and c.active
      and exists (select 1 from variants x where x.product_id = ${p.id} and x.vehicle_model_id = v.id and x.status = 'active')
    order by v.sort, v.slug`;
  if (compat.length === 0) return null;

  const selected = compat.find((c) => c.slug === vehicleSlug) ?? compat[0]!;

  const variants = await db<{ id: string; title: string; vehicle_slug: string; price: number | null; available: boolean }[]>`
    select x.id, x.title, v.slug as vehicle_slug, x.price_kopecks as price, x.available
    from variants x join vehicle_models v on v.id = x.vehicle_model_id and v.published
    join compatibilities c on c.product_id = x.product_id and c.vehicle_model_id = x.vehicle_model_id and c.active
    where x.product_id = ${p.id} and x.status = 'active'
    order by v.sort, x.sort, x.title`;

  const gallery = await db<Image[]>`
    select url, alt, width, height from media
    where product_id = ${p.id} and status = 'ready' order by sort, created_at`;

  const inContext = variants.filter((v) => v.vehicle_slug === selected.slug && v.available && v.price !== null);
  const priceFrom = inContext.length ? Math.min(...inContext.map((v) => v.price!)) : null;

  return {
    slug: p.slug,
    code: p.code,
    title: p.title,
    vehicle: { slug: selected.slug, label: vehicleLabel(selected.make, selected.model) },
    position: p.position,
    image: gallery[0] ?? null,
    priceFrom,
    status: priceFrom === null ? "on_request" : "available",
    gallery,
    description: p.description,
    composition: p.composition,
    material: p.material_label,
    installation: p.installation,
    compatibility: compat.map((c) => ({
      vehicleSlug: c.slug,
      label: vehicleLabel(c.make, c.model),
      ...(c.note ? { note: c.note } : {}),
    })),
    variants: variants.map((v) => ({
      id: v.id,
      title: v.title,
      vehicleSlug: v.vehicle_slug,
      priceFrom: v.available ? v.price : null,
      available: v.available,
    })),
  };
}
