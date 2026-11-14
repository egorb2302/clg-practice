import { type PointerEvent as RPointerEvent, useRef, useState } from "react";
import { Icon, Illustration, VkMark } from "../site";
import { telegramLink } from "../../lib/format";
import { useSite, vkLink } from "../../lib/site";
import type { Vehicle } from "../../lib/vehicle";
import { bodyOf, WORKS } from "./data";

type Work = { car: string; what: string; img: string; note?: string };

const pad = (n: number) => String(n).padStart(2, "0");

export function Works({ car, onQuiz }: { car: Vehicle; onQuiz: () => void }) {
  const { meta } = useSite();
  let items: Work[];
  if (car?.mode === "kit") items = [{ car: car.label, what: "Готовый комплект, установка у нас", note: "ваша модель", img: "/img/truck.webp" }, ...WORKS];
  else if (car?.mode === "custom") {
    const body = bodyOf(car.label);
    const rest = WORKS.filter((w) => w.car !== car.label);
    items = [...rest.filter((w) => w.body === body).map((w) => ({ ...w, note: `похожий кузов: ${body}` })), ...rest.filter((w) => w.body !== body)];
  } else items = WORKS;
  const n = items.length;

  const [cur, setCur] = useState(0);
  const at = Math.min(cur, n - 1);
  const [dx, setDx] = useState(0);
  const [drag, setDrag] = useState(false);
  const d = useRef({ x0: 0, t0: 0, id: -1, moved: false });
  const stage = useRef<HTMLDivElement>(null);

  const go = (to: number) => setCur(((to % n) + n) % n);

  const down = (e: RPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    d.current = { x0: e.clientX, t0: performance.now(), id: e.pointerId, moved: false };
    setDrag(true);
  };
  const move = (e: RPointerEvent<HTMLDivElement>) => {
    if (!drag || e.pointerId !== d.current.id) return;
    let v = e.clientX - d.current.x0;
    if (Math.abs(v) > 6 && !d.current.moved) { d.current.moved = true; e.currentTarget.setPointerCapture(e.pointerId); }
    if ((at === 0 && v > 0) || (at === n - 1 && v < 0)) v *= 0.35;
    setDx(v);
  };
  const up = (e: RPointerEvent<HTMLDivElement>) => {
    if (!drag || e.pointerId !== d.current.id) return;
    const w = stage.current?.querySelector<HTMLElement>(".home-works__slide")?.offsetWidth ?? 800;
    const v = dx / Math.max(1, performance.now() - d.current.t0);
    if ((dx < -w * 0.18 || v < -0.6) && at < n - 1) go(at + 1);
    else if ((dx > w * 0.18 || v > 0.6) && at > 0) go(at - 1);
    setDx(0);
    setDrag(false);
  };

  const tg = meta.contacts.telegram ? telegramLink(meta.contacts.telegram) : null;
  const vk = vkLink(meta.contacts.vk);
  const head = car?.mode === "kit" ? ["Уже стоит", `на ${car.label}`, "и не только"] : ["Уже сделали", car?.mode === "custom" ? "под похожие модели" : "под другие модели"];
  const prev = items[(at - 1 + n) % n]!;
  const next = items[(at + 1) % n]!;

  return (
    <section id="works" className="home-works" aria-labelledby="home-works-t">
      <div className="home-works__honey" aria-hidden="true" />

      <div
        ref={stage}
        className={`home-works__stage${drag ? " is-drag" : ""}`}
        role="group"
        aria-roledescription="карусель"
        aria-label="Работы"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") { e.preventDefault(); go(at + 1); }
          if (e.key === "ArrowLeft") { e.preventDefault(); go(at - 1); }
        }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      >
        <div className="home-works__track" style={{ transform: `translate3d(calc(${-(at + 0.5)} * var(--sw) + ${dx}px), 0, 0)` }}>
          {items.map((w, i) => (
            <figure
              key={w.car}
              className={`home-works__slide${i === at ? " is-on" : ""}`}
              aria-hidden={i !== at}
              onClick={() => { if (!d.current.moved && i !== at) go(i); }}
            >
              <div className="home-works__cap">
                <b className="D">{w.car}</b>
                <span>{w.what}</span>
                {w.note ? <em>{w.note}</em> : null}
              </div>
              <Illustration src={w.img} alt={`${w.car}: ${w.what.toLowerCase()}`} ratio="2 / 1" sizes="(max-width: 767px) 86vw, 1000px" dark className="home-works__img" />
            </figure>
          ))}
        </div>
      </div>

      <div className="home-works__plate home-works__plate--l">
        <button type="button" className="home-works__go" onClick={() => go(at - 1)} aria-label={`Назад: ${prev.car}`}>
          <span className="ar ol" aria-hidden="true"><Icon name="back" /></span>Назад
        </button>
        <div className="home-works__thumb cut" key={`p-${prev.car}`}><Illustration src={prev.img} alt="" ratio="1 / 1" thumb dark label={false} /><span>{prev.car}</span></div>
      </div>
      <div className="home-works__plate home-works__plate--r">
        <div className="home-works__thumb cut" key={`n-${next.car}`}><Illustration src={next.img} alt="" ratio="1 / 1" thumb dark label={false} /><span>{next.car}</span></div>
        <button type="button" className="home-works__go" onClick={() => go(at + 1)} aria-label={`Вперед: ${next.car}`}>
          Вперед<span className="ar ol" aria-hidden="true"><Icon name="arrow" /></span>
        </button>
      </div>

      <h2 id="home-works-t" className="home-works__t" data-in="">{head.map((h, i) => <span key={h}>{i ? <br /> : null}{h}</span>)}</h2>

      <div className="home-works__dots" aria-label="Работы по номерам">
        {items.map((w, i) => (
          <button key={w.car} type="button" className={i === at ? "is-on" : ""} aria-current={i === at ? "true" : undefined} aria-label={`Работа ${i + 1}: ${w.car}`} onClick={() => go(i)}>
            <span className="D num">{pad(i + 1)}</span><i aria-hidden="true" />
          </button>
        ))}
      </div>

      <div className="home-works__end">
        <span className="lift">
          <a href="#quiz" className="btn btn--white home-cta" data-magnet="" onClick={(e) => { e.preventDefault(); onQuiz(); }}>
            <span className="home-cta__t">{car ? `Хочу такую же на ${car.label}` : "Хочу такую же на свою"}</span>
            <span className="home-cta__a" aria-hidden="true"><Icon name="arrow" /></span>
          </a>
        </span>
        {vk || tg ? (
          <div className="home-works__soc">
            {vk ? <a href={vk.href} target="_blank" rel="noopener noreferrer"><span className="ar ol" aria-hidden="true"><VkMark /></span>ВКонтакте</a> : null}
            {tg ? <a href={tg.href} target="_blank" rel="noopener noreferrer"><span className="ar ol" aria-hidden="true"><Icon name="telegram" /></span>Telegram</a> : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
