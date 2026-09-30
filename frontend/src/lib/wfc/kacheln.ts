/**
 * Simple Tiled Model: Kacheln mit Anschlüssen an den vier Seiten. Zwei
 * Kacheln dürfen nebeneinander, wenn die Anschlüsse der gemeinsamen Kante
 * gleich sind. Drehungen werden automatisch erzeugt (außer bei der
 * Landschaft, deren Kacheln schon alle Lagen enthalten).
 */
import { gegen, type Modell } from "./kern";

/** Anschlüsse in der Reihenfolge rechts, unten, links, oben (wie RICHTUNG) */
export type Seiten = [string, string, string, string];

export interface Kachel {
  name: string;
  seiten: Seiten;
  gewicht: number;
  /** Landschaft: Geländestufe der Ecken NW, NE, SE, SW */
  ecken?: [number, number, number, number];
}

export interface Variante { kachel: Kachel; drehung: number; seiten: Seiten }

export interface Kachelsatz {
  id: string;
  name: string;
  text: string;
  kacheln: Kachel[];
  drehen: boolean;
  /** Farben der Anschlussarten bzw. Geländestufen für die Pinsel */
  pinsel: { name: string; farbe: string; passt: (v: Variante) => boolean }[];
}

function drehe(s: Seiten): Seiten {
  // im Uhrzeigersinn: was oben war, ist jetzt rechts
  return [s[3], s[0], s[1], s[2]];
}

export function varianten(satz: Kachelsatz): Variante[] {
  const aus: Variante[] = [];
  for (const k of satz.kacheln) {
    const gesehen = new Set<string>();
    let s = k.seiten;
    for (let r = 0; r < (satz.drehen ? 4 : 1); r++) {
      const key = s.join("|");
      if (!gesehen.has(key)) { gesehen.add(key); aus.push({ kachel: k, drehung: r, seiten: s }); }
      s = drehe(s);
    }
  }
  return aus;
}

export function kachelModell(v: Variante[]): Modell {
  const erlaubt = [0, 1, 2, 3].map(d => v.map(a => v.flatMap((b, q) => (a.seiten[d] === b.seiten[gegen(d)] ? [q] : []))));
  // Das Gewicht einer Kachel teilt sich auf ihre Drehungen auf
  const lagen = new Map<Kachel, number>();
  for (const x of v) lagen.set(x.kachel, (lagen.get(x.kachel) ?? 0) + 1);
  return { anzahl: v.length, gewicht: v.map(x => x.kachel.gewicht / lagen.get(x.kachel)!), erlaubt };
}

const hat = (v: Variante, zeichen: string) => v.seiten.some(s => s.includes(zeichen));

// ── Rohre ────────────────────────────────────────────────────────────────
const ROHRE: Kachelsatz = {
  id: "rohre", name: "Rohre", drehen: true,
  text: "Jede Kachel hat an jeder Seite einen Anschluss (1) oder keinen (0). Nebeneinander passen nur Kanten mit gleichem Anschluss — so entstehen geschlossene Rohrnetze.",
  kacheln: [
    { name: "leer", seiten: ["0", "0", "0", "0"], gewicht: 3 },
    { name: "gerade", seiten: ["1", "0", "1", "0"], gewicht: 2 },
    { name: "kurve", seiten: ["1", "1", "0", "0"], gewicht: 2 },
    { name: "t", seiten: ["1", "1", "1", "0"], gewicht: 1 },
    { name: "kreuz", seiten: ["1", "1", "1", "1"], gewicht: 0.5 },
    { name: "ende", seiten: ["1", "0", "0", "0"], gewicht: 0.3 },
  ],
  pinsel: [
    { name: "leer", farbe: "#1f2937", passt: v => v.kachel.name === "leer" },
    { name: "Rohr", farbe: "#38bdf8", passt: v => v.kachel.name !== "leer" },
  ],
};

// ── Straßen und Flüsse ───────────────────────────────────────────────────
const STRASSEN: Kachelsatz = {
  id: "strassen", name: "Straßen & Flüsse", drehen: true,
  text: "Drei Anschlussarten: Wiese (W), Straße (S), Fluss (F). Wo eine Straße einen Fluss kreuzt, braucht es eine Brücke — sonst passt nichts.",
  kacheln: [
    { name: "wiese", seiten: ["W", "W", "W", "W"], gewicht: 6 },
    { name: "strasse", seiten: ["S", "W", "S", "W"], gewicht: 2 },
    { name: "strassenkurve", seiten: ["S", "S", "W", "W"], gewicht: 1 },
    { name: "einmuendung", seiten: ["S", "S", "S", "W"], gewicht: 0.6 },
    { name: "kreuzung", seiten: ["S", "S", "S", "S"], gewicht: 0.3 },
    { name: "fluss", seiten: ["F", "W", "F", "W"], gewicht: 2 },
    { name: "flusskurve", seiten: ["F", "F", "W", "W"], gewicht: 1 },
    { name: "bruecke", seiten: ["S", "F", "S", "F"], gewicht: 0.6 },
  ],
  pinsel: [
    { name: "Wiese", farbe: "#65a30d", passt: v => v.kachel.name === "wiese" },
    { name: "Straße", farbe: "#78716c", passt: v => hat(v, "S") && !hat(v, "F") },
    { name: "Fluss", farbe: "#2563eb", passt: v => hat(v, "F") },
  ],
};

// ── Landschaft (Ecken-Kacheln) ────────────────────────────────────────────
const STUFEN = ["Wasser", "Sand", "Wiese"];
const landschaft: Kachel[] = [];
{
  // Alle Eckenbelegungen aus Wasser (0), Sand (1), Wiese (2) — außer denen, bei
  // denen Wasser und Wiese an einer Kante nebeneinanderliegen. Über Kreuz
  // (diagonal, nur in der Mitte berührend) ist erlaubt: sonst gäbe es Zellen,
  // die von zwei schrägen Nachbarn Wasser und Wiese aufgezwungen bekommen und für
  // die es keine Kachel gibt — der Lauf scheiterte dann fast immer, sobald Wiese entsteht.
  for (let m = 0; m < 81; m++) {
    const e = [0, 1, 2, 3].map(b => Math.floor(m / 3 ** b) % 3) as [number, number, number, number];
    const [nw, ne, se, sw] = e;
    const kanten = [[nw, ne], [ne, se], [se, sw], [sw, nw]];
    if (kanten.some(([a, b]) => Math.abs(a - b) > 1)) continue;
    const rein = e.every(x => x === e[0]);
    landschaft.push({
      // Wasser leicht, Wiese schwer: sonst flutet das Wasser vom Rand her alles (Insel ohne Wiese)
      name: `ecken-${e.join("")}`, ecken: e, gewicht: rein ? [0.5, 1, 8][e[0]] : 1,
      // rechts: NE+SE, unten: SW+SE, links: NW+SW, oben: NW+NE — gleiche Ecken müssen aneinanderstoßen
      seiten: [`${ne}${se}`, `${sw}${se}`, `${nw}${sw}`, `${nw}${ne}`],
    });
  }
}
const LANDSCHAFT: Kachelsatz = {
  id: "landschaft", name: "Landschaft", drehen: false, kacheln: landschaft,
  text: "Jede Kachel hat an ihren vier Ecken Wasser, Sand oder Wiese; aneinander stoßende Ecken müssen gleich sein. Entlang einer Kante liegen nur benachbarte Stufen — deshalb liegt zwischen Wasser und Wiese immer ein Strand.",
  pinsel: STUFEN.map((name, s) => ({
    name, farbe: ["#2563eb", "#fcd34d", "#65a30d"][s],
    passt: (v: Variante) => v.kachel.ecken!.every(x => x === s),
  })),
};

export const KACHELSAETZE: Kachelsatz[] = [LANDSCHAFT, STRASSEN, ROHRE];
