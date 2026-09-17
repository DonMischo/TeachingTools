"use client";
/**
 * Die Karte zu einem Gerät oder einem Ereignis.
 *
 * Zeigt jede Größe mit ihrer Formel und den eingesetzten Zahlen. Das ist der
 * Unterschied zu einer Messanzeige: »0,26 J« sagt nichts, »E_pot = m·g·h =
 * 0,2 · 9,81 · 0,13 = 0,26 J« kann man an die Tafel schreiben.
 */
import { alsText, type Groesse } from "@/lib/physik/phaenomene";

export function Bericht({ titel, hinweis, werte, onSchliessen }: {
  titel: string;
  hinweis?: string;
  werte: Groesse[];
  onSchliessen?: () => void;
}) {
  if (!werte.length && !hinweis) return null;
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-black">{titel}</h2>
        {onSchliessen && (
          <button
            onClick={onSchliessen}
            aria-label="Karte schließen"
            className="text-[var(--text-muted)] hover:text-[var(--text)] leading-none px-1"
          >✕</button>
        )}
      </div>

      {hinweis && <p className="text-sm text-[var(--text-muted)] leading-relaxed">{hinweis}</p>}

      <dl className="flex flex-col gap-2">
        {werte.map(w => (
          <div key={w.name} className="border-t border-[var(--border)] pt-2 first:border-0 first:pt-0">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-sm text-[var(--text-muted)]">{w.name}</dt>
              <dd className="font-bold tabular-nums">{alsText(w)}</dd>
            </div>
            {w.formel && (
              <div className="text-xs text-[var(--text-muted)] mt-0.5 font-mono">
                {w.formel}
                {w.rechnung && <> = {w.rechnung} = <span className="font-bold">{alsText(w)}</span></>}
              </div>
            )}
          </div>
        ))}
      </dl>
    </div>
  );
}
