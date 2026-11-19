/**
 * Fassaden und Dächer der 3D-Stadt aus Blender-Kacheln (scripts/stadt/fassaden.py → /modelle/stadt/kacheln):
 *
 * - Wände: je Achse (3,4 m) und Geschoss (3,1 m) ein Fensterfeld mit Rahmen, Sprossen, Faschen, Sohlbank und
 *   Gurtgesims, aus Weltkoordinaten gekachelt — dasselbe Raster wie die gemalten Fenster vorher. Der Putz ist
 *   hell und nimmt die Farbe des Hauses an; etwa jedes fünfte Haus ist aus Backstein (eigene Farbe).
 * - Dächer: Biberschwanz entlang des Hangs, Flachdächer mit Bahnen; beide nehmen die Dachfarbe an.
 * - Normal-Maps: Fensterlaibung, Sohlbank, Fugen und Ziegelkanten fangen das Licht.
 *
 * Ohne Kacheln (Tests, noch nicht geladen) malt der Wand-Shader die schlichten Fenster wie bisher.
 */
import * as THREE from "three";

const BASIS = "/modelle/stadt/kacheln";
const NAMEN = ["putz", "ziegel", "dach", "flachdach"] as const;
type Name = (typeof NAMEN)[number];
export type StadtKacheln = Record<Name, { farbe: THREE.Texture; normal: THREE.Texture }>;

let fertig: StadtKacheln | null = null;
let laden: Promise<StadtKacheln | null> | null = null;

/** einmal laden; null ohne WebGL2 oder bei Fehler */
export function ladeStadtKacheln(): Promise<StadtKacheln | null> {
  if (laden) return laden;
  if (typeof window === "undefined" || !("WebGL2RenderingContext" in window)) return (laden = Promise.resolve(null));
  const tl = new THREE.TextureLoader();
  const eine = (name: Name, art: "farbe" | "normal") => tl.loadAsync(`${BASIS}/${name}_${art}.jpg`).then(t => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    t.colorSpace = art === "farbe" ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.userData.geteilt = true;
    return t;
  });
  laden = Promise.all(NAMEN.map(n => Promise.all([eine(n, "farbe"), eine(n, "normal")]).then(([farbe, normal]) => [n, { farbe, normal }] as const)))
    .then(e => (fertig = Object.fromEntries(e) as StadtKacheln))
    .catch(() => null);
  return laden;
}

export const stadtKacheln = () => fertig;

/** Weltlage und Normale an den Fragment-Shader reichen (mit Instanzen) */
const WELT_VERTEX = (sh: THREE.WebGLProgramParametersWithUniforms) => {
  sh.vertexShader = sh.vertexShader
    .replace("#include <common>", "#include <common>\nvarying vec3 vWp;\nvarying vec3 vWn;\nvarying vec2 vHaus;")
    .replace("#include <project_vertex>", `#include <project_vertex>
  mat4 wm = modelMatrix;
  #ifdef USE_INSTANCING
  wm = modelMatrix * instanceMatrix;
  #endif
  vWp = (wm * vec4(transformed, 1.0)).xyz;
  vWn = normalize(mat3(wm) * objectNormal);
  vHaus = (wm * vec4(0.0, 0.0, 0.0, 1.0)).xz;`);
};

/** Normale aus der Normal-Map in Weltrichtungen (T, B, N) und weiter in Kameraraum */
const RELIEF = `
  vec3 reliefNormale(vec3 nt, vec3 T, vec3 B, vec3 N, float staerke) {
    nt = nt * 2.0 - 1.0;
    nt.xy *= staerke;
    vec3 nw = normalize(T * nt.x + B * nt.y + N * nt.z);
    return normalize((viewMatrix * vec4(nw, 0.0)).xyz);
  }`;

/**
 * Wandmaterial: Fensterfelder aus der Kachel (mit Kacheln) bzw. gemalte Fenster (ohne).
 * `ziegel` = Anteil der Häuser aus Backstein (nach der Lage des Hauses gewürfelt).
 */
export function fassadenStoff(m: THREE.MeshLambertMaterial, ziegel = 0.2): THREE.MeshLambertMaterial {
  const K = fertig;
  m.onBeforeCompile = sh => {
    WELT_VERTEX(sh);
    const kopf = "#include <common>\nvarying vec3 vWp;\nvarying vec3 vWn;\nvarying vec2 vHaus;";
    if (!K) {
      sh.fragmentShader = sh.fragmentShader.replace("#include <common>", kopf).replace("#include <color_fragment>", `#include <color_fragment>
  if (abs(vWn.y) < 0.4) {
    vec2 t = normalize(vec2(-vWn.z, vWn.x));
    float fu = fract(dot(vWp.xz, t) / 3.4);
    float fv = fract(vWp.y / 3.1);
    if (fu > 0.3 && fu < 0.7 && fv > 0.38 && fv < 0.84) diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.17, 0.21, 0.27), 0.8);
  }`);
      return;
    }
    Object.assign(sh.uniforms, {
      uPutz: { value: K.putz.farbe }, uPutzN: { value: K.putz.normal },
      uZiegel: { value: K.ziegel.farbe }, uZiegelN: { value: K.ziegel.normal }, uZiegelAnteil: { value: ziegel },
    });
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `${kopf}
  uniform sampler2D uPutz, uPutzN, uZiegel, uZiegelN;
  uniform float uZiegelAnteil;
  float hausZufall(vec2 p) { return fract(sin(dot(floor(p * 0.5), vec2(12.9898, 78.233))) * 43758.5453); }
  ${RELIEF}`)
      .replace("#include <color_fragment>", `#include <color_fragment>
  bool wandFlaeche = abs(vWn.y) < 0.4;
  bool backstein = hausZufall(vHaus) < uZiegelAnteil;
  vec2 wt = normalize(vec2(-vWn.z, vWn.x));
  vec2 wuv = vec2(dot(vWp.xz, wt) / 3.4, vWp.y / 3.1);
  if (wandFlaeche) {
    // Putz nimmt die Hausfarbe an; Backstein bringt seine eigene mit (die Helligkeit je Ecke bleibt)
    if (backstein) diffuseColor.rgb = texture(uZiegel, wuv).rgb * (0.55 + 0.45 * max(vColor.r, max(vColor.g, vColor.b)));
    else diffuseColor.rgb *= texture(uPutz, wuv).rgb * 1.12;
  }`)
      .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
  if (wandFlaeche) {
    vec3 nt = backstein ? texture(uZiegelN, wuv).xyz : texture(uPutzN, wuv).xyz;
    normal = reliefNormale(nt, vec3(wt.x, 0.0, wt.y), vec3(0.0, 1.0, 0.0), normalize(vWn), 1.3);
  }`);
  };
  m.customProgramCacheKey = () => `fassade|${K ? "kachel" : "gemalt"}|${ziegel}`;
  return m;
}

/** Dachmaterial: Biberschwanz auf schrägen Flächen (entlang Traufe und Hang), Bahnen auf flachen */
export function dachStoff(m: THREE.MeshLambertMaterial): THREE.MeshLambertMaterial {
  const K = fertig;
  if (!K) return m;
  m.onBeforeCompile = sh => {
    WELT_VERTEX(sh);
    Object.assign(sh.uniforms, {
      uDach: { value: K.dach.farbe }, uDachN: { value: K.dach.normal },
      uFlach: { value: K.flachdach.farbe }, uFlachN: { value: K.flachdach.normal },
    });
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>
  varying vec3 vWp;
  varying vec3 vWn;
  varying vec2 vHaus;
  uniform sampler2D uDach, uDachN, uFlach, uFlachN;
  ${RELIEF}`)
      .replace("#include <color_fragment>", `#include <color_fragment>
  vec3 dn = normalize(vWn);
  bool schraeg = dn.y > 0.2 && dn.y < 0.96;
  bool flach = dn.y >= 0.96;
  float waag = max(length(dn.xz), 1e-4);
  vec2 dt = normalize(vec2(-dn.z, dn.x) + 1e-5);
  // Hang hinauf: senkrecht auf die Traufe, in der Dachfläche
  vec3 hang = vec3(-dn.x * dn.y, 1.0 - dn.y * dn.y, -dn.z * dn.y) / waag;
  vec2 duv = schraeg ? vec2(dot(vWp.xz, dt), dot(vWp, hang)) / 2.0 : vWp.xz / 2.0;
  if (schraeg) diffuseColor.rgb *= texture(uDach, duv).rgb * 1.2;
  else if (flach) diffuseColor.rgb *= texture(uFlach, duv).rgb * 1.25;`)
      .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
  if (schraeg) normal = reliefNormale(texture(uDachN, duv).xyz, vec3(dt.x, 0.0, dt.y), hang, dn, 1.4);
  else if (flach) normal = reliefNormale(texture(uFlachN, duv).xyz, vec3(1.0, 0.0, 0.0), vec3(0.0, 0.0, -1.0), dn, 1.0);`);
  };
  m.customProgramCacheKey = () => "dach|kachel";
  return m;
}
