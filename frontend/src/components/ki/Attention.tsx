"use client";
/**
 * Station »Worauf schaut das Modell?« — Attention zum Mitmachen.
 *
 * Ein Wort im Satz fragt, und wer antippt, worauf es sich bezieht, zieht damit
 * selbst einen Bogen. Danach sieht man, welche Bögen ein Sprachmodell zöge.
 *
 * Angetippt statt gezogen: Auf dem Telefon ist Ziehen eine Zumutung, und der
 * Bogen wird ja doch gezeichnet.
 *
 * Gefragt wird nicht nur nach Pronomen. Vier Sorten, alle mit derselben
 * Mechanik — weil es für ein Modell auch dieselbe Rechnung ist:
 *
 *   pronomen     Wer ist mit »er«, »sie« gemeint?
 *   bedeutung    Welches Wort legt fest, was »Bank«, »Maus«, »Ball« heißt?
 *   verbklammer  Wohin gehört das »auf« am Satzende? (deutsche Besonderheit)
 *   satzbau      Bezüge über Satzteile und Satzgrenzen hinweg.
 *
 * Viele Aufgaben kommen paarweise: zwei Sätze, ein Wort Unterschied, andere
 * Antwort. Das ist der Beweis, dass unser Wortnetz das nicht können *kann* —
 * wenn das fragende Wort dran ist, hat es den Satzanfang längst vergessen.
 */
import { useMemo, useState } from "react";
import {
  ATTENTION_AUFGABEN, ART_TITEL, partner,
  type AttentionArt, type AttentionAufgabe,
} from "@/lib/ki/attention";
import { Wissen } from "@/components/ki/Wissen";

/** Wortkästchen mit ihren Mittelpunkten — daran hängen die Bögen. */
type Kasten = { index: number; x: number; y: number; breite: number; zeile: number };

const ZEILEN_HOEHE = 44;
const KASTEN_HOEHE = 30;
/** Luft über der ersten Zeile. Muss größer sein als der höchste Bogen. */
const OBEN = 58;
const BOGEN_MAX = OBEN - 12;

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
    out.push({ index, x, y: zeile * ZEILEN_HOEHE + OBEN, breite, zeile });
    x += breite + 6;
  });
  return out;
}

function bogen(von: Kasten, nach: Kasten): string {
  const x1 = von.x + von.breite / 2;
  const x2 = nach.x + nach.breite / 2;
  if (von.zeile === nach.zeile) {
    // Über die Wörter hinweg, nicht hindurch: ein Halbbogen nach oben. Die
    // Höhe wächst mit dem Abstand, bleibt aber im Bild (siehe BOGEN_MAX).
    const y = von.y;
    const hoehe = Math.min(22 + Math.abs(x2 - x1) / 9, BOGEN_MAX);
    return `M ${x1} ${y} C ${x1} ${y - hoehe}, ${x2} ${y - hoehe}, ${x2} ${y}`;
  }
  // Über zwei Zeilen: vom oberen Rand des einen Kastens zum unteren des
  // anderen. Ein Halbbogen wie oben liefe quer durch die Zeile dazwischen.
  const obenIstZiel = nach.zeile < von.zeile;
  const start = obenIstZiel ? { x: x1, y: von.y } : { x: x1, y: von.y + KASTEN_HOEHE };
  const ende = obenIstZiel ? { x: x2, y: nach.y + KASTEN_HOEHE } : { x: x2, y: nach.y };
  const mitte = (start.y + ende.y) / 2;
  return `M ${start.x} ${start.y} C ${start.x} ${mitte}, ${ende.x} ${mitte}, ${ende.x} ${ende.y}`;
}

function frageZu(a: AttentionAufgabe): string {
  return a.frageText ?? `Worauf bezieht sich »${a.woerter[a.frage].replace(/[.,]$/, "")}«?`;
}

type Ergebnis = { id: string; art: AttentionArt; richtig: boolean };

export function Attention() {
  const [nr, setNr] = useState(0);
  const [wahl, setWahl] = useState<number | null>(null);
  const [ergebnisse, setErgebnisse] = useState<Ergebnis[]>([]);
  const [zeigeModell, setZeigeModell] = useState(false);
  const [breite, setBreite] = useState(560);

  const durch = nr >= ATTENTION_AUFGABEN.length;
  const aufgabe: AttentionAufgabe = ATTENTION_AUFGABEN[Math.min(nr, ATTENTION_AUFGABEN.length - 1)];
  const kaesten = useMemo(() => lege(aufgabe.woerter, breite), [aufgabe, breite]);
  const zeilen = Math.max(...kaesten.map(k => k.zeile)) + 1;
  const hoehe = zeilen * ZEILEN_HOEHE + OBEN;

  const beantwortet = wahl !== null;
  const richtig = wahl === aufgabe.ziel;
  const gegenstueck = partner(aufgabe);
  const erledigt = new Set(ergebnisse.map(e => e.id));
  const paarFertig = !!gegenstueck && erledigt.has(aufgabe.id) && erledigt.has(gegenstueck.id);

  function tippe(index: number) {
    if (beantwortet || !aufgabe.wahlbar.includes(index)) return;
    setWahl(index);
    setErgebnisse(alt => [
      ...alt.filter(e => e.id !== aufgabe.id),
      { id: aufgabe.id, art: aufgabe.art, richtig: index === aufgabe.ziel },
    ]);
  }

  function weiter() {
    setWahl(null);
    setZeigeModell(false);
    setNr(n => n + 1);
  }

  function nochmal() {
    setWahl(null);
    setZeigeModell(false);
    setErgebnisse([]);
    setNr(0);
  }

  // ─────────────────────────────────────────────── Auswertung am Ende ──
  if (durch) {
    const treffer = ergebnisse.filter(e => e.richtig).length;
    const arten = (Object.keys(ART_TITEL) as AttentionArt[])
      .map(art => {
        const eigene = ergebnisse.filter(e => e.art === art);
        return { art, richtig: eigene.filter(e => e.richtig).length, gesamt: eigene.length };
      })
      .filter(z => z.gesamt > 0);
    const daneben = ergebnisse.filter(e => !e.richtig)
      .map(e => ATTENTION_AUFGABEN.find(a => a.id === e.id)!)
      .filter(Boolean);

    return (
      <div className="flex flex-col gap-4">
        <div className="p-4 rounded-2xl border border-(--accent) bg-(--surface) flex flex-col gap-3">
          <h2 className="font-black">🔎 Auswertung</h2>
          <p className="text-lg font-black">
            {treffer} von {ergebnisse.length} Bögen richtig gezogen.
          </p>

          <ul className="flex flex-col gap-1.5">
            {arten.map(z => (
              <li key={z.art} className="flex items-center gap-2 text-sm">
                <span className="w-44 shrink-0">{ART_TITEL[z.art]}</span>
                <span className="flex-1 h-2 rounded-full bg-(--surface-hover) overflow-hidden">
                  <span
                    className="block h-full bg-(--accent)"
                    style={{ width: `${(z.richtig / z.gesamt) * 100}%` }}
                  />
                </span>
                <span className="w-12 text-right font-bold">{z.richtig}/{z.gesamt}</span>
              </li>
            ))}
          </ul>

          {daneben.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-(--text-muted)">
                Die hier waren knifflig
              </span>
              <ul className="flex flex-col gap-1 text-sm">
                {daneben.map(a => (
                  <li key={a.id} className="text-(--text-muted)">
                    »{a.woerter.join(" ")}« —{" "}
                    <b className="text-(--text)">{a.woerter[a.ziel].replace(/[.,]$/, "")}</b>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-sm leading-relaxed">
            Du hast gerade von Hand gemacht, was in einem Sprachmodell bei <b>jedem einzelnen
            Wort</b> passiert — und zwar gleichzeitig für alle Wörter des Textes, in Dutzenden
            solcher Bogenbilder nebeneinander. Was dich Nachdenken gekostet hat, ist dort eine
            Multiplikation von Zahlen.
          </p>

          <button
            type="button"
            onClick={nochmal}
            className="self-start px-4 py-2 rounded-xl font-black bg-(--accent) text-(--accent-text)"
          >
            ↺ Noch einmal
          </button>
        </div>

        <Wissen thema="attention" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="p-4 rounded-2xl border border-(--border) bg-(--surface) flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <h2 className="font-black">🔎 Worauf schaut das Modell?</h2>
          <span className="text-xs text-(--text-muted)">
            Satz {nr + 1} von {ATTENTION_AUFGABEN.length} ·{" "}
            {ergebnisse.filter(e => e.richtig).length} richtig
          </span>
        </div>

        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="px-2 py-0.5 rounded-lg border border-(--border) text-[10px]
            uppercase tracking-wide text-(--text-muted)">
            {ART_TITEL[aufgabe.art]}
          </span>
          <p className="text-sm font-bold">{frageZu(aufgabe)}</p>
        </div>

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
              const schluessel = beantwortet && k.index === aufgabe.schluesselwort && !istZiel;
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
                    x={k.x} y={k.y} width={k.breite} height={KASTEN_HOEHE} rx={9}
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
              <span className="font-normal text-(--text-muted)">{aufgabe.erklaerung}</span>
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setZeigeModell(z => !z)}
                className="px-3 py-1.5 rounded-xl border border-(--border) bg-(--surface)
                  hover:bg-(--surface-hover) text-sm font-bold"
              >
                {zeigeModell ? "Bögen verbergen" : "🧠 Was ein Modell ansieht"}
              </button>
              <button
                type="button"
                onClick={weiter}
                className="px-3 py-1.5 rounded-xl font-black bg-(--accent) text-(--accent-text) text-sm"
              >
                {nr + 1 >= ATTENTION_AUFGABEN.length ? "Zur Auswertung →" : "Nächster Satz →"}
              </button>
            </div>
          </div>
        )}

        {zeigeModell && (
          <p className="text-xs text-(--text-muted) leading-relaxed">
            So sieht Attention aus: Das fragende Wort verteilt seine Aufmerksamkeit auf alle
            übrigen Wörter — dicker Bogen, mehr Gewicht. Ein echtes Modell hat davon Dutzende
            solcher Bogenbilder nebeneinander (»Köpfe«), und jedes achtet auf etwas anderes.
          </p>
        )}
      </div>

      {paarFertig && gegenstueck && (
        <div className="p-4 rounded-2xl border border-(--accent) bg-(--surface) flex flex-col gap-2">
          <h3 className="font-black text-sm">Ein Wort — andere Antwort</h3>
          {[aufgabe, gegenstueck].map(a => (
            <p key={a.id} className="text-sm">
              {a.woerter.map((w, i) => (
                <span
                  key={i}
                  className={
                    i === a.schluesselwort ? "font-black text-(--accent)"
                      : i === a.ziel ? "underline decoration-2" : undefined
                  }
                >
                  {w}{" "}
                </span>
              ))}
            </p>
          ))}
          <p className="text-xs text-(--text-muted) leading-relaxed">
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
