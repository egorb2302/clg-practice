import type { Position } from "@armorix/contracts";

const rub = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });

/** Kopecks → «от 45 900 ₽»; null → «Уточнить цену», never «0 ₽». */
export function priceFrom(kopecks: number | null | undefined): string {
  if (kopecks == null) return "Уточнить цену";
  return `от ${rub.format(Math.round(kopecks / 100))} ₽`;
}

export function rubles(kopecks: number): string {
  return `${rub.format(Math.round(kopecks / 100))} ₽`;
}

export const POSITION_LABEL: Record<Position, string> = {
  front: "Передняя защита",
  rear: "Задняя защита",
  kit: "Комплект",
};

export const PRICE_NOTE = "Окончательная стоимость зависит от комплектации и подтверждается менеджером";

/** Russian plural: plural(3, ["позиция", "позиции", "позиций"]) */
export function plural(n: number, forms: [string, string, string]): string {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b > 1 && b < 5) return forms[1];
  if (b === 1) return forms[0];
  return forms[2];
}

/** +7 (900) 000-00-00 while typing */
export function maskPhone(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("8")) d = "7" + d.slice(1);
  if (!d.startsWith("7")) d = "7" + d;
  d = d.slice(0, 11);
  const p = d.slice(1);
  let out = "+7";
  if (p.length) out += " (" + p.slice(0, 3);
  if (p.length >= 3) out += ")";
  if (p.length > 3) out += " " + p.slice(3, 6);
  if (p.length > 6) out += "-" + p.slice(6, 8);
  if (p.length > 8) out += "-" + p.slice(8, 10);
  return out;
}

/** E.164 for the API, or the raw string if it is not a full RU number (server validates). */
export function phoneE164(masked: string): string {
  const d = masked.replace(/\D/g, "");
  return d.length === 11 ? "+" + d : masked.trim();
}

/** keep short words (prepositions, conjunctions, numbers) with the next word */
export function nb(s: string): string {
  return s.replace(/\b(JAC|Haval|AISI|Tank) (T9|H3|304|300)\b/g, "$1\u00a0$2").replace(/(?<=^|[\s(«])([А-Яа-яЁёA-Za-z\d]{1,3})\s+/g, "$1\u00a0").replace(/(\d)\s+(мм|ч|₽|кг|дн)/g, "$1\u00a0$2");
}
