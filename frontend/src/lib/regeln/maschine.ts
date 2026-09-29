/**
 * Regelmaschine — Ersetzungsregeln auf einem Raster, nach dem Vorbild von
 * MarkovJunior (mxgmn).
 *
 * Eine Regel ersetzt ein Muster durch ein gleich großes anderes, z. B.
 * `RBB=GGR`: rot-schwarz-schwarz wird grün-grün-rot. Muster mit mehreren
 * Zeilen schreibt man mit `/`: `WB/BB=WB/BW`. `*` passt im Muster auf jede
 * Farbe und lässt im Ersatz die Zelle, wie sie ist. Jede Regel gilt
 * automatisch in allen vier Drehungen.
 *
 * Ein Programm ist eine Folge von Blöcken; jeder Block läuft, bis keine
 * seiner Regeln mehr passt (oder seine Schrittgrenze erreicht ist), dann ist
 * der nächste dran. Arten:
 *   eins   — ein zufälliger Treffer unter allen Regeln des Blocks
 *   markov — die erste Regel, die irgendwo passt, an einer zufälligen Stelle
 *   alle   — alle Treffer auf einmal (überlappende fallen weg)
 *
 * Reine Rechnung ohne Zeichnen: das Gebäude (Phase 3) nutzt dieselbe Maschine.
 */

export const JOKER = "*";

export const FARBEN: Record<string, { name: string; hex: string }> = {
  B: { name: "Schwarz", hex: "#111827" },
  W: { name: "Weiß", hex: "#f5efe6" },
  R: { name: "Rot", hex: "#e11d48" },
  G: { name: "Grün", hex: "#16a34a" },
  U: { name: "Blau", hex: "#2563eb" },
  Y: { name: "Gelb", hex: "#eab308" },
  O: { name: "Orange", hex: "#ea580c" },
  A: { name: "Grau", hex: "#6b7280" },
};

export interface Muster { b: number; h: number; z: string }
export interface Regel { aus: Muster; ein: Muster }
export type Art = "eins" | "markov" | "alle";
export interface Block { art: Art; regeln: Regel[]; grenze?: number }
export interface Programm { bloecke: Block[] }
export interface Raster { b: number; h: number; z: string[] }
export interface Start { b: number; h: number; grund: string; mitte?: string }

/** Ein Treffer: welche Regel (Index im Block), in welcher Drehung, wo. */
export interface Treffer { regel: number; v: Regel; x: number; y: number }

export interface Lauf {
  raster: Raster;
  block: number;
  schritt: number;
  gesamt: number;
  fertig: boolean;
  /** zaehler[block][regel] — wie oft die Regel angewendet wurde */
  zaehler: number[][];
  /** Treffer des letzten Schritts, für »Warum?« */
  letzte: Treffer[];
  rng: () => number;
}

// ── Text ⇄ Muster ────────────────────────────────────────────────────────

export function muster(text: string): Muster {
  const zeilen = text.trim().toUpperCase().split("/");
  const b = zeilen[0].length;
  if (!b || zeilen.some(z => z.length !== b)) throw new Error(`Zeilen ungleich lang: ${text}`);
  return { b, h: zeilen.length, z: zeilen.join("") };
}

export function musterText(m: Muster): string {
  const zeilen: string[] = [];
  for (let y = 0; y < m.h; y++) zeilen.push(m.z.slice(y * m.b, (y + 1) * m.b));
  return zeilen.join("/");
}

/** `RBB=GGR` (auch `RBB → GGR` oder `RBB > GGR`). */
export function regel(text: string): Regel {
  const [a, e] = text.split(/=|→|->|>/).map(s => s.trim());
  if (e === undefined) throw new Error(`Regel ohne »=«: ${text}`);
  const aus = muster(a), ein = muster(e);
  if (aus.b !== ein.b || aus.h !== ein.h) throw new Error(`Muster und Ersatz verschieden groß: ${text}`);
  return { aus, ein };
}

export function regelText(r: Regel): string {
  return `${musterText(r.aus)}=${musterText(r.ein)}`;
}

/**
 * Ein Programm als Text, ein Block je Zeile:
 *   markov: RBB=GGR, RGG=WWR
 *   eins x12: WBW=WWW
 * `x12` ist die Schrittgrenze; Zeilen mit `#` sind Kommentare.
 */
export function programm(text: string): Programm {
  const bloecke: Block[] = [];
  for (const roh of text.split("\n")) {
    const zeile = roh.trim();
    if (!zeile || zeile.startsWith("#")) continue;
    const m = zeile.match(/^(eins|markov|alle)(?:\s*[x×]\s*(\d+))?\s*:\s*(.*)$/i);
    if (!m) throw new Error(`Zeile nicht verstanden: ${zeile}`);
    const regeln = m[3].split(/[,;]/).map(s => s.trim()).filter(Boolean).map(regel);
    if (!regeln.length) throw new Error(`Block ohne Regel: ${zeile}`);
    bloecke.push({ art: m[1].toLowerCase() as Art, regeln, ...(m[2] ? { grenze: +m[2] } : {}) });
  }
  return { bloecke };
}

export function programmText(p: Programm): string {
  return p.bloecke
    .map(b => `${b.art}${b.grenze !== undefined ? ` x${b.grenze}` : ""}: ${b.regeln.map(regelText).join(", ")}`)
    .join("\n");
}

// ── Drehungen ────────────────────────────────────────────────────────────

function dreheMuster(m: Muster): Muster {
  // 90° im Uhrzeigersinn: neu[y][x] = alt[h-1-x][y]
  const b = m.h, h = m.b;
  let z = "";
  for (let y = 0; y < h; y++) for (let x = 0; x < b; x++) z += m.z[(m.h - 1 - x) * m.b + y];
  return { b, h, z };
}

/** Die bis zu vier verschiedenen Drehungen einer Regel. */
export function drehungen(r: Regel): Regel[] {
  const aus: Regel[] = [];
  const gesehen = new Set<string>();
  let v = r;
  for (let i = 0; i < 4; i++) {
    const k = `${v.aus.b}:${v.aus.z}=${v.ein.z}`;
    if (!gesehen.has(k)) { gesehen.add(k); aus.push(v); }
    v = { aus: dreheMuster(v.aus), ein: dreheMuster(v.ein) };
  }
  return aus;
}

// ── Raster ───────────────────────────────────────────────────────────────

export function neuesRaster(s: Start): Raster {
  const z = new Array<string>(s.b * s.h).fill(s.grund);
  if (s.mitte) z[Math.floor(s.h / 2) * s.b + Math.floor(s.b / 2)] = s.mitte;
  return { b: s.b, h: s.h, z };
}

export function zelle(r: Raster, x: number, y: number): string {
  return r.z[y * r.b + x];
}

/** Deterministischer Zufall (mulberry32) — gleicher Seed, gleiches Bild. */
export function zufall(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Treffer suchen und anwenden ──────────────────────────────────────────

function passt(r: Raster, v: Regel, x: number, y: number): boolean {
  const { aus } = v;
  let aendert = false;
  for (let dy = 0; dy < aus.h; dy++) {
    for (let dx = 0; dx < aus.b; dx++) {
      const i = dy * aus.b + dx;
      const ist = r.z[(y + dy) * r.b + x + dx];
      const soll = aus.z[i];
      if (soll !== JOKER && soll !== ist) return false;
      const neu = v.ein.z[i];
      if (neu !== JOKER && neu !== ist) aendert = true;
    }
  }
  // Ein Treffer, der nichts ändert, zählt nicht — sonst liefe z. B. W=W ewig.
  return aendert;
}

function suche(r: Raster, regelNr: number, varianten: Regel[], aus: Treffer[]) {
  for (const v of varianten) {
    for (let y = 0; y + v.aus.h <= r.h; y++) {
      for (let x = 0; x + v.aus.b <= r.b; x++) {
        if (passt(r, v, x, y)) aus.push({ regel: regelNr, v, x, y });
      }
    }
  }
}

function wende(r: Raster, t: Treffer) {
  const { ein } = t.v;
  for (let dy = 0; dy < ein.h; dy++) {
    for (let dx = 0; dx < ein.b; dx++) {
      const c = ein.z[dy * ein.b + dx];
      if (c !== JOKER) r.z[(t.y + dy) * r.b + t.x + dx] = c;
    }
  }
}

/** Alle Stellen, an denen irgendeine Regel des Blocks gerade passt. */
export function treffer(r: Raster, block: Block): Treffer[] {
  const aus: Treffer[] = [];
  block.regeln.forEach((rg, i) => suche(r, i, drehungen(rg), aus));
  return aus;
}

// ── Lauf ─────────────────────────────────────────────────────────────────

export function starte(p: Programm, s: Start, seed: number): Lauf {
  return {
    raster: neuesRaster(s),
    block: 0, schritt: 0, gesamt: 0, fertig: false,
    zaehler: p.bloecke.map(b => b.regeln.map(() => 0)),
    letzte: [],
    rng: zufall(seed),
  };
}

/** Versucht einen Schritt im aktuellen Block; `false`, wenn der Block fertig ist. */
function schrittImBlock(p: Programm, l: Lauf): boolean {
  const block = p.bloecke[l.block];
  if (block.grenze !== undefined && l.schritt >= block.grenze) return false;
  const r = l.raster;
  const zieh = <T,>(a: T[]) => a[Math.floor(l.rng() * a.length)];
  let angewandt: Treffer[] = [];

  if (block.art === "markov") {
    for (let i = 0; i < block.regeln.length && !angewandt.length; i++) {
      const tr: Treffer[] = [];
      suche(r, i, drehungen(block.regeln[i]), tr);
      if (tr.length) angewandt = [zieh(tr)];
    }
    if (angewandt.length) wende(r, angewandt[0]);
  } else if (block.art === "eins") {
    const tr = treffer(r, block);
    if (tr.length) { angewandt = [zieh(tr)]; wende(r, angewandt[0]); }
  } else {
    const tr = treffer(r, block);
    // Mischen, dann der Reihe nach: was eine in diesem Schritt schon geänderte
    // Zelle berührt, fällt weg (sonst wüchse ein Fleck in einem Schritt quer übers Feld).
    for (let i = tr.length - 1; i > 0; i--) {
      const j = Math.floor(l.rng() * (i + 1));
      [tr[i], tr[j]] = [tr[j], tr[i]];
    }
    const geaendert = new Uint8Array(r.b * r.h);
    for (const t of tr) {
      let frei = true;
      for (let dy = 0; dy < t.v.aus.h && frei; dy++)
        for (let dx = 0; dx < t.v.aus.b && frei; dx++)
          if (geaendert[(t.y + dy) * r.b + t.x + dx]) frei = false;
      if (!frei || !passt(r, t.v, t.x, t.y)) continue;
      for (let dy = 0; dy < t.v.aus.h; dy++)
        for (let dx = 0; dx < t.v.aus.b; dx++) {
          const i = (t.y + dy) * r.b + t.x + dx, c = t.v.ein.z[dy * t.v.aus.b + dx];
          if (c !== JOKER && c !== r.z[i]) geaendert[i] = 1;
        }
      wende(r, t);
      angewandt.push(t);
    }
  }

  if (!angewandt.length) return false;
  for (const t of angewandt) l.zaehler[l.block][t.regel]++;
  l.letzte = angewandt;
  l.schritt++;
  l.gesamt++;
  return true;
}

/** Ein Schritt des ganzen Programms; springt über fertige Blöcke. `false` = Programm fertig. */
export function schritt(p: Programm, l: Lauf): boolean {
  while (l.block < p.bloecke.length) {
    if (schrittImBlock(p, l)) return true;
    l.block++;
    l.schritt = 0;
  }
  l.fertig = true;
  l.letzte = [];
  return false;
}

/**
 * Wo könnte der nächste Schritt passieren? Bei »markov« nur die Treffer der
 * ersten Regel, die überhaupt passt — genau unter denen wird gelost.
 */
export function kandidaten(p: Programm, l: Lauf): Treffer[] {
  const block = p.bloecke[l.block];
  if (l.fertig || !block) return [];
  if (block.art !== "markov") return treffer(l.raster, block);
  for (let i = 0; i < block.regeln.length; i++) {
    const tr: Treffer[] = [];
    suche(l.raster, i, drehungen(block.regeln[i]), tr);
    if (tr.length) return tr;
  }
  return [];
}

/** Bis zum Ende laufen (mit Notbremse gegen Endlosprogramme). */
export function laufeDurch(p: Programm, l: Lauf, maxSchritte = 200_000): Lauf {
  for (let i = 0; i < maxSchritte && schritt(p, l); i++);
  return l;
}

// ── Prüfen (für Rätsel und Tests) ────────────────────────────────────────

export function zaehle(r: Raster, f: string): number {
  return r.z.reduce((n, c) => n + (c === f ? 1 : 0), 0);
}

const NACHBARN = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** Hängen alle Zellen der Farbe über Kanten zusammen? (keine Zelle = ja) */
export function zusammenhaengend(r: Raster, f: string): boolean {
  const start = r.z.indexOf(f);
  if (start < 0) return true;
  const gesehen = new Uint8Array(r.z.length);
  const stapel = [start];
  gesehen[start] = 1;
  let n = 0;
  while (stapel.length) {
    const i = stapel.pop()!;
    n++;
    const x = i % r.b, y = (i - x) / r.b;
    for (const [dx, dy] of NACHBARN) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= r.b || ny >= r.h) continue;
      const j = ny * r.b + nx;
      if (!gesehen[j] && r.z[j] === f) { gesehen[j] = 1; stapel.push(j); }
    }
  }
  return n === zaehle(r, f);
}

/** Bilden die Zellen der Farbe einen Baum — zusammenhängend und ohne Schleife? */
export function istBaum(r: Raster, f: string): boolean {
  const knoten = zaehle(r, f);
  if (!knoten || !zusammenhaengend(r, f)) return false;
  let kanten = 0;
  for (let y = 0; y < r.h; y++) {
    for (let x = 0; x < r.b; x++) {
      if (zelle(r, x, y) !== f) continue;
      if (x + 1 < r.b && zelle(r, x + 1, y) === f) kanten++;
      if (y + 1 < r.h && zelle(r, x, y + 1) === f) kanten++;
    }
  }
  return kanten === knoten - 1;
}
