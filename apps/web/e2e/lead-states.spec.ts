import { expect, test, type Page } from "@playwright/test";
import { drawer, fillContact, mockLeads, open, selectionItems } from "./helpers";

async function toSelectionPage(page: Page) {
  await open(page, "/catalog");
  await page.getByRole("button", { name: /^В подборку: / }).first().click();
  await expect.poll(async () => (await selectionItems(page)).length).toBe(1);
  await page.locator(".hd__sel").click();
  await drawer(page).getByRole("link", { name: "Оформить заявку" }).click();
  await expect(page).toHaveURL(/\/selection$/);
  return page.locator("form.lf").first();
}

test("empty form: errors at the fields, focus on the first one, nothing sent", async ({ page }) => {
  const sent = await mockLeads(page);
  const form = await toSelectionPage(page);
  await form.locator("button[type=submit]").click();
  await expect(form.getByLabel("Имя")).toBeFocused();
  await expect(form.getByLabel("Имя")).toHaveAttribute("aria-invalid", "true");
  expect(sent).toHaveLength(0);
});

test("422 from the server: error at the field and focus on it", async ({ page }) => {
  await mockLeads(page, () => ({ status: 422, json: { code: "VALIDATION", fieldErrors: { "contact.phone": "Проверьте номер" } } }));
  const form = await toSelectionPage(page);
  await fillContact(page, form);
  await form.locator("button[type=submit]").click();
  await expect(form.getByLabel("Телефон")).toBeFocused();
  await expect(form.getByLabel("Телефон")).toHaveAttribute("aria-invalid", "true");
});

test("429: «too many attempts», the button waits", async ({ page }) => {
  await mockLeads(page, () => ({ status: 429, json: { code: "RATE_LIMITED", retryAfterSec: 60 } }));
  const form = await toSelectionPage(page);
  await fillContact(page, form);
  await form.locator("button[type=submit]").click();
  await expect(form.locator("button[type=submit]")).toHaveText(/Подождите\s1\sминуту/);
  await expect(form.locator(".lf__msg")).toContainText(/попыт/i);
});

test("network failure: «Повторить», the retry reuses the same Idempotency-Key", async ({ page }) => {
  const keys: string[] = [];
  await page.route(/\/api\/v1\/leads$/, async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    keys.push(route.request().headers()["idempotency-key"] ?? "");
    if (keys.length === 1) return route.abort("failed");
    await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ reference: "AX-E2E002", status: "received" }) });
  });
  const form = await toSelectionPage(page);
  await fillContact(page, form);
  await form.locator("button[type=submit]").click();
  await expect(form.locator("button[type=submit]")).toHaveText(/Повторить/);
  await form.locator("button[type=submit]").click();
  await expect(page.getByRole("heading", { name: "Заявка AX-E2E002 принята" }).first()).toBeVisible();
  expect(keys).toHaveLength(2);
  expect(keys[1]).toBe(keys[0]);
});

test("503: «Повторить», the retry reuses the same Idempotency-Key", async ({ page }) => {
  const sent = await mockLeads(page, (n) => (n === 1 ? { status: 503, json: {} } : undefined));
  const form = await toSelectionPage(page);
  await fillContact(page, form);
  await form.locator("button[type=submit]").click();
  await expect(form.locator("button[type=submit]")).toHaveText(/Повторить/);
  await form.locator("button[type=submit]").click();
  await expect(page.getByRole("heading", { name: "Заявка AX-E2E001 принята" }).first()).toBeVisible();
  expect(sent).toHaveLength(2);
  expect(sent[1]!.key).toBe(sent[0]!.key);
});

test("409 catalog changed: the change is shown per item, nothing is cleared", async ({ page }) => {
  let variant = "";
  await mockLeads(page, (_n, body) => {
    variant = (body.items as { variantId: string }[])[0]!.variantId;
    return { status: 409, json: { code: "CATALOG_CHANGED", changes: [{ variantId: variant, available: true, priceFrom: 9_990_000 }] } };
  });
  const form = await toSelectionPage(page);
  await fillContact(page, form);
  await form.locator("button[type=submit]").click();
  const change = page.locator("p", { hasText: "Цена изменилась" }).first();
  await expect(change).toBeVisible();
  await expect(change).toContainText(/от\s99\s900\s₽/);
  expect((await selectionItems(page)).map((i) => i.variantId)).toEqual([variant]);
});
