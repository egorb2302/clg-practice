import { expect, test, type Page } from "@playwright/test";
import { drawer, fillContact, mockLeads, open, selectionItems } from "./helpers";

async function checkoutFromDrawer(page: Page) {
  const sent = await mockLeads(page);
  const d = drawer(page);
  await expect(d).toBeVisible();
  await d.getByRole("link", { name: "Оформить заявку" }).click();
  await expect(page).toHaveURL(/\/selection$/);
  const before = await selectionItems(page);
  expect(before.length).toBeGreaterThan(0);

  const form = await fillContact(page);
  await form.locator("button[type=submit]").click();
  await expect(page.getByRole("heading", { name: "Заявка AX-E2E001 принята" }).first()).toBeVisible();

  expect(sent).toHaveLength(1);
  const body = sent[0]!.body as { type: string; items: { variantId: string; quantity: number }[]; deliveryMethod?: string };
  expect(body.type).toBe("catalog");
  expect(body.items.map((i) => i.variantId).sort()).toEqual(before.map((i) => i.variantId).sort());
  expect(body.deliveryMethod).toBeTruthy();
  expect(sent[0]!.key).toMatch(/^[0-9a-f-]{36}$/);
  await expect.poll(() => selectionItems(page)).toEqual([]);
}

test("home: «В подборку» → open selection → submit", async ({ page }) => {
  await open(page, "/");
  const kits = page.locator("#kits");
  await kits.getByRole("button", { name: "В подборку" }).first().click();
  await expect.poll(async () => (await selectionItems(page)).length).toBe(1);
  await kits.getByRole("button", { name: /^В подборке: .*открыть подборку$/ }).first().click();
  await checkoutFromDrawer(page);
});

test("catalog: «В подборку» → open selection → submit", async ({ page }) => {
  await open(page, "/catalog");
  await page.getByRole("button", { name: /^В подборку: / }).first().click();
  await expect.poll(async () => (await selectionItems(page)).length).toBe(1);
  await page.getByRole("button", { name: /^В подборке: .*открыть подборку$/ }).first().click();
  await checkoutFromDrawer(page);
});

test("product: «В подборку» → open selection → submit", async ({ page }) => {
  await open(page, "/catalog/jac-t9-front-tube?vehicle=jac-t9");
  const main = page.locator(".prd-main");
  await main.getByRole("button", { name: "В подборку", exact: true }).click();
  await expect.poll(async () => (await selectionItems(page)).length).toBe(1);
  await main.getByRole("button", { name: /^В подборке: .*открыть подборку$/ }).click();
  await checkoutFromDrawer(page);
});

test("selection survives a reload, removal can be undone, quantity is kept", async ({ page }) => {
  await open(page, "/catalog");
  await page.getByRole("button", { name: /^В подборку: / }).first().click();
  await page.getByRole("button", { name: /^В подборке: .*открыть подборку$/ }).first().click();
  const d = drawer(page);
  await d.getByRole("button", { name: "Больше" }).click();
  await expect.poll(async () => (await selectionItems(page))[0]?.quantity).toBe(2);

  await page.reload();
  await expect(page.locator("html")).toHaveClass(/is-ready/);
  await expect.poll(async () => (await selectionItems(page))[0]?.quantity).toBe(2);

  await page.locator(".hd__sel").click();
  await d.getByRole("button", { name: /^Удалить из подборки: / }).click();
  await expect.poll(async () => (await selectionItems(page)).length).toBe(0);
  await d.getByRole("button", { name: "Вернуть" }).click();
  await expect.poll(async () => (await selectionItems(page))[0]?.quantity).toBe(2);
});

test("selection drawer: focus moves in, Esc closes, focus returns, page does not scroll", async ({ page }) => {
  await open(page, "/catalog");
  const opener = page.locator(".hd__sel");
  await opener.click();
  const d = drawer(page);
  await expect(d).toBeVisible();
  await expect(d.getByRole("heading", { name: "Ваша подборка" })).toBeFocused();
  await expect(page.locator("html")).toHaveClass(/is-locked/);
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    expect(await d.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(d).toBeHidden();
  await expect(opener).toBeFocused();
  await expect(page.locator("html")).not.toHaveClass(/is-locked/);
});
