import type { Bevoelkerung, Zustand } from "./typen";

export const klemme = (x: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, x));

/** 0…100 → −1…+1, 50 ist neutral. */
export const n = (x: number) => (x - 50) / 50;

export const gesamt = (b: Bevoelkerung) => b.jung + b.erwerb + b.alt;
export const altAnteil = (b: Bevoelkerung) => b.alt / gesamt(b);
export const erwerbAnteil = (b: Bevoelkerung) => b.erwerb / gesamt(b);

/** Zufallsgenerator mit Zustand im Spielstand (mulberry32) — gleicher Seed, gleiche Ereignisse. */
export function zufall(z: Zustand): number {
  let t = (z.rng = (z.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function mio(x: number): string {
  if (x >= 1000) return `${(x / 1000).toLocaleString("de-DE", { maximumFractionDigits: 2 })} Mrd.`;
  return `${x.toLocaleString("de-DE", { maximumFractionDigits: x < 10 ? 1 : 0 })} Mio.`;
}
