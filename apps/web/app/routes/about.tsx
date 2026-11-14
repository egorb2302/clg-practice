import { data, Link } from "react-router";
import type { Route } from "./+types/about";
import { Glyph } from "../components/pages/glyphs";
import { Crumbs, Icon, Illustration } from "../components/site";
import { PUBLIC_CACHE } from "../lib/api.server";
import { nb, telegramLink } from "../lib/format";
import { rootOrigin, seo } from "../lib/seo";
import { telHref, useSite } from "../lib/site";
import css from "../styles/pages/about.css?url";

export const links: Route.LinksFunction = () => [{ rel: "stylesheet", href: css }];
export const loader = () => data({}, { headers: { "Cache-Control": PUBLIC_CACHE } });
export { pageHeaders as headers } from "../lib/headers";
export const meta: Route.MetaFunction = ({ matches }) =>
  seo({ title: "О компании и производстве", description: "Как ARMORIX делает защиту бамперов: сталь AISI 304, гибка и сварка в своей мастерской, установка без сверления и доставка по России", path: "/about", origin: rootOrigin(matches), image: "/og/armorix-about-v1.jpg" });

const NUMS: { pre?: string; n: string; shown: string; post?: string; label: string }[] = [
  { n: "304", shown: "304", label: "марка нержавеющей стали" },
  { n: "2.5", shown: "2,5", post: "ч", label: "на установку у нас" },
  { n: "0", shown: "0", label: "отверстий в кузове" },
  { pre: "от", n: "4", shown: "4", post: "нед", label: "на изготовление под вашу модель" },
];

const RULES = [
  ["Под конкретную модель", "Каждую защиту проектируем по замерам машины, а не подгоняем универсальную дугу"],
  ["Каждый шов проверяет мастер", "Геометрию и сварку смотрим на каждой детали до покрытия"],
  ["Без сверления кузова", "Кронштейны встают в заводские отверстия рамы, кузов остается целым"],
];

const STEPS = [
  ["Замер", "По машине в мастерской или по фото и размерам, которые вы пришлете", "/img/install-hands.webp"],
  ["Чертеж", "Показываем чертеж и примерный вид до оплаты, правим по вашим пожеланиям", "/img/tex-brushed.webp"],
  ["Резка и гибка", "Труба 63 или 76 мм, гнем по линии штатного бампера", "/img/shop-grinder.webp"],
  ["Сварка", "Каждый шов проверяет мастер, геометрию сверяем по шаблону", "/img/shop-sparks.webp"],
  ["Покрытие", "Зеркальная полировка нержавейки или порошковая окраска", "/img/steel-plates.webp"],
  ["Примерка", "Ставим на машину до выдачи, если не встает, исправляем", "/img/bumper.webp"],
];

const MATS = [
  { cls: "pol", sw: "Образец: полировка", t: "Нержавеющая сталь AISI 304, зеркальная полировка", rows: [["Коррозия", "Не ржавеет, красить не нужно"], ["Уход", "Мойка высоким давлением и реагенты не страшны"], ["Вид", "Зеркальный блеск, как у хромированных деталей"], ["Цена", "Выше черной, разница по каждому комплекту в каталоге"]] },
  { cls: "pow", sw: "Образец: черная", t: "Черная сталь, порошковая краска", rows: [["Коррозия", "Защищает слой краски, скол подкрашивается"], ["Уход", "Мойка без ограничений, подкраска при глубоком сколе"], ["Вид", "Матовый черный, строже и незаметнее"], ["Цена", "Доступнее нержавейки"]] },
];

const DELIVERY: Record<string, { icon: "home" | "truck" | "wrench"; note: string }> = {
  pickup: { icon: "home", note: "Из мастерской в рабочее время. Покажем, как ставить, и проверим крепеж" },
  shipping: { icon: "truck", note: "По всей России, в жесткой коробке, с крепежом и инструкцией. Срок и цена зависят от города" },
  install: { icon: "wrench", note: "Около 2,5 часа в мастерской по записи, машину забираете в тот же день" },
};

export default function About() {
  const { meta: site } = useSite();
  const c = site.contacts;
  const tel = telHref(c.phone);
  const tg = c.telegram ? telegramLink(c.telegram) : null;
  const methods = site.deliveryMethods;

  return (
    <>
      <section className="ph dark2 abt-head">
        <div className="wrap">
          <Crumbs items={[{ label: "Главная", to: "/" }, { label: "О компании" }]} />
          <div className="abt-head__row">
            <h1 className="ph__t" data-in="">О компании</h1>
            <p className="abt-lead" data-in="">{nb("ARMORIX делает стальную защиту бампера для китайских внедорожников и пикапов. Готовые комплекты для JAC T9 и Haval H3, под другие модели делаем по месту")}</p>
          </div>
          <ul className="abt-nums" data-stagger="">
            {NUMS.map((x) => (
              <li key={x.label} data-in="">
                <b className="num">{x.pre ? <small>{x.pre} </small> : null}<span data-count={x.n}>{x.shown}</span>{x.post ? <small> {x.post}</small> : null}</b>
                <span>{x.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="light sec abt-story">
        <div className="wrap abt-story__grid">
          <div className="abt-mosaic" data-stagger="">
            <div className="abt-mosaic__a" data-in=""><Illustration src="/img/shop-welder.webp" alt="Мастер варит стальную трубу" sizes="(max-width: 1023px) 100vw, 40vw" className="abt-fill" /></div>
            <div data-in=""><Illustration src="/img/steel-tubes.webp" alt="Стальные трубы на стеллаже" sizes="(max-width: 1023px) 50vw, 25vw" className="abt-fill" /></div>
            <div data-in=""><Illustration src="/img/install-rack.webp" alt="Защита на подъемнике" sizes="(max-width: 1023px) 50vw, 25vw" className="abt-fill" /></div>
          </div>
          <div className="abt-story__t" data-in="">
            <h2 className="h2">Как мы<br />работаем</h2>
            <p>{nb("Мы делаем стальную защиту бампера для китайских внедорожников и пикапов. Для JAC T9 и Haval H3 есть готовые комплекты, сделанные по замерам этих машин, для остальных моделей изготавливаем защиту под заказ")}</p>
            <p>{nb("Все делаем в своей мастерской: гибка трубы, сварка, полировка или порошковая окраска. Перед выдачей защиту примеряем на машину, чтобы она встала без доработок")}</p>
            <ul className="abt-rules">
              {RULES.map(([t, d]) => (
                <li key={t}><span className="abt-rules__i"><Icon name="check" size={18} /></span><div><strong>{t}</strong><span>{nb(d!)}</span></div></li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="dark sec abt-steps">
        <div className="wrap">
          <div className="abt-sh" data-in="">
            <h2 className="h2">Как делаем<br />защиту</h2>
            <p className="txt">От замера до примерки в одной мастерской</p>
          </div>
          <ol className="abt-steps__l" data-stagger="">
            {STEPS.map(([t, d, img], i) => (
              <li key={t} data-in="">
                <article className="abt-step ol">
                  <Illustration src={img!} alt="" dark ratio="16 / 10" sizes="(max-width: 767px) 100vw, (max-width: 1279px) 50vw, 33vw" />
                  <div className="abt-step__b">
                    <small className="D num">0{i + 1}</small>
                    <h3>{t}</h3>
                    <p>{nb(d!)}</p>
                  </div>
                </article>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="light sec abt-mats">
        <div className="wrap">
          <div className="abt-sh" data-in="">
            <h2 className="h2">Материалы</h2>
            <Link className="lnk" to="/catalog"><span className="lnk__t">Смотреть комплекты</span><span className="ol ar" aria-hidden="true"><Icon name="arrow" className="ico--go" /></span></Link>
          </div>
          <div className="abt-mats__l" data-stagger="">
            {MATS.map((m) => (
              <div key={m.t} data-in="">
                <article className="abt-mat ol">
                  <div className={`abt-sw ${m.cls}`}><span>{m.sw}</span></div>
                  <div className="abt-mat__b">
                    <h3 className="h4">{m.t}</h3>
                    <dl>{m.rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{nb(v!)}</dd></div>)}</dl>
                  </div>
                </article>
              </div>
            ))}
          </div>
          <p className="small abt-mats__n">Труба 63 или 76 мм, размеры и материал по каждому комплекту указаны на странице товара</p>
        </div>
      </section>

      <section className="sec abt-get" id="delivery">
        <div className="wrap">
          <div className="abt-sh" data-in="">
            <h2 className="h2">Установка<br />и доставка</h2>
            <p className="txt">Способ получения выбираете в подборке, менеджер подтвердит срок и цену</p>
          </div>
          <div className="abt-get__l" data-stagger="">
            {methods.map((m) => {
              const d = DELIVERY[m.code];
              return (
                <div key={m.code} data-in="">
                  <article className="abt-card ol">
                    <span className="abt-card__i"><Glyph name={d?.icon ?? "home"} size={24} /></span>
                    <h3>{m.label}</h3>
                    <p>{nb(d?.note ?? "")}</p>
                  </article>
                </div>
              );
            })}
            {c.address ? (
              <div data-in="" className="abt-get__map">
                <Link className="abt-map ol" to="/contacts">
                  <span className="abt-map__road" aria-hidden="true" />
                  <span className="cap">Мастерская</span>
                  <span className="abt-map__b">
                    <span>
                      <b>Как добраться<br />до мастерской</b>
                      <small>{c.address}</small>
                    </span>
                    <span className="ol ar" aria-hidden="true"><Icon name="arrow" className="ico--go" /></span>
                  </span>
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="dark2 sec abt-cta">
        <div className="wrap abt-cta__row">
          <div data-in="">
            <h2 className="h2">Подберем защиту<br />под вашу машину</h2>
            <p className="txt">Готовые комплекты для JAC T9 и Haval H3, для других моделей сделаем под заказ и покажем чертеж до оплаты</p>
          </div>
          <div className="abt-cta__go" data-in="">
            <div className="abt-cta__btns">
              <Link className="lnk" to="/contacts?type=custom"><span className="lnk__t">Сделать под мою модель</span><span className="ol ar" aria-hidden="true"><Icon name="arrow" className="ico--go" /></span></Link>
              <span className="lift"><Link className="btn btn--light btn--lg" to="/catalog">Смотреть каталог<Icon name="arrow" className="ico--go" /></Link></span>
            </div>
            {tel || tg ? (
              <p className="abt-line">
                <span>Или напрямую:</span>
                {tel ? <a href={tel} className="num">{c.phone}</a> : null}
                {tg ? <a href={tg.href} rel="noopener">Telegram {tg.label}</a> : null}
              </p>
            ) : null}
          </div>
        </div>
      </section>
    </>
  );
}
