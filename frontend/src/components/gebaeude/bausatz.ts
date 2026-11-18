/**
 * Bausatz aus Blender (scripts/bausatz/baue.py → /modelle/bausatz/<stil>.glb): gemauerte Wände,
 * Eckpfeiler, Steinplatten, Torbögen und Stufen statt glatter Klötze. Die Teile tragen ihre Farbe
 * samt gebackener Umgebungsverdeckung je Ecke; ein Teil `<name>__glut` (Fackelflamme) leuchtet.
 *
 * Wird je Stil einmal geladen; bis dahin (und ohne WebGL2, z. B. in Tests) baut szene.ts Klötze.
 */
import { useEffect, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import type { Stil } from "./szene";

/** Stile, für die es einen Bausatz gibt */
export const BAUSAETZE: readonly Stil[] = ["verlies"];

/** ein Teil: Stein (Eckenfarbe) und ggf. das, was leuchtet */
export interface BauTeil { geo: THREE.BufferGeometry; glut?: THREE.BufferGeometry }
export type Bausatz = Record<string, BauTeil>;

const fertig = new Map<Stil, Bausatz>();
const laden = new Map<Stil, Promise<boolean>>();
let lader: GLTFLoader | null = null;

export function hatBausatz(stil: Stil | undefined): stil is Stil {
  return !!stil && BAUSAETZE.includes(stil);
}

/** die Teile eines Stils nach Namen (ohne Stil-Vorsilbe), sobald geladen — sonst null */
export function bausatz(stil: Stil | undefined): Bausatz | null {
  return (stil && fertig.get(stil)) || null;
}

/** einmal je Stil laden; `true`, wenn der Bausatz da ist */
export function ladeBausatz(stil: Stil | undefined): Promise<boolean> {
  if (!hatBausatz(stil)) return Promise.resolve(false);
  const da = laden.get(stil);
  if (da) return da;
  if (typeof window === "undefined" || !("WebGL2RenderingContext" in window)) return Promise.resolve(false);
  if (!lader) {
    const draco = new DRACOLoader();
    draco.setDecoderPath("/draco/");
    lader = new GLTFLoader();
    lader.setDRACOLoader(draco);
  }
  const p = lader.loadAsync(`/modelle/bausatz/${stil}.glb`).then(gltf => {
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
      const name = voll.slice(stil.length + 1);
      teile[name] = { ...teile[name], ...(glut ? { glut: g } : { geo: g }) };
    });
    fertig.set(stil, teile);
    return true;
  }).catch(() => false);
  laden.set(stil, p);
  return p;
}

/**
 * Lädt die Bausätze der genannten Stile; die Zahl steigt, sobald einer da ist — in den
 * Schlüssel zum Neubauen aufnehmen, dann tauschen die Klötze gegen Mauerwerk.
 */
export function useBausatz(stile: (Stil | undefined)[]): number {
  const [nr, setNr] = useState(0);
  const schluessel = [...new Set(stile.filter(hatBausatz))].sort().join(",");
  useEffect(() => {
    let an = true;
    for (const s of schluessel ? schluessel.split(",") as Stil[] : []) {
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
