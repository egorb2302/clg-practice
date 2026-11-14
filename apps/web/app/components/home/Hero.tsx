import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Link } from "react-router";
import { Icon, Illustration, Logo } from "../site";
import { plural, priceFrom } from "../../lib/format";
import { useUi } from "../../lib/ui";
import { useVehicle, vehicle, type Vehicle } from "../../lib/vehicle";
import { BRANDS, MODELS } from "../../lib/vehicles-catalog";
import { bodyOf, isCalm, type Kit, minPrice, splitCar } from "./data";

type Slide = { key: string; name: string; sub: string; kit?: Kit };

const pad = (n: number) => String(n).padStart(2, "0");

export function Hero({ kits, onQuiz }: { kits: Kit[]; onQuiz: () => void }) {
  const car = useVehicle();
  const drawer = useUi((s) => s.drawer);
  const slides: Slide[] = [
    ...kits.map((k) => ({ key: k.vehicle.slug, name: k.vehicle.label, sub: "Готовый комплект", kit: k })),
    { key: "custom", name: car?.mode === "custom" ? car.label : "Ваша модель", sub: "Под вашу модель" },
  ];
  const n = slides.length;
  const own = car ? (car.mode === "kit" ? Math.max(0, slides.findIndex((s) => s.key === car.slug)) : n - 1) : -1;
  const [auto, setAuto] = useState(0);
  const [browse, setBrowse] = useState<number | null>(null);
  const [all, setAll] = useState(false);
  const idx = ((browse ?? (own >= 0 ? own : auto)) % n + n) % n;
  const slide = slides[idx]!;

  const root = useRef<HTMLElement>(null);
  const hold = useRef({ hover: false, until: 0, seen: true });
  const live = useRef({ car, drawer, all });
  live.current = { car, drawer, all };

  useEffect(() => { setBrowse(null); }, [car?.label]);

  useEffect(() => {
    if (isCalm()) return;
    const el = root.current;
    const io = el ? new IntersectionObserver(([e]) => { hold.current.seen = !!e?.isIntersecting; }, { threshold: 0.35 }) : null;
    if (el) io?.observe(el);
    const t = window.setInterval(() => {
      const h = hold.current, l = live.current;
      if (l.car || l.drawer || l.all || h.hover || !h.seen || document.hidden || Date.now() < h.until) return;
      setAuto((a) => a + 1);
    }, 5000);
    return () => { window.clearInterval(t); io?.disconnect(); };
  }, []);

  useEffect(() => {
    const el = root.current;
    if (!el || isCalm() || !matchMedia("(pointer: fine)").matches) return;
    let raf = 0, x = 0, y = 0;
    const paint = () => { raf = 0; el.style.setProperty("--mx", x.toFixed(3)); el.style.setProperty("--my", y.toFixed(3)); };
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      x = ((e.clientX - r.left) / r.width - 0.5) * 2;
      y = ((e.clientY - r.top) / r.height - 0.5) * 2;
      if (!raf) raf = requestAnimationFrame(paint);
    };
    const leave = () => { x = 0; y = 0; if (!raf) raf = requestAnimationFrame(paint); };
    el.addEventListener("pointermove", move, { passive: true });
    el.addEventListener("pointerleave", leave);
    return () => { el.removeEventListener("pointermove", move); el.removeEventListener("pointerleave", leave); cancelAnimationFrame(raf); };
  }, []);

  const go = (to: number) => {
    if (!car) { setAuto(to); hold.current.until = Date.now() + 12000; } else setBrowse(to);
  };

  const nameLen = slide.name.length;
  const size = nameLen > 12 ? "s" : nameLen > 8 ? "m" : "l";
  const kitCount = car?.mode === "kit" ? kits.find((k) => k.vehicle.slug === car.slug)?.products ?? [] : [];
  const ctaLabel = car?.mode === "custom" ? `Рассчитать под ${car.label}` : "Оставить заявку";

  return (
    <section
      ref={root}
      className="home-hero"
      aria-label="Стальная защита бампера"
      onPointerEnter={() => { hold.current.hover = true; }}
      onPointerLeave={() => { hold.current.hover = false; }}
    >
      <div className="home-hero__stage white">
        <Logo mark className="home-hero__mark" />
        <div className="home-hero__name" key={`n-${slide.key}-${idx}`} data-size={size}>
          <span className="home-hero__model D">{slide.name}</span>
          <span className="home-hero__sub">{slide.sub}</span>
        </div>
        <div className="home-hero__floor" aria-hidden="true" />
        <div className={`home-hero__car${slide.kit ? "" : " is-sil"}${idx === 0 ? " is-flip" : ""}`} key={`c-${slide.key}-${idx}`}>
          {slide.kit ? (
            <Illustration src="/img/truck-cut.webp" alt={`${slide.name} со стальной защитой бампера`} ratio="2 / 1" sizes="(max-width: 1023px) 100vw, 64vw" eager className="home-hero__img" />
          ) : (
            <Silhouette caption={car?.mode === "custom" ? `${bodyOf(car.label)}, защиту сделаем по месту` : "Выберите марку и модель"} />
          )}
        </div>

        <button type="button" className="home-hero__tab" onClick={() => setAll(true)} aria-expanded={all} aria-controls="home-all">
          <span>Все модели</span>
          <Icon name="chev" size={16} />
        </button>
        <AllModels open={all} kits={kits} onClose={() => setAll(false)} />

        <ul className="home-hero__facts" aria-label="ARMORIX в цифрах">
          <li><b className="D">AISI 304</b>нержавеющая сталь</li>
          <li><b className="D">0</b>отверстий в кузове</li>
          <li><b className="D"><span data-count="2.5">2,5</span> ч</b>установка у нас</li>
        </ul>
        <span className="lift lift--ink home-hero__cta">
          <a href="#quiz" className="btn btn--dark home-cta" data-magnet="" onClick={(e) => { e.preventDefault(); onQuiz(); }}>
            <span className="home-cta__t">{ctaLabel}</span>
            <span className="home-cta__a" aria-hidden="true"><Icon name="arrow" /></span>
          </a>
        </span>
      </div>

      <aside className="home-hero__side dark">
        <div className="home-hero__h1">
          <h1>Стальная защита бампера под вашу машину</h1>
        </div>
        <p className="home-hero__lead">
          Для китайских внедорожников и пикапов: готовые комплекты для {kits.map((k) => k.vehicle.label).join(" и ") || "JAC T9 и Haval H3"}, под другие модели сделаем по месту, ставится без сверления
        </p>
        <Picker kits={kits} car={car} onAll={() => setAll(true)} />
        <p className="home-hero__help" aria-live="polite">
          {car?.mode === "kit"
            ? `Для ${car.label} в каталоге ${kitCount.length} ${plural(kitCount.length, ["позиция", "позиции", "позиций"])}, ${priceFrom(minPrice(kitCount))}`
            : car?.mode === "custom"
              ? `Готового комплекта под ${car.label} пока нет, сделаем по месту: сначала эскиз на согласование`
              : "Покажем комплекты или как сделаем под вашу модель"}
        </p>
        {car?.mode === "kit" ? (
          <Link className="lnk home-hero__lnk" to={`/catalog?vehicle=${encodeURIComponent(car.slug)}`}><span className="lnk__t">Смотреть комплекты для {car.label}</span><span className="ar ol" aria-hidden="true"><Icon name="arrow" /></span></Link>
        ) : car?.mode === "custom" ? (
          <a className="lnk home-hero__lnk" href="#trust"><span className="lnk__t">Как сделаем под {car.label}</span><span className="ar ol" aria-hidden="true"><Icon name="arrow" /></span></a>
        ) : (
          <Link className="lnk home-hero__lnk" to="/catalog"><span className="lnk__t">Смотреть все комплекты</span><span className="ar ol" aria-hidden="true"><Icon name="arrow" /></span></Link>
        )}
        <div className="home-hero__nav">
          <span className="D num">{pad(idx + 1)} / {pad(n)}</span>
          <button type="button" className="ar ol home-sq" onClick={() => go(idx - 1)} aria-label="Предыдущая модель"><Icon name="back" /></button>
          <button type="button" className="ar ol home-sq" onClick={() => go(idx + 1)} aria-label="Следующая модель"><Icon name="arrow" /></button>        </div>
      </aside>
    </section>
  );
}

function pickVehicle(kits: Kit[], brand: string, model: string) {
  const k = kits.find((x) => x.vehicle.make === brand && x.vehicle.model === model);
  if (k) vehicle.set({ mode: "kit", slug: k.vehicle.slug, label: k.vehicle.label });
  else vehicle.set({ mode: "custom", brand, model, label: `${brand} ${model}` });
}

function fromCar(car: Vehicle, kits: Kit[]): { brand: string; model: string; other: string } {
  if (!car) return { brand: "", model: "", other: "" };
  if (car.mode === "kit") {
    const k = kits.find((x) => x.vehicle.slug === car.slug);
    return k ? { brand: k.vehicle.make, model: k.vehicle.model, other: "" } : { brand: "", model: "", other: "" };
  }
  if (MODELS[car.brand]?.some((m) => m.name === car.model)) return { brand: car.brand, model: car.model, other: "" };
  return { brand: "other", model: "", other: car.label };
}

function Picker({ kits, car, onAll }: { kits: Kit[]; car: Vehicle; onAll: () => void }) {
  const [s, setS] = useState(() => fromCar(car, kits));
  useEffect(() => { setS(fromCar(car, kits)); }, [car, kits]);
  const commitOther = (t: string) => {
    const v = t.trim();
    if (v.length < 2 || v === car?.label) return;
    const { make, model } = splitCar(v);
    vehicle.set({ mode: "custom", brand: make, model, label: v });
  };

  return (
    <div className="home-pick ol">
      <p className="home-pick__t"><b>Подобрать под вашу машину</b><small>по желанию</small></p>
      <div className="home-pick__row">
        <div className="fld">
          <label className="home-pick__l" htmlFor="home-brand">Марка</label>
          <select
            id="home-brand"
            className="in"
            value={s.brand}
            onChange={(e) => {
              const b = e.target.value;
              setS({ brand: b, model: "", other: "" });
              if (!b) vehicle.clear();
            }}
          >
            <option value="">Марка</option>
            {BRANDS.map((b) => <option key={b} value={b}>{b}</option>)}
            <option value="other">Другая</option>
          </select>
        </div>
        <div className="fld">
          {s.brand === "other" ? (
            <>
              <label className="home-pick__l" htmlFor="home-other">Марка и модель</label>
              <input
                id="home-other"
                className="in"
                value={s.other}
                placeholder="Lixiang L7"
                autoComplete="off"
                onChange={(e) => setS((o) => ({ ...o, other: e.target.value }))}
                onBlur={(e) => commitOther(e.target.value)}
                onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => { if (e.key === "Enter") commitOther(e.currentTarget.value); }}
              />
            </>
          ) : (
            <>
              <label className="home-pick__l" htmlFor="home-model">Модель</label>
              <select
                id="home-model"
                className="in"
                value={s.model}
                disabled={!s.brand}
                onChange={(e) => {
                  const m = e.target.value;
                  setS((o) => ({ ...o, model: m }));
                  if (m) pickVehicle(kits, s.brand, m);
                  else vehicle.clear();
                }}
              >
                <option value="">Модель</option>
                {(MODELS[s.brand] ?? []).map((m) => <option key={m.name} value={m.name}>{m.name}</option>)}
              </select>
            </>
          )}
        </div>
      </div>
      <div className="home-pick__foot">
        <button type="button" className="flink home-pick__all" onClick={onAll}>Все модели</button>
        {car ? <button type="button" className="flink" onClick={() => vehicle.clear()}>Сбросить выбор</button> : null}
      </div>
    </div>
  );
}

function AllModels({ open, kits, onClose }: { open: boolean; kits: Kit[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const back = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!open) return;
    back.current = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>("h2")?.focus();
    const key = (e: globalThis.KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("keydown", key); back.current?.focus?.(); };
  }, [open, onClose]);
  const kitModel = (b: string, m: string) => kits.some((k) => k.vehicle.make === b && k.vehicle.model === m);
  const pick = (b: string, m: string) => { pickVehicle(kits, b, m); onClose(); };

  return (
    <div ref={ref} id="home-all" className={`home-all${open ? " is-open" : ""}`} role="dialog" aria-modal="false" aria-labelledby="home-all-t" inert={!open}>
      <div className="home-all__top">
        <h2 id="home-all-t" tabIndex={-1}>Все модели</h2>
        <button type="button" className="btn btn--line ol btn--sm" onClick={onClose}>Закрыть</button>
      </div>
      <p className="home-all__note">С рамкой модели с готовым комплектом, под остальные сделаем по месту</p>
      {BRANDS.map((b) => (
        <div key={b} className="home-all__g">
          <span className="home-all__b">{b}</span>
          <div className="home-all__ms">
            {MODELS[b]!.map((m) => (
              <button key={m.name} type="button" className={`home-all__m${kitModel(b, m.name) ? " is-kit" : ""}`} onClick={() => pick(b, m.name)}>
                {b} {m.name}
              </button>
            ))}
          </div>
        </div>
      ))}
      <button
        type="button"
        className="home-all__m home-all__other"
        onClick={() => {
          onClose();
          window.setTimeout(() => {
            const sel = document.getElementById("home-brand") as HTMLSelectElement | null;
            sel?.focus();
          }, 60);
        }}
      >
        Другая марка или модель
      </button>
    </div>
  );
}

function Silhouette({ caption }: { caption: string }) {
  return (
    <figure className="home-sil">
      <svg viewBox="0 0 1000 440" role="img" aria-label="Силуэт машины с защитой бампера">
        <g className="home-sil__body" fill="#fff" stroke="#1c1c1c" strokeWidth="1.4" strokeDasharray="6 5">
          <path d="M70 196 L305 196 L590 186 L690 188 L695 355 L72 330 Z" />
          <path d="M305 196 L312 100 L500 94 L590 186 Z" />
          <path d="M500 94 L640 104 L735 192 L590 186 Z" />
          <path d="M590 186 L735 192 L850 196 L690 188 Z" />
          <path d="M690 188 L850 196 L852 338 L695 355 Z" />
        </g>
        <g fill="none" stroke="#1c1c1c" strokeWidth="1" strokeDasharray="4 4">
          <path d="M322 112 L398 108 L398 182 L322 186 Z" />
          <path d="M410 108 L490 104 L560 180 L410 182 Z" />
          <path d="M712 222 L830 226 L831 284 L713 292 Z" />
        </g>
        <g fill="#fff" stroke="#1c1c1c" strokeWidth="1.4">
          <ellipse cx="205" cy="338" rx="52" ry="58" /><ellipse cx="205" cy="338" rx="22" ry="25" fill="none" />
          <ellipse cx="575" cy="346" rx="58" ry="64" /><ellipse cx="575" cy="346" rx="25" ry="28" fill="none" />
        </g>
        <g className="home-sil__guard" fill="#1c1c1c">
          <path d="M680 292 L870 284 L871 297 L681 306 Z" />
          <path d="M704 340 L862 328 L864 341 L706 354 Z" />
          <path d="M737 222 h6 v78 h-6z M803 224 h6 v72 h-6z" />
        </g>
      </svg>
      <figcaption>{caption}</figcaption>
    </figure>
  );
}
