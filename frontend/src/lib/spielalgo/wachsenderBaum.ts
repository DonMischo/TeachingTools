/**
 * »Growing Tree« (wachsender Baum): ein Labyrinth-Erzeuger mit Stellschrauben.
 * Er hält eine Liste offener Zellen. Wer immer die NEUESTE nimmt, ist der
 * Backtracker; wer eine ZUFÄLLIGE nimmt, verhält sich wie Prim. Dazwischen
 * mischt der Regler `neueste`. Dazu Vorlieben für Geradeaus und Waagrecht.
 *
 * Arbeitet auf demselben Raster wie `lib/regeln/labyrinth` (Lab, K), damit
 * Zeichnen und Kennzahlen gleich bleiben.
 */
import { K, type Lab } from "@/lib/regeln/labyrinth";

export interface BaumOptionen {
  /** Anteil der Schritte, die die neueste Zelle nehmen (1 = Backtracker, 0 = wie Prim) */
  neueste: number;
  /** Vorliebe, die Richtung beizubehalten (0 = egal, 1 = möglichst geradeaus) */
  geradeaus: number;
  /** Vorliebe für waagrechte Gänge (0 = nur senkrecht, 0,5 = egal, 1 = nur waagrecht) */
  waagrecht: number;
  /** Startzelle: Ecke oben links oder Mitte */
  start: "ecke" | "mitte";
}

export const BAUM_STANDARD: BaumOptionen = { neueste: 0.75, geradeaus: 0, waagrecht: 0.5, start: "ecke" };

type Zelle = [number, number];
const RICHT: Zelle[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function* wachsenderBaum(l: Lab, o: BaumOptionen, rng: () => number): Generator<string> {
  const { n, R } = l;
  const idx = (x: number, y: number) => (2 * y + 1) * R + 2 * x + 1;
  const wand = (a: Zelle, b: Zelle) => (a[1] + b[1] + 1) * R + a[0] + b[0] + 1;
  l.k.fill(K.WAND);
  l.menge.fill(-1);
  const drin = new Uint8Array(n * n);
  const herkunft = new Int8Array(n * n).fill(-1); // Richtung, aus der die Zelle betreten wurde
  const s: Zelle = o.start === "mitte" ? [n >> 1, n >> 1] : [0, 0];
  const liste: Zelle[] = [s];
  drin[s[1] * n + s[0]] = 1;
  l.k[idx(...s)] = K.KOPF;
  yield `Start bei ${s[0]}|${s[1]}. Die Liste enthält eine Zelle.`;

  while (liste.length) {
    const neu = rng() < o.neueste;
    const li = neu ? liste.length - 1 : Math.floor(rng() * liste.length);
    const c = liste[li];
    const frei = RICHT.map((d, r) => ({ d, r })).filter(({ d }) => {
      const x = c[0] + d[0], y = c[1] + d[1];
      return x >= 0 && y >= 0 && x < n && y < n && !drin[y * n + x];
    });
    if (!frei.length) {
      liste.splice(li, 1);
      l.k[idx(...c)] = K.OFFEN;
      l.liste = liste.slice(-30).reverse().map(([x, y]) => `${x}|${y}`);
      yield `${c[0]}|${c[1]} hat keine freien Nachbarn mehr und fliegt aus der Liste (${liste.length} übrig).`;
      continue;
    }
    // Gewichte: Geradeaus-Vorliebe und Waagrecht-Vorliebe
    const gew = frei.map(({ d, r }) => {
      let g = 1;
      if (herkunft[c[1] * n + c[0]] === r) g *= 1 + 8 * o.geradeaus;
      g *= d[0] ? 2 * o.waagrecht + 0.02 : 2 * (1 - o.waagrecht) + 0.02;
      return g;
    });
    let t = rng() * gew.reduce((a, b) => a + b, 0), wahl = 0;
    while (t > gew[wahl] && wahl < gew.length - 1) { t -= gew[wahl]; wahl++; }
    const { d, r } = frei[wahl];
    const z: Zelle = [c[0] + d[0], c[1] + d[1]];
    drin[z[1] * n + z[0]] = 1;
    herkunft[z[1] * n + z[0]] = r;
    l.k[wand(c, z)] = K.OFFEN;
    l.k[idx(...c)] = K.SPUR;
    l.k[idx(...z)] = K.KOPF;
    liste.push(z);
    l.liste = liste.slice(-30).reverse().map(([x, y]) => `${x}|${y}`);
    yield `${neu ? "Neueste" : "Zufällige"} Zelle ${c[0]}|${c[1]} gewählt, Gang nach ${z[0]}|${z[1]}.`;
    if (l.k[idx(...z)] === K.KOPF) l.k[idx(...z)] = K.SPUR;
  }
  for (let i = 0; i < l.k.length; i++) if (l.k[i] !== K.WAND) l.k[i] = K.OFFEN;
  l.liste = [];
  return "fertig";
}
