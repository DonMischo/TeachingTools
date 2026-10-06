/**
 * Unscharfe Hilfe (Fuzzy-Logik): Wie viel Hilfe braucht jemand gerade?
 *
 * Drei Eingänge — Fehlversuche, verbrauchte Zeit (im Verhältnis zur Richtzeit),
 * Untätigkeit in Sekunden — werden in »wenig / mittel / viel« übersetzt, ein
 * paar Regeln verknüpfen sie, und der gewichtete Mittelwert ergibt einen
 * Hilfebedarf zwischen 0 und 1. Daraus folgt die Hilfestufe:
 *   0 nichts · 1 Tipp anbieten · 2 konkreter Hinweis · 3 Vorführen anbieten
 * Im Hilfsmodus steigt der Bedarf schneller, Vorführen ist immer da.
 */
const rampeAuf = (x: number, a: number, b: number) => (x <= a ? 0 : x >= b ? 1 : (x - a) / (b - a));
const rampeAb = (x: number, a: number, b: number) => 1 - rampeAuf(x, a, b);
const dreieck = (x: number, a: number, m: number, b: number) => (x <= a || x >= b ? 0 : x <= m ? (x - a) / (m - a) : (b - x) / (b - m));

export interface HilfeEingang { fehlversuche: number; zeitAnteil: number; untaetig: number; hilfsmodus?: boolean }

export function hilfebedarf(e: HilfeEingang): number {
  const f = { wenig: rampeAb(e.fehlversuche, 0, 2), mittel: dreieck(e.fehlversuche, 0.5, 2, 3.5), viel: rampeAuf(e.fehlversuche, 2, 4) };
  const z = { kurz: rampeAb(e.zeitAnteil, 0.5, 1), normal: dreieck(e.zeitAnteil, 0.5, 1, 1.8), lang: rampeAuf(e.zeitAnteil, 1, 2) };
  const u = { aktiv: rampeAb(e.untaetig, 20, 60), haengt: rampeAuf(e.untaetig, 20, 60) };
  const und = Math.min, oder = Math.max;
  // [Stärke der Regel, Ausgang: 0.05 kaum · 0.45 etwas · 0.7 deutlich · 0.95 viel]
  const regeln: [number, number][] = [
    [und(f.wenig, z.kurz, u.aktiv), 0.05],
    [und(f.wenig, z.normal), 0.3],
    [oder(f.mittel, z.lang), 0.55],
    [und(f.mittel, z.lang), 0.8],
    [u.haengt, 0.6],
    [und(u.haengt, oder(f.mittel, z.lang)), 0.85],
    [f.viel, 0.95],
    [und(f.viel, oder(z.lang, u.haengt)), 1],
  ];
  const summe = regeln.reduce((s, [w]) => s + w, 0);
  const roh = summe ? regeln.reduce((s, [w, o]) => s + w * o, 0) / summe : 0;
  return e.hilfsmodus ? Math.min(1, roh * 1.4 + 0.15) : roh;
}

export type Hilfestufe = 0 | 1 | 2 | 3;

export function hilfestufe(e: HilfeEingang): Hilfestufe {
  const b = hilfebedarf(e);
  if (b >= 0.75) return 3;
  if (b >= 0.55) return 2;
  if (b >= 0.35) return 1;
  return 0;
}
