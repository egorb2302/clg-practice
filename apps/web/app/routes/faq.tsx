import { useId, useMemo, useState } from "react";
import { Link } from "react-router";
import type { Route } from "./+types/faq";
import { Glyph } from "../components/pages/glyphs";
import { Collapse, Crumbs, Icon, VkMark } from "../components/site";
import { nb, plural, telegramLink } from "../lib/format";
import { rootOrigin, seo } from "../lib/seo";
import { telHref, useSite, vkLink } from "../lib/site";
import { requireFeature } from "../lib/stub.server";
import css from "../styles/pages/faq.css?url";

export const links: Route.LinksFunction = () => [{ rel: "stylesheet", href: css }];
export const loader = () => requireFeature(null);
export { pageHeaders as headers } from "../lib/headers";
export const meta: Route.MetaFunction = ({ matches }) =>
  seo({ title: "Вопросы и ответы", description: "Ответы ARMORIX про защиту бампера: совместимость, покрытие, сроки, доставка и установка", path: "/faq", origin: rootOrigin(matches) });

type QA = { id: string; q: string; a: string };
type Group = { id: string; title: string; items: QA[] };

function groups(f: { account: boolean; loyalty: boolean }): Group[] {
  const lead: QA[] = [
    { id: "lead-0", q: "Что происходит после заявки?", a: "Менеджер перезвонит в рабочее время, проверит совместимость и назовет точную цену. Номер заявки вы увидите на экране сразу после отправки" },
  ];
  if (f.loyalty) lead.push({ id: "lead-1", q: "Как получить приветственные баллы?", a: "1 000 баллов за первую заявку из каталога или на изготовление, один раз на кабинет. 1 балл равен 1 ₽, баллы действуют 180 дней, ими можно оплатить до 20% покупки. Если отправили заявку без входа, баллы появятся после подтверждения контакта в кабинете" });
  if (f.account) lead.push({ id: "lead-2", q: "Зачем входить в кабинет?", a: "В кабинете видны заявки и их статус, подтвержденные покупки, баллы и подписка" });
  const parts = ["Заявка", ...(f.account ? ["кабинет"] : []), ...(f.loyalty ? ["бонусы"] : [])];
  const leadTitle = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} и ${parts[parts.length - 1]}` : parts[0]!;
  return [
    { id: "fit", title: "Подбор и совместимость", items: [
      { id: "fit-0", q: "Подойдет ли защита к моей комплектации?", a: "Готовые комплекты сделаны по замерам JAC T9 и Haval H3, совместимость с годом выпуска указана в карточке товара. Если стоит лебедка, фаркоп или другой бампер, пришлите фото: проверим бесплатно до заявки" },
      { id: "fit-1", q: "Моей машины нет в каталоге. Сделаете?", a: "Да, под заказ: снимем размеры по фото или на месте, покажем чертеж до оплаты и примерим на машине. Изготовление занимает от четырех недель" },
      { id: "fit-2", q: "Не закроет ли защита датчики и камеру?", a: "Фаркоп, парктроники и штатная камера остаются рабочими. Если датчики стоят нестандартно, проверим по фото" },
    ] },
    { id: "steel", title: "Материал и покрытие", items: [
      { id: "steel-0", q: "Чем нержавейка отличается от черной порошковой?", a: "Нержавеющая сталь AISI 304 с зеркальной полировкой не ржавеет и не требует покраски. Черная сталь с порошковой краской дешевле и смотрится строже, скол подкрашивается" },
      { id: "steel-1", q: "Какой толщины труба?", a: "Основная труба 63 или 76 мм, стенка 2 мм. Размеры по каждому комплекту указаны на странице товара" },
      { id: "steel-2", q: "Как ухаживать за защитой?", a: "Мойка высоким давлением и реагенты не страшны. Нержавейку не нужно полировать и подкрашивать, порошковую подкрашивают только при глубоком сколе" },
    ] },
    { id: "install", title: "Установка", items: [
      { id: "install-0", q: "Нужно ли сверлить кузов?", a: "Нет, кронштейны встают в заводские отверстия рамы, кузов и покрытие остаются целыми. Бампер снимать не нужно" },
      { id: "install-1", q: "Сколько занимает установка у вас?", a: "Около 2,5 часа в мастерской по записи, машину забираете в тот же день" },
      { id: "install-2", q: "Можно поставить самому?", a: "Да, в комплекте весь крепеж и инструкция с фото. Если что-то не сходится, менеджер поможет" },
    ] },
    { id: "price", title: "Цена, доставка, оплата", items: [
      { id: "price-0", q: "Почему на сайте цена «от»?", a: "Окончательная стоимость зависит от комплектации и подтверждается менеджером. Цена «от» значит самый доступный вариант покрытия для этой машины" },
      { id: "price-1", q: "Как оплатить?", a: "На сайте ничего не оплачивается. Менеджер перезвонит, подтвердит цену и срок, оплата после согласования" },
      { id: "price-2", q: "Доставляете в другие города?", a: "Да, транспортной компанией до терминала или до двери в любой регион России, в жесткой коробке. Стоимость и срок зависят от города, их назовет менеджер. Самовывоз из мастерской бесплатно" },
      { id: "price-3", q: "Сколько ждать комплект?", a: "Комплекты для JAC T9 и Haval H3 обычно есть на складе, изготовление под новую модель занимает от четырех недель" },
    ] },
    { id: "warranty", title: "Гарантия", items: [
      { id: "warranty-0", q: "Какая гарантия?", a: "Гарантия распространяется на сварку и покрытие, ее срок менеджер назовет вместе с ценой. Действует при установке у нас или по инструкции из комплекта" },
      { id: "warranty-1", q: "Что если зацепил защиту?", a: "Выправим или заменим одну деталь, а не всю защиту целиком. Стоимость скажем по фото" },
    ] },
    { id: "lead", title: leadTitle, items: lead },
  ];
}

function Item({ qa, open, onToggle }: { qa: QA; open: boolean; onToggle: () => void }) {
  const id = useId();
  return (
    <div data-in="">
      <div className={`faq-w${open ? " is-open" : ""}`}>
        <div className="faq-q ol">
          <h3>
            <button type="button" className="faq-q__b" aria-expanded={open} aria-controls={id} onClick={onToggle}>
              <span className="faq-q__t">{nb(qa.q)}</span>
              <span className="faq-sign" aria-hidden="true"><i /><i /></span>
            </button>
          </h3>
          <Collapse open={open} id={id}><p className="faq-a">{nb(qa.a)}</p></Collapse>
        </div>
      </div>
    </div>
  );
}

export default function Faq() {
  const { meta: site } = useSite();
  const all = useMemo(() => groups({ account: site.features.account, loyalty: site.features.loyalty }), [site.features.account, site.features.loyalty]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [opened, setOpened] = useState<Record<string, boolean>>({ "fit-0": true });
  const needle = q.trim().toLowerCase();

  const matches = (x: QA) => !needle || `${x.q} ${x.a}`.toLowerCase().includes(needle);
  const counted = all.map((g) => ({ ...g, hits: g.items.filter(matches) }));
  const total = counted.reduce((t, g) => t + g.hits.length, 0);
  const shown = counted.filter((g) => (cat === "all" || g.id === cat) && g.hits.length);
  const shownTotal = shown.reduce((t, g) => t + g.hits.length, 0);
  const auto = !!needle && shownTotal <= 3;
  const isOpen = (id: string) => opened[id] ?? auto;
  const toggle = (id: string) => setOpened((o) => ({ ...o, [id]: !isOpen(id) }));
  const reset = () => { setQ(""); setCat("all"); };

  const c = site.contacts;
  const tel = telHref(c.phone);
  const tg = c.telegram ? telegramLink(c.telegram) : null;
  const vk = vkLink(c.vk);
  const ld = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: all.flatMap((g) => g.items).map((x) => ({ "@type": "Question", name: x.q, acceptedAnswer: { "@type": "Answer", text: x.a } })),
  }).replace(/</g, "\\u003c");
  const n = (k: number) => `${k} ${plural(k, ["вопрос", "вопроса", "вопросов"])}`;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ld }} />
      <section className="ph dark2 faq-head">
        <div className="wrap">
          <Crumbs items={[{ label: "Главная", to: "/" }, { label: "Вопросы и ответы" }]} />
          <div className="faq-head__row">
            <div data-in="">
              <h1 className="ph__t">Вопросы<br />и ответы</h1>
              <p className="ph__sub">
                Собрали то, что спрашивают владельцы перед покупкой и после установки.{tel ? <> Не нашли свой вопрос, позвоните <a className="faq-tel num" href={tel}>{c.phone}</a>, ответим по вашей машине</> : " Не нашли свой вопрос, напишите нам, ответим по вашей машине"}
              </p>
            </div>
            <div className="faq-search" data-in="">
              <label htmlFor="faq-s">Поиск по вопросам</label>
              <span className="faq-search__f">
                <span className="faq-search__i"><Glyph name="search" /></span>
                <input id="faq-s" className="in" type="search" autoComplete="off" placeholder="Датчики, гарантия, доставка" value={q} onChange={(e) => setQ(e.target.value)} />
                {q ? <button type="button" className="faq-search__x" onClick={() => setQ("")}>Очистить</button> : null}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="light sec faq-body">
        <div className="wrap faq-grid">
          <aside className="faq-cats" aria-label="Разделы вопросов">
            <p className="cap">Разделы</p>
            <div className="faq-cats__l">
              {[{ id: "all", title: "Все вопросы", k: total }, ...counted.map((g) => ({ id: g.id, title: g.title, k: g.hits.length }))].map((x) => (
                <button key={x.id} type="button" className={`faq-cat ol${x.k === 0 ? " is-zero" : ""}`} aria-pressed={cat === x.id} onClick={() => setCat(x.id)}>
                  <span>{x.title}</span><small className="num">{x.k}</small>
                </button>
              ))}
            </div>
            {tel ? (
              <div className="faq-help">
                <span>Не нашли ответ? Позвоните, в рабочее время отвечаем сразу</span>
                <a className="faq-tel num" href={tel}>{c.phone}</a>
                {c.hours ? <span className="small">{c.hours}</span> : null}
              </div>
            ) : null}
          </aside>

          <div className="faq-main">
            {needle ? <p className="faq-found" role="status" aria-live="polite">{total ? `Нашли ${total} ${plural(total, ["ответ", "ответа", "ответов"])} по запросу «${q.trim()}»` : ""}</p> : null}
            {shown.map((g) => (
              <div key={g.id} className="faq-grp">
                <h2 className="faq-grp__h"><span>{g.title}</span><small>{n(g.hits.length)}</small></h2>
                <div className="faq-list" data-stagger="">
                  {g.hits.map((x) => <Item key={x.id} qa={x} open={isOpen(x.id)} onToggle={() => toggle(x.id)} />)}
                </div>
              </div>
            ))}
            {total === 0 ? (
              <div className="faq-empty ol" role="status">
                <h2 className="h3">Такого вопроса пока нет</h2>
                <p className="txt">По запросу «{q.trim()}» ничего не нашли. Спросите менеджера: ответим по телефону или в Telegram, а частые вопросы добавим сюда</p>
                <div className="faq-empty__go">
                  <span className="lift"><Link className="btn btn--dark" to="/contacts">Задать вопрос<Icon name="arrow" className="ico--go" /></Link></span>
                  <button type="button" className="flink" onClick={reset}>Показать все вопросы</button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="dark2 sec faq-ask">
        <div className="wrap faq-ask__grid">
          <div data-in="">
            <h2 className="h2">Не нашли<br />свой вопрос?</h2>
            <p className="txt">Ответим по вашей машине: про совместимость, сроки и цену. На сайте ничего не оплачивается</p>
          </div>
          <div className="faq-ways" data-stagger="">
            {tel ? <div data-in=""><a className="faq-way ol" href={tel}><span className="faq-way__i"><Icon name="phone" size={22} /></span><b>Позвонить</b><span>{c.phone}{c.hours ? `, ${c.hours}` : ""}</span></a></div> : null}
            {tg ? <div data-in=""><a className="faq-way ol" href={tg.href} rel="noopener"><span className="faq-way__i"><Icon name="telegram" size={22} /></span><b>Telegram</b><span>{tg.label}, можно прислать фото машины</span></a></div> : null}
            {vk ? <div data-in=""><a className="faq-way ol" href={vk.href} rel="noopener"><span className="faq-way__i"><VkMark /></span><b>ВКонтакте</b><span>{vk.label}</span></a></div> : null}
            <div data-in=""><Link className="faq-way ol" to="/contacts"><span className="faq-way__i"><Icon name="chat" size={22} /></span><b>Написать вопрос</b><span>Форма на странице контактов, ответим удобным способом</span></Link></div>
          </div>
        </div>
      </section>
    </>
  );
}
