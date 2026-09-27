/**
 * Küstendynamik — das Querprofil einer Küste als Höhenlinie.
 *
 * Jede Spalte ist 1 m breit und hat drei Schichten übereinander:
 *   fels  — fester Untergrund (Kreide/Geschiebemergel am Kliff, Watt-/Kleiboden)
 *   sand  — lockerer Sand, den Wellen und Wind bewegen
 *   deich — der Deichkörper (Sandkern mit Kleidecke), nur wo gebaut
 *
 * Die See liegt links (Spalte 0), das Land rechts — wie in den Schulbuch-
 * Profilen. Höhen in m über NHN (≈ Mittelwasser).
 *
 * Das Modell ist ein Schulmodell, keine Ingenieursrechnung. Es bildet die
 * Zusammenhänge ab, die im Unterricht vorkommen, mit Größenordnungen aus
 * echten Küsten:
 *   - Wellen brechen, wenn das Wasser flacher als etwa ihre Höhe wird
 *     (Brecherzone am Sandriff, danach Rollerzone, Spülsaum am Ufer).
 *   - Sturm trägt Sand vom Strand ins Riff, ruhiges Wetter bringt ihn zurück;
 *     was der Küstenlängsstrom mitnimmt, fehlt dem Strand für immer.
 *   - Am Kliff frisst die Brandung eine Hohlkehle; Frost und Regen lockern
 *     die Wand; irgendwann bricht sie ab und die Kliffhalde schützt den Fuß,
 *     bis das Meer sie abgeräumt hat — Findlinge bleiben als Blockstrand.
 *   - Wind weht trockenen Sand landeinwärts; Strandhafer hält ihn fest.
 *   - Läuft das Wasser über Düne oder Deich, füllt sich das Hinterland.
 */

export type KuestenArt = "flach" | "steil" | "marsch";

export const DX = 1;

export const BEWUCHS = { KEIN: 0, STRANDHAFER: 1, SALZWIESE: 2, GRAS: 3 } as const;
export const SCHUTZ = { KEIN: 0, DECKWERK: 1, LAHNUNG: 2, ZAUN: 3 } as const;

export interface Objekt {
  id: string;
  art: "hotel" | "haus" | "leuchtturm" | "burgwall" | "weg" | "schaf";
  name: string;
  x: number;
  /** Bodenhöhe beim Bau — wer tief darunter gräbt, holt das Haus. */
  boden0: number;
  zerstoert?: string;
  nass?: boolean;
}

export interface Meldung { stunde: number; text: string; art: "info" | "warnung" | "schaden" | "gut" }

export interface Wetter {
  /** Windstärke in Beaufort 0–12 */
  bft: number;
  /** true = Wind vom Meer aufs Land */
  auflandig: boolean;
  regen: boolean;
  frost: boolean;
}

export interface Profil {
  art: KuestenArt;
  n: number;
  fels: Float64Array;
  sand: Float64Array;
  deich: Float64Array;
  bewuchs: Uint8Array;
  schutz: Uint8Array;
  bloecke: Float64Array;
  /** Tiefe der Brandungshohlkehle an der Kliffwand (m) */
  kehle: number;
  kehleX: number;
  /** 0 … 1: wie sehr Frost, Regen und Wurzeln die Kliffwand gelockert haben */
  verwitterung: number;
  /** Wasser im Hinterland (m³ je m Küste) */
  hinterVol: number;
  deichSchaden: number;
  deichGebrochen: boolean;
  /** Mittlerer Tidenhub (m) */
  hub: number;
  /** Anteil des abgetragenen Sandes, den der Küstenlängsstrom wegträgt */
  laengs: number;
  /** Wie hoch eine schwere Sturmflut das Wasser drückt (m) */
  stauMax: number;
  /** Ostsee: kürzerer Anlauf, kleinere Wellen */
  wellenFaktor: number;
  stunde: number;
  /** Laufende Sturmflut: verbleibende und gesamte Dauer in Stunden, Höhe */
  flut: { rest: number; dauer: number; hoehe: number } | null;
  /** Bilanz in m³ je m Küste */
  bilanz: { weggetragen: number; aufgespuelt: number; kliff: number; angeweht: number; abgetragen: number; zurueck: number };
  /** Kosten und Schäden in Mio € — gerechnet für 1 km Küste */
  kosten: number;
  schaden: number;
  objekte: Objekt[];
  meldungen: Meldung[];
  /** Für die Zeichnung: der letzte Abbruch */
  abbruch: { x0: number; x1: number; stunde: number } | null;
  /** Ausgangshöhen, damit die Zeichnung zeigen kann, was fehlt */
  start: Float64Array;
  seed: number;
  /** Merker, damit Meldungen nicht jede Stunde kommen */
  merker: Record<string, boolean>;
}

/* ─────────────────────────────────────────────── Konstanten (geeicht) ── */

/** Abtrag durch Brandung: m³ je m Küste und Stunde je m² Wellenhöhe */
const K_BRANDUNG = 0.035;
/** Wie viel Hohlkehle (m) eine Einheit Brandungsarbeit in die Wand frisst */
const K_KEHLE = 0.005;
/** Rücktransport an den Strand bei ruhigem Wetter (m³/m/h) */
const K_AUFBAU = 0.02;
/** Flugsand (m³/m/h) je (Bft − 3)³ */
const K_WIND = 0.0003;
/** Überlauf ins Hinterland (m³/m/h) */
const K_UEBER = 6;
/** Wie schnell Überlauf die Binnenböschung eines Deichs ausspült */
const K_DEICHSCHADEN = 0.8;
/** Schöpfwerk/Siel: m³/m/h, die bei niedrigem Außenwasser abfließen */
const K_SIEL = 1.5;
/** Schwebstoff, der sich zwischen Lahnungen absetzt (m/h) ≈ 6 cm im Jahr */
const K_SCHLICK = 0.06 / 8766;
/** Böschungswinkel: über Wasser ~33°, unter Wasser deutlich flacher */
const TAN_TROCKEN = 0.65;
const TAN_NASS = 0.18;
/** Kehlentiefe, bei der die Wand ohne Verwitterung abbricht */
const KEHLE_KRITISCH = 1.6;

export const STUNDEN_JAHR = 8766;

/* ────────────────────────────────────────────────────────── Zufall ── */

export function zufall(p: { seed: number }): number {
  // mulberry32 — reproduzierbar, damit Tests und Vorführung gleich laufen
  let t = (p.seed = (p.seed + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/* ─────────────────────────────────────────────────────── Grundgrößen ── */

export function boden(p: Profil, i: number): number {
  return p.fels[i] + p.sand[i] + p.deich[i];
}

export function tide(hub: number, stunde: number): number {
  return (hub / 2) * Math.cos((2 * Math.PI * stunde) / 12.42);
}

/** Zusätzlicher Wasserstand durch Sturmflut bzw. Windstau */
export function stau(p: Profil, w: Wetter): number {
  let s = 0;
  if (p.flut) {
    const t = 1 - p.flut.rest / p.flut.dauer;
    s = p.flut.hoehe * Math.sin(Math.PI * t);
  }
  // Auflandiger Sturm drückt auch ohne »Sturmflut« Wasser gegen die Küste.
  if (w.auflandig && w.bft > 6) s = Math.max(s, (w.bft - 6) * 0.12 * (p.stauMax / 3));
  return s;
}

export function wasserstand(p: Profil, w: Wetter): number {
  return tide(p.hub, p.stunde) + stau(p, w);
}

/** Wellenhöhe draußen auf See (m) nach Beaufort — Nordsee-Größenordnung */
const H_BFT = [0, 0.1, 0.2, 0.6, 1.0, 1.5, 2.2, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0];

export function wellenhoehe(p: Profil, w: Wetter): number {
  const h = H_BFT[Math.max(0, Math.min(12, Math.round(w.bft)))] * p.wellenFaktor;
  return w.auflandig ? h : h * 0.2;
}

export function mhw(p: Profil) { return p.hub / 2; }
export function mnw(p: Profil) { return -p.hub / 2; }

/** Erste Spalte von See her, deren Boden über dem Wasser liegt */
export function uferIndex(p: Profil, W: number): number {
  for (let i = 0; i < p.n; i++) if (boden(p, i) >= W) return i;
  return p.n;
}

export interface Wellen {
  /** Wellenhöhe je Spalte (0 an Land) */
  H: Float64Array;
  /** Wo die Wellen zum ersten Mal brechen (−1: nirgends) */
  brecher: number;
  ufer: number;
  /** Wellenhöhe, die am Ufer ankommt */
  amUfer: number;
  /** Steigung der Böschung, auf die die Wellen treffen (tan) */
  neigung: number;
}

/**
 * Wellen auf dem Weg zum Ufer: Eine Welle bricht, wenn das Wasser flacher
 * als etwa ihre Höhe wird (H ≤ 0,78 · Tiefe). Ein Sandriff lässt sie also
 * weit draußen brechen — dahinter kommen nur noch kleine Wellen an.
 */
export function wellen(p: Profil, W: number, H0: number): Wellen {
  const H = new Float64Array(p.n);
  let h = H0, brecher = -1, gebrochen = false;
  const ufer = uferIndex(p, W);
  for (let i = 0; i < ufer; i++) {
    const tiefe = W - boden(p, i);
    const grenze = 0.78 * tiefe;
    // Eine gebrochene Welle verliert weiter Kraft, bis sie zu ihrer Tiefe
    // passt (Dally-Modell) — hinter einem Riff kommt also weniger an.
    if (gebrochen && h > 0.4 * tiefe) h -= (0.08 / Math.max(tiefe, 0.3)) * (h - 0.4 * tiefe) * DX;
    if (grenze < h) {
      if (brecher < 0 && h > 0.25) brecher = i;
      gebrochen = true;
      h = grenze;
    }
    if (p.bewuchs[i] === BEWUCHS.SALZWIESE) h *= 0.99;
    if (p.schutz[i] === SCHUTZ.LAHNUNG) h *= 0.985;
    if (p.bloecke[i] > 0.2) h *= 1 - 0.015 * Math.min(p.bloecke[i], 4);
    H[i] = h;
  }
  // Was am Ufer ankommt: die größte Welle der letzten 15 m vor der
  // Wasserlinie — an der allerletzten nassen Spalte wäre jede Welle null.
  let amUfer = 0;
  for (let k = Math.max(0, ufer - 15); k < ufer; k++) amUfer = Math.max(amUfer, H[k]);
  const neigung = ufer >= 5 && ufer < p.n ? Math.max(0, (boden(p, ufer) - boden(p, ufer - 5)) / 5) : 0;
  return { H, brecher, ufer, amUfer, neigung };
}

/**
 * Wie hoch die Wellen über den Ruhewasserspiegel auflaufen (m). Auf einer
 * steilen Böschung schießt das Wasser viel höher hinauf als auf einer
 * flachen — deshalb bekommen Deiche außen eine Neigung von 1:6.
 */
export function auflauf(wl: Wellen, H0: number) {
  return wl.amUfer * Math.min(2.2, 0.5 + 4 * wl.neigung) + 0.1 * H0;
}

/* ─────────────────────────────────────────────────────────── Aufbau ── */

function leer(art: KuestenArt, n: number): Profil {
  return {
    art, n,
    fels: new Float64Array(n), sand: new Float64Array(n), deich: new Float64Array(n),
    bewuchs: new Uint8Array(n), schutz: new Uint8Array(n), bloecke: new Float64Array(n),
    kehle: 0, kehleX: -1, verwitterung: 0,
    hinterVol: 0, deichSchaden: 0, deichGebrochen: false,
    hub: 0, laengs: 0, stauMax: 3, wellenFaktor: 1,
    stunde: 0, flut: null,
    bilanz: { weggetragen: 0, aufgespuelt: 0, kliff: 0, angeweht: 0, abgetragen: 0, zurueck: 0 },
    kosten: 0, schaden: 0,
    objekte: [], meldungen: [], abbruch: null,
    start: new Float64Array(n), seed: 20260927, merker: {},
  };
}

/** Stückweise lineare Höhe durch Stützpunkte [x, z] */
function linie(punkte: [number, number][], x: number): number {
  if (x <= punkte[0][0]) return punkte[0][1];
  for (let k = 1; k < punkte.length; k++) {
    const [x1, z1] = punkte[k];
    const [x0, z0] = punkte[k - 1];
    if (x <= x1) return z0 + ((z1 - z0) * (x - x0)) / (x1 - x0);
  }
  return punkte[punkte.length - 1][1];
}

function objekt(p: Profil, o: Omit<Objekt, "boden0">) {
  p.objekte.push({ ...o, boden0: boden(p, Math.round(o.x)) });
}

/**
 * Flachküste nach dem Vorbild der Sylter Weststrands: Vorstrand mit Sandriff
 * und Küstenpriel, Strand mit Strandwall, Düne mit Strandhafer, dahinter
 * Häuser. Tidenhub ≈ 1,8 m; der Längsstrom trägt jedes Jahr Sand weg.
 */
function flachkueste(): Profil {
  const n = 360;
  const p = leer("flach", n);
  p.hub = 1.8; p.laengs = 0.25; p.stauMax = 3.0; p.wellenFaktor = 1;
  const oben: [number, number][] = [
    [0, -8], [90, -4.6], [135, -2.4], [150, -1.3], [158, -1.2], [170, -2.1], [182, -2.4],
    [205, -0.9], [228, 0.9], [240, 2.0], [250, 2.3], [262, 2.8], [270, 3.4],
    [284, 10.5], [292, 12], [300, 11.5], [316, 5.5], [326, 4.2], [360, 4.2],
  ];
  const unten: [number, number][] = [[0, -14], [260, -9], [360, -5]];
  for (let i = 0; i < n; i++) {
    p.fels[i] = linie(unten, i);
    p.sand[i] = linie(oben, i) - p.fels[i];
    if (i >= 272 && i <= 322) p.bewuchs[i] = BEWUCHS.STRANDHAFER;
    if (i > 322) p.bewuchs[i] = BEWUCHS.GRAS;
  }
  objekt(p, { id: "hotel", art: "hotel", name: "Hotel", x: 334 });
  objekt(p, { id: "haus", art: "haus", name: "Wohnhaus", x: 350 });
  p.start = Float64Array.from({ length: n }, (_, i) => boden(p, i));
  return p;
}

/**
 * Steilküste nach dem Vorbild von Kap Arkona (Rügen): 40 m hohes Kliff aus
 * Kreide und Geschiebemergel mit Findlingen, davor Blockstrand und
 * Abrasionsplattform, draußen die Seehalde. Ostsee: fast keine Gezeiten.
 */
function steilkueste(): Profil {
  const n = 300;
  const p = leer("steil", n);
  p.hub = 0.1; p.laengs = 0.6; p.stauMax = 1.6; p.wellenFaktor = 0.75;
  const fels: [number, number][] = [
    [0, -9], [100, -5], [125, -2.2], [215, -0.9], [236, 0.2], [239, 0.6],
    [240, 40], [300, 41],
  ];
  const sand: [number, number][] = [
    [0, 0.2], [50, 1.6], [95, 1.8], [118, 0.3], [125, 0], [226, 0], [230, 0.3],
    [234, 1.6], [238, 4.2], [239, 5.5], [240, 0],
  ];
  for (let i = 0; i < n; i++) {
    p.fels[i] = linie(fels, i);
    p.sand[i] = i < 240 ? Math.max(0, linie(sand, i)) : 0;
    if (i >= 240) p.bewuchs[i] = BEWUCHS.GRAS;
    if (i >= 216 && i <= 236) p.bloecke[i] = 1 + ((i * 7) % 3);
  }
  objekt(p, { id: "burgwall", art: "burgwall", name: "Burgwall (slawische Tempelburg)", x: 246 });
  objekt(p, { id: "weg", art: "weg", name: "Wanderweg an der Kante", x: 256 });
  objekt(p, { id: "leuchtturm", art: "leuchtturm", name: "Leuchtturm", x: 286 });
  p.kehleX = 240;
  p.start = Float64Array.from({ length: n }, (_, i) => boden(p, i));
  return p;
}

/**
 * Marschküste mit Deich (Nordsee-Festland): Watt mit Priel, Vorland mit
 * Salzwiese, ein alter Deich wie vor 1962 (niedrig, steile Binnenböschung),
 * dahinter der Koog — tiefer als das mittlere Hochwasser.
 */
function marschkueste(): Profil {
  const n = 400;
  const p = leer("marsch", n);
  p.hub = 3.0; p.laengs = 0.1; p.stauMax = 3.6; p.wellenFaktor = 1;
  const grund: [number, number][] = [
    [0, -4.5], [60, -2.4], [120, -1.4], [132, -3.4], [142, -3.4], [152, -1.2],
    [200, -0.5], [218, 1.6], [226, 1.9], [262, 2.0], [400, 0.4],
  ];
  const koog: [number, number][] = [[262, 2.0], [300, 0.5], [400, 0.4]];
  for (let i = 0; i < n; i++) {
    const g = i < 262 ? linie(grund, i) : linie(koog, i);
    p.fels[i] = g - (i < 226 ? 1.5 : 0.3);
    p.sand[i] = i < 226 ? 1.5 : 0.3;
    if (i >= 218 && i < 262) p.bewuchs[i] = BEWUCHS.SALZWIESE;
    if (i >= 262) p.bewuchs[i] = BEWUCHS.GRAS;
  }
  deichProfil(p, 6.0, 3, 1.5, 262);
  objekt(p, { id: "schaf", art: "schaf", name: "Deichschafe", x: 276 });
  objekt(p, { id: "dorf1", art: "haus", name: "Hof im Koog", x: 336 });
  objekt(p, { id: "dorf2", art: "haus", name: "Dorf", x: 370 });
  p.start = Float64Array.from({ length: n }, (_, i) => boden(p, i));
  return p;
}

/** Deich aufsetzen: Außenböschung 1:aussen, 5 m Krone, Binnenböschung 1:innen */
function deichProfil(p: Profil, krone: number, aussen: number, innen: number, fuss: number) {
  const g0 = (i: number) => p.fels[i] + p.sand[i];
  const hA = krone - g0(fuss);
  const kroneX = fuss + hA * aussen;
  const kroneEnde = kroneX + 5;
  for (let i = 0; i < p.n; i++) {
    let z = -Infinity;
    if (i >= fuss && i <= kroneX) z = g0(fuss) + (i - fuss) / aussen;
    else if (i > kroneX && i <= kroneEnde) z = krone;
    else if (i > kroneEnde) z = krone - (i - kroneEnde) / innen;
    const d = Math.max(0, z - g0(i));
    p.deich[i] = Math.max(p.deich[i], d);
    if (d > 0) p.bewuchs[i] = BEWUCHS.GRAS;
  }
}

export function neuesProfil(art: KuestenArt): Profil {
  return art === "flach" ? flachkueste() : art === "steil" ? steilkueste() : marschkueste();
}

/* ─────────────────────────────────────────────────────────── Melden ── */

function melde(p: Profil, text: string, art: Meldung["art"] = "info") {
  p.meldungen.push({ stunde: p.stunde, text, art });
  if (p.meldungen.length > 60) p.meldungen.splice(0, p.meldungen.length - 60);
}

/** Einmal melden, bis `zuruecksetzen` den Merker löscht */
function einmal(p: Profil, key: string, text: string, art: Meldung["art"] = "info") {
  if (p.merker[key]) return;
  p.merker[key] = true;
  melde(p, text, art);
}

/* ────────────────────────────────────────────────────── Sand bewegen ── */

/** Sand auf Spalten verteilen, gewichtet nach `gewicht` */
function verteilen(p: Profil, von: number, bis: number, menge: number, gewicht: (i: number) => number) {
  von = Math.max(0, von); bis = Math.min(p.n - 1, bis);
  let summe = 0;
  for (let i = von; i <= bis; i++) summe += Math.max(0, gewicht(i));
  if (summe <= 0 || menge <= 0) return false;
  for (let i = von; i <= bis; i++) p.sand[i] += (menge * Math.max(0, gewicht(i))) / summe;
  return true;
}

/**
 * Lockerer Sand rutscht, bis die Böschung nicht steiler ist als sein
 * Schüttwinkel. So wandert eine angenagte Düne als Ganzes zurück.
 */
function rutschen(p: Profil, W: number, durchlaeufe = 2) {
  for (let d = 0; d < durchlaeufe; d++) {
    for (let i = 0; i < p.n - 1; i++) {
      const a = boden(p, i), b = boden(p, i + 1);
      const nass = Math.min(a, b) < W - 0.3;
      const tan = nass ? TAN_NASS : TAN_TROCKEN;
      const diff = a - b;
      if (Math.abs(diff) <= tan * DX) continue;
      const hoch = diff > 0 ? i : i + 1, tief = diff > 0 ? i + 1 : i;
      if (p.schutz[hoch] === SCHUTZ.DECKWERK) continue;
      const m = Math.min(p.sand[hoch], (Math.abs(diff) - tan * DX) / 2);
      if (m <= 0) continue;
      p.sand[hoch] -= m;
      p.sand[tief] += m;
    }
  }
}

/* ──────────────────────────────────────────────────────────── Prozesse ── */

/**
 * Brandung: Wo die Wellen auflaufen, trägt das Wasser ab. Sand geht leicht,
 * Klei langsam, Kreide und Mergel fast nicht — dort frisst die Brandung
 * stattdessen die Hohlkehle in die Wand. Ein Deckwerk hält, wirft die
 * Energie aber zurück und wühlt davor den Strand auf.
 */
function brandung(p: Profil, W: number, wl: Wellen, H0: number, dt: number) {
  const Hs = wl.amUfer;
  // Die Wucht hängt an dem, was am Ufer ankommt, und an der Dünung draußen.
  // Kleine Wellen bauen auf, erst Sturmwellen tragen ab.
  // Am Kliff arbeitet auch die kleine Welle an der Wand; der Sandstrand
  // reagiert erst auf Sturmwellen.
  const e = Math.max(0, Hs - (p.art === "steil" ? 0.1 : 0.3)) * Math.max(0, H0 - 1) ** 2;
  const res = { sand: 0, fels: 0 };
  if (e <= 0) return res;
  const R = auflauf(wl, H0);
  const unten = W - 0.4 * Hs;
  let cap = K_BRANDUNG * e * dt;

  for (let i = wl.ufer; i < p.n && cap > 1e-7; i++) {
    const g = boden(p, i);
    if (p.schutz[i] === SCHUTZ.DECKWERK) {
      // Rückstrom vor der Mauer: der Sand davor wird weggespült
      for (let j = i - 1; j >= Math.max(0, i - 10) && cap > 1e-7; j--) {
        const t = Math.min(p.sand[j], cap * 0.08);
        p.sand[j] -= t; cap -= t; res.sand += t;
      }
      break;
    }
    if (g > W + R) {
      // Wand über dem Wellenauflauf — die Brandung arbeitet an ihrem Fuß.
      if (p.deich[i] > 0.05) {
        const grasig = p.bewuchs[i] === BEWUCHS.GRAS ? 0.5 : 1;
        const t = Math.min(p.deich[i], cap * 0.08 * grasig);
        p.deich[i] -= t;
      } else if (p.sand[i] > 0.05) {
        const t = Math.min(p.sand[i], cap, g - (W + 0.3 * R));
        if (t > 0) { p.sand[i] -= t; res.sand += t; }
        if (p.bewuchs[i] === BEWUCHS.STRANDHAFER) p.bewuchs[i] = 0;
      } else {
        // Kliffwand: die Hohlkehle wächst
        p.kehle += cap * K_KEHLE;
        p.kehleX = i;
        res.fels += cap * K_KEHLE * Math.min(g - W, 40) * 0.5;
      }
      break;
    }
    const verfuegbar = g - unten;
    if (verfuegbar <= 0) continue;
    if (p.deich[i] > 0.01) {
      const t = Math.min(p.deich[i], verfuegbar, cap * 0.08);
      p.deich[i] -= t; cap -= t / 0.08;
    } else if (p.sand[i] > 0.001) {
      // Salzwiese hält mit Wurzeln fest, Schlick im Watt klebt zusammen.
      const zaeh = p.bewuchs[i] === BEWUCHS.SALZWIESE ? 0.04 : p.art === "marsch" ? 0.3 : 1;
      const t = Math.min(p.sand[i], verfuegbar, cap * zaeh);
      p.sand[i] -= t; cap -= t / zaeh; res.sand += t;
      if (p.bewuchs[i] === BEWUCHS.STRANDHAFER && t > 0.02) p.bewuchs[i] = 0;
    } else {
      // Abrasion: der Felsboden wird ganz langsam zur Plattform abgeschliffen
      const t = Math.min(verfuegbar, cap * 0.004);
      p.fels[i] -= t; cap -= t; res.fels += t;
    }
  }
  return res;
}

/**
 * Sturm: der abgetragene Sand landet im Sandriff vor der Brecherzone;
 * einen Teil nimmt der Küstenlängsstrom mit. Feines Kliffmaterial sinkt
 * weiter draußen zur Seehalde.
 */
function ablagern(p: Profil, W: number, wl: Wellen, sand: number, fels: number) {
  if (sand > 0) {
    p.bilanz.abgetragen += sand;
    const weg = sand * p.laengs;
    p.bilanz.weggetragen += weg;
    const rest = sand - weg;
    // Das Riff wächst vor der Niedrigwasserlinie, 2–5 m unter MNW —
    // nie höher, sonst läge es nach ein paar Stürmen trocken.
    const nw = uferIndex(p, mnw(p));
    const mitte = Math.max(nw - 110, Math.min(nw - 25, wl.brecher >= 0 ? wl.brecher + 4 : nw - 40));
    const ok = verteilen(p, mitte - 14, mitte + 8, rest,
      i => (boden(p, i) < mnw(p) - 1.5 ? 1 - Math.abs(i - mitte) / 16 : 0));
    if (!ok) p.bilanz.weggetragen += rest;
  }
  if (fels > 0) {
    // Die Hälfte des Kliffmaterials sinkt draußen zur Seehalde, der Rest
    // (Kreideschlamm, Ton) treibt weit fort.
    const halde = fels * 0.5;
    p.bilanz.weggetragen += fels - halde;
    let bis = 0;
    while (bis < p.n && boden(p, bis) < -4) bis++;
    verteilen(p, Math.max(0, bis - 60), bis, halde, i => i - (bis - 60));
  }
}

/**
 * Ruhiges Wetter: kleine Wellen schieben Sand aus dem Riff zurück an den
 * Strand und bauen den Strandwall auf — so erholt sich der Strand im Sommer.
 */
function aufbauen(p: Profil, W: number, H0: number, dt: number) {
  if (p.art !== "flach" || H0 >= 1.5 || H0 < 0.15) return;
  const hw = uferIndex(p, mhw(p));
  if (hw >= p.n || hw < 10) return;
  // Gleichgewichtsprofil nach Dean: Wassertiefe = A · Abstand^(2/3), A ≈ 0,2 (Sylter Vorstrand).
  // Was flacher liegt (das Sandriff nach dem Sturm), schieben die Wellen zurück.
  const gleich = (i: number) => mhw(p) - 0.2 * Math.pow(hw - i, 2 / 3);
  const von = Math.max(0, hw - 160), bis = hw - 2;
  let summe = 0;
  for (let i = von; i <= bis; i++) summe += Math.max(0, Math.min(p.sand[i], boden(p, i) - gleich(i)));
  if (summe < 0.05) return;
  const menge = Math.min(K_AUFBAU * (1.5 - H0) * dt, summe * 0.02);
  let genommen = 0;
  for (let i = von; i <= bis; i++) {
    const ueber = Math.max(0, Math.min(p.sand[i], boden(p, i) - gleich(i)));
    const t = (menge * ueber) / summe;
    p.sand[i] -= t; genommen += t;
  }
  p.bilanz.zurueck += genommen;
  // Der Wellenauflauf legt ihn oben am Strand als Strandwall ab.
  const dach = mhw(p) + 1.1;
  const unten = uferIndex(p, W - 0.3);
  if (!verteilen(p, unten, Math.min(p.n - 1, hw + 25), genommen, i => Math.max(0, dach - boden(p, i)))) {
    verteilen(p, von, bis, genommen, () => 1);
  }
}

/**
 * Wind: auflandiger Wind ab Stärke 4 treibt trockenen Sand landeinwärts.
 * Wo Strandhafer oder ein Sandfangzaun steht, bleibt er liegen — dort
 * wächst die Düne. Strandhafer wächst mit, wenn er zugeweht wird.
 */
function flugsand(p: Profil, W: number, w: Wetter, dt: number) {
  // Nur am Sandstrand: am Kliff und im Watt gibt es keinen trockenen Flugsand.
  if (p.art !== "flach" || !w.auflandig || w.bft < 4 || w.regen) return;
  const trocken = uferIndex(p, W + 0.4);
  let menge = K_WIND * (w.bft - 3) ** 3 * dt;
  let quelle = 0;
  let ziel = -1;
  for (let i = trocken; i < p.n; i++) {
    if (p.bewuchs[i] !== BEWUCHS.KEIN || p.schutz[i] === SCHUTZ.ZAUN || p.schutz[i] === SCHUTZ.DECKWERK) { ziel = i; break; }
    if (i > trocken && boden(p, i) - boden(p, i - 1) > 0.4) { ziel = i; break; }
    if (p.sand[i] > 0.05) quelle++;
  }
  if (quelle === 0) return;
  menge = Math.min(menge, quelle * 0.02);
  let genommen = 0;
  for (let i = trocken; i < (ziel < 0 ? p.n : ziel); i++) {
    if (p.sand[i] <= 0.05) continue;
    const t = Math.min(p.sand[i] - 0.05, menge / quelle);
    p.sand[i] -= t; genommen += t;
  }
  if (ziel < 0) {
    // Nichts hält den Sand — er weht ins Land.
    p.bilanz.weggetragen += genommen;
    return;
  }
  p.bilanz.angeweht += genommen;
  verteilen(p, ziel, Math.min(p.n - 1, ziel + 10), genommen, i => 11 - (i - ziel));
}

/** Strandhafer breitet sich langsam auf trockenem, ruhigem Sand aus */
function wachsen(p: Profil, W: number, dt: number) {
  const grenze = mhw(p) + 1.8;
  for (let i = 1; i < p.n - 1; i++) {
    if (p.bewuchs[i] !== BEWUCHS.KEIN || p.sand[i] < 0.5 || boden(p, i) < grenze) continue;
    if (p.bewuchs[i - 1] !== BEWUCHS.STRANDHAFER && p.bewuchs[i + 1] !== BEWUCHS.STRANDHAFER) continue;
    if (zufall(p) < dt / (24 * 60)) p.bewuchs[i] = BEWUCHS.STRANDHAFER;
  }
}

/**
 * Lahnungsfelder beruhigen das Wasser, der Schlick setzt sich ab. Liegt das
 * Feld hoch genug, siedelt der Queller — eine Salzwiese entsteht.
 */
function verlanden(p: Profil, dt: number) {
  for (let i = 0; i < p.n; i++) {
    if (p.schutz[i] !== SCHUTZ.LAHNUNG) continue;
    const g = boden(p, i);
    if (g < mhw(p) + 0.3) p.sand[i] += K_SCHLICK * dt;
    else if (p.bewuchs[i] !== BEWUCHS.SALZWIESE) {
      p.bewuchs[i] = BEWUCHS.SALZWIESE;
      einmal(p, "salzwiese", "Zwischen den Lahnungen ist das Watt so hoch geworden, dass Queller wächst — eine neue Salzwiese.", "gut");
    }
  }
}

/* ──────────────────────────────────────────────────────── Kliffabbruch ── */

function kliffkante(p: Profil): number {
  let beste = -1;
  for (let i = 1; i < p.n; i++) if (p.fels[i] - p.fels[i - 1] > 3) { beste = i; break; }
  return beste;
}

/**
 * Die Wand bricht: ein Streifen hinter der Kante stürzt ab. Das Material
 * liegt danach als Kliffhalde am Fuß (Schüttwinkel ~35°); die Findlinge
 * darin bleiben später als Blockstrand liegen.
 */
export function abbrechen(p: Profil, breite: number, grund: string) {
  const kante = kliffkante(p);
  if (kante < 0) return;
  const fuss = boden(p, kante - 1);
  const b = Math.max(1, Math.round(breite));
  let vol = 0;
  // Übrig bleibt der Felssockel am Fuß; alles darüber stürzt als Halde nach vorn.
  const neu = p.fels[kante - 1];
  for (let i = kante; i < Math.min(p.n, kante + b); i++) {
    vol += boden(p, i) - neu;
    p.fels[i] = neu; p.sand[i] = 0; p.bewuchs[i] = 0; p.schutz[i] = 0;
  }
  if (vol <= 0) return;
  p.bilanz.kliff += vol;
  // Halde aufschütten: Oberkante suchen, bei der das Volumen passt
  const neueKante = Math.min(p.n - 1, kante + b);
  const halde = (top: number) => {
    let v = 0;
    for (let i = neueKante - 1; i >= 0; i--) {
      const z = top - 0.7 * (neueKante - 1 - i);
      const g = boden(p, i);
      if (z <= g) { if (i < neueKante - 3) break; else continue; }
      v += z - g;
    }
    return v;
  };
  let lo = fuss, hi = fuss + 60;
  for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if (halde(m) < vol * 0.7) lo = m; else hi = m; }
  // Feines Material (Kreideschlamm, Ton) spült das Meer sofort fort.
  p.bilanz.weggetragen += vol * 0.3;
  for (let i = neueKante - 1; i >= 0; i--) {
    const z = lo - 0.7 * (neueKante - 1 - i);
    const g = boden(p, i);
    if (z <= g) { if (i < neueKante - 3) break; else continue; }
    p.sand[i] += z - g;
    p.bloecke[i] += (z - g) * 0.08;
  }
  p.abbruch = { x0: kante, x1: kante + b, stunde: p.stunde };
  p.kehle = 0;
  p.kehleX = neueKante;
  p.verwitterung = 0;
  if (!p.merker.gesperrt) {
    melde(p, "Ohne Absperrung hätten hier Menschen am Strand oder an der Kante stehen können. Abbrüche kommen ohne Vorwarnung!", "warnung");
  }
  melde(p, `Kliffabbruch (${grund}): ${b} m Kante sind abgestürzt, rund ${Math.round(vol)} m³ je Meter Küste liegen jetzt als Kliffhalde am Fuß.`, "warnung");
  for (const o of p.objekte) {
    if (o.zerstoert) continue;
    if (o.x < kante + b) {
      o.zerstoert = "Kliffabbruch";
      p.schaden += o.art === "leuchtturm" ? 12 : o.art === "burgwall" ? 5 : 0.5;
      melde(p, `${o.name} ist mit dem Kliff abgestürzt.`, "schaden");
    } else if (o.x < kante + b + 8) {
      einmal(p, "kante-" + o.id, `${o.name} steht nur noch ${Math.round(o.x - kante - b)} m von der Kante entfernt.`, "warnung");
    }
  }
}

function kliffPruefen(p: Profil, w: Wetter, dt: number) {
  if (p.art !== "steil") return;
  // Frost sprengt, Regen macht den Mergel schwer und glitschig, Wurzeln hebeln.
  const monat = monatVon(p.stunde);
  const winter = monat <= 2 || monat >= 11;
  let v = 0.02 / STUNDEN_JAHR;
  // grob: nach etwa fünf bis zehn Wintern ist die Wand mürbe
  if (w.regen) v += 0.08 / 2600;
  if (w.frost) v += 0.1 / 1000;
  if (winter) v += 0.1 / STUNDEN_JAHR;
  p.verwitterung = Math.min(1.2, p.verwitterung + v * dt);
  const kante = kliffkante(p);
  if (kante < 0) return;
  const grenze = KEHLE_KRITISCH * (1 - 0.55 * Math.min(1, p.verwitterung));
  if (p.kehle >= grenze) {
    abbrechen(p, p.kehle + 1.5 + zufall(p) * 4, p.verwitterung > 0.5 ? "Hohlkehle und durchweichte Wand" : "Brandungshohlkehle");
  } else if (p.verwitterung >= 1 && (w.regen || w.frost) && zufall(p) < dt / 3000) {
    abbrechen(p, 1 + zufall(p) * 2, w.frost ? "Frostsprengung" : "Regen hat die Wand aufgeweicht");
  }
}

/* ───────────────────────────────────────────────── Überflutung, Deich ── */

/** Höchster Punkt zwischen Ufer und Hinterland */
export function krone(p: Profil, ab: number): number {
  let best = -1, z = -Infinity;
  for (let i = Math.max(0, ab); i < p.n; i++) { const g = boden(p, i); if (g > z) { z = g; best = i; } }
  return best;
}

/** Wasserspiegel im Hinterland hinter der Krone (−Infinity = trocken) */
export function hinterPegel(p: Profil, k: number): number {
  if (p.hinterVol <= 1e-6 || k < 0 || k >= p.n - 1) return -Infinity;
  let lo = -20, hi = boden(p, k);
  const vol = (L: number) => { let v = 0; for (let i = k + 1; i < p.n; i++) v += Math.max(0, L - boden(p, i)); return v; };
  if (vol(hi) <= p.hinterVol) return hi;
  for (let s = 0; s < 40; s++) { const m = (lo + hi) / 2; if (vol(m) < p.hinterVol) lo = m; else hi = m; }
  return lo;
}

function ueberfluten(p: Profil, W: number, wl: Wellen, H0: number, dt: number) {
  if (wl.ufer >= p.n) {
    // Alles unter Wasser: der Koog füllt sich bis zum Meeresspiegel.
    const k0 = krone(p, 0);
    let v = 0;
    for (let i = k0 + 1; i < p.n; i++) v += Math.max(0, W - boden(p, i));
    p.hinterVol = Math.max(p.hinterVol, v);
    nassPruefen(p, k0, W);
    return;
  }
  const k = krone(p, wl.ufer);
  if (k < 0 || k >= p.n - 1) return;
  const z = boden(p, k);
  const R = auflauf(wl, H0);
  let q = 0;
  if (W + R > z) q += K_UEBER * 0.05 * (W + R - z) ** 1.5;
  if (W > z) q += K_UEBER * (W - z) ** 1.5;
  q *= dt;
  let L = hinterPegel(p, k);
  if (q > 0) {
    p.hinterVol += q;
    if (p.deich[k] > 0.3) {
      einmal(p, "deich-ueber", "Das Wasser läuft über die Deichkrone! Die steile Binnenböschung wird ausgespült.", "warnung");
      // Steile Binnenböschung (alte Deiche) bricht viel schneller.
      const steil = Math.max(0, boden(p, k) - boden(p, Math.min(p.n - 1, k + 6))) / 6;
      p.deichSchaden += q * K_DEICHSCHADEN * (1 + 4 * Math.max(0, steil - 0.34));
      if (!p.deichGebrochen && p.deichSchaden >= 1) {
        p.deichGebrochen = true;
        for (let i = 0; i < p.n; i++) if (p.deich[i] > 0) p.deich[i] = Math.max(0, p.deich[i] - Math.max(0, boden(p, i) - (W - 0.6)));
        melde(p, "DEICHBRUCH! Die Binnenböschung ist weggespült, die Sturmflut strömt in den Koog.", "schaden");
      }
    } else if (p.art === "flach") {
      einmal(p, "duene-ueber", "Die Wellen schlagen über die Düne — Wasser läuft ins Hinterland.", "warnung");
    }
  } else if (!p.deichGebrochen && Number.isFinite(L) && L > W + 0.2) {
    // Bei niedrigem Außenwasser öffnen die Siele, das Schöpfwerk pumpt.
    p.hinterVol = Math.max(0, p.hinterVol - K_SIEL * dt);
  }
  if (p.hinterVol <= 0.01) { p.hinterVol = 0; p.merker["deich-ueber"] = false; p.merker["duene-ueber"] = false; }
  nassPruefen(p, k, hinterPegel(p, k));
}

function nassPruefen(p: Profil, k: number, L: number) {
  for (const o of p.objekte) {
    if (o.zerstoert) continue;
    const xi = Math.round(o.x);
    const nass = o.x > k && L > boden(p, xi) + 0.2;
    if (nass && !o.nass) {
      p.schaden += o.art === "hotel" ? 8 : o.art === "haus" ? 2 : 0.1;
      melde(p, `${o.name} steht unter Wasser.`, "schaden");
    }
    o.nass = nass;
  }
}

/** Häuser, unter denen der Boden weggespült wurde */
function unterspuelt(p: Profil) {
  for (const o of p.objekte) {
    if (o.zerstoert) continue;
    const xi = Math.round(o.x);
    if (boden(p, xi) < o.boden0 - 1.5) {
      o.zerstoert = "unterspült";
      p.schaden += o.art === "hotel" ? 25 : o.art === "haus" ? 3 : 0.2;
      melde(p, `${o.name} ist unterspült und verloren.`, "schaden");
    }
  }
}

/* ─────────────────────────────────────────────────────────────── Zeit ── */

/** 0 = Januar … 11 = Dezember; die Simulation beginnt am 1. Januar 2026 */
export function monatVon(stunde: number): number {
  return Math.floor(((stunde / 24) % 365.25) / 30.44) % 12;
}
export function jahrVon(stunde: number): number {
  return 2026 + Math.floor(stunde / STUNDEN_JAHR);
}

/** Eine Sturmflut auslösen: `staerke` 0…1 der größten Sturmflut dieser Küste */
export function sturmflut(p: Profil, staerke = 1) {
  const hoehe = p.stauMax * staerke;
  p.flut = { rest: 30, dauer: 30, hoehe };
  melde(p, `Sturmflut! Der Sturm drückt das Wasser bis zu ${hoehe.toFixed(1).replace(".", ",")} m über das normale Niveau.`, "warnung");
}

/**
 * Eine Stunde Küste. `dt` darf größer sein (Zeitraffer), sollte aber 3 h
 * nicht überschreiten, sonst springt die Tide über ihre Extreme.
 */
export function schritt(p: Profil, w: Wetter, dt = 1) {
  const W = wasserstand(p, w);
  const H0 = wellenhoehe(p, w);
  const wl = wellen(p, W, H0);

  const ab = brandung(p, W, wl, H0, dt);
  ablagern(p, W, wl, ab.sand, ab.fels);
  aufbauen(p, W, H0, dt);
  flugsand(p, W, w, dt);
  rutschen(p, W);
  wachsen(p, W, dt);
  verlanden(p, dt);
  kliffPruefen(p, w, dt);
  ueberfluten(p, W, wl, H0, dt);
  unterspuelt(p);

  p.stunde += dt;
  if (p.flut) {
    p.flut.rest -= dt;
    if (p.flut.rest <= 0) p.flut = null;
  }
}

/* ─────────────────────────────────────────────────────────── Wetter ── */

export interface WetterLage { wetter: Wetter; bisStunde: number }

/**
 * Wetter im Jahreslauf: im Winter mehr Wind und Stürme, der Wind kommt an
 * Nord- und Ostsee meist aus West (auflandig an der Westküste).
 */
export function naechstesWetter(p: Profil): WetterLage {
  const m = monatVon(p.stunde);
  const winter = m <= 2 || m >= 9;
  const r = () => zufall(p);
  if (winter && r() < 0.025) {
    // Sturmtief: 12–36 h Sturm, manchmal mit Sturmflut
    const bft = 8 + Math.floor(r() * 3);
    // Leichte Sturmfluten sind häufig, schwere selten.
    if (r() < 0.3) sturmflut(p, 0.3 + 0.7 * r() ** 3);
    else if (bft >= 10) melde(p, `Schwerer Sturm mit Windstärke ${bft}.`, "info");
    return { wetter: { bft, auflandig: true, regen: r() < 0.6, frost: false }, bisStunde: p.stunde + 12 + r() * 24 };
  }
  const mittel = winter ? 4.6 : 3.3;
  const g = (r() + r() + r() - 1.5) * 2.4;
  const bft = Math.max(0, Math.min(7, Math.round(mittel + g)));
  return {
    wetter: {
      bft,
      auflandig: r() < 0.62,
      regen: r() < (winter ? 0.4 : 0.22),
      frost: (m <= 1 || m === 11) && r() < 0.45,
    },
    bisStunde: p.stunde + 6 + r() * 18,
  };
}

/* ─────────────────────────────────────────────────── Auswertung ── */

/** Wasserlinie bei MHW, Dünenfuß, Strandbreite u. a. für die Anzeige */
export function kennzahlen(p: Profil) {
  const hw = uferIndex(p, mhw(p));
  const k = krone(p, hw);
  let fuss = hw;
  while (fuss < k && boden(p, fuss + 1) - boden(p, fuss) < 0.3) fuss++;
  return {
    strand: Math.max(0, fuss - hw),
    duene: k >= 0 ? boden(p, k) : 0,
    kroneX: k,
    kante: kliffkante(p),
    hochwasserlinie: hw,
  };
}
