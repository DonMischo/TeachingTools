/**
 * Wassermodell des Stromkreises: Fass auf dem Turm (Quelle), weite Rohre
 * (Leiter), Ventile als Engstellen (Widerstände), Rückrohr zurück zur Pumpe.
 *
 * Gerechnet wird elektrisch, gezeigt wird beides. Maßstab der Analogie:
 * 1 m Höhe ≙ 1 V, 1 L/s Durchfluss ≙ 1 A, Druckverlust in m ≙ Spannungsfall in V.
 * Die Pumpe am Turmfuß hält den Wasserstand — sie ist das, was die Batterie
 * für die Ladungen tut.
 */

export type Aufbau = "einzeln" | "reihe" | "parallel";

export interface WasserEinstellung {
  aufbau: Aufbau;
  /** Höhe des Fasses über dem Rückrohr in m ≙ Spannung U in V. */
  hoehe: number;
  /** Engstellen in Ω (Ventil 2 nur bei Reihe/Parallel). */
  ventil1: number;
  ventil2: number;
  /** Rohrdicke 1 (dünn) … 4 (dick). */
  rohr: number;
  /** Rückrohr offen (Kreis geschlossen) oder abgesperrt. */
  geschlossen: boolean;
}

/** Relative Länge der Leitungsstücke: Zuleitung, Ableitung, Rückrohr samt Steigrohr. */
export const LAENGEN = { zu: 1, ab: 1, rueck: 2 } as const;

/** Widerstand eines Leitungsstücks: R = ρ·l/A, mit A ∝ d². */
export function leitungsWiderstand(rohr: number, laenge: number): number {
  return (0.5 * laenge) / (rohr * rohr);
}

export interface WasserZustand {
  rZu: number; rAb: number; rRueck: number;
  /** Ersatzwiderstand der Ventile und des ganzen Kreises. */
  rVentile: number; rGesamt: number;
  /** Strom im Hauptkreis und in den Ventilen. */
  strom: number; i1: number; i2: number;
  /** Spannungsfälle. */
  u1: number; u2: number; uZu: number; uAb: number; uRueck: number;
  /** Potenziale (Druck) entlang des Kreises, 0 = Pumpeneingang. */
  phi: { quelle: number; vor: number; mitte: number; nach: number; fass: number };
  /** Leistungen in W: Quelle und Ventile. */
  pQuelle: number; p1: number; p2: number;
}

export function rechne(e: WasserEinstellung): WasserZustand {
  const U = e.hoehe;
  const rZu = leitungsWiderstand(e.rohr, LAENGEN.zu);
  const rAb = leitungsWiderstand(e.rohr, LAENGEN.ab);
  const rRueck = leitungsWiderstand(e.rohr, LAENGEN.rueck);
  const R1 = e.ventil1, R2 = e.ventil2;
  const rVentile = e.aufbau === "einzeln" ? R1 : e.aufbau === "reihe" ? R1 + R2 : (R1 * R2) / (R1 + R2);
  const rGesamt = rZu + rVentile + rAb + rRueck;
  const strom = e.geschlossen ? U / rGesamt : 0;

  const uZu = strom * rZu, uAb = strom * rAb, uRueck = strom * rRueck;
  const uBlock = strom * rVentile;
  let i1 = strom, i2 = 0, u1 = uBlock, u2 = 0;
  if (e.aufbau === "reihe") { i2 = strom; u1 = strom * R1; u2 = strom * R2; }
  if (e.aufbau === "parallel") { i1 = uBlock / R1; i2 = uBlock / R2; u1 = uBlock; u2 = uBlock; }

  const vor = U - uZu;
  const nach = vor - uBlock;
  // Steht das Wasser (Sperre zu), ist strom = 0: bis zur Sperre überall der volle Druck U.
  const fass = nach - uAb;
  return {
    rZu, rAb, rRueck, rVentile, rGesamt,
    strom, i1, i2, u1, u2, uZu, uAb, uRueck,
    phi: { quelle: U, vor, mitte: vor - (e.aufbau === "reihe" ? u1 : uBlock / 2), nach, fass },
    pQuelle: U * strom, p1: u1 * i1, p2: u2 * i2,
  };
}
