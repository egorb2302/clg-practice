import type { ProductCard as Card, Vehicle } from "@armorix/contracts";
import { data, Link } from "react-router";
import type { Route } from "./+types/offer";
import { coverOf, offerState, type Post, PostBody, postText, until, vehiclesIn } from "../components/account/post";
import { useEligibility } from "../components/account/useEligibility";
import { Crumbs, Icon, Illustration, ProductCard } from "../components/site";
import { fmtDate, loginHref } from "../lib/account";
import { api, apiRaw, PUBLIC_CACHE } from "../lib/api.server";
import { plural } from "../lib/format";
import { rootOrigin, seo } from "../lib/seo";
import { useSite } from "../lib/site";
import { requireFeature } from "../lib/stub.server";
import css from "../styles/pages/offers.css?url";

export const links: Route.LinksFunction = () => [{ rel: "stylesheet", href: css }];

async function kitsFor(cars: Vehicle[]): Promise<Card[]> {
  const ask = (q: Record<string, string>) => api.catalog(new URLSearchParams(q)).then((r) => r.items).catch((): Card[] => []);
  const lists = cars.length
    ? await Promise.all(cars.flatMap((c) => [ask({ vehicle: c.slug, position: "kit" }), ask({ vehicle: c.slug })]))
    : [await ask({ position: "kit" })];
  const seen = new Set<string>();
  const out: Card[] = [];
  for (const it of lists.flat()) {
    const k = `${it.slug}:${it.vehicle.slug}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(it);
  }
  return out.slice(0, 3);
}

export async function loader({ params }: Route.LoaderArgs) {
  await requireFeature("offers");
  const r = await apiRaw("GET", `/offers/${encodeURIComponent(params.slug)}`);
  if (r.status === 404) throw data(null, { status: 404 });
  if (r.status >= 400) throw data(null, { status: 502 });
  const post = (r.body as { post: Post }).post;
  const all = await api.vehicles().then((v) => v.items).catch((): Vehicle[] => []);
  const cars = vehiclesIn(postText(post), all);
  const kits = await kitsFor(cars);
  return data({ post, cars, kits }, { headers: { "Cache-Control": PUBLIC_CACHE } });
}
export { pageHeaders as headers } from "../lib/headers";
export const meta: Route.MetaFunction = ({ data: d, matches, params }) => {
  const p = d?.post;
  return seo({
    title: p ? p.title : "Акция",
    description: p ? (p.summary || p.benefit || "Условия акции ARMORIX на стальную защиту бампера") : "Условия акции ARMORIX на стальную защиту бампера",
    path: `/offers/${params.slug}`,
    origin: rootOrigin(matches),
    image: p?.coverUrl && /^https?:\/\//.test(p.coverUrl) ? p.coverUrl : undefined,
  });
};

export default function Offer({ loaderData }: Route.ComponentProps) {
  const { post: p, cars, kits } = loaderData;
  const { meta } = useSite();
  const st = offerState(p);
  const closed = !!p.minPurchases;
  const el = useEligibility(meta.features.account && closed && st === "live");
  const eligible = el.of(p.slug);
  const cv = coverOf(p, "offer");
  const carText = cars.length ? cars.map((c) => c.label).join(", ") : "все модели";
  const n = p.minPurchases ?? 0;
  const nLabel = `${n} ${plural(n, ["подтвержденная покупка", "подтвержденные покупки", "подтвержденных покупок"])}`;
  const catalogTo = cars.length === 1 ? `/catalog?vehicle=${cars[0]!.slug}` : "/catalog";

  const how = closed
    ? ["Войдите в кабинет, где есть ваша подтвержденная покупка", "Добавьте нужную защиту в подборку и отправьте заявку", "Менеджер проверит условие и применит акцию при подтверждении сделки"]
    : ["Выберите комплект в каталоге и добавьте его в подборку", "Отправьте заявку из подборки, оплата на сайте не нужна", "Менеджер проверит условия и применит акцию при подтверждении сделки"];

  let status: { head: string; text: string } | null = null;
  if (st === "ended") status = { head: "Акция закончилась", text: `Заявки по ней больше не принимаются${p.endsAt ? ` с ${fmtDate(p.endsAt)}` : ""}. Посмотрите действующие акции` };
  else if (st === "soon") status = { head: "Акция еще не началась", text: p.startsAt ? `Начнется ${fmtDate(p.startsAt)}, условия ниже уже можно посмотреть` : "Условия ниже уже можно посмотреть" };
  else if (closed && eligible === true) status = { head: "Вам подходит", text: "В кабинете есть нужные подтвержденные покупки. Акцию применит менеджер" };
  else if (closed && el.state === "known") status = { head: "Пока не подходит", text: `Нужно: ${nLabel}, у вас ${el.purchases}` };
  else if (closed) status = { head: "Нужен вход", text: `Акция для клиентов, у которых ${nLabel}. Войдите, и покажем, подходит ли она вам` };

  return (
    <>
      <section className="of-dh dark2">
        <div className="wrap">
          <Crumbs items={[{ label: "Главная", to: "/" }, { label: "Акции", to: "/offers" }, { label: p.title }]} />
          <Link className="lnk lnk--sm of-dh__back" to="/offers"><span className="ar ol" aria-hidden="true"><Icon name="back" className="ico--back" /></span><span className="lnk__t">Все акции</span></Link>
          <h1 className="of-dh__t" data-in="">{p.title}</h1>
          {p.summary ? <p className="of-dh__lead" data-in="">{p.summary}</p> : null}
          <ul className="of-dh__chips" data-in="">
            <li className="of-chip cut is-hi">{st === "ended" ? `Закончилась${p.endsAt ? ` ${fmtDate(p.endsAt)}` : ""}` : st === "soon" && p.startsAt ? `С ${fmtDate(p.startsAt)}` : p.endsAt ? `До ${fmtDate(p.endsAt)}` : "Без срока"}</li>
            <li className="of-chip cut">{cars.length ? carText : "Для всех моделей"}</li>
            <li className="of-chip cut">{p.combinable ? "Суммируется с другими акциями" : "Не суммируется с другими акциями"}</li>
            {closed ? <li className="of-chip cut">После {n} {plural(n, ["покупки", "покупок", "покупок"])}</li> : null}
          </ul>
        </div>
      </section>

      <section className="of-dsec light">
        <div className="wrap of-dgrid">
          <div className="of-dmain">
            <div data-in=""><Illustration src={cv.src} alt="" label={cv.own} ratio="16 / 9" eager crop={cv.own} className="cut of-dimg" sizes="(max-width: 1023px) 100vw, 60vw" /></div>
            <h2 className="of-h2" data-in="">Условия</h2>
            {p.body ? <PostBody text={p.body} className="of-terms" /> : <p className="of-terms__p">{p.summary || "Подробные условия уточнит менеджер"}</p>}
            <h2 className="of-h2" data-in="">Как получить</h2>
            <ol className="of-how" data-stagger="">
              {how.map((t, i) => <li key={t} className="ol" data-in=""><span className="D">{String(i + 1).padStart(2, "0")}</span><span>{t}</span></li>)}
            </ol>
          </div>

          <aside className="of-panel ol" aria-label="Выгода" data-in="">
            <span className="of-cap">Выгода</span>
            <span className={`of-panel__g D${(p.benefit ?? "").length > 22 ? " is-long" : ""}`}>{p.benefit || p.title}</span>
            {status ? (
              <div className="of-st ol" role="status">
                <Icon name={st === "live" ? "shield" : "clock"} />
                <span><strong>{status.head}</strong>{status.text}</span>
              </div>
            ) : null}
            <dl className="of-rows">
              <div><dt>Срок</dt><dd>{until(p)}</dd></div>
              <div><dt>Машины</dt><dd>{carText}</dd></div>
              <div><dt>С другими акциями</dt><dd>{p.combinable ? "суммируется" : "не суммируется"}</dd></div>
            </dl>
            {st === "ended" ? (
              <span className="lift lift--block"><Link className="btn btn--white btn--block" to="/offers">Действующие акции</Link></span>
            ) : closed && el.state !== "known" && st === "live" ? (
              <span className="lift lift--block"><Link className="btn btn--white btn--block" to={loginHref(`/offers/${p.slug}`)}>Войти и проверить</Link></span>
            ) : (
              <>
                <span className="lift lift--block"><Link className="btn btn--white btn--block" to={catalogTo}>Выбрать комплект</Link></span>
                <Link className="btn btn--line ol btn--block" to="/selection">Оформить подборку</Link>
              </>
            )}
            <span className="of-panel__f">На сайте ничего не оплачивается. Скидку применяет менеджер при подтверждении сделки, условия фиксируются в покупке</span>
          </aside>
        </div>
        {kits.length && st !== "ended" ? (
          <div className="wrap of-kitsec">
            <h2 className="of-h2" data-in="">{cars.length ? "Подходящие комплекты" : "Комплекты из каталога"}</h2>
            <div className="of-kits" data-stagger="">
              {kits.map((k) => <ProductCard key={`${k.slug}-${k.vehicle.slug}`} p={k} back={`/offers/${p.slug}`} sizes="(max-width: 767px) 100vw, (max-width: 1279px) 50vw, 33vw" />)}
            </div>
          </div>
        ) : null}
      </section>
    </>
  );
}
