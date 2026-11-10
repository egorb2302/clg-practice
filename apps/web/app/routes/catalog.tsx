import { catalogQuery, type Facet } from "@armorix/contracts";
import { data, Link, useNavigation } from "react-router";
import type { Route } from "./+types/catalog";
import { ProductCard } from "../components/ProductCard";
import { Chip, Icon, Sbtn } from "../components/ui";
import { api, PUBLIC_CACHE } from "../lib/api.server";
import { nb, plural } from "../lib/format";
import { rootOrigin, seo } from "../lib/seo";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const parsed = catalogQuery.safeParse(Object.fromEntries(url.searchParams));
  const q = parsed.success ? parsed.data : { page: 1 };
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v !== undefined && !(k === "page" && v === 1)) qs.set(k, String(v));
  const [vehicles, catalog] = await Promise.all([api.vehicles(), api.catalog(qs)]);
  return data({ vehicles: vehicles.items, catalog, q, search: qs.toString() }, { headers: { "Cache-Control": PUBLIC_CACHE } });
}
export { pageHeaders as headers } from "../lib/headers";
export const meta: Route.MetaFunction = ({ data: d, matches }) => {
  const v = d?.vehicles.find((x) => x.slug === d.q.vehicle);
  return seo({
    title: v ? `Защита бампера ${v.label}` : "Каталог защиты бамперов",
    description: v ? `Передняя и задняя защита ${v.label} из стали AISI 304 и с порошковым покрытием, цены от, установка без сверления` : "Каталог стальной защиты бамперов для JAC T9 и Haval H3: передняя, задняя и комплекты, цены от",
    path: `/catalog${d?.search ? `?${d.search}` : ""}`,
    origin: rootOrigin(matches),
  });
};

const VIMG: Record<string, string> = { "jac-t9": "/img/truck-s.webp", "haval-h3": "/img/road-mud-s.webp" };

export default function Catalog({ loaderData }: Route.ComponentProps) {
  const { vehicles, catalog, q, search } = loaderData;
  const nav = useNavigation();
  const loading = nav.state === "loading" && nav.location.pathname === "/catalog";
  const vehicle = vehicles.find((v) => v.slug === q.vehicle);
  const pages = Math.max(1, Math.ceil(catalog.total / catalog.pageSize));
  const back = `/catalog${search ? `?${search}` : ""}`;

  /** build a link that changes one filter and resets the page */
  const href = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams(search);
    for (const [k, v] of Object.entries(patch)) { if (v) p.set(k, v); else p.delete(k); }
    if (!("page" in patch)) p.delete("page");
    const s = p.toString();
    return `/catalog${s ? `?${s}` : ""}`;
  };
  const group = (name: string, key: "position" | "material", facets: Facet[]) =>
    facets.length >= 2 ? (
      <div className="fl" role="group" aria-label={name}>
        <span className="fl__t">{name}</span>
        <Link className="fl__o" to={href({ [key]: undefined })} aria-current={!q[key] ? "true" : undefined} preventScrollReset>Все</Link>
        {facets.map((f) => (
          <Link key={f.value} className="fl__o" to={href({ [key]: q[key] === f.value ? undefined : f.value })} aria-current={q[key] === f.value ? "true" : undefined} preventScrollReset>
            {f.label}<span className="num">{f.count}</span>
          </Link>
        ))}
      </div>
    ) : null;

  return (
    <>
      <section className="ph wrap">
        <div className="ph__txt" data-in="">
          <p className="crumbs"><Link to="/" className="chip"><span>Главная</span></Link><span className="chip"><span>Каталог</span></span></p>
          <h1 className="tt"><span>{vehicle ? `Защита для ${vehicle.label}` : "Каталог защиты"}</span><span className="mute">{catalog.total} {plural(catalog.total, ["позиция", "позиции", "позиций"])} {vehicle ? "для этой модели" : "для двух моделей"}</span></h1>
          <p className="t-lead">{nb("Выберите машину, затем тип защиты и материал, цена «от» считается для выбранной комбинации")}</p>
        </div>
        <nav className="vt" aria-label="Автомобиль" data-stagger="">
          <Link className="vt__i" to="/catalog" aria-current={!q.vehicle ? "true" : undefined} preventScrollReset data-in="">
            <span className="vt__img vt__img--all"><img src="/img/steel-chrome-s.webp" alt="" loading="lazy" /></span>
            <b>Все модели</b>
          </Link>
          {vehicles.map((v) => (
            <Link key={v.slug} className="vt__i" to={`/catalog?vehicle=${v.slug}`} aria-current={q.vehicle === v.slug ? "true" : undefined} preventScrollReset data-in="">
              <span className="vt__img">{VIMG[v.slug] ? <img src={VIMG[v.slug]} alt="" loading="lazy" /> : null}</span>
              <b>{v.label}</b>
            </Link>
          ))}
          <Link className="vt__i vt__i--custom" to="/contacts?type=custom" data-in="">
            <span className="vt__img vt__img--plus"><Icon name="plus" /></span>
            <b>Другая модель</b>
          </Link>
        </nav>
      </section>

      <section className="wrap cat" aria-labelledby="cat-h" aria-busy={loading}>
        <h2 className="sr" id="cat-h">Товары</h2>
        <div className="cat__bar">
          {group("Тип защиты", "position", catalog.filters.position)}
          {group("Материал", "material", catalog.filters.material)}
          {(q.position || q.material) ? <Link className="tlink" to={href({ position: undefined, material: undefined })} preventScrollReset>Сбросить фильтры</Link> : null}
        </div>

        {catalog.items.length ? (
          <div className={`grid-cards${loading ? " is-loading" : ""}`} data-stagger="">
            {catalog.items.map((p) => <ProductCard key={p.slug} p={p} back={back} />)}
          </div>
        ) : (
          <div className="empty">
            <Chip>Ничего не нашлось</Chip>
            <h2 className="tt"><span>Под эти фильтры комплектов нет</span><span className="mute">Сбросьте их или закажите свой</span></h2>
            <div className="empty__go">
              <Sbtn to={href({ position: undefined, material: undefined })} className="sbtn--lg">Сбросить фильтры</Sbtn>
              <Link className="tlink" to="/contacts?type=custom">Индивидуальный заказ</Link>
            </div>
          </div>
        )}

        {pages > 1 ? (
          <nav className="pager" aria-label="Страницы">
            {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
              <Link key={n} to={href({ page: n === 1 ? undefined : String(n) })} aria-current={n === q.page ? "page" : undefined} className="pager__n num">{n}</Link>
            ))}
          </nav>
        ) : null}

        <aside className="cat__custom">
          <div>
            <b>{nb("Не нашли свою модель?")}</b>
            <p>{nb("Сделаем защиту по замерам вашей машины, на штатные точки и без сверления")}</p>
          </div>
          <Sbtn to="/contacts?type=custom">Индивидуальный заказ</Sbtn>
        </aside>
      </section>
    </>
  );
}

export function ErrorBoundary() {
  return (
    <section className="sec wrap err">
      <h1 className="tt"><span>Каталог не загрузился</span><span className="mute">Попробуйте обновить страницу</span></h1>
      <p><a className="tlink" href="/catalog">Обновить</a></p>
    </section>
  );
}
