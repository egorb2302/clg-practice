import type { ProductCard as Card, Vehicle } from "@armorix/contracts";
import { useState } from "react";
import { data, Link, useRouteLoaderData } from "react-router";
import type { Route } from "./+types/home";
import { ProductCard } from "../components/ProductCard";
import { Cases, FilmHero, Frames, Marquee } from "../components/film";
import { Adv, ContactPlate, Faq, Flow, Rail, Stats } from "../components/sections";
import { Chip, Icon, Img, Sbtn, Tt } from "../components/ui";
import { api, PUBLIC_CACHE } from "../lib/api.server";
import { ADV, CUSTOM, FAQ, STATS, STEPS } from "../lib/content";
import { nb, plural, POSITION_LABEL, priceFrom } from "../lib/format";
import { rootOrigin, seo } from "../lib/seo";
import type { loader as rootLoader } from "../root";

export async function loader() {
  const [vehicles, catalog] = await Promise.all([api.vehicles(), api.catalog(new URLSearchParams())]);
  return data({ vehicles: vehicles.items, products: catalog.items }, { headers: { "Cache-Control": PUBLIC_CACHE } });
}
export { pageHeaders as headers } from "../lib/headers";
export const meta: Route.MetaFunction = ({ matches }) =>
  seo({
    title: "Защита бамперов для внедорожников и пикапов | ARMORIX",
    description: "Стальная защита бамперов для JAC T9 и Haval H3 из AISI 304, установка без сверления, доставка по России и изготовление под вашу модель",
    path: "/",
    origin: rootOrigin(matches),
  });

const minPrice = (ps: Card[]) => {
  const p = ps.map((x) => x.priceFrom).filter((x): x is number => x != null);
  return p.length ? Math.min(...p) : null;
};

export default function Home({ loaderData }: Route.ComponentProps) {
  const { vehicles, products } = loaderData;
  const root = useRouteLoaderData<typeof rootLoader>("root");
  const meta = root?.meta;
  return (
    <>
      <FilmHero />
      <Frames />
      <Showcase vehicles={vehicles} products={products} />
      <Marquee />
      <Story models={vehicles.length} items={products.length} />
      <Flow chip={["03", "Путь комплекта"]} title={["От листа стали", "до вашей дороги"]} steps={STEPS} />
      <Adv chip={["04", "Преимущество"]} title="Не универсальная, а ваша" img="/img/road-taiga.webp" items={ADV} />
      <div className="gap-s" />
      <Stats chip={["05", "В цифрах"]} title={["Мы отвечаем за эти цифры", "в каждом комплекте"]} lead="Каждый комплект проходит одни и те же проверки: марка стали, посадка на раму, швы и покрытие" img="/img/steel-wrenches.webp" items={STATS} />
      <Cases />
      <Custom />
      {meta ? <Faq chip={["07", "Вопросы"]} items={FAQ} phone={meta.contacts.phone} /> : null}
      {meta ? <ContactPlate meta={meta} chip={["08", "Контакты"]} title={["Обсудим вашу машину", "и подберем защиту"]} img="/img/road-fog.webp" /> : null}
    </>
  );
}

/* ── 01 Ready kits, after the Jetour model stage: a scene per vehicle, the model name
      as a giant outlined word, thumbnails switch it, the kit's cards sit under it ── */
const SCENE: Record<string, { img: string; word: string; alt: string; thumb?: string }> = {
  "jac-t9": { img: "/img/truck-l.webp", word: "T9", alt: "Пикап с защитой бампера на горной дороге", thumb: "/img/truck-s.webp" },
  "haval-h3": { img: "/img/road-mud.webp", word: "H3", alt: "Внедорожник с защитой бампера в грязи" },
  custom: { img: "/img/car-snow.webp", word: "4×4", alt: "Внедорожник на снежной горной дороге" },
};
function Showcase({ vehicles, products }: { vehicles: Vehicle[]; products: Card[] }) {
  const tabs = [...vehicles.map((v) => ({ slug: v.slug, label: v.label })), { slug: "custom", label: "Другая модель" }];
  const [cur, setCur] = useState(tabs[0]?.slug ?? "custom");
  const ps = products.filter((p) => p.vehicle.slug === cur);
  const label = tabs.find((t) => t.slug === cur)?.label ?? "";
  const positions = [...new Set(ps.map((p) => p.position))];

  return (
    <section className="show" id="kits" aria-label="Готовые комплекты">
      <div className="show__stage frame">
        {tabs.map((t) => {
          const s = SCENE[t.slug] ?? SCENE.custom!;
          return <div key={t.slug} className={`show__bg${t.slug === cur ? " is-on" : ""}`} aria-hidden={t.slug !== cur}><Img src={s.img} alt={s.alt} /></div>;
        })}
        <div className="show__shade" aria-hidden="true" />
        <span className="show__word" aria-hidden="true" key={cur}>{(SCENE[cur] ?? SCENE.custom!).word}</span>

        <div className="show__head" data-in="">
          <Chip n="01">Готовые комплекты</Chip>
          <Tt a="Выберите свою машину" b="и посмотрите, что на нее есть" />
        </div>

        <div className="show__card glass" key={`c-${cur}`}>
          {cur === "custom" ? (
            <>
              <p className="show__k">Индивидуальное изготовление</p>
              <h3 className="show__name">Под вашу модель</h3>
              <p className="show__txt">{nb("Снимем размеры с вашей машины и сделаем защиту на штатные точки, от чертежа до полировки")}</p>
              <ul className="show__list">
                <li><span>Срок</span><b>от 4 недель</b></li>
                <li><span>Материал</span><b>AISI 304 или порошок</b></li>
                <li><span>Примерка</span><b>на вашей машине</b></li>
              </ul>
              <div className="show__go"><Sbtn to="/contacts?type=custom" className="sbtn--lg">Обсудить свою модель</Sbtn></div>
            </>
          ) : (
            <>
              <p className="show__k">{ps.length} {plural(ps.length, ["позиция", "позиции", "позиций"])} в каталоге</p>
              <h3 className="show__name">{label}</h3>
              <p className="show__price num">{priceFrom(minPrice(ps))}</p>
              <ul className="show__list">
                {positions.map((pos) => {
                  const pp = ps.filter((p) => p.position === pos);
                  return <li key={pos}><span>{POSITION_LABEL[pos]}</span><b className="num">{priceFrom(minPrice(pp))}</b></li>;
                })}
              </ul>
              <div className="show__go">
                <Sbtn to={`/catalog?vehicle=${cur}`} className="sbtn--lg">Все комплекты {label}</Sbtn>
              </div>
            </>
          )}
        </div>

        <div className="show__tabs" role="tablist" aria-label="Автомобиль">
          {tabs.map((t) => {
            const s = SCENE[t.slug] ?? SCENE.custom!;
            return (
              <button key={t.slug} type="button" role="tab" aria-selected={cur === t.slug} aria-controls="show-panel" className="show__tab" onClick={() => setCur(t.slug)}>
                <span className="show__thumb"><img src={(s.thumb ?? s.img.replace(/\.webp$/, "-s.webp"))} alt="" loading="lazy" /></span>
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="show__panel wrap" id="show-panel" role="tabpanel" aria-label={label}>
        {cur === "custom" ? (
          <ol className="how" data-stagger="">
            {[
              ["draft", "Фото и замеры", "Пришлите марку, модель, год и фото бампера, при необходимости снимем размеры сами"],
              ["sheet", "Чертеж и цена", "Предложим конструкцию на штатные точки и назовем цену и срок до начала работ"],
              ["gear", "Изготовление и примерка", "Гнем, варим и примеряем на вашей машине, затем полировка или покраска"],
            ].map(([ic, t, d], i) => (
              <li key={t} data-in="">
                <span className="how__n num">0{i + 1}</span>
                <Icon name={ic!} />
                <b>{t}</b>
                <p>{nb(d!)}</p>
              </li>
            ))}
          </ol>
        ) : (
          <div className="grid-cards" data-stagger="" key={cur}>
            {ps.map((p) => <ProductCard key={p.slug} p={p} back={`/catalog?vehicle=${cur}`} />)}
          </div>
        )}
      </div>
    </section>
  );
}

/* ── 02 Company: a filled bento, every tile carries a picture or a diagram ── */
function Story({ models, items }: { models: number; items: number }) {
  return (
    <section className="sec wrap story" aria-label="О компании">
      <div className="head" data-in="">
        <div><Chip n="02">О компании</Chip><Tt a="Ставим эту защиту" b="и на свои машины" /></div>
        <Link className="tlink" to="/about">Подробнее о производстве <Icon name="arrow" vb="0 0 20 20" /></Link>
      </div>
      <div className="bento" data-stagger="">
        <figure className="bt bt--shop" data-in="">
          <Img src="/img/shop-welder.webp" alt="Мастер варит стальную деталь в мастерской" sizes="(max-width: 767px) 100vw, 58vw" />
          <figcaption className="glass">
            <b>Своя мастерская</b>
            <span>{nb("Гибка, сварка и полировка в одном цеху, поэтому мы отвечаем за каждый шов")}</span>
            <span className="bt__tags"><i>Трубогиб</i><i>Аргон</i><i>Полировка</i></span>
          </figcaption>
        </figure>
        <div className="bt bt--txt" data-in="">
          <p className="bt__k">Почему мы начали</p>
          <p className="bt__big">{nb("Для легендарных внедорожников защиту делают десятки мастерских, а владельцу JAC или Haval остается универсальный кенгурятник")}</p>
          <p className="bt__p">{nb("Мы делаем стальную защиту под конкретную китайскую машину: по ее замерам, на ее штатные точки")}</p>
          <ul className="bt__row"><li><b className="num">{models}</b><span>{plural(models, ["модель", "модели", "моделей"])} в каталоге</span></li><li><b className="num">{items}</b><span>{plural(items, ["готовая позиция", "готовые позиции", "готовых позиций"])}</span></li><li><b>∞</b><span>под заказ</span></li></ul>
        </div>
        {/* the three small tiles share one structure: label, a visual of one height, title, text */}
        <div className="bt bt--mat bt--step" data-in="">
          <p className="bt__lbl"><span className="num">01</span>Материал</p>
          <div className="bt__img"><Img src="/img/tex-brushed.webp" alt="" sizes="33vw" /><span className="bt__stamp num">AISI 304</span></div>
          <b>Нержавеющая сталь</b>
          <div className="bt__more">
            <p>{nb("Зеркальная полировка, не ржавеет на сколах и переживает зимы с реагентами")}</p>
            <dl className="bt__spec"><div><dt>Труба</dt><dd className="num">Ø 63 и 76 мм</dd></div><div><dt>Стенка</dt><dd className="num">2 мм</dd></div></dl>
          </div>
        </div>
        <div className="bt bt--mount bt--step" data-in="">
          <p className="bt__lbl"><span className="num">02</span>Крепление</p>
          <svg className="mount" viewBox="0 0 320 150" aria-hidden="true">
            <path className="mount__bumper" d="M20 60 Q160 20 300 60 L290 110 Q160 130 30 110 Z" />
            <path className="mount__bar" d="M30 52 Q160 8 290 52" />
            <path className="mount__bar" d="M110 32 L104 104 M210 32 L216 104" />
            {[[60, 118], [120, 126], [200, 126], [260, 118]].map(([x, y]) => <g key={x}><line x1={x} y1={y! - 20} x2={x} y2={y} /><circle cx={x} cy={y} r="5" /></g>)}
          </svg>
          <b>Штатные точки рамы</b>
          <div className="bt__more">
            <p>{nb("Четыре кронштейна встают в заводские отверстия, ни одного нового в кузове")}</p>
          </div>
        </div>
        <div className="bt bt--time bt--step" data-in="">
          <p className="bt__lbl"><span className="num">03</span>Установка</p>
          <div className="bt__vis" aria-hidden="true"><span className="bt__num num">2,5</span></div>
          <b>Установка за 2,5 часа</b>
          <ol className="tl bt__more">
            <li><span className="num">10:00</span>Приезжаете в мастерскую</li>
            <li><span className="num">10:20</span>Ставим кронштейны на раму</li>
            <li><span className="num">11:40</span>Навешиваем и выставляем дугу</li>
            <li><span className="num">12:30</span>Забираете машину</li>
          </ol>
        </div>
      </div>
    </section>
  );
}

/* ── 06 Custom work: what we make beyond the catalog, a rail that actually scrolls ── */
function Custom() {
  return (
    <section className="sec custom" aria-label="Индивидуальное изготовление">
      <div className="wrap head" data-in="">
        <div><Chip n="06">Под вашу модель</Chip><Tt a="Нет вашей машины в каталоге?" b="Изготовим по замерам" /></div>
        <div className="custom__r">
          <p>{nb("Опишите машину и задачу, мы проверим, можно ли поставить защиту на штатные точки, и назовем цену до начала работ")}</p>
          <Sbtn to="/contacts?type=custom" className="sbtn--lg">Обсудить свою модель</Sbtn>
        </div>
      </div>
      <Rail items={CUSTOM} label="Что изготавливаем под заказ" />
      <ul className="wrap custom__facts" data-stagger="">
        {[["gear", "Срок", "от 4 недель"], ["gem", "Материал", "AISI 304 или порошок"], ["wrench", "Примерка", "на вашей машине"], ["sheet", "Цена", "до начала работ"]].map(([ic, k, v]) => (
          <li key={k} data-in=""><Icon name={ic!} /><span>{k}</span><b>{v}</b></li>
        ))}
      </ul>
    </section>
  );
}
