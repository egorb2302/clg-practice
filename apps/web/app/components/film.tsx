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

/* ── framed photos: a keybed. The card under the cursor rises most, its neighbours a little;
      it turns to colour at once and its clip starts (stock frames with a camera push) ── */
const U = (n: number) => `/img/stock/u${String(n).padStart(2, "0")}.webp`;
type Frame = { t: string; to: string; still: string; clip: string[] };
const FRAMES: Frame[] = [
  { t: "JAC T9", to: "/catalog?vehicle=jac-t9", still: S("truck-l"), clip: [U(4), U(20), U(22), U(21)] },
  { t: "Haval H3", to: "/catalog?vehicle=haval-h3", still: S("road-mud"), clip: [U(5), U(2), U(19), U(12)] },
  { t: "Сварка", to: "/about", still: S("shop-welder"), clip: [U(25), U(26), U(33), U(36)] },
  { t: "Шлифовка", to: "/about", still: S("shop-grinder"), clip: [U(27), U(30), U(34), U(32)] },
  { t: "Металл", to: "/about", still: S("steel-tubes"), clip: [U(35), U(37), U(31), U(32)] },
  { t: "Установка", to: "/about#delivery", still: S("install-rack"), clip: [U(38), U(39), U(40), U(42)] },
  { t: "Тайга", to: "/catalog", still: S("road-taiga"), clip: [U(1), U(9), U(11), U(23)] },
  { t: "Снег", to: "/catalog", still: S("car-snow"), clip: [U(18), U(24), U(12), U(14)] },
  { t: "Ночь", to: "/catalog", still: S("road-fog"), clip: [U(16), U(17), U(14), U(3)] },
  { t: "Свет", to: "/catalog?vehicle=jac-t9", still: S("bullbar"), clip: [U(13), U(15), U(3), U(16)] },
];
export function Frames() {
  return (
    <section className="frames" aria-label="Кадры">
      <div className="frames__head wrap">
        <p className="frames__k">В деле</p>
        <p className="frames__n num" aria-hidden="true">Наведите на кадр</p>
      </div>
      <div className="frames__track">
        {FRAMES.map((f, i) => (
          <Link key={f.t} className="fr" to={f.to} style={{ "--i": i } as React.CSSProperties} draggable={false}>
            <span className="fr__key">
              <img className="fr__still" src={f.still} alt="" loading="lazy" draggable={false} />
              <span className="fr__clip" aria-hidden="true">
                {f.clip.map((c, k) => <img key={c + k} src={c} alt="" loading="lazy" decoding="async" draggable={false} style={{ "--k": k } as React.CSSProperties} />)}
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

/* ── makes over a big photo: hovering a make stops the line, lights the make, writes a caption
      under it and wipes its own photo in from the right (aaronbrimhall.com «Those who get it») ── */
type Make = { m: string; note: string; to: string; img: string };
const MAKES: Make[] = [
  { m: "JAC", note: "в каталоге", to: "/catalog?vehicle=jac-t9", img: "/img/truck-l.webp" },
  { m: "Haval", note: "в каталоге", to: "/catalog?vehicle=haval-h3", img: "/img/road-mud.webp" },
  { m: "Tank", note: "под заказ", to: "/contacts?type=custom", img: U(4) },
  { m: "Great Wall", note: "под заказ", to: "/contacts?type=custom", img: U(20) },
  { m: "Jetour", note: "под заказ", to: "/contacts?type=custom", img: U(22) },
  { m: "Chery", note: "под заказ", to: "/contacts?type=custom", img: U(1) },
  { m: "Geely", note: "под заказ", to: "/contacts?type=custom", img: U(21) },
  { m: "Changan", note: "под заказ", to: "/contacts?type=custom", img: U(18) },
  { m: "Exeed", note: "под заказ", to: "/contacts?type=custom", img: U(16) },
  { m: "BAIC", note: "под заказ", to: "/contacts?type=custom", img: U(10) },
];
export function Marquee() {
  const row = (dup: boolean) => MAKES.map((x, i) => (
    <Link key={x.m + dup} className="mq__w" to={x.to} data-i={i} tabIndex={dup ? -1 : undefined} aria-hidden={dup || undefined} draggable={false}>
      <span className="mq__name">{x.m}</span>
      <span className="mq__cap">{x.m} <span>{x.note}</span> <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M9.5 9.5 2 2m7.5 7.5H3.3m6.2 0V3.2" /></svg></span>
    </Link>
  ));
  return (
    <section className="mq frame" aria-label="Марки">
      <div className="frame__bg mq__bg"><img src="/img/car-dust.webp" alt="" loading="lazy" decoding="async" /></div>
      <div className="mq__stage" aria-hidden="true">
        {MAKES.map((x, i) => <img key={x.m} src={x.img} alt="" data-i={i} loading="lazy" decoding="async" />)}
      </div>
      <div className="mq__veil" aria-hidden="true" />
      <div className="mq__copy">
        <h2 className="mq__t"><span>Китайские внедорожники</span><span>наша специализация</span></h2>
        <p className="mq__p">{nb("JAC и Haval уже в каталоге, для других марок снимем размеры с вашей машины и сделаем защиту на штатные точки")}</p>
      </div>
      <div className="mq__run">
        <div className="mq__line">{row(false)}{row(true)}</div>
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
