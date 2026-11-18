/**
 * Aufbau (wie Anno): alles liegt auf einem Raster aus 6-m-Feldern (= Geländezellen).
 *   - Du setzt die wichtigen Gebäude (Markt, Burg, Zeche …) feldgenau; Lageregeln wie im Bau-Modus.
 *   - Jedes Gebäude hat einen Einzugsbereich. Häuser entstehen nur darin, an Straßen, feldgenau.
 *   - Ein Haus ist so gut versorgt, wie viele der nötigen Gebäude es erreichen — davon hängen
 *     Bewohner und Größe ab.
 *   - Straßen: Hauptstraßen von jedem Gebäude zum Netz (kürzester Weg übers Gelände), Wohnstraßen
 *     wachsen je Stadttyp als Raster, gewachsenes Gassennetz oder Fächer.
 *   - Bebaubar ist nur freigeschaltetes Land; es wächst mit jeder Stufe.
 * Alles deterministisch aus Seed und Zügen.
 */
import { neigungBei, type Gelaende } from "@/lib/gelaende/gelaende";
import { perlin } from "@/lib/gelaende/rauschen";
import type { P } from "./geometrie";
import { BAUTEN, ZONEN, type BauTyp, type HausArt, type Stil } from "./modell";
import { BAUPLAENE, kapazitaet, pruefeOrt, stufeVon, type Bewertung, type Ort } from "./bauen";

export const FREI = 0, STRASSE = 1, HAUPT = 2, HAUS = 3, BAU = 4;

/** Einzugsbereich je Gebäude in Metern (Rest: 220 m) */
const REICHWEITE: Partial<Record<BauTyp, number>> = {
  markt: 260, forum: 260, plaza: 260, kirche: 220, kathedrale: 320, tempel: 180, schule: 300, bahnhof: 450, depot: 400,
  burg: 380, schloss: 450, moschee: 260, hammam: 160, thermen: 260, rathaus: 300, cabildo: 260, zechenturm: 340,
  hochofen: 420, kai: 300, universitaet: 500, techzentrale: 600, einkauf: 600, kaufhalle: 260, poliklinik: 420,
  aufmarschplatz: 420, kulturhaus: 360, paradeplatz: 300, kaserne: 260, muehle: 200, castellum: 400, schacht: 220,
  werk: 600, gericht: 320, hafenkontor: 320, karawanserei: 240, kasbah: 360, huettenwerk: 300, bergamt: 260, forschungspark: 400,
};
export const reichweite = (b: BauTyp) => REICHWEITE[b] ?? 220;

export interface AufHaus { i: number; j: number; dreh: 0 | 1 | 2 | 3; bewohner: number; ziel: number; versorgt: number; hoehe: number; /** Kantenlänge in Feldern (2 = Haus, 3 = Hof) */ s: number; /** Hof: 3 = Dreiseithof, 4 = Vierseithof, 0 = Einzelhaus */ hof: number }

/** Kantenlänge eines Grundstücks in Feldern: Europa und Orient bauen Höfe (Drei-/Vierseithof, Hofhaus), sonst Einzelhäuser */
export const hausMass = (stil: Stil) => (stil === "europaeisch" || stil === "orientalisch" ? 3 : 2);
/** Mitte eines Hauses (Karte in Metern) */
export const hausMitte = (w: Welt, h: AufHaus): P => ({ x: (h.i + h.s / 2) * w.zelle, y: (h.j + h.s / 2) * w.zelle });
const zellenVon = (h: { i: number; j: number; s: number }) => {
  const aus: [number, number][] = [];
  for (let b = 0; b < h.s; b++) for (let a = 0; a < h.s; a++) aus.push([h.i + a, h.j + b]);
  return aus;
};
export interface AufBau { id: number; bau: BauTyp; i: number; j: number; w: number; h: number; faktor: number; /** Vierteldrehungen (0–3), Zufahrt 0 = Süden */ dreh: number }

export interface Welt {
  stil: Stil;
  seed: number;
  n: number;
  zelle: number;
  /** Belegung je Feld (FREI, STRASSE, HAUPT, HAUS, BAU) */
  feld: Uint8Array;
  /** 1 = freigeschaltet (bebaubar) */
  frei: Uint8Array;
  haeuser: AufHaus[];
  bauten: AufBau[];
  einwohner: number;
  tick: number;
  /** Radius der Wohnstraßen um das Zentrum (Felder), wächst nach Bedarf */
  strassenRadius: number;
  naechsteId: number;
  /** Brückenmitten (Felder), für Mindestabstand */
  bruecken: { i: number; j: number }[];
  /** 1 = Aue trockengelegt (Gräben, Deich) — dort darf gebaut werden */
  trocken: Uint8Array;
}

/** Feld liegt in der (noch nassen) Aue */
export const nasseAue = (g: Gelaende, w: Welt, k: number) => g.aue[k] === 1 && !w.trocken[k];

/** Radius des Trockenlegens in Metern */
export const TROCKEN_RADIUS = 60;

/** Aue im Umkreis trockenlegen; gibt die Zahl der neu trockenen Felder zurück (0 = hier gibt es nichts zu tun) */
export function trockenlegen(g: Gelaende, w: Welt, x: number, y: number): number {
  const rz = Math.ceil(TROCKEN_RADIUS / w.zelle), ci = Math.floor(x / w.zelle), cj = Math.floor(y / w.zelle);
  let neu = 0;
  for (let j = Math.max(0, cj - rz); j <= Math.min(w.n - 1, cj + rz); j++)
    for (let i = Math.max(0, ci - rz); i <= Math.min(w.n - 1, ci + rz); i++) {
      const k = j * w.n + i;
      if ((i - ci) ** 2 + (j - cj) ** 2 > rz * rz || !w.frei[k] || !g.aue[k] || w.trocken[k] || g.wasser[k]) continue;
      w.trocken[k] = 1;
      neu++;
    }
  return neu;
}

export function neueWelt(g: Gelaende, stil: Stil, seed: number): Welt {
  const n = g.n;
  const w: Welt = { stil, seed, n, zelle: g.zelle, feld: new Uint8Array(n * n), frei: new Uint8Array(n * n).fill(1), haeuser: [], bauten: [], einwohner: 0, tick: 0, strassenRadius: 6, naechsteId: 1, bruecken: [], trocken: new Uint8Array(n * n) };
  return w;
}

export const mitteVon = (w: Welt, b: { i: number; j: number; w: number; h: number }): P => ({ x: (b.i + b.w / 2) * w.zelle, y: (b.j + b.h / 2) * w.zelle });
export const orteVon = (w: Welt): Ort[] => w.bauten.map(b => ({ bau: b.bau, p: mitteVon(w, b) }));
/** Grundfläche in Feldern; bei ungerader Drehung sind Breite und Tiefe vertauscht */
export function fussabdruck(b: BauTyp, dreh = 0) {
  const w = Math.max(2, Math.min(24, Math.round(BAUTEN[b].b / 6))), h = Math.max(2, Math.min(24, Math.round(BAUTEN[b].h / 6)));
  return dreh % 2 ? { w: h, h: w } : { w, h };
}

/** Feld vor der Zufahrt des Gebäudes (Seite je Drehung: Süden, Westen, Norden, Osten) */
function zufahrt(i: number, j: number, fw: number, fh: number, dreh: number) {
  return [{ i: i + Math.floor(fw / 2), j: j + fh }, { i: i - 1, j: j + Math.floor(fh / 2) }, { i: i + Math.floor(fw / 2), j: j - 1 }, { i: i + fw, j: j + Math.floor(fh / 2) }][dreh % 4];
}

const baubarFeld = (g: Gelaende, i: number, j: number, max = 22) => {
  if (i < 0 || j < 0 || i >= g.n || j >= g.n) return false;
  const k = j * g.n + i;
  return !g.wasser[k] && neigungBei(g, (i + 0.5) * g.zelle, (j + 0.5) * g.zelle) < max;
};

/** Zentrum: das Kern-Gebäude des Stadttyps, sonst das erste */
export function zentrum(w: Welt): AufBau | null {
  const z = BAUPLAENE[w.stil].zentrum;
  return w.bauten.find(b => b.bau === z) ?? w.bauten[0] ?? null;
}

export const stufe = (w: Welt) => stufeVon(BAUPLAENE[w.stil], w.einwohner);

/** Freischalten: Kreis um das Zentrum (wächst je Stufe) und um jedes Gebäude */
export function freischalten(w: Welt) {
  const z = zentrum(w);
  if (!z) { w.frei.fill(1); return; }
  w.frei.fill(0);
  const kreise: [P, number][] = [[mitteVon(w, z), 420 + 330 * stufe(w)], ...w.bauten.map(b => [mitteVon(w, b), 180] as [P, number])];
  for (const [c, r] of kreise) {
    const rz = Math.ceil(r / w.zelle), ci = Math.floor(c.x / w.zelle), cj = Math.floor(c.y / w.zelle);
    for (let j = Math.max(0, cj - rz); j <= Math.min(w.n - 1, cj + rz); j++)
      for (let i = Math.max(0, ci - rz); i <= Math.min(w.n - 1, ci + rz); i++)
        if ((i - ci) ** 2 + (j - cj) ** 2 <= rz * rz) w.frei[j * w.n + i] = 1;
  }
}

// ---------------------------------------------------------------- Gebäude setzen

export interface Platzpruefung { ok: boolean; faktor: number; gruende: Bewertung[]; versorgt: number }

/** Darf Gebäude b mit linker oberer Ecke (i, j) hin? Dazu: Lage nach den Regeln, Häuser im Einzugsbereich */
export function pruefePlatz(g: Gelaende, w: Welt, b: BauTyp, i: number, j: number, dreh = 0): Platzpruefung {
  const { w: fw, h: fh } = fussabdruck(b, dreh);
  const gruende: Bewertung[] = [];
  let ok = true;
  for (let y = j; y < j + fh && ok; y++) for (let x = i; x < i + fw; x++) {
    if (x < 0 || y < 0 || x >= w.n || y >= w.n) { ok = false; gruende.push({ ok: false, text: "außerhalb der Karte" }); break; }
    const k = y * w.n + x;
    if (!w.frei[k]) { ok = false; gruende.push({ ok: false, text: "Land noch nicht erschlossen — wächst mit der nächsten Stufe" }); break; }
    if (w.feld[k] === HAUS || w.feld[k] === BAU) { ok = false; gruende.push({ ok: false, text: "Feld ist schon bebaut" }); break; }
    if (g.wasser[k] && b !== "kai" && b !== "werft" && b !== "hafen" && b !== "kanalhafen" && b !== "muehle" && b !== "hafenkontor") { ok = false; gruende.push({ ok: false, text: "im Wasser" }); break; }
  }
  const p = mitteVon(w, { i, j, w: fw, h: fh });
  const pr = pruefeOrt(g, w.stil, b, p, orteVon(w));
  const r = reichweite(b);
  const versorgt = w.haeuser.filter(h => { const m = hausMitte(w, h); return Math.hypot(m.x - p.x, m.y - p.y) <= r; }).length;
  return { ok: ok && pr.erlaubt, faktor: ok ? pr.faktor : 0, gruende: [...gruende, ...pr.gruende], versorgt };
}

export function baue(g: Gelaende, w: Welt, b: BauTyp, i: number, j: number, dreh = 0): AufBau | null {
  const pr = pruefePlatz(g, w, b, i, j, dreh);
  if (!pr.ok) return null;
  const { w: fw, h: fh } = fussabdruck(b, dreh);
  const neu: AufBau = { id: w.naechsteId++, bau: b, i, j, w: fw, h: fh, faktor: pr.faktor, dreh: dreh % 4 };
  for (let y = j; y < j + fh; y++) for (let x = i; x < i + fw; x++) w.feld[y * w.n + x] = BAU;
  w.bauten.push(neu);
  // Hauptstraße zum Netz (vom Rand der Fläche)
  const tor = zufahrt(i, j, fw, fh, dreh);
  const ziel = naechsteStrasse(w, tor.i, tor.j) ?? (w.bauten.length > 1 ? (() => { const z = zentrum(w)!; return z === neu ? null : zufahrt(z.i, z.j, z.w, z.h, z.dreh); })() : null);
  if (ziel) strasseZwischen(g, w, tor, ziel, HAUPT);
  else markiere(w, tor.i, tor.j, HAUPT);
  for (const o of w.bauten) o.faktor = pruefeOrt(g, w.stil, o.bau, mitteVon(w, o), orteVon(w)).faktor;
  freischalten(w);
  return neu;
}

/** Haus-Felder freigeben (gibt true zurück, damit es aus der Liste fällt) */
function leere(w: Welt, h: AufHaus) {
  for (const [x, y] of zellenVon(h)) w.feld[y * w.n + x] = FREI;
  return true;
}

export function reisseAb(g: Gelaende, w: Welt, id: number) {
  const b = w.bauten.find(x => x.id === id);
  if (!b) return;
  for (let y = b.j; y < b.j + b.h; y++) for (let x = b.i; x < b.i + b.w; x++) w.feld[y * w.n + x] = FREI;
  w.bauten = w.bauten.filter(x => x.id !== id);
  for (const o of w.bauten) o.faktor = pruefeOrt(g, w.stil, o.bau, mitteVon(w, o), orteVon(w)).faktor;
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
  if (w.feld[k] !== HAUPT) w.feld[k] = art;
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
  const kosten = new Float64Array(bw * bh).fill(Infinity), vor = new Int32Array(bw * bh).fill(-1);
  const idx = (i: number, j: number) => (j - j0) * bw + (i - i0);
  const heap: [number, number][] = [];
  const push = (c: number, k: number) => { heap.push([c, k]); let x = heap.length - 1; while (x > 0) { const p = (x - 1) >> 1; if (heap[p][0] <= heap[x][0]) break; [heap[p], heap[x]] = [heap[x], heap[p]]; x = p; } };
  const pop = () => { const t = heap[0], l = heap.pop()!; if (heap.length) { heap[0] = l; let x = 0; for (;;) { const a2 = 2 * x + 1, b2 = a2 + 1; let m = x; if (a2 < heap.length && heap[a2][0] < heap[m][0]) m = a2; if (b2 < heap.length && heap[b2][0] < heap[m][0]) m = b2; if (m === x) break; [heap[m], heap[x]] = [heap[x], heap[m]]; x = m; } } return t; };
  const s = idx(a.i, a.j), zi = idx(b.i, b.j);
  kosten[s] = 0; push(0, s);
  while (heap.length) {
    const [c, k] = pop();
    if (c > kosten[k]) continue;
    if (k === zi) break;
    const i = (k % bw) + i0, j = Math.floor(k / bw) + j0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = i + dx, y = j + dy;
      if (x < i0 || y < j0 || x > i1 || y > j1) continue;
      const kk = y * n + x, f = w.feld[kk];
      if (f === HAUS || (f === BAU && !(x === b.i && y === b.j))) continue;
      const steil = neigungBei(g, (x + 0.5) * w.zelle, (y + 0.5) * w.zelle);
      const schritt = (f === STRASSE || f === HAUPT ? 0.35 : 1) + steil * 0.08 + (g.wasser[kk] ? 6 : 0) + (steil > 30 ? 20 : 0);
      const ni = idx(x, y), nc = c + schritt;
      if (nc < kosten[ni]) { kosten[ni] = nc; vor[ni] = k; push(nc + Math.abs(x - b.i) + Math.abs(y - b.j), ni); }
    }
  }
  if (!Number.isFinite(kosten[zi])) return;
  for (let k = zi; k >= 0; k = vor[k]) markiere(w, (k % bw) + i0, Math.floor(k / bw) + j0, art);
}

/**
 * Geplantes Straßennetz je Stadttyp als Feld-Muster um das Zentrum:
 *   raster/stern  gerades Raster im Blockmaß
 *   organisch     verbogenes Raster: jede Straße schlängelt sich, Blöcke sind ungleich groß
 *   faecher       Strahlen vom Zentrum und Ringe
 * Die Felder sind für Häuser gesperrt, damit die Stadt nach außen weiterwachsen kann.
 */
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
  // Lage der k-ten Straße an der Stelle t (quer dazu): lange Wellen, damit die Gassen auf dem Raster
  // längere gerade Stücke haben statt Treppen; Abstand je Straße leicht verschieden
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

/** Wohnstraßen des geplanten Netzes bis zum Radius r (Felder) anlegen */
function wohnstrassen(g: Gelaende, w: Welt, r: number) {
  const z = zentrum(w), nz = netz(w);
  if (!z || !nz) return;
  const { i: ci, j: cj } = zufahrt(z.i, z.j, z.w, z.h, z.dreh);
  for (let j = Math.max(0, cj - r); j <= Math.min(w.n - 1, cj + r); j++)
    for (let i = Math.max(0, ci - r); i <= Math.min(w.n - 1, ci + r); i++) {
      const k = j * w.n + i;
      if ((i - ci) ** 2 + (j - cj) ** 2 > r * r || w.feld[k] !== FREI || !w.frei[k] || !baubarFeld(g, i, j, 25) || !imEinzug(w, i, j, 30) || nasseAue(g, w, k)) continue;
      if (nz(i, j)) w.feld[k] = STRASSE;
    }
}

/**
 * Brücken: Wo eine Straße am Ufer endet und das andere Ufer nah (≤ 60 m), erschlossen und bebaubar ist,
 * führt sie über das Wasser weiter. Brücken halten Abstand voneinander (≥ 150 m) — sie waren teuer.
 */
export function bruecken(g: Gelaende, w: Welt) {
  const n = w.n, nass = (x: number, y: number) => g.wasser[y * n + x] > 0;
  for (let k = 0; k < n * n; k++) {
    const f = w.feld[k];
    if ((f !== STRASSE && f !== HAUPT) || g.wasser[k]) continue;
    const i = k % n, j = Math.floor(k / n);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      let x = i + dx, y = j + dy;
      if (x < 0 || y < 0 || x >= n || y >= n || !nass(x, y)) continue;
      const ueber: number[] = [];
      while (x >= 0 && y >= 0 && x < n && y < n && nass(x, y) && ueber.length <= 10) { ueber.push(y * n + x); x += dx; y += dy; }
      if (ueber.length > 10 || x < 0 || y < 0 || x >= n || y >= n) continue;
      const l = y * n + x;
      if (!w.frei[l] || !baubarFeld(g, x, y, 40) || (w.feld[l] !== FREI && w.feld[l] !== STRASSE && w.feld[l] !== HAUPT)) continue;
      const mi = (i + x) / 2, mj = (j + y) / 2;
      if (w.bruecken.some(b => Math.hypot(b.i - mi, b.j - mj) < 25)) continue;
      for (const u of ueber) w.feld[u] = STRASSE;
      if (w.feld[l] === FREI) w.feld[l] = STRASSE;
      w.bruecken.push({ i: mi, j: mj });
    }
  }
}

// ---------------------------------------------------------------- Häuser und Versorgung

/** nötige Gebäude bis zur aktuellen Stufe */
export function beduerfnisse(w: Welt): BauTyp[] {
  const plan = BAUPLAENE[w.stil];
  return [...new Set(plan.stufen.slice(0, stufe(w) + 1).flatMap(s => s.braucht))];
}

/** Anteil der Bedürfnisse, deren Gebäude das Feld (i, j) im Einzugsbereich haben */
export function versorgungBei(w: Welt, i: number, j: number, beduerf = beduerfnisse(w), s = 2): number {
  if (!beduerf.length) return 1;
  const x = (i + s / 2) * w.zelle, y = (j + s / 2) * w.zelle;
  let n = 0;
  for (const b of beduerf) if (w.bauten.some(o => o.bau === b && Math.hypot(mitteVon(w, o).x - x, mitteVon(w, o).y - y) <= reichweite(b))) n++;
  return n / beduerf.length;
}

const imEinzug = (w: Welt, i: number, j: number, rand = 0, s = 2) => w.bauten.some(o => Math.hypot(mitteVon(w, o).x - (i + s / 2) * w.zelle, mitteVon(w, o).y - (j + s / 2) * w.zelle) <= reichweite(o.bau) + rand);

/** Kandidaten für neue Häuser: 2 × 2 frei, freigeschaltet, eben, an einer Straße, im Einzugsbereich */
function hausplaetze(g: Gelaende, w: Welt, max: number): AufHaus[] {
  const z = zentrum(w);
  if (!z) return [];
  const c = mitteVon(w, z), rausch = perlin(w.seed + 5);
  const n = w.n, aus: { h: AufHaus; wert: number }[] = [];
  const gesehen = new Set<number>();
  const nz = netz(w);
  const S = hausMass(w.stil), zi = Math.floor(c.x / w.zelle), zj = Math.floor(c.y / w.zelle);
  const frei2 = (i: number, j: number) => {
    for (const [x, y] of zellenVon({ i, j, s: S })) {
      if (x < 0 || y < 0 || x >= n || y >= n) return false;
      const k = y * n + x;
      // Häuser: nicht in die nasse Aue (Hochwasser) — erst nach dem Trockenlegen; ein Uferstreifen bleibt frei
      if (w.feld[k] !== FREI || !w.frei[k] || !baubarFeld(g, x, y, 25) || nz?.(x, y) || nasseAue(g, w, k) || g.abstandWasser[k] < 15) return false;
    }
    return true;
  };
  for (let k = 0; k < n * n; k++) {
    const f = w.feld[k];
    if (f !== STRASSE && f !== HAUPT) continue;
    const si = k % n, sj = Math.floor(k / n);
    // Haus an jeder Seite der Straße, Front zur Straße
    const lagen: [number, number, 0 | 1 | 2 | 3][] = [];
    for (let t = 0; t < S; t++) lagen.push([si - S, sj - t, 1], [si + 1, sj - t, 3], [si - t, sj - S, 0], [si - t, sj + 1, 2]);
    for (const [i, j, dreh] of lagen) {
      const key = j * n + i;
      if (gesehen.has(key) || !frei2(i, j) || !imEinzug(w, i, j, 0, S)) continue;
      gesehen.add(key);
      const d = Math.hypot((i + S / 2) * w.zelle - c.x, (j + S / 2) * w.zelle - c.y);
      // in der Flucht der Nachbarn (Raster im Grundstücksmaß): Häuser schließen lückenlos an
      const flucht = (((i - zi) % S) + S) % S === 0 && (((j - zj) % S) + S) % S === 0 ? 40 : 0;
      aus.push({ h: { i, j, dreh, bewohner: 0, ziel: 0, versorgt: 0, hoehe: 0, s: S, hof: 0 }, wert: -d + rausch(i / 7, j / 7) * 60 + (f === HAUPT ? 25 : 0) + flucht });
    }
  }
  aus.sort((a, b) => b.wert - a.wert);
  // Häuser dürfen sich nicht überlappen
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

/** Bewohner je Haus nach Versorgung (4 … 12), Höhe nach Stadttyp und Versorgung */
function hausWerte(w: Welt, h: AufHaus, beduerf: BauTyp[]) {
  h.versorgt = versorgungBei(w, h.i, h.j, beduerf, h.s);
  // ein Hof beherbergt mehr Menschen (Familie, Gesinde, Handwerk) als ein Einzelhaus
  const gross = h.s === 3 ? 2 : 1;
  h.ziel = Math.round((4 + 8 * h.versorgt) * gross);
  if (h.s === 3) h.hof = (h.i * 7 + h.j * 13) % 3 === 0 ? 4 : 3;
  const art = ZONEN[BAUPLAENE[w.stil].kern].haus;
  const [lo, hi] = art?.hoehe ?? [6, 10];
  h.hoehe = lo + (hi - lo) * h.versorgt;
}

/** ein Zeitschritt: Bewohner ziehen ein, neue Häuser und Straßen, Freischalten bei neuer Stufe */
export function schritt(g: Gelaende, w: Welt): void {
  w.tick++;
  if (!w.bauten.length) return;
  const alteStufe = stufe(w);
  const beduerf = beduerfnisse(w);
  if (w.tick % 4 === 1) for (const h of w.haeuser) hausWerte(w, h, beduerf);
  // Bewohner ziehen nach und nach ein
  let summe = 0;
  for (const h of w.haeuser) { h.bewohner += Math.sign(h.ziel - h.bewohner); summe += h.bewohner; }
  w.einwohner = summe;
  // so viele Einwohner trägt die Stadt (Stufen und Lage wie im Bau-Modus)
  const { kap } = kapazitaet(g, w.stil, { orte: orteVon(w), einwohner: w.einwohner, tick: w.tick });
  const zielSumme = w.haeuser.reduce((a, h) => a + h.ziel, 0);
  if (zielSumme < kap) {
    let neu = hausplaetze(g, w, 6);
    if (neu.length < 6) {
      w.strassenRadius = Math.min(w.n, w.strassenRadius + 3);
      wohnstrassen(g, w, w.strassenRadius);
      bruecken(g, w);
      neu = hausplaetze(g, w, 6);
    }
    for (const h of neu) {
      for (const [x, y] of zellenVon(h)) w.feld[y * w.n + x] = HAUS;
      hausWerte(w, h, beduerf);
      w.haeuser.push(h);
    }
  } else if (zielSumme > kap * 1.1 && w.haeuser.length) {
    // zu viele Häuser (Gebäude abgerissen): das schlechtest versorgte steht leer und verschwindet
    w.haeuser.sort((a, b) => b.versorgt - a.versorgt);
    leere(w, w.haeuser.pop()!);
  }
  if (stufe(w) !== alteStufe) freischalten(w);
}

/** Stadttyp für die Häuser: Fassaden- und Dachfarben */
export function hausFarben(stil: Stil) {
  const art = ZONEN[BAUPLAENE[stil].kern].haus as HausArt | null;
  return { fassade: art?.fassade ?? "#e6dccb", dach: art?.dach ?? "#9c5b44", flach: !!art?.flach };
}

// ---------------------------------------------------------------- Straßen zeichnen

export interface Kette { punkte: P[]; haupt: boolean }

/**
 * Straßen als geglättete Linien: Ketten von Kreuzung zu Kreuzung (Felder mit ≠ 2 Nachbarn) verfolgen und
 * mit Chaikin glätten — Treppenstufen werden zu Schrägen, Ecken zu Kurven, Kreuzungen bleiben feldgenau.
 * Liefert auch die Kreuzungsfelder (die bekommen eine eigene Pflasterfläche).
 */
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
  const knoten: number[] = [];
  const istKnoten = new Uint8Array(n * n);
  for (let k = 0; k < n * n; k++) if (ist(k) && nachbarn(k).length !== 2) { knoten.push(k); istKnoten[k] = 1; }
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
  // übrige Ringe ohne Kreuzung
  for (let k = 0; k < n * n; k++) if (ist(k) && !istKnoten[k]) for (const nb of nachbarn(k)) if (!gesehen.has(kante(k, nb))) verfolge(k, nb);
  return { ketten, knoten };
}

// ---------------------------------------------------------------- Spielstand

/**
 * Spielstand als kompakter Text: Belegung, Erschließung und Trockenlegung je Feld in einem Byte,
 * lauflängenkodiert (fast alles ist leer), dazu Häuser, Gebäude und Zähler. Meist einige 10 KB.
 */
export function welteAlsText(w: Welt): string {
  const n = w.n, rle: number[] = [];
  let alt = -1, zahl = 0;
  for (let k = 0; k < n * n; k++) {
    const v = w.feld[k] | (w.frei[k] << 3) | (w.trocken[k] << 4);
    if (v === alt) zahl++;
    else { if (zahl) rle.push(alt, zahl); alt = v; zahl = 1; }
  }
  rle.push(alt, zahl);
  return JSON.stringify({
    v: 1, stil: w.stil, seed: w.seed, n, felder: rle,
    haeuser: w.haeuser.map(h => [h.i, h.j, h.dreh, h.bewohner, h.ziel, Math.round(h.versorgt * 100), Math.round(h.hoehe * 10), h.s, h.hof]),
    bauten: w.bauten.map(b => [b.id, b.bau, b.i, b.j, b.w, b.h, Math.round(b.faktor * 100), b.dreh]),
    einwohner: w.einwohner, tick: w.tick, strassenRadius: w.strassenRadius, naechsteId: w.naechsteId, bruecken: w.bruecken.map(b => [b.i, b.j]),
  });
}

/** Spielstand lesen; null, wenn er nicht zu Gelände und Stadttyp passt oder kaputt ist */
export function welteAusText(text: string, g: Gelaende, stil: Stil): Welt | null {
  try {
    const d = JSON.parse(text);
    if (d.v !== 1 || d.stil !== stil || d.n !== g.n || d.seed !== g.wahl.seed) return null;
    const w = neueWelt(g, stil, d.seed);
    let k = 0;
    for (let x = 0; x + 1 < d.felder.length; x += 2) {
      const v = d.felder[x], z = d.felder[x + 1];
      for (let t = 0; t < z && k < w.n * w.n; t++, k++) { w.feld[k] = v & 7; w.frei[k] = (v >> 3) & 1; w.trocken[k] = (v >> 4) & 1; }
    }
    if (k !== w.n * w.n) return null;
    w.haeuser = d.haeuser.map((h: number[]) => ({ i: h[0], j: h[1], dreh: h[2], bewohner: h[3], ziel: h[4], versorgt: h[5] / 100, hoehe: h[6] / 10, s: h[7], hof: h[8] }));
    w.bauten = d.bauten.map((b: [number, BauTyp, number, number, number, number, number, number]) => ({ id: b[0], bau: b[1], i: b[2], j: b[3], w: b[4], h: b[5], faktor: b[6] / 100, dreh: b[7] }));
    w.einwohner = d.einwohner; w.tick = d.tick; w.strassenRadius = d.strassenRadius; w.naechsteId = d.naechsteId;
    w.bruecken = d.bruecken.map((b: number[]) => ({ i: b[0], j: b[1] }));
    return w;
  } catch {
    return null;
  }
}
