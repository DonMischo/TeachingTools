/**
 * Die Verbinder: was sie tun und was man an ihnen einstellt.
 *
 * Achse und Schraube sitzen an *einem* Punkt und verbinden, was dort
 * übereinander liegt — oder, liegt dort nur ein Teil, dieses mit der Wand.
 * Seil und Feder spannen sich zwischen *zwei* Punkten.
 */
import type { ParameterDef } from "../typen";
import type { VerbinderArt } from "./modell";

export interface VerbinderTyp {
  art: VerbinderArt;
  name: string;
  icon: string;
  /** Wie viele Klicks das Setzen braucht: einer an der Stelle, oder Anfang und Ende. */
  punkte: 1 | 2;
  hinweis: string;
  parameter: ParameterDef[];
}

export const VERBINDER: VerbinderTyp[] = [
  {
    art: "achse",
    name: "Achse",
    icon: "⚙️",
    punkte: 1,
    hinweis: "Auf eine Stelle tippen: was dort übereinander liegt, dreht sich umeinander — liegt dort nur ein Teil, dreht es sich an der Wand.",
    parameter: [
      { schluessel: "reibung", name: "Lagerreibung", einheit: "Nm", standard: 0, min: 0, max: 20 },
      { schluessel: "motorMoment", name: "Motor: Drehmoment", einheit: "Nm", standard: 0, min: 0, max: 500 },
      { schluessel: "drehzahl", name: "Motor: Drehzahl", einheit: "1/s", standard: 0, min: -20, max: 20, bedienung: true },
    ],
  },
  {
    art: "schraube",
    name: "Schraube",
    icon: "🔩",
    punkte: 1,
    hinweis: "Auf eine Stelle tippen: was dort übereinander liegt, wird fest verbunden — liegt dort nur ein Teil, wird es an die Wand geschraubt.",
    parameter: [
      { schluessel: "bruchkraft", name: "Bricht ab (0 = nie)", einheit: "N", standard: 0, min: 0, max: 2000 },
    ],
  },
  {
    art: "seil",
    name: "Seil",
    icon: "🪢",
    punkte: 2,
    hinweis: "Anfang und Ende antippen — ein Teil oder die Wand. Das Seil zieht, drückt aber nicht.",
    parameter: [
      { schluessel: "laenge", name: "Länge (0 = wie gespannt)", einheit: "m", standard: 0, min: 0, max: 5 },
    ],
  },
  {
    art: "feder",
    name: "Feder",
    icon: "〰️",
    punkte: 2,
    hinweis: "Anfang und Ende antippen. Ohne Last ist sie so lang, wie man sie gespannt hat.",
    parameter: [
      { schluessel: "federkonstante", name: "Federkonstante", einheit: "N/m", standard: 20, min: 0.5, max: 2000 },
      { schluessel: "laenge", name: "Ruhelänge (0 = wie gespannt)", einheit: "m", standard: 0, min: 0, max: 3 },
      { schluessel: "daempfung", name: "Dämpfung", einheit: "", standard: 0.05, min: 0, max: 1 },
    ],
  },
];

export const verbinderTyp = (art: VerbinderArt | string): VerbinderTyp | undefined =>
  VERBINDER.find(v => v.art === art);

export function standardWerteVerbinder(art: VerbinderArt): Record<string, number> {
  return Object.fromEntries((verbinderTyp(art)?.parameter ?? []).map(p => [p.schluessel, p.standard]));
}
