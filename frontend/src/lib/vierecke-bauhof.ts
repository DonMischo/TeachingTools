/**
 * Spiel »Bauhof« zu Rechtecken — reine Logik, ohne Oberfläche.
 *
 *   🦁 Gehege bauen   Ein Tier braucht mindestens `bedarf` Kästchen Platz, es
 *                     gibt nur `zaun` Zaunstücke. Gezogen wird ein Rechteck auf
 *                     dem Gelände, Felsen und Teiche dürfen nicht hinein.
 *                     Umfang gegen Fläche: Bei gleichem Zaun fasst das
 *                     quadratischere Gehege mehr.
 *   🖌️ Wand streichen Die Wand ohne Fenster und Tür mit möglichst wenigen
 *                     Rollerstrichen streichen; jeder Strich ist ein Rechteck,
 *                     das weder Fenster noch Gestrichenes überdeckt. Am Ende
 *                     ist die Wandfläche die Summe der Teilrechtecke.
 */
import { eins, ganz, type Zufall } from "@/lib/geometrie/aufgabe";

/** Rechteck in Kästchen: linke obere Zelle (x, y), Breite b, Höhe h. */
export type Rechteck = { x: number; y: number; b: number; h: number };

/** Rechteck zwischen zwei angetippten Zellen (beide eingeschlossen). */
export function aufziehen(x1: number, y1: number, x2: number, y2: number): Rechteck {
  return { x: Math.min(x1, x2), y: Math.min(y1, y2), b: Math.abs(x2 - x1) + 1, h: Math.abs(y2 - y1) + 1 };
}

export const flaeche = (r: Rechteck) => r.b * r.h;
export const umfang = (r: Rechteck) => 2 * (r.b + r.h);

export function zellen(r: Rechteck): number[][] {
  const z: number[][] = [];
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.b; x++) z.push([x, y]);
  return z;
}

/** Gitter als Zeilen von Zeichen: "." frei, sonst belegt. */
export type Gitter = string[];
export const frei = (g: Gitter, x: number, y: number) => g[y]?.[x] === ".";
export const passt = (g: Gitter, r: Rechteck) => zellen(r).every(([x, y]) => frei(g, x, y));

/* ─────────────────────────────────────────────────────────── Gehege ── */

/** `ab`: so viele Kästchen braucht das Tier mindestens — kleine Tiere, kleine Gehege. */
export type Tier = { emoji: string; name: string; ab: number };
export const TIERE: Tier[] = [
  { emoji: "🐧", name: "Pinguine", ab: 0 }, { emoji: "🐐", name: "Ziegen", ab: 6 }, { emoji: "🦙", name: "Alpakas", ab: 9 },
  { emoji: "🦓", name: "Zebras", ab: 12 }, { emoji: "🐻", name: "Bären", ab: 15 }, { emoji: "🦁", name: "Löwen", ab: 18 },
  { emoji: "🦒", name: "Giraffen", ab: 22 }, { emoji: "🐘", name: "Elefanten", ab: 26 },
];

/** Das größte Tier, dem der Platzbedarf noch zusteht. */
export const tierFuer = (bedarf: number): Tier => TIERE.filter(t => t.ab <= bedarf).at(-1)!;

export type GehegeLevel = { nr: number; w: number; h: number; gitter: Gitter; tier: Tier; zaun: number; bedarf: number; beste: number };

/** Größte Fläche, die mit höchstens `zaun` Zaun auf freiem Gelände geht. */
export function besteFlaeche(g: Gitter, zaun: number): number {
  const H = g.length, W = g[0].length;
  let best = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
    for (let h = 1; y + h <= H; h++) for (let b = 1; x + b <= W; b++) {
      const r = { x, y, b, h };
      if (umfang(r) > zaun) break;
      if (flaeche(r) > best && passt(g, r)) best = flaeche(r);
    }
  return best;
}

/**
 * Level `nr`: Je höher, desto mehr Hindernisse und desto knapper der Zaun.
 * Ein Lösungsrechteck wird zuerst gewählt und freigehalten — lösbar ist jedes
 * Level also immer.
 */
export function gehegeLevel(nr: number, r: Zufall = Math.random): GehegeLevel {
  const w = 12, h = 9;
  const b = ganz(r, 3, 6), hh = ganz(r, 2, 5);
  const loes: Rechteck = { x: ganz(r, 0, w - b), y: ganz(r, 0, h - hh), b, h: hh };
  const zeilen = Array.from({ length: h }, () => Array(w).fill("."));
  const loesZ = new Set(zellen(loes).map(([x, y]) => `${x},${y}`));
  const hindernisse = Math.min(4 + nr * 3, 26);
  for (let i = 0; i < hindernisse; i++) {
    const x = ganz(r, 0, w - 1), y = ganz(r, 0, h - 1);
    if (!loesZ.has(`${x},${y}`)) zeilen[y][x] = r() < 0.7 ? "F" : "T";
  }
  const gitter = zeilen.map(z => z.join(""));
  // Anfangs etwas Spielraum beim Zaun, später genau der Umfang der Lösung.
  const zaun = umfang(loes) + (nr < 3 ? 2 : nr < 6 ? ganz(r, 0, 1) * 2 : 0);
  const bedarf = Math.max(2, flaeche(loes) - (nr < 4 ? ganz(r, 1, 3) : 0));
  return { nr, w, h, gitter, tier: tierFuer(bedarf), zaun, bedarf, beste: besteFlaeche(gitter, zaun) };
}

/** Bewertung eines gezogenen Geheges; `null`, solange etwas nicht passt. */
export function bewerteGehege(l: GehegeLevel, g: Rechteck): { ok: boolean; grund?: string; sterne: number } {
  if (!passt(l.gitter, g)) return { ok: false, grund: "Felsen und Teiche dürfen nicht ins Gehege.", sterne: 0 };
  if (umfang(g) > l.zaun) return { ok: false, grund: `Der Zaun reicht nicht: Umfang ${umfang(g)}, aber nur ${l.zaun} Zaunstücke.`, sterne: 0 };
  if (flaeche(g) < l.bedarf) return { ok: false, grund: `Zu eng: ${flaeche(g)} Kästchen, die ${l.tier.name} brauchen ${l.bedarf}.`, sterne: 0 };
  return { ok: true, sterne: flaeche(g) >= l.beste ? 3 : flaeche(g) >= Math.max(l.bedarf + 1, l.beste * 0.85) ? 2 : 1 };
}

/* ───────────────────────────────────────────────────────────── Wand ── */

/** "." zu streichen, "F" Fenster, "T" Tür. */
export type WandLevel = { nr: number; w: number; h: number; gitter: Gitter; flaeche: number; profi: number };

/**
 * Wenigste Striche nach einem gierigen Verfahren: erste freie Zelle (Zeile für
 * Zeile), so breit wie möglich, dann so tief wie diese Breite reicht. Das ist
 * eine obere Schranke — wer sie unterbietet, bekommt einen Extrastern.
 */
export function gierigeStriche(g: Gitter): Rechteck[] {
  const H = g.length, W = g[0].length;
  const belegt = g.map(z => z.split("").map(c => c !== "."));
  const striche: Rechteck[] = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (belegt[y][x]) continue;
    let b = 0;
    while (x + b < W && !belegt[y][x + b]) b++;
    let h = 1;
    while (y + h < H && Array.from({ length: b }, (_, i) => belegt[y + h][x + i]).every(v => !v)) h++;
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + b; xx++) belegt[yy][xx] = true;
    striche.push({ x, y, b, h });
  }
  return striche;
}

export function wandLevel(nr: number, r: Zufall = Math.random): WandLevel {
  const w = ganz(r, 9, 12), h = ganz(r, 5, 7);
  const zeilen = Array.from({ length: h }, () => Array(w).fill("."));
  const setze = (q: Rechteck, c: string) => { for (const [x, y] of zellen(q)) zeilen[y][x] = c; };
  // Tür unten, Fenster oben — mit steigendem Level mehr und unregelmäßiger.
  const tb = ganz(r, 2, 3), th = Math.min(h - 1, ganz(r, 3, 4));
  setze({ x: ganz(r, 0, w - tb), y: h - th, b: tb, h: th }, "T");
  const fenster = Math.min(1 + Math.floor(nr / 2), 4);
  for (let i = 0; i < fenster; i++) {
    const fb = eins(r, [1, 2, 2, 3]), fh = eins(r, [1, 2, 2]);
    const q = { x: ganz(r, 0, w - fb), y: ganz(r, 0, Math.max(0, h - fh - 2)), b: fb, h: fh };
    if (zellen(q).every(([x, y]) => zeilen[y][x] === ".")) setze(q, "F");
  }
  const gitter = zeilen.map(z => z.join(""));
  return { nr, w, h, gitter, flaeche: gitter.join("").split("").filter(c => c === ".").length, profi: gierigeStriche(gitter).length };
}

/** Sterne: fertig = 1, höchstens Profi-Wert + 1 Striche = 2, Profi-Wert oder besser = 3. */
export function wandSterne(l: WandLevel, striche: number): number {
  return striche <= l.profi ? 3 : striche <= l.profi + 1 ? 2 : 1;
}
