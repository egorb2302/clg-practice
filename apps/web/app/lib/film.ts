/* Motion for the round 12 blocks (components/film.tsx). Returns a cleanup.
   Reduced motion: no mask growth (the full reel shows), no clips, no parallax, no wave. */
export function initFilm(): () => void {
  const d = document;
  const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const off: (() => void)[] = [];
  const on = (t: EventTarget, e: string, f: EventListener, o?: AddEventListenerOptions) => { t.addEventListener(e, f, o); off.push(() => t.removeEventListener(e, f, o)); };
  const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const smooth = (a: number, b: number, v: number) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };

  const film = d.querySelector<HTMLElement>(".film");
  const frames = d.querySelector<HTMLElement>(".frames");
  const mq = d.querySelector<HTMLElement>(".mq");
  const cases = [...d.querySelectorAll<HTMLElement>(".case")];
  const bento = d.querySelector<HTMLElement>(".bento");
  if (!film && !frames && !mq && !cases.length && !bento) return () => {};

  /* bento 02: the three small tiles open one after another as you reach them and stay open;
     the steel accent sits on the newest. Side by side they open by how far the row has come up
     (01 at 82 %, 02 at 66 %, 03 at 50 % of the screen); stacked, each opens at 72 % */
  const steps = bento ? [...bento.querySelectorAll<HTMLElement>(".bt--step")] : [];
  if (bento && steps.length && !calm) bento.classList.add("is-staged");

  /* hero reel: a new frame every 4.2 s in both layers, the viewfinder clock runs at 25 fps */
  if (film) {
    const reels = [...film.querySelectorAll<HTMLElement>(".film__reel")];
    const n = reels[0]?.children.length ?? 0;
    const frameEl = film.querySelector<HTMLElement>("[data-frame]");
    let cur = 0;
    const id = window.setInterval(() => {
      if (calm || d.hidden || !n) return;
      cur = (cur + 1) % n;
      reels.forEach((r) => [...r.children].forEach((img, i) => img.classList.toggle("is-on", i === cur)));
      if (frameEl) frameEl.textContent = `${String(cur + 1).padStart(2, "0")} / ${String(n).padStart(2, "0")}`;
    }, 4200);
    off.push(() => clearInterval(id));
    const tc = film.querySelector<HTMLElement>("[data-tc]");
    const t0 = performance.now();
    const p2 = (v: number) => String(v).padStart(2, "0");
    const tick = window.setInterval(() => {
      if (!tc) return;
      const f = Math.floor((performance.now() - t0) / 40), s = Math.floor(f / 25);
      tc.textContent = `${p2(Math.floor(s / 3600))}:${p2(Math.floor(s / 60) % 60)}:${p2(s % 60)}:${p2(f % 25)}`;
    }, 40);
    off.push(() => clearInterval(tick));
    film.classList.toggle("is-calm", calm);
  }

  /* frames, after the reference frame by frame: the card under the cursor rises ~52 px, the two
     next to it 22 and 7 px (a keybed), it turns to colour at once and its clip runs from the
     first frame, each stock frame 1.1 s with a camera push; leaving drops it back in 0.25 s */
  const fr = frames ? [...frames.querySelectorAll<HTMLElement>(".fr")] : [];
  const LIFT = [52, 22, 7];
  let hot = -1;
  const lift = () => fr.forEach((c, i) => { const dd = hot < 0 ? 9 : Math.abs(i - hot); c.style.setProperty("--lift", `${-(LIFT[dd] ?? 0)}px`); });
  fr.forEach((card, idx) => {
    const imgs = [...card.querySelectorAll<HTMLElement>(".fr__clip img")];
    let id = 0, k = 0;
    const show = (n: number) => imgs.forEach((im, i) => { im.classList.toggle("is-on", i === n); if (i === n) { im.style.animation = "none"; void im.offsetWidth; im.style.animation = ""; } });
    const play = () => {
      hot = idx; lift();
      card.classList.add("is-hot");
      if (calm || !imgs.length) return;
      card.classList.add("is-play");
      k = 0; show(0);
      clearInterval(id);
      id = window.setInterval(() => { k = (k + 1) % imgs.length; show(k); }, 1100);
    };
    const stop = () => { card.classList.remove("is-play", "is-hot"); clearInterval(id); if (hot === idx) { hot = -1; lift(); } };
    on(card, "pointerenter", ((e: PointerEvent) => { if (e.pointerType !== "touch") play(); }) as EventListener);
    on(card, "pointerleave", stop);
    on(card, "focus", play);
    on(card, "blur", stop);
    off.push(() => clearInterval(id));
  });

  /* makes: hover stops the line, lights the make and wipes its photo in from the right */
  let mqHold = false;
  if (mq) {
    const stage = [...mq.querySelectorAll<HTMLElement>(".mq__stage img")];
    let cur = -1, z = 1;
    const set = (i: number) => {
      if (i === cur) return;
      cur = i;
      mq.classList.toggle("is-hot", i >= 0);
      if (i < 0) { stage.forEach((im) => im.classList.remove("is-on")); return; }
      const im = stage[i]; if (!im) return;
      im.style.zIndex = String(++z);
      im.classList.remove("is-on"); void im.offsetWidth; im.classList.add("is-on");
      mq.querySelectorAll<HTMLElement>(".mq__w").forEach((w) => w.classList.toggle("is-on", Number(w.dataset.i) === i));
    };
    mq.querySelectorAll<HTMLElement>(".mq__w").forEach((w) => {
      on(w, "pointerenter", ((e: PointerEvent) => { if (e.pointerType === "touch") return; mqHold = true; set(Number(w.dataset.i)); }) as EventListener);
      on(w, "focus", () => { mqHold = true; set(Number(w.dataset.i)); });
    });
    const run = mq.querySelector<HTMLElement>(".mq__run");
    if (run) {
      on(run, "pointerleave", () => { mqHold = false; set(-1); mq.querySelectorAll(".mq__w.is-on").forEach((w) => w.classList.remove("is-on")); });
      on(run, "focusout", ((e: FocusEvent) => { if (!run.contains(e.relatedTarget as Node)) { mqHold = false; set(-1); } }) as EventListener);
    }
  }

  /* frames track: drag with the mouse, a progress line under it */
  const track = frames?.querySelector<HTMLElement>(".frames__track");
  const prog = frames?.querySelector<HTMLElement>(".frames__prog i");
  if (track) {
    const upd = () => {
      const max = track.scrollWidth - track.clientWidth, w = max > 0 ? track.clientWidth / track.scrollWidth : 1;
      if (prog) { prog.style.width = `${w * 100}%`; prog.style.transform = `translateX(${(max > 0 ? track.scrollLeft / max : 0) * (1 / w - 1) * 100}%)`; }
    };
    let x0: number | undefined, s0 = 0, moved = false;
    on(track, "pointerdown", ((e: PointerEvent) => { if (e.pointerType !== "mouse") return; x0 = e.clientX; s0 = track.scrollLeft; moved = false; }) as EventListener);
    on(track, "pointermove", ((e: PointerEvent) => { if (x0 === undefined) return; const dx = e.clientX - x0; if (Math.abs(dx) > 4) { moved = true; track.classList.add("is-drag"); } track.scrollLeft = s0 - dx; }) as EventListener);
    const end = () => { x0 = undefined; setTimeout(() => track.classList.remove("is-drag"), 0); };
    on(track, "pointerup", end);
    on(track, "pointerleave", end);
    on(track, "click", ((e: Event) => { if (moved) { e.preventDefault(); moved = false; } }) as EventListener, { capture: true });
    on(track, "scroll", upd, { passive: true });
    on(window, "resize", upd);
    upd();
  }

  /* case cards fade up once */
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -12% 0px" });
  cases.forEach((c) => io.observe(c));
  off.push(() => io.disconnect());

  /* one scroll loop: hero mask, frames in / out and their wave, marquee speed, case parallax */
  let lastY = scrollY, vel = 0, raf = 0, running = true;
  const mqAnim = () => mq?.querySelector<HTMLElement>(".mq__line")?.getAnimations()[0];
  const loop = () => {
    if (!running) return;
    const vh = innerHeight, vw = innerWidth, y = scrollY;
    vel += ((y - lastY) - vel) * 0.18; lastY = y;

    if (film && !calm) {
      const r = film.getBoundingClientRect(), span = Math.max(1, r.height - vh);
      const p = clamp(-r.top / span);
      if (r.bottom > 0 && r.top < vh) {
        const start = Math.min(vw, vh) * 0.46, end = Math.max(vw, vh) * 9;
        const g = Math.pow(smooth(0.04, 0.82, p), 2.4);
        film.style.setProperty("--m", `${(start + (end - start) * g).toFixed(1)}px`);
        film.style.setProperty("--full", smooth(0.36, 0.62, p).toFixed(3));
        film.style.setProperty("--hud", smooth(0.38, 0.62, p).toFixed(3));
        film.style.setProperty("--ring", (1 - smooth(0, 0.22, p)).toFixed(3));
      }
    }

    if (frames) {
      const r = frames.getBoundingClientRect();
      const inView = r.top < vh * 0.82 && r.bottom > vh * 0.38;
      const past = r.bottom <= vh * 0.38;
      frames.classList.toggle("is-in", inView);
      frames.classList.toggle("is-out", past);
    }

    if (bento && steps.length && !calm) {
      const rs = steps.map((t) => t.getBoundingClientRect());
      const row = rs.every((r) => Math.abs(r.top - rs[0]!.top) < 4);
      let last = -1;
      steps.forEach((t, i) => {
        const at = row ? vh * (0.82 - 0.16 * i) : vh * 0.72;
        if (rs[i]!.top < at) t.classList.add("is-open");
        if (t.classList.contains("is-open")) last = i;
      });
      steps.forEach((t, i) => t.classList.toggle("is-cur", i === last));
    }

    if (mq && !calm) {
      const a = mqAnim();
      const want = mqHold ? 0 : 1 + Math.min(5, Math.abs(vel) * 0.12);
      if (a) { a.playbackRate += (want - a.playbackRate) * (mqHold ? 0.16 : 0.08); if (Math.abs(a.playbackRate) < 0.01 && mqHold) a.playbackRate = 0; }
    }

    if (!calm) cases.forEach((c) => {
      const r = c.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) return;
      const k = clamp((r.top + r.height / 2 - vh / 2) / vh, -1, 1);
      c.style.setProperty("--py", `${(k * 120).toFixed(1)}px`);
    });

    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  off.push(() => { running = false; cancelAnimationFrame(raf); });

  return () => off.forEach((f) => f());
}
