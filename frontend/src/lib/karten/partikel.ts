/**
 * Partikelfluss für Wind und Meeresströmungen (wie earth.nullschool): Aus den
 * schematischen Linien wird ein Geschwindigkeitsfeld auf einem 1°-Gitter, in
 * dem Partikel treiben. Reine Rechnung — gezeichnet wird in PartikelFluss.tsx.
 */
import type { Feature, Geometry, Position } from "geojson";

/**
 * Feld auf 1°-Gitter: Zelle (x, y) = Länge −180 + x, Breite 90 − y. u = Ost, v = Nord, je 0–1.
 * klasse: welche der übergebenen Arten (Windgürtel) in der Zelle überwiegt, 1-basiert (0 = keine).
 */
export type Feld = { u: Float32Array; v: Float32Array; warm: Float32Array; staerke: Float32Array; klasse: Uint8Array; aktiv: number[] };

const B = 360, H = 180;
const GURT = ["itc", "hoch", "tief"];

const zuMonat = (monate: unknown, monat: string) => monate === "alle" || String(monate ?? "alle").includes(`,${monat},`);

function linien(g: Geometry): Position[][] {
  if (g.type === "LineString") return [g.coordinates];
  if (g.type === "MultiLineString") return g.coordinates;
  return [];
}

/**
 * Baut das Feld: Stützpunkte alle ½° entlang der Linien (Richtung = Linienrichtung),
 * jeder wirkt im Umkreis `radius` (Grad) mit Gewicht (1 − d/r)², gemittelt je Zelle.
 */
export function baueFeld(features: Feature[], monat: string, radius: number, klassen: string[] = []): Feld {
  const u = new Float32Array(B * H), v = new Float32Array(B * H), warm = new Float32Array(B * H), gewicht = new Float32Array(B * H);
  const K = klassen.length, jeKlasse = new Float32Array(B * H * K);
  for (const f of features) {
    const p = f.properties ?? {};
    if (GURT.includes(p.art) || !zuMonat(p.monate, monat) || !f.geometry) continue;
    const istWarm = p.art === "warm" ? 1 : 0, ki = klassen.indexOf(p.art);
    for (const l of linien(f.geometry)) for (let i = 1; i < l.length; i++) {
      const [x0, y0] = l[i - 1], [x1, y1] = l[i];
      const k = Math.cos((((y0 + y1) / 2) * Math.PI) / 180);
      const ost = (x1 - x0) * k, nord = y1 - y0, laenge = Math.hypot(ost, nord);
      if (!laenge) continue;
      const schritte = Math.max(1, Math.ceil(laenge / 0.5));
      for (let s = 0; s <= schritte; s++) {
        const lon = x0 + ((x1 - x0) * s) / schritte, lat = y0 + ((y1 - y0) * s) / schritte;
        const kl = Math.max(0.2, Math.cos((lat * Math.PI) / 180));
        const ry = Math.ceil(radius), rx = Math.ceil(radius / kl);
        const cx = Math.floor(lon + 180), cy = Math.floor(90 - lat);
        for (let dy = -ry; dy <= ry; dy++) for (let dx = -rx; dx <= rx; dx++) {
          const x = cx + dx, y = cy + dy;
          if (x < 0 || x >= B || y < 0 || y >= H) continue;
          const d = Math.hypot((x + 0.5 - 180 - lon) * kl, 90 - y - 0.5 - lat);
          if (d >= radius) continue;
          const w = (1 - d / radius) ** 2, z = y * B + x;
          u[z] += (w * ost) / laenge; v[z] += (w * nord) / laenge; warm[z] += w * istWarm; gewicht[z] += w;
          if (ki >= 0) jeKlasse[z * K + ki] += w;
        }
      }
    }
  }
  const staerke = new Float32Array(B * H), klasse = new Uint8Array(B * H), aktiv: number[] = [];
  for (let z = 0; z < B * H; z++) {
    const w = gewicht[z];
    if (!w) continue;
    const betrag = Math.hypot(u[z], v[z]) || 1;
    // Richtung aus dem Mittel, Stärke wächst mit der Nähe zur Linie
    staerke[z] = Math.min(1, w);
    u[z] = (u[z] / betrag) * staerke[z]; v[z] = (v[z] / betrag) * staerke[z]; warm[z] /= w;
    if (staerke[z] > 0.15) aktiv.push(z);
    for (let k = 0, best = 0; k < K; k++) if (jeKlasse[z * K + k] > best) { best = jeKlasse[z * K + k]; klasse[z] = k + 1; }
  }
  return { u, v, warm, staerke, klasse, aktiv };
}

/** Geschwindigkeit an einer Stelle (bilinear zwischen den Zellmitten). */
export function wind(feld: Feld, lon: number, lat: number): [number, number, number] {
  const fx = lon + 180 - 0.5, fy = 90 - lat - 0.5;
  const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
  let u = 0, v = 0, warm = 0;
  for (const [x, y, w] of [[x0, y0, (1 - tx) * (1 - ty)], [x0 + 1, y0, tx * (1 - ty)], [x0, y0 + 1, (1 - tx) * ty], [x0 + 1, y0 + 1, tx * ty]]) {
    if (x < 0 || x >= B || y < 0 || y >= H) continue;
    const z = y * B + x;
    u += feld.u[z] * w; v += feld.v[z] * w; warm += feld.warm[z] * w;
  }
  return [u, v, warm];
}

/** Überwiegende Art (1-basiert, 0 = keine) in der Zelle an dieser Stelle. */
export function klasseBei(feld: Feld, lon: number, lat: number): number {
  const x = Math.min(B - 1, Math.max(0, Math.floor(lon + 180))), y = Math.min(H - 1, Math.max(0, Math.floor(90 - lat)));
  return feld.klasse[y * B + x];
}

/** Zufälliger Startpunkt in einer Zelle, in der etwas fließt. */
export function startpunkt(feld: Feld, zufall = Math.random): [number, number] | null {
  if (!feld.aktiv.length) return null;
  const z = feld.aktiv[Math.floor(zufall() * feld.aktiv.length)];
  return [(z % B) - 180 + zufall(), 90 - Math.floor(z / B) - zufall()];
}
