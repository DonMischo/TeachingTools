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
 *   eins     — ein zufälliger Treffer unter allen Regeln des Blocks
 *   markov   — die erste Regel (bzw. Gruppe `a | b`), die irgendwo passt, an einer zufälligen Stelle
 *   alle     — alle Treffer auf einmal (überlappende fallen weg); `p43` = jeder nur mit 43 %
 *   pfad     — `pfad: A → U über E = G`: kürzester Weg von einem A über E zu einem U, gefärbt G
 *   nachbarn — `nachbarn: A=D bei 5-8 D`: zählt die acht Nachbarn (Zellautomat, alle Zellen zugleich)
 * Symmetrie je Block: normal in allen Drehungen und gespiegelt, `spiegel` nur
 * links/rechts gespiegelt (z. B. Pflanzen wachsen nach oben), `fest` genau so.
 *
 * Vorbild und Beispiele: MarkovJunior von Maxim Gumin (MIT-Lizenz).
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
  // weitere Farben aus der Palette von MarkovJunior — damit dessen Beispiele passen
  E: { name: "Smaragd", hex: "#008751" },
  N: { name: "Braun", hex: "#ab5236" },
  D: { name: "Dunkelgrau", hex: "#5f574f" },
  P: { name: "Lila", hex: "#7e2553" },
  I: { name: "Indigo", hex: "#1d2b53" },
  K: { name: "Pink", hex: "#ff77a8" },
  F: { name: "Hautfarbe", hex: "#ffccaa" },
  S: { name: "Schiefer", hex: "#83769c" },
  C: { name: "Cyan", hex: "#00e5ff" },
  H: { name: "Honig", hex: "#e4bb40" },
  J: { name: "Dschungel", hex: "#4b692f" },
};

export interface Muster { b: number; h: number; z: string }
export interface Regel {
  aus: Muster;
  ein: Muster;
  /** in »markov«: gleichrangig mit der Regel davor (im Text `a | b`) */
  oder?: boolean;
}
export type Art = "eins" | "markov" | "alle" | "pfad" | "nachbarn";
export type Symmetrie = "alle" | "spiegel" | "fest";
/**
 * Weg von einer Farbe über andere zu einer Ziel-Farbe. `abstand`: der Weg
 * läuft nicht direkt neben schon gemalten Wegen (Leiterbahnen mit Lücke).
 */
export interface Pfad {
  von: string; nach: string; ueber: string; male: string; abstand?: boolean;
  /** Farbe des Startfelds, sobald es angeschlossen ist (sonst die erste Zielfarbe) */
  start?: string;
}
/** Zellautomat: Zelle `aus` wird `ein`, wenn min…max ihrer acht Nachbarn die Farbe(n) `zaehlt` haben */
export interface Nachbarregel { aus: string; ein: string; min: number; max: number; zaehlt: string }
export interface Block {
  art: Art;
  regeln: Regel[];
  grenze?: number;
  sym?: Symmetrie;
  /** nur »alle«: Wahrscheinlichkeit je Treffer (0…1) */
  p?: number;
  pfad?: Pfad;
  nachbarn?: Nachbarregel[];
}
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
 *   markov spiegel: U/P=P/E | UU/PU=UP/EE, U/G=P/G
 *   alle x1 p43: A=D
 *   pfad: A → U über E = G
 *   nachbarn: A=D bei 5-8 D, D=A bei 6-8 A
 * `x12` ist die Schrittgrenze, `p43` die Chance je Treffer (nur alle),
 * `spiegel`/`fest` die Symmetrie; Zeilen mit `#` sind Kommentare.
 */
export function programm(text: string): Programm {
  const bloecke: Block[] = [];
  for (const roh of text.split("\n")) {
    const zeile = roh.trim();
    if (!zeile || zeile.startsWith("#")) continue;
    const m = zeile.match(/^(eins|markov|alle|pfad|nachbarn)\b([^:]*):\s*(.*)$/i);
    if (!m) throw new Error(`Zeile nicht verstanden: ${zeile}`);
    const art = m[1].toLowerCase() as Art;
    const block: Block = { art, regeln: [] };
    let abstand = false;
    const zusatz = m[2].replace(/([x×])\s*(\d+)|\bp(\d+)\b|\bspiegel\b|\bfest\b|\babstand\b/gi, (t, x, n, pz) => {
      if (x) block.grenze = +n;
      else if (pz) block.p = Math.min(100, +pz) / 100;
      else if (t.toLowerCase() === "abstand") abstand = true;
      else block.sym = t.toLowerCase() as Symmetrie;
      return "";
    }).trim();
    if (zusatz) throw new Error(`»${zusatz}« verstehe ich nicht: ${zeile}`);
    const rumpf = m[3].trim();
    if (art === "pfad") {
      const w = rumpf.match(/^(\S+)\s*(?:→|->|>)\s*(\S+)\s+über\s+(\S+)\s*=\s*(\S)(?:\s*,\s*start\s+(\S))?$/i);
      if (!w) throw new Error(`Pfad so schreiben: »pfad: A → U über E = G« (optional », start K«) — ${zeile}`);
      block.pfad = {
        von: w[1].toUpperCase(), nach: w[2].toUpperCase(), ueber: w[3].toUpperCase(), male: w[4].toUpperCase(),
        ...(abstand ? { abstand } : {}), ...(w[5] ? { start: w[5].toUpperCase() } : {}),
      };
    } else if (art === "nachbarn") {
      block.nachbarn = rumpf.split(/[,;]/).map(s => s.trim()).filter(Boolean).map(s => {
        const n = s.match(/^(\S)\s*=\s*(\S)\s+bei\s+(\d)(?:\s*-\s*(\d))?\s+(\S+)$/i);
        if (!n) throw new Error(`Nachbarregel so schreiben: »A=D bei 5-8 D« — ${s}`);
        return { aus: n[1].toUpperCase(), ein: n[2].toUpperCase(), min: +n[3], max: n[4] ? +n[4] : +n[3], zaehlt: n[5].toUpperCase() };
      });
      if (!block.nachbarn.length) throw new Error(`Block ohne Regel: ${zeile}`);
    } else {
      // »,« trennt Regeln (in markov: Rangfolge), »|« macht sie gleichrangig
      for (const gruppe of rumpf.split(/[,;]/).map(s => s.trim()).filter(Boolean)) {
        gruppe.split("|").map(s => s.trim()).filter(Boolean).forEach((t, i) => {
          block.regeln.push(i ? { ...regel(t), oder: true } : regel(t));
        });
      }
      if (!block.regeln.length) throw new Error(`Block ohne Regel: ${zeile}`);
    }
    bloecke.push(block);
  }
  return { bloecke };
}

export function blockText(b: Block): string {
  const kopf = [b.art, b.grenze !== undefined ? `x${b.grenze}` : "", b.p !== undefined ? `p${Math.round(b.p * 100)}` : "",
    b.sym && b.sym !== "alle" ? b.sym : "", b.pfad?.abstand ? "abstand" : ""].filter(Boolean).join(" ");
  if (b.art === "pfad" && b.pfad) {
    return `${kopf}: ${b.pfad.von} → ${b.pfad.nach} über ${b.pfad.ueber} = ${b.pfad.male}${b.pfad.start ? `, start ${b.pfad.start}` : ""}`;
  }
  if (b.art === "nachbarn" && b.nachbarn) {
    return `${kopf}: ${b.nachbarn.map(n => `${n.aus}=${n.ein} bei ${n.min === n.max ? n.min : `${n.min}-${n.max}`} ${n.zaehlt}`).join(", ")}`;
  }
  return `${kopf}: ${b.regeln.map((r, i) => (i ? (r.oder ? " | " : ", ") : "") + regelText(r)).join("")}`;
}

export function programmText(p: Programm): string {
  return p.bloecke.map(blockText).join("\n");
}

// ── Drehungen ────────────────────────────────────────────────────────────

function dreheMuster(m: Muster): Muster {
  // 90° im Uhrzeigersinn: neu[y][x] = alt[h-1-x][y]
  const b = m.h, h = m.b;
  let z = "";
  for (let y = 0; y < h; y++) for (let x = 0; x < b; x++) z += m.z[(m.h - 1 - x) * m.b + y];
  return { b, h, z };
}

function spiegleMuster(m: Muster): Muster {
  let z = "";
  for (let y = 0; y < m.h; y++) for (let x = m.b - 1; x >= 0; x--) z += m.z[y * m.b + x];
  return { b: m.b, h: m.h, z };
}

const VARIANTEN = new WeakMap<Regel, Map<Symmetrie, Regel[]>>();

/**
 * Die verschiedenen Lagen einer Regel: bei »alle« vier Drehungen und ihre
 * Spiegelbilder (wie in MarkovJunior), bei »spiegel« nur links/rechts
 * gespiegelt, bei »fest« nur sie selbst. Wird je Regel gemerkt.
 */
export function drehungen(r: Regel, sym: Symmetrie = "alle"): Regel[] {
  let jeSym = VARIANTEN.get(r);
  const gemerkt = jeSym?.get(sym);
  if (gemerkt) return gemerkt;
  const kandidaten: Regel[] = [];
  if (sym === "fest") kandidaten.push(r);
  else if (sym === "spiegel") kandidaten.push(r, { aus: spiegleMuster(r.aus), ein: spiegleMuster(r.ein) });
  else {
    let v = r;
    for (let i = 0; i < 4; i++) {
      kandidaten.push(v, { aus: spiegleMuster(v.aus), ein: spiegleMuster(v.ein) });
      v = { aus: dreheMuster(v.aus), ein: dreheMuster(v.ein) };
    }
  }
  const aus: Regel[] = [];
  const gesehen = new Set<string>();
  for (const v of kandidaten) {
    const k = `${v.aus.b}:${v.aus.z}=${v.ein.z}`;
    if (!gesehen.has(k)) { gesehen.add(k); aus.push(v); }
  }
  if (!jeSym) { jeSym = new Map(); VARIANTEN.set(r, jeSym); }
  jeSym.set(sym, aus);
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
  block.regeln.forEach((rg, i) => suche(r, i, drehungen(rg, block.sym), aus));
  return aus;
}

/** markov: Regeln in Ranggruppen (eine Gruppe = eine Regel und ihre `oder`-Nachfolger) */
function ranggruppen(block: Block): number[][] {
  const gruppen: number[][] = [];
  block.regeln.forEach((r, i) => {
    if (r.oder && gruppen.length) gruppen[gruppen.length - 1].push(i);
    else gruppen.push([i]);
  });
  return gruppen;
}

function markovTreffer(r: Raster, block: Block): Treffer[] {
  for (const gruppe of ranggruppen(block)) {
    const tr: Treffer[] = [];
    for (const i of gruppe) suche(r, i, drehungen(block.regeln[i], block.sym), tr);
    if (tr.length) return tr;
  }
  return [];
}

const RINGS = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
const KANTEN = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** Zellautomat: alle Zellen gleichzeitig; zählt die Änderungen je Regel. */
function nachbarSchritt(r: Raster, regeln: Nachbarregel[]): number[] | null {
  const neu = r.z.slice();
  const zaehler = regeln.map(() => 0);
  let geaendert = false;
  for (let y = 0; y < r.h; y++) {
    for (let x = 0; x < r.b; x++) {
      const c = r.z[y * r.b + x];
      for (let k = 0; k < regeln.length; k++) {
        const g = regeln[k];
        if (g.aus !== c) continue;
        let n = 0;
        for (const [dx, dy] of RINGS) {
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < r.b && ny < r.h && g.zaehlt.includes(r.z[ny * r.b + nx])) n++;
        }
        if (n >= g.min && n <= g.max && g.ein !== c) {
          neu[y * r.b + x] = g.ein;
          zaehler[k]++;
          geaendert = true;
          break;
        }
      }
    }
  }
  if (!geaendert) return null;
  r.z = neu;
  return zaehler;
}

/**
 * Pfad: Breitensuche von allen Zielfeldern aus über die erlaubten Felder.
 * Das Startfeld, das am nächsten dran ist, bekommt seinen Weg; unterwegs geht
 * es möglichst geradeaus. Danach hat das Startfeld die (erste) Zielfarbe —
 * es ist angeschlossen und läuft nicht noch einmal los.
 */
function pfadSchritt(r: Raster, pf: Pfad, rng: () => number): boolean {
  const n = r.b * r.h;
  const d = new Int32Array(n).fill(-1);
  // Mit Abstand: Felder neben schon gemalten Wegen und neben Zielen sind gesperrt —
  // nur der letzte Schritt ins Ziel darf daran vorbei (siehe unten).
  const frei = (j: number) => {
    if (!pf.ueber.includes(r.z[j])) return false;
    if (!pf.abstand) return true;
    const x = j % r.b, y = (j - x) / r.b;
    for (const [dx, dy] of RINGS) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= r.b || ny >= r.h) continue;
      const c = r.z[ny * r.b + nx];
      if (c === pf.male || pf.nach.includes(c)) return false;
    }
    return true;
  };
  const schlange: number[] = [];
  for (let i = 0; i < n; i++) if (pf.nach.includes(r.z[i])) { d[i] = 0; schlange.push(i); }
  for (let k = 0; k < schlange.length; k++) {
    const i = schlange[k], x = i % r.b, y = (i - x) / r.b;
    for (const [dx, dy] of KANTEN) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= r.b || ny >= r.h) continue;
      const j = ny * r.b + nx;
      // Der letzte Schritt ins Ziel darf an den Bahnen entlang — sonst käme man nie an.
      const erlaubt = d[i] === 0 ? pf.ueber.includes(r.z[j]) : frei(j);
      if (d[j] < 0 && erlaubt) { d[j] = d[i] + 1; schlange.push(j); }
    }
  }
  // nächstes Startfeld: kleinster Abstand eines Nachbarn
  let best = Infinity;
  let starts: number[] = [];
  for (let i = 0; i < n; i++) {
    if (!pf.von.includes(r.z[i])) continue;
    const x = i % r.b, y = (i - x) / r.b;
    for (const [dx, dy] of KANTEN) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= r.b || ny >= r.h) continue;
      const dj = d[ny * r.b + nx];
      if (dj < 0) continue;
      if (dj < best) { best = dj; starts = [i]; } else if (dj === best && starts.at(-1) !== i) starts.push(i);
    }
  }
  if (!starts.length) return false;
  const start = starts[Math.floor(rng() * starts.length)];
  let x = start % r.b, y = (start - x) / r.b;
  let richtung: number[] | null = null;
  for (;;) {
    // Nachbarn mit kleinstem Abstand; bei Gleichstand geradeaus, sonst zufällig
    let min = Infinity;
    let wahl: number[][] = [];
    for (const k of KANTEN) {
      const nx = x + k[0], ny = y + k[1];
      if (nx < 0 || ny < 0 || nx >= r.b || ny >= r.h) continue;
      const dj = d[ny * r.b + nx];
      if (dj < 0) continue;
      if (dj < min) { min = dj; wahl = [k]; } else if (dj === min) wahl.push(k);
    }
    const weiter: number[] = richtung && wahl.includes(richtung) ? richtung : wahl[Math.floor(rng() * wahl.length)];
    richtung = weiter;
    x += weiter[0]; y += weiter[1];
    if (min === 0) break;
    r.z[y * r.b + x] = pf.male;
  }
  r.z[start] = pf.start ?? pf.nach[0];
  return true;
}

// ── Lauf ─────────────────────────────────────────────────────────────────

export function starte(p: Programm, s: Start, seed: number): Lauf {
  return {
    raster: neuesRaster(s),
    block: 0, schritt: 0, gesamt: 0, fertig: false,
    zaehler: p.bloecke.map(b => (b.nachbarn ?? (b.pfad ? [b.pfad] : b.regeln)).map(() => 0)),
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

  if (block.art === "nachbarn" || block.art === "pfad") {
    // Diese Blöcke haben keine Muster-Treffer; gezählt wird trotzdem.
    let zaehler: number[] | null;
    if (block.art === "nachbarn") zaehler = nachbarSchritt(r, block.nachbarn ?? []);
    else zaehler = block.pfad && pfadSchritt(r, block.pfad, l.rng) ? [1] : null;
    if (!zaehler) return false;
    zaehler.forEach((z, k) => { l.zaehler[l.block][k] += z; });
    l.letzte = [];
    l.schritt++;
    l.gesamt++;
    return true;
  }

  if (block.art === "markov") {
    const tr = markovTreffer(r, block);
    if (tr.length) { angewandt = [zieh(tr)]; wende(r, angewandt[0]); }
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
      if (block.p !== undefined && l.rng() >= block.p) continue;
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
  if (l.fertig || !block || block.art === "pfad" || block.art === "nachbarn") return [];
  if (block.art !== "markov") return treffer(l.raster, block);
  return markovTreffer(l.raster, block);
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
