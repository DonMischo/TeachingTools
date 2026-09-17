"use client";
/**
 * Die Uhr des Labors.
 *
 * Ein fester Zeitschritt (240 Hz), entkoppelt von der Bildrate: gerechnet
 * wird immer in gleich großen Schritten, gezeichnet wird, wann der Browser
 * mag. Ohne das hinge jedes Messergebnis daran, wie schnell gerade das Gerät
 * ist — und dieselbe Pendelmessung käme auf dem Tablet anders heraus als am
 * Smartboard.
 *
 * Gezeichnet wird über `beobachte`, nicht über React-Zustand: ein `setState`
 * je Bild würde das ganze Labor samt Werkbank neu rendern, 60-mal in der
 * Sekunde. Die Messgeräte holen sich ihre Werte stattdessen selbst aus dem
 * Bus, wenn sie gerufen werden.
 */
import { useCallback, useEffect, useRef } from "react";
import { Messbus } from "@/lib/physik/messbus";
import { DT, leererZustand, schritt, type LaborZustand } from "@/lib/physik/rechenwerke";
import type { Szene } from "@/lib/physik/typen";

export function useSimulation(szene: Szene, laeuft: boolean, tempo: number) {
  const bus = useRef<Messbus>(null as unknown as Messbus);
  if (bus.current === null) bus.current = new Messbus();
  const zustand = useRef<LaborZustand>(leererZustand());
  const zuschauer = useRef(new Set<() => void>());

  // Der Schritt liest immer den neuesten Aufbau, ohne dafür die Schleife
  // neu zu starten — sonst setzte jedes Verschieben eines Geräts die Uhr aus.
  const szeneRef = useRef(szene);
  szeneRef.current = szene;

  /** Meldet eine Zeichenroutine an; gibt das Abmelden zurück. */
  const beobachte = useCallback((fn: () => void) => {
    const menge = zuschauer.current;
    menge.add(fn);
    return () => { menge.delete(fn); };
  }, []);

  useEffect(() => {
    if (!laeuft) return;
    let id = 0;
    let vorher = performance.now();
    let rest = 0;

    const rahmen = (jetzt: number) => {
      // Nach einem Wechsel des Reiters liegen Minuten dazwischen. Die Zeit
      // wird gekappt, sonst rechnet das Labor stundenlang nach.
      const vergangen = Math.min(0.25, (jetzt - vorher) / 1000);
      vorher = jetzt;
      rest += vergangen * tempo;

      let schritte = 0;
      while (rest >= DT && schritte < 240) {
        const ergebnis = schritt(szeneRef.current, zustand.current, DT);
        zustand.current = ergebnis.zustand;
        bus.current.schreibe(ergebnis.zustand.t, ergebnis.werte);
        rest -= DT;
        schritte++;
      }
      if (rest > DT) rest = 0; // aufgeben statt aufholen

      for (const fn of zuschauer.current) fn();
      id = requestAnimationFrame(rahmen);
    };

    id = requestAnimationFrame(rahmen);
    return () => cancelAnimationFrame(id);
  }, [laeuft, tempo]);

  const zuruecksetzen = useCallback(() => {
    bus.current.leere();
    zustand.current = leererZustand();
    for (const fn of zuschauer.current) fn();
  }, []);

  return { bus: bus.current, zustand, beobachte, zuruecksetzen };
}
