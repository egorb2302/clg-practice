import type { ProductCard, Vehicle as KitVehicle } from "@armorix/contracts";
import type { Vehicle } from "../../lib/vehicle";

export type Kit = { vehicle: KitVehicle; products: ProductCard[] };
export type Offer = { slug: string; title: string; summary: string; endsAt?: string | null };

export type Mode = "none" | "kit" | "custom";

export function modeOf(v: Vehicle): Mode {
  return v ? v.mode : "none";
}

export const priced = (ps: ProductCard[]) => [...ps].sort((a, b) => (a.priceFrom ?? Infinity) - (b.priceFrom ?? Infinity));

export function leadProduct(kit: Kit | undefined): ProductCard | undefined {
  if (!kit) return undefined;
  return priced(kit.products.filter((p) => p.position === "front"))[0] ?? priced(kit.products)[0];
}

export function minPrice(ps: ProductCard[]): number | null {
  const p = ps.map((x) => x.priceFrom).filter((x): x is number => x != null);
  return p.length ? Math.min(...p) : null;
}

export const BODY: Record<string, string> = {
  "JAC T8": "пикап", "Great Wall Poer": "пикап", "Great Wall Wingle 7": "пикап",
  "Tank 300": "рамный внедорожник", "Tank 400": "рамный внедорожник", "Tank 500": "рамный внедорожник", "Haval H5": "рамный внедорожник",
};
export const bodyOf = (label: string) => BODY[label] ?? "кроссовер";

export const WORKS = [
  { car: "Tank 300", body: "рамный внедорожник", what: "Передняя защита, черная порошковая", img: "/img/hero-forest.webp" },
  { car: "Chery Tiggo 8 Pro", body: "кроссовер", what: "Передняя и задняя, нержавейка", img: "/img/hero-wet.webp" },
  { car: "Geely Monjaro", body: "кроссовер", what: "Задняя защита, нержавейка", img: "/img/bumper.webp" },
  { car: "Great Wall Poer", body: "пикап", what: "Передняя защита, черная порошковая", img: "/img/car-dust.webp" },
  { car: "Haval H5", body: "рамный внедорожник", what: "Передняя защита, нержавейка", img: "/img/truck-l.webp" },
];

export function coatShort(code: string | undefined): string {
  if (code === "aisi304") return "Нержавейка, полировка";
  if (code === "powder") return "Черная порошковая";
  return "Покрытие по запросу";
}

export function splitCar(text: string): { make: string; model: string } {
  const t = text.trim().replace(/\s+/g, " ");
  const i = t.indexOf(" ");
  return i > 0 ? { make: t.slice(0, i), model: t.slice(i + 1) } : { make: t, model: t };
}

export function isCalm(): boolean {
  return typeof window !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: isCalm() ? "auto" : "smooth", block: "start" });
}

export const PATH = {
  sheet: "M4 4h16v16H4zM4 9h16M9 9v11",
  fit: "M3 17l6-6 4 4 8-8M15 7h6v6",
  camera: "M3 7h4l2-3h6l2 3h4v13H3zM12 17a4 4 0 100-8 4 4 0 000 8z",
  guard: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM8.5 12l2.5 2.5 4.5-5",
  list: "M5 4h14v16H5zM8 9h8M8 13h8M8 17h5",
  phone: "M6 3l4 1 1 5-2 1a11 11 0 006 6l1-2 5 1 1 4-3 2C10 21 3 14 3 6z",
  truck: "M3 15h12V7H3zM15 10h4l2 3v2h-6zM7 18a2 2 0 100-4 2 2 0 000 4zM17 18a2 2 0 100-4 2 2 0 000 4z",
  pin: "M12 21s7-6 7-12a7 7 0 00-14 0c0 6 7 12 7 12zM12 11a2 2 0 100-4 2 2 0 000 4z",
};

export function Glyph({ d, size = 28 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden="true" focusable="false">
      <path d={d} />
    </svg>
  );
}
