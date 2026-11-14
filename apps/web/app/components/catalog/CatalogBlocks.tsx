import type { ReactNode } from "react";
import { Link } from "react-router";
import { Icon, Illustration } from "../site";
import { CatIcon, type CatIconName } from "./CatIcon";

export function CardSkeleton({ n = 6 }: { n?: number }) {
  return (
    <div className="cat-grid cat-skel" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="cat-sk ol" style={{ "--i": i } as React.CSSProperties}>
          <i className="cat-sk__img" />
          <div className="cat-sk__b"><i style={{ width: "34%" }} /><i style={{ width: "72%", height: 26 }} /><i style={{ width: "58%" }} /><i style={{ width: "44%", height: 30, marginTop: 18 }} /></div>
        </div>
      ))}
    </div>
  );
}

const BOX_ICON: Record<"error" | "empty" | "custom", CatIconName> = { error: "alert", empty: "search", custom: "car" };

export function StateBox({ kind, title, text, children }: { kind: "error" | "empty" | "custom"; title: string; text: string; children?: ReactNode }) {
  return (
    <div className={`cat-box ol cat-box--${kind}`} role={kind === "error" ? "alert" : "status"}>
      <span className="cat-box__ico ol" aria-hidden="true"><CatIcon name={BOX_ICON[kind]} size={40} /></span>
      <h2 className="cat-box__t">{title}</h2>
      <p className="cat-box__p">{text}</p>
      {children ? <div className="cat-box__acts">{children}</div> : null}
    </div>
  );
}

const WORKS = [
  { car: "Tank 300", body: "рамный внедорожник", what: "передняя защита, черная порошковая", img: "/img/car-dust.webp" },
  { car: "Haval H5", body: "рамный внедорожник", what: "передняя защита, нержавейка", img: "/img/road-taiga.webp" },
  { car: "Great Wall Poer", body: "пикап", what: "передняя защита, черная порошковая", img: "/img/road-mud.webp" },
  { car: "Chery Tiggo 8 Pro", body: "кроссовер", what: "передняя и задняя, нержавейка", img: "/img/car-snow.webp" },
  { car: "Geely Monjaro", body: "кроссовер", what: "задняя защита, нержавейка", img: "/img/install-rack.webp" },
];
const BODY: Record<string, string> = {
  "JAC T8": "пикап", "Great Wall Poer": "пикап", "Great Wall Wingle 7": "пикап", "Tank 300": "рамный внедорожник",
  "Tank 400": "рамный внедорожник", "Tank 500": "рамный внедорожник", "Haval H5": "рамный внедорожник", "Haval Dargo": "кроссовер",
  "Haval Jolion": "кроссовер", "Chery Tiggo 7 Pro": "кроссовер", "Chery Tiggo 8 Pro": "кроссовер", "Chery Tiggo 9": "кроссовер",
  "Geely Monjaro": "кроссовер", "Geely Atlas": "кроссовер", "Geely Okavango": "кроссовер", "Changan UNI-K": "кроссовер",
  "Changan CS75 Plus": "кроссовер", "Exeed VX": "кроссовер", "Exeed TXL": "кроссовер",
};

export function SimilarWorks({ car }: { car: string }) {
  const body = BODY[car];
  const list = WORKS.filter((w) => w.car !== car).sort((a, b) => Number(b.body === body) - Number(a.body === body)).slice(0, 3);
  return (
    <div className="cat-works">
      <h3 className="cat-works__t">Так мы сделали под похожие машины</h3>
      <ul className="cat-works__g" data-stagger="">
        {list.map((w) => (
          <li key={w.car} data-in="">
            <Illustration className="cat-works__img" src={w.img} alt={`Работа на ${w.car}`} sizes="(max-width: 767px) 100vw, 30vw" crop />
            <b>{w.car}</b>
            <span>{w.what}{w.body === body ? ", похожий кузов" : ""}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TrustStrip() {
  const rows: [CatIconName | "phone", string][] = [
    ["shieldok", "Встает на штатные точки, без сверления"],
    ["truck", "Ставим у нас или отправляем по России"],
    ["phone", "На сайте ничего не оплачивается: цену подтвердит менеджер"],
  ];
  return (
    <div className="cat-trust" data-stagger="">
      {rows.map(([ic, t]) => (
        <div className="cat-trust__i" key={t} data-in="">
          <span className="cat-trust__ic cut" aria-hidden="true">{ic === "phone" ? <Icon name="phone" /> : <CatIcon name={ic} />}</span>
          <b>{t}</b>
        </div>
      ))}
      <Link className="lnk" to="/faq"><span className="lnk__t">Все вопросы</span><span className="ar ol" aria-hidden="true"><Icon name="arrow" /></span></Link>
    </div>
  );
}

export function CustomStrip({ kit }: { kit: boolean }) {
  const facts: [CatIconName, string][] = [["drawing", "Чертеж до оплаты"], ["fit", "Примерка на машине"], ["camera", "Фото каждого этапа"], ["shieldok", "Не встанет, исправим"]];
  return (
    <section className="dark2 cat-cstrip" aria-labelledby="cat-cs-t">
      <div className="wrap cat-cstrip__in">
        <div className="cat-sketch ol" aria-hidden="true">
          <svg viewBox="0 0 800 560">
            <g fill="none" stroke="#5E5E5B" strokeWidth="3" strokeDasharray="10 8"><path d="M110 150 L180 70 L620 70 L690 150 L712 330 L712 420 L88 420 L88 330 Z" /><rect x="290" y="210" width="220" height="110" /></g>
            <g className="cat-sketch__bar" fill="none" stroke="#EDEDEB" strokeWidth="9"><path d="M150 342 L650 342 M180 392 L620 392 M318 214 L318 392 M482 214 L482 392 M150 342 L180 392 M650 342 L620 392" /></g>
          </svg>
          <span>пример эскиза</span>
        </div>
        <div className="cat-cstrip__body">
          <div className="cat-cstrip__head" data-in="">
            <h2 id="cat-cs-t" className="cat-cstrip__t">{kit ? "Нужна защита на другую машину?" : "Нет вашей модели в каталоге?"}<br />Сделаем под нее</h2>
            <Link className="lnk" to="/#quiz"><span className="lnk__t">Рассчитать под мою модель</span><span className="ar ol" aria-hidden="true"><Icon name="arrow" /></span></Link>
          </div>
          <ul className="cat-cstrip__facts" data-stagger="">
            {facts.map(([ic, t]) => (
              <li key={t} data-in=""><span className="cat-cstrip__ic cut" aria-hidden="true"><CatIcon name={ic} /></span><b>{t}</b></li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
