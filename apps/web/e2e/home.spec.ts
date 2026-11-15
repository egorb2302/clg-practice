import { expect, test } from "@playwright/test";
import { CAR_KEY, drawer, fillContact, mockLeads, open, selectionItems, stored } from "./helpers";

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
  await expect(quiz.getByRole("heading", { name: "Какая у вас машина?" })).toBeVisible();
  await quiz.getByRole("button", { name: /Оформить подборку/ }).click();
  await expect(quiz.getByRole("heading", { name: "Как с вами связаться?" })).toBeVisible();
  await expect(quiz.locator(".home-quiz__step")).toHaveText("Контакты");
  const form = await fillContact(page, quiz.locator("form.lf"));
  await form.locator("label.rdo", { hasText: "Самовывоз" }).click();
  await form.getByRole("button", { name: "Проверить заявку" }).click();
  await expect(quiz.getByRole("heading", { name: "Проверьте заявку" })).toBeVisible();
  await expect(quiz.locator(".lf__sum")).toContainText("Связь");
  expect(sent).toHaveLength(0);
  await quiz.getByRole("button", { name: "Жду звонка" }).click();
  await expect(quiz.getByRole("heading", { name: "Заявка AX-E2E001 принята" })).toBeVisible();
  expect((sent[0]!.body as { deliveryMethod: string }).deliveryMethod).toBe("pickup");
  const body = sent[0]!.body as { items: { variantId: string }[] };
  expect(body.items.map((i) => i.variantId)).toEqual([item!.variantId]);
});

test("quiz review step: a server failure keeps the answers and offers a retry", async ({ page }) => {
  await mockLeads(page, () => ({ status: 503, json: {} }));
  await open(page, "/");
  await page.locator("#kits").getByRole("button", { name: "В подборку" }).first().click();
  await page.locator(".home-hero__cta a").click();
  const quiz = page.locator("#quiz");
  await quiz.getByRole("button", { name: /Оформить подборку/ }).click();
  const form = await fillContact(page, quiz.locator("form.lf"));
  await form.locator("label.rdo", { hasText: "Самовывоз" }).click();
  await form.getByRole("button", { name: "Проверить заявку" }).click();
  await quiz.getByRole("button", { name: "Жду звонка" }).click();
  await expect(quiz.getByRole("alert")).toContainText("Не получилось отправить");
  await expect(quiz.getByRole("button", { name: "Отправить еще раз" })).toBeVisible();
  await quiz.getByRole("button", { name: "Назад" }).click();
  await expect(quiz.getByRole("heading", { name: "Как с вами связаться?" })).toBeVisible();
});

test("quiz without a selection starts from the chosen car", async ({ page }) => {
  await open(page, "/");
  await page.locator("#home-brand").selectOption("JAC");
  await page.locator("#home-model").selectOption("T9");
  await page.locator(".home-hero__cta a").click();
  const quiz = page.locator("#quiz");
  await expect(quiz.getByRole("heading", { name: "Какая у вас машина?" })).toBeVisible();
  await expect(quiz.getByRole("radio", { name: /JAC T9/ })).toHaveAttribute("aria-checked", "true");
  await quiz.getByRole("button", { name: "Далее" }).click();
  await expect(quiz.getByRole("heading", { name: "Что защищаем?" })).toBeVisible();
});

test("the quiz always opens on the car question, even with a saved car and selection", async ({ page }) => {
  await open(page, "/");
  await page.locator("#kits").getByRole("button", { name: "В подборку" }).first().click();
  await page.locator("#home-brand").selectOption("Haval");
  await page.locator("#home-model").selectOption("H3");
  await page.reload();
  await page.waitForSelector("html.is-ready");
  const quiz = page.locator("#quiz");
  await quiz.scrollIntoViewIfNeeded();
  await expect(quiz.getByRole("button", { name: /Оформить подборку \(1\)/ })).toBeVisible();
  await expect(quiz.getByRole("radio", { name: /Haval H3/ })).toHaveAttribute("aria-checked", "true");
  await expect(quiz.getByRole("heading", { name: "Какая у вас машина?" })).toBeVisible();
  await expect(quiz.locator(".home-quiz__step")).toHaveText(/Шаг\s1\sиз\s4/);

  await quiz.getByRole("button", { name: /Оформить подборку/ }).click();
  await expect(quiz.getByRole("heading", { name: "Как с вами связаться?" })).toBeVisible();
  await page.locator(".hd__sel").click();
  await drawer(page).getByRole("button", { name: /Удалить/ }).first().click();
  await page.keyboard.press("Escape");
  await expect.poll(async () => (await selectionItems(page)).length).toBe(0);
  await page.locator("#kits").getByRole("button", { name: "В подборку" }).first().click();
  await quiz.scrollIntoViewIfNeeded();
  await expect(quiz.getByRole("heading", { name: "Какая у вас машина?" })).toBeVisible();
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
