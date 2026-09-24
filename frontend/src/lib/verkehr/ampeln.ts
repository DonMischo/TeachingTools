/**
 * Ampelanlagen. Die Ampel-Punkte aus OSM werden zu Anlagen gebündelt (alles
 * innerhalb 45 m), ihre Zufahrten nach Richtung in zwei Achsen geteilt. Die
 * Anlage schaltet im festen Umlauf — der Stand hängt nur an der Uhr, deshalb
 * sehen alle Spieler dieselben Farben ohne ein einziges Nachrichtenpaket.
 *
 * Anlagen mit nur einer Achse sind Fußgängerampeln: für Autos grün, bis
 * jemand den Taster drückt.
 */
import type { P } from "./geometrie";
import { winkelVon, type Stadt } from "./stadt";

export type Licht = "gruen" | "gelb" | "rot" | "rotgelb";

export type Anlage = {
  id: number;
  mitte: P;
  /** Richtung der Achsen (mod π). Eine Achse = Fußgängerampel an einer Straße. */
  achsen: number[];
  /** Versatz im Umlauf, damit nicht alle Anlagen gleichzeitig umspringen. */
  versatz: number;
  signale: { p: P; achse: number; art: "auto" | "fuss" }[];
};

/** Umlauf einer Kreuzung in Sekunden: A grün 20, gelb 3, alles rot 2, B grün 20, gelb 3, alles rot 2. */
export const UMLAUF = 50;
const GRUEN = 20, GELB = 3, ROT_ALLE = 2, ROTGELB = 1.5;

/** Fußgängerampel: so lange nach dem Drücken bis Fußgängergrün, und so lange grün. */
export const TASTER_WARTEN = 5;
export const FUSS_GRUEN = 10;
/** Räumzeit: Fußgänger rot, Autos noch rot. */
const RAEUMEN = 4;

function achsenwinkel(w: number) {
  const m = ((w % Math.PI) + Math.PI) % Math.PI;
  return m;
}
export function achsenAbstand(a: number, b: number) {
  const d = Math.abs(achsenwinkel(a) - achsenwinkel(b));
  return Math.min(d, Math.PI - d);
}

export function baueAnlagen(stadt: Stadt): Anlage[] {
  const punkte = stadt.karte.punkte.filter((p) => p.art === "ampel" || p.art === "ampelUebergang");
  const haufen: { p: P; art: "auto" | "fuss" }[][] = [];
  for (const p of punkte) {
    const eintrag = { p: p.p, art: p.art === "ampel" ? ("auto" as const) : ("fuss" as const) };
    const h = haufen.find((h) => h.some((q) => Math.hypot(q.p[0] - p.p[0], q.p[1] - p.p[1]) < 45));
    if (h) h.push(eintrag); else haufen.push([eintrag]);
  }
  return haufen.map((h, id) => {
    const mitte: P = [h.reduce((s, q) => s + q.p[0], 0) / h.length, h.reduce((s, q) => s + q.p[1], 0) / h.length];
    const achsen: number[] = [];
    const signale = h.flatMap((q) => {
      const n = stadt.naechsteStrasse(q.p[0], q.p[1], 12);
      if (!n) return [];
      const w = achsenwinkel(winkelVon(n.st));
      let i = achsen.findIndex((a) => achsenAbstand(a, w) < Math.PI / 5);
      if (i < 0) { if (achsen.length >= 2) i = achsenAbstand(achsen[0], w) < achsenAbstand(achsen[1], w) ? 0 : 1; else { achsen.push(w); i = achsen.length - 1; } }
      return [{ p: q.p, achse: i, art: q.art }];
    });
    return { id, mitte, achsen, versatz: (id * 17) % UMLAUF, signale };
  });
}

/** Autolicht einer Achse zur Zeit `t` (Sekunden der gemeinsamen Uhr). `taster` = Zeitpunkt des letzten Drückens. */
export function autoLicht(a: Anlage, achse: number, t: number, taster = -Infinity): Licht {
  if (a.achsen.length < 2) return autoLichtFussampel(t - taster);
  const u = (((t + a.versatz) % UMLAUF) + UMLAUF) % UMLAUF;
  const phase = achse === 0 ? u : (u + UMLAUF / 2) % UMLAUF;
  if (phase < GRUEN) return "gruen";
  if (phase < GRUEN + GELB) return "gelb";
  if (phase >= UMLAUF - ROTGELB) return "rotgelb";
  return "rot";
}

function autoLichtFussampel(seitTaster: number): Licht {
  if (seitTaster < 0 || seitTaster >= TASTER_WARTEN + FUSS_GRUEN + RAEUMEN + ROTGELB) return "gruen";
  if (seitTaster < TASTER_WARTEN - GELB) return "gruen";
  if (seitTaster < TASTER_WARTEN) return "gelb";
  if (seitTaster < TASTER_WARTEN + FUSS_GRUEN + RAEUMEN) return "rot";
  return "rotgelb";
}

/**
 * Darf man zu Fuß über die Straße der Achse `achse`? Grün, solange die Autos
 * dieser Achse rot haben — ohne die letzten Sekunden davor (Räumzeit).
 */
export function fussGruen(a: Anlage, achse: number, t: number, taster = -Infinity): boolean {
  if (a.achsen.length < 2) {
    const s = t - taster;
    return s >= TASTER_WARTEN && s < TASTER_WARTEN + FUSS_GRUEN;
  }
  const u = (((t + a.versatz) % UMLAUF) + UMLAUF) % UMLAUF;
  const phase = achse === 0 ? u : (u + UMLAUF / 2) % UMLAUF;
  // Autos dieser Achse rot von GRUEN+GELB bis UMLAUF-ROTGELB; Fußgänger grün ab
  // da plus ROT_ALLE, bis RAEUMEN vor dem Ende.
  return phase >= GRUEN + GELB + ROT_ALLE && phase < UMLAUF - ROTGELB - RAEUMEN;
}

/** Die Anlage und Achse, zu der ein Punkt auf einer Fahrbahn gehört (≤ 30 m zur Mitte, Richtung der Straße). */
export function anlageAn(anlagen: Anlage[], x: number, y: number, strassenWinkel: number): { a: Anlage; achse: number } | null {
  let best: { a: Anlage; d: number } | null = null;
  for (const a of anlagen) {
    const d = Math.min(...a.signale.map((s) => Math.hypot(s.p[0] - x, s.p[1] - y)), Math.hypot(a.mitte[0] - x, a.mitte[1] - y));
    if (d < 30 && (!best || d < best.d)) best = { a, d };
  }
  if (!best) return null;
  const { a } = best;
  let achse = 0;
  if (a.achsen.length > 1 && achsenAbstand(a.achsen[1], strassenWinkel) < achsenAbstand(a.achsen[0], strassenWinkel)) achse = 1;
  return { a, achse };
}
