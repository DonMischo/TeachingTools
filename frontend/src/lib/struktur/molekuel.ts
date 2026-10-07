/**
 * Das Molekül als Graph: Atome und Bindungen, sonst nichts.
 *
 * Gebaut wird es aus dem IUPAC-Namen (iupac.ts), Koordinaten bekommt es
 * später (layout.ts). Wasserstoff steht nicht als Atom drin, sondern wird
 * aus der Bindigkeit gerechnet — so wie man es in der Skelettformel auch
 * nicht hinschreibt.
 */
import { sub } from "@/lib/chemie";


export type Atom = {
  /** Elementsymbol: C, O, N, Cl … */
  el: string;
  /** Nummer in der Hauptkette (1-basiert), sonst undefined. */
  kette?: number;
  /** Formale Ladung, etwa in der Nitrogruppe: N trägt +, ein O trägt −. */
  ladung?: number;
  /** Feste Zahl Wasserstoffatome statt der gerechneten (geladene Atome). */
  hFest?: number;
};

export type Bindung = { a: number; b: number; grad: 1 | 2 | 3 };

export type Molekuel = {
  atome: Atom[];
  bindungen: Bindung[];
  /** Indizes der Atome, die den Ring bilden — leer bei offenen Ketten. */
  ring: number[];
};

/** Übliche Bindigkeit; danach richtet sich, wie viele H ein Atom trägt. */
const BINDIGKEIT: Record<string, number> = {
  C: 4, N: 3, O: 2, S: 2, P: 3, H: 1, F: 1, Cl: 1, Br: 1, I: 1,
};

export const leer = (): Molekuel => ({ atome: [], bindungen: [], ring: [] });

export function addAtom(m: Molekuel, el: string, kette?: number): number {
  m.atome.push({ el, kette });
  return m.atome.length - 1;
}

export function bind(m: Molekuel, a: number, b: number, grad: 1 | 2 | 3 = 1): void {
  m.bindungen.push({ a, b, grad });
}

/** Summe der Bindungsgrade an einem Atom. */
export function grade(m: Molekuel, i: number): number {
  return m.bindungen.reduce((s, b) => s + (b.a === i || b.b === i ? b.grad : 0), 0);
}

/** Wie viele Wasserstoffatome hängen rechnerisch an diesem Atom? */
export function hZahl(m: Molekuel, i: number): number {
  if (m.atome[i].hFest !== undefined) return m.atome[i].hFest!;
  const v = BINDIGKEIT[m.atome[i].el];
  if (v === undefined) return 0;
  return Math.max(0, v - grade(m, i));
}

/** Freie Elektronenpaare: was von der Achterschale übrig bleibt. */
export function paare(m: Molekuel, i: number): number {
  const el = m.atome[i].el;
  const aussen: Record<string, number> = { N: 5, O: 6, S: 6, F: 7, Cl: 7, Br: 7, I: 7 };
  if (!(el in aussen)) return 0;
  return Math.max(0, (aussen[el] - (BINDIGKEIT[el] ?? 0)) / 2);
}

export const nachbarn = (m: Molekuel, i: number): number[] =>
  m.bindungen.flatMap(b => (b.a === i ? [b.b] : b.b === i ? [b.a] : []));

/**
 * Summenformel in der Hill-Schreibweise: erst C, dann H, der Rest alphabetisch.
 * Die Wasserstoffatome kommen aus der Rechnung, nicht aus dem Graphen.
 *
 * Die Zahlen bleiben hier normal — zum Vergleichen und Prüfen. Fürs Anzeigen
 * setzt `formelTief` sie tief.
 */
export function summenformel(m: Molekuel): string {
  const zahl: Record<string, number> = {};
  m.atome.forEach((a, i) => {
    zahl[a.el] = (zahl[a.el] ?? 0) + 1;
    const h = hZahl(m, i);
    if (h) zahl.H = (zahl.H ?? 0) + h;
  });
  const teil = (el: string) => (zahl[el] ? `${el}${zahl[el] > 1 ? zahl[el] : ""}` : "");
  const rest = Object.keys(zahl).filter(e => e !== "C" && e !== "H").sort();
  return teil("C") + teil("H") + rest.map(teil).join("");
}

/**
 * Dieselbe Formel zum Hinsehen: C2H6O wird zu C₂H₆O. Chemische Formeln
 * schreibt man mit tiefgestellten Zahlen, sonst liest sich C2H6O wie eine
 * Rechnung.
 */
export const formelTief = (formel: string): string =>
  formel.replace(/\d/g, d => sub(Number(d)));

/** Molare Masse in g/mol — mit den Atommassen der Schulbuchtabelle. */
const MASSE: Record<string, number> = {
  H: 1.008, C: 12.011, N: 14.007, O: 15.999, F: 18.998,
  P: 30.974, S: 32.06, Cl: 35.45, Br: 79.904, I: 126.904,
};

export function molareMasse(m: Molekuel): number {
  const summe = m.atome.reduce((s, a, i) => s + (MASSE[a.el] ?? 0) + hZahl(m, i) * MASSE.H, 0);
  return Math.round(summe * 1000) / 1000;
}
