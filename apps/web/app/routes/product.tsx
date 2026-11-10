import { useEffect, useRef, useState } from "react";
import { data, Link, redirect, useLocation, useRouteLoaderData } from "react-router";
import type { Route } from "./+types/product";
import { LeadForm } from "../components/LeadForm";
import { ProductCard } from "../components/ProductCard";
import { Chip, Icon, Img, Sbtn } from "../components/ui";
import { api, PUBLIC_CACHE } from "../lib/api.server";
import { nb, POSITION_LABEL, PRICE_NOTE, priceFrom } from "../lib/format";
import { selection, useSelection, type SelectionItem } from "../lib/selection";
import { rootOrigin, seo } from "../lib/seo";
import type { loader as rootLoader } from "../root";

export async function loader({ params, request }: Route.LoaderArgs) {
  const vehicle = new URL(request.url).searchParams.get("vehicle") ?? undefined;
  const res = await api.product(params.slug, vehicle);
  if (!res) throw data(null, { status: 404 });
  if ("redirect" in res) {
    const to = res.redirect.startsWith("/") ? res.redirect : `/catalog/${encodeURIComponent(res.redirect)}`;
    throw redirect(vehicle ? `${to}?vehicle=${encodeURIComponent(vehicle)}` : to, 301);
  }
  const p = res.product;
  const related = (await api.catalog(new URLSearchParams({ vehicle: p.vehicle.slug }))).items.filter((x) => x.slug !== p.slug).slice(0, 3);
  return data({ product: p, related }, { headers: { "Cache-Control": PUBLIC_CACHE } });
}
export const headers: Route.HeadersFunction = ({ loaderHeaders }) => loaderHeaders;
export const meta: Route.MetaFunction = ({ data: d, matches }) =>
  d ? seo({
    title: `${d.product.title}, ${d.product.vehicle.label}`,
    description: `${d.product.title} для ${d.product.vehicle.label}, ${priceFrom(d.product.priceFrom)}, ${d.product.code}`,
    path: `/catalog/${d.product.slug}`,
    origin: rootOrigin(matches),
    image: d.product.image?.url,
  }) : [{ title: "Товар не найден | ARMORIX" }];

const sentences = (s: string | null) => (s ?? "").split(/(?<=[.!?])\s+/).map((x) => x.replace(/\.$/, "").trim()).filter(Boolean);

export default function Product({ loaderData }: Route.ComponentProps) {
  const { product: p, related } = loaderData;
  const root = useRouteLoaderData<typeof rootLoader>("root");
  const loc = useLocation();
  const back = (loc.state as { back?: string } | null)?.back ?? `/catalog?vehicle=${p.vehicle.slug}`;
  const gallery = p.gallery.length ? p.gallery : p.image ? [p.image] : [];
  const [shot, setShot] = useState(0);
  const own = p.variants.filter((v) => v.vehicleSlug === p.vehicle.slug);
  const firstOk = own.find((v) => v.available) ?? own[0];
  const [vid, setVid] = useState(firstOk?.id ?? "");
  const variant = own.find((v) => v.id === vid) ?? firstOk;
  const [askPrice, setAskPrice] = useState<{ id: string; priceFrom: number | null; available: boolean } | null>(null);
  const sel = useSelection();
  const inSel = variant ? sel.some((i) => i.variantId === variant.id) : false;
  const dlg = useRef<HTMLDialogElement>(null);

  useEffect(() => { setShot(0); setVid(firstOk?.id ?? ""); }, [p.slug]); // eslint-disable-line react-hooks/exhaustive-deps

  const item = (): Omit<SelectionItem, "quantity"> | null => variant ? {
    variantId: variant.id, productSlug: p.slug, vehicleSlug: variant.vehicleSlug,
    snapshot: { title: p.title, priceFrom: variant.priceFrom, imageUrl: p.image?.url ?? null, variantTitle: variant.title, vehicleLabel: p.vehicle.label },
  } : null;
  const ask = () => dlg.current?.showModal();
  const askItem = item();

  return (
    <>
      <section className="pd wrap">
        <p className="crumbs pd__back">
          <Link className="tlink" to={back}><Icon name="arrow" vb="0 0 20 20" className="ico ico--back" />Назад к каталогу</Link>
        </p>
        <div className="pd__grid">
          <div className="pd__gal" data-in="">
            <div className="pd__main">
              {gallery.map((g, i) => (
                <div key={g.url + i} className={`pd__shot${i === shot ? " is-on" : ""}`} aria-hidden={i !== shot}>
                  <Img src={g.url} alt={g.alt} w={g.width} h={g.height} eager={i === 0} sizes="(max-width: 1023px) 100vw, 58vw" />
                </div>
              ))}
              {!gallery.length ? <span className="pc__none">Фото комплекта готовится</span> : <span className="pc__tag">Иллюстрация</span>}
            </div>
            {gallery.length > 1 ? (
              <div className="pd__thumbs" role="group" aria-label="Фото">
                {gallery.map((g, i) => (
                  <button key={g.url + i} type="button" aria-pressed={i === shot} aria-label={`Фото ${i + 1}: ${g.alt}`} onClick={() => setShot(i)}>
                    <img src={g.url.replace(/\.webp$/, "-s.webp")} alt="" loading="lazy" />
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="pd__info" data-in="">
            <p className="pd__meta"><Chip n={p.code}>{POSITION_LABEL[p.position]}</Chip><span className={`pd__st${p.status === "on_request" ? " is-r" : ""}`}>{p.status === "available" ? "В наличии" : "Под заказ"}</span></p>
            <h1 className="pd__t">{p.title}</h1>
            <p className="pd__car"><Icon name="truck" />Для {p.compatibility.map((c) => c.label).join(", ") || p.vehicle.label}</p>

            {own.length > 1 ? (
              <fieldset className="vars">
                <legend>Вариант</legend>
                {own.map((v) => (
                  <label key={v.id} className={`var${v.available ? "" : " is-off"}`}>
                    <input type="radio" name="variant" value={v.id} checked={v.id === variant?.id} disabled={!v.available} onChange={() => setVid(v.id)} />
                    <span className="var__t">{v.title}</span>
                    <span className="var__p num">{v.available ? priceFrom(v.priceFrom) : "Недоступен"}</span>
                  </label>
                ))}
              </fieldset>
            ) : null}

            <div className="pd__price">
              <b className={`num${variant?.priceFrom == null ? " is-ask" : ""}`}>{priceFrom(variant?.priceFrom ?? null)}</b>
              <p>{PRICE_NOTE}</p>
            </div>
            <div className="pd__acts">
              {inSel ? (
                <Sbtn to="/selection" className="sbtn--lg">В подборке, открыть</Sbtn>
              ) : (
                <Sbtn className="sbtn--lg" onClick={() => { const it = item(); if (it) selection.add(it); }} disabled={!variant?.available}>В подборку</Sbtn>
              )}
              <button className="btn-line" type="button" onClick={ask}>Уточнить комплектацию</button>
            </div>
            <ul className="pd__perks">
              <li><Icon name="nodrill" />Без сверления кузова</li>
              <li><Icon name="truck" />Доставка по России</li>
              <li><Icon name="wrench" />Установка у нас</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="wrap pd__more" aria-label="Описание">
        <div className="pd__desc" data-in="">
          <h2 className="pd__h">Описание</h2>
          {sentences(p.description).map((s) => <p key={s}>{nb(s)}</p>)}
        </div>
        <dl className="spec" data-stagger="">
          {p.composition.length ? <div data-in=""><dt>Состав комплекта</dt><dd><ul>{p.composition.map((c) => <li key={c}>{nb(c)}</li>)}</ul></dd></div> : null}
          {p.material ? <div data-in=""><dt>Материал</dt><dd>{p.material.split("; ").map((m) => <p key={m}>{m}</p>)}</dd></div> : null}
          {p.installation ? <div data-in=""><dt>Установка</dt><dd>{sentences(p.installation).map((s) => <p key={s}>{nb(s)}</p>)}</dd></div> : null}
          <div data-in=""><dt>Совместимость</dt><dd>{p.compatibility.map((c) => <p key={c.vehicleSlug}><b>{c.label}</b>{c.note ? `, ${c.note.charAt(0).toLowerCase()}${c.note.slice(1)}` : ""}</p>)}</dd></div>
        </dl>
      </section>

      {related.length ? (
        <section className="sec wrap" aria-label="Другие комплекты">
          <div className="head" data-in=""><h2 className="tt"><span>Еще для {p.vehicle.label}</span></h2><Link className="tlink" to={back}>Весь каталог</Link></div>
          <div className="grid-cards" data-stagger="">{related.map((r) => <ProductCard key={r.slug} p={r} back={back} />)}</div>
        </section>
      ) : null}

      <dialog ref={dlg} className="dlg" aria-labelledby="ask-t">
        <div className="dlg__in">
          <button className="dlg__x" type="button" aria-label="Закрыть" onClick={() => dlg.current?.close()}><Icon name="close" /></button>
          <h2 id="ask-t" className="dlg__t">Уточнить комплектацию</h2>
          <p className="dlg__p">{p.title}, {p.vehicle.label}{variant ? `, ${variant.title}` : ""}</p>
          {askPrice && askPrice.id === askItem?.variantId ? (
            <p className="dlg__p" role="status">
              {askPrice.available ? `Цена обновилась: ${priceFrom(askPrice.priceFrom)}. Отправьте вопрос ещё раз` : "Этот вариант сейчас недоступен, выберите другой"}
            </p>
          ) : null}
          {askItem && !(askPrice && askPrice.id === askItem.variantId && !askPrice.available) ? (
            <LeadForm
              key={variant?.id}
              type="catalog"
              items={[{ ...askItem, quantity: 1, snapshot: { ...askItem.snapshot, priceFrom: askPrice && askPrice.id === askItem.variantId ? askPrice.priceFrom : askItem.snapshot.priceFrom } }]}
              deliveryMethods={root?.meta.deliveryMethods ?? []}
              submitLabel="Отправить вопрос"
              changedMessage="Пока вы смотрели товар, цена изменилась"
              onCatalogChanged={(changes) => {
                const c = changes.find((x) => x.variantId === askItem.variantId);
                if (c) setAskPrice({ id: c.variantId, priceFrom: c.priceFrom, available: c.available });
              }}
            />
          ) : null}
        </div>
      </dialog>
    </>
  );
}
