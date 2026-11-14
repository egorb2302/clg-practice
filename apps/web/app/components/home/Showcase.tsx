import type { ProductCard as Card } from "@armorix/contracts";
import { useEffect, useState, type KeyboardEvent } from "react";
import { Link } from "react-router";
import { addCard, Icon, Illustration } from "../site";
import { POSITION_LABEL, priceFrom } from "../../lib/format";
import { useSelection } from "../../lib/selection";
import { ui } from "../../lib/ui";
import type { Vehicle } from "../../lib/vehicle";
import { type Kit, leadProduct, priced } from "./data";

type Slide = {
  key: string;
  tab: string;
  car: string;
  title: string;
  text: string;
  photo: string;
  stats: [string, string, string][];
  product?: Card;
};

const KIT_TEXT = "Ставится на штатные точки без сверления, нержавейка AISI 304 или черная сталь с порошковой краской";

function kitSlide(p: Card, tab: string): Slide {
  return {
    key: p.slug,
    tab,
    car: p.vehicle.label,
    title: POSITION_LABEL[p.position],
    text: p.title,
    photo: `на весь экран: ${p.vehicle.label} с защитой едет по камням, машина слева`,
    stats: [["2,5", " ч", "установка"], ["0", "", "отверстий в кузове"], p.coating?.code === "aisi304" ? ["304", "", "марка стали AISI"] : ["РФ", "", "доставка по России"]],
    product: p,
  };
}

function customSlide(label: string | null, tab: string): Slide {
  return {
    key: "custom",
    tab,
    car: label ?? "Любая модель",
    title: label ? `Защита под ваш ${label}` : "Под вашу модель",
    text: label
      ? "Готового комплекта еще нет: снимем размеры, покажем эскиз на согласование, сварим и поставим"
      : "Снимем размеры по фото, покажем эскиз до изготовления, сделаем по месту и поставим",
    photo: label ? "на весь экран: работа под похожую модель на камнях, подпись «так мы сделали под похожую машину»" : "на весь экран: реальная работа под другую модель на камнях",
    stats: [["0", " ₽", "до согласования"], ["2", " материала", "на выбор"], ["от 4", " нед", "изготовление"]],
  };
}

export function Showcase({ kits, car, onQuiz }: { kits: Kit[]; car: Vehicle; onQuiz: () => void }) {
  const sel = useSelection();
  let slides: Slide[];
  if (car?.mode === "kit") {
    const mine = kits.find((k) => k.vehicle.slug === car.slug);
    slides = [
      ...priced(mine?.products ?? []).slice(0, 4).map((p) => kitSlide(p, POSITION_LABEL[p.position])),
      ...kits.filter((k) => k.vehicle.slug !== car.slug).flatMap((k) => { const p = leadProduct(k); return p ? [kitSlide(p, k.vehicle.label)] : []; }),
    ];
  } else if (car?.mode === "custom") {
    slides = [customSlide(car.label, `Под ваш ${car.label}`), ...kits.flatMap((k) => { const p = leadProduct(k); return p ? [kitSlide(p, k.vehicle.label)] : []; })];
  } else {
    slides = [...kits.flatMap((k) => { const p = leadProduct(k); return p ? [kitSlide(p, k.vehicle.label)] : []; }), customSlide(null, "Другая модель")];
  }
  const [cur, setCur] = useState(0);
  useEffect(() => { setCur(0); }, [car?.label]);
  const at = Math.min(cur, slides.length - 1);
  const s = slides[at]!;
  const p = s.product;
  const added = p ? sel.some((i) => i.productSlug === p.slug) : false;

  const act = () => {
    if (!p) { onQuiz(); return; }
    if (added) { ui.openDrawer(); return; }
    addCard(p);
    ui.toast(`${p.title}, ${p.vehicle.label}`);
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1 };
    let next = -1;
    if (e.key in step) next = (at + step[e.key]! + slides.length) % slides.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = slides.length - 1;
    if (next < 0) return;
    e.preventDefault();
    setCur(next);
    e.currentTarget.querySelectorAll<HTMLElement>("[role=tab]")[next]?.focus();
  };

  return (
    <section id="kits" className="home-show dark" aria-label="Готовые комплекты">
      <div className="home-show__bgs">
        <Illustration src="/img/x.webp" alt="" caption={s.photo} dark />
      </div>

      <ul className="home-show__stats">
        {s.stats.map(([v, u, k]) => (
          <li key={k}><b className="D">{v}<small>{u}</small></b><span>{k}</span></li>
        ))}
      </ul>

      <div className="home-show__col">
        <div className="home-show__card" id="home-show-panel" role="tabpanel" aria-labelledby={`home-show-tab-${at}`}>
          <span className="home-show__car">{s.car}</span>
          <h3 className="home-show__t">{s.title}</h3>
          <span className="home-show__dash" aria-hidden="true" />
          {p ? <p className="home-show__name">{s.text}</p> : null}
          <p className="home-show__txt">{p ? KIT_TEXT : s.text}</p>
          <p className="home-show__price D num">{p ? priceFrom(p.priceFrom) : "Цену назовем после фото"}</p>
          <div className="home-show__act">
            <span className="lift">
              <button type="button" className="btn btn--white btn--sm" onClick={act} aria-label={added && p ? `В подборке: ${p.title}, открыть подборку` : undefined}>
                {p ? (added ? <><Icon name="check" />В подборке</> : "В подборку") : car?.mode === "custom" ? `Рассчитать под ${car.label}` : "Рассчитать под мою модель"}
              </button>
            </span>
            {p ? (
              <Link className="lnk lnk--sm" to={`/catalog/${p.slug}?vehicle=${encodeURIComponent(p.vehicle.slug)}`}><span className="lnk__t">Подробнее</span><span className="ar ol" aria-hidden="true"><Icon name="arrow" /></span></Link>
            ) : (
              <a className="lnk lnk--sm" href="#works"><span className="lnk__t">Похожие работы</span><span className="ar ol" aria-hidden="true"><Icon name="arrow" /></span></a>
            )}
          </div>
        </div>
        <div className="home-show__pic">
          <Illustration src="/img/x.webp" alt="" caption="защита крупно на машине" ratio="auto" className="home-show__thumb" />
        </div>
        <div className="home-show__tabs" role="tablist" aria-label="Комплекты" onKeyDown={onKey}>
          {slides.map((x, i) => (
            <button
              key={x.key}
              id={`home-show-tab-${i}`}
              type="button"
              role="tab"
              aria-selected={i === at}
              aria-controls="home-show-panel"
              tabIndex={i === at ? 0 : -1}
              className="home-show__tab ol"
              onClick={() => setCur(i)}
            >
              {x.tab}
            </button>
          ))}
        </div>
        <Link className="lnk lnk--sm home-show__all" to={car?.mode === "kit" ? `/catalog?vehicle=${encodeURIComponent(car.slug)}` : "/catalog"}><span className="lnk__t">Весь каталог</span><span className="ar ol" aria-hidden="true"><Icon name="arrow" /></span></Link>
      </div>
    </section>
  );
}
