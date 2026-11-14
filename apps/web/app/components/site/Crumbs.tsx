import { Fragment, type ReactNode } from "react";
import { Link } from "react-router";

export function Crumbs({ items, className = "" }: { items: { label: string; to?: string }[]; className?: string }) {
  return (
    <nav className={`crumb ${className}`} aria-label="Вы здесь">
      <ol>
        {items.map((it, i) => (
          <Fragment key={`${it.label}-${i}`}>
            <li>
              {it.to && i < items.length - 1 ? <Link to={it.to}>{it.label}</Link> : <span aria-current="page">{it.label}</span>}
              {i < items.length - 1 ? <span aria-hidden="true">/</span> : null}
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
  );
}

export function SectionHead({ title, sub, aside, as: As = "h2", id, className = "" }: { title: ReactNode; sub?: ReactNode; aside?: ReactNode; as?: "h1" | "h2" | "h3"; id?: string; className?: string }) {
  return (
    <div className={`sh ${className}`} data-in="">
      <div>
        <As className="sh__t" id={id}>{title}</As>
        {sub ? <p className="sh__sub">{sub}</p> : null}
      </div>
      {aside}
    </div>
  );
}
