import type { CatalogChange } from "@armorix/contracts";
import { useEffect, useRef, useState } from "react";
import { Icon, LeadForm } from "../site";
import { priceFrom } from "../../lib/format";
import { useModal } from "../../lib/modal";

type Item = { variantId: string; priceFrom: number | null; title: string; sub: string };

export function LeadPanel({ open, onClose, item }: { open: boolean; onClose: () => void; item: Item }) {
  const ref = useRef<HTMLElement>(null);
  const [change, setChange] = useState<CatalogChange | null>(null);
  useModal(ref, open, onClose, { fallback: ".prd-ask" });
  useEffect(() => { setChange(null); }, [item.variantId]);
  const seen = change && change.variantId === item.variantId ? change.priceFrom : item.priceFrom;
  const gone = !!change && change.variantId === item.variantId && !change.available;

  return (
    <>
      <button type="button" className={`scrim${open ? " is-on" : ""}`} tabIndex={-1} aria-hidden="true" onClick={onClose} />
      <aside ref={ref} className={`dr prd-lead${open ? " is-open" : ""}`} role="dialog" aria-modal="true" aria-labelledby="prd-lead-t" inert={!open}>
        <div className="dr__h">
          <h2 className="dr__t" id="prd-lead-t" tabIndex={-1}>Уточнить комплектацию</h2>
          <button type="button" className="x-btn ol" onClick={onClose} aria-label="Закрыть"><Icon name="close" /></button>
        </div>
        <div className="dr__b thin-scroll">
          <div className="prd-lead__item ol">
            <b>{item.title}</b>
            <span>{item.sub}</span>
            <span className={`prd-lead__p${seen == null ? " is-ask" : ""}`}>{priceFrom(seen)}</span>
          </div>
          <p className="prd-lead__note">Ответим, что входит в комплект, встанет ли на вашу машину и сколько займет установка</p>
          {change && change.variantId === item.variantId ? (
            <p className="prd-lead__chg" role="status">
              {gone ? "Этот вариант сейчас недоступен, выберите другой на странице товара" : `Пока вы смотрели, цена изменилась: ${priceFrom(item.priceFrom)} → ${priceFrom(change.priceFrom)}. Отправьте заявку еще раз`}
            </p>
          ) : null}
          {gone ? null : (
            <LeadForm
              type="catalog"
              items={[{ variantId: item.variantId, quantity: 1, seenPriceFrom: seen }]}
              submitLabel="Уточнить комплектацию"
              onCatalogChanged={(changes) => {
                const c = changes.find((x) => x.variantId === item.variantId);
                if (c) setChange(c);
              }}
              className="prd-lead__form"
            />
          )}
        </div>
      </aside>
    </>
  );
}
