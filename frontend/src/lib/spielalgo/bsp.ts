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
  /** Schnittrichtung: quer zur längeren Seite, immer abwechselnd oder Münzwurf */
  schnitt?: "laenger" | "abwechselnd" | "zufall";
  /** Wo geschnitten wird: 0 = genau in der Mitte, 1 = irgendwo zwischen den Mindestgrößen */
  streuung?: number;
  /** Gangform */
  gang?: "L" | "Z";
  /** zusätzliche Gänge zwischen nahen Räumen (ergeben Rundwege) */
  rundgaenge?: number;
}

export const BSP_STANDARD: BspOptionen = { b: 64, h: 44, min: 8, tiefe: 5, fuellung: 0.55, schnitt: "laenger", streuung: 1, gang: "L", rundgaenge: 0 };

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
    // Regel für die Richtung (nur wenn beide gehen)
    const regel = s.o.schnitt ?? "laenger";
    let senkrecht: boolean;
    if (!kannWaagrecht) senkrecht = true;
    else if (!kannSenkrecht) senkrecht = false;
    else if (regel === "abwechselnd") senkrecht = kn.tiefe % 2 === 0;
    else if (regel === "laenger" && r.b / r.h > 1.25) senkrecht = true;
    else if (regel === "laenger" && r.h / r.b > 1.25) senkrecht = false;
    else senkrecht = rng() < 0.5;
    const laenge = senkrecht ? r.b : r.h;
    // Schnittstelle: um die Mitte herum, so weit die Streuung erlaubt
    const spiel = Math.floor(((laenge - 2 * min) / 2) * (s.o.streuung ?? 1));
    const pos = Math.floor(laenge / 2) - spiel + Math.floor(rng() * (2 * spiel + 1));
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
    s.gaenge.push(gang(s, mitte(best[0]), mitte(best[1]), rng));
    s.aktiv = i;
    yield `Gang zwischen den beiden Hälften von Ebene ${s.knoten[i].tiefe + 1} – jetzt hängen sie zusammen.`;
  }

  // 4. Rundgänge: zusätzliche Gänge zwischen nahen Räumen, die noch keinen direkten Gang haben
  const alle = s.knoten.filter(k => k.raum).map(k => k.raum!);
  const verbunden = new Set<string>();
  for (let n = 0; n < (s.o.rundgaenge ?? 0); n++) {
    let best: [number, number] | null = null, bestD = Infinity;
    for (let i = 0; i < alle.length; i++) for (let j = i + 1; j < alle.length; j++) {
      if (verbunden.has(`${i}-${j}`)) continue;
      const [px, py] = mitte(alle[i]), [qx, qy] = mitte(alle[j]);
      const d = Math.abs(px - qx) + Math.abs(py - qy) + rng() * 6;
      if (d < bestD) { bestD = d; best = [i, j]; }
    }
    if (!best) break;
    verbunden.add(`${best[0]}-${best[1]}`);
    s.gaenge.push(gang(s, mitte(alle[best[0]]), mitte(alle[best[1]]), rng));
    yield `Rundgang ${n + 1}: zwei nahe Räume zusätzlich verbunden – jetzt gibt es einen zweiten Weg.`;
  }
  return "fertig";
}

function gang(s: Bsp, a: [number, number], b: [number, number], rng: () => number): [number, number][] {
  if ((s.o.gang ?? "L") === "L") return lGang(a, b, rng() < 0.5);
  return zGang(a, b, rng() < 0.5);
}

/** Gang in Z-Form: Knick in der Mitte zwischen beiden Räumen. */
export function zGang([ax, ay]: [number, number], [bx, by]: [number, number], waagrecht: boolean): [number, number][] {
  if (waagrecht) {
    const mx = Math.floor((ax + bx) / 2);
    return [...lGang([ax, ay], [mx, by], true).slice(0, -1), ...lGang([mx, by], [bx, by], true)];
  }
  const my = Math.floor((ay + by) / 2);
  return [...lGang([ax, ay], [bx, my], false).slice(0, -1), ...lGang([bx, my], [bx, by], false)];
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
