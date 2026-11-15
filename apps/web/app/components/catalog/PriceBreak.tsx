import { useEffect, useRef, useState } from "react";

export function PriceBreak({ rows }: { rows: [string, string][] }) {
  const [open, setOpen] = useState(false);
  const [up, setUp] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const pop = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const r = box.current?.getBoundingClientRect();
    const h = pop.current?.offsetHeight ?? 0;
    if (r) setUp(window.innerHeight - r.bottom < h + 16 && r.top > h + 16);
    const away = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); box.current?.querySelector("button")?.focus(); } };
    const flip = () => {
      const b = box.current?.getBoundingClientRect();
      const ph = pop.current?.offsetHeight ?? 0;
      if (b) setUp(window.innerHeight - b.bottom < ph + 16 && b.top > ph + 16);
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", key);
    window.addEventListener("resize", flip);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", key); window.removeEventListener("resize", flip); };
  }, [open]);

  return (
    <div ref={box} className={`prd-break${open ? " is-open" : ""}${up ? " is-up" : ""}`}>
      <button type="button" className="prd-break__b" aria-expanded={open} aria-controls="prd-break" onClick={() => setOpen((v) => !v)}>
        Из чего складывается цена<i className="prd-faq__pm" aria-hidden="true" />
      </button>
      <div ref={pop} id="prd-break" className="prd-break__pop ol" hidden={!open}>
        <dl className="prd-break__dl">
          {rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
        </dl>
      </div>
    </div>
  );
}
