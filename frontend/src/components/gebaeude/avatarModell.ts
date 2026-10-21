/**
 * Die neuen Avatare (Blender, scripts/avatare) als .glb: einmal laden, im Toon-Look, Haut in der gewählten Farbe.
 * baueAvatar() baut sofort die alte Figur und tauscht sie gegen das Modell, sobald es geladen ist
 * (ohne WebGL, z. B. in jsdom, bleibt die gebaute Figur).
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { toonStil } from "@/lib/angriffe/toon";

/** Größe der Modelle relativ zur alten Figur (Chibi-Kopf, sonst gleich hoch) */
const MASSSTAB = 0.88;

let lader: GLTFLoader | null = null;
const vorlagen = new Map<string, Promise<THREE.Object3D>>();

function lade(datei: string) {
  if (!lader) {
    const draco = new DRACOLoader();
    draco.setDecoderPath("/draco/");
    lader = new GLTFLoader();
    lader.setDRACOLoader(draco);
  }
  if (!vorlagen.has(datei)) {
    vorlagen.set(datei, lader.loadAsync(datei).then((g) => {
      toonStil(g.scene);
      g.scene.traverse((o) => {   // Vorlage bleibt im Speicher: geteilt markieren (entsorge, szene.ts)
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        m.geometry.userData.geteilt = true;
        const map = (m.material as THREE.MeshToonMaterial).map;
        if (map) map.userData.geteilt = true;
      });
      return g.scene;
    }));
  }
  return vorlagen.get(datei)!;
}

export function avatarDatei(a: { klasse: string; form: string; tier?: string }) {
  return `/modelle/avatare/${a.tier ? `tier_${a.tier}` : `mensch_${a.klasse}_${a.form}`}.glb`;
}

/** Tauscht den Inhalt von `g` gegen das Modell; `beiModell` in g.userData wird danach aufgerufen (z. B. Arena) */
export function ersetzeDurchModell(g: THREE.Group, datei: string, haut: number) {
  if (typeof window === "undefined" || !("WebGL2RenderingContext" in window)) return;
  lade(datei).then((vorlage) => {
    const m = vorlage.clone(true);
    m.traverse((o) => {   // eigene Materialien je Figur (Haut färben, Treffer-Tönung ohne andere Figuren)
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || o.userData.umriss) return;
      mesh.material = (mesh.material as THREE.Material).clone();
      if ((mesh.material as THREE.MeshToonMaterial).name === "Haut") (mesh.material as THREE.MeshToonMaterial).color.set(haut);
    });
    m.scale.setScalar(MASSSTAB);
    for (const alt of [...g.children]) {
      g.remove(alt);
      alt.traverse((o) => { const x = o as THREE.Mesh; if (x.isMesh) { x.geometry.dispose(); (x.material as THREE.Material).dispose(); } });
    }
    g.add(m);
    (g.userData.beiModell as (() => void) | undefined)?.();
  }).catch(() => { /* bleibt bei der gebauten Figur */ });
}
