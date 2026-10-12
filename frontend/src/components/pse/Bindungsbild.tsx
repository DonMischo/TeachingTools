"use client";
/**
 * Die Verbindung im Schalenbild: die Atome rücken so zusammen, dass sich ihre
 * Außenschalen überlappen — und genau dort pendelt das geteilte
 * Elektronenpaar hin und her.
 *
 * Das ist der Kern der Sache: ein bindendes Paar gehört keinem der beiden
 * Atome allein. Es bewegt sich zwischen den Schalen, und beide zählen es mit.
 * Darum hat Sauerstoff im Wasser acht Elektronen und jedes Wasserstoffatom
 * zwei, obwohl zusammen nur acht da sind.
 *
 * Bewegt wird mit CSS: eine Gruppe wird in die Bindungsrichtung gedreht, die
 * Gruppe darin pendelt auf ihrer eigenen x-Achse.
 */
import type { BindungsAtom, Verbindung } from "@/lib/pse/bindung";

/** Radius der Außenschale. Der Kernabstand liegt darunter, damit sich die Schalen überlappen. */
const R = 48;

const BEWEGUNG = `
@keyframes bd-pendel { from { transform: translateX(var(--weg)); } to { transform: translateX(calc(-1 * var(--weg))); } }
@keyframes bd-flimmern { 0%, 100% { opacity: 0.85; } 50% { opacity: 1; } }
@keyframes bd-glimmen { 0%, 100% { opacity: 0.10; } 50% { opacity: 0.22; } }
.bd-pendel { animation: bd-pendel 2.6s ease-in-out infinite alternate; }
.bd-einsam { animation: bd-flimmern 3.4s ease-in-out infinite; }
.bd-ueberlapp { animation: bd-glimmen 2.6s ease-in-out infinite; }
.bd-still * { animation-play-state: paused !important; }
@media (prefers-reduced-motion: reduce) {
  .bd-pendel, .bd-einsam, .bd-ueberlapp { animation: none; }
}
`;

/** Ein Elektron. Geteilte sind in Akzentfarbe, eigene blau. */
const Elektron = ({ x, y, geteilt }: { x: number; y: number; geteilt?: boolean }) => (
  <circle cx={x} cy={y} r={5} fill={geteilt ? "var(--accent)" : "#93c5fd"}
    stroke="var(--surface)" strokeWidth={1.4} />
);

/**
 * Die Richtungen, in die die freien Paare eines Atoms zeigen: acht Plätze auf
 * der Schale, die weitesten von allen Bindungen weg.
 */
function freiePlaetze(richtungen: number[], anzahl: number): number[] {
  const slots = Array.from({ length: 8 }, (_, i) => (i / 8) * 2 * Math.PI);
  // Abstand zur nächsten Bindung, über den kürzeren Weg um den Kreis gemessen.
  const abstand = (w: number) =>
    richtungen.length === 0 ? 1
      : Math.min(...richtungen.map(b => Math.abs(Math.atan2(Math.sin(w - b), Math.cos(w - b)))));
  return slots.sort((x, y) => abstand(y) - abstand(x)).slice(0, anzahl);
}

/** Ein Atom mit Kern, Schalen und seinen freien Elektronenpaaren. */
function Atom({ a, cx, cy, richtungen }: {
  a: BindungsAtom; cx: number; cy: number; richtungen: number[];
}) {
  const n = a.schalen.length;
  const plaetze = freiePlaetze(richtungen, a.einsam);
  return (
    <g>
      {a.schalen.map((_, i) => (
        <circle key={i} cx={cx} cy={cy} r={(R * (i + 1)) / n} fill="none"
          stroke={i === n - 1 ? "var(--accent)" : "var(--border)"}
          strokeWidth={i === n - 1 ? 1.4 : 0.8} opacity={i === n - 1 ? 0.75 : 0.5} />
      ))}
      {/* Der Kern bleibt klein und gleich groß — hier zählt die Hülle. */}
      <circle cx={cx} cy={cy} r={15} fill="var(--surface)" stroke="#f87171" strokeWidth={1.2} />
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central"
        className="font-black" fontSize={16} fill="var(--text)">{a.e.symbol}</text>
      {/* Freie Elektronenpaare auf der Außenschale */}
      {plaetze.map((w, i) => (
        <g key={i} className="bd-einsam" style={{ animationDelay: `${i * 0.5}s` }}>
          {[-1, 1].map(seite => (
            <Elektron key={seite}
              x={cx + Math.cos(w) * R - Math.sin(w) * seite * 6}
              y={cy + Math.sin(w) * R + Math.cos(w) * seite * 6} />
          ))}
        </g>
      ))}
      {/* Bilanz: wie viele Elektronen liegen um dieses Atom */}
      <text x={cx} y={cy + R + 17} textAnchor="middle" fontSize={11} className="font-bold tabular-nums"
        fill={a.erfuellt ? "var(--green)" : "var(--red)"}>
        {a.huelle}e⁻{a.erfuellt ? " ✓" : ` statt ${a.soll}`}
      </text>
    </g>
  );
}

export default function Bindungsbild({ v, laufen = true }: { v: Verbindung; laufen?: boolean }) {
  if (v.atome.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-sm text-muted">
        Noch kein Atom gewählt — nimm unten eines dazu.
      </div>
    );
  }
  // Mehr Nachbarn brauchen mehr Platz, sonst stoßen sie aneinander.
  const nachbarn = v.zentrum === null ? 1 : v.atome.length - 1;
  const L = nachbarn >= 5 ? 112 : 88;
  const orte = v.atome.map(a => ({ x: a.x * L, y: a.y * L }));
  const rand = R + 34;
  const xs = orte.map(o => o.x), ys = orte.map(o => o.y);
  const x0 = Math.min(...xs) - rand, y0 = Math.min(...ys) - rand;
  const breite = Math.max(...xs) + rand - x0, hoehe = Math.max(...ys) + rand - y0;

  /** Richtungen der Bindungen je Atom — dorthin kommen keine freien Paare. */
  const richtungen = v.atome.map((_, i) =>
    v.bindungen.filter(b => b.a === i || b.b === i).map(b => {
      const anderer = b.a === i ? b.b : b.a;
      return Math.atan2(orte[anderer].y - orte[i].y, orte[anderer].x - orte[i].x);
    }));

  return (
    <svg viewBox={`${x0} ${y0} ${breite} ${hoehe}`}
      className="w-full h-auto block max-w-[460px] mx-auto"
      role="img" aria-label={`${v.formel} im Schalenmodell: ${v.bindungen.length} Bindungen`}>
      <style>{BEWEGUNG}</style>
      <g className={laufen ? undefined : "bd-still"}>
        {v.bindungen.map((b, i) => {
          const p = orte[b.a], q = orte[b.b];
          const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2;
          const grad = (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI;
          const abstand = Math.hypot(q.x - p.x, q.y - p.y);
          // So weit pendelt das Paar: bis dicht an den einen Kern und zurück.
          const weg = Math.max(14, abstand / 2 - 20);
          return (
            <g key={i} transform={`rotate(${grad} ${mx} ${my})`}>
              {/* Der Bereich, in dem sich die Schalen überlappen */}
              <ellipse className="bd-ueberlapp" cx={mx} cy={my} rx={abstand / 2 + 6} ry={26}
                fill="var(--accent)" />
              {Array.from({ length: b.grad }, (_, k) => {
                const quer = (k - (b.grad - 1) / 2) * 17;
                return (
                  <g key={k} className="bd-pendel"
                    style={{ ["--weg" as string]: `${weg}px`, animationDelay: `${(i * 0.4 + k * 0.2).toFixed(2)}s` }}>
                    <Elektron x={mx} y={my + quer - 5.5} geteilt />
                    <Elektron x={mx} y={my + quer + 5.5} geteilt />
                  </g>
                );
              })}
            </g>
          );
        })}
        {v.atome.map((a, i) => (
          <Atom key={i} a={a} cx={orte[i].x} cy={orte[i].y} richtungen={richtungen[i]} />
        ))}
      </g>
    </svg>
  );
}
