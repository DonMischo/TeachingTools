/**
 * Die Verbinder: was sie tun und was man an ihnen einstellt.
 *
 * Achse und Schraube sitzen an *einem* Punkt und verbinden, was dort
 * übereinander liegt — oder, liegt dort nur ein Teil, dieses mit der Wand.
 * Seil und Feder spannen sich zwischen *zwei* Punkten.
 */
import { bogen } from "../einheiten";
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
      { schluessel: "loestNach", name: "Löst nach (0 = nie)", einheit: "s", standard: 0, min: 0, max: 60, bedienung: true },
      { schluessel: "loestBeiWinkel", name: "Löst bei Drehung (0 = nie)", einheit: "rad", anzeige: "grad", standard: 0, min: bogen(-360), max: bogen(360) },
    ],
  },
  {
    art: "seil",
    name: "Seil",
    icon: "🪢",
    punkte: 2,
    hinweis: "Anfang und Ende antippen — ein Teil oder die Wand. Unterwegs die Mitte einer Scheibe antippen: dort läuft das Seil über sie, und aus zwei Rollen wird ein Flaschenzug. Das Seil zieht, drückt aber nicht. Sitzt der Anfang am Rand einer Scheibe, wird mit »Wickelt auf« eine Winde daraus.",
    parameter: [
      { schluessel: "laenge", name: "Länge (0 = wie gespannt)", einheit: "m", standard: 0, min: 0, max: 5 },
      {
        /*
         * Die Winde: das Seil sitzt am Rand einer Scheibe und wickelt sich auf,
         * wenn sie sich dreht. Der Hebelarm ist der Abstand vom Mittelpunkt.
         *
         * Zwei Bauarten, und sie unterscheiden sich erst am Anschlag:
         *
         * - **Offen** wie ein Haspel ohne Gehäuse. Ist das Seil ganz
         *   aufgewickelt, hängt die Last am Kranz und wird von da an
         *   mitgenommen — über den Scheitel und auf der anderen Seite wieder
         *   hinunter.
         * - **Geschlossen** wie eine Seilwinde mit Öffnung. Dort bleibt die
         *   Last hängen, und wer weiterkurbelt, spannt nur noch. Mit einer
         *   Bruchkraft reißt das Seil dann irgendwann.
         *
         * Ohne Winde bleibt das Seilende einfach am Kranz festgebunden und
         * dreht mit der Scheibe mit.
         */
        schluessel: "wickelt", name: "Wickelt auf das Teil am Anfang", einheit: "", standard: 0, min: 0, max: 2,
        optionen: [
          { wert: 0, name: "nein — am Kranz angebunden" },
          { wert: 1, name: "offene Winde" },
          { wert: 2, name: "geschlossene Winde" },
        ],
      },
      { schluessel: "bruchkraft", name: "Reißt bei (0 = nie)", einheit: "N", standard: 0, min: 0, max: 20000 },
      {
        schluessel: "wickelrichtung", name: "Wickelrichtung", einheit: "", standard: 1, min: -1, max: 1,
        optionen: [{ wert: 1, name: "linksherum zieht an" }, { wert: -1, name: "rechtsherum zieht an" }],
      },
      { schluessel: "loestNach", name: "Löst nach (0 = nie)", einheit: "s", standard: 0, min: 0, max: 60, bedienung: true },
      { schluessel: "loestBeiWinkel", name: "Löst bei Drehung (0 = nie)", einheit: "rad", anzeige: "grad", standard: 0, min: bogen(-360), max: bogen(360) },
    ],
  },
  {
    art: "kabel",
    name: "Kabel",
    icon: "🔌",
    punkte: 2,
    hinweis: "Zwei Anschlüsse antippen — links oder rechts an einem Bauteil. Ein Kabel ist kein Bauteil, sondern ein Gleichheitszeichen: was es verbindet, ist derselbe Knoten.",
    parameter: [],
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
