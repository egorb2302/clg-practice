import type { ProductCard as Card } from "@armorix/contracts";
import { useState } from "react";
import { Link } from "react-router";
import { priceFrom } from "../../lib/format";
import { selection, useSelection } from "../../lib/selection";
import { ui } from "../../lib/ui";
import { Icon } from "./Icon";
import { Illustration } from "./Illustration";

function cheapest(p: Card) {
  const live = p.options.filter((o) => o.available);
  const pool = live.length ? live : p.options;
  return [...pool].sort((a, b) => (a.priceFrom ?? Number.MAX_SAFE_INTEGER) - (b.priceFrom ?? Number.MAX_SAFE_INTEGER))[0];
}

type Props = { p: Card; back?: string; kitDiscountPct?: number; sizes?: string; eager?: boolean };

export function ProductCard({ p, back, kitDiscountPct, sizes = "(max-width: 767px) 100vw, (max-width: 1279px) 50vw, 33vw", eager }: Props) {
  const to = `/catalog/${p.slug}?vehicle=${encodeURIComponent(p.vehicle.slug)}`;
  const state = back ? { back } : undefined;
  const items = useSelection();
  const [optId, setOptId] = useState(() => cheapest(p)?.id ?? "");
  const opt = p.options.find((o) => o.id === optId) ?? cheapest(p);
  const inSel = !!opt && items.some((i) => i.variantId === opt.id);
  const price = opt ? opt.priceFrom : p.priceFrom;
  const many = p.options.length > 1;
  const titleId = `pc-${p.slug}-${p.vehicle.slug}`;

  function add() {
    if (!opt) return;
    selection.add({
      variantId: opt.id,
      productSlug: p.slug,
      vehicleSlug: p.vehicle.slug,
      snapshot: {
        title: p.title,
        priceFrom: opt.priceFrom,
        imageUrl: p.image?.url ?? null,
        variantTitle: many ? opt.title : undefined,
        vehicleLabel: p.vehicle.label,
        options: p.options.filter((o) => o.available).map((o) => ({ id: o.id, title: o.title, priceFrom: o.priceFrom })),
        position: p.position,
      },
    });
    ui.toast(`${p.title}, ${p.vehicle.label}`);
  }

  return (
    <div className="pc-w" data-in="">
      <article className="pc ol" aria-labelledby={titleId}>
        <Link className="pc-cover" to={to} state={state} prefetch="intent" tabIndex={-1} aria-hidden="true" />
        <div className="pc__img" style={{ position: "relative" }}>
          <Illustration src={p.image?.url ?? ""} alt={p.image?.alt ?? ""} caption={`${p.title.toLowerCase()} ${p.vehicle.label}${p.coating ? `, ${p.coating.label.toLowerCase()}` : ""}, вырезанная, на сером фоне`} sizes={sizes} eager={eager} />
          <span className={`pc__st tag${p.status === "available" ? "" : " tag--line"}`}>{p.status === "available" ? "В наличии" : "Под заказ"}</span>
          {kitDiscountPct ? <span className="pc-deal">Комплектом дешевле на {kitDiscountPct}%</span> : null}
        </div>
        <div className="pc__b">
          <p className="pc__meta">{p.vehicle.label} · {p.code}</p>
          <h3 className="pc__t" id={titleId}><Link to={to} state={state} prefetch="intent">{p.title}</Link></h3>
          {p.coating ? <p className="pc__coat">{p.coating.label}</p> : null}
          {many ? (
            <div className="pc__opts" role="radiogroup" aria-label="Вариант">
              {p.options.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  role="radio"
                  aria-checked={o.id === opt?.id}
                  disabled={!o.available}
                  className="pc__opt ol"
                  onClick={() => setOptId(o.id)}
                >
                  {o.title}
                  <small>{priceFrom(o.priceFrom)}</small>
                </button>
              ))}
            </div>
          ) : null}
          <div className="pc__price">
            <span className={`pc__p${price == null ? " is-ask" : ""}`}>{priceFrom(price)}</span>
            {price == null ? <span className="pc__note">Назовем по телефону, бесплатно</span> : null}
          </div>
          <div className="pc__act">
            <span className="lift lift--ink">
              {inSel ? (
                <button type="button" className="btn btn--dark" onClick={() => ui.openDrawer()} aria-label={`В подборке: ${p.title}, открыть подборку`}>
                  В подборке <Icon name="check" size={18} />
                </button>
              ) : (
                <button type="button" className="btn btn--dark" onClick={add} disabled={!opt || !opt.available} aria-label={`В подборку: ${p.title}, ${p.vehicle.label}`}>
                  В подборку
                </button>
              )}
            </span>
            <Link className="lnk pc__more" to={to} state={state} prefetch="intent"><span className="lnk__t">Подробнее</span></Link>
          </div>
        </div>
      </article>
    </div>
  );
}
