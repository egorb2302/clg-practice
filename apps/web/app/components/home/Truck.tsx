type Tone = {
  floor: string; tail: string; body: string; wheelBack: string; cab: string; glass: string; roof: string; hood: string; front: string;
  grille: string; lamps: string; mirror: string; seam: string; step: string; rim: string; hub: string; guard: string;
};

const TONES: Record<"grey" | "dark", Tone> = {
  grey: { floor: "none", tail: "#A4A4A0", body: "#CFCFCB", wheelBack: "#9A9A96", cab: "#CFCFCB", glass: "#B8B8B4", roof: "#A6A6A2", hood: "#C4C4C0", front: "#B9B9B5", grille: "#8E8E8A", lamps: "#F6F6F4", mirror: "#CFCFCB", seam: "#B0B0AC", step: "#8E8E8A", rim: "#8E8E8A", hub: "#CFCFCB", guard: "#3A3A3A" },
  dark: { floor: "#141414", tail: "#1C1C1C", body: "#363634", wheelBack: "#1A1A1A", cab: "#363634", glass: "#242424", roof: "#202020", hood: "#41413F", front: "#484846", grille: "#242424", lamps: "#8E8E8A", mirror: "#363634", seam: "#2A2A2A", step: "#242424", rim: "#202020", hub: "#3A3A3A", guard: "#9A9A96" },
};

export function Truck({ tone = "grey", label }: { tone?: "grey" | "dark"; label?: string }) {
  const c = TONES[tone];
  return (
    <svg viewBox="0 0 1000 440" role="img" aria-label={label ?? "Рисунок машины с защитой бампера"}>
      {c.floor !== "none" ? <ellipse cx="470" cy="404" rx="462" ry="20" fill={c.floor} /> : null}
      <ellipse cx="826" cy="346" rx="22" ry="28" fill={c.tail} />
      <path d="M70 196 L305 196 L590 186 L690 188 L695 355 L72 330 Z" fill={c.body} />
      <ellipse cx="205" cy="326" rx="64" ry="60" fill={c.wheelBack} />
      <ellipse cx="575" cy="334" rx="70" ry="66" fill={c.wheelBack} />
      <path d="M305 196 L312 100 L500 94 L590 186 Z" fill={c.cab} />
      <path d="M322 112 L398 108 L398 182 L322 186 Z" fill={c.glass} />
      <path d="M410 108 L490 104 L560 180 L410 182 Z" fill={c.glass} />
      <path d="M500 94 L640 104 L735 192 L590 186 Z" fill={c.roof} />
      <path d="M590 186 L735 192 L850 196 L690 188 Z" fill={c.hood} />
      <path d="M690 188 L850 196 L852 338 L695 355 Z" fill={c.front} />
      <path d="M712 222 L830 226 L831 284 L713 292 Z" fill={c.grille} />
      <path d="M694 196 L728 198 L728 216 L694 216 Z M814 202 L848 204 L848 220 L814 219 Z" fill={c.lamps} />
      <path d="M576 168 L600 166 L600 182 L578 184 Z" fill={c.mirror} />
      <path d="M305 198 L306 330 M405 188 L406 322 M560 188 L562 330" fill="none" stroke={c.seam} strokeWidth="1.2" />
      <path d="M70 202 L84 202 L84 244 L71 244 Z" fill={c.step} />
      <ellipse cx="205" cy="338" rx="52" ry="58" fill={c.rim} />
      <ellipse cx="205" cy="338" rx="22" ry="25" fill={c.hub} />
      <ellipse cx="575" cy="346" rx="58" ry="64" fill={c.rim} />
      <ellipse cx="575" cy="346" rx="25" ry="28" fill={c.hub} />
      <path d="M680 292 L870 284 L871 297 L681 306 Z" fill={c.guard} />
      <path d="M740 222 L740 300 M806 224 L806 296" stroke={c.guard} strokeWidth="6" />
      <path d="M704 340 L862 328 L864 341 L706 354 Z" fill={c.guard} />
      <path d="M70 196 L305 196" stroke={c.seam} strokeWidth="2" />
    </svg>
  );
}
