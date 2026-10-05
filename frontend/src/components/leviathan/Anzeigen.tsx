"use client";
/** Die Leviathan-Anzeige und kleine Verlaufsdiagramme. */
import { leviathan } from "@/lib/leviathan/motor";
import type { Schnappschuss, Werte, Zone } from "@/lib/leviathan/typen";

export const ZONE_TEXT: Record<Zone, { name: string; text: string; farbe: string }> = {
  abwesend: { name: "Abwesender Leviathan", farbe: "var(--red)",
    text: "Der Staat ist zu schwach: Beschlüsse versickern, Schocks wirken ungebremst, Putsche werden wahrscheinlicher." },
  gefesselt: { name: "Gefesselter Leviathan", farbe: "var(--green)",
    text: "Staat und Gesellschaft halten sich die Waage – der schmale Korridor, in dem Freiheit und Wohlstand wachsen." },
  despotisch: { name: "Despotischer Leviathan", farbe: "var(--red)",
    text: "Der Staat ist stärker als die Gesellschaft: Er setzt schnell durch, aber Korruption bleibt verborgen." },
};

/** Zeiger auf der Skala abwesend ← Korridor → despotisch. */
export function LeviathanAnzeige({ w }: { w: Werte }) {
  const l = leviathan(w);
  const x = (p: number) => 50 + Math.max(-50, Math.min(50, p)) * 0.9; // −55…+55 → 0…100 %
  const z = ZONE_TEXT[l.zone];
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <div className="font-black text-lg" style={{ color: z.farbe }}>🐋 {z.name}</div>
        <div className="text-xs text-(--text-muted) tabular-nums">
          Staat {Math.round(l.staat)} · Gesellschaft {Math.round(l.gesellschaft)}
        </div>
      </div>
      <div className="relative h-8 mt-2 rounded-full bg-(--surface-hover)" role="meter" aria-label="Leviathan-Anzeige"
        aria-valuemin={-50} aria-valuemax={50} aria-valuenow={Math.round(l.position)} aria-valuetext={z.name}>
        <div className="absolute top-0 bottom-0 rounded-full opacity-30"
          style={{ left: `${x(-l.breite)}%`, width: `${x(l.breite) - x(-l.breite)}%`, background: "var(--green)" }} />
        <div className="absolute -top-1 -bottom-1 w-1.5 rounded-full bg-(--text) transition-all duration-700"
          style={{ left: `calc(${x(l.position)}% - 3px)` }} />
      </div>
      <div className="flex justify-between text-[11px] text-(--text-muted) mt-1">
        <span>◀ abwesend</span><span>Korridor</span><span>despotisch ▶</span>
      </div>
      <p className="text-xs text-(--text-muted) mt-2">{z.text}</p>
    </div>
  );
}

/** Kleines Liniendiagramm über alle Runden. */
export function Verlauf({ verlauf, wert, min = 0, max = 100, farbe = "var(--accent)", hoehe = 60, band }: {
  verlauf: Schnappschuss[]; wert: (s: Schnappschuss) => number; min?: number; max?: number;
  farbe?: string; hoehe?: number; band?: [number, number];
}) {
  const B = 300;
  const n = Math.max(1, verlauf.length - 1);
  const y = (v: number) => hoehe - ((v - min) / (max - min)) * hoehe;
  const punkte = verlauf.map((s, i) => `${(i / n) * B},${y(wert(s))}`).join(" ");
  return (
    <svg viewBox={`0 0 ${B} ${hoehe}`} className="w-full" style={{ height: hoehe }} preserveAspectRatio="none" aria-hidden>
      {band && <rect x={0} width={B} y={y(band[1])} height={y(band[0]) - y(band[1])} style={{ fill: "var(--green)", opacity: 0.15 }} />}
      <polyline points={punkte} style={{ fill: "none", stroke: farbe, strokeWidth: 2.5 }} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
