/**
 * Die Welten der freien 3D-Ansicht — drei Kachelsätze auf derselben Karte:
 *
 *   gebaeude  Mauern, Türstürze, Lampen, Topfpflanzen (in den Farben aller Baustile)
 *   hoehle    Felsbrocken, Säulen, leuchtende Kristalle, Fackellicht
 *   wald      hohe Stämme mit Kronen, Büsche als Rand, Gras, Lichtung je Station
 *
 * `baueLandschaft` baut alles, was sich nicht ändert (einmal je Abschnitt),
 * `baueOrte` die Stationen, das Tor und den Rückweg (neu bei jedem Fortschritt).
 * Ohne React.
 */
import * as THREE from "three";
import { DURCHGANG, PLATZ, WAND, WEG, ZELLE, feldMitte, istFrei, type FreiEbene, type FreiOrt } from "@/lib/gebaeude/frei";
import type { Objekt } from "@/lib/gebaeude/objekte";
import { baueObjekt } from "../objekte3d";
import { felsGeometrie, musterMaterial, textur, zufallAus } from "../stoff";
import { AUSSEHEN, STILE, type RaumZustand, type Stil } from "../szene";

export type Welt = "gebaeude" | "hoehle" | "wald";

/** Welcher Kachelsatz zu welchem Baustil gehört */
export function weltVon(stil: Stil): Welt {
  return stil === "wald" ? "wald" : AUSSEHEN[stil].organisch ? "hoehle" : "gebaeude";
}

export interface Stimmung {
  himmelOben: number; himmelUnten: number;
  nebel: number; dichte: number;
  sonne: number; sonneStaerke: number; sonneVon: [number, number, number];
  /** Himmelslicht: Farbe von oben, Farbe von unten, Stärke */
  oben: number; unten: number; umgebung: number;
  /** Fackel über der Figur (0 = aus) */
  fackel: number;
  belichtung: number;
}

export interface Landschaft {
  gruppe: THREE.Group;
  stimmung: Stimmung;
  /** bis zu dieser Höhe versperren Wände der Kamera die Sicht (0 = gar nicht) */
  wandHoehe: number;
}

const farbe = (hex: number) => new THREE.Color(hex);
const css = (hex: number) => `#${hex.toString(16).padStart(6, "0")}`;
const aus = <T,>(liste: T[], r: () => number) => liste[Math.floor(r() * liste.length)];

interface Stueck { p: THREE.Vector3; s: THREE.Vector3; q?: THREE.Quaternion; f?: THREE.Color }

/** Viele gleiche Körper als eine InstancedMesh */
function reihe(geo: THREE.BufferGeometry, mat: THREE.Material, stuecke: Stueck[], schatten = true): THREE.InstancedMesh {
  const m = new THREE.InstancedMesh(geo, mat, Math.max(1, stuecke.length));
  m.count = stuecke.length;
  const mx = new THREE.Matrix4(), q0 = new THREE.Quaternion();
  stuecke.forEach((t, i) => {
    mx.compose(t.p, t.q ?? q0, t.s);
    m.setMatrixAt(i, mx);
    if (t.f) m.setColorAt(i, t.f);
  });
  m.castShadow = schatten;
  m.receiveShadow = true;
  // die Teile liegen über die ganze Karte verstreut
  m.frustumCulled = false;
  return m;
}

const wuerfel = new THREE.BoxGeometry(1, 1, 1);
wuerfel.userData.geteilt = true;

let stamm: THREE.BufferGeometry | null = null;
/** Baumstamm: unten breiter, leicht krumm, Fuß bei y = 0, Höhe 1 */
function stammGeometrie(): THREE.BufferGeometry {
  if (stamm) return stamm;
  const g = new THREE.CylinderGeometry(0.62, 1, 1, 7, 5);
  g.translate(0, 0.5, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    p.setX(i, p.getX(i) + Math.sin(y * 5.1) * 0.12);
    p.setZ(i, p.getZ(i) + Math.cos(y * 3.7) * 0.12);
  }
  g.computeVertexNormals();
  g.userData.geteilt = true;
  stamm = g;
  return g;
}

let bueschel: THREE.BufferGeometry | null = null;
/** Grasbüschel: elf Halme, die auseinanderfallen */
function bueschelGeometrie(): THREE.BufferGeometry {
  if (bueschel) return bueschel;
  const r = zufallAus(5);
  const ecken: number[] = [], normalen: number[] = [];
  for (let k = 0; k < 11; k++) {
    const a = r() * Math.PI * 2, weit = 0.08 + r() * 0.3, h = 0.2 + r() * 0.34, b = 0.035 + r() * 0.03;
    const fx = Math.cos(a) * 0.1, fz = Math.sin(a) * 0.1, qx = -Math.sin(a) * b, qz = Math.cos(a) * b;
    const s = [fx - qx, 0, fz - qz, fx + qx, 0, fz + qz, Math.cos(a) * weit, h, Math.sin(a) * weit];
    // von beiden Seiten zu sehen (zweites Dreieck andersherum) und hell wie der Boden: Normale nach oben
    ecken.push(...s, s[3], s[4], s[5], s[0], s[1], s[2], s[6], s[7], s[8]);
    for (let n = 0; n < 6; n++) normalen.push(0, 1, 0);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(ecken, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(normalen, 3));
  g.userData.geteilt = true;
  bueschel = g;
  return g;
}

/** Himmel: große Kugel mit Farbverlauf vom Horizont nach oben */
function himmel(oben: number, unten: number): THREE.Mesh {
  const g = new THREE.SphereGeometry(420, 24, 12);
  const p = g.attributes.position, farben: number[] = [];
  const o = farbe(oben), u = farbe(unten), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    c.copy(u).lerp(o, Math.min(1, Math.max(0, p.getY(i) / 420) * 2.2));
    farben.push(c.r, c.g, c.b);
  }
  g.setAttribute("color", new THREE.Float32BufferAttribute(farben, 3));
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  m.renderOrder = -1;
  return m;
}

/**
 * Wie tief steckt ein Feld in der Wand? 0 = frei, 1 = Wand am Weg, 2 = dahinter …
 * Das Raster bekommt ringsum `rand` Felder dazu (der Wald geht hinter der Karte weiter).
 */
function tiefen(e: FreiEbene, rand: number, max = 7): { t: Uint8Array; B: number } {
  const B = e.b + 2 * rand;
  const t = new Uint8Array(B * B).fill(max);
  const schlange: number[] = [];
  for (let y = 0; y < e.h; y++) for (let x = 0; x < e.b; x++) {
    if (e.art[y * e.b + x] !== WAND) { const i = (y + rand) * B + x + rand; t[i] = 0; schlange.push(i); }
  }
  for (let k = 0; k < schlange.length; k++) {
    const i = schlange[k], x = i % B, y = (i - x) / B;
    if (t[i] >= max - 1) continue;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= B || ny >= B) continue;
      const j = ny * B + nx;
      if (t[j] > t[i] + 1) { t[j] = t[i] + 1; schlange.push(j); }
    }
  }
  return { t, B };
}

/** Feld ohne Wand in der Nachbarschaft: ein einzelner Baum bzw. eine Säule mitten im Weg */
function allein(e: FreiEbene, x: number, y: number): boolean {
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if ((dx || dy) && !istFrei(e, x + dx, y + dy)) return false;
  }
  return true;
}

/** Der Boden als gemaltes Bild: `male` setzt die Pinselstriche */
function boden(e: FreiEbene, male: (ctx: CanvasRenderingContext2D, px: number) => void, grund: number): THREE.Mesh {
  const px = Math.max(8, Math.min(20, Math.floor(2048 / e.b)));
  const c = typeof document !== "undefined" ? document.createElement("canvas") : null;
  const ctx = c?.getContext("2d");
  const mat = new THREE.MeshLambertMaterial({ color: ctx ? 0xffffff : grund });
  if (c && ctx) {
    c.width = e.b * px; c.height = e.h * px;
    ctx.fillStyle = css(grund);
    ctx.fillRect(0, 0, c.width, c.height);
    male(ctx, px);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    mat.map = tex;
  }
  const g = new THREE.PlaneGeometry(e.b * ZELLE, e.h * ZELLE);
  g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, mat);
  m.position.set((e.b * ZELLE) / 2, 0, (e.h * ZELLE) / 2);
  m.receiveShadow = true;
  m.userData.boden = true;
  return m;
}

/** Ein Pinselstrich: flache, schräge Ellipse */
function strich(ctx: CanvasRenderingContext2D, x: number, y: number, lang: number, breit: number, winkel: number, f: string, deckung = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(winkel);
  ctx.globalAlpha = deckung;
  ctx.fillStyle = f;
  ctx.beginPath();
  ctx.ellipse(0, 0, lang, breit, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Je Feld einige Striche in Farben, die `wahl` für das Feld nennt */
function striche(ctx: CanvasRenderingContext2D, e: FreiEbene, px: number, r: () => number, anzahl: number, wahl: (art: number, x: number, y: number) => number[] | null, deckung = 0.85) {
  for (let y = 0; y < e.h; y++) for (let x = 0; x < e.b; x++) {
    const farben = wahl(e.art[y * e.b + x], x, y);
    if (!farben) continue;
    for (let k = 0; k < anzahl; k++) {
      strich(ctx, (x + r() * 1.4 - 0.2) * px, (y + r() * 1.4 - 0.2) * px, px * (0.45 + r() * 0.5), px * (0.16 + r() * 0.2),
        (r() - 0.5) * 1.1, css(aus(farben, r)), deckung);
    }
  }
}

/** Ebene in einer Farbe weit um die Karte herum (bis zum Nebel) */
function umland(e: FreiEbene, f: number): THREE.Mesh {
  const g = new THREE.PlaneGeometry(900, 900);
  g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: f }));
  m.position.set((e.b * ZELLE) / 2, -0.03, (e.h * ZELLE) / 2);
  return m;
}

// ── Wald ─────────────────────────────────────────────────────────────────

const WALD = {
  schatten: [0x3f4a1f, 0x4d5a26, 0x5a4a22, 0x6b5a2a, 0x46522a],
  wiese: [0x8a8f2e, 0xa39a34, 0xb7a23c, 0x7d8a2c, 0xc2a64a, 0x96a238],
  pfad: [0x9a7646, 0xa9834f, 0x8c6a3d, 0xb8935a],
  lichtung: [0xa8b03a, 0xc0b848, 0x93a836, 0xd1c05a],
  blueten: [0xfff3c4, 0xffd24a, 0xf2a0c0, 0xffffff],
  stamm: [0x6b4a32, 0x7a5638, 0x5a4034, 0x80624a, 0x6a5148],
  krone: [0x6b8e23, 0x8a9a2b, 0xc9a227, 0xd98a1f, 0xb5541b, 0x4f7a28, 0xe0b53a, 0x7da033],
  busch: [0x4f7a28, 0x6b8e23, 0x8a9a2b, 0x3f6a2a, 0xa8a030],
  gras: [0x9aa83e, 0x86a034, 0xb3ac48, 0x76942f, 0xc09f40],
};

function waldLandschaft(e: FreiEbene, seed: number): Landschaft {
  const g = new THREE.Group();
  const r = zufallAus(seed * 7 + 3);
  g.add(himmel(0x86b4e6, 0xf2ddb0));
  g.add(umland(e, 0x4d5a26));
  g.add(boden(e, (ctx, px) => {
    striche(ctx, e, px, r, 6, a => (a === WAND ? WALD.schatten : a === PLATZ ? WALD.lichtung : WALD.wiese));
    // ausgetretener Pfad: wo ringsum alles frei ist
    striche(ctx, e, px, r, 3, (a, x, y) => (a === WEG && allein(e, x, y) ? WALD.pfad : null), 0.55);
    // Blüten auf den Lichtungen
    for (let y = 0; y < e.h; y++) for (let x = 0; x < e.b; x++) {
      if (e.art[y * e.b + x] !== PLATZ) continue;
      for (let k = 0; k < 2; k++) {
        ctx.fillStyle = css(aus(WALD.blueten, r));
        ctx.beginPath();
        ctx.arc((x + r()) * px, (y + r()) * px, px * (0.05 + r() * 0.05), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, 0x5d6b2a));

  const RAND = 7;
  const { t, B } = tiefen(e, RAND);
  const staemme: Stueck[] = [], kronen: Stueck[] = [], buesche: Stueck[] = [], graeser: Stueck[] = [], steine: Stueck[] = [];
  const hoch = new THREE.Vector3(0, 1, 0);
  const dreh = () => new THREE.Quaternion().setFromAxisAngle(hoch, r() * Math.PI * 2);
  for (let Y = 0; Y < B; Y++) for (let X = 0; X < B; X++) {
    const tiefe = t[Y * B + X], x = X - RAND, y = Y - RAND;
    const wx = feldMitte(x), wz = feldMitte(y);
    if (tiefe === 0) {
      if (e.art[y * e.b + x] !== DURCHGANG && r() < 0.3) {
        graeser.push({ p: new THREE.Vector3(wx + (r() - 0.5) * ZELLE, 0, wz + (r() - 0.5) * ZELLE), s: new THREE.Vector3().setScalar(0.8 + r() * 0.9), q: dreh(), f: farbe(aus(WALD.gras, r)) });
      }
      continue;
    }
    const einzeln = tiefe === 1 && allein(e, x, y);
    // am Weg dicht, dahinter lichter, weit hinten nur noch einzelne Stämme
    if (r() < (tiefe === 1 ? 0.9 : tiefe <= 3 ? 0.6 : 0.3)) {
      const h = 6.5 + r() * 4.5, dick = 0.2 + r() * 0.17;
      const sx = wx + (r() - 0.5) * 0.5, sz = wz + (r() - 0.5) * 0.5;
      const neigung = new THREE.Quaternion().setFromEuler(new THREE.Euler((r() - 0.5) * 0.12, r() * 6.3, (r() - 0.5) * 0.12));
      staemme.push({ p: new THREE.Vector3(sx, -0.1, sz), s: new THREE.Vector3(dick, h, dick), q: neigung, f: farbe(aus(WALD.stamm, r)).multiplyScalar(0.85 + r() * 0.3) });
      const blaetter = tiefe <= 3 ? 3 : 2;
      for (let k = 0; k < blaetter; k++) {
        const breit = 2.2 + r() * 1.6;
        kronen.push({
          p: new THREE.Vector3(sx + (r() - 0.5) * 1.8, h * (0.82 + r() * 0.22), sz + (r() - 0.5) * 1.8),
          s: new THREE.Vector3(breit, 1.3 + r() * 0.9, breit), q: dreh(), f: farbe(aus(WALD.krone, r)).multiplyScalar(0.9 + r() * 0.25),
        });
      }
    }
    if (tiefe <= 2 && r() < (einzeln ? 1 : 0.75)) {
      const breit = einzeln ? 0.9 : 1.2 + r() * 0.6;
      buesche.push({ p: new THREE.Vector3(wx + (r() - 0.5) * 0.4, 0.3, wz + (r() - 0.5) * 0.4), s: new THREE.Vector3(breit, 0.7 + r() * 0.5, breit), q: dreh(), f: farbe(aus(WALD.busch, r)).multiplyScalar(0.85 + r() * 0.3) });
    }
    if (tiefe <= 3) for (let k = 0; k < 2; k++) {
      graeser.push({ p: new THREE.Vector3(wx + (r() - 0.5) * ZELLE, 0, wz + (r() - 0.5) * ZELLE), s: new THREE.Vector3().setScalar(1 + r() * 1.2), q: dreh(), f: farbe(aus(WALD.gras, r)).multiplyScalar(0.75 + r() * 0.3) });
    }
    if (tiefe === 1 && !einzeln && r() < 0.12) {
      const gross = 0.5 + r() * 0.5;
      steine.push({ p: new THREE.Vector3(wx, 0.1, wz), s: new THREE.Vector3(gross * 1.3, gross * 0.8, gross), q: dreh(), f: farbe(0x8f8a82).multiplyScalar(0.8 + r() * 0.3) });
    }
  }
  const weiss = () => new THREE.MeshLambertMaterial({ color: 0xffffff });
  g.add(reihe(stammGeometrie(), weiss(), staemme));
  g.add(reihe(felsGeometrie(), weiss(), kronen));
  g.add(reihe(felsGeometrie(), weiss(), buesche));
  g.add(reihe(felsGeometrie(), weiss(), steine));
  g.add(reihe(bueschelGeometrie(), weiss(), graeser, false));
  return {
    gruppe: g, wandHoehe: 0,
    stimmung: {
      himmelOben: 0x86b4e6, himmelUnten: 0xf2ddb0, nebel: 0xe9d6ac, dichte: 0.017,
      sonne: 0xffc98f, sonneStaerke: 3.4, sonneVon: [-0.62, 0.58, -0.4],
      oben: 0xb9d2ff, unten: 0x9a6a36, umgebung: 1.0, fackel: 0, belichtung: 1.0,
    },
  };
}

// ── Höhle ────────────────────────────────────────────────────────────────

function hoehleLandschaft(e: FreiEbene, stil: Stil, seed: number): Landschaft {
  const g = new THREE.Group();
  const r = zufallAus(seed * 11 + 5);
  const F = STILE[stil];
  const glut = F.licht ?? 0xffa24a;
  const fels = farbe(F.wand), grund = farbe(F.boden);
  const ton = (c: THREE.Color, heller: number) => c.clone().multiplyScalar(heller).getHex();
  g.add(himmel(0x04050a, 0x0a0c14));
  g.add(umland(e, ton(fels, 0.4)));
  g.add(boden(e, (ctx, px) => {
    striche(ctx, e, px, r, 6, a => (a === WAND ? [ton(fels, 0.5), ton(fels, 0.65)]
      : a === PLATZ ? [ton(grund, 1.15), ton(grund, 1.3), ton(grund, 1.0)] : [ton(grund, 0.8), ton(grund, 0.95), ton(grund, 1.08), ton(fels, 0.9)]));
    // Pfützen aus Licht: Kristallstaub bzw. Glut am Wegrand
    striche(ctx, e, px, r, 1, (a, x, y) => (a !== WAND && r() < 0.1 && !allein(e, x, y) ? [glut] : null), 0.45);
  }, ton(grund, 0.9)));

  const { t, B } = tiefen(e, 3);
  const brocken: Stueck[] = [], zapfen: Stueck[] = [], kristalle: Stueck[] = [];
  const lichter: [number, number][] = [];
  const hoch = new THREE.Vector3(0, 1, 0);
  const dreh = () => new THREE.Quaternion().setFromAxisAngle(hoch, r() * Math.PI * 2);
  for (let Y = 0; Y < B; Y++) for (let X = 0; X < B; X++) {
    const tiefe = t[Y * B + X], x = X - 3, y = Y - 3;
    if (tiefe === 0 || tiefe > 3) continue;
    const wx = feldMitte(x), wz = feldMitte(y);
    const einzeln = tiefe === 1 && allein(e, x, y);
    if (einzeln) {
      // Tropfsteinsäule
      const h = 4.5 + r() * 2.5;
      brocken.push({ p: new THREE.Vector3(wx, h * 0.42, wz), s: new THREE.Vector3(1.15, h, 1.15), q: dreh(), f: farbe(ton(fels, 0.9 + r() * 0.4)) });
      brocken.push({ p: new THREE.Vector3(wx, 0.3, wz), s: new THREE.Vector3(1.7, 1.1, 1.7), q: dreh(), f: farbe(ton(fels, 0.8 + r() * 0.3)) });
      continue;
    }
    // am Weg mannshohe Brocken, dahinter türmt sich der Fels
    const teile = tiefe === 1 ? 2 : 1;
    for (let k = 0; k < teile; k++) {
      const h = tiefe === 1 ? 2.4 + r() * 2.4 : 5.5 + tiefe * 1.5 + r() * 3;
      // am Weg kaum breiter als das Feld: sonst ragen die Brocken in den Weg und verdecken die Figur
      const breit = ZELLE * (tiefe === 1 ? 1.3 + r() * 0.4 : 1.8 + r() * 0.9);
      const kipp = new THREE.Quaternion().setFromEuler(new THREE.Euler((r() - 0.5) * 0.3, r() * 6.3, (r() - 0.5) * 0.3));
      brocken.push({
        p: new THREE.Vector3(wx + (r() - 0.5) * 0.3, h * 0.3, wz + (r() - 0.5) * 0.3), s: new THREE.Vector3(breit, h, breit * (0.8 + r() * 0.4)), q: kipp,
        f: farbe(ton(fels, (tiefe === 1 ? 0.9 : 0.6) + r() * 0.5)),
      });
    }
    if (tiefe === 1 && r() < 0.5) {
      const h = 0.5 + r() * 1.3;
      zapfen.push({ p: new THREE.Vector3(wx + (r() - 0.5) * 1.2, h / 2, wz + (r() - 0.5) * 1.2), s: new THREE.Vector3(1, h, 1), f: farbe(ton(fels, 1.2 + r() * 0.4)) });
    }
    if (tiefe === 1 && r() < 0.1) {
      for (let k = 0; k < 4; k++) {
        const h = 0.5 + r() * 1.1;
        const kipp = new THREE.Quaternion().setFromEuler(new THREE.Euler((r() - 0.5) * 0.9, r() * 6, (r() - 0.5) * 0.9));
        kristalle.push({ p: new THREE.Vector3(wx + (r() - 0.5) * 0.9, h * 0.4, wz + (r() - 0.5) * 0.9), s: new THREE.Vector3(1, h, 1), q: kipp });
      }
      // nur wenige echte Lichter, weit auseinander
      if (lichter.length < 7 && lichter.every(([lx, lz]) => Math.hypot(lx - wx, lz - wz) > 13)) lichter.push([wx, wz]);
    }
  }
  g.add(reihe(felsGeometrie(), new THREE.MeshLambertMaterial({ color: 0xffffff }), brocken, false));
  g.add(reihe(new THREE.ConeGeometry(0.24, 1, 6), new THREE.MeshLambertMaterial({ color: 0xffffff }), zapfen, false));
  g.add(reihe(new THREE.ConeGeometry(0.14, 1, 5), new THREE.MeshLambertMaterial({ color: glut, emissive: glut, emissiveIntensity: 1.6 }), kristalle, false));
  for (const [lx, lz] of lichter) {
    const l = new THREE.PointLight(glut, 16, 15, 1.5);
    l.position.set(lx, 1.6, lz);
    g.add(l);
  }
  return {
    gruppe: g, wandHoehe: 99,
    stimmung: {
      himmelOben: 0x04050a, himmelUnten: 0x0a0c14, nebel: 0x080a12, dichte: 0.034,
      sonne: 0x8fa8ff, sonneStaerke: 0, sonneVon: [0.2, 1, 0.1],
      oben: 0x8fa6e0, unten: 0x3a3340, umgebung: 1.0, fackel: 30, belichtung: 1.15,
    },
  };
}

// ── Gebäude ──────────────────────────────────────────────────────────────

/** Stile, in denen es dämmrig ist (Fackel an) */
const DUNKEL = new Set<Stil>(["verlies", "gotisch", "raumstation", "neon"]);

function gebaeudeLandschaft(e: FreiEbene, stil: Stil, seed: number): Landschaft {
  const g = new THREE.Group();
  const r = zufallAus(seed * 13 + 1);
  const F = STILE[stil], A = AUSSEHEN[stil];
  const dunkel = DUNKEL.has(stil);
  const H = 2.4 + F.wandH * 1.1;
  const oben = dunkel ? 0x0b0d14 : 0x8fb3d9, unten = dunkel ? 0x14161f : 0xe4ecf3;
  g.add(himmel(oben, unten));
  g.add(umland(e, F.sockel));
  const muster = A.boden ? textur(A.boden) : null;
  g.add(boden(e, (ctx, px) => {
    for (let y = 0; y < e.h; y++) for (let x = 0; x < e.b; x++) {
      const a = e.art[y * e.b + x];
      if (a === WAND) continue;
      // Fliesen: je vier Felder eine Farbe
      const fliese = F.boden2 !== undefined && (Math.floor(x / 2) + Math.floor(y / 2)) % 2 === 1 ? F.boden2 : F.boden;
      ctx.fillStyle = css(a === PLATZ ? farbe(fliese).lerp(farbe(0xffffff), 0.12).getHex() : a === DURCHGANG ? farbe(fliese).lerp(farbe(F.tuer), 0.35).getHex() : fliese);
      ctx.fillRect(x * px, y * px, px + 1, px + 1);
    }
    if (muster) {
      // das Muster des Baustils (Parkett, Stein, Marmor …) darüberlegen
      const flaeche = ctx.createPattern(muster.image as HTMLCanvasElement, "repeat");
      if (flaeche) {
        const skala = (4.4 / ZELLE) * px / (muster.image as HTMLCanvasElement).width;
        ctx.save();
        ctx.globalAlpha = 0.6;
        ctx.globalCompositeOperation = "multiply";
        ctx.scale(skala, skala);
        ctx.fillStyle = flaeche;
        ctx.fillRect(0, 0, ctx.canvas.width / skala, ctx.canvas.height / skala);
        ctx.restore();
      }
    }
    // Teppich um jede Station, den Eingang und das Tor
    for (const [x, y] of [...e.raeume.map(p => [p.x, p.y]), e.start, e.ziel]) {
      ctx.fillStyle = css(farbe(F.tuer).lerp(farbe(F.boden), 0.35).getHex());
      ctx.globalAlpha = 0.75;
      ctx.beginPath();
      ctx.ellipse((x + 0.5) * px, (y + 0.5) * px, px * 3.2, px * 3.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.lineWidth = px * 0.18;
      ctx.strokeStyle = css(F.oben);
      ctx.stroke();
    }
    // Pinselspuren: helle und dunkle Flecken
    striche(ctx, e, px, r, 2, a => (a === WAND ? null : [0xffffff, 0x000000]), 0.05);
  }, F.sockel));

  const waende: Stueck[] = [], sockel: Stueck[] = [], leisten: Stueck[] = [], stuerze: Stueck[] = [], pfosten: Stueck[] = [], lampen: Stueck[] = [];
  for (let y = 0; y < e.h; y++) for (let x = 0; x < e.b; x++) {
    const a = e.art[y * e.b + x], wx = feldMitte(x), wz = feldMitte(y);
    if (a === DURCHGANG) {
      stuerze.push({ p: new THREE.Vector3(wx, H - 0.3, wz), s: new THREE.Vector3(ZELLE, 0.6, ZELLE) });
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (!istFrei(e, x + dx, y + dy)) pfosten.push({ p: new THREE.Vector3(wx + dx * (ZELLE / 2 - 0.1), (H - 0.6) / 2, wz + dy * (ZELLE / 2 - 0.1)), s: new THREE.Vector3(dx ? 0.2 : ZELLE, H - 0.6, dy ? 0.2 : ZELLE) });
      }
      continue;
    }
    if (a !== WAND) continue;
    waende.push({ p: new THREE.Vector3(wx, H / 2, wz), s: new THREE.Vector3(ZELLE, H, ZELLE) });
    let frei: [number, number] | null = null, amWeg = false;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!istFrei(e, x + dx, y + dy)) continue;
      amWeg = true;
      if (!dx !== !dy) frei = [dx, dy];
    }
    if (!amWeg) continue;
    sockel.push({ p: new THREE.Vector3(wx, 0.5, wz), s: new THREE.Vector3(ZELLE + 0.1, 1.0, ZELLE + 0.1) });
    leisten.push({ p: new THREE.Vector3(wx, H + F.obenH * 0.75, wz), s: new THREE.Vector3(ZELLE + 0.08, Math.max(0.1, F.obenH * 1.5), ZELLE + 0.08) });
    if (frei && (x * 7 + y * 13) % 6 === 0) {
      lampen.push({ p: new THREE.Vector3(wx + frei[0] * (ZELLE / 2 + 0.08), 2.35, wz + frei[1] * (ZELLE / 2 + 0.08)), s: new THREE.Vector3(0.22, 0.32, 0.22) });
    }
  }
  // oben heller Putz im Muster des Stils, unten ein Sockel in der Wandfarbe
  g.add(reihe(wuerfel, musterMaterial(farbe(F.wand).lerp(farbe(F.boden), 0.45).getHex(), A.wand, 2.2), waende));
  g.add(reihe(wuerfel, new THREE.MeshLambertMaterial({ color: F.wand }), sockel));
  g.add(reihe(wuerfel, new THREE.MeshLambertMaterial({ color: F.oben }), leisten));
  g.add(reihe(wuerfel, new THREE.MeshLambertMaterial({ color: F.tuer }), stuerze));
  g.add(reihe(wuerfel, new THREE.MeshLambertMaterial({ color: F.tuer }), pfosten));
  const schein = F.licht ?? 0xffdf9e;
  g.add(reihe(wuerfel, new THREE.MeshLambertMaterial({ color: schein, emissive: schein, emissiveIntensity: dunkel ? 2.2 : 1.1 }), lampen, false));

  // Topfpflanzen in den Ecken der Zimmer
  const toepfe: Stueck[] = [], gruen: Stueck[] = [];
  const hoch = new THREE.Vector3(0, 1, 0);
  for (const p of e.raeume) for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    if (r() < 0.35) continue;
    const wx = feldMitte(p.x + sx * p.r) + sx * 0.25, wz = feldMitte(p.y + sy * p.r) + sy * 0.25;
    toepfe.push({ p: new THREE.Vector3(wx, 0.3, wz), s: new THREE.Vector3(0.6, 0.6, 0.6) });
    const breit = 0.9 + r() * 0.4;
    gruen.push({ p: new THREE.Vector3(wx, 1.1 + r() * 0.3, wz), s: new THREE.Vector3(breit, 1.2 + r() * 0.6, breit), q: new THREE.Quaternion().setFromAxisAngle(hoch, r() * 6), f: farbe(aus([0x3f7a2a, 0x5a8f2f, 0x2f6a3a], r)) });
  }
  g.add(reihe(new THREE.CylinderGeometry(0.42, 0.3, 1, 10), new THREE.MeshLambertMaterial({ color: 0xb4623a }), toepfe));
  g.add(reihe(felsGeometrie(), new THREE.MeshLambertMaterial({ color: 0xffffff }), gruen));

  return {
    gruppe: g, wandHoehe: H,
    stimmung: dunkel
      ? { himmelOben: oben, himmelUnten: unten, nebel: 0x0b0d14, dichte: 0.026, sonne: 0x9fb4ff, sonneStaerke: 0.35, sonneVon: [-0.3, 1, 0.25], oben: 0x8a94c0, unten: 0x2a2420, umgebung: 0.7, fackel: 40, belichtung: 1.15 }
      : { himmelOben: oben, himmelUnten: unten, nebel: unten, dichte: 0.008, sonne: 0xffe9c4, sonneStaerke: 2.4, sonneVon: [-0.45, 1, 0.3], oben: 0xffffff, unten: 0xb89a7a, umgebung: 1.25, fackel: 0, belichtung: 0.95 },
  };
}

export function baueLandschaft(e: FreiEbene, stil: Stil, seed: number): Landschaft {
  const w = weltVon(stil);
  return w === "wald" ? waldLandschaft(e, seed) : w === "hoehle" ? hoehleLandschaft(e, stil, seed) : gebaeudeLandschaft(e, stil, seed);
}

// ── Stationen, Tor, Rückweg ──────────────────────────────────────────────

const RAUM_FARBE: Record<RaumZustand, number> = { offen: 0xf59e0b, geloest: 0x22c55e, info: 0x60a5fa, gelesen: 0x94a3b8 };

export interface OrteBild {
  zustaende: RaumZustand[];
  zielOffen: boolean;
  zielArt: "weiter" | "ausgang";
  objekte?: Objekt[];
  stil: Stil;
  /** gibt es einen Rückweg (nicht im ersten Abschnitt)? */
  mitZurueck: boolean;
  /** ein Boss bewacht das Tor */
  waechter: boolean;
  /** Nummer des Abschnitts: wählt die Monster aus */
  abschnitt: number;
}

export interface Marke { ort: FreiOrt; text: string; ton: "offen" | "geloest" | "info" | "gelesen" | "zu" | "weiter"; x: number; y: number; z: number }

/** Leuchtender Ring am Boden und eine Lichtsäule: von Weitem zu sehen */
function leuchtfeuer(g: THREE.Group, f: number, saeule: boolean) {
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.55, 1.85, 40), new THREE.MeshBasicMaterial({ color: f, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.04;
  g.add(ring);
  if (!saeule) return;
  const s = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 16, 8, 1, true),
    new THREE.MeshBasicMaterial({ color: f, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  s.position.y = 8;
  g.add(s);
}

/** Tor aus zwei Pfosten und einem Sturz; dazwischen schimmert es rot (zu) oder grün (offen) */
function tor(g: THREE.Group, stein: number, schein: number, breit = 2.6, hoehe = 3.4) {
  const mat = new THREE.MeshLambertMaterial({ color: stein });
  for (const s of [-1, 1]) {
    const p = new THREE.Mesh(wuerfel, mat);
    p.scale.set(0.5, hoehe, 0.6);
    p.position.set(s * (breit / 2 + 0.25), hoehe / 2, 0);
    p.castShadow = true;
    g.add(p);
  }
  const sturz = new THREE.Mesh(wuerfel, mat);
  sturz.scale.set(breit + 1.3, 0.5, 0.7);
  sturz.position.y = hoehe + 0.25;
  sturz.castShadow = true;
  g.add(sturz);
  const flaeche = new THREE.Mesh(new THREE.PlaneGeometry(breit, hoehe),
    new THREE.MeshBasicMaterial({ color: schein, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  flaeche.position.y = hoehe / 2;
  g.add(flaeche);
}

export function baueOrte(e: FreiEbene, bild: OrteBild): { gruppe: THREE.Group; marken: Marke[] } {
  const g = new THREE.Group();
  const marken: Marke[] = [];
  const w = weltVon(bild.stil);
  const stein = w === "wald" ? 0x7a5638 : w === "hoehle" ? farbe(STILE[bild.stil].wand).multiplyScalar(1.5).getHex() : STILE[bild.stil].tuer;

  e.raeume.forEach((p, k) => {
    const zg = new THREE.Group();
    zg.userData.ort = { art: "raum", raum: k } satisfies FreiOrt;
    zg.position.set(feldMitte(p.x), 0, feldMitte(p.y));
    const z = bild.zustaende[k] ?? "offen";
    leuchtfeuer(zg, RAUM_FARBE[z], z === "offen" || z === "info");
    const ding = baueObjekt(bild.objekte?.[k] ?? "pult", z === "geloest", k + bild.abschnitt * 3);
    ding.scale.setScalar(1.5);
    ding.rotation.y = k * 1.3;
    ding.traverse(o => { o.castShadow = true; });
    zg.add(ding);
    g.add(zg);
    marken.push({ ort: { art: "raum", raum: k }, text: z === "info" || z === "gelesen" ? "i" : String(k + 1), ton: z, x: zg.position.x, y: 3.4, z: zg.position.z });
  });

  const zg = new THREE.Group();
  zg.userData.ort = { art: "ziel" } satisfies FreiOrt;
  zg.position.set(feldMitte(e.ziel[0]), 0, feldMitte(e.ziel[1]));
  const offen = bild.zielOffen;
  tor(zg, stein, offen ? 0x22c55e : 0xe11d48);
  leuchtfeuer(zg, offen ? 0x22c55e : 0xe11d48, true);
  if (bild.waechter) {
    // der Boss steht neben dem Tor; ist es offen, liegt er besiegt da
    const boss = baueObjekt("boss", offen, bild.abschnitt);
    boss.scale.setScalar(1.5);
    boss.position.set(offen ? 2.6 : 0, 0, offen ? 0.5 : 1.6);
    boss.traverse(o => { o.castShadow = true; });
    zg.add(boss);
  }
  g.add(zg);
  marken.push({ ort: { art: "ziel" }, text: offen ? (bild.zielArt === "ausgang" ? "EXIT" : "➡") : "🔒", ton: offen ? "weiter" : "zu", x: zg.position.x, y: 4.6, z: zg.position.z });

  if (bild.mitZurueck) {
    const rg = new THREE.Group();
    rg.userData.ort = { art: "zurueck" } satisfies FreiOrt;
    rg.position.set(feldMitte(e.start[0]), 0, feldMitte(e.start[1]));
    tor(rg, stein, 0x94a3b8, 2.2, 2.8);
    leuchtfeuer(rg, 0x94a3b8, false);
    g.add(rg);
    marken.push({ ort: { art: "zurueck" }, text: "⬅", ton: "gelesen", x: rg.position.x, y: 3.9, z: rg.position.z });
  }
  return { gruppe: g, marken };
}
