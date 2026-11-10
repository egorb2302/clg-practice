import {
  emailRequestSchema,
  emailVerifySchema,
  recoveryVerifySchema,
  totpVerifySchema,
  type SessionResponse,
} from "@armorix/contracts";
import { randomUUID } from "node:crypto";
import { Router, type Response } from "express";
import type { Deps } from "../deps";
import { HttpError, parse } from "../http/errors";
import { decrypt, encrypt, hmac, randomDigits, randomToken, safeEqual, sha256 } from "../security/crypto";
import { enforce, hit } from "../security/rateLimit";
import { audit as writeAudit } from "../services/audit";
import { reserveEmail } from "../services/outbox";
import {
  clearSessionCookie,
  createSession,
  csrfFor,
  loadAuthByToken,
  revokeSession,
  setSessionCookie,
  type AuthContext,
} from "../security/session";
import { newTotpSecret, otpauthUri, verifyTotp } from "../security/totp";
import { normalizeEmail } from "../util";
import { clientIp } from "./leads";

const CODE_TTL_MIN = 10;
const MAX_ATTEMPTS = 5;
const OTP_RESERVE = 50;
const badCode = () => new HttpError(400, "VALIDATION", "Код неверный или истёк", { fieldErrors: { code: "Код неверный или истёк" } });

export const codeHmac = (deps: Deps, challengeId: string, code: string) => hmac(deps.cfg.APP_SECRET, `otp:${challengeId}:${code}`);

function sessionBody(deps: Deps, a: AuthContext): SessionResponse {
  return {
    user: { id: a.user.id, email: a.user.email, name: a.user.name, roles: a.user.roles },
    mfa: { required: a.user.isStaff, enrolled: a.mfaEnrolled, passed: a.mfaPassed },
    csrfToken: csrfFor(deps, a.sessionId),
  };
}

async function issueSession(deps: Deps, res: Response, userId: string, mfaPassed: boolean, previous?: AuthContext | null) {
  if (previous) await revokeSession(deps.sql, previous.sessionId);
  const s = await createSession(deps.sql, deps, userId, mfaPassed);
  setSessionCookie(res, deps, s.token, s.ttl);
  const auth = await loadAuthByToken(deps, s.token);
  if (!auth) throw new HttpError(401, "UNAUTHORIZED", "Войдите в систему");
  return sessionBody(deps, auth);
}

function requireLogin(res: Response) {
  const auth = res.locals.auth as AuthContext | null;
  if (!auth) throw new HttpError(401, "UNAUTHORIZED", "Войдите в систему");
  return auth;
}

export function authRoutes(deps: Deps) {
  const r = Router();

  r.post("/auth/email/request", async (req, res) => {
    const { email: rawEmail } = parse(emailRequestSchema, req.body);
    const email = normalizeEmail(rawEmail);
    await enforce(deps.sql, `otp:ip:${clientIp(req)}`, 20, 3600);
    const minute = await enforceSoft(deps, `otp:email-min:${email}`, 1, 60);
    const hourly = await enforceSoft(deps, `otp:email-hour:${email}`, 5, 3600);
    if (!minute || !hourly) {
      throw new HttpError(429, "RATE_LIMITED", "Код уже отправлен, подождите перед повторной отправкой", { retryAfterSec: 60 });
    }

    const [user] = await deps.sql<{ id: string; is_staff: boolean }[]>`
      select id, is_staff from users where email = ${email} and status = 'active'`;
    const allowed = user ? user.is_staff || deps.cfg.FEATURE_ACCOUNT : deps.cfg.FEATURE_ACCOUNT;
    if (!allowed) {
      res.status(202).json({ challengeId: randomUUID(), expiresInSec: CODE_TTL_MIN * 60 });
      return;
    }
    const code = randomDigits(6);
    const id = randomUUID();
    await deps.sql`
      insert into login_challenges (id, purpose, email, user_id, code_hmac, expires_at)
      values (${id}, 'login', ${email}, ${user?.id ?? null}, ${codeHmac(deps, id, code)},
        now() + make_interval(mins => ${CODE_TTL_MIN}))`;
    if (!(await reserveEmail(deps.sql, deps.cfg.EMAIL_DAILY_LIMIT + OTP_RESERVE))) {
      console.error(JSON.stringify({ level: "error", event: "otp.daily_limit" }));
      res.status(202).json({ challengeId: id, expiresInSec: CODE_TTL_MIN * 60 });
      return;
    }
    deps.waitUntil(
      deps.email
        .send({
          to: email,
          subject: `Код входа ARMORIX: ${code}`,
          text: `Ваш код для входа: ${code}\nКод действует ${CODE_TTL_MIN} минут. Если вы не запрашивали вход, просто проигнорируйте письмо.`,
        })
        .catch((e) => console.error(JSON.stringify({ level: "error", event: "otp.send", error: String((e as Error).message) }))),
    );
    res.status(202).json({ challengeId: id, expiresInSec: CODE_TTL_MIN * 60 });
  });

  r.post("/auth/email/verify", async (req, res) => {
    const { challengeId, code } = parse(emailVerifySchema, req.body);
    await enforce(deps.sql, `otp-verify:ip:${clientIp(req)}`, 30, 3600);
    if (!/^[0-9a-f-]{36}$/.test(challengeId)) throw badCode();
    const [ch] = await deps.sql<{ id: string; email: string; user_id: string | null; code_hmac: Buffer }[]>`
      update login_challenges set attempts = attempts + 1
      where id = ${challengeId} and purpose = 'login' and consumed_at is null and expires_at > now()
        and attempts < ${MAX_ATTEMPTS}
      returning id, email, user_id, code_hmac`;
    if (!ch || !safeEqual(ch.code_hmac, codeHmac(deps, ch.id, code))) throw badCode();
    const consumed = await deps.sql`
      update login_challenges set consumed_at = now() where id = ${ch.id} and consumed_at is null returning id`;
    if (consumed.length === 0) throw badCode();

    const user = await deps.sql.begin(async (tx) => {
      const [existing] = await tx<{ id: string; is_staff: boolean; status: string }[]>`
        select id, is_staff, status from users where email = ${ch.email}`;
      if (existing) {
        if (existing.status !== "active") return null;
        await tx`update users set email_verified_at = coalesce(email_verified_at, now()) where id = ${existing.id}`;
        return existing;
      }
      if (!deps.cfg.FEATURE_ACCOUNT) return null;
      const [created] = await tx<{ id: string; is_staff: boolean }[]>`
        insert into users (email, email_verified_at) values (${ch.email}, now()) returning id, is_staff`;
      await tx`insert into user_roles (user_id, role) values (${created!.id}, 'client')`;
      return created!;
    });
    if (!user) throw badCode();
    const body = await issueSession(deps, res, user.id, !user.is_staff, res.locals.auth as AuthContext | null);
    res.json(body);
  });

  r.get("/auth/session", async (_req, res) => {
    const auth = requireLogin(res);
    res.set("Cache-Control", "no-store").json(sessionBody(deps, auth));
  });

  r.post("/auth/totp/enroll", async (_req, res) => {
    const auth = requireLogin(res);
    if (!auth.user.isStaff) throw new HttpError(403, "FORBIDDEN", "Недоступно");
    if (auth.mfaEnrolled) throw new HttpError(409, "CONFLICT", "Приложение уже подключено. Для сброса обратитесь к администратору");
    const secret = newTotpSecret();
    await deps.sql`
      insert into totp_factors (user_id, secret_enc) values (${auth.user.id}, ${encrypt(deps.cfg.TOTP_ENC_KEY, secret)})
      on conflict (user_id) do update set secret_enc = excluded.secret_enc, last_used_step = 0, created_at = now()
      where totp_factors.confirmed_at is null`;
    res.set("Cache-Control", "no-store").json({ secret, otpauthUri: otpauthUri(secret, auth.user.email ?? auth.user.id) });
  });

  r.post("/auth/totp/verify", async (req, res) => {
    const auth = requireLogin(res);
    if (!auth.user.isStaff) throw new HttpError(403, "FORBIDDEN", "Недоступно");
    const { code } = parse(totpVerifySchema, req.body);
    await enforce(deps.sql, `totp:${auth.user.id}`, 6, 600);
    const [f] = await deps.sql<{ secret_enc: string; confirmed_at: Date | null; last_used_step: number }[]>`
      select secret_enc, confirmed_at, last_used_step from totp_factors where user_id = ${auth.user.id}`;
    if (!f) throw new HttpError(409, "CONFLICT", "Сначала подключите приложение-аутентификатор");
    const step = verifyTotp(decrypt(deps.cfg.TOTP_ENC_KEY, f.secret_enc), code, Date.now(), f.last_used_step);
    if (step === null) throw badCode();
    const updated = await deps.sql`
      update totp_factors set last_used_step = ${step}, confirmed_at = coalesce(confirmed_at, now())
      where user_id = ${auth.user.id} and last_used_step < ${step} returning user_id`;
    if (updated.length === 0) throw badCode();

    let recoveryCodes: string[] | undefined;
    if (!f.confirmed_at) {
      recoveryCodes = Array.from({ length: 8 }, () => randomToken(9));
      await deps.sql`delete from recovery_codes where user_id = ${auth.user.id}`;
      for (const rc of recoveryCodes) {
        await deps.sql`insert into recovery_codes (user_id, code_hash) values (${auth.user.id}, ${sha256(rc)})`;
      }
      await writeAudit(deps.sql, auth.user.id, "totp.enrolled", "user", auth.user.id);
    }
    const body = await issueSession(deps, res, auth.user.id, true, auth);
    res.set("Cache-Control", "no-store").json(recoveryCodes ? { ...body, recoveryCodes } : body);
  });

  r.post("/auth/recovery", async (req, res) => {
    const auth = requireLogin(res);
    if (!auth.user.isStaff) throw new HttpError(403, "FORBIDDEN", "Недоступно");
    const { code } = parse(recoveryVerifySchema, req.body);
    await enforce(deps.sql, `recovery:${auth.user.id}`, 5, 3600);
    const used = await deps.sql`
      update recovery_codes set used_at = now()
      where user_id = ${auth.user.id} and code_hash = ${sha256(code)} and used_at is null returning id`;
    if (used.length === 0) throw badCode();
    await writeAudit(deps.sql, auth.user.id, "totp.recovery_used", "user", auth.user.id);
    res.json(await issueSession(deps, res, auth.user.id, true, auth));
  });

  r.post("/auth/logout", async (_req, res) => {
    const auth = res.locals.auth as AuthContext | null;
    if (auth) await revokeSession(deps.sql, auth.sessionId);
    clearSessionCookie(res, deps);
    res.status(204).end();
  });

  return r;
}

async function enforceSoft(deps: Deps, key: string, limit: number, windowSec: number) {
  return (await hit(deps.sql, key, limit, windowSec)).allowed;
}
