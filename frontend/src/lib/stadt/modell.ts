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
  { id: "residenz", icon: "👑", label: "Residenzstadt (Absolutismus)", kurz: "Residenz" },
  { id: "festung", icon: "⭐", label: "Festungsstadt", kurz: "Festung" },
  { id: "sozialistisch", icon: "🏭", label: "Sozialistische Stadt (DDR)", kurz: "Sozialistisch" },
  { id: "lateinamerika", icon: "⛪", label: "Lateinamerikanische Stadt", kurz: "Lateinamerika" },
  { id: "orientalisch", icon: "🕌", label: "Orientalische Stadt", kurz: "Orientalisch" },
  { id: "bergmann", icon: "⛏️", label: "Bergmannsstadt", kurz: "Bergbau" },
  { id: "industrie", icon: "🏭", label: "Industriestadt (Ruhrgebiet)", kurz: "Industrie" },
  { id: "hafen", icon: "⚓", label: "Hafen- und Handelsstadt", kurz: "Hafen" },
  { id: "tech", icon: "💻", label: "Tech-Region (Silicon Valley)", kurz: "Tech" },
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
  kanal: { label: "Kanal", breite: 22, farbe: "#6fa6c9", rand: "#4a7a99" },
  // Nahverkehr: fährt auf Straßen oder unter der Erde, verdrängt keine Häuser
  tram: { label: "Straßenbahn", breite: 3, farbe: "#d6342c", rand: "#d6342c" },
  bus: { label: "Buslinie", breite: 3, farbe: "#e08a1e", rand: "#e08a1e" },
  sbahn: { label: "S-Bahn / Stadtbahn", breite: 4, farbe: "#2f8f46", rand: "#2f8f46" },
  ubahn: { label: "U-Bahn", breite: 4, farbe: "#2456a6", rand: "#2456a6" },
} as const;

/** Linien des Nahverkehrs (ÖPNV) */
export const OEPNV: StrassenArt[] = ["tram", "bus", "sbahn", "ubahn"];
export type StrassenArt = keyof typeof STRASSEN;

/** Häuser eines Viertels: Breite an der Straße, Tiefe, Lücke, Höhe in m */
export interface HausArt { breite: [number, number]; tiefe: [number, number]; luecke: number; hoehe: [number, number]; dach: string; abseits?: number; /** Wandfarbe im 3D-Flug */ fassade?: string; /** Flachdach statt Satteldach */ flach?: boolean }

export const ZONEN = {
  // Römisch
  insulae: { label: "Insulae (Wohnblöcke)", farbe: "#d9a066", haus: { breite: [14, 22], tiefe: [14, 22], luecke: 1, hoehe: [8, 14], dach: "#c2703d", fassade: "#eadcc2" } },
  suburbium: { label: "Suburbium (Vorstadt)", farbe: "#e2b98a", haus: { breite: [10, 16], tiefe: [10, 14], luecke: 6, hoehe: [5, 7], dach: "#c27a4d", fassade: "#e3d3b5" } },
  verlassen: { label: "Aufgegeben", farbe: "#b9b2a4", haus: { breite: [8, 12], tiefe: [6, 10], luecke: 18, hoehe: [2, 3], dach: "#9d968a", fassade: "#b9b2a4" } },
  // Europäisch
  dorf: { label: "Siedlung", farbe: "#d8c39a", haus: { breite: [10, 14], tiefe: [8, 12], luecke: 14, hoehe: [5, 7], dach: "#a8643c", fassade: "#dccaa8" } },
  altstadt: { label: "Altstadt", farbe: "#d7a072", haus: { breite: [6, 10], tiefe: [12, 18], luecke: 0, hoehe: [9, 15], dach: "#b4532a", fassade: "#efe2c8" } },
  vorstadt: { label: "Vorstadt", farbe: "#dcb48a", haus: { breite: [8, 12], tiefe: [10, 14], luecke: 4, hoehe: [6, 9], dach: "#b7653a", fassade: "#e6d6ba" } },
  gruenderzeit: { label: "Gründerzeitviertel", farbe: "#c9a58b", haus: { breite: [16, 22], tiefe: [14, 18], luecke: 0, hoehe: [16, 20], dach: "#8f5a46", fassade: "#dccbb2" } },
  industrie: { label: "Industrie", farbe: "#a9a29b", haus: { breite: [30, 60], tiefe: [24, 40], luecke: 10, hoehe: [10, 18], dach: "#77706a", fassade: "#a8572f", flach: true } },
  grosssiedlung: { label: "Großwohnsiedlung", farbe: "#c0c4ca", haus: { breite: [60, 90], tiefe: [12, 14], luecke: 30, hoehe: [30, 45], dach: "#9aa0a8", abseits: 14, fassade: "#d9dbde", flach: true } },
  einfamilienhaus: { label: "Einfamilienhäuser", farbe: "#d6dcb6", haus: { breite: [10, 12], tiefe: [9, 11], luecke: 12, hoehe: [6, 8], dach: "#b2503a", abseits: 8, fassade: "#f1ece0" } },
  gewerbe: { label: "Gewerbegebiet", farbe: "#c8bfd6", haus: { breite: [40, 80], tiefe: [30, 50], luecke: 30, hoehe: [8, 12], dach: "#8e88a0", abseits: 12, fassade: "#cfd4dc", flach: true } },
  park: { label: "Grünanlage", farbe: "#9cc47c", haus: null },
  // Amerikanisch
  kleinstadt: { label: "Kleinstadt (Main Street)", farbe: "#d8bc8e", haus: { breite: [8, 12], tiefe: [16, 22], luecke: 2, hoehe: [6, 9], dach: "#a16a46", fassade: "#c9a27a" } },
  cbd: { label: "Innenstadt (CBD)", farbe: "#a9b6c6", haus: { breite: [24, 36], tiefe: [24, 36], luecke: 4, hoehe: [40, 160], dach: "#7f8fa3", fassade: "#9fb7cc", flach: true } },
  uebergang: { label: "Übergangszone", farbe: "#bfae9d", haus: { breite: [14, 22], tiefe: [14, 20], luecke: 10, hoehe: [8, 14], dach: "#8d7664", fassade: "#b39a82", flach: true } },
  arbeiter: { label: "Arbeiterviertel", farbe: "#d1b48f", haus: { breite: [8, 10], tiefe: [12, 16], luecke: 3, hoehe: [7, 9], dach: "#9c5f3e", fassade: "#a65c3e" } },
  vorort: { label: "Wohnviertel (Streetcar Suburb)", farbe: "#d8d0a4", haus: { breite: [10, 14], tiefe: [10, 14], luecke: 8, hoehe: [7, 9], dach: "#8c5442", abseits: 6, fassade: "#e8e1cf" } },
  pendler: { label: "Vororte (Suburbs)", farbe: "#dbe3b4", haus: { breite: [14, 18], tiefe: [12, 16], luecke: 14, hoehe: [5, 7], dach: "#7b6a5a", abseits: 10, fassade: "#efe9dc" } },
  parkplatz: { label: "Parkplätze", farbe: "#b8b8b8", haus: null },
  konversion: { label: "Neues Quartier auf Industriebrache", farbe: "#cbd5c0", haus: { breite: [26, 40], tiefe: [14, 18], luecke: 12, hoehe: [14, 22], dach: "#7d8b80", abseits: 6, fassade: "#e9ece6", flach: true } },
  gated: { label: "Gated Community", farbe: "#e6dcc0", haus: { breite: [16, 22], tiefe: [14, 18], luecke: 12, hoehe: [6, 8], dach: "#9c5b44", abseits: 10, fassade: "#f4efe4" } },
  // Residenzstadt
  residenz: { label: "Residenzstadt (Modellhäuser)", farbe: "#dcc7a8", haus: { breite: [14, 18], tiefe: [12, 14], luecke: 0, hoehe: [10, 13], dach: "#5a616d", fassade: "#efe4cc" } },
  schlossgarten: { label: "Schlossgarten", farbe: "#8fbf6a", haus: null },
  // Festungsstadt
  festung: { label: "Festungsstadt", farbe: "#d4b48c", haus: { breite: [10, 14], tiefe: [12, 16], luecke: 0, hoehe: [9, 13], dach: "#a0522d", fassade: "#e9dcc4" } },
  glacis: { label: "Glacis (freies Schussfeld)", farbe: "#c8d6a0", haus: null },
  graben: { label: "Festungsgraben", farbe: "#7fb3d5", haus: null },
  // Sozialistische Stadt
  tradition: { label: "Wohnkomplex »Nationale Tradition«", farbe: "#d9c3a0", haus: { breite: [40, 60], tiefe: [12, 14], luecke: 4, hoehe: [15, 19], dach: "#9c6b4e", fassade: "#e8d5b0" } },
  platte: { label: "Plattenbau (WBS 70)", farbe: "#c9ccd0", haus: { breite: [60, 100], tiefe: [12, 13], luecke: 24, hoehe: [15, 33], dach: "#9aa0a6", abseits: 16, fassade: "#d8dbd2", flach: true } },
  rueckbau: { label: "Rückbaufläche (nach 1990)", farbe: "#b9d29a", haus: null },
  kombinat: { label: "Kombinat", farbe: "#a49a8f", haus: { breite: [80, 140], tiefe: [40, 70], luecke: 16, hoehe: [18, 28], dach: "#6d675f", fassade: "#8a7f74", flach: true } },
  // Lateinamerikanische Stadt
  kolonial: { label: "Kolonialer Kern (Casco)", farbe: "#e0bf8f", haus: { breite: [12, 18], tiefe: [16, 24], luecke: 0, hoehe: [6, 9], dach: "#c0643a", fassade: "#f0d9a8" } },
  verfall: { label: "Verfallene Altbauten (Conventillos)", farbe: "#b9a48a", haus: { breite: [10, 14], tiefe: [14, 20], luecke: 1, hoehe: [6, 9], dach: "#8f6a52", fassade: "#c9b496" } },
  oberschicht: { label: "Oberschicht-Sektor (Barrio alto)", farbe: "#e9e1cf", haus: { breite: [18, 26], tiefe: [16, 22], luecke: 10, hoehe: [10, 45], dach: "#b8b2a6", fassade: "#f3efe6", flach: true } },
  marginal: { label: "Marginalsiedlung (Favela, Barriada)", farbe: "#c7a585", haus: { breite: [4, 7], tiefe: [4, 7], luecke: 0.5, hoehe: [3, 6], dach: "#8d8d8d", fassade: "#c99a6e", flach: true } },
  sozialbau: { label: "Sozialer Wohnungsbau", farbe: "#d6ccb8", haus: { breite: [30, 40], tiefe: [10, 12], luecke: 10, hoehe: [10, 14], dach: "#a39c90", fassade: "#e2d6c0", flach: true } },
  // Orientalische Stadt
  medina: { label: "Medina (Wohnquartiere)", farbe: "#e7dcc6", haus: { breite: [12, 18], tiefe: [12, 18], luecke: 0, hoehe: [6, 10], dach: "#e2d8c4", fassade: "#efe7d6", flach: true } },
  bazar: { label: "Bazar (Suq)", farbe: "#d9b98a", haus: { breite: [4, 6], tiefe: [6, 8], luecke: 0, hoehe: [4, 5], dach: "#c9a77c", fassade: "#dcc29a", flach: true } },
  // Bergmannsstadt
  bergstadt: { label: "Bergstadt (Bergmannshäuser am Hang)", farbe: "#d2b48c", haus: { breite: [8, 12], tiefe: [8, 11], luecke: 3, hoehe: [6, 9], dach: "#5d5a58", fassade: "#e8dcc4" } },
  halde: { label: "Halde (Abraum)", farbe: "#8c8277", haus: null },
  huette: { label: "Hütte und Pochwerk", farbe: "#9b8f84", haus: { breite: [24, 40], tiefe: [16, 24], luecke: 10, hoehe: [8, 14], dach: "#4f4a45", fassade: "#8f8378" } },
  // Industriestadt
  zeche: { label: "Zeche und Kokerei", farbe: "#8f8780", haus: { breite: [40, 80], tiefe: [24, 40], luecke: 14, hoehe: [14, 26], dach: "#544c46", fassade: "#7d6e64", flach: true } },
  kolonie: { label: "Arbeiterkolonie (Zechensiedlung)", farbe: "#cdbf9a", haus: { breite: [10, 14], tiefe: [8, 10], luecke: 10, hoehe: [6, 8], dach: "#8a3f2c", fassade: "#b5654a" } },
  landschaftspark: { label: "Landschaftspark (alte Industrie)", farbe: "#a7c48a", haus: null },
  // Hafenstadt
  kontor: { label: "Kaufmanns-Altstadt (Kontorhäuser)", farbe: "#cf9f7a", haus: { breite: [7, 10], tiefe: [14, 20], luecke: 0, hoehe: [12, 18], dach: "#7d3a24", fassade: "#a6553a" } },
  speicher: { label: "Speicherstadt", farbe: "#b06a4c", haus: { breite: [30, 50], tiefe: [20, 26], luecke: 4, hoehe: [20, 26], dach: "#5f6b5a", fassade: "#a64f34" } },
  hafengebiet: { label: "Hafen (Kais, Kräne, Lager)", farbe: "#a4a9ad", haus: { breite: [40, 90], tiefe: [24, 40], luecke: 18, hoehe: [10, 16], dach: "#7b8288", fassade: "#9aa1a6", flach: true } },
  containerhafen: { label: "Containerterminal", farbe: "#c6a77d", haus: { breite: [12, 12], tiefe: [2.5, 2.5], luecke: 1, hoehe: [2.5, 7.5], dach: "#b4462f", fassade: "#2e6aa6", flach: true, abseits: 6 } },
  hafencity: { label: "Neues Hafenquartier", farbe: "#c3cfd8", haus: { breite: [26, 40], tiefe: [20, 26], luecke: 10, hoehe: [20, 45], dach: "#c9d2d8", fassade: "#e4e8ec", flach: true } },
  // Tech-Region
  campus: { label: "Tech-Campus (Bürogelände)", farbe: "#bcd3c4", haus: { breite: [50, 90], tiefe: [30, 50], luecke: 40, hoehe: [10, 18], dach: "#d7dde0", fassade: "#9fc1d6", flach: true, abseits: 30 } },
  uni: { label: "Universität", farbe: "#e2d1a8", haus: { breite: [30, 50], tiefe: [16, 24], luecke: 20, hoehe: [10, 16], dach: "#b0543a", fassade: "#e8d7b4", abseits: 12 } },
  obstplantage: { label: "Obstplantagen (Valley of Heart’s Delight)", farbe: "#b9cf8a", haus: null },
  ville: { label: "Ville nouvelle (Kolonialstadt)", farbe: "#e6e2d6", haus: { breite: [18, 26], tiefe: [14, 20], luecke: 6, hoehe: [12, 18], dach: "#d9d4c8", fassade: "#f4f1ea", flach: true } },
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
  // Residenzstadt
  schloss: { label: "Schloss", icon: "👑", b: 190, h: 60, hoehe: 26, farbe: "#efe6d2", text: "Sitz des absoluten Fürsten — Mittelpunkt, auf den alle Achsen zulaufen: »L'État, c'est moi.«" },
  kaserne: { label: "Kaserne", icon: "💂", b: 90, h: 26, hoehe: 14, farbe: "#c9b59a", text: "Stehendes Heer: Soldaten wohnten in Kasernen, nicht mehr bei den Bürgern einquartiert." },
  // Festungsstadt
  zitadelle: { label: "Zitadelle", icon: "🏯", b: 130, h: 130, hoehe: 14, farbe: "#a39b8f", text: "Festung in der Festung — letzte Zuflucht der Besatzung, wie der Petersberg in Erfurt." },
  paradeplatz: { label: "Paradeplatz", icon: "🎖️", b: 110, h: 110, hoehe: 0, farbe: "#e8e0c8", text: "Großer Platz in der Mitte für Appelle und Aufmärsche der Garnison; von hier sind alle Bastionen schnell erreichbar." },
  // Sozialistische Stadt
  kulturhaus: { label: "Kulturhaus / Rathaus", icon: "🎭", b: 70, h: 50, hoehe: 24, farbe: "#e9e2d0", text: "Dominante am zentralen Platz: Kultur, Feiern und Verwaltung der »sozialistischen Gemeinschaft«." },
  aufmarschplatz: { label: "Zentraler Platz", icon: "🚩", b: 160, h: 110, hoehe: 0, farbe: "#ddd6c8", text: "Für Demonstrationen und Feiertage — am Ende der Magistrale, gegenüber dem Werk." },
  werk: { label: "Kombinat (Werk)", icon: "🏭", b: 320, h: 160, hoehe: 28, farbe: "#8f877d", text: "Der Grund für die Stadt: ein Großbetrieb (z. B. Eisenhüttenkombinat Ost). Die Stadt wurde für seine Arbeiter gebaut." },
  kaufhalle: { label: "Kaufhalle", icon: "🛒", b: 50, h: 36, hoehe: 6, farbe: "#d0d4d8", text: "Jeder Wohnkomplex bekam Kaufhalle, Schule, Kindergarten und Poliklinik in Fußnähe." },
  poliklinik: { label: "Poliklinik", icon: "🩺", b: 60, h: 30, hoehe: 14, farbe: "#e4e7ea", text: "Ärztehaus mit vielen Fachrichtungen unter einem Dach." },
  // Lateinamerikanische Stadt
  plaza: { label: "Plaza Mayor", icon: "🟫", b: 110, h: 110, hoehe: 0, farbe: "#eadfc4", text: "Nach den spanischen »Leyes de Indias« (1573) Mittelpunkt des Schachbretts: Kirche, Rathaus und Palast stehen am Platz." },
  kathedrale: { label: "Kathedrale", icon: "⛪", b: 50, h: 90, hoehe: 45, farbe: "#e8dcc2", text: "Hauptkirche an der Plaza — Zeichen der Kolonialmacht und der Kirche." },
  cabildo: { label: "Cabildo (Rathaus)", icon: "🏛️", b: 50, h: 30, hoehe: 12, farbe: "#f1e3c2", text: "Stadtverwaltung der Kolonie, an der Plaza gegenüber der Kathedrale." },
  // Orientalische Stadt
  moschee: { label: "Freitagsmoschee", icon: "🕌", b: 80, h: 80, hoehe: 18, farbe: "#f2ece0", text: "Mittelpunkt der Medina: Um sie herum liegen die wertvollsten Läden des Bazars." },
  kasbah: { label: "Kasbah (Zitadelle)", icon: "🏰", b: 160, h: 120, hoehe: 16, farbe: "#c8a57a", text: "Sitz des Herrschers, am Rand der Medina an der Mauer — oft auf höherem Gelände." },
  hammam: { label: "Hammam", icon: "♨️", b: 30, h: 24, hoehe: 7, farbe: "#efe5d3", text: "Öffentliches Bad, oft neben der Moschee (Waschungen vor dem Gebet)." },
  karawanserei: { label: "Karawanserei (Funduq)", icon: "🐪", b: 60, h: 60, hoehe: 9, farbe: "#d8c2a0", text: "Herberge und Lager für Fernhändler — nahe den Toren an den Karawanenwegen." },
  // Bergmannsstadt
  schacht: { label: "Schacht mit Förderturm", icon: "⛏️", b: 30, h: 30, hoehe: 30, farbe: "#6f655c", text: "Hier fahren die Bergleute ein und das Erz kommt nach oben. Der Schacht liegt über dem Erzgang — die Stadt drängt sich darum." },
  huettenwerk: { label: "Schmelzhütte", icon: "🔥", b: 60, h: 40, hoehe: 18, farbe: "#7f746a", text: "Erz wird geschmolzen. Braucht Holzkohle aus dem Wald und Wasserkraft für die Blasebälge — deshalb unten am Bach." },
  bergamt: { label: "Bergamt", icon: "📜", b: 34, h: 24, hoehe: 14, farbe: "#e2d2b0", text: "Verwaltet die Gruben und erhebt den »Zehnten« für den Landesherrn." },
  // Industriestadt
  zechenturm: { label: "Zeche (Fördergerüst)", icon: "🏗️", b: 80, h: 60, hoehe: 55, farbe: "#6c635b", text: "Steinkohlenbergwerk: Über dem Flöz entsteht die Zeche, daneben Kokerei und Halde. Die Stadt wächst zwischen den Zechen zusammen." },
  hochofen: { label: "Hochofen / Stahlwerk", icon: "🔥", b: 140, h: 80, hoehe: 60, farbe: "#5e5650", text: "Kohle (als Koks) und Eisenerz werden zu Stahl. Braucht Kühlwasser und Schiffe — deshalb am Fluss." },
  kanalhafen: { label: "Kanalhafen", icon: "🚢", b: 90, h: 40, hoehe: 6, farbe: "#a4a9ad", text: "Kohle und Erz kommen per Schiff — billiger als jede Bahn." },
  // Hafenstadt
  kai: { label: "Kai mit Kränen", icon: "🏗️", b: 120, h: 30, hoehe: 22, farbe: "#8a9096", text: "Schiffe legen an, Kräne heben die Ladung an Land." },
  leuchtturm: { label: "Leuchtturm", icon: "🗼", b: 14, h: 14, hoehe: 34, farbe: "#f2f2f2", text: "Weist Schiffen nachts den Weg in die Bucht." },
  werft: { label: "Werft", icon: "⚓", b: 120, h: 60, hoehe: 30, farbe: "#7a8189", text: "Hier werden Schiffe gebaut — an tiefem Wasser mit Helling." },
  baecker: { label: "Bäckerei", icon: "🥖", b: 18, h: 14, hoehe: 9, farbe: "#e2c9a0", text: "Backt Brot aus dem Mehl der Mühle: mehr Nahrung für die Stadt. Braucht 3 Handwerker." },
  schmiede: { label: "Schmiede", icon: "⚒️", b: 18, h: 14, hoehe: 8, farbe: "#8f8478", text: "Pflüge, Sensen, Hufeisen: Die Bauernhöfe liefern mehr. Verbraucht Holzkohle. Braucht 3 Handwerker." },
  weberei: { label: "Weberei", icon: "🧶", b: 24, h: 16, hoehe: 10, farbe: "#d6c3a8", text: "Webt aus Wolle Tuch: für die Bürger und den Fernhandel (mehr Steuern). Braucht 6 Handwerker." },
  zimmerei: { label: "Zimmerei", icon: "🔨", b: 22, h: 16, hoehe: 8, farbe: "#b88a5a", text: "Balken und Dachstühle aus Brettern: Bauen wird billiger. Braucht 4 Handwerker." },
  brauerei: { label: "Brauerei", icon: "🍺", b: 22, h: 18, hoehe: 12, farbe: "#c9a37a", text: "Braut aus Hopfen Bier: Die Bürger wollen es, die Leute sind zufriedener. Braucht 4 Handwerker." },
  holzfaeller: { label: "Holzfäller", icon: "🪓", b: 14, h: 12, hoehe: 6, farbe: "#8a6a44", text: "Schlägt Bauholz im Wald — steht er nicht am Wald, kommt wenig. Braucht 3 Bauern (Waldarbeit)." },
  saegewerk: { label: "Sägemühle", icon: "🪚", b: 20, h: 14, hoehe: 8, farbe: "#a07a52", text: "Sägt aus 2 Bauholz 2 Bretter — für Zimmerei und jedes größere Haus. Braucht 3 Handwerker." },
  lehmgrube: { label: "Lehmgrube", icon: "🟫", b: 24, h: 24, hoehe: 2, farbe: "#9a6b45", text: "Gräbt Lehm, am besten nahe am Fluss (Auelehm). Braucht 3 Bauern." },
  ziegelei: { label: "Ziegelei", icon: "🧱", b: 24, h: 18, hoehe: 10, farbe: "#b5654a", text: "Brennt aus Lehm und Brennholz Ziegel — für Bürgerhäuser und alles ab der Marktstadt. Braucht 4 Handwerker." },
  koehler: { label: "Köhlerei", icon: "⚫", b: 14, h: 14, hoehe: 5, farbe: "#4a4440", text: "Meiler verkohlen Holz zu Holzkohle — die braucht die Schmiede. Braucht 2 Bauern." },
  schafhof: { label: "Schäferei", icon: "🐑", b: 26, h: 20, hoehe: 6, farbe: "#d8d0bc", text: "Schafe auf der Weide liefern Wolle für die Weberei. Braucht 2 Bauern." },
  steinbruch: { label: "Steinbruch", icon: "🪨", b: 30, h: 24, hoehe: 4, farbe: "#9a968e", text: "Bricht Steine am Hang — für Kirche, Rathaus und Mauern ab der Handelsstadt. Braucht 4 Handwerker." },
  hopfengarten: { label: "Hopfengarten", icon: "🌿", b: 28, h: 24, hoehe: 5, farbe: "#6f8f4a", text: "Hopfenstangen auf gutem Boden: ohne Hopfen kein Bier. Braucht 2 Bauern." },
  brunnen: { label: "Brunnen", icon: "🪣", b: 10, h: 10, hoehe: 4, farbe: "#a8a29a", text: "Trinkwasser für die Häuser in 2 Minuten Fußweg — ohne Wasser zieht niemand ein." },
  kapelle: { label: "Kapelle", icon: "⛪", b: 14, h: 22, hoehe: 14, farbe: "#e6ddcc", text: "Kleine Kirche fürs Dorf: Glaube in 3 Minuten Fußweg. Die Stadt braucht später eine Kirche." },
  hafenkontor: { label: "Hafenkontor", icon: "📦", b: 36, h: 24, hoehe: 16, farbe: "#b5654a", text: "Speicher- und Handelshaus am Kai: Schiffe bringen Salz, Tuch und Wein, Kaufleute lagern und verkaufen. Steht direkt am Wasser, die Zufahrt zeigt zur Stadt." },
  verladehafen: { label: "Verladehafen", icon: "⚓", b: 30, h: 18, hoehe: 6, farbe: "#8b7355", text: "Anlegestelle am Fluss: Waren aus dem Lager gehen auf Kähne und fahren zum Kontor — dort werden sie verkauft oder eingekauft." },
  zollhaus: { label: "Zollhaus / Börse", icon: "💰", b: 40, h: 30, hoehe: 16, farbe: "#e6d6b6", text: "Kaufleute handeln Waren aus aller Welt; der Zoll füllt die Stadtkasse." },
  // Tech-Region
  universitaet: { label: "Universität", icon: "🎓", b: 140, h: 90, hoehe: 18, farbe: "#e2c89a", text: "Keimzelle der Tech-Region: Absolventen gründen Firmen in der Nähe (Stanford → Hewlett-Packard, Google)." },
  forschungspark: { label: "Forschungspark", icon: "🔬", b: 110, h: 80, hoehe: 14, farbe: "#bcd3c4", text: "Die Universität verpachtet Land an Firmen — Forschung und Produktion Tür an Tür." },
  techzentrale: { label: "Konzernzentrale (Campus)", icon: "💻", b: 160, h: 120, hoehe: 20, farbe: "#a9c6dc", text: "Großer Campus mit Parkhäusern im Grünen — gut mit dem Auto, schlecht mit Bus und Bahn erreichbar." },
  rechenzentrum: { label: "Rechenzentrum", icon: "🗄️", b: 90, h: 50, hoehe: 12, farbe: "#9aa6b2", text: "Braucht viel Strom und Kühlung, aber kaum Personal." },
  // Nahverkehr
  haltestelle: { label: "Haltestelle", icon: "🚏", b: 8, h: 8, hoehe: 3, farbe: "#f3d34a", text: "Wer im Umkreis von etwa 400 m (5 Minuten zu Fuß) wohnt, nutzt Bus und Bahn." },
  umsteige: { label: "Umsteigeknoten", icon: "🔀", b: 24, h: 24, hoehe: 8, farbe: "#f3d34a", text: "Hier treffen sich Linien — kurze Wege zum Umsteigen machen das Netz schnell." },
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
