import { randomUUID } from "node:crypto";
import { emailRequestSchema, emailVerifySchema } from "@armorix/contracts";
import { Router, type Response } from "express";
import { z } from "zod";
import type { Deps } from "../deps";
import { HttpError, notFound, parse } from "../http/errors";
import { feature } from "../http/features";
import { hmac, randomDigits, randomToken, safeEqual, sha256 } from "../security/crypto";
import { fetchTelegramJwks, TokenError, verifyTelegramIdToken, type TelegramClaims } from "../security/oidc";
import { enforce } from "../security/rateLimit";
import { createSession, csrfFor, loadAuthByToken, revokeSession, setSessionCookie, type AuthContext } from "../security/session";
import { audit } from "../services/audit";
import { balance, creditAward } from "../services/loyalty";
import { releaseEmail, reserveEmail } from "../services/outbox";
import { normalizeEmail, normalizePhone } from "../util";
import { clientIp } from "./leads";

const FRESH_SESSION_MIN = 15;
const tokenBody = z.object({ idToken: z.string().min(20).max(8000), nonce: z.string().min(16).max(100) });
const claimBody = z.object({ references: z.array(z.string().regex(/^AX-\d{6,}$/)).min(1).max(20) });

export const publicLeadStatus: Record<string, string> = {
  new: "Принята",
  in_progress: "В работе",
  offer_agreed: "В работе",
  sale_confirmed: "Завершена покупкой",
  closed: "Закрыта",
};

function requireLogin(res: Response) {
  const auth = res.locals.auth as AuthContext | null;
  if (!auth) throw new HttpError(401, "UNAUTHORIZED", "Войдите в кабинет");
  return auth;
}

async function isFresh(deps: Deps, sessionId: string) {
  const [s] = await deps.sql<{ fresh: boolean }[]>`
    select created_at > now() - make_interval(mins => ${FRESH_SESSION_MIN}) as fresh from sessions where id = ${sessionId}`;
  return Boolean(s?.fresh);
}

const badToken = () => new HttpError(400, "VALIDATION", "Не удалось подтвердить вход через Telegram");

export function accountRoutes(deps: Deps) {
  const r = Router();
  const account = feature(deps.cfg, "FEATURE_ACCOUNT");
  const jwks = () => (deps.telegramJwks ?? fetchTelegramJwks)();

  async function consumeNonce(nonce: string, purpose: "login" | "link", sessionId: string | null) {
    const rows = await deps.sql`
      update oidc_nonces set used_at = now()
      where nonce_hash = ${sha256(nonce)} and purpose = ${purpose} and used_at is null and expires_at > now()
        and ${sessionId ? deps.sql`session_id = ${sessionId}` : deps.sql`session_id is null`}
      returning nonce_hash`;
    if (rows.length === 0) throw badToken();
  }

  async function verifyToken(idToken: string, nonce: string): Promise<TelegramClaims> {
    const clientId = deps.cfg.TELEGRAM_LOGIN_CLIENT_ID;
    if (!clientId) throw notFound();
    try {
      return await verifyTelegramIdToken(idToken, { clientId, nonce, jwks });
    } catch (e) {
      if (e instanceof TokenError) throw badToken();
      throw e;
    }
  }

  async function applyPhone(userId: string, claims: TelegramClaims) {
    if (!claims.phone_number || claims.phone_number_verified === false) return;
    const phone = normalizePhone(claims.phone_number.startsWith("+") ? claims.phone_number : `+${claims.phone_number}`);
    if (!phone) return;
    await deps.sql`
      update users set phone = ${phone}, phone_verified_at = now()
      where id = ${userId} and not exists (
        select 1 from users o where o.phone = ${phone} and o.phone_verified_at is not null and o.id <> ${userId})`;
  }

  r.post("/auth/telegram/nonce", account, async (_req, res) => {
    if (!deps.cfg.TELEGRAM_LOGIN_CLIENT_ID) throw notFound();
    const auth = res.locals.auth as AuthContext | null;
    const nonce = randomToken(24);
    await deps.sql`
      insert into oidc_nonces (nonce_hash, purpose, session_id, expires_at)
      values (${sha256(nonce)}, ${auth ? "link" : "login"}, ${auth?.sessionId ?? null}, now() + interval '10 minutes')`;
    res.set("Cache-Control", "no-store").json({ nonce, clientId: Number(deps.cfg.TELEGRAM_LOGIN_CLIENT_ID), purpose: auth ? "link" : "login" });
  });

  r.post("/auth/telegram", account, async (req, res) => {
    const body = parse(tokenBody, req.body);
    await enforce(deps.sql, `tg-login:ip:${clientIp(req)}`, 30, 3600);
    await consumeNonce(body.nonce, "login", null);
    const claims = await verifyToken(body.idToken, body.nonce);
    const user = await deps.sql.begin(async (tx) => {
      const [known] = await tx<{ id: string; is_staff: boolean; status: string }[]>`
        select u.id, u.is_staff, u.status from identities i join users u on u.id = i.user_id
        where i.provider = 'telegram' and i.subject = ${claims.sub}`;
      if (known) return known;
      const [created] = await tx<{ id: string; is_staff: boolean; status: string }[]>`
        insert into users (name) values (${claims.name ?? claims.preferred_username ?? null}) returning id, is_staff, status`;
      await tx`insert into user_roles (user_id, role) values (${created!.id}, 'client')`;
      await tx`insert into identities (provider, subject, user_id) values ('telegram', ${claims.sub}, ${created!.id})`;
      return created!;
    });
    if (user.status !== "active") throw badToken();
    if (user.is_staff) throw new HttpError(403, "FORBIDDEN", "Сотрудники входят по коду на email");
    await applyPhone(user.id, claims);
    const previous = res.locals.auth as AuthContext | null;
    if (previous) await revokeSession(deps.sql, previous.sessionId);
    const s = await createSession(deps.sql, deps, user.id, true);
    setSessionCookie(res, deps, s.token, s.ttl);
    const auth = (await loadAuthByToken(deps, s.token))!;
    res.json({
      user: { id: auth.user.id, email: auth.user.email, name: auth.user.name, roles: auth.user.roles },
      mfa: { required: false, enrolled: false, passed: true },
      csrfToken: csrfFor(deps, auth.sessionId),
    });
  });

  r.post("/me/identities/telegram", account, async (req, res) => {
    const auth = requireLogin(res);
    if (auth.user.isStaff) throw new HttpError(403, "FORBIDDEN", "Недоступно для сотрудников");
    if (!(await isFresh(deps, auth.sessionId))) throw new HttpError(401, "UNAUTHORIZED", "Войдите заново, чтобы привязать Telegram");
    const body = parse(tokenBody, req.body);
    await consumeNonce(body.nonce, "link", auth.sessionId);
    const claims = await verifyToken(body.idToken, body.nonce);
    const linked = await deps.sql`
      insert into identities (provider, subject, user_id) values ('telegram', ${claims.sub}, ${auth.user.id})
      on conflict (provider, subject) do nothing returning user_id`;
    if (linked.length === 0) {
      const [owner] = await deps.sql`select user_id from identities where provider = 'telegram' and subject = ${claims.sub}`;
      if (owner?.user_id !== auth.user.id) throw new HttpError(409, "CONFLICT", "Этот Telegram уже привязан к другому кабинету");
    }
    await applyPhone(auth.user.id, claims);
    await audit(deps.sql, auth.user.id, "identity.link", "user", auth.user.id, { provider: "telegram" });
    res.json({ linked: true });
  });

  r.get("/me", account, async (_req, res) => {
    const auth = requireLogin(res);
    const [u] = await deps.sql`
      select id, email, email_verified_at is not null as "emailVerified", phone, phone_verified_at is not null as "phoneVerified", name,
        coalesce(array(select provider from identities i where i.user_id = users.id), '{}') as identities
      from users where id = ${auth.user.id}`;
    res.set("Cache-Control", "no-store").json({ profile: u });
  });

  r.patch("/me", account, async (req, res) => {
    const auth = requireLogin(res);
    const b = parse(z.object({ name: z.string().trim().min(1).max(80) }), req.body);
    await deps.sql`update users set name = ${b.name} where id = ${auth.user.id}`;
    res.json({ name: b.name });
  });

  r.post("/me/email/request", account, async (req, res) => {
    const auth = requireLogin(res);
    if (!(await isFresh(deps, auth.sessionId))) throw new HttpError(401, "UNAUTHORIZED", "Войдите заново, чтобы сменить email");
    const email = normalizeEmail(parse(emailRequestSchema, req.body).email);
    await enforce(deps.sql, `email-change:${auth.user.id}`, 5, 3600);
    const [taken] = await deps.sql`select 1 from users where email = ${email} and id <> ${auth.user.id}`;
    const id = randomUUID();
    if (!taken && (await reserveEmail(deps.sql, deps.cfg.EMAIL_DAILY_LIMIT))) {
      const code = randomDigits(6);
      await deps.sql`
        insert into login_challenges (id, purpose, email, user_id, code_hmac, expires_at)
        values (${id}, 'email_change', ${email}, ${auth.user.id}, ${hmac(deps.cfg.APP_SECRET, `otp:${id}:${code}`)},
          now() + interval '10 minutes')`;
      deps.waitUntil(
        deps.email
          .send({ to: email, subject: `Код подтверждения ARMORIX: ${code}`, text: `Код для смены email в кабинете: ${code}\nКод действует 10 минут.` })
          .catch(async () => releaseEmail(deps.sql).catch(() => {})),
      );
    }
    res.status(202).json({ challengeId: id });
  });

  r.post("/me/email/verify", account, async (req, res) => {
    const auth = requireLogin(res);
    const { challengeId, code } = parse(emailVerifySchema, req.body);
    const bad = new HttpError(400, "VALIDATION", "Код неверный или истёк", { fieldErrors: { code: "Код неверный или истёк" } });
    if (!/^[0-9a-f-]{36}$/.test(challengeId)) throw bad;
    const [ch] = await deps.sql<{ id: string; email: string; code_hmac: Buffer }[]>`
      update login_challenges set attempts = attempts + 1
      where id = ${challengeId} and purpose = 'email_change' and user_id = ${auth.user.id}
        and consumed_at is null and expires_at > now() and attempts < 5
      returning id, email, code_hmac`;
    if (!ch || !safeEqual(ch.code_hmac, hmac(deps.cfg.APP_SECRET, `otp:${ch.id}:${code}`))) throw bad;
    try {
      await deps.sql.begin(async (tx) => {
        const used = await tx`update login_challenges set consumed_at = now() where id = ${ch.id} and consumed_at is null returning id`;
        if (used.length === 0) throw bad;
        await tx`update users set email = ${ch.email}, email_verified_at = now() where id = ${auth.user.id}`;
        await audit(tx, auth.user.id, "user.email_changed", "user", auth.user.id);
      });
    } catch (e) {
      if ((e as { code?: string }).code === "23505") throw new HttpError(409, "CONFLICT", "Этот email уже используется");
      throw e;
    }
    res.json({ email: ch.email });
  });

  r.get("/me/leads", account, async (_req, res) => {
    const auth = requireLogin(res);
    const rows = await deps.sql<{ reference: string; type: string; status: string; created_at: Date; items: number }[]>`
      select reference, type, status, created_at, (select count(*)::int from lead_items i where i.lead_id = l.id) as items
      from leads l where owner_user_id = ${auth.user.id} order by created_at desc limit 200`;
    res.set("Cache-Control", "no-store").json({
      items: rows.map((l) => ({ reference: l.reference, type: l.type, status: publicLeadStatus[l.status], createdAt: l.created_at, items: l.items })),
    });
  });

  r.get("/me/leads/claimable", account, async (_req, res) => {
    const auth = requireLogin(res);
    const rows = await deps.sql`
      select l.reference, l.type, l.created_at as "createdAt"
      from leads l join users u on u.id = ${auth.user.id}
      where l.owner_user_id is null and l.created_at > now() - interval '180 days'
        and ((u.email_verified_at is not null and l.email = u.email) or (u.phone_verified_at is not null and l.phone = u.phone))
      order by l.created_at desc limit 50`;
    res.set("Cache-Control", "no-store").json({ items: rows });
  });

  r.post("/me/leads/claim", account, async (req, res) => {
    const auth = requireLogin(res);
    const { references } = parse(claimBody, req.body);
    const out = await deps.sql.begin(async (tx) => {
      const results: { reference: string; claimed: boolean; loyaltyStatus?: string }[] = [];
      for (const ref of references) {
        const [lead] = await tx<{ id: string }[]>`
          select l.id from leads l join users u on u.id = ${auth.user.id}
          where l.reference = ${ref} and l.owner_user_id is null
            and ((u.email_verified_at is not null and l.email = u.email) or (u.phone_verified_at is not null and l.phone = u.phone))
          for update of l`;
        if (!lead) {
          results.push({ reference: ref, claimed: false });
          continue;
        }
        await tx`update leads set owner_user_id = ${auth.user.id}, version = version + 1, updated_at = now() where id = ${lead.id}`;
        await tx`insert into lead_events (lead_id, actor_user_id, type, note) values (${lead.id}, ${auth.user.id}, 'claim', 'self')`;
        let loyaltyStatus: string | undefined;
        if (deps.cfg.FEATURE_LOYALTY) {
          const [award] = await tx<{ id: string }[]>`select id from loyalty_awards where lead_id = ${lead.id} and status = 'pending'`;
          if (award) loyaltyStatus = await creditAward(tx, award.id, auth.user.id);
        }
        results.push({ reference: ref, claimed: true, ...(loyaltyStatus ? { loyaltyStatus } : {}) });
      }
      return results;
    });
    res.json({ items: out });
  });

  r.get("/me/purchases", account, async (_req, res) => {
    const auth = requireLogin(res);
    const sales = await deps.sql`
      select s.id, s.status, s.amount_kopecks as amount, s.refunded_kopecks as refunded, s.sold_on::text as "soldOn",
        coalesce((select json_agg(json_build_object('title', i.title, 'quantity', i.quantity)) from sale_items i where i.sale_id = s.id), '[]') as items
      from sales s where s.client_user_id = ${auth.user.id} and s.status <> 'draft'
      order by s.sold_on desc limit 200`;
    res.set("Cache-Control", "no-store").json({ items: sales });
  });

  r.get("/me/loyalty", account, feature(deps.cfg, "FEATURE_LOYALTY"), async (_req, res) => {
    const auth = requireLogin(res);
    const history = await deps.sql`
      select type, points, reason, created_at as "createdAt", expires_at as "expiresAt"
      from loyalty_ledger where user_id = ${auth.user.id} order by created_at desc limit 200`;
    const pending = await deps.sql`
      select a.points, l.reference, a.confirm_deadline as "confirmDeadline"
      from loyalty_awards a join leads l on l.id = a.lead_id
      where a.status = 'pending' and l.owner_user_id = ${auth.user.id}`;
    res.set("Cache-Control", "no-store").json({ balance: await balance(deps.sql, auth.user.id), history, pending });
  });

  return r;
}
