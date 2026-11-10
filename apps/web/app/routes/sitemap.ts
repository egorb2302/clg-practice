import type { Route } from "./+types/sitemap";
import { api, PUBLIC_CACHE, siteOrigin } from "../lib/api.server";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

export async function loader({ request }: Route.LoaderArgs) {
  const origin = siteOrigin(request);
  const { urls } = await api.sitemap();
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `  <url><loc>${esc(origin + u.path)}</loc><lastmod>${u.updatedAt.slice(0, 10)}</lastmod></url>`)
    .join("\n")}\n</urlset>\n`;
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": PUBLIC_CACHE } });
}
