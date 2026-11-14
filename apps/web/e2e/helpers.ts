import { expect, type Page, type Route } from "@playwright/test";

export const SEL_KEY = "armorix.selection.v1";
export const CAR_KEY = "armorix.vehicle.v1";

export async function open(page: Page, path: string) {
  await page.addInitScript(() => {
    try { sessionStorage.setItem("armorix-intro", "1"); } catch { /* storage blocked */ }
  });
  await page.goto(path);
  await expect(page.locator("html")).toHaveClass(/is-ready/);
}

export type SentLead = { body: Record<string, unknown>; key: string | undefined };
type Reply = { status: number; json: unknown };

export async function mockLeads(page: Page, reply?: (n: number, body: Record<string, unknown>) => Reply | undefined) {
  const sent: SentLead[] = [];
  await page.route(/\/api\/v1\/leads$/, async (route: Route) => {
    if (route.request().method() !== "POST") return route.fallback();
    const body = route.request().postDataJSON() as Record<string, unknown>;
    sent.push({ body, key: route.request().headers()["idempotency-key"] });
    const r = reply?.(sent.length, body) ?? { status: 201, json: { reference: "AX-E2E001", status: "received" } };
    await route.fulfill({ status: r.status, contentType: "application/json", body: JSON.stringify(r.json) });
  });
  return sent;
}

export async function stored<T>(page: Page, key: string, area: "localStorage" | "sessionStorage" = "localStorage"): Promise<T | null> {
  const raw = await page.evaluate(([k, a]) => window[a as "localStorage"].getItem(k as string), [key, area]);
  return raw ? (JSON.parse(raw) as T) : null;
}

export type Stored = { variantId: string; productSlug: string; quantity: number };

export async function selectionItems(page: Page): Promise<Stored[]> {
  return (await stored<Stored[]>(page, SEL_KEY)) ?? [];
}

export function drawer(page: Page) {
  return page.getByRole("dialog", { name: "Ваша подборка" });
}

export async function fillContact(page: Page, scope = page.locator("form.lf").first()) {
  await scope.getByLabel("Имя").fill("Тест Тестов");
  const phone = scope.getByLabel("Телефон");
  await phone.click();
  await phone.pressSequentially("9001234567");
  return scope;
}
