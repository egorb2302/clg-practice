import { type ReactNode, useId, useState } from "react";
import { Icon } from "./Icon";

export function Collapse({ open, id, className = "", children }: { open: boolean; id?: string; className?: string; children: ReactNode }) {
  return (
    <div id={id} className={`clp${open ? " is-open" : ""} ${className}`} inert={!open}>
      <div className="clp__in">{children}</div>
    </div>
  );
}

export function Disclosure({ title, children, defaultOpen = false, as: As = "h3" }: { title: ReactNode; children: ReactNode; defaultOpen?: boolean; as?: "h2" | "h3" }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className="dsc">
      <As style={{ font: "inherit", textTransform: "none" }}>
        <button type="button" className="dsc__b" aria-expanded={open} aria-controls={id} onClick={() => setOpen((v) => !v)}>
          <span>{title}</span>
          <span className="ar ol" aria-hidden="true"><Icon name="chev" /></span>
        </button>
      </As>
      <Collapse open={open} id={id}>
        <div className="dsc__body">{children}</div>
      </Collapse>
    </div>
  );
}
