/**
 * three.js-Teil des Gebäudes: baut die Stockwerke als Klötzchen (Boden,
 * Wände nur am Flur entlang, Zimmer, Türen, Treppe) — ohne React.
 */
import * as THREE from "three";
import type { Plan, Punkt } from "@/lib/gebaeude/plan";
import type { Objekt } from "@/lib/gebaeude/objekte";
import { baueObjekt } from "./objekte3d";
import { felsGeometrie, musterMaterial, zufallAus, type Muster } from "./stoff";
import { bauReihe, bausatz, type Bausatz, type Lage } from "./bausatz";

export type RaumZustand = "offen" | "geloest" | "info" | "gelesen";

/** Höhe eines Stockwerks in Feldern */
export const STOCK_H = 3;

/** Haus: Stockwerke gehen nach oben (+1). Verlies: Ebenen gehen nach unten (−1). */
export type Richtung = 1 | -1;

/** Bodenhöhe von Stockwerk bzw. Ebene i */
export function hoeheVon(i: number, richtung: Richtung = 1): number {
  return i * STOCK_H * richtung;
}

const FARBE = {
  boden: 0xece4d8, bodenRand: 0x8b7e74, wand: 0x5b4b45, wandOben: 0xd9cfc4,
  offen: 0xf59e0b, geloest: 0x22c55e, info: 0x60a5fa, gelesen: 0x94a3b8,
  tuer: 0x7c2d12, treppe: 0xcbd5e1, gesperrt: 0xe11d48, ausgang: 0x22c55e,
};

const RAUM_FARBE: Record<RaumZustand, number> = {
  offen: FARBE.offen, geloest: FARBE.geloest, info: FARBE.info, gelesen: FARBE.gelesen,
};

/**
 * Aussehen des Hauses. Beton und Neon nach den Bildern von MarkovJunior
 * (Apartemazements), Garten wie ein Palast mit Hecken am Wasser.
 */
export type Stil =
  | "klassisch" | "beton" | "neon" | "garten" | "verlies"
  | "burg" | "holz" | "eis" | "wueste" | "raumstation" | "lava"
  | "steinzeit" | "antike" | "mittelalter" | "gotisch" | "viktorianisch" | "retro"
  | "wald" | "hoehle" | "winter" | "oase" | "pilze";

interface Palette {
  boden: number; wand: number; wandH: number; oben: number; obenH: number;
  tuer: number; treppe: number; stuetze: number; sockel: number;
  /** zweite Bodenfarbe: Fliesen im Schachbrett */
  boden2?: number;
  /** Zimmer leuchten (Neon) */
  leuchten?: boolean;
  /** Farbe der Lichtsäule über leuchtenden Zimmern (Vorgabe: rot) */
  licht?: number;
}

export const STILE: Record<Stil, Palette & { name: string }> = {
  klassisch: { name: "Klassisch", boden: 0xece4d8, wand: 0x5b4b45, wandH: 1.2, oben: 0xd9cfc4, obenH: 0.06, tuer: 0x7c2d12, treppe: 0xcbd5e1, stuetze: 0x8b7e74, sockel: 0x475569 },
  beton: { name: "Beton", boden: 0xe7e5e4, wand: 0xa8a29e, wandH: 0.9, oben: 0xf5f5f4, obenH: 0.12, tuer: 0x57534e, treppe: 0xf5f5f4, stuetze: 0xd6d3d1, sockel: 0x78716c },
  neon: { name: "Glas & Neon", boden: 0xd4d4d8, wand: 0x27272a, wandH: 1.3, oben: 0xfafafa, obenH: 0.1, tuer: 0xfafafa, treppe: 0xe4e4e7, stuetze: 0xf4f4f5, sockel: 0x3f3f46, leuchten: true },
  garten: { name: "Gartenpalast", boden: 0xd9e4c8, wand: 0xf5ecd7, wandH: 0.8, oben: 0x3f6212, obenH: 0.45, tuer: 0x92400e, treppe: 0xf5ecd7, stuetze: 0xf5ecd7, sockel: 0x2563eb },
  verlies: { name: "Verlies", boden: 0x57534e, wand: 0x3f3a36, wandH: 1.5, oben: 0x78716c, obenH: 0.12, tuer: 0x44403c, treppe: 0x78716c, stuetze: 0x44403c, sockel: 0x1c1917 },
  burg: { name: "Burg", boden: 0xd6d3d1, boden2: 0xa8a29e, wand: 0x78716c, wandH: 1.6, oben: 0x991b1b, obenH: 0.25, tuer: 0x78350f, treppe: 0xa8a29e, stuetze: 0x57534e, sockel: 0x3f6212 },
  holz: { name: "Holzhütte", boden: 0xe9c99a, wand: 0x8b5a2b, wandH: 1.0, oben: 0x5c3317, obenH: 0.2, tuer: 0x3f2a14, treppe: 0xd4a373, stuetze: 0x6b4423, sockel: 0x4d7c0f },
  eis: { name: "Eispalast", boden: 0xf0f9ff, boden2: 0xe0f2fe, wand: 0x7dd3fc, wandH: 1.4, oben: 0xffffff, obenH: 0.35, tuer: 0x0369a1, treppe: 0xe0f2fe, stuetze: 0xbae6fd, sockel: 0x0c4a6e },
  wueste: { name: "Wüstentempel", boden: 0xfde68a, wand: 0xd97706, wandH: 1.1, oben: 0xfef3c7, obenH: 0.15, tuer: 0x1e3a8a, treppe: 0xfcd34d, stuetze: 0xb45309, sockel: 0xca8a04 },
  raumstation: { name: "Raumstation", boden: 0x475569, boden2: 0x334155, wand: 0x1e293b, wandH: 1.2, oben: 0x22d3ee, obenH: 0.05, tuer: 0x94a3b8, treppe: 0x64748b, stuetze: 0x64748b, sockel: 0x0f172a, leuchten: true, licht: 0x22d3ee },
  lava: { name: "Lavahöhle", boden: 0x44372f, wand: 0x33291f, wandH: 1.5, oben: 0xea580c, obenH: 0.08, tuer: 0x431407, treppe: 0x44403c, stuetze: 0x292524, sockel: 0x7c2d12, leuchten: true, licht: 0xf97316 },
  // Epochen — z. B. ein Abschnitt je Zeitalter (TaskCrawler "gebaeude": {"stile": […]})
  steinzeit: { name: "Steinzeithöhle", boden: 0x8a6f4e, wand: 0x6b5844, wandH: 1.7, oben: 0x57473a, obenH: 0.3, tuer: 0xb45309, treppe: 0x7c6a55, stuetze: 0x57473a, sockel: 0x44403c },
  antike: { name: "Antiker Tempel", boden: 0xf5f5f4, boden2: 0xe7e5e4, wand: 0xfafaf9, wandH: 1.3, oben: 0xc2410c, obenH: 0.15, tuer: 0xa16207, treppe: 0xf5f5f4, stuetze: 0xe7e5e4, sockel: 0x0369a1 },
  mittelalter: { name: "Mittelalter (Fachwerk)", boden: 0xc8b89a, wand: 0xf5f0e1, wandH: 1.2, oben: 0x4a2c17, obenH: 0.18, tuer: 0x5c3a1a, treppe: 0x9c8a70, stuetze: 0x4a2c17, sockel: 0x57534e },
  gotisch: { name: "Gotik", boden: 0x57534e, boden2: 0x3f3a36, wand: 0x6b6560, wandH: 2.0, oben: 0x44403c, obenH: 0.1, tuer: 0x1c1917, treppe: 0x78716c, stuetze: 0x44403c, sockel: 0x1c1917, leuchten: true, licht: 0x8b5cf6 },
  viktorianisch: { name: "Viktorianisch", boden: 0x6b3a2a, wand: 0x14532d, wandH: 1.3, oben: 0xd4af37, obenH: 0.08, tuer: 0x3b1f14, treppe: 0x8b5a3c, stuetze: 0x1c1917, sockel: 0x44403c },
  retro: { name: "Retro (70er)", boden: 0xd97706, wand: 0xfef3c7, wandH: 1.0, oben: 0x92400e, obenH: 0.1, tuer: 0x65a30d, treppe: 0xfcd34d, stuetze: 0x78716c, sockel: 0x57534e },
  // Natur: in der freien 3D-Ansicht eigene Welten (Wald mit Bäumen, Höhle mit Kristallen), sonst Hecken bzw. Fels
  wald: { name: "Wald", boden: 0x9aa63a, wand: 0x4f7a28, wandH: 1.3, oben: 0x6b8e23, obenH: 0.3, tuer: 0x6b4a32, treppe: 0x8c6a3d, stuetze: 0x6b4a32, sockel: 0x3f4a1f },
  winter: { name: "Winterwald", boden: 0xeef3f9, wand: 0xdbe5f1, wandH: 1.3, oben: 0xffffff, obenH: 0.3, tuer: 0x4a3a30, treppe: 0xcfd9e6, stuetze: 0x4a3a30, sockel: 0x9dbbe0 },
  oase: { name: "Oase", boden: 0xedd39a, wand: 0xc9a56c, wandH: 1.2, oben: 0xdfc07c, obenH: 0.2, tuer: 0x8a6a44, treppe: 0xd6b577, stuetze: 0x8a6a44, sockel: 0x3f95e6 },
  pilze: { name: "Leuchtpilzwald", boden: 0x25444c, wand: 0x3a2a6a, wandH: 1.4, oben: 0x9a7bff, obenH: 0.25, tuer: 0x1a1440, treppe: 0x2a3550, stuetze: 0xd8d0e8, sockel: 0x070618, leuchten: true, licht: 0x38e1d6 },
  hoehle: { name: "Tropfsteinhöhle", boden: 0x5a554e, wand: 0x4c505c, wandH: 1.6, oben: 0x6b7080, obenH: 0.2, tuer: 0x2b2e38, treppe: 0x6b7080, stuetze: 0x3a3d48, sockel: 0x16181f, leuchten: true, licht: 0x38e1d6 },
};

/** Verzierung auf den Eckpfeilern der Wände */
type Ecke = "saeule" | "spitze" | "tropfstein" | "zinne" | "kristall";

/**
 * Oberflächen und Form je Stil: Muster für Boden und Wände, »organisch« =
 * Wände aus unregelmäßigen Felsbrocken (Höhlen), Verzierung an den Ecken.
 */
export const AUSSEHEN: Record<Stil, { boden?: Muster; wand?: Muster; organisch?: boolean; ecken?: Ecke; glut?: boolean }> = {
  klassisch: { boden: "parkett", wand: "putz" },
  beton: { boden: "beton", wand: "beton" },
  neon: { boden: "metall" },
  garten: { boden: "sand", wand: "putz" },
  verlies: { boden: "stein", wand: "stein" },
  burg: { boden: "stein", wand: "stein", ecken: "zinne" },
  holz: { boden: "holz", wand: "holz" },
  eis: { boden: "eis", wand: "eis", ecken: "kristall" },
  wueste: { boden: "sand", wand: "stein" },
  raumstation: { boden: "metall", wand: "metall" },
  lava: { boden: "fels", wand: "fels", organisch: true, ecken: "tropfstein", glut: true },
  steinzeit: { boden: "erde", wand: "fels", organisch: true, ecken: "tropfstein" },
  antike: { boden: "marmor", wand: "marmor", ecken: "saeule" },
  mittelalter: { boden: "holz", wand: "fachwerk" },
  gotisch: { boden: "stein", wand: "stein", ecken: "spitze" },
  viktorianisch: { boden: "parkett", wand: "tapete" },
  retro: { boden: "teppich", wand: "putz" },
  wald: { boden: "erde", organisch: true },
  winter: { boden: "eis", organisch: true },
  oase: { boden: "sand", organisch: true },
  pilze: { boden: "erde", organisch: true },
  hoehle: { boden: "fels", wand: "fels", organisch: true, ecken: "tropfstein" },
};

const box = new THREE.BoxGeometry(1, 1, 1);

/** Schild mit Text über einem Feld (Zimmernummer, Schloss …) */
export function schild(text: string, farbe = "#111827", hinter = "#fef3c7"): THREE.Sprite {
  const c = document.createElement("canvas");
  c.width = 128; c.height = 128;
  const ctx = c.getContext("2d");
  if (!ctx) return new THREE.Sprite(new THREE.SpriteMaterial({ depthTest: false })); // ohne Canvas (Tests)
  ctx.fillStyle = hinter;
  ctx.beginPath();
  ctx.arc(64, 64, 58, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = farbe;
  ctx.stroke();
  ctx.fillStyle = farbe;
  ctx.font = `bold ${text.length > 2 ? 44 : 64}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 64, 68);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
  s.scale.set(0.9, 0.9, 1);
  s.renderOrder = 10;
  return s;
}

function klotz(farbe: number, b: number, h: number, t: number, x: number, y: number, z: number, leuchtet = false): THREE.Mesh {
  const m = new THREE.Mesh(box, new THREE.MeshLambertMaterial(
    leuchtet ? { color: farbe, emissive: farbe, emissiveIntensity: 0.9 } : { color: farbe }));
  m.scale.set(b, h, t);
  m.position.set(x, y + h / 2, z);
  return m;
}

/**
 * Maße: Die ungeraden Rasterzeilen/-spalten (Flure, Zimmer, Kreuzungen) sind
 * breit, die geraden (Wände und kurze Durchgänge dazwischen) schmal.
 */
export const WEIT = 2.2;
export const SCHMAL = 0.3;

export function breite(i: number): number {
  return Math.abs(i) % 2 === 1 ? WEIT : SCHMAL;
}

/** Weltkoordinate der Mitte von Rasterspalte bzw. -zeile i */
export function welt(i: number): number {
  return Math.ceil(i / 2) * SCHMAL + Math.floor(i / 2) * WEIT + breite(i) / 2;
}

/** Breite eines ganzen Abschnitts (R Rasterspalten) in Welteinheiten */
export function abschnittBreite(R: number): number {
  return welt(R - 1) + breite(R - 1) / 2;
}

/** Ebene: um wie viel Abschnitt i nach rechts versetzt liegt (sonst 0) */
export function versatzVon(i: number, R: number, flach?: boolean): number {
  return flach ? i * abschnittBreite(R) : 0;
}

/** Umkehrung von `welt`: in welcher Rasterspalte liegt die Weltkoordinate w? */
export function feldAus(w: number, R: number): number {
  for (let i = 0; i < R; i++) if (w < welt(i) + breite(i) / 2) return i;
  return R - 1;
}

/** Viele gleiche Klötze als eine InstancedMesh, je Feld in dessen Breite */
function klotzReihe(felder: Punkt[], farbe: number | THREE.Material, h: number, y: number): THREE.InstancedMesh {
  const mat0 = typeof farbe === "number" ? new THREE.MeshLambertMaterial({ color: farbe }) : farbe;
  const m = new THREE.InstancedMesh(box, mat0, Math.max(1, felder.length));
  m.count = felder.length;
  const mat = new THREE.Matrix4();
  felder.forEach(([x, z], i) => {
    mat.compose(new THREE.Vector3(welt(x), y + h / 2, welt(z)), new THREE.Quaternion(), new THREE.Vector3(breite(x), h, breite(z)));
    m.setMatrixAt(i, mat);
  });
  return m;
}

/** Zufall je Feld: jedes Feld sieht bei jedem Neuaufbau gleich aus */
const feldZufall = (x: number, y: number, stock: number) => zufallAus(x * 73856093 ^ y * 19349663 ^ (stock + 1) * 83492791);

/** Höhlenwände: je Wandfeld ein unregelmäßiger Felsbrocken, etwas größer als das Feld */
function felsReihe(felder: Punkt[], mat: THREE.Material, h: number, y: number, stock: number): THREE.InstancedMesh {
  // lange Wandstücke (ein Feld breit) bekommen drei Brocken nebeneinander statt eines langen
  const TEILE = 3;
  const m = new THREE.InstancedMesh(felsGeometrie(), mat, Math.max(1, felder.length * TEILE));
  const mx = new THREE.Matrix4(), q = new THREE.Quaternion(), farbe = new THREE.Color();
  let k = 0;
  for (const [x, z] of felder) {
    const r = feldZufall(x, z, stock);
    const langX = breite(x) === WEIT && breite(z) !== WEIT, langZ = breite(z) === WEIT && breite(x) !== WEIT;
    const teile = langX || langZ ? TEILE : 1;
    for (let t = 0; t < teile; t++) {
      const versatz = teile > 1 ? (t - (teile - 1) / 2) * (WEIT / teile) : 0;
      const bx = langX ? WEIT / teile : breite(x), bz = langZ ? WEIT / teile : breite(z);
      const sy = h * (1.0 + r() * 0.6);
      const s = new THREE.Vector3((bx + 0.6) * (0.95 + r() * 0.35), sy, (bz + 0.6) * (0.95 + r() * 0.35));
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * Math.PI * 2);
      mx.compose(new THREE.Vector3(welt(x) + (langX ? versatz : 0), y + sy * 0.38, welt(z) + (langZ ? versatz : 0)), q, s);
      m.setMatrixAt(k, mx);
      m.setColorAt(k++, farbe.setScalar(0.78 + r() * 0.36));
    }
  }
  m.count = k;
  return m;
}

/** Verzierung auf den Eckpfeilern: Säulen, Turmspitzen, Tropfsteine, Zinnen, Eiskristalle */
function verzierung(art: Ecke, felder: Punkt[], F: Palette, y0: number, oben: number, stock: number): THREE.Group {
  const g = new THREE.Group();
  const n = Math.max(1, felder.length);
  const mx = new THREE.Matrix4(), q = new THREE.Quaternion();
  const reihe = (geo: THREE.BufferGeometry, mat: THREE.Material, lage: (x: number, z: number, r: () => number) => [THREE.Vector3, THREE.Vector3, THREE.Quaternion?] | null) => {
    const m = new THREE.InstancedMesh(geo, mat, n);
    let k = 0;
    for (const [x, z] of felder) {
      const l = lage(welt(x), welt(z), feldZufall(x, z, stock + 17));
      if (!l) continue;
      mx.compose(l[0], l[2] ?? q.identity(), l[1]);
      m.setMatrixAt(k++, mx);
    }
    m.count = k;
    g.add(m);
  };
  const lambert = (color: number, extra: THREE.MeshLambertMaterialParameters = {}) => new THREE.MeshLambertMaterial({ color, ...extra });
  if (art === "saeule") {
    // vom Boden bis über die Mauer, mit Kapitell
    const h = oben - y0 + 0.2;
    reihe(new THREE.CylinderGeometry(0.24, 0.28, 1, 14), musterMaterial(F.stuetze, "marmor", 1.6), (x, z) =>
      [new THREE.Vector3(x, y0 + h / 2, z), new THREE.Vector3(1, h, 1)]);
    reihe(new THREE.BoxGeometry(1, 1, 1), lambert(F.stuetze), (x, z) =>
      [new THREE.Vector3(x, oben + 0.26, z), new THREE.Vector3(0.72, 0.14, 0.72)]);
  } else if (art === "spitze") {
    reihe(new THREE.ConeGeometry(0.24, 1, 4), lambert(F.oben), (x, z, r) => {
      const h = 0.8 + r() * 0.5;
      return [new THREE.Vector3(x, oben + h / 2, z), new THREE.Vector3(1, h, 1), q.clone().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 4)];
    });
  } else if (art === "tropfstein") {
    const hell = new THREE.Color(F.wand).multiplyScalar(1.5).getHex();
    reihe(new THREE.ConeGeometry(0.22, 1, 7), lambert(hell), (x, z, r) => {
      if (r() < 0.45) return null;
      const h = 0.5 + r() * 0.8;
      return [new THREE.Vector3(x + (r() - 0.5) * 0.4, oben * 0.95 + h / 2 - 0.1, z + (r() - 0.5) * 0.4), new THREE.Vector3(1, h, 1)];
    });
  } else if (art === "zinne") {
    reihe(new THREE.BoxGeometry(1, 1, 1), lambert(F.wand), (x, z) =>
      [new THREE.Vector3(x, oben + 0.2, z), new THREE.Vector3(0.5, 0.4, 0.5)]);
  } else {
    reihe(new THREE.ConeGeometry(0.13, 1, 5), lambert(0xe0f2fe, { emissive: 0x38bdf8, emissiveIntensity: 0.35 }), (x, z, r) => {
      const h = 0.6 + r() * 0.7;
      const kipp = new THREE.Quaternion().setFromEuler(new THREE.Euler((r() - 0.5) * 0.6, 0, (r() - 0.5) * 0.6));
      return [new THREE.Vector3(x, oben + h / 2 - 0.05, z), new THREE.Vector3(1, h, 1), kipp];
    });
  }
  return g;
}

export interface StockBild {
  zustaende: RaumZustand[];
  zielOffen: boolean;
  zielArt: "treppe" | "ausgang";
  /** was in den Zimmern steht (Vorgabe: Schreibtisch) */
  objekte?: Objekt[];
  /** Stockwerke unter dem aktuellen werden abgedunkelt */
  unten: boolean;
  stil?: Stil;
  /** Gesamtansicht: Stützen bis zum Stockwerk darunter, keine Schilder */
  ganz?: boolean;
  /** +1 Haus (nach oben), −1 Verlies (nach unten) */
  richtung?: Richtung;
  /** Ein Boss bewacht Treppe bzw. Ausgang (Verlies) */
  waechter?: boolean;
  /** Ebene: Abschnitte nebeneinander, Türen in der Wand statt Treppen */
  flach?: boolean;
}

/** Tür in der Wand zwischen zwei Abschnitten; offen klappt sie zur Seite. */
function wandtuer(g: THREE.Group, x: number, z: number, y0: number, offen: boolean, farbe: number, hoehe: number) {
  if (offen) {
    const fluegel = klotz(farbe, WEIT * 0.9, hoehe, 0.1, x + WEIT * 0.45, y0 + 0.25, z - WEIT / 2 + 0.1);
    g.add(fluegel);
  } else {
    g.add(klotz(farbe, 2 * SCHMAL, hoehe, WEIT, x, y0 + 0.25, z));
    g.add(klotz(0xfacc15, 2 * SCHMAL + 0.04, 0.12, 0.12, x, y0 + 0.25 + hoehe * 0.5, z + WEIT * 0.3));
  }
}

/**
 * Treppe in einem Feld: nach oben fünf Stufen, nach unten ein Schacht mit
 * fünf Stufen hinab. `zu` = Richtung (dx, dz) zum offenen Nachbarfeld, von dem
 * man hineinläuft: dort liegt die unterste (bzw. beim Hinab die oberste) Stufe.
 */
function treppe(g: THREE.Group, x: number, z: number, y0: number, hoch: boolean, farbe: number, zu: Punkt = [0, -1], K?: Bausatz | null, ton = 0xffffff) {
  const t = new THREE.Group();
  const stufe = WEIT / 5;
  // gebaut mit dem Eingang bei −z, dann gedreht
  const stufen: Lage[] = [];
  for (let s = 0; s < 5; s++) {
    const tz = -WEIT / 2 + stufe / 2 + s * stufe;
    // Stufen hinab: jede liegt tiefer; darunter ist es dunkel
    const [h, y] = hoch ? [0.25 + s * (STOCK_H / 5), y0] : [0.2, y0 + 0.25 - (s + 1) * (STOCK_H / 5) - 0.2];
    if (K?.stufe) stufen.push({ x: 0, y, z: tz, hoch: h });
    else t.add(klotz(farbe, WEIT, h, stufe, 0, y, tz));
  }
  if (K?.stufe) t.add(bauReihe(K.stufe, stufen, ton));
  if (!hoch) {
    // Schachtwände, damit das Loch als Loch zu sehen ist
    for (const s of [-1, 1]) t.add(klotz(0x1c1917, 0.12, STOCK_H, WEIT, s * (WEIT / 2 - 0.06), y0 - STOCK_H + 0.25, 0));
  }
  t.rotation.y = Math.atan2(-zu[0], -zu[1]);
  t.position.set(x, 0, z);
  g.add(t);
}

/** Richtung zum einzigen offenen Nachbarn eines Feldes (Treppen liegen in Sackgassen) */
function eingang(offen: (x: number, y: number) => boolean, [x, y]: Punkt): Punkt {
  for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]] as Punkt[]) if (offen(x + dx, y + dy)) return [dx, dy];
  return [0, -1];
}

/** Bausatz-Teile nach Namen sammeln und je Name eine InstancedMesh-Gruppe bauen */
function bauGruppen(K: Bausatz, lagen: Map<string, Lage[]>, farbe: number, leuchten = 0): THREE.Group[] {
  return [...lagen].filter(([name]) => K[name]?.geo).map(([name, l]) => bauReihe(K[name], l, farbe, leuchten));
}

function dazu(lagen: Map<string, Lage[]>, name: string, l: Lage) {
  const liste = lagen.get(name);
  if (liste) liste.push(l); else lagen.set(name, [l]);
}

/** Bodenfelder aus Steinplatten: breit = eine von drei Platten, Durchgang = Streifen, Ecke = kleines Stück */
function bausatzBoden(K: Bausatz, felder: Punkt[], y0: number, stock: number, farbe: number, leuchten = 0): THREE.Group[] {
  const lagen = new Map<string, Lage[]>();
  for (const [x, z] of felder) {
    const r = feldZufall(x, z, stock + 31);
    const bx = breite(x) === WEIT, bz = breite(z) === WEIT;
    const name = bx && bz ? `boden${1 + Math.floor(r() * 3)}` : bx || bz ? "bodenschmal" : "bodenklein";
    // breite Platten zufällig gedreht, Streifen längs zum Durchgang
    const dreh = bx && bz ? Math.floor(r() * 4) * Math.PI / 2 : bx || !bz ? 0 : Math.PI / 2;
    dazu(lagen, name, { x: welt(x), y: y0, z: welt(z), dreh });
  }
  return bauGruppen(K, lagen, farbe, leuchten);
}

/**
 * Wandfelder aus Mauerwerk: Ecken = Pfeiler, lange Felder = Mauerstück (manche mit Fackel,
 * Ketten oder Geröll — die Seite mit dem Schmuck zeigt zum Flur), volle Felder = Block.
 */
function bausatzWaende(K: Bausatz, felder: Punkt[], offen: (x: number, y: number) => boolean,
  y0: number, stock: number, hoch: number, farbe: number): THREE.Group[] {
  const lagen = new Map<string, Lage[]>();
  for (const [x, z] of felder) {
    const r = feldZufall(x, z, stock + 47);
    const bx = breite(x) === WEIT, bz = breite(z) === WEIT;
    const ort = { x: welt(x), y: y0, z: welt(z), hoch, farbe: new THREE.Color().setScalar(0.88 + r() * 0.2) };
    if (!bx && !bz) { dazu(lagen, "pfeiler", { ...ort, dreh: Math.floor(r() * 4) * Math.PI / 2 }); continue; }
    if (bx && bz) { dazu(lagen, "block", { ...ort, dreh: Math.floor(r() * 4) * Math.PI / 2 }); continue; }
    // Schmuck sitzt in Blender auf der Seite +y, im Spiel −z; Drehung so, dass er zu einem Flurfeld zeigt
    const seiten: Punkt[] = (bx ? [[0, -1], [0, 1]] : [[-1, 0], [1, 0]] as Punkt[]).filter(([dx, dz]) => offen(x + dx, z + dz)) as Punkt[];
    const [dx, dz] = seiten.length ? seiten[Math.floor(r() * seiten.length)] : bx ? [0, -1] : [-1, 0];
    const w = r();
    const art = !seiten.length || w < 0.5 ? 1 : w < 0.68 ? 4 : w < 0.84 ? 3 : 2;
    dazu(lagen, `mauer${art}`, { ...ort, dreh: Math.atan2(-dx, -dz) });
  }
  return bauGruppen(K, lagen, farbe);
}

export function baueStock(plan: Plan, i: number, bild: StockBild): THREE.Group {
  const g = new THREE.Group();
  const st = plan.stockwerke[i];
  const R = plan.R;
  const richtung = bild.richtung ?? 1;
  const flach = !!bild.flach;
  const y0 = flach ? 0 : hoeheVon(i, richtung);
  g.position.x = versatzVon(i, R, flach);
  const boden: Punkt[] = [];
  const waende: Punkt[] = [];
  const offen = (x: number, y: number) => x >= 0 && y >= 0 && x < R && y < R && st.boden[y * R + x];
  const sonder = new Set<string>([
    ...st.raeume.flatMap(r => (r.flaeche ?? [[r.x, r.y]]).map(([x, y]) => `${x},${y}`)),
    ...(flach ? [] : [`${st.ziel}`, ...(i > 0 ? [`${st.start}`] : [])]),
  ]);
  // Ebene: die Wandfelder, in denen Türen sitzen, bleiben frei
  const tuerFelder = new Set<string>(flach ? [`${R - 1},${st.ziel[1]}`, ...(i > 0 ? [`0,${st.start[1]}`] : [])] : []);
  for (let y = 0; y < R; y++) {
    for (let x = 0; x < R; x++) {
      if (offen(x, y)) {
        if (!sonder.has(`${x},${y}`)) boden.push([x, y]);
        continue;
      }
      // Wände nur dort, wo sie an Flur grenzen — dazwischen bleibt Luft.
      let amFlur = false;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (offen(x + dx, y + dy)) amFlur = true;
      if (amFlur && !tuerFelder.has(`${x},${y}`)) waende.push([x, y]);
    }
  }
  const stilName = bild.stil ?? "klassisch";
  const F = STILE[stilName], A = AUSSEHEN[stilName];
  const dunkel = (f: number) => (bild.unten ? new THREE.Color(f).multiplyScalar(0.55).getHex() : f);
  const glut = A.glut && !bild.unten ? "glut" as const : undefined;
  const bodenStoff = (f: number) => musterMaterial(dunkel(f), A.boden, 2.2, {}, glut);
  // Bausatz aus Blender (gemauert, mit gebackenen Schatten) — solange er lädt, Klötze
  const K = A.organisch ? null : bausatz(stilName);
  const ton = bild.unten ? 0x8c8c8c : 0xffffff;
  if (K) {
    g.add(...bausatzBoden(K, boden, y0, i, ton));
  } else if (F.boden2 === undefined) g.add(klotzReihe(boden, bodenStoff(F.boden), 0.25, y0));
  else {
    // Fliesen: je ein breites Feld mit seinem schmalen Rand hat eine Farbe
    const hell = boden.filter(([x, y]) => (Math.floor(x / 2) + Math.floor(y / 2)) % 2 === 0);
    g.add(klotzReihe(hell, bodenStoff(F.boden), 0.25, y0));
    g.add(klotzReihe(boden.filter(p => !hell.includes(p)), bodenStoff(F.boden2), 0.25, y0));
  }
  // an den Wänden glimmt es nur schwach, am Boden stärker
  const wandStoff = musterMaterial(dunkel(F.wand), A.wand, 1.6, glut ? { emissiveIntensity: 0.45 } : {}, glut);
  if (A.organisch) {
    g.add(felsReihe(waende, wandStoff, bild.unten ? 0.5 : F.wandH, y0, i));
  } else if (K) {
    g.add(...bausatzWaende(K, waende, offen, y0, i, (bild.unten ? 0.5 : F.wandH) / 1.5, ton));
  } else {
    g.add(klotzReihe(waende, wandStoff, bild.unten ? 0.5 : F.wandH, y0));
    if (!bild.unten) g.add(klotzReihe(waende, F.oben, F.obenH, y0 + F.wandH));
  }
  if (A.ecken && !bild.unten) {
    const ecken = waende.filter(([x, y]) => x % 2 === 0 && y % 2 === 0);
    g.add(verzierung(A.ecken, ecken, F, y0, y0 + F.wandH + (A.organisch ? 0 : F.obenH), i));
  }

  // Stützen: an den Eckpfeilern bis hinunter zum Stockwerk darunter — nur wo
  // dort kein Flur ist, damit nichts im Weg steht.
  if (bild.ganz && i > 0) {
    const unter = plan.stockwerke[i - 1];
    const pfeiler = waende.filter(([x, y]) => x % 2 === 0 && y % 2 === 0 && x > 0 && y > 0 && x < R - 1 && y < R - 1
      && !unter.boden[y * R + x] && (x + y) % 4 === 0);
    const m = new THREE.InstancedMesh(box, new THREE.MeshLambertMaterial({ color: F.stuetze }), Math.max(1, pfeiler.length));
    m.count = pfeiler.length;
    const mat = new THREE.Matrix4();
    pfeiler.forEach(([x, y], k) => {
      mat.compose(new THREE.Vector3(welt(x), y0 - (richtung * STOCK_H) / 2, welt(y)), new THREE.Quaternion(), new THREE.Vector3(SCHMAL, STOCK_H, SCHMAL));
      m.setMatrixAt(k, mat);
    });
    g.add(m);
  }

  const rand = WEIT / 2 - 0.08;
  st.raeume.forEach((r, k) => {
    // Alles eines Zimmers in einer Gruppe: ein Klick auf irgendetwas darin
    // (Boden, Objekt, Schild) schickt die Figur hierher.
    const zg = new THREE.Group();
    zg.userData.ort = { art: "raum", raum: k };
    g.add(zg);
    const z = bild.zustaende[k] ?? "offen";
    const rx = welt(r.x), rz = welt(r.y);
    // Verlies: der ganze Saal in der Zimmerfarbe (gedämpft), die Mitte kräftig
    if (K) {
      // Bausatz: Steinplatten in der Zimmerfarbe, die Mitte glimmt — so sieht man den Zustand auch im Dunkeln
      const farbe = new THREE.Color(dunkel(RAUM_FARBE[z]));
      if (r.flaeche) {
        const rand = r.flaeche.filter(([x, y]) => x !== r.x || y !== r.y);
        zg.add(...bausatzBoden(K, rand, y0 + 0.02, i + 5, new THREE.Color(farbe).lerp(new THREE.Color(0xffffff), 0.3).getHex()));
      }
      zg.add(...bausatzBoden(K, [[r.x, r.y]], y0 + 0.05, i + 7, farbe.getHex(), bild.unten ? 0 : 0.12));
    } else {
      if (r.flaeche) {
        const rand = r.flaeche.filter(([x, y]) => x !== r.x || y !== r.y);
        zg.add(klotzReihe(rand, dunkel(new THREE.Color(RAUM_FARBE[z]).lerp(new THREE.Color(F.boden), 0.6).getHex()), 0.27, y0));
      }
      zg.add(klotz(dunkel(RAUM_FARBE[z]), WEIT, 0.3, WEIT, rx, y0, rz, F.leuchten && !bild.unten));
    }
    if (F.leuchten && !bild.unten) {
      // Neon: eine Lichtsäule über dem Zimmer, wie die roten Räume im Bild
      zg.add(klotz(F.licht ?? 0xff3b3b, WEIT * 0.96, 1.1, 0.08, rx, y0 + 0.3, rz - WEIT / 2 + 0.05, true));
    }
    if (bild.unten) return;
    // Das Objekt schaut zur Tür.
    const ding = baueObjekt(bild.objekte?.[k] ?? "pult", z === "geloest", k + i * 3);
    ding.position.set(rx, y0 + 0.3, rz);
    ding.rotation.y = Math.atan2(r.tuer[0] - r.x, r.tuer[1] - r.y);
    zg.add(ding);
    // Türrahmen im kurzen Durchgang davor, quer zur Laufrichtung
    const [tx, ty] = r.tuer;
    const quer = tx % 2 === 0; // Durchgang in x-Richtung → Rahmen steht entlang z
    const mx = welt(tx), mz = welt(ty);
    if (K?.bogen) {
      zg.add(bauReihe(K.bogen, [{ x: mx, y: y0 + 0.25, z: mz, dreh: quer ? Math.PI / 2 : 0 }]));
    } else {
      for (const s of [-rand, rand]) {
        zg.add(klotz(F.tuer, 0.16, 1.5, 0.16, mx + (quer ? 0 : s), y0 + 0.25, mz + (quer ? s : 0)));
      }
      zg.add(klotz(F.tuer, quer ? 0.18 : WEIT, 0.16, quer ? WEIT : 0.18, mx, y0 + 1.75, mz));
    }
    if (bild.ganz) return;
    const sp = schild(z === "info" || z === "gelesen" ? "i" : String(k + 1), "#111827",
      z === "geloest" ? "#bbf7d0" : z === "offen" ? "#fef3c7" : z === "info" ? "#dbeafe" : "#e2e8f0");
    sp.position.set(rx, y0 + 2.3, rz);
    zg.add(sp);
  });

  // Treppe bzw. Ausgang
  const zielG = new THREE.Group();
  zielG.userData.ort = { art: "ziel" };
  g.add(zielG);
  const [zx, zy] = [welt(st.ziel[0]), welt(st.ziel[1])];
  if (flach) {
    const tx = welt(R - 1) + SCHMAL / 2; // Grenze zum nächsten Abschnitt
    const letzte = bild.zielArt === "ausgang";
    wandtuer(zielG, tx, zy, y0, bild.zielOffen, letzte ? FARBE.ausgang : F.tuer, F.wandH + 0.2);
    // ein Streifen Boden unter der Tür, damit man sie auch offen trifft
    zielG.add(klotz(dunkel(F.boden), 2 * SCHMAL, 0.25, WEIT, tx, y0, zy));
  } else if (bild.zielArt === "treppe") {
    treppe(zielG, zx, zy, y0, richtung === 1, dunkel(F.treppe), eingang(offen, st.ziel), K, ton);
  } else {
    zielG.add(klotz(dunkel(FARBE.ausgang), WEIT, 0.3, WEIT, zx, y0, zy));
    if (!bild.unten) {
      for (const s of [-rand, rand]) zielG.add(klotz(FARBE.ausgang, 0.16, 1.8, 0.16, zx + s, y0 + 0.3, zy));
      zielG.add(klotz(FARBE.ausgang, WEIT, 0.16, 0.16, zx, y0 + 2.1, zy));
    }
  }
  // Der Boss steht im Durchgang vor Treppe bzw. Ausgang; ist die Tür offen, liegt er besiegt da.
  if (bild.waechter && !bild.unten) {
    const vor = flach ? st.ziel : [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [st.ziel[0] + dx, st.ziel[1] + dy] as Punkt)
      .find(([x, y]) => offen(x, y));
    if (vor && flach) {
      const boss = baueObjekt("boss", bild.zielOffen, i);
      boss.position.set(zx + 0.2, y0 + 0.25, zy + (bild.zielOffen ? WEIT * 0.3 : 0));
      boss.rotation.y = -Math.PI / 2;
      zielG.add(boss);
    } else if (vor) {
      const boss = baueObjekt("boss", bild.zielOffen, i);
      boss.position.set(welt(vor[0]) + (welt(vor[0]) - zx) * 0.3, y0 + 0.25, welt(vor[1]) + (welt(vor[1]) - zy) * 0.3);
      boss.rotation.y = Math.atan2(vor[0] - st.ziel[0], vor[1] - st.ziel[1]);
      zielG.add(boss);
    }
  }
  if (!bild.unten && !bild.ganz) {
    if (!bild.zielOffen && !flach) zielG.add(klotz(FARBE.gesperrt, WEIT * 0.9, 0.14, 0.14, zx, y0 + 1.0, zy + WEIT / 2 - 0.1));
    const pfeil = flach ? "➡" : richtung === 1 ? "⬆" : "⬇";
    const sp = schild(bild.zielOffen ? (bild.zielArt === "treppe" ? pfeil : "EXIT") : "🔒", "#111827", bild.zielOffen ? "#bbf7d0" : "#fecdd3");
    sp.position.set(flach ? welt(R - 1) + SCHMAL / 2 : zx, y0 + 2.8, zy);
    zielG.add(sp);
  }

  // Treppe zurück: dort, wo man auf diesem Stockwerk angekommen ist
  if (i > 0) {
    const zurueck = new THREE.Group();
    zurueck.userData.ort = { art: "zurueck" };
    g.add(zurueck);
    const [sx, sz] = [welt(st.start[0]), welt(st.start[1])];
    if (flach) zurueck.add(klotz(dunkel(F.boden), WEIT, 0.26, WEIT, sx, y0, sz));
    else if (richtung === 1) {
      // Haus: das Stockwerk darunter wird immer mitgezeichnet — seine Treppe kommt
      // hier durchs Loch herauf. Eine zweite Treppe im selben Raum flimmerte
      // (gleiche Flächen); darum nur eine unsichtbare Klickfläche über dem Loch.
      const flaeche = new THREE.Mesh(box, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
      flaeche.scale.set(WEIT, 0.05, WEIT);
      flaeche.position.set(sx, y0 + 0.25, sz);
      zurueck.add(flaeche);
    } else treppe(zurueck, sx, sz, y0, true, dunkel(F.treppe), eingang(offen, st.start), K, ton);
    if (!bild.unten && !bild.ganz) {
      const sp = schild(flach ? "⬅" : richtung === 1 ? "⬇" : "⬆", "#111827", "#e2e8f0");
      sp.position.set(sx, y0 + 2.4, sz);
      zurueck.add(sp);
    }
  }
  return g;
}

/** Ort, auf den ein Klick zielt: das erste getroffene Zimmer, die Treppe weiter oder die zurück. */
export type KlickOrt = { art: "raum"; raum: number } | { art: "ziel" } | { art: "zurueck" };

export function ortAmStrahl(stockwerk: THREE.Object3D, zeiger: THREE.Raycaster): KlickOrt | null {
  for (const treffer of zeiger.intersectObject(stockwerk, true)) {
    let o: THREE.Object3D | null = treffer.object;
    while (o && !o.userData.ort) o = o.parent;
    if (o) return o.userData.ort as KlickOrt;
  }
  return null;
}


/** Alles unterhalb eines Objekts freigeben */
export function entsorge(o: THREE.Object3D) {
  o.traverse(k => {
    const m = k as THREE.Mesh;
    // geteilte Geometrien und Muster (stoff.ts) bleiben für das nächste Stockwerk
    if (m.geometry && m.geometry !== box && !m.geometry.userData.geteilt) m.geometry.dispose();
    const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
    for (const mat of mats) {
      const map = (mat as THREE.SpriteMaterial).map;
      if (map && !map.userData.geteilt) map.dispose();
      mat.dispose();
    }
  });
}
