"use client";
/** Persönliche Daten in einem Prompt schwärzen: antippen schwärzt, nochmal antippen hebt auf. */
import { useState } from "react";
import { SCHWAERZ_TEXT, schwaerzWertung } from "@/lib/kikompass/interaktiv";

export function Schwaerzen({ onFertig }: { onFertig?: () => void }) {
  const [weg, setWeg] = useState<Set<number>>(new Set());
  const [geprueft, setGeprueft] = useState(false);
  const w = schwaerzWertung(weg);

  function umschalten(i: number) {
    if (geprueft) return;
    setWeg(alt => { const n = new Set(alt); if (n.has(i)) n.delete(i); else n.add(i); return n; });
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="font-semibold">Schwärzen vor dem Absenden</p>
      <p className="text-sm text-muted">
        Lea will die KI etwas fragen. Tippe alle Stellen an, die nicht in einen KI-Chat gehören. Die Frage selbst muss lesbar bleiben.
      </p>
      <p className="card p-3 leading-8">
        {SCHWAERZ_TEXT.map((s, i) => {
          const schwarz = weg.has(i);
          const farbe = geprueft ? (s.privat && !schwarz ? "ring-2 ring-red-500" : !s.privat && schwarz ? "ring-2 ring-amber-500" : "") : "";
          return (
            <button key={i} onClick={() => umschalten(i)} aria-pressed={schwarz}
              className={`rounded px-0.5 ${farbe} ${schwarz ? "bg-black text-black dark:bg-white dark:text-white" : "hover:bg-surface-hover"}`}>
              {s.text}
            </button>
          );
        })}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        {!geprueft ? (
          <button className="btn-primary" onClick={() => { setGeprueft(true); onFertig?.(); }}>Prüfen</button>
        ) : (
          <>
            <span className="font-medium">
              {w.gefunden} von {w.privat} persönlichen Angaben geschwärzt
              {w.zuviel > 0 ? `, ${w.zuviel}× zu viel (die Frage braucht die KI noch)` : ""}.
              {w.gefunden === w.privat && w.zuviel === 0 ? " Perfekt – so kann die Frage raus!" : " Rot umrandet: fehlt noch."}
            </span>
            <button className="btn-secondary" onClick={() => { setWeg(new Set()); setGeprueft(false); }}>Nochmal</button>
          </>
        )}
      </div>
      {geprueft && (
        <p className="text-sm text-muted">
          Besser so: »Ein·e Schüler·in der 7. Klasse fragt: Kannst du mir erklären, wie man Brüche kürzt?« Für eine gute Antwort reicht das völlig.
        </p>
      )}
    </div>
  );
}
