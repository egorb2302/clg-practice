/* Page motion, re-run on every route: staggered reveals, counters, the lit sentence,
   the sticky workflow and the rail. Returns a cleanup. Reduced motion: static. */
export function initMotion(): () => void {
  const d = document, root = d.documentElement;
  const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $$ = <T extends Element = HTMLElement>(s: string, c: ParentNode = d) => [...c.querySelectorAll<T & Element>(s)] as T[];
  const off: (() => void)[] = [];
  const on = (t: EventTarget, e: string, f: EventListener, o?: AddEventListenerOptions) => { t.addEventListener(e, f, o); off.push(() => t.removeEventListener(e, f, o)); };

  /* reveals */
  $$("[data-stagger]").forEach((g) => $$<HTMLElement>("[data-in]", g).forEach((el, i) => el.style.setProperty("--i", String(i))));
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -8% 0px" });
  const watch = () => {
    $$("[data-stagger]").forEach((g) => $$<HTMLElement>("[data-in]", g).forEach((el, i) => el.style.setProperty("--i", String(i))));
    $$("[data-in]:not(.is-in)").forEach((el) => io.observe(el));
  };
  watch();
  const mo = new MutationObserver(watch);
  mo.observe(d.body, { childList: true, subtree: true });
  off.push(() => io.disconnect(), () => mo.disconnect());

  /* counters */
  const cio = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    cio.unobserve(e.target);
    const el = e.target as HTMLElement, raw = el.dataset.count ?? "0", end = parseFloat(raw), dec = (raw.split(".")[1] ?? "").length;
    if (calm) return;
    const t0 = performance.now();
    const step = (t: number) => { const k = Math.min(1, (t - t0) / 1600), v = end * (1 - Math.pow(1 - k, 4)); el.textContent = v.toFixed(dec).replace(".", ","); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }), { threshold: 0.5 });
  $$("[data-count]").forEach((el) => cio.observe(el));
  off.push(() => cio.disconnect());

  /* scroll scene */
  const says = $$<HTMLElement>(".say");
  const flows = $$<HTMLElement>(".flow");
  const bar = d.querySelector(".bar");
  let tick = false;
  const frame = () => {
    tick = false;
    const vh = innerHeight;
    bar?.classList.toggle("is-solid", scrollY > 24);
    says.forEach((say) => {
      const parts = $$<HTMLElement>(".w, .say__pic", say);
      const r = say.getBoundingClientRect();
      const k = calm ? 1 : Math.min(1, Math.max(0, (vh * 0.82 - r.top) / (r.height + vh * 0.35)));
      const n = Math.round(k * parts.length);
      parts.forEach((w, i) => w.classList.toggle("is-lit", i < n));
    });
    flows.forEach((f) => {
      const steps = $$<HTMLElement>(".flow__steps li", f), n = steps.length;
      if (!n) return;
      const r = f.getBoundingClientRect(), span = r.height - vh;
      const p = span > 0 ? Math.min(0.9999, Math.max(0, -r.top / span)) : 0;
      const cur = Math.floor(p * n), part = p * n - cur;
      steps.forEach((s, i) => { s.classList.toggle("is-on", i === cur); s.classList.toggle("is-past", i < cur); });
      $$(".flow__img, .panel__bg > img, .flow__thumb img, .flow__desc > div", f).forEach((el) => {
        const i = Number((el as HTMLElement).dataset.i);
        el.classList.toggle("is-on", i === cur);
      });
      $$<HTMLElement>(".flow__bar i", f).forEach((b, i) => b.style.setProperty("--k", i < cur ? "1" : i === cur ? part.toFixed(3) : "0"));
    });
  };
  const req = () => { if (!tick) { tick = true; requestAnimationFrame(frame); } };
  on(window, "scroll", req, { passive: true });
  on(window, "resize", req);
  frame();

  /* rail: arrows only when there is something to scroll to */
  $$<HTMLElement>(".rail").forEach((rail) => {
    const tr = rail.querySelector<HTMLElement>(".rail__track");
    if (!tr) return;
    const prog = rail.querySelector<HTMLElement>(".rail__progress i");
    const prev = rail.querySelector<HTMLButtonElement>(".rail__btn--prev"), next = rail.querySelector<HTMLButtonElement>(".rail__btn--next");
    const upd = () => {
      const max = tr.scrollWidth - tr.clientWidth;
      rail.classList.toggle("is-static", max < 8);
      const k = max > 0 ? tr.scrollLeft / max : 0, w = max > 0 ? tr.clientWidth / tr.scrollWidth : 1;
      if (prog) { prog.style.width = `${w * 100}%`; prog.style.transform = `translateX(${k * (1 / w - 1) * 100}%)`; }
      if (prev) prev.disabled = tr.scrollLeft < 4;
      if (next) next.disabled = tr.scrollLeft > max - 4;
    };
    const go = (dir: number) => { const it = tr.querySelector<HTMLElement>(".rail__item"); tr.scrollBy({ left: dir * (it ? it.offsetWidth + 16 : 400), behavior: calm ? "auto" : "smooth" }); };
    if (prev) on(prev, "click", () => go(-1));
    if (next) on(next, "click", () => go(1));
    on(tr, "scroll", upd, { passive: true });
    on(window, "resize", upd);
    let x0: number | undefined, s0 = 0, moved = false;
    on(tr, "pointerdown", ((e: PointerEvent) => { if (e.pointerType !== "mouse") return; x0 = e.clientX; s0 = tr.scrollLeft; moved = false; }) as EventListener);
    on(tr, "pointermove", ((e: PointerEvent) => { if (x0 === undefined) return; const dx = e.clientX - x0; if (Math.abs(dx) > 4) { moved = true; tr.classList.add("is-drag"); } tr.scrollLeft = s0 - dx; }) as EventListener);
    const end = () => { x0 = undefined; setTimeout(() => tr.classList.remove("is-drag"), 0); };
    on(tr, "pointerup", end);
    on(tr, "pointerleave", end);
    on(tr, "click", ((e: Event) => { if (moved) { e.preventDefault(); moved = false; } }) as EventListener, { capture: true });
    upd();
  });

  root.classList.add("is-ready");
  return () => off.forEach((f) => f());
}
