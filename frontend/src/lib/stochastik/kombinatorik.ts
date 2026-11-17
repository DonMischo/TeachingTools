/**
 * Kombinatorik (Kl. 10, Gymnasium) und Zufallsgrößen.
 *
 * Drei Abzählprinzipien wie im Lehrplan: geordnet mit Zurücklegen (n^k),
 * geordnet ohne Zurücklegen (n · (n−1) · …), mit einem Griff (ohne
 * Reihenfolge, ohne Zurücklegen: geordnet geteilt durch k!). Die
 * Schreibweise als Binomialkoeffizient kommt erst in 11/12.
 */
import { bruch, mal, plus, summe, wert, type Bruch } from "./zahlen";

export type Ziehart = "mitZ" | "ohneZ" | "griff";

export const fakultaet = (n: number): number => (n <= 1 ? 1 : n * fakultaet(n - 1));

/** Die Faktoren, die man hinschreibt: [6, 6, 6] oder [6, 5, 4]. */
export function faktoren(n: number, k: number, art: Ziehart): number[] {
  return Array.from({ length: k }, (_, i) => (art === "mitZ" ? n : n - i));
}

export function anzahl(n: number, k: number, art: Ziehart): number {
  if (k < 0 || (art !== "mitZ" && k > n)) return 0;
  const p = faktoren(n, k, art).reduce((a, b) => a * b, 1);
  return art === "griff" ? p / fakultaet(k) : p;
}

/** Alle Möglichkeiten aufzählen (nur für kleine Zahlen gedacht). */
export function aufzaehlen<T>(xs: readonly T[], k: number, art: Ziehart): T[][] {
  const aus: T[][] = [];
  const geh = (start: number, frei: boolean[], bisher: T[]) => {
    if (bisher.length === k) { aus.push(bisher); return; }
    xs.forEach((x, i) => {
      if (art !== "mitZ" && !frei[i]) return;
      if (art === "griff" && i < start) return;
      const f = [...frei]; f[i] = false;
      geh(i + 1, f, [...bisher, x]);
    });
  };
  geh(0, xs.map(() => true), []);
  return aus;
}

// ── Zufallsgrößen ─────────────────────────────────────────────────────────

export interface Wert { x: number; p: Bruch }

export function erwartungswert(v: readonly Wert[]): Bruch {
  return summe(v.map(w => mal(bruch(Math.round(w.x * 100), 100), w.p)));
}

export const pSumme = (v: readonly Wert[], gilt: (x: number) => boolean) => summe(v.filter(w => gilt(w.x)).map(w => w.p));

/** Gleich große x-Werte zusammenfassen und sortieren. */
export function verteilung(paare: readonly { x: number; p: Bruch }[]): Wert[] {
  const z = new Map<number, Bruch>();
  for (const { x, p } of paare) z.set(x, plus(z.get(x) ?? bruch(0), p));
  return [...z].sort((a, b) => a[0] - b[0]).map(([x, p]) => ({ x, p }));
}

/** Augensumme zweier Würfel. */
export function augensumme(seiten = 6): Wert[] {
  const paare: { x: number; p: Bruch }[] = [];
  for (let i = 1; i <= seiten; i++) for (let j = 1; j <= seiten; j++) paare.push({ x: i + j, p: bruch(1, seiten * seiten) });
  return verteilung(paare);
}

/** Σ-Schreibweise des Erwartungswerts als lesbarer Text. */
export function summenTerm(v: readonly Wert[], bt: (b: Bruch) => string): string {
  return v.map(w => `${w.x < 0 ? `(${String(w.x).replace("-", "−")})` : w.x} · ${bt(w.p)}`).join(" + ");
}

export const istFair = (v: readonly Wert[]) => wert(erwartungswert(v)) === 0;
