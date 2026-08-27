"use client";
/**
 * Tasteneingabe für die Schreibübung und ihre Spiele.
 *
 * Alle Modi lesen die Tastatur gleich, und genau das ist der Grund für diesen
 * Hook: Die Regeln, was *nicht* als Anschlag zählt (Browser-Kürzel, AltGr,
 * Tottasten), dürfen zwischen Lektion und Spiel nicht auseinanderlaufen.
 *
 * Getippt wird auf ein fokussierbares Element statt in ein Eingabefeld — ein
 * echtes Feld hätte einen Inhalt, den man korrigieren könnte, und genau das
 * soll die Fehlersperre verhindern.
 */
import { useCallback, useEffect, useRef, useState } from "react";

export function useTippEingabe(onZeichen: (zeichen: string) => void) {
  const [gedrueckt, setGedrueckt] = useState<ReadonlySet<string>>(new Set());
  const [fokus, setFokus] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Der Handler wechselt bei jedem Rendern; die Callbacks unten sollen deshalb
  // stabil bleiben und immer den frischesten aufrufen.
  const zeichenRef = useRef(onZeichen);
  useEffect(() => { zeichenRef.current = onZeichen; }, [onZeichen]);

  useEffect(() => { ref.current?.focus(); }, []);

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    setGedrueckt(prev => new Set(prev).add(e.code));

    // Tastenkürzel des Browsers bleiben dem Browser. AltGr meldet sich unter
    // Windows als Strg+Alt — auch das gehört nicht hierher.
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    // Tabulator gibt den Fokus weiter, das darf er.
    if (e.key === "Tab") return;
    // Tottasten (^ ` ´) erzeugen erst mit dem nächsten Zeichen etwas.
    if (e.key === "Dead" || e.key.length !== 1) {
      e.preventDefault();
      return;
    }

    e.preventDefault();
    zeichenRef.current(e.key);
  }, []);

  const onKeyUp = useCallback((e: React.KeyboardEvent) => {
    setGedrueckt(prev => {
      const next = new Set(prev);
      next.delete(e.code);
      return next;
    });
  }, []);

  const feldProps = {
    ref,
    tabIndex: 0,
    role: "textbox" as const,
    onKeyDown,
    onKeyUp,
    onFocus: () => setFokus(true),
    onBlur: () => { setFokus(false); setGedrueckt(new Set()); },
  };

  return { gedrueckt, fokus, feldProps, fokussieren: () => ref.current?.focus() };
}
