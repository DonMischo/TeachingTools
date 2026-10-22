"use client";
/**
 * Lebensbalken mit Spielgefühl: sinkt weich ab, ein heller Geisterbalken zeigt kurz den Verlust und läuft nach,
 * jeder Verlust blitzt und rüttelt, bei wenig Leben pulsiert der Balken rot. Mehrere schnelle Treffer sammeln sich im Geist.
 */
import { useEffect, useRef, useState } from "react";
import { wenigerBewegung } from "@/lib/challenge/bewegung";

/** So lange bleibt der Geisterbalken stehen, bevor er nachläuft (ms) */
export const GEIST_HALTEN = 450;
/** Ab diesem Anteil gilt das Leben als knapp */
export const KNAPP = 0.25;

const CSS = `@keyframes lbpuls{0%,100%{filter:brightness(1)}50%{filter:brightness(1.6)}}
@keyframes lbglut{0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0)}50%{box-shadow:0 0 8px 2px rgba(239,68,68,.75)}}
.lb-knapp{animation:lbglut .9s ease-in-out infinite}.lb-knapp .lb-fuell{animation:lbpuls .9s ease-in-out infinite}
@media (prefers-reduced-motion: reduce){.lb-knapp,.lb-knapp .lb-fuell{animation:none}.lb-knapp{box-shadow:0 0 0 2px rgba(239,68,68,.8)}}`;

const farbeFuer = (p: number) => (p > 0.5 ? "#4ade80" : p > 0.2 ? "#facc15" : "#ef4444");

export function LebensBalken({ wert, max, label, farbe, warnen = true, className = "h-3 rounded" }: {
  wert: number; max: number;
  /** Name für Screenreader (ohne: nur Dekoration) */ label?: string;
  /** feste Farbe (z. B. EP-Balken), sonst grün → gelb → rot */ farbe?: string;
  /** rotes Pulsieren bei wenig Leben */ warnen?: boolean;
  className?: string;
}) {
  const p = max ? Math.max(0, Math.min(1, wert / max)) : 0;
  const [geist, setGeist] = useState(p);
  const vorher = useRef(p);
  const huelle = useRef<HTMLDivElement>(null), blitz = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const alt = vorher.current;
    vorher.current = p;
    if (p >= alt) { setGeist(p); return; }
    // Verlust: Blitz und Rütteln, der Geist bleibt beim höchsten Stand stehen und läuft nach dem letzten Treffer nach
    if (!wenigerBewegung()) {
      huelle.current?.animate?.([{ transform: "translateX(0)" }, { transform: "translateX(-4px)" }, { transform: "translateX(3px)" }, { transform: "translateX(-2px)" }, { transform: "translateX(0)" }], { duration: 280 });
    }
    blitz.current?.animate?.([{ opacity: 0.85 }, { opacity: 0 }], { duration: 320, easing: "ease-out" });
    const t = setTimeout(() => setGeist(p), GEIST_HALTEN);
    return () => clearTimeout(t);
  }, [p]);

  const knapp = warnen && p > 0 && p <= KNAPP;
  return (
    <div ref={huelle} role={label ? "progressbar" : undefined} aria-label={label} aria-valuemin={label ? 0 : undefined} aria-valuemax={label ? max : undefined} aria-valuenow={label ? wert : undefined}
      aria-hidden={label ? undefined : true} data-knapp={knapp || undefined}
      className={`relative overflow-hidden border border-line bg-black/30 ${knapp ? "lb-knapp" : ""} ${className}`}>
      <style>{CSS}</style>
      <div data-teil="geist" className="absolute inset-y-0 left-0 bg-white/80" style={{ width: `${Math.max(geist, p) * 100}%`, transition: "width .6s ease-in" }} />
      <div data-teil="fuellung" className="lb-fuell absolute inset-y-0 left-0"
        style={{ width: `${p * 100}%`, background: farbe ?? farbeFuer(p), transition: "width .35s cubic-bezier(.2,.8,.3,1), background-color .3s" }} />
      {/* Glanzkante oben und feine Zehntel-Striche */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(to bottom, rgba(255,255,255,.35), rgba(255,255,255,0) 55%)" }} />
      <div className="absolute inset-0 pointer-events-none" style={{ background: "repeating-linear-gradient(90deg, transparent 0 calc(10% - 1px), rgba(0,0,0,.22) calc(10% - 1px) 10%)" }} />
      <div ref={blitz} className="absolute inset-0 bg-white pointer-events-none" style={{ opacity: 0 }} />
    </div>
  );
}
