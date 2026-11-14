import { useId, useRef } from "react";
import { LEGAL, LEGAL_VERSION } from "../../lib/legal";
import { useModal } from "../../lib/modal";
import { type LegalDoc, ui, useUi } from "../../lib/ui";
import { Icon } from "./Icon";
import { TabList } from "./Tabs";

export function LegalModal() {
  const doc = useUi((s) => s.legal);
  const open = !!doc;
  const ref = useRef<HTMLDivElement>(null);
  const last = useRef<LegalDoc>("policy");
  if (doc) last.current = doc;
  const cur = LEGAL.find((d) => d.id === (doc ?? last.current)) ?? LEGAL[0]!;
  const base = useId().replace(/:/g, "");
  const close = () => ui.closeLegal();
  useModal(ref, open, close);

  return (
    <>
      <button type="button" className={`scrim scrim--top${open ? " is-on" : ""}`} tabIndex={-1} aria-hidden="true" onClick={close} />
      <div ref={ref} className={`lg ol${open ? " is-open" : ""}`} role="dialog" aria-modal="true" aria-labelledby={`${base}-h`} inert={!open}>
        <div className="lg__top">
          <TabList
            tabs={LEGAL.map((d) => ({ id: d.id, label: d.tab }))}
            value={cur.id}
            onChange={(id) => ui.openLegal(id as LegalDoc)}
            label="Документы"
            idBase={base}
          />
          <button type="button" className="x-btn ol" onClick={close} aria-label="Закрыть документ"><Icon name="close" /></button>
        </div>
        <h2 className="lg__t" id={`${base}-h`} tabIndex={-1}>{cur.title}</h2>
        <div
          key={cur.id}
          className="lg__tx tabs__panel is-swap thin-scroll"
          role="tabpanel"
          id={`${base}-p-${cur.id}`}
          aria-labelledby={`${base}-t-${cur.id}`}
          tabIndex={0}
        >
          {cur.sections.map(([h, t], i) => (
            <div key={i}>
              {h ? <h3>{h}</h3> : null}
              <p>{t}</p>
            </div>
          ))}
        </div>
        <span className="lg__ver">{LEGAL_VERSION}</span>
        <span className="lift lg__ok"><button type="button" className="btn btn--light" onClick={close}>Понятно</button></span>
      </div>
    </>
  );
}
