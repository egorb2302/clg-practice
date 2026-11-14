export function initMotion(): () => void {
  const d = document, root = d.documentElement;
  const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const off: (() => void)[] = [];
  const $$ = <T extends HTMLElement = HTMLElement>(s: string, c: ParentNode = d) => [...c.querySelectorAll<T>(s)];

  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    e.target.classList.add("is-in");
    io.unobserve(e.target);
  }), { rootMargin: "0px 0px -8% 0px" });
  const cio = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    cio.unobserve(e.target);
    count(e.target as HTMLElement, calm);
  }), { threshold: 0.5 });

  const watch = () => {
    $$("[data-stagger]").forEach((g) => $$("[data-in]", g).forEach((el, i) => el.style.setProperty("--i", String(Math.min(i, 8)))));
    $$("[data-in]:not(.is-in)").forEach((el) => (calm ? el.classList.add("is-in") : io.observe(el)));
    $$("[data-count]:not([data-counted])").forEach((el) => { el.dataset.counted = ""; cio.observe(el); });
  };
  watch();
  const mo = new MutationObserver(watch);
  mo.observe(d.body, { childList: true, subtree: true });
  off.push(() => io.disconnect(), () => cio.disconnect(), () => mo.disconnect());

  if (!calm && matchMedia("(pointer: fine)").matches) {
    const move = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest<HTMLElement>("[data-magnet]");
      if (!el) return;
      const r = el.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width - 0.5) * 6, y = ((e.clientY - r.top) / r.height - 0.5) * 4;
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    };
    const leave = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest<HTMLElement>("[data-magnet]");
      if (el && !el.contains(e.relatedTarget as Node | null)) el.style.transform = "";
    };
    d.addEventListener("pointermove", move, { passive: true });
    d.addEventListener("pointerout", leave, { passive: true });
    off.push(() => { d.removeEventListener("pointermove", move); d.removeEventListener("pointerout", leave); });
  }

  const introRunning = !root.classList.contains("no-intro") && !root.classList.contains("intro-done");
  const ready = () => { root.classList.add("is-ready"); root.classList.remove("no-js"); };
  if (introRunning) {
    window.addEventListener("app:ready", ready);
    off.push(() => window.removeEventListener("app:ready", ready));
  } else ready();

  return () => off.forEach((f) => f());
}

function count(el: HTMLElement, calm: boolean) {
  const raw = el.dataset.count ?? "0", end = parseFloat(raw), dec = (raw.split(".")[1] ?? "").length;
  const fmt = (v: number) => v.toLocaleString("ru-RU", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  if (calm || !Number.isFinite(end)) { el.textContent = fmt(end || 0); return; }
  const t0 = performance.now();
  const step = (t: number) => {
    const k = Math.min(1, (t - t0) / 1400);
    el.textContent = fmt(end * (1 - Math.pow(1 - k, 4)));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export function watchHeader(el: HTMLElement): () => void {
  let tick = false;
  const frame = () => { tick = false; el.classList.toggle("is-solid", window.scrollY > 24); };
  const req = () => { if (!tick) { tick = true; requestAnimationFrame(frame); } };
  window.addEventListener("scroll", req, { passive: true });
  frame();
  return () => window.removeEventListener("scroll", req);
}
