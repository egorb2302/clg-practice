import { Icon } from "../site";
import { telHref, useSite } from "../../lib/site";
import type { Vehicle } from "../../lib/vehicle";
import { Glyph, PATH } from "./data";

type Step = { d: string; t: string; p: string; link: string; href?: string; to?: () => void };

export function Process({ car, onQuiz }: { car: Vehicle; onQuiz: () => void }) {
  const { meta } = useSite();
  const tel = telHref(meta.contacts.phone) ?? "#quiz";
  const custom = car?.mode === "custom";
  const steps: Step[] = custom
    ? [
        { d: PATH.camera, t: "Фото и размеры", p: `Пришлите 4 фото ${car.label} спереди и сбоку, при необходимости снимем размеры у нас`, link: `Рассчитать под ${car.label}`, to: onQuiz },
        { d: PATH.sheet, t: "Эскиз и цена", p: "Пришлем эскиз защиты на вашей машине и точную цену, платите только после согласования", link: "Пример эскиза", href: "#trust" },
        { d: PATH.truck, t: "Изготовление и установка", p: "Варим, примеряем на машине, присылаем фото этапов, ставим у нас или отправляем по России", link: "Позвонить нам", href: tel },
      ]
    : [
        { d: PATH.list, t: "Подборка за 2 минуты", p: `${car?.mode === "kit" ? `Добавьте комплекты для ${car.label}` : "Выберите машину и комплект"} в подборку и отправьте заявку: на сайте ничего не оплачивается`, link: car?.mode === "kit" ? `Комплекты для ${car.label}` : "Подобрать комплект", href: "#kits" },
        { d: PATH.phone, t: "Звонок и расчет", p: `Менеджер перезвонит в рабочее время, уточнит комплектацию${car?.mode === "kit" ? ` ${car.label}` : ""} и назовет точную цену`, link: "Позвонить нам", href: tel },
        { d: PATH.truck, t: "Установка или доставка", p: "Ставим у нас за 2,5 часа или отправляем по России транспортной компанией в жесткой коробке", link: "Как доставляем", href: "/faq" },
      ];

  return (
    <section className="home-proc" aria-labelledby="home-proc-t">
      <h2 id="home-proc-t" className="home-proc__t" data-in="">{custom ? "Как сделаем под вашу машину" : "Как все проходит"}</h2>
      <div className="home-proc__box">
      <span className="home-proc__link" aria-hidden="true" />
      <ol className="home-proc__row" data-stagger="">
        {steps.map((s, i) => (
          <li key={s.t} className="home-proc__w" data-in="">
            <article className="home-proc__card ol">
              <span className="home-proc__n D">0{i + 1}</span>
              <span className="home-proc__ic cut" aria-hidden="true"><Glyph d={s.d} size={38} /></span>
              <h3>{s.t}</h3>
              <p>{s.p}</p>
              <span className="lift lift--ink lift--block home-proc__go">
                <a
                  className="btn btn--line ol home-proc__btn"
                  href={s.href ?? "#quiz"}
                  onClick={s.to ? (e) => { e.preventDefault(); s.to!(); } : undefined}
                >
                  <span>{s.link}</span><Icon name="arrow" className="ico--go" />
                </a>
              </span>
            </article>
          </li>
        ))}
      </ol>
      </div>
      {car?.mode !== "kit" ? (
        <p className="home-proc__lane" data-in="">
          <span>{custom ? "Каждый шаг согласуем с вами, без согласования эскиза не начинаем" : "Нет готового комплекта под вашу машину? Сделаем по месту и покажем эскиз до изготовления"}</span>
          {custom ? (
            <a className="lnk" href="#trust"><span className="lnk__t">Пример эскиза</span><span className="ar ol" aria-hidden="true"><Icon name="arrow" /></span></a>
          ) : (
            <a className="lnk" href="#quiz" onClick={(e) => { e.preventDefault(); onQuiz(); }}><span className="lnk__t">Сделать под мою модель</span><span className="ar ol" aria-hidden="true"><Icon name="arrow" /></span></a>
          )}
        </p>
      ) : null}
    </section>
  );
}
