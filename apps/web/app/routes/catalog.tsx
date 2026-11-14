import type { Vehicle as KitVehicle } from "@armorix/contracts";
import { useCallback, useEffect, useRef, useState } from "react";
import { data, Link, useLocation, useNavigate, useNavigation, useRevalidator } from "react-router";
import type { Route } from "./+types/catalog";
import { CardSkeleton, CustomStrip, SimilarWorks, StateBox, TrustStrip } from "../components/catalog/CatalogBlocks";
import { CatIcon } from "../components/catalog/CatIcon";
import { fetchAllCards } from "../components/catalog/catalog.server";
import { FilterPanel } from "../components/catalog/FilterPanel";
import { buildCatalog, catHref, cardKey, type CatQuery, parseQuery } from "../components/catalog/model";
import { Crumbs, Icon, ProductCard } from "../components/site";
import { api, PUBLIC_CACHE } from "../lib/api.server";
import { plural, rubles } from "../lib/format";
import { rootOrigin, seo } from "../lib/seo";
import { telHref, useSite } from "../lib/site";
import { hasKit } from "../lib/vehicles-catalog";
import { useVehicle, vehicle as vehicleStore, type Vehicle } from "../lib/vehicle";
import css from "../styles/pages/catalog.css?url";

export const links: Route.LinksFunction = () => [{ rel: "stylesheet", href: css }];

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const q = parseQuery(url.searchParams);
  try {
    const [vehicles, all] = await Promise.all([api.vehicles().then((r) => r.items), fetchAllCards()]);
    const view = buildCatalog(all, vehicles, q);
    return data({ ok: true as const, view }, { headers: { "Cache-Control": PUBLIC_CACHE } });
  } catch {
    return data({ ok: false as const, q }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
export { pageHeaders as headers } from "../lib/headers";

export const meta: Route.MetaFunction = ({ data: d, matches }) => {
  const v = d?.ok ? d.view.vehicle : null;
  return seo({
    title: v ? `Защита бампера ${v.label}` : "Каталог защиты бамперов",
    description: v
      ? `Передняя, задняя защита и комплекты для ${v.label}: нержавейка AISI 304 или черная порошковая, на штатные точки без сверления, цены от`
      : "Каталог стальной защиты бамперов для китайских внедорожников: передняя, задняя и комплекты, на штатные точки без сверления, цены от",
    path: v ? `/catalog?vehicle=${encodeURIComponent(v.slug)}` : "/catalog",
    origin: rootOrigin(matches),
  });
};

const same = (a: Vehicle, b: Vehicle) => (a?.label ?? "") === (b?.label ?? "") && (a?.mode ?? "") === (b?.mode ?? "");

export default function Catalog({ loaderData }: Route.ComponentProps) {
  const { vehicles: kitVehicles, meta } = useSite();
  const car = useVehicle();
  const navigate = useNavigate();
  const nav = useNavigation();
  const loc = useLocation();
  const reval = useRevalidator();
  const [sheet, setSheet] = useState(false);
  const closeSheet = useCallback(() => setSheet(false), []);

  const q: CatQuery = loaderData.ok ? loaderData.view.q : loaderData.q;
  const navToCatalog = nav.state === "loading" && nav.location.pathname === "/catalog";
  const pending = navToCatalog ? parseQuery(new URLSearchParams(nav.location.search)) : q;
  const contextChange = navToCatalog && (pending.vehicle ?? "") !== (q.vehicle ?? "");
  const moreLoading = navToCatalog && !contextChange && pending.page > q.page;

  const prev = useRef<Vehicle | undefined>(undefined);
  useEffect(() => {
    if (prev.current === undefined) {
      prev.current = vehicleStore.get();
      const c = prev.current;
      if (!q.vehicle && c?.mode === "kit" && kitVehicles.some((v) => v.slug === c.slug)) {
        navigate(catHref({ vehicle: c.slug, sort: q.sort }), { replace: true, preventScrollReset: true });
      }
      return;
    }
    if (same(prev.current, car)) return;
    prev.current = car;
    const want = car?.mode === "kit" ? car.slug : undefined;
    if (want !== q.vehicle) navigate(catHref({ vehicle: want, sort: q.sort }), { preventScrollReset: true });
  }, [car]); // eslint-disable-line react-hooks/exhaustive-deps

  const pickVehicle = (slug: string) => {
    const v = kitVehicles.find((x) => x.slug === slug);
    if (v) vehicleStore.set({ mode: "kit", slug: v.slug, label: v.label });
    else vehicleStore.clear();
  };
  const pickCustom = (brand: string, model: string) => {
    const label = `${brand} ${model}`;
    const kit: KitVehicle | undefined = hasKit(brand, model) ? kitVehicles.find((v) => v.label === label) : undefined;
    if (kit) vehicleStore.set({ mode: "kit", slug: kit.slug, label: kit.label });
    else vehicleStore.set({ mode: "custom", brand, model, label });
  };

  const custom = !q.vehicle && car?.mode === "custom" ? car : null;
  const view = loaderData.ok ? loaderData.view : null;
  const carLabel = view?.vehicle?.label ?? custom?.label;
  const tel = telHref(meta.contacts.phone);

  const h1 = carLabel ? `Защита для ${carLabel}` : "Каталог защиты";
  const lead = custom
    ? `Готовых комплектов под ${custom.label} пока нет. Сделаем под вашу машину: эскиз до изготовления, платите после согласования`
    : view?.vehicle
      ? `Все, что встает на ${view.vehicle.label}. Сомневаетесь в комплектации? Проверим по фото до заявки`
      : "Стальная защита бампера на штатные точки, без сверления. Выберите машину, и покажем только то, что на нее встанет";

  const crumbs = carLabel
    ? [{ label: "Главная", to: "/" }, { label: "Каталог", to: "/catalog" }, { label: carLabel }]
    : [{ label: "Главная", to: "/" }, { label: "Каталог" }];

  const resultsKey = `${q.vehicle ?? ""}|${custom?.label ?? ""}|${q.position}|${q.material}|${q.price}|${q.stock}|${q.sort ?? ""}`;

  return (
    <>
      <section className="dark2 cat-head" aria-labelledby="cat-h1">
        <div className="wrap">
          <Crumbs items={crumbs} />
          <div className="cat-head__row">
            <h1 id="cat-h1" className="cat-head__t" key={h1}>{h1}</h1>
            <div className="cat-head__side">
              <p className="cat-head__lead" key={lead}>{lead}</p>
              {view && !custom && view.baseTotal ? (
                <dl className="cat-stats">
                  <div><dt>Позиций</dt><dd className="num" data-count={view.baseTotal}>{view.baseTotal}</dd></div>
                  {!view.vehicle ? <div><dt>{plural(view.vehicles.length, ["Модель", "Модели", "Моделей"])}</dt><dd className="num" data-count={view.vehicles.length}>{view.vehicles.length}</dd></div> : null}
                  {view.baseMin != null ? <div><dt>Цена от, ₽</dt><dd className="num" data-count={Math.round(view.baseMin / 100)}>{rubles(view.baseMin).replace(" ₽", "")}</dd></div> : null}
                </dl>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="light cat-res" aria-labelledby="cat-res-h" aria-busy={navToCatalog || undefined}>
        <h2 className="vh" id="cat-res-h">Результаты</h2>
        <div className="wrap cat-lay">
          {view ? (
            <FilterPanel
              view={view}
              pending={pending}
              loading={navToCatalog}
              custom={custom}
              open={sheet}
              onClose={closeSheet}
              onVehicle={pickVehicle}
              onCustom={pickCustom}
            />
          ) : <div />}

          <div className="cat-main" id="cat-grid">
            {view && !custom ? (
              <div className="cat-top">
                <p className="cat-count" role="status" aria-live="polite">
                  <b className="num">{navToCatalog && !moreLoading ? "…" : view.total}</b> {navToCatalog && !moreLoading ? "загружаем" : plural(view.total, ["позиция", "позиции", "позиций"])}
                </p>
                <div className="cat-tools">
                  <button type="button" className="cat-fbtn ol" onClick={() => setSheet(true)} aria-controls="cat-filters" aria-expanded={sheet}>
                    <CatIcon name="filter" />Фильтры{view.chips.length ? <span className="cat-fbtn__n num">{view.chips.length}</span> : null}
                  </button>
                  {view.sortable ? (
                    <label className="cat-sort">
                      <span>Сортировка</span>
                      <select
                        className="in in--light"
                        name="sort"
                        form="cat-f"
                        value={pending.sort ?? ""}
                        onChange={(e) => navigate(catHref({ ...q, sort: (e.target.value || undefined) as CatQuery["sort"], page: 1 }), { preventScrollReset: true })}
                      >
                        <option value="">Сначала по моделям</option>
                        <option value="price_asc">Сначала дешевле</option>
                        <option value="price_desc">Сначала дороже</option>
                      </select>
                    </label>
                  ) : null}
                </div>
              </div>
            ) : null}

            {!view ? (
              <StateBox kind="error" title="Не удалось загрузить каталог" text="Проверьте интернет и попробуйте еще раз. Если не получится, позвоните: подскажем и подберем защиту по телефону">
                <span className="lift lift--ink">
                  <a className="btn btn--dark" href={`${loc.pathname}${loc.search}`} onClick={(e) => { e.preventDefault(); reval.revalidate(); }} aria-busy={reval.state === "loading" || undefined}>
                    {reval.state === "loading" ? <span className="busy" aria-hidden="true"><i /><i /><i /></span> : null}Повторить
                  </a>
                </span>
                {tel ? <a className="lnk" href={tel}><span className="lnk__t">Позвонить {meta.contacts.phone}</span><span className="ar ol" aria-hidden="true"><Icon name="phone" /></span></a> : null}
              </StateBox>
            ) : custom ? (
              <div className="cat-fade" key={`custom-${custom.label}`}>
                <StateBox kind="custom" title={`Для ${custom.label} готовых комплектов пока нет`} text="Сделаем под вашу машину по месту: снимем размеры по фото, покажем эскиз до изготовления, платите после согласования. Цену назовем после фото, бесплатно">
                  <span className="lift lift--ink"><Link className="btn btn--dark" to="/#quiz">Рассчитать под {custom.label}<Icon name="arrow" className="ico--go" /></Link></span>
                  <button type="button" className="lnk" onClick={() => vehicleStore.clear()}><span className="lnk__t">Смотреть готовые комплекты</span><span className="ar ol" aria-hidden="true"><Icon name="arrow" /></span></button>
                </StateBox>
                <SimilarWorks car={custom.label} />
              </div>
            ) : contextChange ? (
              <CardSkeleton n={6} />
            ) : view.total === 0 ? (
              <div className="cat-fade" key={`empty-${resultsKey}`}>
                <StateBox kind="empty" title="По этим фильтрам ничего нет" text="Такого сочетания сейчас нет в каталоге. Сбросьте фильтры или расскажите, что нужно, сделаем под заказ">
                  <span className="lift lift--ink"><Link className="btn btn--dark" to={catHref({ vehicle: q.vehicle })} preventScrollReset>Сбросить фильтры</Link></span>
                  <Link className="lnk" to="/#quiz"><span className="lnk__t">Индивидуальный заказ</span><span className="ar ol" aria-hidden="true"><Icon name="arrow" /></span></Link>
                </StateBox>
              </div>
            ) : (
              <div className={`cat-fade${navToCatalog && !moreLoading ? " is-busy" : ""}`} key={resultsKey}>
                {view.groups.map((g) => (
                  <div className="cat-grp-res" key={g.slug || "all"}>
                    {view.grouped ? (
                      <div className="cat-ghead">
                        <h3 className="cat-ghead__t">{g.label}</h3>
                        <span className="cat-ghead__n">{g.total} {plural(g.total, ["позиция", "позиции", "позиций"])}</span>
                        <Link
                          className="lnk cat-ghead__go"
                          to={catHref({ vehicle: g.slug })}
                          preventScrollReset
                          onClick={(e) => { e.preventDefault(); pickVehicle(g.slug); }}
                        >
                          <span className="lnk__t">Только для {g.label}</span><span className="ar ol" aria-hidden="true"><Icon name="arrow" /></span>
                        </Link>
                      </div>
                    ) : null}
                    <div className="cat-grid" data-stagger="">
                      {g.items.map((p, i) => (
                        <ProductCard
                          key={cardKey(p)}
                          p={p}
                          back={`${loc.pathname}${loc.search}`}
                          kitDiscountPct={view.discounts[cardKey(p)]}
                          sizes="(max-width: 599px) 100vw, (max-width: 1439px) 40vw, 28vw"
                          eager={i < 3 && g === view.groups[0]}
                        />
                      ))}
                    </div>
                  </div>
                ))}

                {view.pages > 1 ? (
                  <nav className="cat-pager" aria-label="Страницы каталога">
                    <span className="cat-pager__t">Показано {view.shown} из {view.total}</span>
                    <span className="cat-pager__bar" aria-hidden="true"><i style={{ width: `${(view.shown / view.total) * 100}%` }} /></span>
                    {view.page < view.pages ? (
                      <span className="lift lift--ink">
                        <Link className="btn btn--line ol" to={catHref({ ...q, page: view.page + 1 })} preventScrollReset aria-busy={moreLoading || undefined}>
                          {moreLoading ? <span className="busy" aria-hidden="true"><i /><i /><i /></span> : null}
                          Показать еще {Math.min(12, view.total - view.shown)}
                        </Link>
                      </span>
                    ) : null}
                    <div className="cat-pager__n">
                      {Array.from({ length: view.pages }, (_, i) => i + 1).map((n) => (
                        <Link key={n} to={catHref({ ...q, page: n })} preventScrollReset className={n <= view.page ? "is-on" : undefined} aria-current={n === view.page ? "page" : undefined}>{n}</Link>
                      ))}
                    </div>
                  </nav>
                ) : null}
              </div>
            )}
          </div>
        </div>

        <div className="wrap"><TrustStrip /></div>
      </section>

      {custom ? null : <CustomStrip kit={!!view?.vehicle} />}
    </>
  );
}
