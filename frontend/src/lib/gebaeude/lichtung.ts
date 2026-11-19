/**
 * Lichtungskarten für die Naturwelten der freien 3D-Ansicht: statt Gängen eines Labyrinths
 * Lichtungen im Wald, verbunden durch geschwungene Pfade, mit Rundwegen und einem Bach.
 *
 *  1. Lichtungen verteilen (Poisson-Scheiben: zufällig, aber nie zu eng), Ankunft nahe einer
 *     Ecke, Ziel möglichst weit weg.
 *  2. Ablauf als Graph: kürzeste Verbindungen aller Lichtungen (Prim), dazu einige Querwege,
 *     die Schleifen schließen und sich mit keinem anderen Weg kreuzen — man kann im Kreis gehen
 *     und anderen Wegen zurück.
 *  3. Pfade: Wegsuche (Dijkstra) über ein Kostenfeld aus Rauschen, damit sie sich winden statt
 *     schnurgerade zu laufen; dann geglättet (Chaikin) und 3–4 Felder breit gezogen.
 *  4. Lichtungen als rundliche Flecken mit welligem Rand.
 *  5. Bach (wahlweise): eine geschwungene Linie von Rand zu Rand, die um die Lichtungen
 *     herumfließt. Wo sie einen Pfad kreuzt, bleibt der Pfad begehbar — dort steht eine Brücke.
 *
 * Ergebnis ist eine FreiEbene wie bei den anderen Karten (Felder WAND/WEG/PLATZ), dazu `wasser`
 * (Bachfelder, nicht begehbar) und `bruecken`. Reine Rechnung ohne Zeichnen.
 */
import type { FreiEbene, FreiRaum } from "./frei";
import type { Punkt } from "./plan";

const WAND = 0, WEG = 1, PLATZ = 2;

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

/** kleiner, schneller Zufall mit Seed */
function zufall(seed: number): () => number {
  let a = (seed * 2654435761) >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Wertrauschen auf einem Gitter der Weite `w`, weich interpoliert, Werte 0…1 */
function rauschfeld(B: number, w: number, r: () => number): Float32Array {
  const n = Math.ceil(B / w) + 2;
  const g = Float32Array.from({ length: n * n }, () => r());
  const f = new Float32Array(B * B);
  const glatt = (t: number) => t * t * (3 - 2 * t);
  for (let y = 0; y < B; y++) for (let x = 0; x < B; x++) {
    const gx = x / w, gy = y / w, ix = Math.floor(gx), iy = Math.floor(gy), fx = glatt(gx - ix), fy = glatt(gy - iy);
    const a = g[iy * n + ix], b = g[iy * n + ix + 1], c = g[(iy + 1) * n + ix], d = g[(iy + 1) * n + ix + 1];
    f[y * B + x] = (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
  }
  return f;
}

/** Dijkstra auf dem Raster (8 Nachbarn) nach Kosten je Feld; Weg von a nach b als Feldliste */
function billigsterWeg(B: number, kosten: Float32Array, a: Punkt, b: Punkt): Punkt[] {
  const d = new Float32Array(B * B).fill(Infinity), von = new Int32Array(B * B).fill(-1);
  const start = a[1] * B + a[0], ziel = b[1] * B + b[0];
  // binärer Heap aus (Abstand, Feld)
  const heap: [number, number][] = [];
  const hinein = (e: [number, number]) => {
    heap.push(e);
    for (let i = heap.length - 1; i > 0;) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; }
  };
  const heraus = () => {
    const oben = heap[0], letzt = heap.pop()!;
    if (heap.length) {
      heap[0] = letzt;
      for (let i = 0; ;) {
        const l = 2 * i + 1, rr = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (rr < heap.length && heap[rr][0] < heap[m][0]) m = rr;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return oben;
  };
  d[start] = 0;
  hinein([0, start]);
  while (heap.length) {
    const [dd, i] = heraus();
    if (i === ziel) break;
    if (dd > d[i]) continue;
    const x = i % B, y = (i - x) / B;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx, ny = y + dy;
      if (nx < 1 || ny < 1 || nx >= B - 1 || ny >= B - 1) continue;
      const j = ny * B + nx, schritt = (dx && dy ? Math.SQRT2 : 1) * (kosten[i] + kosten[j]) / 2;
      if (dd + schritt < d[j]) { d[j] = dd + schritt; von[j] = i; hinein([d[j], j]); }
    }
  }
  const aus: Punkt[] = [];
  for (let i = ziel; i >= 0; i = von[i]) { const x = i % B; aus.push([x, (i - x) / B]); if (i === start) break; }
  return aus.reverse();
}

/** Ecken abrunden: jede Strecke an 1/4 und 3/4 teilen, zweimal */
function chaikin(p: [number, number][], runden = 2): [number, number][] {
  let q = p;
  for (let k = 0; k < runden; k++) {
    if (q.length < 3) return q;
    const n: [number, number][] = [q[0]];
    for (let i = 0; i < q.length - 1; i++) {
      const [ax, ay] = q[i], [bx, by] = q[i + 1];
      n.push([ax * 0.75 + bx * 0.25, ay * 0.75 + by * 0.25], [ax * 0.25 + bx * 0.75, ay * 0.25 + by * 0.75]);
    }
    n.push(q[q.length - 1]);
    q = n;
  }
  return q;
}

/** jedes zweite Feld behalten (Dijkstra-Treppen werden so zu Schrägen, bevor Chaikin rundet) */
const ausduennen = (p: Punkt[]): [number, number][] => p.filter((_, i) => i % 3 === 0 || i === p.length - 1).map(([x, y]) => [x + 0.5, y + 0.5]);

/** Kreisscheibe mit Radius `rad` um (x, y) in Feldern: `setze(i)` für jedes Feld darin */
function scheibe(B: number, x: number, y: number, rad: number, setze: (i: number) => void) {
  for (let fy = Math.floor(y - rad); fy <= Math.ceil(y + rad); fy++) for (let fx = Math.floor(x - rad); fx <= Math.ceil(x + rad); fx++) {
    if (fx < 1 || fy < 1 || fx >= B - 1 || fy >= B - 1) continue;
    if ((fx + 0.5 - x) ** 2 + (fy + 0.5 - y) ** 2 <= rad * rad) setze(fy * B + fx);
  }
}

/** schneiden sich die Strecken ab und cd (ohne gemeinsame Endpunkte)? */
function kreuzen(a: Punkt, b: Punkt, c: Punkt, d: Punkt): boolean {
  const o = (p: Punkt, q: Punkt, s: Punkt) => Math.sign((q[0] - p[0]) * (s[1] - p[1]) - (q[1] - p[1]) * (s[0] - p[0]));
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
}

/** halbe Breite der Lichtungen (Felder): passt zum Platz der Stationen in den anderen Karten */
const LICHTUNG = 5.2;
/** Mindestabstand der Lichtungsmitten (Felder) */
const ABSTAND = 17;
const RAND = 7;

function versuch(zimmer: number, seed: number, wahl: LichtungsWahl): (FreiEbene & { wasser?: Uint8Array; bruecken?: Bruecke[] }) | null {
  const r = zufall(seed);
  const m = zimmer + 2;
  // Fläche je Lichtung etwa ABSTAND² · 1,25
  const B = Math.max(40, Math.round(Math.sqrt(m * ABSTAND * ABSTAND * 1.3)) + 2 * RAND);

  // 1. Lichtungen: Poisson-Scheiben durch Wurfversuche
  const mitten: Punkt[] = [];
  for (let k = 0; k < 4000 && mitten.length < m; k++) {
    const p: Punkt = [RAND + Math.floor(r() * (B - 2 * RAND)), RAND + Math.floor(r() * (B - 2 * RAND))];
    if (mitten.every(q => Math.hypot(q[0] - p[0], q[1] - p[1]) >= ABSTAND)) mitten.push(p);
  }
  if (mitten.length < m) return null;
  // Ankunft: nahe der Ecke oben links; Ziel: am weitesten davon
  mitten.sort((a, b) => a[0] + a[1] - (b[0] + b[1]));
  const start = mitten[0];
  const weit = (p: Punkt) => Math.hypot(p[0] - start[0], p[1] - start[1]);
  const rest = mitten.slice(1).sort((a, b) => weit(a) - weit(b));
  const ziel = rest.pop()!;
  const alle = [start, ...rest, ziel];

  // 2. Graph: Prim, dann kreuzungsfreie Querwege für Schleifen
  const kanten: [number, number][] = [];
  const drin = new Set([0]);
  while (drin.size < alle.length) {
    let best: [number, number] | null = null, bd = Infinity;
    for (const i of drin) for (let j = 0; j < alle.length; j++) {
      if (drin.has(j)) continue;
      const d = Math.hypot(alle[i][0] - alle[j][0], alle[i][1] - alle[j][1]);
      if (d < bd) { bd = d; best = [i, j]; }
    }
    kanten.push(best!);
    drin.add(best![1]);
  }
  const zusatz = Math.max(1, Math.round(alle.length / 3));
  const kandidaten: [number, number, number][] = [];
  for (let i = 0; i < alle.length; i++) for (let j = i + 1; j < alle.length; j++) {
    if (kanten.some(([a, b]) => (a === i && b === j) || (a === j && b === i))) continue;
    const d = Math.hypot(alle[i][0] - alle[j][0], alle[i][1] - alle[j][1]);
    if (d < ABSTAND * 2.1) kandidaten.push([i, j, d + r() * 6]);
  }
  kandidaten.sort((a, b) => a[2] - b[2]);
  for (const [i, j] of kandidaten) {
    if (kanten.length >= alle.length - 1 + zusatz) break;
    // nicht über andere Wege und nicht durch eine fremde Lichtung
    if (kanten.some(([a, b]) => a !== i && a !== j && b !== i && b !== j && kreuzen(alle[i], alle[j], alle[a], alle[b]))) continue;
    const durch = alle.some((p, k) => k !== i && k !== j && abstandZurStrecke(p, alle[i], alle[j]) < LICHTUNG + 2);
    if (durch) continue;
    kanten.push([i, j]);
  }

  // 3. Pfade über ein Kostenfeld aus Rauschen; fremde Lichtungen kosten viel
  const art = new Uint8Array(B * B);
  const welle = rauschfeld(B, 6, r), fein = rauschfeld(B, 2.5, r);
  const kosten = new Float32Array(B * B);
  for (let i = 0; i < B * B; i++) kosten[i] = 1 + welle[i] * 7 + fein[i] * 2;
  for (const [i, j] of kanten) {
    const k2 = kosten.slice();
    alle.forEach((p, k) => { if (k !== i && k !== j) scheibe(B, p[0] + 0.5, p[1] + 0.5, LICHTUNG + 3, f => { k2[f] += 60; }); });
    const weg = billigsterWeg(B, k2, alle[i], alle[j]);
    const glatt = chaikin(ausduennen(weg), 3);
    // Pfadbreite schwankt leicht (3–4 Felder)
    glatt.forEach(([x, y], n) => scheibe(B, x, y, 1.55 + 0.35 * fein[Math.floor(y) * B + Math.floor(x)] + (n % 7 === 0 ? 0.1 : 0), f => { if (art[f] === WAND) art[f] = WEG; }));
  }

  // 4. Lichtungen: rundlich mit welligem Rand (mindestens LICHTUNG, damit die Stationen Platz haben)
  for (const [x, y] of alle) {
    const phase = r() * 6.28, phase2 = r() * 6.28;
    for (let fy = y - 9; fy <= y + 9; fy++) for (let fx = x - 9; fx <= x + 9; fx++) {
      if (fx < 1 || fy < 1 || fx >= B - 1 || fy >= B - 1) continue;
      const dx = fx - x, dy = fy - y, w = Math.atan2(dy, dx);
      const rad = LICHTUNG + 0.6 + 0.9 * Math.sin(3 * w + phase) * 0.5 + 0.6 * Math.sin(5 * w + phase2) * 0.5 + 0.6;
      if (Math.hypot(dx, dy) <= rad) art[fy * B + fx] = PLATZ;
    }
  }

  // 5. Bach: von einem Rand zum gegenüberliegenden, weit um die Lichtungen herum
  let wasser: Uint8Array | undefined, bruecken: Bruecke[] | undefined;
  if (wahl.bach) {
    const bk = new Float32Array(B * B);
    for (let i = 0; i < B * B; i++) bk[i] = 1 + welle[i] * 10;
    for (const p of alle) scheibe(B, p[0] + 0.5, p[1] + 0.5, LICHTUNG + 3, f => { bk[f] += 120; });
    // nicht am Kartenrand entlang: dort sieht ihn niemand und er kreuzt keinen Weg
    for (let y = 0; y < B; y++) for (let x = 0; x < B; x++) {
      const rand = Math.min(x, y, B - 1 - x, B - 1 - y);
      if (rand < RAND + 2) bk[y * B + x] += (RAND + 2 - rand) * 12;
    }
    // Wege lieber im rechten Winkel kreuzen: Wegfelder kosten etwas mehr
    for (let i = 0; i < B * B; i++) if (art[i] === WEG) bk[i] += 25;
    const quer = r() < 0.5;
    const a: Punkt = quer ? [1, Math.floor(B * (0.3 + r() * 0.4))] : [Math.floor(B * (0.3 + r() * 0.4)), 1];
    const b: Punkt = quer ? [B - 2, Math.floor(B * (0.3 + r() * 0.4))] : [Math.floor(B * (0.3 + r() * 0.4)), B - 2];
    const lauf = chaikin(ausduennen(billigsterWeg(B, bk, a, b)), 3);
    wasser = new Uint8Array(B * B);
    const w = wasser;
    lauf.forEach(([x, y]) => scheibe(B, x, y, 1.75, f => { if (art[f] !== PLATZ) w[f] = 1; }));
    // Brücken: zusammenhängende Stücke, wo Bach und Pfad sich treffen
    bruecken = [];
    const gesehen = new Uint8Array(B * B);
    for (let i = 0; i < B * B; i++) {
      if (!w[i] || art[i] !== WEG || gesehen[i]) continue;
      const stueck: number[] = [], offen = [i];
      gesehen[i] = 1;
      while (offen.length) {
        const k = offen.pop()!;
        stueck.push(k);
        const x = k % B, y = (k - x) / B;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const j = (y + dy) * B + x + dx;
          if (w[j] && art[j] === WEG && !gesehen[j]) { gesehen[j] = 1; offen.push(j); }
        }
      }
      const mx = stueck.reduce((s, k) => s + (k % B), 0) / stueck.length + 0.5;
      // ein Bach, der lange neben bzw. auf dem Pfad läuft, passt unter keine Brücke: diese Karte verwerfen
      const xs = stueck.map(k => k % B), ys = stueck.map(k => Math.floor(k / B));
      if (Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) > 6.5) return null;
      const my = stueck.reduce((s, k) => s + Math.floor(k / B), 0) / stueck.length + 0.5;
      // Richtung des Pfads: senkrecht zum Bach an dieser Stelle
      let bi = 0, bd = Infinity;
      lauf.forEach(([x, y], n) => { const d = (x - mx) ** 2 + (y - my) ** 2; if (d < bd) { bd = d; bi = n; } });
      const [p0, p1] = [lauf[Math.max(0, bi - 2)], lauf[Math.min(lauf.length - 1, bi + 2)]];
      const bachWinkel = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);
      bruecken.push({ x: mx, y: my, winkel: bachWinkel + Math.PI / 2, lang: 3.5 * 2 });
    }
    // Bachfelder sind nicht begehbar, außer auf der Brücke (dort bleibt der Pfad)
    for (let i = 0; i < B * B; i++) if (w[i] && art[i] !== WEG) art[i] = WAND;
    // Bachfelder unter Brücken bleiben Weg, gelten aber als Wasser für das Zeichnen
  }

  const e: FreiEbene & { wasser?: Uint8Array; bruecken?: Bruecke[] } = {
    b: B, h: B, art, start, ziel,
    raeume: rest.map(([x, y]): FreiRaum => ({ x, y, r: LICHTUNG })),
    wasser, bruecken,
  };
  return e;
}

function abstandZurStrecke(p: Punkt, a: Punkt, b: Punkt): number {
  const vx = b[0] - a[0], vy = b[1] - a[1], l2 = vx * vx + vy * vy || 1;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / l2));
  return Math.hypot(p[0] - a[0] - vx * t, p[1] - a[1] - vy * t);
}

/** Eine Lichtungskarte mit `zimmer` Stationen; gleicher Seed, gleiche Karte */
export function lichtungsEbene(zimmer: number, seed: number, wahl: LichtungsWahl = {}): FreiEbene {
  for (let v = 0; v < 20; v++) {
    const e = versuch(zimmer, seed * 977 + v * 31 + 5, wahl);
    if (e && erreichbar(e)) return e;
  }
  throw new Error("Lichtungskarte ließ sich nicht bauen");
}

/** alle Stationen und das Ziel von der Ankunft aus erreichbar? */
function erreichbar(e: FreiEbene): boolean {
  const B = e.b, gesehen = new Uint8Array(B * B), offen = [e.start[1] * B + e.start[0]];
  gesehen[offen[0]] = 1;
  while (offen.length) {
    const i = offen.pop()!, x = i % B, y = (i - x) / B;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, j = ny * B + nx;
      if (nx >= 0 && ny >= 0 && nx < B && ny < B && e.art[j] !== WAND && !gesehen[j]) { gesehen[j] = 1; offen.push(j); }
    }
  }
  return [e.ziel, ...e.raeume.map(p => [p.x, p.y] as Punkt)].every(([x, y]) => gesehen[y * B + x]);
}
