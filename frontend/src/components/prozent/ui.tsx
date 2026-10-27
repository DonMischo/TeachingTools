"use client";
/** Kleine Bedienteile für die Prozent-Blätter. */
import { useEffect, useState, type ReactNode } from "react";
import { leseZahl, z } from "@/lib/prozent";

/** Zahlenfeld mit deutschem Komma; meldet nur gültige Zahlen im Bereich. */
export function Zahlfeld({ label, wert, setze, min = 0, max = 1e9, einheit, breite = "w-28" }: {
  label: ReactNode; wert: number; setze: (n: number) => void; min?: number; max?: number; einheit?: string; breite?: string;
}) {
  const [text, setText] = useState(z(wert, 4));
  // Von außen gesetzte Werte übernehmen, solange das Getippte nicht schon dasselbe meint.
  useEffect(() => { setText(t => (leseZahl(t) === wert ? t : z(wert, 4))); }, [wert]);
  const n = leseZahl(text);
  const ok = n !== null && n >= min && n <= max;
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-muted">{label}</span>
      <span className="flex items-center gap-1">
        <input className={`input ${breite} ${ok ? "" : "border-bad"}`} inputMode="decimal" value={text}
          onChange={e => {
            setText(e.target.value);
            const x = leseZahl(e.target.value);
            if (x !== null && x >= min && x <= max) setze(x);
          }} />
        {einheit && <span className="font-bold">{einheit}</span>}
      </span>
    </label>
  );
}

export function Chips<T extends string>({ wahl, setze, optionen }: {
  wahl: T; setze: (t: T) => void; optionen: readonly { id: T; label: ReactNode }[];
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {optionen.map(o => (
        <button key={o.id} type="button" className={`chip ${wahl === o.id ? "chip-on" : ""}`} aria-pressed={wahl === o.id}
          onClick={() => setze(o.id)}>{o.label}</button>
      ))}
    </div>
  );
}

export function Erklaerung({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted max-w-3xl">{children}</p>;
}

/** Wie viele Antworten saßen — mit Serie. */
export type Punktestand = { richtig: number; gesamt: number; serie: number; beste: number };
export const LEER: Punktestand = { richtig: 0, gesamt: 0, serie: 0, beste: 0 };
export function zaehle(p: Punktestand, richtig: boolean): Punktestand {
  const serie = richtig ? p.serie + 1 : 0;
  return { richtig: p.richtig + (richtig ? 1 : 0), gesamt: p.gesamt + 1, serie, beste: Math.max(p.beste, serie) };
}
