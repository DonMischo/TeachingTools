"use client";
/**
 * Was alle Stufen wissen müssen, ohne dass jede es als Prop durchreicht:
 *
 *   pruefung — Prüfungsmodus: keine Vorführung, »Weiter« heißt Überspringen
 *   hilfe    — Hilfsmodus: größere Ziele, mehr Zeit (Schalter im Werkzeug,
 *              bewusst ohne Nachteilsausgleich-Daten — die sind
 *              Gesundheitsdaten und gehören nicht ins Kinder-Werkzeug)
 *   handy    — Teil 4: Android oder iPhone (iOS), umschaltbar in jeder Stufe
 */
import { createContext, useContext } from "react";
import type { HandySystem } from "@/lib/maus/mobil";

export type { HandySystem };

export type MausRahmen = {
  pruefung: boolean;
  hilfe: boolean;
  handy: HandySystem;
  setHandy: (h: HandySystem) => void;
};

export const MausKontext = createContext<MausRahmen>({ pruefung: false, hilfe: false, handy: "android", setHandy: () => {} });

export function useMausKontext(): MausRahmen {
  return useContext(MausKontext);
}

/** Im Hilfsmodus: so viel mehr Zeit … */
export const HILFE_ZEIT = 1.6;
/** … und so viel breitere Wege bzw. größere Ziele. */
export const HILFE_GROESSE = 1.5;
