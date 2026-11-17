/**
 * Durchsicht für die Draufsicht der 3D-Welt: Um die Figur herum verschwindet alles, was höher als
 * `hoehe` ist (Baumkronen, Mauerkronen, Felsen, Tropfsteine) — wie ein Ausschnitt, durch den man von
 * oben auf den Weg sieht. Am Rand des Kreises löst es sich in Pünktchen auf statt hart abzubrechen.
 *
 * Alle Materialien teilen dieselben Uniforms: Ein- und Ausschalten kostet keinen neuen Shader.
 */
import * as THREE from "three";

export const DURCHSICHT = {
  uDsSpieler: { value: new THREE.Vector3() },
  uDsAn: { value: 0 },
  uDsRadius: { value: 11 },
  uDsHoehe: { value: 2.4 },
};

/** Material bekommt die Durchsicht (bestehende Shader-Änderungen bleiben erhalten) */
export function durchsicht(mat: THREE.Material): void {
  if (mat.userData.durchsicht || (mat as THREE.ShaderMaterial).isShaderMaterial) return;
  mat.userData.durchsicht = true;
  const alt = mat.onBeforeCompile;
  const altSchluessel = mat.customProgramCacheKey.bind(mat);
  mat.onBeforeCompile = (shader, renderer) => {
    alt.call(mat, shader, renderer);
    Object.assign(shader.uniforms, DURCHSICHT);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vDsWelt;")
      .replace("#include <project_vertex>", `#include <project_vertex>
        vec4 dsW = vec4( transformed, 1.0 );
        #ifdef USE_INSTANCING
          dsW = instanceMatrix * dsW;
        #endif
        vDsWelt = ( modelMatrix * dsW ).xyz;`);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>
        varying vec3 vDsWelt;
        uniform vec3 uDsSpieler;
        uniform float uDsAn, uDsRadius, uDsHoehe;`)
      .replace("#include <clipping_planes_fragment>", `#include <clipping_planes_fragment>
        if ( uDsAn > 0.5 && vDsWelt.y > uDsHoehe ) {
          float dsD = length( vDsWelt.xz - uDsSpieler.xz );
          float dsRand = clamp( ( uDsRadius - dsD ) / 2.0, 0.0, 1.0 );
          float dsZufall = fract( sin( dot( floor( gl_FragCoord.xy ), vec2( 12.9898, 78.233 ) ) ) * 43758.5453 );
          if ( dsZufall < dsRand ) discard;
        }`);
  };
  mat.customProgramCacheKey = () => `${altSchluessel()}|ds`;
  mat.needsUpdate = true;
}

/** alle Meshes unter `o` bekommen die Durchsicht */
export function durchsichtFuer(o: THREE.Object3D): void {
  o.traverse(k => {
    const m = k as THREE.Mesh;
    if (!m.isMesh) return;
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) durchsicht(mat);
  });
}
