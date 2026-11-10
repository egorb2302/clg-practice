/* Browser side of POST /api/v1/leads (same origin; on Vercel the rewrite or the
   /api/v1/* route proxies it to the API, so cookies stay first-party). */
import { API_PREFIX, type CatalogChange, type LeadCreatedResponse, type LeadRequest } from "@armorix/contracts";

export type LeadResult =
  | { kind: "ok"; data: LeadCreatedResponse }
  | { kind: "invalid"; fieldErrors: Record<string, string> }
  | { kind: "changed"; changes: CatalogChange[] }
  | { kind: "mismatch" }
  | { kind: "limited"; retryAfterSec: number }
  | { kind: "busy" }
  | { kind: "failed" };

export async function postLead(body: LeadRequest, key: string): Promise<LeadResult> {
  let res: Response;
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 20_000);
    res = await fetch(`${API_PREFIX}/leads`, {
      method: "POST",
      headers: { "content-type": "application/json", "Idempotency-Key": key },
      body: JSON.stringify(body),
      signal: ctl.signal,
    });
    clearTimeout(t);
  } catch {
    return { kind: "failed" };
  }
  const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (res.status === 201 && data) return { kind: "ok", data: data as unknown as LeadCreatedResponse };
  if (res.status === 422) return { kind: "invalid", fieldErrors: (data?.fieldErrors as Record<string, string>) ?? {} };
  if (res.status === 409 && data?.code === "CATALOG_CHANGED") return { kind: "changed", changes: (data.changes as CatalogChange[]) ?? [] };
  if (res.status === 409 && data?.code === "IDEMPOTENCY_MISMATCH") return { kind: "mismatch" };
  if (res.status === 409) return { kind: "busy" };
  if (res.status === 429) return { kind: "limited", retryAfterSec: Number(data?.retryAfterSec) || 60 };
  return { kind: "failed" };
}

export const uuid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (+c ^ (Math.random() * 16) >> (+c / 4)).toString(16));
