import type { ReactNode } from "react";

const G: Record<string, ReactNode> = {
  search: <><circle cx="11" cy="11" r="7" /><path d="M16.5 16.5L21 21" /></>,
  truck: <><path d="M2 7h12v9H2zM14 10h4l4 3v3h-8" /><circle cx="6" cy="18" r="2" /><circle cx="18" cy="18" r="2" /></>,
  wrench: <><path d="M14 7l3-3 3 3-3 3M17 4v7M4 20l8-8" /><path d="M10 10l4 4" /></>,
  home: <><path d="M4 21V8l8-5 8 5v13" /><path d="M9 21v-7h6v7" /></>,
  undo: <path d="M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3" />,
};

export type GlyphName = keyof typeof G;

export function Glyph({ name, size = 20 }: { name: GlyphName; size?: number }) {
  return (
    <svg className="ico" viewBox="0 0 24 24" width={size} height={size} style={{ width: size, height: size }} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" strokeLinejoin="miter" aria-hidden="true" focusable="false">
      {G[name]}
    </svg>
  );
}
