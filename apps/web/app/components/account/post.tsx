import type { Vehicle } from "@armorix/contracts";
import { Fragment, type ReactNode } from "react";
import { fmtDate } from "../../lib/account";

export type Post = {
  slug: string;
  title: string;
  summary: string;
  body?: string;
  coverUrl: string | null;
  startsAt: string | null;
  endsAt: string | null;
  publishedAt: string | null;
  benefit?: string;
  minPurchases?: number | null;
  combinable?: boolean | null;
  expired?: boolean;
  eligible?: boolean;
};

type Block =
  | { k: "p"; lines: string[] }
  | { k: "h"; text: string }
  | { k: "ul"; items: string[] }
  | { k: "ol"; items: string[] }
  | { k: "q"; lines: string[] };

const UL = /^\s*[-*•]\s+/;
const OL = /^\s*\d{1,2}[.)]\s+/;

export function parseBody(text: string): Block[] {
  const out: Block[] = [];
  const chunks = text.replace(/\r\n?/g, "\n").split(/\n{2,}/);
  for (const chunk of chunks) {
    let lines = chunk.split("\n").map((l) => l.trimEnd()).filter((l) => l.trim());
    while (lines.length) {
      const first = lines[0]!;
      if (/^#{2,3}\s+/.test(first)) {
        out.push({ k: "h", text: first.replace(/^#{2,3}\s+/, "") });
        lines = lines.slice(1);
        continue;
      }
      if (UL.test(first) || OL.test(first)) {
        const re = UL.test(first) ? UL : OL;
        const items: string[] = [];
        while (lines.length && (re.test(lines[0]!) || (items.length && /^\s{2,}\S/.test(lines[0]!)))) {
          const l = lines.shift()!;
          if (re.test(l)) items.push(l.replace(re, ""));
          else items[items.length - 1] += ` ${l.trim()}`;
        }
        out.push(re === UL ? { k: "ul", items } : { k: "ol", items });
        continue;
      }
      if (/^>\s?/.test(first)) {
        const q: string[] = [];
        while (lines.length && /^>\s?/.test(lines[0]!)) q.push(lines.shift()!.replace(/^>\s?/, ""));
        out.push({ k: "q", lines: q });
        continue;
      }
      const p: string[] = [];
      while (lines.length && !/^#{2,3}\s+/.test(lines[0]!) && !UL.test(lines[0]!) && !OL.test(lines[0]!) && !/^>\s?/.test(lines[0]!)) p.push(lines.shift()!.trim());
      out.push({ k: "p", lines: p });
    }
  }
  return out;
}

const withBreaks = (lines: string[]): ReactNode => lines.map((l, i) => <Fragment key={i}>{i ? <br /> : null}{l}</Fragment>);

export function PostBody({ text, className = "" }: { text: string; className?: string }) {
  const blocks = parseBody(text);
  if (!blocks.length) return null;
  return (
    <div className={className}>
      {blocks.map((b, i) => {
        if (b.k === "h") return <h2 key={i}>{b.text}</h2>;
        if (b.k === "ul" || b.k === "ol") return b.k === "ul" ? <ul key={i}>{b.items.map((t, j) => <li key={j}>{t}</li>)}</ul> : <ol key={i}>{b.items.map((t, j) => <li key={j}><span className="n" aria-hidden="true">{String(j + 1).padStart(2, "0")}</span><span>{t}</span></li>)}</ol>;
        if (b.k === "q") return <blockquote key={i}><p>{withBreaks(b.lines)}</p></blockquote>;
        return <p key={i}>{withBreaks(b.lines)}</p>;
      })}
    </div>
  );
}

export function readMinutes(text: string | undefined): number {
  const words = (text ?? "").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 170));
}

export function vehiclesIn(text: string, vehicles: Vehicle[]): Vehicle[] {
  const t = text.toLowerCase();
  return vehicles.filter((v) => t.includes(v.label.toLowerCase()));
}

export const postText = (p: Post) => `${p.title} ${p.summary} ${p.benefit ?? ""} ${p.body ?? ""}`;

const ART = {
  news: ["/img/shop-welder.webp", "/img/install-rack.webp", "/img/shop-sparks.webp", "/img/shop-grinder.webp", "/img/install-hands.webp", "/img/steel-tubes.webp", "/img/steel-plates.webp", "/img/bumper.webp", "/img/tex-brushed.webp"],
  offer: ["/img/truck.webp", "/img/road-taiga.webp", "/img/bullbar.webp", "/img/road-fog.webp", "/img/truck-cut.webp", "/img/taiga-valley.webp", "/img/bumper.webp", "/img/install-hands.webp", "/img/taiga-peaks.webp"],
};

export type Art = Record<string, string>;

const hashOf = (slug: string) => {
  let h = 0;
  for (const c of slug) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
};

export function postArt(slug: string, type: "news" | "offer"): string {
  const list = ART[type];
  return list[hashOf(slug) % list.length]!;
}

export function assignArt(posts: { slug: string; coverUrl: string | null }[], type: "news" | "offer"): Art {
  const list = ART[type];
  const used = new Set<string>();
  const out: Art = {};
  for (const p of posts) {
    if (p.coverUrl && /^https?:\/\//i.test(p.coverUrl)) continue;
    const start = hashOf(p.slug) % list.length;
    let pick = list[start]!;
    for (let i = 0; i < list.length; i++) {
      const c = list[(start + i) % list.length]!;
      if (!used.has(c)) {
        pick = c;
        break;
      }
    }
    used.add(pick);
    out[p.slug] = pick;
  }
  return out;
}

export function coverOf(p: Post, type: "news" | "offer", art?: Art): { src: string; own: boolean } {
  return p.coverUrl && /^https?:\/\//i.test(p.coverUrl) ? { src: p.coverUrl, own: false } : { src: art?.[p.slug] ?? postArt(p.slug, type), own: true };
}

export function until(p: Post): string {
  const st = offerState(p);
  if (st === "ended") return p.endsAt ? `закончилась ${fmtDate(p.endsAt)}` : "закончилась";
  if (st === "soon" && p.startsAt) return `с ${fmtDate(p.startsAt)}`;
  return p.endsAt ? `до ${fmtDate(p.endsAt)}` : "без срока";
}

export function offerState(p: Post, now = Date.now()): "soon" | "live" | "ended" {
  if (p.expired || (p.endsAt && new Date(p.endsAt).getTime() <= now)) return "ended";
  if (p.startsAt && new Date(p.startsAt).getTime() > now) return "soon";
  return "live";
}
