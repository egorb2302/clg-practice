import type { CatalogChange, ProductCard as Card } from "@armorix/contracts";
import { useEffect, useMemo, useRef, useState } from "react";
import { data, Link } from "react-router";
import type { Route } from "./+types/selection";
import { Glyph } from "../components/pages/glyphs";
import { Crumbs, Icon, Illustration, LeadForm, ProductCard, productArt, SectionHead, type LeadItem } from "../components/site";
import { api, PUBLIC_CACHE } from "../lib/api.server";
import { PRICE_NOTE, plural, priceFrom, rubles } from "../lib/format";
import { selection, setDelivery, useDelivery, useSelection, type SelectionItem } from "../lib/selection";
import { rootOrigin, seo } from "../lib/seo";
import { useSite } from "../lib/site";
import css from "../styles/pages/selection.css?url";

export const links: Route.LinksFunction = () => [{ rel: "stylesheet", href: css }];

export async function loader() {
  const cards = await api.catalog(new URLSearchParams()).then((r) => r.items).catch((): Card[] => []);
  return data({ cards }, { headers: { "Cache-Control": PUBLIC_CACHE } });
}
export { pageHeaders as headers } from "../lib/headers";
export const meta: Route.MetaFunction = ({ matches }) =>
  seo({ title: "Подборка", description: "Выбранные комплекты защиты и заявка менеджеру", path: "/selection", origin: rootOrigin(matches), noindex: true });

const DELIVERY_NOTE: Record<string, string> = {
  pickup: "Заберете комплект в мастерской, крепеж и инструкция внутри",
  shipping: "До терминала или до двери в любой регион России, стоимость и срок назовет менеджер",
  install: "Около 2,5 часа в мастерской по записи, цену назовет менеджер",
};
const DELIVERY_ICON: Record<string, "home" | "truck" | "wrench"> = { pickup: "home", shipping: "truck", install: "wrench" };

const NEXT = [
  "Менеджер проверит позиции и совместимость с вашей машиной",
  "Позвонит или напишет, назовет точную цену и срок",
  "Вы подтверждаете состав, оплата только после согласования",
];

type Row = { kind: "item"; item: SelectionItem } | { kind: "gone"; item: SelectionItem; index: number };
const key = (c: Card) => `${c.slug}|${c.vehicle.slug}`;

export default function Selection({ loaderData }: Route.ComponentProps) {
  const { cards } = loaderData;
  const { meta: site } = useSite();
  const items = useSelection();
  const stored = useDelivery();
  const [ready, setReady] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [changes, setChanges] = useState<CatalogChange[]>([]);
  const [gone, setGone] = useState<{ item: SelectionItem; index: number }[]>([]);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => setReady(true), []);

  const methods = site.deliveryMethods;
  const delivery = methods.find((m) => m.code === stored)?.code ?? methods[0]?.code;

  const rows = useMemo<Row[]>(() => {
    const r: Row[] = items.map((item) => ({ kind: "item", item }));
    [...gone].sort((a, b) => a.index - b.index).forEach((g) => r.splice(Math.min(g.index, r.length), 0, { kind: "gone", ...g }));
    return r;
  }, [items, gone]);

  const leadItems: LeadItem[] = items.map((i) => ({ variantId: i.variantId, quantity: i.quantity, seenPriceFrom: i.snapshot.priceFrom }));
  const sum = items.reduce((s, i) => (i.snapshot.priceFrom != null ? s + i.snapshot.priceFrom * i.quantity : s), 0);
  const unpriced = items.filter((i) => i.snapshot.priceFrom == null).length;
  const vehicles = [...new Set(items.map((i) => i.snapshot.vehicleLabel ?? i.vehicleSlug))];
  const n = items.length;

  const chOf = (id: string) => changes.find((c) => c.variantId === id);
  const dropChange = (id: string) => setChanges((cs) => cs.filter((c) => c.variantId !== id));
  const openChanges = changes.filter((c) => items.some((i) => i.variantId === c.variantId));

  function removeItem(item: SelectionItem, index: number) {
    selection.remove(item.variantId);
    dropChange(item.variantId);
    setGone((g) => [...g.filter((x) => x.item.variantId !== item.variantId), { item, index }]);
    window.setTimeout(() => setGone((g) => g.filter((x) => x.item.variantId !== item.variantId)), 9000);
  }
  function bringBack(g: { item: SelectionItem; index: number }) {
    selection.restore(g.item, g.index);
    setGone((list) => list.filter((x) => x.item.variantId !== g.item.variantId));
  }
  function sendNewPrice(item: SelectionItem, ch: CatalogChange) {
    selection.setPrice(item.variantId, ch.priceFrom);
    dropChange(item.variantId);
    const left = openChanges.filter((c) => c.variantId !== item.variantId && c.available).length;
    if (!left) window.setTimeout(() => panel.current?.querySelector("form")?.requestSubmit(), 140);
  }

  const together = useMemo(() => {
    const vs = new Set(items.map((i) => i.vehicleSlug));
    const have = new Set(items.map((i) => `${i.productSlug}|${i.vehicleSlug}`));
    return cards.filter((c) => vs.has(c.vehicle.slug) && !have.has(key(c)) && !c.options.some((o) => items.some((i) => i.variantId === o.id))).slice(0, 3);
  }, [cards, items]);
  const popular = useMemo(() => {
    const seen = new Set<string>();
    return [...cards].sort((a, b) => Number(b.position === "kit") - Number(a.position === "kit")).filter((c) => !seen.has(key(c)) && seen.add(key(c))).slice(0, 3);
  }, [cards]);

  const empty = ready && !n && !gone.length && !done;
  const sub = !ready ? "Загружаем подборку" : done ? "Заявка отправлена" : n ? `${n} ${plural(n, ["позиция", "позиции", "позиций"])}${vehicles.length ? ` · ${vehicles.join(", ")}` : ""}` : "Пока ничего не выбрано";

  return (
    <>
      <section className="ph dark2">
        <div className="wrap">
          <Crumbs items={[{ label: "Главная", to: "/" }, { label: "Каталог", to: "/catalog" }, { label: "Подборка" }]} />
          <div className="sel-head">
            <div data-in="">
              <h1 className="ph__t">Подборка</h1>
              <p className="ph__sub num" aria-live="polite">{sub}</p>
            </div>
            <Link className="lnk" to="/catalog" data-in="">
              <span className="lnk__t">Добавить из каталога</span>
              <span className="ol ar" aria-hidden="true"><Icon name="arrow" className="ico--go" /></span>
            </Link>
          </div>
        </div>
      </section>

      <section className="light sec sel-body">
        <div className="wrap">
          {!ready ? <div className="sel-wait" aria-busy="true"><span className="busy" aria-hidden="true"><i /><i /><i /></span>Загружаем подборку</div> : null}

          {empty ? (
            <div className="sel-empty" role="status">
              <div className="sel-empty__t" data-in="">
                <h2 className="h2">В подборке пока пусто</h2>
                <p className="txt">Добавьте комплекты из каталога, соберем одну заявку на все позиции</p>
                <div className="sel-empty__go">
                  <span className="lift"><Link className="btn btn--dark btn--lg" to="/catalog">Открыть каталог</Link></span>
                  <Link className="lnk" to="/contacts?type=custom"><span className="lnk__t">Нет вашей модели</span><span className="ol ar" aria-hidden="true"><Icon name="arrow" className="ico--go" /></span></Link>
                </div>
              </div>
              {popular.length ? (
                <div className="sel-sug">
                  <SectionHead title="Популярные комплекты" />
                  <div className="sel-cards" data-stagger="">
                    {popular.map((c) => <div key={key(c)} data-in=""><ProductCard p={c} back="/selection" /></div>)}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {ready && !empty ? (
            <div className="sel-grid">
              <div className="sel-main">
                {openChanges.length ? (
                  <p className="sel-alert" role="alert"><Icon name="clock" />Пока вы выбирали, изменились позиции ({openChanges.length}): проверьте и подтвердите</p>
                ) : null}

                {rows.length ? (
                  <ul className="sel-list" data-stagger="">
                    {rows.map((r, idx) => {
                      if (r.kind === "gone") {
                        return (
                          <li key={`g-${r.item.variantId}`} className="sel-gone">
                            <span>Позиция «{r.item.snapshot.title}» убрана</span>
                            <button type="button" className="sel-undo" onClick={() => bringBack(r)}><Glyph name="undo" size={16} />Вернуть</button>
                          </li>
                        );
                      }
                      const i = r.item;
                      const ch = chOf(i.variantId);
                      const href = `/catalog/${i.productSlug}?vehicle=${encodeURIComponent(i.vehicleSlug)}`;
                      const opts = i.snapshot.options ?? [];
                      const at = items.findIndex((x) => x.variantId === i.variantId);
                      return (
                        <li key={i.variantId} className="sel-li" data-in="">
                        <div className={`sel-it${ch ? " is-changed" : ""}`}>
                          <Link className="sel-it__img" to={href} tabIndex={-1} aria-hidden="true">
                            <Illustration src={i.snapshot.imageUrl ?? productArt(i.snapshot.position)} alt="" thumb sizes="160px" />
                          </Link>
                          <div className="sel-it__b">
                            <p className="sel-it__meta">{i.snapshot.vehicleLabel ?? i.vehicleSlug}{i.snapshot.position === "kit" ? " · комплект" : ""}</p>
                            <h3 className="sel-it__t"><Link to={href}>{i.snapshot.title}</Link></h3>
                            {opts.length > 1 ? (
                              <div className="sel-opts" role="radiogroup" aria-label={`Вариант: ${i.snapshot.title}`}>
                                {opts.map((o) => (
                                  <button key={o.id} type="button" role="radio" aria-checked={o.id === i.variantId} className="sel-opt ol" onClick={() => selection.swap(i.variantId, o)}>
                                    <span>{o.title}</span><small className="num">{o.priceFrom != null ? priceFrom(o.priceFrom) : "Уточнить цену"}</small>
                                  </button>
                                ))}
                              </div>
                            ) : i.snapshot.variantTitle ? <p className="sel-it__var">{i.snapshot.variantTitle}</p> : null}
                            <Link className="sel-it__more" to={href}>Страница товара</Link>
                          </div>
                          <div className="sel-it__side">
                            <p className="sel-it__p num">{priceFrom(i.snapshot.priceFrom)}</p>
                            {i.quantity > 1 && i.snapshot.priceFrom != null ? <p className="sel-it__sum num">всего от {rubles(i.snapshot.priceFrom * i.quantity)}</p> : null}
                            <div className="qty" role="group" aria-label={`Количество: ${i.snapshot.title}`}>
                              <button type="button" aria-label="Меньше" disabled={i.quantity <= 1} onClick={() => selection.setQuantity(i.variantId, i.quantity - 1)}><Icon name="minus" /></button>
                              <output className="num" aria-live="polite">{i.quantity}</output>
                              <button type="button" aria-label="Больше" disabled={i.quantity >= 20} onClick={() => selection.setQuantity(i.variantId, i.quantity + 1)}><Icon name="plus" /></button>
                            </div>
                            <button type="button" className="sel-rm" onClick={() => removeItem(i, at < 0 ? idx : at)}><Icon name="trash" size={16} />Убрать</button>
                          </div>
                          {ch ? (
                            <div className="sel-chg ol" role="alert">
                              {ch.available ? (
                                <>
                                  <p>Цена изменилась: <s className="num">{priceFrom(i.snapshot.priceFrom)}</s> <Icon name="arrow" size={16} /> <b className="num">{priceFrom(ch.priceFrom)}</b></p>
                                  <div className="sel-chg__go">
                                    <button type="button" className="btn btn--dark btn--sm" onClick={() => sendNewPrice(i, ch)}>Отправить с новой ценой</button>
                                    <button type="button" className="btn btn--line btn--sm ol" onClick={() => removeItem(i, at < 0 ? idx : at)}>Убрать эту позицию</button>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <p>Эта позиция больше недоступна</p>
                                  <div className="sel-chg__go">
                                    <button type="button" className="btn btn--dark btn--sm" onClick={() => removeItem(i, at < 0 ? idx : at)}>Убрать эту позицию</button>
                                  </div>
                                </>
                              )}
                            </div>
                          ) : null}
                        </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
                {n ? <p className="sel-note small">{PRICE_NOTE}</p> : null}

                {done && !n ? (
                  <div className="sel-done" data-in="">
                    <h2 className="h3">Заявка {done} принята</h2>
                    <p className="txt">Отправленные позиции убраны из подборки. Что будет дальше</p>
                    <ol className="sel-next">
                      {NEXT.map((t, k) => <li key={t}><span className="D" aria-hidden="true">{k + 1}</span>{t}</li>)}
                    </ol>
                    <div className="sel-done__go">
                      <span className="lift"><Link className="btn btn--dark" to="/catalog">Вернуться в каталог</Link></span>
                      <Link className="lnk" to="/"><span className="lnk__t">На главную</span><span className="ol ar" aria-hidden="true"><Icon name="arrow" className="ico--go" /></span></Link>
                    </div>
                  </div>
                ) : null}

                {n && methods.length > 1 ? (
                  <div className="sel-block">
                    <SectionHead title="Как получить" as="h2" className="sel-sh" />
                    <div className="sel-dms" role="radiogroup" aria-label="Способ получения" data-stagger="">
                      {methods.map((m) => (
                        <div key={m.code} data-in="">
                          <label className="sel-dm ol">
                            <input className="vh" type="radio" name="sel-delivery" value={m.code} checked={delivery === m.code} onChange={() => setDelivery(m.code)} />
                            <span className="sel-dm__i"><Glyph name={DELIVERY_ICON[m.code] ?? "home"} size={22} /></span>
                            <b>{m.label}</b>
                            <span className="sel-dm__n">{DELIVERY_NOTE[m.code]}</span>
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {n && together.length ? (
                  <div className="sel-block">
                    <SectionHead title="Часто берут вместе" as="h2" className="sel-sh" />
                    <div className="sel-cards" data-stagger="">
                      {together.map((c) => <div key={key(c)} data-in=""><ProductCard p={c} back="/selection" /></div>)}
                    </div>
                  </div>
                ) : null}
              </div>

              <aside className="sel-panel cut" aria-label="Заявка" ref={panel}>
                {n ? (
                  <div className="sel-orient">
                    <div className="sel-orient__top">
                      <span className="cap">Ориентир</span>
                      <span className="tag tag--plate num">{n} {plural(n, ["позиция", "позиции", "позиций"])}</span>
                    </div>
                    {sum > 0 ? <p className="sel-orient__sum num" key={sum}>от {rubles(sum)}</p> : <p className="sel-orient__sum is-ask">Цену назовет менеджер</p>}
                    <p className="sel-orient__n">{unpriced && sum > 0 ? `Без позиций, у которых цену назовет менеджер: ${unpriced}. ` : ""}{PRICE_NOTE}</p>
                  </div>
                ) : null}
                <h2 className="sel-panel__h h4">{n || !done ? "Заявка менеджеру" : "Заявка отправлена"}</h2>
                {n ? <p className="small">Онлайн-оплаты нет: менеджер подтвердит цену и способ получения</p> : null}
                <LeadForm
                  type="catalog"
                  items={leadItems}
                  deliveryMethod={delivery}
                  onSuccess={(r, sent) => { setDone(r.reference); selection.removeSubmitted(sent); }}
                  onCatalogChanged={setChanges}
                />
              </aside>
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}
