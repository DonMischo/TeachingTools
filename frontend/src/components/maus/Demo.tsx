"use client";
/**
 * Die Vorführung: ein Mauszeiger fährt langsam zum Ziel, daneben die Maus mit
 * der leuchtenden Taste und ein kurzer Satz, was gerade passiert.
 *
 * Jeder Schritt steht rund drei Sekunden — Zehnjährige sollen mitlesen und
 * sehen können, was die Maus tut, nicht nur, dass etwas passiert ist. Für
 * Tastenkürzel erscheint die Tastatur aus der Schreibübung mit den gedrückten
 * Tasten.
 *
 * Während der Vorführung liegt eine durchsichtige Fläche über allem: ein Klick
 * des Kindes soll nicht als Treffer zählen, solange die Maus es vormacht.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Tastatur } from "@/components/tippen/Tastatur";
import { MausBild, type MausTaste } from "./MausBild";

export type Ort = { x: number; y: number };

export type DemoSchritt = {
  text: string;
  /** Wohin der Zeiger fährt (Bildschirmkoordinaten), ausgewertet beim Start des Schritts. */
  zu?: () => Ort | null;
  taste?: MausTaste;
  /** Gedrückte Tasten, als KeyboardEvent.code. */
  tasten?: string[];
  /** Nebenwirkung zu Beginn des Schritts, z. B. ein Wort sichtbar markieren. */
  aktion?: () => void;
  ms?: number;
};

export const SCHRITT_MS = 3000;

type Lauf = { schritt: DemoSchritt; nr: number; von: number; ort: Ort; dauer: number };

export function mitte(el: Element | null): Ort | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

export function useDemo(onEnde?: () => void) {
  const [lauf, setLauf] = useState<Lauf | null>(null);
  const uhren = useRef<ReturnType<typeof setTimeout>[]>([]);
  const endeRef = useRef(onEnde);
  endeRef.current = onEnde;

  const stopp = useCallback(() => {
    uhren.current.forEach(clearTimeout);
    uhren.current = [];
    setLauf(null);
    endeRef.current?.();
  }, []);

  const abspielen = useCallback((schritte: DemoSchritt[]) => {
    uhren.current.forEach(clearTimeout);
    uhren.current = [];
    let ort: Ort = { x: window.innerWidth / 2, y: window.innerHeight - 80 };
    let zeit = 0;
    schritte.forEach((schritt, nr) => {
      const dauer = schritt.ms ?? SCHRITT_MS;
      uhren.current.push(setTimeout(() => {
        ort = schritt.zu?.() ?? ort;
        schritt.aktion?.();
        setLauf({ schritt, nr, von: schritte.length, ort, dauer });
      }, zeit));
      zeit += dauer;
    });
    uhren.current.push(setTimeout(stopp, zeit));
  }, [stopp]);

  useEffect(() => () => uhren.current.forEach(clearTimeout), []);

  return { aktiv: lauf !== null, lauf, abspielen, stopp };
}

function Zeiger() {
  return (
    <svg width="26" height="38" viewBox="0 0 13 19" aria-hidden>
      <path d="M1 1 L1 15 L4.5 11.5 L7 17.5 L9.2 16.6 L6.8 10.8 L11.5 10.8 Z"
        fill="#fff" stroke="#000" strokeWidth="1" strokeLinejoin="round" />
    </svg>
  );
}

export function DemoBuehne({ demo }: { demo: ReturnType<typeof useDemo> }) {
  const { lauf, stopp } = demo;
  if (!lauf) return null;
  const { schritt, ort, dauer } = lauf;
  // Auch mit gehaltener Taste wird gefahren — das ist das Ziehen.
  const faehrt = !!schritt.zu;
  const drueckt = schritt.taste === "links" || schritt.taste === "rechts" || schritt.taste === "doppel";

  return (
    <div className="fixed inset-0 z-[60]" data-testid="demo" onContextMenu={e => e.preventDefault()}>
      <div className="absolute inset-0 bg-black/5" />

      <div
        className="absolute left-0 top-0 pointer-events-none"
        style={{
          transform: `translate(${ort.x}px, ${ort.y}px)`,
          transition: `transform ${faehrt ? Math.round(dauer * 0.7) : 250}ms ease-in-out`,
        }}
      >
        <div className="relative">
          {drueckt && (
            <span
              key={`${lauf.nr}-welle`}
              className="absolute left-0 top-0 w-16 h-16 rounded-full border-4 border-[var(--accent)]"
              style={{ animation: `maus-welle ${schritt.taste === "doppel" ? 600 : 900}ms ease-out infinite` }}
            />
          )}
          <Zeiger />
          <div className="absolute left-7 top-7 flex items-start gap-2">
            <div className="rounded-2xl bg-white/95 shadow-lg p-1.5 border border-gray-200">
              <MausBild taste={schritt.taste ?? null} groesse={54} />
            </div>
            {/* w-max: der Rahmen ist nur so breit wie der Zeiger — ohne bräche jedes Wort um. */}
            <div className="w-max rounded-xl bg-[var(--surface)] text-[var(--text)] shadow-lg border border-[var(--border)] px-3 py-2 text-sm font-bold max-w-[220px] leading-snug">
              {schritt.text}
            </div>
          </div>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 p-3 flex flex-col items-center gap-2 pointer-events-none">
        {schritt.tasten && (
          <div className="w-full max-w-2xl rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-xl p-3">
            <Tastatur gedrueckt={new Set(schritt.tasten)} zeigeFinger={false} />
          </div>
        )}
        <div className="flex items-center gap-3 pointer-events-auto">
          <span className="text-xs text-[var(--text-muted)] tabular-nums">
            Schritt {lauf.nr + 1} von {lauf.von}
          </span>
          <button
            onClick={stopp}
            className="text-sm rounded-lg px-3 py-1.5 border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)]"
          >
            ⏹ Vorführung beenden
          </button>
        </div>
      </div>
    </div>
  );
}
