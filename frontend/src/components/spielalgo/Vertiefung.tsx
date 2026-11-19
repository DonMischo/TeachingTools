"use client";
/**
 * »Genauer hinschauen«: aufklappbares Feld je Reiter mit Hintergrund,
 * gekürztem Code und zusätzlichen Stellschrauben. Zugeklappt stört es nicht,
 * aufgeklappt liegt es direkt über der Bühne, damit man die Wirkung sieht.
 */
import { useState, type ReactNode } from "react";
import type { Schnipsel } from "./code";

export function Vertiefung({ hintergrund, code, stellschrauben, extra }: {
  hintergrund: ReactNode;
  code: Schnipsel[];
  stellschrauben: ReactNode;
  /** z. B. eine zusätzliche Bühne */
  extra?: ReactNode;
}) {
  const [nr, setNr] = useState(0);
  const s = code[Math.min(nr, code.length - 1)];
  return (
    <details className="card group text-sm" data-vertiefung>
      <summary className="cursor-pointer select-none px-4 py-2.5 font-bold flex items-center gap-2 list-none [&::-webkit-details-marker]:hidden">
        <span className="transition-transform group-open:rotate-90">▶</span>
        🔬 Genauer hinschauen: Code, Hintergrund und Stellschrauben
        <span className="font-normal text-muted text-xs ml-auto hidden sm:inline">Regeln ändern und zusehen, was passiert</span>
      </summary>
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] gap-4 px-4 pb-4">
        <div className="flex flex-col gap-2 min-w-0">
          {code.length > 1 && (
            <div className="flex flex-wrap gap-1" aria-label="Code-Schnipsel">
              {code.map((c, i) => (
                <button key={c.name} aria-pressed={i === nr} onClick={() => setNr(i)}
                  className={`px-2 py-1 rounded-md text-xs font-bold border ${i === nr ? "bg-accent text-accent-fg border-accent" : "border-line bg-surface text-muted hover:text-fg"}`}>
                  {c.name}
                </button>
              ))}
            </div>
          )}
          <Code schnipsel={s} />
          <div className="flex flex-col gap-2 leading-relaxed">{hintergrund}</div>
        </div>
        <div className="flex flex-col gap-3 min-w-0">
          <div className="rounded-xl border border-line bg-page p-3 flex flex-col gap-2.5" data-stellschrauben>
            <h4 className="font-black">🎛️ Stellschrauben</h4>
            {stellschrauben}
          </div>
          {extra}
        </div>
      </div>
    </details>
  );
}

/** Code-Block; Kommentarzeilen und -enden gedämpft. */
export function Code({ schnipsel }: { schnipsel: Schnipsel }) {
  return (
    <figure className="flex flex-col gap-1">
      <pre className="text-[12px] leading-snug font-mono bg-page border border-line rounded-lg p-3 overflow-auto max-h-[420px]" data-code>
        {schnipsel.text.split("\n").map((z, i) => {
          const k = z.indexOf("//");
          return (
            <div key={i}>
              {k < 0 ? z : <>{z.slice(0, k)}<span className="text-muted italic">{z.slice(k)}</span></>}
              {z === "" ? " " : null}
            </div>
          );
        })}
      </pre>
      <figcaption className="text-xs text-muted">gekürzt aus <code>{schnipsel.datei}</code> (Zeichnen und Sonderfälle weggelassen)</figcaption>
    </figure>
  );
}

/** Auswahl mit Beschriftung, für Stellschrauben. */
export function Wahl<T extends string>({ label, wert, setWert, optionen }: {
  label: string; wert: T; setWert: (v: T) => void; optionen: [T, string][];
}) {
  return (
    <label className="flex items-center gap-2 flex-wrap">
      <span>{label}</span>
      <select value={wert} onChange={e => setWert(e.target.value as T)} className="rounded-lg border border-line bg-surface px-2 py-1">
        {optionen.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
      </select>
    </label>
  );
}

/** Kleine Erklärzeile unter einer Stellschraube. */
export function Hinweis({ children }: { children: ReactNode }) {
  return <p className="text-xs text-muted -mt-1.5">{children}</p>;
}
