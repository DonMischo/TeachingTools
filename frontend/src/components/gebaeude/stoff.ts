/**
 * Oberflächen für die Gebäude-Stile: Muster werden auf ein Canvas gemalt
 * (grau, die Farbe kommt vom Material) und nach Weltkoordinaten aufgelegt —
 * so passen schmale und breite Felder nahtlos aneinander, nichts wird verzerrt.
 */
import * as THREE from "three";
import { MUSTER_GROESSE, MUSTER_SYNTHESE, maleMuster, musterProbe, type Muster } from "@/lib/gebaeude/muster";
import { GEBAEUDE_SYNTHESE, bildAus, schreibePixel, synthetisiere } from "@/lib/wfc/textur";

export type { Muster };
export { zufallAus } from "@/lib/gebaeude/muster";

const cache = new Map<Muster, THREE.CanvasTexture | null>();

/** Die Musterkachel (null ohne Canvas, z. B. in Tests) */
export function textur(m: Muster): THREE.CanvasTexture | null {
  if (cache.has(m)) return cache.get(m)!;
  let t: THREE.CanvasTexture | null = null;
  const c = typeof document !== "undefined" ? document.createElement("canvas") : null;
  const ctx = c?.getContext("2d");
  if (c && ctx) {
    const probe = MUSTER_SYNTHESE.includes(m) ? musterProbe(m, GEBAEUDE_SYNTHESE.probe) : null;
    if (probe) {
      // Unregelmäßiges wächst per Textur-Synthese aus einer kleinen Probe (wie im Reiter »Textur«)
      const { aus, n, m: zusatz, polieren } = GEBAEUDE_SYNTHESE;
      const farben = synthetisiere(bildAus(probe.daten, probe.b, probe.h), { b: aus, h: aus, n, m: zusatz, polieren, seed: 7 });
      c.width = c.height = aus;
      const bild = ctx.createImageData(aus, aus);
      schreibePixel(farben, null, bild.data);
      ctx.putImageData(bild, 0, 0);
    } else {
      c.width = c.height = MUSTER_GROESSE;
      maleMuster(m, ctx);
    }
    t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    // gehört allen Stockwerken: `entsorge` lässt es stehen
    t.userData.geteilt = true;
  }
  cache.set(m, t);
  return t;
}

/**
 * Material mit Muster in Weltkoordinaten: oben xz, an den Seiten xy bzw. zy.
 * `groesse` = wie viele Welteinheiten eine Musterkachel abdeckt.
 */
export function musterMaterial(farbe: number, m: Muster | undefined, groesse = 2.2, extra: THREE.MeshLambertMaterialParameters = {}): THREE.MeshLambertMaterial {
  const t = m ? textur(m) : null;
  const mat = new THREE.MeshLambertMaterial({ color: farbe, ...extra, ...(t ? { map: t } : {}) });
  if (!t) return mat;
  const skala = (1 / groesse).toFixed(4);
  mat.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vHpWelt;\nvarying vec3 vHpNorm;")
      .replace("#include <project_vertex>", `#include <project_vertex>
        vec4 hpW = vec4( transformed, 1.0 );
        vec3 hpN = objectNormal;
        #ifdef USE_INSTANCING
          hpW = instanceMatrix * hpW;
          hpN = mat3( instanceMatrix ) * hpN;
        #endif
        vHpWelt = ( modelMatrix * hpW ).xyz;
        vHpNorm = normalize( mat3( modelMatrix ) * hpN );`);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vHpWelt;\nvarying vec3 vHpNorm;")
      .replace("#include <map_fragment>", `#ifdef USE_MAP
        vec3 hpA = abs( vHpNorm );
        vec2 hpUv = hpA.y > max( hpA.x, hpA.z ) ? vHpWelt.xz : ( hpA.x > hpA.z ? vHpWelt.zy : vHpWelt.xy );
        diffuseColor *= texture2D( map, hpUv * ${skala} );
      #endif`);
  };
  mat.customProgramCacheKey = () => `hp-muster-${skala}`;
  return mat;
}

/** Ein unregelmäßiger Felsbrocken (Radius ~0,5), für alle Brocken derselbe */
let brocken: THREE.BufferGeometry | null = null;
export function felsGeometrie(): THREE.BufferGeometry {
  if (brocken) return brocken;
  const g = new THREE.IcosahedronGeometry(0.5, 1);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    // gleiche Ecken gleich verschieben (sonst reißt die Oberfläche auf)
    const h = Math.sin(v.x * 12.9898 + v.y * 78.233 + v.z * 37.719) * 43758.5453;
    v.multiplyScalar(0.82 + (h - Math.floor(h)) * 0.36);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  g.userData.geteilt = true;
  brocken = g;
  return g;
}
