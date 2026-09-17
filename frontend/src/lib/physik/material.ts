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
