import { data, useRouteLoaderData } from "react-router";
import type { Route } from "./+types/about";
import { Adv, ContactPlate, Flow, Say } from "../components/sections";
import { Icon, Img, Sbtn, Tt } from "../components/ui";
import { PUBLIC_CACHE } from "../lib/api.server";
import { ADV, STEPS } from "../lib/content";
import { nb } from "../lib/format";
import { rootOrigin, seo } from "../lib/seo";
import type { loader as rootLoader } from "../root";

export const loader = () => data({}, { headers: { "Cache-Control": PUBLIC_CACHE } });
export { pageHeaders as headers } from "../lib/headers";
export const meta: Route.MetaFunction = ({ matches }) =>
  seo({ title: "О компании и производстве", description: "Как ARMORIX делает защиту бамперов: сталь AISI 304, гибка и сварка в своей мастерской, установка без сверления и доставка по России", path: "/about", origin: rootOrigin(matches), image: "/img/shop-sparks.webp" });

export default function About() {
  const root = useRouteLoaderData<typeof rootLoader>("root");
  return (
    <>
      <section className="ph ph--split wrap">
        <div className="ph__txt" data-in="">
          <p className="crumbs"><span className="chip"><span>О компании</span></span></p>
          <h1 className="tt"><span>Защита под конкретную машину,</span><span className="mute">а не под шаблон</span></h1>
          <p className="t-lead">{nb("ARMORIX делает стальную защиту бамперов для китайских внедорожников и пикапов: от замера модели до установки у нас в мастерской")}</p>
          <div className="ph__go"><Sbtn to="/catalog" className="sbtn--lg">Смотреть каталог</Sbtn></div>
        </div>
        <figure className="ph__img" data-in="">
          <Img src="/img/shop-welder.webp" alt="Мастер варит стальную трубу" eager sizes="(max-width: 1023px) 100vw, 50vw" />
        </figure>
      </section>

      <section className="sec wrap saysec">
        <Say parts={[
          "Мы начали с простого вопроса: почему для", { steel: "JAC и Haval" }, { pic: "/img/truck-s.webp", alt: "Пикап на горной дороге" },
          "нет защиты, сделанной по их замерам, и ответили на него", { steel: "своей мастерской" }, { pic: "/img/shop-grinder-s.webp", alt: "Шлифовка стали" },
        ]} />
      </section>

      <Flow chip={["01", "Производство"]} title={["От листа стали", "до вашей дороги"]} steps={STEPS} />

      <section className="sec wrap mats" aria-label="Материалы">
        <div className="head" data-in=""><div><Tt a="Две отделки на выбор" b="и одна сталь под нагрузку" /></div></div>
        <div className="mats__grid" data-stagger="">
          {[
            { img: "/img/steel-chrome.webp", t: "AISI 304, зеркальная полировка", d: "Нержавеющая сталь, не ржавеет даже на сколах, блестит как хром и переживает зимы с реагентами", tags: ["Не ржавеет", "Блеск", "Дороже"] },
            { img: "/img/tex-scratch.webp", t: "Черная сталь, порошковое покрытие", d: "Матовая отделка без блеска, держит удары и дешевле нержавеющей, скол лучше подкрасить до весны", tags: ["Матовая", "Под стиль off-road", "Доступнее"] },
          ].map((m) => (
            <article key={m.t} className="mat" data-in="">
              <div className="mat__img"><Img src={m.img} alt="" sizes="(max-width: 767px) 100vw, 50vw" /></div>
              <div className="mat__b"><h3>{m.t}</h3><p>{nb(m.d)}</p><p className="mat__tags">{m.tags.map((t) => <span key={t}>{t}</span>)}</p></div>
            </article>
          ))}
        </div>
      </section>

      <section className="sec wrap deliv" id="delivery" aria-label="Установка и доставка">
        <div className="head" data-in=""><div><Tt a="Поставим у себя" b="или отправим в любой регион" /></div></div>
        <div className="deliv__grid" data-stagger="">
          {[
            ["wrench", "Установка у нас", "Около 2,5 часа в мастерской по записи, машину забираете в тот же день"],
            ["box", "Самовывоз", "Комплект в жесткой коробке, весь крепеж и инструкция с фото внутри"],
            ["truck", "Транспортная компания", "До терминала или до двери в любой регион России, сроки зависят от города"],
          ].map(([ic, t, d]) => (
            <div key={t} className="dv" data-in=""><span className="card__i"><Icon name={ic!} /></span><h3>{t}</h3><p>{nb(d!)}</p></div>
          ))}
        </div>
      </section>

      <Adv chip={["04", "Преимущество"]} title="Не универсальная, а ваша" img="/img/road-mud.webp" items={ADV} />
      <div className="gap-s" />
      {root?.meta ? <ContactPlate meta={root.meta} chip={["05", "Контакты"]} title={["Приезжайте в мастерскую", "или напишите нам"]} img="/img/taiga-valley.webp" /> : null}
    </>
  );
}
