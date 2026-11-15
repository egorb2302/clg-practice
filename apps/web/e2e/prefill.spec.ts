import { expect, test, type Page } from "@playwright/test";
import { drawer, mockLeads, open, selectionItems } from "./helpers";

test("car chosen in the hero is already in the quiz when the visitor scrolls down to it", async ({ page }) => {
  await open(page, "/");
  await page.locator("#home-brand").selectOption("JAC");
  await page.locator("#home-model").selectOption("T9");
  const quiz = page.locator("#quiz");
  await quiz.scrollIntoViewIfNeeded();
  await expect(quiz.getByRole("heading", { name: "Что защищаем?" })).toBeVisible();
  await expect(quiz.locator(".home-quiz__step")).toHaveText(/Шаг\s2\sиз\s4/);
  await quiz.getByRole("button", { name: "Назад" }).click();
  await expect(quiz.getByRole("radio", { name: /JAC T9/ })).toHaveAttribute("aria-checked", "true");

  await page.locator("#home-brand").selectOption("Haval");
  await page.locator("#home-model").selectOption("H3");
  await expect(quiz.getByRole("heading", { name: "Что защищаем?" })).toBeVisible();
  await quiz.getByRole("button", { name: "Назад" }).click();
  await expect(quiz.getByRole("radio", { name: /Haval H3/ })).toHaveAttribute("aria-checked", "true");
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
  await quiz.getByRole("button", { name: "Далее" }).click();
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
  await qform.getByRole("button", { name: "Проверить заявку" }).click();
  await quiz.getByRole("button", { name: "Жду звонка" }).click();
  await expect(quiz.getByRole("heading", { name: "Заявка AX-E2E001 принята" })).toBeVisible();
  const body = sent[0]!.body as { name: string; contact: { phone: string } };
  expect(body.name).toBe("Тест Тестов");
  expect(body.contact.phone).toBe("+79001234567");
});

test("contacts page shows the reviews block", async ({ page }) => {
  await open(page, "/contacts");
  await expect(page.getByRole("heading", { name: "Отзывы" })).toBeVisible();
  await expect(page.locator(".cnt-rev")).toHaveCount(3);
});

const seed = (page: Page, v: Record<string, unknown>) =>
  page.addInitScript((s) => { sessionStorage.setItem("armorix.contact.v1", s); }, JSON.stringify(v));

test("typography binds short words without hydration errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  for (const path of ["/", "/about", "/catalog", "/contacts", "/news", "/offers"]) {
    await open(page, path);
    await page.waitForTimeout(1500);
  }
  await open(page, "/about");
  await expect.poll(() => page.locator(".abt-story__t p").first().evaluate((p) => p.textContent?.includes(" ") ?? false)).toBe(true);
  expect(errors.filter((e) => /hydrat|did not match/i.test(e))).toEqual([]);
});

test("a saved contact fills the form after hydration without errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await seed(page, { name: "Тест Тестов", pref: "phone", phone: "+7 (900) 123-45-67", email: "", owner: null });
  await open(page, "/contacts");
  const form = page.locator("#contact-form form.lf");
  await expect(form.getByLabel("Имя")).toHaveValue("Тест Тестов");
  await expect(form.getByLabel("Телефон")).toHaveValue("+7 (900) 123-45-67");
  expect(errors.filter((e) => /hydrat/i.test(e))).toEqual([]);
});

test("without a saved contact the forms start empty", async ({ page }) => {
  await seed(page, { name: "", pref: "phone", phone: "", email: "", owner: null });
  await open(page, "/contacts");
  const form = page.locator("#contact-form form.lf");
  await expect(form.getByLabel("Имя")).toHaveValue("");
  await expect(form.getByLabel("Телефон")).toHaveValue("");
});

test("a form already on the page follows the phone typed in the callback field", async ({ page }) => {
  await open(page, "/contacts");
  const form = page.locator("#contact-form form.lf");
  await page.getByRole("button", { name: "Связаться с нами" }).click();
  const cb = page.getByRole("dialog", { name: "Связаться" }).getByLabel("Или оставьте телефон, перезвоним сами");
  await cb.click();
  await cb.pressSequentially("9001234567");
  await page.keyboard.press("Escape");
  await expect(form.getByLabel("Телефон")).toHaveValue("+7 (900) 123-45-67");
  await form.getByLabel("Телефон").fill("");
  await form.getByLabel("Телефон").pressSequentially("9007654321");
  await page.getByRole("button", { name: "Связаться с нами" }).click();
  await expect(cb).toHaveValue("+7 (900) 765-43-21");
});

test("a prefilled form sent at once still reports a human fill time", async ({ page }) => {
  const sent = await mockLeads(page);
  await seed(page, { name: "Тест Тестов", pref: "phone", phone: "+7 (900) 123-45-67", email: "", owner: null });
  await open(page, "/catalog");
  await page.getByRole("button", { name: /^В подборку: / }).first().click();
  await page.locator(".hd__sel").click();
  await drawer(page).getByRole("link", { name: "Оформить заявку" }).click();
  const form = page.locator("form.lf").first();
  await expect(form.getByLabel("Телефон")).toHaveValue("+7 (900) 123-45-67");
  await form.locator("button[type=submit]").click();
  await expect(page.getByRole("heading", { name: "Заявка AX-E2E001 принята" }).first()).toBeVisible();
  expect((sent[0]!.body as { fillMs: number }).fillMs).toBeGreaterThanOrEqual(3000);
});

test("the callback sent at once with a saved phone still reports a human fill time", async ({ page }) => {
  const sent = await mockLeads(page);
  await seed(page, { name: "", pref: "phone", phone: "+7 (900) 123-45-67", email: "", owner: null });
  await open(page, "/");
  await page.getByRole("button", { name: "Связаться с нами" }).click();
  const panel = page.getByRole("dialog", { name: "Связаться" });
  await panel.getByRole("button", { name: "Перезвоните мне" }).click();
  await expect(panel.getByText("Заявка AX-E2E001 принята")).toBeVisible();
  expect((sent[0]!.body as { fillMs: number }).fillMs).toBeGreaterThanOrEqual(3000);
});

test("changing the car resets the later quiz answers; clearing it starts over", async ({ page }) => {
  await open(page, "/");
  await page.locator("#home-brand").selectOption("JAC");
  await page.locator("#home-model").selectOption("T9");
  const quiz = page.locator("#quiz");
  await quiz.scrollIntoViewIfNeeded();
  await quiz.getByRole("radio").first().click();
  await quiz.getByRole("button", { name: "Далее" }).click();
  await expect(quiz.getByRole("heading", { name: "Какое покрытие?" })).toBeVisible();

  await page.locator("#home-brand").selectOption("Haval");
  await page.locator("#home-model").selectOption("H3");
  await expect(quiz.getByRole("heading", { name: "Что защищаем?" })).toBeVisible();
  await expect(quiz.getByRole("radio", { checked: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Сбросить выбор" }).click();
  await expect(quiz.getByRole("heading", { name: "Какая у вас машина?" })).toBeVisible();
});
