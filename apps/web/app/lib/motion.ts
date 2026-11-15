let booted = false;

const fmt = (v: number, dec: number) => v.toLocaleString("ru-RU", { minimumFractionDigits: dec, maximumFractionDigits: dec });

const target = (el: HTMLElement) => {
  const raw = el.dataset.count ?? "0", v = parseFloat(raw);
  return { end: Number.isFinite(v) ? v : 0, dec: (raw.split(".")[1] ?? "").length };
};

function countUp(el: HTMLElement, animate: boolean) {
  const first = target(el);
  if (!animate || first.end === 0) { el.textContent = fmt(first.end, first.dec); return; }
  const t0 = performance.now(), dur = 1100;
  const step = (t: number) => {
    const { end, dec } = target(el), k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
    el.textContent = fmt(k < 1 ? Math.round(end * e * 10 ** dec) / 10 ** dec : end, dec);
    if (k < 1) requestAnimationFrame(step);
  };
  el.textContent = fmt(0, first.dec);
  requestAnimationFrame(step);
}

const inView = (el: Element) => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < window.innerHeight; };

export function initMotion(): () => void {
  const root = document.documentElement;
  const off: (() => void)[] = [];
  const live = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let on = false, tick = false;
  const pending = new Set<HTMLElement>();

  const show = (el: HTMLElement) => {
    pending.delete(el);
    if (el.hasAttribute("data-count")) countUp(el, true);
    else {
      el.dataset.shown = "run";
      window.setTimeout(() => { if (el.dataset.shown === "run") el.dataset.shown = ""; }, 1700);
    }
  };
  const check = () => {
    tick = false;
    const edge = window.innerHeight * .92, end = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
    pending.forEach((el) => { if (end || el.getBoundingClientRect().top < edge) show(el); });
  };
  const req = () => { if (!tick && pending.size) { tick = true; requestAnimationFrame(check); } };

  const settle = (first = false) => {
    document.querySelectorAll<HTMLElement>("[data-in]:not([data-shown]):not([data-io])").forEach((el) => {
      if (!on || (first && inView(el))) { el.dataset.shown = ""; return; }
      el.dataset.io = "";
      pending.add(el);
    });
    document.querySelectorAll<HTMLElement>("[data-count]:not([data-counted])").forEach((el) => {
      el.dataset.counted = "";
      if (on) { el.textContent = fmt(0, (el.dataset.count?.split(".")[1] ?? "").length); pending.add(el); }
      else countUp(el, false);
    });
    req();
  };

  const start = () => {
    if (live) {
      on = true;
      root.classList.add("mo");
      window.addEventListener("scroll", req, { passive: true });
      window.addEventListener("resize", req);
      off.push(() => {
        window.removeEventListener("scroll", req);
        window.removeEventListener("resize", req);
        pending.forEach((el) => { if (el.hasAttribute("data-count")) delete el.dataset.counted; else delete el.dataset.io; });
      });
    }
    settle(!booted);
    booted = true;
    const mo = new MutationObserver((ms) => { if (ms.some((m) => !(m.target as Element).closest?.("[data-count]"))) settle(); });
    mo.observe(document.body, { childList: true, subtree: true });
    off.push(() => mo.disconnect());
  };

  const introRunning = !root.classList.contains("no-intro") && !root.classList.contains("intro-done");
  const ready = () => { root.classList.add("is-ready"); root.classList.remove("no-js"); start(); };
  if (introRunning) {
    window.addEventListener("app:ready", ready, { once: true });
    off.push(() => window.removeEventListener("app:ready", ready));
  } else ready();

  return () => off.forEach((f) => f());
}

export function watchHeader(el: HTMLElement): () => void {
  let tick = false;
  const frame = () => { tick = false; el.classList.toggle("is-solid", window.scrollY > 24); };
  const req = () => { if (!tick) { tick = true; requestAnimationFrame(frame); } };
  window.addEventListener("scroll", req, { passive: true });
  frame();
  return () => window.removeEventListener("scroll", req);
}
