/**
 * Gemeinsamer Teil der Kartengeneratoren des TaskCrawlers (Vertrag mit den Baukästen:
 * TT-Weltenwerkstatt/docs/karten-vertrag.md). Alle Generatoren arbeiten gleich:
 *
 *  1. Ablauf: `zyklisch.ts` baut den Graphen (Start und Ziel auf einer Schleife, Stationen auf den Bögen).
 *  2. Der Graph wird in die Fläche gelegt: Jeder Knoten bekommt einen Ort (Lichtung, Halle, Saal),
 *     jede Kante einen Weg. Wie das geschieht, entscheidet die Weltart (lichtung.ts, hoehlenkarte.ts, saalkarte.ts).
 *  3. `wege.ts` prüft am Ende, dass alles erreichbar ist.
 *
 * Dazu die Angaben für die Weltbauer: Säle, Wanddicken, Durchgänge, Höhe, Ablauf und Seed.
 */
import { erzeugeAblauf, neuerAblauf, type Ablauf, type Zyklus } from "@/lib/spielalgo/zyklisch";
import { neueSuche, suche, type Feld } from "@/lib/spielalgo/wege";
import type { Punkt } from "./plan";

const WAND = 0, WEG = 1, PLATZ = 2;

/** Ein Saal: Rechteck (Gebäude) bzw. Fleck mit umschließendem Rechteck (Höhle, Wald), in Feldern */
export interface Saal {
  art: "start" | "ziel" | "station" | "halle" | "vorplatz";
  /** linke obere Ecke und Größe (bei Flecken das umschließende Rechteck) */
  x: number; y: number; b: number; h: number;
  /** Mittelfeld */
  mx: number; my: number;
  /** Knoten im Ablauf */
  knoten: number;
}

/** Tür bzw. Bogen zwischen Saal und Gang: zwei Felder breit, auf gerade Felder ausgerichtet */
export interface Durchgang {
  /** erstes Feld (kleinere Koordinate) auf der Innenkante der Wand */
  x: number; y: number;
  /** Richtung vom Saal in den Gang (eine Achse, ±1) */
  dx: number; dy: number;
  /** Breite längs der Wand und Tiefe durch die Wand, in Feldern */
  breite: number; tiefe: number;
  /** Saal, zu dem der Durchgang gehört */
  saal: number;
}

/** Ziel als Tor in der Wandlinie (Höhle): erstes Wandfeld in der Mitte, Richtung in den Fels */
export interface Tor { x: number; y: number; dx: number; dy: number; breite: number; tiefe: number }

/** Quelle des Bachs (Höhle): gerade Felswand von `breite` Feldern, davor das Becken; Mitte der Wandkante in Feldern, Richtung bachab */
export interface Quelle { x: number; y: number; dx: number; dy: number; breite: number }

/** Vorplatz unter freiem Himmel (Antike): Platz (Rechteck in Feldern) und der Kern des Tempels darauf (Wandfelder, Schauseite nach +y) */
export interface Vorplatz { platz: { x: number; y: number; b: number; h: number }; kern: { x: number; y: number; b: number; h: number } }

/** Der Ablauf, wie er in der Karte liegt: Graph aus zyklisch.ts und der Saal je Knoten */
export interface KartenAblauf extends Ablauf {
  zyklus: Zyklus;
  /** Saal je Knoten (Index in `saele`) */
  saal: number[];
}

/** kleiner, schneller Zufall mit Seed (wie in den anderen Spielalgorithmen) */
export function zufall(seed: number): () => number {
  let a = (seed * 2654435761) >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── 1. Ablauf ────────────────────────────────────────────────────────────

export interface Geplant {
  ablauf: Ablauf;
  zyklus: Zyklus;
  /** Knoten mit Stationen (genau `zimmer` Stück), die übrigen Mittelknoten sind Hallen ohne Aufgabe */
  stationen: number[];
  /** Sackgassen-Hallen ohne Aufgabe (1–2 je Ebene), nur für die Ausstattung */
  extra: number[];
}

/**
 * Ablauf für `zimmer` Stationen: eine Schleife ohne Schloss (der TaskCrawler kennt keine Schlüssel),
 * der lange Bogen so lang, dass alle Stationen Platz haben; ab fünf Stationen eine Nebenschleife.
 */
export function planeAblauf(zimmer: number, r: () => number): Geplant {
  const zyklen: Zyklus[] = ["zweiwege", "gefahr", "abkuerzung"];
  const zyklus = zyklen[Math.floor(r() * zyklen.length)];
  const neben = zimmer >= 5 ? 1 : 0;
  const mitte = (laenge: number) => 2 + laenge + (laenge > 0 && zyklus !== "abkuerzung" ? 1 : 0) + neben;
  let laenge = 0;
  while (mitte(laenge) < zimmer) laenge++;
  const ablauf = neuerAblauf();
  for (const _ of erzeugeAblauf(ablauf, { zyklus, laenge, neben, aussicht: 0, tempo: true }, r)) { /* bis zum Ende */ }
  // Sicht-Kanten gibt es mit aussicht = 0 nicht; Tür und Einweg sind im Spiel offene Wege
  for (const k of ablauf.kanten) if (k.art !== "sicht") k.art = "weg";
  const mittel = ablauf.knoten.filter(k => k.art !== "start" && k.art !== "ziel").map(k => k.id);
  // Hallen ohne Aufgabe für die Ausstattung: 1–2 Sackgassen an Nebenschleife oder Bögen, nie auf dem Hauptweg
  // zwischen zwei Stationen, damit der Umweg freiwillig bleibt
  const extra: number[] = [];
  const zahl = 1 + (r() < 0.5 ? 1 : 0);
  const wirte = [...mittel].sort((x, y) => (ablauf.knoten[y].art === "belohnung" ? 1 : 0) - (ablauf.knoten[x].art === "belohnung" ? 1 : 0) || r() - 0.5);
  for (let n = 0; n < zahl && n < wirte.length; n++) {
    const w = ablauf.knoten[wirte[n]];
    const id = ablauf.knoten.push({ id: ablauf.knoten.length, art: "belohnung", x: 0, y: 0 }) - 1;
    // nach außen, weg von der Mitte der Hauptschleife
    const l = Math.hypot(w.x, w.y);
    const [ux, uy] = l > 0.05 ? [w.x / l, w.y / l] : [Math.cos(r() * 6.28), Math.sin(r() * 6.28)];
    ablauf.knoten[id].x = w.x + ux * 0.5;
    ablauf.knoten[id].y = w.y + uy * 0.5;
    ablauf.kanten.push({ a: w.id, b: id, art: "weg" });
    extra.push(id);
  }
  // überzählige Knoten werden Hallen ohne Aufgabe: lieber Ruhe- oder Belohnungsräume
  const rang = (id: number) => (["ruhe", "belohnung"].includes(ablauf.knoten[id].art) ? 1 : 0);
  const stationen = [...mittel].sort((a, b) => rang(a) - rang(b) || a - b).slice(0, zimmer);
  return { ablauf, zyklus, stationen, extra };
}

/**
 * Ziele der Knoten in der Fläche: Die Lage aus zyklisch.ts (Start links, Ziel rechts, Bögen oben
 * und unten) wird auf das Rechteck [rand, B − rand]² gestreckt, wahlweise gespiegelt oder gedreht.
 */
export function knotenZiele(a: Ablauf, B: number, rand: number, r: () => number): [number, number][] {
  const xs = a.knoten.map(k => k.x), ys = a.knoten.map(k => k.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const drehen = r() < 0.5, spiegelX = r() < 0.5, spiegelY = r() < 0.5;
  return a.knoten.map(k => {
    let u = (k.x - x0) / (x1 - x0 || 1), v = (k.y - y0) / (y1 - y0 || 1);
    if (spiegelX) u = 1 - u;
    if (spiegelY) v = 1 - v;
    if (drehen) [u, v] = [v, u];
    return [rand + u * (B - 2 * rand), rand + v * (B - 2 * rand)];
  });
}

/** Jeder Knoten bekommt den nächsten freien Ort (Start und Ziel zuerst); gibt den Ort je Knoten zurück */
export function ordneZu(ziele: [number, number][], orte: [number, number][], reihenfolge: number[]): number[] | null {
  if (orte.length < ziele.length) return null;
  const frei = new Set(orte.map((_, i) => i));
  const aus = new Array<number>(ziele.length).fill(-1);
  for (const k of reihenfolge) {
    let best = -1, bd = Infinity;
    for (const i of frei) {
      const d = (orte[i][0] - ziele[k][0]) ** 2 + (orte[i][1] - ziele[k][1]) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    aus[k] = best;
    frei.delete(best);
  }
  return aus;
}

/** Start, Ziel, dann die übrigen Knoten nach Schritten vom Start */
export function knotenReihenfolge(a: Ablauf): number[] {
  const d = a.knoten.map(() => -1);
  d[0] = 0;
  const q = [0];
  for (let i = 0; i < q.length; i++) for (const k of a.kanten) {
    const nb = k.a === q[i] ? k.b : k.b === q[i] ? k.a : -1;
    if (nb >= 0 && d[nb] < 0) { d[nb] = d[q[i]] + 1; q.push(nb); }
  }
  return [0, 1, ...a.knoten.map(k => k.id).filter(i => i > 1).sort((x, y) => d[x] - d[y])];
}

/** schneiden sich die Strecken ab und cd (ohne gemeinsame Endpunkte)? */
export function kreuzen(a: [number, number], b: [number, number], c: [number, number], d: [number, number]): boolean {
  const o = (p: [number, number], q: [number, number], s: [number, number]) => Math.sign((q[0] - p[0]) * (s[1] - p[1]) - (q[1] - p[1]) * (s[0] - p[0]));
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
}

// ── 2. Wege in der Fläche ────────────────────────────────────────────────

/** Wegsuche aus wege.ts (A*, auch schräg) über Kosten je Feld (0 = gesperrt); Weg als Feldliste */
export function suchWeg(B: number, H: number, kosten: Uint8Array, a: Punkt, b: Punkt, diagonal = true): Punkt[] {
  const f: Feld = { b: B, h: H, kosten };
  const s = neueSuche(f);
  const it = suche(f, a[1] * B + a[0], b[1] * B + b[0], "astar", s, { diagonal, heuristik: diagonal ? "euklid" : "manhattan" });
  while (!it.next().done) { /* bis zum Ende */ }
  return s.weg.map(i => [i % B, Math.floor(i / B)] as Punkt);
}

/** Ecken abrunden: jede Strecke an 1/4 und 3/4 teilen */
export function chaikin(p: [number, number][], runden = 2): [number, number][] {
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

/** jedes dritte Feld behalten (Treppen der Wegsuche werden so zu Schrägen, bevor Chaikin rundet) */
export const ausduennen = (p: Punkt[]): [number, number][] => p.filter((_, i) => i % 3 === 0 || i === p.length - 1).map(([x, y]) => [x + 0.5, y + 0.5]);

/** Kreisscheibe mit Radius `rad` um (x, y) in Feldern: `setze(i)` für jedes Feld darin (ohne Randfelder) */
export function scheibe(B: number, H: number, x: number, y: number, rad: number, setze: (i: number) => void) {
  for (let fy = Math.floor(y - rad); fy <= Math.ceil(y + rad); fy++) for (let fx = Math.floor(x - rad); fx <= Math.ceil(x + rad); fx++) {
    if (fx < 1 || fy < 1 || fx >= B - 1 || fy >= H - 1) continue;
    if ((fx + 0.5 - x) ** 2 + (fy + 0.5 - y) ** 2 <= rad * rad) setze(fy * B + fx);
  }
}

// ── 3. Prüfen und Angaben für die Weltbauer ─────────────────────────────

interface Raster { b: number; h: number; art: Uint8Array }

const frei = (e: Raster, x: number, y: number) => x >= 0 && y >= 0 && x < e.b && y < e.h && e.art[y * e.b + x] !== WAND;

/** Abstände vom Feld `von` über begehbare Felder (wege.ts: Flowfield-artige Breitensuche), −1 = unerreichbar */
export function abstaende(e: Raster, von: Punkt): Int32Array {
  const d = new Int32Array(e.b * e.h).fill(-1);
  if (!frei(e, von[0], von[1])) return d;
  d[von[1] * e.b + von[0]] = 0;
  const q = [von[1] * e.b + von[0]];
  for (let k = 0; k < q.length; k++) {
    const i = q[k], x = i % e.b, y = (i - x) / e.b;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const j = (y + dy) * e.b + x + dx;
      if (frei(e, x + dx, y + dy) && d[j] < 0) { d[j] = d[i] + 1; q.push(j); }
    }
  }
  return d;
}

/** Wie viele Wandfelder liegen von (x, y) aus in Richtung (dx, dy), bis wieder ein begehbares Feld kommt? Am Kartenrand 9. */
export function wandDickeBei(e: Raster, x: number, y: number, dx: number, dy: number): number {
  let n = 0;
  for (; n < 9; n++) {
    const a = x + dx * n, b = y + dy * n;
    if (a < 0 || b < 0 || a >= e.b || b >= e.h) return 9;
    if (e.art[b * e.b + a] !== WAND) return n;
  }
  return 9;
}

/**
 * Wanddicke je Wandfeld an einer Kante: kleinste Dicke über alle Seiten, an denen ein begehbares Feld
 * anliegt (gemessen von dort aus quer durch die Wand). 0 = kein Kantenfeld.
 */
export function wanddicken(e: Raster): Uint8Array {
  const w = new Uint8Array(e.b * e.h);
  for (let y = 0; y < e.h; y++) for (let x = 0; x < e.b; x++) {
    if (e.art[y * e.b + x] !== WAND) continue;
    let m = 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (!frei(e, x - dx, y - dy)) continue;
      const d = wandDickeBei(e, x, y, dx, dy);
      m = m ? Math.min(m, d) : d;
    }
    w[y * e.b + x] = m;
  }
  return w;
}

/** Liegt jedes begehbare Feld in einem freien Block von `n` × `n` Feldern? (Gänge mindestens n breit) Gibt die Felder zurück, die das nicht tun. */
export function zuEng(e: Raster, n = 3): number[] {
  const ok = new Uint8Array(e.b * e.h);
  for (let y = 0; y + n <= e.h; y++) for (let x = 0; x + n <= e.b; x++) {
    let alle = true;
    for (let j = 0; j < n && alle; j++) for (let i = 0; i < n; i++) if (e.art[(y + j) * e.b + x + i] === WAND) { alle = false; break; }
    if (alle) for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) ok[(y + j) * e.b + x + i] = 1;
  }
  const aus: number[] = [];
  for (let i = 0; i < ok.length; i++) if (e.art[i] !== WAND && !ok[i]) aus.push(i);
  return aus;
}

/** Felder, die in keinem freien n × n-Block liegen, werden Wand (»Öffnen«): danach ist kein Gang schmaler als n */
export function oeffnen(e: Raster, n = 3, schonen?: (i: number) => boolean): number {
  const eng = zuEng(e, n).filter(i => !schonen?.(i));
  for (const i of eng) e.art[i] = WAND;
  return eng.length;
}

/** Säle aus Flecken: umschließendes Rechteck der Felder mit Abstand ≤ rad um die Mitte, die frei sind */
export function fleckSaal(e: Raster, art: Saal["art"], [mx, my]: Punkt, rad: number, knoten: number): Saal {
  let x0 = mx, y0 = my, x1 = mx, y1 = my;
  for (let y = Math.max(0, Math.floor(my - rad)); y <= Math.min(e.h - 1, Math.ceil(my + rad)); y++) {
    for (let x = Math.max(0, Math.floor(mx - rad)); x <= Math.min(e.b - 1, Math.ceil(mx + rad)); x++) {
      if (e.art[y * e.b + x] !== PLATZ) continue;
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
  }
  return { art, x: x0, y: y0, b: x1 - x0 + 1, h: y1 - y0 + 1, mx, my, knoten };
}

export { WAND, WEG, PLATZ };
