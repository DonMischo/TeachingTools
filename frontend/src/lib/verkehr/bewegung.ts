/**
 * Wie sich die Spielfigur bewegt: bildschirmbezogen (hoch = nach Norden), acht
 * Richtungen, Blick in Laufrichtung. Häuser sind fest.
 */
import type { Stadt } from "./stadt";

/** Tempo in m/s — Gehen wie ein Kind, Rennen wie ein Kind, das es eilig hat. */
export const GEHEN = 1.5;
export const RENNEN = 4;
/** Halbe Schulterbreite: so nah darf die Figur an eine Hauswand. */
export const FIGUR_RADIUS = 0.3;

export type Figur = { x: number; y: number; winkel: number; tempo: number };
export type Eingabe = {
  hoch: boolean; runter: boolean; links: boolean; rechts: boolean; rennen: boolean;
  /** Stick am Handy: Richtung und Stärke (Länge bis 1). Hat Vorrang vor den Tasten. */
  stick?: { x: number; y: number };
};

export const KEINE_EINGABE: Eingabe = { hoch: false, runter: false, links: false, rechts: false, rennen: false };

export function schritt(f: Figur, e: Eingabe, dt: number, stadt: Stadt): Figur {
  const analog = e.stick && Math.hypot(e.stick.x, e.stick.y) > 0.15;
  const dx = analog ? e.stick!.x : (e.rechts ? 1 : 0) - (e.links ? 1 : 0);
  const dy = analog ? e.stick!.y : (e.runter ? 1 : 0) - (e.hoch ? 1 : 0);
  if (!dx && !dy) return { ...f, tempo: 0 };
  const laenge = Math.hypot(dx, dy);
  // Am Stick: weit ausgelenkt = rennen, wenig = langsam gehen.
  const tempo = analog ? (laenge > 0.95 || e.rennen ? RENNEN : GEHEN * Math.min(1, laenge / 0.8)) : e.rennen ? RENNEN : GEHEN;
  const [x, y] = stadt.ausHaeusern(f.x + (dx / laenge) * tempo * dt, f.y + (dy / laenge) * tempo * dt, FIGUR_RADIUS);
  return { x, y, winkel: Math.atan2(dy, dx), tempo };
}

/** Tastenbelegung: Pfeile und WASD, Umschalt zum Rennen. */
export function eingabeAusTasten(gedrueckt: ReadonlySet<string>): Eingabe {
  const hat = (...codes: string[]) => codes.some((c) => gedrueckt.has(c));
  return {
    hoch: hat("ArrowUp", "KeyW"),
    runter: hat("ArrowDown", "KeyS"),
    links: hat("ArrowLeft", "KeyA"),
    rechts: hat("ArrowRight", "KeyD"),
    rennen: hat("ShiftLeft", "ShiftRight"),
  };
}
