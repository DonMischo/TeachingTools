/**
 * Nasser Boden: eine Schicht knapp über dem Boden, die die Szene spiegelt — in Pfützen kräftig, sonst
 * als schwacher Film, zum flachen Blickwinkel hin stärker (Fresnel). Unter den Pfützen wird der Boden
 * dunkler, darüber liegt das Spiegelbild der Neonleisten, Automaten und Lampen.
 *
 * Das Spiegelbild rendert three's Reflector (gespiegelte Kamera, schräge Schnittebene); gezeichnet wird
 * es aber mit einem gewöhnlichen MeshBasicMaterial, damit Durchsicht und Sicht der Draufsicht greifen.
 * In der Draufsicht und auf Güte »schnell« wird nicht gespiegelt: dann bleiben nur die dunklen Pfützen.
 */
import * as THREE from "three";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";
import { DURCHSICHT } from "./durchsicht";

/** global: Spiegelbilder an (FreiWelt schaltet es mit der Güte) */
export const NASS = { spiegel: true };

/** Loch im Boden in Weltkoordinaten (x0, z0, x1, z1), z. B. über einem Kabelkanal */
export type Loch = [number, number, number, number];
const LOECHER = 48;

/**
 * Schneidet Rechtecke aus einem Bodenmaterial (der Boden ist eine einzige Ebene; darunter liegende
 * Modelle wie Kabelkanäle würden sonst verdeckt). Bestehende Shader-Änderungen bleiben erhalten.
 */
export function bodenLoecher(mat: THREE.Material, loecher: Loch[]): void {
  if (!loecher.length) return;
  const liste = loecher.slice(0, LOECHER).map(([a, b, c, d]) => new THREE.Vector4(Math.min(a, c), Math.min(b, d), Math.max(a, c), Math.max(b, d)));
  while (liste.length < LOECHER) liste.push(new THREE.Vector4(0, 0, 0, 0));
  const zahl = Math.min(LOECHER, loecher.length);
  const alt = mat.onBeforeCompile, altSchluessel = mat.customProgramCacheKey.bind(mat);
  mat.onBeforeCompile = (shader, renderer) => {
    alt.call(mat, shader, renderer);
    shader.uniforms.uLoch = { value: liste };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vLochWelt;")
      .replace("#include <project_vertex>", "#include <project_vertex>\nvLochWelt = ( modelMatrix * vec4( transformed, 1.0 ) ).xz;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\nvarying vec2 vLochWelt;\nuniform vec4 uLoch[ ${LOECHER} ];`)
      .replace("#include <clipping_planes_fragment>", `#include <clipping_planes_fragment>
        for ( int i = 0; i < ${zahl}; i++ ) {
          vec4 l = uLoch[ i ];
          if ( vLochWelt.x > l.x && vLochWelt.x < l.z && vLochWelt.y > l.y && vLochWelt.y < l.w ) discard;
        }`);
  };
  mat.customProgramCacheKey = () => `${altSchluessel()}|loch${zahl}`;
  mat.needsUpdate = true;
}

export interface NassOptionen {
  /** ausgesparte Rechtecke (Kanäle) */
  loecher?: Loch[];
  /** Anteil der Fläche unter Pfützen (0…1), Vorgabe 0.3 */
  pfuetzen?: number;
  /** Spiegelung als Film außerhalb der Pfützen (0…1), Vorgabe 0.15 */
  film?: number;
  /** Helligkeit des Spiegelbilds, Vorgabe 1 */
  staerke?: number;
  /** wie stark der Boden unter Pfützen dunkler wird (0…1), Vorgabe 0.45 */
  dunkel?: number;
}

export function nasserBoden(b: number, t: number, o: NassOptionen = {}): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(b, t);
  const breite = Math.min(1024, Math.round((window.innerWidth || 1024) * 0.5));
  const spiegel = new Reflector(geo, { textureWidth: breite, textureHeight: Math.round(breite * 0.6), multisample: 0, clipBias: 0.003 });
  const alt = spiegel.material as THREE.ShaderMaterial;
  const matrix = alt.uniforms.textureMatrix.value as THREE.Matrix4;
  const bild = spiegel.getRenderTarget().texture;
  alt.dispose();

  const u = {
    tSpiegel: { value: bild },
    uSpiegelM: { value: matrix },
    uStaerke: { value: o.staerke ?? 1 },
    uPfuetzen: { value: o.pfuetzen ?? 0.3 },
    uFilm: { value: o.film ?? 0.15 },
    uDunkel: { value: o.dunkel ?? 0.45 },
    uAn: { value: 1 },
  };
  const m = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, fog: false });
  // Ergebnis = Spiegelbild + Boden × (1 − Alpha); der Alphakanal des Zwischenbilds (Leuchtmaske) bleibt
  m.blending = THREE.CustomBlending;
  m.blendSrc = THREE.OneFactor;
  m.blendDst = THREE.OneMinusSrcAlphaFactor;
  m.blendSrcAlpha = THREE.ZeroFactor;
  m.blendDstAlpha = THREE.OneFactor;
  m.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform mat4 uSpiegelM;\nvarying vec4 vSpUv;\nvarying vec3 vSpWelt;")
      .replace("#include <project_vertex>", "#include <project_vertex>\nvSpUv = uSpiegelM * vec4( position, 1.0 );\nvSpWelt = ( modelMatrix * vec4( position, 1.0 ) ).xyz;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>
        uniform sampler2D tSpiegel;
        uniform float uStaerke, uPfuetzen, uFilm, uDunkel, uAn;
        varying vec4 vSpUv;
        varying vec3 vSpWelt;
        float spZufall( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
        float spRauschen( vec2 p ) {
          vec2 i = floor( p ), f = fract( p );
          f = f * f * ( 3.0 - 2.0 * f );
          return mix( mix( spZufall( i ), spZufall( i + vec2( 1.0, 0.0 ) ), f.x ),
                      mix( spZufall( i + vec2( 0.0, 1.0 ) ), spZufall( i + vec2( 1.0, 1.0 ) ), f.x ), f.y );
        }
        float spFbm( vec2 p ) { return spRauschen( p ) * 0.55 + spRauschen( p * 2.1 + 7.3 ) * 0.3 + spRauschen( p * 4.7 + 1.9 ) * 0.15; }`)
      .replace("#include <color_fragment>", `#include <color_fragment>
        {
          vec2 p = vSpWelt.xz;
          // Pfützen: große weiche Flecken mit scharfem Rand; dazwischen Schlieren
          float n = spFbm( p * 0.16 );
          float rand = 1.0 - uPfuetzen;
          float pfuetze = smoothstep( rand, rand + 0.035, n );
          float schliere = spFbm( p * vec2( 0.9, 0.25 ) + 3.0 );
          float nass = max( pfuetze, uFilm * smoothstep( 0.35, 0.75, schliere ) );
          // flacher Blick spiegelt mehr
          vec3 blick = normalize( cameraPosition - vSpWelt );
          float fres = 0.35 + 0.65 * pow( 1.0 - abs( blick.y ), 2.0 );
          // leichtes Zittern: außerhalb der Pfützen stumpfer
          vec2 wackel = ( vec2( spRauschen( p * 3.0 ), spRauschen( p * 3.0 + 17.0 ) ) - 0.5 ) * mix( 0.035, 0.006, pfuetze );
          vec3 bild = texture2DProj( tSpiegel, vec4( vSpUv.xy + wackel * vSpUv.w, vSpUv.zw ) ).rgb;
          diffuseColor = vec4( min( bild, vec3( 6.0 ) ) * nass * fres * uStaerke * uAn, pfuetze * uDunkel );
        }`);
  };
  m.customProgramCacheKey = () => "nassboden";
  bodenLoecher(m, o.loecher ?? []);

  const flaeche = new THREE.Mesh(geo, m);
  flaeche.rotation.x = -Math.PI / 2;
  flaeche.renderOrder = -1;
  flaeche.receiveShadow = false;
  flaeche.castShadow = false;
  // Spiegelbild nur, wenn es etwas bringt: nicht in der Draufsicht, nicht auf »schnell«
  flaeche.onBeforeRender = (renderer, scene, camera, geometry, material, group) => {
    const an = NASS.spiegel && DURCHSICHT.uDsAn.value < 0.5 && DURCHSICHT.uDsSichtAn.value < 0.5;
    u.uAn.value = an ? 1 : 0;
    if (!an) return;
    flaeche.visible = false;
    spiegel.matrixWorld.copy(flaeche.matrixWorld);
    spiegel.onBeforeRender(renderer, scene, camera, geometry, material, group);
    flaeche.visible = true;
  };
  flaeche.userData.entsorge = () => { spiegel.dispose(); };
  return flaeche;
}
