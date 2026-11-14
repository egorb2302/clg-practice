import { API_PREFIX, type ApiError } from "@armorix/contracts";
import { plural } from "./format";

export type Res<T> = { status: number; body: T | null; error: ApiError | null };

let token: string | null | undefined;

export function setCsrf(t: string | null | undefined) {
  token = t;
}

export async function call<T = unknown>(method: string, path: string, body?: unknown, csrfToken?: string | null): Promise<Res<T>> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (csrfToken) headers["x-csrf-token"] = csrfToken;
  try {
    const r = await fetch(`${API_PREFIX}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "same-origin",
      cache: "no-store",
    });
    const text = await r.text();
    let parsed: unknown = null;
    try { parsed = text ? JSON.parse(text) : null; } catch { parsed = null; }
    const ok = r.status < 400;
    return { status: r.status, body: ok ? (parsed as T) : null, error: ok ? null : ((parsed as ApiError | null) ?? null) };
  } catch {
    return { status: 0, body: null, error: null };
  }
}

export async function csrf(): Promise<string | null> {
  if (token !== undefined) return token;
  const r = await call<{ csrfToken: string }>("GET", "/auth/session");
  token = r.status === 200 && r.body ? r.body.csrfToken : null;
  return token;
}

export async function send<T = unknown>(method: string, path: string, body?: unknown): Promise<Res<T>> {
  const r = await call<T>(method, path, body ?? {}, await csrf());
  if (r.status === 403 && r.error?.code === "CSRF") {
    token = undefined;
    return call<T>(method, path, body ?? {}, await csrf());
  }
  return r;
}

export function safeNext(raw: string | null | undefined, fallback = "/account"): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  if (/^\/(login|api|admin)(\/|\?|$)/.test(raw)) return fallback;
  return raw;
}

export function loginHref(next: string, reauth = false): string {
  return `/login?next=${encodeURIComponent(next)}${reauth ? "&reauth=1" : ""}`;
}

export function emailOk(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
}

const DATE = new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Moscow", day: "2-digit", month: "2-digit", year: "numeric" });
const TIME = new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Moscow", hour: "2-digit", minute: "2-digit" });
const LONG = new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Moscow", day: "numeric", month: "long", year: "numeric" });

const asDate = (v: string | Date | null | undefined) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};
export const fmtDate = (v: string | Date | null | undefined) => { const d = asDate(v); return d ? DATE.format(d) : ""; };
export const fmtTime = (v: string | Date | null | undefined) => { const d = asDate(v); return d ? TIME.format(d) : ""; };
export const fmtLong = (v: string | Date | null | undefined) => { const d = asDate(v); return d ? LONG.format(d) : ""; };

const N = new Intl.NumberFormat("ru-RU");
export const num = (n: number) => N.format(n);
export const pointsLabel = (n: number) => `${N.format(n)} ${plural(n, ["балл", "балла", "баллов"])}`;

export function maskedPhone(phone: string | null | undefined): string {
  const d = (phone ?? "").replace(/\D/g, "");
  if (d.length !== 11) return phone ?? "";
  return `+${d[0]} ${d.slice(1, 4)} ***-**-${d.slice(9)}`;
}

export type TgResult = { id_token?: string; error?: string };
type TgLogin = { auth: (o: { client_id: number; nonce?: string; scope?: string[]; lang?: string }, cb: (r: TgResult) => void) => void };

export const TG_SCRIPT = "https://oauth.telegram.org/js/telegram-login.js?6";
let tgLoad: Promise<TgLogin> | null = null;

export function loadTelegram(): Promise<TgLogin> {
  const w = window as unknown as { Telegram?: { Login?: TgLogin } };
  if (w.Telegram?.Login) return Promise.resolve(w.Telegram.Login);
  if (tgLoad) return tgLoad;
  tgLoad = new Promise<TgLogin>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = TG_SCRIPT;
    s.async = true;
    s.onload = () => (w.Telegram?.Login ? resolve(w.Telegram.Login) : reject(new Error("telegram")));
    s.onerror = () => { tgLoad = null; s.remove(); reject(new Error("telegram")); };
    document.head.appendChild(s);
  });
  return tgLoad;
}
