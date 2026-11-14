export function initMotion(): () => void {
  const root = document.documentElement;
  const off: (() => void)[] = [];
  const settle = () => {
    document.querySelectorAll<HTMLElement>("[data-in]:not(.is-in)").forEach((el) => el.classList.add("is-in"));
    document.querySelectorAll<HTMLElement>("[data-count]:not([data-counted])").forEach((el) => {
      el.dataset.counted = "";
      const raw = el.dataset.count ?? "0", end = parseFloat(raw), dec = (raw.split(".")[1] ?? "").length;
      el.textContent = (Number.isFinite(end) ? end : 0).toLocaleString("ru-RU", { minimumFractionDigits: dec, maximumFractionDigits: dec });
    });
  };
  settle();
  const mo = new MutationObserver(settle);
  mo.observe(document.body, { childList: true, subtree: true });
  off.push(() => mo.disconnect());

  const introRunning = !root.classList.contains("no-intro") && !root.classList.contains("intro-done");
  const ready = () => { root.classList.add("is-ready"); root.classList.remove("no-js"); };
  if (introRunning) {
    window.addEventListener("app:ready", ready);
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
