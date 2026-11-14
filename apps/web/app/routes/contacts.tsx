import { type ReactNode, useEffect, useState } from "react";
import { data, useSearchParams } from "react-router";
import type { Route } from "./+types/contacts";
import { Crumbs, Icon, Illustration, LeadForm, Tabs, VkMark } from "../components/site";
import { PUBLIC_CACHE } from "../lib/api.server";
import { nb, telegramLink } from "../lib/format";
import { rootOrigin, seo } from "../lib/seo";
import { telHref, useSite, vkLink } from "../lib/site";
import css from "../styles/pages/contacts.css?url";

export const links: Route.LinksFunction = () => [{ rel: "stylesheet", href: css }];
export const loader = () => data({}, { headers: { "Cache-Control": PUBLIC_CACHE } });
export { pageHeaders as headers } from "../lib/headers";
export const meta: Route.MetaFunction = ({ matches }) =>
  seo({ title: "Контакты", description: "Телефон, почта и телеграм ARMORIX, часы работы мастерской и форма вопроса или заявки на индивидуальное изготовление", path: "/contacts", origin: rootOrigin(matches) });

type Row = { id: string; icon: ReactNode; k: string; v: string; n: string; href?: string; ext?: boolean };

const NEXT = [
  "Менеджер ответит в рабочее время тем способом, который вы выбрали",
  "Для заказа под машину попросим фото бампера и точек крепления",
  "Чертеж и цену покажем до оплаты",
];

export default function Contacts() {
  const { meta: site } = useSite();
  const [sp] = useSearchParams();
  const want = sp.get("type") === "custom" ? "custom" : "general";
  const [tab, setTab] = useState<string>(want);
  useEffect(() => setTab(want), [want]);

  const c = site.contacts;
  const tg = c.telegram ? telegramLink(c.telegram) : null;
  const vk = vkLink(c.vk);
  const tel = telHref(c.phone);
  const rows: Row[] = ([
    c.phone ? { id: "phone", icon: <Icon name="phone" size={24} />, k: "Телефон", v: c.phone, n: "Звонок или сообщение", href: tel ?? undefined } : null,
    tg ? { id: "tg", icon: <Icon name="telegram" size={24} />, k: "Telegram", v: tg.label, n: "Фото машины удобнее присылать сюда", href: tg.href, ext: true } : null,
    vk ? { id: "vk", icon: <VkMark />, k: "ВКонтакте", v: vk.label, n: "Сообщения группы", href: vk.href, ext: true } : null,
    c.email ? { id: "mail", icon: <Icon name="mail" size={24} />, k: "Почта", v: c.email, n: "Ответим в течение рабочего дня", href: `mailto:${c.email}` } : null,
    c.address ? { id: "pin", icon: <Icon name="pin" size={24} />, k: "Мастерская", v: c.address, n: "Установка по записи" } : null,
    c.hours ? { id: "clock", icon: <Icon name="clock" size={24} />, k: "Часы работы", v: c.hours, n: "Звонки и сообщения в рабочее время" } : null,
  ] as (Row | null)[]).filter((r): r is Row => !!r);

  const q = c.address ? encodeURIComponent(c.address) : "";

  return (
    <>
      <section className="ph dark2">
        <div className="wrap">
          <Crumbs items={[{ label: "Главная", to: "/" }, { label: "Контакты" }]} />
          <div className="cnt-head">
            <h1 className="ph__t" data-in="">Контакты</h1>
            <p className="cnt-head__p" data-in="">Звоните, пишите или приезжайте в мастерскую. В рабочее время отвечаем без долгих ожиданий</p>
          </div>
        </div>
      </section>

      <section className="light sec cnt-main">
        <div className={`wrap cnt-grid`}>
          <ul className="cnt-list" data-stagger="">
            {rows.map((r) => {
              const body = (
                <>
                  <span className="cnt-it__i">{r.icon}</span>
                  <span className="cnt-it__t"><small>{r.k}</small><b>{r.v}</b></span>
                  <em>{nb(r.n)}</em>
                </>
              );
              return (
                <li key={r.id} data-in="">
                  {r.href ? <a className="cnt-it ol" href={r.href} {...(r.ext ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{body}</a> : <div className="cnt-it ol">{body}</div>}
                </li>
              );
            })}
            {!rows.length ? <li className="small">Контакты скоро появятся, а пока напишите нам через форму ниже</li> : null}
          </ul>

          {c.address ? (
            <div className="cnt-map ol" data-in="">
              <span className="cnt-map__road" aria-hidden="true" />
              <span className="cnt-pin" aria-hidden="true">
                <span>ARMORIX</span>
                <svg width="28" height="36" viewBox="0 0 24 30"><path d="M12 30S2 18 2 11a10 10 0 0120 0c0 7-10 19-10 19z" fill="currentColor" /><circle cx="12" cy="11" r="4" fill="#d9d9d6" /></svg>
              </span>
              <div className="cnt-route ol">
                <b className="h4">Как добраться</b>
                <p>{c.address}</p>
                {c.hours ? <p className="small">{c.hours}</p> : null}
                <div className="cnt-route__l">
                  <a className="cnt-ml" href={`https://yandex.ru/maps/?text=${q}`} target="_blank" rel="noopener noreferrer"><span>Яндекс Карты</span><Icon name="ext" size={16} /></a>
                  <a className="cnt-ml" href={`https://2gis.ru/search/${q}`} target="_blank" rel="noopener noreferrer"><span>2ГИС</span><Icon name="ext" size={16} /></a>
                </div>
              </div>
            </div>
          ) : (
            <div className="cnt-art" data-in=""><Illustration src="" alt="" caption="въезд и вывеска" className="cnt-fill" /></div>
          )}
        </div>
      </section>

      <section className="sec cnt-shop">
        <div className="wrap">
          <div className="cnt-sh" data-in="">
            <h2 className="h2">Мастерская</h2>
            <p className="txt">Можно приехать посмотреть готовые комплекты и образцы покрытия до заказа, установка по записи</p>
          </div>
          <div className="cnt-photos" data-stagger="">
            <div data-in=""><Illustration src="" alt="" caption="мастерская изнутри, подъемник с машиной" className="cnt-fill" /></div>
            <div data-in=""><Illustration src="" alt="" caption="образцы покрытия" className="cnt-fill" /></div>
            <div data-in=""><Illustration src="" alt="" caption="мастер за сваркой" className="cnt-fill" /></div>
          </div>
        </div>
      </section>

      <section className="dark2 sec cnt-form" id="contact-form">
        <div className="wrap cnt-form__grid">
          <div data-in="">
            <h2 className="h2">Напишите<br />нам</h2>
            <p className="txt">Вопрос про комплект, срок или установку, или заказ под машину, которой нет в каталоге</p>
            <ol className="cnt-next">
              {NEXT.map((t, i) => <li key={t}><b className="D num">0{i + 1}</b><span>{nb(t)}</span></li>)}
            </ol>
          </div>
          <div className="cnt-panel ol" data-in="">
            <Tabs
              label="Тип обращения"
              mode="swap"
              value={tab}
              onChange={setTab}
              className="cnt-tabs"
              tabs={[
                { id: "general", label: "Общий вопрос", content: <LeadForm type="general" submitLabel="Отправить" /> },
                { id: "custom", label: "Под мою машину", content: <LeadForm type="custom" submitLabel="Отправить заявку" /> },
              ]}
            />
          </div>
        </div>
      </section>
    </>
  );
}
