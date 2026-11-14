import { type KeyboardEvent, type ReactNode, useRef } from "react";

export type SpecRow = [ReactNode, ReactNode];
export type SpecTab = { id: string; label: string; sub: string; rows: SpecRow[]; numbered?: boolean };

export function SpecTabs({ tabs, value, onChange }: { tabs: SpecTab[]; value: string; onChange: (id: string) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const cur = tabs.find((t) => t.id === value) ?? tabs[0]!;
  const onKey = (e: KeyboardEvent) => {
    const i = tabs.findIndex((t) => t.id === cur.id);
    let n = -1;
    if (e.key === "ArrowRight") n = (i + 1) % tabs.length;
    else if (e.key === "ArrowLeft") n = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") n = 0;
    else if (e.key === "End") n = tabs.length - 1;
    if (n < 0) return;
    e.preventDefault();
    onChange(tabs[n]!.id);
    refs.current[n]?.focus();
  };
  return (
    <div className="prd-tabs">
      <div className="prd-tabs__bar">
        <div className="prd-tabs__list" role="tablist" aria-label="О товаре" onKeyDown={onKey}>
          {tabs.map((t, i) => (
            <button
              key={t.id}
              ref={(el) => { refs.current[i] = el; }}
              type="button"
              role="tab"
              id={`prd-t-${t.id}`}
              aria-selected={t.id === cur.id}
              aria-controls={`prd-p-${t.id}`}
              tabIndex={t.id === cur.id ? 0 : -1}
              className="prd-tab"
              onClick={() => onChange(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <span className="prd-tabs__sub" key={cur.id}>{cur.sub}</span>
      </div>
      <div className="prd-tabs__panels">
        {tabs.map((t) => {
          const on = t.id === cur.id;
          const half = Math.ceil(t.rows.length / 2);
          const cols = [t.rows.slice(0, half), t.rows.slice(half)];
          return (
            <div key={t.id} id={`prd-p-${t.id}`} role="tabpanel" aria-labelledby={`prd-t-${t.id}`} tabIndex={on ? 0 : -1} inert={!on} className={`prd-panel${on ? " is-on" : ""}`}>
              {cols.map((rows, c) => (
                <dl key={c} className={`prd-spec${t.numbered ? " prd-spec--num" : ""}`}>
                  {rows.map(([k, v], r) => (
                    <div key={r} className="prd-spec__r">
                      <dt>{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
