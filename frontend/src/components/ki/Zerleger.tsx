"use client";
/**
 * Station 2: »Zerlegen« — das Minispiel zum Tokenizer.
 *
 * Erst schneidet die Klasse selbst (antippen zwischen den Buchstaben), dann
 * deckt die Maschine ihre eigenen Schnitte auf. Der Aha-Moment liegt im
 * Vergleich: häufige Wörter bleiben ganz, seltene zerfallen, und Leerzeichen
 * und Satzzeichen hängen am Wort *davor*. Danach steht da nur noch eine Reihe
 * von Zahlen — mehr bekommt das Modell nie zu sehen.
 */
import { useMemo, useState } from "react";
import { zerlege, schnitte, bewerte, zeichen } from "@/lib/ki/tokenizer";

/** Farben der Stücke — Tokens abwechselnd einfärben, damit die Grenzen springen. */
const FARBEN = ["#38bdf8", "#f472b6", "#a3e635", "#fbbf24", "#c084fc", "#2dd4bf"];

function Balken({ zustand, onClick }: {
  zustand: "leer" | "gesetzt" | "treffer" | "verpasst" | "daneben";
  onClick?: () => void;
}) {
  const farbe = zustand === "treffer" ? "var(--green)"
    : zustand === "verpasst" ? "var(--text-muted)"
    : zustand === "daneben" ? "var(--red)"
    : zustand === "gesetzt" ? "var(--accent)"
    : "transparent";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      aria-label="Schnittstelle"
      className="relative h-8 w-3 shrink-0 rounded-sm disabled:cursor-default"
      style={{ background: "transparent" }}
    >
      {/* Der Balken ist im Ruhezustand nur ein kurzer, blasser Strich in der
          Mitte: eine volle Linie zwischen jedem Buchstabenpaar sähe aus, als
          wäre schon überall geschnitten. */}
      <span
        className="absolute left-1/2 -translate-x-1/2 rounded-sm"
        style={{
          width: zustand === "leer" ? 2 : 3,
          top: zustand === "leer" ? "38%" : 0,
          bottom: zustand === "leer" ? "38%" : 0,
          background: zustand === "leer" ? "var(--text-muted)" : farbe,
          opacity: zustand === "leer" ? 0.3 : 1,
        }}
      />
    </button>
  );
}

export function Zerleger({ text, onWeiter }: { text: string; onWeiter: (quote: number) => void }) {
  const tokens = useMemo(() => zerlege(text), [text]);
  const echte = useMemo(() => new Set(schnitte(tokens)), [tokens]);
  const [eigene, setEigene] = useState<Set<number>>(new Set());
  const [geprueft, setGeprueft] = useState(false);

  const wertung = useMemo(() => bewerte(eigene, echte), [eigene, echte]);

  function umschalten(i: number) {
    if (geprueft) return;
    setEigene(alt => {
      const neu = new Set(alt);
      if (neu.has(i)) neu.delete(i); else neu.add(i);
      return neu;
    });
  }

  function zustand(i: number) {
    if (!geprueft) return eigene.has(i) ? "gesetzt" as const : "leer" as const;
    if (echte.has(i)) return eigene.has(i) ? "treffer" as const : "verpasst" as const;
    return eigene.has(i) ? "daneben" as const : "leer" as const;
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-black">✂️ Wo schneidet die Maschine?</h2>
        <p className="text-sm text-muted mt-1 leading-relaxed">
          Ein Sprachmodell liest keine Buchstaben, sondern <b>Stücke</b> aus einer festen Liste —
          jedes mit einer Nummer. Tippe zwischen die Buchstaben, wo du einen Schnitt vermutest.
        </p>
      </div>

      {/* Der Satz mit Lücken zum Antippen. Leerzeichen werden sichtbar gemacht,
          sonst sieht man nicht, zu welchem Stück sie gehören. */}
      <div className="card p-4 overflow-x-auto">
        {/* Umbrechen statt schieben: auf dem Telefon passt der Satz sonst nicht
            in eine Zeile, und wer scrollen muss, verliert die Übersicht. */}
        <div className="flex flex-wrap items-center font-mono text-lg leading-none">
          {zeichen(text).map(({ text: c, start: i }) => (
            <span key={i} className="flex items-center">
              {i > 0 && <Balken zustand={zustand(i)} onClick={geprueft ? undefined : () => umschalten(i)} />}
              <span className={c === " " ? "text-muted" : ""}>
                {c === " " ? "␣" : c}
              </span>
            </span>
          ))}
        </div>
      </div>

      {!geprueft ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setGeprueft(true)}
            className="btn-primary px-4 py-2"
          >
            Prüfen
          </button>
          <button
            type="button"
            onClick={() => setEigene(new Set())}
            className="px-3 py-2 rounded-xl border border-line bg-surface text-sm font-bold"
          >
            ↺ Zurücksetzen
          </button>
          <span className="text-sm text-muted">
            {eigene.size} {eigene.size === 1 ? "Schnitt" : "Schnitte"} gesetzt
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="btn-primary px-3 py-1">
              {wertung.quote} %
            </span>
            <span><b className="text-ok">{wertung.treffer.length}</b> getroffen</span>
            <span><b>{wertung.verpasst.length}</b> übersehen</span>
            <span><b className="text-bad">{wertung.daneben.length}</b> zu viel</span>
          </div>

          {/* Die Stücke der Maschine, jedes mit seiner Nummer. */}
          <div className="flex flex-wrap gap-2">
            {tokens.map((t, i) => (
              <span key={i} className="flex flex-col items-center gap-1">
                <span
                  className="px-2 py-1 rounded-lg font-mono text-sm font-bold"
                  style={{
                    background: `${FARBEN[i % FARBEN.length]}22`,
                    border: `1px solid ${FARBEN[i % FARBEN.length]}`,
                  }}
                >
                  {t.text.replace(/ /g, "␣")}
                </span>
                <span className="text-[10px] text-muted font-mono">{t.id}</span>
              </span>
            ))}
          </div>

          <p className="text-xs text-muted leading-relaxed">
            🔢 Ab hier zählt nur noch die untere Zeile: <b>{tokens.length} Zahlen</b>. Buchstaben,
            Wörter und Sinn sind weg — das Modell rechnet nur mit Nummern.
            Häufige Wörter (»Text␣«) sind ein einziges Stück, seltenere zerfallen in Stamm und
            Endung (»kurz« + »en␣«), und Leerzeichen und Satzzeichen hängen am Wort davor (»Katze.«).
            Echte Zerleger haben 50 000 bis 200 000 solcher Stücke und haben sie sich aus riesigen
            Textmengen selbst zusammengesucht; unsere Liste ist von Hand geschrieben und hat gut hundert.
          </p>

          <div>
            <button
              type="button"
              onClick={() => onWeiter(wertung.quote)}
              className="btn-primary px-4 py-2"
            >
              Weiter zum Netz →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
