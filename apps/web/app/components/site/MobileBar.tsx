import { useSelection } from "../../lib/selection";
import { telHref, useSite } from "../../lib/site";
import { ui, useUi } from "../../lib/ui";
import { Icon } from "./Icon";

export function MobileBar() {
  const { meta } = useSite();
  const n = useSelection().length;
  const drawer = useUi((s) => s.drawer);
  const contact = useUi((s) => s.contact);
  const tel = telHref(meta.contacts.phone);
  return (
    <nav className="bb" aria-label="Быстрые действия">
      {tel ? <a href={tel}><Icon name="phone" /><span className="bb__l">Позвонить</span></a> : null}
      <button type="button" onClick={() => ui.setContact(!contact)} aria-expanded={contact} aria-haspopup="dialog" aria-controls="contact-p">
        <Icon name="mail" /><span className="bb__l">Связаться</span>
      </button>
      <button type="button" onClick={() => ui.toggleDrawer()} aria-expanded={drawer} aria-controls="drawer">
        <Icon name="bag" /><span className="bb__l">Подборка{n ? <b>{n}</b> : null}</span>
      </button>
    </nav>
  );
}
