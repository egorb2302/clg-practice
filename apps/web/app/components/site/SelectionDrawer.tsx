import { API_PREFIX, type CatalogResponse, type ProductCard as Card } from "@armorix/contracts";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { plural, priceFrom, rubles } from "../../lib/format";
import { useModal } from "../../lib/modal";
import { selection, setDelivery, type SelectionItem, useDelivery, useSelection } from "../../lib/selection";
import { useSite } from "../../lib/site";
import { ui, useUi } from "../../lib/ui";
import { useVehicle } from "../../lib/vehicle";
import { Icon } from "./Icon";
import { Illustration, productArt } from "./Illustration";

const sugCache = new Map<string, Card[]>();

function cheapest(p: Card) {
  return [...p.options.filter((o) => o.available)].sort((a, b) => (a.priceFrom ?? Number.MAX_SAFE_INTEGER) - (b.priceFrom ?? Number.MAX_SAFE_INTEGER))[0];
}

export function addCard(p: Card) {
  const o = cheapest(p);
  if (!o) return;
  selection.add({
    variantId: o.id,
    productSlug: p.slug,
    vehicleSlug: p.vehicle.slug,
    snapshot: {
      title: p.title,
      priceFrom: o.priceFrom,
      imageUrl: p.image?.url ?? null,
      variantTitle: p.options.length > 1 ? o.title : undefined,
      vehicleLabel: p.vehicle.label,
      options: p.options.filter((x) => x.available).map((x) => ({ id: x.id, title: x.title, priceFrom: x.priceFrom })),
      position: p.position,
    },
  });
}

export function SelectionDrawer() {
  const open = useUi((s) => s.drawer);
  const items = useSelection();
  const car = useVehicle();
  const { meta } = useSite();
  const ref = useRef<HTMLElement>(null);
  const [undo, setUndo] = useState<{ item: SelectionItem; index: number } | null>(null);
  const [sug, setSug] = useState<Card[]>([]);
  const chosenDlv = useDelivery();
  const close = () => ui.closeDrawer();
  useModal(ref, open, close, { fallback: ".hd__sel" });

  const undoBtn = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (!open) setUndo(null); }, [open]);
  useEffect(() => { if (undo) undoBtn.current?.focus(); }, [undo]);

  const sugVehicle = items[0]?.vehicleSlug ?? (car?.mode === "kit" ? car.slug : "");
  const sugOff = !items.length && car?.mode === "custom";
  useEffect(() => {
    if (!open || sugOff) return;
    const k = sugVehicle;
    const hit = sugCache.get(k);
    if (hit) { setSug(hit); return; }
    let live = true;
    fetch(`${API_PREFIX}/catalog${k ? `?vehicle=${encodeURIComponent(k)}` : ""}`)
      .then((r) => (r.ok ? (r.json() as Promise<CatalogResponse>) : null))
      .then((d) => { if (d && live) { sugCache.set(k, d.items); setSug(d.items); } })
      .catch(() => undefined);
    return () => { live = false; };
  }, [open, sugVehicle, sugOff]);

  const picked = new Set(items.map((i) => `${i.productSlug}|${i.vehicleSlug}`));
  const suggestions = sugOff ? [] : sug.filter((p) => !picked.has(`${p.slug}|${p.vehicle.slug}`) && cheapest(p)).slice(0, 3);
  const sugHead = items.length ? "Часто берут вместе" : car?.mode === "kit" ? `Комплекты для ${car.label}` : "Популярные комплекты";

  const qty = items.reduce((t, i) => t + i.quantity, 0);
  const sum = items.reduce((t, i) => t + (i.snapshot.priceFrom ?? 0) * i.quantity, 0);
  const unpriced = items.some((i) => i.snapshot.priceFrom == null);
  const qtyText = `${qty} ${plural(qty, ["позиция", "позиции", "позиций"])}`;
  const methods = meta.deliveryMethods;
  const dlv = methods.find((m) => m.code === chosenDlv)?.code ?? methods[0]?.code;

  function remove(item: SelectionItem, index: number) {
    selection.remove(item.variantId);
    setUndo({ item, index });
  }

  return (
    <>
      <button type="button" className={`scrim${open ? " is-on" : ""}`} tabIndex={-1} aria-hidden="true" onClick={close} />
      <aside ref={ref} id="drawer" className={`dr${open ? " is-open" : ""}`} role="dialog" aria-modal="true" aria-labelledby="dr-t" inert={!open}>
        <div className="dr__h">
          <h2 className="dr__t" id="dr-t" tabIndex={-1}>Ваша подборка</h2>
          {items.length ? <span className="dr__cnt">{qtyText}</span> : null}
          <button type="button" className="x-btn ol" onClick={close} aria-label="Закрыть подборку"><Icon name="close" /></button>
        </div>

        <div className="dr__b thin-scroll">
          {!items.length ? (
            <div className="dr-empty">
              <span className="dr-empty__ico ol" aria-hidden="true"><Icon name="bag" /></span>
              <b>Подборка пока пустая</b>
              {car?.mode === "custom" ? (
                <>
                  <p>Под {car.label} готового комплекта нет, сделаем под заказ: опишите машину, и посчитаем</p>
                  <span className="lift"><Link to="/#quiz" className="btn btn--light" onClick={close}>Рассчитать под {car.label}<Icon name="arrow" className="ico--go" /></Link></span>
                </>
              ) : (
                <>
                  <p>Добавьте комплект кнопкой «В подборку» в карточке или прямо отсюда, это ни к чему не обязывает</p>
                  <span className="lift"><Link to={car?.mode === "kit" ? `/catalog?vehicle=${encodeURIComponent(car.slug)}` : "/catalog"} className="btn btn--light" onClick={close}>Смотреть комплекты<Icon name="arrow" className="ico--go" /></Link></span>
                </>
              )}
            </div>
          ) : null}

          {items.map((it, i) => {
            const to = `/catalog/${it.productSlug}?vehicle=${encodeURIComponent(it.vehicleSlug)}`;
            const opts = it.snapshot.options ?? [];
            const p = it.snapshot.priceFrom;
            return (
              <div className="dr-it" key={it.variantId}>
                <Illustration className="dr-it__img" src={it.snapshot.imageUrl ?? productArt(it.snapshot.position)} alt="" thumb dark />
                <div className="dr-it__i">
                  <Link className="dr-it__t" to={to} onClick={close}>{it.snapshot.title}</Link>
                  {it.snapshot.vehicleLabel ? <span className="dr-it__car">{it.snapshot.vehicleLabel}</span> : null}
                  {opts.length > 1 ? (
                    <div className="dr-it__opts" role="radiogroup" aria-label={`Вариант: ${it.snapshot.title}`}>
                      {opts.map((o) => (
                        <button key={o.id} type="button" role="radio" aria-checked={o.id === it.variantId} className="chip ol" onClick={() => selection.swap(it.variantId, o)}>{o.title}</button>
                      ))}
                    </div>
                  ) : it.snapshot.variantTitle ? <span className="dr-it__var">{it.snapshot.variantTitle}</span> : null}
                  <div className="dr-it__bot">
                    <span className={`dr-it__p${p == null ? " is-ask" : ""}`}>{priceFrom(p)}</span>
                    <div className="dr-it__ctl">
                      <div className="qty" role="group" aria-label={`Количество: ${it.snapshot.title}`}>
                        <button type="button" aria-label="Меньше" disabled={it.quantity <= 1} onClick={() => selection.setQuantity(it.variantId, it.quantity - 1)}><Icon name="minus" /></button>
                        <output aria-live="polite">{it.quantity}</output>
                        <button type="button" aria-label="Больше" disabled={it.quantity >= 20} onClick={() => selection.setQuantity(it.variantId, it.quantity + 1)}><Icon name="plus" /></button>
                      </div>
                      <button type="button" className="dr-it__rm ol" onClick={() => remove(it, i)} aria-label={`Удалить из подборки: ${it.snapshot.title}`}><Icon name="trash" /><span>Удалить</span></button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {undo ? (
            <div className="dr-undo" role="status">
              <span>Удалено: {undo.item.snapshot.title}</span>
              <button ref={undoBtn} type="button" onClick={() => { selection.restore(undo.item, undo.index); setUndo(null); }}>Вернуть</button>
            </div>
          ) : null}

          {suggestions.length ? (
            <div className="dr-sug">
              <span className="cap">{sugHead}</span>
              {suggestions.map((p) => {
                const o = cheapest(p)!;
                return (
                  <div className="dr-sg ol" key={`${p.slug}|${p.vehicle.slug}`}>
                    <Illustration src={p.image?.url ?? productArt(p.position)} alt="" thumb dark />
                    <div>
                      <span className="dr-sg__t">{p.title}</span>
                      <span className="dr-sg__s">{p.vehicle.label}, {priceFrom(o.priceFrom)}</span>
                    </div>
                    <button type="button" className="btn btn--line ol" onClick={() => addCard(p)} aria-label={`В подборку: ${p.title}, ${p.vehicle.label}`}><Icon name="plus" size={16} />В подборку</button>
                  </div>
                );
              })}
            </div>
          ) : null}

          {items.length ? (
            <Link to="/catalog" className="lnk dr__more" onClick={close}><span className="ar ol" aria-hidden="true"><Icon name="back" className="ico--back" /></span><span className="lnk__t">Продолжить выбор</span></Link>
          ) : null}
        </div>

        {items.length ? (
          <div className="dr__f">
            <div className="dr__row"><span>{qtyText}</span><span className="D">{sum ? rubles(sum) : "цена по запросу"}</span></div>
            {methods.length > 1 ? (
              <fieldset className="dr-dlv">
                <legend>Способ получения</legend>
                {methods.map((m) => (
                  <label key={m.code} className="rdo">
                    <input className="vh" type="radio" name="dr-dlv" value={m.code} checked={dlv === m.code} onChange={() => setDelivery(m.code)} />
                    <i aria-hidden="true" />{m.label}
                  </label>
                ))}
              </fieldset>
            ) : null}
            <div className="dr__tot"><span>Ориентир</span><span className="D">{sum ? `от ${rubles(sum)}` : "назовет менеджер"}</span></div>
            {unpriced && sum ? <span className="dr__ask">Позиции без цены назовем по телефону, бесплатно</span> : null}
            <span className="lift lift--block">
              <Link to="/selection" className="btn btn--light btn--lg btn--block" onClick={close}>Оформить заявку<Icon name="arrow" className="ico--go" /></Link>
            </span>
            <p className="dr__trust"><Icon name="shield" />Это не оплата: менеджер перезвонит и подтвердит цену</p>
          </div>
        ) : null}
      </aside>
    </>
  );
}
