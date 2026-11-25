/**
 * Lichtungskarten für die Naturwelten der freien 3D-Ansicht: Lichtungen im Wald, verbunden durch
 * geschwungene Pfade, mit Rundwegen und wahlweise einem Bach. Gebaut aus den Spielalgorithmen:
 *
 *  1. Ablauf (zyklisch.ts über karte.ts): Start und Ziel auf einer Schleife, Stationen auf den Bögen.
 *  2. Orte (verteilen.ts): Poisson-Scheiben liefern Lichtungen mit Mindestabstand; jeder Knoten
 *     des Ablaufs nimmt die Lichtung, die seiner Lage im Graphen am nächsten liegt.
 *  3. Pfade (wege.ts, A*) je Kante des Ablaufs über ein Kostenfeld aus Rauschen (rauschen.ts, fbm),
 *     damit sie sich winden; dann geglättet (Chaikin) und 3–4 Felder breit gezogen.
 *  4. Lichtungen als rundliche Flecken mit welligem Rand (Station etwa 7 × 7 Felder, Ziel ≥ 9 × 9).
 *  5. Bach (wahlweise): eine Rauschlinie von Rand zu Rand, um die Lichtungen herum. Wo er einen Pfad
 *     kreuzt, läuft der Pfad 7 Felder geradeaus quer zum Bach: dort steht eine Brücke (9,8 m).
 *
 * Ergebnis ist eine FreiEbene (Felder WAND/WEG/PLATZ), dazu `wasser`, `bruecken`, `saele` und `ablauf`.
 */
import type { FreiEbene, FreiRaum } from "./frei";
import type { Punkt } from "./plan";
import { neuerPoisson, poisson } from "@/lib/spielalgo/verteilen";
import { fbm, gradientRauschen } from "@/lib/spielalgo/rauschen";
import {
  PLATZ, WAND, WEG, abstaende, ausduennen, chaikin, fleckSaal, knotenReihenfolge, knotenZiele, kreuzen, ordneZu, planeAblauf,
  scheibe, suchWeg, zufall, type Geplant, type KartenAblauf, type Saal,
} from "./karte";

export interface Bruecke {
  /** Mitte in Feldern (Bruchteile erlaubt) */
  x: number;
  y: number;
  /** Richtung des Pfads über die Brücke (Bogenmaß, 0 = +x) */
  winkel: number;
  /** Länge über das Wasser in Feldern */
  lang: number;
}

export interface LichtungsWahl {
  /** ein Bach quer durch die Karte, mit Brücken */
  bach?: boolean;
}

/** halbe Breite der Lichtungen (Felder): Station etwa 7 × 7, mit Rand */
export const LICHTUNG = 5.2;
/** Mindestabstand der Lichtungsmitten (Felder) */
const ABSTAND = 17;
const RAND = 7;
/** Brücke: so viele Felder läuft der Pfad geradeaus quer über den Bach */
export const BRUECKE_LANG = 7;

/** Orte für die Knoten des Ablaufs: Poisson-Scheiben im Innern der Karte */
export function lichtungsOrte(B: number, rand: number, abstand: number, r: () => number): [number, number][] {
  const s = neuerPoisson(B - 2 * rand, B - 2 * rand, abstand, 30);
  const it = poisson(s, r);
  while (!it.next().done) { /* bis zum Ende */ }
  return s.punkte.map(p => [Math.round(p.x) + rand, Math.round(p.y) + rand]);
}

/**
 * Den Ablauf auf Orte legen: Kartengröße so lange vergrößern, bis genug Poisson-Orte da sind;
 * Kanten dürfen sich nicht kreuzen. Gibt die Kartenbreite und die Mitte je Knoten zurück.
 */
export function legeAblauf(g: Geplant, abstand: number, rand: number, r: () => number): { B: number; pos: Punkt[]; kanten: [number, number][] } | null {
  const n = g.ablauf.knoten.length;
  const kanten: [number, number][] = [];
  for (const k of g.ablauf.kanten) {
    if (k.art === "sicht" || kanten.some(([a, b]) => (a === k.a && b === k.b) || (a === k.b && b === k.a))) continue;
    kanten.push([k.a, k.b]);
  }
  let B = Math.max(40, Math.round(Math.sqrt(n * abstand * abstand * 1.3)) + 2 * rand);
  for (let versuch = 0; versuch < 6; versuch++, B += 4) {
    const orte = lichtungsOrte(B, rand, abstand, r);
    const zu = ordneZu(knotenZiele(g.ablauf, B, rand, r), orte, knotenReihenfolge(g.ablauf));
    if (!zu) continue;
    const pos = zu.map(i => orte[i] as Punkt);
    const gekreuzt = kanten.some(([a, b], i) => kanten.some(([c, d], j) => j > i && a !== c && a !== d && b !== c && b !== d && kreuzen(pos[a], pos[b], pos[c], pos[d])));
    if (gekreuzt) continue;
    return { B, pos, kanten };
  }
  return null;
}

/** Kostenfeld aus fbm-Rauschen: 1 (bequem) bis 10 (Dickicht); Randfelder gesperrt */
export function rauschKosten(B: number, seed: number, weite: number, staerke = 9): { kosten: Uint8Array; welle: Float32Array } {
  const rs = gradientRauschen(seed);
  const kosten = new Uint8Array(B * B), welle = new Float32Array(B * B);
  for (let y = 0; y < B; y++) for (let x = 0; x < B; x++) {
    const w = (fbm(rs, x / weite, y / weite, 3) + 1) / 2;
    welle[y * B + x] = w;
    kosten[y * B + x] = x < 1 || y < 1 || x >= B - 1 || y >= B - 1 ? 0 : 1 + Math.round(Math.max(0, Math.min(1, w)) * staerke);
  }
  return { kosten, welle };
}

/** Pfad je Kante: A* über das Kostenfeld, fremde Orte kosten viel; geglättet und mit Pinsel `rad(x, y, n)` gezogen */
export function ziehePfade(B: number, art: Uint8Array, kosten: Uint8Array, pos: Punkt[], kanten: [number, number][], meide: number,
  rad: (x: number, y: number, n: number) => number) {
  for (const [i, j] of kanten) {
    const k2 = kosten.slice();
    pos.forEach((p, k) => {
      if (k !== i && k !== j) scheibe(B, B, p[0] + 0.5, p[1] + 0.5, meide, f => { if (k2[f]) k2[f] = Math.min(255, k2[f] + 60); });
    });
    const weg = suchWeg(B, B, k2, pos[i], pos[j]);
    chaikin(ausduennen(weg), 3).forEach(([x, y], n) => scheibe(B, B, x, y, rad(x, y, n), f => { if (art[f] === WAND) art[f] = WEG; }));
  }
}

/**
 * Bach von einem Rand zum gegenüberliegenden, weit um die Orte herum (Kosten aus `welle`). An jeder Kreuzung
 * mit einem Pfad wird der Pfad geradeaus quer zum Bach gezogen (BRUECKE_LANG Felder, 3 breit): die Brücke.
 * Gibt null zurück, wenn der Bach zu lange neben einem Pfad läuft (dann passt keine Brücke).
 */
export function legeBach(B: number, art: Uint8Array, orte: Punkt[], meide: number, welle: Float32Array, rad: number, r: () => number):
  { wasser: Uint8Array; bruecken: Bruecke[]; lauf: [number, number][] } | null {
  const bk = new Uint8Array(B * B);
  for (let i = 0; i < B * B; i++) bk[i] = 1 + Math.round(welle[i] * 10);
  for (const p of orte) scheibe(B, B, p[0] + 0.5, p[1] + 0.5, meide, f => { bk[f] = Math.min(255, bk[f] + 120); });
  // nicht am Kartenrand entlang: dort sieht ihn niemand und er kreuzt keinen Weg
  for (let y = 0; y < B; y++) for (let x = 0; x < B; x++) {
    const rand = Math.min(x, y, B - 1 - x, B - 1 - y);
    if (rand < RAND + 2) bk[y * B + x] = Math.min(255, bk[y * B + x] + (RAND + 2 - rand) * 12);
    if (rand < 1) bk[y * B + x] = 0;
  }
  // Wege lieber im rechten Winkel kreuzen: Wegfelder kosten mehr
  for (let i = 0; i < B * B; i++) if (art[i] === WEG && bk[i]) bk[i] = Math.min(255, bk[i] + 25);
  const quer = r() < 0.5;
  const a: Punkt = quer ? [1, Math.floor(B * (0.3 + r() * 0.4))] : [Math.floor(B * (0.3 + r() * 0.4)), 1];
  const b: Punkt = quer ? [B - 2, Math.floor(B * (0.3 + r() * 0.4))] : [Math.floor(B * (0.3 + r() * 0.4)), B - 2];
  bk[a[1] * B + a[0]] = bk[a[1] * B + a[0]] || 1;
  bk[b[1] * B + b[0]] = bk[b[1] * B + b[0]] || 1;
  const lauf = chaikin(ausduennen(suchWeg(B, B, bk, a, b)), 3);
  const wasser = new Uint8Array(B * B);
  lauf.forEach(([x, y]) => scheibe(B, B, x, y, rad, f => { if (art[f] !== PLATZ) wasser[f] = 1; }));
  // Kreuzungen: zusammenhängende Stücke, wo Bach und Pfad sich treffen
  const bruecken: Bruecke[] = [];
  const gesehen = new Uint8Array(B * B);
  const steg: number[] = [];
  for (let i = 0; i < B * B; i++) {
    if (!wasser[i] || art[i] !== WEG || gesehen[i]) continue;
    const stueck: number[] = [], offen = [i];
    gesehen[i] = 1;
    while (offen.length) {
      const k = offen.pop()!;
      stueck.push(k);
      const x = k % B, y = (k - x) / B;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const j = (y + dy) * B + x + dx;
        if (wasser[j] && art[j] === WEG && !gesehen[j]) { gesehen[j] = 1; offen.push(j); }
      }
    }
    const xs = stueck.map(k => k % B), ys = stueck.map(k => Math.floor(k / B));
    // ein Bach, der lange neben bzw. auf dem Pfad läuft, passt unter keine Brücke
    if (Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) > 6.5) return null;
    const mx = xs.reduce((s, v) => s + v, 0) / xs.length + 0.5, my = ys.reduce((s, v) => s + v, 0) / ys.length + 0.5;
    let bi = 0, bd = Infinity;
    lauf.forEach(([x, y], n) => { const d = (x - mx) ** 2 + (y - my) ** 2; if (d < bd) { bd = d; bi = n; } });
    const [p0, p1] = [lauf[Math.max(0, bi - 2)], lauf[Math.min(lauf.length - 1, bi + 2)]];
    const winkel = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]) + Math.PI / 2;
    bruecken.push({ x: mx, y: my, winkel, lang: BRUECKE_LANG });
    // der Pfad läuft geradeaus über die Brücke: Streifen BRUECKE_LANG × 3 Felder quer zum Bach
    const ux = Math.cos(winkel), uy = Math.sin(winkel);
    for (let t = -BRUECKE_LANG / 2; t <= BRUECKE_LANG / 2; t += 0.25) for (let s = -1.5; s <= 1.5; s += 0.25) {
      const fx = Math.floor(mx + ux * t - uy * s), fy = Math.floor(my + uy * t + ux * s);
      if (fx < 1 || fy < 1 || fx >= B - 1 || fy >= B - 1) continue;
      steg.push(fy * B + fx);
    }
  }
  for (const i of steg) if (art[i] === WAND) art[i] = WEG;
  const aufSteg = new Uint8Array(B * B);
  for (const i of steg) aufSteg[i] = 1;
  // Bachfelder sind nicht begehbar, außer auf dem Brückensteg
  for (let i = 0; i < B * B; i++) if (wasser[i] && art[i] === WEG && !aufSteg[i]) art[i] = WAND;
  return { wasser, bruecken, lauf };
}

/** Säle und Ablauf aus den Knoten (Flecken um die Mitten) */
export function fleckSaele(e: { b: number; h: number; art: Uint8Array }, g: Geplant, pos: Punkt[], rad: number): { saele: Saal[]; ablauf: KartenAblauf } {
  const saele = pos.map((p, k) => fleckSaal(e, k === 0 ? "start" : k === 1 ? "ziel" : g.stationen.includes(k) ? "station" : "halle", p, rad, k));
  return { saele, ablauf: { ...g.ablauf, zyklus: g.zyklus, saal: pos.map((_, k) => k) } };
}

/** Stationen in der Reihenfolge ihrer Entfernung von der Ankunft */
export function stationenNachWeg(e: { b: number; h: number; art: Uint8Array }, start: Punkt, orte: Punkt[], r: number): FreiRaum[] | null {
  const d = abstaende(e, start);
  const mit = orte.map(([x, y]) => ({ x, y, r, d: d[y * e.b + x] }));
  if (mit.some(m => m.d < 0)) return null;
  return mit.sort((a, b) => a.d - b.d).map(({ x, y }) => ({ x, y, r }));
}

function versuch(zimmer: number, seed: number, wahl: LichtungsWahl): FreiEbene | null {
  const r = zufall(seed);
  const g = planeAblauf(zimmer, r);
  const lage = legeAblauf(g, ABSTAND, RAND, r);
  if (!lage) return null;
  const { B, pos, kanten } = lage;
  const art = new Uint8Array(B * B);
  const { kosten, welle } = rauschKosten(B, seed, 7);
  const fein = rauschKosten(B, seed + 101, 2.5).welle;

  // Pfade 3–4 Felder breit
  ziehePfade(B, art, kosten, pos, kanten, LICHTUNG + 3, (x, y, n) => 1.6 + 0.35 * fein[Math.floor(y) * B + Math.floor(x)] + (n % 7 === 0 ? 0.1 : 0));

  // Lichtungen: rundlich mit welligem Rand; das Ziel etwas größer (Steinkreis ≥ 9 × 9)
  pos.forEach(([x, y], k) => {
    const phase = r() * 6.28, phase2 = r() * 6.28, extra = k === 1 ? 0.8 : 0;
    for (let fy = y - 10; fy <= y + 10; fy++) for (let fx = x - 10; fx <= x + 10; fx++) {
      if (fx < 1 || fy < 1 || fx >= B - 1 || fy >= B - 1) continue;
      const dx = fx - x, dy = fy - y, w = Math.atan2(dy, dx);
      const rad = LICHTUNG + 1.2 + extra + 0.45 * Math.sin(3 * w + phase) + 0.3 * Math.sin(5 * w + phase2);
      if (Math.hypot(dx, dy) <= rad) art[fy * B + fx] = PLATZ;
    }
  });

  let wasser: Uint8Array | undefined, bruecken: Bruecke[] | undefined;
  if (wahl.bach) {
    const bach = legeBach(B, art, pos, LICHTUNG + 3, welle, 1.75, r);
    if (!bach) return null;
    ({ wasser, bruecken } = bach);
  }

  const e: FreiEbene = { b: B, h: B, art, start: pos[0], ziel: pos[1], raeume: [], wasser, bruecken };
  const raeume = stationenNachWeg(e, pos[0], g.stationen.map(k => pos[k]), LICHTUNG);
  if (!raeume) return null;
  e.raeume = raeume;
  Object.assign(e, fleckSaele(e, g, pos, LICHTUNG + 2.5));
  return e;
}

/** Eine Lichtungskarte mit `zimmer` Stationen; gleicher Seed, gleiche Karte */
export function lichtungsEbene(zimmer: number, seed: number, wahl: LichtungsWahl = {}): FreiEbene {
  for (let v = 0; v < 30; v++) {
    const e = versuch(zimmer, seed * 977 + v * 31 + 5, wahl);
    if (e && alleErreichbar(e)) return e;
  }
  throw new Error("Lichtungskarte ließ sich nicht bauen");
}

/** alle Stationen und das Ziel von der Ankunft aus erreichbar? */
export function alleErreichbar(e: FreiEbene): boolean {
  const d = abstaende(e, e.start);
  return [e.ziel, ...e.raeume.map(p => [p.x, p.y] as Punkt)].every(([x, y]) => d[y * e.b + x] >= 0);
}
