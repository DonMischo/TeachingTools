/**
 * Wo passt eine Stadt hin? Gemeinsame Bewertung für alle Stadttypen:
 *   - Gelände: mittlere Hangneigung über die ganze Fläche der Stadt, nicht
 *     nur am Mittelpunkt (keine Residenz auf Hügeln, kein Raster am Hang)
 *   - Fluss: jeder Typ hat einen Wunschabstand zum Fluss — nah genug für
 *     Wasser, Handel und Mühlen, weit genug aus der Aue
 * Die Stile addieren den Wert zu ihren eigenen Bedingungen.
 */
import { inAue, istWasser, neigungBei, type Gelaende } from "@/lib/gelaende/gelaende";
import { zurLinie, type P } from "./geometrie";
import type { Stil } from "./modell";

export interface Profil {
  /** Radius der Stadtfläche in Metern */
  r: number;
  /** mittlere Neigung in %, die noch gut bebaubar ist */
  neigung: number;
  /** Wunschabstand zum Fluss [Meter, Toleranz] — null: egal */
  fluss: [number, number] | null;
  /** Gewicht des Flussabstands (1 = normal) */
  flussGewicht?: number;
}

export const PROFILE: Record<Stil, Profil> = {
  roemisch: { r: 280, neigung: 5, fluss: [380, 200] },
  europaeisch: { r: 230, neigung: 7, fluss: [200, 150], flussGewicht: 1.5 },
  amerikanisch: { r: 330, neigung: 4, fluss: [450, 350], flussGewicht: 0.5 },
  residenz: { r: 450, neigung: 3, fluss: [600, 350] },
  festung: { r: 420, neigung: 3, fluss: [520, 250] },
  sozialistisch: { r: 400, neigung: 4, fluss: [900, 450], flussGewicht: 0.6 },
  lateinamerika: { r: 300, neigung: 5, fluss: [450, 300], flussGewicht: 0.6 },
  orientalisch: { r: 400, neigung: 6, fluss: [480, 260] },
  bergmann: { r: 220, neigung: 14, fluss: [160, 160], flussGewicht: 0.8 },
  industrie: { r: 350, neigung: 3, fluss: [260, 160], flussGewicht: 1.5 },
  hafen: { r: 300, neigung: 5, fluss: [220, 180], flussGewicht: 0.6 },
  tech: { r: 450, neigung: 4, fluss: [700, 500], flussGewicht: 0.3 },
};

/** Abstand zur Fluss-Mittellinie (Meter), Infinity ohne Fluss */
export function flussAbstand(g: Gelaende, p: P): number {
  return g.flussLinie.length < 2 ? Infinity : zurLinie(p, g.flussLinie).d;
}

/** Mittlere Neigung und Anteil nasser/überschwemmter Punkte in der Kreisfläche */
export function flaeche(g: Gelaende, c: P, r: number): { neigung: number; nass: number } {
  let neig = 0, nass = 0, n = 0;
  for (const f of [0, 1 / 3, 2 / 3, 1]) {
    const k = f === 0 ? 1 : 12;
    for (let i = 0; i < k; i++) {
      const w = (i / k) * Math.PI * 2 + f;
      const x = c.x + Math.cos(w) * r * f, y = c.y + Math.sin(w) * r * f;
      n++;
      if (x < 0 || y < 0 || x > g.breite || y > g.breite) { nass++; continue; }
      if (istWasser(g, x, y) || inAue(g, x, y)) nass++;
      neig += neigungBei(g, x, y);
    }
  }
  return { neigung: neig / Math.max(1, n - nass), nass: nass / n };
}

/** Eignung von c als Stadtmitte für den Stil: ≈ 0 ideal, stark negativ ungeeignet */
export function eignung(g: Gelaende, c: P, stil: Stil): number {
  const p = PROFILE[stil];
  const f = flaeche(g, c, p.r);
  // steiler als erlaubt kostet viel, flacher ist immer etwas besser
  let w = -Math.max(0, f.neigung - p.neigung) * 1.5 - f.neigung * 0.15 - f.nass * 4;
  if (p.fluss) {
    const d = flussAbstand(g, c);
    if (Number.isFinite(d)) w -= (Math.abs(d - p.fluss[0]) / p.fluss[1]) * (p.flussGewicht ?? 1);
  }
  return w;
}

/** Kurzer Satz, warum der Ort passt (für die Anzeige) */
export function standortText(g: Gelaende, c: P, stil: Stil): string {
  const p = PROFILE[stil];
  const f = flaeche(g, c, p.r);
  const d = flussAbstand(g, c);
  const teile = [`mittlere Neigung ${f.neigung.toFixed(1).replace(".", ",")} % (gut bis ${p.neigung} %)`];
  if (Number.isFinite(d)) teile.push(`${Math.round(d / 10) * 10} m zum Fluss`);
  return teile.join(", ");
}
