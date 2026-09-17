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
import { Welt, type Stoss } from "@/lib/physik/welt";
import { DT, leererZustand, schritt, type LaborZustand } from "@/lib/physik/rechenwerke";
import type { Szene } from "@/lib/physik/typen";

export function useSimulation(
  szene: Szene,
  laeuft: boolean,
  tempo: number,
  /** Wird nach einem Schritt mit den Zusammenstößen gerufen, die er brachte. */
  beiStoss?: (stoesse: Stoss[], zustand: LaborZustand) => void,
) {
  const bus = useRef<Messbus>(null as unknown as Messbus);
  if (bus.current === null) bus.current = new Messbus();
  const zustand = useRef<LaborZustand>(leererZustand());
  const welt = useRef<Welt>(null as unknown as Welt);
  if (welt.current === null) welt.current = new Welt();
  const stoesse = useRef<Stoss[]>([]);
  const zuschauer = useRef(new Set<() => void>());

  // Der Schritt liest immer den neuesten Aufbau, ohne dafür die Schleife
  // neu zu starten — sonst setzte jedes Verschieben eines Geräts die Uhr aus.
  const szeneRef = useRef(szene);
  szeneRef.current = szene;

  // Über ein Ref, damit ein neuer Rückruf die Schleife nicht neu startet.
  const meldung = useRef(beiStoss);
  meldung.current = beiStoss;

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
        // Erst die Welt (Fallen, Stapeln, Stöße), dann die Messwerte — so
        // beschreiben beide denselben Augenblick.
        welt.current.synchronisiere(szeneRef.current, zustand.current.mechanik);
        welt.current.schritt(szeneRef.current, zustand.current.mechanik, DT);
        const neueStoesse = welt.current.ereignisse();
        if (neueStoesse.length) stoesse.current = [...stoesse.current, ...neueStoesse].slice(-40);

        const ergebnis = schritt(szeneRef.current, zustand.current, DT, welt.current.zustand());
        zustand.current = ergebnis.zustand;

        // Erst melden, wenn der Zustand steht — sonst beschreibt der Bericht
        // den Augenblick vor dem Stoß.
        if (neueStoesse.length) meldung.current?.(neueStoesse, zustand.current);
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

  /**
   * Ein Gerät neu loslassen — ohne Angabe alle.
   *
   * Der Zustand wird schlicht vergessen; der nächste Schritt setzt das Gerät
   * dann wieder auf seine Startauslenkung. Gebraucht wird das, sobald ein
   * gedämpftes Pendel ausgeschwungen ist: ohne das bliebe es für immer stehen,
   * und man müsste es erst verstellen, um es wieder in Gang zu bringen.
   */
  const loslassen = useCallback((id?: string) => {
    const alt = zustand.current.mechanik;
    zustand.current = {
      ...zustand.current,
      mechanik: id === undefined
        ? {}
        : Object.fromEntries(Object.entries(alt).filter(([k]) => k !== id)),
    };
    for (const fn of zuschauer.current) fn();
  }, []);

  const zuruecksetzen = useCallback(() => {
    bus.current.leere();
    zustand.current = leererZustand();
    welt.current.zuruecksetzen(szeneRef.current, {});
    stoesse.current = [];
    for (const fn of zuschauer.current) fn();
  }, []);

  /** Setzt einen freien Körper an die Hand des Ziehenden. */
  const setzeKoerper = useCallback((id: string, pos: { x: number; y: number }) => {
    welt.current.setzeOrt(id, pos);
  }, []);

  return { bus: bus.current, zustand, beobachte, zuruecksetzen, loslassen, setzeKoerper, stoesse };
}
