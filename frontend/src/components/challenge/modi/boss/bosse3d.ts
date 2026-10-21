/**
 * 3D-Bosse für die Kampfarena, aus einfachen Körpern gebaut wie die Avatare (gebaeude/avatar.ts).
 * Jede Figur steht mit y = 0 auf dem Boden und schaut nach +z; hoehe ist ihre ungefähre Größe.
 */
import * as THREE from "three";
import { baueAvatar } from "@/components/gebaeude/avatar";

const mat = (farbe: number, leuchtet = false) =>
  new THREE.MeshLambertMaterial(leuchtet ? { color: farbe, emissive: farbe, emissiveIntensity: 0.9 } : { color: farbe, flatShading: true });

function teil(g: THREE.Object3D, geo: THREE.BufferGeometry, farbe: number, x: number, y: number, z: number, leuchtet = false) {
  const m = new THREE.Mesh(geo, mat(farbe, leuchtet));
  m.position.set(x, y, z);
  g.add(m);
  return m;
}
const kugel = (g: THREE.Object3D, farbe: number, r: number, x: number, y: number, z: number, leuchtet = false) => teil(g, new THREE.SphereGeometry(r, 18, 12), farbe, x, y, z, leuchtet);
const kegel = (g: THREE.Object3D, farbe: number, r: number, h: number, x: number, y: number, z: number) => teil(g, new THREE.ConeGeometry(r, h, 8), farbe, x, y, z);
const zyl = (g: THREE.Object3D, farbe: number, r: number, h: number, x: number, y: number, z: number) => teil(g, new THREE.CylinderGeometry(r, r * 1.1, h, 10), farbe, x, y, z);
/** Flacher Flügel aus einem Dreieck mit Zacken */
function fluegel(g: THREE.Object3D, farbe: number, s: 1 | -1) {
  const f = new THREE.Shape();
  f.moveTo(0, 0); f.lineTo(s * 1.6, 0.9); f.lineTo(s * 1.4, 0.2); f.lineTo(s * 1.9, -0.1); f.lineTo(s * 1.2, -0.3); f.lineTo(s * 1.4, -0.8); f.lineTo(0, -0.3);
  const m = teil(g, new THREE.ShapeGeometry(f), farbe, s * 0.55, 1.9, -0.35);
  (m.material as THREE.MeshLambertMaterial).side = THREE.DoubleSide;
  m.rotation.y = s * 0.5;
  return m;
}
const augen = (g: THREE.Object3D, farbe: number, abstand: number, y: number, z: number, r = 0.09) => {
  for (const s of [-1, 1]) kugel(g, farbe, r, s * abstand, y, z, true);
};

function drache() {
  const g = new THREE.Group(), GRUEN = 0x3f9b4a, DUNKEL = 0x2a6b33, BAUCH = 0xe8d56a;
  kugel(g, GRUEN, 0.9, 0, 1.2, 0).scale.set(1, 1.1, 1.3);
  kugel(g, BAUCH, 0.7, 0, 1.15, 0.55).scale.set(0.9, 1, 0.5);
  zyl(g, GRUEN, 0.32, 0.9, 0, 1.95, 0.45).rotation.x = 0.5;
  kugel(g, GRUEN, 0.45, 0, 2.45, 0.75).scale.set(1, 0.85, 1.2);
  kugel(g, GRUEN, 0.3, 0, 2.32, 1.18).scale.set(1, 0.7, 1.2);
  augen(g, 0xff3b30, 0.22, 2.58, 1.0);
  for (const s of [-1, 1]) { const h = kegel(g, BAUCH, 0.08, 0.45, s * 0.22, 2.9, 0.55); h.rotation.x = -0.7; }
  for (const s of [-1, 1] as const) fluegel(g, DUNKEL, s);
  for (let i = 0; i < 5; i++) kugel(g, GRUEN, 0.32 - i * 0.05, 0, 0.75 - i * 0.08, -1.0 - i * 0.38);
  for (let i = 0; i < 4; i++) kegel(g, DUNKEL, 0.1, 0.3, 0, 2.05 - i * 0.28, -0.35 - i * 0.3).rotation.x = -0.4;
  for (const [x, z] of [[-0.5, 0.45], [0.5, 0.45], [-0.5, -0.5], [0.5, -0.5]]) zyl(g, DUNKEL, 0.17, 0.6, x, 0.3, z);
  return g;
}

function monster() {
  const g = new THREE.Group(), LILA = 0x8a4fd0, DUNKEL = 0x5a2f90;
  kugel(g, LILA, 1.1, 0, 1.15, 0).scale.set(1, 0.95, 1);
  kugel(g, 0xffffff, 0.38, 0, 1.45, 0.9);
  kugel(g, 0x111111, 0.17, 0, 1.47, 1.22);
  kugel(g, 0xff3b30, 0.06, 0, 1.49, 1.37, true);
  const mund = teil(g, new THREE.TorusGeometry(0.4, 0.07, 8, 20, Math.PI), 0x2a0f3a, 0, 0.85, 0.98);
  mund.rotation.z = Math.PI;
  for (let i = 0; i < 5; i++) kegel(g, 0xffffff, 0.06, 0.18, -0.28 + i * 0.14, 0.78, 1.0).rotation.x = Math.PI;
  for (const s of [-1, 1]) {
    kegel(g, DUNKEL, 0.15, 0.5, s * 0.55, 2.2, 0.1).rotation.z = -s * 0.5;
    kugel(g, LILA, 0.25, s * 1.05, 1.0, 0.3);
    kugel(g, DUNKEL, 0.3, s * 0.5, 0.15, 0.2).scale.set(1, 0.5, 1.3);
  }
  return g;
}

function bestie() {
  const g = new THREE.Group(), ORANGE = 0xe0703a, HELL = 0xf3b184, ROT = 0xc4291c;
  kugel(g, ORANGE, 0.85, 0, 1.15, 0).scale.set(1.1, 1, 1.4);
  kugel(g, HELL, 0.6, 0, 1.0, 0.6).scale.set(0.9, 0.9, 0.6);
  kugel(g, ORANGE, 0.6, 0, 1.95, 0.95);
  kugel(g, HELL, 0.3, 0, 1.8, 1.4).scale.set(1.1, 0.8, 1);
  augen(g, 0xfff27a, 0.25, 2.08, 1.38, 0.1);
  for (const s of [-1, 1]) {
    const h = kegel(g, ROT, 0.12, 0.6, s * 0.35, 2.55, 0.85); h.rotation.z = -s * 0.4;
    kegel(g, ORANGE, 0.14, 0.3, s * 0.5, 2.35, 0.7).rotation.z = -s * 0.9;
  }
  for (let i = 0; i < 6; i++) kegel(g, ROT, 0.12, 0.4, 0, 2.0 - i * 0.12, 0.3 - i * 0.3).rotation.x = -0.6;
  for (let i = 0; i < 4; i++) kugel(g, ORANGE, 0.22 - i * 0.04, 0, 1.0 + i * 0.15, -1.15 - i * 0.3);
  for (const [x, z] of [[-0.55, 0.6], [0.55, 0.6], [-0.55, -0.6], [0.55, -0.6]]) zyl(g, 0x3b1a14, 0.2, 0.55, x, 0.28, z);
  return g;
}

function rapper() {
  const g = baueAvatar({ klasse: "rapper", form: "m", haut: 2 });
  g.scale.setScalar(2.2);
  return g;
}

const BAU: Record<string, { bau: () => THREE.Object3D; hoehe: number }> = {
  monster: { bau: drache, hoehe: 3.0 },
  rap: { bau: rapper, hoehe: 2.9 },
  prinzessin: { bau: monster, hoehe: 2.4 },
  einhorn: { bau: bestie, hoehe: 2.6 },
};

/** Der Boss eines Skins (unbekannte Skins: der Drache) */
export function baueBoss(skin: string): { modell: THREE.Object3D; hoehe: number } {
  const b = BAU[skin] ?? BAU.monster;
  return { modell: b.bau(), hoehe: b.hoehe };
}
