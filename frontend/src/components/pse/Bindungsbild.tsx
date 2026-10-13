"use client";
/**
 * Die Verbindung im Schalenbild: die Atome rücken so zusammen, dass sich ihre
 * Außenschalen überlappen — und die bindenden Elektronen laufen um beide Kerne.
 *
 * Das ist der Kern der Sache. Jedes Atom hat seine Farbe, und jedes seiner
 * Elektronen trägt sie. Ein bindendes Paar besteht aus je einem Elektron der
 * beiden Partner; beide ziehen auf einer Acht um das eine und um das andere
 * Atom. Man sieht also, dass dasselbe Elektron zu beiden Schalen gehört —
 * darum zählt es bei beiden mit, und darum hat Sauerstoff im Wasser acht
 * Elektronen und jedes Wasserstoffatom zwei, obwohl zusammen nur acht da sind.
 *
 * Die freien Elektronenpaare kreisen auf ihrer eigenen Schale weiter.
 *
 * Bewegt wird mit CSS: die freien Paare drehen sich als Gruppe um ihren Kern,
 * die bindenden laufen per `offset-path` den Weg um beide Atome ab.
 */
import { freiePlaetze, type BindungsAtom, type Verbindung } from "@/lib/pse/bindung";

/** Radius der Außenschale. Der Kernabstand liegt darunter, damit sich die Schalen überlappen. */
const R = 48;
/** Abstand zweier gebundener Kerne. Kleiner als 2·R — sonst überlappen sich die Schalen nicht. */
const L = 88;

/**
 * Jedes Atom bekommt eine Farbe, damit man seine Elektronen wiedererkennt,
 * wenn sie beim Nachbarn vorbeikommen. Die Kategorienfarben taugen dafür
 * nicht: Kohlenstoff, Stickstoff und Sauerstoff wären alle gleich grün.
 */
const FARBE = ["#fbbf24", "#60a5fa", "#4ade80", "#f472b6", "#a78bfa", "#fb923c", "#22d3ee", "#e879f9"];

const BEWEGUNG = `
@keyframes bd-kreisen { from { offset-distance: 0%; } to { offset-distance: 100%; } }
@keyframes bd-dreh { to { transform: rotate(360deg); } }
@keyframes bd-glimmen { 0%, 100% { opacity: 0.10; } 50% { opacity: 0.22; } }
.bd-bindend { animation: bd-kreisen 7s linear infinite; offset-rotate: 0deg; }
.bd-schale { animation: bd-dreh 16s linear infinite; }
.bd-ueberlapp { animation: bd-glimmen 2.6s ease-in-out infinite; }
.bd-still * { animation-play-state: paused !important; }
@media (prefers-reduced-motion: reduce) {
  .bd-bindend, .bd-schale, .bd-ueberlapp { animation: none; }
}
`;

/**
 * Eine Zahl zwischen 0 und 1, die für dieselben beiden Nummern immer gleich
 * ausfällt. Damit bekommt jedes Elektronenpaar sein eigenes Tempo, ohne dass
 * sich die Bewegung bei jedem Neuzeichnen ändert — `Math.random` würde die
 * Paare bei jedem Klick neu losschicken.
 */
const streu = (a: number, b: number): number => {
  const x = Math.sin((a + 1) * 12.9898 + (b + 1) * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

/** Ein Elektron in der Farbe des Atoms, von dem es kommt. */
const Elektron = ({ x, y, farbe }: { x: number; y: number; farbe: string }) => (
  <circle cx={x} cy={y} r={5} fill={farbe} stroke="var(--surface)" strokeWidth={1.4} />
);

/**
 * Der Weg eines bindenden Elektrons: der Umriss beider Schalen zusammen —
 * einmal außen um das eine Atom herum, dann außen um das andere.
 *
 * Weil beide Schalen gleich groß sind und sich überschneiden, treffen sie
 * sich in zwei Punkten. Von dort geht es jeweils auf dem großen Bogen
 * (large-arc) entgegen dem Uhrzeigersinn (sweep 0) um das eine und um das
 * andere Atom.
 */
export function wegUmBeide(ax: number, ay: number, bx: number, by: number): string {
  const dx = bx - ax, dy = by - ay;
  const abstand = Math.hypot(dx, dy) || 1;
  // Senkrechte zur Verbindungslinie; darauf liegen die beiden Schnittpunkte.
  const nx = -dy / abstand, ny = dx / abstand;
  const hoch = Math.sqrt(Math.max(1, R * R - (abstand / 2) * (abstand / 2)));
  const mx = (ax + bx) / 2, my = (ay + by) / 2;
  const p1 = [mx - nx * hoch, my - ny * hoch];
  const p2 = [mx + nx * hoch, my + ny * hoch];
  const rund = (n: number) => Math.round(n * 10) / 10;
  return `M ${rund(p1[0])} ${rund(p1[1])}`
    + ` A ${R} ${R} 0 1 0 ${rund(p2[0])} ${rund(p2[1])}`
    + ` A ${R} ${R} 0 1 0 ${rund(p1[0])} ${rund(p1[1])} Z`;
}

/** Ein Atom mit Kern, Schalen und seinen freien Elektronenpaaren. */
function Atom({ a, cx, cy, farbe, richtungen, nummer, statisch }: {
  a: BindungsAtom; cx: number; cy: number; farbe: string; richtungen: number[];
  nummer: number; statisch: boolean;
}) {
  const n = a.schalen.length;
  const plaetze = freiePlaetze(richtungen, a.einsam);
  return (
    <g>
      {a.schalen.map((_, i) => (
        <circle key={i} cx={cx} cy={cy} r={(R * (i + 1)) / n} fill="none"
          stroke={i === n - 1 ? farbe : "var(--border)"}
          strokeWidth={i === n - 1 ? 1.4 : 0.8} opacity={i === n - 1 ? 0.5 : 0.4} />
      ))}
      {/* Der Kern bleibt klein und gleich groß — hier zählt die Hülle. */}
      <circle cx={cx} cy={cy} r={15} fill="var(--surface)" stroke="#f87171" strokeWidth={1.2} />
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central"
        className="font-black" fontSize={16} fill="var(--text)">{a.e.symbol}</text>
      {/* Die freien Paare kreisen auf der Außenschale weiter — jedes in
          seinem eigenen Tempo und seiner eigenen Richtung, aber immer als
          Paar: die zwei Elektronen eines Paares sitzen in derselben Gruppe
          und bleiben darum beieinander. Im ruhenden Bild stehen sie still. */}
      {plaetze.map((w, i) => (
        <g key={i} className={statisch ? undefined : "bd-schale"}
          style={statisch ? undefined : { transformOrigin: `${cx}px ${cy}px`,
            animationDuration: `${(11 + streu(nummer, i) * 13).toFixed(1)}s`,
            animationDirection: streu(nummer, i + 40) > 0.5 ? "reverse" : "normal" }}>
          {[-1, 1].map(seite => (
            <Elektron key={seite} farbe={farbe}
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

export default function Bindungsbild({ v, laufen = true, statisch = false }: {
  v: Verbindung; laufen?: boolean;
  /**
   * Das ruhende Bild: die gemeinsamen Elektronenpaare liegen zwischen den
   * beiden Atomen, so wie sie im Heft gezeichnet werden. Zum Abzeichnen und
   * zum Zeigen an der Tafel ist das oft das brauchbarere.
   */
  statisch?: boolean;
}) {
  if (v.atome.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-sm text-muted">
        Noch kein Atom gewählt — nimm unten eines dazu.
      </div>
    );
  }
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
          const weg = wegUmBeide(p.x, p.y, q.x, q.y);
          const dauer = 7 + i * 0.6;
          // Mitte der Bindung, Richtung und Querrichtung — für das ruhende Bild.
          const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2;
          const laenge = Math.hypot(q.x - p.x, q.y - p.y) || 1;
          const ux = (q.x - p.x) / laenge, uy = (q.y - p.y) / laenge;
          const nx = -uy, ny = ux;
          return (
            <g key={i}>
              {/* Der Bereich, in dem sich die Schalen überlappen */}
              <ellipse className={statisch ? undefined : "bd-ueberlapp"}
                opacity={statisch ? 0.16 : undefined}
                cx={mx} cy={my} rx={laenge / 2 + 6} ry={26} fill="var(--accent)"
                transform={`rotate(${(Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI} ${mx} ${my})`} />
              {/* Je geteiltem Paar ein Elektron von jedem Partner. Im laufenden
                  Bild auf demselben Weg, aber eine halbe Runde auseinander:
                  ist das eine hier, ist das andere drüben. Im ruhenden Bild
                  liegt das Paar zwischen den Kernen — jedes Elektron auf der
                  Seite des Atoms, von dem es kommt. */}
              {Array.from({ length: b.grad }, (_, k) => {
                const quer = (k - (b.grad - 1) / 2) * 16;
                return (
                  <g key={k}>
                    {[b.a, b.b].map((wer, seite) => statisch ? (
                      <Elektron key={wer} farbe={FARBE[wer % FARBE.length]}
                        x={mx + nx * quer + ux * (seite ? 6 : -6)}
                        y={my + ny * quer + uy * (seite ? 6 : -6)} />
                    ) : (
                      <g key={wer} className="bd-bindend"
                        style={{ offsetPath: `path("${weg}")`, animationDuration: `${dauer}s`,
                          animationDelay: `${-(seite * dauer / 2 + k * dauer * 0.08).toFixed(2)}s` }}>
                        <Elektron x={0} y={0} farbe={FARBE[wer % FARBE.length]} />
                      </g>
                    ))}
                  </g>
                );
              })}
            </g>
          );
        })}
        {v.atome.map((a, i) => (
          <Atom key={i} a={a} cx={orte[i].x} cy={orte[i].y} nummer={i} statisch={statisch}
            farbe={FARBE[i % FARBE.length]} richtungen={richtungen[i]} />
        ))}
      </g>
    </svg>
  );
}
