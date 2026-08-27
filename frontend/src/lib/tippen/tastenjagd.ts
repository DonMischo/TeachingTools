/**
 * Tastenjagd — Spiellogik, rein rechnerisch.
 *
 * Ein einzelnes Zeichen steht da, die Tastatur zeigt es, und gemessen wird die
 * Zeit bis zum richtigen Anschlag. Das Spiel misst also nicht Wörter pro
 * Minute, sondern **wie lange der Finger zu jeder einzelnen Taste braucht** —
 * genau die Größe, aus der sich später gezieltes Nachdrillen bauen lässt.
 *
 * Ein Fehlanschlag rückt nicht vor (wie die Fehlersperre der Lektionen); die
 * Uhr läuft weiter, der Fehler kostet also Zeit.
 */

export type Jagd = {
  ziele: string[];
  index: number;
  /** Zeitpunkt, seit dem das aktuelle Ziel steht. */
  seitMs: number | null;
  zeiten: { zeichen: string; ms: number }[];
  fehler: number;
};

export function starteJagd(ziele: string[]): Jagd {
  return { ziele, index: 0, seitMs: null, zeiten: [], fehler: 0 };
}

/** Die Uhr für das erste Ziel starten (wenn der Spieler bereit ist). */
export function jagdStart(j: Jagd, jetzt: number): Jagd {
  return j.seitMs === null ? { ...j, seitMs: jetzt } : j;
}

export function jagdZiel(j: Jagd): string | undefined {
  return j.ziele[j.index];
}

export function jagdVorbei(j: Jagd): boolean {
  return j.index >= j.ziele.length;
}

export function jagdTreffer(j: Jagd, zeichen: string, jetzt: number): Jagd {
  const soll = jagdZiel(j);
  if (soll === undefined) return j;

  if (zeichen !== soll) return { ...j, fehler: j.fehler + 1 };

  // Ohne gestartete Uhr gibt es keine ehrliche Zeit — dann zählt der Treffer,
  // aber er geht nicht in die Messung ein.
  const zeiten = j.seitMs === null ? j.zeiten : [...j.zeiten, { zeichen: soll, ms: jetzt - j.seitMs }];
  return { ...j, index: j.index + 1, seitMs: jetzt, zeiten };
}

/** Mittlere Reaktionszeit in ms (0, solange nichts gemessen wurde). */
export function schnitt(j: Jagd): number {
  if (j.zeiten.length === 0) return 0;
  return Math.round(j.zeiten.reduce((s, z) => s + z.ms, 0) / j.zeiten.length);
}

/** Die zähesten Tasten, langsamste zuerst — je Zeichen gemittelt. */
export function langsamste(j: Jagd, anzahl = 5): { zeichen: string; ms: number }[] {
  const je = new Map<string, number[]>();
  for (const z of j.zeiten) je.set(z.zeichen, [...(je.get(z.zeichen) ?? []), z.ms]);
  return [...je.entries()]
    .map(([zeichen, werte]) => ({
      zeichen,
      ms: Math.round(werte.reduce((s, m) => s + m, 0) / werte.length),
    }))
    .sort((a, b) => b.ms - a.ms)
    .slice(0, anzahl);
}

/** Eine Runde Ziele aus dem Zeichenvorrat ziehen. */
export function zieleFuer(erlaubt: string, anzahl: number, zufall: () => number): string[] {
  const buchstaben = [...new Set(erlaubt)].filter(c => c !== " ");
  const ziele: string[] = [];
  for (let i = 0; i < anzahl; i++) {
    ziele.push(buchstaben[Math.floor(zufall() * buchstaben.length)]);
  }
  return ziele;
}
