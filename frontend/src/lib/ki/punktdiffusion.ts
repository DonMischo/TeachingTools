/**
 * Echtes Entrauschen — in zwei Dimensionen.
 *
 * Der Bilderteil kann das Verrauschen live rechnen, den Rückweg aber nicht:
 * Dafür bräuchte es ein trainiertes Modell, das rät, welches Rauschen weg muss.
 * Mit **Punkten statt Pixeln** geht genau dieser Rückweg trotzdem — und zwar
 * richtig gerechnet, nicht nachgespielt.
 *
 * Der Trick: Das Ziel ist hier keine unbekannte Verteilung über alle Bilder der
 * Welt, sondern eine bekannte Punktwolke (ein Herz, ein Stern, ein Haus). Für
 * eine bekannte Verteilung lässt sich die Größe, die ein Bildmodell mühsam
 * lernen muss, direkt ausrechnen: die Richtung, in der die Punktdichte am
 * stärksten wächst. Fachleute nennen sie Score.
 *
 *   q(x_t) = Mittel über alle Zielpunkte von N(x_t; √ᾱ·x_i, (1−ᾱ))
 *   ∇ log q(x_t) = Σ_i w_i · (√ᾱ·x_i − x_t) / (1−ᾱ)
 *
 * Das w_i ist dabei genau das, was man erwartet: Ein Zielpunkt zählt umso mehr,
 * je näher er liegt. Jeder Schritt schiebt die Punkte ein Stück in diese
 * Richtung und würfelt ein bisschen Rauschen dazu — dasselbe Verfahren wie bei
 * Stable Diffusion, nur dass dort ein neuronales Netz die Richtung schätzt.
 *
 * Was ein Bildmodell tut, ist also nicht »das Bild aus dem Rauschen holen«,
 * sondern: **immer wieder ein kleines Stück in die wahrscheinlichere Richtung
 * gehen.** Genau das sieht man hier.
 */
import { rng } from "./rng";

export type Punkt = { x: number; y: number };

/** Der Kosinus-Fahrplan: anfangs verschwindet wenig, am Ende viel. */
export function alphaQuer(t: number, schritte: number): number {
  const s = 0.008;
  const f = (x: number) => Math.cos(((x / schritte + s) / (1 + s)) * (Math.PI / 2)) ** 2;
  return Math.max(1e-4, Math.min(1, f(t) / f(0)));
}

/** Normalverteilte Zufallszahl (Box-Muller). */
function normal(wuerfel: () => number): number {
  const u = Math.max(1e-9, wuerfel());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * wuerfel());
}

// ────────────────────────────────────────────────────────────── Formen ──
// Jede Form ist eine Frage: liegt dieser Punkt drinnen? Daraus werden durch
// Würfeln (Verwerfungsmethode) gleichmäßig verteilte Punkte — ein Zielbild,
// das aus lauter Einzelpunkten besteht.

type Innen = (x: number, y: number) => boolean;

const HERZ: Innen = (x, y) => {
  // Die klassische Herzkurve, etwas gestaucht: (x²+y²−1)³ − x²y³ ≤ 0
  const a = x * 1.25;
  const b = -y * 1.25 + 0.25;
  const u = a * a + b * b - 0.55;
  return u * u * u - a * a * b * b * b <= 0;
};

const STERN: Innen = (x, y) => {
  // Fünfzackiger Stern in Polarkoordinaten: der erlaubte Radius schwankt.
  const r = Math.hypot(x, y);
  const winkel = Math.atan2(y, x);
  const zacken = 5;
  const grenze = 0.55 + 0.35 * Math.cos(zacken * (winkel - Math.PI / 2));
  return r <= grenze;
};

const HAUS: Innen = (x, y) => {
  const wand = Math.abs(x) <= 0.55 && y >= -0.75 && y <= 0.15;
  const dach = y > 0.15 && y <= 0.8 && Math.abs(x) <= 0.7 * (1 - (y - 0.15) / 0.65);
  return wand || dach;
};

const RING: Innen = (x, y) => {
  const r = Math.hypot(x, y);
  return r <= 0.8 && r >= 0.45;
};

export type Form = { slug: string; titel: string; icon: string; punkte: Punkt[] };

/** Punkte in einer Form auswürfeln — immer dieselben, damit alle dasselbe sehen. */
function streue(innen: Innen, anzahl: number, seed: number): Punkt[] {
  const wuerfel = rng(seed);
  const out: Punkt[] = [];
  let versuche = 0;
  while (out.length < anzahl && versuche < anzahl * 200) {
    versuche++;
    const x = wuerfel() * 2 - 1;
    const y = wuerfel() * 2 - 1;
    if (innen(x, y)) out.push({ x, y });
  }
  return out;
}

const ZIELPUNKTE = 260;

export const FORMEN: Form[] = [
  { slug: "herz", titel: "Herz", icon: "❤️", punkte: streue(HERZ, ZIELPUNKTE, 11) },
  { slug: "stern", titel: "Stern", icon: "⭐", punkte: streue(STERN, ZIELPUNKTE, 22) },
  { slug: "haus", titel: "Haus", icon: "🏠", punkte: streue(HAUS, ZIELPUNKTE, 33) },
  { slug: "ring", titel: "Ring", icon: "⭕", punkte: streue(RING, ZIELPUNKTE, 44) },
];

/** Alle Formen zusammen — das »kenne ich nicht«-Ziel für den Prompt-Regler. */
export const ALLE_PUNKTE: Punkt[] = FORMEN.flatMap(f => f.punkte);

// ──────────────────────────────────────────────────────── Vor und zurück ──

/** Reines Rauschen als Startpunkt — so fängt jedes Bildmodell an. */
export function rauschwolke(anzahl: number, seed: number): Punkt[] {
  const wuerfel = rng(seed);
  return Array.from({ length: anzahl }, () => ({ x: normal(wuerfel), y: normal(wuerfel) }));
}

/** Der Hinweg: Punkte verrauschen, wie beim Training eines Bildmodells. */
export function verrausche(punkte: readonly Punkt[], t: number, schritte: number, seed: number): Punkt[] {
  const a = Math.sqrt(alphaQuer(t, schritte));
  const b = Math.sqrt(1 - alphaQuer(t, schritte));
  const wuerfel = rng(seed);
  return punkte.map(p => ({
    x: a * p.x + b * normal(wuerfel),
    y: a * p.y + b * normal(wuerfel),
  }));
}

/**
 * Die Richtung, in der es dichter wird — für eine bekannte Punktwolke exakt.
 *
 * Jeder Zielpunkt zieht, aber unterschiedlich stark: je näher, desto mehr. Das
 * Gewicht wird über den Abstand als Softmax bestimmt, deshalb der Umweg über
 * das Maximum (sonst rechnet man mit e hoch minus sehr viel und bekommt 0).
 */
function score(p: Punkt, ziel: readonly Punkt[], aQuer: number): Punkt {
  const wurzelA = Math.sqrt(aQuer);
  const varianz = Math.max(1e-6, 1 - aQuer);
  let maxLog = -Infinity;
  const logs = new Array<number>(ziel.length);
  for (let i = 0; i < ziel.length; i++) {
    const dx = p.x - wurzelA * ziel[i].x;
    const dy = p.y - wurzelA * ziel[i].y;
    logs[i] = -(dx * dx + dy * dy) / (2 * varianz);
    if (logs[i] > maxLog) maxLog = logs[i];
  }
  let summe = 0;
  for (let i = 0; i < ziel.length; i++) {
    logs[i] = Math.exp(logs[i] - maxLog);
    summe += logs[i];
  }
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < ziel.length; i++) {
    const w = logs[i] / summe;
    sx += w * (wurzelA * ziel[i].x - p.x);
    sy += w * (wurzelA * ziel[i].y - p.y);
  }
  return { x: sx / varianz, y: sy / varianz };
}

/**
 * Ein Schritt zurück: von t nach t−1.
 *
 * `staerke` ist der Prompt-Regler (in der Fachsprache »Guidance«):
 *
 *   0  Das Ziel wird ignoriert — es entsteht irgendeine der bekannten Formen.
 *   1  Ganz normal auf die gewählte Form zu.
 *   >1 Übertrieben: Die Punkte drängen auf die dichtesten Stellen und lassen
 *      den Rest der Form leer. Genau dieser Fehler passiert auch echten
 *      Bildgeneratoren, wenn man die Guidance zu hoch dreht.
 */
export function entrauscheSchritt(
  punkte: readonly Punkt[],
  t: number,
  schritte: number,
  ziel: readonly Punkt[],
  egal: readonly Punkt[],
  staerke: number,
  wuerfel: () => number,
): Punkt[] {
  const aQuer = alphaQuer(t, schritte);
  const aQuerVorher = alphaQuer(t - 1, schritte);
  // Wie viel Rauschen dieser eine Schritt wegnimmt.
  const alpha = Math.min(0.9999, aQuer / aQuerVorher);
  const beta = 1 - alpha;

  return punkte.map(p => {
    const mitZiel = score(p, ziel, aQuer);
    // Bei voller Stärke ist der Umweg über das Ziel-lose Modell unnötig.
    const roh = staerke === 1 ? mitZiel : score(p, egal, aQuer);
    const sx = roh.x + staerke * (mitZiel.x - roh.x);
    const sy = roh.y + staerke * (mitZiel.y - roh.y);
    const mittel = (1 / Math.sqrt(alpha)) * (p.x + beta * sx);
    const mittelY = (1 / Math.sqrt(alpha)) * (p.y + beta * sy);
    // Der letzte Schritt wird nicht mehr verrauscht — sonst zittert das Bild.
    const zufall = t > 1 ? Math.sqrt(beta) : 0;
    return {
      x: mittel + zufall * normal(wuerfel),
      y: mittelY + zufall * normal(wuerfel),
    };
  });
}

/** Wie nah die Wolke ihrer Zielform schon ist (0–1) — für die Fortschrittszeile. */
export function aehnlichkeit(punkte: readonly Punkt[], ziel: readonly Punkt[]): number {
  if (!punkte.length || !ziel.length) return 0;
  let summe = 0;
  for (const p of punkte) {
    let nah = Infinity;
    for (const z of ziel) {
      const d = (p.x - z.x) ** 2 + (p.y - z.y) ** 2;
      if (d < nah) nah = d;
    }
    summe += Math.sqrt(nah);
  }
  const schnitt = summe / punkte.length;
  // 0 Abstand → 1, ein halber Bildschirm Abstand → 0.
  return Math.max(0, Math.min(1, 1 - schnitt / 0.5));
}
