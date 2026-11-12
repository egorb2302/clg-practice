import { randomInt } from "node:crypto";
import { leadRequestSchema, type CatalogChange, type LeadCreatedResponse, type LeadRequest } from "@armorix/contracts";
import type { Tx } from "../db.js";
import type { Deps } from "../deps.js";
import { HttpError, parse } from "../http/errors.js";
import { fingerprint } from "../security/crypto.js";
import { enforce } from "../security/rateLimit.js";
import type { AuthContext } from "../security/session.js";
import { normalizeEmail, normalizePhone } from "../util.js";
import { awardForLead } from "./loyalty.js";
import { enqueue, kick, type OutboxJob } from "./outbox.js";

const KEY_RE = /^[A-Za-z0-9_-]{8,100}$/;

export const leadTypeLabels = { catalog: "по каталогу", custom: "индивидуальное изготовление", general: "общий вопрос" } as const;

type Normalized = LeadRequest & { phone: string | null; email: string | null };

function normalize(lead: LeadRequest): Normalized {
  const fieldErrors: Record<string, string> = {};
  let phone: string | null = null;
  let email: string | null = null;
  if (lead.contact.phone) {
    phone = normalizePhone(lead.contact.phone);
    if (!phone) fieldErrors["contact.phone"] = "Проверьте номер телефона";
  }
  if (lead.contact.email) email = normalizeEmail(lead.contact.email);
  if (lead.type === "catalog") {
    const seen = new Set<string>();
    lead.items.forEach((it, i) => {
      if (seen.has(it.variantId)) fieldErrors[`items.${i}.variantId`] = "Позиция повторяется";
      seen.add(it.variantId);
    });
  }
  if (Object.keys(fieldErrors).length) {
    throw new HttpError(422, "VALIDATION", "Проверьте поля формы", { fieldErrors });
  }
  return { ...lead, phone, email };
}

function isBot(deps: Deps, lead: LeadRequest) {
  return lead.website !== "" || lead.fillMs < deps.cfg.LEAD_MIN_FILL_MS;
}

const fakeReference = () => `AX-${String(randomInt(100_000, 999_999))}`;

type StoredKey = { fingerprint: string; response_status: number | null; response_body: LeadCreatedResponse | null };

async function storedResponse(deps: Deps, key: string) {
  const [row] = await deps.sql<StoredKey[]>`
    select fingerprint, response_status, response_body from idempotency_keys
    where scope = 'lead' and key = ${key} and expires_at > now()`;
  return row ?? null;
}

export async function submitLead(
  deps: Deps,
  input: { body: unknown; key: string | undefined; ip: string; auth: AuthContext | null },
): Promise<{ status: number; body: LeadCreatedResponse; jobIds: string[] }> {
  if (!input.key || !KEY_RE.test(input.key)) {
    throw new HttpError(400, "IDEMPOTENCY_KEY_REQUIRED", "Нужен заголовок Idempotency-Key");
  }
  const key = input.key;
  const raw = parse(leadRequestSchema, input.body);
  if (isBot(deps, raw)) {
    return { status: 201, body: { reference: fakeReference(), status: "received" }, jobIds: [] };
  }
  const lead = normalize(raw);
  const { fillMs: _f, website: _w, ...fpSource } = lead;
  const fp = fingerprint(fpSource);

  const prior = await storedResponse(deps, key);
  if (prior) {
    if (prior.fingerprint !== fp) throw new HttpError(409, "IDEMPOTENCY_MISMATCH", "Ключ уже использован для другой заявки");
    if (prior.response_body) return { status: prior.response_status ?? 201, body: prior.response_body, jobIds: [] };
  }

  await enforce(deps.sql, `lead:ip:${input.ip}`, deps.cfg.LEAD_LIMIT_IP_PER_HOUR, 3600);
  for (const contact of [lead.phone, lead.email]) {
    if (contact) await enforce(deps.sql, `lead:contact:${contact}`, deps.cfg.LEAD_LIMIT_CONTACT_PER_HOUR, 3600);
  }

  return deps.sql.begin(async (tx) => {
    const claimed = await tx`
      insert into idempotency_keys (scope, key, fingerprint) values ('lead', ${key}, ${fp})
      on conflict (scope, key) do nothing returning key`;
    if (claimed.length === 0) {
      const [row] = await tx<StoredKey[]>`
        select fingerprint, response_status, response_body from idempotency_keys where scope = 'lead' and key = ${key}`;
      if (!row || row.fingerprint !== fp) {
        throw new HttpError(409, "IDEMPOTENCY_MISMATCH", "Ключ уже использован для другой заявки");
      }
      if (row.response_body) return { status: row.response_status ?? 201, body: row.response_body, jobIds: [] };
      throw new HttpError(409, "CONFLICT", "Заявка обрабатывается, повторите через несколько секунд");
    }

    const deliveryMethod = lead.type === "catalog" ? await resolveDelivery(tx, lead.deliveryMethod) : null;
    const items = lead.type === "catalog" ? await verifyItems(tx, lead) : [];

    const ownerId = input.auth && !input.auth.user.isStaff ? input.auth.user.id : null;
    const [created] = await tx<{ id: string; reference: string }[]>`
      insert into leads (type, name, preferred_contact, phone, email, delivery_method,
        vehicle_make, vehicle_model, vehicle_year, request, message, comment, owner_user_id)
      values (${lead.type}, ${lead.name}, ${lead.contact.preferred}, ${lead.phone}, ${lead.email}, ${deliveryMethod},
        ${lead.type === "custom" ? lead.vehicle.make : null}, ${lead.type === "custom" ? lead.vehicle.model : null},
        ${lead.type === "custom" ? (lead.vehicle.year ?? null) : null},
        ${lead.type === "custom" ? lead.request : null}, ${lead.type === "general" ? lead.message : null},
        ${lead.type === "general" ? null : (lead.comment ?? null)}, ${ownerId})
      returning id, reference`;
    const leadRow = created!;

    for (const it of items) {
      await tx`
        insert into lead_items (lead_id, variant_id, product_id, product_slug, product_title, product_code,
          variant_title, vehicle_label, price_from_kopecks, quantity)
        values (${leadRow.id}, ${it.variantId}, ${it.productId}, ${it.slug}, ${it.title}, ${it.code},
          ${it.variantTitle}, ${it.vehicleLabel}, ${it.price}, ${it.quantity})`;
    }
    await tx`insert into lead_events (lead_id, type, to_status) values (${leadRow.id}, 'created', 'new')`;

    const jobIds = await enqueue(tx, leadNotifications(deps, leadRow, lead));
    const loyaltyStatus = deps.cfg.FEATURE_LOYALTY ? await awardForLead(tx, { id: leadRow.id, type: lead.type }, ownerId) : undefined;
    const body: LeadCreatedResponse = {
      reference: leadRow.reference,
      status: "received",
      ...(loyaltyStatus ? { loyaltyStatus } : {}),
    };
    await tx`
      update idempotency_keys set response_status = 201, response_body = ${tx.json(body)}
      where scope = 'lead' and key = ${key}`;
    return { status: 201, body, jobIds };
  });
}

async function resolveDelivery(tx: Tx, requested: string | undefined) {
  const methods = await tx<{ code: string }[]>`select code from delivery_methods where enabled order by sort`;
  if (requested) {
    if (!methods.some((m) => m.code === requested)) {
      throw new HttpError(422, "VALIDATION", "Проверьте поля формы", {
        fieldErrors: { deliveryMethod: "Этот способ получения недоступен" },
      });
    }
    return requested;
  }
  if (methods.length === 1) return methods[0]!.code;
  if (methods.length > 1) {
    throw new HttpError(422, "VALIDATION", "Проверьте поля формы", {
      fieldErrors: { deliveryMethod: "Выберите способ получения" },
    });
  }
  return null;
}

type VerifiedItem = {
  variantId: string;
  productId: string;
  slug: string;
  title: string;
  code: string;
  variantTitle: string;
  vehicleLabel: string;
  price: number | null;
  quantity: number;
};

async function verifyItems(tx: Tx, lead: Extract<Normalized, { type: "catalog" }>): Promise<VerifiedItem[]> {
  const ids = lead.items.map((i) => i.variantId);
  const rows = await tx<
    { id: string; variant_title: string; price: number | null; ok: boolean; product_id: string; slug: string; title: string; code: string; make: string; model: string }[]
  >`
    select x.id, x.title as variant_title, x.price_kopecks as price,
      (x.status = 'active' and x.available and p.status = 'published' and v.published
        and exists (select 1 from compatibilities c where c.product_id = x.product_id
          and c.vehicle_model_id = x.vehicle_model_id and c.active)) as ok,
      p.id as product_id, p.slug, p.title, p.code, v.make, v.model
    from variants x join products p on p.id = x.product_id join vehicle_models v on v.id = x.vehicle_model_id
    where x.id in ${tx(ids)}`;
  const byId = new Map(rows.map((r) => [r.id, r]));
  const changes: CatalogChange[] = [];
  const out: VerifiedItem[] = [];
  for (const item of lead.items) {
    const r = byId.get(item.variantId);
    if (!r || !r.ok) {
      changes.push({ variantId: item.variantId, available: false, priceFrom: null });
      continue;
    }
    if (item.seenPriceFrom !== r.price) {
      changes.push({ variantId: item.variantId, available: true, priceFrom: r.price });
      continue;
    }
    out.push({
      variantId: r.id,
      productId: r.product_id,
      slug: r.slug,
      title: r.title,
      code: r.code,
      variantTitle: r.variant_title,
      vehicleLabel: `${r.make} ${r.model}`,
      price: r.price,
      quantity: item.quantity,
    });
  }
  if (changes.length) {
    throw new HttpError(409, "CATALOG_CHANGED", "Подборка изменилась, проверьте позиции", { changes });
  }
  return out;
}

function leadNotifications(deps: Deps, lead: { id: string; reference: string }, req: Normalized): OutboxJob[] {
  const link = `${deps.cfg.SITE_URL}/admin/leads/${lead.reference}`;
  const staffText = `Новая заявка ${lead.reference}: ${leadTypeLabels[req.type]}\n${link}`;
  const jobs: OutboxJob[] = [];
  for (const chat of deps.cfg.TELEGRAM_STAFF_CHAT_IDS) {
    jobs.push({
      channel: "telegram",
      topic: "lead.staff",
      dedupeKey: `lead:${lead.id}:tg:${chat}`,
      payload: { method: "sendMessage", params: { chat_id: chat, text: staffText, disable_web_page_preview: true } },
    });
  }
  for (const to of deps.cfg.STAFF_NOTIFY_EMAILS) {
    jobs.push({
      channel: "email",
      topic: "lead.staff",
      dedupeKey: `lead:${lead.id}:email-staff:${to}`,
      payload: { to, subject: `Новая заявка ${lead.reference}`, text: staffText },
    });
  }
  if (req.email) {
    const how = req.contact.preferred === "phone" ? "по телефону" : "по email";
    jobs.push({
      channel: "email",
      topic: "lead.customer",
      dedupeKey: `lead:${lead.id}:email-customer`,
      payload: {
        to: req.email,
        subject: `ARMORIX: заявка ${lead.reference} принята`,
        text: [
          "Здравствуйте!",
          "",
          `Мы получили вашу заявку ${lead.reference}. Менеджер свяжется с вами ${how} в рабочее время.`,
          "Номер заявки пригодится при общении с менеджером.",
          "",
          "ARMORIX",
          deps.cfg.SITE_URL,
        ].join("\n"),
      },
    });
  }
  return jobs;
}

export function afterLead(deps: Deps, jobIds: string[]) {
  kick(deps, jobIds);
}

export async function anonymizeExpiredLeads(deps: Deps) {
  return deps.sql.begin(async (tx) => {
    const rows = await tx<{ id: string }[]>`
      update leads set name = 'Данные удалены', phone = null, email = null, request = null, message = null, comment = null,
        close_comment = null, anonymized_at = now(), updated_at = now(), version = version + 1
      where id in (
        select id from leads
        where anonymized_at is null and created_at < now() - make_interval(days => ${deps.cfg.LEAD_RETENTION_DAYS})
        order by created_at limit 500)
      returning id`;
    if (rows.length) {
      const ids = rows.map((r) => r.id);
      await tx`delete from outbox where dedupe_key like 'lead:%' and split_part(dedupe_key, ':', 2) in ${tx(ids)}`;
      await tx`update sales set contact_phone = null, contact_email = null where lead_id in ${tx(ids)}`;
      await tx`update lead_events set note = null where lead_id in ${tx(ids)} and note is not null`;
    }
    return rows.length;
  });
}
