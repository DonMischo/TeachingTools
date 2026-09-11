/**
 * Stufe »Scrollen«: eine lange senkrechte Liste und ein waagrechter Streifen.
 *
 * Die Zeilen/Spalten entstehen deterministisch aus den Avataren — kein
 * Zufall, damit dieselbe Liste bei jedem Aufruf entsteht und Ziele fest
 * stehen.
 */
import { AVATARS } from "@/components/AvatarPicker";
import { tierName } from "./tiere";

export type Eintrag = { index: number; tier: string; name: string; label: string };

/** Anzahl der Zeilen in der senkrechten Liste. */
export const ANZAHL_ZEILEN = 80;
/** Anzahl der Bilder im waagrechten Streifen. */
export const ANZAHL_SPALTEN = 20;

/** Ziel-Zeile für Aufgabe 1 (Mausrad) — etwa Zeile 40. */
export const ZIEL_RAD = 39;
/** Ziel-Zeile für Aufgabe 2 (Scrollleiste) — nahe dem Ende. */
export const ZIEL_LEISTE = ANZAHL_ZEILEN - 3;
/** Ziel-Spalte für Aufgabe 4 (waagrecht) — ganz rechts. */
export const ZIEL_QUER = ANZAHL_SPALTEN - 1;

function eintraege(anzahl: number): Eintrag[] {
  return Array.from({ length: anzahl }, (_, i) => {
    const tier = AVATARS[i % AVATARS.length].id;
    const name = tierName(tier);
    return { index: i, tier, name, label: `${name} Nr. ${i + 1}` };
  });
}

/** Die senkrechte Liste. */
export function zeilen(): Eintrag[] {
  return eintraege(ANZAHL_ZEILEN);
}

/** Der waagrechte Streifen — eigene Reihenfolge, damit die Namen sich unterscheiden. */
export function spalten(): Eintrag[] {
  return eintraege(ANZAHL_SPALTEN).map(e => ({
    ...e,
    tier: AVATARS[(e.index + 7) % AVATARS.length].id,
    name: tierName(AVATARS[(e.index + 7) % AVATARS.length].id),
    label: `${tierName(AVATARS[(e.index + 7) % AVATARS.length].id)} Nr. ${e.index + 1}`,
  }));
}

/** Womit wurde gescrollt: dem Mausrad, der Scrollleiste — oder gar nicht? */
export function scrollArt(radEreignisse: number, scrollWeg: number): "rad" | "leiste" | "keins" {
  if (radEreignisse > 0) return "rad";
  if (scrollWeg > 0) return "leiste";
  return "keins";
}
