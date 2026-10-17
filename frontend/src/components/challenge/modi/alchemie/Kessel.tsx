"use client";
/** Kessel mit Suppe: jede Zutat färbt sie, Rühren (im Kreis ziehen oder Knopf) wirbelt sie auf und dreht den Farbton. Das Gebräu ist die WebGL-Flüssigkeit. */
import { useEffect, useRef, useState } from "react";
import Fluessigkeit, { type Zufluss } from "@/components/fluessigkeit/Fluessigkeit";
import { hashText } from "@/lib/challenge/zufall";

/** Grundsuppe im Kessel, bevor Zutaten hineinkommen. */
export const SUPPE = "hsl(88 38% 36%)";
/** Füllstand der Suppe ohne Zutaten; jede Zutat hebt ihn. */
export const SUPPE_STAND = 0.45;

/** Farbton einer Zutat: fest aus ihrer Id. */
export const zutatFarbton = (id: string) => hashText(id) % 360;

/** Farbe des Gebräus: Mischung der Zutatenfarben (Mittel auf dem Farbkreis); Rühren dreht den Ton weiter und hellt auf. */
export function braufarbe(zutaten: string[], ruehr = 0): string {
  if (!zutaten.length) return ruehr ? `hsl(${Math.round((88 + ruehr * 0.6) % 360)} 40% 38%)` : SUPPE;
  let x = 0, y = 0;
  for (const id of zutaten) { const w = (zutatFarbton(id) * Math.PI) / 180; x += Math.cos(w); y += Math.sin(w); }
  const h = ((Math.atan2(y, x) * 180) / Math.PI + 360 + ruehr * 0.6) % 360;
  const s = Math.min(85, 50 + zutaten.length * 10);
  const l = Math.min(60, 42 + Math.min(ruehr, 150) * 0.12);
  return `hsl(${Math.round(h)} ${s}% ${Math.round(l)}%)`;
}

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

export default function Kessel({ farbe, setRuehr, blubbert, ueberlauf, fuellstand, wirbel = 0, regenbogen, zufluss, kinder }: {
  farbe: string; setRuehr(f: (r: number) => number): void; blubbert: boolean; ueberlauf: boolean; /** neue Zutat: Teilchen fallen hinein */ zufluss?: Zufluss | null;
  /** 0..1, steigt mit den Zutaten */ fuellstand: number; /** Wirbelstärke, kurz erhöht bei Treffern */ wirbel?: number; regenbogen?: boolean; kinder?: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const letzter = useRef<number | null>(null);
  // Rühren wirbelt sofort auf und klingt nach einer Weile ab
  const [schwung, setSchwung] = useState(0);
  const abklingen = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(abklingen.current), []);
  const ruehre = (menge: number) => {
    setRuehr((r) => r + menge);
    setSchwung(1);
    clearTimeout(abklingen.current);
    abklingen.current = setTimeout(() => setSchwung(0), 700);
  };
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
    ruehre(Math.abs(d) * 18);
  };
  return (
    <div className="flex flex-col items-center gap-1">
      <div ref={ref} className={`relative select-none touch-none cursor-grab ${ueberlauf ? "alch-wackel" : ""}`} style={{ width: 200, height: 170 }} aria-label="Kessel (im Kreis ziehen zum Rühren)"
        onPointerDown={(e) => { letzter.current = winkel(e); (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); }}
        onPointerMove={bewege} onPointerUp={() => { letzter.current = null; }} onPointerCancel={() => { letzter.current = null; }}>
        <div role="img" aria-label="Kessel" className="absolute inset-x-0 bottom-0 overflow-hidden"
          style={{ height: 150, borderRadius: "14px 14px 90px 90px / 14px 14px 80px 80px", background: "radial-gradient(circle at 35% 25%, #5a5566, #25212d 70%)", boxShadow: "0 10px 14px rgba(0,0,0,.45), inset 0 -8px 14px rgba(0,0,0,.5)" }}>
          <div className="absolute" style={{ left: 14, top: 14, width: 172, height: 118, borderRadius: "8px 8px 70px 70px / 8px 8px 60px 60px", overflow: "hidden", background: "#120f16", boxShadow: "inset 0 0 12px #000" }}>
            <Fluessigkeit farbe={farbe} fuellstand={fuellstand} breite={172} hoehe={118} form="kessel" wirbel={Math.max(wirbel, schwung)} blasen={blubbert || ueberlauf || schwung > 0} regenbogen={regenbogen} zufluss={zufluss} tempo={6} />
          </div>
        </div>
        <div className="absolute left-0 right-0 rounded-full" style={{ top: 12, height: 14, background: "linear-gradient(#6a6478,#2c2834)", boxShadow: "0 2px 3px rgba(0,0,0,.5)" }} aria-hidden />
        {ueberlauf && [0, 1, 2, 3].map((b) => (
          <span key={b} className="alch-tropf absolute w-3 rounded-full" style={{ left: 30 + b * 40, top: 20, height: 18, background: farbe, animationDelay: `${b * 0.15}s` }} aria-hidden />
        ))}
        {ueberlauf && <span className="alch-puff absolute top-0 left-1/2 text-5xl" aria-hidden>💥</span>}
        {kinder}
      </div>
      <button type="button" className="btn-secondary" onClick={() => ruehre(40)}>🥄 Umrühren</button>
    </div>
  );
}
