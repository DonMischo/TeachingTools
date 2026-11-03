/**
 * Zusammengesetzte Körper: Haus, Silo, Turm, Werkstück mit Bohrung, Eistüte.
 * Volumen werden addiert (bzw. die Bohrung abgezogen); bei der Oberfläche
 * fallen die Flächen weg, an denen die Teile aneinanderstoßen — die sind
 * verdeckt. Bausteine für die 3D-Ansicht und das Schrägbild gleich dazu.
 */
import { z } from "@/lib/prozent";
import { ist, liegendesPrisma, masseIn, prismaAus, type Feld, type Masse, type Polyeder, type Rund, type V3 } from "@/lib/koerper";
import { skizzePoly, skizzeStapel, schraeg, type Mass } from "@/lib/koerper-skizze";
import type { Skizze, Zug } from "@/lib/geometrie/skizze";

export type ZKey = "haus" | "silo" | "turm" | "werkstueck" | "eistuete";
export const Z_REIHE: ZKey[] = ["haus", "silo", "turm", "werkstueck", "eistuete"];

export type Zeile = { text: string; rechnung: string; wert: number; minus?: boolean };
export type ZDaten = { V: number; O: number; vZeilen: Zeile[]; oZeilen: Zeile[]; verdeckt: string };

/**
 * Ein Teil in 3D. `verdeckt`: Teilflächen, die im fertigen Körper innen liegen.
 * `weg`: das Teil ist herausgenommen (Bohrung). `kopf`: steht auf dem Kopf.
 * `abheben`: Richtung, in die es beim Auseinanderziehen wandert.
 */
export type Baustein = { name: string; poly?: Polyeder; rund?: Rund; kopf?: boolean; versatz: V3; abheben: V3; verdeckt?: string[]; weg?: boolean };

type ZLinie = { id: string; von: V3; bis: V3; kante?: boolean };

export type Zusammengesetzt = {
  key: ZKey; name: string; icon: string; aus: string;
  felder: Feld[];
  rechne: (m: Masse) => ZDaten;
  bausteine: (m: Masse) => Baustein[];
  linien: (m: Masse) => ZLinie[];
  bild: (m: Masse, masse: Mass[]) => Skizze;
};

const π = Math.PI;
const F = (key: string, label: string, min: number, max: number, start: number): Feld => ({ key, label, min, max, start });
const zeile = (text: string, rechnung: string, wert: number, minus = false): Zeile => ({ text, rechnung, wert, minus });
const summe = (zs: Zeile[]) => zs.reduce((s, x) => s + (x.minus ? -x.wert : x.wert), 0);
const daten = (vZeilen: Zeile[], oZeilen: Zeile[], verdeckt: string): ZDaten => ({ V: summe(vZeilen), O: summe(oZeilen), vZeilen, oZeilen, verdeckt });

const rechteck = (a: number, b: number): [number, number][] => [[-a / 2, b / 2], [a / 2, b / 2], [a / 2, -b / 2], [-a / 2, -b / 2]];
const hausQuer = (b: number, c: number, hd: number): [number, number][] => [[b / 2, 0], [-b / 2, 0], [-b / 2, c], [0, c + hd], [b / 2, c]];

const SEGMENTE = 36;
function kreisZug(m: V3, r: number, art: Zug["art"]): Zug {
  return { pts: Array.from({ length: SEGMENTE }, (_, i) => schraeg([m[0] + r * Math.cos(i / SEGMENTE * 2 * π), m[1], m[2] + r * Math.sin(i / SEGMENTE * 2 * π)])), art, geschlossen: true };
}

export const ZUSAMMEN: Record<ZKey, Zusammengesetzt> = {
  haus: {
    key: "haus", name: "Haus", icon: "🏠", aus: "Quader + dreiseitiges Prisma (Dach)",
    felder: [F("a", "Länge a", 4, 12, 8), F("b", "Breite b", 3, 10, 6), F("c", "Wandhöhe c", 2, 8, 4), F("hd", "Dachhöhe h_D", 1, 6, 3)],
    rechne: ({ a, b, c, hd }) => {
      const sd = Math.hypot(b / 2, hd);
      return daten(
        [
          zeile("Quader a · b · c", `${z(a)} · ${z(b)} · ${z(c)} ${ist(a * b * c, "cm³")}`, a * b * c),
          zeile("Dach (Prisma) ½ · b · h_D · a", `½ · ${z(b)} · ${z(hd)} · ${z(a)} ${ist(b * hd * a / 2, "cm³")}`, b * hd * a / 2),
        ],
        [
          zeile("Boden a · b", `${z(a)} · ${z(b)} ${ist(a * b, "cm²")}`, a * b),
          zeile("4 Wände 2 · a · c + 2 · b · c", `2 · ${z(a * c)} + 2 · ${z(b * c)} ${ist(2 * a * c + 2 * b * c, "cm²")}`, 2 * a * c + 2 * b * c),
          zeile("2 Giebeldreiecke 2 · ½ · b · h_D", `${z(b)} · ${z(hd)} ${ist(b * hd, "cm²")}`, b * hd),
          zeile("2 Dachflächen 2 · a · s", `s = √((b : 2)² + h_D²) ${ist(sd, "cm")}; 2 · ${z(a)} · ${z(sd)} ${ist(2 * a * sd, "cm²")}`, 2 * a * sd),
        ],
        "Die Deckfläche des Quaders und die Grundfläche des Dachs liegen aufeinander — beide fehlen in der Oberfläche.",
      );
    },
    bausteine: ({ a, b, c, hd }) => [
      { name: "Quader", poly: prismaAus(rechteck(a, b), c), versatz: [0, 0, 0], abheben: [0, 0, 0], verdeckt: ["D"] },
      { name: "Dach", poly: liegendesPrisma([[b / 2, 0], [-b / 2, 0], [0, hd]], a), versatz: [0, c, 0], abheben: [0, 1, 0], verdeckt: ["M1"] },
    ],
    linien: ({ a, b, c, hd }) => [
      { id: "a", von: [-a / 2, 0, b / 2], bis: [a / 2, 0, b / 2], kante: true },
      { id: "b", von: [a / 2, 0, b / 2], bis: [a / 2, 0, -b / 2], kante: true },
      { id: "c", von: [a / 2, 0, b / 2], bis: [a / 2, c, b / 2], kante: true },
      { id: "hd", von: [a / 2, c, 0], bis: [a / 2, c + hd, 0] },
    ],
    bild: ({ a, b, c, hd }, masse) => skizzePoly(liegendesPrisma(hausQuer(b, c, hd), a), masse),
  },
  silo: {
    key: "silo", name: "Silo", icon: "🌾", aus: "Zylinder + Halbkugel",
    felder: [F("r", "Radius r", 1, 6, 3), F("h", "Zylinderhöhe h", 2, 14, 8)],
    rechne: ({ r, h }) => daten(
      [
        zeile("Zylinder π · r² · h", `π · ${z(r)}² · ${z(h)} ${ist(π * r * r * h, "cm³")}`, π * r * r * h),
        zeile("Halbkugel ⅔ · π · r³", `2 : 3 · π · ${z(r)}³ ${ist(2 / 3 * π * r ** 3, "cm³")}`, 2 / 3 * π * r ** 3),
      ],
      [
        zeile("Boden π · r²", `π · ${z(r)}² ${ist(π * r * r, "cm²")}`, π * r * r),
        zeile("Zylindermantel 2 · π · r · h", `2 · π · ${z(r)} · ${z(h)} ${ist(2 * π * r * h, "cm²")}`, 2 * π * r * h),
        zeile("Kuppel 2 · π · r²", `2 · π · ${z(r)}² ${ist(2 * π * r * r, "cm²")}`, 2 * π * r * r),
      ],
      "Die Deckfläche des Zylinders und die Grundfläche der Halbkugel liegen aufeinander.",
    ),
    bausteine: ({ r, h }) => [
      { name: "Zylinder", rund: { art: "mantel", r1: r, r2: r, h }, versatz: [0, 0, 0], abheben: [0, 0, 0], verdeckt: ["D"] },
      { name: "Halbkugel", rund: { art: "halbkugel", r1: r, r2: 0, h: r }, versatz: [0, h, 0], abheben: [0, 1, 0], verdeckt: ["G"] },
    ],
    linien: ({ r, h }) => [
      { id: "r", von: [0, h, 0], bis: [r, h, 0] },
      { id: "h", von: [r, 0, 0], bis: [r, h, 0], kante: true },
    ],
    bild: ({ r, h }, masse) => skizzeStapel([{ typ: "mantel", r0: r, r1: r, y0: 0, y1: h }, { typ: "kuppel", r, y0: h, richtung: 1 }], masse),
  },
  turm: {
    key: "turm", name: "Turm", icon: "🏰", aus: "Zylinder + Kegel (Dach)",
    felder: [F("r", "Radius r", 1, 6, 2.5), F("h", "Zylinderhöhe h", 2, 14, 8), F("hk", "Kegelhöhe h_K", 1, 8, 4)],
    rechne: ({ r, h, hk }) => {
      const s = Math.hypot(r, hk);
      return daten(
        [
          zeile("Zylinder π · r² · h", `π · ${z(r)}² · ${z(h)} ${ist(π * r * r * h, "cm³")}`, π * r * r * h),
          zeile("Kegel ⅓ · π · r² · h_K", `⅓ · π · ${z(r)}² · ${z(hk)} ${ist(π * r * r * hk / 3, "cm³")}`, π * r * r * hk / 3),
        ],
        [
          zeile("Boden π · r²", `π · ${z(r)}² ${ist(π * r * r, "cm²")}`, π * r * r),
          zeile("Zylindermantel 2 · π · r · h", `2 · π · ${z(r)} · ${z(h)} ${ist(2 * π * r * h, "cm²")}`, 2 * π * r * h),
          zeile("Kegelmantel π · r · s", `s = √(r² + h_K²) ${ist(s, "cm")}; π · ${z(r)} · ${z(s)} ${ist(π * r * s, "cm²")}`, π * r * s),
        ],
        "Die Deckfläche des Zylinders und die Grundfläche des Kegels liegen aufeinander.",
      );
    },
    bausteine: ({ r, h, hk }) => [
      { name: "Zylinder", rund: { art: "mantel", r1: r, r2: r, h }, versatz: [0, 0, 0], abheben: [0, 0, 0], verdeckt: ["D"] },
      { name: "Kegel", rund: { art: "mantel", r1: r, r2: 0, h: hk }, versatz: [0, h, 0], abheben: [0, 1, 0], verdeckt: ["G"] },
    ],
    linien: ({ r, h, hk }) => [
      { id: "r", von: [0, 0, 0], bis: [r, 0, 0] },
      { id: "h", von: [-r, 0, 0], bis: [-r, h, 0], kante: true },
      { id: "hk", von: [0, h, 0], bis: [0, h + hk, 0] },
    ],
    bild: ({ r, h, hk }, masse) => skizzeStapel([{ typ: "mantel", r0: r, r1: r, y0: 0, y1: h }, { typ: "mantel", r0: r, r1: 0, y0: h, y1: h + hk }], masse),
  },
  werkstueck: {
    key: "werkstueck", name: "Werkstück mit Bohrung", icon: "🔩", aus: "Quader − Zylinder (Bohrung)",
    felder: [F("a", "Länge a", 6, 12, 8), F("b", "Breite b", 6, 12, 6), F("c", "Dicke c", 1, 8, 3), F("r", "Bohrradius r", 0.5, 2.5, 1.5)],
    rechne: ({ a, b, c, r }) => daten(
      [
        zeile("Quader a · b · c", `${z(a)} · ${z(b)} · ${z(c)} ${ist(a * b * c, "cm³")}`, a * b * c),
        zeile("Bohrung π · r² · c", `π · ${z(r)}² · ${z(c)} ${ist(π * r * r * c, "cm³")}`, π * r * r * c, true),
      ],
      [
        zeile("Quaderoberfläche 2 · (a · b + a · c + b · c)", `2 · (${z(a * b)} + ${z(a * c)} + ${z(b * c)}) ${ist(2 * (a * b + a * c + b * c), "cm²")}`, 2 * (a * b + a * c + b * c)),
        zeile("2 Kreise oben und unten 2 · π · r²", `2 · π · ${z(r)}² ${ist(2 * π * r * r, "cm²")}`, 2 * π * r * r, true),
        zeile("Innenwand der Bohrung 2 · π · r · c", `2 · π · ${z(r)} · ${z(c)} ${ist(2 * π * r * c, "cm²")}`, 2 * π * r * c),
      ],
      "Oben und unten fehlt je ein Kreis, dafür kommt innen die Mantelfläche der Bohrung dazu.",
    ),
    bausteine: ({ a, b, c, r }) => [
      { name: "Quader", poly: prismaAus(rechteck(a, b), c), versatz: [0, 0, 0], abheben: [0, 0, 0] },
      { name: "Bohrung", rund: { art: "mantel", r1: r, r2: r, h: c }, versatz: [0, 0, 0], abheben: [0, 1, 0], weg: true },
    ],
    linien: ({ a, b, c, r }) => [
      { id: "a", von: [-a / 2, 0, b / 2], bis: [a / 2, 0, b / 2], kante: true },
      { id: "b", von: [a / 2, 0, b / 2], bis: [a / 2, 0, -b / 2], kante: true },
      { id: "c", von: [a / 2, 0, b / 2], bis: [a / 2, c, b / 2], kante: true },
      { id: "r", von: [0, c, 0], bis: [r, c, 0] },
    ],
    bild: ({ a, b, c, r }, masse) => skizzePoly(prismaAus(rechteck(a, b), c), masse, {
      zuege: [kreisZug([0, c, 0], r, "sichtbar"), kreisZug([0, 0, 0], r, "verdeckt")],
    }),
  },
  eistuete: {
    key: "eistuete", name: "Eistüte", icon: "🍨", aus: "Kegel (Spitze unten) + Halbkugel",
    felder: [F("r", "Radius r", 1, 5, 2.5), F("h", "Tütenhöhe h", 3, 14, 10)],
    rechne: ({ r, h }) => {
      const s = Math.hypot(r, h);
      return daten(
        [
          zeile("Kegel ⅓ · π · r² · h", `⅓ · π · ${z(r)}² · ${z(h)} ${ist(π * r * r * h / 3, "cm³")}`, π * r * r * h / 3),
          zeile("Halbkugel ⅔ · π · r³", `2 : 3 · π · ${z(r)}³ ${ist(2 / 3 * π * r ** 3, "cm³")}`, 2 / 3 * π * r ** 3),
        ],
        [
          zeile("Kegelmantel π · r · s", `s = √(r² + h²) ${ist(s, "cm")}; π · ${z(r)} · ${z(s)} ${ist(π * r * s, "cm²")}`, π * r * s),
          zeile("Kuppel 2 · π · r²", `2 · π · ${z(r)}² ${ist(2 * π * r * r, "cm²")}`, 2 * π * r * r),
        ],
        "Die Kreisfläche oben am Kegel und unten an der Halbkugel liegen aufeinander.",
      );
    },
    bausteine: ({ r, h }) => [
      { name: "Kegel", rund: { art: "mantel", r1: r, r2: 0, h }, kopf: true, versatz: [0, 0, 0], abheben: [0, 0, 0], verdeckt: ["G"] },
      { name: "Halbkugel", rund: { art: "halbkugel", r1: r, r2: 0, h: r }, versatz: [0, h, 0], abheben: [0, 1, 0], verdeckt: ["G"] },
    ],
    linien: ({ r, h }) => [
      { id: "r", von: [0, h, 0], bis: [r, h, 0] },
      { id: "h", von: [0, 0, 0], bis: [0, h, 0] },
    ],
    bild: ({ r, h }, masse) => skizzeStapel([{ typ: "mantel", r0: 0, r1: r, y0: 0, y1: h }, { typ: "kuppel", r, y0: h, richtung: 1 }], masse),
  },
};

export const zStart = (k: Zusammengesetzt): Masse => masseIn(k, {});

/** Schrägbild eines zusammengesetzten Körpers, beschriftet wie `skizzeKoerper`. */
export function skizzeZusammen(key: ZKey, m: Masse, texte: Partial<Record<string, string>> = {}): Skizze {
  const k = ZUSAMMEN[key];
  const masse: Mass[] = k.linien(m).flatMap(l => {
    const t = texte[l.id];
    if (t === undefined) return [];
    return [{ von: l.von, bis: l.bis, text: t, art: t.includes("?") ? "gesucht" : l.kante ? "kante" : "hilfe" } as Mass];
  });
  return k.bild(m, masse);
}
