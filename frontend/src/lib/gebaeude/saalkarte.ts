/**
 * Gebäudekarten (Antike, Burg, Viktorianisch, Neon) aus den Spielalgorithmen:
 *
 *  1. Ablauf (zyklisch.ts): Start und Ziel auf einer Schleife, Stationen auf den Bögen.
 *  2. Fläche teilen (bsp.ts): In jedes Endstück passt ein Saal mit geraden Kanten, geraden Feldzahlen
 *     (Decken- und Säulenmodule sind 2 Felder = 2,8 m) und mindestens 8 × 8 Feldern.
 *  3. Jeder Knoten des Ablaufs bekommt den Saal, der seiner Lage im Graphen am nächsten liegt;
 *     nicht gebrauchte Säle bleiben Mauerwerk.
 *  4. Jede Kante des Ablaufs wird ein Gang (3 Felder breit) in I-, L- oder Z-Form (wie lGang/zGang
 *     in bsp.ts). Er beginnt und endet an Durchgängen: 2 Felder breit, auf gerade Felder ausgerichtet,
 *     so tief wie die Wand. Gänge laufen nie durch fremde Säle oder deren Wände.
 *  5. Wand um jeden Saal: 1 Feld, in der Antike 2 Felder (Kolonnaden sind 2,8 m tief).
 *  6. Antike: Die Ebene beginnt auf einem Vorplatz unter freiem Himmel (18 × 34 Felder) mit dem Tempel (18 × 40 m),
 *     die Freitreppe zur Ankunft; ein Gang führt vom Rand des Platzes zum Startsaal des Ablaufs.
 */
import { erzeugeBsp, neuerBsp, type Rechteck } from "@/lib/spielalgo/bsp";
import type { FreiEbene } from "./frei";
import type { Punkt } from "./plan";
import { PLATZ, WAND, WEG, knotenReihenfolge, knotenZiele, ordneZu, planeAblauf, zufall, type Durchgang, type Geplant, type Saal, type Vorplatz } from "./karte";
import { alleErreichbar, stationenNachWeg } from "./lichtung";

export const DURCHGANG_FELD = 3;
/** kleinste Saalseite (gerade) */
export const SAAL_MIN = 8;

export interface SaalWahl {
  /** Wanddicke um jeden Saal (Antike 2) */
  wand: number;
  /** Vorplatz mit Tempel am Anfang (Antike) */
  vorplatz?: boolean;
}

type Seite = "N" | "S" | "W" | "O";
const NORMALE: Record<Seite, [number, number]> = { N: [0, -1], S: [0, 1], W: [-1, 0], O: [1, 0] };

interface Anker {
  /** linke obere Ecke des 3×3-Pinsels direkt vor der Wand */
  px: number; py: number;
  seite: Seite;
  tuer: Durchgang;
}

/** Durchgang auf Seite `s` des Saals `R` an Stelle `o` (gerade), dazu der Pinsel davor */
function anker(R: Rechteck, s: Seite, o: number, wand: number, saal: number): Anker {
  const [dx, dy] = NORMALE[s];
  if (s === "N" || s === "S") {
    const y = s === "N" ? R.y - wand : R.y + R.h;
    return { px: o, py: s === "N" ? R.y - wand - 3 : R.y + R.h + wand, seite: s, tuer: { x: o, y, dx, dy, breite: 2, tiefe: wand, saal } };
  }
  const x = s === "W" ? R.x - wand : R.x + R.b;
  return { px: s === "W" ? R.x - wand - 3 : R.x + R.b + wand, py: o, seite: s, tuer: { x, y: o, dx, dy, breite: 2, tiefe: wand, saal } };
}

/** gerade Stellen längs einer Seite, an denen ein 2 Felder breiter Durchgang Platz hat */
function stellen(R: Rechteck, s: Seite): number[] {
  const [a, l] = s === "N" || s === "S" ? [R.x, R.b] : [R.y, R.h];
  const aus: number[] = [];
  for (let o = a + 2; o <= a + l - 4; o += 2) aus.push(o);
  return aus;
}

/** Weg von Anker a nach b mit höchstens zwei Knicken (Pinsel-Ecken); null, wenn die Richtungen nicht passen */
function route(a: Anker, b: Anker): Punkt[] | null {
  const waag = (s: Seite) => s === "W" || s === "O";
  const [adx, ady] = NORMALE[a.seite], [bdx, bdy] = NORMALE[b.seite];
  // a läuft in Richtung seiner Normale los, b wird entgegen seiner Normale erreicht
  const passt = (vx: number, vy: number, dx: number, dy: number) => vx * dx + vy * dy >= 0;
  if (waag(a.seite) && waag(b.seite)) {
    if (adx !== -bdx) return null;
    if (a.py === b.py) return passt(b.px - a.px, 0, adx, 0) ? [[a.px, a.py], [b.px, b.py]] : null;
    const m = Math.round((a.px + b.px) / 2);
    if (!passt(m - a.px, 0, adx, 0) || !passt(b.px - m, 0, adx, 0) || Math.abs(m - a.px) < 2 || Math.abs(b.px - m) < 2) return null;
    return [[a.px, a.py], [m, a.py], [m, b.py], [b.px, b.py]];
  }
  if (!waag(a.seite) && !waag(b.seite)) {
    if (ady !== -bdy) return null;
    if (a.px === b.px) return passt(0, b.py - a.py, 0, ady) ? [[a.px, a.py], [b.px, b.py]] : null;
    const m = Math.round((a.py + b.py) / 2);
    if (!passt(0, m - a.py, 0, ady) || !passt(0, b.py - m, 0, ady) || Math.abs(m - a.py) < 2 || Math.abs(b.py - m) < 2) return null;
    return [[a.px, a.py], [a.px, m], [b.px, m], [b.px, b.py]];
  }
  // L: erst längs a, dann längs b
  const ecke: Punkt = waag(a.seite) ? [b.px, a.py] : [a.px, b.py];
  if (!passt(ecke[0] - a.px, ecke[1] - a.py, adx, ady) || !passt(b.px - ecke[0], b.py - ecke[1], -bdx, -bdy)) return null;
  return [[a.px, a.py], ecke, [b.px, b.py]];
}

/** Felder eines Gangs: Pinsel 3×3 von Ecke zu Ecke */
function gangFelder(weg: Punkt[], B: number): number[] {
  const aus: number[] = [];
  for (let i = 0; i < weg.length - 1; i++) {
    const [ax, ay] = weg[i], [bx, by] = weg[i + 1];
    for (let y = Math.min(ay, by); y <= Math.max(ay, by) + 2; y++) for (let x = Math.min(ax, bx); x <= Math.max(ax, bx) + 2; x++) aus.push(y * B + x);
  }
  if (weg.length === 1) for (let y = weg[0][1]; y <= weg[0][1] + 2; y++) for (let x = weg[0][0]; x <= weg[0][0] + 2; x++) aus.push(y * B + x);
  return aus;
}

function versuch(zimmer: number, seed: number, wahl: SaalWahl): FreiEbene | null {
  const r = zufall(seed);
  const g: Geplant = planeAblauf(zimmer, r);
  const n = g.ablauf.knoten.length;
  const wand = wahl.wand;
  const rand = wand + 2; // Abstand des Saals zum Rand seines Endstücks: Wand plus Platz für Gänge
  const min = SAAL_MIN + 2 * rand + 1;
  // Fläche: etwa 1,6 Endstücke je Knoten
  let B = Math.max(40, Math.ceil(Math.sqrt(n * 1.7) * (min + 3)));
  B += B % 2;
  /** Streifen links für den Vorplatz: Rand, Wand, 18 Felder Platz, Wand, Abstand */
  const VP = { b: 18, h: 34 };
  const S = wahl.vorplatz ? 4 + VP.b + wand + 2 : 0;
  if (wahl.vorplatz) B = Math.max(B + S, VP.h + 2 * wand + 8);
  B += B % 2;
  for (let groesser = 0; groesser < 5; groesser++, B += 8) {
    const bsp = neuerBsp({ b: B - S, h: B, min, tiefe: 8, fuellung: 1, schnitt: "laenger", streuung: 0.7, gang: "L", rundgaenge: 0 });
    const it = erzeugeBsp(bsp, r);
    while (!it.next().done) { /* bis zum Ende */ }
    // Säle in die Endstücke: gerade Lage, gerade Größe, mindestens SAAL_MIN
    const saeleRoh: Rechteck[] = [];
    for (const k of bsp.knoten) {
      if (k.kinder) continue;
      k.r.x += S;
      const x0 = k.r.x + rand + ((k.r.x + rand) % 2), x1 = k.r.x + k.r.b - rand;
      const y0 = k.r.y + rand + ((k.r.y + rand) % 2), y1 = k.r.y + k.r.h - rand;
      const maxB = (x1 - x0) - ((x1 - x0) % 2), maxH = (y1 - y0) - ((y1 - y0) % 2);
      if (maxB < SAAL_MIN || maxH < SAAL_MIN) continue;
      const b = Math.min(maxB, SAAL_MIN + 2 * Math.floor(r() * ((Math.min(maxB, 16) - SAAL_MIN) / 2 + 1)));
      const h = Math.min(maxH, SAAL_MIN + 2 * Math.floor(r() * ((Math.min(maxH, 16) - SAAL_MIN) / 2 + 1)));
      const x = x0 + 2 * Math.floor(r() * ((maxB - b) / 2 + 1)), y = y0 + 2 * Math.floor(r() * ((maxH - h) / 2 + 1));
      saeleRoh.push({ x, y, b, h });
    }
    if (saeleRoh.length < n) continue;
    const mitte = (R: Rechteck): [number, number] => [R.x + R.b / 2, R.y + R.h / 2];
    let ziele = knotenZiele(g.ablauf, B, min / 2, r);
    if (S) {
      // der Start liegt nah am Vorplatz (links)
      const links = ziele[0][0] <= ziele[1][0];
      ziele = ziele.map(([x, y]) => [S + ((links ? x : B - x) / B) * (B - S), y]);
    }
    const zu = ordneZu(ziele, saeleRoh.map(mitte), knotenReihenfolge(g.ablauf));
    if (!zu) continue;
    const R = zu.map(i => saeleRoh[i]);
    let vorplatz: Vorplatz | undefined;
    if (S) {
      const y = 4 + 2 * Math.floor(r() * ((B - VP.h - 8) / 2 + 1));
      const platz = { x: 4, y, b: VP.b, h: VP.h };
      vorplatz = { platz, kern: { x: platz.x + 3, y: platz.y + 3, b: 12, h: 26 } };
      R.push(platz);
    }

    // Sperrfläche: jeder Saal samt Wand
    const art = new Uint8Array(B * B);
    const sperre = new Uint8Array(B * B);
    for (const q of R) {
      for (let y = q.y - wand; y < q.y + q.h + wand; y++) for (let x = q.x - wand; x < q.x + q.b + wand; x++) sperre[y * B + x] = 1;
      for (let y = q.y; y < q.y + q.h; y++) for (let x = q.x; x < q.x + q.b; x++) art[y * B + x] = PLATZ;
    }
    const durchgaenge: Durchgang[] = [];
    const tuerBelegt = new Set<string>();
    let ok = true;
    const kanten: [number, number][] = [];
    for (const k of g.ablauf.kanten) {
      if (k.art === "sicht" || kanten.some(([a, b]) => (a === k.a && b === k.b) || (a === k.b && b === k.a))) continue;
      kanten.push([k.a, k.b]);
    }
    if (vorplatz) kanten.push([R.length - 1, 0]);
    for (const [i, j] of kanten) {
      let best: { weg: Punkt[]; a: Anker; b: Anker; kosten: number } | null = null;
      for (const sa of ["N", "S", "W", "O"] as Seite[]) for (const sb of ["N", "S", "W", "O"] as Seite[]) {
        for (const oa of stellen(R[i], sa)) for (const ob of stellen(R[j], sb)) {
          if (tuerBelegt.has(`${i}${sa}${oa}`) || tuerBelegt.has(`${j}${sb}${ob}`)) continue;
          const a = anker(R[i], sa, oa, wand, i), b = anker(R[j], sb, ob, wand, j);
          const weg = route(a, b);
          if (!weg) continue;
          const felder = gangFelder(weg, B);
          if (felder.some(f => f < 0 || f >= B * B || sperre[f] || f % B < 1 || f % B >= B - 1 || f < B || f >= B * (B - 1))) continue;
          // Pinselränder dürfen nicht über den Zeilenrand laufen
          let laenge = 0;
          for (let w = 0; w < weg.length - 1; w++) laenge += Math.abs(weg[w + 1][0] - weg[w][0]) + Math.abs(weg[w + 1][1] - weg[w][1]);
          // vorhandene Gänge mitbenutzen ist billig, neue Flächen kosten
          const neu = felder.filter(f => art[f] !== WEG).length;
          const kosten = neu + 8 * (weg.length - 2) + r() * 3 + laenge * 0.1;
          if (!best || kosten < best.kosten) best = { weg, a, b, kosten };
        }
      }
      if (!best) { ok = false; break; }
      for (const f of gangFelder(best.weg, B)) art[f] = WEG;
      for (const [an, s] of [[best.a, best.a.seite], [best.b, best.b.seite]] as [Anker, Seite][]) {
        const t = an.tuer;
        tuerBelegt.add(`${t.saal}${s}${s === "N" || s === "S" ? t.x : t.y}`);
        durchgaenge.push(t);
      }
    }
    if (!ok) continue;
    // Durchgänge durch die Wand schlagen
    for (const t of durchgaenge) {
      for (let q = 0; q < t.tiefe; q++) for (let w = 0; w < t.breite; w++) {
        const x = t.dx ? t.x + q : t.x + w, y = t.dy ? t.y + q : t.y + w;
        art[y * B + x] = 3;
      }
    }

    const pos: Punkt[] = R.map(q => [q.x + Math.floor(q.b / 2), q.y + Math.floor(q.h / 2)]);
    if (vorplatz) {
      // Tempelkern ist Mauer; die Ankunft liegt vor der Freitreppe
      const k = vorplatz.kern;
      for (let y = k.y; y < k.y + k.h; y++) for (let x = k.x; x < k.x + k.b; x++) art[y * B + x] = WAND;
      pos[R.length - 1] = [vorplatz.platz.x + 9, vorplatz.platz.y + vorplatz.platz.h - 3];
    }
    const e: FreiEbene = { b: B, h: B, art, start: vorplatz ? pos[R.length - 1] : pos[0], ziel: pos[1], raeume: [], vorplatz };
    const raeume = stationenNachWeg(e, e.start, g.stationen.map(k => pos[k]), Math.min(...g.stationen.map(k => Math.min(R[k].b, R[k].h))) / 2 - 1);
    if (!raeume) continue;
    e.raeume = raeume;
    e.saele = R.map((q, k): Saal => ({
      art: k >= n ? "vorplatz" : k === 0 ? "start" : k === 1 ? "ziel" : g.stationen.includes(k) ? "station" : "halle",
      x: q.x, y: q.y, b: q.b, h: q.h, mx: pos[k][0], my: pos[k][1], knoten: k,
    }));
    e.durchgaenge = durchgaenge;
    e.ablauf = { ...g.ablauf, zyklus: g.zyklus, saal: R.map((_, k) => k) };
    return e;
  }
  return null;
}

/** Eine Gebäudekarte mit `zimmer` Stationen; gleicher Seed, gleiche Karte */
export function saalEbene(zimmer: number, seed: number, wahl: SaalWahl = { wand: 1 }): FreiEbene {
  for (let v = 0; v < 40; v++) {
    const e = versuch(zimmer, seed * 389 + v * 41 + 3, wahl);
    if (e && alleErreichbar(e)) return e;
  }
  throw new Error("Gebäudekarte ließ sich nicht bauen");
}

