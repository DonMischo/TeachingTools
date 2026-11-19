/**
 * BSP-Räume (Binary Space Partitioning): Die Fläche wird immer wieder in zwei
 * Teile geschnitten, in jedes Endstück kommt ein Raum, dann verbinden Gänge
 * die Geschwister — von unten nach oben im Baum, so hängt am Ende alles
 * zusammen.
 *
 * Als Generator: Nach jedem Schnitt, Raum und Gang wird angehalten (`yield`
 * mit einer Notiz), damit man zusehen kann.
 */

export interface Rechteck { x: number; y: number; b: number; h: number }

export interface BspKnoten {
  r: Rechteck;
  tiefe: number;
  kinder?: [number, number];
  /** Schnitt: senkrecht = Linie von oben nach unten bei x = pos */
  schnitt?: { senkrecht: boolean; pos: number };
  raum?: Rechteck;
}

export interface BspOptionen {
  b: number;
  h: number;
  /** kleinste Seitenlänge eines Teilstücks */
  min: number;
  /** größte Baumtiefe */
  tiefe: number;
  /** Raum füllt sein Teilstück zu mindestens … (0..1) */
  fuellung: number;
}

export const BSP_STANDARD: BspOptionen = { b: 64, h: 44, min: 8, tiefe: 5, fuellung: 0.55 };

export interface Bsp {
  o: BspOptionen;
  knoten: BspKnoten[];
  /** Gänge als Zellfolgen */
  gaenge: [number, number][][];
  /** zuletzt bearbeiteter Knoten */
  aktiv: number;
}

export const ZELLE = { WAND: 0, RAUM: 1, GANG: 2 } as const;

export function neuerBsp(o: BspOptionen): Bsp {
  return { o, knoten: [{ r: { x: 0, y: 0, b: o.b, h: o.h }, tiefe: 0 }], gaenge: [], aktiv: 0 };
}

const mitte = (r: Rechteck): [number, number] => [Math.floor(r.x + r.b / 2), Math.floor(r.y + r.h / 2)];

export function* erzeugeBsp(s: Bsp, rng: () => number): Generator<string> {
  const { tiefe: maxTiefe, fuellung } = s.o;
  const min = Math.max(5, s.o.min); // Raum 3×3 plus Rand muss hineinpassen
  yield "Eine leere Fläche. Sie wird jetzt immer wieder in zwei Teile geschnitten.";

  // 1. Teilen, Ebene für Ebene
  const schlange = [0];
  for (let k = 0; k < schlange.length; k++) {
    const i = schlange[k];
    const kn = s.knoten[i];
    const { r } = kn;
    if (kn.tiefe >= maxTiefe) continue;
    const kannSenkrecht = r.b >= 2 * min, kannWaagrecht = r.h >= 2 * min;
    if (!kannSenkrecht && !kannWaagrecht) continue;
    // Lange Stücke quer schneiden, sonst zufällig
    let senkrecht: boolean;
    if (!kannWaagrecht) senkrecht = true;
    else if (!kannSenkrecht) senkrecht = false;
    else if (r.b / r.h > 1.25) senkrecht = true;
    else if (r.h / r.b > 1.25) senkrecht = false;
    else senkrecht = rng() < 0.5;
    const laenge = senkrecht ? r.b : r.h;
    const pos = min + Math.floor(rng() * (laenge - 2 * min + 1));
    const a: Rechteck = senkrecht ? { ...r, b: pos } : { ...r, h: pos };
    const b: Rechteck = senkrecht ? { ...r, x: r.x + pos, b: r.b - pos } : { ...r, y: r.y + pos, h: r.h - pos };
    const ia = s.knoten.push({ r: a, tiefe: kn.tiefe + 1 }) - 1;
    const ib = s.knoten.push({ r: b, tiefe: kn.tiefe + 1 }) - 1;
    kn.kinder = [ia, ib];
    kn.schnitt = { senkrecht, pos: (senkrecht ? r.x : r.y) + pos };
    schlange.push(ia, ib);
    s.aktiv = i;
    yield `Ebene ${kn.tiefe + 1}: Stück ${r.b}×${r.h} ${senkrecht ? "senkrecht" : "waagrecht"} geteilt (${a.b}×${a.h} und ${b.b}×${b.h}).`;
  }

  // 2. Räume in die Blätter
  const blaetter = s.knoten.map((_, i) => i).filter(i => !s.knoten[i].kinder);
  for (const i of blaetter) {
    const { r } = s.knoten[i];
    // 1 Feld Rand rundum, damit Räume sich nicht berühren
    const innenB = r.b - 2, innenH = r.h - 2;
    const rb = Math.max(3, Math.min(innenB, Math.floor(innenB * (fuellung + rng() * (1 - fuellung)))));
    const rh = Math.max(3, Math.min(innenH, Math.floor(innenH * (fuellung + rng() * (1 - fuellung)))));
    const rx = r.x + 1 + Math.floor(rng() * (innenB - rb + 1));
    const ry = r.y + 1 + Math.floor(rng() * (innenH - rh + 1));
    s.knoten[i].raum = { x: rx, y: ry, b: rb, h: rh };
    s.aktiv = i;
    yield `Raum ${rb}×${rh} in ein Endstück gesetzt (${blaetter.indexOf(i) + 1} von ${blaetter.length}).`;
  }

  // 3. Gänge: von unten nach oben je ein Gang zwischen den beiden Kindern
  const innere = s.knoten.map((_, i) => i).filter(i => s.knoten[i].kinder).sort((a, b) => s.knoten[b].tiefe - s.knoten[a].tiefe);
  for (const i of innere) {
    const [ka, kb] = s.knoten[i].kinder!;
    const ra = raeume(s, ka), rb = raeume(s, kb);
    // das nächstgelegene Raumpaar verbinden
    let best: [Rechteck, Rechteck] = [ra[0], rb[0]], bestD = Infinity;
    for (const p of ra) for (const q of rb) {
      const [px, py] = mitte(p), [qx, qy] = mitte(q);
      const d = Math.abs(px - qx) + Math.abs(py - qy);
      if (d < bestD) { bestD = d; best = [p, q]; }
    }
    s.gaenge.push(lGang(mitte(best[0]), mitte(best[1]), rng() < 0.5));
    s.aktiv = i;
    yield `Gang zwischen den beiden Hälften von Ebene ${s.knoten[i].tiefe + 1} – jetzt hängen sie zusammen.`;
  }
  return "fertig";
}

/** Alle Räume im Teilbaum von `i`. */
export function raeume(s: Bsp, i: number): Rechteck[] {
  const kn = s.knoten[i];
  if (kn.raum) return [kn.raum];
  if (!kn.kinder) return [];
  return [...raeume(s, kn.kinder[0]), ...raeume(s, kn.kinder[1])];
}

/** Gang in L-Form: erst waagrecht, dann senkrecht (oder umgekehrt). */
export function lGang([ax, ay]: [number, number], [bx, by]: [number, number], erstWaagrecht: boolean): [number, number][] {
  const z: [number, number][] = [];
  const sx = Math.sign(bx - ax), sy = Math.sign(by - ay);
  if (erstWaagrecht) {
    for (let x = ax; x !== bx; x += sx) z.push([x, ay]);
    for (let y = ay; y !== by; y += sy) z.push([bx, y]);
  } else {
    for (let y = ay; y !== by; y += sy) z.push([ax, y]);
    for (let x = ax; x !== bx; x += sx) z.push([x, by]);
  }
  z.push([bx, by]);
  return z;
}

/** Fertiges Raster: 0 Wand, 1 Raum, 2 Gang. */
export function bspRaster(s: Bsp): Uint8Array {
  const { b, h } = s.o;
  const z = new Uint8Array(b * h);
  for (const g of s.gaenge) for (const [x, y] of g) z[y * b + x] = ZELLE.GANG;
  for (const kn of s.knoten) if (kn.raum) {
    const r = kn.raum;
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.b; x++) z[y * b + x] = ZELLE.RAUM;
  }
  return z;
}
