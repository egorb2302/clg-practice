import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { useSelection } from "../../lib/selection";
import { ui, useUi } from "../../lib/ui";
import { Icon } from "./Icon";

export function Toast() {
  const toast = useUi((s) => s.toast);
  const drawer = useUi((s) => s.drawer);
  const n = useSelection().length;
  const [paused, setPaused] = useState(false);
  const last = useRef(toast);
  if (toast) last.current = toast;
  const on = !!toast && !drawer;

  useEffect(() => {
    if (!toast || paused) return;
    const t = window.setTimeout(() => ui.closeToast(), 6000);
    return () => window.clearTimeout(t);
  }, [toast, paused]);

  const shown = toast ?? last.current;
  return (
    <div
      className={`tst ol${on ? " is-on" : ""}${paused ? " is-paused" : ""}`}
      role="status"
      aria-live="polite"
      inert={!on}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {shown ? (
        <>
          <span className="tst__t"><b>{shown.title}</b> в подборке</span>
          <span className="tst__acts">
            <button type="button" className="lnk" onClick={() => ui.openDrawer()}><span className="lnk__t">Открыть подборку</span></button>
            <Link to="/selection" className="lnk" onClick={() => ui.closeToast()}><span className="lnk__t">Оформить подборку ({n})</span></Link>
          </span>
          <button type="button" className="x-btn ol" aria-label="Закрыть уведомление" onClick={() => ui.closeToast()}><Icon name="close" size={16} /></button>
          <span className="tst__bar" key={shown.id} aria-hidden="true" />
        </>
      ) : null}
    </div>
  );
}
