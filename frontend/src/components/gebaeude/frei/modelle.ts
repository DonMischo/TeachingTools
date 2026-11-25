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
import { weltStoff } from "./weltstoff";

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

const texturStoffe = new Map<string, THREE.MeshLambertMaterial>();

/**
 * Teile mit Kacheltextur: Fels-Material in Weltkoordinaten (weltstoff.ts), eins je Textur und Seite;
 * Kalk (Tropfsteine) mit 2,8 m je Kachel, Fels mit 4,2 m. Sonst null.
 */
export function texturStoff(teil: KitTeil, doppelt = false): THREE.MeshLambertMaterial | null {
  if (!teil.map) return null;
  const schluessel = `${teil.map.uuid}|${teil.normalMap?.uuid ?? ""}|${doppelt ? 2 : 1}`;
  let m = texturStoffe.get(schluessel);
  if (!m) {
    const kalk = /kalk/i.test(teil.stoffName ?? "");
    m = weltStoff(teil.map, teil.normalMap ?? null, { kachel: kalk ? 2.8 : 4.2, doppelseitig: doppelt });
    texturStoffe.set(schluessel, m);
  }
  return m;
}

// ── Baukästen aus der Weltenwerkstatt ────────────────────────────────────
// Fertig gefärbte Modelle (Eckenfarben mit eingebackener Verdeckung), gebaut in TT-Weltenwerkstatt
// (blender/<welt>.py) und als /modelle/welten/<welt>.glb abgelegt. Leuchtende Teile tragen `glut`.

/** Teil eines Baukastens; manche tragen eine Kacheltextur (Endfarbe = Textur × Eckenfarbe, z. B. Fels der Höhle) */
export interface KitTeil { geo: THREE.BufferGeometry; glut: boolean; map?: THREE.Texture; normalMap?: THREE.Texture; stoffName?: string }
/**
 * Stoff für leuchtende Teile: unbeleuchtet in der eigenen Eckenfarbe × `hell`, beidseitig (die Modelle der
 * Weltenwerkstatt sind beidseitig gebaut; einseitig fehlen Kristallen und Flammen ganze Flächen).
 * `facetten`: jede Fläche bekommt ihre eigene Helligkeit nach Lage zum Blick und zu einem gedachten
 * Oberlicht, die Kanten zum Rand hin leuchten auf — so liest sich ein Kristall als geschliffener Stein
 * statt als flacher Umriss.
 * Leuchtende Teile schreiben Alpha 2 ins Zwischenbild: daran erkennt der Malfilter, was leuchten darf
 * (beleuchtete Flächen wie die Figur unter ihrem Licht müssen viel heller sein, um zu strahlen).
 */
export function glutStoff(hell: number, facetten = false): THREE.MeshBasicMaterial {
  const m = new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(hell, hell, hell), side: THREE.DoubleSide });
  m.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace("#include <opaque_fragment>", "#include <opaque_fragment>\ngl_FragColor.a = 2.0;");
    if (!facetten) return;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vFacBlick;")
      .replace("#include <project_vertex>", "#include <project_vertex>\nvFacBlick = -mvPosition.xyz;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vFacBlick;")
      .replace("#include <color_fragment>", `#include <color_fragment>
        {
          vec3 blick = normalize(vFacBlick);
          vec3 n = normalize(cross(dFdx(vFacBlick), dFdy(vFacBlick)));
          if (dot(n, blick) < 0.0) n = -n;
          float zu = clamp(dot(n, blick), 0.0, 1.0);
          float oben = max(dot(n, normalize(vec3(-0.35, 0.85, 0.4))), 0.0);
          diffuseColor.rgb *= 0.62 + 0.42 * oben + 0.55 * pow(1.0 - zu, 2.5);
        }`);
  };
  m.customProgramCacheKey = () => (facetten ? "glut-facetten" : "glut");
  return m;
}

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
      const stoff = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.MeshStandardMaterial | undefined;
      teile[m.name] = { geo: g, glut: !!(m.userData.glut ?? m.parent?.userData.glut), map: stoff?.map ?? undefined, normalMap: stoff?.normalMap ?? undefined, stoffName: stoff?.name };
    });
    kits.set(name, teile);
    return true;
  }).catch(() => false);
  kitLaden.set(name, p);
  return p;
}
