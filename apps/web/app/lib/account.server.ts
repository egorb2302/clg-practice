import type { SessionResponse } from "@armorix/contracts";
import { apiRaw } from "./api.server";

export const PRIVATE_CACHE = "private, no-store";

export function privateHeaders(): Headers {
  return new Headers({ "Cache-Control": PRIVATE_CACHE, "X-Robots-Tag": "noindex" });
}

function forward(request: Request): Headers {
  const h = new Headers();
  const cookie = request.headers.get("cookie");
  if (cookie) h.set("cookie", cookie);
  const ua = request.headers.get("user-agent");
  if (ua) h.set("user-agent", ua);
  return h;
}

export async function meGet<T>(request: Request, path: string, search = ""): Promise<{ status: number; body: T | null }> {
  try {
    const r = await apiRaw("GET", path, search, undefined, forward(request));
    return { status: r.status, body: r.status < 400 ? (r.body as T) : null };
  } catch {
    return { status: 0, body: null };
  }
}

export async function sessionOf(request: Request): Promise<SessionResponse | null> {
  if (!request.headers.get("cookie")) return null;
  const r = await meGet<SessionResponse>(request, "/auth/session");
  return r.status === 200 ? r.body : null;
}
