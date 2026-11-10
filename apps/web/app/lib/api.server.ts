/* All server-side data access. Loaders call ${API_ORIGIN}/api/v1/...; API_MOCK=1 swaps
   in local fixtures with the same shapes. Swapping mock → real is one env change. */
import {
  API_PREFIX,
  type CatalogResponse,
  type MetaResponse,
  type ProductResponse,
  type SitemapResponse,
  type VehiclesResponse,
} from "@armorix/contracts";
import { mockApi } from "./mock.server";

export const PUBLIC_CACHE = "public, s-maxage=60, stale-while-revalidate=300";

export const isMock = () => process.env.API_MOCK === "1";
const origin = () => (process.env.API_ORIGIN ?? "http://localhost:3000").replace(/\/+$/, "");

export class ApiFailure extends Error {
  constructor(public status: number, public body: unknown) {
    super(`API ${status}`);
  }
}

/** Raw call: returns status and parsed body, never throws on HTTP errors. */
export async function apiRaw(method: string, path: string, search = "", body?: unknown, headers?: Headers): Promise<{ status: number; body: unknown; headers?: Headers }> {
  if (isMock()) return mockApi(method, path, new URLSearchParams(search), body, headers);
  const res = await fetch(`${origin()}${API_PREFIX}${path}${search ? `?${search}` : ""}`, {
    method,
    headers: headers ?? (body === undefined ? undefined : { "content-type": "application/json" }),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let parsed: unknown = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = { code: "INTERNAL", message: text.slice(0, 200) }; }
  return { status: res.status, body: parsed, headers: res.headers };
}

async function get<T>(path: string, search = ""): Promise<T> {
  const r = await apiRaw("GET", path, search);
  if (r.status >= 400) throw new ApiFailure(r.status, r.body);
  return r.body as T;
}

export const api = {
  meta: () => get<MetaResponse>("/meta"),
  vehicles: () => get<VehiclesResponse>("/vehicles"),
  catalog: (q: URLSearchParams) => get<CatalogResponse>("/catalog", q.toString()),
  product: async (slug: string, vehicle?: string): Promise<ProductResponse | null> => {
    const r = await apiRaw("GET", `/catalog/${encodeURIComponent(slug)}`, vehicle ? new URLSearchParams({ vehicle }).toString() : "");
    if (r.status === 404) return null;
    if (r.status >= 400) throw new ApiFailure(r.status, r.body);
    return r.body as ProductResponse;
  },
  sitemap: () => get<SitemapResponse>("/sitemap"),
};

/** Absolute site origin for canonical and OG tags. */
export function siteOrigin(request: Request): string {
  return (process.env.SITE_ORIGIN ?? new URL(request.url).origin).replace(/\/+$/, "");
}
