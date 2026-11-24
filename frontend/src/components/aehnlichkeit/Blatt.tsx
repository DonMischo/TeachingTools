"use client";
/** Kariertes Zeichenblatt in Einheiten (y nach unten) mit Ziehen und Antippen. */
import { useRef, type PointerEvent, type ReactNode } from "react";
import type { Figur, P } from "@/lib/aehnlichkeit";

export const BEREICH = { x0: -10, x1: 14, y0: -10, y1: 8 };
export const E = 24; // Pixel je Einheit
export const sx = (x: number) => (x - BEREICH.x0) * E;
export const sy = (y: number) => (y - BEREICH.y0) * E;

export function Blatt({ children, onZiehen, onTippen, label }: {
  children: ReactNode; label: string;
  /** Rückgabe true = Ziehen beginnt hier (z. B. Punkt getroffen) */
  onZiehen?: (p: P, phase: "start" | "zug" | "ende") => boolean | void;
  onTippen?: (p: P) => void;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const ziehe = useRef(false);
  const W = (BEREICH.x1 - BEREICH.x0) * E, H = (BEREICH.y1 - BEREICH.y0) * E;
  const punkt = (e: PointerEvent): P => {
    const r = svg.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W / E + BEREICH.x0, y: ((e.clientY - r.top) / r.height) * H / E + BEREICH.y0 };
  };
  const linien = [];
  for (let x = BEREICH.x0; x <= BEREICH.x1; x++) linien.push(<line key={`x${x}`} x1={sx(x)} y1={0} x2={sx(x)} y2={H} stroke="var(--color-line)" strokeWidth={x === 0 ? 1.5 : 0.6} />);
  for (let y = BEREICH.y0; y <= BEREICH.y1; y++) linien.push(<line key={`y${y}`} x1={0} y1={sy(y)} x2={W} y2={sy(y)} stroke="var(--color-line)" strokeWidth={y === 0 ? 1.5 : 0.6} />);
  return (
    <svg ref={svg} viewBox={`0 0 ${W} ${H}`} className="w-full touch-none select-none bg-surface rounded-xl" role="img" aria-label={label}
      onPointerDown={e => { const p = punkt(e); if (onZiehen?.(p, "start")) { ziehe.current = true; (e.target as Element).setPointerCapture?.(e.pointerId); } else onTippen?.(p); }}
      onPointerMove={e => { if (ziehe.current) onZiehen?.(punkt(e), "zug"); }}
      onPointerUp={e => { if (ziehe.current) { ziehe.current = false; onZiehen?.(punkt(e), "ende"); } }}>
      {linien}
      {children}
    </svg>
  );
}

export const pfad = (f: Figur) => f.map((p, i) => `${i ? "L" : "M"}${sx(p.x)} ${sy(p.y)}`).join(" ") + " Z";
const BUCHSTABEN = "ABCDEFG";

export function FigurZeichnung({ f, farbe, strich, beschriftung }: { f: Figur; farbe: string; strich?: string; beschriftung?: "" | "'" }) {
  const mx = f.reduce((s, p) => s + p.x, 0) / f.length, my = f.reduce((s, p) => s + p.y, 0) / f.length;
  return (
    <g>
      <path d={pfad(f)} fill={farbe + "26"} stroke={farbe} strokeWidth={2.5} strokeDasharray={strich} />
      {beschriftung !== undefined && f.map((p, i) => {
        const dx = p.x - mx, dy = p.y - my, l = Math.hypot(dx, dy) || 1;
        return <text key={i} x={sx(p.x + (dx / l) * 0.5)} y={sy(p.y + (dy / l) * 0.5) + 5} textAnchor="middle" fontSize={14} fontWeight={800} fill={farbe}>{BUCHSTABEN[i]}{beschriftung}</text>;
      })}
    </g>
  );
}
