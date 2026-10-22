/**
 * Eine Schaltung, wie sie gespeichert, geteilt und exportiert wird.
 *
 * Alles liegt auf einem Raster aus ganzen Zahlen. Ein Bauteil spannt sich
 * von `a` nach `b` (wie bei Falstad: man zieht es auf), ein Draht ebenso.
 * Verbunden ist nur, was mit einem **Endpunkt** auf demselben Rasterpunkt
 * liegt — ein Draht, der an einem Punkt bloß vorbeiläuft, berührt ihn nicht.
 */

export interface Punkt { x: number; y: number }

export type BauteilArt =
  | "batterie" | "wechselquelle"
  | "widerstand" | "lampe" | "motor"
  | "schalter" | "umschalter" | "sicherung"
  | "diode" | "led"
  | "kondensator" | "spule" | "trafo"
  | "amperemeter" | "voltmeter";

export interface Bauteil {
  id: string;
  art: BauteilArt;
  a: Punkt;
  b: Punkt;
  /** Kenngrößen in SI-Einheiten; was fehlt, kommt aus `TEILE[art].werte`. */
  werte: Record<string, number>;
}

export interface Draht { id: string; a: Punkt; b: Punkt }

export interface Schaltung {
  version: 1;
  bauteile: Bauteil[];
  draehte: Draht[];
}

export const schluessel = (p: Punkt) => `${p.x},${p.y}`;

/**
 * Die Anschlüsse eines Bauteils, in fester Reihenfolge.
 *
 * Die meisten haben zwei: `a` und `b`. Der Umschalter hat seinen Mittelkontakt
 * bei `a` und zwei Ausgänge — `b` und daneben, zwei Raster links von der
 * Laufrichtung. Der Trafo trägt die Primärspule von `a` aus und die
 * Sekundärspule von `b` aus, beide zwei Raster lang quer zur Verbindung a→b.
 */
export function anschluesse(t: Bauteil): Punkt[] {
  const dx = Math.sign(t.b.x - t.a.x), dy = Math.sign(t.b.y - t.a.y);
  // links von der Laufrichtung (Bildschirm: y nach unten)
  const quer = { x: dy, y: -dx };
  if (t.art === "umschalter") {
    return [t.a, t.b, { x: t.b.x + 2 * quer.x, y: t.b.y + 2 * quer.y }];
  }
  if (t.art === "trafo") {
    return [
      t.a, { x: t.a.x + 2 * quer.x, y: t.a.y + 2 * quer.y },
      t.b, { x: t.b.x + 2 * quer.x, y: t.b.y + 2 * quer.y },
    ];
  }
  return [t.a, t.b];
}
