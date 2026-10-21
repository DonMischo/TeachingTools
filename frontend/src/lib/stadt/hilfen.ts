/** Bausteine für das Wachstum der Städte (alle Stile) */
import { inAue, istWasser, neigungBei, type Gelaende } from "@/lib/gelaende/gelaende";
import { abstand, inPoly, punktBei, rechteck, zurLinie, type P } from "./geometrie";
import { BAUTEN, type Bau, type BauTyp, type Stadt, type Strasse, type StrassenArt } from "./modell";
import { randPunkt, weg } from "./wege";

export type Z = () => number;

// ---------------------------------------------------------------- Hilfen

/** Band um einen Linienzug als Polygon */
export function band(l: P[], breite: number): P[] {
  if (l.length < 2) return [];
  const links: P[] = [], rechts: P[] = [];
  for (let i = 0; i < l.length; i++) {
    const a = l[Math.max(0, i - 1)], b = l[Math.min(l.length - 1, i + 1)];
    const d = abstand(a, b) || 1;
    const nx = -(b.y - a.y) / d, ny = (b.x - a.x) / d;
    links.push({ x: l[i].x + nx * breite / 2, y: l[i].y + ny * breite / 2 });
    rechts.push({ x: l[i].x - nx * breite / 2, y: l[i].y - ny * breite / 2 });
  }
  return [...links, ...rechts.reverse()];
}

/** Linienzug fein abtasten und an Wasser (bzw. Meer) zerschneiden */
export function zerschneiden(l: P[], g: Gelaende, nurMeer = false): P[][] {
  const aus: P[][] = [];
  let cur: P[] = [];
  const nass = (p: P) => (nurMeer ? g.wasser[Math.floor(Math.max(0, Math.min(g.n - 1, p.y / g.zelle))) * g.n + Math.floor(Math.max(0, Math.min(g.n - 1, p.x / g.zelle)))] === 2 : istWasser(g, p.x, p.y));
  for (let i = 0; i + 1 < l.length; i++) {
    const a = l[i], b = l[i + 1], d = abstand(a, b);
    const k = Math.max(1, Math.ceil(d / 6));
    for (let s = 0; s <= k; s++) {
      if (s === 0 && i > 0) continue;
      const p = { x: a.x + (b.x - a.x) * s / k, y: a.y + (b.y - a.y) * s / k };
      const draussen = p.x < 0 || p.y < 0 || p.x > g.breite || p.y > g.breite;
      if (nass(p) || draussen) { if (cur.length > 1) aus.push(cur); cur = []; }
      else if (!cur.length || s === k || s === 0) cur.push(p);
      else { cur.push(p); }
    }
  }
  if (cur.length > 1) aus.push(cur);
  return aus.map(c => c.length > 2 ? [c[0], ...c.slice(1, -1).filter((_, i) => i % 4 === 3), c[c.length - 1]] : c);
}

/** Bauwerke mit Platz (Forum, Markt …) schneiden Neben­straßen und Gassen weg */
const PLATZ: BauTyp[] = ["forum", "markt", "thermen", "theater", "kloster", "burg", "gericht", "einkauf", "bahnhof", "buero", "amphitheater", "kirche", "fabrik", "schule", "friedhof", "schloss", "zitadelle", "paradeplatz", "kulturhaus", "aufmarschplatz", "werk", "kaufhalle", "plaza", "kathedrale", "cabildo", "moschee", "kasbah", "karawanserei", "kaserne"];
export function freiraeumen(s: Stadt): void {
  const flaechen = s.bauten.filter(b => PLATZ.includes(b.typ)).map(b => rechteck(b, BAUTEN[b.typ].b + 6, BAUTEN[b.typ].h + 6, b.dreh ?? 0));
  if (!flaechen.length) return;
  const neu: Strasse[] = [];
  for (const st of s.strassen) {
    if (st.art !== "neben" && st.art !== "gasse") { neu.push(st); continue; }
    let cur: P[] = [];
    for (let i = 0; i + 1 < st.punkte.length; i++) {
      const a = st.punkte[i], b = st.punkte[i + 1];
      const k = Math.max(1, Math.ceil(abstand(a, b) / 4));
      for (let q = i ? 1 : 0; q <= k; q++) {
        const p = { x: a.x + (b.x - a.x) * q / k, y: a.y + (b.y - a.y) * q / k };
        if (flaechen.some(f => inPoly(p, f))) { if (cur.length > 1) neu.push({ ...st, punkte: duenn(cur) }); cur = []; }
        else cur.push(p);
      }
    }
    if (cur.length > 1) neu.push({ ...st, punkte: duenn(cur) });
  }
  s.strassen = neu;
}
const duenn = (c: P[]) => (c.length > 2 ? [c[0], ...c.slice(1, -1).filter((_, i) => i % 3 === 2), c[c.length - 1]] : c);

/** gerades Straßenraster in einem Rechteck, am Wasser unterbrochen */
export function raster(g: Gelaende, x0: number, y0: number, x1: number, y1: number, bx: number, by: number, ox: number, oy: number, art: StrassenArt = "neben", drin?: (p: P) => boolean): Strasse[] {
  const aus: Strasse[] = [];
  const zu = (l: P[]) => {
    for (const st of zerschneiden(l, g)) {
      if (!drin) { aus.push({ art, punkte: st }); continue; }
      // nur Teile innerhalb des Gebiets
      let cur: P[] = [];
      const feinst: P[] = [];
      for (let i = 0; i + 1 < st.length; i++) {
        const a = st[i], b = st[i + 1], k = Math.max(1, Math.ceil(abstand(a, b) / 8));
        for (let q = i ? 1 : 0; q <= k; q++) feinst.push({ x: a.x + (b.x - a.x) * q / k, y: a.y + (b.y - a.y) * q / k });
      }
      for (const p of feinst) {
        if (drin(p)) cur.push(p);
        else { if (cur.length > 1) aus.push({ art, punkte: [cur[0], cur[cur.length - 1]] }); cur = []; }
      }
      if (cur.length > 1) aus.push({ art, punkte: [cur[0], cur[cur.length - 1]] });
    }
  };
  for (let x = ox + Math.ceil((x0 - ox) / bx) * bx; x <= x1 + 0.01; x += bx) zu([{ x, y: y0 }, { x, y: y1 }]);
  for (let y = oy + Math.ceil((y0 - oy) / by) * by; y <= y1 + 0.01; y += by) zu([{ x: x0, y }, { x: x1, y }]);
  return aus;
}

export const rechteckPoly = (x0: number, y0: number, x1: number, y1: number): P[] => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];

/** bester Punkt nach einer Bewertung über ein grobes Gitter */
export function besterPunkt(g: Gelaende, rand: number, wert: (p: P) => number): P | null {
  let best: P | null = null, bw = -Infinity;
  for (let y = rand; y <= g.breite - rand; y += 48) for (let x = rand; x <= g.breite - rand; x += 48) {
    const p = { x, y };
    const w = wert(p);
    if (w > bw) { bw = w; best = p; }
  }
  return bw > -1e8 ? best : null;
}

/** Kann hier gebaut werden? kein Wasser, keine Aue, nicht zu steil */
export const baubar = (g: Gelaende, p: P, maxNeigung = 12) =>
  p.x > 0 && p.y > 0 && p.x < g.breite && p.y < g.breite && !istWasser(g, p.x, p.y) && !inAue(g, p.x, p.y) && neigungBei(g, p.x, p.y) < maxNeigung;

/** Punkt in der Nähe von p, der baubar ist (spiralförmig suchen) */
export function baubarNahe(g: Gelaende, p: P, z: Z, max = 300, neigung = 12): P | null {
  if (baubar(g, p, neigung)) return p;
  for (let r = 16; r <= max; r += 16) for (let k = 0; k < 12; k++) {
    const w = (k / 12) * Math.PI * 2 + z() * 0.3;
    const q = { x: p.x + Math.cos(w) * r, y: p.y + Math.sin(w) * r };
    if (baubar(g, q, neigung)) return q;
  }
  return null;
}

/** Richtung des Flusses nahe p (Bogenmaß), sonst null */
export function flussRichtung(g: Gelaende, p: P): number | null {
  if (g.flussLinie.length < 2) return null;
  const r = zurLinie(p, g.flussLinie);
  const a = g.flussLinie[r.seg], b = g.flussLinie[r.seg + 1];
  return Math.atan2(b.y - a.y, b.x - a.x);
}

/** Fernstraße von Kartenrand zu Kartenrand durch p, dem Gelände folgend */
export function fernstrasse(g: Gelaende, p: P, w: number, steigung = 0.6, wasser = 30): P[] {
  const a = randPunkt(p, w + Math.PI, g.breite), b = randPunkt(p, w, g.breite);
  const k = { steigung, wasser };
  const l1 = weg(g, a, p, k), l2 = weg(g, p, b, k);
  return [...l1, ...l2.slice(1)];
}

export function bau(s: Stadt, typ: BauTyp, p: P | null, dreh = 0): Bau | null {
  if (!p) return null;
  const b = { typ, x: p.x, y: p.y, dreh };
  s.bauten.push(b);
  return b;
}

/** Punkt neben einer Straße, Abstand d von ihr, auf der Seite s */
export function nebenStrasse(l: P[], weg: number, d: number, seite: 1 | -1): P {
  const { p, dx, dy } = punktBei(l, weg);
  return { x: p.x - dy * d * seite, y: p.y + dx * d * seite };
}

/** Teil des Linienzugs von Punkt q aus (nahe daran) in Richtung weg vom Zentrum c, Länge L */
export function auslauf(l: P[], q: P, c: P, L: number): P[] {
  const r = zurLinie(q, l);
  const vorwaerts = abstand(l[Math.min(l.length - 1, r.seg + 1)], c) > abstand(l[r.seg], c);
  const aus: P[] = [r.q];
  let s = 0;
  if (vorwaerts) for (let i = r.seg + 1; i < l.length && s < L; i++) { s += abstand(aus[aus.length - 1], l[i]); aus.push(l[i]); }
  else for (let i = r.seg; i >= 0 && s < L; i--) { s += abstand(aus[aus.length - 1], l[i]); aus.push(l[i]); }
  return aus;
}

