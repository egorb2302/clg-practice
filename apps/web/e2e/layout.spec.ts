import { expect, test } from "@playwright/test";
import { open } from "./helpers";

const ROUTES = ["/", "/catalog", "/catalog/jac-t9-front-tube?vehicle=jac-t9", "/selection", "/faq", "/about", "/contacts", "/privacy", "/login", "/offers", "/news"];

for (const path of ROUTES) {
  test(`type rules on ${path}: Tektur 500 or Golos 400, no text under 13 px`, async ({ page }) => {
    await open(page, path);
    const bad = await page.evaluate(() => {
      const out: string[] = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const seen = new Set<Element>();
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const el = n.parentElement;
        if (!el || seen.has(el) || !n.textContent?.trim()) continue;
        seen.add(el);
        if (el.closest("[aria-hidden='true'], .hp, .vh, script, style, noscript, svg")) continue;
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === "hidden" || cs.display === "none") continue;
        const size = parseFloat(cs.fontSize);
        const family = cs.fontFamily.split(",")[0]!.replace(/["']/g, "").trim();
        const weight = cs.fontWeight;
        const what = `${el.tagName.toLowerCase()}.${[...el.classList].join(".")} «${n.textContent.trim().slice(0, 30)}»`;
        if (size < 13) out.push(`${what}: ${size}px`);
        if (!["Tektur", "Golos Text"].includes(family)) out.push(`${what}: font ${cs.fontFamily}`);
        else if (family === "Tektur" && weight !== "500") out.push(`${what}: Tektur ${weight}`);
        else if (family === "Golos Text" && weight !== "400") out.push(`${what}: Golos ${weight}`);
      }
      return out;
    });
    expect(bad).toEqual([]);
  });
}

test.describe("phone width", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("bottom bar: call and selection, no horizontal scroll", async ({ page }) => {
    await open(page, "/");
    const bar = page.getByRole("navigation", { name: "Быстрые действия" });
    await expect(bar).toBeVisible();
    await expect(bar.getByRole("link", { name: "Позвонить" })).toHaveAttribute("href", /^tel:\+7\d{10}$/);
    await expect(bar.getByRole("button", { name: /Подборка/ })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});

test("header shows «Кабинет», «Акции», «Новости» by /meta flags", async ({ page }) => {
  const meta = await (await page.request.get("/api/v1/meta")).json() as { features: Record<string, boolean> };
  await open(page, "/");
  const header = page.locator("header").first();
  for (const [flag, label] of [["account", "Кабинет"], ["offers", "Акции"], ["news", "Новости"]] as const) {
    await expect(header.getByRole("link", { name: label, exact: true })).toHaveCount(meta.features[flag] ? 1 : 0);
  }
});

test("prices: «от … ₽» or «Уточнить цену», never «0 ₽»", async ({ page }) => {
  await open(page, "/catalog");
  const text = await page.locator("main").innerText();
  expect(text).toMatch(/от \d[\d\s]* ₽/);
  expect(text).not.toMatch(/(^|[^\d\s])0 ₽/m);
});
