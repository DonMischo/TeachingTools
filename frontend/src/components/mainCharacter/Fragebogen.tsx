"use client";
/** Fragebogen: eine Frage pro Bildschirm, zurück jederzeit möglich, Fortschritt oben. */
import { useState } from "react";
import { FRAGEN } from "@/lib/mainCharacterFragebogen";

export function Fragebogen({ antworten, onAntworten, onFertig, onAbbrechen }: {
  antworten: (number | undefined)[];
  onAntworten: (a: (number | undefined)[]) => void;
  /** mit allen Antworten — die letzte ist im Elternteil evtl. noch nicht angekommen */
  onFertig: (antworten: (number | undefined)[]) => void;
  onAbbrechen: () => void;
}) {
  const erste = antworten.findIndex(a => a === undefined);
  const [i, setI] = useState(erste < 0 ? Math.min(antworten.length, FRAGEN.length - 1) : erste);
  const f = FRAGEN[i];
  const waehle = (j: number) => {
    const neu = [...antworten];
    neu[i] = j;
    if (i < FRAGEN.length - 1) { onAntworten(neu); setI(i + 1); }
    else onFertig(neu);
  };
  return (
    <section className="card p-5 flex flex-col gap-4 max-w-2xl mx-auto w-full" aria-labelledby="mc-frage">
      <div className="flex items-center gap-3 text-sm text-muted">
        <span className="tabular-nums">Frage {i + 1} von {FRAGEN.length}</span>
        <div className="flex-1 h-1.5 rounded bg-surface-hover overflow-hidden">
          <div className="h-full bg-accent transition-all" style={{ width: `${(i / FRAGEN.length) * 100}%` }} />
        </div>
      </div>
      <h2 id="mc-frage" className="text-xl font-semibold text-balance">{f.frage}</h2>
      <div className="flex flex-col gap-2">
        {f.antworten.map((a, j) => (
          <button key={j} type="button" onClick={() => waehle(j)}
            className={`text-left rounded-lg border px-4 py-3 transition-colors ${antworten[i] === j ? "border-accent bg-accent/10" : "border-line hover:border-accent"}`}>
            {a.text}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted">Es gibt keine falschen Antworten. Nimm, was am ehesten zu dir passt. Deine Antworten bleiben auf diesem Gerät.</p>
      <div className="flex justify-between gap-2">
        <button type="button" className="btn-secondary" onClick={() => (i > 0 ? setI(i - 1) : onAbbrechen())}>← Zurück</button>
        {antworten[i] !== undefined && i < FRAGEN.length - 1 && (
          <button type="button" className="btn-secondary" onClick={() => setI(i + 1)}>Weiter →</button>
        )}
        {antworten[i] !== undefined && i === FRAGEN.length - 1 && (
          <button type="button" className="btn-primary" onClick={() => onFertig(antworten)}>Auswerten</button>
        )}
      </div>
    </section>
  );
}
