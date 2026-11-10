import { Router } from "express";
import { z } from "zod";
import type { Deps } from "../../deps";
import { HttpError, notFound, parse, versionConflict } from "../../http/errors";
import { authOf, capsOf, requireStaff } from "../../security/session";
import { audit } from "../../services/audit";
import { maskEmail, maskPhone, normalizeEmail, normalizePhone } from "../../util";

const saleItem = z.object({
  title: z.string().trim().min(1).max(300),
  quantity: z.number().int().min(1).max(100),
  priceKopecks: z.number().int().positive().nullable().optional(),
  variantId: z.uuid().optional(),
});

const createBody = z.object({
  contactPhone: z.string().trim().max(32).optional(),
  contactEmail: z.email().max(254).optional(),
  items: z.array(saleItem).min(1).max(50),
});

const editBody = z.object({ version: z.number().int().positive(), items: z.array(saleItem).min(1).max(50) });

const confirmBody = z.object({
  version: z.number().int().positive(),
  amountKopecks: z.number().int().positive(),
  soldOn: z.iso.date(),
  externalId: z.string().trim().min(1).max(100),
  source: z.string().trim().regex(/^[a-z0-9_-]{1,30}$/).default("manual"),
});

const refundBody = z.object({
  amountKopecks: z.number().int().positive(),
  reason: z.string().trim().min(3).max(500),
});

type SaleRow = {
  id: string;
  lead_id: string | null;
  status: string;
  source: string;
  external_id: string | null;
  amount_kopecks: number | null;
  refunded_kopecks: number;
  sold_on: string | null;
  version: number;
  contact_phone: string | null;
  contact_email: string | null;
};

export function adminSaleRoutes(deps: Deps) {
  const r = Router();
  const canSell = requireStaff("sales_confirm");

  async function loadSale(id: string) {
    if (!z.uuid().safeParse(id).success) throw notFound("Сделка не найдена");
    const [s] = await deps.sql<SaleRow[]>`select *, sold_on::text as sold_on from sales where id = ${id}`;
    if (!s) throw notFound("Сделка не найдена");
    return s;
  }

  r.get("/admin/sales", requireStaff("leads_read"), async (req, res) => {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const rows = await deps.sql`
      select s.id, s.status, s.amount_kopecks as "amount", s.refunded_kopecks as "refunded", s.sold_on::text as "soldOn",
        s.external_id as "externalId", s.source, l.reference as "leadReference", s.created_at as "createdAt"
      from sales s left join leads l on l.id = s.lead_id
      where true ${status ? deps.sql`and s.status = ${status}` : deps.sql``}
      order by s.created_at desc limit 200`;
    res.json({ items: rows });
  });

  r.get("/admin/sales/:id", requireStaff("leads_read"), async (req, res) => {
    const s = await loadSale(String(req.params.id));
    const canView = capsOf(res).has("contacts_view");
    const items = await deps.sql`
      select id, variant_id as "variantId", title, quantity, price_kopecks as "priceKopecks" from sale_items
      where sale_id = ${s.id} order by id`;
    const events = await deps.sql`
      select e.type, e.amount_kopecks as "amount", e.note, e.created_at as "createdAt", u.name as "actorName"
      from sale_events e left join users u on u.id = e.actor_user_id where e.sale_id = ${s.id} order by e.created_at`;
    const [lead] = s.lead_id ? await deps.sql`select reference from leads where id = ${s.lead_id}` : [];
    res.json({
      sale: {
        id: s.id,
        status: s.status,
        source: s.source,
        externalId: s.external_id,
        amount: s.amount_kopecks,
        refunded: s.refunded_kopecks,
        soldOn: s.sold_on,
        version: s.version,
        leadReference: lead?.reference ?? null,
        contactPhone: canView ? s.contact_phone : maskPhone(s.contact_phone),
        contactEmail: canView ? s.contact_email : maskEmail(s.contact_email),
      },
      items,
      events,
    });
  });

  r.post("/admin/sales", canSell, async (req, res) => {
    const body = parse(createBody, req.body);
    const actor = authOf(res).user.id;
    const phone = body.contactPhone ? normalizePhone(body.contactPhone) : null;
    if (body.contactPhone && !phone) {
      throw new HttpError(422, "VALIDATION", "Проверьте поля", { fieldErrors: { contactPhone: "Проверьте номер телефона" } });
    }
    const id = await deps.sql.begin(async (tx) => {
      const [s] = await tx<{ id: string }[]>`
        insert into sales (contact_phone, contact_email, created_by)
        values (${phone}, ${body.contactEmail ? normalizeEmail(body.contactEmail) : null}, ${actor}) returning id`;
      for (const it of body.items) {
        await tx`
          insert into sale_items (sale_id, variant_id, title, quantity, price_kopecks)
          values (${s!.id}, ${it.variantId ?? null}, ${it.title}, ${it.quantity}, ${it.priceKopecks ?? null})`;
      }
      await tx`insert into sale_events (sale_id, type, actor_user_id) values (${s!.id}, 'created', ${actor})`;
      await audit(tx, actor, "sale.draft", "sale", s!.id, { offline: true });
      return s!.id;
    });
    res.status(201).json({ saleId: id });
  });

  r.patch("/admin/sales/:id", canSell, async (req, res) => {
    const body = parse(editBody, req.body);
    const s = await loadSale(String(req.params.id));
    const actor = authOf(res).user.id;
    if (s.status !== "draft") throw new HttpError(409, "INVALID_TRANSITION", "Подтверждённую сделку нельзя изменить");
    const version = await deps.sql.begin(async (tx) => {
      const rows = await tx<{ version: number }[]>`
        update sales set version = version + 1 where id = ${s.id} and version = ${body.version} and status = 'draft'
        returning version`;
      if (rows.length === 0) throw versionConflict();
      await tx`delete from sale_items where sale_id = ${s.id}`;
      for (const it of body.items) {
        await tx`
          insert into sale_items (sale_id, variant_id, title, quantity, price_kopecks)
          values (${s.id}, ${it.variantId ?? null}, ${it.title}, ${it.quantity}, ${it.priceKopecks ?? null})`;
      }
      await tx`insert into sale_events (sale_id, type, actor_user_id) values (${s.id}, 'edit', ${actor})`;
      return rows[0]!.version;
    });
    res.json({ version });
  });

  r.post("/admin/sales/:id/confirm", canSell, async (req, res) => {
    const body = parse(confirmBody, req.body);
    const id = String(req.params.id);
    const actor = authOf(res).user.id;
    const alreadyDone = (s: SaleRow) => {
      const same = s.external_id === body.externalId && s.source === body.source && s.amount_kopecks === body.amountKopecks;
      if (!same) throw new HttpError(409, "INVALID_TRANSITION", "Сделка уже подтверждена с другими данными");
      res.json({ saleId: s.id, status: s.status, alreadyConfirmed: true });
    };
    const s = await loadSale(id);
    if (s.status !== "draft") return alreadyDone(s);
    let raced = false;
    try {
      await deps.sql.begin(async (tx) => {
        const rows = await tx`
          update sales set status = 'confirmed', amount_kopecks = ${body.amountKopecks}, sold_on = ${body.soldOn},
            external_id = ${body.externalId}, source = ${body.source}, confirmed_by = ${actor}, confirmed_at = now(),
            version = version + 1
          where id = ${s.id} and status = 'draft' and version = ${body.version} returning id`;
        if (rows.length === 0) {
          raced = true;
          return;
        }
        await tx`
          insert into sale_events (sale_id, type, amount_kopecks, actor_user_id)
          values (${s.id}, 'confirmed', ${body.amountKopecks}, ${actor})`;
        if (s.lead_id) {
          const [lead] = await tx<{ status: string }[]>`select status from leads where id = ${s.lead_id} for update`;
          if (lead && lead.status !== "sale_confirmed") {
            await tx`update leads set status = 'sale_confirmed', version = version + 1, updated_at = now() where id = ${s.lead_id}`;
            await tx`
              insert into lead_events (lead_id, actor_user_id, type, from_status, to_status)
              values (${s.lead_id}, ${actor}, 'status', ${lead.status}, 'sale_confirmed')`;
          }
        }
        await audit(tx, actor, "sale.confirm", "sale", s.id, {
          amount: body.amountKopecks,
          externalId: body.externalId,
          source: body.source,
        });
      });
    } catch (e) {
      if ((e as { code?: string }).code === "23505") {
        throw new HttpError(409, "CONFLICT", "Сделка с таким номером уже есть", {
          fieldErrors: { externalId: "Номер сделки уже использован" },
        });
      }
      throw e;
    }
    if (raced) {
      const now = await loadSale(id);
      if (now.status === "draft") throw versionConflict();
      return alreadyDone(now);
    }
    res.json({ saleId: s.id, status: "confirmed" });
  });

  r.post("/admin/sales/:id/refunds", canSell, async (req, res) => {
    const body = parse(refundBody, req.body);
    const key = req.header("idempotency-key");
    if (!key || !/^[A-Za-z0-9_-]{8,100}$/.test(key)) {
      throw new HttpError(400, "IDEMPOTENCY_KEY_REQUIRED", "Нужен заголовок Idempotency-Key");
    }
    const s = await loadSale(String(req.params.id));
    const actor = authOf(res).user.id;
    const result = await deps.sql.begin(async (tx) => {
      const [cur] = await tx<{ status: string; amount_kopecks: number | null; refunded_kopecks: number }[]>`
        select status, amount_kopecks, refunded_kopecks from sales where id = ${s.id} for update`;
      const [dup] = await tx<{ amount_kopecks: number }[]>`
        select amount_kopecks from sale_events where sale_id = ${s.id} and type = 'refund' and idempotency_key = ${key}`;
      if (dup && cur) {
        if (dup.amount_kopecks !== body.amountKopecks) {
          throw new HttpError(409, "IDEMPOTENCY_MISMATCH", "Ключ уже использован для другого возврата");
        }
        return { status: cur.status, refunded: cur.refunded_kopecks, duplicate: true };
      }
      if (!cur || !["confirmed", "partially_refunded"].includes(cur.status) || cur.amount_kopecks === null) {
        throw new HttpError(409, "INVALID_TRANSITION", "Возврат возможен только по подтверждённой сделке");
      }
      const refunded = cur.refunded_kopecks + body.amountKopecks;
      if (refunded > cur.amount_kopecks) {
        throw new HttpError(422, "VALIDATION", "Сумма возврата больше суммы сделки", {
          fieldErrors: { amountKopecks: "Больше остатка по сделке" },
        });
      }
      const status = refunded === cur.amount_kopecks ? "refunded" : "partially_refunded";
      await tx`update sales set refunded_kopecks = ${refunded}, status = ${status}, version = version + 1 where id = ${s.id}`;
      await tx`
        insert into sale_events (sale_id, type, amount_kopecks, idempotency_key, actor_user_id, note)
        values (${s.id}, 'refund', ${body.amountKopecks}, ${key}, ${actor}, ${body.reason})`;
      await audit(tx, actor, "sale.refund", "sale", s.id, { amount: body.amountKopecks });
      return { status, refunded, duplicate: false };
    });
    res.status(result.duplicate ? 200 : 201).json(result);
  });

  return r;
}
