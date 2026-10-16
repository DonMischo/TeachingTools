/**
 * Ein- und Aussteigen an Bus, Straßenbahn und Zug: wann welche Tür offen ist,
 * wo die Aussteigenden laufen und wo man stehen soll. Alles aus der Zeit seit
 * dem Anhalten gerechnet — gleiche Zeit, gleiches Bild auf jedem Rechner.
 */
import type { P } from "./geometrie";

export type TuerPhase = "zu" | "aussteigen" | "einsteigen" | "schliessen";

/** Ablauf eines Halts in Sekunden seit dem Stillstand. */
export const HALT = { oeffnen: 1.5, aussteigen: 6, einsteigen: 12, schliessen: 2.5 } as const;
export const HALT_DAUER = HALT.oeffnen + HALT.aussteigen + HALT.einsteigen + HALT.schliessen;

/** `dauer`: wie lange der Halt dauert — wer zu früh ist, wartet mit offenen Türen bis zur Abfahrtszeit. */
export function tuerPhase(alter: number, dauer: number = HALT_DAUER): TuerPhase {
  if (alter < HALT.oeffnen) return "zu";
  if (alter < HALT.oeffnen + HALT.aussteigen) return "aussteigen";
  if (alter < dauer - HALT.schliessen) return "einsteigen";
  if (alter < dauer) return "schliessen";
  return "zu";
}

/** Breite einer Tür und Tiefe des Streifens davor, der für Aussteigende frei bleiben muss. */
export const TUER_BREITE = 1.3;
export const KORRIDOR_TIEFE = 2.5;

export type Tuer = {
  /** Mitte der Tür an der Außenkante des Fahrzeugs. */
  p: P;
  /** Richtung nach draußen (Einheitsvektor). */
  raus: P;
  /** Richtung längs des Fahrzeugs (Einheitsvektor). */
  laengs: P;
};

/**
 * Türen eines Fahrzeugs: `lagen` sind die Abstände der Türmitten von der
 * Fahrzeugmitte längs, `seite` +1 = rechts in Fahrtrichtung.
 */
export function tueren(x: number, y: number, winkel: number, breite: number, lagen: number[], seite: 1 | -1 = 1): Tuer[] {
  const c = Math.cos(winkel), s = Math.sin(winkel);
  const raus: P = [-s * seite, c * seite];
  return lagen.map((l) => ({
    p: [x + c * l + raus[0] * (breite / 2), y + s * l + raus[1] * (breite / 2)],
    raus,
    laengs: [c, s],
  }));
}

/** Lage eines Punktes zur Tür: `quer` nach draußen, `laengs` entlang des Fahrzeugs. */
export function relativZurTuer(t: Tuer, x: number, y: number) {
  const dx = x - t.p[0], dy = y - t.p[1];
  return { quer: dx * t.raus[0] + dy * t.raus[1], laengs: dx * t.laengs[0] + dy * t.laengs[1] };
}

/** Steht der Punkt im Streifen vor der Tür, den Aussteigende brauchen? */
export function imKorridor(t: Tuer, x: number, y: number): boolean {
  const { quer, laengs } = relativZurTuer(t, x, y);
  return quer > -0.2 && quer < KORRIDOR_TIEFE && Math.abs(laengs) < TUER_BREITE / 2 + 0.3;
}

/** Richtig warten: seitlich neben der Tür, nah genug zum Einsteigen, nicht im Streifen. */
export function seitlichDaneben(t: Tuer, x: number, y: number): boolean {
  const { quer, laengs } = relativZurTuer(t, x, y);
  return !imKorridor(t, x, y) && quer > 0 && quer < 2.5 && Math.abs(laengs) >= TUER_BREITE / 2 + 0.3 && Math.abs(laengs) < 3;
}

/** Nah genug an der offenen Tür, um einzusteigen. */
export function anDerTuer(t: Tuer, x: number, y: number): boolean {
  const { quer, laengs } = relativZurTuer(t, x, y);
  return quer > -0.3 && quer < 0.7 && Math.abs(laengs) < TUER_BREITE / 2;
}

/** Wie viele steigen an dieser Tür aus (0–2), fest aus Fahrzeug, Halt und Tür. */
export function aussteigerZahl(fahrzeug: number, halt: number, tuer: number): number {
  const h = Math.imul(fahrzeug * 73856093 ^ halt * 19349663 ^ tuer * 83492791, 2654435761) >>> 0;
  return h % 3;
}

/**
 * Wo steht der k-te Aussteigende `alter` Sekunden nach dem Anhalten? `null`,
 * solange er drinnen ist oder schon weg. Erst 2,5 m gerade hinaus, dann zur Seite.
 */
export function aussteigerLage(t: Tuer, k: number, alter: number): P | null {
  const los = HALT.oeffnen + 0.3 + k * 1.4;
  const a = alter - los;
  if (a < 0 || a > 5) return null;
  const hinaus = Math.min(a, 1.8) / 1.8 * 2.5;
  const seitwaerts = Math.max(0, a - 1.8) * 1.4 * (k % 2 ? 1 : -1);
  return [t.p[0] + t.raus[0] * hinaus + t.laengs[0] * seitwaerts, t.p[1] + t.raus[1] * hinaus + t.laengs[1] * seitwaerts];
}
