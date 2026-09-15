/**
 * Reine Hilfsfunktionen für Teil 3 · Aussehen & Bedienhilfe.
 *
 * »Ziel …«-Funktionen wählen ausgehend vom Aussehen zu Beginn der Stufe ein
 * Ziel, das sich vom aktuellen Wert unterscheidet — jede Aufgabe soll eine
 * echte Änderung verlangen. »… erreicht«-Funktionen prüfen, ob das Kind das
 * Ziel getroffen hat.
 */
import { AKZENTE, HINTERGRUENDE, type Aussehen, type ZeigerFarbe } from "./windows";

export function zielHintergrund(start: Aussehen, zufall: () => number = Math.random): string {
  const andere = HINTERGRUENDE.filter(h => h.id !== start.hintergrund);
  return andere[Math.floor(zufall() * andere.length)].id;
}

export function zielAkzent(start: Aussehen, zufall: () => number = Math.random): string {
  const andere = AKZENTE.filter(a => a.id !== start.akzent);
  return andere[Math.floor(zufall() * andere.length)].id;
}

export function gegenModus(start: Aussehen): boolean {
  return !start.dunkel;
}

/** Bevorzugt gelb oder bunt — die auffälligsten Farben. */
export function zielZeigerFarbe(start: Aussehen): ZeigerFarbe {
  const bevorzugt: ZeigerFarbe[] = ["gelb", "bunt"];
  const wahl = bevorzugt.find(f => f !== start.zeigerFarbe);
  if (wahl) return wahl;
  const alle: ZeigerFarbe[] = ["weiss", "schwarz", "gelb", "bunt"];
  return alle.find(f => f !== start.zeigerFarbe)!;
}

export function hintergrundGewaehlt(aussehen: Aussehen, ziel: string): boolean {
  return aussehen.hintergrund === ziel;
}

export function modusGewaehlt(aussehen: Aussehen, zielDunkel: boolean): boolean {
  return aussehen.dunkel === zielDunkel;
}

export function akzentGewaehlt(aussehen: Aussehen, ziel: string): boolean {
  return aussehen.akzent === ziel;
}

/** Größer als zu Beginn UND mindestens Stufe 3. */
export function zeigerGroesseGenug(aussehen: Aussehen, startGroesse: number): boolean {
  return aussehen.zeigerGroesse >= 3 && aussehen.zeigerGroesse > startGroesse;
}

export function zeigerFarbeGewaehlt(aussehen: Aussehen, ziel: ZeigerFarbe): boolean {
  return aussehen.zeigerFarbe === ziel;
}

export function textGroesseGenug(aussehen: Aussehen): boolean {
  return aussehen.textGroesse >= 150;
}

/**
 * Profilbild-Ziel: das eigene Tier des Kindes — ist es schon das Profilbild,
 * dann ein anderes, das die Aufgabe beim Namen nennt.
 */
export function zielProfilTier(start: Aussehen, eigenesTier: string, tiere: string[], zufall: () => number = Math.random): string {
  if (start.profilTier !== eigenesTier) return eigenesTier;
  const andere = tiere.filter(t => t !== eigenesTier);
  return andere[Math.floor(zufall() * andere.length)];
}

/** Die Begrüßung zählt, wenn etwas drinsteht und es nicht die alte ist. */
export function begruessungGeaendert(aussehen: Aussehen, start: Aussehen): boolean {
  return aussehen.begruessung.trim() !== "" && aussehen.begruessung !== start.begruessung;
}
