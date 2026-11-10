import type { Route } from "./+types/admin";
import { safeSplat } from "./api";

const PASS_OUT = ["content-type", "cache-control", "etag", "last-modified"];

export async function loader({ request, params }: Route.LoaderArgs) {
  const splat = params["*"] ?? "";
  if (!safeSplat(splat)) return new Response(null, { status: 404 });
  const origin = (process.env.API_ORIGIN ?? "http://localhost:3350").replace(/\/+$/, "");
  const url = new URL(request.url);
  const res = await fetch(`${origin}/admin/${splat}${url.search}`, {
    headers: { accept: request.headers.get("accept") ?? "*/*" },
    redirect: "manual",
  });
  const out = new Headers({ "x-robots-tag": "noindex, nofollow" });
  for (const h of PASS_OUT) {
    const v = res.headers.get(h);
    if (v) out.set(h, v);
  }
  return new Response(res.body, { status: res.status, headers: out });
}
