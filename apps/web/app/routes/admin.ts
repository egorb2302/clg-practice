import type { Route } from "./+types/admin";

const PASS_OUT = ["content-type", "cache-control", "etag", "last-modified", "x-robots-tag"];

export async function loader({ request, params }: Route.LoaderArgs) {
  const origin = (process.env.API_ORIGIN ?? "http://localhost:3350").replace(/\/+$/, "");
  const url = new URL(request.url);
  const path = params["*"] ? `/admin/${params["*"]}` : "/admin/";
  const res = await fetch(`${origin}${path}${url.search}`, { headers: { accept: request.headers.get("accept") ?? "*/*" }, redirect: "manual" });
  const out = new Headers({ "x-robots-tag": "noindex, nofollow" });
  for (const h of PASS_OUT) {
    const v = res.headers.get(h);
    if (v) out.set(h, v);
  }
  return new Response(res.body, { status: res.status, headers: out });
}
