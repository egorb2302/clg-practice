import { data } from "react-router";
import type { Route } from "./+types/privacy";
import { PUBLIC_CACHE } from "../lib/api.server";
import { rootOrigin, seo } from "../lib/seo";

export const loader = () => data({}, { headers: { "Cache-Control": PUBLIC_CACHE } });
export const headers: Route.HeadersFunction = ({ loaderHeaders }) => loaderHeaders;
export const meta: Route.MetaFunction = ({ matches }) =>
  seo({ title: "Обработка персональных данных", description: "Как ARMORIX обрабатывает данные из заявок и рассылки", path: "/privacy", origin: rootOrigin(matches) });

export default function Privacy() {
  return (
    <section className="sec wrap doc">
      <p className="crumbs"><span className="chip"><span>Документ</span></span></p>
      <h1 className="tt"><span>Обработка персональных данных</span><span className="mute">Текст готовится</span></h1>
      <div className="doc__body">
        <p>Здесь будет политика обработки персональных данных и текст согласия на рассылку</p>
        <p>Пока текст на согласовании, мы используем данные из заявки только для ответа на нее</p>
      </div>
    </section>
  );
}
