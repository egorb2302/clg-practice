import type { ProductCard as Card } from "@armorix/contracts";
import { api } from "../../lib/api.server";

export async function fetchAllCards(): Promise<Card[]> {
  const first = await api.catalog(new URLSearchParams());
  const pages = Math.min(1000, Math.ceil(first.total / Math.max(1, first.pageSize)));
  const items = [...first.items];
  for (let p = 2; p <= pages; p += 4) {
    const batch = Array.from({ length: Math.min(4, pages - p + 1) }, (_, i) => api.catalog(new URLSearchParams({ page: String(p + i) })));
    for (const r of await Promise.all(batch)) items.push(...r.items);
  }
  return items;
}

export function popularCards(all: Card[], n = 3): Card[] {
  const rank = { kit: 0, front: 1, rear: 2 } as const;
  const seen = new Set<string>();
  return [...all]
    .sort((a, b) => rank[a.position] - rank[b.position] || (a.priceFrom == null ? 1 : 0) - (b.priceFrom == null ? 1 : 0))
    .filter((c) => (seen.has(c.slug) ? false : (seen.add(c.slug), true)))
    .slice(0, n);
}
