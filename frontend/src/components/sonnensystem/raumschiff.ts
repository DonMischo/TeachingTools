/**
 * Prozedurale Raumschiffe, aus einem Startwert (Seed) gebaut.
 *
 * Nachbau des Blender-Skripts SpaceshipGenerator von Michael Davies
 * (https://github.com/a1studmuffin/SpaceshipGenerator, MIT-Lizenz,
 * Copyright (c) 2016 Michael Davies). Das Original arbeitet mit bmesh in
 * Blender; hier dasselbe Vorgehen auf einer kleinen Flächenliste:
 *   1. ein zufällig gestreckter Würfel,
 *   2. vorne und hinten Rumpfabschnitte herausziehen (mal verjüngt, verschoben, gerippt),
 *   3. ein paar schiefe Auswüchse,
 *   4. jede Fläche nach Lage verzieren: hinten Triebwerke, oben Antennen,
 *      seitlich Geschütze und Kugeln, unten Landescheiben, überall Gitter und Fenster,
 *   5. oft spiegelsymmetrisch.
 * Abweichungen: keine Bevel-Kante, Texturen werden gezeichnet statt geladen,
 * und der Zufall ist ein eigener (gleicher Seed ⇒ überall dasselbe Schiff,
 * aber nicht dasselbe wie in Blender).
 */
import * as THREE from "three";

/** Materialplätze wie im Original. */
export const HUELLE = 0, LICHTER = 1, DUNKEL = 2, GLUT = 3, SCHEIBE = 4;

interface Flaeche { v: number[]; mat: number; tot?: boolean }

/** Gleicher Text ⇒ gleiche Zahlenfolge (cyrb53-Hash + mulberry32). */
function zufallAus(seed: string): () => number {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < seed.length; i++) {
    const c = seed.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  let a = (Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Bau {
  p: THREE.Vector3[] = [];
  f: Flaeche[] = [];
  constructor(readonly zufall: () => number) {}

  r() { return this.zufall(); }
  /** wie Pythons uniform(a, b) */
  u(a: number, b: number) { return a + (b - a) * this.zufall(); }
  /** wie Pythons randint(a, b): beide Grenzen eingeschlossen */
  ganz(a: number, b: number) { return a + Math.floor(this.zufall() * (b - a + 1)); }

  punkt(v: THREE.Vector3) { this.p.push(v); return this.p.length - 1; }
  flaeche(v: number[], mat: number): Flaeche { const f = { v, mat }; this.f.push(f); return f; }
  lebende() { return this.f.filter(f => !f.tot); }

  /** Newell-Verfahren: funktioniert auch für leicht verbogene Vielecke. */
  normale(f: Flaeche) {
    const n = new THREE.Vector3();
    for (let i = 0; i < f.v.length; i++) {
      const a = this.p[f.v[i]], b = this.p[f.v[(i + 1) % f.v.length]];
      n.x += (a.y - b.y) * (a.z + b.z);
      n.y += (a.z - b.z) * (a.x + b.x);
      n.z += (a.x - b.x) * (a.y + b.y);
    }
    return n;
  }
  einheitsNormale(f: Flaeche) { return this.normale(f).normalize(); }
  flaecheninhalt(f: Flaeche) { return this.normale(f).length() / 2; }
  mitte(f: Flaeche) {
    const box = new THREE.Box3();
    for (const i of f.v) box.expandByPoint(this.p[i]);
    return box.getCenter(new THREE.Vector3());
  }
  /** Achsen der Fläche: x entlang der ersten Kante, z zeigt hinein (wie get_face_matrix). */
  matrix(f: Flaeche, ort?: THREE.Vector3) {
    const x = this.p[f.v[1]].clone().sub(this.p[f.v[0]]).normalize();
    const z = this.einheitsNormale(f).negate();
    const y = new THREE.Vector3().crossVectors(z, x);
    return new THREE.Matrix4().makeBasis(x, y, z).setPosition(ort ?? this.mitte(f));
  }
  breiteHoehe(f: Flaeche): [number, number] {
    if (f.v.length < 4) return [-1, -1];
    return [this.p[f.v[0]].distanceTo(this.p[f.v[1]]), this.p[f.v[2]].distanceTo(this.p[f.v[1]])];
  }
  seitenverhaeltnis(f: Flaeche) {
    const a = this.p[f.v[0]].distanceTo(this.p[f.v[1]]);
    const b = this.p[f.v[1]].distanceTo(this.p[f.v[2]]);
    const q = Math.max(0.01, a / Math.max(b, 1e-9));
    return q < 1 ? 1 / q : q;
  }

  /** Fläche einzeln herausziehen; die Seitenwände landen optional in `seiten`. */
  ziehe(f: Flaeche, weit: number, seiten?: Flaeche[]): Flaeche {
    const n = this.einheitsNormale(f);
    f.tot = true;
    const neu = f.v.map(i => this.punkt(this.p[i].clone()));
    for (let i = 0; i < f.v.length; i++) {
      const j = (i + 1) % f.v.length;
      const s = this.flaeche([f.v[i], f.v[j], neu[j], neu[i]], f.mat);
      seiten?.push(s);
    }
    for (const i of neu) this.p[i].addScaledVector(n, weit);
    return this.flaeche(neu, f.mat);
  }
  skaliere(f: Flaeche, sx: number, sy: number, sz: number) {
    const m = this.matrix(f);
    const inv = m.clone().invert();
    for (const i of f.v) {
      const q = this.p[i].applyMatrix4(inv);
      q.set(q.x * sx, q.y * sy, q.z * sz).applyMatrix4(m);
    }
  }
  /** Viereck in ein (schnitte+1)²-Gitter zerlegen. */
  unterteile(f: Flaeche, schnitte: number): Flaeche[] {
    if (f.v.length !== 4) return [];
    f.tot = true;
    const [p0, p1, p2, p3] = f.v.map(i => this.p[i]);
    const k = schnitte + 1;
    const g: number[][] = [];
    for (let i = 0; i <= k; i++) {
      g.push([]);
      for (let j = 0; j <= k; j++) {
        const oben = p0.clone().lerp(p1, i / k), unten = p3.clone().lerp(p2, i / k);
        g[i].push(this.punkt(oben.lerp(unten, j / k)));
      }
    }
    const zellen: Flaeche[] = [];
    for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) {
      zellen.push(this.flaeche([g[i][j], g[i + 1][j], g[i + 1][j + 1], g[i][j + 1]], f.mat));
    }
    return zellen;
  }
  /** Kegelstumpf entlang der lokalen z-Achse (wie bmesh create_cone, Radien statt »diameter«). */
  kegel(m: THREE.Matrix4, segmente: number, r1: number, r2: number, tiefe: number, deckel: boolean, mat = HUELLE) {
    const n = Math.max(3, Math.floor(segmente));
    const unten: number[] = [], oben: number[] = [];
    for (let i = 0; i < n; i++) {
      const w = (i / n) * Math.PI * 2;
      unten.push(this.punkt(new THREE.Vector3(r1 * Math.cos(w), r1 * Math.sin(w), -tiefe / 2).applyMatrix4(m)));
      oben.push(this.punkt(new THREE.Vector3(r2 * Math.cos(w), r2 * Math.sin(w), tiefe / 2).applyMatrix4(m)));
    }
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      this.flaeche([unten[i], unten[j], oben[j], oben[i]], mat);
    }
    if (deckel) {
      this.flaeche([...unten].reverse(), mat);
      this.flaeche(oben, mat);
    }
  }
  kugel(m: THREE.Matrix4, radius: number, mat = HUELLE) {
    const pos = new THREE.IcosahedronGeometry(radius, 3).getAttribute("position");
    for (let i = 0; i < pos.count; i += 3) {
      const ecken = [0, 1, 2].map(k => this.punkt(new THREE.Vector3().fromBufferAttribute(pos, i + k).applyMatrix4(m)));
      this.flaeche(ecken, mat);
    }
  }
  /** Gitterpunkte auf einem Viereck, wie die h/v-Schleifen im Original. */
  raster(f: Flaeche, h: number, v: number, je: (ort: THREE.Vector3) => void) {
    const [p0, p1, p2, p3] = f.v.map(i => this.p[i]);
    for (let a = 0; a < h; a++) {
      const oben = p0.clone().lerp(p1, (a + 1) / (h + 1));
      const unten = p3.clone().lerp(p2, (a + 1) / (h + 1));
      for (let b = 0; b < v; b++) je(oben.clone().lerp(unten, (b + 1) / (v + 1)));
    }
  }
}

const istHinten = (n: THREE.Vector3) => n.x < -0.95;
const drehX = (grad: number) => new THREE.Matrix4().makeRotationX(THREE.MathUtils.degToRad(grad));
const drehY = (grad: number) => new THREE.Matrix4().makeRotationY(THREE.MathUtils.degToRad(grad));
const drehZ = (grad: number) => new THREE.Matrix4().makeRotationZ(THREE.MathUtils.degToRad(grad));
const schiebe = (x: number, y: number, z: number) => new THREE.Matrix4().makeTranslation(x, y, z);
const mal = (...ms: THREE.Matrix4[]) => ms.reduce((a, b) => a.clone().multiply(b));

function geripptZiehen(b: Bau, f: Flaeche, weit: number, rippen: number, s: number) {
  const je = weit / rippen;
  for (let i = 0; i < rippen; i++) {
    f = b.ziehe(f, je * 0.25);
    f = b.ziehe(f, 0); b.skaliere(f, s, s, s);
    f = b.ziehe(f, je * 0.5);
    f = b.ziehe(f, 0); b.skaliere(f, 1 / s, 1 / s, 1 / s);
    f = b.ziehe(f, je * 0.25);
  }
  return f;
}

function triebwerk(b: Bau, f: Flaeche) {
  const zellen = b.unterteile(f, b.ganz(1, Math.floor(4 - b.seitenverhaeltnis(f))));
  const laenge = b.u(0.1, 0.2);
  const aussen = 1 / b.u(1.3, 1.6), innen = 1 / b.u(1.05, 1.1);
  for (let z of zellen) {
    if (!istHinten(b.einheitsNormale(z))) continue;
    z.mat = DUNKEL;
    z = b.ziehe(z, laenge);
    b.skaliere(z, aussen, aussen, aussen);
    const seiten: Flaeche[] = [];
    z = b.ziehe(z, -laenge * 0.9, seiten);
    for (const s of seiten) s.mat = GLUT;
    b.skaliere(z, innen, innen, innen);
  }
}

function gitter(b: Bau, f: Flaeche) {
  const zellen = b.unterteile(f, b.ganz(2, 4));
  const laenge = b.u(0.025, 0.15);
  for (let z of zellen) {
    const mat = b.r() > 0.5 ? LICHTER : HUELLE;
    const seiten: Flaeche[] = [];
    z = b.ziehe(z, laenge, seiten);
    if (Math.abs(b.einheitsNormale(z).z) < 0.707) for (const s of seiten) s.mat = mat;
    b.skaliere(z, 0.8, 0.8, 0.8);
  }
}

function zylinder(b: Bau, f: Flaeche) {
  if (f.v.length < 4) return;
  const h = b.ganz(1, 3), v = b.ganz(1, 3), seg = b.ganz(6, 12);
  const [w, hh] = b.breiteHoehe(f);
  const tiefe = 1.3 * Math.min(w / (h + 2), hh / (v + 2));
  b.raster(f, h, v, ort => b.kegel(mal(b.matrix(f, ort), drehX(90)), seg, tiefe * 0.5, tiefe * 0.5, tiefe, true));
}

function geschuetze(b: Bau, f: Flaeche) {
  if (f.v.length < 4) return;
  const h = b.ganz(1, 2), v = b.ganz(1, 2);
  const [w, hh] = b.breiteHoehe(f);
  const g = 0.5 * Math.min(w / (h + 2), hh / (v + 2));
  const t = g * 0.2;
  const n = b.einheitsNormale(f);
  b.raster(f, h, v, ort => {
    const fm = mal(b.matrix(f, ort.clone().addScaledVector(n, t * 0.5)), drehZ(b.u(0, 90)));
    b.kegel(fm, 16, g * 0.9, g, t, true);                                      // Sockel
    b.kegel(mal(fm, drehY(90), schiebe(0, 0, g * 0.6)), 16, g * 0.6, g * 0.5, t * 2, true);  // Schutz links
    b.kegel(mal(fm, drehY(90), schiebe(0, 0, -g * 0.6)), 16, g * 0.5, g * 0.6, t * 2, true); // Schutz rechts
    const haus = mal(fm, drehX(b.u(0, 45)), schiebe(0, -g * 0.4, 0));
    b.kegel(haus, 8, g * 0.4, g * 0.4, t * 5, true);
    b.kegel(mal(haus, schiebe(g * 0.2, 0, -g)), 8, g * 0.1, g * 0.1, t * 6, true);           // Rohre
    b.kegel(mal(haus, schiebe(-g * 0.2, 0, -g)), 8, g * 0.1, g * 0.1, t * 6, true);
  });
}

function kugel(b: Bau, f: Flaeche) {
  const [w, h] = b.breiteHoehe(f);
  if (w < 0) return;
  const groesse = b.u(0.4, 1) * Math.min(w, h);
  const n = b.einheitsNormale(f);
  b.kugel(b.matrix(f, b.mitte(f).addScaledVector(n, -b.u(0, groesse * 0.5))), groesse);
}

function antennen(b: Bau, f: Flaeche) {
  if (f.v.length < 4) return;
  const n = b.einheitsNormale(f);
  const seite = Math.sqrt(b.flaecheninhalt(f));
  b.raster(f, b.ganz(4, 10), b.ganz(4, 10), ort => {
    if (b.r() <= 0.9) return;
    const tiefe = b.u(0.1, 1.5) * seite;
    const kurz = tiefe * b.u(0.02, 0.15);
    const fuss = b.u(0.005, 0.05);
    const mat = b.r() > 0.5 ? HUELLE : DUNKEL;
    const seg = b.u(3, 6);
    b.kegel(b.matrix(f, ort.clone().addScaledVector(n, tiefe * 0.5)), seg, 0, fuss, tiefe, false, mat);
    b.kegel(b.matrix(f, ort.clone().addScaledVector(n, kurz * 0.45)), seg, fuss * b.u(1, 1.5), fuss * b.u(1.5, 2), kurz, true, mat);
  });
}

function landescheibe(b: Bau, f: Flaeche) {
  const [w, h] = b.breiteHoehe(f);
  if (w < 0) return;
  const t = 0.125 * Math.min(w, h);
  const n = b.einheitsNormale(f);
  const mitte = b.mitte(f);
  b.kegel(b.matrix(f, mitte.clone().addScaledVector(n, t * 0.5)), 32, t * 3, t * 4, t, true);
  b.kegel(b.matrix(f, mitte.clone().addScaledVector(n, t * 1.05)), 32, t * 1.25, t * 2.25, 0, false, SCHEIBE);
}

/** Spiegelt die +y-Hälfte auf −y (statt bmesh symmetrize ohne echtes Zerschneiden). */
function spiegeln(b: Bau) {
  const eps = 1e-4;
  for (const f of b.lebende()) {
    const y = b.mitte(f).y;
    if (y < -eps) { f.tot = true; continue; }
    if (y <= eps) continue;
    const kopie = f.v.map(i => { const q = b.p[i].clone(); q.y = -q.y; return b.punkt(q); });
    b.flaeche(kopie.reverse(), f.mat);
  }
}

export interface Rumpf {
  /** Dreiecke, je 3 Ecken × xyz, schon nach Material sortiert. Three.js-Achsen: vorne = −z, oben = +y. */
  positionen: Float32Array;
  /** je Material: ab welcher Ecke und wie viele */
  gruppen: { start: number; anzahl: number; mat: number }[];
  /** Farbtöne aus demselben Seed (0..1): Rumpf und Glühen */
  rumpfFarbe: [number, number, number];
  glutFarbe: [number, number, number];
}

/** Baut die Geometrie eines Schiffs. Größte Ausdehnung = 1, Mitte im Ursprung. */
export function erzeugeRumpf(seed: string): Rumpf {
  const b = new Bau(zufallAus(seed));

  // 1. Würfel, zufällig gestreckt
  const s = new THREE.Vector3(b.u(0.75, 2), b.u(0.75, 2), b.u(0.75, 2));
  for (let i = 0; i < 8; i++) {
    b.punkt(new THREE.Vector3(((i & 1) - 0.5) * s.x, (((i >> 1) & 1) - 0.5) * s.y, (((i >> 2) & 1) - 0.5) * s.z));
  }
  for (const v of [[0, 4, 6, 2], [1, 3, 7, 5], [0, 1, 5, 4], [2, 6, 7, 3], [0, 2, 3, 1], [4, 5, 7, 6]]) b.flaeche(v, HUELLE);

  // 2. Rumpfabschnitte nach vorn und hinten
  for (let f of b.lebende()) {
    if (Math.abs(b.einheitsNormale(f).x) <= 0.5) continue;
    const laenge = b.u(0.3, 1);
    const anzahl = b.ganz(3, 5);
    for (let i = 0; i < anzahl; i++) {
      const letzter = i === anzahl - 1;
      if (b.r() > 0.1) {
        f = b.ziehe(f, laenge);
        if (b.r() > 0.75) f = b.ziehe(f, laenge * 0.25);
        if (b.r() > 0.5) {
          let sy = b.u(1.2, 1.5), sz = b.u(1.2, 1.5);
          if (letzter || b.r() > 0.5) { sy = 1 / sy; sz = 1 / sz; }
          b.skaliere(f, 1, sy, sz);
        }
        if (b.r() > 0.5) {
          const dz = b.u(0.1, 0.4) * s.z * laenge * (b.r() > 0.5 ? -1 : 1);
          for (const i of f.v) b.p[i].z += dz;
        }
        if (b.r() > 0.5) {
          const dreh = drehY(b.r() > 0.5 ? -5 : 5);
          for (const i of f.v) b.p[i].applyMatrix4(dreh);
        }
      } else {
        f = geripptZiehen(b, f, laenge, b.ganz(2, 4), b.u(0.75, 0.95));
      }
    }
  }

  // 3. schiefe Auswüchse
  for (let f of b.lebende()) {
    if (b.seitenverhaeltnis(f) > 4) continue;
    if (b.r() <= 0.85) continue;
    const laenge = b.u(0.1, 0.4);
    for (let i = b.ganz(1, 4); i > 0; i--) {
      f = b.ziehe(f, laenge);
      if (b.r() > 0.25) { const k = 1 / b.u(1.1, 1.5); b.skaliere(f, k, k, k); }
    }
  }

  // 4. Flächen nach Lage einsortieren und verzieren
  const liste: Record<"triebwerk" | "gitter" | "antenne" | "waffe" | "kugel" | "scheibe" | "zylinder", Flaeche[]> =
    { triebwerk: [], gitter: [], antenne: [], waffe: [], kugel: [], scheibe: [], zylinder: [] };
  for (const f of b.lebende()) {
    if (b.seitenverhaeltnis(f) > 3) continue;
    const n = b.einheitsNormale(f);
    const nachAussen = n.dot(b.mitte(f)) > 0;
    const w = b.r();
    if (istHinten(n)) {
      if (!liste.triebwerk.length || w > 0.75) liste.triebwerk.push(f);
      else if (w > 0.5) liste.zylinder.push(f);
      else if (w > 0.25) liste.gitter.push(f);
      else f.mat = LICHTER;
    } else if (n.x > 0.9) {
      if (nachAussen && w > 0.7) { liste.antenne.push(f); f.mat = LICHTER; }
      else if (w > 0.4) liste.gitter.push(f);
      else f.mat = LICHTER;
    } else if (n.z > 0.9) {
      if (nachAussen && w > 0.7) liste.antenne.push(f);
      else if (w > 0.6) liste.gitter.push(f);
      else if (w > 0.3) liste.zylinder.push(f);
    } else if (n.z < -0.9) {
      if (w > 0.75) liste.scheibe.push(f);
      else if (w > 0.5) liste.gitter.push(f);
      else if (w > 0.25) liste.waffe.push(f);
    } else if (Math.abs(n.y) > 0.9) {
      if (!liste.waffe.length || w > 0.75) liste.waffe.push(f);
      else if (w > 0.6) liste.gitter.push(f);
      else if (w > 0.4) liste.kugel.push(f);
      else f.mat = LICHTER;
    }
  }
  liste.triebwerk.forEach(f => triebwerk(b, f));
  liste.gitter.forEach(f => gitter(b, f));
  liste.antenne.forEach(f => antennen(b, f));
  liste.waffe.forEach(f => geschuetze(b, f));
  liste.kugel.forEach(f => kugel(b, f));
  liste.scheibe.forEach(f => landescheibe(b, f));
  liste.zylinder.forEach(f => zylinder(b, f));

  // 5. oft spiegelsymmetrisch
  if (b.r() > 0.5) spiegeln(b);

  const rumpfFarbe: [number, number, number] = [b.r(), b.u(0, 0.25), b.u(0.3, 0.6)];
  const glutFarbe: [number, number, number] = [b.r(), 1, b.u(0.5, 0.7)];

  // Blender-Achsen (vorne +x, oben +z) → three.js (vorne −z, oben +y)
  const umrechnen = (q: THREE.Vector3) => new THREE.Vector3(-q.y, q.z, -q.x);
  const box = new THREE.Box3();
  const lebend = b.lebende().sort((x, y) => x.mat - y.mat);
  const dreiecke: number[] = [];
  const gruppen: Rumpf["gruppen"] = [];
  for (const f of lebend) {
    const ecken = f.v.map(i => umrechnen(b.p[i]));
    const vorher = dreiecke.length / 3;
    for (let i = 1; i < ecken.length - 1; i++) {
      for (const e of [ecken[0], ecken[i], ecken[i + 1]]) { dreiecke.push(e.x, e.y, e.z); box.expandByPoint(e); }
    }
    const neu = dreiecke.length / 3 - vorher;
    const letzte = gruppen[gruppen.length - 1];
    if (letzte?.mat === f.mat) letzte.anzahl += neu;
    else gruppen.push({ start: vorher, anzahl: neu, mat: f.mat });
  }
  const mitte = box.getCenter(new THREE.Vector3());
  const k = 1 / Math.max(...box.getSize(new THREE.Vector3()).toArray());
  const positionen = new Float32Array(dreiecke.length);
  for (let i = 0; i < dreiecke.length; i += 3) {
    positionen[i] = (dreiecke[i] - mitte.x) * k;
    positionen[i + 1] = (dreiecke[i + 1] - mitte.y) * k;
    positionen[i + 2] = (dreiecke[i + 2] - mitte.z) * k;
  }
  return { positionen, gruppen, rumpfFarbe, glutFarbe };
}

/** Würfelprojektion: jede Fläche bekommt die Koordinaten der Ebene, in die sie am meisten schaut. */
function wuerfelUV(geo: THREE.BufferGeometry, wiederholung: number) {
  const pos = geo.getAttribute("position"), nor = geo.getAttribute("normal");
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i)), nz = Math.abs(nor.getZ(i));
    const [a, c] = nx >= ny && nx >= nz ? [pos.getZ(i), pos.getY(i)] : ny >= nz ? [pos.getX(i), pos.getZ(i)] : [pos.getX(i), pos.getY(i)];
    uv[i * 2] = a * wiederholung;
    uv[i * 2 + 1] = c * wiederholung;
  }
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
}

let texturen: { platten: THREE.Texture; fenster: THREE.Texture } | null = null;

/** Rumpfplatten und Fensterreihen als Leinwand-Texturen (statt der PNGs aus dem Original). */
function holeTexturen() {
  if (texturen) return texturen;
  const leinwand = () => { const c = document.createElement("canvas"); c.width = c.height = 256; return c; };
  const platten = leinwand(), fenster = leinwand();
  const gp = platten.getContext("2d")!, gf = fenster.getContext("2d")!;
  gp.fillStyle = "#b8b8b8"; gp.fillRect(0, 0, 256, 256);
  gf.fillStyle = "#000"; gf.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 60; i++) {
    const x = Math.floor(Math.random() * 16) * 16, y = Math.floor(Math.random() * 16) * 16;
    const w = 16 * (1 + Math.floor(Math.random() * 4)), h = 16 * (1 + Math.floor(Math.random() * 3));
    const hell = 150 + Math.floor(Math.random() * 90);
    gp.fillStyle = `rgb(${hell},${hell},${hell})`;
    gp.fillRect(x, y, w, h);
  }
  gp.strokeStyle = "rgba(0,0,0,0.35)"; gp.lineWidth = 1;
  for (let i = 0; i <= 256; i += 32) { gp.beginPath(); gp.moveTo(i + 0.5, 0); gp.lineTo(i + 0.5, 256); gp.moveTo(0, i + 0.5); gp.lineTo(256, i + 0.5); gp.stroke(); }
  for (let reihe = 4; reihe < 256; reihe += 16) {
    for (let x = 2; x < 256; x += 8) {
      if (Math.random() < 0.55) continue;
      gf.fillStyle = Math.random() < 0.8 ? "#ffe7b0" : "#a8d8ff";
      gf.fillRect(x, reihe, 5, 4);
    }
  }
  const zuTextur = (c: HTMLCanvasElement) => {
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  texturen = { platten: zuTextur(platten), fenster: zuTextur(fenster) };
  return texturen;
}

/**
 * Ein fertiges Schiff: Länge (größte Ausdehnung) = `laenge`, Bug zeigt nach −z.
 * userData.huelle ist das Rumpfmaterial (zum Aufglühen beim Verglühen).
 */
export function baueRaumschiff(seed: string, laenge = 1): THREE.Group {
  const r = erzeugeRumpf(seed);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(r.positionen, 3));
  for (const g of r.gruppen) geo.addGroup(g.start, g.anzahl, g.mat);
  geo.computeVertexNormals();
  wuerfelUV(geo, 6);

  const tx = holeTexturen();
  const farbe = new THREE.Color().setHSL(...r.rumpfFarbe);
  const glut = new THREE.Color().setHSL(...r.glutFarbe);
  const rumpf = (c: THREE.Color) => new THREE.MeshStandardMaterial({ color: c, map: tx.platten, metalness: 0.5, roughness: 0.55, flatShading: true });
  const huelle = rumpf(farbe);
  const lichter = rumpf(farbe);
  lichter.emissiveMap = tx.fenster;
  lichter.emissive.setRGB(1, 1, 1);
  const materialien = [
    huelle,
    lichter,
    rumpf(farbe.clone().multiplyScalar(0.3)),
    new THREE.MeshBasicMaterial({ color: glut, side: THREE.DoubleSide }),
    new THREE.MeshBasicMaterial({ color: glut, side: THREE.DoubleSide }),
  ];
  const mesh = new THREE.Mesh(geo, materialien);
  mesh.scale.setScalar(laenge);
  const g = new THREE.Group();
  g.add(mesh);
  g.userData.huelle = huelle;
  g.userData.glut = glut;
  return g;
}
