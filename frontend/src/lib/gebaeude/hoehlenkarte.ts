/**
 * Höhlenkarten aus den Spielalgorithmen:
 *
 *  1. Ablauf (zyklisch.ts) auf Poisson-Orte legen (wie bei den Lichtungen, lichtung.ts).
 *  2. Den Ablauf als Kern in den Fels schlagen: Hallen (≥ 7 × 7 Felder) an den Knoten, Gänge (≥ 3 Felder)
 *     je Kante über ein Rauschkostenfeld (wege.ts, A*).
 *  3. Wahlweise ein unterirdischer Bach (4 Felder breit) mit Brücken.
 *  4. Aufweiten mit dem Zellautomaten aus hoehle.ts (Moore-Nachbarschaft, B5678/S45678): nahe am Kern
 *     zufällig frei, dann glätten; der Kern bleibt frei, das Wasser bleibt Wasser.
 *  5. `regionen`: abgetrennte Taschen bekommen einen 3 Felder breiten Tunnel (wege.ts), winzige werden
 *     zugeschüttet; zuletzt wird alles geöffnet, was schmaler als 3 Felder ist, und nur die größte Höhle bleibt.
 *  3a. Der Bach entspringt an einer geraden Felswand von 4 Feldern (Wasserfall), davor ein Becken von 4 × 3 Feldern.
 *  6. Tropfsteinsäulen in großen Hallen, das Ziel als Steintor in der Wand (3 Felder breit, 4 Felder Fels dahinter).
 */
import type { FreiEbene } from "./frei";
import { nurGroesste, regionen, runde, type Hoehle } from "@/lib/spielalgo/hoehle";
import { type Quelle, PLATZ, WAND, WEG, abstaende, ausduennen, chaikin, oeffnen, planeAblauf, scheibe, suchWeg, wandDickeBei, zufall, type Tor } from "./karte";
import { fleckSaele, legeAblauf, legeBach, rauschKosten, stationenNachWeg, ziehePfade, alleErreichbar, type Bruecke } from "./lichtung";

const ABSTAND = 15;
const RAND = 8;
/** halbe Breite der Hallen an den Knoten (Felder) */
export const HALLE = 4.6;
/** Breite des Bachbetts: Radius 2 → 4 Felder */
const BACH = 2.0;

export interface HoehlenWahl { bach?: boolean }

function versuch(zimmer: number, seed: number, wahl: HoehlenWahl): FreiEbene | null {
  const r = zufall(seed);
  const g = planeAblauf(zimmer, r);
  const lage = legeAblauf(g, ABSTAND, RAND, r);
  if (!lage) return null;
  const { B, pos, kanten } = lage;
  const art = new Uint8Array(B * B);
  const { kosten, welle } = rauschKosten(B, seed, 6);

  // 2. Kern: Gänge, dann Hallen
  ziehePfade(B, art, kosten, pos, kanten, HALLE + 3, () => 1.6);
  pos.forEach(([x, y], k) => scheibe(B, B, x + 0.5, y + 0.5, HALLE + (k === 1 ? 0.6 : 0) + r() * 0.6, f => { art[f] = PLATZ; }));

  // 3. Bach
  let wasser: Uint8Array | undefined, bruecken: Bruecke[] | undefined, quelle: Quelle | undefined;
  const fest = new Uint8Array(B * B);
  if (wahl.bach) {
    const bach = legeBach(B, art, pos, HALLE + 3, welle, BACH, r);
    if (!bach) return null;
    ({ wasser, bruecken } = bach);
    quelle = legeQuelle(B, art, bach.wasser, bach.lauf, fest) ?? undefined;
    if (!quelle) return null;
  }

  // 4. Zellautomat (hoehle.ts): 1 = Fels
  const kern = Uint8Array.from(art, a => (a !== WAND ? 1 : 0));
  const nass = (i: number) => !!wasser?.[i] && !kern[i];
  const d = new Uint8Array(B * B).fill(9), offen: number[] = [];
  for (let i = 0; i < B * B; i++) if (kern[i]) { d[i] = 0; offen.push(i); }
  for (let k = 0; k < offen.length; k++) {
    const i = offen[k], x = i % B, y = (i - x) / B;
    if (d[i] >= 4) continue;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy, j = ny * B + nx;
      if (nx < 1 || ny < 1 || nx >= B - 1 || ny >= B - 1 || d[j] <= d[i] + 1) continue;
      d[j] = d[i] + 1;
      offen.push(j);
    }
  }
  const hz: Hoehle = {
    b: B, h: B, generation: 0, region: null,
    z: Uint8Array.from(d, (v, i) => (kern[i] || (v <= 4 && !nass(i) && r() < [1, 0.62, 0.5, 0.36, 0.2][v]) ? 0 : 1)),
  };
  const halte = () => { for (let i = 0; i < B * B; i++) { if (kern[i]) hz.z[i] = 0; else if (nass(i) || fest[i]) hz.z[i] = 1; } };
  for (let n = 0; n < 4; n++) { runde(hz, [5, 6, 7, 8], [4, 5, 6, 7, 8]); halte(); }
  // Rand bleibt Fels
  for (let i = 0; i < B; i++) hz.z[i] = hz.z[(B - 1) * B + i] = hz.z[i * B] = hz.z[i * B + B - 1] = 1;

  // 5. Taschen: große per Tunnel anschließen, kleine zuschütten
  const groessen = regionen(hz);
  for (let nr = 1; nr < groessen.length; nr++) {
    if (groessen[nr] < 10) continue;
    let best: [number, number] | null = null, bd = Infinity;
    for (let i = 0; i < B * B; i += 2) {
      if (hz.region![i] !== nr) continue;
      for (let j = 0; j < B * B; j += 3) {
        if (hz.region![j] !== 0) continue;
        const dd = Math.abs((i % B) - (j % B)) + Math.abs(Math.floor(i / B) - Math.floor(j / B));
        if (dd < bd) { bd = dd; best = [i, j]; }
      }
    }
    if (!best || bd > 14) continue;
    const tk = Uint8Array.from(hz.z, (f, i) => (nass(i) || (i % B) < 1 || (i % B) >= B - 1 || i < B || i >= B * (B - 1) ? 0 : f ? 4 : 1));
    const weg = suchWeg(B, B, tk, [best[0] % B, Math.floor(best[0] / B)], [best[1] % B, Math.floor(best[1] / B)]);
    for (const [x, y] of chaikin(ausduennen(weg), 2)) scheibe(B, B, x, y, 1.6, f => { if (!nass(f) && !fest[f]) hz.z[f] = 0; });
  }
  regionen(hz);
  nurGroesste(hz);
  for (let i = 0; i < B * B; i++) if (!hz.z[i] && art[i] === WAND && !nass(i)) art[i] = WEG;
  for (let i = 0; i < B * B; i++) if (hz.z[i] && art[i] !== WAND && !kern[i]) art[i] = WAND;

  const e: FreiEbene = { b: B, h: B, art, start: pos[0], ziel: pos[1], raeume: [], wasser, bruecken, quelle };
  // nichts schmaler als 3 Felder (der Kern ist überall mindestens 3 breit und bleibt)
  oeffnen(e, 3);
  // was dabei abgetrennt wurde, wird Fels
  const dz = abstaende(e, pos[0]);
  for (let i = 0; i < B * B; i++) if (art[i] !== WAND && dz[i] < 0) art[i] = WAND;

  // 6. Tropfsteinsäulen: einzelne Felsfelder, 7 × 7 frei ringsum, fern von Stationen und Wasser
  for (let y = 3; y < B - 3; y++) for (let x = 3; x < B - 3; x++) {
    if (r() > 0.04) continue;
    if (pos.some(([mx, my]) => Math.hypot(mx - x, my - y) < 5)) continue;
    let ringsFrei = true;
    for (let dy = -3; dy <= 3 && ringsFrei; dy++) for (let dx = -3; dx <= 3; dx++) {
      const j = (y + dy) * B + x + dx;
      if (art[j] === WAND || wasser?.[j]) { ringsFrei = false; break; }
    }
    if (ringsFrei) art[y * B + x] = WAND;
  }

  const raeume = stationenNachWeg(e, pos[0], g.stationen.map(k => pos[k]), HALLE);
  if (!raeume) return null;
  e.raeume = raeume;
  const tor = zielTor(e);
  if (!tor) return null;
  e.tor = tor;
  Object.assign(e, fleckSaele(e, g, pos, HALLE + 2));
  return e;
}

/**
 * Quelle: Der Bach beginnt dort, wo er zum ersten Mal neben begehbarem Boden fließt (vor jeder Brücke). Dort entsteht eine
 * gerade Felswand von 4 Feldern quer zum Lauf, dahinter Fels, davor ein Becken von 4 × 3 Feldern; das Wasser oberhalb verschwindet.
 * `fest` markiert den Fels, den der Zellautomat nicht anrühren darf.
 */
function legeQuelle(B: number, art: Uint8Array, wasser: Uint8Array, lauf: [number, number][], fest: Uint8Array): Quelle | null {
  const begehbar = (x: number, y: number) => x > 0 && y > 0 && x < B - 1 && y < B - 1 && art[y * B + x] !== WAND && !wasser[y * B + x];
  const unterBruecke = (x: number, y: number) => art[y * B + x] !== WAND && !!wasser[y * B + x];
  let i = -1;
  for (let n = 4; n < lauf.length - 6 && i < 0; n++) {
    const [lx, ly] = lauf[n];
    let nah = false, bruecke = false;
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const x = Math.floor(lx) + dx, y = Math.floor(ly) + dy;
      if (x < 1 || y < 1 || x >= B - 1 || y >= B - 1) continue;
      if (begehbar(x, y)) nah = true;
      if (unterBruecke(x, y)) bruecke = true;
    }
    if (bruecke) return null; // erst eine Brücke, dann Boden: keine Quelle davor möglich
    if (nah) i = n;
  }
  if (i < 0) return null;
  const [ax, ay] = lauf[i], [bx, by] = lauf[Math.min(lauf.length - 1, i + 4)];
  const waag = Math.abs(bx - ax) >= Math.abs(by - ay);
  const dx = waag ? Math.sign(bx - ax) || 1 : 0, dy = waag ? 0 : Math.sign(by - ay) || 1;
  const px = -dy, py = dx;
  const qx = Math.floor(ax), qy = Math.floor(ay);
  const zelle = (m: number, k: number) => [qx + dx * m + px * k, qy + dy * m + py * k];
  const innen = (x: number, y: number) => x > 1 && y > 1 && x < B - 2 && y < B - 2;
  for (let m = -3; m <= 3; m++) for (let k = -2; k <= 1; k++) if (!innen(...(zelle(m, k) as [number, number]))) return null;
  // Wasser oberhalb der Quelle verschwindet
  for (let f = 0; f < B * B; f++) {
    if (!wasser[f]) continue;
    const x = f % B + 0.5, y = Math.floor(f / B) + 0.5;
    let best = 0, bd = Infinity;
    lauf.forEach(([lx, ly], n) => { const d = (lx - x) ** 2 + (ly - y) ** 2; if (d < bd) { bd = d; best = n; } });
    if (best <= i) wasser[f] = 0;
  }
  // Wand (m = 0) und Fels dahinter
  for (let m = -3; m <= 0; m++) for (let k = m === 0 ? -2 : -3; k <= (m === 0 ? 1 : 2); k++) {
    const [x, y] = zelle(m, k);
    art[y * B + x] = WAND; wasser[y * B + x] = 0; fest[y * B + x] = 1;
  }
  // Becken davor
  for (let m = 1; m <= 3; m++) for (let k = -2; k <= 1; k++) {
    const [x, y] = zelle(m, k);
    if (art[y * B + x] === PLATZ) return null;
    art[y * B + x] = WAND; wasser[y * B + x] = 1;
  }
  return { x: qx + 0.5 + dx * 0.5 - px * 0.5, y: qy + 0.5 + dy * 0.5 - py * 0.5, dx, dy, breite: 4 };
}

/**
 * Steintor am Ziel: von der Zielmitte in jede Richtung bis zur Wand; dort müssen 3 Felder nebeneinander
 * mindestens 4 Felder Fels hinter sich haben (der Gang hinter dem Tor ist 4,5 m tief).
 */
export function zielTor(e: FreiEbene): Tor | null {
  const [zx, zy] = e.ziel;
  let best: Tor | null = null, bestTiefe = 0;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    let x = zx, y = zy, n = 0;
    while (n < 14 && e.art[y * e.b + x] !== WAND) { x += dx; y += dy; n++; }
    if (n >= 14) continue;
    let tiefe = 9;
    for (let s = -1; s <= 1; s++) {
      const qx = x + dy * s, qy = y + dx * s;
      // das Feld vor der Wand muss begehbar sein, sonst ist es keine glatte Wandlinie
      const vor = (qy - dy) * e.b + qx - dx;
      if (e.art[vor] === WAND) { tiefe = 0; break; }
      tiefe = Math.min(tiefe, wandDickeBei(e, qx, qy, dx, dy));
    }
    if (tiefe >= 4 && tiefe > bestTiefe) { bestTiefe = tiefe; best = { x, y, dx, dy, breite: 3, tiefe }; }
  }
  return best;
}

/** Eine Höhlenkarte mit `zimmer` Stationen; gleicher Seed, gleiche Karte */
export function hoehlenEbene(zimmer: number, seed: number, wahl: HoehlenWahl = {}): FreiEbene {
  for (let v = 0; v < 40; v++) {
    const e = versuch(zimmer, seed * 613 + v * 37 + 11, wahl);
    if (e && alleErreichbar(e)) return e;
  }
  throw new Error("Höhlenkarte ließ sich nicht bauen");
}

