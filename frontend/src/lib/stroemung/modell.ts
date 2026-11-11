/**
 * Ein Rohrnetz, wie es die Stationen und der Baukasten von »Druck & Strömung«
 * beschreiben. Alles in SI: Pa (Überdruck gegen die Luft), m, m³/s, N.
 *
 * Knoten haben eine Höhe z — der Löser rechnet mit dem Gesamtdruck
 * P = p + ρ·g·z, damit ruhendes Wasser unten von selbst mehr Druck hat.
 * Teile verbinden zwei Knoten (`a` → `b`) oder hängen an einem (`a`).
 */

export type Medium = "wasser" | "oel" | "luft";

export const MEDIEN: Record<Medium, { name: string; dichte: number; zaehigkeit: number }> = {
  wasser: { name: "Wasser", dichte: 1000, zaehigkeit: 1.0e-3 },
  /** Zähes Hydrauliköl: strömt in Rohren laminar — dort gilt Hagen-Poiseuille (r⁴). */
  oel: { name: "Hydrauliköl", dichte: 870, zaehigkeit: 0.05 },
  luft: { name: "Luft", dichte: 1.2, zaehigkeit: 1.8e-5 },
};

export const G = 9.81;
/** Luftdruck in Pa — Bezug für Überdruck und Gasmengen. */
export const P_LUFT = 101325;

export interface Knoten { id: string; z: number }

interface ZweiPol { id: string; a: string; b: string }
interface EinPol { id: string; a: string }

export type Teil =
  /** Rohr: Hagen-Poiseuille, auf Wunsch zusätzlich turbulente Reibung (Δp ∝ Q²). */
  | (ZweiPol & { art: "rohr"; laenge: number; durchmesser: number; turbulent?: boolean })
  /** Ventil/Engstelle mit festem Strömungswiderstand R in Pa·s/m³ (Infinity = zu). */
  | (ZweiPol & { art: "drossel"; widerstand: number })
  /** Pumpe/Verdichter, fördert von a nach b: Δp = p0·(1 − Q/qmax). */
  | (ZweiPol & { art: "pumpe"; foerderdruck: number; maxFluss: number })
  /** Druckminderer: hält hinter sich (b) den Überdruck `druck`; reicht der Vordruck nicht, steht er offen (Widerstand R). */
  | (ZweiPol & { art: "druckminderer"; druck: number; widerstand: number })
  /** Rückschlagventil: lässt nur a → b durch. */
  | (ZweiPol & { art: "rueckschlag"; widerstand: number })
  /** Netzanschluss: hält den Knoten auf dem Überdruck p (Hausanschluss, Druckluftnetz). */
  | (EinPol & { art: "druckquelle"; druck: number })
  /** Auslass ins Freie (Zapfstelle, Düse) mit Widerstand R; lässt nur hinaus (Infinity = zu). */
  | (EinPol & { art: "auslass"; widerstand: number })
  /** Offener Behälter, `a` ist der Boden. Füllhöhe in m. */
  | (EinPol & { art: "behaelter"; flaeche: number; hoehe: number; fuellung: number })
  /** Starrer Druckkessel voll Gas (nur bei Luft wirksam), Anfangsüberdruck in Pa. */
  | (EinPol & { art: "kessel"; volumen: number; druck: number })
  /** Gaspolster (Ausdehnungsgefäß): Wasser drückt ein Luftpolster zusammen, p·V = const. */
  | (EinPol & { art: "polster"; volumen: number; vordruck: number })
  /** Zylinder: Kolbenfläche A, Last F (N) — fährt aus, wenn p > F/A. Weg und Hub in m. */
  | (EinPol & { art: "zylinder"; flaeche: number; hub: number; kraft: number; weg: number });

export type TeilArt = Teil["art"];

export interface Netz {
  medium: Medium;
  knoten: Knoten[];
  teile: Teil[];
}

/** Querschnitt eines Rohrs. */
export const querschnitt = (d: number) => Math.PI * d * d / 4;
