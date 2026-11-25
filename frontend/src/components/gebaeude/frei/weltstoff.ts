/**
 * Fels-Material in Weltkoordinaten (triplanar) für die Baukästen, übernommen aus der Weltenwerkstatt
 * (TT-Weltenwerkstatt/vorschau/web/weltstoff.js, Stand 1a285c2):
 *
 * Statt der UVs jedes Modells nimmt der Shader die Weltposition. Die Textur läuft über alle Wandstücke durch,
 * überlappende Stücke zeigen an derselben Stelle dieselbe Textur (kein Flimmern an den Stößen), und gleiche
 * Modelle sehen an verschiedenen Orten verschieden aus. Dazu eine großflächige Helligkeits- und Farbtonschwankung
 * (etwa 9 m). Die Eckenfarben (Moos, Rost, Verdeckung) wirken weiter. Funktioniert mit InstancedMesh.
 */
import * as THREE from "three";

export interface WeltStoffWahl {
  /** Meter je Kachel (Fels 4,2, Kalk 2,8) */
  kachel?: number;
  /** Größe der Helligkeitsflecken in m */
  makro?: number;
  /** Stärke der Normalenkarte */
  staerke?: number;
  /** für Decke und Gänge */
  doppelseitig?: boolean;
}

export function weltStoff(map: THREE.Texture, normalMap: THREE.Texture | null, o: WeltStoffWahl = {}): THREE.MeshLambertMaterial {
  const kachel = o.kachel ?? 4.2, makro = o.makro ?? 9, staerke = o.staerke ?? 1;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  if (normalMap) normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping;
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, side: o.doppelseitig ? THREE.DoubleSide : THREE.FrontSide });
  m.onBeforeCompile = (shader: THREE.WebGLProgramParametersWithUniforms) => {
    Object.assign(shader.uniforms, {
      tpMap: { value: map }, tpNorm: { value: normalMap }, tpKachel: { value: kachel }, tpMakro: { value: makro }, tpStaerke: { value: staerke },
    });
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vTpPos;\nvarying vec3 vTpNormal;")
      .replace("#include <project_vertex>", `#include <project_vertex>
        vec4 tpW = vec4( transformed, 1.0 );
        vec3 tpN = objectNormal;
        #ifdef USE_INSTANCING
          tpW = instanceMatrix * tpW;
          tpN = mat3( instanceMatrix ) * tpN;
        #endif
        tpW = modelMatrix * tpW;
        vTpPos = tpW.xyz;
        vTpNormal = normalize( mat3( modelMatrix ) * tpN );`);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>
        varying vec3 vTpPos;
        varying vec3 vTpNormal;
        uniform sampler2D tpMap;
        uniform sampler2D tpNorm;
        uniform float tpKachel, tpMakro, tpStaerke;
        float tpHash( vec3 p ) { p = fract( p * 0.3183099 + 0.1 ); p *= 17.0; return fract( p.x * p.y * p.z * ( p.x + p.y + p.z ) ); }
        float tpRauschen( vec3 x ) {
          vec3 i = floor( x ), f = fract( x );
          f = f * f * ( 3.0 - 2.0 * f );
          return mix( mix( mix( tpHash( i ), tpHash( i + vec3( 1, 0, 0 ) ), f.x ), mix( tpHash( i + vec3( 0, 1, 0 ) ), tpHash( i + vec3( 1, 1, 0 ) ), f.x ), f.y ),
                      mix( mix( tpHash( i + vec3( 0, 0, 1 ) ), tpHash( i + vec3( 1, 0, 1 ) ), f.x ), mix( tpHash( i + vec3( 0, 1, 1 ) ), tpHash( i + vec3( 1, 1, 1 ) ), f.x ), f.y ), f.z );
        }
        vec3 tpGewicht( vec3 n ) { vec3 w = pow( abs( n ), vec3( 4.0 ) ); return w / ( w.x + w.y + w.z ); }`)
      .replace("#include <map_fragment>", `
        vec3 tpN0 = normalize( vTpNormal );
        vec3 tpw = tpGewicht( tpN0 );
        // je Achse etwas versetzt, damit die drei Projektionen nicht dasselbe Muster zeigen
        vec2 tpUx = vTpPos.zy / tpKachel + vec2( 0.31, 0.0 );
        vec2 tpUy = vTpPos.xz / tpKachel + vec2( 0.57, 0.13 );
        vec2 tpUz = vTpPos.xy / tpKachel;
        vec3 tpFarbe = texture2D( tpMap, tpUx ).rgb * tpw.x + texture2D( tpMap, tpUy ).rgb * tpw.y + texture2D( tpMap, tpUz ).rgb * tpw.z;
        float tpM = 0.65 * tpRauschen( vTpPos / tpMakro ) + 0.35 * tpRauschen( vTpPos / ( tpMakro * 0.38 ) + 7.3 );
        tpFarbe *= mix( 0.7, 1.3, tpM );
        tpFarbe *= mix( vec3( 0.9, 0.97, 1.08 ), vec3( 1.1, 1.0, 0.88 ), tpRauschen( vTpPos / ( tpMakro * 1.6 ) + 17.0 ) );
        diffuseColor.rgb *= tpFarbe;`)
      .replace("#include <normal_fragment_maps>", !normalMap ? "#include <normal_fragment_maps>" : `
        {
          vec3 N = tpN0 * faceDirection;
          vec3 nX = texture2D( tpNorm, tpUx ).xyz * 2.0 - 1.0;
          vec3 nY = texture2D( tpNorm, tpUy ).xyz * 2.0 - 1.0;
          vec3 nZ = texture2D( tpNorm, tpUz ).xyz * 2.0 - 1.0;
          nX.xy *= tpStaerke; nY.xy *= tpStaerke; nZ.xy *= tpStaerke;
          // Whiteout-Mischung (B. Golus): Tangentennormalen je Projektion in Weltachsen
          nX = vec3( nX.xy + N.zy, abs( nX.z ) * N.x );
          nY = vec3( nY.xy + N.xz, abs( nY.z ) * N.y );
          nZ = vec3( nZ.xy + N.xy, abs( nZ.z ) * N.z );
          vec3 wN = normalize( nX.zyx * tpw.x + nY.xzy * tpw.y + nZ.xyz * tpw.z );
          normal = normalize( ( viewMatrix * vec4( wN, 0.0 ) ).xyz );
        }`);
  };
  m.customProgramCacheKey = () => `weltstoff-${normalMap ? 1 : 0}`;
  return m;
}
