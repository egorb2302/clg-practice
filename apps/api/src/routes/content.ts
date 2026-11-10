import { Router } from "express";
import { z } from "zod";
import type { Deps } from "../deps";
import { HttpError, notFound, parse } from "../http/errors";
import { feature } from "../http/features";
import { safeEqual } from "../security/crypto";
import { enforce } from "../security/rateLimit";
import type { AuthContext } from "../security/session";
import { subscriptionToken, unsubscribeLinks } from "../services/campaigns";
import { priorPurchases } from "../services/offers";
import { enqueue, kick } from "../services/outbox";
import { normalizeEmail } from "../util";
import { clientIp } from "./leads";

const publicCache = "public, s-maxage=60, stale-while-revalidate=300";

const subscribeBody = z.object({
  email: z.email({ error: "Проверьте email" }).max(254),
  consent: z.literal(true, { error: "Нужно согласие на рассылку" }),
  source: z.string().trim().regex(/^[a-z0-9_-]{1,30}$/).default("site"),
});
const tokenBody = z.object({ id: z.uuid(), token: z.string().min(20).max(100) });

type PostRow = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  body: string;
  cover_url: string | null;
  starts_at: Date | null;
  ends_at: Date | null;
  published_at: Date | null;
  min_purchases: number | null;
  benefit: string | null;
  combinable: boolean | null;
};

const toPost = (p: PostRow, full: boolean) => ({
  slug: p.slug,
  title: p.title,
  summary: p.summary,
  ...(full ? { body: p.body } : {}),
  coverUrl: p.cover_url,
  startsAt: p.starts_at,
  endsAt: p.ends_at,
  publishedAt: p.published_at,
  ...(p.benefit !== null ? { benefit: p.benefit, minPurchases: p.min_purchases, combinable: p.combinable } : {}),
});

export function contentRoutes(deps: Deps) {
  const r = Router();

  const listPosts = (type: "offer" | "news") => async (_req: unknown, res: import("express").Response) => {
    const rows = await deps.sql<PostRow[]>`
      select p.*, o.min_purchases, o.benefit, o.combinable from posts p left join offer_rules o on o.post_id = p.id
      where p.type = ${type} and p.status = 'published'
        ${type === "offer" ? deps.sql`and coalesce(p.ends_at > now(), true)` : deps.sql``}
      order by coalesce(p.starts_at, p.published_at) desc limit 100`;
    res.set("Cache-Control", publicCache).json({ items: rows.map((p) => toPost(p, false)) });
  };

  const onePost = (type: "offer" | "news") => async (req: import("express").Request, res: import("express").Response) => {
    const [p] = await deps.sql<PostRow[]>`
      select p.*, o.min_purchases, o.benefit, o.combinable from posts p left join offer_rules o on o.post_id = p.id
      where p.type = ${type} and p.status = 'published' and p.slug = ${String(req.params.slug).slice(0, 80)}`;
    if (!p) throw notFound();
    res.set("Cache-Control", publicCache).json({ post: { ...toPost(p, true), expired: p.ends_at ? p.ends_at < new Date() : false } });
  };

  r.get("/offers", feature(deps.cfg, "FEATURE_OFFERS"), listPosts("offer"));
  r.get("/offers/:slug", feature(deps.cfg, "FEATURE_OFFERS"), onePost("offer"));
  r.get("/news", feature(deps.cfg, "FEATURE_NEWS"), listPosts("news"));
  r.get("/news/:slug", feature(deps.cfg, "FEATURE_NEWS"), onePost("news"));

  r.get("/me/offers", feature(deps.cfg, "FEATURE_ACCOUNT"), feature(deps.cfg, "FEATURE_OFFERS"), async (_req, res) => {
    const auth = res.locals.auth as AuthContext | null;
    if (!auth) throw new HttpError(401, "UNAUTHORIZED", "Войдите в кабинет");
    const purchases = await priorPurchases(deps.sql, auth.user.id, null);
    const rows = await deps.sql<PostRow[]>`
      select p.*, o.min_purchases, o.benefit, o.combinable from posts p join offer_rules o on o.post_id = p.id
      where p.type = 'offer' and p.status = 'published'
        and coalesce(p.starts_at <= now(), true) and coalesce(p.ends_at > now(), true)
      order by p.ends_at nulls last`;
    res.set("Cache-Control", "no-store").json({
      purchases,
      items: rows.map((p) => ({ ...toPost(p, false), eligible: !p.min_purchases || purchases >= p.min_purchases })),
    });
  });

  const campaigns = feature(deps.cfg, "FEATURE_CAMPAIGNS");

  r.post("/subscriptions", campaigns, async (req, res) => {
    const b = parse(subscribeBody, req.body);
    const email = normalizeEmail(b.email);
    await enforce(deps.sql, `sub:ip:${clientIp(req)}`, 10, 3600);
    await enforce(deps.sql, `sub:email:${email}`, 3, 86_400);
    const auth = res.locals.auth as AuthContext | null;
    const jobIds = await deps.sql.begin(async (tx) => {
      const [sub] = await tx<{ id: string; status: string }[]>`
        insert into subscriptions (email, user_id, consent_text_version, source)
        values (${email}, ${auth && !auth.user.isStaff ? auth.user.id : null}, ${deps.cfg.CONSENT_TEXT_VERSION}, ${b.source})
        on conflict (email) do update set updated_at = now(),
          status = case when subscriptions.status = 'unsubscribed' then 'pending' else subscriptions.status end,
          consent_text_version = case when subscriptions.status = 'active' then subscriptions.consent_text_version else excluded.consent_text_version end,
          source = case when subscriptions.status = 'active' then subscriptions.source else excluded.source end
        returning id, status`;
      if (sub!.status === "active") return [];
      await tx`insert into consent_events (subscription_id, type, text_version, source)
        values (${sub!.id}, 'subscribe', ${deps.cfg.CONSENT_TEXT_VERSION}, ${b.source})`;
      const link = `${deps.cfg.SITE_URL}/subscribe/confirm?id=${sub!.id}&token=${subscriptionToken(deps, sub!.id, "confirm")}`;
      return enqueue(tx, [
        {
          channel: "email",
          topic: "subscription.confirm",
          dedupeKey: `sub-confirm:${sub!.id}:${new Date().toISOString().slice(0, 10)}`,
          payload: {
            to: email,
            subject: "ARMORIX: подтвердите подписку",
            text: `Подтвердите подписку на новости и предложения ARMORIX:\n${link}\n\nЕсли вы не подписывались, просто проигнорируйте письмо.`,
          },
        },
      ]);
    });
    kick(deps, jobIds);
    res.status(202).json({ ok: true });
  });

  r.post("/subscriptions/confirm", campaigns, async (req, res) => {
    const b = parse(tokenBody, req.body);
    if (!safeEqual(b.token, subscriptionToken(deps, b.id, "confirm"))) throw notFound();
    await deps.sql.begin(async (tx) => {
      const rows = await tx`
        update subscriptions set status = 'active', confirmed_at = now(), updated_at = now()
        where id = ${b.id} and status = 'pending' returning id`;
      if (rows.length) await tx`insert into consent_events (subscription_id, type) values (${b.id}, 'confirm')`;
    });
    res.json({ status: "active" });
  });

  async function unsubscribe(id: string, token: string) {
    if (!safeEqual(token, subscriptionToken(deps, id, "unsubscribe"))) throw notFound();
    await deps.sql.begin(async (tx) => {
      const rows = await tx`
        update subscriptions set status = 'unsubscribed', unsubscribed_at = now(), updated_at = now()
        where id = ${id} and status <> 'unsubscribed' returning id`;
      if (rows.length) await tx`insert into consent_events (subscription_id, type) values (${id}, 'unsubscribe')`;
    });
  }

  r.post("/subscriptions/unsubscribe", campaigns, async (req, res) => {
    const b = parse(tokenBody, req.body);
    await unsubscribe(b.id, b.token);
    res.json({ status: "unsubscribed" });
  });

  r.post("/subscriptions/one-click", campaigns, async (req, res) => {
    const b = parse(tokenBody, req.query);
    await unsubscribe(b.id, b.token);
    res.status(200).send("");
  });

  r.get("/me/subscription", feature(deps.cfg, "FEATURE_ACCOUNT"), campaigns, async (_req, res) => {
    const auth = res.locals.auth as AuthContext | null;
    if (!auth) throw new HttpError(401, "UNAUTHORIZED", "Войдите в кабинет");
    const [s] = await deps.sql<{ id: string; status: string; email: string }[]>`
      select s.id, s.status, s.email from subscriptions s join users u on u.id = ${auth.user.id}
      where s.user_id = u.id or (u.email_verified_at is not null and s.email = u.email)
      order by s.updated_at desc limit 1`;
    res.set("Cache-Control", "no-store").json({
      subscription: s ? { status: s.status, email: s.email, unsubscribe: unsubscribeLinks(deps, s.id).page } : null,
    });
  });

  return r;
}
