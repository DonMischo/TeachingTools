/**
 * Toon-Look für Avatare und Monster: drei Lichtstufen und ein dunkler Umriss (nach außen geschobene Rückseite).
 * Materialnamen aus den Blender-Avataren sind Rollen: Glanz bleibt hell, Gesicht ist transparent,
 * Auge/Iris/Bart und Durchsichtiges bekommen keinen Umriss.
 */
import * as THREE from "three";

let stufen: THREE.DataTexture | null = null;
function lichtStufen() {
  if (!stufen) {
    stufen = new THREE.DataTexture(new Uint8Array([90, 90, 90, 255, 180, 180, 180, 255, 255, 255, 255, 255]), 3, 1);
    stufen.minFilter = stufen.magFilter = THREE.NearestFilter;
    stufen.userData.geteilt = true;
    stufen.needsUpdate = true;
  }
  return stufen;
}

const umrisse = new Map<number, THREE.MeshBasicMaterial>();
function umrissMat(dicke: number) {
  const key = Math.round(dicke * 10000);
  if (!umrisse.has(key)) {
    const m = new THREE.MeshBasicMaterial({ color: 0x1a1020, side: THREE.BackSide });
    m.onBeforeCompile = (s) => {
      s.vertexShader = s.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>\n transformed += normalize(normal) * ${dicke.toFixed(4)};`);
    };
    m.customProgramCacheKey = () => `umriss:${key}`;
    umrisse.set(key, m);
  }
  return umrisse.get(key)!;
}

const OHNE_UMRISS = new Set(["Auge", "Iris", "Bart", "Glanz", "Gesicht"]);

/** Ersetzt die Materialien unter `root` durch Toon-Materialien und hängt Umrisse an (dicke in lokalen Einheiten) */
export function toonStil(root: THREE.Object3D, dicke = 0.012) {
  const meshes: THREE.Mesh[] = [];
  root.traverse((o) => { if ((o as THREE.Mesh).isMesh && !o.userData.umriss) meshes.push(o as THREE.Mesh); });
  for (const o of meshes) {
    const alt = o.material as THREE.MeshStandardMaterial;
    const rolle = alt.name;
    if (rolle === "Glanz") { o.material = new THREE.MeshBasicMaterial({ color: 0xffffff, name: rolle }); continue; }
    const m = new THREE.MeshToonMaterial({ name: rolle, color: alt.color, map: alt.map, vertexColors: !!o.geometry.attributes.color, gradientMap: lichtStufen(),
      transparent: alt.transparent || rolle === "Gesicht", opacity: alt.opacity });
    if (rolle === "Gesicht") { m.alphaTest = 0.02; m.depthWrite = false; o.renderOrder = 1; }
    if (alt.emissive && alt.emissiveIntensity && alt.emissive.getHex()) { m.emissive = alt.emissive.clone(); m.emissiveIntensity = alt.emissiveIntensity * 0.5; }
    o.material = m;
    if (OHNE_UMRISS.has(rolle) || alt.transparent) continue;
    const skin = o as THREE.SkinnedMesh;
    let u: THREE.Mesh;
    if (skin.isSkinnedMesh) {
      const s = new THREE.SkinnedMesh(o.geometry, umrissMat(dicke));
      s.bind(skin.skeleton, skin.bindMatrix);
      u = s;
    } else u = new THREE.Mesh(o.geometry, umrissMat(dicke));
    u.userData.umriss = true;
    u.position.copy(o.position); u.quaternion.copy(o.quaternion); u.scale.copy(o.scale);
    o.parent!.add(u);
  }
}
