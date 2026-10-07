/**
 * Koordinaten-Lauf — die Spielregeln ohne DOM.
 *
 * Die Figur steht auf einem festen Raster: ←/→ läuft genau eine Einheit, ↑/↓
 * stellt die Sprunghöhe ein, »Springen« setzt den Punkt dort, wo die Füße
 * oben ankommen. Ein Punkt (x|y) heißt also wörtlich: erst x laufen, dann y
 * springen. Unter der x-Achse liegt Wasser — negative y sind Abtauchen.
 *
 * Zwei Arten zu laufen:
 *  - absolut: gelaufen wird immer auf der x-Achse, nach jedem Punkt landet die
 *    Figur wieder dort. x liest man unten ab, y ist die Sprunghöhe.
 *  - relativ (Steigung): die Figur steht auf dem letzten Punkt und läuft auf
 *    dessen Höhe weiter. Laufen und Springen sind dann die beiden Seiten des
 *    Steigungsdreiecks: Nenner von m = laufen, Zähler = springen.
 */

export type P = { x: number; y: number };
export type Bereich = { x0: number; x1: number; y0: number; y1: number };
export type Bruch = [zaehler: number, nenner: number];

export type Achse =
  | { art: "x" } | { art: "y" } | { art: "ursprung" }
  | { art: "senkrecht"; k: number } | { art: "waagerecht"; k: number };

export type BenannterPunkt = { name: string; p: P };

type Basis = { id: string; welt: number; titel: string; text: string; bereich: Bereich; info: string[] };
/** Was ein Level je nach Art verlangt — ohne Name, Welt und Text. */
export type LevelInhalt = { bereich: Bereich } & (
  | { art: "setzen"; ziele: BenannterPunkt[]; linien?: number[][]; sichtbar?: boolean }
  | { art: "spiegeln"; vorlage: BenannterPunkt[]; achse: Achse; linien?: number[][] }
  | { art: "steigung"; start: P; m: Bruch; schritte: number; tipp?: boolean }
  | { art: "gerade"; n: number; m: Bruch; schritte: number; tipp?: boolean }
);
export type Level = Basis & LevelInhalt;

/** Was ein Level verlangt, einheitlich für alle Arten. */
export type Aufgabe = {
  ziele: BenannterPunkt[];
  /** Ziele, die von Anfang an stehen (auf der Spiegelachse liegen sie schon richtig). */
  vorab: boolean[];
  /** Nur in dieser Reihenfolge — bei Steigung und Gerade. */
  geordnet: boolean;
  /** Ab diesem Ziel wird vom letzten Punkt aus gelaufen; null = nie. */
  relativAb: number | null;
  /** Startpunkt des ersten relativen Schritts, wenn kein Ziel davor liegt. */
  start: P | null;
  /** Feste, schon gezeichnete Punkte (Spiegelvorlage). */
  vorlage: BenannterPunkt[];
  linien: number[][];
};

export const spiegel = (p: P, a: Achse): P => {
  switch (a.art) {
    case "x": return { x: p.x, y: -p.y };
    case "y": return { x: -p.x, y: p.y };
    case "ursprung": return { x: -p.x, y: -p.y };
    case "senkrecht": return { x: 2 * a.k - p.x, y: p.y };
    case "waagerecht": return { x: p.x, y: 2 * a.k - p.y };
  }
};

export const gleich = (a: P, b: P) => a.x === b.x && a.y === b.y;

export function aufgabe(l: Level): Aufgabe {
  const leer = { vorlage: [] as BenannterPunkt[], start: null, relativAb: null, geordnet: false, linien: [] as number[][] };
  switch (l.art) {
    case "setzen":
      return { ...leer, ziele: l.ziele, vorab: l.ziele.map(() => false), linien: l.linien ?? [] };
    case "spiegeln": {
      const ziele = l.vorlage.map(v => ({ name: v.name + "'", p: spiegel(v.p, l.achse) }));
      return {
        ...leer, ziele, vorlage: l.vorlage, linien: l.linien ?? [],
        vorab: ziele.map((z, i) => gleich(z.p, l.vorlage[i].p)),
      };
    }
    case "steigung": {
      const [z, n] = l.m;
      const ziele = Array.from({ length: l.schritte }, (_, i) => ({
        name: String.fromCharCode(66 + i), p: { x: l.start.x + n * (i + 1), y: l.start.y + z * (i + 1) },
      }));
      return { ...leer, ziele, vorab: ziele.map(() => false), geordnet: true, relativAb: 0, start: l.start };
    }
    case "gerade": {
      const [z, nn] = l.m;
      const ziele = Array.from({ length: l.schritte + 1 }, (_, i) => ({
        name: String.fromCharCode(65 + i), p: { x: nn * i, y: l.n + z * i },
      }));
      return { ...leer, ziele, vorab: ziele.map(() => false), geordnet: true, relativAb: 1 };
    }
  }
}

/* ── Zustand ───────────────────────────────────────────────────────────────── */

export type Zustand = {
  /** Wo die Figur läuft: x und die Höhe des Laufwegs (0 = x-Achse). */
  held: P;
  /** Eingestellte Sprunghöhe, negativ = abtauchen. */
  sprung: number;
  gesetzt: boolean[];
  fehler: number;
};

export type Aktion = "links" | "rechts" | "hoch" | "runter" | "springen";

export type Ereignis =
  | { art: "nichts" }
  | { art: "treffer"; ziel: number; p: P; fertig: boolean; von: P }
  | { art: "schon"; p: P; von: P }
  | { art: "daneben"; p: P; hinweis: string; von: P };

export const naechstes = (a: Aufgabe, z: Zustand): number => {
  if (a.geordnet) return z.gesetzt.indexOf(false);
  return z.gesetzt.findIndex((g, i) => !g && !a.vorab[i]);
};

/** Läuft die Figur gerade vom letzten Punkt aus? Dann: von welchem. */
export function basis(a: Aufgabe, z: Zustand): P | null {
  if (a.relativAb === null) return null;
  const i = naechstes(a, z);
  if (i < 0 || i < a.relativAb) return null;
  return i === 0 ? a.start : a.ziele[i - 1].p;
}

export function anfang(a: Aufgabe, bereich: Bereich): Zustand {
  const z: Zustand = { held: { x: 0, y: 0 }, sprung: 0, gesetzt: a.vorab.slice(), fehler: 0 };
  const b = basis(a, z);
  if (b) z.held = { ...b };
  else z.held = { x: Math.min(Math.max(0, bereich.x0), bereich.x1), y: 0 };
  return z;
}

export const fertig = (z: Zustand) => z.gesetzt.every(Boolean);

export function schritt(a: Aufgabe, bereich: Bereich, z: Zustand, aktion: Aktion): { zustand: Zustand; ereignis: Ereignis } {
  const nichts = { zustand: z, ereignis: { art: "nichts" } as Ereignis };
  if (fertig(z)) return nichts;
  const { held } = z;
  switch (aktion) {
    case "links":
    case "rechts": {
      const x = held.x + (aktion === "links" ? -1 : 1);
      if (x < bereich.x0 || x > bereich.x1) return nichts;
      return { zustand: { ...z, held: { ...held, x } }, ereignis: { art: "nichts" } };
    }
    case "hoch":
    case "runter": {
      const s = z.sprung + (aktion === "hoch" ? 1 : -1);
      if (held.y + s < bereich.y0 || held.y + s > bereich.y1) return nichts;
      return { zustand: { ...z, sprung: s }, ereignis: { art: "nichts" } };
    }
    case "springen": {
      const p = { x: held.x, y: held.y + z.sprung };
      const von = { ...held };
      const i = naechstes(a, z);
      const treffer = a.geordnet
        ? (gleich(a.ziele[i].p, p) ? i : -1)
        : a.ziele.findIndex((t, j) => !z.gesetzt[j] && gleich(t.p, p));
      if (treffer >= 0) {
        const gesetzt = z.gesetzt.slice();
        gesetzt[treffer] = true;
        const neu: Zustand = { ...z, gesetzt, sprung: 0 };
        const b = basis(a, neu);
        neu.held = b ? { ...b } : { x: p.x, y: 0 };
        return { zustand: neu, ereignis: { art: "treffer", ziel: treffer, p, fertig: fertig(neu), von } };
      }
      if (a.ziele.some((t, j) => z.gesetzt[j] && gleich(t.p, p))) {
        return { zustand: { ...z, sprung: 0 }, ereignis: { art: "schon", p, von } };
      }
      return {
        zustand: { ...z, sprung: 0, fehler: z.fehler + 1 },
        ereignis: { art: "daneben", p, hinweis: hinweis(a, z, p), von },
      };
    }
  }
}

/* ── Hinweise nach einem Fehlsprung ────────────────────────────────────────── */

const offen = (a: Aufgabe, z: Zustand) => a.ziele.filter((_, j) => !z.gesetzt[j]).map(t => t.p);

export function hinweis(a: Aufgabe, z: Zustand, p: P): string {
  const b = basis(a, z);
  if (b) {
    const soll = a.ziele[naechstes(a, z)].p;
    const d = { x: p.x - b.x, y: p.y - b.y };
    const n = soll.x - b.x, zz = soll.y - b.y;
    if (d.x === 0 && d.y === 0) return "Du bist nur auf der Stelle gehüpft. Erst nach rechts laufen, dann springen.";
    if (d.x === Math.abs(zz) && Math.abs(d.y) === n && n !== Math.abs(zz))
      return "Vertauscht: Der Nenner sagt, wie weit du läufst, der Zähler, wie hoch du springst.";
    if (d.x === n && d.y === -zz)
      return zz > 0 ? "Richtung prüfen: m ist positiv — es geht nach oben." : "Richtung prüfen: m ist negativ — nach dem Laufen geht es nach unten.";
    if (d.x <= 0) return "Bei der Steigung läufst du immer nach rechts — so weit, wie der Nenner sagt.";
    if (d.x === n) return `Gelaufen hast du richtig. Jetzt ${zz > 0 ? "springen" : "abtauchen"}: so weit, wie der Zähler sagt.`;
    return "Zähle vom letzten Punkt aus: erst der Nenner nach rechts, dann der Zähler hoch (oder runter).";
  }
  const rest = offen(a, z);
  const i = naechstes(a, z);
  if (a.relativAb !== null && i === 0 && p.x !== 0)
    return "Der y-Achsenabschnitt n liegt auf der y-Achse — dort ist x = 0.";
  if (a.vorlage.some(v => gleich(v.p, p)))
    return "Das ist der Originalpunkt. Sein Spiegelbild liegt auf der anderen Seite der Achse, genauso weit weg.";
  if (rest.some(t => t.x === p.y && t.y === p.x))
    return "x und y vertauscht? Erst laufen (x), dann springen (y)!";
  if (rest.some(t => (t.x === -p.x && t.y === p.y) || (t.x === p.x && t.y === -p.y)))
    return "Vorzeichen prüfen: minus bei x heißt nach links, minus bei y heißt abtauchen.";
  if (rest.some(t => t.x === p.x))
    return `x = ${fmt(p.x)} stimmt für einen Punkt — die Sprunghöhe noch nicht.`;
  if (rest.some(t => t.y === p.y))
    return `Die Höhe ${fmt(p.y)} passt zu einem Punkt — gelaufen bist du aber nicht weit genug (oder zu weit).`;
  return "Hier liegt kein gesuchter Punkt. Lies noch einmal: (x|y) — erst laufen, dann springen.";
}

/* ── Vorführen: der Weg zum nächsten Ziel ──────────────────────────────────── */

export type DemoSchritt = { text: string; aktionen: Aktion[] };

export const fmt = (v: number) => (v < 0 ? "−" + Math.abs(v) : String(v));
export const punktText = (b: BenannterPunkt) => `${b.name}(${fmt(b.p.x)}|${fmt(b.p.y)})`;

const wiederhole = (a: Aktion, n: number): Aktion[] => Array.from({ length: Math.abs(n) }, () => a);

export function achsenText(a: Achse): string {
  switch (a.art) {
    case "x": return "an der x-Achse";
    case "y": return "an der y-Achse";
    case "ursprung": return "am Ursprung";
    case "senkrecht": return `an der Geraden x = ${fmt(a.k)}`;
    case "waagerecht": return `an der Geraden y = ${fmt(a.k)}`;
  }
}

/**
 * Wie man das nächste Ziel vom jetzigen Zustand aus erreicht — als Schritte
 * mit Satz und Tastendrücken. Der Spielzustand wird dabei nicht verändert;
 * das Vorführen spielt die Aktionen auf einer Kopie ab.
 */
export function vorfuehrung(l: Level, a: Aufgabe, z: Zustand): DemoSchritt[] {
  const i = naechstes(a, z);
  if (i < 0) return [];
  const ziel = a.ziele[i];
  const out: DemoSchritt[] = [];
  const b = basis(a, z);
  const nachX = (dx: number): Aktion[] => wiederhole(dx > 0 ? "rechts" : "links", dx);
  const nachSprung = (s: number): Aktion[] => wiederhole(s > z.sprung ? "hoch" : "runter", s - z.sprung);

  if (b) {
    const n = ziel.p.x - b.x, zz = ziel.p.y - b.y;
    out.push({ text: `m = ${zz < 0 ? "−" : ""}${Math.abs(zz)}/${n}: vom letzten Punkt aus geht es weiter.`, aktionen: nachX(b.x - z.held.x) });
    out.push({ text: `Nenner ${n}: ${n} nach rechts laufen.`, aktionen: nachX(n) });
    out.push({
      text: zz > 0 ? `Zähler ${zz}: ${zz} nach oben.` : `Zähler ${fmt(zz)}: ${-zz} nach unten.`,
      aktionen: nachSprung(zz),
    });
    out.push({ text: `Springen — ${punktText(ziel)} sitzt.`, aktionen: ["springen"] });
    return out;
  }

  if (l.art === "spiegeln") {
    const v = a.vorlage[i];
    out.push({ text: `${punktText(v)} ${achsenText(l.achse)} gespiegelt ergibt ${punktText(ziel)}.`, aktionen: [] });
  } else if (l.art === "gerade" && i === 0) {
    out.push({ text: `n = ${fmt(l.n)}: Die Gerade schneidet die y-Achse bei ${punktText(ziel)}.`, aktionen: [] });
  } else {
    out.push({ text: `Gesucht: ${punktText(ziel)}.`, aktionen: [] });
  }
  const { x, y } = ziel.p;
  out.push({
    text: x === 0 ? "x = 0: auf der y-Achse bleiben." : `x = ${fmt(x)}: ${x > 0 ? "nach rechts" : "nach links"} laufen, bis du über der ${fmt(x)} stehst.`,
    aktionen: nachX(x - z.held.x),
  });
  out.push({
    text: y === 0 ? "y = 0: gar nicht springen — der Punkt liegt auf der x-Achse." :
      y > 0 ? `y = ${y}: Sprunghöhe ${y} einstellen.` : `y = ${fmt(y)}: ${-y} tief abtauchen.`,
    aktionen: nachSprung(y),
  });
  out.push({ text: "Springen — der Punkt sitzt.", aktionen: ["springen"] });
  return out;
}

/* ── Sterne und Fortschritt ────────────────────────────────────────────────── */

export const sterne = (fehler: number) => (fehler === 0 ? 3 : fehler <= 2 ? 2 : 1);

export type Stand = Record<string, number>;

export function ladeStand(schluessel: string): Stand {
  try {
    const roh = JSON.parse(localStorage.getItem(schluessel) ?? "{}");
    if (!roh || typeof roh !== "object" || Array.isArray(roh)) return {};
    const aus: Stand = {};
    for (const [k, v] of Object.entries(roh)) if (typeof v === "number" && v >= 1 && v <= 3) aus[k] = v;
    return aus;
  } catch { return {}; }
}

export function speichereStand(schluessel: string, s: Stand) {
  try { localStorage.setItem(schluessel, JSON.stringify(s)); } catch { /* privates Fenster */ }
}

/** Ein besseres Ergebnis ersetzt ein schlechteres, nie umgekehrt. */
export const mitErgebnis = (s: Stand, id: string, st: number): Stand =>
  (s[id] ?? 0) >= st ? s : { ...s, [id]: st };

/** Gleichung y = mx + n als LaTeX — für Auftrag und Beschriftung. */
export function geradeTex([z, n]: Bruch, b: number): string {
  const neg = z < 0;
  const az = Math.abs(z);
  const m = n === 1 ? (az === 1 ? "" : String(az)) : `\\tfrac{${az}}{${n}}`;
  const plus = b === 0 ? "" : b > 0 ? ` + ${b}` : ` - ${-b}`;
  return `y = ${neg ? "-" : ""}${m}x${plus}`;
}

export function bruchTex([z, n]: Bruch): string {
  if (n === 1) return String(z);
  return `${z < 0 ? "-" : ""}\\tfrac{${Math.abs(z)}}{${n}}`;
}
