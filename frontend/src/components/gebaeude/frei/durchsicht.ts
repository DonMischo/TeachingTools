/**
 * Durchsicht für die Draufsicht der 3D-Welt: Um die Figur herum verschwindet alles, was höher als
 * `hoehe` ist (Baumkronen, Mauerkronen, Felsen, Tropfsteine) — wie ein Ausschnitt, durch den man von
 * oben auf den Weg sieht. Am Rand des Kreises löst es sich in Pünktchen auf statt hart abzubrechen.
 *
 * Dazu die Sicht (sicht.ts): In der Draufsicht ist nur hell, was die Figur von ihrem Feld aus sehen kann;
 * schon Gesehenes bleibt gedämpft, der Rest schwarz. So schaut man von oben nicht in Nachbarräume.
 *
 * Aufgeschnittene Wände: Einseitige Materialien werden beidseitig gezeichnet, die Rückseiten aber
 * verworfen, solange nicht geschnitten wird (also wie vorher). In der Draufsicht sieht man in einen
 * angeschnittenen Wandkörper hinein auf seine Rückseiten: die werden flach dunkel gemalt — eine
 * geschlossene Mauerkrone statt eines hohlen Inneren. (Die Neon-Halle legt echte Kappen darüber.)
 *
 * Alle Materialien teilen dieselben Uniforms: Ein- und Ausschalten kostet keinen neuen Shader.
 */
import * as THREE from "three";

export const DURCHSICHT = {
  uDsSpieler: { value: new THREE.Vector3() },
  uDsAn: { value: 0 },
  uDsRadius: { value: 11 },
  uDsHoehe: { value: 2.4 },
  /** Sicht je Feld (Rotkanal 0…1), über die Karte gespannt; ohne Karte überall hell */
  uDsSicht: { value: weiss() as THREE.Texture },
  /** Größe der Karte in Welteinheiten */
  uDsGroesse: { value: new THREE.Vector2(1, 1) },
  /** Sicht anwenden (nur Draufsicht mit Karte) */
  uDsSichtAn: { value: 0 },
  /** Farbe der Mauerkrone, wo ein Wandkörper aufgeschnitten ist */
  uDsKappe: { value: new THREE.Color(0x1e2226) },
};

function weiss(): THREE.DataTexture {
  const t = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  t.needsUpdate = true;
  return t;
}

/** Material bekommt die Durchsicht (bestehende Shader-Änderungen bleiben erhalten) */
export function durchsicht(mat: THREE.Material): void {
  if (mat.userData.durchsicht || (mat as THREE.ShaderMaterial).isShaderMaterial) return;
  mat.userData.durchsicht = true;
  // einseitig und deckend: beidseitig zeichnen, Rückseiten nur für die Mauerkrone (Schatten wie bisher)
  const kappe = mat.side === THREE.FrontSide && !mat.transparent;
  if (kappe) { mat.side = THREE.DoubleSide; mat.shadowSide = THREE.BackSide; }
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
        uniform float uDsAn, uDsRadius, uDsHoehe, uDsSichtAn;
        uniform sampler2D uDsSicht;
        uniform vec2 uDsGroesse;
        uniform vec3 uDsKappe;`)
      .replace("#include <clipping_planes_fragment>", `#include <clipping_planes_fragment>
        if ( uDsAn > 0.5 && vDsWelt.y > uDsHoehe ) {
          float dsD = length( vDsWelt.xz - uDsSpieler.xz );
          float dsRand = clamp( ( uDsRadius - dsD ) / 2.0, 0.0, 1.0 );
          float dsZufall = fract( sin( dot( floor( gl_FragCoord.xy ), vec2( 12.9898, 78.233 ) ) ) * 43758.5453 );
          if ( dsZufall < dsRand ) discard;
        }${kappe ? "\n        if ( !gl_FrontFacing && uDsAn < 0.5 ) discard;" : ""}`);
    // Sicht: zuletzt, nach Nebel und Farbraum
    const sicht = `
        if ( uDsSichtAn > 0.5 ) {
          vec2 dsUv = vDsWelt.xz / uDsGroesse;
          float dsSicht = ( dsUv.x < 0.0 || dsUv.y < 0.0 || dsUv.x > 1.0 || dsUv.y > 1.0 ) ? 0.0 : texture2D( uDsSicht, dsUv ).r;
          gl_FragColor.rgb *= dsSicht;
        }`;
    const ende = shader.fragmentShader.includes("#include <dithering_fragment>") ? "#include <dithering_fragment>" : "#include <premultiplied_alpha_fragment>";
    const krone = kappe ? `
        if ( !gl_FrontFacing ) gl_FragColor = vec4( uDsKappe, gl_FragColor.a );` : "";
    shader.fragmentShader = shader.fragmentShader.replace(ende, `${ende}${krone}${sicht}`);
  };
  mat.customProgramCacheKey = () => `${altSchluessel()}|ds3${kappe ? "k" : ""}`;
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
