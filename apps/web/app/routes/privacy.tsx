import { useEffect, useState } from "react";
import { data } from "react-router";
import type { Route } from "./+types/privacy";
import { Crumbs } from "../components/site";
import { PUBLIC_CACHE } from "../lib/api.server";
import { nb } from "../lib/format";
import { LEGAL, LEGAL_VERSION } from "../lib/legal";
import { rootOrigin, seo } from "../lib/seo";
import css from "../styles/pages/privacy.css?url";

export const links: Route.LinksFunction = () => [{ rel: "stylesheet", href: css }];
export const loader = () => data({}, { headers: { "Cache-Control": PUBLIC_CACHE } });
export { pageHeaders as headers } from "../lib/headers";
export const meta: Route.MetaFunction = ({ matches }) =>
  seo({ title: "Обработка персональных данных", description: "Какие данные ARMORIX получает из заявок и рассылки, зачем, где хранит и как их удалить", path: "/privacy", origin: rootOrigin(matches) });

export default function Privacy() {
  const [active, setActive] = useState(LEGAL[0]!.id as string);

  useEffect(() => {
    const els = LEGAL.map((d) => document.getElementById(d.id)).filter((e): e is HTMLElement => !!e);
    const fromHash = location.hash.slice(1);
    if (LEGAL.some((d) => d.id === fromHash)) setActive(fromHash);
    const io = new IntersectionObserver((es) => {
      const hit = es.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (hit) setActive(hit.target.id);
    }, { rootMargin: "-20% 0px -60% 0px", threshold: [0, .25, .5, 1] });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);

  return (
    <>
      <section className="ph dark2">
        <div className="wrap">
          <Crumbs items={[{ label: "Главная", to: "/" }, { label: "Документы" }]} />
          <h1 className="ph__t prv-h1" data-in="">Обработка<br />персональных данных</h1>
          <p className="ph__sub" data-in="">{LEGAL_VERSION}</p>
        </div>
      </section>

      <section className="light sec prv-body">
        <div className="wrap prv-grid">
          <nav className="prv-toc" aria-label="Документы">
            <p className="cap">Документы</p>
            <ol>
              {LEGAL.map((d) => (
                <li key={d.id}>
                  <a className="prv-toc__a ol" href={`#${d.id}`} aria-current={active === d.id ? "true" : undefined}>{d.title}</a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="prv-docs">
            {LEGAL.map((d) => (
              <article key={d.id} id={d.id} className="prv-doc" data-in="">
                <h2 className="h3 prv-doc__t">{d.title}</h2>
                {d.sections.map(([h, t], i) => (
                  <section key={i} className={h ? "prv-sec" : "prv-lead"}>
                    {h ? <h3 className="prv-sec__h">{h}</h3> : null}
                    <p>{nb(t)}</p>
                  </section>
                ))}
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
