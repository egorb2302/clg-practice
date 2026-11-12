import type { ReactNode } from "react";
import { Link } from "react-router";
import { LOCK_H_VIEWBOX } from "./sprite";

export function Icon({ name, className = "ico", vb = "0 0 24 24" }: { name: string; className?: string; vb?: string }) {
  return (
    <svg className={className} viewBox={vb} aria-hidden="true" focusable="false">
      <use href={`#i-${name}`} />
    </svg>
  );
}
export const Arrow = () => <Icon name="arrow" vb="0 0 20 20" />;

export function Logo({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox={LOCK_H_VIEWBOX} aria-hidden="true" focusable="false">
      <use href="#lock-h" />
    </svg>
  );
}

type SbtnProps = { children: ReactNode; to?: string; className?: string; type?: "button" | "submit"; onClick?: () => void; disabled?: boolean; busy?: boolean; state?: unknown };
/** split button: label plate + square arrow plate; a band of light crosses the steel on hover */
export function Sbtn({ children, to, className = "", type = "button", onClick, disabled, busy, state }: SbtnProps) {
  const inner = (
    <>
      <span className="sbtn__l">{children}</span>
      <span className="sbtn__a">{busy ? <span className="spin" aria-hidden="true" /> : <Arrow />}</span>
    </>
  );
  const cls = `sbtn ${className}${busy ? " is-busy" : ""}`;
  if (to) return <Link className={cls} to={to} state={state}>{inner}</Link>;
  return (
    <button className={cls} type={type} onClick={onClick} disabled={disabled} aria-disabled={busy || undefined}>
      {inner}
    </button>
  );
}

export function Chip({ n, children }: { n?: string; children: ReactNode }) {
  return (
    <span className="chip">
      {n ? <span>{n}</span> : null}
      <span>{children}</span>
    </span>
  );
}

/** two-tone heading */
export function Tt({ a, b, as: As = "h2", className = "" }: { a: ReactNode; b?: ReactNode; as?: "h1" | "h2" | "h3"; className?: string }) {
  return (
    <As className={`tt ${className}`}>
      <span>{a}</span>
      {b ? <span className="mute">{b}</span> : null}
    </As>
  );
}

const STORED = /-(\d+)\.webp$/;

export const thumbUrl = (src: string) =>
  src.startsWith("/img/") && src.endsWith(".webp") ? src.replace(/\.webp$/, "-s.webp") : STORED.test(src) ? src.replace(STORED, "-480.webp") : src;

function srcSetOf(src: string, w?: number) {
  if (src.startsWith("/img/") && src.endsWith(".webp")) return `${src.replace(/\.webp$/, "-s.webp")} 800w, ${src} 1600w`;
  const m = STORED.exec(src);
  if (!m) return undefined;
  const max = Number(m[1]);
  return [480, 960, 1600].filter((x) => x < max).map((x) => `${src.replace(STORED, `-${x}.webp`)} ${x}w`).concat(`${src} ${w ?? max}w`).join(", ");
}

export function Img({ src, alt, w, h, className, eager, sizes }: { src: string; alt: string; w?: number; h?: number; className?: string; eager?: boolean; sizes?: string }) {
  const set = srcSetOf(src, w);
  return (
    <img
      className={className}
      src={src}
      srcSet={set}
      sizes={set ? sizes ?? "100vw" : undefined}
      alt={alt}
      width={w}
      height={h}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={eager ? "high" : undefined}
    />
  );
}
