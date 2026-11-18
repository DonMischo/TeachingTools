/**
 * Bau-Modus (wie in Anno): Man setzt nur die wichtigen Orte einer Stadt —
 * Forum, Markt, Burg, Zeche, Bahnhof … —, die Häuser und Straßen baut der
 * Algorithmus je nach Stadttyp drumherum. Jeder Ort hat Lageregeln: Steht er
 * schlecht (zu steil, zu weit vom Fluss …), wirkt er nur halb. Einwohner
 * wachsen bis zur Kapazität der Orte; die nächste Stufe (Epoche) beginnt erst,
 * wenn die geforderten Orte der aktuellen Stufe stehen.
 */
import { hoeheBei, istWasser, neigungBei, wasserAbstand, type Gelaende } from "@/lib/gelaende/gelaende";
import { perlin, zufallsquelle } from "@/lib/gelaende/rauschen";
import { abstand, inPoly, rechteck, type P } from "./geometrie";
import { bau, baubar, fernstrasse, flussRichtung, freiraeumen, gedrehtesRaster } from "./hilfen";
import { leereStadt, type BauTyp, type Stadt, type Stil, type ZonenTyp } from "./modell";
import { nahverkehr } from "./oepnv";
import { flaeche, flussAbstand } from "./standort";
import { stromlinien, type Feld } from "./tensor";
import { bastionen } from "./stile/festung";
import { glaetten, randPunkt, weg } from "./wege";

export interface Ort { bau: BauTyp; p: P }
export interface Bewertung { ok: boolean; text: string }
type Regel = ((g: Gelaende, p: P, orte: Ort[]) => Bewertung) & { beschreibung: string };
const regel = (beschreibung: string, f: (g: Gelaende, p: P, orte: Ort[]) => Bewertung): Regel => Object.assign(f, { beschreibung });

export interface Schluessel {
  bau: BauTyp;
  /** ab welcher Stufe verfügbar */
  stufe: number;
  /** Einwohner, die dieser Ort trägt (bei guter Lage) */
  kap: number;
  /** harte Regel: sonst darf man hier nicht bauen */
  muss?: Regel;
  /** weiche Regeln: jede verfehlte halbiert die Wirkung */
  soll: Regel[];
  /** Viertel, das um den Ort entsteht (Radius in m, wächst mit der Stadt) */
  viertel?: { typ: ZonenTyp; r: number; raster?: number };
  /** höchstens so oft */
  max?: number;
}

export interface Stufe { name: string; jahr: number; ab: number; braucht: BauTyp[] }
export type Muster = "raster" | "organisch" | "faecher" | "stern";
export interface BauPlan { stufen: Stufe[]; orte: Schluessel[]; muster: Muster; kern: ZonenTyp; mauerBis: number; dichte: number; block: number; /** Mitte der Wohnstadt (sonst der erste Ort) */ zentrum?: BauTyp }

// ---------------------------------------------------------------- Regeln

const r1 = (n: number) => n.toFixed(0);
// gemessen wird die mittlere Neigung der Baufläche (Umkreis 35 m), nicht nur ein Punkt
const flach = (max: number): Regel => regel(`eben: höchstens ${max} % Neigung im Umkreis von 35 m`, (g, p) => {
  const n = flaeche(g, p, 35).neigung;
  return { ok: n <= max, text: n <= max ? `eben genug (${r1(n)} % im Umkreis von 35 m)` : `zu steil: im Umkreis von 35 m im Mittel ${r1(n)} %, gut bis ${max} %` };
});
const amFluss = (min: number, max: number): Regel => regel(`${min}–${max} m vom Fluss (nah, aber hochwassersicher)`, (g, p) => {
  const d = flussAbstand(g, p);
  if (!Number.isFinite(d)) return { ok: true, text: "kein Fluss auf der Karte" };
  return { ok: d >= min && d <= max, text: d < min ? `zu nah am Fluss (${r1(d)} m, Hochwasser)` : d > max ? `zu weit vom Fluss (${r1(d)} m, gut bis ${max} m)` : `${r1(d)} m zum Fluss` };
});
const amWasser = (max: number): Regel => regel(`direkt am Wasser (höchstens ${max} m)`, (g, p) => {
  const d = wasserAbstand(g, p.x, p.y);
  return { ok: d <= max, text: d <= max ? "direkt am Wasser" : `${r1(d)} m bis zum Wasser — muss ans Ufer` };
});
const nah = (b: BauTyp, max: number, name: string): Regel => regel(`höchstens ${max} m bis ${name}`, (_g, p, orte) => {
  const o = orte.filter(x => x.bau === b);
  if (!o.length) return { ok: false, text: `${name} fehlt noch` };
  const d = Math.min(...o.map(x => abstand(x.p, p)));
  return { ok: d <= max, text: d <= max ? `nah an ${name}` : `${r1(d)} m bis ${name} — höchstens ${max} m` };
});
const fern = (b: BauTyp, min: number, name: string): Regel => regel(`mindestens ${min} m Abstand zu ${name}`, (_g, p, orte) => {
  const o = orte.filter(x => x.bau === b);
  if (!o.length) return { ok: true, text: `kein ${name} in der Nähe` };
  const d = Math.min(...o.map(x => abstand(x.p, p)));
  return { ok: d >= min, text: d >= min ? `genug Abstand zu ${name}` : `zu nah an ${name} (${r1(d)} m, mindestens ${min} m)` };
});
const erhoeht = (dz: number): Regel => regel(`erhöht: mindestens ${dz} m über der Stadt`, (g, p, orte) => {
  const k = orte[0]?.p;
  if (!k) return { ok: true, text: "" };
  const h = hoeheBei(g, p.x, p.y) - hoeheBei(g, k.x, k.y);
  return { ok: h >= dz, text: h >= dz ? `${r1(h)} m über der Stadt` : `nur ${r1(h)} m über der Stadt — gut ab ${dz} m` };
});
const quelleHoeher: Regel = regel("eine Quelle liegt mindestens 12 m höher (Gefälle fürs Aquädukt)", (g, p) => {
  const hp = hoeheBei(g, p.x, p.y);
  let best = -Infinity;
  if (g.quelle) best = hoeheBei(g, g.quelle.x, g.quelle.y) - hp;
  for (let k = 0; k < 24 && best < 12; k++) for (const r of [900, 1500, 2200]) {
    const q = { x: p.x + Math.cos(k / 24 * Math.PI * 2) * r, y: p.y + Math.sin(k / 24 * Math.PI * 2) * r };
    if (q.x > 0 && q.y > 0 && q.x < g.breite && q.y < g.breite) best = Math.max(best, hoeheBei(g, q.x, q.y) - hp);
  }
  return { ok: best >= 12, text: best >= 12 ? "eine Quelle liegt höher — das Aquädukt hat Gefälle" : "keine höhere Quelle in 2 km — kein Gefälle fürs Aquädukt" };
});
const beiMerkmal = (k: "erz" | "kohle", max: number, name: string): Regel => regel(`über dem ${name} (höchstens ${max} m)`, (g, p) => {
  const m = g[k];
  if (!m) return { ok: true, text: `kein ${name} geplant — überall möglich` };
  const d = abstand(m, p);
  return { ok: d <= max, text: d <= max ? `über dem ${name}` : `${r1(d)} m vom ${name} entfernt` };
});
const land: Regel = regel("an Land", (g, p) => ({ ok: !istWasser(g, p.x, p.y) && p.x > 0 && p.y > 0 && p.x < g.breite && p.y < g.breite, text: "nicht im Wasser" }));

// ---------------------------------------------------------------- Baupläne

const S = (bau: BauTyp, stufe: number, kap: number, soll: Regel[], extra: Partial<Schluessel> = {}): Schluessel => ({ bau, stufe, kap, soll, ...extra });

export const BAUPLAENE: Record<Stil, BauPlan> = {
  roemisch: {
    muster: "raster", kern: "insulae", mauerBis: 400, dichte: 120, block: 80,
    stufen: [
      { name: "Kolonie", jahr: -15, ab: 0, braucht: ["forum", "tempel"] },
      { name: "Blütezeit", jahr: 150, ab: 4000, braucht: ["thermen", "castellum", "amphitheater"] },
      { name: "Stadt heute", jahr: 2025, ab: 14000, braucht: [] },
    ],
    orte: [
      S("forum", 0, 2500, [flach(5), amFluss(150, 800)], { max: 1 }),
      S("tempel", 0, 1200, [nah("forum", 150, "Forum")]),
      S("castellum", 1, 3000, [quelleHoeher, nah("forum", 600, "Forum")], { max: 1 }),
      S("thermen", 1, 2000, [nah("castellum", 500, "Wasserverteiler")]),
      S("amphitheater", 1, 2000, [fern("forum", 380, "Forum"), flach(8)]),
      S("hafen", 1, 2500, [amWasser(40)], { muss: amWasser(80) }),
      S("bahnhof", 2, 10000, [fern("forum", 450, "Forum"), flach(3)], { viertel: { typ: "gruenderzeit", r: 300 } }),
    ],
  },
  europaeisch: {
    muster: "organisch", kern: "altstadt", mauerBis: 1860, dichte: 160, block: 70,
    stufen: [
      { name: "Siedlung an der Furt", jahr: 950, ab: 0, braucht: ["markt", "burg"] },
      { name: "Marktstadt", jahr: 1300, ab: 2500, braucht: ["kirche", "rathaus", "muehle"] },
      { name: "Industriestadt", jahr: 1880, ab: 9000, braucht: ["bahnhof", "fabrik"] },
      { name: "Moderne", jahr: 2000, ab: 25000, braucht: [] },
    ],
    orte: [
      S("markt", 0, 2000, [flach(6), amFluss(80, 450)], { max: 1 }),
      S("burg", 0, 800, [erhoeht(15), nah("markt", 900, "Markt")], { max: 1 }),
      S("kirche", 1, 1500, [nah("markt", 120, "Markt")]),
      S("rathaus", 1, 1500, [nah("markt", 80, "Markt")], { max: 1 }),
      S("muehle", 1, 1200, [amWasser(30)], { muss: amWasser(80) }),
      S("kloster", 1, 1000, [fern("markt", 200, "Markt")]),
      S("bahnhof", 2, 8000, [fern("markt", 450, "Markt"), flach(3)], { viertel: { typ: "gruenderzeit", r: 380 } }),
      S("fabrik", 2, 6000, [nah("bahnhof", 700, "Bahnhof")], { viertel: { typ: "industrie", r: 160, raster: 90 } }),
      S("einkauf", 3, 6000, [fern("markt", 1200, "Markt")], { viertel: { typ: "einfamilienhaus", r: 300, raster: 70 } }),
      S("schule", 3, 4000, [fern("markt", 700, "Markt")], { viertel: { typ: "grosssiedlung", r: 220, raster: 110 } }),
    ],
  },
  amerikanisch: {
    muster: "raster", kern: "kleinstadt", mauerBis: -1e9, dichte: 40, block: 110,
    stufen: [
      { name: "Eisenbahnstadt", jahr: 1870, ab: 0, braucht: ["depot", "silo", "gericht"] },
      { name: "Straßenbahnstadt", jahr: 1910, ab: 4000, braucht: ["fabrik", "kirche"] },
      { name: "Autostadt", jahr: 1960, ab: 15000, braucht: ["einkauf", "hochhaus"] },
      { name: "Sprawl", jahr: 2000, ab: 35000, braucht: [] },
    ],
    orte: [
      S("depot", 0, 2000, [flach(3)], { max: 1 }),
      S("silo", 0, 800, [nah("depot", 250, "Depot")]),
      S("gericht", 0, 1500, [nah("depot", 400, "Depot")], { max: 1 }),
      S("kirche", 1, 2000, [nah("gericht", 600, "Courthouse")]),
      S("fabrik", 1, 6000, [nah("depot", 800, "Depot")], { viertel: { typ: "arbeiter", r: 260 } }),
      S("hochhaus", 2, 8000, [nah("gericht", 300, "Courthouse")], { viertel: { typ: "cbd", r: 200 } }),
      S("einkauf", 2, 9000, [fern("gericht", 1200, "Courthouse")], { viertel: { typ: "pendler", r: 420, raster: 90 } }),
      S("buero", 3, 9000, [fern("gericht", 1500, "Courthouse")], { viertel: { typ: "pendler", r: 380, raster: 90 } }),
    ],
  },
  residenz: {
    muster: "faecher", kern: "residenz", mauerBis: -1e9, dichte: 110, block: 75,
    stufen: [
      { name: "Gründung", jahr: 1715, ab: 0, braucht: ["schloss", "kirche"] },
      { name: "Ausbau", jahr: 1800, ab: 5000, braucht: ["markt", "rathaus", "theater"] },
      { name: "Industrie und Moderne", jahr: 1950, ab: 16000, braucht: [] },
    ],
    orte: [
      S("schloss", 0, 3000, [flach(3)], { max: 1, viertel: { typ: "schlossgarten", r: 250 } }),
      S("kirche", 0, 1500, [nah("schloss", 500, "Schloss")]),
      S("markt", 1, 2500, [nah("schloss", 700, "Schloss"), fern("schloss", 250, "Schloss")], { max: 1 }),
      S("rathaus", 1, 1500, [nah("markt", 120, "Markt")], { max: 1 }),
      S("theater", 1, 1500, [nah("schloss", 400, "Schloss")]),
      S("kaserne", 1, 2000, [fern("schloss", 300, "Schloss")]),
      S("bahnhof", 2, 9000, [fern("schloss", 700, "Schloss"), flach(3)], { viertel: { typ: "gruenderzeit", r: 350 } }),
    ],
  },
  festung: {
    muster: "stern", kern: "festung", mauerBis: 1870, dichte: 150, block: 66,
    stufen: [
      { name: "Festung", jahr: 1700, ab: 0, braucht: ["paradeplatz", "kaserne", "kirche"] },
      { name: "Entfestigung", jahr: 1880, ab: 6000, braucht: ["bahnhof"] },
      { name: "heute", jahr: 2025, ab: 15000, braucht: [] },
    ],
    orte: [
      S("paradeplatz", 0, 2500, [flach(3)], { max: 1 }),
      S("kaserne", 0, 1500, [nah("paradeplatz", 300, "Paradeplatz")]),
      S("kirche", 0, 1500, [nah("paradeplatz", 250, "Paradeplatz")]),
      S("zitadelle", 0, 1000, [erhoeht(8)], { max: 1 }),
      S("bahnhof", 1, 8000, [fern("paradeplatz", 600, "Paradeplatz")], { viertel: { typ: "gruenderzeit", r: 350 } }),
      S("einkauf", 2, 6000, [fern("paradeplatz", 1000, "Paradeplatz")], { viertel: { typ: "einfamilienhaus", r: 300, raster: 70 } }),
    ],
  },
  sozialistisch: {
    muster: "raster", kern: "tradition", zentrum: "aufmarschplatz", mauerBis: -1e9, dichte: 180, block: 120,
    stufen: [
      { name: "Erste sozialistische Stadt", jahr: 1955, ab: 0, braucht: ["werk", "aufmarschplatz", "kulturhaus"] },
      { name: "Plattenbau", jahr: 1980, ab: 8000, braucht: ["kaufhalle", "poliklinik", "schule"] },
      { name: "Schrumpfung", jahr: 2015, ab: 22000, braucht: [] },
    ],
    orte: [
      S("werk", 0, 6000, [amFluss(100, 600), flach(3)], { max: 1, viertel: { typ: "kombinat", r: 220 } }),
      S("aufmarschplatz", 0, 2000, [fern("werk", 800, "Werk"), flach(4)], { max: 1 }),
      S("kulturhaus", 0, 1500, [nah("aufmarschplatz", 200, "Zentralen Platz")]),
      S("kaufhalle", 1, 4000, [fern("aufmarschplatz", 500, "Zentralen Platz")], { viertel: { typ: "platte", r: 230, raster: 85 } }),
      S("schule", 1, 4000, [fern("aufmarschplatz", 500, "Zentralen Platz")], { viertel: { typ: "platte", r: 230, raster: 85 } }),
      S("poliklinik", 1, 3000, [nah("aufmarschplatz", 600, "Zentralen Platz")]),
    ],
  },
  lateinamerika: {
    muster: "raster", kern: "kolonial", mauerBis: -1e9, dichte: 90, block: 110,
    stufen: [
      { name: "Kolonialstadt", jahr: 1580, ab: 0, braucht: ["plaza", "kathedrale", "cabildo"] },
      { name: "Wachstum und Industrie", jahr: 1930, ab: 6000, braucht: ["fabrik"] },
      { name: "Megastadt", jahr: 2020, ab: 25000, braucht: [] },
    ],
    orte: [
      S("plaza", 0, 2500, [flach(5)], { max: 1 }),
      S("kathedrale", 0, 1500, [nah("plaza", 140, "Plaza")], { max: 1 }),
      S("cabildo", 0, 1500, [nah("plaza", 140, "Plaza")], { max: 1 }),
      S("fabrik", 1, 8000, [fern("plaza", 700, "Plaza")], { viertel: { typ: "marginal", r: 260, raster: 40 } }),
      S("hochhaus", 2, 9000, [nah("plaza", 1500, "Plaza"), fern("plaza", 500, "Plaza")], { viertel: { typ: "oberschicht", r: 300 } }),
      S("einkauf", 2, 6000, [fern("plaza", 1200, "Plaza")], { viertel: { typ: "gated", r: 220, raster: 80 } }),
    ],
  },
  orientalisch: {
    muster: "organisch", kern: "medina", mauerBis: 1900, dichte: 220, block: 50,
    stufen: [
      { name: "Medina", jahr: 900, ab: 0, braucht: ["moschee", "kasbah"] },
      { name: "Handelsstadt", jahr: 1400, ab: 4000, braucht: ["hammam", "karawanserei"] },
      { name: "Ville nouvelle und heute", jahr: 1950, ab: 14000, braucht: [] },
    ],
    orte: [
      S("moschee", 0, 3000, [amFluss(100, 900), flach(8)], { max: 1, viertel: { typ: "bazar", r: 110, raster: 30 } }),
      S("kasbah", 0, 1500, [erhoeht(5), nah("moschee", 600, "Moschee")], { max: 1 }),
      S("hammam", 1, 1500, [nah("moschee", 150, "Moschee")]),
      S("karawanserei", 1, 2500, [fern("moschee", 250, "Moschee")]),
      S("bahnhof", 2, 8000, [fern("moschee", 700, "Moschee")], { viertel: { typ: "ville", r: 400, raster: 100 } }),
    ],
  },
  bergmann: {
    muster: "organisch", kern: "bergstadt", zentrum: "markt", mauerBis: 1850, dichte: 100, block: 60,
    stufen: [
      { name: "Berggeschrei", jahr: 1170, ab: 0, braucht: ["schacht"] },
      { name: "Planmäßige Bergstadt", jahr: 1500, ab: 2500, braucht: ["markt", "kirche", "bergamt", "huettenwerk"] },
      { name: "Bahn im Tal", jahr: 1900, ab: 8000, braucht: ["bahnhof"] },
      { name: "heute", jahr: 2025, ab: 14000, braucht: [] },
    ],
    orte: [
      S("schacht", 0, 1500, [beiMerkmal("erz", 250, "Erzgang")], { max: 4, viertel: { typ: "halde", r: 40 } }),
      S("markt", 1, 2500, [flach(10), nah("schacht", 650, "Schacht")], { max: 1 }),
      S("kirche", 1, 1500, [nah("markt", 150, "Markt")]),
      S("bergamt", 1, 1000, [nah("markt", 200, "Markt")], { max: 1 }),
      S("huettenwerk", 1, 2000, [amWasser(60)], { viertel: { typ: "huette", r: 110, raster: 60 } }),
      S("bahnhof", 2, 6000, [flach(3), amFluss(40, 400)], { viertel: { typ: "industrie", r: 160, raster: 80 } }),
      S("universitaet", 3, 5000, [nah("markt", 900, "Markt")], { viertel: { typ: "uni", r: 150 } }),
    ],
  },
  industrie: {
    muster: "raster", kern: "gruenderzeit", zentrum: "kirche", mauerBis: -1e9, dichte: 140, block: 100,
    stufen: [
      { name: "Dorf und Zeche", jahr: 1840, ab: 0, braucht: ["kirche", "zechenturm"] },
      { name: "Hochindustrialisierung", jahr: 1890, ab: 4000, braucht: ["hochofen", "kanalhafen", "bahnhof"] },
      { name: "Zechensterben", jahr: 1965, ab: 20000, braucht: ["schule"] },
      { name: "Strukturwandel", jahr: 2025, ab: 35000, braucht: [] },
    ],
    orte: [
      S("kirche", 0, 1200, [amFluss(80, 600)], { max: 1 }),
      S("zechenturm", 0, 5000, [beiMerkmal("kohle", 700, "Kohlefeld"), fern("kirche", 400, "Dorf")], { max: 4, viertel: { typ: "kolonie", r: 200, raster: 60 } }),
      S("hochofen", 1, 9000, [amFluss(40, 300), flach(3)], { max: 2, viertel: { typ: "industrie", r: 220, raster: 110 } }),
      S("kanalhafen", 1, 3000, [nah("zechenturm", 300, "Zeche")]),
      S("bahnhof", 1, 6000, [nah("kirche", 900, "Ortskern")], { viertel: { typ: "gruenderzeit", r: 260 } }),
      S("schule", 2, 6000, [fern("kirche", 800, "Ortskern")], { viertel: { typ: "grosssiedlung", r: 220, raster: 110 } }),
      S("universitaet", 3, 8000, [fern("zechenturm", 300, "Zeche")], { viertel: { typ: "uni", r: 180 } }),
    ],
  },
  hafen: {
    muster: "organisch", kern: "kontor", zentrum: "markt", mauerBis: 1860, dichte: 170, block: 60,
    stufen: [
      { name: "Hansestadt", jahr: 1250, ab: 0, braucht: ["kai", "markt", "kirche", "zollhaus"] },
      { name: "Freihafen", jahr: 1890, ab: 6000, braucht: ["werft", "bahnhof", "leuchtturm"] },
      { name: "Containerhafen und heute", jahr: 1990, ab: 22000, braucht: [] },
    ],
    orte: [
      S("kai", 0, 3000, [amWasser(25), flach(5)], { muss: amWasser(70), max: 4, viertel: { typ: "speicher", r: 110, raster: 60 } }),
      S("markt", 0, 2000, [nah("kai", 350, "Kai")], { max: 1 }),
      S("kirche", 0, 1500, [nah("markt", 150, "Markt")]),
      S("zollhaus", 0, 1500, [nah("kai", 150, "Kai")], { max: 1 }),
      S("werft", 1, 5000, [amWasser(30), fern("markt", 500, "Markt")], { muss: amWasser(70), viertel: { typ: "hafengebiet", r: 180, raster: 120 } }),
      S("leuchtturm", 1, 500, [amWasser(80), fern("markt", 600, "Markt")], { max: 1 }),
      S("bahnhof", 1, 7000, [nah("markt", 1200, "Markt")], { viertel: { typ: "gruenderzeit", r: 320 } }),
      S("einkauf", 2, 7000, [fern("markt", 1000, "Markt")], { viertel: { typ: "hafencity", r: 220, raster: 80 } }),
    ],
  },
  tech: {
    muster: "raster", kern: "kleinstadt", zentrum: "depot", mauerBis: -1e9, dichte: 35, block: 100,
    stufen: [
      { name: "Tal der Obstgärten", jahr: 1900, ab: 0, braucht: ["depot"] },
      { name: "Universität und Forschungspark", jahr: 1955, ab: 3000, braucht: ["universitaet", "forschungspark"] },
      { name: "Silicon Valley", jahr: 1985, ab: 12000, braucht: ["techzentrale", "einkauf"] },
      { name: "heute", jahr: 2025, ab: 30000, braucht: [] },
    ],
    orte: [
      S("depot", 0, 2500, [flach(3)], { max: 1 }),
      S("universitaet", 1, 5000, [fern("depot", 900, "Bahnhof"), flach(4)], { max: 1, viertel: { typ: "einfamilienhaus", r: 380, raster: 70 } }),
      S("forschungspark", 1, 5000, [nah("universitaet", 700, "Universität")], { viertel: { typ: "campus", r: 160 } }),
      S("techzentrale", 2, 10000, [fern("depot", 900, "Bahnhof")], { viertel: { typ: "campus", r: 200 } }),
      S("rechenzentrum", 2, 3000, [fern("depot", 1200, "Bahnhof")]),
      S("einkauf", 2, 9000, [fern("depot", 1000, "Bahnhof")], { viertel: { typ: "pendler", r: 420, raster: 90 } }),
    ],
  },
};

// ---------------------------------------------------------------- Bewerten

export interface Pruefung { erlaubt: boolean; faktor: number; gruende: Bewertung[] }

/** Wie gut steht ein Ort von Typ b bei p? */
export function pruefeOrt(g: Gelaende, stil: Stil, b: BauTyp, p: P, orte: Ort[]): Pruefung {
  const s = BAUPLAENE[stil].orte.find(x => x.bau === b);
  if (!s) return { erlaubt: false, faktor: 0, gruende: [{ ok: false, text: "gehört nicht zu diesem Stadttyp" }] };
  const hart = [land(g, p, orte), ...(s.muss ? [s.muss(g, p, orte)] : [])];
  if (neigungBei(g, p.x, p.y) > 45) hart.push({ ok: false, text: "viel zu steil zum Bauen" });
  const andere = orte.filter(o => !(o.p.x === p.x && o.p.y === p.y));
  if (s.max && andere.filter(o => o.bau === b).length >= s.max) hart.push({ ok: false, text: `höchstens ${s.max}× möglich` });
  const soll = b === "bahnhof" || b === "depot" ? [...s.soll, fern(b, 700, "anderen Bahnhof")] : s.soll;
  const weich = soll.map(r => r(g, p, andere)).filter(x => x.text);
  const erlaubt = hart.every(x => x.ok);
  const faktor = erlaubt ? Math.pow(0.5, weich.filter(x => !x.ok).length) : 0;
  return { erlaubt, faktor, gruende: [...hart.filter(x => !x.ok), ...weich] };
}

/** Was eine gute Lage für diesen Ort ausmacht (vor dem Setzen) */
export function lageRegeln(stil: Stil, b: BauTyp): { muss: string[]; soll: string[] } {
  const s = BAUPLAENE[stil].orte.find(x => x.bau === b);
  if (!s) return { muss: [], soll: [] };
  return { muss: ["an Land", ...(s.muss ? [s.muss.beschreibung] : [])], soll: s.soll.map(r => r.beschreibung) };
}

/** Eignung auf einem Raster k × k: je Feld 0 (verboten) oder 1, 0,5, 0,25 … (Wirkung) */
export function eignungsRaster(g: Gelaende, stil: Stil, b: BauTyp, orte: Ort[], k = 72): Float32Array {
  const aus = new Float32Array(k * k);
  for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) {
    const p = { x: (i + 0.5) * g.breite / k, y: (j + 0.5) * g.breite / k };
    aus[j * k + i] = pruefeOrt(g, stil, b, p, orte).faktor;
  }
  return aus;
}

// ---------------------------------------------------------------- Stand und Zeit

export interface BauStand { orte: Ort[]; einwohner: number; tick: number }

export const leererStand = (): BauStand => ({ orte: [], einwohner: 0, tick: 0 });

/** Index der aktuellen Stufe */
export function stufeVon(plan: BauPlan, einwohner: number): number {
  let i = 0;
  while (i + 1 < plan.stufen.length && einwohner >= plan.stufen[i + 1].ab) i++;
  return i;
}

/** fehlende Orte, die die aktuelle Stufe für den Aufstieg braucht */
export function fehlt(plan: BauPlan, stand: BauStand): BauTyp[] {
  const st = plan.stufen[stufeVon(plan, stand.einwohner)];
  return st.braucht.filter(b => !stand.orte.some(o => o.bau === b));
}

/** Kapazität: Summe der Orte nach Lage, gedeckelt auf die nächste Stufe, solange Pflicht-Orte fehlen */
export function kapazitaet(g: Gelaende, stil: Stil, stand: BauStand): { kap: number; gedeckelt: boolean } {
  const plan = BAUPLAENE[stil];
  let kap = 0;
  for (const o of stand.orte) {
    const s = plan.orte.find(x => x.bau === o.bau);
    if (s) kap += s.kap * pruefeOrt(g, stil, o.bau, o.p, stand.orte).faktor;
  }
  const i = stufeVon(plan, stand.einwohner);
  const naechste = plan.stufen[i + 1];
  if (naechste && fehlt(plan, stand).length && kap >= naechste.ab) return { kap: naechste.ab * 0.97, gedeckelt: true };
  // jede Stufe, deren Pflichtbauten alle stehen, trägt (bei guter Lage) sicher bis zur nächsten —
  // auch nachdem sie erreicht ist, sonst fiele die Stadt knapp unter die Schwelle zurück
  for (let j = 0; j + 1 < plan.stufen.length; j++) {
    const br = plan.stufen[j].braucht;
    if (br.some(b => !stand.orte.some(o => o.bau === b))) break;
    const lage = br.map(b => Math.max(...stand.orte.filter(o => o.bau === b).map(o => pruefeOrt(g, stil, b, o.p, stand.orte).faktor)));
    const mittel = lage.length ? lage.reduce((a, x) => a + x, 0) / lage.length : 1;
    kap = Math.max(kap, plan.stufen[j + 1].ab * 1.15 * mittel);
  }
  return { kap, gedeckelt: false };
}

/** ein Zeitschritt: Einwohner wachsen auf die Kapazität zu (oder schrumpfen) */
export function schritt(g: Gelaende, stil: Stil, stand: BauStand): BauStand {
  const { kap } = kapazitaet(g, stil, stand);
  const d = kap - stand.einwohner;
  const neu = Math.max(0, stand.einwohner + Math.sign(d) * Math.min(Math.abs(d), Math.max(40, Math.abs(d) * 0.08)));
  return { ...stand, einwohner: Math.round(neu), tick: stand.tick + 1 };
}

/** Jahr: zwischen den Stufen nach Einwohnern eingeblendet */
export function jahrVonStand(plan: BauPlan, einwohner: number): number {
  const i = stufeVon(plan, einwohner);
  const a = plan.stufen[i], b = plan.stufen[i + 1];
  if (!b) return a.jahr;
  const t = Math.max(0, Math.min(1, (einwohner - a.ab) / (b.ab - a.ab)));
  return Math.round(a.jahr + (b.jahr - a.jahr) * t * 0.9);
}

// ---------------------------------------------------------------- Stadt erzeugen

const polar = (c: P, w: number, r: number): P => ({ x: c.x + Math.cos(w) * r, y: c.y + Math.sin(w) * r });
const kreis = (c: P, r: number, z?: () => number, k = 20): P[] =>
  Array.from({ length: k }, (_, i) => polar(c, (i / k) * Math.PI * 2, r * (z ? 0.88 + z() * 0.24 : 1)));

/** Straßen in einem Kreis nach Muster */
function strassenIn(g: Gelaende, s: Stadt, c: P, r: number, muster: Muster, block: number, dreh: number, seed: number, art: "neben" | "gasse" = "neben") {
  const z = zufallsquelle(seed);
  const drin = (p: P) => abstand(p, c) < r && baubar(g, p, 22);
  if (muster === "organisch") {
    const feld: Feld = { basen: [{ art: "radial", c, groesse: r }, { art: "raster", c, winkel: dreh, groesse: r * 1.2 }], rauschen: { r: perlin(seed), staerke: 0.7, skala: 160 } };
    const l = stromlinien(feld, drin, { dsep: block, dtest: block * 0.4, schritt: 5, maxLaenge: r * 2, minLaenge: 25, verbinden: 14, zufall: z, keime: [c], rahmen: { x0: c.x - r, y0: c.y - r, x1: c.x + r, y1: c.y + r }, max: 40 });
    s.strassen.push(...l.map(punkte => ({ art, punkte })));
  } else {
    s.strassen.push(...gedrehtesRaster(g, c, 2 * r, 2 * r, block, block * 0.8, dreh, art, drin));
  }
}

/**
 * Die Stadt zu einem Stand: Kern um den ersten Ort, Viertel um die Orte,
 * Straßen zu allen Orten, Mauer bis zur Industrialisierung, Nahverkehr.
 * Deterministisch — gleicher Stand, gleiche Stadt.
 */
export function stadtAus(g: Gelaende, stil: Stil, stand: BauStand, seed: number): Stadt {
  const plan = BAUPLAENE[stil];
  const s = leereStadt(stil);
  const orte = stand.orte;
  for (const o of orte) bau(s, o.bau, o.p);
  if (!orte.length) return s;
  const c = (orte.find(o => o.bau === plan.zentrum) ?? orte[0]).p;
  const jahr = jahrVonStand(plan, stand.einwohner);
  const w = flussRichtung(g, c) ?? 0;
  const dreh = plan.muster === "raster" && (stil === "roemisch" || stil === "amerikanisch" || stil === "lateinamerika" || stil === "tech") ? 0 : w;
  // Fläche des Kerns aus den Einwohnern (Dichte in Einw./ha); Viertel um Orte tragen den Rest
  const viertelOrte = orte.filter(o => plan.orte.find(x => x.bau === o.bau)?.viertel);
  const kernAnteil = viertelOrte.length ? 0.6 : 1;
  const ha = (stand.einwohner * kernAnteil) / plan.dichte;
  const r = Math.max(60, Math.sqrt((ha * 10000) / Math.PI));

  // Fernstraße durch den Kern, dem Tal folgend
  if (stand.einwohner > 0) s.strassen.push({ art: "fernstrasse", name: "Fernstraße", punkte: fernstrasse(g, c, w, 0.6, 25) });

  // Kern
  if (plan.muster === "stern") {
    const R = Math.max(160, r);
    const wall = bastionen(c, R, 8);
    s.zonen.push({ typ: "glacis", poly: bastionen(c, R * 1.6, 8) }, { typ: "festung", poly: wall });
    if (jahr < plan.mauerBis) s.mauern.push(wall);
    s.strassen.push(...gedrehtesRaster(g, c, 2 * R, 2 * R, plan.block, plan.block, 0, "neben", p => inPoly(p, wall)));
  } else if (plan.muster === "faecher") {
    // Strahlen vom Schloss in den Halbkreis vor ihm, Zirkel als Ring
    const garten = w + Math.PI / 2;
    for (let k = 0; k <= 8; k++) {
      const a = garten + Math.PI / 2 + (k / 8) * Math.PI;
      s.strassen.push({ art: k === 4 ? "haupt" : "neben", punkte: [polar(c, a, 40), polar(c, a, Math.max(120, r * 1.15))] });
    }
    for (const f of [0.45, 0.8]) {
      const bogen: P[] = [];
      for (let k = 0; k <= 16; k++) bogen.push(polar(c, garten + Math.PI / 2 + (k / 16) * Math.PI, r * f + 40));
      s.strassen.push({ art: f < 0.5 ? "ring" : "neben", punkte: bogen });
    }
    const halb: P[] = [c];
    for (let k = 0; k <= 16; k++) halb.push(polar(c, garten + Math.PI / 2 + (k / 16) * Math.PI, r * 1.2 + 40));
    s.zonen.push({ typ: plan.kern, poly: halb });
  } else {
    const z = zufallsquelle(seed + 5);
    const poly = kreis(c, r, plan.muster === "organisch" ? z : undefined);
    s.zonen.push({ typ: plan.kern, poly });
    strassenIn(g, s, c, r, plan.muster, plan.block, dreh, seed, plan.muster === "organisch" && jahr < 1700 ? "gasse" : "neben");
    const rand = kreis(c, r * 1.08, zufallsquelle(seed + 9), 16);
    // Mauer bis zur Industrialisierung, danach Ring auf ihrem Platz
    if (stand.einwohner > 600 && jahr < plan.mauerBis) s.mauern.push(rand);
    else if (stand.einwohner > 600 && plan.mauerBis > 0) s.strassen.push({ art: "ring", name: "Ring", punkte: [...rand, rand[0]] });
  }

  // Viertel um die Orte, wachsen mit der Stadt
  const wachstum = Math.min(1, Math.max(0.35, stand.einwohner / (plan.stufen[plan.stufen.length - 1].ab || 1)));
  viertelOrte.forEach((o, i) => {
    const v = plan.orte.find(x => x.bau === o.bau)!.viertel!;
    const rv = v.r * (0.5 + 0.5 * wachstum);
    const m = abstand(o.p, c) < r * 0.6 ? o.p : polar(o.p, Math.atan2(o.p.y - c.y, o.p.x - c.x), rv * 0.4);
    const poly = v.typ === "halde" ? rechteck(polar(o.p, Math.atan2(c.y - o.p.y, c.x - o.p.x) + 2.4, 40), 60, 36, w) : kreis(m, rv, zufallsquelle(seed + i));
    s.zonen.push({ typ: v.typ, poly });
    if (v.typ !== "halde" && v.typ !== "schlossgarten") {
      const raster = v.raster ?? plan.block;
      strassenIn(g, s, m, rv, v.typ === "einfamilienhaus" || v.typ === "pendler" || v.typ === "marginal" ? "organisch" : "raster", raster, w, seed + 31 * i);
    }
  });

  // Hauptstraßen: vom Kern zu jedem Ort (dem Gelände folgend)
  for (const o of orte) if (abstand(o.p, c) > 60) s.strassen.push({ art: "haupt", punkte: glaetten(weg(g, c, o.p, { steigung: 0.6, wasser: 25, raster: 20 }), 1) });

  // Bahn durch alle Bahnhöfe: vom Kartenrand über jeden Bahnhof zum anderen Rand
  const bhf = orte.filter(o => o.bau === "bahnhof" || o.bau === "depot").map(o => o.p);
  if (bhf.length === 1) {
    const wb = Math.atan2(bhf[0].y - c.y, bhf[0].x - c.x) + Math.PI / 2;
    s.strassen.push({ art: "bahn", name: "Eisenbahn", punkte: glaetten(fernstrasse(g, bhf[0], wb, 4, 8), 2) });
  } else if (bhf.length > 1) {
    // Reihenfolge entlang der Hauptrichtung der Bahnhöfe
    let a = bhf[0], b = bhf[1], weit = 0;
    for (const p of bhf) for (const q of bhf) if (abstand(p, q) > weit) { weit = abstand(p, q); a = p; b = q; }
    const wb = Math.atan2(b.y - a.y, b.x - a.x);
    const reihe = [...bhf].sort((p, q) => (p.x - a.x) * Math.cos(wb) + (p.y - a.y) * Math.sin(wb) - ((q.x - a.x) * Math.cos(wb) + (q.y - a.y) * Math.sin(wb)));
    const halte = [randPunkt(reihe[0], wb + Math.PI, g.breite), ...reihe, randPunkt(reihe[reihe.length - 1], wb, g.breite)];
    const pfad: P[] = [halte[0]];
    for (let i = 1; i < halte.length; i++) pfad.push(...weg(g, halte[i - 1], halte[i], { steigung: 4, wasser: 8 }).slice(1));
    s.strassen.push({ art: "bahn", name: "Eisenbahn", punkte: glaetten(pfad, 2) });
  }
  freiraeumen(s);
  nahverkehr(g, s, jahr, stil);
  return s;
}
