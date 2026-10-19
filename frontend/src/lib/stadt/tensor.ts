/**
 * Straßen aus einem Tensorfeld, nach der Idee von »MapGenerator« (Keir,
 * github.com/ProbableTrain/MapGenerator, LGPL-3.0) und Chen et al. 2008,
 * »Interactive Procedural Street Modeling«. Neu geschrieben, kein Code
 * übernommen.
 *
 * Ein Feld ordnet jedem Punkt zwei Richtungen zu (Haupt und quer dazu). Aus
 * Rastern (gerade Straßen) und Kreisen (Straßen rund um einen Platz) wird
 * gemischt, je näher, desto stärker. Straßen folgen dann den Feldlinien und
 * halten Abstand zueinander — das ergibt Blöcke, die sich dem Gelände und den
 * Plätzen anpassen.
 */
import type { Rauschen } from "@/lib/gelaende/rauschen";
import { abstand, ausduennen, type P } from "./geometrie";

export type Basis =
  | { art: "raster"; c: P; winkel: number; groesse: number }
  | { art: "radial"; c: P; groesse: number };

export interface Feld { basen: Basis[]; rauschen?: { r: Rauschen; staerke: number; skala: number } }

/** Richtung der Hauptlinien an p (Bogenmaß) */
export function hauptRichtung(f: Feld, p: P): number {
  let a = 0, b = 0;
  for (const s of f.basen) {
    const d = abstand(p, s.c);
    const w = Math.exp(-((d / s.groesse) ** 2)) + 1e-6;
    const th = s.art === "raster" ? s.winkel : Math.atan2(p.y - s.c.y, p.x - s.c.x) + Math.PI / 2;
    a += w * Math.cos(2 * th);
    b += w * Math.sin(2 * th);
  }
  let phi = Math.atan2(b, a) / 2;
  if (f.rauschen) phi += f.rauschen.staerke * f.rauschen.r(p.x / f.rauschen.skala, p.y / f.rauschen.skala);
  return phi;
}

export interface StromOptionen {
  /** Abstand zwischen Straßen gleicher Richtung */
  dsep: number;
  /** Straße endet, wenn sie einer anderen so nahe kommt */
  dtest: number;
  schritt: number;
  maxLaenge: number;
  minLaenge: number;
  /** Straßen enden an Ecken anderer Straßen in diesem Umkreis */
  verbinden: number;
  zufall: () => number;
  /** Startpunkte (z. B. auf Hauptstraßen); sonst zufällig */
  keime?: P[];
  /** Rechteck für zufällige Keime */
  rahmen: { x0: number; y0: number; x1: number; y1: number };
  /** höchstens so viele Straßen je Richtung */
  max?: number;
}

class Raster {
  private m = new Map<number, { p: P; id: number }[]>();
  constructor(private z: number) {}
  private k(x: number, y: number) { return Math.floor(x / this.z) * 100003 + Math.floor(y / this.z); }
  add(p: P, id: number) {
    const k = this.k(p.x, p.y);
    let l = this.m.get(k);
    if (!l) this.m.set(k, (l = []));
    l.push({ p, id });
  }
  /** nächster Punkt einer anderen Linie als id */
  naechster(p: P, r: number, ohne = -1): { p: P; d: number; id: number } | null {
    let best: { p: P; d: number; id: number } | null = null;
    const n = Math.ceil(r / this.z);
    const cx = Math.floor(p.x / this.z), cy = Math.floor(p.y / this.z);
    for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) {
      const l = this.m.get((cx + i) * 100003 + (cy + j));
      if (!l) continue;
      for (const e of l) {
        if (e.id === ohne) continue;
        const d = abstand(p, e.p);
        if (d < r && (!best || d < best.d)) best = { p: e.p, d, id: e.id };
      }
    }
    return best;
  }
}

/**
 * Verfolgt Feldlinien beider Richtungen abwechselnd.
 * `drin(p)` begrenzt das Gebiet (Mauer, Wasser, Viertel).
 */
export function stromlinien(f: Feld, drin: (p: P) => boolean, o: StromOptionen): P[][] {
  const familien = [new Raster(o.dsep), new Raster(o.dsep)];
  const alle = new Raster(o.dsep);
  const linien: { punkte: P[]; fam: number }[] = [];
  const keime: P[][] = [[...(o.keime ?? [])], [...(o.keime ?? [])]];
  let id = 0;
  const anzahl = [0, 0];
  const maxJe = o.max ?? 400;

  const zufallsKeim = (): P => ({
    x: o.rahmen.x0 + o.zufall() * (o.rahmen.x1 - o.rahmen.x0),
    y: o.rahmen.y0 + o.zufall() * (o.rahmen.y1 - o.rahmen.y0),
  });

  const verfolge = (start: P, fam: number, vor: 1 | -1, eigene: number): P[] => {
    const pts: P[] = [];
    let p = start;
    let w = hauptRichtung(f, p) + (fam ? Math.PI / 2 : 0);
    let dx = Math.cos(w) * vor, dy = Math.sin(w) * vor;
    let weg = 0;
    while (weg < o.maxLaenge / 2) {
      // Euler mit Richtungsstetigkeit (Feldlinien haben kein Vorzeichen)
      w = hauptRichtung(f, p) + (fam ? Math.PI / 2 : 0);
      let nx = Math.cos(w), ny = Math.sin(w);
      if (nx * dx + ny * dy < 0) { nx = -nx; ny = -ny; }
      const q = { x: p.x + nx * o.schritt, y: p.y + ny * o.schritt };
      if (!drin(q)) break;
      if (familien[fam].naechster(q, o.dtest, eigene)) break;
      pts.push(q);
      weg += o.schritt;
      dx = nx; dy = ny; p = q;
      if (weg > o.dsep * 2 && abstand(q, start) < o.schritt) break;
    }
    return pts;
  };

  let versuche = 0;
  while (versuche++ < 4000 && (anzahl[0] < maxJe || anzahl[1] < maxJe)) {
    const fam = versuche % 2;
    if (anzahl[fam] >= maxJe) continue;
    const s = keime[fam].length ? keime[fam].shift()! : versuche < 3000 ? zufallsKeim() : null;
    if (!s) break;
    if (!drin(s) || familien[fam].naechster(s, o.dsep)) continue;
    const meine = id;
    const a = verfolge(s, fam, 1, meine), b = verfolge(s, fam, -1, meine);
    const punkte = [...b.reverse(), s, ...a];
    if (punkte.length * o.schritt < o.minLaenge) continue;
    id++;
    anzahl[fam]++;
    linien.push({ punkte, fam });
    for (const p of punkte) { familien[fam].add(p, meine); alle.add(p, meine); }
    // neue Keime für die Gegenrichtung entlang dieser Straße
    for (let i = 0; i < punkte.length; i += Math.max(1, Math.round(o.dsep / o.schritt))) keime[1 - fam].push(punkte[i]);
  }

  // lose Enden an die nächste Straße anschließen
  return linien.map((l, i) => {
    const pts = [...l.punkte];
    for (const ende of [0, 1]) {
      const p = ende ? pts[pts.length - 1] : pts[0];
      const n = alle.naechster(p, o.verbinden, i);
      if (n && n.d > 1) { if (ende) pts.push(n.p); else pts.unshift(n.p); }
    }
    return ausduennen(pts, o.schritt * 2.5);
  });
}
