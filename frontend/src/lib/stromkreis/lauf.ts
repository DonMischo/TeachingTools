/** Wie fein gerechnet werden muss, damit Wechselstrom und Schwingkreise rund laufen. */
import type { Schaltung } from "./modell";
import { TEILE } from "./teile";

const wert = (s: Schaltung["bauteile"][number], k: string) => s.werte[k] ?? TEILE[s.art].werte[k];

export function hatWechsel(s: Schaltung): boolean {
  return s.bauteile.some(t => t.art === "wechselquelle");
}

/** Größter Zeitschritt: höchstens 1 ms, 100 Schritte je Wechselstrom- oder LC-Periode. */
export function schrittweite(s: Schaltung): number {
  let dt = 1e-3;
  for (const t of s.bauteile) if (t.art === "wechselquelle") dt = Math.min(dt, 1 / (100 * wert(t, "frequenz")));
  const L = s.bauteile.filter(t => t.art === "spule").map(t => wert(t, "induktivitaet"));
  const C = s.bauteile.filter(t => t.art === "kondensator").map(t => wert(t, "kapazitaet"));
  if (L.length && C.length) dt = Math.min(dt, (2 * Math.PI * Math.sqrt(Math.min(...L) * Math.min(...C))) / 100);
  return Math.max(1e-7, dt);
}

/** Größte Spannung, die eine Quelle liefern kann — Maßstab für die Potenzialfarben. */
export function hoechstspannung(s: Schaltung): number {
  let v = 0;
  for (const t of s.bauteile) {
    if (t.art === "batterie") v = Math.max(v, Math.abs(wert(t, "spannung")));
    if (t.art === "wechselquelle") v = Math.max(v, Math.abs(wert(t, "spannung")) * Math.SQRT2);
  }
  return Math.max(1, v);
}
