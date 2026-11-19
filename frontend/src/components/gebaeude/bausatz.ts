/**
 * Bausatz aus Blender (scripts/bausatz/baue.py → /modelle/bausatz/<stil>.glb): gemauerte Wände,
 * Eckpfeiler, Steinplatten, Torbögen und Stufen statt glatter Klötze. Die Teile tragen ihre Farbe
 * samt gebackener Umgebungsverdeckung je Ecke; ein Teil `<name>__glut` (Fackelflamme) leuchtet.
 *
 * Wird je Bausatz einmal geladen; bis dahin (und ohne WebGL2, z. B. in Tests) baut szene.ts Klötze.
 *
 * Die Gebäude der freien 3D-Ansicht nehmen die Ausstattung aus verlies3d.glb (scripts/bausatz/verlies3d.py)
 * und je Stil einen Kachelsatz: /modelle/bausatz/kacheln/<stil>/<mauer|boden|decke>_<farbe|normal>.jpg
 * (scripts/bausatz/kacheln.py).
 */
import { useEffect, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import type { Stil } from "./szene";

/** Bausätze mit Modellen: 2,5D-Verlies und die Ausstattung der 3D-Gebäude */
export const BAUSAETZE: readonly string[] = ["verlies", "verlies3d"];

/** Stile mit Kacheln für die 3D-Gebäude (scripts/bausatz/kacheln.py → kacheln/<stil>/…) */
export const KACHEL_STILE: readonly Stil[] = [
  "verlies", "burg", "gotisch", "mittelalter", "antike", "klassisch", "viktorianisch", "retro",
  "holz", "eis", "wueste", "beton", "raumstation", "neon",
];
const KACHELN = ["mauer", "boden", "decke"];

/** Name des Kachelsatzes eines Stils (für ladeBausatz, bauKacheln, useBausatz) */
export const kachelName = (stil: Stil) => `kacheln/${stil}`;

/** ein Teil: Stein (Eckenfarbe) und ggf. das, was leuchtet */
export interface BauTeil { geo: THREE.BufferGeometry; glut?: THREE.BufferGeometry }
export type Bausatz = Record<string, BauTeil>;
/** Kachel: Farbe (mit gebackenen Schatten) und Normalen, kachelbar (RepeatWrapping) */
export interface Kachel { farbe: THREE.Texture; normal: THREE.Texture }

const fertig = new Map<string, Bausatz>();
const kachelnFertig = new Map<string, Record<string, Kachel>>();
const laden = new Map<string, Promise<boolean>>();
let lader: GLTFLoader | null = null;

export function hatBausatz(name: string | undefined): name is string {
  return !!name && (BAUSAETZE.includes(name) || KACHEL_STILE.some(s => kachelName(s) === name));
}

/** die Teile eines Bausatzes nach Namen (ohne Vorsilbe), sobald geladen — sonst null */
export function bausatz(name: string | undefined): Bausatz | null {
  return (name && fertig.get(name)) || null;
}

/** die Kacheln eines Bausatzes, sobald geladen — sonst null */
export function bauKacheln(name: string | undefined): Record<string, Kachel> | null {
  return (name && kachelnFertig.get(name)) || null;
}

function ladeKachel(name: string, kachel: string): Promise<Kachel> {
  const tl = new THREE.TextureLoader();
  const eine = (art: string) => tl.loadAsync(`/modelle/bausatz/${name}/${kachel}_${art}.jpg`).then(t => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    t.colorSpace = art === "farbe" ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.userData.geteilt = true;
    return t;
  });
  return Promise.all([eine("farbe"), eine("normal")]).then(([farbe, normal]) => ({ farbe, normal }));
}

/** einmal je Bausatz laden (Modelle und Kacheln); `true`, wenn alles da ist */
export function ladeBausatz(name: string | undefined): Promise<boolean> {
  if (!hatBausatz(name)) return Promise.resolve(false);
  const da = laden.get(name);
  if (da) return da;
  if (typeof window === "undefined" || !("WebGL2RenderingContext" in window)) return Promise.resolve(false);
  if (!lader) {
    const draco = new DRACOLoader();
    draco.setDecoderPath("/draco/");
    lader = new GLTFLoader();
    lader.setDRACOLoader(draco);
  }
  // Kachelsatz: nur Texturen
  if (!BAUSAETZE.includes(name)) {
    const p = Promise.all(KACHELN.map(k => ladeKachel(name, k).then(t => [k, t] as const)))
      .then(ks => { kachelnFertig.set(name, Object.fromEntries(ks)); return true; })
      .catch(() => false);
    laden.set(name, p);
    return p;
  }
  const modelle = lader.loadAsync(`/modelle/bausatz/${name}.glb`).then(gltf => {
    const teile: Bausatz = {};
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse(o => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const g = m.geometry.clone();
      g.applyMatrix4(m.matrixWorld);
      g.userData.geteilt = true;
      // Namen: verlies_mauer3 bzw. verlies_mauer3__glut
      const [voll, glut] = m.name.split("__");
      const teil = voll.slice(name.length + 1);
      teile[teil] = { ...teile[teil], ...(glut ? { glut: g } : { geo: g }) };
    });
    return teile;
  });
  const p = modelle.then(teile => { fertig.set(name, teile); return true; }).catch(() => false);
  laden.set(name, p);
  return p;
}

/**
 * Lädt die genannten Bausätze; die Zahl steigt, sobald einer da ist — in den
 * Schlüssel zum Neubauen aufnehmen, dann tauschen die Klötze gegen Mauerwerk.
 */
export function useBausatz(namen: (Stil | string | undefined)[]): number {
  const [nr, setNr] = useState(0);
  const schluessel = [...new Set(namen.filter(hatBausatz))].sort().join(",");
  useEffect(() => {
    let an = true;
    for (const s of schluessel ? schluessel.split(",") : []) {
      if (fertig.has(s)) continue;
      ladeBausatz(s).then(ok => { if (an && ok) setNr(n => n + 1); });
    }
    return () => { an = false; };
  }, [schluessel]);
  return nr;
}

/** wo ein Teil steht: Fußpunkt, Drehung um die Hochachse, Streckung in der Höhe, Farbe (Vorgabe: weiß) */
export interface Lage { x: number; y: number; z: number; dreh?: number; hoch?: number; farbe?: THREE.Color }

/**
 * Viele gleiche Teile als InstancedMesh (Stein und Glut je eine). `farbe` färbt alle (Abdunkeln
 * unterer Stockwerke, Zimmerfarbe), `leuchten` lässt den Stein selbst etwas glimmen.
 */
export function bauReihe(teil: BauTeil, lagen: Lage[], farbe = 0xffffff, leuchten = 0): THREE.Group {
  const g = new THREE.Group();
  const n = Math.max(1, lagen.length);
  const mx = new THREE.Matrix4(), q = new THREE.Quaternion(), oben = new THREE.Vector3(0, 1, 0);
  const stein = new THREE.MeshLambertMaterial({ color: farbe, vertexColors: true });
  if (leuchten) { stein.emissive = new THREE.Color(farbe); stein.emissiveIntensity = leuchten; }
  const teile: [THREE.BufferGeometry, THREE.Material][] = [[teil.geo, stein]];
  if (teil.glut) teile.push([teil.glut, new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })]);
  for (const [geo, mat] of teile) {
    const m = new THREE.InstancedMesh(geo, mat, n);
    lagen.forEach((l, k) => {
      mx.compose(new THREE.Vector3(l.x, l.y, l.z), q.setFromAxisAngle(oben, l.dreh ?? 0), new THREE.Vector3(1, l.hoch ?? 1, 1));
      m.setMatrixAt(k, mx);
      if (l.farbe) m.setColorAt(k, l.farbe);
    });
    m.count = lagen.length;
    g.add(m);
  }
  return g;
}
