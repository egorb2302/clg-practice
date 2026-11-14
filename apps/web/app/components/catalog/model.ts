import type { Position, ProductCard as Card, Vehicle } from "@armorix/contracts";
import { positions } from "@armorix/contracts";

export const PER_PAGE = 12;

export const PRICE_KEYS = ["to30", "30-40", "from40", "ask"] as const;
export type PriceKey = (typeof PRICE_KEYS)[number];
export const STOCK_KEYS = ["available", "on_request"] as const;
export type StockKey = (typeof STOCK_KEYS)[number];
export const SORTS = ["price_asc", "price_desc"] as const;
export type Sort = (typeof SORTS)[number];

export const GROUPS = ["position", "material", "price", "stock"] as const;
export type GroupKey = (typeof GROUPS)[number];

export type CatQuery = {
  vehicle?: string;
  position: string[];
  material: string[];
  price: string[];
  stock: string[];
  sort?: Sort;
  page: number;
};

export const GROUP_TITLE: Record<GroupKey, string> = {
  position: "Что защищаем",
  material: "Покрытие",
  price: "Цена",
  stock: "Наличие",
};

const POS_LABEL: Record<Position, string> = { front: "Передняя", rear: "Задняя", kit: "Комплект" };
const PRICE_LABEL: Record<PriceKey, string> = { to30: "до 30 000 ₽", "30-40": "от 30 000 до 40 000 ₽", from40: "от 40 000 ₽", ask: "Цена по запросу" };
const STOCK_LABEL: Record<StockKey, string> = { available: "В наличии", on_request: "Под заказ" };
const COAT_SHORT: Record<string, string> = { aisi304: "Нержавейка, полировка", powder: "Черная порошковая" };

export function swatchOf(code: string | undefined | null): "steel" | "black" {
  return code === "powder" || /black|powder|чер/i.test(code ?? "") ? "black" : "steel";
}

export function coatLabel(code: string, apiLabel?: string): string {
  return COAT_SHORT[code] ?? apiLabel ?? code;
}

const list = (sp: URLSearchParams, k: string) =>
  [...new Set(sp.getAll(k).flatMap((v) => v.split(",")).map((v) => v.trim()).filter(Boolean))].slice(0, 12);

export function parseQuery(sp: URLSearchParams): CatQuery {
  const vehicle = sp.get("vehicle")?.trim().slice(0, 80) || undefined;
  const sort = sp.get("sort");
  const page = Math.min(50, Math.max(1, Number.parseInt(sp.get("page") ?? "1", 10) || 1));
  return {
    vehicle,
    position: list(sp, "position").filter((v) => (positions as readonly string[]).includes(v)),
    material: list(sp, "material").filter((v) => /^[a-z0-9_-]{1,40}$/i.test(v)),
    price: list(sp, "price").filter((v) => (PRICE_KEYS as readonly string[]).includes(v)),
    stock: list(sp, "stock").filter((v) => (STOCK_KEYS as readonly string[]).includes(v)),
    sort: (SORTS as readonly string[]).includes(sort ?? "") ? (sort as Sort) : undefined,
    page,
  };
}

export function toSearch(q: Partial<CatQuery>): string {
  const p = new URLSearchParams();
  if (q.vehicle) p.set("vehicle", q.vehicle);
  for (const g of GROUPS) for (const v of q[g] ?? []) p.append(g, v);
  if (q.sort) p.set("sort", q.sort);
  if (q.page && q.page > 1) p.set("page", String(q.page));
  return p.toString();
}

export function catHref(q: Partial<CatQuery>): string {
  const s = toSearch(q);
  return `/catalog${s ? `?${s}` : ""}`;
}

export function priceKey(kop: number | null): PriceKey {
  if (kop == null) return "ask";
  if (kop < 3_000_000) return "to30";
  if (kop < 4_000_000) return "30-40";
  return "from40";
}

const valueOf: Record<GroupKey, (c: Card) => string> = {
  position: (c) => c.position,
  material: (c) => c.coating?.code ?? "",
  price: (c) => priceKey(c.priceFrom),
  stock: (c) => c.status,
};

const ORDER: Record<GroupKey, readonly string[]> = { position: ["front", "rear", "kit"], material: [], price: PRICE_KEYS, stock: STOCK_KEYS };

function labelOf(g: GroupKey, v: string, cards: Card[]): string {
  if (g === "position") return POS_LABEL[v as Position] ?? v;
  if (g === "price") return PRICE_LABEL[v as PriceKey] ?? v;
  if (g === "stock") return STOCK_LABEL[v as StockKey] ?? v;
  return coatLabel(v, cards.find((c) => c.coating?.code === v)?.coating?.label);
}

const matches = (c: Card, q: CatQuery, except?: GroupKey) =>
  GROUPS.every((g) => g === except || !q[g].length || q[g].includes(valueOf[g](c)));

export const cardKey = (c: Card) => `${c.slug}|${c.vehicle.slug}`;

export type FacetOpt = { value: string; label: string; count: number; checked: boolean; swatch?: "steel" | "black" };
export type FacetGroup = { key: GroupKey; title: string; options: FacetOpt[] };
export type VehicleOpt = { slug: string; label: string; count: number; minPrice: number | null };
export type Chip = { group: GroupKey; value: string; label: string };
export type CardGroup = { slug: string; label: string; total: number; items: Card[] };

export type CatalogView = {
  vehicles: VehicleOpt[];
  vehicle: VehicleOpt | null;
  facets: FacetGroup[];
  chips: Chip[];
  total: number;
  baseTotal: number;
  baseMin: number | null;
  shown: number;
  page: number;
  pages: number;
  sortable: boolean;
  grouped: boolean;
  groups: CardGroup[];
  discounts: Record<string, number>;
  q: CatQuery;
};

const minPrice = (cards: Card[]) => {
  const ps = cards.map((c) => c.priceFrom).filter((p): p is number => p != null);
  return ps.length ? Math.min(...ps) : null;
};

export function kitDiscounts(all: Card[]): Record<string, number> {
  const out: Record<string, number> = {};
  const shared = new Set(all.filter((c, i) => all.findIndex((x) => x.slug === c.slug) !== i).map((c) => c.slug));
  for (const k of all) {
    if (k.position !== "kit" || k.priceFrom == null || shared.has(k.slug)) continue;
    const same = all.filter((c) => c.vehicle.slug === k.vehicle.slug);
    const f = minPrice(same.filter((c) => c.position === "front"));
    const r = minPrice(same.filter((c) => c.position === "rear"));
    if (f == null || r == null || k.priceFrom >= f + r) continue;
    const pct = Math.floor((1 - k.priceFrom / (f + r)) * 100);
    if (pct >= 1) out[cardKey(k)] = pct;
  }
  return out;
}

export function buildCatalog(all: Card[], kitVehicles: Vehicle[], q: CatQuery): CatalogView {
  const vehicles: VehicleOpt[] = kitVehicles.map((v) => {
    const own = all.filter((c) => c.vehicle.slug === v.slug);
    return { slug: v.slug, label: v.label, count: own.length, minPrice: minPrice(own) };
  });
  const vehicle = vehicles.find((v) => v.slug === q.vehicle) ?? null;
  const qq: CatQuery = { ...q, vehicle: vehicle?.slug };
  const base = vehicle ? all.filter((c) => c.vehicle.slug === vehicle.slug) : all;

  const facets: FacetGroup[] = [];
  for (const g of GROUPS) {
    const present = [...new Set(base.map(valueOf[g]).filter(Boolean))];
    const vals = [...new Set([...present, ...qq[g]])];
    const order = ORDER[g];
    vals.sort((a, b) => (order.length ? order.indexOf(a) - order.indexOf(b) : labelOf(g, a, base).localeCompare(labelOf(g, b, base), "ru")));
    if (present.length < 2 && !qq[g].length) continue;
    const pool = base.filter((c) => matches(c, qq, g));
    facets.push({
      key: g,
      title: GROUP_TITLE[g],
      options: vals.map((v) => ({
        value: v,
        label: labelOf(g, v, base),
        count: pool.filter((c) => valueOf[g](c) === v).length,
        checked: qq[g].includes(v),
        ...(g === "material" ? { swatch: swatchOf(v) } : {}),
      })),
    });
  }
  const chips: Chip[] = GROUPS.flatMap((g) => qq[g].map((v) => ({ group: g, value: v, label: labelOf(g, v, base) })));

  let res = base.filter((c) => matches(c, qq));
  if (qq.sort) {
    const dir = qq.sort === "price_asc" ? 1 : -1;
    res = [...res].sort((a, b) => {
      if (a.priceFrom == null && b.priceFrom == null) return 0;
      if (a.priceFrom == null) return 1;
      if (b.priceFrom == null) return -1;
      return (a.priceFrom - b.priceFrom) * dir;
    });
  }
  const total = res.length;
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const page = Math.min(qq.page, pages);
  const visible = res.slice(0, page * PER_PAGE);
  const grouped = !vehicle && !qq.sort && total <= 24 && vehicles.length > 1;
  const groups: CardGroup[] = grouped
    ? vehicles
        .map((v) => ({ slug: v.slug, label: v.label, total: res.filter((c) => c.vehicle.slug === v.slug).length, items: visible.filter((c) => c.vehicle.slug === v.slug) }))
        .filter((g) => g.items.length)
    : [{ slug: "", label: "", total, items: visible }];

  const disc = kitDiscounts(all);
  const discounts: Record<string, number> = {};
  for (const c of visible) if (disc[cardKey(c)]) discounts[cardKey(c)] = disc[cardKey(c)]!;

  return {
    vehicles,
    vehicle,
    facets,
    chips,
    total,
    baseTotal: base.length,
    baseMin: minPrice(base),
    shown: visible.length,
    page,
    pages,
    sortable: total > 10 || !!qq.sort,
    grouped,
    groups,
    discounts,
    q: { ...qq, page },
  };
}
