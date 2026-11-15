import { expect, test } from "@playwright/test";
import { open } from "./helpers";

test.use({ reducedMotion: "no-preference" });

const hidden = (page: import("@playwright/test").Page) =>
  page.evaluate(() => [...document.querySelectorAll<HTMLElement>("[data-in]")].filter((el) => getComputedStyle(el).opacity === "0").length);

test("an opened FAQ item stays visible after its reveal", async ({ page }) => {
  await open(page, "/");
  await expect(page.locator("html")).toHaveClass(/\bmo\b/);
  const item = page.locator(".home-faq__q").nth(1);
  await item.scrollIntoViewIfNeeded();
  await expect.poll(() => item.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
  await item.getByRole("button").click();
  await expect(item).toHaveClass(/is-open/);
  await page.waitForTimeout(400);
  expect(await item.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
});

test("a fast jump to the bottom leaves no block hidden and counters reach their values", async ({ page }) => {
  await open(page, "/");
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect.poll(() => hidden(page)).toBe(0);
  await expect.poll(() => page.evaluate(() => [...document.querySelectorAll<HTMLElement>("[data-count]")].every((el) => el.textContent === Number(el.dataset.count).toLocaleString("ru-RU")))).toBe(true);
});

test("after a catalog filter change nothing stays hidden", async ({ page }) => {
  await open(page, "/catalog");
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect.poll(() => hidden(page)).toBe(0);
  await page.goto("/catalog?vehicle=jac-t9");
  await expect(page.locator("html")).toHaveClass(/is-ready/);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect.poll(() => hidden(page)).toBe(0);
});
