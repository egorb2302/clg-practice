/* API_MOCK=1: local fixtures with the same shapes as apps/api (JAC T9 and Haval H3,
   8 products, one without a price, one archived variant). Server-only: the browser reaches
   it through the /api/v1/* proxy route, so idempotency and rate limits live in one place.
   Test hooks for screenshots, mock only: a comment or message containing #429 or #500. */
import {
  leadRequestSchema,
  type CatalogResponse,
  type Facet,
  type Image,
  type MetaResponse,
  type Position,
  type ProductCard,
  type ProductDetail,
  type SitemapResponse,
  type VehiclesResponse,
} from "@armorix/contracts";

type Variant = ProductDetail["variants"][number] & { material: "aisi304" | "powder" };
type Product = Omit<ProductDetail, "variants" | "priceFrom" | "material"> & { variants: Variant[]; updatedAt: string };

const img = (name: string, w: number, h: number, alt: string): Image => ({ url: `/img/${name}.webp`, alt, width: w, height: h });
const rub = (n: number) => n * 100;

const MATERIAL: Record<Variant["material"], string> = {
  aisi304: "Нержавеющая сталь AISI 304, зеркальная полировка",
  powder: "Черная сталь, порошковое покрытие",
};
const MATERIAL_SHORT: Record<Variant["material"], string> = { aisi304: "AISI 304", powder: "Порошковое покрытие" };

export const META: MetaResponse = {
  features: { account: false, loyalty: false, offers: false, news: false, campaigns: false },
  deliveryMethods: [
    { code: "pickup", label: "Самовывоз" },
    { code: "shipping", label: "Доставка транспортной компанией" },
    { code: "install", label: "Установка у нас" },
  ],
  contacts: {
    phone: "+7 900 000-00-00",
    email: "hello@armorix.ru",
    telegram: "armorix",
    address: "Москва, мастерская по записи",
    hours: "Будни с 10 до 19, суббота с 11 до 16",
  },
};

const VEHICLES: VehiclesResponse["items"] = [
  { slug: "jac-t9", make: "JAC", model: "T9", label: "JAC T9" },
  { slug: "haval-h3", make: "Haval", model: "H3", label: "Haval H3" },
];
const T9 = { slug: "jac-t9", label: "JAC T9" };
const H3 = { slug: "haval-h3", label: "Haval H3" };

const MOUNT = "На штатные точки крепления, без сверления кузова и без снятия бампера. Крепеж и инструкция в комплекте. Установка у нас занимает около 2,5 часа.";

const PRODUCTS: Product[] = [
  {
    slug: "jac-t9-front-tube", code: "AX-T9-F01", title: "Передняя защита бампера, труба Ø 76", vehicle: T9, position: "front",
    image: img("bumper", 1600, 937, "Передняя защита из полированной стали на бампере пикапа"), status: "available",
    gallery: [img("bumper", 1600, 937, "Передняя защита из полированной стали на бампере пикапа"), img("truck", 1600, 667, "Пикап с передней защитой на горной дороге"), img("steel-tubes", 1067, 1600, "Гнутые трубы из нержавеющей стали")],
    description: "Основная дуга из трубы Ø 76 мм с двумя вертикальными стойками закрывает бампер и нижнюю часть решетки. Рассчитана на ветки, кочки и удары на малой скорости, не мешает работе парктроников.",
    composition: ["Дуга Ø 76 мм с двумя стойками Ø 63 мм", "Кронштейны под штатные точки рамы", "Крепеж из нержавеющей стали", "Инструкция по установке"],
    installation: MOUNT,
    compatibility: [{ vehicleSlug: "jac-t9", label: "JAC T9", note: "Все комплектации с 2022 года" }],
    variants: [
      { id: "0b7c2f4e-1a11-4c3a-9a51-2f0f6c1a0001", title: "AISI 304, зеркальная полировка", vehicleSlug: "jac-t9", priceFrom: rub(45900), available: true, material: "aisi304" },
      { id: "0b7c2f4e-1a11-4c3a-9a51-2f0f6c1a0002", title: "Черная сталь, порошковое покрытие", vehicleSlug: "jac-t9", priceFrom: rub(36900), available: true, material: "powder" },
    ],
    updatedAt: "2026-11-08T10:00:00.000Z",
  },
  {
    slug: "jac-t9-bullbar", code: "AX-T9-F02", title: "Кенгурин с защитой фар", vehicle: T9, position: "front",
    image: img("bullbar", 1600, 992, "Кенгурин с защитой фар на передней части пикапа"), status: "available",
    gallery: [img("bullbar", 1600, 992, "Кенгурин с защитой фар на передней части пикапа"), img("steel-chrome", 1600, 900, "Полированная сталь крупным планом")],
    description: "Высокая дуга закрывает решетку радиатора и фары. Есть площадка под дополнительный свет. Подходит для поездок по лесным дорогам, где ветки бьют выше бампера.",
    composition: ["Кенгурин из трубы Ø 63 мм", "Защитные дуги фар", "Площадка под балку света", "Кронштейны и крепеж"],
    installation: MOUNT,
    compatibility: [{ vehicleSlug: "jac-t9", label: "JAC T9", note: "Не совместим с лебедочной площадкой" }],
    variants: [
      { id: "0b7c2f4e-1a11-4c3a-9a51-2f0f6c1a0003", title: "AISI 304, зеркальная полировка", vehicleSlug: "jac-t9", priceFrom: rub(58900), available: true, material: "aisi304" },
    ],
    updatedAt: "2026-11-08T10:00:00.000Z",
  },
  {
    slug: "jac-t9-rear", code: "AX-T9-R01", title: "Задняя защита, уголки", vehicle: T9, position: "rear",
    image: img("hero-wet", 1600, 1067, "Пикап на мокрой лесной дороге"), status: "available",
    gallery: [img("hero-wet", 1600, 1067, "Пикап на мокрой лесной дороге"), img("tex-brushed", 1199, 675, "Шлифованная сталь")],
    description: "Два уголка защищают задний бампер при парковке задним ходом и съезде с крутого склона. Не закрывают фаркоп и номер.",
    composition: ["Два уголка из трубы Ø 63 мм", "Кронштейны под штатные точки", "Крепеж"],
    installation: MOUNT,
    compatibility: [{ vehicleSlug: "jac-t9", label: "JAC T9" }],
    variants: [
      { id: "0b7c2f4e-1a11-4c3a-9a51-2f0f6c1a0004", title: "AISI 304, зеркальная полировка", vehicleSlug: "jac-t9", priceFrom: rub(32900), available: true, material: "aisi304" },
      { id: "0b7c2f4e-1a11-4c3a-9a51-2f0f6c1a0005", title: "Черная сталь, порошковое покрытие", vehicleSlug: "jac-t9", priceFrom: rub(27900), available: true, material: "powder" },
    ],
    updatedAt: "2026-11-08T10:00:00.000Z",
  },
  {
    slug: "jac-t9-kit", code: "AX-T9-K01", title: "Комплект: передняя и задняя защита", vehicle: T9, position: "kit",
    image: img("truck", 1600, 667, "Пикап с комплектом защиты на горной дороге"), status: "available",
    gallery: [img("truck", 1600, 667, "Пикап с комплектом защиты на горной дороге"), img("bumper", 1600, 937, "Передняя защита крупным планом"), img("hero-wet", 1600, 1067, "Пикап на мокрой лесной дороге")],
    description: "Передняя дуга Ø 76 мм и задние уголки одним заказом. Дешевле, чем по отдельности, ставим за один визит.",
    composition: ["Передняя защита AX-T9-F01", "Задняя защита AX-T9-R01", "Весь крепеж и инструкция"],
    installation: MOUNT,
    compatibility: [{ vehicleSlug: "jac-t9", label: "JAC T9", note: "Все комплектации с 2022 года" }],
    variants: [
      { id: "0b7c2f4e-1a11-4c3a-9a51-2f0f6c1a0006", title: "AISI 304, зеркальная полировка", vehicleSlug: "jac-t9", priceFrom: rub(74900), available: true, material: "aisi304" },
      { id: "0b7c2f4e-1a11-4c3a-9a51-2f0f6c1a0007", title: "С порогами (снят с производства)", vehicleSlug: "jac-t9", priceFrom: rub(89900), available: false, material: "aisi304" },
    ],
    updatedAt: "2026-11-08T10:00:00.000Z",
  },
  {
    slug: "haval-h3-front-tube", code: "AX-H3-F01", title: "Передняя защита бампера, труба Ø 63", vehicle: H3, position: "front",
    image: img("road-mud", 1600, 1075, "Внедорожник с передней защитой в грязи"), status: "available",
    gallery: [img("road-mud", 1600, 1075, "Внедорожник с передней защитой в грязи"), img("car-snow", 1600, 1067, "Внедорожник на снежной дороге")],
    description: "Низкая дуга повторяет линию бампера Haval H3 и не уменьшает угол въезда. Защищает бампер и туманки.",
    composition: ["Дуга Ø 63 мм", "Кронштейны под штатные точки", "Крепеж из нержавеющей стали", "Инструкция"],
    installation: MOUNT,
    compatibility: [{ vehicleSlug: "haval-h3", label: "Haval H3", note: "Модель с 2024 года" }],
    variants: [
      { id: "0b7c2f4e-1a11-4c3a-9a51-2f0f6c1a0008", title: "AISI 304, зеркальная полировка", vehicleSlug: "haval-h3", priceFrom: rub(42900), available: true, material: "aisi304" },
      { id: "0b7c2f4e-1a11-4c3a-9a51-2f0f6c1a0009", title: "Черная сталь, порошковое покрытие", vehicleSlug: "haval-h3", priceFrom: rub(34900), available: true, material: "powder" },
    ],
    updatedAt: "2026-11-08T10:00:00.000Z",
  },
  {
    slug: "haval-h3-skid", code: "AX-H3-F02", title: "Нижняя дуга переднего бампера", vehicle: H3, position: "front",
    image: img("car-dust", 1600, 1067, "Внедорожник на пыльной дороге"), status: "available",
    gallery: [img("car-dust", 1600, 1067, "Внедорожник на пыльной дороге")],
    description: "Компактная дуга под бампером. Принимает удар от камня и колеи, когда большая защита не нужна.",
    composition: ["Дуга Ø 51 мм", "Кронштейны", "Крепеж"],
    installation: MOUNT,
    compatibility: [{ vehicleSlug: "haval-h3", label: "Haval H3" }],
    variants: [
      { id: "0b7c2f4e-1a11-4c3a-9a51-2f0f6c1a0010", title: "Черная сталь, порошковое покрытие", vehicleSlug: "haval-h3", priceFrom: rub(24900), available: true, material: "powder" },
    ],
    updatedAt: "2026-11-08T10:00:00.000Z",
  },
  {
    slug: "haval-h3-rear", code: "AX-H3-R01", title: "Задняя защита, прямая труба", vehicle: H3, position: "rear",
    image: img("car-snow", 1600, 1067, "Внедорожник на снежной дороге"), status: "on_request",
    gallery: [img("car-snow", 1600, 1067, "Внедорожник на снежной дороге")],
    description: "Прямая труба под задним бампером. Готовим первую партию, цену подтвердит менеджер.",
    composition: ["Труба Ø 63 мм", "Кронштейны", "Крепеж"],
    installation: MOUNT,
    compatibility: [{ vehicleSlug: "haval-h3", label: "Haval H3" }],
    variants: [
      { id: "0b7c2f4e-1a11-4c3a-9a51-2f0f6c1a0011", title: "AISI 304, зеркальная полировка", vehicleSlug: "haval-h3", priceFrom: null, available: true, material: "aisi304" },
    ],
    updatedAt: "2026-11-08T10:00:00.000Z",
  },
  {
    slug: "haval-h3-kit", code: "AX-H3-K01", title: "Комплект: передняя и задняя защита", vehicle: H3, position: "kit",
    image: img("hero-forest", 1600, 1000, "Внедорожник в тумане лесной дороги"), status: "available",
    gallery: [img("hero-forest", 1600, 1000, "Внедорожник в тумане лесной дороги"), img("road-mud", 1600, 1075, "Внедорожник с защитой в грязи")],
    description: "Передняя дуга Ø 63 мм и задняя труба одним заказом, ставим за один визит.",
    composition: ["Передняя защита AX-H3-F01", "Задняя защита AX-H3-R01", "Весь крепеж"],
    installation: MOUNT,
    compatibility: [{ vehicleSlug: "haval-h3", label: "Haval H3", note: "Модель с 2024 года" }],
    variants: [
      { id: "0b7c2f4e-1a11-4c3a-9a51-2f0f6c1a0012", title: "AISI 304, зеркальная полировка", vehicleSlug: "haval-h3", priceFrom: rub(69900), available: true, material: "aisi304" },
    ],
    updatedAt: "2026-11-08T10:00:00.000Z",
  },
];
const REDIRECTS: Record<string, string> = { "t9-front": "jac-t9-front-tube", "h3-front": "haval-h3-front-tube" };

const minPrice = (vs: Variant[]) => {
  const p = vs.filter((v) => v.available && v.priceFrom != null).map((v) => v.priceFrom as number);
  return p.length ? Math.min(...p) : null;
};
const toCard = (p: Product, material?: string): ProductCard => ({
  slug: p.slug, code: p.code, title: p.title, vehicle: p.vehicle, position: p.position, image: p.image, status: p.status,
  priceFrom: minPrice(p.variants.filter((v) => !material || v.material === material)),
});
const facet = (items: Product[], key: "position" | "material"): Facet[] => {
  const counts = new Map<string, number>();
  for (const p of items) {
    const vals = key === "position" ? [p.position] : [...new Set(p.variants.filter((v) => v.available).map((v) => v.material))];
    for (const v of vals) counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  const label = (v: string) => (key === "position" ? { front: "Передняя", rear: "Задняя", kit: "Комплект" }[v as Position] : MATERIAL_SHORT[v as Variant["material"]]) ?? v;
  return [...counts].map(([value, count]) => ({ value, label, count })).map((f) => ({ ...f, label: label(f.value) }));
};

const PAGE_SIZE = 9;
function catalog(q: URLSearchParams): CatalogResponse {
  const vehicle = q.get("vehicle") || undefined, position = q.get("position") || undefined, material = q.get("material") || undefined;
  const page = Math.max(1, Number(q.get("page")) || 1);
  const byVehicle = PRODUCTS.filter((p) => !vehicle || p.vehicle.slug === vehicle);
  const hits = byVehicle
    .filter((p) => !position || p.position === position)
    .filter((p) => !material || p.variants.some((v) => v.available && v.material === material));
  return {
    items: hits.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((p) => toCard(p, material)),
    filters: { position: facet(byVehicle, "position"), material: facet(byVehicle, "material") },
    page, pageSize: PAGE_SIZE, total: hits.length,
  };
}

function product(slug: string): { status: number; body: unknown } {
  if (REDIRECTS[slug]) return { status: 200, body: { redirect: `/catalog/${REDIRECTS[slug]}` } };
  const p = PRODUCTS.find((x) => x.slug === slug);
  if (!p) return { status: 404, body: { code: "NOT_FOUND", message: "Товар не найден", requestId: rid() } };
  const mats = [...new Set(p.variants.map((v) => MATERIAL[v.material]))];
  const detail: ProductDetail = {
    ...toCard(p), gallery: p.gallery, description: p.description, composition: p.composition,
    material: mats.join("; "), installation: p.installation, compatibility: p.compatibility,
    variants: p.variants.map(({ material: _m, ...v }) => v),
  };
  return { status: 200, body: { product: detail } };
}

/* ── leads ── */
const rid = () => Math.random().toString(36).slice(2, 10);
const keys = new Map<string, { hash: string; reference: string }>();
const hits = new Map<string, number[]>();
let seq = 122;

async function lead(raw: unknown, key: string | null): Promise<{ status: number; body: unknown }> {
  await new Promise((r) => setTimeout(r, 700));
  if (!key) return { status: 400, body: { code: "IDEMPOTENCY_KEY_REQUIRED", message: "Нет ключа", requestId: rid() } };
  const hash = JSON.stringify(raw);
  const seen = keys.get(key);
  if (seen) return seen.hash === hash
    ? { status: 201, body: { reference: seen.reference, status: "received" } }
    : { status: 409, body: { code: "IDEMPOTENCY_MISMATCH", message: "Ключ уже использован", requestId: rid() } };

  const parsed = leadRequestSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[i.path.join(".")] ??= i.message;
    return { status: 422, body: { code: "VALIDATION", message: "Проверьте поля", fieldErrors, requestId: rid() } };
  }
  const body = parsed.data;
  const text = "comment" in body ? body.comment ?? "" : "message" in body ? body.message : "";
  if (text.includes("#500")) return { status: 500, body: { code: "INTERNAL", message: "Сбой", requestId: rid() } };
  const who = body.contact.phone || body.contact.email || "";
  const now = Date.now(), list = (hits.get(who) ?? []).filter((t) => now - t < 10 * 60_000);
  if (text.includes("#429") || list.length >= 5) return { status: 429, body: { code: "RATE_LIMITED", message: "Слишком много попыток", retryAfterSec: 300, requestId: rid() } };

  // honeypot or a form filled faster than a person can: answer as success, create nothing
  if (body.website || body.fillMs < 1500) return { status: 201, body: { reference: `AX-${String(++seq).padStart(6, "0")}`, status: "received" } };

  if (body.type === "catalog") {
    const all = PRODUCTS.flatMap((p) => p.variants);
    const changes = body.items.flatMap((it) => {
      const v = all.find((x) => x.id === it.variantId);
      if (!v) return [{ variantId: it.variantId, available: false, priceFrom: null }];
      if (!v.available || v.priceFrom !== it.seenPriceFrom) return [{ variantId: v.id, available: v.available, priceFrom: v.priceFrom }];
      return [];
    });
    if (changes.length) return { status: 409, body: { code: "CATALOG_CHANGED", message: "Каталог изменился", changes, requestId: rid() } };
  }
  hits.set(who, [...list, now]);
  const reference = `AX-${String(++seq).padStart(6, "0")}`;
  keys.set(key, { hash, reference });
  return { status: 201, body: { reference, status: "received" } };
}

/** One entry point with the API's paths: method + path under /api/v1 + query + body. */
export async function mockApi(method: string, path: string, query: URLSearchParams, body?: unknown, headers?: Headers): Promise<{ status: number; body: unknown }> {
  const parts = path.replace(/^\/+|\/+$/g, "").split("/");
  if (method === "GET") {
    if (path === "/meta") return { status: 200, body: META };
    if (path === "/vehicles") return { status: 200, body: { items: VEHICLES } };
    if (path === "/catalog") return { status: 200, body: catalog(query) };
    if (parts[0] === "catalog" && parts[1] && parts.length === 2) return product(decodeURIComponent(parts[1]));
    if (path === "/sitemap") {
      const now = new Date().toISOString();
      const body: SitemapResponse = { urls: [...["/", "/catalog", "/about", "/contacts", "/privacy"].map((p) => ({ path: p, updatedAt: now })), ...PRODUCTS.map((p) => ({ path: `/catalog/${p.slug}`, updatedAt: p.updatedAt }))] };
      return { status: 200, body };
    }
  }
  if (method === "POST" && path === "/leads") return lead(body, headers?.get("Idempotency-Key") ?? null);
  return { status: 404, body: { code: "NOT_FOUND", message: "Нет такого адреса", requestId: rid() } };
}
