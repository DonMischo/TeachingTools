/**
 * Karten für die freie 3D-Ansicht des TaskCrawlers — gewachsen mit der
 * Regelmaschine (Regel-Labor), aber weiter und luftiger als die Flure des
 * Gebäudes:
 *
 *  1. Auf einem groben Raster wächst ein Punktgitter (`IBB=IBI`).
 *  2. Plätze (5×5) werden aufs Gitter gestempelt: je Station einer, dazu
 *     Ankunft und Ausgang.
 *  3. Ein Backtracker gräbt Wege zwischen den Plätzen, einige Wände fallen
 *     (Rundwege), jeder Platz bekommt einen Durchgang, Sackgassen verschwinden.
 *  4. Das grobe Raster wird gestreckt: Wege und Plätze dreimal so breit wie
 *     die Wände dazwischen.
 *  5. Wald und Höhle: die Ränder werden angenagt und geglättet (Zellautomat),
 *     damit nichts mehr nach Raster aussieht.
 *
 * Reine Rechnung ohne Zeichnen — dazu Bewegung (Kreis gegen Felder), Wegsuche
 * und »wo stehe ich?«.
 */
import { laufeDurch, programm, starte } from "@/lib/regeln/maschine";
import { lichtungsEbene, type Bruecke } from "./lichtung";
import type { Punkt } from "./plan";

/** Kantenlänge eines Feldes in Welteinheiten */
export const ZELLE = 1.4;
/** grobes Raster → Felder: Wege/Plätze so viele Felder breit, Wände eines */
const WEIT = 3;

export const WAND = 0, WEG = 1, PLATZ = 2, DURCHGANG = 3;

export interface FreiRaum {
  /** Feld in der Mitte des Platzes */
  x: number;
  y: number;
  /** halbe Kantenlänge in Feldern */
  r: number;
}

export interface FreiEbene {
  b: number;
  h: number;
  /** je Feld: WAND, WEG, PLATZ oder DURCHGANG */
  art: Uint8Array;
  /** Platz der Ankunft */
  start: Punkt;
  /** Platz mit Treppe, Tor bzw. Ausgang */
  ziel: Punkt;
  /** die Stationen, nach Entfernung von der Ankunft */
  raeume: FreiRaum[];
  /** Bachfelder (1 = Wasser; nicht begehbar außer unter einer Brücke) — nur Lichtungskarten mit Bach */
  wasser?: Uint8Array;
  /** Brücken über den Bach */
  bruecken?: Bruecke[];
}

/**
 * Wie eine Karte entsteht:
 *  raster   Punktgitter, Plätze, Backtracker-Gänge (Gebäude, Garten)
 *  genagt   dasselbe mit angenagten Rändern (Höhle)
 *  lichtung Lichtungen mit geschwungenen Pfaden und Rundwegen (lichtung.ts; Wälder)
 *  bach     wie lichtung, dazu ein Bach mit Brücken (Pilzwald)
 */
export type KartenArt = "raster" | "genagt" | "lichtung" | "bach";

export interface FreiPlan { ebenen: FreiEbene[] }

const PLATZ_STEMPEL =
  "BBBBBBB/BIBIBIB/BBBBBBB/BIBIBIB/BBBBBBB/BIBIBIB/BBBBBBB=DDDDDDD/DUVUVUD/DVVVVVD/DUVUVUD/DVVVVVD/DUVUVUD/DDDDDDD";

/** Das Programm für ein grobes Raster mit `plaetze` Plätzen und `luecken` zusätzlichen Durchbrüchen */
export function freiRegeln(plaetze: number, luecken: number): string {
  return [
    "# Punktgitter: jedes zweite Feld",
    "alle: IBB=IBI",
    "# Plätze aufs Gitter stempeln (Wände erst grau, damit niemand hindurchgräbt)",
    `eins x${plaetze}: ${PLATZ_STEMPEL}`,
    "# Wege graben (Backtracker), nur von Gitterpunkt zu Gitterpunkt",
    "eins x1: I=R",
    "markov: RBI=GGR, RGG=WWR",
    "alle: R=W",
    "alle: I=B",
    "alle: D=B",
    "# Rundwege: einige Wände zwischen den Wegen fallen",
    `eins x${luecken}: WBW=WWW`,
    "# jeder Platz bekommt genau einen Durchgang; ist er angeschlossen, färbt er sich gelb",
    "markov: YU=YY | YV=YY, UBW=YOW",
    "# Sackgassen weg",
    "alle: *B*/BWB/*W*=*B*/BBB/*W*",
  ].join("\n");
}

/** Wald und Höhle: Ränder annagen und glätten, dazu Einzelgänger im Weg (Plätze `P` bleiben frei) */
export const NAGE_REGELN = [
  "alle x1 p22: WB=WA",
  "alle: A=W",
  "nachbarn x1: B=W bei 7-8 W",
  "# einzelne Bäume bzw. Felssäulen mitten im Weg: nie zwei nebeneinander, man kommt immer herum",
  "alle x1 p14: WWW/WWW/WWW=***/*B*/***",
].join("\n");

const NACHBARN: Punkt[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function istFrei(e: FreiEbene, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < e.b && y < e.h && e.art[y * e.b + x] !== WAND;
}

/** Abstände (in Feldern) von `von` zu allen freien Feldern; −1 = unerreichbar */
export function freiAbstaende(e: FreiEbene, von: Punkt): Int32Array {
  const d = new Int32Array(e.b * e.h).fill(-1);
  if (!istFrei(e, von[0], von[1])) return d;
  d[von[1] * e.b + von[0]] = 0;
  const schlange = [von[1] * e.b + von[0]];
  for (let k = 0; k < schlange.length; k++) {
    const i = schlange[k], x = i % e.b, y = (i - x) / e.b;
    for (const [dx, dy] of NACHBARN) {
      const j = (y + dy) * e.b + x + dx;
      if (istFrei(e, x + dx, y + dy) && d[j] < 0) { d[j] = d[i] + 1; schlange.push(j); }
    }
  }
  return d;
}

/** Kürzester Weg über Felder (ohne das Startfeld, mit dem Zielfeld); leer, wenn keiner */
export function freiWeg(e: FreiEbene, von: Punkt, nach: Punkt): Punkt[] {
  const d = freiAbstaende(e, nach);
  if (!istFrei(e, von[0], von[1]) || d[von[1] * e.b + von[0]] < 0) return [];
  const aus: Punkt[] = [];
  let [x, y] = von;
  while (x !== nach[0] || y !== nach[1]) {
    const hier = d[y * e.b + x];
    const [dx, dy] = NACHBARN.find(([ax, ay]) => istFrei(e, x + ax, y + ay) && d[(y + ay) * e.b + x + ax] === hier - 1)!;
    x += dx; y += dy;
    aus.push([x, y]);
  }
  return aus;
}

/** Weltkoordinate der Mitte von Feld i */
export const feldMitte = (i: number) => (i + 0.5) * ZELLE;
/** Feld zu einer Weltkoordinate */
export const feldBei = (w: number) => Math.floor(w / ZELLE);

/** grobe Rasterspalte → erste Feldspalte */
const fein = (i: number) => Math.ceil(i / 2) + Math.floor(i / 2) * WEIT;

function ebene(zimmer: number, seed: number, organisch: boolean, C: number): FreiEbene | null {
  const plaetze = zimmer + 2;
  const p = programm(freiRegeln(plaetze, plaetze));
  const lauf = starte(p, { b: C, h: C, grund: "B" }, seed);
  lauf.raster.z[C + 1] = "I";
  laufeDurch(p, lauf, 400_000);
  const z = lauf.raster.z;
  if (!lauf.fertig || z.includes("U") || z.includes("V")) return null;

  // Plätze: die linke obere Ecke jedes gelben 5×5-Blocks
  const mitten: Punkt[] = [];
  for (let y = 1; y < C; y++) for (let x = 1; x < C; x++) {
    if (z[y * C + x] === "Y" && z[y * C + x - 1] !== "Y" && z[(y - 1) * C + x] !== "Y") mitten.push([x + 2, y + 2]);
  }
  if (mitten.length !== plaetze) return null;

  // strecken
  const B = fein(C);
  const art = new Uint8Array(B * B);
  for (let y = 0; y < C; y++) for (let x = 0; x < C; x++) {
    const c = z[y * C + x];
    const a = c === "W" ? WEG : c === "Y" ? PLATZ : c === "O" ? DURCHGANG : WAND;
    if (a === WAND) continue;
    for (let fy = fein(y); fy < fein(y + 1); fy++) for (let fx = fein(x); fx < fein(x + 1); fx++) art[fy * B + fx] = a;
  }

  if (organisch) {
    const n = programm(NAGE_REGELN);
    const nl = starte(n, { b: B, h: B, grund: "B" }, seed + 7);
    for (let i = 0; i < art.length; i++) if (art[i] !== WAND) nl.raster.z[i] = art[i] === WEG ? "W" : "P";
    laufeDurch(n, nl);
    for (let y = 1; y < B - 1; y++) for (let x = 1; x < B - 1; x++) {
      const i = y * B + x;
      if (art[i] === WAND && nl.raster.z[i] === "W") art[i] = WEG;
      else if (art[i] === WEG && nl.raster.z[i] === "B") art[i] = WAND;
    }
  }

  const e: FreiEbene = { b: B, h: B, art, start: [0, 0], ziel: [0, 0], raeume: [] };
  const mitteFein = ([x, y]: Punkt): Punkt => [fein(x) + 1, fein(y) + 1];
  // Ankunft: der Platz, der einer Ecke am nächsten liegt
  mitten.sort((a, b) => a[0] + a[1] - (b[0] + b[1]));
  e.start = mitteFein(mitten[0]);
  const d = freiAbstaende(e, e.start);
  const rest = mitten.slice(1).map(mitteFein).map(m => ({ m, d: d[m[1] * B + m[0]] }));
  if (rest.some(r => r.d < 0)) return null;
  rest.sort((a, b) => a.d - b.d);
  e.ziel = rest.pop()!.m;
  // halbe Kantenlänge: 5 grobe Felder = 3 weite + 2 schmale
  const r = (3 * WEIT + 2 - 1) / 2;
  e.raeume = rest.map(({ m }) => ({ x: m[0], y: m[1], r }));
  return e;
}

/**
 * Baut die Karten: `zimmer[i]` Stationen in Abschnitt i. Gleicher Seed, gleiche
 * Karte — die ganze Klasse läuft durch dieselbe Welt. `organisch[i]`: Wald und
 * Höhle bekommen angenagte Ränder.
 */
export function baueFreiPlan(zimmer: number[], seed: number, organisch: (boolean | KartenArt)[] = []): FreiPlan {
  const ebenen = zimmer.map((n, i) => {
    const art = organisch[i] === true ? "genagt" : organisch[i] || "raster";
    if (art === "lichtung" || art === "bach") return lichtungsEbene(n, seed * 131 + i * 17, { bach: art === "bach" });
    // ein Platz belegt mit Abstand etwa 9×9 grobe Felder
    let C = Math.max(19, 2 * Math.ceil(Math.sqrt((n + 2) * 90) / 2) + 1);
    for (; C <= 81; C += 4) {
      for (let v = 0; v < 6; v++) {
        const e = ebene(n, seed * 131 + i * 17 + v, art === "genagt", C);
        if (e) return e;
      }
    }
    throw new Error("Karte zu groß");
  });
  return { ebenen };
}

// ── Bewegung ─────────────────────────────────────────────────────────────

/**
 * Schiebt einen Kreis (Mitte x/z, Radius r, Welteinheiten) aus allen Wandfeldern
 * heraus — die Figur gleitet an Wänden entlang.
 */
export function schiebeHeraus(e: FreiEbene, x: number, z: number, r: number): [number, number] {
  for (let runde = 0; runde < 3; runde++) {
    const fx = feldBei(x), fz = feldBei(z);
    let geschoben = false;
    for (let j = fz - 1; j <= fz + 1; j++) for (let i = fx - 1; i <= fx + 1; i++) {
      if (istFrei(e, i, j)) continue;
      // nächster Punkt des Feldes zur Kreismitte
      const nx = Math.max(i * ZELLE, Math.min(x, (i + 1) * ZELLE));
      const nz = Math.max(j * ZELLE, Math.min(z, (j + 1) * ZELLE));
      const dx = x - nx, dz = z - nz, d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      if (d2 > 1e-9) {
        const d = Math.sqrt(d2);
        x += (dx / d) * (r - d); z += (dz / d) * (r - d);
      } else {
        // Mitte steckt im Feld: zur nächsten Kante hinaus
        const l = x - i * ZELLE, re = (i + 1) * ZELLE - x, o = z - j * ZELLE, u = (j + 1) * ZELLE - z;
        const m = Math.min(l, re, o, u);
        if (m === l) x = i * ZELLE - r; else if (m === re) x = (i + 1) * ZELLE + r;
        else if (m === o) z = j * ZELLE - r; else z = (j + 1) * ZELLE + r;
      }
      geschoben = true;
    }
    if (!geschoben) break;
  }
  return [x, z];
}

/** Wie weit (0…1) ist die Strecke von a nach b frei? Für die Kamera und gerade Wege. */
export function freieStrecke(e: FreiEbene, ax: number, az: number, bx: number, bz: number, rand = 0): number {
  const lang = Math.hypot(bx - ax, bz - az);
  const n = Math.max(1, Math.ceil(lang / 0.2));
  for (let k = 1; k <= n; k++) {
    const t = k / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
    const frei = rand
      ? istFrei(e, feldBei(x - rand), feldBei(z - rand)) && istFrei(e, feldBei(x + rand), feldBei(z - rand))
        && istFrei(e, feldBei(x - rand), feldBei(z + rand)) && istFrei(e, feldBei(x + rand), feldBei(z + rand))
      : istFrei(e, feldBei(x), feldBei(z));
    if (!frei) return (k - 1) / n;
  }
  return 1;
}

export type FreiOrt = { art: "raum"; raum: number } | { art: "ziel" } | { art: "zurueck" };

/** So nah (Welteinheiten) muss man an Station, Tor oder Rückweg stehen */
export const NAH = 2.6;

/** Mitte eines Ortes in Welteinheiten */
export function ortMitte(e: FreiEbene, ort: FreiOrt): [number, number] {
  const [x, y] = ort.art === "ziel" ? e.ziel : ort.art === "zurueck" ? e.start : [e.raeume[ort.raum].x, e.raeume[ort.raum].y];
  return [feldMitte(x), feldMitte(y)];
}

/** An welchem Ort steht die Figur? (`mitZurueck`: nicht im ersten Abschnitt) */
export function ortBei(e: FreiEbene, x: number, z: number, mitZurueck: boolean): FreiOrt | null {
  const nah = (ort: FreiOrt) => { const [mx, mz] = ortMitte(e, ort); return Math.hypot(x - mx, z - mz) < NAH; };
  const k = e.raeume.findIndex((_, i) => nah({ art: "raum", raum: i }));
  if (k >= 0) return { art: "raum", raum: k };
  if (nah({ art: "ziel" })) return { art: "ziel" };
  if (mitZurueck && nah({ art: "zurueck" })) return { art: "zurueck" };
  return null;
}
