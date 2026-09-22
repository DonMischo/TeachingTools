/**
 * Ein Netz aus Knoten und Zweigen — und wie man es löst.
 *
 * Anders als die Mechanik lässt sich ein Stromkreis nicht Bauteil für Bauteil
 * rechnen: durch eine Reihenschaltung fließt überall derselbe Strom, und was
 * er ist, entscheidet der ganze Kreis gemeinsam. Also wird ein
 * Gleichungssystem aufgestellt und gelöst — eine Unbekannte je Knoten, eine je
 * Spannungsquelle (Knotenpotenzialverfahren, MNA).
 *
 * Hier steht nur das Verfahren, nichts über Bauteile. Das ist Absicht: das
 * **Wärmenetz ist dasselbe Netz** — Temperatur statt Spannung, Wärmestrom
 * statt Strom, Wärmeleitwert statt Leitwert, Wärmekapazität statt Kapazität.
 * Wer das einmal gelöst hat, hat es zweimal gelöst; `strom.ts` und `waerme.ts`
 * bauen beide nur noch ihre Zweige zusammen.
 *
 * Knoten 0 ist die Masse: sein Potenzial ist null. Welcher Punkt das ist,
 * bestimmt die Schicht darüber — beim Stromkreis der Minuspol, beim Wärmenetz
 * die Umgebung.
 */

/**
 * Ein winziger Leitwert von jedem Knoten gegen Masse.
 *
 * Er hält die Matrix lösbar, wenn ein Zweig in der Luft hängt — ohne ihn ist
 * sie singulär, sobald jemand ein Bauteil nur einseitig anschließt. Klein
 * genug, dass er das Ergebnis nicht verfälscht: bei Schulwiderständen
 * (1 Ω bis 10 kΩ) liegen die echten Leitwerte um Größenordnungen darüber.
 */
const STUETZE = 1e-12;

export type Zweig =
  /** Ein Widerstand, angegeben als Leitwert (1/R). */
  | { art: "leitwert"; a: number; b: number; wert: number }
  /**
   * Eine ideale Spannungsquelle: sie hält a − b auf `wert`.
   *
   * Sie bringt eine eigene Unbekannte mit — ihren Strom —, und genau deshalb
   * ist sie auch der Trick für einen Draht: eine Quelle mit null Volt ist
   * elektrisch nichts und verrät trotzdem, wie viel durch sie fließt.
   */
  | { art: "quelle"; a: number; b: number; wert: number; id: string }
  /** Eine Stromquelle: sie treibt `wert` von a nach b, was auch immer dagegensteht. */
  | { art: "strom"; a: number; b: number; wert: number };

export interface Netz {
  /** Wie viele Knoten es gibt; 0 ist die Masse. */
  knoten: number;
  zweige: Zweig[];
}

export interface Loesung {
  /** Potenzial je Knoten, Masse ist 0. */
  potenzial: number[];
  /** Strom durch eine benannte Quelle, positiv von a nach b. */
  strom: Map<string, number>;
}

/** Gauß mit Spaltenpivotsuche. Gibt null zurück, wenn nichts zu lösen ist. */
export function loeseLGS(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  if (!n) return [];
  const M = A.map((zeile, i) => [...zeile, b[i]]);

  for (let spalte = 0; spalte < n; spalte++) {
    let beste = spalte;
    for (let i = spalte + 1; i < n; i++) {
      if (Math.abs(M[i][spalte]) > Math.abs(M[beste][spalte])) beste = i;
    }
    if (Math.abs(M[beste][spalte]) < 1e-14) return null;
    [M[spalte], M[beste]] = [M[beste], M[spalte]];

    for (let i = 0; i < n; i++) {
      if (i === spalte) continue;
      const faktor = M[i][spalte] / M[spalte][spalte];
      if (!faktor) continue;
      for (let j = spalte; j <= n; j++) M[i][j] -= faktor * M[spalte][j];
    }
  }

  const x = new Array<number>(n);
  for (let i = 0; i < n; i++) x[i] = M[i][n] / M[i][i];
  return x.every(Number.isFinite) ? x : null;
}

/** Löst das Netz. Bei einem unlösbaren Netz steht überall null. */
export function loeseNetz(netz: Netz): Loesung {
  const n = Math.max(0, netz.knoten - 1);
  const quellen = netz.zweige.filter(z => z.art === "quelle");
  const leer: Loesung = { potenzial: new Array(netz.knoten).fill(0), strom: new Map() };
  const groesse = n + quellen.length;
  if (!groesse) return leer;

  // Masse ist Knoten 0 und kommt nicht ins Gleichungssystem.
  const A = Array.from({ length: groesse }, () => new Array<number>(groesse).fill(0));
  const rechts = new Array<number>(groesse).fill(0);
  for (let i = 0; i < n; i++) A[i][i] += STUETZE;

  for (const z of netz.zweige) {
    const ia = z.a - 1, ib = z.b - 1;
    if (z.art === "leitwert") {
      const leit = z.wert;
      if (ia >= 0) A[ia][ia] += leit;
      if (ib >= 0) A[ib][ib] += leit;
      if (ia >= 0 && ib >= 0) { A[ia][ib] -= leit; A[ib][ia] -= leit; }
    } else if (z.art === "strom") {
      if (ia >= 0) rechts[ia] -= z.wert;
      if (ib >= 0) rechts[ib] += z.wert;
    }
  }

  quellen.forEach((q, k) => {
    const zeile = n + k;
    const ia = q.a - 1, ib = q.b - 1;
    if (ia >= 0) { A[ia][zeile] += 1; A[zeile][ia] += 1; }
    if (ib >= 0) { A[ib][zeile] -= 1; A[zeile][ib] -= 1; }
    rechts[zeile] = q.wert;
  });

  const loesung = loeseLGS(A, rechts);
  if (!loesung) return leer;

  const potenzial = new Array<number>(netz.knoten).fill(0);
  for (let k = 1; k < netz.knoten; k++) potenzial[k] = loesung[k - 1];
  const strom = new Map<string, number>();
  quellen.forEach((q, k) => strom.set((q as Extract<Zweig, { art: "quelle" }>).id, loesung[n + k]));
  return { potenzial, strom };
}

/**
 * Verschmilzt, was zusammengehört — die ganze Bedeutung eines Kabels.
 *
 * Zwei verbundene Anschlüsse sind derselbe Knoten; ein Draht ist kein Bauteil,
 * sondern ein Gleichheitszeichen. Masse wird immer Knoten 0.
 */
export class Knotenzaehler {
  private eltern = new Map<string, string>();

  private finde(x: string): string {
    const p = this.eltern.get(x);
    if (p === undefined) { this.eltern.set(x, x); return x; }
    if (p === x) return x;
    const wurzel = this.finde(p);
    this.eltern.set(x, wurzel);
    return wurzel;
  }

  melde(schluessel: string) {
    this.finde(schluessel);
  }

  verbinde(a: string, b: string) {
    const wa = this.finde(a), wb = this.finde(b);
    if (wa !== wb) this.eltern.set(wa, wb);
  }

  /** Nummeriert die Knoten; `masse` wird 0, sonst der erste gemeldete. */
  nummern(masse?: string): Map<string, number> {
    const wurzeln = new Map<string, number>();
    if (masse !== undefined && this.eltern.has(masse)) wurzeln.set(this.finde(masse), 0);
    const aus = new Map<string, number>();
    for (const k of [...this.eltern.keys()].sort()) {
      const w = this.finde(k);
      if (!wurzeln.has(w)) wurzeln.set(w, wurzeln.size);
      aus.set(k, wurzeln.get(w)!);
    }
    return aus;
  }
}
