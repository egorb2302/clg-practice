import { API_PREFIX, type ProductCard as Card, type ProductResponse } from "@armorix/contracts";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { POSITION_LABEL, priceFrom } from "../lib/format";
import { selection, useSelection } from "../lib/selection";
import { Icon, Img } from "./ui";

/** catalog card: photo 4:3, model, position, «от …» or «Уточнить цену», «В подборку».
   The card has no variant ids, so the button loads the product once and adds the variant
   whose price the card shows (or the first available one). */
export function ProductCard({ p, back }: { p: Card; back?: string }) {
  const to = `/catalog/${p.slug}?vehicle=${encodeURIComponent(p.vehicle.slug)}`;
  const items = useSelection();
  const inSel = items.some((i) => i.productSlug === p.slug && i.vehicleSlug === p.vehicle.slug);
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");
  const foot = useRef<HTMLDivElement>(null);
  const refocus = useRef(false);
  useEffect(() => {
    if (inSel && refocus.current) { refocus.current = false; foot.current?.querySelector<HTMLElement>("a, button")?.focus(); }
  }, [inSel]);

  async function add() {
    const hadFocus = document.activeElement?.closest(".pc__foot") === foot.current;
    setState("busy");
    try {
      const res = await fetch(`${API_PREFIX}/catalog/${encodeURIComponent(p.slug)}?vehicle=${encodeURIComponent(p.vehicle.slug)}`);
      const data = (await res.json()) as ProductResponse;
      if (!res.ok || !("product" in data)) throw new Error("load");
      const vs = data.product.variants.filter((v) => v.available && v.vehicleSlug === p.vehicle.slug);
      const v = vs.find((x) => x.priceFrom === p.priceFrom) ?? vs[0];
      if (!v) throw new Error("none");
      refocus.current = hadFocus;
      selection.add({
        variantId: v.id, productSlug: p.slug, vehicleSlug: v.vehicleSlug,
        snapshot: { title: p.title, priceFrom: v.priceFrom, imageUrl: p.image?.url ?? null, variantTitle: v.title, vehicleLabel: p.vehicle.label },
      });
      setState("idle");
    } catch {
      setState("error");
    }
  }

  return (
    <article className="pc" data-in="">
      <Link className="pc__img" to={to} state={back ? { back } : undefined} prefetch="intent" tabIndex={-1} aria-hidden="true">
        {p.image ? <Img src={p.image.url} alt="" w={p.image.width} h={p.image.height} sizes="(max-width: 767px) 100vw, 33vw" /> : <span className="pc__none">Фото комплекта готовится</span>}
        {p.image ? <span className="pc__tag">Иллюстрация</span> : null}
        {p.status === "on_request" ? <span className="pc__tag pc__tag--r">Под заказ</span> : null}
      </Link>
      <div className="pc__body">
        <p className="pc__meta"><span>{p.vehicle.label}</span><span>{POSITION_LABEL[p.position]}</span><span className="num">{p.code}</span></p>
        <h3 className="pc__t"><Link to={to} state={back ? { back } : undefined} prefetch="intent">{p.title}</Link></h3>
        <div className="pc__foot" ref={foot}>
          <b className={`pc__price num${p.priceFrom == null ? " is-ask" : ""}`}>{priceFrom(p.priceFrom)}</b>
          {inSel ? (
            <Link className="pc__add is-in" to="/selection"><Icon name="check" />В подборке</Link>
          ) : (
            <button className="pc__add" type="button" onClick={add} disabled={state === "busy"} aria-label={`В подборку: ${p.title}, ${p.vehicle.label}`}>
              <Icon name={state === "busy" ? "clock" : "plus"} />{state === "error" ? "Повторить" : "В подборку"}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
