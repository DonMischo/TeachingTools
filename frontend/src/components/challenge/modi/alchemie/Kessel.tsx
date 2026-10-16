"use client";
/** Kessel mit kosmetischem Rühren: Ziehen im Kreis (oder Knopf) färbt den Trank. Das Gebräu ist die WebGL-Flüssigkeit. */
import { useRef } from "react";
import Fluessigkeit from "@/components/fluessigkeit/Fluessigkeit";

/** Farbe des Gebräus aus der Rührmenge (Grün am Anfang, wandert durchs Spektrum). */
export const braufarbe = (ruehr: number) => `hsl(${Math.round((135 + ruehr * 0.6) % 360)} 70% 55%)`;

/** Glasflasche mit Flüssigkeit (live) für den frisch abgefüllten Trank. */
export function Flasche({ farbe, regenbogen, wirbel = 0 }: { farbe: string; regenbogen?: boolean; wirbel?: number }) {
  return (
    <div role="img" aria-label="Trank" className="alch-flug relative" style={{ width: 64, height: 96 }}>
      <Fluessigkeit farbe={farbe} fuellstand={0.7} breite={64} hoehe={96} form="flasche" regenbogen={regenbogen} wirbel={wirbel} />
      <svg viewBox="0 0 64 96" width={64} height={96} className="absolute inset-0 pointer-events-none" aria-hidden>
        <path d="M24 4 H40 V28 Q58 38 58 62 Q58 92 32 92 Q6 92 6 62 Q6 38 24 28 Z" fill="none" stroke="#e8f4fb" strokeOpacity="0.85" strokeWidth="2.5" />
        <rect x="22" y="0" width="20" height="9" rx="3" fill="#a0713a" />
        <path d="M14 52 Q12 72 18 84" fill="none" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </div>
  );
}

export default function Kessel({ farbe, ruehr, setRuehr, blubbert, ueberlauf, fuellstand, wirbel = 0, regenbogen, kinder }: {
  farbe: string; ruehr: number; setRuehr(f: (r: number) => number): void; blubbert: boolean; ueberlauf: boolean;
  /** 0..1, steigt mit den Zutaten */ fuellstand: number; /** Wirbelstärke, kurz erhöht bei Treffern */ wirbel?: number; regenbogen?: boolean; kinder?: React.ReactNode;
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
      <div ref={ref} className={`relative select-none touch-none cursor-grab ${ueberlauf ? "alch-wackel" : ""}`} style={{ width: 200, height: 170 }} aria-label="Kessel (im Kreis ziehen zum Rühren)"
        onPointerDown={(e) => { letzter.current = winkel(e); (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); }}
        onPointerMove={bewege} onPointerUp={() => { letzter.current = null; }} onPointerCancel={() => { letzter.current = null; }}>
        <div role="img" aria-label="Kessel" className="absolute inset-x-0 bottom-0 overflow-hidden"
          style={{ height: 150, borderRadius: "14px 14px 90px 90px / 14px 14px 80px 80px", background: "radial-gradient(circle at 35% 25%, #5a5566, #25212d 70%)", boxShadow: "0 10px 14px rgba(0,0,0,.45), inset 0 -8px 14px rgba(0,0,0,.5)" }}>
          <div className="absolute" style={{ left: 14, top: 14, width: 172, height: 118, borderRadius: "8px 8px 70px 70px / 8px 8px 60px 60px", overflow: "hidden", background: "#120f16", boxShadow: "inset 0 0 12px #000" }}>
            <Fluessigkeit farbe={farbe} fuellstand={fuellstand} breite={172} hoehe={118} form="kessel" wirbel={wirbel} blasen={blubbert || ueberlauf} regenbogen={regenbogen} />
          </div>
        </div>
        <div className="absolute left-0 right-0 rounded-full" style={{ top: 12, height: 14, background: "linear-gradient(#6a6478,#2c2834)", boxShadow: "0 2px 3px rgba(0,0,0,.5)" }} aria-hidden />
        {ueberlauf && [0, 1, 2, 3].map((b) => (
          <span key={b} className="alch-tropf absolute w-3 rounded-full" style={{ left: 30 + b * 40, top: 20, height: 18, background: farbe, animationDelay: `${b * 0.15}s` }} aria-hidden />
        ))}
        {ueberlauf && <span className="alch-puff absolute top-0 left-1/2 text-5xl" aria-hidden>💥</span>}
        {kinder}
      </div>
      <button type="button" className="btn-secondary" onClick={() => setRuehr((r) => r + 40)}>🥄 Umrühren</button>
    </div>
  );
}
