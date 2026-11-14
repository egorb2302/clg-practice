import { useEffect, useRef, useState } from "react";
import { data, Link } from "react-router";
import type { Route } from "./+types/news";
import { assignArt, coverOf, type Post } from "../components/account/post";
import { Crumbs, Icon, Illustration } from "../components/site";
import { fmtDate } from "../lib/account";
import { apiRaw, PUBLIC_CACHE } from "../lib/api.server";
import { rootOrigin, seo } from "../lib/seo";
import { requireFeature } from "../lib/stub.server";
import css from "../styles/pages/news.css?url";

export const links: Route.LinksFunction = () => [{ rel: "stylesheet", href: css }];

export async function loader() {
  await requireFeature("news");
  const r = await apiRaw("GET", "/news");
  if (r.status === 404) throw data(null, { status: 404 });
  const items = r.status < 400 ? ((r.body as { items: Post[] }).items ?? []) : [];
  return data({ items, failed: r.status >= 400 }, { headers: { "Cache-Control": r.status < 400 ? PUBLIC_CACHE : "no-store" } });
}
export { pageHeaders as headers } from "../lib/headers";
export const meta: Route.MetaFunction = ({ matches }) =>
  seo({ title: "Новости мастерской", description: "Новости ARMORIX: новые модели защиты, изменения в комплектах и сроках изготовления", path: "/news", origin: rootOrigin(matches) });

const STEP = 6;

const when = (p: Post) => fmtDate(p.publishedAt ?? p.startsAt);

export default function News({ loaderData }: Route.ComponentProps) {
  const { items, failed } = loaderData;
  const [n, setN] = useState(STEP);
  const grid = useRef<HTMLUListElement>(null);
  const prev = useRef(STEP);
  const [feat, ...rest] = items;
  const shown = rest.slice(0, n);
  const art = assignArt(items, "news");

  useEffect(() => {
    if (n > prev.current) grid.current?.querySelectorAll<HTMLElement>("a")[prev.current]?.focus({ preventScroll: true });
    prev.current = n;
  }, [n]);

  return (
    <>
      <section className="nw-hd dark2">
        <div className="wrap">
          <Crumbs items={[{ label: "Главная", to: "/" }, { label: "Новости" }]} />
          <div className="nw-hd__row">
            <h1 className="nw-hd__t" data-in="">Новости</h1>
            <p className="nw-hd__p" data-in="">Что нового в мастерской: модели, которые сделали впервые, изменения в комплектах и сроках</p>
          </div>
        </div>
      </section>

      <section className="nw-sec light">
        <div className="wrap">
          {failed ? <p className="ferr" role="alert">Не удалось загрузить новости, обновите страницу через минуту</p> : null}
          {feat ? (
            <>
              <Link className="nw-feat ol" to={`/news/${feat.slug}`} prefetch="intent" data-in="">
                {(() => { const cv = coverOf(feat, "news", art); return <Illustration src={cv.src} alt="" label={cv.own} ratio="16 / 10" eager className="nw-feat__img" sizes="(max-width: 1023px) 100vw, 60vw" />; })()}
                <span className="nw-feat__b">
                  <time className="nw-meta" dateTime={feat.publishedAt ?? undefined}>{when(feat)}</time>
                  <span className="nw-feat__t D">{feat.title}</span>
                  {feat.summary ? <span className="nw-feat__d">{feat.summary}</span> : null}
                  <span className="lnk nw-feat__go"><span className="lnk__t">Читать</span><span className="ar ol" aria-hidden="true"><Icon name="arrow" /></span></span>
                </span>
              </Link>
              {shown.length ? (
                <ul className="nw-grid" ref={grid} data-stagger="">
                  {shown.map((p) => {
                    const cv = coverOf(p, "news", art);
                    return (
                      <li key={p.slug} data-in="">
                        <Link className="nw-card ol" to={`/news/${p.slug}`} prefetch="intent">
                          <Illustration src={cv.src} alt="" label={cv.own} sizes="(max-width: 767px) 100vw, (max-width: 1279px) 50vw, 33vw" />
                          <span className="nw-card__b">
                            <time className="nw-meta" dateTime={p.publishedAt ?? undefined}>{when(p)}</time>
                            <span className="nw-card__t D">{p.title}</span>
                            {p.summary ? <span className="nw-card__d">{p.summary}</span> : null}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
              {rest.length > n ? (
                <div className="nw-more">
                  <span className="lift lift--ink"><button type="button" className="btn btn--line ol" onClick={() => setN((x) => x + STEP)}>Показать еще</button></span>
                  <span className="nw-more__n">{shown.length + 1} из {items.length}</span>
                </div>
              ) : null}
            </>
          ) : !failed ? (
            <div className="nw-empty ol" role="status" data-in="">
              <h2 className="nw-empty__t">Новостей пока нет</h2>
              <p>Первая появится, когда сделаем новую модель или изменим комплекты. А пока можно посмотреть каталог и как устроена мастерская</p>
              <div className="nw-empty__a">
                <span className="lift lift--ink"><Link className="btn btn--dark" to="/catalog">В каталог<Icon name="arrow" className="ico--go" /></Link></span>
                <Link className="lnk" to="/about"><span className="lnk__t">О мастерской</span></Link>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}
