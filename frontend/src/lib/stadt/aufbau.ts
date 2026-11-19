/**
 * Aufbau (wie Anno), alles auf einem Raster aus 6-m-Feldern (= Geländezellen). Plan: docs/stadt-aufbau-plan.md
 *   - Start: einige Dörfer mit Bauernhöfen, Brunnen, Kapelle und Feldern, verbunden durch Feldwege.
 *   - Das Kern-Gebäude (Markt …) in oder bei einem Dorf erhebt es zum Marktort; die anderen Dörfer bleiben Umland.
 *   - Gebäude bieten Güter (Wasser, Nahrung, Glaube …) in einer Reichweite in Gehminuten auf dem Wegenetz.
 *   - Häuser gehören einer Schicht (Bauern, Handwerker, Bürger …). Sind ihre Grundbedürfnisse erfüllt, füllen sie
 *     sich und steigen auf; fehlt etwas länger, steigen sie ab und stehen zuletzt leer.
 *   - Nahrung kommt von den Bauernhöfen der Dörfer (und später per Bahn/Schiff); ohne Überschuss wächst die Stadt nicht.
 *   - Geld: Bauen kostet, Gebäude und Wege kosten Unterhalt, die Bewohner zahlen Steuern.
 *   - Bebaubar ist nur erschlossenes Land; es wächst mit jeder Stufe.
 * Deterministisch aus Seed und Zügen.
 */
import { neigungBei, type Gelaende } from "@/lib/gelaende/gelaende";
import { perlin, zufallsquelle } from "@/lib/gelaende/rauschen";
import { waldMaske } from "@/lib/gelaende/wald";
import type { P } from "./geometrie";
import { BAUTEN, ZONEN, type BauTyp, type HausArt, type Stil } from "./modell";
import { BAUPLAENE, pruefeOrt, type Bewertung, type Ort } from "./bauen";
import {
  ANBIETER, ARBEITSLOS, aufStufen, EINFUHR, ERLOES_JE_STELLE, ERWERBSQUOTE, KUNDEN, grundVon, kosten, METER_JE_MINUTE, NAHRUNG_JE_HOF, palette, SCHICHTEN, SEKTOREN, SELBST, START_TALER, STELLEN, steuern,
  TROCKEN_KOSTEN, unterhalt, VORRANG, VORSTUFE, zentrumTyp, type Gut, type Sektor,
} from "./aufbauRegeln";

export const FREI = 0, STRASSE = 1, HAUPT = 2, HAUS = 3, BAU = 4;

export interface AufHaus {
  i: number; j: number; dreh: 0 | 1 | 2 | 3; bewohner: number; ziel: number;
  /** Anteil erfüllter Grundbedürfnisse 0…1 */
  versorgt: number; hoehe: number;
  /** Kantenlänge in Feldern (2 = Haus, 3 = Hof) */ s: number;
  /** Hof: 3 = Dreiseithof, 4 = Vierseithof, 0 = Einzelhaus */ hof: number;
  /** Schicht (Index in SCHICHTEN) */ schicht: number;
  /** Schritte mit fehlender Versorgung */ mangel: number;
  /** Straßenfeld vor dem Haus (Index) — von dort aus zählt die Versorgung */ tor: number;
  /** Bauernhof eines Dorfes (steigt nicht auf, liefert Nahrung) */ bauer: boolean;
  /** Ackerfelder des Hofes (Zahl der Felder; voll = FELD_JE_HOF) */ feld?: number;
}
export interface AufBau { id: number; bau: BauTyp; i: number; j: number; w: number; h: number; faktor: number; /** Vierteldrehungen (0–3), Zufahrt 0 = Süden */ dreh: number; /** gehört einem Dorf (kein Unterhalt) */ dorf?: boolean }
export interface Dorf { name: string; i: number; j: number; stadt: boolean }

export interface Welt {
  stil: Stil;
  seed: number;
  n: number;
  zelle: number;
  /** Belegung je Feld (FREI, STRASSE, HAUPT, HAUS, BAU) */
  feld: Uint8Array;
  /** 1 = erschlossen (bebaubar) */
  frei: Uint8Array;
  /** 1 = Acker (nur Anzeige) */
  acker: Uint8Array;
  /** 1 = Aue trockengelegt */
  trocken: Uint8Array;
  haeuser: AufHaus[];
  bauten: AufBau[];
  doerfer: Dorf[];
  einwohner: number;
  tick: number;
  stufe: number;
  taler: number;
  /** letzte Bilanz je Schritt */
  bilanz: { steuern: number; unterhalt: number; nahrung: number; bedarf: number };
  /** warum die Stadt gerade nicht wächst (nicht gespeichert, jeden Schritt neu) */
  engpass?: "nahrung" | "platz" | "arbeit" | null;
  strassenRadius: number;
  naechsteId: number;
  bruecken: { i: number; j: number }[];
  /** Zähler für Änderungen (Neuzeichnen und Neuberechnen nur bei Bedarf) */
  version: { strassen: number; haeuser: number; bauten: number };
}

/** Feld liegt in der (noch nassen) Aue */
export const nasseAue = (g: Gelaende, w: Welt, k: number) => g.aue[k] === 1 && !w.trocken[k];
export const TROCKEN_RADIUS = 60;

// ---------------------------------------------------------------- vorab gerechnete Raster (Leistung)

const ebenCache = new WeakMap<Gelaende, { e25: Uint8Array; e40: Uint8Array }>();
/** Felder, die eben genug sind (Neigung < 25 % bzw. < 40 %) und nicht im Wasser liegen — einmal je Gelände */
function eben(g: Gelaende) {
  let c = ebenCache.get(g);
  if (!c) {
    const n = g.n, e25 = new Uint8Array(n * n), e40 = new Uint8Array(n * n);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const k = j * n + i;
      if (g.wasser[k]) continue;
      const s = neigungBei(g, (i + 0.5) * g.zelle, (j + 0.5) * g.zelle);
      if (s < 25) e25[k] = 1;
      if (s < 40) e40[k] = 1;
    }
    c = { e25, e40 };
    ebenCache.set(g, c);
  }
  return c;
}
const ok25 = (g: Gelaende, i: number, j: number) => i >= 0 && j >= 0 && i < g.n && j < g.n && eben(g).e25[j * g.n + i] === 1;

// ---------------------------------------------------------------- Berufe und Besetzung

export interface Besetzung {
  /** Anteil besetzter Stellen je Gebäude-ID (1 = voll, ohne Stellen immer 1) */
  quote: Map<number, number>;
  /** Arbeitskräfte je Schicht, die in Betrieben arbeiten könnten */
  angebot: number[];
  /** davon nach der Verteilung noch frei */
  frei: number[];
  /** offene Stellen je Schicht */
  fehlend: number[];
  /** Erwerbstätige je Wirtschaftszweig (dazu »arbeitslos«) */
  sektoren: Record<Sektor, number>;
  /** Plätze für Selbstständige je Schicht, die noch frei sind */
  selbstFrei: number[];
  /** Arbeitskräfte ohne Stelle je Schicht */
  arbeitslos: number[];
  /** Anteil der Stadt-Arbeitskräfte ohne Stelle */
  quoteArbeitslos: number;
}

const besetzungCache = new WeakMap<Welt, { schluessel: string; b: Besetzung }>();
/**
 * Personal verteilen: jede Schicht stellt ERWERBSQUOTE ihrer Bewohner für Betriebe; die Schicht darunter darf
 * aushelfen (Bauern am Markt, Handwerker im Rathaus). Betriebe bekommen Leute nach VORRANG, Versorgung zuerst.
 */
export function besetzung(w: Welt): Besetzung {
  const schluessel = `${w.tick}|${w.version.bauten}|${w.version.haeuser}`;
  const c = besetzungCache.get(w);
  if (c && c.schluessel === schluessel) return c.b;
  const angebot = SCHICHTEN.map(() => 0), leute = SCHICHTEN.map(() => 0);
  let bauern = 0;
  for (const h of w.haeuser) {
    angebot[h.schicht] += h.bewohner * ERWERBSQUOTE;
    if (h.bauer) bauern += h.bewohner; else leute[h.schicht] += h.bewohner;
  }
  const frei = [...angebot], fehlend = SCHICHTEN.map(() => 0);
  const sektoren = Object.fromEntries(Object.keys(SEKTOREN).map(k => [k, 0])) as Record<Sektor, number>;
  const quote = new Map<number, number>();
  const rang = (b: AufBau) => { const k = VORRANG.indexOf(b.bau); return k < 0 ? VORRANG.length : k; };
  for (const b of [...w.bauten].sort((a, x) => rang(a) - rang(x) || a.id - x.id)) {
    const st = STELLEN[b.bau];
    if (!st || b.dorf) { quote.set(b.id, 1); continue; }
    let rest = st.n;
    for (const sch of [st.schicht, st.schicht - 1]) {
      if (sch < 0 || rest <= 0) continue;
      const nimm = Math.min(rest, frei[sch]);
      frei[sch] -= nimm; rest -= nimm;
    }
    fehlend[st.schicht] += rest;
    quote.set(b.id, (st.n - rest) / st.n);
    sektoren[st.sektor] += st.n - rest;
  }
  // Bauern arbeiten auf dem Feld (Bauern, die in der Stadt aushelfen, fehlen dort nicht). Stadtleute ohne Stelle
  // arbeiten selbstständig, soweit die Stadt sie trägt (SELBST), sonst sind sie ohne Arbeit
  const eigen: Sektor[] = ["land", "handwerk", "handel", "industrie", "handel"];
  sektoren.land += bauern * 0.6 + frei[0];
  const stadtLeute = leute.reduce((a, x) => a + x, 0);
  const selbstFrei = SCHICHTEN.map(() => 0), arbeitslos = SCHICHTEN.map(() => 0);
  let stadtKraft = 0, ohne = 0;
  for (let k = 1; k < SCHICHTEN.length; k++) {
    const platz = SELBST[k] * stadtLeute * ERWERBSQUOTE, selbst = Math.min(frei[k], platz);
    sektoren[eigen[k]] += selbst;
    selbstFrei[k] = platz - selbst;
    arbeitslos[k] = frei[k] - selbst;
    stadtKraft += leute[k] * ERWERBSQUOTE; ohne += arbeitslos[k];
  }
  sektoren.arbeitslos = ohne;
  const b = { quote, angebot, frei, fehlend, sektoren, selbstFrei, arbeitslos, quoteArbeitslos: stadtKraft ? ohne / stadtKraft : 0 };
  besetzungCache.set(w, { schluessel, b });
  return b;
}

/** Betrieb läuft (mindestens die Hälfte der Stellen besetzt) */
const laeuft = (bes: Besetzung, b: AufBau) => (bes.quote.get(b.id) ?? 1) >= 0.5;

/** Wirkung einer Werkstatt-Art: Summe der Besetzung, höchstens `max` Betriebe */
function werkstatt(w: Welt, bes: Besetzung, typ: BauTyp, max: number) {
  return w.bauten.filter(b => b.bau === typ && !b.dorf).map(b => bes.quote.get(b.id) ?? 0).sort((a, x) => x - a).slice(0, max).reduce((a, x) => a + x, 0);
}

/**
 * Verkauf der Werkstätten: jeder laufende Betrieb verdient je besetzter Stelle, solange die Kundschaft reicht.
 * Gleiche Betriebe teilen sich die Kunden (Absatz < 100 %); ohne Vorstufe (Bäckerei ohne Mühle) kein Verkauf,
 * je Mühle beliefert sie höchstens zwei Bäckereien.
 */
export function gewerbe(w: Welt, bes = besetzung(w)): { summe: number; je: Map<number, { absatz: number; ertrag: number; grund?: string }> } {
  const je = new Map<number, { absatz: number; ertrag: number; grund?: string }>();
  let summe = 0;
  for (const typ of Object.keys(KUNDEN) as BauTyp[]) {
    const liste = w.bauten.filter(b => b.bau === typ && !b.dorf).sort((a, b) => (bes.quote.get(b.id) ?? 0) - (bes.quote.get(a.id) ?? 0) || a.id - b.id);
    if (!liste.length) continue;
    const vor = VORSTUFE[typ];
    const erlaubt = vor ? 2 * w.bauten.filter(b => b.bau === vor && laeuft(bes, b)).length : Infinity;
    const aktiv = liste.filter((b, k) => laeuft(bes, b) && k < erlaubt);
    const absatz = aktiv.length ? Math.min(1, w.einwohner / (aktiv.length * KUNDEN[typ]!)) : 0;
    for (const b of liste) {
      const q = bes.quote.get(b.id) ?? 0;
      if (!aktiv.includes(b)) { je.set(b.id, { absatz: 0, ertrag: 0, grund: !laeuft(bes, b) ? "kein Personal" : `keine ${BAUTEN[vor!].label}` }); continue; }
      const ertrag = ERLOES_JE_STELLE * STELLEN[typ]!.n * q * absatz;
      je.set(b.id, { absatz, ertrag });
      summe += ertrag;
    }
  }
  return { summe, je };
}

/** Baukosten mit Zimmerei (−15 %, wenn eine besetzt ist) */
export function baukosten(w: Welt, b: BauTyp) {
  return Math.round(kosten(b) * (werkstatt(w, besetzung(w), "zimmerei", 1) >= 0.5 ? 0.85 : 1));
}

/** Versorgung je Gut: 1 = Straßenfeld in Reichweite eines Anbieters. Neu nur, wenn sich Straßen oder Gebäude ändern */
const abdeckungCache = new WeakMap<Welt, { schluessel: string; raster: Map<Gut, Uint8Array> }>();
export function abdeckung(w: Welt): Map<Gut, Uint8Array> {
  const bes = besetzung(w);
  const aktiv = w.bauten.filter(b => laeuft(bes, b));
  const schluessel = `${w.version.strassen}|${aktiv.map(b => b.id).join(",")}`;
  const alt = abdeckungCache.get(w);
  if (alt && alt.schluessel === schluessel) return alt.raster;
  const n = w.n, raster = new Map<Gut, Uint8Array>();
  const dist = new Float32Array(n * n);
  for (const b of aktiv) for (const a of ANBIETER[b.bau] ?? []) {
    let r = raster.get(a.gut);
    if (!r) { r = new Uint8Array(n * n); raster.set(a.gut, r); }
    erreichbar(w, b, a.minuten, r, dist);
  }
  abdeckungCache.set(w, { schluessel, raster });
  return raster;
}

/** Breitensuche auf dem Wegenetz ab der Zufahrt bis zur Reichweite (Felder auf Straßen) */
function erreichbar(w: Welt, b: AufBau, minuten: number, ziel: Uint8Array, dist: Float32Array) {
  const n = w.n, max = (minuten * METER_JE_MINUTE) / w.zelle;
  const t = zufahrt(b.i, b.j, b.w, b.h, b.dreh);
  if (t.i < 0 || t.j < 0 || t.i >= n || t.j >= n) return;
  const start = t.j * n + t.i;
  const besucht: number[] = [start];
  dist[start] = 1; // 1 = Abstand 0 (0 heißt »nicht besucht«)
  ziel[start] = 1;
  for (let q = 0; q < besucht.length; q++) {
    const k = besucht[q], d = dist[k];
    if (d - 1 >= max) continue;
    const i = k % n;
    for (const nb of [i > 0 ? k - 1 : -1, i < n - 1 ? k + 1 : -1, k - n, k + n]) {
      if (nb < 0 || nb >= n * n || dist[nb]) continue;
      const f = w.feld[nb];
      if (f !== STRASSE && f !== HAUPT) continue;
      dist[nb] = d + 1;
      ziel[nb] = 1;
      besucht.push(nb);
    }
  }
  for (const k of besucht) dist[k] = 0;
}

/** Straßenfelder (Liste), nur bei Änderung neu */
const strassenCache = new WeakMap<Welt, { v: number; liste: number[] }>();
function strassenListe(w: Welt): number[] {
  const c = strassenCache.get(w);
  if (c && c.v === w.version.strassen) return c.liste;
  const liste: number[] = [];
  for (let k = 0; k < w.n * w.n; k++) if (w.feld[k] === STRASSE || w.feld[k] === HAUPT) liste.push(k);
  strassenCache.set(w, { v: w.version.strassen, liste });
  return liste;
}

// ---------------------------------------------------------------- Welt

export function trockenlegen(g: Gelaende, w: Welt, x: number, y: number): number {
  if (w.taler < TROCKEN_KOSTEN) return 0;
  const rz = Math.ceil(TROCKEN_RADIUS / w.zelle), ci = Math.floor(x / w.zelle), cj = Math.floor(y / w.zelle);
  let neu = 0;
  for (let j = Math.max(0, cj - rz); j <= Math.min(w.n - 1, cj + rz); j++)
    for (let i = Math.max(0, ci - rz); i <= Math.min(w.n - 1, ci + rz); i++) {
      const k = j * w.n + i;
      if ((i - ci) ** 2 + (j - cj) ** 2 > rz * rz || !w.frei[k] || !g.aue[k] || w.trocken[k] || g.wasser[k]) continue;
      w.trocken[k] = 1;
      neu++;
    }
  if (neu) w.taler -= TROCKEN_KOSTEN;
  return neu;
}

export function neueWelt(g: Gelaende, stil: Stil, seed: number, mitDoerfern = true): Welt {
  const n = g.n;
  const w: Welt = {
    stil, seed, n, zelle: g.zelle, feld: new Uint8Array(n * n), frei: new Uint8Array(n * n), acker: new Uint8Array(n * n),
    trocken: new Uint8Array(n * n), haeuser: [], bauten: [], doerfer: [], einwohner: 0, tick: 0, stufe: 0,
    // Startgeld: genug für das Kern-Gebäude und die erste Grundversorgung
    taler: START_TALER + kosten(zentrumTyp(stil)),
    bilanz: { steuern: 0, unterhalt: 0, nahrung: 0, bedarf: 0 }, strassenRadius: 6, naechsteId: 1, bruecken: [],
    version: { strassen: 0, haeuser: 0, bauten: 0 },
  };
  if (mitDoerfern) legeDoerferAn(g, w);
  w.einwohner = w.haeuser.reduce((a, h) => a + h.bewohner, 0);
  freischalten(w);
  return w;
}

export const mitteVon = (w: Welt, b: { i: number; j: number; w: number; h: number }): P => ({ x: (b.i + b.w / 2) * w.zelle, y: (b.j + b.h / 2) * w.zelle });
export const orteVon = (w: Welt): Ort[] => w.bauten.map(b => ({ bau: b.bau, p: mitteVon(w, b) }));
export function fussabdruck(b: BauTyp, dreh = 0) {
  const w = Math.max(2, Math.min(24, Math.round(BAUTEN[b].b / 6))), h = Math.max(2, Math.min(24, Math.round(BAUTEN[b].h / 6)));
  return dreh % 2 ? { w: h, h: w } : { w, h };
}
/** Feld vor der Zufahrt des Gebäudes (Seite je Drehung: Süden, Westen, Norden, Osten) */
export function zufahrt(i: number, j: number, fw: number, fh: number, dreh: number) {
  return [{ i: i + Math.floor(fw / 2), j: j + fh }, { i: i - 1, j: j + Math.floor(fh / 2) }, { i: i + Math.floor(fw / 2), j: j - 1 }, { i: i + fw, j: j + Math.floor(fh / 2) }][dreh % 4];
}

export const hausMass = (stil: Stil) => (stil === "europaeisch" || stil === "orientalisch" ? 3 : 2);
export const hausMitte = (w: Welt, h: AufHaus): P => ({ x: (h.i + h.s / 2) * w.zelle, y: (h.j + h.s / 2) * w.zelle });
const zellenVon = (h: { i: number; j: number; s: number }) => {
  const aus: [number, number][] = [];
  for (let b = 0; b < h.s; b++) for (let a = 0; a < h.s; a++) aus.push([h.i + a, h.j + b]);
  return aus;
};

/** Zentrum: das Kern-Gebäude des Stadttyps, sonst das erste */
export function zentrum(w: Welt): AufBau | null {
  const z = zentrumTyp(w.stil);
  return w.bauten.find(b => b.bau === z) ?? null;
}
export const stufe = (w: Welt) => w.stufe;

/** Erschlossen: Umkreis der Dörfer (350 m), des Zentrums (wächst je Stufe) und jedes Gebäudes */
export function freischalten(w: Welt) {
  w.frei.fill(0);
  const z = zentrum(w);
  const kreise: [P, number][] = [
    ...w.doerfer.map(d => [{ x: (d.i + 0.5) * w.zelle, y: (d.j + 0.5) * w.zelle }, 350] as [P, number]),
    ...w.bauten.map(b => [mitteVon(w, b), 180] as [P, number]),
  ];
  if (z) kreise.push([mitteVon(w, z), 420 + 330 * w.stufe]);
  if (!w.doerfer.length && !z) { w.frei.fill(1); return; }
  for (const [c, r] of kreise) {
    const rz = Math.ceil(r / w.zelle), ci = Math.floor(c.x / w.zelle), cj = Math.floor(c.y / w.zelle);
    for (let j = Math.max(0, cj - rz); j <= Math.min(w.n - 1, cj + rz); j++)
      for (let i = Math.max(0, ci - rz); i <= Math.min(w.n - 1, ci + rz); i++)
        if ((i - ci) ** 2 + (j - cj) ** 2 <= rz * rz) w.frei[j * w.n + i] = 1;
  }
}

// ---------------------------------------------------------------- Dörfer

const SILBE_A = ["Alt", "Neu", "Ober", "Nieder", "Groß", "Klein", ""];
const SILBE_B = ["ammer", "buch", "eich", "lin", "rod", "wal", "hain", "mühl", "stein", "ros", "wend", "birk", "hasel", "erl"];
const SILBE_C = ["stedt", "leben", "roda", "hausen", "dorf", "feld", "bach", "au", "ingen"];
function dorfName(z: () => number) {
  const a = SILBE_A[Math.floor(z() * SILBE_A.length)], b = SILBE_B[Math.floor(z() * SILBE_B.length)], c = SILBE_C[Math.floor(z() * SILBE_C.length)];
  const stamm = b + c;
  return a ? `${a}${stamm}` : stamm[0].toUpperCase() + stamm.slice(1);
}

/** 3–5 Dörfer an trockenen, ebenen Plätzen nahe am Wasser, mit Höfen, Brunnen, Kapelle, Äckern und Feldwegen */
export function legeDoerferAn(g: Gelaende, w: Welt) {
  const z = zufallsquelle(w.seed + 4242), n = w.n, e = eben(g).e25, rausch = perlin(w.seed + 11);
  const kandidaten: { i: number; j: number; wert: number }[] = [];
  for (let j = 45; j < n - 45; j += 4) for (let i = 45; i < n - 45; i += 4) {
    const k = j * n + i;
    if (!e[k] || g.aue[k]) continue;
    const dw = g.abstandWasser[k];
    if (dw < 50 || dw > 600) continue;
    let gut = 0;
    for (let b = -8; b <= 8; b += 4) for (let a = -8; a <= 8; a += 4) { const kk = (j + b) * n + i + a; if (e[kk] && !g.aue[kk]) gut++; }
    if (gut < 22) continue;
    kandidaten.push({ i, j, wert: gut - dw / 120 + rausch(i / 40, j / 40) * 3 });
  }
  kandidaten.sort((a, b) => b.wert - a.wert);
  for (const c of kandidaten) {
    if (w.doerfer.length >= 4) break;
    if (w.doerfer.some(d => Math.hypot(d.i - c.i, d.j - c.j) * w.zelle < 650)) continue;
    w.doerfer.push({ name: dorfName(z), i: c.i, j: c.j, stadt: false });
  }
  freischalten(w);
  for (const d of w.doerfer) baueDorf(g, w, d, 6);
  // Feldwege zwischen benachbarten Dörfern
  for (let a = 0; a < w.doerfer.length; a++) {
    let best = -1, bd = Infinity;
    for (let b = 0; b < w.doerfer.length; b++) if (b !== a) { const d = Math.hypot(w.doerfer[a].i - w.doerfer[b].i, w.doerfer[a].j - w.doerfer[b].j); if (d < bd) { bd = d; best = b; } }
    if (best >= 0) strasseZwischen(g, w, w.doerfer[a], w.doerfer[best], STRASSE);
  }
}

/** Dorfkreuz, Brunnen, Kapelle und die ersten Höfe mit ihren Feldern */
function baueDorf(g: Gelaende, w: Welt, d: Dorf, hoefe: number) {
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    for (let t = 0; t < 18; t++) {
      const i = d.i + dx * t, j = d.j + dy * t;
      if (!ok25(g, i, j)) break;
      markiere(w, i, j, STRASSE);
    }
  }
  setzeOhneKosten(g, w, "brunnen", d.i + 1, d.j - 3, 0);
  setzeOhneKosten(g, w, "kapelle", d.i - 5, d.j + 1, 3);
  for (let k = 0; k < hoefe; k++) if (!neuerHof(g, w, d)) break;
}

// ---------------------------------------------------------------- Höfe, Felder, neue Dörfer

/** Ackerland je Hof: real 7–15 ha je Bauernfamilie (Hufe); im Spiel verkleinert auf ≈ 0,7 ha (200 Felder à 36 m²) */
export const FELD_JE_HOF = 200;
/** höchstens so viele Dörfer (mit den neu gegründeten) */
export const MAX_DOERFER = 9;
const waldCache = new WeakMap<Gelaende, Float32Array>();
const wald = (g: Gelaende) => { let m = waldCache.get(g); if (!m) { m = waldMaske(g); waldCache.set(g, m); } return m; };

/** Acker darf hier liegen: frei, eben genug, trocken, kein Wasser, nicht schon Acker */
const ackerbar = (g: Gelaende, w: Welt, k: number) => w.feld[k] === FREI && !w.acker[k] && !g.wasser[k] && !nasseAue(g, w, k) && eben(g).e25[k] === 1;

/**
 * Felder für einen Hof: von der Hofstelle aus zusammenhängend (Breitensuche) bis FELD_JE_HOF, höchstens 16 Felder
 * weit. probe = nur zählen. Die Feldfrucht (1 Winterkorn, 2 Sommerkorn, 3 Brache) wechselt von Hof zu Hof.
 */
function bestelleFeld(g: Gelaende, w: Welt, h: AufHaus, probe = false): number {
  const n = w.n, art = 1 + ((h.i * 7 + h.j * 11) % 3), gesehen = new Set<number>(), schlange: number[] = [];
  const mx = h.i + h.s / 2, my = h.j + h.s / 2;
  // Start: der Ring um die Hofstelle
  for (let y = h.j - 1; y <= h.j + h.s; y++) for (let x = h.i - 1; x <= h.i + h.s; x++) {
    if (x < 0 || y < 0 || x >= n || y >= n || (x >= h.i && x < h.i + h.s && y >= h.j && y < h.j + h.s)) continue;
    const k = y * n + x;
    if (ackerbar(g, w, k)) { gesehen.add(k); schlange.push(k); }
  }
  let zahl = 0;
  for (let q = 0; q < schlange.length && zahl < FELD_JE_HOF; q++) {
    const k = schlange[q], x = k % n;
    zahl++;
    if (!probe) w.acker[k] = art;
    for (const nb of [x > 0 ? k - 1 : -1, x < n - 1 ? k + 1 : -1, k - n, k + n]) {
      if (nb < 0 || nb >= n * n || gesehen.has(nb)) continue;
      if (Math.abs((nb % n) - mx) > 22 || Math.abs(Math.floor(nb / n) - my) > 22 || !ackerbar(g, w, nb)) continue;
      gesehen.add(nb); schlange.push(nb);
    }
  }
  return zahl;
}

/** einen Hof mit eigenen Feldern im Dorf anlegen; false, wenn kein Platz für Hof und Acker mehr ist */
function neuerHof(g: Gelaende, w: Welt, d: Dorf): boolean {
  for (const h of hausplaetze(g, w, 24, { i: d.i, j: d.j, r: d.stadt ? 30 : 24 + w.stufe * 2, bauer: true })) {
    if (bestelleFeld(g, w, h, true) < FELD_JE_HOF * 0.6) continue;
    setzeHaus(w, h);
    h.feld = bestelleFeld(g, w, h);
    w.version.strassen++; // Äcker neu zeichnen
    return true;
  }
  return false;
}

/** Dorfweg um ein Stück verlängern (neue Hofstellen am Ortsrand) */
function dorfwegVerlaengern(g: Gelaende, w: Welt, d: Dorf): boolean {
  const n = w.n, richtungen = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  for (let r = 0; r < 4; r++) {
    const [dx, dy] = richtungen[(r + w.tick) % 4];
    let ende = 0;
    for (let t = 1; t < 60; t++) {
      const i = d.i + dx * t, j = d.j + dy * t;
      if (i < 0 || j < 0 || i >= n || j >= n) break;
      const f = w.feld[j * n + i];
      if (f === STRASSE || f === HAUPT) ende = t; else if (t > ende + 1) break;
    }
    let neu = 0;
    for (let t = ende + 1; t <= ende + 8; t++) {
      const i = d.i + dx * t, j = d.j + dy * t, k = j * n + i;
      if (!ok25(g, i, j) || w.feld[k] !== FREI || g.wasser[k] || nasseAue(g, w, k)) break;
      w.acker[k] = 0;
      markiere(w, i, j, STRASSE);
      neu++;
    }
    if (neu >= 4) return true;
  }
  return false;
}

/** Bauplatz für ein neues Dorf: eben, trocken, kaum Wald, Wasser in der Nähe, ≥ 650 m zu den anderen, nicht zu weit von der Stadt */
export function dorfPlatz(g: Gelaende, w: Welt): { i: number; j: number } | null {
  const n = w.n, e = eben(g).e25, wm = wald(g), z = zentrum(w), zc = z ? { i: z.i, j: z.j } : w.doerfer[0];
  let best: { i: number; j: number; wert: number } | null = null;
  for (let j = 30; j < n - 30; j += 4) for (let i = 30; i < n - 30; i += 4) {
    const k = j * n + i;
    if (!e[k] || g.aue[k] || g.wasser[k]) continue;
    const dw = g.abstandWasser[k];
    if (dw < 40 || dw > 700) continue;
    if (w.doerfer.some(d => Math.hypot(d.i - i, d.j - j) * w.zelle < 650)) continue;
    const weit = zc ? Math.hypot(zc.i - i, zc.j - j) * w.zelle : 0;
    if (weit > 2200) continue;
    let gut = 0, baum = 0, belegt = 0;
    for (let b = -12; b <= 12; b += 4) for (let a = -12; a <= 12; a += 4) {
      const kk = (j + b) * n + i + a;
      if (e[kk] && !g.aue[kk] && !g.wasser[kk]) gut++;
      baum += wm[kk];
      if (w.feld[kk] !== FREI) belegt++;
    }
    if (gut < 40 || baum / 49 > 0.35 || belegt > 2) continue;
    const wert = gut - baum - dw / 150 - weit / 400;
    if (!best || wert > best.wert) best = { i, j, wert };
  }
  return best;
}

/** neues Dorf gründen (Ausbauzeit: Bauern ziehen dorthin, wo noch Land frei ist); Feldweg zum nächsten Dorf */
export function gruendeDorf(g: Gelaende, w: Welt): Dorf | null {
  const p = dorfPlatz(g, w);
  if (!p) return null;
  const zq = zufallsquelle(w.seed + w.doerfer.length * 97 + w.tick);
  let name = dorfName(zq);
  for (let t = 0; t < 10 && w.doerfer.some(d => d.name === name); t++) name = dorfName(zq);
  const d: Dorf = { name, i: p.i, j: p.j, stadt: false };
  const naechstes = [...w.doerfer].sort((a, b) => Math.hypot(a.i - p.i, a.j - p.j) - Math.hypot(b.i - p.i, b.j - p.j))[0];
  w.doerfer.push(d);
  freischalten(w);
  baueDorf(g, w, d, 3);
  if (naechstes) strasseZwischen(g, w, d, naechstes, STRASSE);
  freischalten(w);
  return d;
}

function setzeOhneKosten(g: Gelaende, w: Welt, b: BauTyp, i: number, j: number, dreh: number) {
  const { w: fw, h: fh } = fussabdruck(b, dreh);
  for (let y = j; y < j + fh; y++) for (let x = i; x < i + fw; x++) if (x < 0 || y < 0 || x >= w.n || y >= w.n || w.feld[y * w.n + x] !== FREI || !ok25(g, x, y)) return null;
  const neu: AufBau = { id: w.naechsteId++, bau: b, i, j, w: fw, h: fh, faktor: 1, dreh, dorf: true };
  for (let y = j; y < j + fh; y++) for (let x = i; x < i + fw; x++) w.feld[y * w.n + x] = BAU;
  w.bauten.push(neu);
  const t = zufahrt(i, j, fw, fh, dreh), s = naechsteStrasse(w, t.i, t.j, 30);
  if (s) strasseZwischen(g, w, t, s, STRASSE); else markiere(w, t.i, t.j, STRASSE);
  w.version.bauten++;
  return neu;
}

/** Höfe, ab denen ein Dorf seine eigene Schmiede bekommt; Grundgröße der Dörfer (wächst je Stufe um 3 Höfe) */
export const DORF_SCHMIEDE = 10, DORF_HOEFE = 6;
const DORF_R = 30;
/** Bauernhöfe eines Dorfes (im Umkreis von 180 m) */
export function hoefeIm(w: Welt, d: Dorf) {
  return w.haeuser.filter(h => h.bauer && (h.i - d.i) ** 2 + (h.j - d.j) ** 2 <= DORF_R * DORF_R).length;
}
/** die Dorfschmiede eines Dorfes, falls es eine hat */
export function dorfSchmiede(w: Welt, d: Dorf) {
  return w.bauten.find(b => b.dorf && b.bau === "schmiede" && (b.i - d.i) ** 2 + (b.j - d.j) ** 2 <= DORF_R * DORF_R) ?? null;
}

/** Dorf in der Nähe (≤ 250 m) */
export function dorfBei(w: Welt, x: number, y: number): Dorf | null {
  let best: Dorf | null = null, bd = 250;
  for (const d of w.doerfer) { const dd = Math.hypot((d.i + 0.5) * w.zelle - x, (d.j + 0.5) * w.zelle - y); if (dd < bd) { bd = dd; best = d; } }
  return best;
}

// ---------------------------------------------------------------- Gebäude setzen

export interface Platzpruefung { ok: boolean; faktor: number; gruende: Bewertung[]; versorgt: number; kosten: number }

/** Darf Gebäude b mit linker oberer Ecke (i, j) hin? Lageregeln, Freischaltung, Stufe, Geld */
/**
 * Was einem Gebäude weichen muss: Häuser unter dem Bauplatz, an der Zufahrt oder mit ihrem Tor darunter,
 * und Wegfelder darunter. `getrennt` = ohne diese Wegfelder zerfiele das Wegenetz (dann nicht erlaubt).
 */
export function verdraengt(w: Welt, i: number, j: number, fw: number, fh: number, dreh: number): { haeuser: AufHaus[]; wege: number; getrennt: boolean } {
  const n = w.n, unter = new Set<number>();
  for (let y = j; y < j + fh; y++) for (let x = i; x < i + fw; x++) if (x >= 0 && y >= 0 && x < n && y < n) unter.add(y * n + x);
  const tz = zufahrt(i, j, fw, fh, dreh), tk = tz.j * n + tz.i;
  const haeuser = w.haeuser.filter(h => unter.has(h.tor) || zellenVon(h).some(([x, y]) => unter.has(y * n + x) || y * n + x === tk));
  const ist = (k: number) => (w.feld[k] === STRASSE || w.feld[k] === HAUPT) && !unter.has(k);
  let wege = 0;
  const rand = new Set<number>();
  for (const k of unter) {
    if (w.feld[k] !== STRASSE && w.feld[k] !== HAUPT) continue;
    wege++;
    const x = k % n;
    for (const nb of [x > 0 ? k - 1 : -1, x < n - 1 ? k + 1 : -1, k - n, k + n]) if (nb >= 0 && nb < n * n && ist(nb)) rand.add(nb);
  }
  if (!wege || rand.size < 2) return { haeuser, wege, getrennt: false };
  // hängen die Wegstücke rund um den Bauplatz noch zusammen?
  const start = [...rand][0], gesehen = new Set([start]), schlange = [start];
  let offen = rand.size - 1;
  for (let q = 0; q < schlange.length && offen > 0; q++) {
    const k = schlange[q], x = k % n;
    for (const nb of [x > 0 ? k - 1 : -1, x < n - 1 ? k + 1 : -1, k - n, k + n]) {
      if (nb < 0 || nb >= n * n || gesehen.has(nb) || !ist(nb)) continue;
      gesehen.add(nb); schlange.push(nb);
      if (rand.has(nb)) offen--;
    }
  }
  return { haeuser, wege, getrennt: offen > 0 };
}

export function pruefePlatz(g: Gelaende, w: Welt, b: BauTyp, i: number, j: number, dreh = 0): Platzpruefung {
  const { w: fw, h: fh } = fussabdruck(b, dreh);
  const gruende: Bewertung[] = [];
  let ok = true;
  for (let y = j; y < j + fh && ok; y++) for (let x = i; x < i + fw; x++) {
    if (x < 0 || y < 0 || x >= w.n || y >= w.n) { ok = false; gruende.push({ ok: false, text: "außerhalb der Karte" }); break; }
    const k = y * w.n + x;
    if (!w.frei[k]) { ok = false; gruende.push({ ok: false, text: "Land noch nicht erschlossen — wächst mit der nächsten Stufe" }); break; }
    // Häuser und Wege dürfen weichen, andere Gebäude nicht
    if (w.feld[k] === BAU) { ok = false; gruende.push({ ok: false, text: "hier steht schon ein Gebäude" }); break; }
    if (g.wasser[k] && !["kai", "werft", "hafen", "kanalhafen", "muehle", "hafenkontor"].includes(b)) { ok = false; gruende.push({ ok: false, text: "im Wasser" }); break; }
  }
  // die Zufahrt muss ans Wegenetz können: frei oder schon Straße, nicht im Haus
  const tz = zufahrt(i, j, fw, fh, dreh);
  if (ok && (tz.i < 0 || tz.j < 0 || tz.i >= w.n || tz.j >= w.n || w.feld[tz.j * w.n + tz.i] === BAU)) {
    ok = false; gruende.push({ ok: false, text: "Zufahrt versperrt — dreh das Gebäude oder rück es ab" });
  }
  const pal = palette(w.stil).find(p => p.bau === b);
  if (!pal) { ok = false; gruende.push({ ok: false, text: "gehört nicht zu diesem Stadttyp" }); }
  else if (pal.stufe > w.stufe) { ok = false; gruende.push({ ok: false, text: `erst ab Stufe ${pal.stufe + 1}` }); }
  const vor = VORSTUFE[b];
  if (vor && !w.bauten.some(o => o.bau === vor)) { ok = false; gruende.push({ ok: false, text: `braucht erst ${BAUTEN[vor].icon} ${BAUTEN[vor].label} (Warenkette)` }); }
  const k0 = baukosten(w, b);
  if (w.taler < k0) { ok = false; gruende.push({ ok: false, text: `zu teuer: ${k0} Taler, du hast ${Math.floor(w.taler)}` }); }
  // Gebäude, die es (noch) nicht gibt: die teuren Prüfungen sparen
  if (!pal || pal.stufe > w.stufe) return { ok: false, faktor: 0, gruende, versorgt: 0, kosten: k0 };
  if (ok) {
    const v = verdraengt(w, i, j, fw, fh, dreh);
    if (v.getrennt) { ok = false; gruende.push({ ok: false, text: "würde das Wegenetz durchschneiden — etwas verschieben oder drehen" }); }
    else if (v.haeuser.length || v.wege) gruende.push({ ok: true, text: `weichen: ${[v.haeuser.length ? `${v.haeuser.length} ${v.haeuser.length === 1 ? "Haus" : "Häuser"} (${v.haeuser.reduce((a, h) => a + h.bewohner, 0)} Bewohner)` : "", v.wege ? `${v.wege} Wegfelder` : ""].filter(Boolean).join(", ")}` });
  }

  const p = mitteVon(w, { i, j, w: fw, h: fh });
  // Lageregeln nur für Gebäude aus dem Bauplan (Grundversorgung hat keine)
  const imPlan = BAUPLAENE[w.stil].orte.some(o => o.bau === b);
  // ab der Marktstadt (Stufe 3) darf es mehrere Märkte geben (zentrale Orte niederer Ordnung):
  // geprüft wird ohne die anderen Märkte; stehen sie näher als 600 m, teilen sie sich die Kundschaft
  const mehrfach = w.stufe >= 2 && !!ANBIETER[b]?.some(a => a.gut === "nahrung");
  const orte = mehrfach ? orteVon(w).filter(o => o.bau !== b) : orteVon(w);
  const pr = imPlan ? pruefeOrt(g, w.stil, b, p, orte) : { erlaubt: true, faktor: 1, gruende: [] as Bewertung[] };
  if (mehrfach && w.bauten.some(o => o.bau === b && Math.hypot(mitteVon(w, o).x - p.x, mitteVon(w, o).y - p.y) < 600)) {
    pr.faktor *= 0.5;
    pr.gruende.push({ ok: false, text: "näher als 600 m am nächsten Markt — beide teilen sich die Kundschaft" });
  }
  return { ok: ok && pr.erlaubt, faktor: ok ? pr.faktor : 0, gruende: [...gruende, ...pr.gruende], versorgt: erreichteHaeuser(w, b, i, j, fw, fh, dreh), kosten: k0 };
}

/** Häuser, die ein Gebäude an dieser Stelle über das Wegenetz erreichen würde */
export function erreichteHaeuser(w: Welt, b: BauTyp, i: number, j: number, fw: number, fh: number, dreh: number): number {
  const a = ANBIETER[b];
  if (!a?.length) return 0;
  const n = w.n, r = new Uint8Array(n * n), d = new Float32Array(n * n);
  erreichbar(w, { id: 0, bau: b, i, j, w: fw, h: fh, faktor: 1, dreh }, Math.max(...a.map(x => x.minuten)), r, d);
  return w.haeuser.filter(h => r[h.tor]).length;
}

export function baue(g: Gelaende, w: Welt, b: BauTyp, i: number, j: number, dreh = 0): AufBau | null {
  const pr = pruefePlatz(g, w, b, i, j, dreh);
  if (!pr.ok) return null;
  const { w: fw, h: fh } = fussabdruck(b, dreh);
  const neu: AufBau = { id: w.naechsteId++, bau: b, i, j, w: fw, h: fh, faktor: pr.faktor, dreh: dreh % 4 };
  // Häuser und Wege unter dem Bauplatz weichen
  const v = verdraengt(w, i, j, fw, fh, dreh);
  for (const h of v.haeuser) leere(w, h);
  if (v.haeuser.length) w.haeuser = w.haeuser.filter(h => !v.haeuser.includes(h));
  if (v.wege) w.version.strassen++;
  for (let y = j; y < j + fh; y++) for (let x = i; x < i + fw; x++) w.feld[y * w.n + x] = BAU;
  w.bauten.push(neu);
  w.taler -= pr.kosten;
  const tor = zufahrt(i, j, fw, fh, dreh);
  const ziel = naechsteStrasse(w, tor.i, tor.j);
  if (ziel) strasseZwischen(g, w, tor, ziel, HAUPT);
  else markiere(w, tor.i, tor.j, HAUPT);
  // Stadterhebung: das Kern-Gebäude macht das Dorf daneben zum Marktort; Landstraßen zu allen Dörfern
  if (b === zentrumTyp(w.stil) && w.stufe === 0) {
    const m = mitteVon(w, neu), d = dorfBei(w, m.x, m.y);
    if (d) d.stadt = true;
    for (const x of w.doerfer) if (x !== d) strasseZwischen(g, w, tor, x, HAUPT);
    w.stufe = 1;
  }
  for (const o of w.bauten) if (BAUPLAENE[w.stil].orte.some(x => x.bau === o.bau)) o.faktor = pruefeOrt(g, w.stil, o.bau, mitteVon(w, o), orteVon(w)).faktor;
  w.version.bauten++;
  freischalten(w);
  return neu;
}

function leere(w: Welt, h: AufHaus) {
  for (const [x, y] of zellenVon(h)) w.feld[y * w.n + x] = FREI;
  w.version.haeuser++;
}

export function reisseAb(g: Gelaende, w: Welt, id: number) {
  const b = w.bauten.find(x => x.id === id);
  if (!b) return;
  for (let y = b.j; y < b.j + b.h; y++) for (let x = b.i; x < b.i + b.w; x++) w.feld[y * w.n + x] = FREI;
  w.bauten = w.bauten.filter(x => x.id !== id);
  w.taler += kosten(b.bau) * 0.25;
  for (const o of w.bauten) if (BAUPLAENE[w.stil].orte.some(x => x.bau === o.bau)) o.faktor = pruefeOrt(g, w.stil, o.bau, mitteVon(w, o), orteVon(w)).faktor;
  w.version.bauten++;
  freischalten(w);
}

export function bauBei(w: Welt, i: number, j: number): AufBau | null {
  return w.bauten.find(b => i >= b.i && i < b.i + b.w && j >= b.j && j < b.j + b.h) ?? null;
}

// ---------------------------------------------------------------- Straßen

function markiere(w: Welt, i: number, j: number, art: number) {
  if (i < 0 || j < 0 || i >= w.n || j >= w.n) return;
  const k = j * w.n + i;
  if (w.feld[k] === BAU || w.feld[k] === HAUS) return;
  if (w.feld[k] !== HAUPT && w.feld[k] !== art) { w.feld[k] = art; w.version.strassen++; }
}

function naechsteStrasse(w: Welt, i: number, j: number, max = 400): { i: number; j: number } | null {
  for (let r = 0; r < max; r++) for (let a = -r; a <= r; a++) for (const [x, y] of [[i + a, j - r], [i + a, j + r], [i - r, j + a], [i + r, j + a]]) {
    if (x < 0 || y < 0 || x >= w.n || y >= w.n) continue;
    const f = w.feld[y * w.n + x];
    if (f === STRASSE || f === HAUPT) return { i: x, j: y };
  }
  return null;
}

/** kürzester Weg auf dem Raster: Steigung kostet, Wasser viel (Brücke), vorhandene Straßen wenig */
export function strasseZwischen(g: Gelaende, w: Welt, a: { i: number; j: number }, b: { i: number; j: number }, art = STRASSE) {
  const n = w.n, rand = 60;
  const i0 = Math.max(0, Math.min(a.i, b.i) - rand), i1 = Math.min(n - 1, Math.max(a.i, b.i) + rand);
  const j0 = Math.max(0, Math.min(a.j, b.j) - rand), j1 = Math.min(n - 1, Math.max(a.j, b.j) + rand);
  const bw = i1 - i0 + 1, bh = j1 - j0 + 1;
  const kostenF = new Float64Array(bw * bh).fill(Infinity), vor = new Int32Array(bw * bh).fill(-1);
  const idx = (i: number, j: number) => (j - j0) * bw + (i - i0);
  const heap: [number, number][] = [];
  const push = (c: number, k: number) => { heap.push([c, k]); let x = heap.length - 1; while (x > 0) { const p = (x - 1) >> 1; if (heap[p][0] <= heap[x][0]) break; [heap[p], heap[x]] = [heap[x], heap[p]]; x = p; } };
  const pop = () => { const t = heap[0], l = heap.pop()!; if (heap.length) { heap[0] = l; let x = 0; for (;;) { const a2 = 2 * x + 1, b2 = a2 + 1; let m = x; if (a2 < heap.length && heap[a2][0] < heap[m][0]) m = a2; if (b2 < heap.length && heap[b2][0] < heap[m][0]) m = b2; if (m === x) break; [heap[m], heap[x]] = [heap[x], heap[m]]; x = m; } } return t; };
  const s = idx(a.i, a.j), zi = idx(b.i, b.j);
  const schaetz = (k: number) => Math.abs((k % bw) + i0 - b.i) + Math.abs(Math.floor(k / bw) + j0 - b.j);
  kostenF[s] = 0; push(schaetz(s), s);
  while (heap.length) {
    const [c, k] = pop();
    // veralteter Heap-Eintrag (Schlüssel = Kosten + Schätzung)
    if (c > kostenF[k] + schaetz(k) + 1e-9) continue;
    if (k === zi) break;
    const i = (k % bw) + i0, j = Math.floor(k / bw) + j0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = i + dx, y = j + dy;
      if (x < i0 || y < j0 || x > i1 || y > j1) continue;
      const kk = y * n + x, f = w.feld[kk];
      if (f === HAUS || (f === BAU && !(x === b.i && y === b.j))) continue;
      const steil = eben(g).e25[kk] ? 0 : eben(g).e40[kk] ? 2 : 20;
      const schritt = (f === STRASSE || f === HAUPT ? 0.35 : 1) + steil + (g.wasser[kk] ? 6 : 0);
      const ni = idx(x, y), nc = c + schritt;
      if (nc < kostenF[ni]) { kostenF[ni] = nc; vor[ni] = k; push(nc + Math.abs(x - b.i) + Math.abs(y - b.j), ni); }
    }
  }
  if (!Number.isFinite(kostenF[zi])) return;
  for (let k = zi; k >= 0; k = vor[k]) markiere(w, (k % bw) + i0, Math.floor(k / bw) + j0, art);
}

/** Geplantes Straßennetz je Stadttyp als Feld-Muster um das Zentrum (für Häuser gesperrt) */
function netz(w: Welt): ((i: number, j: number) => boolean) | null {
  const z = zentrum(w);
  if (!z) return null;
  const plan = BAUPLAENE[w.stil];
  const { i: ci, j: cj } = zufahrt(z.i, z.j, z.w, z.h, z.dreh);
  const B = Math.max(5, Math.round(plan.block / w.zelle));
  if (plan.muster === "raster" || plan.muster === "stern") return (i, j) => (i - ci) % B === 0 || (j - cj) % B === 0;
  if (plan.muster === "faecher") return (i, j) => {
    const d = Math.hypot(i - ci, j - cj);
    if (d < 2) return true;
    if (Math.abs(d - Math.round(d / B) * B) < 0.71) return true;
    const a = Math.atan2(j - cj, i - ci), st = Math.PI / 8;
    return Math.abs(a - Math.round(a / st) * st) * d < 0.71;
  };
  const r = perlin(w.seed + 77), A = B * 0.4;
  const lage = (k: number, t: number, achse: number) => k * B + Math.round(A * r(k * 3.7 + achse * 50, t / 55) + B * 0.25 * r(k * 1.9 + achse * 20, 0.5));
  const auf = (u: number, t: number, achse: number) => {
    const k0 = Math.floor(u / B);
    for (const k of [k0 - 1, k0, k0 + 1]) {
      const a = lage(k, t, achse), b = lage(k, t - 1, achse);
      if (u >= Math.min(a, b) && u <= Math.max(a, b)) return true;
    }
    return false;
  };
  return (i, j) => auf(j - cj, i - ci, 0) || auf(i - ci, j - cj, 1);
}

/** Wohnstraßen des geplanten Netzes bis zum Radius r (Felder), nur wo Wasser und Nahrung hinkommen können */
function wohnstrassen(g: Gelaende, w: Welt, r: number) {
  const z = zentrum(w), nz = netz(w);
  if (!z || !nz) return;
  const { i: ci, j: cj } = zufahrt(z.i, z.j, z.w, z.h, z.dreh);
  const zm = mitteVon(w, z), grenze = (r * w.zelle) ** 2;
  // nur dort, wo Wasser und Nahrung (Luftlinie) hinreichen — dort können Häuser stehen; keine leeren Straßen auf Vorrat
  const geber = (gut: Gut) => w.bauten.flatMap(b => (ANBIETER[b.bau] ?? []).filter(a => a.gut === gut).map(a => ({ m: mitteVon(w, b), r: a.minuten * METER_JE_MINUTE * 0.8 + 30 })));
  const wa = geber("wasser"), na = geber("nahrung");
  const nah = (l: { m: P; r: number }[], x: number, y: number) => l.some(a => (a.m.x - x) ** 2 + (a.m.y - y) ** 2 <= a.r * a.r);
  const inReichweite = (x: number, y: number) => nah(wa, x, y) && nah(na, x, y);
  for (let j = Math.max(0, cj - r); j <= Math.min(w.n - 1, cj + r); j++)
    for (let i = Math.max(0, ci - r); i <= Math.min(w.n - 1, ci + r); i++) {
      const k = j * w.n + i;
      if (((i + 0.5) * w.zelle - zm.x) ** 2 + ((j + 0.5) * w.zelle - zm.y) ** 2 > grenze) continue;
      if (w.feld[k] !== FREI || !w.frei[k] || !eben(g).e25[k] || nasseAue(g, w, k)) continue;
      if (nz(i, j) && inReichweite((i + 0.5) * w.zelle, (j + 0.5) * w.zelle)) { w.feld[k] = STRASSE; w.version.strassen++; }
    }
}

/** Brücken über schmale Flussstellen (≤ 60 m), mindestens 150 m auseinander */
export function bruecken(g: Gelaende, w: Welt) {
  const n = w.n, nass = (x: number, y: number) => g.wasser[y * n + x] > 0;
  for (const k of [...strassenListe(w)]) {
    if (g.wasser[k]) continue;
    const i = k % n, j = Math.floor(k / n);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      let x = i + dx, y = j + dy;
      if (x < 0 || y < 0 || x >= n || y >= n || !nass(x, y)) continue;
      const ueber: number[] = [];
      while (x >= 0 && y >= 0 && x < n && y < n && nass(x, y) && ueber.length <= 10) { ueber.push(y * n + x); x += dx; y += dy; }
      if (ueber.length > 10 || x < 0 || y < 0 || x >= n || y >= n) continue;
      const l = y * n + x;
      if (!w.frei[l] || !eben(g).e40[l] || (w.feld[l] !== FREI && w.feld[l] !== STRASSE && w.feld[l] !== HAUPT)) continue;
      const mi = (i + x) / 2, mj = (j + y) / 2;
      if (w.bruecken.some(b => Math.hypot(b.i - mi, b.j - mj) < 25)) continue;
      for (const u of ueber) w.feld[u] = STRASSE;
      if (w.feld[l] === FREI) w.feld[l] = STRASSE;
      w.version.strassen++;
      w.bruecken.push({ i: mi, j: mj });
    }
  }
}

// ---------------------------------------------------------------- Häuser, Versorgung, Nahrung, Geld

/** Anteil erfüllter Grundbedürfnisse eines Hauses (Nahrung zählt nur, wenn genug da ist) */
function versorgungVon(w: Welt, h: AufHaus, abd: Map<Gut, Uint8Array>, nahrungOk: (h: AufHaus) => boolean, schicht = h.schicht): number {
  const grund = grundVon(w.stil, schicht);
  if (!grund.length) return 1;
  let n = 0;
  for (const gut of grund) if (abd.get(gut)?.[h.tor] && (gut !== "nahrung" || nahrungOk(h))) n++;
  return n / grund.length;
}

/** Ein Grundstück für ein neues Haus: frei, erschlossen, eben, an der Straße, nicht in der nassen Aue */
function hausplaetze(g: Gelaende, w: Welt, max: number, ort: { i: number; j: number; r: number; bauer: boolean; abd?: Map<Gut, Uint8Array> }): AufHaus[] {
  const n = w.n, rausch = perlin(w.seed + 5), nz = ort.bauer ? null : netz(w);
  const S = hausMass(w.stil), e = eben(g).e25;
  const frei2 = (i: number, j: number) => {
    for (const [x, y] of zellenVon({ i, j, s: S })) {
      if (x < 0 || y < 0 || x >= n || y >= n) return false;
      const k = y * n + x;
      if (w.feld[k] !== FREI || !w.frei[k] || !e[k] || nz?.(x, y) || nasseAue(g, w, k) || g.abstandWasser[k] < 15) return false;
    }
    // Gehöfte stehen einzeln (Hofraum, Garten): ein Feld Abstand zum nächsten Haus
    if (ort.bauer) for (let y = j - 1; y <= j + S; y++) for (let x = i - 1; x <= i + S; x++) {
      if (x >= 0 && y >= 0 && x < n && y < n && w.feld[y * n + x] === HAUS) return false;
    }
    return true;
  };
  const aus: { h: AufHaus; wert: number }[] = [];
  const gesehen = new Set<number>();
  const wasser = ort.abd?.get("wasser"), nahrung = ort.abd?.get("nahrung");
  for (const k of strassenListe(w)) {
    const si = k % n, sj = Math.floor(k / n);
    if (Math.abs(si - ort.i) > ort.r || Math.abs(sj - ort.j) > ort.r) continue;
    // Stadthäuser nur, wo Wasser und Nahrung hinreichen
    if (!ort.bauer && (!wasser?.[k] || !nahrung?.[k])) continue;
    const lagen: [number, number, 0 | 1 | 2 | 3][] = [];
    for (let t = 0; t < S; t++) lagen.push([si - S, sj - t, 1], [si + 1, sj - t, 3], [si - t, sj - S, 0], [si - t, sj + 1, 2]);
    for (const [i, j, dreh] of lagen) {
      const key = j * n + i;
      if (gesehen.has(key) || !frei2(i, j)) continue;
      gesehen.add(key);
      const d = Math.hypot(i + S / 2 - ort.i, j + S / 2 - ort.j);
      if (d > ort.r) continue;
      const flucht = (((i - ort.i) % S) + S) % S === 0 && (((j - ort.j) % S) + S) % S === 0 ? 6 : 0;
      aus.push({ h: { i, j, dreh, bewohner: 0, ziel: 0, versorgt: 0, hoehe: 0, s: S, hof: 0, schicht: ort.bauer ? 0 : 1, mangel: 0, tor: k, bauer: ort.bauer }, wert: -d + rausch(i / 7, j / 7) * 10 + (w.feld[k] === HAUPT ? 4 : 0) + flucht });
    }
  }
  aus.sort((a, b) => b.wert - a.wert);
  const res: AufHaus[] = [];
  const belegt = new Set<number>();
  for (const { h } of aus) {
    if (res.length >= max) break;
    const zellen = zellenVon(h).map(([x, y]) => y * n + x);
    if (zellen.some(z => belegt.has(z))) continue;
    zellen.forEach(z => belegt.add(z));
    res.push(h);
  }
  return res;
}

function setzeHaus(w: Welt, h: AufHaus) {
  for (const [x, y] of zellenVon(h)) { w.feld[y * w.n + x] = HAUS; w.acker[y * w.n + x] = 0; }
  if (h.s === 3) h.hof = (h.i * 7 + h.j * 13) % 3 === 0 ? 4 : 3;
  h.bewohner = h.bauer ? 3 : 2;
  w.haeuser.push(h);
  w.version.haeuser++;
}

/** Zielbewohner und Höhe eines Hauses nach Schicht und Versorgung */
function hausWerte(w: Welt, h: AufHaus) {
  const sch = SCHICHTEN[h.schicht], gross = h.s === 3 ? 1 : 0.6;
  h.ziel = Math.max(1, Math.round(sch.bewohner * gross * (0.4 + 0.6 * h.versorgt)));
  const art = ZONEN[BAUPLAENE[w.stil].kern].haus;
  const [lo, hi] = art?.hoehe ?? [6, 10];
  h.hoehe = h.bauer ? lo * 0.75 : lo + (hi - lo) * Math.min(1, h.schicht / 2) + Math.max(0, h.schicht - 2) * 5;
}

/** Nahrung: Bauernhöfe mit Weg zum Markt liefern voll, ohne Anbindung nur wenig; dazu Einfuhr über Bahn und Schiff */
export function nahrungsBilanz(w: Welt, abd = abdeckung(w)): { angebot: number; bedarf: number } {
  const d = nahrungsDetails(w, abd);
  return { angebot: d.angebot, bedarf: d.bedarf };
}

/** Nahrung nach Posten: Höfe (mit/ohne Weg zum Markt), Werkzeug, Einfuhr, Mühle und Bäckerei */
export function nahrungsDetails(w: Welt, abd = abdeckung(w)) {
  const markt = abd.get("nahrung");
  const anbindung = markt ? marktAnbindung(w) : null;
  const bes = besetzung(w);
  // Schmiede: Werkzeug für die Höfe (+20 %)
  const werkzeug = 1 + 0.2 * werkstatt(w, bes, "schmiede", 1);
  let hoefe = 0, angebunden = 0, ernte = 0, bedarf = 0;
  // Höfe in der Nähe einer Dorfschmiede: +15 % (zählt nicht doppelt mit der Stadtschmiede)
  const dorfS = w.bauten.filter(b => b.dorf && b.bau === "schmiede");
  for (const h of w.haeuser) {
    if (h.bauer) {
      hoefe++;
      if (anbindung?.[h.tor]) angebunden++;
      const dorfWz = dorfS.some(b => (b.i - h.i) ** 2 + (b.j - h.j) ** 2 <= DORF_R * DORF_R) ? 1.15 : 1;
      ernte += NAHRUNG_JE_HOF * Math.min(1, (h.feld ?? FELD_JE_HOF) / FELD_JE_HOF) * Math.max(werkzeug, dorfWz) * (anbindung?.[h.tor] ? 1 : 0.3) * (h.bewohner / Math.max(1, h.ziel));
    } else bedarf += h.bewohner;
  }
  let einfuhr = 0;
  for (const b of w.bauten) einfuhr += (EINFUHR[b.bau] ?? 0) * (bes.quote.get(b.id) ?? 1);
  // Mühle und Bäckereien machen aus Getreide mehr Brot (Bäckerei nur so weit, wie die Mühle mahlt)
  const muehle = werkstatt(w, bes, "muehle", 1);
  const verarbeitung = 0.15 * muehle + 0.15 * Math.min(werkstatt(w, bes, "baecker", 2), 2 * muehle);
  const angebot = Math.round((ernte + einfuhr) * (1 + verarbeitung));
  return { angebot, bedarf, hoefe, angebunden, ernte: Math.round(ernte), einfuhr: Math.round(einfuhr), werkzeug: werkzeug - 1, verarbeitung };
}

/** Bauernhöfe, die über Wege einen Markt erreichen (30 Minuten mit dem Karren) */
const anbindungCache = new WeakMap<Welt, { schluessel: string; r: Uint8Array }>();
function marktAnbindung(w: Welt): Uint8Array {
  const schluessel = `${w.version.strassen}|${w.version.bauten}`;
  const c = anbindungCache.get(w);
  if (c && c.schluessel === schluessel) return c.r;
  const r = new Uint8Array(w.n * w.n), d = new Float32Array(w.n * w.n);
  for (const b of w.bauten) if (ANBIETER[b.bau]?.some(a => a.gut === "nahrung")) erreichbar(w, b, 30 * 3, r, d);
  anbindungCache.set(w, { schluessel, r });
  return r;
}

/** Steuerkraft, Zufriedenheit, Unterhalt (Dorfbauten und Feldwege halten die Bauern selbst instand) */
export function geldBilanz(w: Welt): { steuern: number; unterhalt: number } {
  const d = geldDetails(w);
  return { steuern: d.steuern, unterhalt: d.unterhalt };
}

/** Geld nach Posten: Steuern je Schicht, Unterhalt für Gebäude, Wege und Verwaltung */
export function geldDetails(w: Welt) {
  let kraft = 0, zufr = 0;
  const kraftJe = SCHICHTEN.map(() => 0);
  for (const h of w.haeuser) { const k = h.bewohner * SCHICHTEN[h.schicht].steuer; kraft += k; kraftJe[h.schicht] += k; zufr += h.versorgt; }
  const bes = besetzung(w);
  // Brauerei hebt die Zufriedenheit, Webereien bringen Tuch in den Fernhandel
  // Arbeitslosigkeit über 10 % drückt die Stimmung (und damit die Steuern)
  const unmut = Math.min(0.5, 1.5 * Math.max(0, bes.quoteArbeitslos - ARBEITSLOS.unmut));
  const zufriedenheit = Math.min(1, (w.haeuser.length ? zufr / w.haeuser.length : 1) + 0.1 * werkstatt(w, bes, "brauerei", 1)) * (1 - unmut);
  const handel = 1 + 0.1 * werkstatt(w, bes, "weberei", 3);
  const summe = steuern(kraft, zufriedenheit) * handel, verkauf = gewerbe(w, bes).summe;
  const bau = w.bauten.filter(b => !b.dorf).reduce((a, b) => a + kosten(b.bau), 0);
  // Verwaltung, Wache und Rat wachsen mit der Stadt: je Stufe 20 % mehr Unterhalt; ab der Handelsstadt dazu
  // Armenfürsorge, Stadtwache und Kanzlei je Einwohner — sonst häuft eine große Stadt endlos Geld an
  const aufschlag = 1 + 0.2 * Math.max(0, w.stufe - 1), strassen = stadtStrassen(w);
  const gebaeude = unterhalt(bau, 0) * aufschlag, wege = (unterhalt(0, strassen)) * aufschlag;
  const verwaltung = 0.015 * w.einwohner * Math.max(0, w.stufe - 2);
  return {
    steuern: summe + verkauf, unterhalt: gebaeude + wege + verwaltung, verkauf,
    steuernJe: kraftJe.map(k => (kraft ? (summe * k) / kraft : 0)), zufriedenheit, unmut, handel: handel - 1,
    gebaeude, wege, verwaltung, strassenfelder: strassen,
  };
}

/** Straßenfelder der Stadt (im erschlossenen Kreis um das Zentrum) */
function stadtStrassen(w: Welt): number {
  const z = zentrum(w);
  if (!z) return 0;
  const c = mitteVon(w, z), r2 = ((420 + 330 * w.stufe) / w.zelle) ** 2;
  let n = 0;
  for (const k of strassenListe(w)) if (((k % w.n) + 0.5 - c.x / w.zelle) ** 2 + (Math.floor(k / w.n) + 0.5 - c.y / w.zelle) ** 2 <= r2) n++;
  return n;
}

/** Anteil der Stadthäuser (ohne Bauernhöfe), die alle Grundbedürfnisse haben */
export function versorgungsQuote(w: Welt): number {
  const stadt = w.haeuser.filter(h => !h.bauer);
  return stadt.length ? stadt.filter(h => h.versorgt >= 0.999).length / stadt.length : 0;
}

/** Was für die nächste Stufe noch fehlt (leer = Aufstieg) */
export function naechsteStufeFehlt(w: Welt): string[] {
  const st = aufStufen(w.stil), nx = st[w.stufe + 1];
  if (!nx) return [];
  const aus: string[] = [];
  for (const b of st[w.stufe].braucht) if (!w.bauten.some(o => o.bau === b)) aus.push(`${BAUTEN[b].icon} ${BAUTEN[b].label}`);
  if (w.einwohner < nx.ab) aus.push(`${nx.ab.toLocaleString("de-DE")} Einwohner`);
  if (nx.quote && versorgungsQuote(w) < nx.quote) aus.push(`${Math.round(nx.quote * 100)} % der Häuser voll versorgt`);
  return aus;
}

/** ein Zeitschritt: Versorgung, Auf- und Abstieg, Zuzug, Dörfer wachsen, Geld, Stufe */
export function schritt(g: Gelaende, w: Welt): void {
  w.tick++;
  const abd = abdeckung(w);
  const st = aufStufen(w.stil);
  const { angebot, bedarf } = nahrungsBilanz(w, abd);
  const quote = bedarf ? Math.min(1, angebot / bedarf) : 1;
  // bei Mangel bekommen nur so viele Häuser Nahrung, wie da ist (gleichmäßig verteilt)
  const nahrungOk = (h: AufHaus) => quote >= 0.999 || ((h.i * 73 + h.j * 37) % 100) / 100 < quote;
  if (w.tick % 4 === 1) {
    const raus: AufHaus[] = [];
    // Aufstiegsbremse: es steigen nur so viele auf, dass die Betriebe ihrer Schicht besetzt bleiben
    // und die höhere Schicht Arbeit findet (offene Stellen oder Platz für Selbstständige)
    const bes0 = besetzung(w);
    const spielraum = [...bes0.frei], arbeitOben = bes0.fehlend.map((x, k) => x + bes0.selbstFrei[k]);
    for (const h of w.haeuser) {
      h.versorgt = versorgungVon(w, h, abd, nahrungOk);
      if (h.versorgt < 0.999) h.mangel += 4; else h.mangel = 0;
      // Aufstieg: Haus voll, alles da, was die nächste Schicht braucht, und die Stufe erlaubt es
      const hoeher = h.schicht + 1;
      if (!h.bauer && h.versorgt >= 0.999 && h.bewohner >= h.ziel && hoeher <= st[w.stufe].maxSchicht && hoeher < SCHICHTEN.length
        && versorgungVon(w, h, abd, nahrungOk, hoeher) >= 0.999 && spielraum[h.schicht] >= h.bewohner * ERWERBSQUOTE
        && arbeitOben[hoeher] >= h.bewohner * ERWERBSQUOTE) {
        spielraum[h.schicht] -= h.bewohner * ERWERBSQUOTE;
        arbeitOben[hoeher] -= h.bewohner * ERWERBSQUOTE;
        h.schicht = hoeher; w.version.haeuser++;
      }
      // Abstieg nach längerem Mangel; das unterste Stadthaus steht dann leer
      if (h.mangel >= 24) {
        h.mangel = 0;
        if (h.schicht > (h.bauer ? 0 : 1)) { h.schicht--; w.version.haeuser++; }
        else if (!h.bauer && h.versorgt < 0.5) raus.push(h);
      }
      hausWerte(w, h);
    }
    // ohne Arbeit: bei hoher Arbeitslosigkeit steigen Häuser der betroffenen Schicht ab, Handwerker ziehen weg
    if (bes0.quoteArbeitslos > ARBEITSLOS.abwanderung) {
      const k = bes0.arbeitslos.indexOf(Math.max(...bes0.arbeitslos));
      let rest = bes0.arbeitslos[k] - ARBEITSLOS.abwanderung * bes0.angebot[k];
      for (const h of w.haeuser) {
        if (rest <= 0) break;
        if (h.bauer || h.schicht !== k || raus.includes(h)) continue;
        rest -= h.bewohner * ERWERBSQUOTE;
        if (k > 1) { h.schicht--; w.version.haeuser++; hausWerte(w, h); } else raus.push(h);
        if (rest < 8) break;
      }
    }
    for (const h of raus) leere(w, h);
    if (raus.length) w.haeuser = w.haeuser.filter(h => !raus.includes(h));
  }
  // Bewohner ziehen nach und nach ein oder aus
  let summe = 0;
  for (const h of w.haeuser) { h.bewohner += Math.sign(h.ziel - h.bewohner); summe += h.bewohner; }
  w.einwohner = summe;
  // Zuzug in die Stadt: nur bei Nahrungsüberschuss
  const z = zentrum(w);
  const ohneArbeit = besetzung(w).quoteArbeitslos > ARBEITSLOS.zuzug;
  if (z && angebot > bedarf + 10 && !ohneArbeit) {
    const c = zufahrt(z.i, z.j, z.w, z.h, z.dreh);
    let neu = hausplaetze(g, w, 4, { i: c.i, j: c.j, r: w.strassenRadius, bauer: false, abd });
    // Straßennetz nur bis zum Rand des erschlossenen Lands weiterbauen
    const grenze = Math.ceil((420 + 330 * w.stufe) / w.zelle);
    if (neu.length < 4 && w.strassenRadius < grenze) {
      w.strassenRadius = Math.min(grenze, w.strassenRadius + 3);
      wohnstrassen(g, w, w.strassenRadius);
      bruecken(g, w);
      neu = hausplaetze(g, w, 4, { i: c.i, j: c.j, r: w.strassenRadius, bauer: false, abd: abdeckung(w) });
    }
    for (const h of neu.slice(0, Math.max(1, Math.floor((angebot - bedarf) / 8)))) setzeHaus(w, h);
    w.engpass = neu.length ? null : "platz";
  } else w.engpass = !z ? null : ohneArbeit ? "arbeit" : "nahrung";
  // Landesausbau: fehlt Nahrung, kommen neue Höfe in die Dörfer; dazu wachsen die Dörfer langsam mit der
  // Stadt, die ihnen das Getreide abnimmt (Absatzmarkt) — je Stufe dürfen sie größer werden
  if (z && ((angebot < bedarf * 1.1 && w.tick % 3 === 0) || w.tick % 10 === 5)) {
    const knapp = angebot < bedarf * 1.1;
    let gewollt = false, gebaut = false;
    for (const d of w.doerfer) {
      if (!knapp && (d.stadt || hoefeIm(w, d) >= DORF_HOEFE + 3 * w.stufe)) continue;
      gewollt = true;
      // neues Gehöft mit eigenem Acker; fehlt die Hofstelle, wird der Dorfweg verlängert
      if (neuerHof(g, w, d) || (dorfwegVerlaengern(g, w, d) && neuerHof(g, w, d))) { gebaut = true; break; }
    }
    // alles Land um die Dörfer ist vergeben: Bauern gründen ein neues Dorf
    if (gewollt && !gebaut && w.doerfer.length < MAX_DOERFER && w.tick % 30 < 10) gruendeDorf(g, w);
  }
  // Dorfhandwerk: ein großes Dorf bekommt seine eigene Schmiede (Werkzeug für die eigenen Höfe, kostet die Stadt nichts)
  if (z && w.tick % 10 === 7) {
    for (const d of w.doerfer) {
      if (d.stadt || hoefeIm(w, d) < DORF_SCHMIEDE || dorfSchmiede(w, d)) continue;
      for (let k = 0; k < 40; k++) {
        const a = k * 2.4, r0 = 4 + k * 0.4;
        if (setzeOhneKosten(g, w, "schmiede", Math.round(d.i + Math.cos(a) * r0), Math.round(d.j + Math.sin(a) * r0), k % 4)) break;
      }
    }
  }
  // Geld
  const geld = geldBilanz(w);
  w.taler += geld.steuern - geld.unterhalt;
  w.bilanz = { steuern: geld.steuern, unterhalt: geld.unterhalt, nahrung: angebot, bedarf };
  // Stufe
  if (w.stufe > 0 && w.stufe + 1 < st.length && !naechsteStufeFehlt(w).length) { w.stufe++; freischalten(w); }
}

export function hausFarben(stil: Stil) {
  const art = ZONEN[BAUPLAENE[stil].kern].haus as HausArt | null;
  return { fassade: art?.fassade ?? "#e6dccb", dach: art?.dach ?? "#9c5b44", flach: !!art?.flach };
}

// ---------------------------------------------------------------- Straßen zeichnen

export interface Kette { punkte: P[]; haupt: boolean }

/** Straßen als geglättete Linien zwischen Kreuzungen (Chaikin); dazu die Kreuzungsfelder */
export function strassenKetten(w: Welt, runden = 2): { ketten: Kette[]; knoten: number[] } {
  const n = w.n, z = w.zelle;
  const ist = (k: number) => w.feld[k] === STRASSE || w.feld[k] === HAUPT;
  const nachbarn = (k: number) => {
    const i = k % n, j = Math.floor(k / n), aus: number[] = [];
    if (i > 0 && ist(k - 1)) aus.push(k - 1);
    if (i < n - 1 && ist(k + 1)) aus.push(k + 1);
    if (j > 0 && ist(k - n)) aus.push(k - n);
    if (j < n - 1 && ist(k + n)) aus.push(k + n);
    return aus;
  };
  const mitte = (k: number): P => ({ x: ((k % n) + 0.5) * z, y: (Math.floor(k / n) + 0.5) * z });
  const liste = strassenListe(w);
  const knoten: number[] = [];
  const istKnoten = new Uint8Array(n * n);
  for (const k of liste) if (nachbarn(k).length !== 2) { knoten.push(k); istKnoten[k] = 1; }
  const gesehen = new Set<number>();
  const kante = (a: number, b: number) => (a < b ? a * n * n + b : b * n * n + a);
  const ketten: Kette[] = [];
  const verfolge = (start: number, erst: number) => {
    const zellen = [start];
    let vor = start, jetzt = erst;
    gesehen.add(kante(start, erst));
    for (;;) {
      zellen.push(jetzt);
      if (istKnoten[jetzt] || jetzt === start) break;
      const weiter = nachbarn(jetzt).find(x => x !== vor);
      if (weiter === undefined) break;
      gesehen.add(kante(jetzt, weiter));
      vor = jetzt; jetzt = weiter;
    }
    let pts = zellen.map(mitte);
    for (let r = 0; r < runden && pts.length > 2; r++) {
      const neu: P[] = [pts[0]];
      for (let i = 0; i + 1 < pts.length; i++) {
        const a = pts[i], b = pts[i + 1];
        if (i > 0) neu.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 });
        if (i + 2 < pts.length) neu.push({ x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
      }
      neu.push(pts[pts.length - 1]);
      pts = neu;
    }
    const haupt = zellen.filter(k => w.feld[k] === HAUPT).length * 2 >= zellen.length;
    ketten.push({ punkte: pts, haupt });
  };
  for (const k of knoten) for (const nb of nachbarn(k)) if (!gesehen.has(kante(k, nb))) verfolge(k, nb);
  for (const k of liste) if (!istKnoten[k]) for (const nb of nachbarn(k)) if (!gesehen.has(kante(k, nb))) verfolge(k, nb);
  return { ketten, knoten };
}

// ---------------------------------------------------------------- Spielstand

/** Spielstand als kompakter Text (Felder lauflängenkodiert); Version 2 mit Dörfern, Schichten, Geld */
export function welteAlsText(w: Welt): string {
  const n = w.n, rle: number[] = [];
  let alt = -1, zahl = 0;
  for (let k = 0; k < n * n; k++) {
    const v = w.feld[k] | (w.frei[k] << 3) | (w.trocken[k] << 4) | (w.acker[k] << 5);
    if (v === alt) zahl++;
    else { if (zahl) rle.push(alt, zahl); alt = v; zahl = 1; }
  }
  rle.push(alt, zahl);
  return JSON.stringify({
    v: 2, stil: w.stil, seed: w.seed, n, felder: rle,
    haeuser: w.haeuser.map(h => [h.i, h.j, h.dreh, h.bewohner, h.ziel, Math.round(h.versorgt * 100), Math.round(h.hoehe * 10), h.s, h.hof, h.schicht, h.mangel, h.tor, h.bauer ? 1 : 0, h.feld ?? 0]),
    bauten: w.bauten.map(b => [b.id, b.bau, b.i, b.j, b.w, b.h, Math.round(b.faktor * 100), b.dreh, b.dorf ? 1 : 0]),
    doerfer: w.doerfer.map(d => [d.name, d.i, d.j, d.stadt ? 1 : 0]),
    einwohner: w.einwohner, tick: w.tick, stufe: w.stufe, taler: Math.round(w.taler), strassenRadius: w.strassenRadius, naechsteId: w.naechsteId,
    bruecken: w.bruecken.map(b => [b.i, b.j]),
  });
}

/** Spielstand lesen; null, wenn er nicht zu Gelände und Stadttyp passt, veraltet oder kaputt ist */
export function welteAusText(text: string, g: Gelaende, stil: Stil): Welt | null {
  try {
    const d = JSON.parse(text);
    if (d.v !== 2 || d.stil !== stil || d.n !== g.n || d.seed !== g.wahl.seed) return null;
    const w = neueWelt(g, stil, d.seed, false);
    let k = 0;
    for (let x = 0; x + 1 < d.felder.length; x += 2) {
      const v = d.felder[x], z = d.felder[x + 1];
      for (let t = 0; t < z && k < w.n * w.n; t++, k++) { w.feld[k] = v & 7; w.frei[k] = (v >> 3) & 1; w.trocken[k] = (v >> 4) & 1; w.acker[k] = (v >> 5) & 3; }
    }
    if (k !== w.n * w.n) return null;
    w.haeuser = d.haeuser.map((h: number[]) => ({ i: h[0], j: h[1], dreh: h[2], bewohner: h[3], ziel: h[4], versorgt: h[5] / 100, hoehe: h[6] / 10, s: h[7], hof: h[8], schicht: h[9], mangel: h[10], tor: h[11], bauer: !!h[12], feld: h[12] ? (h[13] ?? FELD_JE_HOF) : undefined }));
    w.bauten = d.bauten.map((b: [number, BauTyp, number, number, number, number, number, number, number]) => ({ id: b[0], bau: b[1], i: b[2], j: b[3], w: b[4], h: b[5], faktor: b[6] / 100, dreh: b[7], dorf: !!b[8] }));
    w.doerfer = d.doerfer.map((x: [string, number, number, number]) => ({ name: x[0], i: x[1], j: x[2], stadt: !!x[3] }));
    w.einwohner = d.einwohner; w.tick = d.tick; w.stufe = d.stufe; w.taler = d.taler; w.strassenRadius = d.strassenRadius; w.naechsteId = d.naechsteId;
    w.bruecken = d.bruecken.map((b: number[]) => ({ i: b[0], j: b[1] }));
    w.version = { strassen: 1, haeuser: 1, bauten: 1 };
    // Bilanz gleich zeigen, nicht erst nach dem ersten Schritt
    const nb = nahrungsBilanz(w), gb = geldBilanz(w);
    w.bilanz = { steuern: gb.steuern, unterhalt: gb.unterhalt, nahrung: nb.angebot, bedarf: nb.bedarf };
    return w;
  } catch {
    return null;
  }
}

/** größte Reichweite eines Gebäudes in Metern Weg (für den Kreis in der Ansicht) */
export const reichweite = (b: BauTyp) => Math.max(0, ...(ANBIETER[b] ?? []).map(a => a.minuten * METER_JE_MINUTE));
