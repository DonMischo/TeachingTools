/**
 * D2-Code als bearbeitbares Modell für die Diagramm-Werkstatt.
 *
 * Der Code ist die einzige Quelle der Wahrheit: der Bausteine-Modus liest ihn
 * mit `parse`, ändert das Modell und schreibt mit `serialize` zurück. Damit das
 * den Code der Schüler·innen nicht umschreibt, behält jede Anweisung ihren
 * Originaltext (`raw`) — neu geschrieben wird nur, was eine Bearbeitung
 * berührt hat. Alles, was dieser Teil-Parser nicht versteht (Klassen, Ebenen,
 * Markdown, Globs …), bleibt als Rohtext an seiner Stelle stehen und wirkt im
 * Diagramm weiter, ist aber nur im Code bearbeitbar.
 *
 * D2 vergleicht Namen ohne Groß-/Kleinschreibung (`Start` und `start` sind ein
 * Knoten); `gleich` bildet das nach.
 */

export type Pfeil = "->" | "<-" | "<->" | "--";
export type Stil = Record<string, string>;

export interface Knoten {
  art: "knoten";
  uid: number;
  /** Voller Pfad wie im kompilierten Diagramm, z. B. `gruppe.a`. */
  id: string;
  label?: string;
  shape?: string;
  stil: Stil;
  kinder: Eintrag[];
  raw?: string;
  einzug?: string;
  leer?: boolean;
}

export interface Kante {
  art: "kante";
  uid: number;
  von: string;
  nach: string;
  pfeil: Pfeil;
  label?: string;
  stil: Stil;
  extra: string[];
  raw?: string;
  einzug?: string;
  leer?: boolean;
}

export interface Roh {
  art: "roh";
  uid: number;
  raw: string;
  einzug?: string;
  leer?: boolean;
}

export type Eintrag = Knoten | Kante | Roh;

export interface Einstellungen {
  direction?: string;
  theme?: number;
  sketch?: boolean;
  layout?: string;
}

export interface Modell {
  eintraege: Eintrag[];
  einstellungen: Einstellungen;
  /** Originaltext von `vars`/`direction`, solange niemand sie ändert. */
  einstellungenRaw?: string;
  naechsteUid: number;
}

export const gleich = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const unter = (id: string, wurzel: string) => gleich(id, wurzel) || id.toLowerCase().startsWith(wurzel.toLowerCase() + ".");

/* ------------------------------------------------------------------ Parser */

class Fehler extends Error {}

const RESERVIERT = new Set([
  "label", "shape", "style", "icon", "near", "width", "height", "tooltip", "link",
  "direction", "constraint", "grid-rows", "grid-columns", "grid-gap", "vertical-gap",
  "horizontal-gap", "class", "classes", "vars", "top", "left", "source-arrowhead",
  "target-arrowhead", "layers", "scenarios", "steps", "filled", "level", "legend-label",
]);

type Wert = { text: string; einfach: boolean } | null;

interface Anweisung {
  schluessel: string[][]; // je Schlüssel die Segmente (roh, Anführungszeichen bleiben)
  pfeile: Pfeil[];
  wert: Wert;
  block?: { start: number; ende: number };
}

/** Segmente eines Pfades, mit Anführungszeichen wie im Quelltext. */
function segmente(key: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q: string | null = null;
  for (const c of key) {
    if (q) { cur += c; if (c === q) q = null; continue; }
    if (c === '"' || c === "'") { q = c; cur += c; continue; }
    if (c === ".") { out.push(cur.trim()); cur = ""; continue; }
    cur += c;
  }
  out.push(cur.trim());
  return out;
}

function entquoten(s: string): string {
  if (s.length >= 2 && s[0] === '"' && s.endsWith('"')) {
    return s.slice(1, -1).replace(/\\(.)/g, (_, c: string) => (c === "n" ? "\n" : c));
  }
  if (s.length >= 2 && s[0] === "'" && s.endsWith("'")) return s.slice(1, -1);
  return s;
}

class Leser {
  i = 0;
  constructor(readonly s: string) {}

  get c() { return this.s[this.i]; }

  leerzeichen() { while (this.c === " " || this.c === "\t" || this.c === "\r") this.i++; }

  pfeil(): Pfeil | null {
    const r = this.s.slice(this.i, this.i + 3);
    if (r === "<->") { this.i += 3; return "<->"; }
    const z = r.slice(0, 2);
    if (z === "->" || z === "<-" || z === "--") { this.i += 2; return z as Pfeil; }
    return null;
  }

  zitat(): string {
    const q = this.c;
    const start = this.i++;
    while (this.i < this.s.length && this.c !== q) {
      if (this.c === "\n") throw new Fehler();
      if (q === '"' && this.c === "\\") this.i++;
      this.i++;
    }
    if (this.c !== q) throw new Fehler();
    this.i++;
    return this.s.slice(start, this.i);
  }

  schluessel(): string[] {
    this.leerzeichen();
    let text = "";
    for (;;) {
      const c = this.c;
      if (c === undefined || c === "\n" || c === ":" || c === ";" || c === "{" || c === "}" || c === "#") break;
      if (c === '"' || c === "'") { text += this.zitat(); continue; }
      const r = this.s.slice(this.i, this.i + 2);
      if (r === "->" || r === "<-" || r === "--") break;
      if ("()[]*&!@$|`,<>".includes(c)) throw new Fehler();
      text += c;
      this.i++;
    }
    const segs = segmente(text);
    if (segs.some(g => g === "")) throw new Fehler();
    return segs;
  }

  wert(): Wert {
    this.leerzeichen();
    const c = this.c;
    if (c === '"' || c === "'") {
      const text = entquoten(this.zitat());
      return { text, einfach: false };
    }
    if (c === "|" || c === "[" || c === "@" || c === "$") throw new Fehler();
    let text = "";
    while (this.i < this.s.length) {
      const d = this.c;
      if (d === "\n" || d === ";" || d === "{" || d === "}") break;
      if (d === "#" && (text === "" || /\s$/.test(text))) break;
      text += d;
      this.i++;
    }
    text = text.trim();
    if (text === "") return null;
    if (text === "null" || text.startsWith("...")) throw new Fehler();
    return { text, einfach: true };
  }

  /** Überspringt einen Block `{ … }` samt Zitaten; i steht danach hinter `}`. */
  block(): { start: number; ende: number } {
    const start = ++this.i;
    let tiefe = 1;
    while (this.i < this.s.length) {
      const c = this.c;
      if (c === '"' || c === "'") { this.zitat(); continue; }
      if (c === "#") { while (this.i < this.s.length && this.c !== "\n") this.i++; continue; }
      if (c === "|") throw new Fehler();
      if (c === "{") tiefe++;
      if (c === "}" && --tiefe === 0) { this.i++; return { start, ende: this.i - 1 }; }
      this.i++;
    }
    throw new Fehler();
  }

  /** Ende einer unverstandenen Anweisung: Zeilenende/`;`/`}` auf Tiefe 0. */
  rohEnde(start: number): number {
    let i = start;
    let tiefe = 0;
    let q: string | null = null;
    let pipe: string | null = null;
    while (i < this.s.length) {
      const c = this.s[i];
      if (pipe) {
        if (this.s.startsWith(pipe, i)) { i += pipe.length; pipe = null; continue; }
        i++; continue;
      }
      if (q) {
        if (c === "\\" && q === '"') { i += 2; continue; }
        if (c === q || c === "\n") q = null;
        i++; continue;
      }
      if (c === '"' || c === "'") { q = c; i++; continue; }
      if (c === "|") {
        let j = i;
        while (this.s[j] === "|" || this.s[j] === "`") j++;
        pipe = this.s.slice(i, j).split("").reverse().join("");
        i = j;
        continue;
      }
      if (c === "{" || c === "[") tiefe++;
      if (c === "}" || c === "]") { if (tiefe === 0) return i; tiefe--; }
      if (tiefe === 0 && (c === "\n" || c === ";")) return i;
      if (tiefe === 0 && c === "#" && (i === start || /\s/.test(this.s[i - 1]))) return i;
      i++;
    }
    return i;
  }

  anweisung(): Anweisung {
    const schluessel = [this.schluessel()];
    const pfeile: Pfeil[] = [];
    for (;;) {
      this.leerzeichen();
      const p = this.pfeil();
      if (!p) break;
      pfeile.push(p);
      schluessel.push(this.schluessel());
    }
    this.leerzeichen();
    let wert: Wert = null;
    if (this.c === ":") { this.i++; wert = this.wert(); this.leerzeichen(); }
    let block: Anweisung["block"];
    if (this.c === "{") { block = this.block(); this.leerzeichen(); }
    const c = this.c;
    if (!(c === undefined || c === "\n" || c === ";" || c === "}" || c === "#")) throw new Fehler();
    return { schluessel, pfeile, wert, block };
  }
}

interface Kontext {
  m: Modell;
  src: string;
  /** Alle Knoten-Deklarationen nach id (klein), zum Zusammenführen. */
  knoten: Map<string, Knoten>;
}

const neueUid = (m: Modell) => m.naechsteUid++;

function einzugVor(src: string, pos: number): string {
  const zeile = src.lastIndexOf("\n", pos - 1) + 1;
  const davor = src.slice(zeile, pos);
  return /^[ \t]*$/.test(davor) ? davor : "";
}

/** Liest einen Block (oder die Datei) als Liste von Einträgen. */
function leseBlock(k: Kontext, start: number, ende: number, scope: string, besitzer: Knoten | Kante | null, ziel: Eintrag[]) {
  const L = new Leser(k.src.slice(0, ende));
  L.i = start;
  let leere = 0;
  let zeilenAnfang = true;
  while (L.i < ende) {
    L.leerzeichen();
    const c = L.c;
    if (c === undefined) break;
    if (c === "\n") { if (zeilenAnfang) leere++; zeilenAnfang = true; L.i++; continue; }
    if (c === ";") { L.i++; continue; }
    const s = L.i;
    const leer = leere > 0 && ziel.length > 0;
    leere = 0;
    zeilenAnfang = false;
    if (c === "#") {
      while (L.i < ende && L.c !== "\n") L.i++;
      rohEintrag(k, besitzer, ziel, k.src.slice(s, L.i), einzugVor(k.src, s), leer);
      continue;
    }
    let a: Anweisung | null = null;
    try { a = L.anweisung(); } catch (e) { if (!(e instanceof Fehler)) throw e; }
    if (!a || !anwenden(k, a, s, L.i, scope, besitzer, ziel, leer)) {
      L.i = L.rohEnde(s);
      rohEintrag(k, besitzer, ziel, k.src.slice(s, L.i).trimEnd(), einzugVor(k.src, s), leer);
    }
  }
}

function rohEintrag(k: Kontext, besitzer: Knoten | Kante | null, ziel: Eintrag[], raw: string, einzug: string, leer: boolean) {
  if (besitzer?.art === "kante") { besitzer.extra.push(raw); return; }
  ziel.push({ art: "roh", uid: neueUid(k.m), raw, einzug, leer });
}

const STIL_EINFACH = /^[A-Za-z0-9_.#-]+$/;

/** Wendet eine Eigenschaft (`shape`, `label`, `style.x`) auf einen Knoten/eine Kante an. */
function eigenschaft(ziel: Knoten | Kante, pfad: string[], wert: Wert): boolean {
  if (!wert) return false;
  if (pfad.length === 1 && pfad[0] === "label") { ziel.label = wert.text; return true; }
  if (pfad.length === 1 && pfad[0] === "shape" && ziel.art === "knoten") { ziel.shape = wert.text; return true; }
  if (pfad.length === 2 && pfad[0] === "style" && !wert.text.includes("\n")) { ziel.stil[pfad[1]] = wert.text; return true; }
  return false;
}

/** Eigenschaften aus einem `style: { … }`- oder Kanten-Block. Nur wenn alles verstanden wird. */
function leseEigenschaften(k: Kontext, start: number, ende: number, ziel: Knoten | Kante, praefix: string[]): boolean {
  const L = new Leser(k.src.slice(0, ende));
  L.i = start;
  const probe: Knoten | Kante = { ...ziel, stil: { ...ziel.stil } };
  while (L.i < ende) {
    L.leerzeichen();
    if (L.c === undefined) break;
    if (L.c === "\n" || L.c === ";") { L.i++; continue; }
    if (L.c === "#") return false;
    let a: Anweisung;
    try { a = L.anweisung(); } catch { return false; }
    if (a.pfeile.length || a.block) return false;
    if (!eigenschaft(probe, [...praefix, ...a.schluessel[0]], a.wert)) return false;
  }
  ziel.label = probe.label;
  if (probe.art === "knoten" && ziel.art === "knoten") ziel.shape = probe.shape;
  ziel.stil = probe.stil;
  return true;
}

/** Kantenblock: verstandene Eigenschaften ins Modell, der Rest bleibt als Extra erhalten. */
function leseKantenBlock(k: Kontext, start: number, ende: number, kante: Kante) {
  const L = new Leser(k.src.slice(0, ende));
  L.i = start;
  while (L.i < ende) {
    L.leerzeichen();
    if (L.c === undefined) break;
    if (L.c === "\n" || L.c === ";") { L.i++; continue; }
    const s = L.i;
    let a: Anweisung | null = null;
    try { a = L.anweisung(); } catch { /* unten als Extra */ }
    if (a && !a.pfeile.length) {
      const segs = a.schluessel[0];
      if (a.block && segs.length === 1 && segs[0] === "style" && !a.wert
        && leseEigenschaften(k, a.block.start, a.block.ende, kante, ["style"])) continue;
      if (!a.block && eigenschaft(kante, segs, a.wert)) continue;
    }
    L.i = L.rohEnde(s);
    kante.extra.push(k.src.slice(s, L.i).trim());
  }
}

function anwenden(k: Kontext, a: Anweisung, s: number, e: number, scope: string, besitzer: Knoten | Kante | null, ziel: Eintrag[], leer: boolean): boolean {
  const raw = k.src.slice(s, e).trimEnd();
  const einzug = einzugVor(k.src, s);
  const pfad = (segs: string[]) => (scope ? scope + "." : "") + segs.join(".");
  const istReserviert = (segs: string[]) => segs.some(g => RESERVIERT.has(g.toLowerCase()));

  // Kanten
  if (a.pfeile.length) {
    if (a.schluessel.some(istReserviert)) return false;
    if (a.pfeile.length > 1 && (a.wert || a.block)) return false;
    const neu: Kante[] = [];
    for (let i = 0; i < a.pfeile.length; i++) {
      neu.push({
        art: "kante", uid: neueUid(k.m), von: pfad(a.schluessel[i]), nach: pfad(a.schluessel[i + 1]),
        pfeil: a.pfeile[i], stil: {}, extra: [], einzug, leer: i === 0 ? leer : false,
      });
    }
    if (a.wert) neu[0].label = a.wert.text;
    if (a.block) leseKantenBlock(k, a.block.start, a.block.ende, neu[0]);
    if (neu.length === 1) neu[0].raw = raw;
    ziel.push(...neu);
    return true;
  }

  const segs = a.schluessel[0];
  const r = segs.findIndex(g => RESERVIERT.has(g.toLowerCase()));

  // Einstellungen ganz oben
  if (!scope && !besitzer && r === 0) {
    if (segs.length === 1 && segs[0] === "direction" && a.wert && !a.block) {
      k.m.einstellungen.direction = a.wert.text;
      k.m.einstellungenRaw = (k.m.einstellungenRaw ? k.m.einstellungenRaw + "\n" : "") + raw;
      return true;
    }
    if (segs.length === 1 && segs[0] === "vars" && a.block && !a.wert) {
      const cfg = leseVars(k.src.slice(a.block.start, a.block.ende));
      if (!cfg) return false;
      Object.assign(k.m.einstellungen, cfg);
      k.m.einstellungenRaw = (k.m.einstellungenRaw ? k.m.einstellungenRaw + "\n" : "") + raw;
      return true;
    }
    return false;
  }

  // Eigenschaft des umgebenden Knotens (`shape: oval` im Block)
  if (r === 0) {
    if (!besitzer || besitzer.art !== "knoten") return false;
    if (segs.length === 1 && segs[0] === "style" && a.block && !a.wert) {
      return leseEigenschaften(k, a.block.start, a.block.ende, besitzer, ["style"]);
    }
    if (a.block) return false;
    return eigenschaft(besitzer, segs, a.wert);
  }

  // `a.style.fill: red` → Eigenschaft von Knoten a
  if (r > 0) {
    if (a.block && !(segs.length === r + 1 && segs[r] === "style" && !a.wert)) return false;
    const id = pfad(segs.slice(0, r));
    const vorher = k.knoten.get(id.toLowerCase());
    const kn = vorher ?? neuerKnoten(k.m, id);
    const ok = a.block
      ? leseEigenschaften(k, a.block.start, a.block.ende, kn, ["style"])
      : eigenschaft(kn, segs.slice(r), a.wert);
    if (!ok) return false;
    if (vorher) vorher.raw = undefined;
    else { kn.einzug = einzug; kn.leer = leer; k.knoten.set(id.toLowerCase(), kn); ziel.push(kn); }
    return true;
  }

  // Knoten-Deklaration
  const id = pfad(segs);
  const vorher = k.knoten.get(id.toLowerCase());
  const kn = vorher ?? neuerKnoten(k.m, id);
  if (a.wert) kn.label = a.wert.text;
  // Unverstandenes im Block landet als Roh-Kind an seiner Stelle.
  if (a.block) leseBlock(k, a.block.start, a.block.ende, id, kn, kn.kinder);
  if (vorher) {
    vorher.raw = undefined;
  } else {
    kn.raw = raw;
    kn.einzug = einzug;
    kn.leer = leer;
    k.knoten.set(id.toLowerCase(), kn);
    ziel.push(kn);
  }
  return true;
}

function neuerKnoten(m: Modell, id: string): Knoten {
  return { art: "knoten", uid: neueUid(m), id, stil: {}, kinder: [] };
}

/** `vars: { d2-config: { … } }` — nur die Schlüssel, die die Werkstatt einstellen kann. */
function leseVars(inhalt: string): Einstellungen | null {
  const m = /^\s*d2-config\s*:\s*\{([^{}]*)\}\s*$/.exec(inhalt);
  if (!m) return null;
  const cfg: Einstellungen = {};
  for (const teil of m[1].split(/[;\n]/)) {
    const t = teil.trim();
    if (!t) continue;
    const z = /^([a-z-]+)\s*:\s*(\S+)$/.exec(t);
    if (!z) return null;
    const [, key, w] = z;
    if (key === "theme-id" && /^\d+$/.test(w)) cfg.theme = Number(w);
    else if (key === "sketch" && (w === "true" || w === "false")) cfg.sketch = w === "true";
    else if (key === "layout-engine" && (w === "dagre" || w === "elk")) cfg.layout = w;
    else return null;
  }
  return cfg;
}

export function parse(code: string): Modell {
  const m: Modell = { eintraege: [], einstellungen: {}, naechsteUid: 1 };
  const k: Kontext = { m, src: code, knoten: new Map() };
  leseBlock(k, 0, code.length, "", null, m.eintraege);
  return m;
}

/* -------------------------------------------------------------- Serializer */

const WERT_EINFACH = /^[\p{L}\p{N}_][\p{L}\p{N} _,.!?]*$/u;

export function quote(text: string): string {
  if (WERT_EINFACH.test(text) && !text.endsWith(" ") && text !== "null") return text;
  return '"' + text.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n") + '"';
}

function stilWert(text: string): string {
  return STIL_EINFACH.test(text) && !text.startsWith("#") ? text : quote(text);
}

function neuEinruecken(raw: string, alt: string, neu: string): string {
  return raw.split("\n").map((z, i) => (i === 0 ? neu + z : neu + (z.startsWith(alt) ? z.slice(alt.length) : z.trimStart()))).join("\n");
}

function relativ(id: string, scope: string): string {
  return scope && unter(id, scope) && !gleich(id, scope) ? id.slice(scope.length + 1) : id;
}

function eigenschaftsZeilen(e: Knoten | Kante): string[] {
  const z: string[] = [];
  if (e.art === "knoten" && e.shape) z.push(`shape: ${stilWert(e.shape)}`);
  for (const [k, v] of Object.entries(e.stil)) z.push(`style.${k}: ${stilWert(v)}`);
  return z;
}

function schreibe(eintraege: Eintrag[], scope: string, einzug: string, out: string[]) {
  for (const e of eintraege) {
    if (e.leer && out.length && out[out.length - 1] !== "") out.push("");
    if (e.raw !== undefined) { out.push(neuEinruecken(e.raw, e.einzug ?? "", einzug)); continue; }
    if (e.art === "kante") {
      const kopf = `${relativ(e.von, scope)} ${e.pfeil} ${relativ(e.nach, scope)}` + (e.label !== undefined ? `: ${quote(e.label)}` : "");
      const innen = [...eigenschaftsZeilen(e), ...e.extra];
      if (!innen.length) { out.push(einzug + kopf); continue; }
      out.push(`${einzug}${kopf} {`);
      for (const z of innen) out.push(neuEinruecken(z, "", einzug + "  "));
      out.push(einzug + "}");
      continue;
    }
    // Knoten
    const kn = e as Knoten;
    const kopf = relativ(kn.id, scope) + (kn.label !== undefined ? `: ${quote(kn.label)}` : "");
    const innen = eigenschaftsZeilen(kn);
    if (!innen.length && !kn.kinder.length) { out.push(einzug + kopf); continue; }
    out.push(`${einzug}${kopf}${kn.label !== undefined ? "" : ":"} {`);
    for (const z of innen) out.push(neuEinruecken(z, "", einzug + "  "));
    schreibe(kn.kinder, kn.id, einzug + "  ", out);
    out.push(einzug + "}");
  }
}

function einstellungenText(m: Modell): string[] {
  if (m.einstellungenRaw !== undefined) return m.einstellungenRaw.split("\n");
  const s = m.einstellungen;
  const cfg: string[] = [];
  if (s.theme !== undefined) cfg.push(`theme-id: ${s.theme}`);
  if (s.sketch) cfg.push("sketch: true");
  if (s.layout && s.layout !== "dagre") cfg.push(`layout-engine: ${s.layout}`);
  const out: string[] = [];
  if (cfg.length) out.push("vars: {", "  d2-config: {", ...cfg.map(z => "    " + z), "  }", "}");
  if (s.direction) out.push(`direction: ${s.direction}`);
  return out;
}

export function serialize(m: Modell): string {
  const out = einstellungenText(m);
  if (out.length && m.eintraege.length) out.push("");
  const koerper: string[] = [];
  schreibe(m.eintraege, "", "", koerper);
  if (koerper[0] === "") koerper.shift();
  return [...out, ...koerper].join("\n") + "\n";
}

/* ------------------------------------------------------------- Bearbeiten */

export function alleKnoten(m: Modell): Knoten[] {
  const out: Knoten[] = [];
  const lauf = (es: Eintrag[]) => { for (const e of es) if (e.art === "knoten") { out.push(e); lauf(e.kinder); } };
  lauf(m.eintraege);
  return out;
}

export function alleKanten(m: Modell): Kante[] {
  const out: Kante[] = [];
  const lauf = (es: Eintrag[]) => { for (const e of es) { if (e.art === "kante") out.push(e); if (e.art === "knoten") lauf(e.kinder); } };
  lauf(m.eintraege);
  return out;
}

/** Kette der Knoten bis zum Eintrag mit dieser uid (zum Ungültigmachen von raw). */
function kette(es: Eintrag[], uid: number, bisher: Knoten[] = []): Knoten[] | null {
  for (const e of es) {
    if (e.uid === uid) return bisher;
    if (e.art === "knoten") {
      const k = kette(e.kinder, uid, [...bisher, e]);
      if (k) return k;
    }
  }
  return null;
}

function beruehrt(m: Modell, e: Eintrag) {
  e.raw = undefined;
  for (const k of kette(m.eintraege, e.uid) ?? []) k.raw = undefined;
}

const kopie = (m: Modell): Modell => structuredClone(m);

export function findeKnoten(m: Modell, id: string): Knoten | undefined {
  return alleKnoten(m).find(k => gleich(k.id, id));
}

/** Nächste freie Id `k1`, `k2` … (auch gegen Namen, die nur im Diagramm stehen). */
export function freieId(m: Modell, belegt: Iterable<string> = []): string {
  const ids = new Set([...alleKnoten(m).map(k => k.id.toLowerCase()), ...[...belegt].map(b => b.toLowerCase())]);
  for (const k of alleKanten(m)) { ids.add(k.von.toLowerCase()); ids.add(k.nach.toLowerCase()); }
  let n = 1;
  while (ids.has(`k${n}`)) n++;
  return `k${n}`;
}

export function knotenHinzufuegen(m0: Modell, label: string, belegt: Iterable<string> = [], shape?: string): { modell: Modell; id: string } {
  const m = kopie(m0);
  const id = freieId(m, belegt);
  const kn = neuerKnoten(m, id);
  kn.label = label;
  if (shape) kn.shape = shape;
  m.eintraege.push(kn);
  return { modell: m, id };
}

export function kanteHinzufuegen(m0: Modell, von: string, nach: string, pfeil: Pfeil = "->"): { modell: Modell; uid: number } {
  const m = kopie(m0);
  const uid = neueUid(m);
  m.eintraege.push({ art: "kante", uid, von, nach, pfeil, stil: {}, extra: [] });
  return { modell: m, uid };
}

/** Neuer Knoten, verbunden mit `eltern` — der Mindmap-Ast. */
export function kindHinzufuegen(m0: Modell, eltern: string, label: string, belegt: Iterable<string> = []): { modell: Modell; id: string } {
  const { modell, id } = knotenHinzufuegen(m0, label, belegt);
  return { modell: kanteHinzufuegen(modell, eltern, id).modell, id };
}

export type KnotenFeld = "label" | "shape" | `style.${string}`;

export function knotenSetzen(m0: Modell, id: string, feld: KnotenFeld, wert: string | undefined): Modell {
  const m = kopie(m0);
  let kn = findeKnoten(m, id);
  if (!kn) {
    if (wert === undefined) return m;
    kn = neuerKnoten(m, id);
    m.eintraege.push(kn);
  }
  if (feld === "label") kn.label = wert;
  else if (feld === "shape") kn.shape = wert;
  else {
    const k = feld.slice(6);
    if (wert === undefined) delete kn.stil[k]; else kn.stil[k] = wert;
  }
  beruehrt(m, kn);
  return m;
}

export type KantenFeld = "label" | "pfeil" | `style.${string}`;

export function kanteSetzen(m0: Modell, uid: number, feld: KantenFeld, wert: string | undefined): Modell {
  const m = kopie(m0);
  const ka = alleKanten(m).find(k => k.uid === uid);
  if (!ka) return m;
  if (feld === "label") ka.label = wert || undefined;
  else if (feld === "pfeil") ka.pfeil = (wert as Pfeil) ?? "->";
  else {
    const k = feld.slice(6);
    if (wert === undefined) delete ka.stil[k]; else ka.stil[k] = wert;
  }
  beruehrt(m, ka);
  return m;
}

/** Entfernt Einträge rekursiv; berührt die Eltern, aus denen etwas verschwindet. */
function entferne(m: Modell, es: Eintrag[], weg: (e: Eintrag) => boolean, eltern: Knoten[]): Eintrag[] {
  const rest = es.filter(e => !weg(e));
  if (rest.length !== es.length) for (const k of eltern) k.raw = undefined;
  for (const e of rest) if (e.art === "knoten") e.kinder = entferne(m, e.kinder, weg, [...eltern, e]);
  return rest;
}

export function knotenLoeschen(m0: Modell, id: string): Modell {
  const m = kopie(m0);
  m.eintraege = entferne(m, m.eintraege, e =>
    (e.art === "knoten" && unter(e.id, id)) || (e.art === "kante" && (unter(e.von, id) || unter(e.nach, id))), []);
  return m;
}

export function kanteLoeschen(m0: Modell, uid: number): Modell {
  const m = kopie(m0);
  m.eintraege = entferne(m, m.eintraege, e => e.uid === uid, []);
  return m;
}

export function einstellen<K extends keyof Einstellungen>(m0: Modell, feld: K, wert: Einstellungen[K]): Modell {
  const m = kopie(m0);
  if (wert === undefined) delete m.einstellungen[feld]; else m.einstellungen[feld] = wert;
  m.einstellungenRaw = undefined;
  return m;
}

/* ------------------------------------------------- Diagramm ↔ Modell */

/** Ordnet eine kompilierte Verbindung (`src`, `dst`, Reihenfolge) einer Kante im Modell zu. */
export function kanteZuVerbindung(m: Modell, verbindungen: { id: string; src: string; dst: string }[], verbindungsId: string): Kante | undefined {
  const v = verbindungen.find(c => c.id === verbindungsId);
  if (!v) return undefined;
  const gleichePaare = verbindungen.filter(c => gleich(c.src, v.src) && gleich(c.dst, v.dst));
  const n = gleichePaare.indexOf(v);
  return alleKanten(m).filter(k => gleich(k.von, v.src) && gleich(k.nach, v.dst))[n];
}

/** Die D2-SVG-Ausgabe kennzeichnet jede Form mit base64(HTML-escaped id) als Klasse. */
export function klasseZuId(klasse: string): string | null {
  if (!/^[A-Za-z0-9+/=_-]+$/.test(klasse) || klasse.length < 4) return null;
  try {
    const bin = atob(klasse.replace(/-/g, "+").replace(/_/g, "/"));
    const text = new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
    return text.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;|&#34;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
  } catch {
    return null;
  }
}

export function idZuKlasse(id: string): string {
  const esc = id.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&#34;").replace(/'/g, "&#39;");
  const bytes = new TextEncoder().encode(esc);
  return btoa(String.fromCharCode(...bytes));
}
