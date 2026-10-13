"use client";
/** Kessel mit kosmetischem Rühren: Ziehen im Kreis (oder Knopf) färbt den Trank. */
import { useRef } from "react";
import { PixelMatrix } from "@/components/challenge/pixel/Matrix";

const spiegel = (halb: string[]) => halb.map((z) => z + [...z].reverse().join(""));
export const KESSEL = spiegel(["..kkkkk", ".klllll", "kcccccc", "kcccccc", "kcccccc", ".kccccc", "..kkkkk", "..kk..k"]);
export const TRANK = spiegel(["..kkk", "...kw", "...kw", "..kww", ".kwll", ".klll", "kllll", "kllll", ".kkkk"]);

/** Farbe des Gebräus aus der Rührmenge (Grün am Anfang, wandert durchs Spektrum). */
export const braufarbe = (ruehr: number) => `hsl(${Math.round((135 + ruehr * 0.6) % 360)} 70% 55%)`;

export default function Kessel({ farbe, ruehr, setRuehr, blubbert, ueberlauf, kinder }: {
  farbe: string; ruehr: number; setRuehr(f: (r: number) => number): void; blubbert: boolean; ueberlauf: boolean; kinder?: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const letzter = useRef<number | null>(null);
  const winkel = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2));
  };
  const bewege = (e: React.PointerEvent) => {
    if (letzter.current === null) return;
    const w = winkel(e);
    let d = w - letzter.current;
    if (d > Math.PI) d -= 2 * Math.PI;
    if (d < -Math.PI) d += 2 * Math.PI;
    letzter.current = w;
    setRuehr((r) => r + Math.abs(d) * 18);
  };
  return (
    <div className="flex flex-col items-center gap-1">
      <div ref={ref} className={`relative select-none touch-none cursor-grab ${ueberlauf ? "alch-wackel" : ""}`} aria-label="Kessel (im Kreis ziehen zum Rühren)"
        onPointerDown={(e) => { letzter.current = winkel(e); (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); }}
        onPointerMove={bewege} onPointerUp={() => { letzter.current = null; }} onPointerCancel={() => { letzter.current = null; }}>
        {blubbert && [0, 1, 2].map((b) => (
          <span key={b} className="alch-blase absolute top-2 w-2 h-2 rounded-full bg-white/80" style={{ left: 20 + b * 22, animationDelay: `${b * 0.5}s` }} />
        ))}
        <div role="img" aria-label="Kessel"><PixelMatrix bild={KESSEL} palette={{ k: "#1d1a24", c: "#3b3744", l: farbe }} scale={8} /></div>
        {ueberlauf && <span className="alch-puff absolute top-0 left-1/2 text-5xl" aria-hidden>💥</span>}
        {kinder}
      </div>
      <button type="button" className="btn-secondary" onClick={() => setRuehr((r) => r + 40)}>🥄 Umrühren</button>
    </div>
  );
}
