/**
 * Küstenlinien für die Karte »Hop für Hop« im Schichtenmodell.
 *
 * Liest ne_10m_land (Natural Earth, gemeinfrei) aus .karten-roh/ — das legt
 * `node scripts/fetch-karten.mjs` an —, behält nur Ringe im Ausschnitt
 * Europa–Japan, vereinfacht sie (Douglas-Peucker) und schreibt sie als
 * Zehntelgrad-Ganzzahlen nach src/lib/schichten/land.json.
 *
 *   node scripts/schichten-land.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const hier = dirname(fileURLToPath(import.meta.url));
const SHP = join(hier, "..", ".karten-roh", "ne_10m_land", "ne_10m_land.shp");
const ZIEL = join(hier, "..", "src", "lib", "schichten", "land.json");
const BOX = { w: -15, o: 155, s: -15, n: 66 };
const TOLERANZ = 0.12;
const MIN_FLAECHE = 0.6;

function ringe(buf) {
  const aus = [];
  let o = 100;
  while (o < buf.length) {
    const laenge = buf.readInt32BE(o + 4) * 2;
    const typ = buf.readInt32LE(o + 8);
    if (typ === 5) {
      const teile = buf.readInt32LE(o + 44), punkte = buf.readInt32LE(o + 48);
      const starts = [];
      for (let i = 0; i < teile; i++) starts.push(buf.readInt32LE(o + 52 + i * 4));
      const p0 = o + 52 + teile * 4;
      for (let t = 0; t < teile; t++) {
        const ende = t + 1 < teile ? starts[t + 1] : punkte;
        const r = [];
        for (let i = starts[t]; i < ende; i++) r.push([buf.readDoubleLE(p0 + i * 16), buf.readDoubleLE(p0 + i * 16 + 8)]);
        aus.push(r);
      }
    }
    o += 8 + laenge;
  }
  return aus;
}

function vereinfache(p, tol) {
  if (p.length < 3) return p;
  const behalte = new Uint8Array(p.length);
  behalte[0] = behalte[p.length - 1] = 1;
  const stapel = [[0, p.length - 1]];
  while (stapel.length) {
    const [a, b] = stapel.pop();
    let max = 0, idx = -1;
    const [ax, ay] = p[a], [bx, by] = p[b];
    const dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy) || 1e-12;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(dy * (p[i][0] - ax) - dx * (p[i][1] - ay)) / l;
      if (d > max) { max = d; idx = i; }
    }
    if (max > tol) { behalte[idx] = 1; stapel.push([a, idx], [idx, b]); }
  }
  return p.filter((_, i) => behalte[i]);
}

/** Geschlossene Ringe am weitesten Punkt teilen — sonst ist die Strecke Anfang–Ende null lang */
function vereinfacheRing(r) {
  let k = 0, max = -1;
  for (let i = 1; i < r.length; i++) {
    const d = Math.hypot(r[i][0] - r[0][0], r[i][1] - r[0][1]);
    if (d > max) { max = d; k = i; }
  }
  return [...vereinfache(r.slice(0, k + 1), TOLERANZ), ...vereinfache(r.slice(k), TOLERANZ).slice(1)];
}

const flaeche = r => Math.abs(r.reduce((s, [x, y], i) => { const [x2, y2] = r[(i + 1) % r.length]; return s + x * y2 - x2 * y; }, 0) / 2);
const imAusschnitt = r => r.some(([x, y]) => x >= BOX.w && x <= BOX.o && y >= BOX.s && y <= BOX.n);

const alle = ringe(readFileSync(SHP));
const aus = [];
for (const r of alle) {
  if (!imAusschnitt(r) || flaeche(r) < MIN_FLAECHE) continue;
  const v = vereinfacheRing(r);
  if (v.length < 4) continue;
  aus.push(v.flatMap(([x, y]) => [Math.round(x * 10), Math.round(y * 10)]));
}
writeFileSync(ZIEL, JSON.stringify({ quelle: "Natural Earth ne_10m_land (gemeinfrei), vereinfacht", einheit: "Zehntelgrad, [lon, lat, lon, lat …]", ringe: aus }));
console.log(`${aus.length} Ringe, ${aus.reduce((s, r) => s + r.length / 2, 0)} Punkte → ${ZIEL}`);
