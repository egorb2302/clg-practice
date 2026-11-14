import { useId, useState } from "react";
import { Link } from "react-router";
import { Collapse, Icon } from "../site";

export function ProductFaq({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState(0);
  const base = useId().replace(/:/g, "");
  return (
    <div className="prd-faq">
      <div className="prd-faq__side" data-in="">
        <h2 className="prd-h2">Вопросы про эту защиту</h2>
        <Link className="lnk" to="/faq"><span className="lnk__t">Все вопросы</span><span className="ar ol" aria-hidden="true"><Icon name="arrow" /></span></Link>
      </div>
      <div className="prd-faq__list" data-stagger="">
        {items.map((it, i) => {
          const on = open === i;
          return (
            <div key={it.q} className={`prd-faq__i${on ? " is-open" : ""}`} data-in="">
              <h3>
                <button type="button" aria-expanded={on} aria-controls={`${base}-${i}`} onClick={() => setOpen(on ? -1 : i)}>
                  <span>{it.q}</span>
                  <i className="prd-faq__pm" aria-hidden="true" />
                </button>
              </h3>
              <Collapse open={on} id={`${base}-${i}`}><p>{it.a}</p></Collapse>
            </div>
          );
        })}
      </div>
    </div>
  );
}
