/**
 * Labyrinth-Algorithmen zum Zuschauen: Erzeuger und Löser als
 * Generator-Funktionen, die nach jedem Schritt anhalten (`yield`).
 *
 * Das Labyrinth liegt auf einem Raster der Seitenlänge R = 2n+1: Zellen auf
 * ungeraden Koordinaten, dazwischen Wände bzw. Durchgänge. Jede Rasterzelle
 * hat eine Art (`K`), die die Bühne einfärbt.
 */

export const K = { WAND: 0, OFFEN: 1, KOPF: 2, SPUR: 3, RAND: 4, BESUCHT: 5, WEG: 6 } as const;

export type Erzeuger = "backtracker" | "prim" | "kruskal" | "wilson";
export type Loeser = "dfs" | "bfs" | "astar";

export interface Lab {
  n: number;
  R: number;
  k: Uint8Array;
  /** Kruskal: Mengen-Nummer je Rasterzelle (−1 = keine) für die Einfärbung */
  menge: Int32Array;
  /** was die Datenstruktur gerade enthält (oben/vorn zuerst) */
  liste: string[];
  notiz: string;
}

export function neuesLab(n: number): Lab {
  const R = 2 * n + 1;
  return { n, R, k: new Uint8Array(R * R), menge: new Int32Array(R * R).fill(-1), liste: [], notiz: "" };
}

type Zelle = [number, number];
const RICHTUNGEN: Zelle[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

const idx = (l: Lab, x: number, y: number) => (2 * y + 1) * l.R + 2 * x + 1;
const wandIdx = (l: Lab, a: Zelle, b: Zelle) => (a[1] + b[1] + 1) * l.R + a[0] + b[0] + 1;
const name = ([x, y]: Zelle) => `${x}|${y}`;

function nachbarn(l: Lab, [x, y]: Zelle): Zelle[] {
  return RICHTUNGEN.map(([dx, dy]) => [x + dx, y + dy] as Zelle)
    .filter(([a, b]) => a >= 0 && b >= 0 && a < l.n && b < l.n);
}

function zieh<T>(a: T[], rng: () => number): T {
  return a[Math.floor(rng() * a.length)];
}

function mische<T>(a: T[], rng: () => number): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Erzeuger ─────────────────────────────────────────────────────────────

export function* erzeuge(l: Lab, art: Erzeuger, rng: () => number): Generator<void> {
  l.k.fill(K.WAND);
  l.menge.fill(-1);
  if (art === "backtracker") yield* backtracker(l, rng);
  else if (art === "prim") yield* prim(l, rng);
  else if (art === "kruskal") yield* kruskal(l, rng);
  else yield* wilson(l, rng);
  l.menge.fill(-1);
  l.liste = [];
  l.notiz = "fertig";
}

function* backtracker(l: Lab, rng: () => number): Generator<void> {
  const besucht = new Uint8Array(l.n * l.n);
  const stapel: Zelle[] = [[0, 0]];
  besucht[0] = 1;
  l.k[idx(l, 0, 0)] = K.KOPF;
  const zeige = () => { l.liste = stapel.slice().reverse().map(name); };
  zeige();
  yield;
  while (stapel.length) {
    const c = stapel[stapel.length - 1];
    const frei = nachbarn(l, c).filter(([x, y]) => !besucht[y * l.n + x]);
    if (frei.length) {
      const d = zieh(frei, rng);
      besucht[d[1] * l.n + d[0]] = 1;
      l.k[idx(l, ...c)] = K.SPUR;
      l.k[wandIdx(l, c, d)] = K.SPUR;
      l.k[idx(l, ...d)] = K.KOPF;
      stapel.push(d);
      l.notiz = `vorwärts nach ${name(d)} — auf den Stapel`;
    } else {
      stapel.pop();
      l.k[idx(l, ...c)] = K.OFFEN;
      const zurueck = stapel[stapel.length - 1];
      if (zurueck) {
        l.k[wandIdx(l, c, zurueck)] = K.OFFEN;
        l.k[idx(l, ...zurueck)] = K.KOPF;
      }
      l.notiz = `Sackgasse bei ${name(c)} — vom Stapel nehmen, zurück`;
    }
    zeige();
    yield;
  }
}

function* prim(l: Lab, rng: () => number): Generator<void> {
  const drin = new Uint8Array(l.n * l.n);
  const rand: Zelle[] = [];
  const imRand = new Uint8Array(l.n * l.n);
  const nimm = (c: Zelle) => {
    drin[c[1] * l.n + c[0]] = 1;
    l.k[idx(l, ...c)] = K.OFFEN;
    for (const d of nachbarn(l, c)) {
      const i = d[1] * l.n + d[0];
      if (!drin[i] && !imRand[i]) { imRand[i] = 1; rand.push(d); l.k[idx(l, ...d)] = K.RAND; }
    }
  };
  const start: Zelle = [Math.floor(rng() * l.n), Math.floor(rng() * l.n)];
  nimm(start);
  l.liste = rand.map(name);
  l.notiz = `Start bei ${name(start)}; blau = Rand`;
  yield;
  while (rand.length) {
    const i = Math.floor(rng() * rand.length);
    const c = rand[i];
    rand.splice(i, 1);
    const alt = zieh(nachbarn(l, c).filter(([x, y]) => drin[y * l.n + x]), rng);
    l.k[wandIdx(l, c, alt)] = K.OFFEN;
    nimm(c);
    l.k[idx(l, ...c)] = K.KOPF;
    l.liste = rand.map(name);
    l.notiz = `zufällige Randzelle ${name(c)} an ${name(alt)} anschließen`;
    yield;
    l.k[idx(l, ...c)] = K.OFFEN;
  }
}

function* kruskal(l: Lab, rng: () => number): Generator<void> {
  const eltern = Array.from({ length: l.n * l.n }, (_, i) => i);
  const wurzel = (i: number): number => (eltern[i] === i ? i : (eltern[i] = wurzel(eltern[i])));
  for (let y = 0; y < l.n; y++) for (let x = 0; x < l.n; x++) {
    l.k[idx(l, x, y)] = K.OFFEN;
    l.menge[idx(l, x, y)] = y * l.n + x;
  }
  const waende: [Zelle, Zelle][] = [];
  for (let y = 0; y < l.n; y++) for (let x = 0; x < l.n; x++) {
    if (x + 1 < l.n) waende.push([[x, y], [x + 1, y]]);
    if (y + 1 < l.n) waende.push([[x, y], [x, y + 1]]);
  }
  mische(waende, rng);
  let inseln = l.n * l.n;
  l.notiz = `${inseln} Inseln — jede Zelle ist ihre eigene`;
  yield;
  for (const [a, b] of waende) {
    const ra = wurzel(a[1] * l.n + a[0]), rb = wurzel(b[1] * l.n + b[0]);
    if (ra === rb) {
      l.notiz = `Wand ${name(a)}–${name(b)} bleibt: beide Seiten sind schon verbunden (sonst Rundweg)`;
      l.liste = [`${inseln} Inseln`];
      yield;
      continue;
    }
    eltern[rb] = ra;
    inseln--;
    l.k[wandIdx(l, a, b)] = K.OFFEN;
    // Die ganze angeschlossene Insel übernimmt die Farbe der anderen.
    const farbe = l.menge[idx(l, ...a)];
    for (let y = 0; y < l.n; y++) for (let x = 0; x < l.n; x++) {
      if (wurzel(y * l.n + x) === ra) l.menge[idx(l, x, y)] = farbe;
    }
    // Durchgänge bekommen die Farbe ihrer Nachbarzelle.
    for (let i = 0; i < l.k.length; i++) {
      const x = i % l.R, y = (i - x) / l.R;
      if (l.k[i] === K.OFFEN && (x % 2 === 0 || y % 2 === 0)) l.menge[i] = l.menge[x % 2 === 0 ? i - 1 : i - l.R];
    }
    l.notiz = `Wand ${name(a)}–${name(b)} fällt: zwei Inseln werden eine`;
    l.liste = [`${inseln} Inseln`];
    yield;
    if (inseln === 1) break;
  }
}

function* wilson(l: Lab, rng: () => number): Generator<void> {
  const drin = new Uint8Array(l.n * l.n);
  const erste: Zelle = [Math.floor(rng() * l.n), Math.floor(rng() * l.n)];
  drin[erste[1] * l.n + erste[0]] = 1;
  l.k[idx(l, ...erste)] = K.OFFEN;
  let rest = l.n * l.n - 1;
  l.notiz = `Start: ${name(erste)} gehört zum Labyrinth`;
  yield;
  while (rest > 0) {
    const frei: Zelle[] = [];
    for (let y = 0; y < l.n; y++) for (let x = 0; x < l.n; x++) if (!drin[y * l.n + x]) frei.push([x, y]);
    const pfad: Zelle[] = [zieh(frei, rng)];
    l.k[idx(l, ...pfad[0])] = K.KOPF;
    l.liste = [name(pfad[0])];
    l.notiz = `Zufallsspaziergang ab ${name(pfad[0])}`;
    yield;
    for (;;) {
      const c = pfad[pfad.length - 1];
      const d = zieh(nachbarn(l, c), rng);
      const schleife = pfad.findIndex(p => p[0] === d[0] && p[1] === d[1]);
      if (schleife >= 0) {
        // Schleife ausradieren: alles nach dem ersten Besuch von d fällt weg.
        for (let i = pfad.length - 1; i > schleife; i--) {
          l.k[idx(l, ...pfad[i])] = K.WAND;
          l.k[wandIdx(l, pfad[i], pfad[i - 1])] = K.WAND;
        }
        pfad.length = schleife + 1;
        l.k[idx(l, ...d)] = K.KOPF;
        l.notiz = `Schleife! Zurück bis ${name(d)} ausradieren`;
      } else {
        l.k[idx(l, ...c)] = K.SPUR;
        l.k[wandIdx(l, c, d)] = K.SPUR;
        if (drin[d[1] * l.n + d[0]]) {
          for (let i = 0; i < pfad.length; i++) {
            drin[pfad[i][1] * l.n + pfad[i][0]] = 1;
            l.k[idx(l, ...pfad[i])] = K.OFFEN;
            l.k[wandIdx(l, pfad[i], pfad[i + 1] ?? d)] = K.OFFEN;
          }
          rest -= pfad.length;
          l.liste = [];
          l.notiz = `Labyrinth erreicht — der Weg (${pfad.length} Zellen) wird fest`;
          yield;
          break;
        }
        pfad.push(d);
        l.k[idx(l, ...d)] = K.KOPF;
        l.notiz = `weiter nach ${name(d)}`;
      }
      l.liste = pfad.slice().reverse().map(name);
      yield;
    }
  }
}

/** Reißt zufällig `anzahl` Wände zwischen zwei Zellen ein — ergibt Rundwege. */
export function entferneWaende(l: Lab, anzahl: number, rng: () => number): number {
  const kandidaten: number[] = [];
  for (let y = 1; y < l.R - 1; y++) for (let x = 1; x < l.R - 1; x++) {
    const i = y * l.R + x;
    if (l.k[i] !== K.WAND || (x % 2) === (y % 2)) continue;
    const a = x % 2 === 0 ? [i - 1, i + 1] : [i - l.R, i + l.R];
    if (l.k[a[0]] !== K.WAND && l.k[a[1]] !== K.WAND) kandidaten.push(i);
  }
  mische(kandidaten, rng);
  const weg = kandidaten.slice(0, anzahl);
  for (const i of weg) l.k[i] = K.OFFEN;
  return weg.length;
}

// ── Löser ────────────────────────────────────────────────────────────────

export interface Loesung { besucht: number; weg: number; gefunden: boolean }

export const START: Zelle = [0, 0];
export const ziel = (l: Lab): Zelle => [l.n - 1, l.n - 1];

export function* loese(l: Lab, art: Loeser, erg: Loesung): Generator<void> {
  for (let i = 0; i < l.k.length; i++) if (l.k[i] !== K.WAND) l.k[i] = K.OFFEN;
  l.menge.fill(-1);
  erg.besucht = 0; erg.weg = 0; erg.gefunden = false;
  const Z = ziel(l);
  const key = ([x, y]: Zelle) => y * l.n + x;
  const h = ([x, y]: Zelle) => Math.abs(Z[0] - x) + Math.abs(Z[1] - y);
  const offen = (a: Zelle, b: Zelle) => l.k[wandIdx(l, a, b)] !== K.WAND;
  const herkunft = new Map<number, Zelle | null>([[key(START), null]]);
  const g = new Map<number, number>([[key(START), 0]]);
  const liste: Zelle[] = [START];
  l.k[idx(l, ...START)] = K.RAND;

  const zeige = () => {
    const sortiert = art === "dfs" ? liste.slice().reverse() : liste;
    l.liste = sortiert.map(c => (art === "astar" ? `${name(c)} f=${g.get(key(c))! + h(c)}` : name(c)));
  };
  zeige();
  l.notiz = art === "dfs" ? "Stapel: der zuletzt gefundene Nachbar kommt zuerst dran"
    : art === "bfs" ? "Schlange: wer zuerst gefunden wurde, kommt zuerst dran"
    : "A*: immer die Zelle mit dem kleinsten f = bisheriger Weg g + geschätzter Rest h";
  yield;

  while (liste.length) {
    let c: Zelle;
    if (art === "dfs") c = liste.pop()!;
    else if (art === "bfs") c = liste.shift()!;
    else {
      let best = 0;
      for (let i = 1; i < liste.length; i++) {
        const fi = g.get(key(liste[i]))! + h(liste[i]), fb = g.get(key(liste[best]))! + h(liste[best]);
        if (fi < fb || (fi === fb && h(liste[i]) < h(liste[best]))) best = i;
      }
      c = liste.splice(best, 1)[0];
    }
    if (l.k[idx(l, ...c)] === K.BESUCHT) continue;
    erg.besucht++;
    l.k[idx(l, ...c)] = K.BESUCHT;
    const her = herkunft.get(key(c));
    if (her) l.k[wandIdx(l, her, c)] = K.BESUCHT;
    if (c[0] === Z[0] && c[1] === Z[1]) {
      // Weg zurückverfolgen
      let p: Zelle | null = c;
      while (p) {
        l.k[idx(l, ...p)] = K.WEG;
        const q: Zelle | null = herkunft.get(key(p)) ?? null;
        if (q) { l.k[wandIdx(l, p, q)] = K.WEG; erg.weg++; }
        p = q;
      }
      erg.gefunden = true;
      l.liste = [];
      l.notiz = `Ziel erreicht: ${erg.weg} Schritte lang, ${erg.besucht} Zellen angeschaut`;
      yield;
      return;
    }
    for (const d of nachbarn(l, c)) {
      if (!offen(c, d) || l.k[idx(l, ...d)] === K.BESUCHT) continue;
      const neuG = g.get(key(c))! + 1;
      if (art === "astar" && g.has(key(d)) && g.get(key(d))! <= neuG) continue;
      if (art === "bfs" && herkunft.has(key(d))) continue;
      herkunft.set(key(d), c);
      g.set(key(d), neuG);
      liste.push(d);
      l.k[idx(l, ...d)] = K.RAND;
    }
    zeige();
    yield;
  }
  l.notiz = "kein Weg gefunden";
}

/** Alle Schritte eines Generators auf einmal. */
export function durch(gen: Generator<void>, max = 1_000_000) {
  for (let i = 0; i < max && !gen.next().done; i++);
}
