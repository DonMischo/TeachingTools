"use client";
/**
 * »Mensch gegen Maschine« — das Ratespiel nach Claude Shannon.
 *
 * Ein echter Text wird Wort für Wort aufgedeckt, und *du* sagst voraus, was als
 * Nächstes kommt. Daneben rät das Netz dasselbe. Am Ende stehen zwei Quoten
 * nebeneinander.
 *
 * Das ist keine Spielerei, sondern das Experiment, mit dem Shannon 1951
 * gemessen hat, wie viel Information in Sprache steckt — und es ist genau die
 * Aufgabe, auf die jedes Sprachmodell trainiert wird. Wer das eine Runde lang
 * gespielt hat, weiß, was ein Sprachmodell den ganzen Tag tut: das nächste Wort
 * raten, sonst nichts.
 *
 * Nebenbei fällt der Groschen, warum Menschen (noch) gut abschneiden: Wir
 * wissen, worum es geht. Das Netz kennt nur Häufigkeiten.
 */
import { useMemo, useState } from "react";
import { trainiere, woerterAus } from "@/lib/ki/trainieren";
import { KORPORA } from "@/lib/ki/korpora";
import { fortsetzungen, type Wort } from "@/lib/ki/wortnetz";
import { rng } from "@/lib/ki/rng";
import { Wissen } from "@/components/ki/Wissen";

/** Wie viele Vorschläge zur Auswahl stehen — mehr wäre auf dem Telefon zu viel. */
const AUSWAHL = 6;
const RUNDEN = 12;

type Stand = { ich: number; maschine: number; runde: number };

/**
 * Wo die Runde anfängt — ausgewürfelt, aber wiederholbar.
 *
 * Angefangen wird immer an einem Satzanfang: mitten in einen Satz zu
 * springen, macht das Raten unfair. Derselbe Seed ergibt dieselbe Runde,
 * damit eine Klasse sich vergleichen kann (»alle auf Seed 42«).
 */
function startPosition(woerter: readonly string[], seed: number, runden: number): number {
  const anfaenge: number[] = [];
  for (let i = 1; i < woerter.length - runden - 1; i++) {
    if (woerter[i - 1] === ".") anfaenge.push(i);
  }
  if (!anfaenge.length) return Math.min(4, Math.max(0, woerter.length - runden - 1));
  return anfaenge[Math.floor(rng(seed)() * anfaenge.length) % anfaenge.length];
}

export function Raten() {
  const [korpusNr, setKorpusNr] = useState(0);
  const [seed, setSeed] = useState(42);
  const [stand, setStand] = useState<Stand>({ ich: 0, maschine: 0, runde: 0 });
  const [wahl, setWahl] = useState<string | null>(null);

  const korpus = KORPORA[korpusNr];
  const woerter = useMemo(() => woerterAus(korpus.text), [korpus]);
  const netz = useMemo(() => trainiere(korpus.text, 2, korpus.titel), [korpus]);
  const start = useMemo(() => startPosition(woerter, seed, RUNDEN), [woerter, seed]);
  const [versatz, setVersatz] = useState(0);
  const pos = start + versatz;

  const richtig = woerter[pos];
  const fertig = stand.runde >= RUNDEN || pos >= woerter.length - 1;

  /** Das Netz sagt voraus — und liefert gleich die Auswahl für den Menschen. */
  const vorschlag = useMemo(() => {
    const verlauf: Wort[] = [];
    for (let i = Math.max(0, pos - 2); i < pos; i++) {
      const w = netz.woerter.find(x => x.text === woerter[i]);
      if (w) verlauf.push(w);
    }
    const alle = fortsetzungen(netz, verlauf).kandidaten;
    const liste = alle.slice(0, AUSWAHL).map(k => k.wort.text);
    // Das richtige Wort muss dabei sein, sonst ist das Spiel nicht zu gewinnen.
    if (!liste.includes(richtig)) {
      liste[liste.length - 1] = richtig;
      // Durchmischen, damit die Antwort nicht immer hinten steht.
      liste.sort((a, b) => (a + pos).localeCompare(b + pos, "de"));
    }
    return { tipp: alle[0]?.wort.text ?? "", liste };
  }, [netz, woerter, pos, richtig]);

  function tippe(wort: string) {
    if (wahl !== null) return;
    setWahl(wort);
    setStand(s => ({
      ich: s.ich + (wort === richtig ? 1 : 0),
      maschine: s.maschine + (vorschlag.tipp === richtig ? 1 : 0),
      runde: s.runde + 1,
    }));
  }

  function weiter() {
    setWahl(null);
    setVersatz(v => v + 1);
  }

  function neu(nr = korpusNr, neuerSeed = seed) {
    setKorpusNr(nr);
    setSeed(neuerSeed);
    setVersatz(0);
    setStand({ ich: 0, maschine: 0, runde: 0 });
    setWahl(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="p-4 rounded-2xl border border-(--border) bg-(--surface) flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <h2 className="font-black">🎯 Mensch gegen Maschine</h2>
          <span className="text-xs text-(--text-muted)">
            Runde {Math.min(stand.runde + (fertig ? 0 : 1), RUNDEN)} von {RUNDEN}
          </span>
        </div>

        <p className="text-sm text-(--text-muted) leading-relaxed">
          Welches Wort kommt als Nächstes? Du tippst, das Netz tippt — und am Ende zählen wir ab.
          Genau diese Aufgabe löst ein Sprachmodell Milliarden Mal beim Training.
        </p>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <span>
            <span aria-hidden>{korpus.icon}</span> <b>{korpus.titel}</b>
            <span className="text-(--text-muted)"> — {korpus.beschreibung}</span>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-(--text-muted)">
          <span>🎲 Seed <b className="font-mono text-(--text)">{seed}</b></span>
          <button
            type="button"
            onClick={() => neu(korpusNr, Math.floor(Math.random() * 1000))}
            className="px-2 py-0.5 rounded-lg border border-(--border) bg-(--surface)
              hover:bg-(--surface-hover) font-bold"
          >
            neue Stelle
          </button>
          <span>
            Derselbe Seed ergibt dieselbe Runde — so rät die ganze Klasse an derselben Stelle.
          </span>
        </div>

        <div className="p-3 rounded-xl border border-(--border) bg-(--bg) text-sm leading-relaxed">
          {woerter.slice(Math.max(0, pos - 14), pos).join(" ")}{" "}
          <span className="px-2 py-0.5 rounded-lg bg-(--accent) text-(--accent-text) font-black">
            {wahl === null ? "???" : richtig}
          </span>
        </div>

        {!fertig && (
          <div className="flex flex-wrap gap-2">
            {vorschlag.liste.map(wort => {
              const istRichtig = wahl !== null && wort === richtig;
              const istFalsch = wahl === wort && wort !== richtig;
              return (
                <button
                  key={wort}
                  type="button"
                  onClick={() => tippe(wort)}
                  disabled={wahl !== null}
                  className={`px-3 py-1.5 rounded-xl border text-sm font-bold disabled:opacity-90 ${
                    istRichtig ? "border-(--green,#22c55e) bg-(--green,#22c55e) text-white"
                      : istFalsch ? "border-(--red,#ef4444) bg-(--red,#ef4444) text-white"
                        : "border-(--border) bg-(--surface) hover:bg-(--surface-hover)"
                  }`}
                >
                  {wort}
                </button>
              );
            })}
          </div>
        )}

        {wahl !== null && !fertig && (
          <div className="flex items-center gap-3 flex-wrap text-sm">
            <span>
              {wahl === richtig ? "✓ Getroffen." : `✗ Es war »${richtig}«.`}
              {" "}Das Netz tippte auf <b>{vorschlag.tipp}</b>
              {vorschlag.tipp === richtig ? " — auch richtig." : "."}
            </span>
            <button
              type="button"
              onClick={weiter}
              className="px-3 py-1.5 rounded-xl font-black bg-(--accent) text-(--accent-text) text-sm"
            >
              Weiter →
            </button>
          </div>
        )}

        <div className="flex gap-4 flex-wrap text-sm">
          <span>👤 Du: <b>{stand.ich}</b></span>
          <span>🤖 Netz: <b>{stand.maschine}</b></span>
          {stand.runde > 0 && (
            <span className="text-(--text-muted)">
              von {stand.runde} {stand.runde === 1 ? "Wort" : "Wörtern"}
            </span>
          )}
        </div>

        {fertig && (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-bold">
              {stand.ich > stand.maschine
                ? "Du warst besser — weil du weißt, worum es in dem Text geht. Das Netz kennt nur Häufigkeiten."
                : stand.ich === stand.maschine
                  ? "Gleichstand. Bei den häufigen Wörtern ist Zählen genauso gut wie Verstehen."
                  : "Das Netz war besser. Bei kurzen, häufigen Wörtern schlägt Statistik das Nachdenken."}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => neu(korpusNr, Math.floor(Math.random() * 1000))}
                className="px-3 py-1.5 rounded-xl font-black bg-(--accent) text-(--accent-text) text-sm"
              >
                ↺ Noch eine Runde
              </button>
              {KORPORA.map((k, i) => (
                <button
                  key={k.slug}
                  type="button"
                  onClick={() => neu(i)}
                  className={`px-3 py-1.5 rounded-xl border text-sm font-bold ${
                    i === korpusNr
                      ? "border-(--accent)"
                      : "border-(--border) bg-(--surface) hover:bg-(--surface-hover)"
                  }`}
                >
                  {k.icon} {k.titel}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <Wissen thema="raten" />
    </div>
  );
}
