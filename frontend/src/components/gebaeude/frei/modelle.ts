/**
 * Modelle der 3D-Welt aus Blender (scripts/welten/baue.py → /modelle/welten/welten.glb):
 * Laubbäume, Tannen, Palmen, Felsen, Büsche, Kaktus, Baumstumpf. Jedes Modell besteht aus Teilen
 * (`laubbaum1_stamm`, `laubbaum1_krone` …), die nur Helligkeit je Ecke tragen — die Farbe kommt je
 * Stück aus der Palette der Welt (instanceColor).
 *
 * Wird einmal geladen; bis dahin (und ohne WebGL2, z. B. in Tests) baut welt.ts die Formen selbst.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";

export const MODELL_URL = "/modelle/welten/welten.glb";

/** wie viele Fassungen es je Modell gibt (laubbaum1 … laubbaum3) */
export const FASSUNGEN = { laubbaum: 3, tanne: 2, palme: 2, fels: 3, busch: 2, kaktus: 1, stumpf: 1 } as const;
export type ModellArt = keyof typeof FASSUNGEN;

let fertig: Record<string, THREE.BufferGeometry> | null = null;
let laden: Promise<boolean> | null = null;

/** die Teile nach Namen, sobald geladen (sonst null) */
export function weltModelle(): Record<string, THREE.BufferGeometry> | null {
  return fertig;
}

/** einmal laden; `true`, wenn die Modelle da sind */
export function ladeWeltModelle(): Promise<boolean> {
  if (laden) return laden;
  if (typeof window === "undefined" || !("WebGL2RenderingContext" in window)) return (laden = Promise.resolve(false));
  const draco = new DRACOLoader();
  draco.setDecoderPath("/draco/");
  const lader = new GLTFLoader();
  lader.setDRACOLoader(draco);
  laden = lader.loadAsync(MODELL_URL).then(gltf => {
    const teile: Record<string, THREE.BufferGeometry> = {};
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse(o => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      // Lage des Knotens in die Geometrie: dann steht jedes Teil im eigenen Ursprung wie in Blender
      const g = m.geometry.clone();
      g.applyMatrix4(m.matrixWorld);
      g.computeVertexNormals();
      g.userData.geteilt = true;
      teile[m.name] = g;
    });
    fertig = teile;
    return true;
  }).catch(() => false);
  return laden;
}

// ── Baukästen aus der Weltenwerkstatt ────────────────────────────────────
// Fertig gefärbte Modelle (Eckenfarben mit eingebackener Verdeckung), gebaut in TT-Weltenwerkstatt
// (blender/<welt>.py) und als /modelle/welten/<welt>.glb abgelegt. Leuchtende Teile tragen `glut`.

export interface KitTeil { geo: THREE.BufferGeometry; glut: boolean }
const kits = new Map<string, Record<string, KitTeil>>();
const kitLaden = new Map<string, Promise<boolean>>();

/** die Teile eines Baukastens, sobald geladen (sonst null) */
export function kit(name: string): Record<string, KitTeil> | null {
  return kits.get(name) ?? null;
}

/** einmal laden; `true`, wenn der Baukasten da ist */
export function ladeKit(name: string): Promise<boolean> {
  const schon = kitLaden.get(name);
  if (schon) return schon;
  if (typeof window === "undefined" || !("WebGL2RenderingContext" in window)) return Promise.resolve(false);
  const draco = new DRACOLoader();
  draco.setDecoderPath("/draco/");
  const lader = new GLTFLoader();
  lader.setDRACOLoader(draco);
  const p = lader.loadAsync(`/modelle/welten/${name}.glb`).then(gltf => {
    const teile: Record<string, KitTeil> = {};
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse(o => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const g = m.geometry.clone();
      g.applyMatrix4(m.matrixWorld);
      g.userData.geteilt = true;
      teile[m.name] = { geo: g, glut: !!(m.userData.glut ?? m.parent?.userData.glut) };
    });
    kits.set(name, teile);
    return true;
  }).catch(() => false);
  kitLaden.set(name, p);
  return p;
}
