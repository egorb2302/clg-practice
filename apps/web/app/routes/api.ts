/* /api/v1/* on the site's own origin. API_MOCK=1: answered by the fixtures. Otherwise
   proxied to API_ORIGIN with the client IP, cookies and the idempotency key forwarded.
   On Vercel a rewrite in front of this route can take over; the shapes stay the same. */
import type { Route } from "./+types/api";
import { apiRaw, isMock } from "../lib/api.server";

const PASS = ["content-type", "cookie", "idempotency-key", "x-csrf-token", "user-agent", "accept-language", "origin"];

async function handle(request: Request, splat: string) {
  const url = new URL(request.url);
  const path = `/${splat}`;
  const body = request.method === "GET" || request.method === "HEAD" ? undefined : await request.json().catch(() => null);
  if (isMock()) {
    const r = await apiRaw(request.method, path, url.searchParams.toString(), body, request.headers);
    return Response.json(r.body, { status: r.status, headers: { "Cache-Control": request.method === "GET" ? "public, s-maxage=60" : "no-store" } });
  }
  const headers = new Headers();
  for (const h of PASS) { const v = request.headers.get(h); if (v) headers.set(h, v); }
  const ip = (request.headers.get("x-vercel-forwarded-for") ?? request.headers.get("x-forwarded-for"))?.split(",")[0]?.trim();
  if (ip) headers.set("x-forwarded-for", ip);
  const secret = process.env.SITE_PROXY_SECRET;
  if (ip && secret) {
    headers.set("x-armorix-client-ip", ip);
    headers.set("x-armorix-proxy-secret", secret);
  }
  const origin = (process.env.API_ORIGIN ?? "http://localhost:3350").replace(/\/+$/, "");
  const res = await fetch(`${origin}/api/v1${path}${url.search}`, {
    method: request.method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
  });
  const out = new Headers();
  for (const h of ["content-type", "cache-control", "set-cookie", "retry-after"]) { const v = res.headers.get(h); if (v) out.set(h, v); }
  return new Response(res.body, { status: res.status, headers: out });
}

export function loader({ request, params }: Route.LoaderArgs) {
  return handle(request, params["*"] ?? "");
}
export function action({ request, params }: Route.ActionArgs) {
  return handle(request, params["*"] ?? "");
}
