/**
 * Das künstliche Neuron — die kleinste lernende Einheit.
 *
 * Das Wortnetz heißt zwar »Netz«, hat mit einem *neuronalen* Netz aber nichts
 * zu tun: Dort wird gezählt, hier wird gewichtet. Ein Neuron nimmt seine
 * Eingaben, multipliziert jede mit einem Gewicht, zählt alles zusammen und
 * sagt: dafür oder dagegen.
 *
 *     Summe = w₁·x₁ + w₂·x₂ + b        Antwort = Summe > 0 ? ja : nein
 *
 * Und »Lernen« heißt hier genau eine Regel, die 1958 aufgeschrieben wurde und
 * bis heute die Idee hinter jedem Training ist: **Liegt das Neuron falsch,
 * verschiebe die Gewichte ein Stück in Richtung der richtigen Antwort.** Kein
 * Verstehen, kein Nachdenken — nur: Fehler machen, nachstellen, wiederholen.
 *
 * Der zweite Datensatz ist mit Absicht nicht zu schaffen: Mit *einer* Geraden
 * lassen sich diese vier Häufchen nicht trennen, egal wie lange man einstellt.
 * Genau daran ist die KI-Forschung in den 1960ern hängengeblieben — und genau
 * deshalb haben heutige Netze mehrere Schichten übereinander.
 */
import { rng } from "./rng";

export type Punkt2 = { x: number; y: number; klasse: 0 | 1 };
export type Gewichte = { w1: number; w2: number; b: number };

export type Datensatz = {
  slug: string;
  titel: string;
  icon: string;
  /** Beschriftung der beiden Achsen und der beiden Klassen. */
  achsen: [string, string];
  klassen: [string, string];
  punkte: Punkt2[];
  /** Ob eine einzige Gerade reicht. */
  trennbar: boolean;
  hinweis: string;
};

/** Ein Häufchen Punkte um einen Mittelpunkt — immer dieselben. */
function haufen(mx: number, my: number, streuung: number, anzahl: number, klasse: 0 | 1, seed: number): Punkt2[] {
  const wuerfel = rng(seed);
  return Array.from({ length: anzahl }, () => {
    // Zwei Würfe gemittelt sehen natürlicher aus als ein gleichverteilter.
    const dx = (wuerfel() + wuerfel() - 1) * streuung;
    const dy = (wuerfel() + wuerfel() - 1) * streuung;
    return { x: Math.max(0.03, Math.min(0.97, mx + dx)), y: Math.max(0.03, Math.min(0.97, my + dy)), klasse };
  });
}

export const DATENSAETZE: Datensatz[] = [
  {
    slug: "obst",
    titel: "Obst",
    icon: "🍎",
    achsen: ["Breite", "Höhe"],
    klassen: ["Apfel", "Birne"],
    trennbar: true,
    hinweis: "Äpfel sind breit und rund, Birnen schmal und hoch. Eine Gerade reicht.",
    punkte: [...haufen(0.68, 0.34, 0.16, 14, 0, 101), ...haufen(0.32, 0.7, 0.16, 14, 1, 202)],
  },
  {
    slug: "pilze",
    titel: "Pilze",
    icon: "🍄",
    achsen: ["Größe", "Farbigkeit"],
    klassen: ["essbar", "giftig"],
    trennbar: true,
    hinweis: "Hier überlappen die Häufchen ein wenig — ein paar Fehler bleiben, wie im echten Leben.",
    punkte: [...haufen(0.38, 0.38, 0.2, 15, 0, 303), ...haufen(0.62, 0.66, 0.2, 15, 1, 404)],
  },
  {
    slug: "knifflig",
    titel: "Knifflig",
    icon: "⚡",
    achsen: ["Merkmal A", "Merkmal B"],
    klassen: ["ja", "nein"],
    trennbar: false,
    hinweis: "Vier Häufchen über Kreuz. Mit einer einzigen Geraden ist das nicht zu schaffen — probiere ruhig, es geht wirklich nicht.",
    punkte: [
      ...haufen(0.25, 0.25, 0.1, 8, 0, 505), ...haufen(0.75, 0.75, 0.1, 8, 0, 606),
      ...haufen(0.25, 0.75, 0.1, 8, 1, 707), ...haufen(0.75, 0.25, 0.1, 8, 1, 808),
    ],
  },
];

/**
 * Die Grundstellung — mit Absicht daneben.
 *
 * Sie sortiert rund die Haelfte der Punkte falsch ein. Stuende die Linie schon
 * richtig, gaebe es nichts zu ueben, und die Station zeigte nur ein fertiges
 * Ergebnis statt des Lernens.
 */
export const START: Gewichte = { w1: -0.6, w2: 0, b: 0.2 };

/** Was das Neuron zu einem Punkt sagt. */
export function antwort(g: Gewichte, p: { x: number; y: number }): 0 | 1 {
  return g.w1 * (p.x - 0.5) + g.w2 * (p.y - 0.5) + g.b > 0 ? 0 : 1;
}

export function fehlerhafte(g: Gewichte, punkte: readonly Punkt2[]): Punkt2[] {
  return punkte.filter(p => antwort(g, p) !== p.klasse);
}

export function treffer(g: Gewichte, punkte: readonly Punkt2[]): number {
  return punkte.length - fehlerhafte(g, punkte).length;
}

/**
 * Ein Lernschritt nach der Perzeptron-Regel (Rosenblatt, 1958).
 *
 * Nimm einen Punkt, bei dem das Neuron falsch liegt, und verschiebe die
 * Gewichte ein Stück in seine Richtung. Mehr ist es nicht — und für trennbare
 * Daten ist bewiesen, dass es nach endlich vielen Schritten passt.
 */
export function lernschritt(
  g: Gewichte,
  punkte: readonly Punkt2[],
  wuerfel: () => number,
  tempo = 0.25,
): { gewichte: Gewichte; punkt: Punkt2 } | null {
  const falsch = fehlerhafte(g, punkte);
  if (!falsch.length) return null;
  const p = falsch[Math.floor(wuerfel() * falsch.length) % falsch.length];
  // Richtung: Klasse 0 soll positiv werden, Klasse 1 negativ.
  const richtung = p.klasse === 0 ? 1 : -1;
  return {
    punkt: p,
    gewichte: {
      w1: g.w1 + tempo * richtung * (p.x - 0.5),
      w2: g.w2 + tempo * richtung * (p.y - 0.5),
      b: g.b + tempo * richtung * 0.1,
    },
  };
}

/**
 * Die Trennlinie als zwei Punkte am Rand des Feldes (0–1).
 *
 * w₁(x−½) + w₂(y−½) + b = 0 nach y aufgelöst; steht w₂ fast auf null, ist die
 * Linie senkrecht und wird nach x aufgelöst.
 */
export function linie(g: Gewichte): [{ x: number; y: number }, { x: number; y: number }] | null {
  const y = (x: number) => 0.5 - (g.w1 * (x - 0.5) + g.b) / g.w2;
  const x = (yy: number) => 0.5 - (g.w2 * (yy - 0.5) + g.b) / g.w1;
  if (Math.abs(g.w2) > 1e-6) return [{ x: 0, y: y(0) }, { x: 1, y: y(1) }];
  if (Math.abs(g.w1) > 1e-6) return [{ x: x(0), y: 0 }, { x: x(1), y: 1 }];
  return null;
}
