import { data, useRouteLoaderData, useSearchParams } from "react-router";
import type { Route } from "./+types/contacts";
import { LeadForm } from "../components/LeadForm";
import { Icon, Img, Tt } from "../components/ui";
import { PUBLIC_CACHE } from "../lib/api.server";
import { nb } from "../lib/format";
import { rootOrigin, seo } from "../lib/seo";
import type { loader as rootLoader } from "../root";

export const loader = () => data({}, { headers: { "Cache-Control": PUBLIC_CACHE } });
export { pageHeaders as headers } from "../lib/headers";
export const meta: Route.MetaFunction = ({ matches }) =>
  seo({ title: "Контакты", description: "Телефон, почта и телеграм ARMORIX, часы работы мастерской и форма вопроса или заявки на индивидуальное изготовление", path: "/contacts", origin: rootOrigin(matches) });

export default function Contacts() {
  const root = useRouteLoaderData<typeof rootLoader>("root");
  const [sp] = useSearchParams();
  const type = sp.get("type") === "custom" ? "custom" : "general";
  const c = root?.meta.contacts ?? {};
  const rows = [
    c.phone ? { ic: "phone", k: "Телефон", v: <a className="num" href={`tel:${c.phone.replace(/[^\d+]/g, "")}`}>{c.phone}</a>, n: "Звонок или сообщение" } : null,
    c.telegram ? { ic: "tg", k: "Телеграм", v: <a href={`https://t.me/${c.telegram}`} rel="noopener">@{c.telegram}</a>, n: "Фото машины удобнее присылать сюда" } : null,
    c.email ? { ic: "mail", k: "Почта", v: <a href={`mailto:${c.email}`}>{c.email}</a>, n: "Ответим в течение рабочего дня" } : null,
    c.hours ? { ic: "clock", k: "Часы работы", v: <span>{c.hours}</span>, n: "Установка по записи" } : null,
    c.address ? { ic: "pin", k: "Мастерская", v: <span>{c.address}</span>, n: "Адрес пришлем после записи" } : null,
  ].filter(Boolean) as { ic: string; k: string; v: React.ReactNode; n: string }[];

  return (
    <section className="ct frame">
      <div className="frame__bg"><Img src="/img/taiga-spruce.webp" alt="" eager /></div>
      <div className="ct__grid">
        <div className="ct__side" data-in="">
          <p className="crumbs"><span className="chip"><span>Контакты</span></span></p>
          <h1 className="tt"><span>Свяжитесь с нами</span><span className="mute">удобным способом</span></h1>
          <ul className="ct__rows">
            {rows.map((r) => (
              <li key={r.k}><Icon name={r.ic} /><span className="ct__k">{r.k}</span><b>{r.v}</b><em>{nb(r.n)}</em></li>
            ))}
          </ul>
        </div>
        <div className="lg" data-in="">
          <div className="lg__in">
            <Tt a={type === "custom" ? "Изготовим под вашу модель" : "Задайте вопрос"} b={type === "custom" ? "расскажите о машине" : "или опишите задачу"} />
            <LeadForm type={type} switchable submitLabel="Отправить" />
          </div>
        </div>
      </div>
    </section>
  );
}
