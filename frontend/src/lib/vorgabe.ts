/**
 * Vorgaben für Simulationen an TaskCrawler-Stationen (`task.sim.config`).
 * Die kommen aus hochgeladenem JSON, also ohne Gewähr — hier wird
 * vorsichtig gelesen: Falscher Typ zählt wie »nicht angegeben«.
 */
export type Vorgabe = Record<string, unknown>;

export function text(v: Vorgabe | undefined, k: string): string | undefined {
  const x = v?.[k];
  return typeof x === "string" && x.trim() ? x.trim() : undefined;
}

export function zahl(v: Vorgabe | undefined, k: string): number | undefined {
  const x = v?.[k];
  return typeof x === "number" && Number.isFinite(x) ? x : undefined;
}

export function wahl<T extends string>(v: Vorgabe | undefined, k: string, erlaubt: readonly T[]): T | undefined {
  const x = text(v, k);
  return x && (erlaubt as readonly string[]).includes(x) ? (x as T) : undefined;
}

export function zahlen(v: Vorgabe | undefined, k: string): Record<string, number> | undefined {
  const x = v?.[k];
  if (!x || typeof x !== "object" || Array.isArray(x)) return undefined;
  const aus: Record<string, number> = {};
  for (const [n, w] of Object.entries(x)) if (typeof w === "number" && Number.isFinite(w)) aus[n] = w;
  return Object.keys(aus).length ? aus : undefined;
}
