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
 * Die Uhr läuft nur im Versuch. Im Bauen steht alles still: nichts fällt,
 * nichts stößt an, und jedes Gerät bleibt genau dort, wo man es hinstellt —
 * auch in der Luft. Ein Versuch beginnt immer beim festgehaltenen Aufbau;
 * `durchlauf` zählt die Starts, und jeder neue setzt Welt, Uhr und Messbus
 * zurück.
 *
 * Gezeichnet wird über `beobachte`, nicht über React-Zustand: ein `setState`
 * je Bild würde das ganze Labor samt Werkbank neu rendern, 60-mal in der
 * Sekunde. Die Messgeräte holen sich ihre Werte stattdessen selbst aus dem
 * Bus, wenn sie gerufen werden.
 */
import { useCallback, useEffect, useRef } from "react";
import { Messbus } from "@/lib/physik/messbus";
import { Welt, type Stoss } from "@/lib/physik/welt";
import { DT, leererZustand, schritt, ueberlastet, type LaborZustand } from "@/lib/physik/rechenwerke";
import type { Szene } from "@/lib/physik/typen";

export function useSimulation(
  szene: Szene,
  /** Versuch statt Bauen: nur dann gibt es eine Welt und eine Uhr. */
  versuch: boolean,
  laeuft: boolean,
  tempo: number,
  /** Wird nach einem Schritt mit den Zusammenstößen gerufen, die er brachte. */
  beiStoss?: (stoesse: Stoss[], zustand: LaborZustand) => void,
  /** Wird gerufen, wenn eine Materialprobe ihre Zugfestigkeit überschreitet. */
  beiBruch?: (proben: string[], zustand: LaborZustand) => void,
  /** Zählt die Versuchsstarts; ein neuer Wert beginnt beim Aufbau von vorn. */
  durchlauf = 0,
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
  const rissMeldung = useRef(beiBruch);
  rissMeldung.current = beiBruch;

  /** Meldet eine Zeichenroutine an; gibt das Abmelden zurück. */
  const beobachte = useCallback((fn: () => void) => {
    const menge = zuschauer.current;
    menge.add(fn);
    return () => { menge.delete(fn); };
  }, []);

  // Jeder Wechsel zwischen Bauen und Versuch, und jeder Neustart, beginnt
  // bei null: im Bauen gibt es gar keine Körper, im Versuch entstehen sie
  // frisch aus dem Aufbau.
  useEffect(() => {
    bus.current.leere();
    zustand.current = leererZustand();
    stoesse.current = [];
    if (versuch) {
      welt.current.zuruecksetzen(szeneRef.current, {});
      zustand.current = { ...zustand.current, welt: welt.current.zustand() };
    } else {
      welt.current.leere();
    }
    for (const fn of zuschauer.current) fn();
  }, [versuch, durchlauf]);

  useEffect(() => {
    if (!versuch || !laeuft) return;
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

        // Im realen Modell führt das Drehgelenk, nicht die Differential-
        // gleichung: der Winkel kommt dann aus der Lage des Körpers zurück.
        const vomGelenk = welt.current.abgeleitet(szeneRef.current, zustand.current.mechanik);
        for (const id in vomGelenk) {
          zustand.current = {
            ...zustand.current,
            mechanik: { ...zustand.current.mechanik, [id]: vomGelenk[id] },
          };
        }

        // Erst melden, wenn der Zustand steht — sonst beschreibt der Bericht
        // den Augenblick vor dem Stoß.
        if (neueStoesse.length) meldung.current?.(neueStoesse, zustand.current);

        const gerissen = ueberlastet(szeneRef.current, zustand.current.mechanik);
        if (gerissen.length) rissMeldung.current?.(gerissen, zustand.current);
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
  }, [versuch, laeuft, tempo]);

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

  /**
   * Bringt Welt und Anzeige auf den neuesten Stand, ohne die Zeit laufen zu
   * lassen.
   *
   * Gebraucht wird das im angehaltenen Zustand: dort dreht sich die Schleife
   * nicht, also wird weder der Weltstand aufgefrischt noch neu gezeichnet —
   * ein gezogenes Gewicht sprang deshalb sichtbar an seinen alten Platz
   * zurück, obwohl es längst woanders lag.
   */
  const aktualisiere = useCallback(() => {
    // Im Bauen gibt es keine Welt: gezeichnet wird, was in der Szene steht.
    if (versuch) {
      welt.current.synchronisiere(szeneRef.current, zustand.current.mechanik);
      zustand.current = { ...zustand.current, welt: welt.current.zustand() };
    }
    for (const fn of zuschauer.current) fn();
  }, [versuch]);

  // Angehalten trotzdem mitbekommen, was sich am Aufbau ändert.
  useEffect(() => {
    if (!versuch || !laeuft) aktualisiere();
  }, [szene, versuch, laeuft, aktualisiere]);

  /**
   * Gibt einem Körper ein Tempo — der Abschuss.
   *
   * Der übergebene Aufbau wird dabei zuerst in die Welt gebracht. Solange das
   * Geschoss auf dem Lager liegt, hat es nämlich gar keinen eigenen Körper —
   * es ist Teil seines Wirts. Ohne diesen Schritt ginge der Stoß ins Leere,
   * weil React den gelösten Aufbau erst im nächsten Bild einspielt.
   */
  const gibTempo = useCallback((id: string, vx: number, vy: number, aufbau?: Szene) => {
    if (aufbau) {
      szeneRef.current = aufbau;
      welt.current.synchronisiere(aufbau, zustand.current.mechanik);
    }
    welt.current.gibTempo(id, vx, vy);
    zustand.current = { ...zustand.current, welt: welt.current.zustand() };
  }, []);

  /** Setzt einen freien Körper an die Hand des Ziehenden. */
  const setzeKoerper = useCallback((id: string, pos: { x: number; y: number }) => {
    if (versuch) welt.current.setzeOrt(id, pos);
    aktualisiere();
  }, [versuch, aktualisiere]);

  /**
   * Die Hand im Versuch: greifen, führen, loslassen.
   *
   * Läuft die Uhr, zieht ein Federgriff den Körper mit — er bleibt dabei ein
   * Körper unter anderen und fliegt mit Schwung weiter. Angehalten wird er
   * einfach versetzt, denn ohne Uhr gäbe es niemanden, der ihn zieht.
   */
  const greifbar = useCallback((id: string) => versuch && welt.current.greifbar(id), [versuch]);
  const greife = useCallback((id: string, punkt: { x: number; y: number }) => {
    if (!versuch) return false;
    return laeuft ? welt.current.greife(id, punkt) : welt.current.greifbar(id);
  }, [versuch, laeuft]);
  const ziehe = useCallback((id: string, punkt: { x: number; y: number }) => {
    if (laeuft) welt.current.ziehe(punkt);
    else setzeKoerper(id, punkt);
  }, [laeuft, setzeKoerper]);
  const lasse = useCallback(() => welt.current.lasse(), []);

  return {
    bus: bus.current, zustand, beobachte, loslassen, setzeKoerper, gibTempo, aktualisiere, stoesse,
    greifbar, greife, ziehe, lasse,
  };
}
