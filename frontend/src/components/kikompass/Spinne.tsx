"use client";
/**
 * Kompetenzspinne: vier Achsen (Verstehen, Anwenden, Reflektieren,
 * Mitgestalten), Werte 0–5 (Stufe 0, Ia, Ib, II, III). Mehrere Reihen werden
 * übereinandergelegt, z. B. »vorher« und »jetzt« oder »Klasse«.
 * Farben stehen als style, nicht als SVG-Attribut: var() wirkt in Attributen nicht.
 */
import { BEREICHE, STUFEN, type BereichId } from "@/lib/kikompass/raster";

export type Reihe = { name: string; werte: Record<BereichId, number>; farbe: string; gestrichelt?: boolean };

const R = 110;
const MITTE = 150;
const MAX = STUFEN.length;

function lage(i: number, r: number): [number, number] {
  // Verstehen oben, dann im Uhrzeigersinn.
  const winkel = -Math.PI / 2 + (i * 2 * Math.PI) / BEREICHE.length;
  return [MITTE + r * Math.cos(winkel), MITTE + r * Math.sin(winkel)];
}

const punkt = (i: number, wert: number) => lage(i, (Math.max(0, Math.min(MAX, wert)) / MAX) * R);

export function Spinne({ reihen, groesse = 340 }: { reihen: Reihe[]; groesse?: number }) {
  return (
    <figure className="flex flex-col items-center gap-2">
      <svg viewBox="-65 5 430 290" width={groesse} height={groesse * 290 / 430} role="img" className="max-w-full h-auto"
        aria-label={reihen.map(r => `${r.name}: ${BEREICHE.map(b => `${b.name} ${r.werte[b.id].toFixed(1)}`).join(", ")}`).join("; ")}>
        {STUFEN.map((s, k) => (
          <polygon key={s.id} fill="none" style={{ stroke: "var(--border)" }} strokeWidth={1}
            points={BEREICHE.map((_, i) => punkt(i, k + 1).join(",")).join(" ")} />
        ))}
        {BEREICHE.map((b, i) => {
          const [x, y] = punkt(i, MAX);
          // Beschriftung außerhalb des Rings: oben/unten näher, links/rechts mit Platz für den Text.
          const [lx, ly] = lage(i, R + (i % 2 ? 50 : 18));
          return (
            <g key={b.id}>
              <line x1={MITTE} y1={MITTE} x2={x} y2={y} style={{ stroke: "var(--border)" }} />
              <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize={12}
                style={{ fill: b.farbe, fontWeight: 600 }}>{b.icon} {b.name}</text>
            </g>
          );
        })}
        {STUFEN.map((s, k) => {
          const [x, y] = punkt(0, k + 1);
          return <text key={s.id} x={x + 4} y={y + 3} fontSize={8} style={{ fill: "var(--text-muted)" }}>{s.id}</text>;
        })}
        {reihen.map(r => (
          <polygon key={r.name}
            points={BEREICHE.map((b, i) => punkt(i, r.werte[b.id]).join(",")).join(" ")}
            style={{ fill: r.farbe, fillOpacity: r.gestrichelt ? 0.05 : 0.25, stroke: r.farbe }}
            strokeWidth={2} strokeDasharray={r.gestrichelt ? "5 4" : undefined} />
        ))}
      </svg>
      {reihen.length > 1 && (
        <figcaption className="flex flex-wrap gap-3 text-xs text-muted">
          {reihen.map(r => (
            <span key={r.name} className="flex items-center gap-1">
              <span className="inline-block w-4 h-0.5" style={{ background: r.farbe }} /> {r.name}
            </span>
          ))}
        </figcaption>
      )}
    </figure>
  );
}
