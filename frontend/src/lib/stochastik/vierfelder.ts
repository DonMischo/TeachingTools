/**
 * Vierfeldertafel (Kl. 9/10): zwei Merkmale A und B, vier Felder plus
 * Randsummen. Funktioniert mit Anzahlen wie mit Wahrscheinlichkeiten –
 * es sind nur Zahlen, die sich zu den Rändern aufaddieren.
 *
 *            B        B̄       Summe
 *   A      ab       aNb       a
 *   Ā      nAb      nAnB      nA
 *   Summe  b        nB        ges
 */

export interface Tafel { ab: number; aNb: number; nAb: number; nAnB: number }

export interface Voll extends Tafel { a: number; nA: number; b: number; nB: number; ges: number }

export function voll(t: Tafel): Voll {
  return {
    ...t, a: t.ab + t.aNb, nA: t.nAb + t.nAnB, b: t.ab + t.nAb, nB: t.aNb + t.nAnB,
    ges: t.ab + t.aNb + t.nAb + t.nAnB,
  };
}

export const FELDER = ["ab", "aNb", "a", "nAb", "nAnB", "nA", "b", "nB", "ges"] as const;
export type FeldName = (typeof FELDER)[number];

/** Aus Anzahlen relative Häufigkeiten (Anteile am Ganzen). */
export function relativ(t: Tafel): Tafel {
  const g = voll(t).ges || 1;
  return { ab: t.ab / g, aNb: t.aNb / g, nAb: t.nAb / g, nAnB: t.nAnB / g };
}

/** Baum »erst A, dann B« → Tafel mit Wahrscheinlichkeiten. */
export function ausBaum(pA: number, pBwennA: number, pBwennNA: number): Tafel {
  return { ab: pA * pBwennA, aNb: pA * (1 - pBwennA), nAb: (1 - pA) * pBwennNA, nAnB: (1 - pA) * (1 - pBwennNA) };
}

export interface BaumWerte { p1: number; p2: number; p2n: number }

/** Tafel → Baum mit A auf der ersten Stufe: P(A), P_A(B), P_Ā(B). */
export function zuBaumA(t: Tafel): BaumWerte {
  const v = voll(t);
  return { p1: v.a / v.ges, p2: v.a ? v.ab / v.a : 0, p2n: v.nA ? v.nAb / v.nA : 0 };
}

/** Umgekehrter Baum: erst B, dann A: P(B), P_B(A), P_B̄(A). */
export function zuBaumB(t: Tafel): BaumWerte {
  const v = voll(t);
  return { p1: v.b / v.ges, p2: v.b ? v.ab / v.b : 0, p2n: v.nB ? v.aNb / v.nB : 0 };
}

/** Stochastisch unabhängig, wenn P(A ∩ B) = P(A) · P(B). */
export function unabhaengig(t: Tafel, tol = 1e-9): boolean {
  const v = voll(t);
  const g = v.ges || 1;
  return Math.abs(v.ab / g - (v.a / g) * (v.b / g)) <= tol;
}

/**
 * Lücken füllen: Aus den bekannten der neun Felder die übrigen ausrechnen,
 * so weit es geht (jede Zeile und Spalte ist eine Summe aus drei Feldern).
 */
export function ergaenze(bekannt: Partial<Record<FeldName, number>>): Partial<Record<FeldName, number>> {
  const w = { ...bekannt };
  const summen: [FeldName, FeldName, FeldName][] = [
    ["ab", "aNb", "a"], ["nAb", "nAnB", "nA"], ["b", "nB", "ges"],
    ["ab", "nAb", "b"], ["aNb", "nAnB", "nB"], ["a", "nA", "ges"],
  ];
  for (let runde = 0; runde < 6; runde++) {
    for (const [x, y, s] of summen) {
      const fehlt = [x, y, s].filter(k => w[k] === undefined);
      if (fehlt.length !== 1) continue;
      if (fehlt[0] === s) w[s] = w[x]! + w[y]!;
      else if (fehlt[0] === x) w[x] = w[s]! - w[y]!;
      else w[y] = w[s]! - w[x]!;
    }
  }
  return w;
}

/** Wert eines Feldes einer Tafel. */
export const feld = (t: Tafel, k: FeldName) => voll(t)[k];
