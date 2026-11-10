import { randomUUID } from "node:crypto";
import { positions } from "@armorix/contracts";
import { Router } from "express";
import sharp, { type Metadata } from "sharp";
import { z } from "zod";
import type { Deps } from "../../deps";
import { HttpError, notFound, parse, versionConflict } from "../../http/errors";
import { authOf, requireStaff } from "../../security/session";
import { audit } from "../../services/audit";

const slug = z.string().trim().regex(/^[a-z0-9-]{1,80}$/, { error: "Латиница, цифры и дефис" });
const version = z.number().int().positive();

const productFields = {
  slug,
  code: z.string().trim().min(1).max(40),
  title: z.string().trim().min(1).max(200),
  position: z.enum(positions),
  description: z.string().trim().max(5000),
  composition: z.array(z.string().trim().min(1).max(200)).max(50),
  material: z.string().trim().max(40).nullable(),
  installation: z.string().trim().max(2000).nullable(),
};
const productCreate = z.object({
  ...productFields,
  description: productFields.description.default(""),
  composition: productFields.composition.default([]),
  material: productFields.material.default(null),
  installation: productFields.installation.default(null),
});
const productPatch = z.object({ version, ...z.object(productFields).partial().shape });

const compatBody = z.object({
  version,
  items: z.array(z.object({ vehicleModelId: z.uuid(), note: z.string().trim().max(300).nullable().optional() })).max(50),
});

const variantCreate = z.object({
  vehicleModelId: z.uuid(),
  title: z.string().trim().min(1).max(200),
  priceKopecks: z.number().int().positive().nullable(),
  available: z.boolean().default(true),
  sort: z.number().int().default(0),
});
const variantPatch = z.object({
  version,
  title: z.string().trim().min(1).max(200).optional(),
  priceKopecks: z.number().int().positive().nullable().optional(),
  available: z.boolean().optional(),
  status: z.enum(["active", "hidden", "archived"]).optional(),
  sort: z.number().int().optional(),
});

const statusBody = z.object({ version, status: z.enum(["draft", "hidden", "archived"]) });

const vehicleCreate = z.object({
  slug,
  make: z.string().trim().min(1).max(60),
  model: z.string().trim().min(1).max(60),
  sort: z.number().int().default(0),
});
const vehiclePatch = z.object({
  version,
  make: z.string().trim().min(1).max(60).optional(),
  model: z.string().trim().min(1).max(60).optional(),
  sort: z.number().int().optional(),
  published: z.boolean().optional(),
});

const materialBody = z.object({
  code: z.string().trim().regex(/^[a-z0-9_-]{1,40}$/),
  label: z.string().trim().min(1).max(100),
});

const uploadBody = z.object({
  productId: z.uuid(),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
});
const mediaPatch = z.object({ alt: z.string().trim().max(300).optional(), sort: z.number().int().optional() });

const WIDTHS = [480, 960, 1600];
const MAX_UPLOAD = 25 * 1024 * 1024;

const pgCode = (e: unknown) => (e as { code?: string }).code;

function mapDbError(e: unknown): never {
  const code = pgCode(e);
  if (code === "23505") throw new HttpError(409, "CONFLICT", "Значение уже используется (slug или код)");
  if (code === "23503") throw new HttpError(409, "CONFLICT", "Связанная запись не найдена или используется");
  throw e;
}

export function adminCatalogRoutes(deps: Deps) {
  const r = Router();
  const edit = requireStaff("catalog_edit");

  async function loadProduct(id: string) {
    if (!z.uuid().safeParse(id).success) throw notFound("Товар не найден");
    const [p] = await deps.sql<{ id: string; slug: string; status: string; version: number; published_at: Date | null }[]>`
      select id, slug, status, version, published_at from products where id = ${id}`;
    if (!p) throw notFound("Товар не найден");
    return p;
  }

  r.get("/admin/vehicles", requireStaff(), async (_req, res) => {
    res.json({ items: await deps.sql`select id, slug, make, model, sort, published, version from vehicle_models order by sort, slug` });
  });

  r.post("/admin/vehicles", edit, async (req, res) => {
    const b = parse(vehicleCreate, req.body);
    const v = await deps.sql
      .begin(async (tx) => {
        const [row] = await tx<{ id: string; version: number }[]>`
          insert into vehicle_models (slug, make, model, sort) values (${b.slug}, ${b.make}, ${b.model}, ${b.sort})
          returning id, version`;
        await audit(tx, authOf(res).user.id, "vehicle.create", "vehicle", row!.id, b);
        return row!;
      })
      .catch(mapDbError);
    res.status(201).json(v);
  });

  r.patch("/admin/vehicles/:id", edit, async (req, res) => {
    const b = parse(vehiclePatch, req.body);
    const id = String(req.params.id);
    if (!z.uuid().safeParse(id).success) throw notFound("Модель не найдена");
    const row = await deps.sql.begin(async (tx) => {
      const rows = await tx`
        update vehicle_models set
          make = coalesce(${b.make ?? null}, make), model = coalesce(${b.model ?? null}, model),
          sort = coalesce(${b.sort ?? null}, sort), published = coalesce(${b.published ?? null}, published),
          version = version + 1
        where id = ${id} and version = ${b.version} returning id, version`;
      if (rows.length === 0) throw versionConflict();
      await audit(tx, authOf(res).user.id, "vehicle.update", "vehicle", id, b);
      return rows[0];
    });
    res.json(row);
  });

  r.get("/admin/materials", requireStaff(), async (_req, res) => {
    res.json({ items: await deps.sql`select code, label from materials order by label` });
  });

  r.post("/admin/materials", edit, async (req, res) => {
    const b = parse(materialBody, req.body);
    await deps.sql.begin(async (tx) => {
      await tx`insert into materials (code, label) values (${b.code}, ${b.label})
        on conflict (code) do update set label = excluded.label`;
      await audit(tx, authOf(res).user.id, "material.upsert", "material", b.code, b);
    });
    res.status(201).json(b);
  });

  r.get("/admin/catalog", requireStaff(), async (req, res) => {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const items = await deps.sql`
      select p.id, p.slug, p.code, p.title, p.position, p.status, p.version, p.updated_at as "updatedAt",
        (select count(*)::int from variants x where x.product_id = p.id and x.status = 'active') as "activeVariants",
        (select min(x.price_kopecks) from variants x where x.product_id = p.id and x.status = 'active' and x.available) as "minPrice",
        (select count(*)::int from media m where m.product_id = p.id and m.status = 'ready') as "photos"
      from products p
      where true ${status ? deps.sql`and p.status = ${status}` : deps.sql``}
      order by p.updated_at desc limit 500`;
    res.json({ items });
  });

  r.get("/admin/catalog/:id", requireStaff(), async (req, res) => {
    const p = await loadProduct(String(req.params.id));
    const [product] = await deps.sql`
      select id, slug, code, title, position, description, composition, material, installation, status, version,
        published_at as "publishedAt" from products where id = ${p.id}`;
    const compatibilities = await deps.sql`
      select c.vehicle_model_id as "vehicleModelId", v.slug, v.make, v.model, c.note, c.active
      from compatibilities c join vehicle_models v on v.id = c.vehicle_model_id where c.product_id = ${p.id}`;
    const variants = await deps.sql`
      select id, vehicle_model_id as "vehicleModelId", title, price_kopecks as "priceKopecks", available, status, sort, version
      from variants where product_id = ${p.id} order by sort, title`;
    const media = await deps.sql`
      select id, status, url, alt, width, height, sort from media where product_id = ${p.id} order by sort, created_at`;
    res.json({ product, compatibilities, variants, media });
  });

  r.post("/admin/catalog", edit, async (req, res) => {
    const b = parse(productCreate, req.body);
    const p = await deps.sql
      .begin(async (tx) => {
        const [row] = await tx<{ id: string; version: number }[]>`
          insert into products (slug, code, title, position, description, composition, material, installation)
          values (${b.slug}, ${b.code}, ${b.title}, ${b.position}, ${b.description}, ${b.composition}, ${b.material}, ${b.installation})
          returning id, version`;
        await audit(tx, authOf(res).user.id, "product.create", "product", row!.id, { slug: b.slug });
        return row!;
      })
      .catch(mapDbError);
    res.status(201).json(p);
  });

  r.patch("/admin/catalog/:id", edit, async (req, res) => {
    const b = parse(productPatch, req.body);
    const p = await loadProduct(String(req.params.id));
    const actor = authOf(res).user.id;
    const result = await deps.sql
      .begin(async (tx) => {
        const rows = await tx<{ version: number }[]>`
          update products set
            slug = coalesce(${b.slug ?? null}, slug), code = coalesce(${b.code ?? null}, code),
            title = coalesce(${b.title ?? null}, title), position = coalesce(${b.position ?? null}, position),
            description = coalesce(${b.description ?? null}, description),
            composition = coalesce(${b.composition ?? null}, composition),
            material = ${b.material === undefined ? tx`material` : b.material},
            installation = ${b.installation === undefined ? tx`installation` : b.installation},
            version = version + 1, updated_at = now()
          where id = ${p.id} and version = ${b.version} returning version`;
        if (rows.length === 0) throw versionConflict();
        if (b.slug && b.slug !== p.slug && p.published_at) {
          await tx`insert into slug_redirects (old_slug, product_id) values (${p.slug}, ${p.id})
            on conflict (old_slug) do update set product_id = excluded.product_id`;
          await tx`delete from slug_redirects where old_slug = ${b.slug}`;
        }
        await audit(tx, actor, "product.update", "product", p.id, { fields: Object.keys(b).filter((k) => k !== "version") });
        return rows[0]!;
      })
      .catch(mapDbError);
    res.json(result);
  });

  r.put("/admin/catalog/:id/compatibilities", edit, async (req, res) => {
    const b = parse(compatBody, req.body);
    const p = await loadProduct(String(req.params.id));
    const actor = authOf(res).user.id;
    const result = await deps.sql
      .begin(async (tx) => {
        const rows = await tx<{ version: number }[]>`
          update products set version = version + 1, updated_at = now() where id = ${p.id} and version = ${b.version} returning version`;
        if (rows.length === 0) throw versionConflict();
        const keep = b.items.map((i) => i.vehicleModelId);
        await tx`update compatibilities set active = false where product_id = ${p.id}
          ${keep.length ? tx`and vehicle_model_id not in ${tx(keep)}` : tx``}`;
        for (const it of b.items) {
          await tx`insert into compatibilities (product_id, vehicle_model_id, note) values (${p.id}, ${it.vehicleModelId}, ${it.note ?? null})
            on conflict (product_id, vehicle_model_id) do update set note = excluded.note, active = true`;
        }
        await audit(tx, actor, "product.compatibilities", "product", p.id, { vehicles: keep });
        return rows[0]!;
      })
      .catch(mapDbError);
    res.json(result);
  });

  r.post("/admin/catalog/:id/variants", edit, async (req, res) => {
    const b = parse(variantCreate, req.body);
    const p = await loadProduct(String(req.params.id));
    const v = await deps.sql.begin(async (tx) => {
      const [compat] = await tx`
        select 1 from compatibilities where product_id = ${p.id} and vehicle_model_id = ${b.vehicleModelId} and active`;
      if (!compat) throw new HttpError(409, "CONFLICT", "Модель не указана в совместимости товара");
      const [row] = await tx<{ id: string; version: number }[]>`
        insert into variants (product_id, vehicle_model_id, title, price_kopecks, available, sort)
        values (${p.id}, ${b.vehicleModelId}, ${b.title}, ${b.priceKopecks}, ${b.available}, ${b.sort})
        returning id, version`;
      await tx`update products set updated_at = now() where id = ${p.id}`;
      await audit(tx, authOf(res).user.id, "variant.create", "variant", row!.id, { product: p.id, price: b.priceKopecks });
      return row!;
    });
    res.status(201).json(v);
  });

  r.patch("/admin/variants/:id", edit, async (req, res) => {
    const b = parse(variantPatch, req.body);
    const id = String(req.params.id);
    if (!z.uuid().safeParse(id).success) throw notFound("Вариант не найден");
    const actor = authOf(res).user.id;
    const result = await deps.sql.begin(async (tx) => {
      const [before] = await tx<{ price_kopecks: number | null; product_id: string }[]>`
        select price_kopecks, product_id from variants where id = ${id}`;
      if (!before) throw notFound("Вариант не найден");
      const rows = await tx<{ version: number }[]>`
        update variants set
          title = coalesce(${b.title ?? null}, title),
          price_kopecks = ${b.priceKopecks === undefined ? tx`price_kopecks` : b.priceKopecks},
          available = coalesce(${b.available ?? null}, available),
          status = coalesce(${b.status ?? null}, status),
          sort = coalesce(${b.sort ?? null}, sort),
          version = version + 1, updated_at = now()
        where id = ${id} and version = ${b.version} returning version`;
      if (rows.length === 0) throw versionConflict();
      await tx`update products set updated_at = now() where id = ${before.product_id}`;
      await audit(tx, actor, "variant.update", "variant", id, {
        ...(b.priceKopecks !== undefined ? { priceFrom: before.price_kopecks, priceTo: b.priceKopecks } : {}),
        fields: Object.keys(b).filter((k) => k !== "version"),
      });
      return rows[0]!;
    });
    res.json(result);
  });

  r.post("/admin/catalog/:id/publish", edit, async (req, res) => {
    const b = parse(z.object({ version }), req.body);
    const p = await loadProduct(String(req.params.id));
    const [check] = await deps.sql<{ title: string; description: string; variants: number; photos: number; no_alt: number }[]>`
      select p.title, p.description,
        (select count(*)::int from variants x where x.product_id = p.id and x.status = 'active') as variants,
        (select count(*)::int from media m where m.product_id = p.id and m.status = 'ready') as photos,
        (select count(*)::int from media m where m.product_id = p.id and m.status = 'ready' and m.alt = '') as no_alt
      from products p where p.id = ${p.id}`;
    const problems: Record<string, string> = {};
    if (!check!.description) problems.description = "Добавьте описание";
    if (check!.variants === 0) problems.variants = "Нужен хотя бы один активный вариант";
    if (check!.photos === 0) problems.media = "Нужна хотя бы одна обработанная фотография";
    if (check!.no_alt > 0) problems.alt = "У всех фото должно быть описание";
    if (Object.keys(problems).length) {
      throw new HttpError(422, "VALIDATION", "Товар не готов к публикации", { fieldErrors: problems });
    }
    const newVersion = await deps.sql.begin(async (tx) => {
      const rows = await tx<{ version: number }[]>`
        update products set status = 'published', published_at = coalesce(published_at, now()), version = version + 1, updated_at = now()
        where id = ${p.id} and version = ${b.version} returning version`;
      if (rows.length === 0) throw versionConflict();
      await audit(tx, authOf(res).user.id, "product.publish", "product", p.id);
      return rows[0]!.version;
    });
    res.json({ status: "published", version: newVersion, visibleWithinSec: 60 });
  });

  r.post("/admin/catalog/:id/status", edit, async (req, res) => {
    const b = parse(statusBody, req.body);
    const p = await loadProduct(String(req.params.id));
    const newVersion = await deps.sql.begin(async (tx) => {
      const rows = await tx<{ version: number }[]>`
        update products set status = ${b.status}, version = version + 1, updated_at = now()
        where id = ${p.id} and version = ${b.version} returning version`;
      if (rows.length === 0) throw versionConflict();
      await audit(tx, authOf(res).user.id, "product.status", "product", p.id, { from: p.status, to: b.status });
      return rows[0]!.version;
    });
    res.json({ status: b.status, version: newVersion });
  });

  r.post("/admin/media/upload-url", edit, async (req, res) => {
    const b = parse(uploadBody, req.body);
    const p = await loadProduct(b.productId);
    const ext = b.contentType.split("/")[1];
    const path = `${p.id}/${randomUUID()}.${ext}`;
    const [{ next }] = await deps.sql<{ next: number }[]>`
      select coalesce(max(sort), -1) + 1 as next from media where product_id = ${p.id}` as unknown as [{ next: number }];
    const [m] = await deps.sql<{ id: string }[]>`
      insert into media (product_id, upload_path, sort) values (${p.id}, ${path}, ${next}) returning id`;
    const upload = await deps.storage.createUploadUrl(path);
    res.status(201).json({ mediaId: m!.id, uploadUrl: upload.url, token: upload.token ?? null, maxBytes: MAX_UPLOAD });
  });

  r.put("/admin/media/local-upload/:path", edit, async (req, res) => {
    if (!deps.storage.writeLocalUpload) throw notFound();
    const path = decodeURIComponent(String(req.params.path));
    const [m] = await deps.sql`select id from media where upload_path = ${path} and status = 'pending'`;
    if (!m || !Buffer.isBuffer(req.body)) throw notFound();
    await deps.storage.writeLocalUpload(path, req.body);
    res.status(204).end();
  });

  r.post("/admin/media/:id/process", edit, async (req, res) => {
    const id = String(req.params.id);
    if (!z.uuid().safeParse(id).success) throw notFound("Фото не найдено");
    const [m] = await deps.sql<{ id: string; product_id: string; upload_path: string; status: string }[]>`
      select id, product_id, upload_path, status from media where id = ${id}`;
    if (!m) throw notFound("Фото не найдено");
    let input: Buffer;
    try {
      input = await deps.storage.readUpload(m.upload_path);
    } catch {
      throw new HttpError(409, "CONFLICT", "Файл ещё не загружен");
    }
    const bad = (msg: string) => new HttpError(422, "VALIDATION", msg, { fieldErrors: { file: msg } });
    if (input.length > MAX_UPLOAD) throw bad("Файл больше 25 МБ");
    let meta: Metadata;
    try {
      meta = await sharp(input).metadata();
    } catch {
      throw bad("Файл не похож на изображение");
    }
    if (!meta.format || !["jpeg", "png", "webp"].includes(meta.format)) throw bad("Нужен JPEG, PNG или WebP");
    const w = meta.width ?? 0;
    const h = meta.height ?? 0;
    if (w < 600 || h < 400) throw bad("Минимальный размер 600×400");
    if (w > 10_000 || h > 10_000) throw bad("Слишком большое разрешение");

    const outputs: { width: number; height: number; url: string }[] = [];
    for (const target of WIDTHS.filter((x, i) => x <= w || i === 0)) {
      const { data, info } = await sharp(input).rotate().resize({ width: Math.min(target, w), withoutEnlargement: true }).webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
      const url = await deps.storage.putPublic(`${m.product_id}/${m.id}-${info.width}.webp`, data, "image/webp");
      outputs.push({ width: info.width, height: info.height, url });
    }
    const main = outputs[outputs.length - 1]!;
    await deps.sql.begin(async (tx) => {
      await tx`
        update media set status = 'ready', url = ${main.url}, width = ${main.width}, height = ${main.height},
          variants = ${tx.json(outputs)} where id = ${m.id}`;
      await tx`update products set updated_at = now() where id = ${m.product_id}`;
      await audit(tx, authOf(res).user.id, "media.process", "media", m.id, { product: m.product_id });
    });
    res.json({ id: m.id, url: main.url, width: main.width, height: main.height, variants: outputs });
  });

  r.patch("/admin/media/:id", edit, async (req, res) => {
    const b = parse(mediaPatch, req.body);
    const id = String(req.params.id);
    if (!z.uuid().safeParse(id).success) throw notFound("Фото не найдено");
    const row = await deps.sql.begin(async (tx) => {
      const rows = await tx`
        update media set alt = coalesce(${b.alt ?? null}, alt), sort = coalesce(${b.sort ?? null}, sort)
        where id = ${id} returning id, alt, sort`;
      if (rows.length === 0) throw notFound("Фото не найдено");
      await audit(tx, authOf(res).user.id, "media.update", "media", id, b);
      return rows[0];
    });
    res.json(row);
  });

  r.delete("/admin/media/:id", edit, async (req, res) => {
    const id = String(req.params.id);
    if (!z.uuid().safeParse(id).success) throw notFound("Фото не найдено");
    await deps.sql.begin(async (tx) => {
      const rows = await tx`delete from media where id = ${id} returning product_id`;
      if (rows.length === 0) throw notFound("Фото не найдено");
      await audit(tx, authOf(res).user.id, "media.delete", "media", id);
    });
    res.status(204).end();
  });

  return r;
}
