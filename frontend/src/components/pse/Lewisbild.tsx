"use client";
/**
 * Die Lewis-Formel (Valenzstrichformel) derselben Verbindung.
 *
 * Das Schalenbild daneben zeigt, was die Elektronen tun; die Lewis-Formel ist
 * die Kurzschrift dafür, und genau so steht sie später im Heft: jedes
 * gemeinsame Elektronenpaar ein Strich zwischen den Symbolen, jedes freie Paar
 * ein Strich am Symbol. Zwei Striche sind eine Doppelbindung, drei eine
 * Dreifachbindung.
 *
 * Gezeichnet wird aus denselben Plätzen wie das Schalenbild, nur enger — die
 * Winkel sind schematisch, nicht gemessen.
 */
import { bindungsrichtungen, freiePlaetze, type Verbindung } from "@/lib/pse/bindung";

/** Abstand zweier Symbole. */
const L = 72;
/** So weit bleibt eine Bindung vom Symbol weg, damit der Strich es nicht berührt. */
const LUECKE = 15;

export default function Lewisbild({ v }: { v: Verbindung }) {
  if (v.atome.length === 0) return null;
  const orte = v.atome.map(a => ({ x: a.x * L, y: a.y * L }));
  const richtungen = bindungsrichtungen(v);
  const rand = 42;
  const xs = orte.map(o => o.x), ys = orte.map(o => o.y);
  const x0 = Math.min(...xs) - rand, y0 = Math.min(...ys) - rand;
  const breite = Math.max(...xs) + rand - x0, hoehe = Math.max(...ys) + rand - y0;

  return (
    <svg viewBox={`${x0} ${y0} ${breite} ${hoehe}`}
      className="w-full h-auto block max-w-[320px] mx-auto"
      role="img" aria-label={`Valenzstrichformel von ${v.formel}`}>
      {/* Bindungen: ein Strich je gemeinsamem Elektronenpaar */}
      {v.bindungen.map((b, i) => {
        const p = orte[b.a], q = orte[b.b];
        const laenge = Math.hypot(q.x - p.x, q.y - p.y) || 1;
        const ux = (q.x - p.x) / laenge, uy = (q.y - p.y) / laenge;
        // Quer zur Bindung versetzt, damit Doppel- und Dreifachbindungen
        // nebeneinander liegen.
        const nx = -uy, ny = ux;
        return Array.from({ length: b.grad }, (_, k) => {
          const quer = (k - (b.grad - 1) / 2) * 5;
          return (
            <line key={`${i}-${k}`}
              x1={p.x + ux * LUECKE + nx * quer} y1={p.y + uy * LUECKE + ny * quer}
              x2={q.x - ux * LUECKE + nx * quer} y2={q.y - uy * LUECKE + ny * quer}
              stroke="var(--text)" strokeWidth={1.6} strokeLinecap="round" />
          );
        });
      })}
      {v.atome.map((a, i) => (
        <g key={i}>
          {/* Freie Elektronenpaare: ein Strich quer zur Blickrichtung */}
          {freiePlaetze(richtungen[i], a.einsam).map((w, k) => {
            const cx = orte[i].x + Math.cos(w) * (LUECKE + 5);
            const cy = orte[i].y + Math.sin(w) * (LUECKE + 5);
            return (
              <line key={k}
                x1={cx - Math.sin(w) * 6} y1={cy + Math.cos(w) * 6}
                x2={cx + Math.sin(w) * 6} y2={cy - Math.cos(w) * 6}
                stroke="var(--text)" strokeWidth={1.6} strokeLinecap="round" />
            );
          })}
          <text x={orte[i].x} y={orte[i].y} textAnchor="middle" dominantBaseline="central"
            className="font-bold" fontSize={19} fill="var(--text)">{a.e.symbol}</text>
          {/* Wo das Oktett nicht aufgeht, steht es dabei — sonst sieht die
              Formel genauso gut aus wie eine richtige. */}
          {!a.erfuellt && (
            <text x={orte[i].x + 13} y={orte[i].y - 11} textAnchor="middle" fontSize={11}
              className="font-bold" fill="var(--red)">!</text>
          )}
        </g>
      ))}
    </svg>
  );
}
