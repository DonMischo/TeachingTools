/**
 * Fertige Schaltungen zum Ausprobieren — geordnet wie im Physikunterricht,
 * vom ersten Stromkreis bis zum Gleichrichter.
 *
 * Gebaut mit zwei Helfern: `T` setzt ein Bauteil von a nach b, `D` zieht einen
 * Draht durch eine Folge von Punkten. Was sich trifft, ist verbunden (siehe
 * `normalisiere`); Drähte, die sich nur kreuzen, sind es nicht.
 */
import type { Bauteil, BauteilArt, Draht, Schaltung } from "./modell";
import { normalisiere } from "./editor";

function bau(f: (T: (art: BauteilArt, ax: number, ay: number, bx: number, by: number, werte?: Record<string, number>) => void,
  D: (...xy: number[]) => void) => void): Schaltung {
  const bauteile: Bauteil[] = [], draehte: Draht[] = [];
  f(
    (art, ax, ay, bx, by, werte = {}) => { bauteile.push({ id: `b${bauteile.length + 1}`, art, a: { x: ax, y: ay }, b: { x: bx, y: by }, werte }); },
    (...xy) => {
      for (let k = 0; k + 3 < xy.length; k += 2) {
        draehte.push({ id: `d${draehte.length + 1}`, a: { x: xy[k], y: xy[k + 1] }, b: { x: xy[k + 2], y: xy[k + 3] } });
      }
    },
  );
  return normalisiere({ version: 1, bauteile, draehte });
}

export interface Beispiel {
  id: string;
  name: string;
  /** Was man damit ausprobieren kann. */
  idee: string;
  /** Empfohlenes Tempo (Zeitlupe für Wechselstrom und Schwingkreis). */
  tempo?: number;
  schaltung: Schaltung;
}

/** Batterie, Schalter, Lämpchen — der erste Stromkreis im Unterricht. */
export const START = bau((T, D) => {
  T("batterie", 4, 10, 4, 4);
  T("schalter", 8, 4, 12, 4, { geschlossen: 1 });
  T("lampe", 16, 4, 16, 10);
  D(4, 4, 8, 4); D(12, 4, 16, 4); D(16, 10, 4, 10);
});

export const BEISPIELE: Beispiel[] = [
  { id: "einfach", name: "Einfacher Stromkreis", idee: "Schalter öffnen und schließen. Wo fließt Strom, wo nicht?", schaltung: START },
  {
    id: "reihe", name: "Reihenschaltung", idee: "Zwei Lämpchen hintereinander: Beide leuchten schwächer, und überall fließt derselbe Strom.",
    schaltung: bau((T, D) => {
      T("batterie", 2, 10, 2, 4);
      T("lampe", 6, 4, 10, 4); T("lampe", 10, 4, 14, 4);
      T("amperemeter", 14, 10, 8, 10);
      D(2, 4, 6, 4); D(14, 4, 18, 4, 18, 10, 14, 10); D(8, 10, 2, 10);
    }),
  },
  {
    id: "parallel", name: "Parallelschaltung", idee: "Jedes Lämpchen hat seinen eigenen Weg und leuchtet hell. Der Strom im Hauptzweig ist die Summe.",
    schaltung: bau((T, D) => {
      T("batterie", 2, 12, 2, 4);
      T("lampe", 10, 4, 10, 12); T("lampe", 16, 4, 16, 12);
      T("amperemeter", 2, 4, 6, 4);
      D(6, 4, 10, 4, 16, 4); D(16, 12, 10, 12, 2, 12);
    }),
  },
  {
    id: "und", name: "UND-Schaltung", idee: "Zwei Schalter in Reihe: Das Lämpchen leuchtet nur, wenn beide geschlossen sind.",
    schaltung: bau((T, D) => {
      T("batterie", 2, 10, 2, 4);
      T("schalter", 4, 4, 8, 4); T("schalter", 10, 4, 14, 4);
      T("lampe", 18, 4, 18, 10);
      D(2, 4, 4, 4); D(8, 4, 10, 4); D(14, 4, 18, 4); D(18, 10, 2, 10);
    }),
  },
  {
    id: "oder", name: "ODER-Schaltung", idee: "Zwei Schalter parallel: Einer genügt, damit das Lämpchen leuchtet.",
    schaltung: bau((T, D) => {
      T("batterie", 2, 12, 2, 4);
      T("schalter", 6, 4, 10, 4); T("schalter", 6, 8, 10, 8);
      T("lampe", 14, 4, 14, 12);
      D(2, 4, 6, 4); D(10, 4, 14, 4); D(6, 4, 6, 8); D(10, 8, 10, 4); D(14, 12, 2, 12);
    }),
  },
  {
    id: "wechsel", name: "Wechselschaltung (Treppenhaus)", idee: "Unten und oben an der Treppe je ein Umschalter: Jeder kann das Licht ein- und ausschalten.",
    schaltung: bau((T, D) => {
      T("batterie", 2, 14, 2, 8);
      T("umschalter", 4, 8, 8, 8);
      T("umschalter", 16, 8, 12, 8);
      T("lampe", 18, 8, 18, 14);
      D(2, 8, 4, 8); D(8, 8, 12, 8); D(8, 6, 10, 6, 10, 10, 12, 10); D(16, 8, 18, 8); D(18, 14, 2, 14);
    }),
  },
  {
    id: "teiler", name: "Spannungsteiler", idee: "1 kΩ und 2 kΩ an 9 V: Die Spannung teilt sich im Verhältnis der Widerstände.",
    schaltung: bau((T, D) => {
      T("batterie", 2, 12, 2, 4, { spannung: 9, innenwiderstand: 0.01 });
      T("widerstand", 8, 4, 8, 8, { widerstand: 1000 });
      T("widerstand", 8, 8, 8, 12, { widerstand: 2000 });
      T("voltmeter", 12, 8, 12, 12);
      D(2, 4, 8, 4); D(8, 12, 2, 12); D(8, 8, 12, 8); D(12, 12, 8, 12);
    }),
  },
  {
    id: "led", name: "LED mit Vorwiderstand", idee: "Der Widerstand begrenzt den Strom. Ersetze ihn durch eine Leitung — was passiert mit der LED?",
    schaltung: bau((T, D) => {
      T("batterie", 2, 10, 2, 4);
      T("widerstand", 4, 4, 8, 4, { widerstand: 150 });
      T("led", 8, 4, 12, 4);
      T("amperemeter", 14, 4, 14, 10);
      D(2, 4, 4, 4); D(12, 4, 14, 4); D(14, 10, 2, 10);
    }),
  },
  {
    id: "kurzschluss", name: "Kurzschluss und Sicherung", idee: "Schließe den Schalter: Der Strom umgeht das Lämpchen, wird riesig — und die Sicherung löst aus.",
    schaltung: bau((T, D) => {
      T("batterie", 2, 12, 2, 4);
      T("sicherung", 4, 4, 8, 4, { nennstrom: 1 });
      T("lampe", 12, 4, 12, 12);
      T("schalter", 16, 4, 16, 12);
      D(2, 4, 4, 4); D(8, 4, 12, 4, 16, 4); D(16, 12, 12, 12, 2, 12);
    }),
  },
  {
    id: "kondensator", name: "Kondensator laden und entladen", idee: "Umschalter: laden über 1 kΩ, entladen über 1 kΩ. Nach τ = R·C = 1 s sind 63 % erreicht — das Oszilloskop zeigt die Kurve.",
    schaltung: bau((T, D) => {
      T("batterie", 2, 14, 2, 4, { spannung: 9 });
      T("widerstand", 2, 4, 6, 4, { widerstand: 1000 });
      T("umschalter", 10, 4, 6, 4);
      T("widerstand", 6, 6, 6, 14, { widerstand: 1000 });
      T("kondensator", 12, 4, 12, 14, { kapazitaet: 1e-3 });
      T("voltmeter", 16, 4, 16, 14);
      D(10, 4, 12, 4, 16, 4); D(16, 14, 12, 14, 6, 14, 2, 14);
    }),
  },
  {
    id: "spule", name: "Spule verzögert den Einschaltstrom", idee: "Schalter schließen: Das Lämpchen hinter der Spule leuchtet später auf — die Spule wehrt sich gegen die Änderung des Stroms.",
    schaltung: bau((T, D) => {
      T("batterie", 2, 14, 2, 4);
      T("schalter", 4, 4, 8, 4);
      T("widerstand", 12, 4, 12, 8, { widerstand: 2.5 });
      T("lampe", 12, 8, 12, 14);
      T("spule", 20, 4, 20, 8, { induktivitaet: 10, widerstand: 2.5 });
      T("lampe", 20, 8, 20, 14);
      D(2, 4, 4, 4); D(8, 4, 12, 4, 20, 4); D(20, 14, 12, 14, 2, 14);
    }),
  },
  {
    id: "schwingkreis", name: "Schwingkreis", idee: "Erst laden, dann umschalten: Die Energie pendelt zwischen Kondensator und Spule hin und her (f ≈ 16 Hz). In Zeitlupe ansehen.",
    tempo: 0.02,
    schaltung: bau((T, D) => {
      T("batterie", 2, 12, 2, 4, { spannung: 9 });
      T("umschalter", 10, 4, 6, 4);
      T("spule", 6, 6, 6, 12, { induktivitaet: 1, widerstand: 1 });
      T("kondensator", 12, 4, 12, 12, { kapazitaet: 1e-4 });
      D(2, 4, 6, 4); D(10, 4, 12, 4); D(12, 12, 6, 12, 2, 12);
    }),
  },
  {
    id: "trafo", name: "Transformator", idee: "600 zu 300 Windungen: Aus 12 V werden 6 V. Ändere die Windungszahlen im Inspektor.",
    schaltung: bau((T, D) => {
      T("wechselquelle", 2, 10, 2, 4, { spannung: 12 });
      T("trafo", 8, 10, 12, 10);
      T("lampe", 18, 4, 18, 10, { nennspannung: 6, nennleistung: 1.2 });
      T("voltmeter", 22, 4, 22, 10);
      D(2, 4, 8, 4, 8, 8); D(2, 10, 8, 10); D(12, 8, 12, 4, 18, 4, 22, 4); D(12, 10, 18, 10, 22, 10);
    }),
  },
  {
    id: "einweg", name: "Einweggleichrichter", idee: "Die Diode lässt nur eine Halbwelle durch. Schließe den Schalter: Der Kondensator glättet. Oszilloskop am Widerstand.",
    tempo: 0.02,
    schaltung: bau((T, D) => {
      T("wechselquelle", 2, 10, 2, 4);
      T("diode", 4, 4, 8, 4);
      T("widerstand", 12, 4, 12, 10, { widerstand: 100 });
      T("schalter", 16, 4, 20, 4);
      T("kondensator", 20, 4, 20, 10, { kapazitaet: 2e-3 });
      D(2, 4, 4, 4); D(8, 4, 12, 4, 16, 4); D(20, 10, 12, 10, 2, 10);
    }),
  },
  {
    id: "bruecke", name: "Brückengleichrichter", idee: "Vier Dioden drehen die untere Halbwelle um: Durch den Widerstand fließt der Strom immer in dieselbe Richtung.",
    tempo: 0.02,
    schaltung: bau((T, D) => {
      T("wechselquelle", 2, 12, 2, 4);
      T("diode", 10, 4, 14, 8); T("diode", 10, 12, 14, 8);
      T("diode", 6, 8, 10, 4); T("diode", 6, 8, 10, 12);
      T("widerstand", 18, 8, 18, 14, { widerstand: 100 });
      D(2, 4, 10, 4); D(2, 12, 10, 12); D(14, 8, 18, 8); D(18, 14, 6, 14, 6, 8);
    }),
  },
  {
    id: "motor", name: "Motor", idee: "Beim Anlaufen zieht der Motor viel Strom, im Lauf wenig — er erzeugt selbst eine Gegenspannung.",
    schaltung: bau((T, D) => {
      T("batterie", 2, 10, 2, 4);
      T("schalter", 4, 4, 8, 4);
      T("amperemeter", 8, 4, 14, 4);
      T("motor", 16, 4, 16, 10);
      D(2, 4, 4, 4); D(14, 4, 16, 4); D(16, 10, 2, 10);
    }),
  },
];
