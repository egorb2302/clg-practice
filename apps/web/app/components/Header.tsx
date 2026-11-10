import type { Features } from "@armorix/contracts";
import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router";
import { useSelection } from "../lib/selection";
import { Icon, Logo, Sbtn } from "./ui";

export function Header({ features }: { features: Features }) {
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

  return (
    <header className={`bar${open ? " is-open" : ""}`}>
      <Link className="bar__logo" to="/" aria-label="ARMORIX — на главную"><Logo /></Link>
      <nav aria-label="Основное меню"><ul className="bar__links">{links}</ul></nav>
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
