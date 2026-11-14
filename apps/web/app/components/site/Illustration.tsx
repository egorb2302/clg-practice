import type { Position } from "@armorix/contracts";

const W: Record<string, [number, number]> = {
  bullbar: [1240, 992], bumper: [1600, 800], "car-dust": [1600, 800], "car-snow": [1600, 800], engine: [500, 500],
  "hero-forest": [1600, 800], "hero-wet": [1600, 800], "install-hands": [1600, 800], "install-rack": [1600, 800],
  "road-fog": [1600, 800], "road-mud": [1600, 800], "road-taiga": [1600, 800], "shop-grinder": [1600, 800],
  "shop-sparks": [1600, 800], "shop-welder": [1600, 800], "steel-chrome": [1600, 800], "steel-liquid": [736, 736],
  "steel-plates": [736, 736], "steel-tubes": [1200, 800], "steel-wrenches": [1600, 800], "taiga-hills": [736, 736],
  "taiga-peaks": [500, 500], "taiga-spruce": [736, 736], "taiga-valley": [735, 735], "tex-brushed": [1199, 800],
  "tex-scratch": [901, 800], "truck-cut": [1600, 800], "truck-l": [2800, 800], truck: [1600, 800],
};
const STORED = /-(\d+)\.webp$/;

function srcSet(src: string): string | undefined {
  const own = /^\/img\/([a-z-]+)\.webp$/.exec(src);
  if (own) {
    const w = W[own[1]!];
    if (!w || w[0] === w[1]) return undefined;
    return `${src.replace(/\.webp$/, "-s.webp")} ${w[1]}w, ${src} ${w[0]}w`;
  }
  const m = STORED.exec(src);
  if (!m) return undefined;
  const max = Number(m[1]);
  return [480, 960, 1600].filter((x) => x < max).map((x) => `${src.replace(STORED, `-${x}.webp`)} ${x}w`).concat(`${src} ${max}w`).join(", ");
}

export function thumbOf(src: string): string {
  if (/^\/img\/[a-z-]+\.webp$/.test(src)) return src.replace(/\.webp$/, "-s.webp");
  const m = STORED.exec(src);
  return m && Number(m[1]) > 480 ? src.replace(STORED, "-480.webp") : src;
}

export function productArt(position?: Position | null): string {
  return position === "rear" ? "/img/bumper.webp" : position === "kit" ? "/img/truck-cut.webp" : "/img/bullbar.webp";
}

type Props = {
  src: string;
  alt: string;
  ratio?: string;
  sizes?: string;
  eager?: boolean;
  label?: boolean;
  crop?: boolean;
  dark?: boolean;
  thumb?: boolean;
  className?: string;
};

export function Illustration({ src, alt, ratio, sizes = "100vw", eager, label = true, crop, dark, thumb, className = "" }: Props) {
  const file = thumb ? thumbOf(src) : src;
  const set = thumb ? undefined : srcSet(src);
  return (
    <div className={`ill${crop ? " ill--crop" : ""}${dark ? " ill--dark" : ""} ${className}`} style={ratio ? ({ "--r": ratio } as React.CSSProperties) : undefined}>
      <img
        src={file}
        srcSet={set}
        sizes={set ? sizes : undefined}
        alt={alt}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={eager ? "high" : undefined}
      />
      {label ? <span className="ill__lbl">Иллюстрация</span> : null}
    </div>
  );
}
