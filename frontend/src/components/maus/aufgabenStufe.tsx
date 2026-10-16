"use client";
/**
 * Gerüst der Stufen, die Aufgabe für Aufgabe abgearbeitet werden (Aussehen,
 * Bedienhilfe, Profil, Taskleiste): Schrittzähler, Hinweis nach jedem Versuch,
 * Fehler und die Wertung, sobald alle Aufgaben gelöst sind.
 */
import { useEffect, useRef, useState } from "react";
import type { StufeId, StufenErgebnis } from "@/lib/maus/ergebnis";
import { wertung } from "@/lib/maus/wertung";

export type Hinweis = { text: string; gut: boolean };

export function useAufgabenStufe(stufe: StufeId, anzahl: number, onFertig: (e: StufenErgebnis) => void) {
  const start = useRef(performance.now());
  const [schritt, setSchritt] = useState(0);
  const [fehler, setFehler] = useState(0);
  const [hinweis, setHinweis] = useState<Hinweis | null>(null);
  const gemeldet = useRef(false);
  // Zwischen »richtig« und dem nächsten Schritt zählt kein zweiter Treffer —
  // sonst übersprängen zwei schnelle Klicks eine Aufgabe.
  const wechselt = useRef(false);
  const fertig = schritt >= anzahl;

  useEffect(() => {
    if (fertig && !gemeldet.current) {
      gemeldet.current = true;
      const dauerMs = Math.round(performance.now() - start.current);
      const { punkte, details } = wertung({ stufe, geloest: anzahl, anzahl, dauerMs, fehler });
      onFertig({ punkte, dauerMs, details });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fertig]);

  function weiterMit(gut: boolean, text: string) {
    if (wechselt.current) return;
    setHinweis({ text, gut });
    if (!gut) return;
    wechselt.current = true;
    setTimeout(() => { setHinweis(null); setSchritt(s => s + 1); wechselt.current = false; }, 700);
  }

  /** Zwischenstand für den Stufenkopf. */
  const punkte = () => wertung({
    stufe, geloest: Math.min(schritt, anzahl), anzahl, dauerMs: performance.now() - start.current, fehler,
  }).punkte;

  return { schritt, setSchritt, fehler, setFehler, hinweis, setHinweis, wechselt, fertig, weiterMit, punkte };
}

export function Hinweiszeile({ hinweis, ersatz }: { hinweis: Hinweis | null; ersatz?: string | null }) {
  return (
    <div className="min-h-6 text-center text-sm font-bold" aria-live="polite"
      style={{ color: hinweis?.gut ? "var(--green, #16a34a)" : "var(--text-muted)" }}>
      {hinweis?.text ?? ersatz}
    </div>
  );
}
