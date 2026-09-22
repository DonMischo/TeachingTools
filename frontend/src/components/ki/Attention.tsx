"use client";
/**
 * Station »Worauf schaut das Modell?« — Attention zum Mitmachen.
 *
 * Der Satz steht als Wortkette da, ein Wort darin fragt (»er«, »sie«). Wer
 * antippt, worauf es sich bezieht, zieht damit selbst einen Bogen — und sieht
 * danach, welche Bögen ein Sprachmodell ziehen würde.
 *
 * Angetippt statt gezogen: Auf dem Telefon ist Ziehen eine Zumutung, und der
 * Bogen wird ja doch gezeichnet.
 *
 * Die Aufgaben kommen paarweise. Sobald beide Sätze eines Paares gelöst sind,
 * stehen sie untereinander: ein Wort Unterschied, andere Antwort. Das ist der
 * Grund, warum es Attention gibt — und der Beweis, dass unser Wortnetz das
 * nicht können *kann*: Wenn »weil er zu« gefallen ist, weiß es nichts mehr von
 * Pokal oder Koffer.
 */
import { useMemo, useState } from "react";
import { ATTENTION_AUFGABEN, partner, type AttentionAufgabe } from "@/lib/ki/attention";
import { Wissen } from "@/components/ki/Wissen";

/** Wortkästchen mit ihren Mittelpunkten — daran hängen die Bögen. */
type Kasten = { index: number; x: number; y: number; breite: number; zeile: number };

const ZEILEN_HOEHE = 44;
const BOGEN_HOEHE = 26;

/** Grobe Textbreite: ohne Messung im DOM, dafür ohne Layout-Sprünge. */
function breiteVon(wort: string): number {
  return Math.max(28, wort.length * 9.5 + 14);
}

/** Wörter auf Zeilen umbrechen — die Bühne ist auf dem Telefon schmal. */
function lege(woerter: string[], maxBreite: number): Kasten[] {
  const out: Kasten[] = [];
  let x = 0;
  let zeile = 0;
  woerter.forEach((w, index) => {
    const breite = breiteVon(w);
    if (x + breite > maxBreite && x > 0) { x = 0; zeile++; }
    out.push({ index, x, y: zeile * ZEILEN_HOEHE + BOGEN_HOEHE, breite, zeile });
    x += breite + 6;
  });
  return out;
}

function bogen(von: Kasten, nach: Kasten): string {
  const x1 = von.x + von.breite / 2;
  const x2 = nach.x + nach.breite / 2;
  if (von.zeile === nach.zeile) {
    // Über die Wörter hinweg, nicht hindurch: ein Halbbogen nach oben.
    const y = von.y;
    const hoehe = Math.min(BOGEN_HOEHE + Math.abs(x2 - x1) / 8, BOGEN_HOEHE + 18);
    return `M ${x1} ${y} C ${x1} ${y - hoehe}, ${x2} ${y - hoehe}, ${x2} ${y}`;
  }
  // Über zwei Zeilen: vom oberen Rand des einen Kastens zum unteren des
  // anderen. Ein Halbbogen wie oben liefe quer durch die Zeile dazwischen.
  const obenIstZiel = nach.zeile < von.zeile;
  const start = obenIstZiel ? { x: x1, y: von.y } : { x: x1, y: von.y + 30 };
  const ende = obenIstZiel ? { x: x2, y: nach.y + 30 } : { x: x2, y: nach.y };
  const mitte = (start.y + ende.y) / 2;
  return `M ${start.x} ${start.y} C ${start.x} ${mitte}, ${ende.x} ${mitte}, ${ende.x} ${ende.y}`;
}

export function Attention() {
  const [nr, setNr] = useState(0);
  const [wahl, setWahl] = useState<number | null>(null);
  const [geloest, setGeloest] = useState<Record<string, boolean>>({});
  const [zeigeModell, setZeigeModell] = useState(false);
  const [breite, setBreite] = useState(560);

  const aufgabe: AttentionAufgabe = ATTENTION_AUFGABEN[nr];
  const kaesten = useMemo(() => lege(aufgabe.woerter, breite), [aufgabe, breite]);
  const zeilen = Math.max(...kaesten.map(k => k.zeile)) + 1;
  const hoehe = zeilen * ZEILEN_HOEHE + BOGEN_HOEHE + 8;

  const beantwortet = wahl !== null;
  const richtig = wahl === aufgabe.ziel;
  const gegenstueck = partner(aufgabe);
  const paarFertig = !!gegenstueck && geloest[aufgabe.id] && geloest[gegenstueck.id];

  function tippe(index: number) {
    if (beantwortet || !aufgabe.wahlbar.includes(index)) return;
    setWahl(index);
    setGeloest(g => ({ ...g, [aufgabe.id]: true }));
  }

  function weiter() {
    setWahl(null);
    setZeigeModell(false);
    setNr(n => (n + 1) % ATTENTION_AUFGABEN.length);
  }

  const treffer = Object.keys(geloest).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <h2 className="font-black">🔎 Worauf schaut das Modell?</h2>
          <span className="text-xs text-[var(--text-muted)]">
            Satz {nr + 1} von {ATTENTION_AUFGABEN.length} · {treffer} bearbeitet
          </span>
        </div>

        <p className="text-sm text-[var(--text-muted)] leading-relaxed">
          Das gelbe Wort schaut zurück. Tippe das Wort an, das damit gemeint ist.
        </p>

        <div
          className="overflow-x-auto"
          ref={el => { if (el && el.clientWidth > 120 && Math.abs(el.clientWidth - breite) > 24) setBreite(el.clientWidth - 8); }}
        >
          <svg
            width="100%"
            viewBox={`0 0 ${breite} ${hoehe}`}
            style={{ maxWidth: breite, height: hoehe }}
            role="group"
            aria-label={`Satz: ${aufgabe.woerter.join(" ")}`}
          >
            {/* Was das Modell ansehen würde — erst auf Knopfdruck. */}
            {zeigeModell && Object.entries(aufgabe.modell).map(([index, gewicht]) => {
              const ziel = kaesten[Number(index)];
              if (!ziel) return null;
              return (
                <path
                  key={`m${index}`}
                  d={bogen(kaesten[aufgabe.frage], ziel)}
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth={1 + gewicht * 7}
                  strokeOpacity={0.25 + gewicht * 0.5}
                  strokeLinecap="round"
                />
              );
            })}

            {/* Der eigene Bogen. */}
            {beantwortet && (
              <path
                d={bogen(kaesten[aufgabe.frage], kaesten[wahl])}
                fill="none"
                stroke={richtig ? "var(--green, #22c55e)" : "var(--red, #ef4444)"}
                strokeWidth={3}
                strokeLinecap="round"
              />
            )}
            {beantwortet && !richtig && (
              <path
                d={bogen(kaesten[aufgabe.frage], kaesten[aufgabe.ziel])}
                fill="none"
                stroke="var(--green, #22c55e)"
                strokeWidth={3}
                strokeDasharray="5 4"
                strokeLinecap="round"
              />
            )}

            {kaesten.map(k => {
              const istFrage = k.index === aufgabe.frage;
              const istZiel = beantwortet && k.index === aufgabe.ziel;
              const istWahl = k.index === wahl;
              const wahlbar = aufgabe.wahlbar.includes(k.index) && !beantwortet;
              const schluessel = beantwortet && k.index === aufgabe.schluesselwort;
              return (
                <g
                  key={k.index}
                  role={wahlbar ? "button" : undefined}
                  tabIndex={wahlbar ? 0 : undefined}
                  onClick={() => tippe(k.index)}
                  onKeyDown={e => { if (e.key === "Enter" || e.key === " ") tippe(k.index); }}
                  style={{ cursor: wahlbar ? "pointer" : "default" }}
                >
                  <rect
                    x={k.x} y={k.y} width={k.breite} height={30} rx={9}
                    fill={
                      istFrage ? "var(--accent)"
                        : istZiel ? "var(--green, #22c55e)"
                          : istWahl ? "var(--red, #ef4444)"
                            : schluessel ? "var(--surface-hover)"
                              : "var(--surface)"
                    }
                    fillOpacity={istFrage || istZiel || istWahl ? 0.9 : 1}
                    stroke={wahlbar || schluessel ? "var(--accent)" : "var(--border)"}
                    strokeWidth={wahlbar ? 2 : 1}
                    strokeDasharray={schluessel ? "4 3" : undefined}
                  />
                  <text
                    x={k.x + k.breite / 2} y={k.y + 20}
                    textAnchor="middle"
                    fontSize={14}
                    fontWeight={istFrage || istZiel || istWahl ? 800 : 500}
                    fill={istFrage || istZiel || istWahl ? "#fff" : "var(--text)"}
                  >
                    {aufgabe.woerter[k.index]}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {beantwortet && (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-bold">
              {richtig ? "✓ Genau." : "✗ Knapp daneben."}{" "}
              <span className="font-normal text-[var(--text-muted)]">{aufgabe.erklaerung}</span>
            </p>
            {aufgabe.schluesselwort !== undefined && (
              <p className="text-xs text-[var(--text-muted)]">
                Das entscheidende Wort ist gestrichelt umrandet — nimm es weg, und der Satz
                ist nicht mehr zu beantworten.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setZeigeModell(z => !z)}
                className="px-3 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)]
                  hover:bg-[var(--surface-hover)] text-sm font-bold"
              >
                {zeigeModell ? "Bögen verbergen" : "🧠 Was ein Modell ansieht"}
              </button>
              <button
                type="button"
                onClick={weiter}
                className="px-3 py-1.5 rounded-xl font-black bg-[var(--accent)] text-[var(--accent-text)] text-sm"
              >
                Nächster Satz →
              </button>
            </div>
          </div>
        )}

        {zeigeModell && (
          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
            So sieht Attention aus: Das fragende Wort verteilt seine Aufmerksamkeit auf alle
            früheren Wörter — dicker Bogen, mehr Gewicht. Ein echtes Modell hat davon Dutzende
            solcher Bogenbilder nebeneinander (»Köpfe«), und jedes achtet auf etwas anderes.
          </p>
        )}
      </div>

      {paarFertig && gegenstueck && (
        <div className="p-4 rounded-2xl border border-[var(--accent)] bg-[var(--surface)] flex flex-col gap-2">
          <h3 className="font-black text-sm">Ein Wort — andere Antwort</h3>
          {[aufgabe, gegenstueck].map(a => (
            <p key={a.id} className="text-sm">
              {a.woerter.map((w, i) => (
                <span
                  key={i}
                  className={
                    i === a.schluesselwort ? "font-black text-[var(--accent)]"
                      : i === a.ziel ? "underline decoration-2" : undefined
                  }
                >
                  {w}{" "}
                </span>
              ))}
            </p>
          ))}
          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
            Beide Sätze sind bis auf ein Wort gleich, und trotzdem ist etwas anderes gemeint.
            Ein Netz, das nur zählt, welches Wort auf welches folgt, müsste hier zweimal
            dasselbe antworten — es hat den Anfang des Satzes längst vergessen.
          </p>
        </div>
      )}

      <Wissen thema="attention" />
    </div>
  );
}
