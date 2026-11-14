import { useSelection } from "../../lib/selection";
import { telHref, useSite } from "../../lib/site";
import { ui, useUi } from "../../lib/ui";
import { Icon } from "./Icon";

export function MobileBar() {
  const { meta } = useSite();
  const n = useSelection().length;
  const drawer = useUi((s) => s.drawer);
  const tel = telHref(meta.contacts.phone);
  return (
    <nav className="bb" aria-label="Быстрые действия">
      {tel ? <a href={tel}><Icon name="phone" />Позвонить</a> : null}
      <button type="button" onClick={() => ui.toggleDrawer()} aria-expanded={drawer} aria-controls="drawer">
        <Icon name="bag" />Подборка{n ? <b>{n}</b> : null}
      </button>
    </nav>
  );
}
