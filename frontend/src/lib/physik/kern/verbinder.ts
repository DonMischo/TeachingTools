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
    hinweis: "Anfang und Ende antippen — ein Teil oder die Wand. Das Seil zieht, drückt aber nicht. Setzt man den Anfang an den Rand einer Scheibe und schaltet »Wickelt auf« ein, wird eine Winde daraus.",
    parameter: [
      { schluessel: "laenge", name: "Länge (0 = wie gespannt)", einheit: "m", standard: 0, min: 0, max: 5 },
      {
        // Die Winde: das Seil sitzt am Rand einer Scheibe und wickelt sich auf,
        // wenn sie sich dreht. Der Hebelarm ist der Abstand vom Mittelpunkt.
        schluessel: "wickelt", name: "Wickelt auf das Teil am Anfang", einheit: "", standard: 0, min: 0, max: 1,
        optionen: [{ wert: 0, name: "nein" }, { wert: 1, name: "ja — Winde" }],
      },
      {
        schluessel: "wickelrichtung", name: "Wickelrichtung", einheit: "", standard: 1, min: -1, max: 1,
        optionen: [{ wert: 1, name: "linksherum zieht an" }, { wert: -1, name: "rechtsherum zieht an" }],
      },
      {
        // Ein Seil aus Gliedern hat Gestalt: es kann über eine Rolle laufen.
        // Das kostet Körper, deshalb nur, wenn man es braucht.
        schluessel: "glieder", name: "Glieder (0 = straffes Seil)", einheit: "", standard: 0, min: 0, max: 60,
      },
      { schluessel: "masseProMeter", name: "Masse je Meter", einheit: "kg", standard: 0.15, min: 0.01, max: 3 },
      { schluessel: "loestNach", name: "Löst nach (0 = nie)", einheit: "s", standard: 0, min: 0, max: 60, bedienung: true },
      { schluessel: "loestBeiWinkel", name: "Löst bei Drehung (0 = nie)", einheit: "rad", anzeige: "grad", standard: 0, min: bogen(-360), max: bogen(360) },
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
