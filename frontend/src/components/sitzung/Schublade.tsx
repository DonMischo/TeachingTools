"use client";
/**
 * Schublade von rechts für Dashboard und Auswertung: das Werkzeug bleibt
 * daneben sichtbar und bedienbar. »Vollbild« macht daraus die Beamer-Ansicht.
 * Esc oder × schließt.
 */
import { useEffect, useState, type ReactNode } from "react";

export function Schublade({ titel, onClose, children }: { titel: ReactNode; onClose: () => void; children: ReactNode }) {
  const [voll, setVoll] = useState(false);
  useEffect(() => {
    const taste = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", taste);
    return () => document.removeEventListener("keydown", taste);
  }, [onClose]);
  return (
    <aside role="dialog" aria-label={typeof titel === "string" ? titel : undefined}
      className={`fixed z-90 bg-page border-l border-line shadow-2xl flex flex-col text-left ${
        voll ? "inset-0" : "top-0 right-0 bottom-0 w-full sm:w-[min(52rem,90vw)]"}`}>
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-line bg-surface">
        <span className="font-black text-base flex-1 truncate">{titel}</span>
        <button type="button" onClick={() => setVoll(v => !v)} aria-pressed={voll}
          className="text-xs border border-line rounded-lg px-2.5 py-1 hover:border-accent">
          {voll ? "⤡ Seitenleiste" : "⤢ Vollbild"}
        </button>
        <button type="button" onClick={onClose} aria-label="Schließen" className="text-muted hover:text-fg text-xl leading-none px-1">×</button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">{children}</div>
    </aside>
  );
}
