"use client";
/**
 * Techniken lernen: je Lektion eine Technik, erklärt in wenigen Schritten,
 * dann drei Aufgaben. Gezählt wird nur, wer die geübte Technik auch benutzt —
 * wer stattdessen zieht, bekommt »Richtig, aber übe hier …«.
 */
import { useEffect, useMemo, useState } from "react";
import { AUFGABEN_JE_LEKTION, LEKTIONEN, lektionsAufgaben, zufall } from "@/lib/markieren/aufgaben";
import { mitTasten } from "@/components/maus/Taste";
import { Textfeld } from "./Textfeld";

const SCHLUESSEL = "hp_markieren_lektionen";
const liesGeschafft = (): string[] => {
  try { return JSON.parse(localStorage.getItem(SCHLUESSEL) ?? "[]"); } catch { return []; }
};
const schreibGeschafft = (ids: string[]) => {
  try { localStorage.setItem(SCHLUESSEL, JSON.stringify(ids)); } catch { /* privat */ }
};

const saat = (id: string, runde: number) => [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) + runde * 7919;

export default function Lektionen() {
  const [geschafft, setGeschafft] = useState<string[]>([]);
  const [idx, setIdx] = useState(0);
  const [runde, setRunde] = useState(0);
  const [nr, setNr] = useState(0);
  const lektion = LEKTIONEN[idx];
  const aufgaben = useMemo(() => lektionsAufgaben(lektion, zufall(saat(lektion.id, runde))), [lektion, runde]);
  const fertig = nr >= AUFGABEN_JE_LEKTION;

  useEffect(() => {
    const g = liesGeschafft();
    setGeschafft(g);
    const offen = LEKTIONEN.findIndex(l => !g.includes(l.id));
    if (offen > 0) setIdx(offen);
  }, []);

  function waehle(i: number) {
    setIdx(i);
    setNr(0);
    setRunde(0);
  }

  function geloest() {
    const naechste = nr + 1;
    setNr(naechste);
    if (naechste === AUFGABEN_JE_LEKTION && !geschafft.includes(lektion.id)) {
      const neu = [...geschafft, lektion.id];
      setGeschafft(neu);
      schreibGeschafft(neu);
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-[17rem_1fr]">
      <nav className="card p-3 flex flex-col gap-1 h-fit" aria-label="Lektionen">
        <div className="text-xs font-bold text-muted px-2 mb-1">
          {geschafft.length} von {LEKTIONEN.length} Techniken geschafft
        </div>
        {LEKTIONEN.map((l, i) => (
          <button key={l.id} type="button" onClick={() => waehle(i)}
            className={"text-left text-sm rounded-lg px-2 py-1.5 flex gap-2 items-center " +
              (i === idx ? "bg-accent text-accent-fg font-bold" : "hover:bg-surface-hover")}>
            <span>{geschafft.includes(l.id) ? "✅" : l.icon}</span>
            <span>{l.titel}</span>
          </button>
        ))}
      </nav>

      <section className="flex flex-col gap-4 min-w-0">
        <div className="card p-4 flex flex-col gap-2">
          <h2 className="text-xl font-black">{lektion.icon} {lektion.titel}</h2>
          <ol className="list-decimal pl-6 flex flex-col gap-1">
            {lektion.schritte.map((s, i) => <li key={i}>{mitTasten(s)}</li>)}
          </ol>
          {lektion.merke && <p className="text-sm text-muted">💡 {mitTasten(lektion.merke)}</p>}
        </div>

        {fertig ? (
          <div className="card p-6 flex flex-col items-center gap-3 text-center">
            <div className="text-4xl">🎉</div>
            <p className="font-black text-lg">Lektion geschafft!</p>
            <div className="flex gap-2 flex-wrap justify-center">
              <button type="button" className="btn-secondary" onClick={() => { setRunde(r => r + 1); setNr(0); }}>↺ Noch eine Runde</button>
              {idx < LEKTIONEN.length - 1 && (
                <button type="button" className="btn-primary" onClick={() => waehle(idx + 1)}>Nächste Technik →</button>
              )}
            </div>
          </div>
        ) : (
          <div className="card p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="font-bold text-lg">👉 {mitTasten(aufgaben[nr].auftrag)}</p>
              <span className="text-sm text-muted">Aufgabe {nr + 1} von {AUFGABEN_JE_LEKTION}</span>
            </div>
            <Textfeld key={`${lektion.id}-${runde}-${nr}`} aufgabe={aufgaben[nr]} verlangt={lektion.verlangt} onGeloest={geloest} />
          </div>
        )}
      </section>
    </div>
  );
}
