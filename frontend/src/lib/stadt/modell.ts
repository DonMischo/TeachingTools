/**
 * Datenmodell eines Stadtplans: Straßen als Linienzüge, Mauern als
 * Polygone, Viertel (Zonen) und einzelne Bauwerke. Häuser entstehen beim
 * Zeichnen entlang der Straßen (siehe haeuser.ts) — das Modell kennt nur
 * das, was Menschen planen.
 */
import type { P } from "./geometrie";

export const STILE = [
  { id: "roemisch", icon: "🏛️", label: "Römische Stadt", kurz: "Römisch" },
  { id: "europaeisch", icon: "⛪", label: "Europäische Stadt", kurz: "Europäisch" },
  { id: "amerikanisch", icon: "🏙️", label: "Amerikanische Stadt", kurz: "Amerikanisch" },
] as const;
export type Stil = (typeof STILE)[number]["id"];

export const STRASSEN = {
  fernstrasse: { label: "Fernstraße", breite: 9, farbe: "#e8d9b0", rand: "#8a7a55" },
  haupt: { label: "Hauptstraße", breite: 12, farbe: "#fff6dc", rand: "#7c6a48" },
  neben: { label: "Nebenstraße", breite: 7, farbe: "#fbf7ec", rand: "#8c8170" },
  gasse: { label: "Gasse", breite: 4, farbe: "#f4efe4", rand: "#9a8f80" },
  ring: { label: "Ring / Boulevard", breite: 26, farbe: "#fff6dc", rand: "#4f7f3a" },
  autobahn: { label: "Autobahn / Highway", breite: 30, farbe: "#f7c46c", rand: "#9a5f12" },
  bahn: { label: "Eisenbahn", breite: 8, farbe: "#3b3b3b", rand: "#3b3b3b" },
  aquaedukt: { label: "Aquädukt", breite: 5, farbe: "#c7a77e", rand: "#6e5232" },
} as const;
export type StrassenArt = keyof typeof STRASSEN;

/** Häuser eines Viertels: Breite an der Straße, Tiefe, Lücke, Höhe in m */
export interface HausArt { breite: [number, number]; tiefe: [number, number]; luecke: number; hoehe: [number, number]; dach: string; abseits?: number }

export const ZONEN = {
  // Römisch
  insulae: { label: "Insulae (Wohnblöcke)", farbe: "#d9a066", haus: { breite: [14, 22], tiefe: [14, 22], luecke: 1, hoehe: [8, 14], dach: "#c2703d" } },
  suburbium: { label: "Suburbium (Vorstadt)", farbe: "#e2b98a", haus: { breite: [10, 16], tiefe: [10, 14], luecke: 6, hoehe: [5, 7], dach: "#c27a4d" } },
  verlassen: { label: "Aufgegeben", farbe: "#b9b2a4", haus: { breite: [8, 12], tiefe: [6, 10], luecke: 18, hoehe: [2, 3], dach: "#9d968a" } },
  // Europäisch
  dorf: { label: "Siedlung", farbe: "#d8c39a", haus: { breite: [10, 14], tiefe: [8, 12], luecke: 14, hoehe: [5, 7], dach: "#a8643c" } },
  altstadt: { label: "Altstadt", farbe: "#d7a072", haus: { breite: [6, 10], tiefe: [12, 18], luecke: 0, hoehe: [9, 15], dach: "#b4532a" } },
  vorstadt: { label: "Vorstadt", farbe: "#dcb48a", haus: { breite: [8, 12], tiefe: [10, 14], luecke: 4, hoehe: [6, 9], dach: "#b7653a" } },
  gruenderzeit: { label: "Gründerzeitviertel", farbe: "#c9a58b", haus: { breite: [16, 22], tiefe: [14, 18], luecke: 0, hoehe: [16, 20], dach: "#8f5a46" } },
  industrie: { label: "Industrie", farbe: "#a9a29b", haus: { breite: [30, 60], tiefe: [24, 40], luecke: 10, hoehe: [10, 18], dach: "#77706a" } },
  grosssiedlung: { label: "Großwohnsiedlung", farbe: "#c0c4ca", haus: { breite: [60, 90], tiefe: [12, 14], luecke: 30, hoehe: [30, 45], dach: "#9aa0a8", abseits: 14 } },
  einfamilienhaus: { label: "Einfamilienhäuser", farbe: "#d6dcb6", haus: { breite: [10, 12], tiefe: [9, 11], luecke: 12, hoehe: [6, 8], dach: "#b2503a", abseits: 8 } },
  gewerbe: { label: "Gewerbegebiet", farbe: "#c8bfd6", haus: { breite: [40, 80], tiefe: [30, 50], luecke: 30, hoehe: [8, 12], dach: "#8e88a0", abseits: 12 } },
  park: { label: "Grünanlage", farbe: "#9cc47c", haus: null },
  // Amerikanisch
  kleinstadt: { label: "Kleinstadt (Main Street)", farbe: "#d8bc8e", haus: { breite: [8, 12], tiefe: [16, 22], luecke: 2, hoehe: [6, 9], dach: "#a16a46" } },
  cbd: { label: "Innenstadt (CBD)", farbe: "#a9b6c6", haus: { breite: [24, 36], tiefe: [24, 36], luecke: 4, hoehe: [40, 160], dach: "#7f8fa3" } },
  uebergang: { label: "Übergangszone", farbe: "#bfae9d", haus: { breite: [14, 22], tiefe: [14, 20], luecke: 10, hoehe: [8, 14], dach: "#8d7664" } },
  arbeiter: { label: "Arbeiterviertel", farbe: "#d1b48f", haus: { breite: [8, 10], tiefe: [12, 16], luecke: 3, hoehe: [7, 9], dach: "#9c5f3e" } },
  vorort: { label: "Wohnviertel (Streetcar Suburb)", farbe: "#d8d0a4", haus: { breite: [10, 14], tiefe: [10, 14], luecke: 8, hoehe: [7, 9], dach: "#8c5442", abseits: 6 } },
  pendler: { label: "Vororte (Suburbs)", farbe: "#dbe3b4", haus: { breite: [14, 18], tiefe: [12, 16], luecke: 14, hoehe: [5, 7], dach: "#7b6a5a", abseits: 10 } },
  parkplatz: { label: "Parkplätze", farbe: "#b8b8b8", haus: null },
} as const satisfies Record<string, { label: string; farbe: string; haus: HausArt | null }>;
export type ZonenTyp = keyof typeof ZONEN;

export interface Bauart { label: string; icon: string; b: number; h: number; hoehe: number; farbe: string; text: string }

export const BAUTEN = {
  forum: { label: "Forum", icon: "🏛️", b: 90, h: 60, hoehe: 4, farbe: "#efe3c8", text: "Marktplatz, Gericht und Treffpunkt der römischen Stadt — an der Kreuzung von Cardo und Decumanus." },
  tempel: { label: "Tempel (Kapitol)", icon: "🏺", b: 30, h: 44, hoehe: 20, farbe: "#f2ecdc", text: "Haupttempel für Jupiter, Juno und Minerva, meist am Forum." },
  thermen: { label: "Thermen", icon: "♨️", b: 60, h: 50, hoehe: 14, farbe: "#e8d4b4", text: "Öffentliche Bäder — brauchen viel Wasser aus dem Aquädukt." },
  theater: { label: "Theater", icon: "🎭", b: 70, h: 50, hoehe: 16, farbe: "#e6d6b8", text: "Halbrund für Schauspiele, oft innerhalb der Mauer." },
  amphitheater: { label: "Amphitheater", icon: "🏟️", b: 110, h: 90, hoehe: 20, farbe: "#d8c09a", text: "Arena für Gladiatoren, wegen der Menschenmassen meist vor der Mauer." },
  nekropole: { label: "Gräberfeld", icon: "⚱️", b: 80, h: 40, hoehe: 2, farbe: "#c9c2b0", text: "Römisches Recht verbot Bestattungen in der Stadt — Gräber reihten sich an den Ausfallstraßen." },
  castellum: { label: "Wasserverteiler", icon: "💧", b: 14, h: 14, hoehe: 8, farbe: "#c7a77e", text: "Castellum divisorum: Hier endet der Aquädukt und verteilt das Wasser." },
  hafen: { label: "Hafen / Anlegestelle", icon: "⚓", b: 60, h: 24, hoehe: 4, farbe: "#b49a74", text: "Am Fluss oder an der Küste: Handel mit Waren von weit her." },
  villa: { label: "Gutshof (Villa rustica)", icon: "🌾", b: 40, h: 30, hoehe: 6, farbe: "#e0c79c", text: "Landgut vor der Stadt, versorgt die Stadt mit Getreide." },
  burg: { label: "Burg", icon: "🏰", b: 60, h: 50, hoehe: 24, farbe: "#b9b1a6", text: "Sitz des Stadtherrn, auf einer Anhöhe — gut zu verteidigen und weit zu sehen." },
  kirche: { label: "Kirche", icon: "⛪", b: 24, h: 56, hoehe: 40, farbe: "#d9d2c6", text: "Pfarrkirche, oft direkt am Markt — höchster Bau der Stadt." },
  markt: { label: "Marktplatz", icon: "🧺", b: 70, h: 50, hoehe: 0, farbe: "#efe6d0", text: "Mittelpunkt der Handelsstadt, an der Fernstraße nahe Furt oder Brücke." },
  rathaus: { label: "Rathaus", icon: "🏤", b: 30, h: 22, hoehe: 18, farbe: "#e2cfa8", text: "Sitz des Stadtrats — Zeichen des Stadtrechts, am Markt." },
  kloster: { label: "Kloster", icon: "📿", b: 60, h: 60, hoehe: 16, farbe: "#d6cdbd", text: "Klöster lagen oft am Rand der Stadt, mit Garten innerhalb der Mauer." },
  muehle: { label: "Mühle", icon: "⚙️", b: 16, h: 12, hoehe: 8, farbe: "#c2a27a", text: "Wassermühle: braucht fließendes Wasser, also direkt am Fluss." },
  spital: { label: "Spital", icon: "🏥", b: 36, h: 24, hoehe: 10, farbe: "#e1d2b6", text: "Für Kranke und Pilger — oft vor dem Tor an der Fernstraße." },
  friedhof: { label: "Friedhof", icon: "✝️", b: 60, h: 50, hoehe: 1, farbe: "#a8bf94", text: "Im Mittelalter rund um die Kirche, ab der Neuzeit vor der Stadt." },
  bahnhof: { label: "Bahnhof", icon: "🚉", b: 70, h: 26, hoehe: 14, farbe: "#c9b8a6", text: "Kam mit der Industrialisierung — in Europa vor der Altstadt, weil drinnen kein Platz war." },
  fabrik: { label: "Fabrik", icon: "🏭", b: 70, h: 40, hoehe: 14, farbe: "#9d958c", text: "Braucht Gleisanschluss oder Wasser — und Arbeiter, die in der Nähe wohnen." },
  mietshaus: { label: "Mietskaserne", icon: "🏢", b: 40, h: 40, hoehe: 20, farbe: "#c9a58b", text: "Dicht bebaute Blöcke mit Hinterhöfen für die vielen Arbeiterfamilien." },
  einkauf: { label: "Einkaufszentrum / Mall", icon: "🛍️", b: 140, h: 90, hoehe: 10, farbe: "#c8bfd6", text: "Auf der grünen Wiese an der Autobahnausfahrt, mit großen Parkplätzen." },
  schule: { label: "Schule", icon: "🏫", b: 50, h: 30, hoehe: 10, farbe: "#e2c49a", text: "Jedes Wohnviertel braucht eine Schule in der Nähe." },
  depot: { label: "Bahnhof (Depot)", icon: "🚂", b: 50, h: 18, hoehe: 8, farbe: "#c9a37a", text: "Die Eisenbahn war der Grund für die Stadt — das Depot ist ihr Ausgangspunkt." },
  gericht: { label: "Courthouse (Gericht)", icon: "⚖️", b: 50, h: 50, hoehe: 22, farbe: "#e4dccb", text: "County Courthouse auf eigenem Block mitten im Raster: der Courthouse Square." },
  silo: { label: "Getreidesilo", icon: "🌽", b: 20, h: 20, hoehe: 30, farbe: "#c8c0b0", text: "Grain Elevator an der Bahn: Hier wird das Getreide der Farmen verladen." },
  hochhaus: { label: "Hochhaus", icon: "🏙️", b: 40, h: 40, hoehe: 180, farbe: "#8ea1b8", text: "Wolkenkratzer im CBD: Wo der Boden am teuersten ist, baut man in die Höhe." },
  buero: { label: "Bürostadt (Edge City)", icon: "🏢", b: 120, h: 80, hoehe: 40, farbe: "#a6b1c4", text: "Bürotürme und Parkplätze am Autobahnring, weit weg vom alten Zentrum." },
  tor: { label: "Stadttor", icon: "🚪", b: 16, h: 16, hoehe: 16, farbe: "#8f8478", text: "Durchlass in der Mauer, wo eine Straße die Stadt verlässt." },
} as const satisfies Record<string, Bauart>;
export type BauTyp = keyof typeof BAUTEN;

export interface Strasse { art: StrassenArt; punkte: P[]; name?: string }
export interface Zone { typ: ZonenTyp; poly: P[] }
export interface Bau { typ: BauTyp; x: number; y: number; dreh?: number }

export interface Stadt {
  stil: Stil;
  strassen: Strasse[];
  mauern: P[][];
  zonen: Zone[];
  bauten: Bau[];
  /** Beschriftungen in der Karte */
  namen?: { text: string; x: number; y: number }[];
}

export const leereStadt = (stil: Stil): Stadt => ({ stil, strassen: [], mauern: [], zonen: [], bauten: [] });

export function kopie(s: Stadt): Stadt {
  return {
    stil: s.stil,
    strassen: s.strassen.map(x => ({ ...x, punkte: x.punkte.map(p => ({ ...p })) })),
    mauern: s.mauern.map(m => m.map(p => ({ ...p }))),
    zonen: s.zonen.map(z => ({ ...z, poly: z.poly.map(p => ({ ...p })) })),
    bauten: s.bauten.map(b => ({ ...b })),
    namen: s.namen?.map(n => ({ ...n })),
  };
}

/** Epoche eines Wachstumsverlaufs */
export interface Epoche {
  jahr: string;
  titel: string;
  text: string;
  /** Stichpunkte: was in dieser Epoche neu dazukam */
  neu: string[];
  stadt: Stadt;
}
