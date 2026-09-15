/**
 * Knöpfe für die dunkle Bühne. Die Simulation bleibt im Weltraum-Look, egal
 * welches Farbschema die App gerade hat — deshalb feste Farben statt var(--…).
 */
import type { ReactNode } from "react";

export function Schalter({ an, onClick, children, titel }: {
  an: boolean;
  onClick: () => void;
  children: ReactNode;
  titel?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={titel}
      aria-pressed={an}
      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
        an ? "bg-sky-400/25 text-sky-100 ring-1 ring-sky-300/50" : "bg-white/5 text-slate-400 hover:text-slate-200"
      }`}
    >
      {children}
    </button>
  );
}

export function Knopfgruppe<T extends string | number>({ werte, aktiv, onWahl }: {
  werte: { wert: T; name: string }[];
  aktiv: T;
  onWahl: (wert: T) => void;
}) {
  return (
    <div className="inline-flex flex-wrap rounded-lg bg-white/5 p-0.5">
      {werte.map(w => (
        <button
          key={String(w.wert)}
          onClick={() => onWahl(w.wert)}
          aria-pressed={w.wert === aktiv}
          className={`px-2 py-1 rounded-md text-xs font-bold transition-colors ${
            w.wert === aktiv ? "bg-sky-400/30 text-white" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          {w.name}
        </button>
      ))}
    </div>
  );
}
