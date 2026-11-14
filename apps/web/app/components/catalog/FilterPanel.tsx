import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Collapse, Icon } from "../site";
import { plural, priceFrom } from "../../lib/format";
import { useModal } from "../../lib/modal";
import { BRANDS, MODELS } from "../../lib/vehicles-catalog";
import { catHref, type CatalogView, type CatQuery, GROUPS, type GroupKey } from "./model";

type Props = {
  view: CatalogView;
  pending: CatQuery;
  loading: boolean;
  custom: { brand: string; model: string; label: string } | null;
  open: boolean;
  onClose: () => void;
  onVehicle: (slug: string) => void;
  onCustom: (brand: string, model: string) => void;
};

type ChipT = { key: string; label: string; aria: string; href?: string; onClick?: () => void };

function useLeaving(items: ChipT[]) {
  return items.map((c) => ({ ...c, out: false }));
}

const OTHER = "__other";

export function FilterPanel({ view, pending, loading, custom, open, onClose, onVehicle, onCustom }: Props) {
  const navigate = useNavigate();
  const ref = useRef<HTMLElement>(null);
  const [closed, setClosed] = useState<Set<string>>(() => new Set());
  const [pickOpen, setPickOpen] = useState(false);
  const [brand, setBrand] = useState(custom?.brand ?? "");
  const [model, setModel] = useState(custom?.model ?? "");
  useModal(ref, open, onClose, { fallback: ".cat-fbtn" });

  useEffect(() => {
    if (custom) { setBrand(custom.brand); setModel(custom.model); }
  }, [custom]);
  useEffect(() => {
    if (!open) return;
    const mq = matchMedia("(min-width: 1024px)");
    const f = () => { if (mq.matches) onClose(); };
    mq.addEventListener("change", f);
    return () => mq.removeEventListener("change", f);
  }, [open, onClose]);

  const q = view.q;
  const vehicleOn = custom || pickOpen ? OTHER : pending.vehicle ?? "";
  const toggle = (k: string) => setClosed((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  const chips: ChipT[] = [];
  if (view.vehicle) chips.push({ key: `v:${view.vehicle.slug}`, label: view.vehicle.label, aria: `Снять машину ${view.vehicle.label}`, href: catHref({ ...q, vehicle: undefined, position: [], material: [], price: [], stock: [], page: 1 }), onClick: () => onVehicle("") });
  else if (custom) chips.push({ key: `c:${custom.label}`, label: custom.label, aria: `Снять машину ${custom.label}`, onClick: () => onVehicle("") });
  for (const c of view.chips) {
    chips.push({ key: `${c.group}:${c.value}`, label: c.label, aria: `Снять фильтр ${c.label}`, href: catHref({ ...q, [c.group]: q[c.group].filter((v) => v !== c.value), page: 1 }) });
  }
  const shownChips = useLeaving(chips);
  const anyFilter = view.chips.length > 0;

  function params(form: HTMLFormElement) {
    const fd = new FormData(form);
    const next: Partial<CatQuery> = { position: [], material: [], price: [], stock: [] };
    const v = fd.get("vehicle");
    if (typeof v === "string" && v && v !== OTHER) next.vehicle = v;
    for (const g of GROUPS) next[g] = fd.getAll(g).filter((x): x is string => typeof x === "string" && !!x);
    const s = fd.get("sort");
    if (s === "price_asc" || s === "price_desc") next.sort = s;
    return next;
  }

  function onChange(e: FormEvent<HTMLFormElement>) {
    const t = e.target as HTMLInputElement;
    if (t.name === "vehicle") {
      if (t.value === OTHER) { setPickOpen(true); return; }
      setPickOpen(false);
      onVehicle(t.value);
      return;
    }
    if (!t.name || (!(GROUPS as readonly string[]).includes(t.name) && t.name !== "sort")) return;
    navigate(catHref(params(e.currentTarget)), { preventScrollReset: true });
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (open) onClose();
  }

  function onBrand(e: ChangeEvent<HTMLSelectElement>) {
    setBrand(e.target.value);
    setModel("");
  }
  function onModel(e: ChangeEvent<HTMLSelectElement>) {
    const m = e.target.value;
    setModel(m);
    if (brand && m) onCustom(brand, m);
  }

  const showLabel = loading ? "Загружаем" : view.total === 0 ? "Ничего не найдено" : `Показать ${view.total} ${plural(view.total, ["позицию", "позиции", "позиций"])}`;
  const groupChecked = (g: GroupKey, v: string) => pending[g].includes(v);

  return (
    <>
      <button type="button" className={`scrim cat-scrim${open ? " is-on" : ""}`} tabIndex={-1} aria-hidden="true" onClick={onClose} />
      <aside
        ref={ref}
        id="cat-filters"
        className={`cat-side${open ? " is-open" : ""}`}
        aria-label="Фильтры"
        {...(open ? { role: "dialog", "aria-modal": true } : {})}
      >
        <form id="cat-f" method="get" action="/catalog" className="cat-form" onChange={onChange} onSubmit={onSubmit}>
          <div className="cat-fhead">
            <h2 className="cat-fhead__t" tabIndex={-1}>Фильтры</h2>
            {anyFilter ? <Link className="cat-reset" to={catHref({ vehicle: q.vehicle, sort: q.sort })} preventScrollReset>Сбросить</Link> : null}
            <button type="button" className="x-btn ol cat-fx" onClick={onClose} aria-label="Закрыть фильтры"><Icon name="close" /></button>
          </div>

          {shownChips.length ? (
            <ul className="cat-chips" aria-label="Выбрано">
              {shownChips.map((c) => (
                <li key={c.key} className={c.out ? "is-out" : undefined}>
                  {c.href ? (
                    <Link className="cat-chip ol" to={c.href} preventScrollReset aria-label={c.aria} onClick={c.onClick ? (e) => { e.preventDefault(); c.onClick!(); } : undefined}>
                      {c.label}<Icon name="close" size={14} />
                    </Link>
                  ) : (
                    <button type="button" className="cat-chip ol" aria-label={c.aria} onClick={c.onClick}>{c.label}<Icon name="close" size={14} /></button>
                  )}
                </li>
              ))}
            </ul>
          ) : null}

          <fieldset className={`cat-grp ol${closed.has("vehicle") ? "" : " is-open"}`}>
            <legend className="vh">Машина</legend>
            <button type="button" className="cat-grp__h" aria-expanded={!closed.has("vehicle")} aria-controls="cat-g-vehicle" onClick={() => toggle("vehicle")}>
              Машина<Icon name="chev" size={18} />
            </button>
            <Collapse open={!closed.has("vehicle")} id="cat-g-vehicle">
              <div className="cat-opts">
                <label className="cat-opt cat-opt--rd">
                  <input type="radio" name="vehicle" value="" checked={vehicleOn === ""} onChange={() => undefined} />
                  <i className="cat-dot" aria-hidden="true" />
                  <span className="cat-opt__l">Все машины</span>
                </label>
                {view.vehicles.map((v) => (
                  <label key={v.slug} className="cat-opt cat-opt--rd cat-opt--kit">
                    <input type="radio" name="vehicle" value={v.slug} checked={vehicleOn === v.slug} onChange={() => undefined} />
                    <i className="cat-dot" aria-hidden="true" />
                    <span className="cat-opt__l">
                      <b>{v.label}</b>
                      {v.count ? <small>{v.count} {plural(v.count, ["позиция", "позиции", "позиций"])}{v.minPrice != null ? `, ${priceFrom(v.minPrice).replace(/ (?=\S+ ₽$)/, " ").replace(/ ₽$/, " ₽")}` : ""}</small> : null}
                    </span>
                    <span className="cat-kit">Комплекты</span>
                  </label>
                ))}
                <label className="cat-opt cat-opt--rd">
                  <input type="radio" name="vehicle" value={OTHER} checked={vehicleOn === OTHER} onChange={() => undefined} />
                  <i className="cat-dot" aria-hidden="true" />
                  <span className="cat-opt__l">
                    Другая модель
                    <small>{custom ? `${custom.label}, сделаем под нее` : "нет в списке, сделаем под нее"}</small>
                  </span>
                </label>
                <Collapse open={vehicleOn === OTHER}>
                  <div className="cat-pick">
                    <select className="in in--light" aria-label="Марка" value={brand} onChange={onBrand}>
                      <option value="">Марка</option>
                      {BRANDS.map((b) => <option key={b} value={b}>{b}</option>)}
                    </select>
                    <select className="in in--light" aria-label="Модель" value={model} onChange={onModel} disabled={!brand}>
                      <option value="">{brand ? "Модель" : "Сначала марка"}</option>
                      {(MODELS[brand] ?? []).map((m) => <option key={m.name} value={m.name}>{m.name}</option>)}
                    </select>
                  </div>
                </Collapse>
              </div>
            </Collapse>
          </fieldset>

          {(custom ? [] : view.facets).map((g) => {
            const isOpen = !closed.has(g.key);
            return (
              <fieldset key={g.key} className={`cat-grp ol${isOpen ? " is-open" : ""}`}>
                <legend className="vh">{g.title}</legend>
                <button type="button" className="cat-grp__h" aria-expanded={isOpen} aria-controls={`cat-g-${g.key}`} onClick={() => toggle(g.key)}>
                  {g.title}<Icon name="chev" size={18} />
                </button>
                <Collapse open={isOpen} id={`cat-g-${g.key}`}>
                  <div className="cat-opts">
                    {g.options.map((o) => {
                      const on = groupChecked(g.key, o.value);
                      const off = o.count === 0 && !on;
                      return (
                        <label key={o.value} className={`cat-opt${off ? " is-off" : ""}`}>
                          <input type="checkbox" name={g.key} value={o.value} checked={on} disabled={off} onChange={() => undefined} />
                          <i className="cat-cb" aria-hidden="true"><svg viewBox="0 0 12 10" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 5l3.5 3.5L11 1" /></svg></i>
                          {o.swatch ? <span className={`cat-sw cat-sw--${o.swatch}`} aria-hidden="true" /> : null}
                          <span className="cat-opt__l">{o.label}</span>
                          <small className="cat-opt__n">{o.count}</small>
                        </label>
                      );
                    })}
                  </div>
                </Collapse>
              </fieldset>
            );
          })}

          <div className="cat-fgo">
            <span className="lift lift--block lift--ink">
              <button type="submit" className="btn btn--dark btn--block" aria-busy={loading || undefined} disabled={!loading && view.total === 0 && !open}>
                {showLabel}
              </button>
            </span>
          </div>
        </form>
      </aside>
    </>
  );
}
