"use client";
/**
 * Ein Lauf bis zum Abschluss: eigene Figur und NPC Woche für Woche, mit
 * Höchstwerten und Änderung der letzten Woche für die Bühne. Klasse, Profil
 * und Plan können während des Laufs wechseln — die Werte bleiben, nur die
 * Verteilung der Zeit ändert sich.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ABSCHLUSS, KLASSEN, NEUTRAL, WERTE, startZustand, werte, woche,
  type KlasseId, type Plan, type Profil, type Wert, type Zustand,
} from "@/lib/mainCharacter";
import type { BuehnenWerte } from "./Buehne";

export const TAKT_MS = 170;

const null5 = (): Record<Wert, number> => ({ W: 0, Z: 0, S: 0, M: 0, E: 0 });

export function useLauf({ klasse, profil = NEUTRAL, plan, onWoche }: {
  klasse: KlasseId;
  profil?: Profil;
  /** eigener Wochenplan; ohne ihn gilt der Plan der Klasse */
  plan?: Plan;
  /** nach jeder Woche (z. B. Stand in die Sitzung melden) */
  onWoche?: (z: Zustand) => void;
}) {
  const ich = useRef<Zustand>(startZustand(KLASSEN[klasse].start, profil.baustellen));
  const npc = useRef<Zustand>(startZustand(KLASSEN.npc.start));
  const spitzen = useRef<Record<Wert, number>>(werte(ich.current));
  const delta = useRef<Record<Wert, number>>(null5());
  const [, setVersion] = useState(0);
  const [laeuft, setLaeuft] = useState(false);
  // aktuelle Eingaben für den Takt, ohne ihn neu zu starten
  const eingabe = useRef({ klasse, profil, plan, onWoche });
  eingabe.current = { klasse, profil, plan, onWoche };

  const neu = useCallback(() => {
    const { klasse: k, profil: p } = eingabe.current;
    ich.current = startZustand(KLASSEN[k].start, p.baustellen);
    npc.current = startZustand(KLASSEN.npc.start);
    spitzen.current = werte(ich.current);
    delta.current = null5();
    setLaeuft(false);
    setVersion(v => v + 1);
  }, []);

  const schritt = useCallback(() => {
    const { klasse: k, profil: p, plan: pl, onWoche: cb } = eingabe.current;
    if (ich.current.woche >= ABSCHLUSS) { setLaeuft(false); return; }
    const vorher = werte(ich.current);
    woche(ich.current, KLASSEN[k], p, pl);
    woche(npc.current, KLASSEN.npc);
    const nachher = werte(ich.current);
    for (const w of WERTE) {
      delta.current[w] = nachher[w] - vorher[w];
      spitzen.current[w] = Math.max(spitzen.current[w], nachher[w]);
    }
    setVersion(v => v + 1);
    cb?.(ich.current);
    if (ich.current.woche >= ABSCHLUSS) setLaeuft(false);
  }, []);

  useEffect(() => {
    if (!laeuft) return;
    const t = setInterval(schritt, TAKT_MS);
    return () => clearInterval(t);
  }, [laeuft, schritt]);

  // Baustellen, die im Charakterbogen dazukommen oder wegfallen, vor dem Start übernehmen
  const baustellenKey = profil.baustellen.join(",");
  useEffect(() => {
    if (ich.current.woche === 0) neu();
  }, [baustellenKey, klasse, neu]);

  const umschalten = useCallback(() => {
    if (ich.current.woche >= ABSCHLUSS) { neu(); setLaeuft(true); return; }
    setLaeuft(l => !l);
  }, [neu]);

  const stand: BuehnenWerte = {
    werte: werte(ich.current), npc: werte(npc.current), spitzen: { ...spitzen.current }, delta: { ...delta.current },
  };
  return { stand, ich: ich.current, npc: npc.current, laeuft, umschalten, neu, schritt, fertig: ich.current.woche >= ABSCHLUSS };
}
