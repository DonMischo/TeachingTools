/**
 * Zwei Neuronen und eines dahinter — das kleinste *tiefe* Netz.
 *
 * Ein einzelnes Neuron kann nur eine Gerade ziehen; am kniffligen Datensatz
 * (vier Häufchen über Kreuz) scheitert es deshalb für immer. Zwei Neuronen
 * ziehen zwei Geraden, und ein drittes entscheidet, was aus deren Antworten
 * folgt. Damit entsteht ein Streifen statt einer Halbebene — und der Datensatz
 * geht auf.
 *
 * Genau dieser Schritt war 1969 der Knackpunkt: Minsky und Papert zeigten, dass
 * ein Perzeptron XOR nicht lernen kann, und die Forschung lag fast zwanzig
 * Jahre still. Die Lösung war nicht ein besseres Neuron, sondern eine zweite
 * Schicht — plus ein Verfahren, um sie zu trainieren.
 *
 * Dieses Verfahren ist hier echt eingebaut:
 *
 *   1. Vorwärts rechnen und den Fehler messen.
 *   2. Den Fehler rückwärts durch das Netz verteilen (»Backpropagation«).
 *   3. Jedes Gewicht ein kleines Stück gegen seinen Anteil am Fehler schieben.
 *
 * Statt der harten Schwelle des Perzeptrons steht dafür eine weiche Kurve
 * (Sigmoid): Nur weil die Antwort sanft übergeht, lässt sich überhaupt sagen,
 * *wie sehr* ein Gewicht am Fehler schuld war.
 */
import { rng } from "./rng";
import type { Punkt2 } from "./perzeptron";

/** Zwei verdeckte Neuronen (w, b) und das Ausgabeneuron (v, bo). */
export type Netz2 = {
  w: [[number, number], [number, number]];
  b: [number, number];
  v: [number, number];
  bo: number;
};

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

/** Zufällige Startgewichte — klein, damit die Kurve nicht gleich flach liegt. */
export function starte(seed: number): Netz2 {
  const wuerfel = rng(seed);
  const z = () => (wuerfel() * 2 - 1) * 2.5;
  return { w: [[z(), z()], [z(), z()]], b: [z(), z()], v: [z(), z()], bo: z() };
}

/** Was das Netz zu einem Punkt sagt: beide verdeckten Werte und die Ausgabe. */
export function vorwaerts(n: Netz2, x: number, y: number) {
  const mx = x - 0.5;
  const my = y - 0.5;
  const a0 = sigmoid(n.w[0][0] * mx + n.w[0][1] * my + n.b[0]);
  const a1 = sigmoid(n.w[1][0] * mx + n.w[1][1] * my + n.b[1]);
  const aus = sigmoid(n.v[0] * a0 + n.v[1] * a1 + n.bo);
  return { a0, a1, aus };
}

/** Klasse 0 heißt »Ausgabe unter der Hälfte« — wie beim einzelnen Neuron. */
export function antwort2(n: Netz2, p: { x: number; y: number }): 0 | 1 {
  return vorwaerts(n, p.x, p.y).aus < 0.5 ? 0 : 1;
}

export function treffer2(n: Netz2, punkte: readonly Punkt2[]): number {
  return punkte.filter(p => antwort2(n, p) === p.klasse).length;
}

/** Mittlerer Fehler (0–1) — die Zahl, die beim Üben kleiner werden soll. */
export function fehler2(n: Netz2, punkte: readonly Punkt2[]): number {
  if (!punkte.length) return 0;
  let summe = 0;
  for (const p of punkte) {
    const { aus } = vorwaerts(n, p.x, p.y);
    summe += (aus - p.klasse) ** 2;
  }
  return summe / punkte.length;
}

/**
 * Ein Durchgang durch alle Punkte: Fehler messen, rückwärts verteilen,
 * Gewichte nachstellen.
 *
 * Gerechnet wird über alle Punkte auf einmal (Full Batch) — bei vierzig
 * Punkten ist das billig und läuft ruhiger als Punkt für Punkt.
 */
export function lernschritt2(n: Netz2, punkte: readonly Punkt2[], tempo = 0.6): Netz2 {
  const dw: [[number, number], [number, number]] = [[0, 0], [0, 0]];
  const db: [number, number] = [0, 0];
  const dv: [number, number] = [0, 0];
  let dbo = 0;

  for (const p of punkte) {
    const mx = p.x - 0.5;
    const my = p.y - 0.5;
    const { a0, a1, aus } = vorwaerts(n, p.x, p.y);

    // Ausgabeschicht: wie weit daneben, so viel Schuld.
    const dz = aus - p.klasse;
    dv[0] += dz * a0;
    dv[1] += dz * a1;
    dbo += dz;

    // Rückwärts in die verdeckte Schicht — jedes Neuron bekommt seinen Anteil,
    // gedämpft durch die Steigung seiner eigenen Kurve.
    const d0 = dz * n.v[0] * a0 * (1 - a0);
    const d1 = dz * n.v[1] * a1 * (1 - a1);
    dw[0][0] += d0 * mx; dw[0][1] += d0 * my; db[0] += d0;
    dw[1][0] += d1 * mx; dw[1][1] += d1 * my; db[1] += d1;
  }

  const k = tempo / Math.max(1, punkte.length);
  return {
    w: [
      [n.w[0][0] - k * dw[0][0], n.w[0][1] - k * dw[0][1]],
      [n.w[1][0] - k * dw[1][0], n.w[1][1] - k * dw[1][1]],
    ],
    b: [n.b[0] - k * db[0], n.b[1] - k * db[1]],
    v: [n.v[0] - k * dv[0], n.v[1] - k * dv[1]],
    bo: n.bo - k * dbo,
  };
}

/**
 * Die Gerade eines verdeckten Neurons — dort, wo es von »eher nein« auf
 * »eher ja« umschlägt (Sigmoid = ½, also Summe = 0).
 */
export function linie2(n: Netz2, i: 0 | 1): [{ x: number; y: number }, { x: number; y: number }] | null {
  const [w1, w2] = n.w[i];
  const b = n.b[i];
  if (Math.abs(w2) > 1e-6) {
    const y = (x: number) => 0.5 - (w1 * (x - 0.5) + b) / w2;
    return [{ x: 0, y: y(0) }, { x: 1, y: y(1) }];
  }
  if (Math.abs(w1) > 1e-6) {
    const x = (yy: number) => 0.5 - (w2 * (yy - 0.5) + b) / w1;
    return [{ x: x(0), y: 0 }, { x: x(1), y: 1 }];
  }
  return null;
}

/**
 * Der Startwert der Grundstellung.
 *
 * Gemessen über acht Startwerte: Mit Tempo 2 kommen sieben davon in unter 500
 * Durchgängen auf alle Punkte, einer (11) verrennt sich dauerhaft in einer
 * Sackgasse. Das ist keine Schwäche des Werkzeugs, sondern eine echte
 * Eigenschaft des Verfahrens (ein lokales Minimum) — und die Station sagt es
 * auch. Für die Grundstellung steht trotzdem ein Wert, der ankommt, damit die
 * Stunde nicht am Würfel hängt.
 */
export const START_SEED = 7;
