/**
 * Erkennbare Modelle der echten Raumfahrzeuge (ISS, Hubble, GPS …), aus
 * Grundkörpern zusammengesteckt. Maße in Vielfachen von `r` (dem Flug-Radius),
 * grob nach den echten Proportionen — die ISS ist breiter als lang, Hubble ein
 * Rohr mit zwei Flügeln, Meteosat eine sich drehende Trommel.
 *
 * Alle Teile hängen am Rumpf; so dreht sich das ganze Fahrzeug mit, und ein
 * Klick auf ein Sonnensegel trifft genauso wie einer auf den Rumpf.
 */
import * as THREE from "three";

const MAT = {
  silber: () => new THREE.MeshStandardMaterial({ color: 0xd4d8de, roughness: 0.35, metalness: 0.8 }),
  weiss: () => new THREE.MeshStandardMaterial({ color: 0xeef0f2, roughness: 0.6, metalness: 0.1 }),
  gold: () => new THREE.MeshStandardMaterial({ color: 0xd9a540, roughness: 0.3, metalness: 0.9 }),
  segel: () => new THREE.MeshStandardMaterial({ color: 0x1d2c5c, roughness: 0.35, metalness: 0.7, emissive: 0x050a1a }),
  segelGold: () => new THREE.MeshStandardMaterial({ color: 0x8a6a2a, roughness: 0.4, metalness: 0.7 }),
  dunkel: () => new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.7, metalness: 0.3 }),
};

type Teil = THREE.Mesh;

function quader(m: THREE.Material, x: number, y: number, z: number): Teil {
  return new THREE.Mesh(new THREE.BoxGeometry(x, y, z), m);
}
/** Zylinder entlang z */
function rohr(m: THREE.Material, radius: number, laenge: number, oben = radius, seg = 20): Teil {
  const t = new THREE.Mesh(new THREE.CylinderGeometry(oben, radius, laenge, seg), m);
  t.geometry.rotateX(Math.PI / 2);
  return t;
}
function bei<T extends THREE.Object3D>(t: T, x: number, y: number, z: number): T {
  t.position.set(x, y, z);
  return t;
}

/** Ein Sonnensegel in der xz-Ebene, mit Mittelsteg wie bei echten Flügeln. */
function segel(m: THREE.Material, laenge: number, breite: number, steg: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  g.add(quader(m, laenge, breite * 0.03, breite));
  g.add(quader(steg, laenge, breite * 0.06, breite * 0.05));
  return g;
}

function iss(r: number, rumpf: Teil) {
  const s = MAT.silber(), w = MAT.weiss(), sg = MAT.segelGold();
  // Gitterträger quer, Module längs
  rumpf.add(quader(s, r * 6, r * 0.12, r * 0.12));
  rumpf.add(bei(rohr(w, r * 0.16, r * 1.5), 0, 0, -r * 0.6));
  rumpf.add(bei(rohr(w, r * 0.13, r * 0.6), 0, -r * 0.15, r * 0.4));
  rumpf.add(bei(rohr(w, r * 0.12, r * 0.7), r * 0.4, 0, -r * 1));
  // acht Flügel an den Enden, je zwei übereinander
  for (const x of [-2.6, -2.1, 2.1, 2.6]) {
    for (const z of [-1, 1]) {
      rumpf.add(bei(segel(sg, r * 0.4, r * 1.6, s), x * r, 0, z * r * 0.95));
    }
  }
  // Radiatoren, weiß und quer gestellt
  for (const x of [-0.9, 0.9]) {
    const rad = quader(w, r * 0.5, r * 0.02, r * 1.0);
    rad.rotation.z = Math.PI / 2;
    rumpf.add(bei(rad, x * r, -r * 0.5, 0));
  }
}

function tiangong(r: number, rumpf: Teil) {
  const w = MAT.weiss(), sg = MAT.segel(), s = MAT.silber();
  rumpf.add(rohr(w, r * 0.28, r * 1.6));
  for (const x of [-1, 1]) {
    const lab = rohr(w, r * 0.24, r * 1.5);
    lab.rotation.y = Math.PI / 2;
    rumpf.add(bei(lab, x * r * 0.75, 0, -r * 0.8));
    rumpf.add(bei(segel(sg, r * 1.6, r * 0.6, s), x * r * 2.1, 0, -r * 0.8));
  }
  rumpf.add(bei(segel(sg, r * 2.2, r * 0.45, s), 0, 0, r * 0.4));
}

function hubble(r: number, rumpf: Teil) {
  const s = MAT.silber(), sg = MAT.segel(), d = MAT.dunkel();
  rumpf.add(rohr(s, r * 0.42, r * 2.4));
  rumpf.add(bei(rohr(s, r * 0.32, r * 0.5), 0, 0, r * 1.45));
  // Öffnung mit aufgeklappter Klappe
  const loch = new THREE.Mesh(new THREE.CircleGeometry(r * 0.38, 20), d);
  rumpf.add(bei(loch, 0, 0, -r * 1.205)).rotation.y = Math.PI;
  const klappe = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.42, r * 0.42, r * 0.03, 20), s);
  rumpf.add(bei(klappe, 0, r * 0.42, -r * 1.55)).rotation.x = -0.3;
  for (const x of [-1, 1]) rumpf.add(bei(segel(sg, r * 1.8, r * 0.55, s), x * r * 1.4, 0, r * 0.3));
}

function chandra(r: number, rumpf: Teil) {
  const g = MAT.gold(), s = MAT.silber(), sg = MAT.segel();
  rumpf.add(rohr(g, r * 0.36, r * 2.6, r * 0.3, 6));
  rumpf.add(bei(rohr(s, r * 0.5, r * 0.6), 0, 0, r * 1.4));
  for (const x of [-1, 1]) rumpf.add(bei(segel(sg, r * 1.7, r * 0.5, s), x * r * 1.4, 0, r * 1.4));
}

function sentinel(r: number, rumpf: Teil) {
  const g = MAT.gold(), s = MAT.silber(), sg = MAT.segel(), d = MAT.dunkel();
  rumpf.add(quader(g, r * 0.9, r * 1.1, r * 1.5));
  rumpf.add(bei(quader(d, r * 0.5, r * 0.35, r * 0.5), 0, -r * 0.7, -r * 0.3));
  // ein einziger langer Flügel, schräg nach oben
  const f = segel(sg, r * 2.6, r * 0.8, s);
  f.rotation.z = 0.35;
  rumpf.add(bei(f, r * 1.75, r * 0.4, 0));
}

function gps(r: number, rumpf: Teil) {
  const g = MAT.gold(), s = MAT.silber(), sg = MAT.segel(), w = MAT.weiss();
  rumpf.add(quader(g, r * 0.9, r * 0.9, r * 1.0));
  for (const x of [-1, 1]) rumpf.add(bei(segel(sg, r * 2.0, r * 0.75, s), x * r * 1.6, 0, 0));
  // Antennenfeld zur Erde: kleine Wendeln
  for (let i = 0; i < 9; i++) {
    const a = rohr(w, r * 0.05, r * 0.3);
    a.rotation.x = Math.PI / 2;
    rumpf.add(bei(a, ((i % 3) - 1) * r * 0.25, -r * 0.6, (Math.floor(i / 3) - 1) * r * 0.25));
  }
}

function meteosat(r: number, rumpf: Teil) {
  const sg = MAT.segel(), s = MAT.silber(), d = MAT.dunkel();
  // Trommel mit Solarzellen rundum, dreht sich um die Hochachse
  const trommel = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.9, r * 0.9, r * 1.3, 24, 1, true), sg);
  rumpf.add(trommel);
  rumpf.add(bei(new THREE.Mesh(new THREE.CylinderGeometry(r * 0.9, r * 0.9, r * 0.05, 24), s), 0, r * 0.65, 0));
  rumpf.add(bei(new THREE.Mesh(new THREE.CylinderGeometry(r * 0.9, r * 0.9, r * 0.05, 24), s), 0, -r * 0.65, 0));
  rumpf.add(bei(new THREE.Mesh(new THREE.CylinderGeometry(r * 0.15, r * 0.2, r * 0.9, 12), s), 0, r * 1.1, 0));
  rumpf.add(bei(new THREE.Mesh(new THREE.ConeGeometry(r * 0.35, r * 0.25, 16), d), 0, r * 1.6, 0));
}

const MODELLE: Partial<Record<string, (r: number, rumpf: Teil) => void>> = { iss, tiangong, hubble, chandra, sentinel, gps, meteosat };

/**
 * Rumpf eines Raumfahrzeugs mit allen Anbauten als Kindern. Unbekannte Ids
 * bekommen das alte Allzweckmodell: Kasten mit zwei Segeln.
 */
export function baueFahrzeug(id: string, farbe: string, r: number): THREE.Mesh {
  const modell = MODELLE[id];
  // Der Rumpf selbst ist bei den meisten Modellen nur ein unsichtbarer Träger.
  const rumpf = modell
    ? new THREE.Mesh(new THREE.BoxGeometry(r * 0.2, r * 0.2, r * 0.2), new THREE.MeshBasicMaterial({ visible: false }))
    : new THREE.Mesh(
      new THREE.BoxGeometry(r * 1.1, r * 0.85, r * 1.7),
      new THREE.MeshStandardMaterial({ color: new THREE.Color(farbe), roughness: 0.5, metalness: 0.45 }),
    );
  if (modell) modell(r, rumpf);
  else for (const x of [-1, 1]) rumpf.add(bei(segel(MAT.segel(), r * 2.4, r * 1.05, MAT.silber()), x * r * 1.85, 0, 0));
  rumpf.traverse(t => { t.userData.id = id; });
  return rumpf;
}
