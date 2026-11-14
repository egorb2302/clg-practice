import type { Features } from "@armorix/contracts";
import { data } from "react-router";
import { api, PUBLIC_CACHE } from "./api.server";

export async function requireFeature(flag: keyof Features | null, cache = PUBLIC_CACHE) {
  if (flag) {
    const meta = await api.meta().catch(() => null);
    if (!meta?.features[flag]) throw data(null, { status: 404 });
  }
  return data({}, { headers: { "Cache-Control": cache } });
}
