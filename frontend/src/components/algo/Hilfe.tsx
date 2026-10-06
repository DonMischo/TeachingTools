"use client";
/**
 * Gemeinsame Bausteine für Wertung und Hilfe in allen drei Reitern:
 *   HilfeKontext — Hilfsmodus an/aus (Schalter oben in der Werkstatt)
 *   useMessung   — Zeit (nur solange die Seite sichtbar ist), Untätigkeit,
 *                  Fehlversuche, Vorgeführt; daraus die unscharfe Hilfestufe
 *   HilfeLeiste  — Tipp → konkreter Hinweis → »Vorführen«, je nach Stufe
 *   WertungZeile — Sterne und Punkte nach dem Lösen
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { hilfestufe, type Hilfestufe } from "@/lib/algo/hilfe";
import type { Wertung } from "@/lib/algo/wertung";

export const HilfeKontext = createContext<{ hilfsmodus: boolean }>({ hilfsmodus: false });
export const useHilfsmodus = () => useContext(HilfeKontext).hilfsmodus;

export interface Messung {
  sekunden: number;
  untaetig: number;
  fehlversuche: number;
  vorgefuehrt: boolean;
  stufe: Hilfestufe;
  hilfsmodus: boolean;
  fehler: () => void;
  vorfuehren: () => void;
}

export function useMessung(richtzeit: number): Messung {
  const hilfsmodus = useHilfsmodus();
  const [sekunden, setSekunden] = useState(0);
  const [untaetig, setUntaetig] = useState(0);
  const [fehlversuche, setFehlversuche] = useState(0);
  const [vorgefuehrt, setVorgefuehrt] = useState(false);
  const zuletzt = useRef(Date.now());
  useEffect(() => {
    const regung = () => { zuletzt.current = Date.now(); setUntaetig(0); };
    window.addEventListener("pointerdown", regung);
    window.addEventListener("keydown", regung);
    const takt = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      setSekunden(s => s + 1);
      setUntaetig(Math.round((Date.now() - zuletzt.current) / 1000));
    }, 1000);
    return () => {
      clearInterval(takt);
      window.removeEventListener("pointerdown", regung);
      window.removeEventListener("keydown", regung);
    };
  }, []);
  const stufe = hilfestufe({ fehlversuche, zeitAnteil: sekunden / Math.max(1, richtzeit), untaetig, hilfsmodus });
  return {
    sekunden, untaetig, fehlversuche, vorgefuehrt, hilfsmodus,
    stufe: hilfsmodus ? (Math.max(stufe, 1) as Hilfestufe) : stufe,
    fehler: useCallback(() => setFehlversuche(n => n + 1), []),
    vorfuehren: useCallback(() => setVorgefuehrt(true), []),
  };
}

const uhr = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export function HilfeLeiste({ m, tipp, hinweis, onVorfuehren, vorfuehrenText = "🎬 Vorführen" }: {
  m: Messung;
  tipp?: ReactNode;
  hinweis?: ReactNode;
  onVorfuehren?: () => void;
  vorfuehrenText?: string;
}) {
  const [offen, setOffen] = useState(false);
  const zeigeTipp = offen || m.stufe >= 1;
  const zeigeHinweis = m.stufe >= 2;
  const zeigeVorfuehren = !!onVorfuehren && (m.stufe >= 3 || m.hilfsmodus);
  return (
    <div className="flex flex-col gap-1.5 text-sm" data-testid="hilfe-leiste">
      <div className="flex items-center gap-3 text-xs text-muted flex-wrap">
        <span title="Zeit (läuft nur, solange die Seite offen ist)">⏱ {uhr(m.sekunden)}</span>
        <span title="Fehlversuche">✗ {m.fehlversuche}</span>
        {m.vorgefuehrt && <span title="Vorgeführt: halbe Punkte, höchstens ein Stern">🎬 vorgeführt</span>}
        {!zeigeTipp && tipp && <button type="button" className="underline" onClick={() => setOffen(true)}>💡 Tipp zeigen</button>}
        {zeigeVorfuehren && (
          <button type="button" className="ml-auto btn-secondary !py-1 !px-2 text-xs animate-pulse" onClick={() => { m.vorfuehren(); onVorfuehren!(); }}
            title="Zeigt die Lösung Schritt für Schritt — danach gibt es halbe Punkte">{vorfuehrenText}</button>
        )}
      </div>
      {zeigeTipp && tipp && <div className="rounded-lg border border-line bg-page p-2">💡 {tipp}</div>}
      {zeigeHinweis && hinweis && <div className="rounded-lg border border-accent/50 bg-accent/10 p-2">🔎 {hinweis}</div>}
    </div>
  );
}

export function Sterne({ n, gross }: { n: number; gross?: boolean }) {
  return (
    <span className={gross ? "text-4xl tracking-widest" : ""}>
      <span className="text-amber-400">{"★".repeat(n)}</span><span className="text-muted">{"☆".repeat(3 - n)}</span>
    </span>
  );
}

export function WertungZeile({ w }: { w: Wertung }) {
  return (
    <div className="rounded-lg border border-ok/60 bg-ok/10 p-2 text-sm flex items-center gap-3 flex-wrap" role="status">
      <Sterne n={w.sterne} /> <b>{w.punkte} Punkte</b>
    </div>
  );
}
