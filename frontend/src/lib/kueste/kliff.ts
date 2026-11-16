/**
 * Steilküste als 2D-Zellmodell (Querschnitt).
 *
 * Anders als die Höhenlinie der Flachküste kann ein Zellgitter Überhänge,
 * Höhlen und schräg gestellte Schichten darstellen. Jede Zelle (0,25–0,5 m)
 * trägt ein Material mit echten Kennwerten: Härte gegen Brandung,
 * Frostempfindlichkeit, Zugfestigkeit, Kohäsion c, Reibungswinkel φ, Wichte γ.
 *
 * Was passiert:
 *   Brandung    Schaden an den Zellen im Auflaufband; das Band hat ein
 *               Maximum knapp über dem Wasserspiegel — so entsteht die
 *               Hohlkehle von selbst. Ins Innere der Kehle kommt weniger an.
 *   Abbruch     Der Überhang über der Kehle ist ein Kragbalken. Übersteigt
 *               die Biegespannung σ = 6·M/H² die Zugfestigkeit der geklüfteten
 *               Wand (geschwächt durch Risse und Nässe), bricht er und stürzt.
 *   Rutschung   Gleitkreise und (bei Møns Klint) alte Überschiebungsflächen
 *               werden mit dem Lamellenverfahren (Fellenius) geprüft:
 *               FS = Σ[c·l + (W·cosα − u·l)·tanφ] / Σ W·sinα.
 *               Grundwasser (u) nach Regen senkt FS; FS < 1 → die Scholle
 *               dreht bzw. gleitet ab und bleibt verkippt liegen.
 *   Schutt      fällt und rieselt, bis er im Schüttwinkel liegt; nasser Ton-
 *               und Mergelschutt fließt flach aus (Schlammstrom).
 *   Wetter      Frost sprengt Schalen ab, Regen spült Rinnen, Wasser tritt
 *               über Tonschichten aus (Quellhorizont) und unterspült,
 *               Wind weht Sand vom Kliff auf die Kliffranddüne.
 *
 * Die Bewegungen (Stürze, Rutschungen) laufen in Echtzeit ab; währenddessen
 * steht die Simulationszeit still. Ohne Oberfläche: `abschliessen()`.
 */
import { tide, zufall, type Meldung, type Wetter } from "./profil";

export type KliffTyp = "kreide" | "moen" | "mergel" | "sand";

export const MAT = {
  LUFT: 0, KREIDE: 1, FEUER: 2, MERGEL: 3, TON: 4, SAND: 5, LIMONIT: 6,
  BODEN: 7, SCHUTT: 8, BLOCK: 9, DECKWERK: 10, LEHM: 11,
} as const;

export interface MatInfo {
  name: string;
  farbe: [number, number, number];
  /** Widerstand gegen Brandung (größer = langsamer) */
  haerte: number;
  frost: number;
  /** Zugfestigkeit des geklüfteten Gebirges (kPa) */
  zug: number;
  c: number;
  phi: number;
  gamma: number;
  regen: number;
  /** Anteil, der beim Abtrag als Block/Feuerstein liegen bleibt */
  block: number;
  /** Schüttwinkel des Schutts aus diesem Material (trocken / nass) */
  ruhe: number;
  ruheNass: number;
}

const L = (o: Partial<MatInfo> & { name: string; farbe: [number, number, number] }): MatInfo => ({
  haerte: 1, frost: 0, zug: 0, c: 0, phi: 30, gamma: 18, regen: 0, block: 0, ruhe: 34, ruheNass: 30, ...o,
});

export const MATERIAL: MatInfo[] = [
  L({ name: "Luft", farbe: [0, 0, 0], gamma: 0 }),
  L({ name: "Kreide", farbe: [238, 236, 226], haerte: 4, frost: 1, zug: 5, c: 260, phi: 35, gamma: 19, regen: 0.15, block: 0.01, ruhe: 38, ruheNass: 34 }),
  L({ name: "Kreide mit Feuerstein", farbe: [226, 224, 214], haerte: 5, frost: 0.9, zug: 6, c: 270, phi: 36, gamma: 19.5, regen: 0.1, block: 0.08, ruhe: 38, ruheNass: 34 }),
  L({ name: "Geschiebemergel", farbe: [160, 138, 106], haerte: 2.2, frost: 0.5, zug: 3, c: 46, phi: 30, gamma: 21, regen: 0.6, block: 0.03, ruhe: 32, ruheNass: 14 }),
  L({ name: "Ton", farbe: [98, 108, 118], haerte: 1.6, frost: 0.35, zug: 2, c: 12, phi: 18, gamma: 19, regen: 0.5, ruhe: 24, ruheNass: 11 }),
  L({ name: "Sand", farbe: [238, 229, 204], haerte: 0.35, frost: 0.05, zug: 0.3, c: 22, phi: 34, gamma: 18, regen: 1, ruhe: 34, ruheNass: 30 }),
  L({ name: "Limonitsandstein", farbe: [176, 88, 46], haerte: 1.8, frost: 0.3, zug: 4, c: 30, phi: 36, gamma: 20, regen: 0.2, block: 0.08, ruhe: 38, ruheNass: 34 }),
  L({ name: "Boden", farbe: [92, 70, 46], haerte: 0.8, frost: 0.3, zug: 2, c: 12, phi: 28, gamma: 16, regen: 0.4, ruhe: 32, ruheNass: 18 }),
  L({ name: "Schutt", farbe: [200, 190, 170], haerte: 0.25, c: 0, phi: 34, regen: 1, ruhe: 36, ruheNass: 20 }),
  L({ name: "Block", farbe: [104, 106, 112], haerte: 80, gamma: 26, ruhe: 50, ruheNass: 50 }),
  L({ name: "Deckwerk", farbe: [128, 130, 136], haerte: 1e9, zug: 1e4, c: 1e4, phi: 45, gamma: 24 }),
  L({ name: "Geschiebelehm", farbe: [168, 92, 56], haerte: 1.8, frost: 0.45, zug: 3, c: 34, phi: 30, gamma: 20, regen: 0.6, block: 0.02, ruhe: 32, ruheNass: 16 }),
];

const LOSE = (m: number) => m === MAT.SCHUTT || m === MAT.BLOCK;

/** Eine alte Überschiebungsfläche (Møns Klint), steigt landwärts an */
export interface Ebene { x0: number; tan: number; c: number; phi: number }

export interface Baum {
  id: number; c: number; r: number;
  /** Neigung in rad; positiv = zum Meer hin gekippt */
  neigung: number;
  liegt: boolean; weg: boolean; groesse: number; art: "buche" | "busch" | "halm";
  /** Abgestorben (Wurzeln frei an der Kante) oder umgestürzt — seit dieser Stunde */
  tot?: number;
  /** Fällt gerade: Position (m), Geschwindigkeit (m/s), Drehrate (rad/s) */
  fall?: { x: number; z: number; vx: number; vz: number; om: number };
}
export interface KObjekt { id: string; art: "leuchtturm" | "aussicht" | "weg" | "haus" | "bank" | "burgwall"; name: string; c: number; r: number; zerstoert?: string }

export interface Bewegung {
  art: "fall" | "rutsch" | "gleit";
  idx: Int32Array;
  mMat: Uint8Array;
  mHerk: Uint8Array;
  bbox: { c0: number; c1: number; r0: number; r1: number };
  /** Drehpunkt (m), Drehwinkel (rad), Verschiebung (m) */
  pivX: number; pivZ: number;
  theta: number; tx: number; tz: number;
  vx: number; vz: number; omega: number;
  /** Rutschen: Gleitrichtung, Reibbeiwert, Weg und Tempo auf der Fläche,
   *  Schwerpunkt der Masse zu Beginn, Austritt der Gleitfläche (x) */
  dirX: number; dirZ: number; reib: number;
  fort: number; tempo: number; mx: number; mz: number; ausX: number;
  dauer: number; zeit: number;
  volumen: number;
  baeume: { id: number; j: number }[];
  objekte: string[];
  id: number;
}

export interface Kliff {
  typ: KliffTyp;
  dx: number; nx: number; nz: number; z0: number;
  mat: Uint8Array; herk: Uint8Array; schaden: Float32Array; gestoert: Uint8Array;
  /** Loses Material: Falltempo nach unten und Rutschtempo zur Seite (m/s, mit Vorzeichen) */
  vz: Float32Array; vx: Float32Array;
  /** Durchgang, in dem eine Zelle zuletzt bewegt wurde — keine zweimal je Durchgang */
  takt: Uint16Array; durchgang: number;
  /** Wasserstand des letzten Zeitschritts (m) — im Wasser sinkt Schutt langsam */
  wasser: number;
  /** Bewuchs je Spalte: 0 kahl, 1 Gras, 2 Strandhafer, 3 Wald */
  bewuchs: Uint8Array;
  hub: number; stauMax: number; wellenFaktor: number;
  stunde: number;
  flut: { rest: number; dauer: number; hoehe: number } | null;
  seed: number;
  /** Grundwasser 0…1 */
  saettigung: number;
  /** Klüfte und Risse in der Wand 0…1 */
  risse: number;
  ebenen: Ebene[];
  bewegungen: Bewegung[];
  baeume: Baum[];
  objekte: KObjekt[];
  schutz: { drainage: boolean; gesperrt: boolean; bepflanzt: boolean };
  bilanz: { abgestuerzt: number; weggespuelt: number; ereignisse: number };
  kosten: number; schadenEuro: number;
  meldungen: Meldung[];
  version: number;
  analyse: { spannung: number; fs: number; fsArt: "" | "kreis" | "ebene" | "kluft"; kehle: number };
  /** Kreide: Scherfestigkeit der steilen Klüfte parallel zur Wand (geeicht) */
  kluft: { c: number; phi: number } | null;
  startKante: number;
  /** Höhe, ab der eine Spalte zur Hochfläche zählt (m) */
  kantenHoehe: number;
  /** Gebirgsfestigkeit dieses Kliffs relativ zu den Tabellenwerten (geeicht) */
  festFaktor: number;
  cache: { version: number; top: Int16Array; front: Int16Array; ton: Int16Array };
  unruhig: boolean;
  /** Bereich, in dem Schutt gerade rieseln kann (Spalten, Zeilen) */
  aktiv: { c0: number; c1: number; r0: number; r1: number };
  seitVerbindung: number;
  pruefen: boolean;
  seitStabil: number;
  satGeprueft: number;
  merker: Record<string, boolean>;
  laufId: number;
}

/* ───────────────────────────────────────────────────────── Grundlagen ── */

export const zelle = (k: Kliff, c: number, r: number) => r * k.nx + c;
export const xVon = (k: Kliff, c: number) => (c + 0.5) * k.dx;
export const zVon = (k: Kliff, r: number) => k.z0 + (r + 0.5) * k.dx;
export const spalteVon = (k: Kliff, x: number) => Math.floor(x / k.dx);
export const zeileVon = (k: Kliff, z: number) => Math.floor((z - k.z0) / k.dx);

function neu(typ: KliffTyp, dx: number, breite: number, z0: number, hoehe: number): Kliff {
  const nx = Math.round(breite / dx), nz = Math.round(hoehe / dx), n = nx * nz;
  return {
    typ, dx, nx, nz, z0,
    mat: new Uint8Array(n), herk: new Uint8Array(n), schaden: new Float32Array(n), gestoert: new Uint8Array(n),
    vz: new Float32Array(n), vx: new Float32Array(n), takt: new Uint16Array(n), durchgang: 0, wasser: 0,
    bewuchs: new Uint8Array(nx),
    hub: 0.1, stauMax: 1.6, wellenFaktor: 0.75,
    stunde: 0, flut: null, seed: 20260928,
    saettigung: 0.25, risse: 0.15,
    ebenen: [], bewegungen: [], baeume: [], objekte: [],
    schutz: { drainage: false, gesperrt: false, bepflanzt: false },
    bilanz: { abgestuerzt: 0, weggespuelt: 0, ereignisse: 0 },
    kosten: 0, schadenEuro: 0, meldungen: [], version: 1,
    analyse: { spannung: 0, fs: 9, fsArt: "", kehle: 0 }, kluft: null,
    startKante: 0, kantenHoehe: 0, festFaktor: 1,
    cache: { version: 0, top: new Int16Array(nx), front: new Int16Array(nz), ton: new Int16Array(nx) },
    unruhig: true, aktiv: { c0: 0, c1: nx - 1, r0: 1, r1: nz - 1 }, seitVerbindung: 99, pruefen: true, seitStabil: 999, satGeprueft: -1, merker: {}, laufId: 0,
  };
}

/** Gitter füllen: fn liefert zu (x, z) in Metern das Material */
function fuellen(k: Kliff, fn: (x: number, z: number, c: number, r: number) => number) {
  for (let r = 0; r < k.nz; r++) for (let c = 0; c < k.nx; c++) {
    const m = fn(xVon(k, c), zVon(k, r), c, r);
    const i = zelle(k, c, r);
    k.mat[i] = m;
    k.herk[i] = m;
  }
}

function hash(a: number, b: number) {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function linie(p: [number, number][], x: number) {
  if (x <= p[0][0]) return p[0][1];
  for (let i = 1; i < p.length; i++) if (x <= p[i][0]) {
    const [x0, z0] = p[i - 1], [x1, z1] = p[i];
    return z0 + ((z1 - z0) * (x - x0)) / (x1 - x0);
  }
  return p[p.length - 1][1];
}

/** Bäume und Bewuchs auf die Oberfläche setzen */
function bepflanzen(k: Kliff, von: number, bis: number, abstand: number, art: Baum["art"], bew: number) {
  const g = geometrie(k);
  // Nur auf der Hochfläche und auf Bänken — nicht an der Wand
  const w = Math.max(1, Math.round(1 / k.dx));
  const eben = (c: number) => c >= w && c < k.nx - w && g.top[c] >= 0
    && Math.abs(g.top[c + w] - g.top[c - w]) * k.dx < 1.2 && g.top[c - w] >= g.top[c] - Math.round(1 / k.dx);
  for (let c = spalteVon(k, von); c < Math.min(k.nx, spalteVon(k, bis)); c++) if (eben(c)) k.bewuchs[c] = bew;
  for (let x = von; x < bis; x += abstand * (0.7 + hash(x, 3) * 0.6)) {
    const c = spalteVon(k, x);
    if (c >= k.nx) break;
    const r = g.top[c];
    if (r < 0 || !eben(c)) continue;
    k.baeume.push({ id: k.baeume.length + 1, c, r, neigung: 0, liegt: false, weg: false, groesse: 0.8 + hash(c, 7) * 0.5, art });
  }
}

/**
 * Die Oberkante runden: Regen, abfließendes Wasser und Bodenkriechen lassen
 * keine scharfe Ecke stehen. Eine Zelle an der Kante fällt weg, wenn in
 * einem Kreis mit Radius R um sie herum weniger als 40 % Gestein liegt —
 * so wird die Ecke zu einem Bogen mit etwa diesem Radius.
 */
function kanteRunden(k: Kliff, radius: number) {
  const g = geometrie(k);
  let hoch = 0;
  for (let c = 0; c < k.nx; c++) hoch = Math.max(hoch, g.top[c]);
  let kc = 0;
  while (kc < k.nx && g.top[kc] < hoch - Math.round((radius * 1.5) / k.dx)) kc++;
  const R = Math.round(radius / k.dx);
  for (let durchgang = 0; durchgang < 3; durchgang++) {
    const weg: number[] = [];
    for (let r = hoch - 3 * R; r <= hoch; r++) {
      if (r < 1) continue;
      for (let c = Math.max(1, kc - 2 * R); c < Math.min(k.nx - 1, kc + 3 * R); c++) {
        const i = r * k.nx + c;
        if (k.mat[i] === MAT.LUFT) continue;
        // nur Zellen an der Oberfläche
        if (k.mat[i + k.nx] !== MAT.LUFT && k.mat[i - 1] !== MAT.LUFT) continue;
        let fest = 0, alle = 0;
        for (let dr = -R; dr <= R; dr += 2) for (let dc = -R; dc <= R; dc += 2) {
          if (dr * dr + dc * dc > R * R) continue;
          const rr = r + dr, cc = c + dc;
          if (rr < 0 || cc < 0 || cc >= k.nx) continue;
          alle++;
          if (rr < k.nz && k.mat[rr * k.nx + cc] !== MAT.LUFT) fest++;
        }
        if (fest / alle < 0.4) weg.push(i);
      }
    }
    for (const i of weg) { k.mat[i] = MAT.LUFT; k.herk[i] = 0; }
    k.version++;
    geometrie(k);
  }
  // Oben wieder Boden, wo die Rundung den Boden abgetragen hat
  for (let c = Math.max(0, kc - 2 * R); c < Math.min(k.nx, kc + 3 * R); c++) {
    const r = g.top[c];
    if (r < hoch - 3 * R || r < 0) continue;
    const i = r * k.nx + c;
    if (k.mat[i] === MAT.MERGEL || k.mat[i] === MAT.KREIDE || k.mat[i] === MAT.FEUER || k.mat[i] === MAT.LEHM) { k.mat[i] = MAT.BODEN; k.herk[i] = MAT.BODEN; }
  }
  k.version++;
}

function objekt(k: Kliff, id: string, art: KObjekt["art"], name: string, x: number) {
  geometrie(k);
  const c = spalteVon(k, x);
  k.objekte.push({ id, art, name, c, r: k.cache.top[c] });
}

/* ────────────────────────────────────────────────────────── Vorlagen ── */

/**
 * Kreidekliff wie in Jasmund (Rügen): fast senkrechte Kreidewand mit
 * Feuersteinbändern, oben Geschiebemergel und Buchenwald, am Fuß
 * Schuttkegel und Feuerstein-Blockstrand.
 */
function kreide(): Kliff {
  const k = neu("kreide", 0.25, 150, -8, 58);
  const see: [number, number][] = [[0, -8], [40, -2.5], [62, -0.7], [68, 0.5]];
  fuellen(k, (x, z) => {
    const face = 70 + 0.09 * Math.max(0, z) + 0.6 * Math.sin(z / 3.1);
    const grund = x < 68 ? linie(see, x) : 0.5;
    const oben = 44 + 0.4 * Math.sin(x / 11);
    if (x >= face && z <= oben) {
      if (z > oben - 0.5) return MAT.BODEN;
      if (z > 40.2 + 1.2 * Math.sin(x / 17)) return MAT.MERGEL;
      return kreideSchicht(x, z, 0.05);
    }
    // Schuttkegel am Fuß, Strand mit Feuersteinen
    if (x > 63 && x < face && z < 0.5 + (x - 63) * 0.72 && z > grund - 0.1) return hash(x * 3, z * 7) < 0.12 ? MAT.BLOCK : MAT.SCHUTT;
    if (z <= grund) {
      if (z > grund - 0.35 && x > 58) return hash(x * 7, z * 13) < 0.25 ? MAT.BLOCK : MAT.SCHUTT;
      return x > 44 ? kreideSchicht(x, z, 0.05) : z > grund - 0.8 ? MAT.SAND : MAT.KREIDE;
    }
    return MAT.LUFT;
  });
  herkunftSetzen(k, MAT.FEUER);
  kanteRunden(k, 4);
  bepflanzen(k, 72, 150, 4.5, "buche", 3);
  objekt(k, "aussicht", "aussicht", "Aussichtsplattform", 80);
  objekt(k, "weg", "weg", "Hochuferweg", 84);
  k.hub = 0.1; k.stauMax = 1.6; k.wellenFaktor = 0.75;
  return fertig(k);
}

function kreideSchicht(x: number, z: number, neig: number) {
  const s = z - x * neig;
  return ((s % 1.7) + 1.7) % 1.7 < 0.26 ? MAT.FEUER : MAT.KREIDE;
}

/**
 * Møns Klint: bis 128 m hoch. Das Eis hat die Kreide in Schollen zerlegt
 * und schräg gestellt; zwischen den Schollen liegen Ton und Mergel auf
 * alten Überschiebungsflächen — auf ihnen gleiten die großen Rutschungen.
 */
function moen(): Kliff {
  const k = neu("moen", 0.5, 360, -10, 140);
  const see: [number, number][] = [[0, -10], [80, -3], [106, -0.6], [113, 0.5]];
  const tan = Math.tan((38 * Math.PI) / 180), cos = Math.cos((38 * Math.PI) / 180);
  const fugen = [92, 101, 108, 160, 175];
  const face = (z: number) => z < 46 ? 115 + 0.22 * z + 1.2 * Math.sin(z / 4)
    : z < 52 ? 125 + (z - 46) * 1.8 : z < 98 ? 136 + 0.26 * (z - 52) + Math.sin(z / 5) : z < 104 ? 148 + (z - 98) * 1.2 : 155 + 0.35 * (z - 104);
  fuellen(k, (x, z) => {
    const grund = x < 113 ? linie(see, x) : 0.5;
    const oben = 122 + 1.5 * Math.sin(x / 23);
    if (x >= face(z) && z <= oben) {
      if (z > oben - 0.5) return MAT.BODEN;
      if (z > oben - 4) return MAT.MERGEL;
      // Abstand zur nächsten Überschiebungsfläche (senkrecht gemessen)
      let best = 99, b = 0;
      for (const x0 of fugen) {
        const d = (z - tan * (x - x0)) * cos;
        if (Math.abs(d) < Math.abs(best)) { best = d; b = x0; }
      }
      if (Math.abs(best) < 0.8) return b % 2 ? MAT.MERGEL : MAT.TON;
      return ((best % 2.3) + 2.3) % 2.3 < 0.4 ? MAT.FEUER : MAT.KREIDE;
    }
    if (x > 110 && x < face(z) && z < 0.5 + (x - 110) * 0.7 && z > grund - 0.1) return MAT.SCHUTT;
    if (z <= grund) {
      if (z > grund - 0.5 && x > 100) return hash(x * 3, z * 11) < 0.4 ? MAT.BLOCK : MAT.SCHUTT;
      return MAT.KREIDE;
    }
    return MAT.LUFT;
  });
  herkunftSetzen(k, MAT.KREIDE);
  kanteRunden(k, 4);
  // Bänke tragen Boden und Wald
  geometrie(k);
  for (let c = 0; c < k.nx; c++) {
    const r = k.cache.top[c];
    if (r > 0 && zVon(k, r) > 44 && k.mat[zelle(k, c, r)] !== MAT.BODEN) {
      k.mat[zelle(k, c, r)] = MAT.BODEN; k.herk[zelle(k, c, r)] = MAT.BODEN;
    }
  }
  k.version++;
  bepflanzen(k, 124, 360, 5, "buche", 3);
  for (const x0 of fugen) k.ebenen.push({ x0, tan, c: 300, phi: 34 });
  ebenenEichen(k, 1.3);
  objekt(k, "aussicht", "aussicht", "Aussichtspunkt", 170);
  objekt(k, "weg", "weg", "Klintweg", 182);
  k.hub = 0.1; k.stauMax = 1.6; k.wellenFaktor = 0.75;
  return fertig(k);
}

/**
 * Geschiebemergel-Steilufer wie das Brodtener Ufer bei Travemünde: 20 m
 * Mergel mit Findlingen, darin eine Sandlage über einer Tonschicht —
 * dort tritt nach Regen Wasser aus (Quellhorizont).
 */
function mergel(): Kliff {
  const k = neu("mergel", 0.25, 100, -6, 30);
  const see: [number, number][] = [[0, -6], [35, -1.6], [48, -0.3], [54, 0.7]];
  fuellen(k, (x, z) => {
    const face = 55 + 0.62 * Math.max(0, z) + 1.1 * Math.sin(z / 2.1);
    const grund = x < 54 ? linie(see, x) : 0.7;
    const oben = 20 + 0.3 * Math.sin(x / 9);
    if (x >= face && z <= oben) {
      if (z > oben - 0.4) return MAT.BODEN;
      const lage = 8 + (x - 60) * 0.02;
      if (z > lage && z < lage + 1.6) return MAT.SAND;
      if (z > lage - 0.6 && z <= lage) return MAT.TON;
      if (hash(Math.floor(x / 0.75), Math.floor(z / 0.75)) < 0.012) return MAT.BLOCK;
      return MAT.MERGEL;
    }
    if (z <= grund) {
      if (z > grund - 0.4 && x > 36) return hash(x * 5, z * 9) < 0.3 ? MAT.BLOCK : MAT.SCHUTT;
      return MAT.MERGEL;
    }
    return MAT.LUFT;
  });
  herkunftSetzen(k, MAT.MERGEL);
  kanteRunden(k, 3);
  bepflanzen(k, 67, 100, 7, "busch", 1);
  objekt(k, "weg", "weg", "Uferweg", 70);
  objekt(k, "bank", "bank", "Bank mit Aussicht", 76);
  objekt(k, "haus", "haus", "Haus", 93);
  k.hub = 0.1; k.stauMax = 1.8; k.wellenFaktor = 0.75;
  return fertig(k);
}

/**
 * Sandkliff wie das Rote Kliff auf Sylt: unten weißer Kaolinsand, darüber
 * ein Band aus rotem Limonitsandstein, oben roter Geschiebelehm und eine
 * Kliffranddüne. Nordsee: Tidenhub knapp 2 m, schwere Sturmfluten.
 */
function sand(): Kliff {
  const k = neu("sand", 0.25, 110, -6, 40);
  const see: [number, number][] = [[0, -6], [40, -2], [54, -0.9], [66, 2.4]];
  fuellen(k, (x, z) => {
    const face = z < 16 ? 67 + 0.95 * Math.max(0, z - 2.4) : z < 18 ? 80 + (z - 16) * 0.3 : z < 27 ? 80.6 + (z - 18) * 0.55 : 85.6 + (z - 27) * 1.2;
    const grund = x < 66 ? linie(see, x) : 2.4;
    const oben = x < 90 ? 27 + Math.min(3, (x - 84) * 0.6) : 30 - (x - 90) * 0.05;
    if (x >= face && z <= oben) {
      if (z > 27) return MAT.SCHUTT;
      if (z > 18) return MAT.LEHM;
      if (z > 16) return MAT.LIMONIT;
      return MAT.SAND;
    }
    if (z <= grund) return x > 45 ? MAT.SCHUTT : MAT.SAND;
    return MAT.LUFT;
  });
  herkunftSetzen(k, MAT.SAND);
  kanteRunden(k, 5);
  bepflanzen(k, 84, 110, 2.5, "halm", 2);
  objekt(k, "weg", "weg", "Kliffweg", 92);
  objekt(k, "haus", "haus", "Reetdachhaus", 104);
  k.hub = 1.8; k.stauMax = 3.0; k.wellenFaktor = 1;
  return fertig(k);
}

/** Schutt bekommt die Herkunft des Gesteins, aus dem er stammt */
function herkunftSetzen(k: Kliff, standard: number) {
  for (let i = 0; i < k.mat.length; i++) if (k.mat[i] === MAT.SCHUTT) k.herk[i] = standard;
}

function fertig(k: Kliff) {
  k.version++;
  const g = geometrie(k);
  let hoch = 0;
  for (let c = 0; c < k.nx; c++) hoch = Math.max(hoch, zVon(k, g.top[c]));
  k.kantenHoehe = 0.8 * hoch;
  k.startKante = kliffKante(k);
  if (k.typ === "kreide" || k.typ === "moen") kluftEichen(k, 1.3); else kreiseEichen(k, 1.2);
  return k;
}

export const KLIFF_TYPEN: { id: KliffTyp; icon: string; name: string; ort: string }[] = [
  { id: "kreide", icon: "⬜", name: "Kreidekliff", ort: "Vorbild: Jasmund auf Rügen (Ostsee)" },
  { id: "moen", icon: "🇩🇰", name: "Møns Klint", ort: "Dänemark: bis 128 m, schräg gestellte Kreideschollen (Ostsee)" },
  { id: "mergel", icon: "🟫", name: "Mergelkliff", ort: "Vorbild: Brodtener Ufer bei Travemünde (Ostsee)" },
  { id: "sand", icon: "🟧", name: "Sandkliff", ort: "Vorbild: Rotes Kliff auf Sylt (Nordsee)" },
];

export function neuesKliff(typ: KliffTyp): Kliff {
  return typ === "kreide" ? kreide() : typ === "moen" ? moen() : typ === "mergel" ? mergel() : sand();
}

/* ─────────────────────────────────────────────────────────── Geometrie ── */

/** Oberste feste Zelle je Spalte, erste feste Zelle je Zeile von See her */
export function geometrie(k: Kliff) {
  const g = k.cache;
  if (g.version === k.version) return g;
  const { nx, nz, mat } = k;
  for (let c = 0; c < nx; c++) {
    let r = nz - 1;
    while (r >= 0 && mat[r * nx + c] === MAT.LUFT) r--;
    g.top[c] = r;
    let t = -1;
    for (let q = r; q >= 0; q--) if (mat[q * nx + c] === MAT.TON) { t = q; break; }
    g.ton[c] = t;
  }
  for (let r = 0; r < nz; r++) {
    let c = 0;
    const b = r * nx;
    while (c < nx && mat[b + c] === MAT.LUFT) c++;
    g.front[r] = c;
  }
  g.version = k.version;
  return g;
}

/** Kliffkante: erste Spalte von See her, deren Oberfläche nahe der Kammhöhe liegt (m) */
export function kliffKante(k: Kliff) {
  const g = geometrie(k);
  for (let c = 0; c < k.nx; c++) if (g.top[c] >= 0 && zVon(k, g.top[c]) >= k.kantenHoehe) return xVon(k, c);
  return xVon(k, k.nx - 1);
}

/* ───────────────────────────────────────────────────── Wasser, Wellen ── */

export function kStau(k: Kliff, w: Wetter) {
  let s = 0;
  if (k.flut) s = k.flut.hoehe * Math.sin(Math.PI * (1 - k.flut.rest / k.flut.dauer));
  if (w.auflandig && w.bft > 6) s = Math.max(s, (w.bft - 6) * 0.12 * (k.stauMax / 3));
  return s;
}

export function kWasser(k: Kliff, w: Wetter) {
  return tide(k.hub, k.stunde) + kStau(k, w);
}

const H_BFT = [0, 0.1, 0.2, 0.6, 1.0, 1.5, 2.2, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0];

export function kWelle(k: Kliff, w: Wetter) {
  const h = H_BFT[Math.max(0, Math.min(12, Math.round(w.bft)))] * k.wellenFaktor;
  return w.auflandig ? h : h * 0.2;
}

export interface KWellen { H: Float32Array; ufer: number; brecher: number; amUfer: number; boden: Float32Array }

/** Wellen auf dem Weg zur Wand: Brechen bei H > 0,78·Tiefe, danach Abnahme (Dally) */
export function kWellen(k: Kliff, W: number, H0: number): KWellen {
  const g = geometrie(k);
  const rw = Math.max(0, Math.min(k.nz - 1, zeileVon(k, W)));
  const ufer = g.front[rw];
  const H = new Float32Array(k.nx), boden = new Float32Array(k.nx);
  let h = H0, brecher = -1, gebrochen = false;
  for (let c = 0; c < Math.min(ufer, k.nx); c++) {
    let r = rw;
    while (r >= 0 && k.mat[r * k.nx + c] === MAT.LUFT) r--;
    const bz = r < 0 ? k.z0 : k.z0 + (r + 1) * k.dx;
    boden[c] = bz;
    const tiefe = Math.max(0.05, W - bz);
    if (gebrochen && h > 0.4 * tiefe) h -= (0.08 / Math.max(tiefe, 0.3)) * (h - 0.4 * tiefe) * k.dx;
    if (0.78 * tiefe < h) { if (brecher < 0 && h > 0.25) brecher = c; gebrochen = true; h = 0.78 * tiefe; }
    // Blöcke am Grund bremsen die Welle
    if (r >= 0 && k.mat[r * k.nx + c] === MAT.BLOCK) h *= 1 - 0.01 * k.dx * 4;
    H[c] = h;
  }
  let amUfer = 0;
  for (let c = Math.max(0, ufer - Math.round(5 / k.dx)); c < Math.min(ufer, k.nx); c++) amUfer = Math.max(amUfer, H[c]);
  return { H, ufer, brecher, amUfer, boden };
}

/* ─────────────────────────────────────────────────────────── Melden ── */

function melde(k: Kliff, text: string, art: Meldung["art"] = "info") {
  k.meldungen.push({ stunde: k.stunde, text, art });
  if (k.meldungen.length > 60) k.meldungen.splice(0, k.meldungen.length - 60);
}

/* ─────────────────────────────────────────────────────── Zellen ändern ── */

function aendern(k: Kliff, i?: number) {
  k.version++; k.unruhig = true; k.pruefen = true;
  if (i === undefined) { k.aktiv = { c0: 0, c1: k.nx - 1, r0: 1, r1: k.nz - 1 }; return; }
  const c = i % k.nx, r = (i - c) / k.nx;
  const a = k.aktiv;
  a.c0 = Math.max(0, Math.min(a.c0, c - 2)); a.c1 = Math.min(k.nx - 1, Math.max(a.c1, c + 2));
  a.r0 = Math.max(1, Math.min(a.r0, r - 1)); a.r1 = Math.min(k.nz - 1, Math.max(a.r1, r + 3));
}

/**
 * Verrutschtes Gestein ist zerrüttet: Frost, Regen und Brandung zerlegen es
 * viel schneller als die gewachsene Wand — die Rutschmasse wird abgeräumt,
 * und das Kliff steht wieder steil.
 */
const zerruettet = (k: Kliff, i: number) => (k.gestoert[i] ? 5 : 1);

/** Zelle abtragen: Feines geht ins Meer, Feuerstein/Findlinge bleiben */
/** Feuersteingeröll wird gerollt und verfrachtet, Findlinge bleiben lange liegen */
function blockHaerte(k: Kliff, i: number) {
  const h = k.herk[i];
  return h === MAT.FEUER || h === MAT.KREIDE ? 0.8 : 12;
}

/**
 * Anteil grober Steine im Schutt, der beim Ausspülen liegen bleibt:
 * Feuersteinknollen aus der Kreide, Findlinge aus dem Geschiebemergel.
 */
const FEUER_IM_SCHUTT: Partial<Record<number, number>> = {
  [MAT.FEUER]: 0.25, [MAT.KREIDE]: 0.03, [MAT.MERGEL]: 0.04, [MAT.LEHM]: 0.03, [MAT.LIMONIT]: 0.06,
};

function abtragen(k: Kliff, i: number, zuSchutt: boolean) {
  const m = k.mat[i];
  if (m === MAT.LUFT || m === MAT.DECKWERK) return;
  if (m === MAT.BLOCK) {
    // von der Brandung fortgerollt
    k.mat[i] = MAT.LUFT; k.herk[i] = 0; k.schaden[i] = 0; k.vz[i] = 0; k.vx[i] = 0;
    aendern(k, i);
    return;
  }
  const herk = m === MAT.SCHUTT ? k.herk[i] : m;
  const info = MATERIAL[herk];
  k.schaden[i] = 0;
  k.gestoert[i] = 0;
  if (zuSchutt && m !== MAT.SCHUTT) {
    k.mat[i] = zufall(k) < info.block ? MAT.BLOCK : MAT.SCHUTT;
    k.herk[i] = herk;
  } else if (m !== MAT.SCHUTT && zufall(k) < info.block) {
    k.mat[i] = MAT.BLOCK; k.herk[i] = herk;
  } else if (m === MAT.SCHUTT && zufall(k) < (FEUER_IM_SCHUTT[herk] ?? 0)) {
    // Das Feine wird ausgespült, die Feuersteinknolle (bzw. der Findling) bleibt
    // liegen — so reichert sich die Kliffhalde oben mit Feuerstein an.
    k.mat[i] = MAT.BLOCK; k.herk[i] = herk;
    k.bilanz.weggespuelt += k.dx * k.dx * 0.8;
  } else {
    k.mat[i] = MAT.LUFT; k.vz[i] = 0; k.vx[i] = 0;
    k.bilanz.weggespuelt += k.dx * k.dx;
  }
  aendern(k, i);
}

/* ─────────────────────────────────────────────────────────── Prozesse ── */

/** Kalibrierung (m, h): Brandung, Plattform, Frost, Regen, Quellen, Wind */
const K_WELLE = 0.09;
const K_PLATTFORM = 0.0006;
const K_FROST = 0.0012;
const K_REGEN = 0.0012;
const K_QUELLE = 0.0016;
const K_WIND = 0.0004;

function brandung(k: Kliff, W: number, H0: number, wl: KWellen, dt: number) {
  const g = geometrie(k);
  const Hs = wl.amUfer;
  if (Hs < 0.05) return;
  const e = Hs * Hs * Math.max(0.3, H0);
  // Am senkrechten Kliff schlägt das Wasser hoch: Auflauf und Gischt
  const R = 1.4 * Hs + 0.1 * H0;
  const mitte = W + 0.25 * Hs, breite = 0.45 * Hs + 0.25;
  const r0 = Math.max(0, zeileVon(k, W - 0.6 * Hs - 0.3)), r1 = Math.min(k.nz - 1, zeileVon(k, W + R));
  // Bezug für die Dämpfung ist die Front an der Wasserlinie
  let vorn = k.nx;
  for (let r = Math.max(r0, zeileVon(k, W)); r <= r1; r++) vorn = Math.min(vorn, g.front[r]);
  for (let r = r0; r <= r1; r++) {
    const c = g.front[r];
    if (c >= k.nx) continue;
    const i = r * k.nx + c;
    const m = k.mat[i];
    if (m === MAT.DECKWERK) continue;
    const z = zVon(k, r);
    const f = Math.exp(-(((z - mitte) / breite) ** 2));
    // In die Kehle hinein verliert die Welle Kraft
    // Weit vor der Uferlinie unter Wasser: dort schleift die Welle nur (Plattform), sie schlägt nicht auf
    const a = c < vorn - Math.round(1.5 / k.dx) ? 0.08 : Math.exp(-(Math.max(0, c - vorn) * k.dx) / 3.5);
    const herk = m === MAT.SCHUTT ? k.herk[i] : m;
    const haerte = m === MAT.BLOCK ? blockHaerte(k, i) : m === MAT.SCHUTT ? 0.25 * (herk === MAT.KREIDE || herk === MAT.FEUER ? 1.6 : 1) : MATERIAL[m].haerte / zerruettet(k, i);
    k.schaden[i] += (K_WELLE * e * f * a * dt * (0.7 + 0.6 * zufall(k))) / haerte;
    if (k.schaden[i] >= 1) abtragen(k, i, false);
  }
  // Abrasionsplattform: der Grund in der Brandungszone wird langsam abgeschliffen
  for (let c = Math.max(0, wl.ufer - Math.round(30 / k.dx)); c < Math.min(wl.ufer, k.nx); c++) {
    const tiefe = W - wl.boden[c];
    if (tiefe > 1.5 * H0 + 0.5) continue;
    const r = zeileVon(k, wl.boden[c] - k.dx * 0.5);
    if (r < 0) continue;
    const i = r * k.nx + c;
    const m = k.mat[i];
    if (m === MAT.LUFT || m === MAT.DECKWERK) continue;
    const haerte = m === MAT.BLOCK ? blockHaerte(k, i) * 3 : m === MAT.SCHUTT ? 0.4 : MATERIAL[m].haerte;
    k.schaden[i] += (K_PLATTFORM * wl.H[c] * wl.H[c] * H0 * dt) / haerte;
    if (k.schaden[i] >= 1) abtragen(k, i, false);
  }
}

/** Wie leicht ein Material an der Oberfläche abgetragen wird (Hangdiffusion) */
const ABTRAG: Partial<Record<number, number>> = {
  [MAT.BODEN]: 1, [MAT.SAND]: 1, [MAT.MERGEL]: 0.6, [MAT.LEHM]: 0.6, [MAT.TON]: 0.5,
  [MAT.LIMONIT]: 0.25, [MAT.KREIDE]: 0.15, [MAT.FEUER]: 0.1,
};

/**
 * Oberflächenabtrag an der Abbruchkante (Hangdiffusion): Eine Stelle wird
 * umso schneller abgetragen, je weiter sie herausragt. Gemessen wird das am
 * Anteil Gestein in einem Kreis von 2 m um die Oberflächenzelle: an einer
 * rechtwinkligen Ecke ein Viertel, an einer geraden Fläche die Hälfte.
 * Regen, Frost und Nässe beschleunigen, Bewuchs bremst. So rundet sich eine
 * frische Abbruchkante in wenigen Jahren wieder ab.
 */
function kanteAbtragen(k: Kliff, w: Wetter, W: number, dt: number) {
  const g = geometrie(k);
  const kc = spalteVon(k, kliffKante(k));
  if (kc <= 0 || kc >= k.nx) return;
  const R = Math.max(2, Math.round(2 / k.dx));
  const oben = g.top[kc];
  const unten = Math.max(zeileVon(k, W + 2), oben - 4 * R);
  const antrieb = 0.3 + (w.regen ? 2 : 0) + (w.frost ? 1 : 0) + Math.max(0, k.saettigung - 0.5) * 2;
  let n = 0;
  for (let r = Math.max(1, unten); r < k.nz - 1; r++) {
    for (let c = Math.max(1, kc - 2 * R); c < Math.min(k.nx - 1, kc + 3 * R); c++) {
      const i = r * k.nx + c;
      const m = k.mat[i];
      const e = ABTRAG[m];
      if (!e) continue;
      // nur freiliegende Zellen (oben oder zur See hin Luft)
      if (k.mat[i + k.nx] !== MAT.LUFT && k.mat[i - 1] !== MAT.LUFT) continue;
      let fest = 0, alle = 0;
      for (let dr = -R; dr <= R; dr += 2) for (let dc = -R; dc <= R; dc += 2) {
        if (dr * dr + dc * dc > R * R) continue;
        const rr = r + dr, cc = c + dc;
        if (rr < 0 || cc < 0 || cc >= k.nx) continue;
        alle++;
        if (rr < k.nz && k.mat[rr * k.nx + cc] !== MAT.LUFT) fest++;
      }
      const vorstehen = 0.46 - fest / alle;
      if (vorstehen <= 0) continue;
      const bremse = k.bewuchs[c] ? 0.5 : 1;
      if (zufall(k) < 0.005 * vorstehen * e * antrieb * bremse * dt) {
        k.mat[i] = MAT.SCHUTT; k.herk[i] = m; k.schaden[i] = 0;
        aendern(k, i);
        if (++n > 40) return;
      }
    }
  }
}

function wetterWirkt(k: Kliff, w: Wetter, W: number, dt: number) {
  const g = geometrie(k);
  const rW = Math.max(0, zeileVon(k, W + 1.5));
  // Frost: Wasser in den Poren gefriert und sprengt Schalen ab
  if (w.frost) {
    for (let r = rW; r < k.nz; r++) {
      const c = g.front[r];
      if (c >= k.nx) continue;
      const i = r * k.nx + c;
      const m = k.mat[i];
      if (LOSE(m) || m === MAT.DECKWERK) continue;
      // An der Ecke greift der Frost von zwei Seiten an
      const ecke = r < k.nz - 1 && k.mat[i + k.nx] === MAT.LUFT ? 2 : 1;
      k.schaden[i] += (K_FROST * ecke * MATERIAL[m].frost * dt * (0.5 + zufall(k)) * zerruettet(k, i)) / MATERIAL[m].haerte;
      if (k.schaden[i] >= 1) abtragen(k, i, true);
    }
    k.risse = Math.min(1, k.risse + 0.00008 * dt);
  }
  // Regen spült die Oberfläche ab, wo sie steil und kahl ist
  if (w.regen) {
    for (let c = 1; c < k.nx - 1; c++) {
      const r = g.top[c];
      if (r <= rW) continue;
      const steil = Math.abs(g.top[c + 1] - g.top[c - 1]) * k.dx / 2;
      if (steil < 0.45) continue;
      const i = r * k.nx + c;
      const m = k.mat[i];
      const info = MATERIAL[m === MAT.SCHUTT ? k.herk[i] : m];
      if (info.regen <= 0 || m === MAT.BLOCK || m === MAT.DECKWERK) continue;
      const schutz = k.bewuchs[c] ? 0.25 : 1;
      k.schaden[i] += (K_REGEN * info.regen * Math.min(2, steil) * schutz * dt * zerruettet(k, i)) / info.haerte;
      if (k.schaden[i] >= 1) abtragen(k, i, true);
    }
    // Das Wasser von der Hochfläche stürzt über die Kante und spült ihre
    // Oberkante ab — nach unten immer schwächer. So rundet sich die Kante.
    const kc = spalteVon(k, kliffKante(k));
    if (kc > 0 && kc < k.nx) {
      const oben = g.top[kc];
      const schutz = k.bewuchs[kc] ? 0.35 : 1;
      for (let r = oben; r >= Math.max(rW, oben - Math.round(5 / k.dx)); r--) {
        const c = g.front[r];
        if (c >= k.nx) continue;
        const i = r * k.nx + c;
        const m = k.mat[i];
        const info = MATERIAL[m === MAT.SCHUTT ? k.herk[i] : m];
        if (info.regen <= 0 || m === MAT.BLOCK || m === MAT.DECKWERK) continue;
        const tiefe = (oben - r) * k.dx;
        k.schaden[i] += (K_REGEN * 3 * info.regen * Math.exp(-tiefe / 1.5) * schutz * dt) / info.haerte;
        if (k.schaden[i] >= 1) abtragen(k, i, true);
      }
    }
    k.risse = Math.min(1, k.risse + 0.00002 * dt);
    k.saettigung = Math.min(k.schutz.drainage ? 0.45 : 1, k.saettigung + 0.002 * dt);
  } else if (!w.frost) {
    // Im Sommer verdunstet und verbraucht die Vegetation viel mehr Wasser als im Winter
    const m = monat(k.stunde);
    const sommer = m >= 3 && m <= 8;
    k.saettigung = Math.max(0.05, k.saettigung - (sommer ? 0.0015 : 0.0003) * (k.schutz.drainage ? 2.5 : 1) * dt);
  }
  // Quellhorizont: über dem Ton staut sich das Wasser und tritt an der Wand aus
  if (k.saettigung > 0.35) {
    for (let r = rW; r < k.nz; r++) {
      const c = g.front[r];
      if (c >= k.nx || r === 0) continue;
      const i = r * k.nx + c;
      const m = k.mat[i];
      if (m !== MAT.SAND && m !== MAT.MERGEL && m !== MAT.LEHM && m !== MAT.KREIDE) continue;
      let ton = false;
      for (let d = 1; d <= 3 && r - d >= 0; d++) if (k.mat[(r - d) * k.nx + c] === MAT.TON || k.mat[(r - d) * k.nx + c + 1] === MAT.TON) ton = true;
      if (!ton) continue;
      k.schaden[i] += (K_QUELLE * (k.saettigung - 0.35) * dt * (0.5 + zufall(k))) / MATERIAL[m].haerte;
      if (k.schaden[i] >= 1) abtragen(k, i, true);
    }
  }
  kanteAbtragen(k, w, W, dt);
  // Bodenkriechen: nasser Boden und Lockermaterial an der Kante rutschen langsam nach
  if (k.saettigung > 0.6) {
    const kc = spalteVon(k, kliffKante(k));
    for (let c = Math.max(1, kc - Math.round(2 / k.dx)); c < Math.min(k.nx, kc + Math.round(4 / k.dx)); c++) {
      const r = g.top[c];
      if (r <= rW) continue;
      const i = r * k.nx + c;
      const m = k.mat[i];
      if (m !== MAT.BODEN && m !== MAT.MERGEL && m !== MAT.LEHM && m !== MAT.SAND && m !== MAT.TON) continue;
      if (k.mat[i - 1] !== MAT.LUFT) continue;
      if (zufall(k) < 0.0015 * (k.saettigung - 0.6) * dt * (k.bewuchs[c] ? 0.4 : 1)) {
        k.mat[i] = MAT.SCHUTT; k.herk[i] = m; aendern(k, i);
      }
    }
  }
  // Sand rieselt ab, wo die Wand steiler als sein Schüttwinkel ist
  for (let r = rW; r < k.nz; r++) {
    const c = g.front[r];
    if (c >= k.nx || c === 0 || r === 0) continue;
    const i = r * k.nx + c;
    if (k.mat[i] !== MAT.SAND) continue;
    if (k.mat[(r - 1) * k.nx + c - 1] !== MAT.LUFT) continue;
    if (zufall(k) < 0.02 * dt * (w.regen ? 0.3 : 1)) { k.mat[i] = MAT.SCHUTT; k.herk[i] = MAT.SAND; aendern(k, i); }
  }
  // Wind: trockener Sand fliegt vom Kliff auf die Kliffranddüne
  if (k.typ === "sand" && w.auflandig && w.bft >= 5 && !w.regen) {
    const kante = spalteVon(k, kliffKante(k));
    const n = Math.floor(K_WIND * (w.bft - 4) ** 2 * dt * 400 + zufall(k));
    for (let s = 0; s < n; s++) {
      const r = rW + Math.floor(zufall(k) * (k.nz - rW));
      const c = g.front[r];
      if (c >= k.nx) continue;
      const i = r * k.nx + c;
      const m = k.mat[i];
      if (!(m === MAT.SAND || (m === MAT.SCHUTT && k.herk[i] === MAT.SAND))) continue;
      const ziel = Math.min(k.nx - 1, kante + Math.round((3 + zufall(k) * 9) / k.dx));
      const rz = g.top[ziel] + 1;
      if (rz >= k.nz) continue;
      k.mat[i] = MAT.LUFT;
      k.mat[rz * k.nx + ziel] = MAT.SCHUTT; k.herk[rz * k.nx + ziel] = MAT.SAND; k.vz[rz * k.nx + ziel] = 0; k.vx[rz * k.nx + ziel] = 0;
      aendern(k, i); aendern(k, rz * k.nx + ziel);
    }
  }
}

/* ─────────────────────────────────────────────── Schutt: fallen, rieseln ── */

function ruhe(k: Kliff, i: number) {
  if (k.mat[i] === MAT.BLOCK) return 50;
  const info = MATERIAL[k.herk[i]];
  const nass = k.saettigung > 0.6 ? (k.saettigung - 0.6) / 0.4 : 0;
  return info.ruhe + (info.ruheNass - info.ruhe) * nass;
}

function verschieben(k: Kliff, von: number, nach: number) {
  k.mat[nach] = k.mat[von]; k.herk[nach] = k.herk[von]; k.schaden[nach] = 0; k.gestoert[nach] = k.gestoert[von];
  k.vz[nach] = k.vz[von]; k.vx[nach] = k.vx[von];
  k.mat[von] = MAT.LUFT; k.herk[von] = 0; k.schaden[von] = 0; k.gestoert[von] = 0; k.vz[von] = 0; k.vx[von] = 0;
}

/** Höchsttempo fallenden Schutts in Luft und im Wasser (m/s) */
const V_LUFT = 30, V_WASSER = 1.5;
/** Unter diesem Rutschtempo (m/s) rieselt Schutt nur noch nach dem Schüttwinkel */
const V_RUHE = 0.3;

/** Zufällig gerundete Zahl von Zellen für einen Weg in Metern */
function zellenFuer(k: Kliff, weg: number) {
  const f = weg / k.dx;
  return Math.floor(f) + (zufall(k) < f - Math.floor(f) ? 1 : 0);
}

/**
 * Aufprall nach einem Fall: ein Teil des Tempos wird zum Rutschen hangabwärts
 * (im Wasser bremst es stark). So läuft ein Schuttkegel weiter aus, je höher
 * der Schutt herabfällt.
 */
function aufprall(k: Kliff, i: number, nass: boolean) {
  const v = k.vz[i];
  k.vz[i] = 0;
  if (v < 2) return;
  const { nx, mat } = k;
  const c = i % nx;
  const frei = (d: number) => {
    const cc = c + d;
    if (cc < 0 || cc >= nx || mat[i + d] !== MAT.LUFT) return 0;
    return mat[i + d - nx] === MAT.LUFT ? 2 : 1;
  };
  const l = frei(-1), r = frei(1);
  if (!l && !r) return;
  const d = l > r ? -1 : r > l ? 1 : zufall(k) < 0.5 ? -1 : 1;
  k.vx[i] = d * v * (nass ? 0.1 : 0.35);
}

/**
 * Ein Durchgang Schwerkraft für lose Zellen (Zeitschritt dt in s), von unten
 * nach oben wie bei einem Fallsand-Spiel, die Laufrichtung wechselt je Zeile:
 *   fallen   mit Erdbeschleunigung, im Wasser nur langsam sinken;
 *   rutschen mit dem Schwung des Aufpralls, bis die Reibung ihn aufzehrt;
 *   rieseln  zur Seite, solange der Hang steiler als der Schüttwinkel ist.
 * Liefert die Zahl der Zellen, die sich bewegt haben oder noch Tempo haben.
 */
export function rieseln(k: Kliff, dt = 1 / 20): number {
  const { nx, mat, vz, vx, takt } = k;
  const a = k.aktiv;
  if (a.c0 > a.c1) return 0;
  const durch = k.durchgang = (k.durchgang % 65535) + 1;
  const rW = zeileVon(k, k.wasser);
  let n = 0;
  let c0 = nx, c1 = -1, r0 = k.nz, r1 = -1;
  const merke = (i: number) => {
    const c = i % nx, r = (i - c) / nx;
    if (c < c0) c0 = c; if (c > c1) c1 = c;
    if (r < r0) r0 = r; if (r > r1) r1 = r;
  };
  for (let r = a.r0; r <= a.r1; r++) {
    const rechts = ((r + durch) & 1) === 1;
    for (let j = a.c0; j <= a.c1; j++) {
      const c = rechts ? a.c1 - (j - a.c0) : j;
      let i = r * nx + c;
      const m = mat[i];
      if ((m !== MAT.SCHUTT && m !== MAT.BLOCK) || takt[i] === durch) continue;
      const von = i;
      // Fallen
      if (mat[i - nx] === MAT.LUFT) {
        let v = Math.min(r <= rW ? V_WASSER : V_LUFT, vz[i] + 9.81 * dt);
        let rr = r;
        for (let s = zellenFuer(k, v * dt); s > 0 && rr > 0 && mat[i - nx] === MAT.LUFT; s--) {
          i -= nx; rr--;
          if (rr <= rW) v = Math.min(v, V_WASSER);
        }
        if (i !== von) verschieben(k, von, i);
        vz[i] = v;
        takt[i] = durch;
        merke(von); merke(i);
        n++;
        if (rr === 0 || mat[i - nx] !== MAT.LUFT) aufprall(k, i, rr <= rW);
        continue;
      }
      if (vz[i] > 0) aufprall(k, i, r <= rW);
      // Rutschen mit Schwung
      if (Math.abs(vx[i]) > V_RUHE) {
        const d = vx[i] > 0 ? 1 : -1;
        let v = Math.abs(vx[i]), cc = c, rr = r;
        for (let s = zellenFuer(k, v * dt); s > 0; s--) {
          const nc = cc + d;
          if (nc < 0 || nc >= nx || mat[rr * nx + nc] !== MAT.LUFT) { v = 0; break; }
          cc = nc;
          if (rr > 0 && mat[(rr - 1) * nx + nc] === MAT.LUFT) rr--;
        }
        // Reibung nach dem Schüttwinkel; im Wasser bremst es viel stärker
        v = Math.max(0, v - 9.81 * Math.tan((ruhe(k, i) * Math.PI) / 180) * dt * (rr <= rW ? 4 : 1));
        const ziel = rr * nx + cc;
        if (ziel !== i) verschieben(k, i, ziel);
        vx[ziel] = v > V_RUHE ? d * v : 0;
        takt[ziel] = durch;
        merke(von); merke(ziel);
        n++;
        continue;
      }
      vx[i] = 0;
      // Rieseln bis zum Schüttwinkel
      let ziel = -1;
      const weite = 1 / Math.tan((ruhe(k, i) * Math.PI) / 180);
      let kmax = Math.floor(weite);
      if (zufall(k) < weite - kmax) kmax++;
      if (kmax < 1) continue;
      const d0 = zufall(k) < 0.5 ? -1 : 1;
      for (const d of [d0, -d0]) {
        for (let s = 1; s <= kmax; s++) {
          const cc = c + d * s;
          if (cc < 0 || cc >= nx || mat[r * nx + cc] !== MAT.LUFT) break;
          if (mat[(r - 1) * nx + cc] === MAT.LUFT) { ziel = (r - 1) * nx + cc; break; }
        }
        if (ziel >= 0) break;
      }
      if (ziel < 0) continue;
      verschieben(k, i, ziel);
      takt[ziel] = durch;
      merke(i); merke(ziel);
      n++;
    }
  }
  if (n > 0) {
    k.version++;
    k.aktiv = { c0: Math.max(0, c0 - 3), c1: Math.min(nx - 1, c1 + 3), r0: Math.max(1, r0 - 1), r1: Math.min(k.nz - 1, r1 + 3) };
  } else k.aktiv = { c0: nx, c1: -1, r0: k.nz, r1: -1 };
  return n;
}

/* ──────────────────────────────────────────── Bewegungen (Stürze, Rutsche) ── */

function masseAus(k: Kliff, zellen: number[], art: Bewegung["art"]): Bewegung {
  const idx = Int32Array.from(zellen);
  const mMat = new Uint8Array(idx.length), mHerk = new Uint8Array(idx.length);
  let c0 = k.nx, c1 = 0, r0 = k.nz, r1 = 0, sx = 0, sz = 0;
  const set = new Set(zellen);
  for (let j = 0; j < idx.length; j++) {
    const i = idx[j];
    mMat[j] = k.mat[i]; mHerk[j] = k.herk[i];
    const c = i % k.nx, r = (i - c) / k.nx;
    c0 = Math.min(c0, c); c1 = Math.max(c1, c); r0 = Math.min(r0, r); r1 = Math.max(r1, r);
    sx += c; sz += r;
  }
  const b: Bewegung = {
    art, idx, mMat, mHerk, bbox: { c0, c1, r0, r1 },
    pivX: xVon(k, sx / idx.length), pivZ: zVon(k, sz / idx.length),
    theta: 0, tx: 0, tz: 0, vx: 0, vz: 0, omega: 0,
    dirX: 0, dirZ: 0, reib: 0, fort: 0, tempo: 0, mx: xVon(k, sx / idx.length), mz: zVon(k, sz / idx.length), ausX: -Infinity, dauer: 12, zeit: 0,
    volumen: idx.length * k.dx * k.dx, baeume: [], objekte: [], id: ++k.laufId,
  };
  const lage = new Map<number, number>();
  for (let j = 0; j < idx.length; j++) lage.set(idx[j], j);
  for (const t of k.baeume) {
    if (t.weg || t.liegt || t.fall) continue;
    const j = lage.get(zelle(k, t.c, t.r));
    if (j === undefined) continue;
    // Bei einem Sturz fällt der Baum für sich (seewärts); bei einer
    // Rutschung fährt er auf der Scholle mit und kippt mit ihr.
    if (art === "fall") baumFaellt(k, t, -0.8);
    else b.baeume.push({ id: t.id, j });
  }
  for (const o of k.objekte) {
    if (o.zerstoert) continue;
    // Ein Objekt steht auf der Zelle unter sich
    if (set.has(zelle(k, o.c, o.r)) || set.has(zelle(k, o.c, Math.max(0, o.r - 1)))) b.objekte.push(o.id);
  }
  for (const i of zellen) { k.mat[i] = MAT.LUFT; k.herk[i] = 0; k.schaden[i] = 0; k.gestoert[i] = 0; }
  aendern(k);
  k.bewegungen.push(b);
  k.bilanz.abgestuerzt += b.volumen;
  k.bilanz.ereignisse++;
  return b;
}

/** Weltposition einer Massenzelle unter der aktuellen Transformation */
function lage(k: Kliff, b: Bewegung, j: number): [number, number] {
  const i = b.idx[j];
  const c = i % k.nx, r = (i - c) / k.nx;
  const x = xVon(k, c) - b.pivX, z = zVon(k, r) - b.pivZ;
  const co = Math.cos(b.theta), si = Math.sin(b.theta);
  return [b.pivX + co * x - si * z + b.tx, b.pivZ + si * x + co * z + b.tz];
}

function fest(k: Kliff, x: number, z: number) {
  const c = spalteVon(k, x), r = zeileVon(k, z);
  if (c < 0 || c >= k.nx) return false;
  if (r < 0) return true;
  if (r >= k.nz) return false;
  return k.mat[r * k.nx + c] !== MAT.LUFT;
}

function hart(k: Kliff, x: number, z: number) {
  const c = spalteVon(k, x), r = zeileVon(k, z);
  if (c < 0 || c >= k.nx || r >= k.nz) return false;
  if (r < 0) return true;
  const m = k.mat[r * k.nx + c];
  return m !== MAT.LUFT && !LOSE(m);
}

/**
 * Rutschende Masse: Stößt sie an Fels (mehr als eine Zelle tief — die
 * Treppenstufen des Rasters unter der Gleitfläche zählen nicht)? Und welcher
 * Anteil ist schon über den Austritt der Gleitfläche hinaus aufs Vorland
 * geschoben? Losen Schutt schiebt sie vor sich her.
 */
function rutschLage(k: Kliff, b: Bewegung) {
  const n = b.idx.length, schritt = Math.max(1, Math.floor(n / 600));
  let treffer = 0, proben = 0, vorne = 0;
  for (let j = 0; j < n; j += schritt) {
    proben++;
    const [x, z] = lage(k, b, j);
    if (x < b.ausX) vorne++;
    if (hart(k, x, z) && hart(k, x, z + k.dx)) treffer++;
  }
  return { stoesst: treffer > Math.max(2, proben * 0.015), vorne: vorne / Math.max(1, proben) };
}

/** Reibbeiwert auf dem Vorland (Strand, Schutt), wo die Scholle ausläuft */
const REIB_VORLAND = 0.9;

/** Eine stürzende Masse zerschellt: Zellen werden Schutt (und Blöcke) */
function aufschlagen(k: Kliff, b: Bewegung) {
  const punkte: { x: number; z: number; j: number }[] = [];
  for (let j = 0; j < b.idx.length; j++) { const [x, z] = lage(k, b, j); punkte.push({ x, z, j }); }
  punkte.sort((a, c) => a.z - c.z);
  for (const p of punkte) {
    let c = Math.max(0, Math.min(k.nx - 1, spalteVon(k, p.x)));
    let r = Math.max(0, zeileVon(k, p.z));
    while (r < k.nz && k.mat[r * k.nx + c] !== MAT.LUFT) r++;
    if (r >= k.nz) { c = Math.min(k.nx - 1, c + 1); continue; }
    const i = r * k.nx + c;
    const herk = b.mMat[p.j] === MAT.SCHUTT ? b.mHerk[p.j] : b.mMat[p.j];
    k.mat[i] = b.mMat[p.j] === MAT.BLOCK || zufall(k) < MATERIAL[herk].block ? MAT.BLOCK : MAT.SCHUTT;
    k.herk[i] = herk;
    // Der Aufprall schleudert den Schutt seewärts: er läuft als Schuttstrom aus
    k.vz[i] = 0;
    k.vx[i] = -(0.2 + 0.2 * zufall(k)) * Math.abs(b.vz);
  }
  aendern(k);
}

/* ─────────────────────────────────────────────────────────────── Bäume ── */

/** Ein Baum verliert den Halt und stürzt — immer zum Meer hin */
function baumFaellt(k: Kliff, t: Baum, vx = -0.4) {
  t.fall = { x: xVon(k, t.c), z: zVon(k, t.r) + k.dx / 2, vx: vx - zufall(k) * 0.8, vz: 0, om: 0.9 + zufall(k) * 0.8 };
  t.liegt = false;
  t.tot ??= k.stunde;
}

/** Echtzeit: fallende Bäume; liefert true, solange einer fällt */
function baeumeBewegen(k: Kliff, dt: number) {
  let aktiv = false;
  for (const t of k.baeume) {
    const f = t.fall;
    if (!f || t.weg) continue;
    aktiv = true;
    for (let s = 0; s < 3; s++) {
      const h = dt / 3;
      f.vz -= 9.81 * h;
      f.x += f.vx * h; f.z += f.vz * h;
      t.neigung = Math.min(1.65, t.neigung + f.om * h);
      if (f.x < 0 || f.z < k.z0) { t.weg = true; t.fall = undefined; break; }
      if (fest(k, f.x, f.z - k.dx * 0.5)) {
        // Aufgeschlagen. Ist der Hang zum Meer hin steiler als etwa 35°,
        // rutscht und rollt der Stamm weiter hinab — bis zum Strand oder ins Wasser.
        const g = geometrie(k);
        const c = Math.max(0, Math.min(k.nx - 1, spalteVon(k, f.x)));
        const s = Math.max(1, Math.round(1 / k.dx));
        const cs = c - s;
        if (cs >= 0 && g.top[cs] >= 0 && (g.top[c] - g.top[cs]) * k.dx > 0.7 * s * k.dx) {
          f.x = xVon(k, cs);
          f.z = zVon(k, g.top[cs]) + k.dx;
          f.vx = -1.5 - zufall(k);
          f.vz = Math.min(f.vz, 0) * 0.3;
          f.om = 0.6;
          continue;
        }
        // Liegt jetzt, die Krone zum Meer
        t.c = Math.max(0, Math.min(k.nx - 1, spalteVon(k, f.x)));
        let r = Math.max(0, zeileVon(k, f.z));
        while (r < k.nz - 1 && k.mat[r * k.nx + t.c] !== MAT.LUFT) r++;
        t.r = Math.max(0, r - 1);
        t.liegt = true;
        t.neigung = 1.35 + zufall(k) * 0.3;
        t.fall = undefined;
        break;
      }
    }
  }
  return aktiv;
}

/**
 * Halt, Absterben und Verrotten:
 *  - ohne Boden unter sich stürzt ein Baum;
 *  - an der Kante mit freiliegenden Wurzeln stirbt er ab und stürzt später;
 *  - liegend verrottet er in etwa 4 Jahren, unter Schutt verschwindet er,
 *    in der Brandung wird er als Treibholz fortgespült.
 */
function baeumePruefen(k: Kliff, W: number, dt: number) {
  const g = geometrie(k);
  const fuss = Math.round(0.6 / k.dx);
  const rand = Math.round(1.5 / k.dx);
  for (const t of k.baeume) {
    if (t.weg || t.fall) continue;
    if (t.liegt) {
      const z = zVon(k, t.r);
      const alter = (k.stunde - (t.tot ?? k.stunde)) / 8766;
      if (g.top[t.c] > t.r + Math.round(1.5 / k.dx)) { t.weg = true; continue; }
      // Schutt darunter weggespült: der Stamm fällt bzw. rutscht weiter hinab
      if (g.top[t.c] < t.r - fuss) { baumFaellt(k, t, -0.3); continue; }
      if (z < W + 1.2 && (k.flut || zufall(k) < dt / (24 * 25))) {
        t.weg = true;
        if (!k.merker.treibholz) { k.merker.treibholz = true; melde(k, "Die Brandung hat einen umgestürzten Baum als Treibholz fortgetragen."); }
        continue;
      }
      if (alter > 4) t.weg = true;
      continue;
    }
    // Stehend: Boden weg → Sturz
    if (g.top[t.c] < t.r - fuss) { baumFaellt(k, t); continue; }
    t.r = g.top[t.c];
    // Die Kante reicht bis unter die Krone: Wurzeln hängen frei, der Baum stirbt ab
    const c0 = Math.max(0, t.c - rand);
    if (t.tot === undefined && g.top[c0] < t.r - Math.round(2 / k.dx)) t.tot = k.stunde;
    if (t.tot !== undefined && k.stunde - t.tot > 1.5 * 8766) baumFaellt(k, t);
  }
}

/** Eine gerutschte Scholle bleibt als Ganzes liegen — verkippt und gelockert */
function ablegen(k: Kliff, b: Bewegung) {
  const lookup = new Map<number, number>();
  for (let j = 0; j < b.idx.length; j++) lookup.set(b.idx[j], j);
  let xa = Infinity, xb = -Infinity, za = Infinity, zb = -Infinity;
  for (let j = 0; j < b.idx.length; j += Math.max(1, Math.floor(b.idx.length / 400))) {
    const [x, z] = lage(k, b, j);
    xa = Math.min(xa, x); xb = Math.max(xb, x); za = Math.min(za, z); zb = Math.max(zb, z);
  }
  const rand = 3 * k.dx;
  const co = Math.cos(-b.theta), si = Math.sin(-b.theta);
  const gesetzt = new Uint8Array(b.idx.length);
  const ueber: number[] = [];
  for (let c = Math.max(0, spalteVon(k, xa - rand)); c <= Math.min(k.nx - 1, spalteVon(k, xb + rand)); c++) {
    for (let r = Math.max(0, zeileVon(k, za - rand)); r <= Math.min(k.nz - 1, zeileVon(k, zb + rand)); r++) {
      const x = xVon(k, c) - b.tx - b.pivX, z = zVon(k, r) - b.tz - b.pivZ;
      const sx = b.pivX + co * x - si * z, sz = b.pivZ + si * x + co * z;
      const sc = spalteVon(k, sx), sr = zeileVon(k, sz);
      if (sc < 0 || sc >= k.nx || sr < 0 || sr >= k.nz) continue;
      const j = lookup.get(sr * k.nx + sc);
      if (j === undefined || gesetzt[j]) continue;
      gesetzt[j] = 1;
      const i = r * k.nx + c;
      if (k.mat[i] === MAT.LUFT) {
        k.mat[i] = b.mMat[j]; k.herk[i] = b.mHerk[j]; k.gestoert[i] = 1; k.schaden[i] = 0;
      } else ueber.push(j);
    }
  }
  // Was nicht mehr hineinpasst, wird Schutt obendrauf
  for (let j = 0; j < b.idx.length; j++) if (!gesetzt[j]) ueber.push(j);
  for (const j of ueber) {
    const [x, z] = lage(k, b, j);
    const c = Math.max(0, Math.min(k.nx - 1, spalteVon(k, x)));
    let r = Math.max(0, zeileVon(k, z));
    while (r < k.nz - 1 && k.mat[r * k.nx + c] !== MAT.LUFT) r++;
    const i = r * k.nx + c;
    k.mat[i] = MAT.SCHUTT; k.herk[i] = b.mMat[j] === MAT.SCHUTT ? b.mHerk[j] : b.mMat[j]; k.vz[i] = 0; k.vx[i] = 0;
  }
  aendern(k);
  geometrie(k);
  for (const { id, j } of b.baeume) {
    const t = k.baeume.find(x => x.id === id);
    if (!t) continue;
    const [x] = lage(k, b, j);
    t.c = Math.max(0, Math.min(k.nx - 1, spalteVon(k, x)));
    t.r = k.cache.top[t.c];
    t.neigung += b.theta + (b.art === "gleit" ? (zufall(k) - 0.5) * 0.3 : 0);
    // Die Wurzeln reißen beim Abrutschen: der Baum steht schief und stirbt ab
    t.tot ??= k.stunde;
  }
}

/** Echtzeit-Schritt aller laufenden Bewegungen */
function bewegen(k: Kliff, dt: number) {
  for (const b of [...k.bewegungen]) {
    b.zeit += dt;
    let fertig = false;
    if (b.art === "fall") {
      for (let s = 0; s < 4 && !fertig; s++) {
        const h = dt / 4;
        b.vz -= 9.81 * h;
        b.tx += b.vx * h; b.tz += b.vz * h; b.theta += b.omega * h;
        // Aufschlag: prüfe den unteren Rand der Masse
        const n = b.idx.length, schritt = Math.max(1, Math.floor(n / 600));
        for (let j = 0; j < n; j += schritt) {
          const [x, z] = lage(k, b, j);
          if (fest(k, x, z - k.dx * 0.5)) { fertig = true; break; }
        }
        if (b.tz < -200) fertig = true;
      }
      if (fertig) aufschlagen(k, b);
    } else {
      // Gleitklotz mit Reibung: Die Schwerkraft treibt, die Restreibung auf
      // der Gleitfläche bremst. Die Scholle kommt zur Ruhe, wenn die Reibung
      // siegt oder sie an Fels stößt — kein vorgegebener Weg.
      // Der Teil, der schon aufs Vorland geschoben ist, treibt nicht mehr
      // mit, sondern bremst — so läuft die Scholle aus.
      for (let s = 0; s < 4 && !fertig; s++) {
        const h = dt / 4;
        const vorher = [b.theta, b.tx, b.tz, b.fort];
        const vorne = b.zeit > 0 ? rutschLage(k, b).vorne : 0;
        if (b.art === "rutsch") {
          // Drehung um den Kreismittelpunkt wie ein gebremstes Pendel
          const x = b.mx - b.pivX, z = b.mz - b.pivZ;
          const co = Math.cos(b.theta), si = Math.sin(b.theta);
          const xs = co * x - si * z, zs = si * x + co * z;
          const R = Math.max(1, Math.hypot(xs, zs));
          const a = (1 - vorne) * (xs / R - b.reib * (-zs / R)) - vorne * REIB_VORLAND;
          b.omega -= (9.81 / R) * a * h;
          if (b.omega >= 0) { b.omega = 0; fertig = b.zeit > 0.2; if (fertig) break; }
          b.theta += b.omega * h;
        } else {
          // Ebene Gleitfläche: a = g (sin β − μ cos β); auf dem Vorland dreht
          // die Bahn in die Waagerechte
          const a = (1 - vorne) * (-b.dirZ - b.reib * -b.dirX) - vorne * REIB_VORLAND;
          b.tempo += 9.81 * a * h;
          if (b.tempo <= 0) { b.tempo = 0; fertig = b.zeit > 0.2; if (fertig) break; }
          const len = Math.hypot((1 - vorne) * b.dirX - vorne, (1 - vorne) * b.dirZ);
          b.tx += (((1 - vorne) * b.dirX - vorne) / len) * b.tempo * h;
          b.tz += (((1 - vorne) * b.dirZ) / len) * b.tempo * h;
          b.fort += b.tempo * h;
        }
        if (rutschLage(k, b).stoesst) { [b.theta, b.tx, b.tz, b.fort] = vorher; fertig = true; }
      }
      if (fertig || b.zeit > b.dauer) {
        fertig = true;
        ablegen(k, b);
        // Was jetzt über Luft hängt, bricht ab und fällt gleich nach
        verbindungPruefen(k);
      }
    }
    if (fertig) {
      k.bewegungen.splice(k.bewegungen.indexOf(b), 1);
      for (const id of b.objekte) {
        const o = k.objekte.find(x => x.id === id);
        if (o && !o.zerstoert) {
          o.zerstoert = b.art === "fall" ? "abgestürzt" : "abgerutscht";
          k.schadenEuro += o.art === "leuchtturm" ? 12 : o.art === "haus" ? 3 : o.art === "aussicht" ? 2 : 0.2;
          melde(k, `${o.name} ist ${o.zerstoert}.`, "schaden");
        }
      }
    }
  }
}

/** Echtzeit: Bewegungen und Schutt; liefert true, solange etwas in Bewegung ist */
export function animieren(k: Kliff, dt: number, durchgaenge = 2): boolean {
  if (k.bewegungen.length) bewegen(k, dt);
  baeumeBewegen(k, dt);
  if (k.unruhig) {
    let n = 0;
    for (let d = 0; d < durchgaenge; d++) n += rieseln(k, dt / 2);
    if (n === 0) k.unruhig = false;
  }
  return k.bewegungen.length > 0;
}

/** Ohne Oberfläche: alles zu Ende fallen und rutschen lassen */
export function abschliessen(k: Kliff) {
  for (let s = 0; s < 3000 && (k.bewegungen.length || k.unruhig || k.baeume.some(t => t.fall && !t.weg)); s++) animieren(k, 1 / 20, 4);
  k.bewegungen.length = 0;
}

/* ─────────────────────────────────────────────────── Standsicherheit ── */

/**
 * Überhang als Kragbalken: Moment M der überhängenden Zellen um die
 * Rückwand der Kehle, Biegespannung σ = 6M/H². Liefert σ/σ_zul.
 */
export function ueberhang(k: Kliff, W: number) {
  const g = geometrie(k);
  const r0 = Math.max(1, zeileVon(k, W - 0.5)), r1 = Math.min(k.nz - 2, zeileVon(k, W + 6));
  // Die Kehle zählt am festen Gestein — Schutt davor ist keine Wand
  const fels = (r: number) => {
    let c = g.front[r];
    while (c < k.nx && (k.mat[r * k.nx + c] === MAT.LUFT || LOSE(k.mat[r * k.nx + c]))) c++;
    return c;
  };
  let rN = -1, xn = -1;
  for (let r = r0; r <= r1; r++) { const f = fels(r); if (f < k.nx && f > xn) { xn = f; rN = r; } }
  if (rN < 0) return { verhaeltnis: 0, kehle: 0, xn: -1, rN: -1 };
  let M = 0, vorn = xn;
  for (let r = rN + 1; r < k.nz; r++) {
    const f = fels(r);
    if (f >= xn) continue;
    vorn = Math.min(vorn, f);
    for (let c = f; c < xn; c++) {
      const m = k.mat[r * k.nx + c];
      if (m === MAT.LUFT || LOSE(m)) continue;
      M += MATERIAL[m].gamma * k.dx * k.dx * (xn - c - 0.5) * k.dx;
    }
  }
  const kehle = (xn - vorn) * k.dx;
  const Hb = (g.top[xn] - rN) * k.dx;
  if (Hb < 1 || M <= 0) return { verhaeltnis: 0, kehle, xn, rN };
  let zug = 0, n = 0;
  for (let r = rN + 1; r <= g.top[xn]; r++) {
    const m = k.mat[r * k.nx + xn];
    if (m === MAT.LUFT) continue;
    zug += LOSE(m) ? 0 : MATERIAL[m].zug; n++;
  }
  zug = (n ? zug / n : 0) * (1 - 0.6 * k.risse) * (1 - 0.3 * k.saettigung);
  const sigma = (6 * M) / (Hb * Hb);
  return { verhaeltnis: zug > 0 ? sigma / zug : 9, kehle, xn, rN };
}

function sturzPruefen(k: Kliff, W: number) {
  const u = ueberhang(k, W);
  k.analyse.spannung = u.verhaeltnis;
  k.analyse.kehle = u.kehle;
  if (u.verhaeltnis < 1 || u.xn < 0) return false;
  const xc = Math.min(k.nx - 1, u.xn + Math.round((zufall(k) * 0.8) / k.dx));
  // Zusammenhängende feste Masse über der Kehle, seewärts des Risses
  const start = zelle(k, xc - 1, u.rN + 1);
  const zellen: number[] = [];
  const gesehen = new Uint8Array(k.mat.length);
  const stapel = [start];
  while (stapel.length) {
    const i = stapel.pop()!;
    if (gesehen[i]) continue;
    gesehen[i] = 1;
    const c = i % k.nx, r = (i - c) / k.nx;
    if (c >= xc || r <= u.rN || k.mat[i] === MAT.LUFT) continue;
    zellen.push(i);
    if (c > 0) stapel.push(i - 1);
    if (c < k.nx - 1) stapel.push(i + 1);
    if (r < k.nz - 1) stapel.push(i + k.nx);
    if (r > 0) stapel.push(i - k.nx);
  }
  if (zellen.length < 4) return false;
  const b = masseAus(k, zellen, "fall");
  b.omega = -(0.15 + zufall(k) * 0.25);
  b.vx = -0.3;
  k.risse *= 0.4;
  const vol = Math.round(b.volumen);
  if (b.volumen < 2) return true;
  melde(k, `Kliffabbruch: Der Überhang über der Hohlkehle (${(u.kehle).toFixed(1).replace(".", ",")} m tief) ist gebrochen — rund ${vol} m³ je Meter Küste stürzen ab.`, "warnung");
  if (!k.schutz.gesperrt) melde(k, "Ohne Absperrung hätten Menschen unter dem Kliff oder an der Kante stehen können!", "warnung");
  return true;
}

interface Flaeche { fs: number; art: "kreis" | "ebene" | "kluft"; zs: (x: number) => number; von: number; bis: number; cx?: number; cz?: number; rad?: number; tan?: number }

/** Grundwasserspiegel in Spalte c (m): steigt von der Wand landeinwärts an; über Ton gestaut */
function grundwasser(k: Kliff, c: number, W: number, ufer: number) {
  const g = k.cache;
  const oben = zVon(k, Math.max(0, g.top[c]));
  const weg = Math.max(0, (c - ufer) * k.dx);
  // Kreide staut, lässt aber wenig nachfließen; Mergel und Sand füllen sich stärker
  const f = k.typ === "kreide" ? 0.3 : k.typ === "moen" ? 0.45 : k.typ === "sand" ? 0.25 : 0.9;
  let z = W + k.saettigung * f * Math.min(oben - W, 25) * Math.min(1, Math.sqrt(weg / 40));
  if (g.ton[c] >= 0) z = Math.max(z, zVon(k, g.ton[c]) + k.saettigung * 3);
  return Math.min(z, oben);
}

/**
 * Wo tritt eine Gleitfläche an der Wand aus? Erste Spalte von See her, in
 * der sie über dem Wasser und unter Gestein liegt. Sie muss frei ausstreichen:
 * Liegt davor auf ihrer Höhe noch Fels, kann darauf nichts abgleiten (-1).
 */
function austritt(k: Kliff, e: Ebene, W: number) {
  const g = k.cache;
  for (let c = 0; c < k.nx; c++) {
    const z = (xVon(k, c) - e.x0) * e.tan;
    if (z > W - 1 && g.top[c] >= 0 && zVon(k, g.top[c]) > z) {
      return hart(k, xVon(k, c) - 1, z + 0.5) ? -1 : c;
    }
  }
  return -1;
}

/** Lamellenverfahren nach Fellenius für eine Gleitfläche z = zs(x) */
function fsFlaeche(k: Kliff, zs: (x: number) => number, von: number, bis: number, W: number, ufer: number, ebene?: Ebene) {
  const g = k.cache;
  const s = Math.max(1, Math.round(1 / k.dx)), b = s * k.dx;
  let zaehler = 0, nenner = 0, flaeche = 0, fels = 0, hatte = false;
  for (let c = Math.max(0, von); c <= Math.min(k.nx - 1, bis); c += s) {
    const x = xVon(k, c);
    const z = zs(x);
    const top = zVon(k, g.top[c]) + k.dx / 2;
    if (!(top > z)) { if (hatte && x > xVon(k, von) + 2) break; continue; }
    hatte = true;
    const r = Math.max(0, zeileVon(k, z));
    let gew = 0;
    for (let q = r + 1; q <= g.top[c]; q++) {
      const mq = k.mat[q * k.nx + c];
      gew += MATERIAL[mq].gamma;
      if (mq !== MAT.LUFT && !LOSE(mq)) fels += k.dx * b;
    }
    gew *= k.dx * b;
    flaeche += (top - z) * b;
    const alpha = Math.atan((zs(x + b / 2) - zs(x - b / 2)) / b);
    const l = b / Math.cos(alpha);
    let ci: number, phi: number;
    if (ebene) { ci = ebene.c * (1 - 0.4 * k.risse); phi = ebene.phi; }
    else {
      const m = k.mat[r * k.nx + c];
      const info = MATERIAL[m === MAT.SCHUTT ? MAT.SCHUTT : m];
      ci = (LOSE(m) ? 0 : info.c * k.festFaktor * (1 - 0.35 * k.risse)) * (k.gestoert[r * k.nx + c] ? 0.25 : 1);
      phi = LOSE(m) ? ruhe(k, r * k.nx + c) : info.phi;
    }
    const u = 9.81 * Math.max(0, grundwasser(k, c, W, ufer) - z);
    zaehler += ci * l + Math.max(0, gew * Math.cos(alpha) - u * l) * Math.tan((phi * Math.PI) / 180);
    nenner += gew * Math.sin(alpha);
  }
  // Überwiegend loser Schutt rieselt von selbst — das ist keine Rutschung.
  if (fels < 0.6 * flaeche) return { fs: 99, flaeche };
  return { fs: nenner > 1 ? zaehler / nenner : 99, flaeche };
}

/** Sucht die ungünstigste Gleitfläche; bei FS < 1 rutscht sie ab */
export function standsicherheit(k: Kliff, W: number, ausloesen = true): number {
  const g = geometrie(k);
  const rw = Math.max(0, zeileVon(k, W));
  const ufer = g.front[rw];
  if (ufer >= k.nx) return 99;
  const hoch = zVon(k, g.top[k.nx - 1]);
  let best: Flaeche | null = null;
  // Füße: am Wandfuß und auf halber Höhe
  const fuesse: [number, number][] = [];
  for (const q of [0, 0.2]) {
    const r = Math.min(k.nz - 1, rw + Math.round(((hoch - W) * q + 0.3) / k.dx));
    if (g.front[r] < k.nx) fuesse.push([xVon(k, g.front[r]) - k.dx, zVon(k, r)]);
  }
  // Kreide ist spröde: Sie rutscht nicht auf Kreisen, sondern bricht entlang
  // fast senkrechter Klüfte parallel zur Wand ab (wie am Königsstuhl).
  if (k.kluft) for (const q of [0, 0.2, 0.4]) {
    // Fuß der Kluft ist die Felswand selbst, nicht die Schutthalde davor
    const r = Math.min(k.nz - 1, rw + Math.round(((hoch - W) * q + 0.3) / k.dx));
    let c = 0;
    while (c < k.nx && (k.mat[r * k.nx + c] === MAT.LUFT || LOSE(k.mat[r * k.nx + c]))) c++;
    if (c >= k.nx) continue;
    const xt = xVon(k, c) - k.dx, zt = zVon(k, r);
    if (hoch - zt < 3) continue;
    // Fast senkrechte Klüfte: Es lösen sich dünne Wandscheiben
    for (const grad of [78, 83, 87]) {
      const tan = Math.tan((grad * Math.PI) / 180);
      const e: Ebene = { x0: xt - zt / tan, tan, c: k.kluft.c, phi: k.kluft.phi };
      const zs = (x: number) => (x - e.x0) * e.tan;
      const von = spalteVon(k, xt), bis = Math.min(k.nx - 1, spalteVon(k, e.x0 + hoch / tan) + 1);
      const { fs, flaeche } = fsFlaeche(k, zs, von, bis, W, ufer, e);
      if (flaeche < 4) continue;
      if (!best || fs < best.fs) best = { fs, art: "kluft", zs, von, bis, tan };
    }
  }
  // Gleitkreise: steil und tief, mit dem Fuß am Wandfuß oder knapp darüber
  else for (const [xt, zt] of fuesse) {
    const Hc = hoch - zt;
    if (Hc < 3) continue;
    for (const a of [-0.3, 0, 0.3, 0.6]) for (const bb of [0.5, 0.9, 1.4]) {
      const cx = xt + a * Hc, cz = zt + bb * Hc;
      const rad = Math.hypot(cx - xt, cz - zt);
      const zs = (x: number) => { const d = x - cx; return Math.abs(d) >= rad ? Infinity : cz - Math.sqrt(rad * rad - d * d); };
      const von = spalteVon(k, xt), bis = spalteVon(k, cx + rad);
      const { fs, flaeche } = fsFlaeche(k, zs, von, bis, W, ufer);
      if (flaeche < 4 || flaeche > 6000) continue;
      if (!best || fs < best.fs) best = { fs, art: "kreis", zs, von, bis, cx, cz, rad };
    }
  }
  for (const e of k.ebenen) {
    for (const hinten of [12, 22, 35]) {
      const zs = (x: number) => (x - e.x0) * e.tan;
      const von = austritt(k, e, W);
      if (von < 0) continue;
      const bis = Math.min(k.nx - 1, von + Math.round(hinten / k.dx));
      const { fs, flaeche } = fsFlaeche(k, zs, von, bis, W, ufer, e);
      if (flaeche < 4) continue;
      if (!best || fs < best.fs) best = { fs, art: "ebene", zs, von, bis, tan: e.tan };
    }
  }
  if (!best) return 99;
  k.analyse.fs = best.fs;
  k.analyse.fsArt = best.art;
  if (!ausloesen || best.fs >= 1) return best.fs;
  // Masse über der Gleitfläche
  const zellen: number[] = [];
  for (let c = Math.max(0, best.von); c <= Math.min(k.nx - 1, best.bis); c++) {
    const x = xVon(k, c), z = best.zs(x);
    if (!Number.isFinite(z)) continue;
    for (let r = Math.max(0, zeileVon(k, z) + 1); r <= g.top[c]; r++) {
      // Nur was im Gleitkreis liegt, dreht mit; darüber bleibt die Wand stehen
      if (best.art === "kreis" && Math.hypot(x - best.cx!, zVon(k, r) - best.cz!) >= best.rad!) break;
      const i = r * k.nx + c;
      if (k.mat[i] !== MAT.LUFT && k.mat[i] !== MAT.DECKWERK) zellen.push(i);
    }
  }
  if (zellen.length < 8) return best.fs;
  if (best.art === "kluft") {
    // Die Wand löst sich an der Kluft, kippt leicht vor und zerfällt beim
    // ersten Aufsetzen — der Schutt fließt als Schuttkegel ab.
    const b = masseAus(k, zellen, "fall");
    b.vx = -0.6; b.omega = 0.15;
    melde(k, `Abbruch: Eine Kreidewand von rund ${Math.round(b.volumen)} m³ je Meter löst sich an einer steilen Kluft und zerfällt zu einem Schuttkegel (Standsicherheit ${best.fs.toFixed(2).replace(".", ",")}).`, "warnung");
    k.saettigung *= 0.8;
    k.risse *= 0.5;
    if (!k.schutz.gesperrt) melde(k, "Kreideabbrüche kommen oft im Frühjahr nach Frost und Regen — Strand unter dem Kliff meiden!", "warnung");
    return best.fs;
  }
  const b = masseAus(k, zellen, best.art === "kreis" ? "rutsch" : "gleit");
  const vol = Math.round(b.volumen);
  if (best.art === "kreis") {
    b.pivX = best.cx!; b.pivZ = best.cz!;
    // Nach dem Bruch bleibt nur die Restreibung: je kleiner die Standsicherheit,
    // desto weiter rutscht die Scholle, bis die Reibung sie wieder hält.
    const neig = Math.max(0.05, (b.mx - b.pivX) / Math.max(1, b.pivZ - b.mz));
    b.reib = neig * Math.max(0.55, Math.min(0.95, best.fs));
    b.ausX = xVon(k, best.von);
    melde(k, `Rutschung: Eine Scholle von rund ${vol} m³ je Meter gleitet auf einer gekrümmten Fläche ab und kippt nach hinten (Standsicherheit ${best.fs.toFixed(2).replace(".", ",")}).`, "warnung");
  } else {
    const len = Math.hypot(1, best.tan!);
    b.dirX = -1 / len; b.dirZ = -best.tan! / len;
    b.reib = best.tan! * Math.max(0.55, Math.min(0.95, best.fs));
    b.ausX = xVon(k, best.von);
    melde(k, `Gleitung: Eine Kreidescholle von rund ${vol} m³ je Meter rutscht auf einer alten Überschiebungsfläche ins Meer — wie 2007 an der Store Taler auf Møn (Standsicherheit ${best.fs.toFixed(2).replace(".", ",")}).`, "warnung");
  }
  k.saettigung *= 0.8;
  k.risse *= 0.5;
  if (!k.schutz.gesperrt) melde(k, "Rutschungen kommen nach langem Regen oft ohne Vorwarnung — Kliffwege sperren!", "warnung");
  return best.fs;
}

/**
 * Die Scherfestigkeit alter Überschiebungsflächen kennt niemand genau.
 * Sie wird so gewählt, dass das heutige Kliff bei mittlerem Grundwasser
 * gerade eben steht (Standsicherheit `ziel`) — so wie es in der Natur ist.
 */
function ebenenEichen(k: Kliff, ziel: number) {
  const kreise = k.ebenen;
  const sat = k.saettigung, risse = k.risse;
  // Wie die Klüfte bei voller Nässe: Die großen Gleitungen brauchen dazu
  // noch Frostrisse oder einen untergrabenen Fuß.
  k.saettigung = 1; k.risse = 0.15;
  let lo = 50, hi = 3000;
  const nur = () => {
    const alle = k.ebenen;
    k.ebenen = kreise;
    const fs = ebenenFs(k);
    k.ebenen = alle;
    return fs;
  };
  for (let s = 0; s < 30; s++) {
    const m = (lo + hi) / 2;
    for (const e of k.ebenen) e.c = m;
    if (nur() < ziel) lo = m; else hi = m;
  }
  for (const e of k.ebenen) e.c = hi;
  k.saettigung = sat; k.risse = risse;
}

/** Wie ebenenEichen, für Gleitkreise: das Kliff steht heute — also ist es so fest */
function kreiseEichen(k: Kliff, ziel: number) {
  const sat = k.saettigung, risse = k.risse, ebenen = k.ebenen;
  k.saettigung = 0.75; k.risse = 0.15; k.ebenen = [];
  let lo = 0.2, hi = 6;
  for (let s = 0; s < 24; s++) {
    const m = (lo + hi) / 2;
    k.festFaktor = m;
    if (standsicherheit(k, 0, false) < ziel) lo = m; else hi = m;
  }
  k.festFaktor = Math.max(1, hi);
  k.saettigung = sat; k.risse = risse; k.ebenen = ebenen;
  k.analyse.fs = standsicherheit(k, 0, false);
}

/**
 * Wie kreiseEichen, für die Klüfte der Kreide — aber bei voller Nässe: Die
 * steilen Wände stehen am Jasmund jahrelang. Abbrechen sollen sie erst, wenn
 * Frost die Klüfte öffnet (Risse) oder die Hohlkehle sie untergräbt.
 */
function kluftEichen(k: Kliff, ziel: number) {
  const sat = k.saettigung, risse = k.risse, ebenen = k.ebenen;
  k.saettigung = 1; k.risse = 0.15; k.ebenen = [];
  k.kluft = { c: 0, phi: 35 };
  let lo = 0, hi = 2000;
  for (let s = 0; s < 30; s++) {
    k.kluft.c = (lo + hi) / 2;
    if (standsicherheit(k, 0, false) < ziel) lo = k.kluft.c; else hi = k.kluft.c;
  }
  k.kluft.c = hi;
  k.saettigung = sat; k.risse = risse; k.ebenen = ebenen;
  k.analyse.fs = standsicherheit(k, 0, false);
}

function ebenenFs(k: Kliff) {
  const g = geometrie(k);
  const W = 0, ufer = g.front[Math.max(0, zeileVon(k, W))];
  let min = 99;
  for (const e of k.ebenen) for (const hinten of [12, 22, 35]) {
    const zs = (x: number) => (x - e.x0) * e.tan;
    const von = austritt(k, e, W);
    if (von < 0) continue;
    const { fs, flaeche } = fsFlaeche(k, zs, von, Math.min(k.nx - 1, von + Math.round(hinten / k.dx)), W, ufer, e);
    if (flaeche >= 4) min = Math.min(min, fs);
  }
  return min;
}

/** Feste Zellen ohne Verbindung zum Grund stürzen ab */
function verbindungPruefen(k: Kliff) {
  const { nx, nz, mat } = k;
  const n = nx * nz;
  const halt = new Uint8Array(n);
  const stapel: number[] = [];
  for (let c = 0; c < nx; c++) if (mat[c] !== MAT.LUFT) { halt[c] = 1; stapel.push(c); }
  // Gewachsener Fels hält in alle Richtungen. Verrutschtes Gestein (gestört)
  // ist zerrüttet und trägt nur, wenn es aufliegt — es hängt nicht seitlich
  // an der Wand. Schutt trägt, was auf ihm liegt.
  while (stapel.length) {
    const i = stapel.pop()!;
    const c = i % nx;
    const lose = LOSE(mat[i]);
    const nb = [i + nx, i - nx, c > 0 ? i - 1 : -1, c < nx - 1 ? i + 1 : -1];
    for (let q = 0; q < 4; q++) {
      const j = nb[q];
      if (j < 0 || j >= n || halt[j]) continue;
      const m = mat[j];
      if (m === MAT.LUFT) continue;
      const aufliegen = q === 0;
      if (!aufliegen && (lose || LOSE(m) || k.gestoert[j])) continue;
      halt[j] = 1; stapel.push(j);
    }
  }
  // Lose Zellen hängen am Grund, wenn sie auf etwas liegen — die rieseln ohnehin.
  const gesehen = new Uint8Array(n);
  for (let i = nx; i < n; i++) {
    const m = mat[i];
    if (m === MAT.LUFT || LOSE(m) || halt[i] || gesehen[i]) continue;
    const teil: number[] = [];
    const st = [i];
    while (st.length) {
      const q = st.pop()!;
      if (gesehen[q]) continue;
      gesehen[q] = 1;
      const mm = mat[q];
      if (mm === MAT.LUFT || LOSE(mm) || halt[q]) continue;
      teil.push(q);
      const c = q % nx;
      st.push(q + nx, q - nx);
      if (c > 0) st.push(q - 1);
      if (c < nx - 1) st.push(q + 1);
    }
    if (teil.length < 12) { for (const q of teil) { k.herk[q] = mat[q]; mat[q] = MAT.SCHUTT; aendern(k, q); } }
    else {
      const b = masseAus(k, teil, "fall");
      b.omega = -(0.1 + zufall(k) * 0.3);
      if (b.volumen > 3) melde(k, `Ein losgelöster Block von rund ${Math.round(b.volumen)} m³ je Meter stürzt ab.`, "warnung");
    }
  }
  k.pruefen = false;
}

/** Bäume und Objekte ohne Boden kippen um */
function haltPruefen(k: Kliff, W: number, dt: number) {
  const g = geometrie(k);
  baeumePruefen(k, W, dt);
  for (const o of k.objekte) {
    if (o.zerstoert) continue;
    if (g.top[o.c] < o.r - Math.round(1 / k.dx)) {
      o.zerstoert = "abgestürzt";
      k.schadenEuro += o.art === "haus" ? 3 : o.art === "aussicht" ? 2 : 0.2;
      melde(k, `${o.name} ist abgestürzt.`, "schaden");
    } else {
      const kante = kliffKante(k);
      if (xVon(k, o.c) - kante < 6 && !k.merker["nah-" + o.id]) {
        k.merker["nah-" + o.id] = true;
        melde(k, `${o.name} steht nur noch ${Math.max(0, Math.round(xVon(k, o.c) - kante))} m von der Kante entfernt.`, "warnung");
      }
    }
  }
}

/* ─────────────────────────────────────────────────────────────── Zeit ── */

export function kSturmflut(k: Kliff, staerke = 1) {
  const hoehe = k.stauMax * staerke;
  k.flut = { rest: 30, dauer: 30, hoehe };
  melde(k, `Sturmflut! Der Sturm drückt das Wasser bis zu ${hoehe.toFixed(1).replace(".", ",")} m über das normale Niveau.`, "warnung");
}

/**
 * Eine Zeitspanne (h) Küste. Bei laufender Bewegung passiert nichts —
 * erst `animieren` bzw. `abschliessen`.
 */
export function kSchritt(k: Kliff, w: Wetter, dt = 1) {
  if (k.bewegungen.length) return;
  const W = kWasser(k, w);
  k.wasser = W;
  const H0 = kWelle(k, w);
  const wl = kWellen(k, W, H0);
  brandung(k, W, H0, wl, dt);
  wetterWirkt(k, w, W, dt);
  if (k.unruhig) for (let d = 0; d < 3 && k.unruhig; d++) if (rieseln(k, 0.25) === 0) k.unruhig = false;
  k.seitVerbindung += dt;
  if (k.pruefen && k.seitVerbindung >= 24) { k.seitVerbindung = 0; verbindungPruefen(k); }
  if (!k.bewegungen.length) sturzPruefen(k, W);
  k.seitStabil += dt;
  if (!k.bewegungen.length && (k.seitStabil >= 48 || Math.abs(k.saettigung - k.satGeprueft) > 0.08)) {
    k.seitStabil = 0;
    k.satGeprueft = k.saettigung;
    standsicherheit(k, W);
  }
  haltPruefen(k, W, dt);
  k.stunde += dt;
  if (k.flut) { k.flut.rest -= dt; if (k.flut.rest <= 0) k.flut = null; }
}

/** Monat 0–11 (Start 1.1.2026) */
const monat = (h: number) => Math.floor(((h / 24) % 365.25) / 30.44) % 12;

/** Wetter im Jahreslauf (wie beim Profil, mit eigener Sturmflut) */
export function kNaechstesWetter(k: Kliff): { wetter: Wetter; bisStunde: number } {
  const m = monat(k.stunde);
  const winter = m <= 2 || m >= 9;
  const r = () => zufall(k);
  if (winter && r() < 0.025) {
    const bft = 8 + Math.floor(r() * 3);
    if (r() < 0.3) kSturmflut(k, 0.3 + 0.7 * r() ** 3);
    else if (bft >= 10) melde(k, `Schwerer Sturm mit Windstärke ${bft}.`);
    return { wetter: { bft, auflandig: true, regen: r() < 0.6, frost: false }, bisStunde: k.stunde + 12 + r() * 24 };
  }
  // Dauerregen-Phasen im Spätherbst und Winter machen die Hänge nass
  const dauerregen = winter && r() < 0.08;
  const g = (r() + r() + r() - 1.5) * 2.4;
  return {
    wetter: {
      bft: Math.max(0, Math.min(7, Math.round((winter ? 4.6 : 3.3) + g))),
      auflandig: r() < 0.6,
      regen: dauerregen || r() < (winter ? 0.4 : 0.22),
      frost: (m <= 1 || m === 11) && r() < 0.45,
    },
    bisStunde: k.stunde + (dauerregen ? 48 + r() * 72 : 6 + r() * 18),
  };
}

/* ─────────────────────────────────────────────────────────── Schutz ── */

export type KliffMassnahmeId = "deckwerk" | "wellenbrecher" | "vorspuelen" | "drainage" | "bepflanzen" | "zurueck" | "sperren";

export const KLIFF_MASSNAHMEN: { id: KliffMassnahmeId; icon: string; name: string; kosten: number; typen: KliffTyp[]; was: string; plus: string; minus: string }[] = [
  { id: "sperren", icon: "🚧", name: "Kliffweg sperren", kosten: 0.01, typen: ["kreide", "moen", "mergel", "sand"],
    was: "Wege an der Kante und am Fuß werden gesperrt, Schilder warnen.",
    plus: "Schützt Menschen — Abbrüche und Rutschungen kommen ohne Vorwarnung.", minus: "Schützt das Kliff nicht." },
  { id: "zurueck", icon: "🚚", name: "Zurückweichen", kosten: 2, typen: ["kreide", "moen", "mergel", "sand"],
    was: "Wege, Aussichtspunkte und Häuser nah an der Kante werden weiter landeinwärts neu gebaut.",
    plus: "Das Kliff bleibt natürlich und liefert weiter Sand für die Nachbarstrände.", minus: "Land geht verloren." },
  { id: "drainage", icon: "💧", name: "Hangentwässerung", kosten: 2, typen: ["mergel", "moen", "sand"],
    was: "Drainagerohre leiten das Grundwasser ab, bevor es an der Wand austritt.",
    plus: "Weniger Porenwasserdruck: die Standsicherheit steigt, Rutschungen werden seltener.", minus: "Gegen die Brandung hilft es nicht; die Rohre müssen gewartet werden." },
  { id: "bepflanzen", icon: "🌿", name: "Hang bepflanzen", kosten: 0.1, typen: ["mergel", "sand"],
    was: "Gräser und Sträucher auf flacheren Hangteilen.",
    plus: "Wurzeln halten den Boden, Regen spült weniger ab.", minus: "Auf senkrechten Wänden wächst nichts; gegen Wellen nutzlos." },
  { id: "vorspuelen", icon: "🚢", name: "Sand vorspülen", kosten: 1, typen: ["sand", "mergel"],
    was: "Vor dem Kliff wird ein Sanddepot aufgespült (wie vor dem Roten Kliff auf Sylt).",
    plus: "Die Wellen fressen erst den Sand, dann das Kliff.", minus: "Hält nur ein paar Jahre, dann muss neu gespült werden." },
  { id: "wellenbrecher", icon: "🪨", name: "Wellenbrecher", kosten: 8, typen: ["kreide", "moen", "mergel", "sand"],
    was: "Ein Damm aus großen Steinen vor der Küste, knapp unter dem Wasserspiegel.",
    plus: "Die Wellen brechen schon dort und kommen schwächer an.", minus: "Teuer, verändert den Meeresgrund; der Sand fehlt dann weiter hinten." },
  { id: "deckwerk", icon: "🧱", name: "Deckwerk am Kliffuß", kosten: 12, typen: ["kreide", "moen", "mergel", "sand"],
    was: "Ein Panzer aus Steinen am Fuß des Kliffs.",
    plus: "Keine Hohlkehle mehr: die Brandung erreicht die Wand nicht.", minus: "Frost, Regen und Rutschungen arbeiten weiter. Das Kliff liefert keinen Sand mehr — die Strände daneben schrumpfen. In Naturschutzgebieten wie Jasmund und Møn verboten." },
];

export function kMassnahme(k: Kliff, id: KliffMassnahmeId) {
  const m = KLIFF_MASSNAHMEN.find(x => x.id === id)!;
  const g = geometrie(k);
  const W0 = 0;
  const rw = Math.max(0, zeileVon(k, W0));
  const fuss = g.front[rw];
  let text = "";
  let kosten = m.kosten;
  const setzen = (c: number, r: number, mm: number, herk = mm) => {
    if (c < 0 || c >= k.nx || r < 0 || r >= k.nz) return;
    const i = r * k.nx + c;
    k.mat[i] = mm; k.herk[i] = herk; k.schaden[i] = 0; k.gestoert[i] = 0;
  };
  switch (id) {
    case "deckwerk": {
      const hoehe = k.hub / 2 + 3;
      for (let c = fuss - Math.round(4 / k.dx); c < fuss + 2; c++) {
        const oben = Math.min(hoehe, (c - (fuss - 4 / k.dx)) * k.dx * 1.2 + (k.hub / 2 - 1));
        for (let r = 0; r < k.nz && zVon(k, r) <= oben; r++) {
          const i = r * k.nx + c;
          if (c >= 0 && c < k.nx && (k.mat[i] === MAT.LUFT || LOSE(k.mat[i]))) setzen(c, r, MAT.DECKWERK);
        }
      }
      text = "Deckwerk aus Steinen am Kliffuß gebaut.";
      break;
    }
    case "wellenbrecher": {
      const mitte = fuss - Math.round(28 / k.dx);
      const krone = -0.2 + k.hub / 2;
      for (let c = mitte - Math.round(5 / k.dx); c <= mitte + Math.round(5 / k.dx); c++) {
        const oben = krone - Math.abs(c - mitte) * k.dx * 0.35;
        for (let r = 0; r < k.nz && zVon(k, r) <= oben; r++) if (c >= 0 && k.mat[r * k.nx + c] !== MAT.DECKWERK) setzen(c, r, MAT.DECKWERK);
      }
      text = "Wellenbrecher knapp unter dem Wasserspiegel gebaut.";
      break;
    }
    case "vorspuelen": {
      for (let c = fuss - Math.round(18 / k.dx); c < fuss + 4; c++) {
        const oben = k.hub / 2 + 2.5 - Math.max(0, fuss - c) * k.dx * 0.18;
        for (let r = 0; r < k.nz && zVon(k, r) <= oben; r++) if (c >= 0 && k.mat[r * k.nx + c] === MAT.LUFT) setzen(c, r, MAT.SCHUTT, MAT.SAND);
      }
      k.unruhig = true;
      text = "Sanddepot vor dem Kliff aufgespült.";
      break;
    }
    case "drainage": k.schutz.drainage = true; k.saettigung = Math.min(k.saettigung, 0.45); text = "Drainage eingebaut: das Grundwasser steigt nicht mehr so hoch."; break;
    case "bepflanzen": {
      let n = 0;
      for (let c = 1; c < k.nx - 1; c++) {
        const steil = Math.abs(g.top[c + 1] - g.top[c - 1]) * k.dx / 2;
        if (g.top[c] > rw && steil < 1.3 && !k.bewuchs[c]) { k.bewuchs[c] = 1; n++; }
      }
      k.schutz.bepflanzt = true;
      text = n ? `Hang auf ${Math.round(n * k.dx)} m bepflanzt.` : "Hier ist nichts flach genug zum Bepflanzen.";
      break;
    }
    case "zurueck": {
      const kante = kliffKante(k);
      const nah = k.objekte.filter(o => !o.zerstoert && xVon(k, o.c) - kante < 20);
      if (!nah.length) return { ok: false, text: "Nichts steht gerade gefährlich nah an der Kante." };
      for (const o of nah) { o.c = Math.min(k.nx - 2, o.c + Math.round(20 / k.dx)); o.r = g.top[o.c]; }
      kosten = m.kosten * nah.length;
      text = `Zurückverlegt: ${nah.map(o => o.name).join(", ")}.`;
      break;
    }
    case "sperren": k.schutz.gesperrt = true; text = "Kliffweg und Strand am Kliffuß gesperrt."; break;
  }
  aendern(k);
  k.kosten += kosten;
  melde(k, `${m.icon} ${text}`, "gut");
  return { ok: true, text };
}

/* ─────────────────────────────────────────────────────────── Begriffe ── */

export interface KBegriff { id: string; name: string; x: number; z: number; text: string; rx: number; rz: number; zx?: number; zz?: number }

const KT: Record<string, string> = {
  kliff: "Das Kliff: die steile Wand, an der Brandung, Frost, Regen und Grundwasser arbeiten.",
  kante: "Die Abbruchkante oben: Hier bricht das Kliff ab. Abstand halten — sie kann unterhöhlt sein!",
  kehle: "Die Brandungshohlkehle: Die Wellen schlagen immer auf derselben Höhe an und fressen eine Kerbe in den Fuß.",
  ueberhang: "Der Überhang: Über der Kehle hängt die Wand frei. Sein Gewicht zieht an der Wand — wird die Spannung zu groß, bricht er ab.",
  halde: "Die Kliffhalde: abgestürztes Material am Fuß. Sie schützt das Kliff, bis das Meer sie abgeräumt hat.",
  block: "Der Blockstrand: Feuersteine und Findlinge bleiben liegen, wenn das Meer das Feine fortspült.",
  plattform: "Die Abrasionsplattform: der flach abgeschliffene Untergrund, über den das Kliff früher reichte.",
  scholle: "Eine abgerutschte Scholle: Sie ist als Ganzes abgeglitten und dabei nach hinten gekippt — die Schichten stehen jetzt schräg.",
  nische: "Die Abrissnische: die steile Wand, an der sich die Rutschmasse gelöst hat.",
  quelle: "Der Quellhorizont: Über der wasserundurchlässigen Tonschicht tritt Grundwasser aus und spült die Wand von innen aus.",
  schlamm: "Ein Schlammstrom: Nasser Ton- und Mergelschutt fließt wie Brei flach aus.",
  deckwerk: "Das Deckwerk: ein Panzer aus Steinen gegen die Brandung.",
  mw: "Mittelwasser — an der Ostsee gibt es kaum Gezeiten.",
  mhw: "Mittlere Hochwasserlinie.",
  mnw: "Mittlere Niedrigwasserlinie.",
};

const SCHICHT_TEXT: Record<number, string> = {
  [MAT.KREIDE]: "Kreide: vor rund 70 Millionen Jahren aus winzigen Kalkschalen am Meeresgrund entstanden. Weich, aber standfest — und frostempfindlich.",
  [MAT.FEUER]: "Feuersteinband: harte Knollen aus Kieselsäure in der Kreide. Sie bleiben am Strand als Feuersteine liegen.",
  [MAT.MERGEL]: "Geschiebemergel: vom Eis zurückgelassenes Gemisch aus Ton, Sand und Steinen (Findlingen).",
  [MAT.TON]: "Ton: undurchlässig und glitschig, wenn er nass ist — eine Gleitschicht für Rutschungen.",
  [MAT.SAND]: "Sand (am Roten Kliff: weißer Kaolinsand): locker, rieselt ab und wird vom Wind verweht.",
  [MAT.LIMONIT]: "Limonitsandstein: durch Eisen rot verkitteter Sand — härter als der Sand darunter.",
  [MAT.LEHM]: "Geschiebelehm: verwitterter Geschiebemergel, durch Eisenoxid rotbraun gefärbt.",
};

export function kBegriffe(k: Kliff, W: number): KBegriff[] {
  const g = geometrie(k);
  const out: KBegriff[] = [];
  const b = (id: string, name: string, x: number, z: number, rx: number, rz: number, text = KT[id]) => out.push({ id, name, x, z, text, rx: Math.max(1.5, rx), rz: Math.max(0.5, rz) });
  if (k.hub < 0.5) b("mw", "Mittelwasser", 4, 0, 300, 0.4);
  else { b("mhw", "MHW", 4, k.hub / 2, 300, 0.35); b("mnw", "MNW", 4, -k.hub / 2, 300, 0.35); }
  const kante = kliffKante(k);
  const kc = spalteVon(k, kante);
  const rw = Math.max(0, zeileVon(k, W));
  // Abbruchkante: der ganze obere Teil der Wand samt Rand der Hochfläche
  const hKliff = Math.max(4, zVon(k, g.top[kc]) - W);
  b("kante", "Abbruchkante", kante + 1, zVon(k, g.top[kc]) - hKliff * 0.1, Math.max(6, hKliff * 0.18), hKliff * 0.2);
  const u = ueberhang(k, W);
  if (u.xn >= 0) {
    if (u.kehle > 0.3) b("kehle", "Brandungshohlkehle", xVon(k, u.xn) - Math.min(u.kehle, 2) / 2, zVon(k, u.rN), Math.max(1.5, u.kehle / 2 + 0.5), 1);
    if (u.kehle > 0.8) {
      const rr = Math.min(k.nz - 1, u.rN + Math.round(1.5 / k.dx));
      b("ueberhang", "Überhang", xVon(k, g.front[rr]) + u.kehle / 2, zVon(k, rr), Math.max(2, u.kehle / 2 + 0.5), 2);
    }
  }
  // Kliff: Mitte der Wand
  const rm = Math.round((rw + g.top[kc]) / 2);
  if (g.front[rm] < k.nx) {
    const unten = g.front[Math.min(k.nz - 1, rw + 2)], oben = g.front[g.top[kc]];
    const breite = Math.abs(xVon(k, Math.min(oben, k.nx - 1)) - xVon(k, Math.min(unten, k.nx - 1))) / 2 + 3;
    b("kliff", "Kliff", xVon(k, g.front[rm]) + 2, zVon(k, rm), breite, (zVon(k, g.top[kc]) - W) / 2);
  }
  // Schichten an der Wand. Die Zone umfasst die ganze sichtbare Fläche der
  // Schicht (bis 25 m hinter die Wand) — bei der Kreide also alles Weiße.
  // Feuersteinbänder und Ton sind schmale Bänder: dort gilt das Band am Schild.
  const box = new Map<number, { x0: number; x1: number; z0: number; z1: number }>();
  const tiefe = Math.round(25 / k.dx);
  for (let r = rw + 1; r <= g.top[kc]; r++) {
    const f = g.front[r];
    if (f >= k.nx) continue;
    for (let c = f; c < Math.min(k.nx, f + tiefe); c++) {
      const i = r * k.nx + c;
      let m = k.mat[i];
      if (m === MAT.LUFT || k.gestoert[i]) continue;
      if (m === MAT.FEUER) m = MAT.KREIDE;
      if (!SCHICHT_TEXT[m]) continue;
      const x = xVon(k, c), z = zVon(k, r);
      const q = box.get(m);
      if (!q) box.set(m, { x0: x, x1: x, z0: z, z1: z });
      else { q.x0 = Math.min(q.x0, x); q.x1 = Math.max(q.x1, x); q.z0 = Math.min(q.z0, z); q.z1 = Math.max(q.z1, z); }
    }
  }
  const gesehen = new Set<number>();
  for (let r = g.top[kc]; r > rw; r -= Math.max(1, Math.round(0.5 / k.dx))) {
    const c = g.front[r];
    if (c >= k.nx) continue;
    const m = k.mat[r * k.nx + c];
    if (SCHICHT_TEXT[m] && !gesehen.has(m) && !k.gestoert[r * k.nx + c]) {
      gesehen.add(m);
      const name = m === MAT.SAND && k.typ === "sand" ? "Kaolinsand" : m === MAT.TON ? "Ton (Gleitschicht)" : MATERIAL[m].name;
      const q = box.get(m);
      if (q && m !== MAT.FEUER && m !== MAT.TON) {
        // Das Oval etwas größer als die halbe Box, damit es die Ecken besser deckt
        out.push({ id: "s" + m, name, x: xVon(k, c) + 1.5, z: zVon(k, r), text: SCHICHT_TEXT[m],
          zx: (q.x0 + q.x1) / 2, zz: (q.z0 + q.z1) / 2,
          rx: Math.max(3, ((q.x1 - q.x0) / 2) * 1.15), rz: Math.max(1, ((q.z1 - q.z0) / 2) * 1.15) });
      } else {
        out.push({ id: "s" + m, name, x: xVon(k, c) + 3, z: zVon(k, r), text: SCHICHT_TEXT[m], rx: 5, rz: 0.7 });
      }
    }
  }
  // Halde, Blockstrand, Schlamm, Scholle
  let halde = -1, hh = 1.2;
  let block = -1, schlamm = -1, scholle = -1;
  for (let c = 0; c < k.nx; c++) {
    const r = g.top[c];
    if (r < 0) continue;
    const i = r * k.nx + c;
    const m = k.mat[i];
    if (m === MAT.SCHUTT) {
      let d = 0;
      while (r - d >= 0 && k.mat[(r - d) * k.nx + c] === MAT.SCHUTT) d++;
      if (d * k.dx > hh && zVon(k, r) > W) { hh = d * k.dx; halde = c; }
      if ((k.herk[i] === MAT.TON || k.herk[i] === MAT.MERGEL) && k.saettigung > 0.6 && zVon(k, r) > W && zVon(k, r) < W + 4) schlamm = c;
    }
    if (m === MAT.BLOCK && block < 0 && Math.abs(zVon(k, r) - W) < 1.2 && c > g.front[rw] - Math.round(15 / k.dx)) block = c;
    if (k.gestoert[i] && scholle < 0 && zVon(k, r) > W + 2) scholle = c;
  }
  if (halde >= 0) b("halde", "Kliffhalde", xVon(k, halde), zVon(k, g.top[halde]) - hh / 2, 6, hh / 2 + 0.5);
  if (block >= 0) b("block", "Blockstrand", xVon(k, block), zVon(k, g.top[block]), 6, 0.9);
  if (schlamm >= 0) b("schlamm", "Schlammstrom", xVon(k, schlamm), zVon(k, g.top[schlamm]), 6, 1.2);
  if (scholle >= 0) {
    b("scholle", "abgerutschte Scholle", xVon(k, scholle) + 4, zVon(k, g.top[scholle]) - 4, 9, 6);
    // Abrissnische: erste ungestörte, hohe Spalte landwärts der Scholle
    let c = scholle;
    while (c < k.nx - 1 && (k.gestoert[g.top[c] * k.nx + c] || g.top[c] < g.top[k.nx - 1] - Math.round(4 / k.dx))) c++;
    if (c < k.nx - 1) b("nische", "Abrissnische", xVon(k, c), zVon(k, g.top[c]) - 2, 3, 4);
  }
  // Abrasionsplattform: flacher Fels knapp unter Wasser vor dem Kliff
  const u0 = g.front[rw];
  let pa = -1, pe = -1;
  for (let c = Math.max(0, u0 - Math.round(40 / k.dx)); c < u0; c++) {
    const r = g.top[c];
    if (r < 0) continue;
    const m = k.mat[r * k.nx + c];
    const z = zVon(k, r);
    if (!LOSE(m) && m !== MAT.DECKWERK && z > W - 3 && z < W) { if (pa < 0) pa = c; pe = c; }
  }
  if (pa >= 0 && (pe - pa) * k.dx > 6) b("plattform", "Abrasionsplattform", xVon(k, (pa + pe) >> 1), zVon(k, g.top[(pa + pe) >> 1]), ((pe - pa) * k.dx) / 2, 1);
  if (k.saettigung > 0.4) {
    for (let r = g.top[kc]; r > rw; r--) {
      const c = g.front[r];
      if (c >= k.nx || r < 2) continue;
      if (k.mat[(r - 1) * k.nx + c] === MAT.TON || k.mat[(r - 2) * k.nx + c] === MAT.TON) { b("quelle", "Quellhorizont", xVon(k, c), zVon(k, r), 3, 0.8); break; }
    }
  }
  if (k.mat.some(m => m === MAT.DECKWERK)) {
    const c = g.front[rw];
    if (c < k.nx) b("deckwerk", "Deckwerk", xVon(k, c) - 2, W, 3, 2);
  }
  return out;
}
