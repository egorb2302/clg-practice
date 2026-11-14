import type { Vehicle } from "@armorix/contracts";
import { data, Link, type ShouldRevalidateFunction, useSearchParams } from "react-router";
import type { Route } from "./+types/offers";
import { coverOf, offerState, type Post, postText, until, vehiclesIn } from "../components/account/post";
import { SubscribeForm } from "../components/account/SubscribeForm";
import { useEligibility } from "../components/account/useEligibility";
import { Crumbs, Icon, Illustration } from "../components/site";
import { fmtDate } from "../lib/account";
import { apiRaw, PUBLIC_CACHE } from "../lib/api.server";
import { plural } from "../lib/format";
import { rootOrigin, seo } from "../lib/seo";
import { useSite } from "../lib/site";
import { requireFeature } from "../lib/stub.server";
import css from "../styles/pages/offers.css?url";
import sbCss from "../styles/pages/subscription.css?url";

export const links: Route.LinksFunction = () => [{ rel: "stylesheet", href: css }, { rel: "stylesheet", href: sbCss }];

export async function loader() {
  await requireFeature("offers");
  const r = await apiRaw("GET", "/offers");
  if (r.status === 404) throw data(null, { status: 404 });
  const items = r.status < 400 ? ((r.body as { items: Post[] }).items ?? []) : [];
  return data({ items, failed: r.status >= 400 }, { headers: { "Cache-Control": r.status < 400 ? PUBLIC_CACHE : "no-store" } });
}
export { pageHeaders as headers } from "../lib/headers";
export const shouldRevalidate: ShouldRevalidateFunction = ({ currentUrl, nextUrl, defaultShouldRevalidate }) =>
  currentUrl.pathname === nextUrl.pathname && !nextUrl.searchParams.has("page") ? false : defaultShouldRevalidate;
export const meta: Route.MetaFunction = ({ matches }) =>
  seo({ title: "Акции на защиту бампера", description: "Действующие акции ARMORIX: условия, сроки и для каких машин. Скидку применяет менеджер при подтверждении сделки", path: "/offers", origin: rootOrigin(matches) });

function Tag({ p, eligible }: { p: Post; eligible: boolean | null }) {
  if (offerState(p) === "soon") return <span className="of-tag cut is-line">Скоро</span>;
  if (p.minPurchases) return <span className="of-tag cut is-ink">{eligible ? "Вам подходит" : `После ${p.minPurchases} ${plural(p.minPurchases, ["покупки", "покупок", "покупок"])}`}</span>;
  return <span className="of-tag cut">Для всех</span>;
}

function Lock({ p, state, eligible, purchases }: { p: Post; state: string; eligible: boolean | null; purchases: number }) {
  if (!p.minPurchases || eligible) return null;
  const n = p.minPurchases;
  return (
    <span className="of-lock">
      <Icon name="shield" size={16} />
      <span>{state === "known" ? `Нужно подтвержденных покупок: ${n}, у вас ${purchases}` : `Для клиентов с подтвержденной покупкой. Войдите в кабинет, и покажем, подходит ли акция`}</span>
    </span>
  );
}

export default function Offers({ loaderData }: Route.ComponentProps) {
  const { items, failed } = loaderData;
  const { meta, vehicles } = useSite();
  const [params] = useSearchParams();
  const el = useEligibility(meta.features.account && items.some((x) => x.minPurchases));
  const carsOf = (p: Post): Vehicle[] => vehiclesIn(postText(p), vehicles);
  const named = vehicles.filter((v) => items.some((p) => carsOf(p).some((c) => c.slug === v.slug)));
  const car = named.find((v) => v.slug === params.get("car")) ?? null;
  const list = car ? items.filter((p) => carsOf(p).some((c) => c.slug === car.slug)) : items;
  const featured = list.find((p) => offerState(p) === "live" && !p.minPurchases) ?? list[0];
  const rest = list.filter((p) => p !== featured);

  return (
    <>
      <section className="of-hd dark2">
        <div className="wrap">
          <Crumbs items={[{ label: "Главная", to: "/" }, { label: "Акции" }]} />
          <div className="of-hd__row">
            <h1 className="of-hd__t" data-in="">Акции</h1>
            <p className="of-hd__p" data-in="">Условия, сроки и для каких машин. На сайте ничего не оплачивается: скидку применяет менеджер, когда подтверждает сделку</p>
          </div>
          {named.length ? (
            <nav className="of-chips" aria-label="Для какой машины" data-in="">
              <Link className={`chip ol${!car ? " is-on" : ""}`} to="/offers" preventScrollReset aria-current={!car ? "true" : undefined}>Все</Link>
              {named.map((v) => <Link key={v.slug} className={`chip ol${car?.slug === v.slug ? " is-on" : ""}`} to={`/offers?car=${v.slug}`} preventScrollReset aria-current={car?.slug === v.slug ? "true" : undefined}>{v.label}</Link>)}
            </nav>
          ) : null}
        </div>
      </section>

      <section className="of-sec light">
        <div className="wrap">
          {failed ? <p className="ferr" role="alert">Не удалось загрузить акции, обновите страницу через минуту</p> : null}
          {featured ? (
            <>
              <FeaturedOffer p={featured} cars={carsOf(featured)} eligible={el.of(featured.slug)} state={el.state} purchases={el.purchases} />
              {rest.length ? (
                <ul className="of-grid" data-stagger="">
                  {rest.map((p) => {
                    const cv = coverOf(p);
                    const cars = carsOf(p);
                    const eligible = el.of(p.slug);
                    return (
                      <li key={p.slug} data-in="">
                        <Link className="of-card ol" to={`/offers/${p.slug}`} prefetch="intent">
                          <Illustration src={cv.src} alt="" caption={cv.caption} sizes="(max-width: 767px) 100vw, (max-width: 1279px) 50vw, 33vw" />
                          <span className="of-card__b">
                            <Tag p={p} eligible={eligible} />
                            <span className="of-card__t D">{p.title}</span>
                            {p.summary ? <span className="of-card__d">{p.summary}</span> : null}
                            <Lock p={p} state={el.state} eligible={eligible} purchases={el.purchases} />
                            <span className="of-card__e"><span>{cars.length ? cars.map((c) => c.label).join(", ") : "все машины"}</span><span>{until(p)}</span></span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </>
          ) : car ? (
            <div className="of-empty ol" role="status" data-in="">
              <div>
                <h2 className="of-empty__t">Для {car.label} акций нет</h2>
                <p>Сейчас акции действуют для других машин. Посмотрите все, вдруг есть общие условия</p>
              </div>
              <Link className="lnk" to="/offers" preventScrollReset><span className="lnk__t">Все акции</span><span className="ar ol" aria-hidden="true"><Icon name="arrow" /></span></Link>
            </div>
          ) : !failed ? (
            <div className="of-empty ol" role="status" data-in="">
              <div>
                <h2 className="of-empty__t">Сейчас акций нет</h2>
                <p>{meta.features.campaigns ? "Новые акции появляются несколько раз в год. Подпишитесь, и пришлем письмо, когда начнется следующая" : "Новые акции появляются несколько раз в год. А пока можно подобрать комплект в каталоге"}</p>
              </div>
              {meta.features.campaigns ? <SubscribeForm source="offers" light /> : <span className="lift lift--ink"><Link className="btn btn--dark" to="/catalog">В каталог<Icon name="arrow" className="ico--go" /></Link></span>}
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}

function FeaturedOffer({ p, cars, eligible, state, purchases }: { p: Post; cars: Vehicle[]; eligible: boolean | null; state: string; purchases: number }) {
  const cv = coverOf(p);
  return (
    <Link className="of-feat ol" to={`/offers/${p.slug}`} prefetch="intent" data-in="">
      <Illustration src={cv.src} alt="" caption={cv.caption} dark eager ratio="16 / 10" className="of-feat__img" sizes="(max-width: 1023px) 100vw, 55vw" />
      <span className="of-feat__b">
        <span className="of-tag cut is-light">{offerState(p) === "soon" && p.startsAt ? `С ${fmtDate(p.startsAt)}` : p.endsAt ? `До ${fmtDate(p.endsAt)}` : "Без срока"}</span>
        <span className="of-feat__t D">{p.title}</span>
        {p.summary ? <span className="of-feat__d">{p.summary}</span> : null}
        <Lock p={p} state={state} eligible={eligible} purchases={purchases} />
        <span className="of-meta">
          {p.benefit ? <span><span>Выгода</span><span>{p.benefit}</span></span> : null}
          <span><span>Для машин</span><span>{cars.length ? cars.map((c) => c.label).join(", ") : "все модели"}</span></span>
          <span><span>С другими акциями</span><span>{p.combinable ? "суммируется" : "не суммируется"}</span></span>
          {p.minPurchases ? <span><span>Условие</span><span>{eligible ? "вам подходит" : `после ${p.minPurchases} ${plural(p.minPurchases, ["покупки", "покупок", "покупок"])}`}</span></span> : null}
        </span>
        <span className="lnk of-feat__go"><span className="lnk__t">Условия акции</span><span className="ar ol" aria-hidden="true"><Icon name="arrow" /></span></span>
      </span>
    </Link>
  );
}
