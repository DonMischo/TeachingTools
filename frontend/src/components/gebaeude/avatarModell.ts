/**
 * Die neuen Avatare (Blender, scripts/avatare) als .glb: einmal laden, im Toon-Look, Haut in der gewählten Farbe.
 * baueAvatar() baut sofort die alte Figur und tauscht sie gegen das Modell, sobald es geladen ist
 * (ohne WebGL, z. B. in jsdom, bleibt die gebaute Figur).
 * Die Modelle tragen ein Skelett und Bewegungen (idle, lauf, rennen, angriff, treffer, jubel, tod);
 * bewegeAvatar() spielt sie, tickAvatare(dt) dreht alle Figuren im Renderloop weiter.
 */
import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { clone as skelettKlon } from "three/examples/jsm/utils/SkeletonUtils.js";
import { toonStil } from "@/lib/angriffe/toon";

/** Größe der Modelle relativ zur alten Figur (Chibi-Kopf, sonst gleich hoch) */
const MASSSTAB = 0.88;

let lader: GLTFLoader | null = null;
const vorlagen = new Map<string, Promise<GLTF>>();

export type Bewegung = "idle" | "lauf" | "rennen" | "angriff" | "treffer" | "jubel" | "tod";
const SCHLEIFE = new Set<Bewegung>(["idle", "lauf", "rennen"]);
const laufend = new Set<THREE.AnimationMixer>();

/** Bewegungen einer geladenen Figur: Schleifen laufen weiter, Einzelbewegungen kehren zur letzten Schleife zurück, tod bleibt liegen */
function bewegungen(m: THREE.Object3D, clips: THREE.AnimationClip[]) {
  const mixer = new THREE.AnimationMixer(m);
  laufend.add(mixer);
  let aktiv: THREE.AnimationAction | null = null, schleife: Bewegung = "idle", jetzt: Bewegung | null = null;
  const spiele = (art: Bewegung) => {
    const clip = clips.find((c) => c.name === art);
    if (!clip) return 0;
    if (SCHLEIFE.has(art)) {
      schleife = art;
      if (jetzt && !SCHLEIFE.has(jetzt)) return clip.duration; // läuft nach der Einzelbewegung weiter
      if (jetzt === art) return clip.duration;
    }
    const neu = mixer.clipAction(clip);
    neu.setLoop(SCHLEIFE.has(art) ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    neu.clampWhenFinished = true;
    neu.reset().play();
    if (aktiv && aktiv !== neu) aktiv.crossFadeTo(neu, 0.15, false);
    aktiv = neu; jetzt = art;
    return clip.duration;
  };
  mixer.addEventListener("finished", () => { if (jetzt !== "tod") { jetzt = null; spiele(schleife); } });
  return { spiele, ende: () => { mixer.stopAllAction(); laufend.delete(mixer); } };
}

/** Spielt eine Bewegung (vor dem Laden gemerkt); gibt die Dauer in Sekunden zurück, 0 ohne Modell */
export function bewegeAvatar(g: THREE.Object3D, art: Bewegung): number {
  const b = g.userData.bewegung as ReturnType<typeof bewegungen> | undefined;
  if (!b) { g.userData.wunsch = art; return 0; }
  return b.spiele(art);
}

/** Bewegungsclips der Figur stoppen (beim Entsorgen) */
export function beendeAvatar(g: THREE.Object3D) {
  (g.userData.bewegung as ReturnType<typeof bewegungen> | undefined)?.ende();
  g.userData.bewegung = undefined;
}

let letzterTick = 0;
/** im Renderloop aufrufen; mehrere Loops zugleich (Vorschau über dem TaskCrawler) drehen trotzdem nur einmal pro Bild */
export function tickAvatare() {
  const jetzt = performance.now(), dt = Math.min(0.1, (jetzt - letzterTick) / 1000);
  if (dt < 0.004) return;
  letzterTick = jetzt;
  for (const m of laufend) m.update(dt);
}

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
      return g;
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
  lade(datei).then((gltf) => {
    const m = skelettKlon(gltf.scene);
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
    if (gltf.animations.length) {
      beendeAvatar(g);
      g.userData.bewegung = bewegungen(m, gltf.animations);
      bewegeAvatar(g, (g.userData.wunsch as Bewegung | undefined) ?? "idle");
    }
    (g.userData.beiModell as (() => void) | undefined)?.();
  }).catch(() => { /* bleibt bei der gebauten Figur */ });
}
