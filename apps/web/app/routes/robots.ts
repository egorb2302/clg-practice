import type { Route } from "./+types/robots";
import { PUBLIC_CACHE, siteOrigin } from "../lib/api.server";

export function loader({ request }: Route.LoaderArgs) {
  const body = ["User-agent: *", "Allow: /", "Disallow: /account", "Disallow: /admin", "Disallow: /api", "", `Sitemap: ${siteOrigin(request)}/sitemap.xml`, ""].join("\n");
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": PUBLIC_CACHE } });
}
