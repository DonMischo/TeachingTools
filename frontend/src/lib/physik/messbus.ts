/**
 * Der Messbus — die einzige Stelle, an der die Rechenwerke zusammenkommen.
 *
 * Mechanik, Stromkreis, Optik, Wellen und Wärme rechnen jedes für sich und
 * können keinen gemeinsamen Zustand teilen. Was sie teilen können, ist das
 * Ergebnis: alles, was sich über die Zeit ändert, meldet sich hier als
 * benanntes Signal an — Pendelwinkel, Knotenspannung, Beleuchtungsstärke,
 * Temperatur.
 *
 * Oszilloskop, Multimeter, Tabelle und CSV-Export lesen ausschließlich diese
 * Meldungen. Sie wissen nicht, welches Rechenwerk den Wert erzeugt hat, und
 * müssen es auch nie erfahren — deshalb gibt es *ein* Oszilloskop für alle
 * Bereiche statt eines je Bereich. Das ist die eigentliche Kombinierbarkeit
 * des Labors.
 */

/** `${geraetId}.${signalSchluessel}`, z. B. "g3.kraft". */
export type SignalId = string;

export const signalId = (geraet: string, schluessel: string): SignalId => `${geraet}.${schluessel}`;

/** Zu welchem Gerät ein Signal gehört. */
export const geraetVonSignal = (id: SignalId): string => id.slice(0, id.indexOf("."));

/** Welche Größe eines Geräts gemeint ist. */
export const schluesselVonSignal = (id: SignalId): string => id.slice(id.indexOf(".") + 1);

/** Messwerte eines Signals, älteste zuerst. */
export interface Verlauf {
  t: number[];
  v: number[];
}

/**
 * Hält je Signal die jüngsten Messwerte.
 *
 * Die Obergrenze ist keine Sparsamkeit, sondern Notwendigkeit: bei 240
 * Schritten je Sekunde wächst jedes Signal sonst unbegrenzt, und ein Labor,
 * das eine Schulstunde lang offen steht, würde den Browser auffressen.
 */
export class Messbus {
  private daten = new Map<SignalId, Verlauf>();

  constructor(private readonly hoechstens = 8192) {}

  /** Trägt einen Zeitschritt ein. */
  schreibe(t: number, werte: Iterable<readonly [SignalId, number]>): void {
    for (const [id, v] of werte) {
      let verlauf = this.daten.get(id);
      if (!verlauf) {
        verlauf = { t: [], v: [] };
        this.daten.set(id, verlauf);
      }
      verlauf.t.push(t);
      verlauf.v.push(v);
      if (verlauf.t.length > this.hoechstens) {
        // Blockweise abschneiden statt bei jedem Schritt eines wegzunehmen —
        // sonst kostet das Aufräumen mehr als das Messen.
        const weg = Math.floor(this.hoechstens / 4);
        verlauf.t.splice(0, weg);
        verlauf.v.splice(0, weg);
      }
    }
  }

  verlauf(id: SignalId): Verlauf | undefined {
    return this.daten.get(id);
  }

  letzter(id: SignalId): number | undefined {
    const verlauf = this.daten.get(id);
    return verlauf?.v[verlauf.v.length - 1];
  }

  ids(): SignalId[] {
    return [...this.daten.keys()];
  }

  leere(): void {
    this.daten.clear();
  }
}
