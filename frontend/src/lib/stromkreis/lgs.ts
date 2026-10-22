/**
 * Gleichungssystem und Knotenbildung — das Handwerkszeug des Lösers.
 *
 * Übernommen aus dem Physiklabor (`physik/kern/netz.ts` auf
 * `feat/physiklabor-v2`), dort bewährt; hier ohne die Bauteile, die bringt
 * `simulation.ts` selbst mit.
 */

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
    if (Math.abs(M[beste][spalte]) < 1e-30) return null;
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

/**
 * Verschmilzt, was zusammengehört — die ganze Bedeutung eines Drahts.
 *
 * Zwei verbundene Punkte sind derselbe Knoten; ein Draht ist kein Bauteil,
 * sondern ein Gleichheitszeichen. Masse wird immer Knoten 0.
 */
export class Knotenzaehler {
  private eltern = new Map<string, string>();

  finde(x: string): string {
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
