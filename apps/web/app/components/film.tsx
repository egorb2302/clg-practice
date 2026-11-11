/* Round 12 blocks after Keelsy's two references:
   - FilmHero: the title stays put (bb-b.net), the footage shows through the ARMORIX mark and
     grows to the full frame with a camera viewfinder on top (aaronbrimhall.com). A slideshow of
     our photos stands in for the film until it is shot.
   - Frames: tall framed photos that rise in one by one, play a «clip» on hover and drop away
     when you scroll past (aaronbrimhall.com gallery).
   - Marquee: a big photo with the makes running across it (aaronbrimhall.com «Those who get it»).
   - Cases: big photo, inner parallax, a glass card overlapping it, sides alternate (bb-b.net).
   - MailFab: a small contact button in the bottom-right corner (bb-b.net, moved to the corner).
   The motion lives in lib/film.ts. */
import { Link } from "react-router";
import { nb } from "../lib/format";
import { Icon } from "./ui";

const S = (f: string) => `/img/${f}-s.webp`;

/* ── hero ── */
const REEL = ["hero-forest", "road-mud", "car-dust", "hero-wet", "road-taiga"];
export function FilmHero() {
  return (
    <section className="film" aria-label="Первый экран">
      <div className="film__pin">
        <div className="film__stage" aria-hidden="true">
          {/* the reel: one layer seen through the mark, one unmasked that takes over at the end */}
          <div className="film__reel film__reel--mask">
            {REEL.map((f, i) => <img key={f} src={`/img/${f}.webp`} alt="" className={i === 0 ? "is-on" : ""} fetchPriority={i === 0 ? "high" : undefined} decoding="async" />)}
          </div>
          <div className="film__reel film__reel--full">
            {REEL.map((f, i) => <img key={f} src={`/img/${f}.webp`} alt="" className={i === 0 ? "is-on" : ""} loading={i === 0 ? "eager" : "lazy"} decoding="async" />)}
          </div>
          <svg className="film__ring" viewBox="0 0 200 200"><circle cx="100" cy="100" r="96" /><path d="M100 0v10M100 190v10M0 100h10M190 100h10" /></svg>
          <div className="film__hud">
            <span className="hud__c hud__c--tl" /><span className="hud__c hud__c--tr" /><span className="hud__c hud__c--bl" /><span className="hud__c hud__c--br" />
            <p className="hud__rec num"><i />REC <span data-tc>00:00:00:00</span></p>
            <p className="hud__spec num">ISO 400<span>1/250</span><span>4K</span></p>
            <span className="hud__x" />
            <p className="hud__foot">Кадры до фильма<span className="num" data-frame>01 / 05</span></p>
          </div>
        </div>
        <div className="film__shade" aria-hidden="true" />
        <div className="film__copy">
          <h1 className="film__t">
            <span className="film__s">Стальная защита бамперов</span>
            <span className="film__b">для внедорожников</span>
          </h1>
          <Link className="film__go tlink" to="/catalog">Подобрать комплект <Icon name="arrow" vb="0 0 20 20" /></Link>
        </div>
        <p className="film__cue" aria-hidden="true">Листайте<i /></p>
      </div>
    </section>
  );
}

/* ── framed photos with a clip on hover ── */
type Frame = { t: string; to: string; seq: string[] };
const FRAMES: Frame[] = [
  { t: "JAC T9", to: "/catalog?vehicle=jac-t9", seq: ["truck-l", "truck-cut", "bumper"] },
  { t: "Haval H3", to: "/catalog?vehicle=haval-h3", seq: ["road-mud", "hero-wet", "car-dust"] },
  { t: "Трубогиб", to: "/about", seq: ["steel-tubes", "steel-chrome", "tex-brushed"] },
  { t: "Сварка", to: "/about", seq: ["shop-welder", "shop-sparks", "shop-grinder"] },
  { t: "Полировка", to: "/about", seq: ["steel-liquid", "steel-plates", "tex-scratch"] },
  { t: "Установка", to: "/about#delivery", seq: ["install-rack", "install-hands", "engine"] },
  { t: "Тайга", to: "/catalog", seq: ["road-taiga", "taiga-spruce", "taiga-valley"] },
  { t: "Снег", to: "/catalog", seq: ["car-snow", "taiga-peaks", "taiga-hills"] },
  { t: "Туман", to: "/catalog", seq: ["road-fog", "hero-forest", "hero-wet"] },
  { t: "Кенгурин", to: "/catalog?vehicle=jac-t9", seq: ["bullbar", "bumper", "truck"] },
];
export function Frames() {
  return (
    <section className="frames" aria-label="Кадры">
      <div className="frames__head wrap">
        <p className="frames__k">В деле</p>
        <p className="frames__n num" aria-hidden="true">10 кадров</p>
      </div>
      <div className="frames__track">
        {FRAMES.map((f, i) => (
          <Link key={f.t} className="fr" to={f.to} style={{ "--i": i } as React.CSSProperties} draggable={false}>
            <span className="fr__key">
              <img className="fr__still" src={S(f.seq[0]!)} alt="" loading="lazy" draggable={false} />
              <span className="fr__clip" aria-hidden="true">
                {f.seq.map((s) => <img key={s} src={S(s)} alt="" loading="lazy" draggable={false} />)}
              </span>
              <span className="fr__rec" aria-hidden="true"><i />REC</span>
              <span className="fr__t">{f.t}</span>
            </span>
          </Link>
        ))}
      </div>
      <div className="frames__bar wrap" aria-hidden="true"><span className="frames__prog"><i /></span><span className="frames__rpm num">Тяните</span></div>
    </section>
  );
}

/* ── big photo with the makes running across ── */
const MAKES = ["JAC", "Haval", "Tank", "Great Wall", "Jetour", "Chery", "Geely", "Changan", "Exeed", "BAIC"];
export function Marquee() {
  const row = MAKES.map((m) => <span key={m} className="mq__w">{m}</span>);
  return (
    <section className="mq frame" aria-label="Марки">
      <div className="frame__bg mq__bg"><img src="/img/car-dust.webp" alt="" loading="lazy" decoding="async" /></div>
      <div className="mq__copy">
        <h2 className="mq__t"><span>Китайские внедорожники</span><span>наша специализация</span></h2>
        <p className="mq__p">{nb("JAC и Haval уже в каталоге, для других марок снимем размеры с вашей машины и сделаем защиту на штатные точки")}</p>
      </div>
      <div className="mq__run" aria-label={MAKES.join(", ")}>
        <div className="mq__line" aria-hidden="true">{row}{row}</div>
      </div>
    </section>
  );
}

/* ── cases: photo with inner parallax, glass card over it, sides alternate ── */
const CASES = [
  { k: "Передняя защита", t: "JAC T9", p: "Труба Ø 76 по линии бампера, нержавеющая AISI 304 с зеркальной полировкой, четыре кронштейна в штатные точки рамы", img: "bumper", to: "/catalog?vehicle=jac-t9&position=front" },
  { k: "Кенгурин с защитой фар", t: "JAC T9", p: "Высокая дуга с площадкой под дополнительный свет, ставится вместе с передней защитой", img: "bullbar", to: "/catalog?vehicle=jac-t9" },
  { k: "Задняя защита", t: "Haval H3", p: "Прямая труба и уголки, которые не закрывают фаркоп, номер и датчики парковки", img: "hero-wet", to: "/catalog?vehicle=haval-h3&position=rear" },
];
export function Cases() {
  return (
    <section className="cases wrap" aria-labelledby="cases-h">
      <div className="cases__head" data-in="">
        <p className="cases__k">Наши комплекты</p>
        <h2 className="cases__h" id="cases-h">На машинах</h2>
        <p className="cases__lead">{nb("Каждый комплект гнем под конкретную модель, вот как он сидит на бампере")}</p>
      </div>
      {CASES.map((c, i) => (
        <Link key={c.k} className={`case${i % 2 ? " case--r" : ""}`} to={c.to}>
          <span className="case__media"><span className="case__par"><img src={`/img/${c.img}.webp`} alt="" loading="lazy" decoding="async" /></span></span>
          <span className="case__card">
            <span className="case__k">{c.k}</span>
            <span className="case__t">{c.t}</span>
            <span className="case__p">{nb(c.p)}</span>
            <span className="case__go"><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M9.5 9.5 2 2m7.5 7.5H3.3m6.2 0V3.2" /></svg>Смотреть в каталоге</span>
          </span>
        </Link>
      ))}
    </section>
  );
}

/* ── contact in the corner ── */
export function MailFab() {
  return (
    <Link className="fab" to="/contacts" aria-label="Написать нам">
      <Icon name="mail" />
      <span className="fab__t">Написать нам</span>
    </Link>
  );
}
