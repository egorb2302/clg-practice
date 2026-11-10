import { Router } from "express";
import { z } from "zod";
import type { Deps } from "../../deps";
import { HttpError, notFound, parse, versionConflict } from "../../http/errors";
import { feature } from "../../http/features";
import { authOf, requireStaff } from "../../security/session";
import { audit } from "../../services/audit";
import { campaignMessage } from "../../services/campaigns";
import { balance, lockUser, reverseAward } from "../../services/loyalty";
import { enqueue, kick } from "../../services/outbox";

const ruleBody = z.object({
  points: z.number().int().positive().max(1_000_000),
  confirmDays: z.number().int().min(1).max(365).default(30),
  pointsTtlDays: z.number().int().min(1).max(3650).nullable().default(null),
  kopecksPerPoint: z.number().int().min(1).max(100_000).default(100),
  redeemLimitPct: z.number().int().min(1).max(100).default(20),
});

const adjustBody = z.object({ points: z.number().int().refine((n) => n !== 0), reason: z.string().trim().min(3).max(300) });
const reasonBody = z.object({ reason: z.string().trim().min(3).max(300) });

const postFields = {
  type: z.enum(["offer", "news"]),
  slug: z.string().trim().regex(/^[a-z0-9-]{1,80}$/),
  title: z.string().trim().min(1).max(200),
  summary: z.string().trim().max(500).default(""),
  body: z.string().trim().max(20_000).default(""),
  coverUrl: z.url({ protocol: /^https?$/ }).max(500).nullable().default(null),
  startsAt: z.iso.datetime({ offset: true }).nullable().default(null),
  endsAt: z.iso.datetime({ offset: true }).nullable().default(null),
  offer: z
    .object({
      minPurchases: z.number().int().min(1).max(1000).nullable().default(null),
      productIds: z.array(z.uuid()).max(200).default([]),
      combinable: z.boolean().default(false),
      benefit: z.string().trim().max(500).default(""),
    })
    .optional(),
};
const postCreate = z.object(postFields);
const postPatch = z.object({
  version: z.number().int().positive(),
  title: z.string().trim().min(1).max(200).optional(),
  summary: z.string().trim().max(500).optional(),
  body: z.string().trim().max(20_000).optional(),
  coverUrl: z.url({ protocol: /^https?$/ }).max(500).nullable().optional(),
  startsAt: z.iso.datetime({ offset: true }).nullable().optional(),
  endsAt: z.iso.datetime({ offset: true }).nullable().optional(),
  offer: postFields.offer,
});
const postStatus = z.object({ version: z.number().int().positive(), status: z.enum(["draft", "published", "archived"]) });

const campaignBody = z.object({ subject: z.string().trim().min(3).max(200), bodyText: z.string().trim().min(10).max(20_000) });
const campaignPatch = campaignBody.partial().extend({ version: z.number().int().positive() });
const scheduleBody = z.object({ version: z.number().int().positive(), at: z.iso.datetime({ offset: true }), confirm: z.literal(true) });

const uuidParam = (v: unknown) => {
  const id = String(v);
  if (!z.uuid().safeParse(id).success) throw notFound();
  return id;
};

export function adminRelease2Routes(deps: Deps) {
  const r = Router();
  const loyalty = feature(deps.cfg, "FEATURE_LOYALTY");
  const posts = (req: import("express").Request, _res: import("express").Response, next: import("express").NextFunction) => {
    if (!deps.cfg.FEATURE_OFFERS && !deps.cfg.FEATURE_NEWS) throw notFound();
    next();
  };
  const campaigns = feature(deps.cfg, "FEATURE_CAMPAIGNS");

  r.get("/admin/loyalty/rules", loyalty, requireStaff("leads_read"), async (_req, res) => {
    res.json({ items: await deps.sql`select * from loyalty_rules order by version desc` });
  });

  r.post("/admin/loyalty/rules", loyalty, requireStaff("loyalty_manage"), async (req, res) => {
    const b = parse(ruleBody, req.body);
    const actor = authOf(res).user.id;
    const rule = await deps.sql.begin(async (tx) => {
      await tx`select pg_advisory_xact_lock(hashtext('loyalty_rules_welcome'))`;
      const [v] = await tx<{ next: number }[]>`select coalesce(max(version), 0) + 1 as next from loyalty_rules where program = 'welcome'`;
      await tx`update loyalty_rules set active = false where program = 'welcome' and active`;
      const [row] = await tx`
        insert into loyalty_rules (program, version, points, confirm_days, points_ttl_days, kopecks_per_point, redeem_limit_pct, created_by)
        values ('welcome', ${v!.next}, ${b.points}, ${b.confirmDays}, ${b.pointsTtlDays}, ${b.kopecksPerPoint}, ${b.redeemLimitPct}, ${actor})
        returning id, version`;
      await audit(tx, actor, "loyalty.rule", "loyalty_rule", row!.id as string, b);
      return row;
    });
    res.status(201).json(rule);
  });

  r.post("/admin/loyalty/rules/deactivate", loyalty, requireStaff("loyalty_manage"), async (_req, res) => {
    await deps.sql.begin(async (tx) => {
      await tx`update loyalty_rules set active = false where program = 'welcome' and active`;
      await audit(tx, authOf(res).user.id, "loyalty.rule_off", "loyalty_rule", null);
    });
    res.json({ active: false });
  });

  r.get("/admin/loyalty/users/:id", loyalty, requireStaff("leads_read"), async (req, res) => {
    const id = uuidParam(req.params.id);
    const history = await deps.sql`
      select type, points, reason, op_key as "opKey", created_at as "createdAt" from loyalty_ledger
      where user_id = ${id} order by created_at desc limit 500`;
    res.json({ balance: await balance(deps.sql, id), history });
  });

  r.post("/admin/loyalty/users/:id/adjust", loyalty, requireStaff("loyalty_manage"), async (req, res) => {
    const id = uuidParam(req.params.id);
    const b = parse(adjustBody, req.body);
    const key = req.header("idempotency-key");
    if (!key || !/^[A-Za-z0-9_-]{8,100}$/.test(key)) throw new HttpError(400, "IDEMPOTENCY_KEY_REQUIRED", "Нужен заголовок Idempotency-Key");
    const actor = authOf(res).user.id;
    const out = await deps.sql.begin(async (tx) => {
      const [u] = await tx`select id from users where id = ${id}`;
      if (!u) throw notFound();
      await lockUser(tx, id);
      const rows = await tx`
        insert into loyalty_ledger (user_id, type, points, op_key, reason, actor_user_id)
        values (${id}, 'adjust', ${b.points}, ${`adjust:${key}`}, ${b.reason}, ${actor})
        on conflict (op_key) do nothing returning id`;
      if (rows.length) await audit(tx, actor, "loyalty.adjust", "user", id, b);
      return { balance: await balance(tx, id), duplicate: rows.length === 0 };
    });
    res.status(out.duplicate ? 200 : 201).json(out);
  });

  r.post("/admin/loyalty/awards/:id/reverse", loyalty, requireStaff("loyalty_manage"), async (req, res) => {
    const id = uuidParam(req.params.id);
    const b = parse(reasonBody, req.body);
    const actor = authOf(res).user.id;
    const reversed = await deps.sql.begin(async (tx) => {
      const ok = await reverseAward(tx, id, b.reason, actor);
      if (ok) await audit(tx, actor, "loyalty.reverse", "loyalty_award", id, b);
      return ok;
    });
    res.json({ reversed });
  });

  r.get("/admin/posts", posts, requireStaff("catalog_edit"), async (req, res) => {
    const type = req.query.type === "news" ? "news" : req.query.type === "offer" ? "offer" : undefined;
    const items = await deps.sql`
      select p.id, p.type, p.slug, p.title, p.status, p.starts_at as "startsAt", p.ends_at as "endsAt", p.version,
        o.min_purchases as "minPurchases", o.rule_version as "ruleVersion"
      from posts p left join offer_rules o on o.post_id = p.id
      where true ${type ? deps.sql`and p.type = ${type}` : deps.sql``}
      order by p.updated_at desc limit 500`;
    res.json({ items });
  });

  r.post("/admin/posts", posts, requireStaff("catalog_edit"), async (req, res) => {
    const b = parse(postCreate, req.body);
    const actor = authOf(res).user.id;
    const row = await deps.sql
      .begin(async (tx) => {
        const [p] = await tx<{ id: string; version: number }[]>`
          insert into posts (type, slug, title, summary, body, cover_url, starts_at, ends_at)
          values (${b.type}, ${b.slug}, ${b.title}, ${b.summary}, ${b.body}, ${b.coverUrl}, ${b.startsAt}, ${b.endsAt})
          returning id, version`;
        if (b.type === "offer") {
          const o = b.offer ?? { minPurchases: null, productIds: [], combinable: false, benefit: "" };
          await tx`insert into offer_rules (post_id, min_purchases, product_ids, combinable, benefit)
            values (${p!.id}, ${o.minPurchases}, ${o.productIds}, ${o.combinable}, ${o.benefit})`;
        }
        await audit(tx, actor, "post.create", "post", p!.id, { type: b.type, slug: b.slug });
        return p!;
      })
      .catch((e) => {
        if ((e as { code?: string }).code === "23505") throw new HttpError(409, "CONFLICT", "Такой адрес уже занят");
        if ((e as { code?: string }).code === "23514") throw new HttpError(422, "VALIDATION", "Проверьте даты", { fieldErrors: { endsAt: "Окончание раньше начала" } });
        throw e;
      });
    res.status(201).json(row);
  });

  r.patch("/admin/posts/:id", posts, requireStaff("catalog_edit"), async (req, res) => {
    const id = uuidParam(req.params.id);
    const b = parse(postPatch, req.body);
    const actor = authOf(res).user.id;
    const version = await deps.sql.begin(async (tx) => {
      const rows = await tx<{ version: number; type: string }[]>`
        update posts set
          title = coalesce(${b.title ?? null}, title), summary = coalesce(${b.summary ?? null}, summary),
          body = coalesce(${b.body ?? null}, body),
          cover_url = ${b.coverUrl === undefined ? tx`cover_url` : b.coverUrl},
          starts_at = ${b.startsAt === undefined ? tx`starts_at` : b.startsAt},
          ends_at = ${b.endsAt === undefined ? tx`ends_at` : b.endsAt},
          version = version + 1, updated_at = now()
        where id = ${id} and version = ${b.version} returning version, type`;
      if (rows.length === 0) throw versionConflict();
      if (b.offer && rows[0]!.type === "offer") {
        await tx`update offer_rules set min_purchases = ${b.offer.minPurchases}, product_ids = ${b.offer.productIds},
          combinable = ${b.offer.combinable}, benefit = ${b.offer.benefit}, rule_version = rule_version + 1
          where post_id = ${id}`;
      }
      await audit(tx, actor, "post.update", "post", id, { fields: Object.keys(b).filter((k) => k !== "version") });
      return rows[0]!.version;
    }).catch((e) => {
      if ((e as { code?: string }).code === "23514") throw new HttpError(422, "VALIDATION", "Проверьте даты", { fieldErrors: { endsAt: "Окончание раньше начала" } });
      throw e;
    });
    res.json({ version });
  });

  r.post("/admin/posts/:id/status", posts, requireStaff("catalog_edit"), async (req, res) => {
    const id = uuidParam(req.params.id);
    const b = parse(postStatus, req.body);
    const actor = authOf(res).user.id;
    const version = await deps.sql.begin(async (tx) => {
      const [p] = await tx<{ title: string; summary: string; type: string; ends_at: Date | null }[]>`
        select title, summary, type, ends_at from posts where id = ${id}`;
      if (!p) throw notFound();
      if (b.status === "published") {
        const problems: Record<string, string> = {};
        if (!p.summary) problems.summary = "Добавьте краткое описание";
        if (p.type === "offer" && p.ends_at && p.ends_at < new Date()) problems.endsAt = "Срок акции уже прошёл";
        if (Object.keys(problems).length) throw new HttpError(422, "VALIDATION", "Публикация не готова", { fieldErrors: problems });
      }
      const rows = await tx<{ version: number }[]>`
        update posts set status = ${b.status}, version = version + 1, updated_at = now(),
          published_at = case when ${b.status} = 'published' then coalesce(published_at, now()) else published_at end
        where id = ${id} and version = ${b.version} returning version`;
      if (rows.length === 0) throw versionConflict();
      await audit(tx, actor, "post.status", "post", id, { to: b.status });
      return rows[0]!.version;
    });
    res.json({ status: b.status, version });
  });

  r.get("/admin/campaigns", campaigns, requireStaff("catalog_edit"), async (_req, res) => {
    const items = await deps.sql`
      select c.id, c.subject, c.status, c.scheduled_at as "scheduledAt", c.version,
        (select json_object_agg(status, n) from (select status, count(*)::int n from campaign_deliveries d where d.campaign_id = c.id group by status) x) as report
      from campaigns c order by c.created_at desc limit 200`;
    const [subs] = await deps.sql`select count(*)::int as active from subscriptions where status = 'active'`;
    res.json({ items, activeSubscribers: subs!.active });
  });

  r.post("/admin/campaigns", campaigns, requireStaff("catalog_edit"), async (req, res) => {
    const b = parse(campaignBody, req.body);
    const actor = authOf(res).user.id;
    const row = await deps.sql.begin(async (tx) => {
      const [c] = await tx<{ id: string; version: number }[]>`
        insert into campaigns (subject, body_text, created_by) values (${b.subject}, ${b.bodyText}, ${actor}) returning id, version`;
      await audit(tx, actor, "campaign.create", "campaign", c!.id);
      return c!;
    });
    res.status(201).json(row);
  });

  r.patch("/admin/campaigns/:id", campaigns, requireStaff("catalog_edit"), async (req, res) => {
    const id = uuidParam(req.params.id);
    const b = parse(campaignPatch, req.body);
    const rows = await deps.sql<{ version: number }[]>`
      update campaigns set subject = coalesce(${b.subject ?? null}, subject), body_text = coalesce(${b.bodyText ?? null}, body_text),
        version = version + 1, updated_at = now()
      where id = ${id} and version = ${b.version} and status = 'draft' returning version`;
    if (rows.length === 0) throw versionConflict();
    res.json(rows[0]);
  });

  r.post("/admin/campaigns/:id/test", campaigns, requireStaff("catalog_edit"), async (req, res) => {
    const id = uuidParam(req.params.id);
    const to = authOf(res).user.email;
    if (!to) throw new HttpError(409, "CONFLICT", "У сотрудника нет email для тестового письма");
    const [c] = await deps.sql<{ subject: string; body_text: string }[]>`select subject, body_text from campaigns where id = ${id}`;
    if (!c) throw notFound();
    const msg = campaignMessage(deps, { subject: `[Тест] ${c.subject}`, body_text: c.body_text }, { id: "00000000-0000-0000-0000-000000000000", email: to });
    const ids = await enqueue(deps.sql, [
      { channel: "email", topic: "campaign.test", dedupeKey: `campaign-test:${id}:${Date.now()}`, payload: msg },
    ]);
    kick(deps, ids);
    res.status(202).json({ to });
  });

  r.post("/admin/campaigns/:id/schedule", campaigns, requireStaff("campaigns_send"), async (req, res) => {
    const id = uuidParam(req.params.id);
    const b = parse(scheduleBody, req.body);
    const actor = authOf(res).user.id;
    const at = new Date(b.at);
    if (at.getTime() < Date.now() - 60_000) throw new HttpError(422, "VALIDATION", "Время уже прошло", { fieldErrors: { at: "Время уже прошло" } });
    const version = await deps.sql.begin(async (tx) => {
      const rows = await tx<{ version: number }[]>`
        update campaigns set status = 'scheduled', scheduled_at = ${at}, scheduled_by = ${actor}, version = version + 1, updated_at = now()
        where id = ${id} and version = ${b.version} and status = 'draft' returning version`;
      if (rows.length === 0) throw versionConflict();
      await audit(tx, actor, "campaign.schedule", "campaign", id, { at: b.at });
      return rows[0]!.version;
    });
    res.json({ status: "scheduled", version });
  });

  r.post("/admin/campaigns/:id/cancel", campaigns, requireStaff("campaigns_send"), async (req, res) => {
    const id = uuidParam(req.params.id);
    const actor = authOf(res).user.id;
    await deps.sql.begin(async (tx) => {
      const rows = await tx`update campaigns set status = 'cancelled', updated_at = now()
        where id = ${id} and status in ('draft', 'scheduled', 'sending') returning id`;
      if (rows.length === 0) throw notFound();
      await tx`update campaign_deliveries set status = 'skipped', updated_at = now() where campaign_id = ${id} and status = 'queued'`;
      await tx`update outbox set status = 'failed', last_error = 'campaign cancelled'
        where status = 'pending' and id in (select outbox_id from campaign_deliveries where campaign_id = ${id})`;
      await audit(tx, actor, "campaign.cancel", "campaign", id);
    });
    res.json({ status: "cancelled" });
  });

  return r;
}
