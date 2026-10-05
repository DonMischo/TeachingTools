"use client";
/**
 * Station »Das Neuron« — Gewichte von Hand und Gewichte gelernt.
 *
 * Erst schiebt man die Linie selbst mit zwei Reglern, dann lässt man die
 * Maschine üben und sieht zu, wie sie mit genau derselben Regel dorthin
 * kommt: Fehler suchen, Gewichte nachstellen, wiederholen.
 *
 * Der dritte Datensatz geht nicht. Das ist keine Schikane, sondern der Grund,
 * warum es tiefe Netze gibt.
 */
import { useEffect, useRef, useState } from "react";
import {
  DATENSAETZE, START, antwort, fehlerhafte, treffer, lernschritt, linie,
  type Gewichte, type Punkt2,
} from "@/lib/ki/perzeptron";
import { rng } from "@/lib/ki/rng";
import { Netzbild } from "@/components/ki/Netzbild";
import { Wissen } from "@/components/ki/Wissen";
import { MitFachworten } from "@/components/ki/Fachwort";

const FELD = 260;

export function Neuron() {
  const [nr, setNr] = useState(0);
  const [g, setG] = useState<Gewichte>(START);
  const [laeuft, setLaeuft] = useState(false);
  const [schritte, setSchritte] = useState(0);
  const [zuletzt, setZuletzt] = useState<Punkt2 | null>(null);
  const wuerfel = useRef(rng(4711));

  const satz = DATENSAETZE[nr];
  const falsch = fehlerhafte(g, satz.punkte);
  const richtig = treffer(g, satz.punkte);
  const quote = Math.round((richtig / satz.punkte.length) * 100);
  const trennlinie = linie(g);

  function zuruecksetzen(neuerSatz = nr) {
    setNr(neuerSatz);
    setG(START);
    setSchritte(0);
    setZuletzt(null);
    setLaeuft(false);
    wuerfel.current = rng(4711);
  }

  function schritt() {
    const naechster = lernschritt(g, satz.punkte, wuerfel.current);
    if (!naechster) { setLaeuft(false); setZuletzt(null); return false; }
    setG(naechster.gewichte);
    setZuletzt(naechster.punkt);
    setSchritte(s => s + 1);
    return true;
  }

  // Automatisch üben — mit Deckel, sonst läuft der knifflige Satz ewig.
  useEffect(() => {
    if (!laeuft) return;
    if (schritte > 400) { setLaeuft(false); return; }
    const id = window.setTimeout(() => { if (!schritt()) setLaeuft(false); }, 90);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [laeuft, g, schritte]);

  const zuPixel = (p: { x: number; y: number }) => ({ cx: p.x * FELD, cy: (1 - p.y) * FELD });

  return (
    <div className="flex flex-col gap-4">
      <div className="p-4 rounded-2xl border border-(--border) bg-(--surface) flex flex-col gap-3">
        <h2 className="font-black">🧠 Ein Neuron lernt</h2>
        <p className="text-sm text-(--text-muted) leading-relaxed">
          Ein Neuron kann nur eines: eine Gerade ziehen und sagen »links davon das eine, rechts das
          andere«. Wo die Gerade liegt, entscheiden zwei Gewichte. Schiebe sie erst selbst — und
          lass dann die Maschine üben.
        </p>

        <div className="flex flex-wrap gap-2">
          {DATENSAETZE.map((d, i) => (
            <button
              key={d.slug}
              type="button"
              onClick={() => zuruecksetzen(i)}
              className={`px-3 py-1.5 rounded-xl border text-sm font-bold ${
                i === nr
                  ? "border-(--accent) bg-(--accent) text-(--accent-text)"
                  : "border-(--border) bg-(--surface) hover:bg-(--surface-hover)"
              }`}
            >
              {d.icon} {d.titel}
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-start">
          <svg
            width={FELD} height={FELD}
            viewBox={`0 0 ${FELD} ${FELD}`}
            className="rounded-xl border border-(--border) bg-(--bg) shrink-0"
            style={{ maxWidth: "100%" }}
            role="img"
            aria-label={`Streubild mit ${satz.punkte.length} Punkten, ${richtig} davon richtig zugeordnet`}
          >
            {/* Die beiden Halbebenen einfärben — so sieht man die Entscheidung. */}
            {trennlinie && (
              <>
                <defs>
                  <clipPath id="feld">
                    <rect x={0} y={0} width={FELD} height={FELD} />
                  </clipPath>
                </defs>
                <g clipPath="url(#feld)">
                  <polygon
                    points={[
                      `${zuPixel(trennlinie[0]).cx},${zuPixel(trennlinie[0]).cy}`,
                      `${zuPixel(trennlinie[1]).cx},${zuPixel(trennlinie[1]).cy}`,
                      antwort(g, { x: 1, y: 1 }) === 0 ? `${FELD},0` : `${FELD},${FELD}`,
                      antwort(g, { x: 1, y: 1 }) === 0 ? `${FELD},0` : `0,${FELD}`,
                    ].join(" ")}
                    fill="var(--accent)"
                    fillOpacity={0.07}
                  />
                  <line
                    x1={zuPixel(trennlinie[0]).cx} y1={zuPixel(trennlinie[0]).cy}
                    x2={zuPixel(trennlinie[1]).cx} y2={zuPixel(trennlinie[1]).cy}
                    stroke="var(--accent)" strokeWidth={3}
                  />
                </g>
              </>
            )}

            {satz.punkte.map((p, i) => {
              const { cx, cy } = zuPixel(p);
              const stimmt = antwort(g, p) === p.klasse;
              const gerade = zuletzt === p;
              return p.klasse === 0 ? (
                <circle
                  key={i} cx={cx} cy={cy} r={gerade ? 9 : 6}
                  fill={stimmt ? "var(--accent)" : "transparent"}
                  stroke={stimmt ? "var(--accent)" : "var(--red, #ef4444)"}
                  strokeWidth={2}
                />
              ) : (
                <rect
                  key={i} x={cx - (gerade ? 8 : 5.5)} y={cy - (gerade ? 8 : 5.5)}
                  width={gerade ? 16 : 11} height={gerade ? 16 : 11} rx={2}
                  fill={stimmt ? "var(--text-muted)" : "transparent"}
                  stroke={stimmt ? "var(--text-muted)" : "var(--red, #ef4444)"}
                  strokeWidth={2}
                />
              );
            })}
          </svg>

          <div className="flex-1 flex flex-col gap-3 w-full">
            <div className="text-sm">
              <b>{richtig} von {satz.punkte.length}</b> richtig ({quote} %)
              {schritte > 0 && <span className="text-(--text-muted)"> · {schritte} Lernschritte</span>}
            </div>

            <div className="flex gap-3 text-xs text-(--text-muted) flex-wrap">
              <span>⬤ {satz.klassen[0]}</span>
              <span>◼ {satz.klassen[1]}</span>
              <span>rot umrandet = falsch einsortiert</span>
            </div>

            {([["w1", satz.achsen[0]], ["w2", satz.achsen[1]], ["b", "Schwelle"]] as const).map(([k, label]) => (
              <label key={k} className="flex items-center gap-2 text-sm">
                <span className="font-bold w-24 shrink-0">{label}</span>
                <input
                  type="range" min={-2} max={2} step={0.05}
                  value={g[k]}
                  onChange={e => { setLaeuft(false); setG(alt => ({ ...alt, [k]: Number(e.target.value) })); }}
                  className="flex-1 accent-(--accent)"
                  aria-label={`Gewicht ${label}`}
                />
                <span className="w-12 text-right font-mono text-xs">{g[k].toFixed(2)}</span>
              </label>
            ))}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setLaeuft(l => !l)}
                disabled={!falsch.length}
                className="px-4 py-2 rounded-xl font-black bg-(--accent) text-(--accent-text) disabled:opacity-40"
              >
                {laeuft ? "⏸ Anhalten" : "🤖 Maschine übt"}
              </button>
              <button
                type="button"
                onClick={() => { setLaeuft(false); schritt(); }}
                disabled={!falsch.length}
                className="px-3 py-2 rounded-xl border border-(--border) bg-(--surface)
                  hover:bg-(--surface-hover) text-sm font-bold disabled:opacity-40"
              >
                ▶︎ Ein Schritt
              </button>
              <button
                type="button"
                onClick={() => zuruecksetzen()}
                className="px-3 py-2 rounded-xl border border-(--border) bg-(--surface)
                  hover:bg-(--surface-hover) text-sm font-bold"
              >
                ↺ Zurück
              </button>
            </div>

            <p className="text-xs text-(--text-muted) leading-relaxed">
              <MitFachworten text={!falsch.length
                ? "✓ Alles richtig einsortiert. Genau das heißt »trainiert«: Es gibt keine Gewichte mehr zu verschieben."
                : zuletzt
                  ? "Die Maschine hat sich gerade den großen Punkt vorgenommen, bei dem sie falsch lag, und die Gewichte ein Stück in seine Richtung geschoben. Mehr passiert bei keinem Lernschritt."
                  : satz.hinweis} />
            </p>

            {!satz.trennbar && schritte > 60 && (
              <p className="text-xs leading-relaxed p-3 rounded-xl border border-(--accent)">
                <MitFachworten text="⚡ Siehst du? Die Linie zappelt und findet nie Ruhe. Dieser Datensatz ist nicht linear separierbar — mit einem einzigen Neuron (einem Perzeptron) also nicht zu schaffen. Man braucht mehrere hintereinander; das ist das berühmte XOR-Problem, an dem die KI-Forschung fast zwanzig Jahre hängengeblieben ist." />
              </p>
            )}
          </div>
        </div>

        {/* Der Bauplan — hier vor allem, um zu zeigen, wie wenig dazwischen ist. */}
        <div className="pt-3 border-t border-(--border) flex flex-col md:flex-row gap-4 items-start">
          <div className="text-(--accent) w-full md:w-auto md:shrink-0">
            <Netzbild
              schichten={[
                { titel: "Eingang", knoten: [{ name: satz.achsen[0] }, { name: satz.achsen[1] }] },
                { titel: "Antwort", knoten: [{ name: `${satz.klassen[0]} / ${satz.klassen[1]}` }] },
              ]}
              kanten={[[[g.w1, g.w2]]]}
            />
          </div>
          <p className="flex-1 text-xs text-(--text-muted) leading-relaxed">
            <MitFachworten text="So ist dieses Neuron gebaut: zwei Eingänge, ein Neuron, Antwort — dazwischen liegt nichts. Man sagt: Es hat eine Schicht. Die Striche sind die beiden Gewichte; schiebe die Regler, und sie werden dicker oder dünner. Gestrichelt heißt negativ: Dieses Merkmal spricht dagegen. Mit einer einzigen Schicht bleibt die Grenze immer eine Gerade. Auf der nächsten Station kommt eine Spalte dazwischen — und genau das meint das Wort »tief«." />
          </p>
        </div>
      </div>

      <Wissen thema="neuron" />
    </div>
  );
}
