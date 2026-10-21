/**
 * Lädt Monster-Modelle (.glb, Draco) einmal pro Seite und gibt animierbare Klone aus.
 * Animationen werden über eine gemeinsame Uhr weitergedreht (tickMonster im Renderloop).
 */
import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { clone as skelettKlon } from "three/examples/jsm/utils/SkeletonUtils.js";
import { monsterUrl, type MonsterId } from "./monster";
import { toonStil } from "./toon";

let lader: GLTFLoader | null = null;
const cache = new Map<MonsterId, Promise<GLTF>>();
const laufend = new Set<THREE.AnimationMixer>();

function gltfLader() {
  if (!lader) {
    const draco = new DRACOLoader();
    draco.setDecoderPath("/draco/");
    lader = new GLTFLoader();
    lader.setDRACOLoader(draco);
  }
  return lader;
}

export type Art = "idle" | "angriff" | "treffer" | "tod";
const MUSTER: Record<Art, RegExp> = { idle: /idle/i, angriff: /punch|bite|headbutt|weapon/i, treffer: /hit/i, tod: /death/i };

/** Ein Monster in der Szene: Modell, Höhe und Animationen */
export interface MonsterFigur {
  modell: THREE.Object3D;
  hoehe: number;
  /** spielt einmal (danach zurück zu idle) oder bleibt bei tod liegen */
  spiele(art: Art): number;
  /** eigene Materialien (z. B. zum Ausgrauen, ohne andere Klone zu treffen) */
  eigeneMaterialien(): void;
  dispose(): void;
}

/** Klon eines Monsters, auf `zielHoehe` skaliert, steht mit den Füßen bei y = 0 */
export async function ladeMonster(id: MonsterId, zielHoehe: number): Promise<MonsterFigur> {
  if (!cache.has(id)) cache.set(id, gltfLader().loadAsync(monsterUrl(id)).then((g) => {
    // Geometrie und Atlas teilen sich alle Klone: beim Aufräumen eines Stockwerks nicht freigeben (szene.ts: entsorge)
    g.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.geometry.userData.geteilt = true;
      const map = (m.material as THREE.MeshStandardMaterial).map;
      if (map) map.userData.geteilt = true;
    });
    return g;
  }));
  const gltf = await cache.get(id)!;
  const modell = skelettKlon(gltf.scene);
  const huelle = new THREE.Group();
  huelle.add(modell);
  modell.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(modell), h = Math.max(0.01, box.max.y - box.min.y);
  toonStil(modell, h * 0.008); // Umriss etwa gleich dick wie bei den Avataren
  modell.scale.setScalar(zielHoehe / h);
  modell.position.y = -box.min.y * (zielHoehe / h);
  const mixer = new THREE.AnimationMixer(modell);
  laufend.add(mixer);
  const clip = (art: Art) => gltf.animations.find((a) => art === "idle" && /^(flying_)?idle$/i.test(a.name)) ?? gltf.animations.find((a) => MUSTER[art].test(a.name));
  let aktiv: THREE.AnimationAction | null = null;
  const wechsel = (neu: THREE.AnimationAction) => {
    neu.reset().play();
    if (aktiv && aktiv !== neu) aktiv.crossFadeTo(neu, 0.15, false);
    aktiv = neu;
  };
  const idle = clip("idle");
  if (idle) wechsel(mixer.clipAction(idle));
  mixer.addEventListener("finished", (e) => {
    const fertig = (e as unknown as { action: THREE.AnimationAction }).action;
    if (idle && fertig.getClip() !== clip("tod")) wechsel(mixer.clipAction(idle));
  });
  return {
    modell: huelle,
    hoehe: zielHoehe,
    spiele(art) {
      const c = clip(art);
      if (!c) return 0;
      const a = mixer.clipAction(c);
      if (art !== "idle") { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
      wechsel(a);
      return c.duration;
    },
    eigeneMaterialien() {
      modell.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh && !o.userData.umriss) m.material = Array.isArray(m.material) ? m.material.map((x) => x.clone()) : m.material.clone();
      });
    },
    dispose() { mixer.stopAllAction(); laufend.delete(mixer); },
  };
}

const abgehaengt = new Map<THREE.AnimationMixer, number>();
/** Alle geladenen Monster weiteranimieren (einmal pro Frame aufrufen); Monster außerhalb einer Szene ruhen und werden nach einer Weile vergessen */
export function tickMonster(dt: number) {
  for (const m of laufend) {
    let o = m.getRoot() as THREE.Object3D;
    while (o.parent) o = o.parent;
    if ((o as THREE.Scene).isScene) { abgehaengt.delete(m); m.update(dt); continue; }
    const n = (abgehaengt.get(m) ?? 0) + 1;
    if (n > 600) { m.stopAllAction(); laufend.delete(m); abgehaengt.delete(m); } else abgehaengt.set(m, n);
  }
}
