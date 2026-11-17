"use client";
/**
 * ☰-Menü für alles, was kein Filter ist: Abschnitte mit Überschrift, Punkte als
 * Knöpfe oder Links. Schließt nach einem Klick, bei Esc und beim Klick daneben.
 */
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

const Schliessen = createContext<() => void>(() => {});

export function Menue({ children, titel = "Menü" }: { children: ReactNode; titel?: string }) {
  const [offen, setOffen] = useState(false);
  const rahmen = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!offen) return;
    const klick = (e: MouseEvent) => { if (!rahmen.current?.contains(e.target as Node)) setOffen(false); };
    const taste = (e: KeyboardEvent) => { if (e.key === "Escape") setOffen(false); };
    document.addEventListener("mousedown", klick);
    document.addEventListener("keydown", taste);
    return () => { document.removeEventListener("mousedown", klick); document.removeEventListener("keydown", taste); };
  }, [offen]);
  return (
    <div className="relative" ref={rahmen}>
      <button className={`btn-secondary h-8 px-3 py-0 text-base ${offen ? "bg-surface-hover" : ""}`} aria-haspopup="menu" aria-expanded={offen}
        aria-label={titel} title={titel} onClick={() => setOffen(o => !o)}>☰</button>
      {offen && (
        <div role="menu" className="absolute right-0 top-full mt-1 z-50 w-72 max-h-[80vh] overflow-y-auto card p-1.5 shadow-xl flex flex-col">
          <Schliessen.Provider value={() => setOffen(false)}>{children}</Schliessen.Provider>
        </div>
      )}
    </div>
  );
}

export function MenueAbschnitt({ titel, children }: { titel: string; children: ReactNode }) {
  return (
    <div className="py-1 border-b border-line last:border-b-0">
      <div className="px-2 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">{titel}</div>
      {children}
    </div>
  );
}

export function MenuePunkt({ onClick, href, children, title, gefahr, disabled }: {
  onClick?: () => void;
  href?: string;
  children: ReactNode;
  title?: string;
  gefahr?: boolean;
  disabled?: boolean;
}) {
  const zu = useContext(Schliessen);
  const cls = `w-full text-left rounded-md px-2 py-1.5 text-sm flex items-center gap-2 disabled:opacity-40 ${
    gefahr ? "text-bad hover:bg-bad/10" : "hover:bg-surface-hover"}`;
  if (href) return <a role="menuitem" className={cls} href={href} target="_blank" rel="noreferrer" title={title} onClick={zu}>{children}</a>;
  return <button role="menuitem" className={cls} title={title} disabled={disabled} onClick={() => { zu(); onClick?.(); }}>{children}</button>;
}

/** Freies Element im Menü (z. B. eine Auswahl), schließt nicht von selbst. */
export function MenueFeld({ children }: { children: ReactNode }) {
  return <div className="px-2 py-1">{children}</div>;
}
