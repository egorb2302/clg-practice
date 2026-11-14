import { data, Link } from "react-router";
import type { Route } from "./+types/news-post";
import { coverOf, type Post, PostBody, readMinutes } from "../components/account/post";
import { Crumbs, Icon, Illustration } from "../components/site";
import { fmtDate, fmtLong } from "../lib/account";
import { apiRaw, PUBLIC_CACHE } from "../lib/api.server";
import { plural } from "../lib/format";
import { rootOrigin, seo } from "../lib/seo";
import { requireFeature } from "../lib/stub.server";
import css from "../styles/pages/news.css?url";

export const links: Route.LinksFunction = () => [{ rel: "stylesheet", href: css }];

export async function loader({ params }: Route.LoaderArgs) {
  await requireFeature("news");
  const [one, list] = await Promise.all([apiRaw("GET", `/news/${encodeURIComponent(params.slug)}`), apiRaw("GET", "/news").catch(() => null)]);
  if (one.status === 404) throw data(null, { status: 404 });
  if (one.status >= 400) throw data(null, { status: 502 });
  const post = (one.body as { post: Post }).post;
  const all = list && list.status < 400 ? ((list.body as { items: Post[] }).items ?? []) : [];
  const more = all.filter((p) => p.slug !== post.slug).slice(0, 3);
  return data({ post, more }, { headers: { "Cache-Control": PUBLIC_CACHE } });
}
export { pageHeaders as headers } from "../lib/headers";
export const meta: Route.MetaFunction = ({ data: d, matches, params }) => {
  const p = d?.post;
  return seo({
    title: p ? p.title : "Новость",
    description: p?.summary || "Новости мастерской ARMORIX: новые модели защиты, комплекты и сроки",
    path: `/news/${params.slug}`,
    origin: rootOrigin(matches),
    image: p?.coverUrl && /^https?:\/\//.test(p.coverUrl) ? p.coverUrl : undefined,
  });
};

export default function NewsPost({ loaderData }: Route.ComponentProps) {
  const { post: p, more } = loaderData;
  const cv = coverOf(p, "news");
  const min = readMinutes(`${p.summary} ${p.body ?? ""}`);
  const date = p.publishedAt ?? p.startsAt;

  return (
    <>
      <section className="nw-ph dark2">
        <div className="wrap">
          <Crumbs items={[{ label: "Главная", to: "/" }, { label: "Новости", to: "/news" }, { label: p.title }]} />
          <p className="nw-ph__meta" data-in="">{date ? <time dateTime={date}>{fmtLong(date)}</time> : null}{date ? <span aria-hidden="true">·</span> : null}<span>{min} {plural(min, ["минута", "минуты", "минут"])} чтения</span></p>
          <h1 className="nw-ph__t" data-in="">{p.title}</h1>
          {p.summary ? <p className="nw-ph__lead" data-in="">{p.summary}</p> : null}
        </div>
      </section>

      <section className="nw-psec light">
        <div className="wrap nw-pgrid">
          <article className="nw-art">
            <div data-in=""><Illustration src={cv.src} alt="" label={cv.own} ratio="16 / 9" eager crop={cv.own} className="cut nw-art__img" sizes="(max-width: 1023px) 100vw, 60vw" /></div>
            {p.body ? <PostBody text={p.body} className="nw-body" /> : null}
          </article>
          <aside className="nw-aside" aria-label="Еще по теме">
            <div className="nw-cta ol" data-in="">
              <b className="D">Нужна защита под вашу машину?</b>
              <span>Подберем комплект из каталога или сделаем под заказ и покажем чертеж до оплаты</span>
              <span className="lift lift--block"><Link className="btn btn--light btn--block" to="/catalog">Подобрать комплект</Link></span>
              <Link className="lnk lnk--sm" to="/contacts"><span className="lnk__t">Рассчитать под заказ</span><span className="ar ol" aria-hidden="true"><Icon name="arrow" /></span></Link>
            </div>
            {more.length ? (
              <nav className="nw-side ol" aria-label="Другие новости" data-in="">
                <span className="nw-cap">Другие новости</span>
                {more.map((m) => (
                  <Link key={m.slug} to={`/news/${m.slug}`} prefetch="intent"><time>{fmtDate(m.publishedAt ?? m.startsAt)}</time><span>{m.title}</span></Link>
                ))}
                <Link className="lnk lnk--sm nw-side__all" to="/news"><span className="lnk__t">Все новости</span></Link>
              </nav>
            ) : null}
          </aside>
        </div>
      </section>

      {more.length ? (
        <section className="nw-next">
          <div className="wrap">
            <h2 className="nw-next__t" data-in="">Читать еще</h2>
            <ul className="nw-grid nw-grid--next" data-stagger="">
              {more.map((m) => {
                const c = coverOf(m, "news");
                return (
                  <li key={m.slug} data-in="">
                    <Link className="nw-card ol" to={`/news/${m.slug}`} prefetch="intent">
                      <Illustration src={c.src} alt="" label={c.own} ratio="16 / 9" sizes="(max-width: 767px) 100vw, 33vw" />
                      <span className="nw-card__b">
                        <time className="nw-meta">{fmtDate(m.publishedAt ?? m.startsAt)}</time>
                        <span className="nw-card__t D">{m.title}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      ) : null}
    </>
  );
}
