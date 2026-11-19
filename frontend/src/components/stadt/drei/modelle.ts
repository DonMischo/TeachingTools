/**
 * Modelle der 3D-Stadt aus Blender (scripts/stadt/baue.py → /modelle/stadt/stadt.glb):
 * Hauswand, Dachformen und Wahrzeichen, je in Teilen <modell>_wand/_dach/_akzent mit Helligkeit je Ecke.
 * Bäume kommen aus den TaskCrawler-Modellen (welten.glb, components/gebaeude/frei/modelle.ts).
 * Ohne WebGL2 (Tests) oder bis zum Laden bleiben einfache Formen.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import type { BauTyp } from "@/lib/stadt/modell";
import { ladeStadtKacheln } from "./fassade";

export const STADT_URL = "/modelle/stadt/stadt.glb";

let fertig: Record<string, THREE.BufferGeometry> | null = null;
let laden: Promise<Record<string, THREE.BufferGeometry> | null> | null = null;

/** einmal laden; null ohne WebGL2 oder bei Fehler */
export function ladeStadtModelle(): Promise<Record<string, THREE.BufferGeometry> | null> {
  if (laden) return laden;
  if (typeof window === "undefined" || !("WebGL2RenderingContext" in window)) return (laden = Promise.resolve(null));
  const draco = new DRACOLoader();
  draco.setDecoderPath("/draco/");
  const lader = new GLTFLoader();
  lader.setDRACOLoader(draco);
  // Fassaden- und Dachkacheln gleich mitladen: wer die Modelle hat, hat auch sie
  laden = Promise.all([lader.loadAsync(STADT_URL), ladeStadtKacheln()]).then(([gltf]) => {
    const teile: Record<string, THREE.BufferGeometry> = {};
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse(o => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const g = m.geometry.clone();
      g.applyMatrix4(m.matrixWorld);
      g.computeVertexNormals();
      g.userData.geteilt = true;
      teile[m.name] = g;
    });
    fertig = teile;
    return teile;
  }).catch(() => null);
  return laden;
}

export const stadtModelle = () => fertig;

/** Bauwerk → Modell aus stadt.glb (fehlt es: kein 3D-Bau, z. B. Plätze) */
export const MODELL_VON: Partial<Record<BauTyp, string>> = {
  kirche: "kirche", kloster: "kirche", kathedrale: "kathedrale", burg: "burg", schloss: "schloss", tempel: "tempel",
  forum: "kolonnade", amphitheater: "arena", theater: "theater", thermen: "kuppelbau", kulturhaus: "kuppelbau",
  universitaet: "kuppelbau", zollhaus: "kuppelbau", poliklinik: "kaserne", schacht: "foerderturm", zechenturm: "foerderturm",
  hochofen: "hochofen", huettenwerk: "hochofen", werk: "hochofen", fabrik: "fabrik", rechenzentrum: "fabrik", kai: "kran",
  werft: "kran", hafen: "kran", kanalhafen: "kran", leuchtturm: "leuchtturm", moschee: "moschee", bahnhof: "bahnhof",
  depot: "bahnhof", hochhaus: "hochhaus", buero: "hochhaus", silo: "silo", muehle: "muehle", tor: "tor", castellum: "tor",
  rathaus: "rathaus", cabildo: "rathaus", bergamt: "rathaus", gericht: "rathaus", spital: "kaserne", kaserne: "kaserne",
  mietshaus: "kaserne", schule: "kaserne", kaufhalle: "kaserne", einkauf: "campus", karawanserei: "festungsbau",
  hammam: "kuppelbau", villa: "kaserne", techzentrale: "campus", forschungspark: "campus", zitadelle: "festungsbau",
  kasbah: "festungsbau", hafenkontor: "kontor", kapelle: "kirche", brunnen: "brunnen",
  baecker: "kaserne", schmiede: "fabrik", weberei: "fabrik", zimmerei: "kaserne", brauerei: "silo",
};

/** Farben der Dächer und Akzente je Modell (Wand = Farbe des Bauwerks) */
export const TEILFARBEN: Record<string, { dach: string; akzent: string }> = {
  kirche: { dach: "#59606b", akzent: "#4f8f7c" }, kathedrale: { dach: "#59606b", akzent: "#4f8f7c" },
  burg: { dach: "#5d5f66", akzent: "#c33" }, schloss: { dach: "#56606e", akzent: "#c9a54a" },
  tempel: { dach: "#c96f4a", akzent: "#f2ede0" }, kolonnade: { dach: "#c2703d", akzent: "#f2ede0" },
  arena: { dach: "#cdb38c", akzent: "#e3cf9e" }, theater: { dach: "#cdb38c", akzent: "#e3cf9e" },
  kuppelbau: { dach: "#9aa0a6", akzent: "#5f9e8a" }, foerderturm: { dach: "#7a4a3a", akzent: "#7b3f2c" },
  hochofen: { dach: "#5a5550", akzent: "#3e3a37" }, fabrik: { dach: "#6d6862", akzent: "#8c3b2a" },
  kran: { dach: "#2e6aa6", akzent: "#c9472f" }, leuchtturm: { dach: "#3a3a3a", akzent: "#cf3a2f" },
  moschee: { dach: "#efe9dc", akzent: "#3a7f6a" }, bahnhof: { dach: "#5d6670", akzent: "#7d8a96" },
  hochhaus: { dach: "#8a96a3", akzent: "#c0c6cc" }, silo: { dach: "#9a948a", akzent: "#7d776e" },
  muehle: { dach: "#8a4b33", akzent: "#6b4a2f" }, tor: { dach: "#8a4b33", akzent: "#8a4b33" },
  rathaus: { dach: "#8a4b33", akzent: "#4f8f7c" }, festungsbau: { dach: "#9a8f80", akzent: "#9a8f80" },
  kaserne: { dach: "#8a4b33", akzent: "#8a4b33" }, campus: { dach: "#cfd5da", akzent: "#7fb2d6" },
  kontor: { dach: "#7d3a24", akzent: "#6b4a2f" }, brunnen: { dach: "#7d3a24", akzent: "#3d7fbf" },
};
