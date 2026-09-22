/**
 * Die Grundteile: wie sie heißen, was man an ihnen einstellt, welche Gestalt
 * sie haben und wie schwer sie sind.
 *
 * Die Gestalt steht hier einmal und wird von allen gelesen — vom Löser, von
 * der Zeichnung und vom Treffertest. Liefen die auseinander, rollte eine
 * Murmel sichtbar neben dem Brett entlang.
 *
 * Die Masse folgt aus Werkstoff und Volumen, nicht aus einer Zahl, die man
 * irgendwo einträgt: ein Brett aus Stahl ist schwerer als eines aus Holz,
 * ohne dass man es sagen muss. Wer eine bestimmte Masse braucht, gibt sie vor
 * — dann gilt die, und die Dichte richtet sich danach.
 */
import { bogen } from "../einheiten";
import { FESTSTOFF_AUSWAHL, feststoff } from "../material";
import type { ParameterDef, Punkt } from "../typen";
import type { Teil, TeilArt } from "./modell";

/** Gestalt in Teilkoordinaten. Kasten und Kreis genügen fürs Erste, die Kapsel für Stangen. */
export type Form =
  | { art: "kasten"; mitte: Punkt; b: number; h: number; winkel?: number }
  | { art: "kreis"; mitte: Punkt; r: number }
  | { art: "kapsel"; a: Punkt; b: Punkt; r: number };

export interface TeilTyp {
  art: TeilArt;
  name: string;
  icon: string;
  parameter: ParameterDef[];
  /** Die Gestalt — eine oder mehrere Formen, alle starr verbunden. */
  formen: (t: Teil) => Form[];
  /** Das Volumen in m³, aus dem mit der Dichte die Masse wird. */
  volumen: (t: Teil) => number;
}

const STOFF = (standard: number): ParameterDef => ({
  schluessel: "stoff", name: "Werkstoff", einheit: "", standard, min: 0,
  max: FESTSTOFF_AUSWAHL.length - 1, optionen: FESTSTOFF_AUSWAHL,
});

/**
 * Welcher Anteil der aufgenommenen Leistung als Licht hinausgeht.
 *
 * Der Rest wird Wärme — bei einer Glühlampe ist das der größte Teil, und
 * genau das ist die Zahl, an der man im Unterricht sieht, warum sie verboten
 * wurde.
 */
const WIRKUNGSGRAD = (standard: number): ParameterDef => ({
  schluessel: "wirkungsgrad", name: "Anteil als Licht", einheit: "", anzeige: "%",
  standard, min: 0, max: 1,
});

/**
 * Wie dick eine Linse an ihrer dicksten Stelle ist.
 *
 * Eine kurze Brennweite heißt starke Krümmung heißt dickes Glas — das sieht
 * man einer Linse an, und deshalb folgt die Gestalt hier der Brennweite statt
 * einer eigenen Einstellung. Für eine Zerstreuungslinse ist es die Dicke des
 * Randes; ihre Mitte ist dünn.
 */
export function linsenDicke(t: Teil): number {
  const d = t.werte.durchmesser ?? 0.12;
  const f = Math.abs(t.werte.brennweite ?? 0.25);
  return Math.min(d * 0.4, Math.max(0.006, (d * 0.1 * 0.25) / Math.max(0.02, f)));
}

/** 0 heißt: aus dem Werkstoff berechnen. */
const MASSE_VORGABE: ParameterDef = {
  schluessel: "masseVorgabe", name: "Masse vorgeben", einheit: "kg", standard: 0, min: 0, max: 50,
};

const w = (t: Teil, k: string, ersatz: number) => t.werte[k] ?? ersatz;

/**
 * Ein Zahnrad: Nabe und Zähne.
 *
 * Box2D v3 hat kein Zahnradgelenk mehr — zwei Zahnräder greifen hier
 * wirklich ineinander, mit Zähnen, die sich berühren. Das ist ehrlicher als
 * eine erzwungene Kopplung: ein zu großer Abstand greift nicht, und bei zu
 * wenig Zähnen rutscht es durch, genau wie im Baukasten aus Blech.
 */
function zahnradFormen(t: Teil): Form[] {
  const r = Math.max(0.02, w(t, "durchmesser", 0.2)) / 2;
  const z = Math.max(6, Math.round(w(t, "zaehne", 12)));
  const teilung = (2 * Math.PI * r) / z;
  const hoehe = teilung * 0.5, breite = teilung * 0.45;
  const formen: Form[] = [{ art: "kreis", mitte: { x: 0, y: 0 }, r: r - hoehe / 2 }];
  for (let i = 0; i < z; i++) {
    const winkel = (i / z) * 2 * Math.PI;
    formen.push({
      art: "kasten",
      mitte: { x: r * Math.cos(winkel), y: r * Math.sin(winkel) },
      b: hoehe, h: breite, winkel,
    });
  }
  return formen;
}

/**
 * Ein elektrisches Bauteil: ein Kasten mit zwei Anschlüssen, links und rechts.
 *
 * Alle sehen gleich aus, weil alle dasselbe sind — zwei Klemmen und etwas
 * dazwischen. Welchen Anschluss man meint, sagt die Seite, auf die man tippt;
 * ein eigener Anschluss-Begriff im Modell wäre dafür zu viel.
 */
const ELEKTRISCH_TIEFE = 0.04;
function elektrisch(
  art: TeilArt, name: string, icon: string, b: number, h: number, masse: number, parameter: ParameterDef[],
): TeilTyp {
  return {
    art, name, icon,
    parameter: [...parameter, { ...MASSE_VORGABE, standard: masse }],
    formen: () => [{ art: "kasten", mitte: { x: 0, y: 0 }, b, h }],
    volumen: () => b * h * ELEKTRISCH_TIEFE,
  };
}

/** Die elektrischen Bauteile — sie hängen am Stromkreis statt am Werkstoff. */
export const ELEKTRISCHE_ARTEN = new Set<TeilArt>(["batterie", "widerstand", "lampe", "schalter", "motor", "strahler"]);
export const istElektrisch = (art: TeilArt | string) => ELEKTRISCHE_ARTEN.has(art as TeilArt);

/**
 * Die beiden Anschlüsse in Teilkoordinaten: 0 links, 1 rechts.
 *
 * Welcher gemeint ist, entscheidet allein das Vorzeichen von x — wer auf die
 * linke Hälfte tippt, meint den linken.
 */
export function pole(t: Teil): [Punkt, Punkt] {
  const form = teilTyp(t.art)?.formen(t)[0];
  const b = form?.art === "kasten" ? form.b : 0.1;
  return [{ x: -b / 2, y: 0 }, { x: b / 2, y: 0 }];
}

/** An welchem Anschluss ein Punkt des Teils sitzt. */
export const polAn = (lokal: Punkt): 0 | 1 => (lokal.x < 0 ? 0 : 1);

export const TEILE: TeilTyp[] = [
  {
    art: "brett",
    name: "Brett",
    icon: "🪵",
    parameter: [
      { schluessel: "laenge", name: "Länge", einheit: "m", standard: 0.6, min: 0.05, max: 3 },
      { schluessel: "dicke", name: "Dicke", einheit: "m", standard: 0.02, min: 0.005, max: 0.2 },
      { schluessel: "tiefe", name: "Breite (in die Tiefe)", einheit: "m", standard: 0.1, min: 0.01, max: 0.5 },
      STOFF(0),
      MASSE_VORGABE,
    ],
    formen: t => [{ art: "kasten", mitte: { x: 0, y: 0 }, b: w(t, "laenge", 0.6), h: w(t, "dicke", 0.02) }],
    volumen: t => w(t, "laenge", 0.6) * w(t, "dicke", 0.02) * w(t, "tiefe", 0.1),
  },
  {
    art: "stange",
    name: "Stange",
    icon: "🥢",
    parameter: [
      { schluessel: "laenge", name: "Länge", einheit: "m", standard: 0.5, min: 0.02, max: 3 },
      { schluessel: "durchmesser", name: "Durchmesser", einheit: "m", standard: 0.012, min: 0.002, max: 0.1 },
      {
        // Von vorn sieht man eine Stange, die aus der Wand ragt, nur als Kreis
        // — und genau so wirkt sie auch: ein Stift, gegen den etwas stößt, an
        // dem etwas hängt, um den sich etwas dreht.
        schluessel: "stirn", name: "Ansicht", einheit: "", standard: 0, min: 0, max: 1,
        optionen: [{ wert: 0, name: "längs" }, { wert: 1, name: "von vorn (Stift)" }],
      },
      STOFF(1),
      MASSE_VORGABE,
    ],
    formen: t => {
      const r = w(t, "durchmesser", 0.012) / 2;
      if (w(t, "stirn", 0) >= 0.5) return [{ art: "kreis", mitte: { x: 0, y: 0 }, r }];
      const halb = Math.max(0, w(t, "laenge", 0.5) / 2 - r);
      return [{ art: "kapsel", a: { x: -halb, y: 0 }, b: { x: halb, y: 0 }, r }];
    },
    // Dieselbe Stange wiegt gleich viel, ob man sie längs oder von vorn sieht.
    volumen: t => Math.PI * (w(t, "durchmesser", 0.012) / 2) ** 2 * w(t, "laenge", 0.5),
  },
  {
    art: "klotz",
    name: "Klotz",
    icon: "🧱",
    parameter: [
      { schluessel: "breite", name: "Breite", einheit: "m", standard: 0.1, min: 0.01, max: 1 },
      { schluessel: "hoehe", name: "Höhe", einheit: "m", standard: 0.1, min: 0.01, max: 1 },
      { schluessel: "tiefe", name: "Tiefe", einheit: "m", standard: 0.1, min: 0.01, max: 1 },
      STOFF(0),
      MASSE_VORGABE,
    ],
    formen: t => [{ art: "kasten", mitte: { x: 0, y: 0 }, b: w(t, "breite", 0.1), h: w(t, "hoehe", 0.1) }],
    volumen: t => w(t, "breite", 0.1) * w(t, "hoehe", 0.1) * w(t, "tiefe", 0.1),
  },
  {
    art: "kugel",
    name: "Murmel",
    icon: "🔵",
    parameter: [
      { schluessel: "durchmesser", name: "Durchmesser", einheit: "m", standard: 0.02, min: 0.004, max: 0.3 },
      STOFF(2),
      MASSE_VORGABE,
    ],
    formen: t => [{ art: "kreis", mitte: { x: 0, y: 0 }, r: w(t, "durchmesser", 0.02) / 2 }],
    volumen: t => (Math.PI / 6) * w(t, "durchmesser", 0.02) ** 3,
  },
  {
    art: "scheibe",
    name: "Scheibe",
    icon: "⚙️",
    parameter: [
      { schluessel: "durchmesser", name: "Durchmesser", einheit: "m", standard: 0.2, min: 0.01, max: 2 },
      { schluessel: "dicke", name: "Dicke", einheit: "m", standard: 0.02, min: 0.002, max: 0.3 },
      STOFF(0),
      MASSE_VORGABE,
    ],
    formen: t => [{ art: "kreis", mitte: { x: 0, y: 0 }, r: w(t, "durchmesser", 0.2) / 2 }],
    volumen: t => Math.PI * (w(t, "durchmesser", 0.2) / 2) ** 2 * w(t, "dicke", 0.02),
  },
  {
    art: "zahnrad",
    name: "Zahnrad",
    icon: "⚙️",
    parameter: [
      { schluessel: "durchmesser", name: "Teilkreis", einheit: "m", standard: 0.2, min: 0.04, max: 1 },
      { schluessel: "zaehne", name: "Zähne", einheit: "", standard: 12, min: 6, max: 40 },
      { schluessel: "dicke", name: "Dicke", einheit: "m", standard: 0.02, min: 0.002, max: 0.2 },
      STOFF(1),
      MASSE_VORGABE,
    ],
    formen: zahnradFormen,
    volumen: t => Math.PI * (w(t, "durchmesser", 0.2) / 2) ** 2 * w(t, "dicke", 0.02),
  },
  {
    art: "massestueck",
    name: "Massestück",
    icon: "🏋️",
    // Beim Massestück ist die Masse das Wesentliche — sie steht drauf. Die
    // Größe folgt ihr, wie bei einem Satz Gewichte aus Messing.
    parameter: [
      { schluessel: "masse", name: "Masse", einheit: "kg", standard: 0.1, min: 0.001, max: 50 },
    ],
    formen: t => {
      const s = massestueckKante(w(t, "masse", 0.1));
      return [{ art: "kasten", mitte: { x: 0, y: 0 }, b: s, h: s }];
    },
    volumen: t => massestueckKante(w(t, "masse", 0.1)) ** 3,
  },

  {
    art: "linse",
    name: "Linse",
    icon: "🔎",
    parameter: [
      { schluessel: "durchmesser", name: "Durchmesser", einheit: "m", standard: 0.12, min: 0.02, max: 0.6 },
      {
        // Die Brennweite steht am echten Glas auch drauf; sie aus Krümmung und
        // Brechzahl auszurechnen wäre genauer und für den Unterricht im Weg.
        schluessel: "brennweite", name: "Brennweite", einheit: "m", standard: 0.25, min: -2, max: 2,
      },
      MASSE_VORGABE,
    ],
    formen: t => [{ art: "kasten", mitte: { x: 0, y: 0 }, b: linsenDicke(t), h: w(t, "durchmesser", 0.12) }],
    volumen: t => linsenDicke(t) * w(t, "durchmesser", 0.12) * 0.03,
  },
  {
    art: "spiegel",
    name: "Spiegel",
    icon: "🪞",
    parameter: [
      { schluessel: "durchmesser", name: "Länge", einheit: "m", standard: 0.2, min: 0.02, max: 1 },
      MASSE_VORGABE,
    ],
    formen: t => [{ art: "kasten", mitte: { x: 0, y: 0 }, b: 0.01, h: w(t, "durchmesser", 0.2) }],
    volumen: t => 0.01 * w(t, "durchmesser", 0.2) * 0.03,
  },

  elektrisch("batterie", "Batterie", "🔋", 0.12, 0.07, 0.3, [
    { schluessel: "spannung", name: "Spannung", einheit: "V", standard: 4.5, min: 0, max: 24, bedienung: true },
    { schluessel: "innenwiderstand", name: "Innenwiderstand", einheit: "Ohm", standard: 0.5, min: 0, max: 20 },
  ]),
  elektrisch("widerstand", "Widerstand", "🧱", 0.1, 0.04, 0.02, [
    { schluessel: "widerstand", name: "Widerstand", einheit: "Ohm", standard: 100, min: 0.1, max: 10000 },
  ]),
  elektrisch("lampe", "Lämpchen", "💡", 0.08, 0.08, 0.03, [
    { schluessel: "widerstand", name: "Widerstand", einheit: "Ohm", standard: 20, min: 0.5, max: 2000 },
    { schluessel: "nennleistung", name: "Nennleistung", einheit: "W", standard: 1, min: 0.05, max: 100 },
    WIRKUNGSGRAD(0.1),
  ]),
  elektrisch("strahler", "Strahler", "🔦", 0.1, 0.06, 0.15, [
    { schluessel: "widerstand", name: "Widerstand", einheit: "Ohm", standard: 5, min: 0.5, max: 500 },
    WIRKUNGSGRAD(0.6),
    { schluessel: "breite", name: "Bündelbreite", einheit: "m", standard: 0.05, min: 0.001, max: 0.4 },
    { schluessel: "oeffnung", name: "Öffnungswinkel", einheit: "rad", anzeige: "grad", standard: 0, min: 0, max: bogen(120) },
    { schluessel: "strahlen", name: "Strahlen", einheit: "", standard: 5, min: 1, max: 15 },
  ]),
  elektrisch("schalter", "Schalter", "🔘", 0.1, 0.04, 0.05, [
    {
      schluessel: "geschlossen", name: "Schalter", einheit: "", standard: 1, min: 0, max: 1, bedienung: true,
      optionen: [{ wert: 0, name: "offen" }, { wert: 1, name: "geschlossen" }],
    },
  ]),
  elektrisch("motor", "Motor", "⚡", 0.14, 0.1, 0.4, [
    { schluessel: "widerstand", name: "Ankerwiderstand", einheit: "Ohm", standard: 2, min: 0.1, max: 200 },
    {
      // Dieselbe Zahl trägt beide Richtungen: M = k·I und U = k·ω. Daran liegt
      // es, dass ein Motor, den man dreht, zum Dynamo wird.
      schluessel: "konstante", name: "Maschinenkonstante", einheit: "Nm", standard: 0.2, min: 0.01, max: 4,
    },
  ]),
];

/** Kantenlänge eines Messingwürfels dieser Masse. */
export const massestueckKante = (masse: number) => Math.cbrt(Math.max(1e-6, masse) / 8500);

export const teilTyp = (art: TeilArt | string): TeilTyp | undefined => TEILE.find(t => t.art === art);

export function standardWerteTeil(art: TeilArt): Record<string, number> {
  return Object.fromEntries((teilTyp(art)?.parameter ?? []).map(p => [p.schluessel, p.standard]));
}

/**
 * Die Masse eines Teils in Kilogramm.
 *
 * Vorgegeben schlägt berechnet; beim Massestück ist die Masse selbst die
 * Einstellung.
 */
export function teilMasse(t: Teil): number {
  if (t.art === "massestueck") return Math.max(1e-6, w(t, "masse", 0.1));
  const vorgabe = w(t, "masseVorgabe", 0);
  if (vorgabe > 0) return vorgabe;
  const typ = teilTyp(t.art);
  return Math.max(1e-6, feststoff(w(t, "stoff", 0)).dichte * (typ?.volumen(t) ?? 0));
}

/** Die Fläche der Gestalt in der Ebene — daraus wird die Dichte für den Löser. */
export function formFlaeche(f: Form): number {
  if (f.art === "kasten") return f.b * f.h;
  if (f.art === "kreis") return Math.PI * f.r * f.r;
  return Math.PI * f.r * f.r + 2 * f.r * Math.hypot(f.b.x - f.a.x, f.b.y - f.a.y);
}

/** Reibung und Sprung aus dem Werkstoff; das Massestück ist aus Messing. */
export function oberflaeche(t: Teil): { reibung: number; sprung: number; farbe: string } {
  if (t.art === "massestueck") return { reibung: 0.4, sprung: 0.1, farbe: "#c9a227" };
  // Elektrische Bauteile stecken in einem Gehäuse, nicht in einem Werkstoff,
  // den man einstellt — sie haben deshalb gar keine Werkstoffwahl.
  if (istElektrisch(t.art)) return { reibung: 0.5, sprung: 0.1, farbe: "#475569" };
  if (t.art === "linse") return { reibung: 0.2, sprung: 0.2, farbe: "#7dd3fc" };
  if (t.art === "spiegel") return { reibung: 0.2, sprung: 0.2, farbe: "#e2e8f0" };
  const s = feststoff(w(t, "stoff", 0));
  return { reibung: s.reibung, sprung: s.sprung, farbe: s.farbe };
}
