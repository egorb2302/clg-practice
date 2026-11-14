import { expect, test } from "@playwright/test";
import { CAR_KEY, fillContact, mockLeads, open, selectionItems, stored } from "./helpers";

test("hero arrows only browse: no car is chosen until the picker", async ({ page }) => {
  await open(page, "/");
  await page.getByRole("button", { name: "Следующая модель" }).click();
  await page.getByRole("button", { name: "Следующая модель" }).click();
  expect(await stored(page, CAR_KEY, "sessionStorage")).toBeNull();
  await expect(page.locator(".hd__car")).toHaveCount(0);

  await page.locator("#home-brand").selectOption("JAC");
  await page.locator("#home-model").selectOption("T9");
  await expect.poll(() => stored<{ label: string }>(page, CAR_KEY, "sessionStorage")).toMatchObject({ label: "JAC T9" });
  await expect(page.locator(".hd__car")).toContainText("JAC T9");

  await page.goto("/catalog");
  await expect(page.locator("html")).toHaveClass(/is-ready/);
  await expect(page.locator(".hd__car")).toContainText("JAC T9");
});

test("hero CTA with a full selection opens the quiz with that selection", async ({ page }) => {
  const sent = await mockLeads(page);
  await open(page, "/");
  await page.locator("#kits").getByRole("button", { name: "В подборку" }).first().click();
  await expect.poll(async () => (await selectionItems(page)).length).toBe(1);
  const [item] = await selectionItems(page);

  await page.locator(".home-hero__cta a").click();
  const quiz = page.locator("#quiz");
  await expect(quiz.getByRole("button", { name: "Отправить подборку (1)" })).toBeVisible();
  const form = await fillContact(page, quiz.locator("form.lf"));
  await form.locator("label.rdo", { hasText: "Самовывоз" }).click();
  await form.getByRole("button", { name: "Отправить подборку (1)" }).click();
  await expect(quiz.getByRole("heading", { name: "Заявка AX-E2E001 принята" })).toBeVisible();
  expect((sent[0]!.body as { deliveryMethod: string }).deliveryMethod).toBe("pickup");
  const body = sent[0]!.body as { items: { variantId: string }[] };
  expect(body.items.map((i) => i.variantId)).toEqual([item!.variantId]);
});

test("quiz without a selection starts from the chosen car", async ({ page }) => {
  await open(page, "/");
  await page.locator("#home-brand").selectOption("JAC");
  await page.locator("#home-model").selectOption("T9");
  await page.locator(".home-hero__cta a").click();
  await expect(page.locator("#quiz").getByRole("heading", { name: "Что защищаем?" })).toBeVisible();
});

test("«Перезвоните мне» sends one lead with the car and the selection", async ({ page }) => {
  const sent = await mockLeads(page);
  await open(page, "/");
  await page.locator("#home-brand").selectOption("JAC");
  await page.locator("#home-model").selectOption("T9");
  await page.locator("#kits").getByRole("button", { name: "В подборку" }).first().click();
  await expect.poll(async () => (await selectionItems(page)).length).toBe(1);

  await page.getByRole("button", { name: "Связаться с нами" }).click();
  const panel = page.getByRole("dialog", { name: "Связаться" });
  await expect(panel).toBeVisible();
  const phone = panel.getByLabel("Или оставьте телефон, перезвоним сами");
  await phone.click();
  await phone.pressSequentially("9001234567");
  await panel.getByRole("button", { name: "Перезвоните мне" }).click();
  await expect(panel.getByText("Заявка AX-E2E001 принята")).toBeVisible();

  expect(sent).toHaveLength(1);
  const body = sent[0]!.body as { message: string; contact: { phone: string } };
  expect(body.contact.phone).toBe("+79001234567");
  expect(body.message).toContain("Машина: JAC T9");
  expect(body.message).toContain("Подборка:");

  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await expect(page.getByRole("button", { name: "Связаться с нами" })).toBeFocused();
});
