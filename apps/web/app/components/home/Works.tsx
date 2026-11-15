import { useState } from "react";
import { Icon, Illustration, VkMark } from "../site";
import { telegramLink } from "../../lib/format";
import { useSite, vkLink } from "../../lib/site";
import type { Vehicle } from "../../lib/vehicle";
import { bodyOf, WORKS } from "./data";
import { Truck } from "./Truck";
import { workPhoto } from "../../lib/photos";

type Work = { car: string; what: string; note?: string };

const pad = (n: number) => String(n).padStart(2, "0");

export function Works({ car, onQuiz }: { car: Vehicle; onQuiz: () => void }) {
  const { meta } = useSite();
  let items: Work[];
  if (car?.mode === "kit") items = [{ car: car.label, what: "Готовый комплект, установка у нас", note: "ваша модель" }, ...WORKS];
  else if (car?.mode === "custom") {
    const body = bodyOf(car.label);
    const rest = WORKS.filter((w) => w.car !== car.label);
    items = [...rest.filter((w) => w.body === body).map((w) => ({ ...w, note: `похожий кузов: ${body}` })), ...rest.filter((w) => w.body !== body)];
  } else items = WORKS;
  const n = items.length;

  const [cur, setCur] = useState(0);
  const at = Math.min(cur, n - 1);
  const go = (to: number) => setCur(((to % n) + n) % n);

  const tg = meta.contacts.telegram ? telegramLink(meta.contacts.telegram) : null;
  const vk = vkLink(meta.contacts.vk);
  const head = car?.mode === "kit" ? ["Уже стоит", `на ${car.label}`, "и не только"] : ["Уже сделали", car?.mode === "custom" ? "под похожие модели" : "под другие модели"];
  const w = items[at]!;
  const prev = items[(at - 1 + n) % n]!;
  const next = items[(at + 1) % n]!;
  const shot = workPhoto(w.car);

  return (
    <section id="works" className="home-works" aria-labelledby="home-works-t">
      <div
        className="home-works__stage"
        role="group"
        aria-label="Работы"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") { e.preventDefault(); go(at + 1); }
          if (e.key === "ArrowLeft") { e.preventDefault(); go(at - 1); }
        }}
      >
        <figure className="home-works__slide" aria-live="polite">
          <div className="home-works__cap">
            <span>{w.car}</span>
            <span>{w.what}</span>
            {w.note ? <em>{w.note}</em> : null}
          </div>
          {shot ? (
            <img key={shot} className="home-works__photo" src={shot} srcSet={`${shot.replace(/\.webp$/, "-800.webp")} 800w, ${shot} 1600w`} sizes="(max-width: 767px) 100vw, 60vw" alt={`${w.car}: ${w.what.toLowerCase()}`} loading="lazy" decoding="async" />
          ) : (
            <Truck tone="dark" label={`${w.car}: ${w.what.toLowerCase()}`} />
          )}
        </figure>
      </div>

      <div className="home-works__plate home-works__plate--l">
        <button type="button" className="home-works__go" onClick={() => go(at - 1)} aria-label={`Назад: ${prev.car}`}>
          <span className="ar ol" aria-hidden="true"><Icon name="back" /></span>Назад
        </button>
        <Illustration src={workPhoto(prev.car) ?? ""} alt="" caption="" ratio="1 / 1" sizes="180px" dark className="home-works__thumb cut" />
      </div>
      <div className="home-works__plate home-works__plate--r">
        <Illustration src={workPhoto(next.car) ?? ""} alt="" caption="" ratio="1 / 1" sizes="180px" dark className="home-works__thumb cut" />
        <button type="button" className="home-works__go" onClick={() => go(at + 1)} aria-label={`Вперед: ${next.car}`}>
          Вперед<span className="ar ol" aria-hidden="true"><Icon name="arrow" /></span>
        </button>
      </div>

      <h2 id="home-works-t" className="home-works__t" data-in="">{head.map((h, i) => <span key={h}>{i ? <br /> : null}{h}</span>)}</h2>

      <div className="home-works__dots" aria-label="Работы по номерам">
        {items.map((x, i) => (
          <button key={x.car} type="button" className={i === at ? "is-on" : ""} aria-current={i === at ? "true" : undefined} aria-label={`Работа ${i + 1}: ${x.car}`} onClick={() => go(i)}>
            <span className="D num">{pad(i + 1)}</span><i aria-hidden="true" />
          </button>
        ))}
      </div>

      <div className="home-works__end">
        <span className="lift">
          <a href="#quiz" className="btn btn--white home-cta" onClick={(e) => { e.preventDefault(); onQuiz(); }}>
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
