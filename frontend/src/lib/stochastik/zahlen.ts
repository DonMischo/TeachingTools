/**
 * Kleine Rechenbausteine für die Stochastik: Brüche (Wahrscheinlichkeiten
 * bleiben exakt, wie im Heft), deutsche Zahlschreibweise und ein Zufall, den
 * man für Tests festlegen kann.
 */
import { leseZahl, zahl } from "@/lib/quadratisch";

export { zahl };

export interface Bruch { z: number; n: number }

const ggt = (a: number, b: number): number => (b === 0 ? Math.abs(a) : ggt(b, a % b));

export function bruch(z: number, n = 1): Bruch {
  if (n === 0) throw new Error("Nenner 0");
  const g = ggt(z, n) || 1;
  const s = n < 0 ? -1 : 1;
  return { z: (s * z) / g, n: (s * n) / g };
}

export const mal = (a: Bruch, b: Bruch) => bruch(a.z * b.z, a.n * b.n);
export const plus = (a: Bruch, b: Bruch) => bruch(a.z * b.n + b.z * a.n, a.n * b.n);
export const minus = (a: Bruch, b: Bruch) => bruch(a.z * b.n - b.z * a.n, a.n * b.n);
export const durch = (a: Bruch, b: Bruch) => bruch(a.z * b.n, a.n * b.z);
export const wert = (b: Bruch) => b.z / b.n;
export const summe = (bs: Bruch[]) => bs.reduce(plus, bruch(0));
export const gleich = (a: Bruch, b: Bruch) => a.z === b.z && a.n === b.n;

/** »3/8«, ganze Zahlen ohne Nenner. */
export const bt = (b: Bruch) => (b.n === 1 ? String(b.z) : `${b.z}/${b.n}`);

/** Prozent mit höchstens einer Nachkommastelle: »37,5 %«. */
export const prozent = (x: number, nk = 1) => `${zahl(x * 100, nk)} %`;

/**
 * Antwort für eine Wahrscheinlichkeit oder relative Häufigkeit lesen:
 * »3/8«, »0,375«, »37,5 %« und »37,5%« meinen dasselbe.
 */
export function leseAnteil(s: string): number | null {
  const t = s.trim();
  if (/%$/.test(t)) {
    const x = leseZahl(t.replace(/%$/, ""));
    return x === null ? null : x / 100;
  }
  return leseZahl(t);
}

/** Zufall, der sich festlegen lässt (mulberry32) – für Tests und Wiederholungen. */
export type Zufall = () => number;
export function zufall(saat: number): Zufall {
  let a = saat >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const ganz = (r: Zufall, von: number, bis: number) => von + Math.floor(r() * (bis - von + 1));
export const eins = <T>(r: Zufall, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];
export function mische<T>(r: Zufall, xs: readonly T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
