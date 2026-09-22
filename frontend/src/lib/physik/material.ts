/**
 * Werkstoffe für den Zugversuch.
 *
 * Die Zahlen sind Schulwerte, keine Normblätter: Elastizitätsmodul und
 * Zugfestigkeit streuen in der Wirklichkeit je nach Legierung und Behandlung
 * erheblich. Sie sind so gewählt, dass die Größenverhältnisse stimmen — Stahl
 * ist steif und fest, Kupfer weicher, Gummi tausendfach nachgiebiger, Glas
 * fest und dabei spröde.
 *
 * `E` ist der Elastizitätsmodul in Pascal: die Spannung, bei der sich der
 * Draht rechnerisch auf die doppelte Länge dehnte, wenn er vorher risse.
 * `zugfestigkeit` ist die Spannung, bei der er tatsächlich reißt.
 */
export interface Werkstoff {
  name: string;
  /** Elastizitätsmodul in Pa. */
  E: number;
  /** Zugfestigkeit in Pa — darüber reißt die Probe. */
  zugfestigkeit: number;
  /** Bis hierher federt sie zurück; darüber bleibt sie verformt. */
  streckgrenze: number;
  /** Farbe auf der Werkbank. */
  farbe: string;
  /** Womit man sie durchtrennt bekommt. */
  brennbar: boolean;
  /** Spröde Werkstoffe reißen ohne vorherige bleibende Dehnung. */
  sproede: boolean;
}

export const WERKSTOFFE: Werkstoff[] = [
  { name: "Stahl", E: 210e9, zugfestigkeit: 500e6, streckgrenze: 350e6, farbe: "#cbd5e1", brennbar: false, sproede: false },
  { name: "Kupfer", E: 120e9, zugfestigkeit: 220e6, streckgrenze: 70e6, farbe: "#fb923c", brennbar: false, sproede: false },
  { name: "Aluminium", E: 70e9, zugfestigkeit: 150e6, streckgrenze: 95e6, farbe: "#e2e8f0", brennbar: false, sproede: false },
  { name: "Nylon", E: 3e9, zugfestigkeit: 75e6, streckgrenze: 45e6, farbe: "#fde68a", brennbar: true, sproede: false },
  { name: "Gummi", E: 0.01e9, zugfestigkeit: 15e6, streckgrenze: 15e6, farbe: "#a78bfa", brennbar: true, sproede: false },
  { name: "Glas", E: 70e9, zugfestigkeit: 50e6, streckgrenze: 50e6, farbe: "#7dd3fc", brennbar: false, sproede: true },
];

/** Der Werkstoff zu einer im Aufbau gespeicherten Nummer. */
export const werkstoff = (nummer: number): Werkstoff =>
  WERKSTOFFE[Math.min(WERKSTOFFE.length - 1, Math.max(0, Math.round(nummer)))];

/** Die Auswahl, wie sie im Einstellfeld erscheint. */
export const WERKSTOFF_AUSWAHL = WERKSTOFFE.map((w, i) => ({ wert: i, name: w.name }));

/** Querschnitt eines runden Drahts aus seinem Durchmesser, in m². */
export const querschnitt = (durchmesser: number) => (Math.PI * durchmesser * durchmesser) / 4;

/**
 * Werkstoffe für Bauteile — Bretter, Klötze, Murmeln.
 *
 * Anders als beim Zugversuch zählen hier nicht Festigkeit und Dehnung,
 * sondern was man beim Anfassen und Zusehen merkt: wie schwer etwas ist, wie
 * gut es rutscht und wie es springt. Eine Stahlkugel und eine gleich große
 * aus Styropor unterscheiden sich um mehr als das Zweihundertfache im
 * Gewicht — genau darum geht es beim Vergleichen.
 */
export interface Feststoff {
  name: string;
  /** Dichte in kg/m³. */
  dichte: number;
  /** Reibungszahl gegen andere Körper. */
  reibung: number;
  /**
   * Spezifische Wärmekapazität in J/(kg·K) — wie viel Wärme ein Kilogramm
   * braucht, um ein Kelvin wärmer zu werden.
   *
   * Sie entscheidet, wie träge ein Körper auf Wärme reagiert: Wasser und Holz
   * schlucken viel, Stahl wenig. Damit rechnet das Wärmenetz seine
   * Zeitkonstante aus, und daran sieht man, warum ein Stahlklotz an der
   * Heizplatte schnell heiß wird und ein Holzbrett nicht.
   */
  waerme: number;
  /** Sprungzahl: 0 bleibt liegen, 1 spränge ewig. */
  sprung: number;
  farbe: string;
}

export const FESTSTOFFE: Feststoff[] = [
  { name: "Holz", dichte: 600, waerme: 1700, reibung: 0.6, sprung: 0.2, farbe: "#b45309" },
  { name: "Stahl", dichte: 7850, waerme: 470, reibung: 0.3, sprung: 0.35, farbe: "#cbd5e1" },
  { name: "Glas", dichte: 2500, waerme: 840, reibung: 0.2, sprung: 0.5, farbe: "#7dd3fc" },
  { name: "Gummi", dichte: 1200, waerme: 1400, reibung: 0.9, sprung: 0.85, farbe: "#a78bfa" },
  { name: "Kunststoff", dichte: 950, waerme: 1500, reibung: 0.4, sprung: 0.45, farbe: "#fde68a" },
  { name: "Styropor", dichte: 30, waerme: 1300, reibung: 0.5, sprung: 0.1, farbe: "#f1f5f9" },
];

export const feststoff = (nummer: number): Feststoff =>
  FESTSTOFFE[Math.min(FESTSTOFFE.length - 1, Math.max(0, Math.round(nummer)))];

export const FESTSTOFF_AUSWAHL = FESTSTOFFE.map((f, i) => ({ wert: i, name: f.name }));

/**
 * Die Tiefe, die ein flach gezeichnetes Bauteil in Wirklichkeit hätte.
 *
 * Die Werkbank ist zweidimensional, Massen sind es nicht. Fünf Zentimeter
 * Tiefe machen aus einem gezeichneten Brett ein Brett, das man tragen könnte.
 */
export const TIEFE = 0.05;

/** Die Masse eines Kastens aus diesem Werkstoff, in Kilogramm. */
export const masseKasten = (stoff: Feststoff, breite: number, hoehe: number) =>
  Math.max(0.001, stoff.dichte * breite * hoehe * TIEFE);

/** Die Masse einer Kugel aus diesem Werkstoff, in Kilogramm. */
export const masseKugel = (stoff: Feststoff, durchmesser: number) =>
  Math.max(0.0001, stoff.dichte * (Math.PI / 6) * durchmesser ** 3);
