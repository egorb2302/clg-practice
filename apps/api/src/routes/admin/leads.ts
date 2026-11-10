import { closeReasons, leadStatuses, type LeadStatus } from "@armorix/contracts";
import { Router } from "express";
import { z } from "zod";
import type { Deps } from "../../deps";
import { HttpError, notFound, parse, versionConflict } from "../../http/errors";
import { authOf, capsOf, requireStaff } from "../../security/session";
import { audit } from "../../services/audit";
import { reverseAward } from "../../services/loyalty";
import { kick } from "../../services/outbox";
import { maskEmail, maskPhone, normalizePhone } from "../../util";

const transitions: Record<LeadStatus, LeadStatus[]> = {
  new: ["in_progress", "closed"],
  in_progress: ["offer_agreed", "closed"],
  offer_agreed: ["in_progress", "closed"],
  closed: ["in_progress"],
  sale_confirmed: [],
};

const listQuery = z.object({
  status: z.enum(leadStatuses).optional(),
  assignee: z.union([z.uuid(), z.literal("none")]).optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
});

const statusBody = z.object({
  to: z.enum(leadStatuses),
  version: z.number().int().positive(),
  reason: z.enum(closeReasons).optional(),
  comment: z.string().trim().max(1000).optional(),
});

const assignBody = z.object({ userId: z.uuid().nullable(), version: z.number().int().positive() });
const noteBody = z.object({ text: z.string().trim().min(1).max(2000) });

const PAGE = 50;

type LeadRow = {
  id: string;
  reference: string;
  type: string;
  status: LeadStatus;
  name: string;
  preferred_contact: string;
  phone: string | null;
  email: string | null;
  assignee_user_id: string | null;
  assignee_name: string | null;
  version: number;
  created_at: Date;
  items_count: number;
};

export function adminLeadRoutes(deps: Deps) {
  const r = Router();
  const staffLeads = requireStaff("leads");
  const readLeads = requireStaff("leads_read");
  const tz = deps.cfg.BUSINESS_TZ;

  const contacts = (canView: boolean, phone: string | null, email: string | null) =>
    canView ? { phone, email } : { phone: maskPhone(phone), email: maskEmail(email) };

  async function loadLead(ref: string) {
    if (!/^AX-\d{6,}$/.test(ref)) throw notFound("Заявка не найдена");
    const [lead] = await deps.sql<(LeadRow & Record<string, unknown>)[]>`
      select l.*, u.name as assignee_name,
        (select count(*)::int from lead_items i where i.lead_id = l.id) as items_count
      from leads l left join users u on u.id = l.assignee_user_id
      where l.reference = ${ref}`;
    if (!lead) throw notFound("Заявка не найдена");
    return lead;
  }

  r.get("/admin/staff", requireStaff(), async (_req, res) => {
    const items = await deps.sql`
      select id, name, email from users where is_staff and status = 'active' order by name nulls last, email`;
    res.json({ items });
  });

  r.get("/admin/leads", readLeads, async (req, res) => {
    const q = parse(listQuery, req.query);
    const canView = capsOf(res).has("contacts_view");
    const search = q.q ?? "";
    const refMatch = search.match(/^(?:AX-)?0*(\d{1,9})$/i);
    const phone = normalizePhone(search);
    const searchSql = !search
      ? deps.sql``
      : refMatch
        ? deps.sql`and l.number = ${Number(refMatch[1])}`
        : canView && phone
          ? deps.sql`and l.phone = ${phone}`
          : canView && search.includes("@")
            ? deps.sql`and l.email = ${search.toLowerCase()}`
            : deps.sql`and l.name ilike ${"%" + search.replace(/[%_\\]/g, "\\$&") + "%"}`;
    const rows = await deps.sql<(LeadRow & { total: number })[]>`
      select l.id, l.reference, l.type, l.status, l.name, l.preferred_contact, l.phone, l.email,
        l.assignee_user_id, u.name as assignee_name, l.version, l.created_at,
        (select count(*)::int from lead_items i where i.lead_id = l.id) as items_count,
        count(*) over ()::int as total
      from leads l left join users u on u.id = l.assignee_user_id
      where true
        ${q.status ? deps.sql`and l.status = ${q.status}` : deps.sql``}
        ${q.assignee === "none" ? deps.sql`and l.assignee_user_id is null` : q.assignee ? deps.sql`and l.assignee_user_id = ${q.assignee}` : deps.sql``}
        ${q.from ? deps.sql`and l.created_at >= (${q.from}::date)::timestamp at time zone ${tz}` : deps.sql``}
        ${q.to ? deps.sql`and l.created_at < (${q.to}::date + 1)::timestamp at time zone ${tz}` : deps.sql``}
        ${searchSql}
      order by l.created_at desc
      limit ${PAGE} offset ${(q.page - 1) * PAGE}`;
    res.json({
      items: rows.map((l) => ({
        reference: l.reference,
        type: l.type,
        status: l.status,
        name: l.name,
        preferredContact: l.preferred_contact,
        ...contacts(canView, l.phone, l.email),
        assignee: l.assignee_user_id ? { id: l.assignee_user_id, name: l.assignee_name } : null,
        itemsCount: l.items_count,
        version: l.version,
        createdAt: l.created_at,
      })),
      page: q.page,
      pageSize: PAGE,
      total: rows[0]?.total ?? 0,
    });
  });

  r.get("/admin/leads/:ref", readLeads, async (req, res) => {
    const lead = await loadLead(String(req.params.ref));
    const canView = capsOf(res).has("contacts_view");
    const items = await deps.sql`
      select variant_id as "variantId", product_slug as "productSlug", product_title as "productTitle",
        product_code as "productCode", variant_title as "variantTitle", vehicle_label as "vehicleLabel",
        price_from_kopecks as "priceFrom", quantity
      from lead_items where lead_id = ${lead.id} order by id`;
    const events = await deps.sql`
      select e.type, e.from_status as "fromStatus", e.to_status as "toStatus", e.note, e.created_at as "createdAt",
        u.name as "actorName", u.email as "actorEmail"
      from lead_events e left join users u on u.id = e.actor_user_id
      where e.lead_id = ${lead.id} order by e.created_at`;
    const sales = await deps.sql`
      select id, status, amount_kopecks as "amount", sold_on as "soldOn", external_id as "externalId"
      from sales where lead_id = ${lead.id} order by created_at`;
    const notifications = await deps.sql`
      select id, channel, topic, status, attempts, last_error as "lastError", sent_at as "sentAt"
      from outbox where dedupe_key like ${`lead:${lead.id}:%`} order by created_at`;
    if (canView) await audit(deps.sql, authOf(res).user.id, "lead.contacts_viewed", "lead", lead.reference);
    res.json({
      lead: {
        reference: lead.reference,
        type: lead.type,
        status: lead.status,
        closeReason: lead.close_reason,
        closeComment: lead.close_comment,
        name: lead.name,
        preferredContact: lead.preferred_contact,
        ...contacts(canView, lead.phone, lead.email),
        deliveryMethod: lead.delivery_method,
        vehicle: lead.vehicle_make ? { make: lead.vehicle_make, model: lead.vehicle_model, year: lead.vehicle_year } : null,
        request: lead.request,
        message: lead.message,
        comment: lead.comment,
        assignee: lead.assignee_user_id ? { id: lead.assignee_user_id, name: lead.assignee_name } : null,
        version: lead.version,
        createdAt: lead.created_at,
      },
      items,
      events,
      sales,
      notifications,
    });
  });

  r.post("/admin/leads/:ref/status", staffLeads, async (req, res) => {
    const body = parse(statusBody, req.body);
    const lead = await loadLead(String(req.params.ref));
    const actor = authOf(res).user.id;
    if (!transitions[lead.status].includes(body.to)) {
      throw new HttpError(409, "INVALID_TRANSITION", "Такой переход статуса недоступен");
    }
    if (body.to === "closed" && !body.reason) {
      throw new HttpError(422, "VALIDATION", "Укажите причину", { fieldErrors: { reason: "Укажите причину закрытия" } });
    }
    if (body.to === "closed" && body.reason === "other" && !body.comment) {
      throw new HttpError(422, "VALIDATION", "Добавьте комментарий", { fieldErrors: { comment: "Опишите причину" } });
    }
    const updated = await deps.sql.begin(async (tx) => {
      const rows = await tx<{ version: number }[]>`
        update leads set status = ${body.to}, version = version + 1, updated_at = now(),
          close_reason = ${body.to === "closed" ? body.reason! : null},
          close_comment = ${body.to === "closed" ? (body.comment ?? null) : null}
        where id = ${lead.id} and version = ${body.version} and status = ${lead.status}
        returning version`;
      if (rows.length === 0) throw versionConflict();
      await tx`
        insert into lead_events (lead_id, actor_user_id, type, from_status, to_status, note)
        values (${lead.id}, ${actor}, 'status', ${lead.status}, ${body.to}, ${body.comment ?? body.reason ?? null})`;
      if (body.to === "closed" && body.reason === "spam") {
        await tx`update loyalty_awards set status = 'ineligible' where lead_id = ${lead.id} and status = 'pending'`;
        const credited = await tx<{ id: string }[]>`select id from loyalty_awards where lead_id = ${lead.id} and status = 'credited'`;
        for (const a of credited) await reverseAward(tx, a.id, "Заявка закрыта как спам", actor);
      }
      await audit(tx, actor, "lead.status", "lead", lead.reference, { from: lead.status, to: body.to, reason: body.reason });
      return rows[0]!;
    });
    res.json({ reference: lead.reference, status: body.to, version: updated.version });
  });

  r.post("/admin/leads/:ref/assign", staffLeads, async (req, res) => {
    const body = parse(assignBody, req.body);
    const lead = await loadLead(String(req.params.ref));
    const actor = authOf(res).user.id;
    if (body.userId) {
      const [u] = await deps.sql`select id from users where id = ${body.userId} and is_staff and status = 'active'`;
      if (!u) throw new HttpError(422, "VALIDATION", "Сотрудник не найден", { fieldErrors: { userId: "Сотрудник не найден" } });
    }
    const version = await deps.sql.begin(async (tx) => {
      const rows = await tx<{ version: number }[]>`
        update leads set assignee_user_id = ${body.userId}, version = version + 1, updated_at = now()
        where id = ${lead.id} and version = ${body.version} returning version`;
      if (rows.length === 0) throw versionConflict();
      await tx`insert into lead_events (lead_id, actor_user_id, type, note) values (${lead.id}, ${actor}, 'assign', ${body.userId})`;
      await audit(tx, actor, "lead.assign", "lead", lead.reference, { to: body.userId });
      return rows[0]!.version;
    });
    res.json({ reference: lead.reference, version });
  });

  r.post("/admin/leads/:ref/notes", staffLeads, async (req, res) => {
    const body = parse(noteBody, req.body);
    const lead = await loadLead(String(req.params.ref));
    await deps.sql`
      insert into lead_events (lead_id, actor_user_id, type, note) values (${lead.id}, ${authOf(res).user.id}, 'note', ${body.text})`;
    res.status(201).json({ ok: true });
  });

  r.post("/admin/leads/:ref/notifications/retry", staffLeads, async (req, res) => {
    const lead = await loadLead(String(req.params.ref));
    const actor = authOf(res).user.id;
    const ids = await deps.sql.begin(async (tx) => {
      const rows = await tx<{ id: string }[]>`
        update outbox set status = 'pending', attempts = 0, run_after = now(), last_error = null
        where dedupe_key like ${`lead:${lead.id}:%`} and status in ('failed', 'needs_review') returning id`;
      if (rows.length) {
        await tx`insert into lead_events (lead_id, actor_user_id, type) values (${lead.id}, ${actor}, 'notify_retry')`;
        await audit(tx, actor, "lead.notify_retry", "lead", lead.reference, { jobs: rows.length });
      }
      return rows.map((x) => x.id);
    });
    kick(deps, ids);
    res.json({ retried: ids.length });
  });

  r.post("/admin/leads/:ref/sale", requireStaff("sales_confirm"), async (req, res) => {
    const lead = await loadLead(String(req.params.ref));
    const actor = authOf(res).user.id;
    const sale = await deps.sql.begin(async (tx) => {
      const [locked] = await tx<{ status: string }[]>`select status from leads where id = ${lead.id} for update`;
      if (!locked || locked.status === "closed" || locked.status === "sale_confirmed") {
        throw new HttpError(409, "INVALID_TRANSITION", "Для этой заявки нельзя оформить продажу");
      }
      const [existing] = await tx<{ id: string }[]>`select id from sales where lead_id = ${lead.id} and status = 'draft'`;
      if (existing) return { id: existing.id, created: false };
      const [created] = await tx<{ id: string }[]>`
        insert into sales (lead_id, client_user_id, contact_phone, contact_email, created_by)
        values (${lead.id}, ${(lead.owner_user_id as string | null) ?? null}, ${lead.phone}, ${lead.email}, ${actor})
        returning id`;
      await tx`
        insert into sale_items (sale_id, variant_id, title, quantity, price_kopecks)
        select ${created!.id}, variant_id, product_title || ', ' || variant_title || ' (' || vehicle_label || ')',
          quantity, price_from_kopecks
        from lead_items where lead_id = ${lead.id}`;
      await tx`insert into sale_events (sale_id, type, actor_user_id) values (${created!.id}, 'created', ${actor})`;
      await audit(tx, actor, "sale.draft", "sale", created!.id, { lead: lead.reference });
      return { id: created!.id, created: true };
    });
    res.status(sale.created ? 201 : 200).json({ saleId: sale.id });
  });

  return r;
}
