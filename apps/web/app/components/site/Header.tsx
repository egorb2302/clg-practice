import { useEffect, useRef } from "react";
import { Link, NavLink, useLocation } from "react-router";
import { useModal } from "../../lib/modal";
import { watchHeader } from "../../lib/motion";
import { useSelection } from "../../lib/selection";
import { telegramLink } from "../../lib/format";
import { telHref, useSite, vkLink } from "../../lib/site";
import { ui, useUi } from "../../lib/ui";
import { useVehicle } from "../../lib/vehicle";
import { Icon, Logo } from "./Icon";

export function useNavLinks() {
  const { meta } = useSite();
  return [
    { to: "/catalog", label: "Каталог" },
    { to: "/about", label: "О компании" },
    ...(meta.features.offers ? [{ to: "/offers", label: "Акции" }] : []),
    ...(meta.features.news ? [{ to: "/news", label: "Новости" }] : []),
    { to: "/contacts", label: "Контакты" },
  ];
}

export function SelCount({ className = "" }: { className?: string }) {
  const items = useSelection();
  const n = items.length;
  return n ? <b className={className}>{n}</b> : null;
}

export function Header() {
  const { meta } = useSite();
  const links = useNavLinks();
  const car = useVehicle();
  const items = useSelection();
  const drawer = useUi((s) => s.drawer);
  const menu = useUi((s) => s.menu);
  const ref = useRef<HTMLElement>(null);
  const tel = telHref(meta.contacts.phone);

  useEffect(() => (ref.current ? watchHeader(ref.current) : undefined), []);

  return (
    <>
      <header ref={ref} className="hd">
        <div className="hd__in wrap">
          <div className="hd__l">
            <Link to="/" className="hd__logo" aria-label="ARMORIX, на главную"><Logo /></Link>
            {car ? (
              <span className="hd__car">Для <b title={car.label}>{car.label}</b><span aria-hidden="true">·</span><Link to="/catalog" aria-label={`Сменить машину ${car.label}`}>сменить</Link></span>
            ) : null}
          </div>
          <nav className="hd__nav" aria-label="Основная навигация">
            {links.map((l) => <NavLink key={l.to} to={l.to} prefetch="intent">{l.label}</NavLink>)}
          </nav>
          <div className="hd__r">
            {tel && meta.contacts.phone ? <a className="hd__ph" href={tel}>{meta.contacts.phone}</a> : null}
            <button
              type="button"
              className={`hd__sel ol${items.length ? "" : " is-empty"}`}
              onClick={() => ui.toggleDrawer()}
              aria-expanded={drawer}
              aria-controls="drawer"
              aria-label={`Подборка${items.length ? `, позиций: ${items.length}` : ", пусто"}`}
            >
              <Icon name="bag" /><span className="hd__sel-t">Подборка</span><SelCount />
            </button>
            {meta.features.account ? <Link className="hd__acc" to="/account"><Icon name="user" size={22} />Кабинет</Link> : null}
            <button type="button" className="hd__burger ol" aria-label="Меню" aria-expanded={menu} aria-controls="mmenu" onClick={() => ui.setMenu(true)}>
              <span aria-hidden="true" />
            </button>
          </div>
        </div>
        <span className="hd__line" aria-hidden="true" />
      </header>
      <MobileMenu />
    </>
  );
}

function MobileMenu() {
  const { meta } = useSite();
  const links = useNavLinks();
  const open = useUi((s) => s.menu);
  const car = useVehicle();
  const ref = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();
  useEffect(() => { ui.setMenu(false); }, [pathname]);
  useModal(ref, open, () => ui.setMenu(false), { fallback: ".hd__burger" });
  const tel = telHref(meta.contacts.phone);
  const tg = meta.contacts.telegram ? telegramLink(meta.contacts.telegram) : null;
  const vk = vkLink(meta.contacts.vk);
  const all =[...links, { to: "/faq", label: "Вопросы и ответы" }, ...(meta.features.account ? [{ to: "/account", label: "Кабинет" }] : [])];

  return (
    <div ref={ref} id="mmenu" className={`mm dark2${open ? " is-open" : ""}`} role="dialog" aria-modal="true" aria-label="Меню" inert={!open}>
      <div className="mm__top wrap">
        <Link to="/" className="hd__logo" aria-label="ARMORIX, на главную" onClick={() => ui.setMenu(false)}><Logo /></Link>
        <button type="button" className="x-btn ol" aria-label="Закрыть меню" onClick={() => ui.setMenu(false)} data-autofocus=""><Icon name="close" /></button>
      </div>
      <div className="wrap">
        <nav className="mm__nav" aria-label="Меню сайта">
          {all.map((l, i) => (
            <NavLink key={l.to} to={l.to} style={{ "--i": i } as React.CSSProperties} onClick={() => ui.setMenu(false)}>
              {l.label}<span className="ar ol" aria-hidden="true"><Icon name="arrow" /></span>
            </NavLink>
          ))}
        </nav>
        <div className="mm__meta">
          {car ? <div className="mm__car">Машина: <b>{car.label}</b><Link to="/catalog" onClick={() => ui.setMenu(false)}>сменить</Link></div> : null}
          {tel && meta.contacts.phone ? <a className="mm__ph" href={tel}>{meta.contacts.phone}</a> : null}
          {meta.contacts.hours ? <span>{meta.contacts.hours}</span> : null}
          {meta.contacts.email ? <a href={`mailto:${meta.contacts.email}`}>{meta.contacts.email}</a> : null}
          {tg ? <a href={tg.href} target="_blank" rel="noopener noreferrer">Telegram {tg.label}</a> : null}
          {vk ? <a href={vk.href} target="_blank" rel="noopener noreferrer">ВКонтакте</a> : null}
        </div>
      </div>
    </div>
  );
}
