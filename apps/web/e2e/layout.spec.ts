import { expect, test } from "@playwright/test";
import { open } from "./helpers";

const ROUTES = ["/", "/catalog", "/catalog/jac-t9-front-tube?vehicle=jac-t9", "/selection", "/faq", "/about", "/contacts", "/privacy", "/login", "/offers", "/news"];

for (const path of ROUTES) {
  test(`type rules on ${path}: Tektur 500 or Golos 400, no text under 13 px`, async ({ page }) => {
    await open(page, path);
    const bad = await page.evaluate(async () => {
      await document.fonts.ready;
      const out: string[] = [];
      if (!document.fonts.check('500 16px "Tektur"')) out.push("Tektur 500 is not loaded");
      if (!document.fonts.check('400 16px "Golos Text"')) out.push("Golos Text 400 is not loaded");
      const rule = (what: string, cs: CSSStyleDeclaration) => {
        const size = parseFloat(cs.fontSize);
        const family = cs.fontFamily.split(",")[0]!.replace(/["']/g, "").trim();
        if (size < 13) out.push(`${what}: ${size}px`);
        if (!["Tektur", "Golos Text"].includes(family)) out.push(`${what}: font ${cs.fontFamily}`);
        else if (family === "Tektur" && cs.fontWeight !== "500") out.push(`${what}: Tektur ${cs.fontWeight}`);
        else if (family === "Golos Text" && cs.fontWeight !== "400") out.push(`${what}: Golos ${cs.fontWeight}`);
      };
      const shown = (el: Element) => {
        if (el.closest(".hp, .vh, script, style, noscript")) return false;
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return !!r.width && !!r.height && cs.visibility !== "hidden" && cs.display !== "none";
      };
      const name = (el: Element, text: string) => `${el.tagName.toLowerCase()}.${[...el.classList].join(".")} «${text.trim().slice(0, 30)}»`;
      const seen = new Set<Element>();
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const el = n.parentElement;
        if (!el || seen.has(el) || !n.textContent?.trim() || el.closest("svg")) continue;
        seen.add(el);
        if (shown(el)) rule(name(el, n.textContent), getComputedStyle(el));
      }
      for (const el of document.body.querySelectorAll("*")) {
        if (!shown(el)) continue;
        for (const pseudo of ["::before", "::after"] as const) {
          const cs = getComputedStyle(el, pseudo);
          const c = cs.content;
          if (c && c !== "none" && c !== "normal" && /^["'].*\S.*["']$/.test(c)) rule(name(el, `${pseudo} ${c}`), cs);
        }
        if ((el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) && el.placeholder) rule(name(el, `placeholder ${el.placeholder}`), getComputedStyle(el, "::placeholder"));
        if ((el instanceof HTMLInputElement && el.value && el.type !== "hidden") || el instanceof HTMLSelectElement) rule(name(el, "value"), getComputedStyle(el));
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
  expect(text).toMatch(/от\s\d[\d\s]*\s₽/);
  expect(text).not.toMatch(/(^|[^\d\s])0\s₽/m);
});
