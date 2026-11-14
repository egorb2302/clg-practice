import type { ReactNode } from "react";

const P = {
  truck: <path d="M3 15h12V7H3zM15 10h4l2 3v2h-6zM7 18a2 2 0 100-4 2 2 0 000 4zM17 18a2 2 0 100-4 2 2 0 000 4z" />,
  drawing: <path d="M4 4h16v16H4zM4 9h16M9 9v11" />,
  fit: <path d="M3 17l6-6 4 4 8-8M15 7h6v6" />,
  camera: <><path d="M3 7h4l2-3h6l2 3h4v13H3z" /><path d="M12 17a4 4 0 100-8 4 4 0 000 8z" /></>,
  shieldok: <><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /><path d="M8.5 12l2.5 2.5 4.5-5" /></>,
  car: <><path d="M4 15V11l3-1 4-4h6l3 5v4" /><path d="M2 15h20" /><path d="M7 18.2a2.2 2.2 0 100-4.4 2.2 2.2 0 000 4.4zM17 18.2a2.2 2.2 0 100-4.4 2.2 2.2 0 000 4.4z" /></>,
  alert: <><path d="M12 3l10 18H2z" /><path d="M12 10v5M12 18v.5" /></>,
  zoom: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  left: <path d="M15 5l-7 7 7 7" />,
  right: <path d="M9 5l7 7-7 7" />,
  filter: <path d="M4 6h16M7 12h10M10 18h4" />,
  search: <><path d="M10.5 4a6.5 6.5 0 110 13 6.5 6.5 0 010-13z" /><path d="M15.5 15.5L20 20" /></>,
} satisfies Record<string, ReactNode>;

export type CatIconName = keyof typeof P;

export function CatIcon({ name, size, className = "" }: { name: CatIconName; size?: number; className?: string }) {
  return (
    <svg
      className={`ico ${className}`}
      viewBox="0 0 24 24"
      style={size ? { width: size, height: size } : undefined}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      focusable="false"
    >
      {P[name]}
    </svg>
  );
}
