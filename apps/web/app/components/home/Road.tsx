import { Icon, Illustration } from "../site";
import type { Vehicle } from "../../lib/vehicle";
import { photo } from "../../lib/photos";
import { Glyph, PATH } from "./data";

export function Road({ car }: { car: Vehicle }) {
  return (
    <section className="home-road dark" aria-labelledby="home-road-t">
      <Illustration src={photo("road")} alt="Пикап со стальной защитой бампера едет по лесной колее" className="home-road__img" dark />
      <div className="home-road__copy" data-stagger="">
        <h2 id="home-road-t" data-in="">Пластик для города,<br />сталь для вашей дороги</h2>
        <p data-in="">Лес, съезд к воде и колея после дождя<br />{car ? `бампер вашего ${car.label} встречает первым` : "бампер встречает первым"}</p>
        <span className="lift" data-in="">
          <a href="#steel" className="btn btn--line ol home-road__btn">Из чего сделана защита<Icon name="arrow" className="ico--go" /></a>
        </span>
      </div>
    </section>
  );
}

const PROMISES = [
  { d: PATH.sheet, t: "Чертеж до оплаты", p: "Эскиз с размерами на вашей машине, платите после согласования" },
  { d: PATH.fit, t: "Примерка на машине", p: "Каркас примеряем до полировки или покраски" },
  { d: PATH.camera, t: "Фото каждого этапа", p: "Резка, гибка, сварка и полировка в Telegram" },
  { d: PATH.guard, t: "Не встанет, исправим", p: "Переделаем за свой счет" },
];

export function Sketch({ label, small = false }: { label?: string; small?: boolean }) {
  return (
    <svg viewBox="0 0 800 560" role="img" aria-label="Пример эскиза защиты на согласование" className={`home-sketch${small ? " is-small" : ""}`}>
      <g className="home-sketch__car" fill="none" strokeDasharray="7 6">
        <path d="M110 150 L180 70 L620 70 L690 150 L712 330 L712 420 L88 420 L88 330 Z" />
        <path d="M200 92 L600 92 L646 150 L154 150 Z" />
        <rect x="290" y="210" width="220" height="110" />
        <rect x="120" y="200" width="130" height="52" /><rect x="550" y="200" width="130" height="52" />
        <rect x="110" y="420" width="96" height="74" /><rect x="594" y="420" width="96" height="74" />
      </g>
      <g className="home-sketch__bar" fill="none">
        <path d="M150 342 L650 342 M180 392 L620 392 M318 214 L318 392 M482 214 L482 392 M150 342 L180 392 M650 342 L620 392" />
      </g>
      {small ? null : (
        <>
          <g className="home-sketch__pin"><circle cx="240" cy="342" r="9" /><circle cx="560" cy="342" r="9" /></g>
          <g className="home-sketch__dim" fill="none">
            <path d="M240 342 L170 470 L90 470 M560 342 L630 470 L710 470" />
            <path d="M150 40 L650 40 M150 32 L150 48 M650 32 L650 48" />
            <path d="M752 214 L752 392 M744 214 L760 214 M744 392 L760 392" />
          </g>
          <g className="home-sketch__txt">
            <text x="400" y="28" textAnchor="middle">ширина по замеру</text>
            <text x="776" y="303" transform="rotate(90 776 303)" textAnchor="middle">высота по замеру</text>
            <text x="90" y="494">штатная точка</text>
            <text x="710" y="494" textAnchor="end">штатная точка</text>
          </g>
        </>
      )}
      {label ? <title>{label}</title> : null}
    </svg>
  );
}

export function Trust({ label, onQuiz }: { label: string; onQuiz: () => void }) {
  return (
    <section id="trust" className="home-trust dark2" aria-labelledby="home-trust-t">
      <figure className="home-trust__sheet ol" data-in="">
        <span className="home-trust__k">пример эскиза</span>
        <Sketch />
        <figcaption className="D">Эскиз на согласование / {label.toUpperCase()} / лист 1</figcaption>
      </figure>
      <div className="home-trust__copy" data-stagger="">
        <h2 id="home-trust-t" data-in="">Вы увидите защиту<br />до сварки</h2>
        <p className="home-trust__lead" data-in="">Под {label} готового комплекта еще нет, поэтому каждый шаг вы видите и подтверждаете сами</p>
        <ul className="home-trust__list" data-in="">
          {PROMISES.map((x) => (
            <li key={x.t}>
              <span className="home-ic cut" aria-hidden="true"><Glyph d={x.d} /></span>
              <b>{x.t}</b>
              <p>{x.p}</p>
            </li>
          ))}
        </ul>
        <p className="home-trust__note" data-in="">Сталь AISI 304 и мастера те же, что у готовых комплектов</p>
        <div className="home-trust__act" data-in="">
          <span className="lift">
            <a href="#quiz" className="btn btn--light" onClick={(e) => { e.preventDefault(); onQuiz(); }}>Рассчитать под {label}<Icon name="arrow" className="ico--go" /></a>
          </span>
          <a href="#works" className="lnk"><span className="lnk__t">Похожие работы</span><span className="ar ol" aria-hidden="true"><Icon name="arrow" /></span></a>
        </div>
      </div>
    </section>
  );
}

export function ShortTrust({ onQuiz }: { onQuiz: () => void }) {
  return (
    <section className="home-strust dark2" aria-labelledby="home-strust-t">
      <div className="home-strust__sheet ol" data-in="">
        <span className="home-trust__k">пример эскиза</span>
        <Sketch small />
      </div>
      <div className="home-strust__body">
        <div className="home-strust__head" data-in="">
          <h2 id="home-strust-t">Нет вашей модели в каталоге?<br />Сделаем под нее</h2>
          <a href="#quiz" className="lnk" onClick={(e) => { e.preventDefault(); onQuiz(); }}><span className="lnk__t">Рассчитать под мою модель</span><span className="ar ol" aria-hidden="true"><Icon name="arrow" /></span></a>
        </div>
        <ul className="home-strust__list" data-stagger="">
          {PROMISES.map((x) => (
            <li key={x.t} data-in=""><span className="home-ic cut" aria-hidden="true"><Glyph d={x.d} size={26} /></span><b>{x.t}</b></li>
          ))}
        </ul>
      </div>
    </section>
  );
}
