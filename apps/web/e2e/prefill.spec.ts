import { expect, test } from "@playwright/test";
import { drawer, mockLeads, open, selectionItems } from "./helpers";

test("car chosen in the hero is already in the quiz when the visitor scrolls down to it", async ({ page }) => {
  await open(page, "/");
  await page.locator("#home-brand").selectOption("JAC");
  await page.locator("#home-model").selectOption("T9");
  const quiz = page.locator("#quiz");
  await quiz.scrollIntoViewIfNeeded();
  await expect(quiz.getByRole("heading", { name: "Что защищаем?" })).toBeVisible();
  await expect(quiz.locator(".home-quiz__sum")).toContainText("JAC T9");
  await expect(quiz.locator(".home-quiz__step")).toHaveText("Шаг 2 из 4");

  await page.locator("#home-brand").selectOption("Haval");
  await page.locator("#home-model").selectOption("H3");
  await expect(quiz.getByRole("heading", { name: "Что защищаем?" })).toBeVisible();
  await expect(quiz.locator(".home-quiz__sum")).toContainText("Haval H3");
});

test("a custom car from the hero fills make and model in the order form", async ({ page }) => {
  await open(page, "/");
  await page.locator("#home-brand").selectOption("Tank");
  await page.locator("#home-model").selectOption("300");
  const quiz = page.locator("#quiz");
  await quiz.scrollIntoViewIfNeeded();
  await expect(quiz.getByRole("heading", { name: "Что защищаем?" })).toBeVisible();
  await quiz.getByRole("radio", { name: /Передняя защита/ }).click();
  await quiz.getByRole("button", { name: "Далее" }).click();
  await quiz.getByRole("radio", { name: /Черная порошковая/ }).click();
  await quiz.getByRole("button", { name: "К контактам" }).click();
  const form = quiz.locator("form.lf");
  await expect(form.getByLabel("Марка")).toHaveValue("Tank");
  await expect(form.getByLabel("Модель")).toHaveValue("300");
  await expect(form.getByLabel("Что изготовить")).toHaveValue("Передняя защита, черная порошковая");
});

test("contacts typed once are filled in every later form", async ({ page }) => {
  const sent = await mockLeads(page);
  await open(page, "/catalog");
  await page.getByRole("button", { name: "Связаться с нами" }).click();
  const panel = page.getByRole("dialog", { name: "Связаться" });
  const cb = panel.getByLabel("Или оставьте телефон, перезвоним сами");
  await cb.click();
  await cb.pressSequentially("9001234567");
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: /^В подборку: / }).first().click();
  await expect.poll(async () => (await selectionItems(page)).length).toBe(1);
  await page.locator(".hd__sel").click();
  await drawer(page).getByRole("link", { name: "Оформить заявку" }).click();
  await expect(page).toHaveURL(/\/selection$/);
  const form = page.locator("form.lf").first();
  await expect(form.getByLabel("Телефон")).toHaveValue("+7 (900) 123-45-67");
  await form.getByLabel("Имя").fill("Тест Тестов");

  await open(page, "/");
  const quiz = page.locator("#quiz");
  await quiz.scrollIntoViewIfNeeded();
  const qform = quiz.locator("form.lf");
  await expect(qform.getByLabel("Имя")).toHaveValue("Тест Тестов");
  await expect(qform.getByLabel("Телефон")).toHaveValue("+7 (900) 123-45-67");
  await qform.locator("label.rdo", { hasText: "Самовывоз" }).click();
  await qform.locator("button[type=submit]").click();
  await expect(quiz.getByRole("heading", { name: "Заявка AX-E2E001 принята" })).toBeVisible();
  const body = sent[0]!.body as { name: string; contact: { phone: string } };
  expect(body.name).toBe("Тест Тестов");
  expect(body.contact.phone).toBe("+79001234567");
});

test("contacts page shows the workshop and the reviews block", async ({ page }) => {
  await open(page, "/contacts");
  await expect(page.getByRole("heading", { name: "Отзывы" })).toBeVisible();
  await expect(page.locator(".cnt-rev")).toHaveCount(3);
});

test("fresh visitor: forms start empty", async ({ page }) => {
  await open(page, "/contacts");
  const form = page.locator("#contact-form form.lf");
  await expect(form.getByLabel("Имя")).toHaveValue("");
  await expect(form.getByLabel("Телефон")).toHaveValue("");
});
