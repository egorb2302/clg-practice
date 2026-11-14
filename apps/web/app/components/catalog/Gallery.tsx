import { type PointerEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { Icon, Illustration } from "../site";
import { useModal } from "../../lib/modal";
import { CatIcon } from "./CatIcon";

export type Shot = { src: string; alt: string };

export function Gallery({ shots, title, proofs }: { shots: Shot[]; title: string; proofs?: ReactNode }) {
  const [i, setI] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);
  const n = shots.length;
  const go = (k: number) => setI(((k % n) + n) % n);
  const start = useRef<number | null>(null);

  const down = (e: PointerEvent) => { if (e.pointerType !== "mouse") start.current = e.clientX; };
  const up = (e: PointerEvent) => {
    if (start.current == null) return;
    const dx = e.clientX - start.current;
    start.current = null;
    if (Math.abs(dx) > 40) go(i + (dx < 0 ? 1 : -1));
  };

  return (
    <div className="prd-gal" role="region" aria-roledescription="галерея" aria-label={`Фото: ${title}`}
      onKeyDown={(e) => { if (n > 1 && e.key === "ArrowRight") go(i + 1); if (n > 1 && e.key === "ArrowLeft") go(i - 1); }}>
      <div className="prd-gal__main" onPointerDown={down} onPointerUp={up} onPointerCancel={() => { start.current = null; }}>
        <div className="prd-gal__track" style={{ transform: `translate3d(${-i * 100}%, 0, 0)` }}>
          {shots.map((s, k) => (
            <div className="prd-gal__slide" key={s.src + k} aria-hidden={k !== i} role="group" aria-roledescription="кадр" aria-label={`${k + 1} из ${n}`}>
              <Illustration src={s.src} alt={s.alt} sizes="(max-width: 1023px) 100vw, 58vw" eager={k === 0} crop />
            </div>
          ))}
        </div>
        <button type="button" className="prd-gal__zoom cut" onClick={() => setZoomOpen(true)} aria-label="Открыть фото крупно" aria-haspopup="dialog"><CatIcon name="zoom" /></button>
        <div className="prd-gal__bar">
          <span className="prd-gal__cnt num" aria-live="polite">{i + 1} / {n}</span>
          {n > 1 ? (
            <div className="prd-gal__nav">
              <button type="button" className="cut" onClick={() => go(i - 1)} aria-label="Предыдущее фото"><CatIcon name="left" /></button>
              <button type="button" className="cut" onClick={() => go(i + 1)} aria-label="Следующее фото"><CatIcon name="right" /></button>
            </div>
          ) : null}
        </div>
      </div>
      {n > 1 ? (
        <div className="prd-gal__thumbs" role="group" aria-label="Кадры" style={{ "--n": Math.max(4, Math.min(n, 6)) } as React.CSSProperties}>
          {shots.map((s, k) => (
            <button key={s.src + k} type="button" className={`prd-thumb ol${k === i ? " is-on" : ""}`} aria-label={`Фото ${k + 1}: ${s.alt}`} aria-current={k === i || undefined} onClick={() => go(k)}>
              <Illustration src={s.src} alt="" thumb label={false} />
            </button>
          ))}
        </div>
      ) : null}
      {proofs}
      <Zoom shots={shots} i={i} go={go} title={title} open={zoomOpen} onClose={() => setZoomOpen(false)} />
    </div>
  );
}

function Zoom({ shots, i, go, title, open, onClose }: { shots: Shot[]; i: number; go: (k: number) => void; title: string; open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(false);
  const [origin, setOrigin] = useState("50% 50%");
  useModal(ref, open, onClose);
  useEffect(() => { if (!open) setZoom(false); }, [open]);
  useEffect(() => { setZoom(false); setOrigin("50% 50%"); }, [i]);
  const n = shots.length;
  const s = shots[i];
  if (!s) return null;

  const at = (e: { clientX: number; clientY: number; currentTarget: HTMLElement }) => {
    const r = e.currentTarget.getBoundingClientRect();
    setOrigin(`${(((e.clientX - r.left) / r.width) * 100).toFixed(1)}% ${(((e.clientY - r.top) / r.height) * 100).toFixed(1)}%`);
  };

  return (
    <div
      ref={ref}
      className={`prd-zoom${open ? " is-open" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label={`Фото крупно: ${title}`}
      inert={!open}
      onKeyDown={(e) => { if (n > 1 && e.key === "ArrowRight") { e.stopPropagation(); go(i + 1); } if (n > 1 && e.key === "ArrowLeft") { e.stopPropagation(); go(i - 1); } }}
    >
      <div className="prd-zoom__top">
        <span className="prd-zoom__n num">{i + 1} / {n}</span>
        <span className="prd-zoom__t">{title}</span>
        <button type="button" className="prd-zoom__z ol" onClick={() => setZoom((z) => !z)} aria-pressed={zoom}>{zoom ? "Отдалить" : "Приблизить"}</button>
        <button type="button" className="x-btn ol" onClick={onClose} aria-label="Закрыть фото" data-autofocus=""><Icon name="close" /></button>
      </div>
      <div className="prd-zoom__stage">
        {n > 1 ? <button type="button" className="prd-zoom__nav cut" onClick={() => go(i - 1)} aria-label="Предыдущее фото"><CatIcon name="left" /></button> : <span />}
        <div
          className={`prd-zoom__img${zoom ? " is-zoom" : ""}`}
          onClick={(e) => { at(e); setZoom((z) => !z); }}
          onPointerMove={(e) => { if (zoom && e.pointerType === "mouse") at(e); }}
        >
          <img key={s.src} src={s.src} alt={s.alt} style={{ transformOrigin: origin }} decoding="async" />
          <span className="ill__lbl">Иллюстрация</span>
        </div>
        {n > 1 ? <button type="button" className="prd-zoom__nav cut" onClick={() => go(i + 1)} aria-label="Следующее фото"><CatIcon name="right" /></button> : <span />}
      </div>
      {n > 1 ? (
        <div className="prd-zoom__thumbs">
          {shots.map((x, k) => (
            <button key={x.src + k} type="button" className={`prd-thumb ol${k === i ? " is-on" : ""}`} aria-label={`Фото ${k + 1}`} aria-current={k === i || undefined} onClick={() => go(k)}>
              <Illustration src={x.src} alt="" thumb label={false} dark />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
