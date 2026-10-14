/** Zufall und Fingerabdruck der Challenge-Spiele, wiederholbar aus einem Startwert. */
export { rng } from "@/lib/ki/rng";

/** Mischt eine Kopie der Liste (Fisher-Yates) mit dem Zufall rnd. */
export function mische<T>(liste: readonly T[], rnd: () => number): T[] {
  const a = [...liste];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/** FNV-1a über einen Text: derselbe Text ergibt dieselbe 32-Bit-Zahl. */
export function hashText(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}
