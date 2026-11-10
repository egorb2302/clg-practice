import type { RoleValue, SessionUser } from "@armorix/contracts";
import type { NextFunction, Request, Response } from "express";
import type { Db } from "../db";
import type { Deps } from "../deps";
import { HttpError } from "../http/errors";
import { hmac, randomToken, safeEqual, sha256 } from "./crypto";

export type AuthContext = {
  sessionId: string;
  user: SessionUser & { isStaff: boolean };
  mfaPassed: boolean;
  mfaEnrolled: boolean;
};

export const cookieName = (secure: boolean) => (secure ? "__Host-ax_session" : "ax_session");

export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return undefined;
}

export function setSessionCookie(res: Response, deps: Deps, token: string, maxAgeSec: number) {
  const parts = [
    `${cookieName(deps.cfg.COOKIE_SECURE)}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSec}`,
  ];
  if (deps.cfg.COOKIE_SECURE) parts.push("Secure");
  res.append("Set-Cookie", parts.join("; "));
}

export function clearSessionCookie(res: Response, deps: Deps) {
  setSessionCookie(res, deps, "", 0);
}

export const csrfFor = (deps: Deps, sessionId: string) => hmac(deps.cfg.APP_SECRET, `csrf:${sessionId}`).toString("base64url");

export async function createSession(db: Db, deps: Deps, userId: string, mfaPassed: boolean) {
  const token = randomToken(32);
  const ttl = deps.cfg.SESSION_TTL_HOURS * 3600;
  const [row] = await db<{ id: string }[]>`
    insert into sessions (token_hash, user_id, mfa_passed, expires_at)
    values (${sha256(token)}, ${userId}, ${mfaPassed}, now() + make_interval(secs => ${ttl}))
    returning id`;
  return { token, id: row!.id, ttl };
}

export async function revokeSession(db: Db, sessionId: string) {
  await db`update sessions set revoked_at = now() where id = ${sessionId} and revoked_at is null`;
}

export async function loadAuth(deps: Deps, req: Request): Promise<AuthContext | null> {
  const token = readCookie(req, cookieName(deps.cfg.COOKIE_SECURE));
  if (!token || token.length > 100) return null;
  return loadAuthByToken(deps, token);
}

export async function loadAuthByToken(deps: Deps, token: string): Promise<AuthContext | null> {
  const [row] = await deps.sql<
    { session_id: string; user_id: string; email: string | null; name: string | null; is_staff: boolean; mfa_passed: boolean; enrolled: boolean; roles: RoleValue[]; last_seen_at: Date }[]
  >`
    select s.id as session_id, u.id as user_id, u.email, u.name, u.is_staff, s.mfa_passed, s.last_seen_at,
      exists (select 1 from totp_factors f where f.user_id = u.id and f.confirmed_at is not null) as enrolled,
      coalesce(array(select role from user_roles r where r.user_id = u.id order by role), '{}') as roles
    from sessions s join users u on u.id = s.user_id
    where s.token_hash = ${sha256(token)} and s.revoked_at is null and s.expires_at > now() and u.status = 'active'`;
  if (!row) return null;
  if (Date.now() - row.last_seen_at.getTime() > 5 * 60_000) {
    const ttl = deps.cfg.SESSION_TTL_HOURS * 3600;
    await deps.sql`
      update sessions set last_seen_at = now(), expires_at = now() + make_interval(secs => ${ttl})
      where id = ${row.session_id}`;
  }
  return {
    sessionId: row.session_id,
    user: { id: row.user_id, email: row.email, name: row.name, roles: row.roles, isStaff: row.is_staff },
    mfaPassed: row.mfa_passed,
    mfaEnrolled: row.enrolled,
  };
}

export function sessionMiddleware(deps: Deps) {
  return async (req: Request, res: Response, next: NextFunction) => {
    res.locals.auth = await loadAuth(deps, req);
    next();
  };
}

const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function originGuard(deps: Deps) {
  const allowed = new Set([new URL(deps.cfg.SITE_URL).origin, ...deps.cfg.ALLOWED_ORIGINS]);
  return (req: Request, res: Response, next: NextFunction) => {
    if (!unsafeMethods.has(req.method)) return next();
    const origin = req.headers.origin;
    if (origin && !allowed.has(origin)) {
      throw new HttpError(403, "CSRF", "Запрос с недопустимого источника");
    }
    const auth = res.locals.auth as AuthContext | null;
    if (auth) {
      const sent = req.headers["x-csrf-token"];
      if (typeof sent !== "string" || !safeEqual(sent, csrfFor(deps, auth.sessionId))) {
        throw new HttpError(403, "CSRF", "Сессия устарела, обновите страницу");
      }
    }
    next();
  };
}

export type Capability =
  | "staff"
  | "leads"
  | "contacts_view"
  | "sales_confirm"
  | "catalog_edit"
  | "users_manage"
  | "jobs_manage"
  | "audit_view";

export function capabilities(roles: readonly RoleValue[]): Set<Capability> {
  const caps = new Set<Capability>();
  const has = (r: RoleValue) => roles.includes(r);
  if (has("manager") || has("editor") || has("admin")) caps.add("staff");
  if (has("manager") || has("admin")) {
    caps.add("leads");
    caps.add("contacts_view");
    caps.add("sales_confirm");
  }
  if (has("editor") || has("admin")) caps.add("catalog_edit");
  if (has("contacts_view")) caps.add("contacts_view");
  if (has("sales_confirm")) caps.add("sales_confirm");
  if (has("admin")) {
    caps.add("users_manage");
    caps.add("jobs_manage");
    caps.add("audit_view");
  }
  return caps;
}

export function requireStaff(...needed: Capability[]) {
  return (_req: Request, res: Response, next: NextFunction) => {
    const auth = res.locals.auth as AuthContext | null;
    if (!auth) throw new HttpError(401, "UNAUTHORIZED", "Войдите в систему");
    const caps = capabilities(auth.user.roles);
    if (!auth.user.isStaff || !caps.has("staff")) throw new HttpError(403, "FORBIDDEN", "Недостаточно прав");
    if (!auth.mfaPassed) throw new HttpError(401, "MFA_REQUIRED", "Подтвердите вход кодом из приложения");
    for (const c of needed) if (!caps.has(c)) throw new HttpError(403, "FORBIDDEN", "Недостаточно прав");
    res.locals.caps = caps;
    next();
  };
}

export const authOf = (res: Response) => res.locals.auth as AuthContext;
export const capsOf = (res: Response) => res.locals.caps as Set<Capability>;
