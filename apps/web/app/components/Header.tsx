import type { Features, Vehicle } from "@armorix/contracts";
import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router";
import { useSelection } from "../lib/selection";
import { Icon, Logo, Sbtn } from "./ui";

/* thumbnails for the catalog menu, same scenes as the home model stage */
const THUMB: Record<string, string> = { "jac-t9": "/img/truck-s.webp", "haval-h3": "/img/road-mud-s.webp" };

export function Header({ features, vehicles = [] }: { features: Features; vehicles?: Vehicle[] }) {
  const items = useSelection();
  const count = items.reduce((n, i) => n + i.quantity, 0);
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const { pathname } = useLocation();

  useEffect(() => setOpen(false), [pathname]);

  // modal menu: focus trap, Esc closes, focus returns to the trigger
  useEffect(() => {
    if (!open) return;
    const el = menu.current;
    const focusables = () => [...(el?.querySelectorAll<HTMLElement>("a, button") ?? [])];
    focusables()[0]?.focus();
    document.documentElement.classList.add("is-locked");
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); trigger.current?.focus(); return; }
      if (e.key !== "Tab") return;
      const f = focusables(), first = f[0], last = f[f.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); document.documentElement.classList.remove("is-locked"); };
  }, [open]);

  const nav = [
    { to: "/catalog", label: "Каталог" },
    ...(features.offers ? [{ to: "/offers", label: "Акции" }] : []),
    ...(features.news ? [{ to: "/news", label: "Новости" }] : []),
    { to: "/about", label: "О компании" },
    { to: "/contacts", label: "Контакты" },
    ...(features.account ? [{ to: "/account", label: "Кабинет" }] : []),
  ];
  const links = nav.map((n) => (
    <li key={n.to}><NavLink to={n.to} prefetch="intent">{n.label}</NavLink></li>
  ));
  // desktop: «Каталог» opens the models on hover and keyboard focus
  const desk = nav.map((n) =>
    n.to === "/catalog" && vehicles.length ? (
      <li key={n.to} className="bar__dd">
        <NavLink to={n.to} prefetch="intent" aria-haspopup="true">{n.label}<Icon name="chev" vb="0 0 20 20" /></NavLink>
        <div className="dd" role="menu" aria-label="Модели в каталоге">
          <div className="dd__in">
            {vehicles.map((v) => (
              <Link key={v.slug} role="menuitem" className="dd__car" to={`/catalog?vehicle=${v.slug}`} prefetch="intent">
                <img src={THUMB[v.slug] ?? "/img/car-snow-s.webp"} alt="" loading="lazy" />
                <span><b>{v.label}</b><small>Защита бампера</small></span>
              </Link>
            ))}
            <div className="dd__side">
              <Link role="menuitem" to="/catalog">Весь каталог <Icon name="arrow" vb="0 0 20 20" /></Link>
              <Link role="menuitem" to="/contacts?type=custom">Под вашу модель <Icon name="arrow" vb="0 0 20 20" /></Link>
            </div>
          </div>
        </div>
      </li>
    ) : <li key={n.to}><NavLink to={n.to} prefetch="intent">{n.label}</NavLink></li>,
  );

  return (
    <header className={`bar${open ? " is-open" : ""}`}>
      <Link className="bar__logo" to="/" aria-label="ARMORIX, на главную"><Logo /></Link>
      <nav aria-label="Основное меню"><ul className="bar__links">{desk}</ul></nav>
      <div className="bar__end">
        <Link className="bar__bag" to="/selection" aria-label={`Подборка: ${count}`}>
          <Icon name="bag" />
          <span className="bar__bag-t">Подборка</span>
          {count ? <span className="bar__count num" aria-hidden="true">{count}</span> : null}
        </Link>
        <Sbtn to="/catalog" className="bar__cta">Подобрать защиту</Sbtn>
        <button ref={trigger} className="burger" type="button" aria-label={open ? "Закрыть меню" : "Открыть меню"} aria-expanded={open} aria-controls="menu" onClick={() => setOpen((o) => !o)}>
          <i /><i />
        </button>
      </div>
      {open ? (
        <div className="menu" id="menu" ref={menu} role="dialog" aria-modal="true" aria-label="Меню">
          <ul>{links}<li><NavLink to="/selection">Подборка{count ? `: ${count}` : ""}</NavLink></li></ul>
          <Sbtn to="/catalog" className="sbtn--lg">Подобрать защиту</Sbtn>
        </div>
      ) : null}
    </header>
  );
}
