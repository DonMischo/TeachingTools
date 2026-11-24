"use client";
/**
 * Training »Schreiben«: Satz für Satz abtippen — Großbuchstaben, Umlaute,
 * Satzzeichen, Sonderzeichen bis Alt Gr, zum Schluss Rechtschreibung.
 * Die Bildschirmtastatur zeigt für das nächste Zeichen die nötigen Tasten
 * (bei Alt-Gr-Zeichen beide), der Hinweis darunter sagt es in Worten.
 */
import { useEffect, useRef, useState } from "react";
import type { MarkierStand } from "@/lib/markieren/speicher";
import { SCHREIB_LEKTIONEN, richtigBis, stimmt, tastenFuer } from "@/lib/markieren/schreiben";
import { mitTasten } from "@/components/maus/Taste";
import { Tastatur } from "@/components/tippen/Tastatur";

const PAUSE_MS = 1200;

export default function Schreiben({ stand, aendern, onAktuell }: {
  stand: MarkierStand | null;
  aendern: (f: (s: MarkierStand) => MarkierStand) => void;
  onAktuell?: (text: string) => void;
}) {
  const geschafft = stand?.schreiben ?? [];
  const [idx, setIdx] = useState(0);
  const [nr, setNr] = useState(0);
  const lektion = SCHREIB_LEKTIONEN[idx];
  const fertig = nr >= lektion.saetze.length;
  const soll = lektion.saetze[nr] ?? "";
  const anfang = lektion.vorgaben?.[nr] ?? "";
  const [text, setText] = useState(anfang);
  const [geloest, setGeloest] = useState(false);
  const [gedrueckt, setGedrueckt] = useState<Set<string>>(new Set());
  const feld = useRef<HTMLTextAreaElement>(null);
  const weiter = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (weiter.current) clearTimeout(weiter.current); }, []);
  useEffect(() => {
    setText(anfang);
    setGeloest(false);
    feld.current?.focus();
  }, [idx, nr, anfang]);
  useEffect(() => {
    onAktuell?.(fertig ? `Schreiben »${lektion.titel}« geschafft` : `Schreiben »${lektion.titel}«, Satz ${nr + 1}/${lektion.saetze.length}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lektion.id, nr, fertig]);

  function waehle(i: number) { setIdx(i); setNr(0); }

  function eingabe(neu: string) {
    if (geloest) return;
    setText(neu);
    if (!stimmt(neu, soll)) return;
    setGeloest(true);
    weiter.current = setTimeout(() => {
      const naechste = nr + 1;
      setNr(naechste);
      if (naechste === lektion.saetze.length && !geschafft.includes(lektion.id)) {
        aendern(s => ((s.schreiben ?? []).includes(lektion.id) ? s : { ...s, schreiben: [...(s.schreiben ?? []), lektion.id] }));
      }
    }, PAUSE_MS);
  }

  // Beim Abtippen hilft die Tastatur fürs nächste Zeichen; bei der Rechtschreibung zeigt sie nichts vor.
  const korrektur = !!lektion.vorgaben;
  const bis = richtigBis(text, soll);
  const hilfe = !korrektur && !geloest && bis === text.length ? tastenFuer(soll[bis]) : null;

  return (
    <div className="grid gap-4 md:grid-cols-[17rem_1fr]">
      <nav className="card p-3 flex flex-col gap-1 h-fit" aria-label="Schreib-Lektionen">
        <div className="text-xs font-bold text-muted px-2 mb-1">{geschafft.length} von {SCHREIB_LEKTIONEN.length} geschafft</div>
        {SCHREIB_LEKTIONEN.map((l, i) => (
          <button key={l.id} type="button" onClick={() => waehle(i)}
            className={"text-left text-sm rounded-lg px-2 py-1.5 flex gap-2 items-center " +
              (i === idx ? "bg-accent text-accent-fg font-bold" : "hover:bg-surface-hover")}>
            <span className="w-5 text-center">{geschafft.includes(l.id) ? "✅" : l.icon}</span>
            <span>{l.titel}</span>
          </button>
        ))}
      </nav>

      <section className="flex flex-col gap-4 min-w-0">
        <div className="card p-4 flex flex-col gap-2">
          <h2 className="text-xl font-black">{lektion.icon} {lektion.titel}</h2>
          <ul className="list-disc pl-6 flex flex-col gap-1">
            {lektion.schritte.map((s, i) => <li key={i}>{mitTasten(s)}</li>)}
          </ul>
        </div>

        {fertig ? (
          <div className="card p-6 flex flex-col items-center gap-3 text-center">
            <div className="text-4xl">🎉</div>
            <p className="font-black text-lg">Lektion geschafft!</p>
            <div className="flex gap-2 flex-wrap justify-center">
              <button type="button" className="btn-secondary" onClick={() => setNr(0)}>↺ Nochmal</button>
              {idx < SCHREIB_LEKTIONEN.length - 1 && (
                <button type="button" className="btn-primary" onClick={() => waehle(idx + 1)}>Nächste Lektion →</button>
              )}
            </div>
          </div>
        ) : (
          <div className="card p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="font-bold text-lg">{korrektur ? "👉 Verbessere den Satz im Feld." : "👉 Tippe genau ab:"}</p>
              <span className="text-sm text-muted">Satz {nr + 1} von {lektion.saetze.length}</span>
            </div>
            {!korrektur && (
              <p className="font-mono text-xl rounded-xl bg-surface-hover px-4 py-3 whitespace-pre-wrap" data-testid="schreib-vorlage">
                {soll.split("").map((c, i) => (
                  <span key={i} className={i < bis ? "text-ok" : i === bis && !geloest ? "underline decoration-2 decoration-accent" : ""}>{c}</span>
                ))}
              </p>
            )}
            <textarea ref={feld} value={text} rows={2} spellCheck={false} autoCorrect="off" autoCapitalize="off" aria-label="Eingabe"
              onChange={e => eingabe(e.target.value)}
              onKeyDown={e => setGedrueckt(g => new Set(g).add(e.code))}
              onKeyUp={e => setGedrueckt(g => { const n = new Set(g); n.delete(e.code); return n; })}
              onBlur={() => setGedrueckt(new Set())}
              className={`input font-mono text-xl ${geloest ? "!border-ok" : bis < text.length && !korrektur ? "!border-bad" : ""}`} />
            <div className="min-h-6 text-sm">
              {geloest ? <span className="text-ok font-bold">✅ Richtig!</span>
                : !korrektur && bis < text.length ? <span className="text-bad">{mitTasten("Ab hier stimmt es nicht — mit [[Rücktaste]] zurück.")}</span>
                : hilfe ? <span className="text-muted">Nächstes Zeichen: {mitTasten(hilfe.text)}</span>
                : korrektur ? <span className="text-muted">Tipp: Groß/klein, Umlaute, Komma, doppelte Buchstaben …</span> : null}
            </div>
            {!korrektur && <Tastatur gedrueckt={gedrueckt} zeigeFinger={false} markiert={hilfe ? new Set(hilfe.codes) : undefined} />}
          </div>
        )}
      </section>
    </div>
  );
}
