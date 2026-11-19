/**
 * Gelände für den Aufbau (2,5D): bikubisch auf 3 m interpoliert, in Kacheln (Sichtprüfung je Kachel).
 * Der Shader zeigt das Bauraster, dunkelt nicht erschlossenes Land ab und tönt einen Einzugsbereich,
 * der nach außen weich ausläuft. Welt: x = Karte x − B/2, z = Karte y − B/2.
 */
import * as THREE from "three";
import type { Gelaende } from "@/lib/gelaende/gelaende";
import { fbm, perlin } from "@/lib/gelaende/rauschen";
import { wasserspiegel } from "../drei/szene";

/** Catmull-Rom-Gewichte */
const cr = (t: number): [number, number, number, number] => {
  const t2 = t * t, t3 = t2 * t;
  return [(-t3 + 2 * t2 - t) / 2, (3 * t3 - 5 * t2 + 2) / 2, (-3 * t3 + 4 * t2 + t) / 2, (t3 - t2) / 2];
};

/** Höhe bikubisch zwischen den Zellmitten (Karte in Metern) */
export function hoeheGlatt(g: Gelaende, x: number, y: number): number {
  const n = g.n, fx = x / g.zelle - 0.5, fy = y / g.zelle - 0.5;
  const i = Math.floor(fx), j = Math.floor(fy);
  const wx = cr(fx - i), wy = cr(fy - j);
  let h = 0;
  for (let b = 0; b < 4; b++) {
    const jj = Math.max(0, Math.min(n - 1, j - 1 + b));
    let zeile = 0;
    for (let a = 0; a < 4; a++) zeile += wx[a] * g.hoehe[jj * n + Math.max(0, Math.min(n - 1, i - 1 + a))];
    h += wy[b] * zeile;
  }
  return h;
}

export interface GelaendeUniforms {
  uFrei: { value: THREE.DataTexture };
  uRaster: { value: number };
  uKreis: { value: THREE.Vector4 };
  uKreisFarbe: { value: THREE.Color };
  uBreite: { value: number };
}

/** Farbe nach Höhe, Neigung und Flecken: sattes Grün wie im Aufbauspiel, Fels an Hängen, Sand am Wasser */
function farbe(g: Gelaende, x: number, y: number, h: number, steil: number, r: ReturnType<typeof perlin>, out: THREE.Color) {
  const k = Math.min(g.n - 1, Math.floor(y / g.zelle)) * g.n + Math.min(g.n - 1, Math.floor(x / g.zelle));
  const fleck = fbm(r, x / 160, y / 160, 3);
  out.setRGB(0.36 + 0.06 * fleck, 0.55 + 0.07 * fleck, 0.25 + 0.03 * fleck);
  if (g.aue[k]) out.lerp(new THREE.Color(0.3, 0.5, 0.26), 0.5);
  if (g.abstandWasser[k] < 10) out.lerp(new THREE.Color(0.78, 0.72, 0.52), 0.65);
  const fels = Math.min(1, Math.max(0, (steil - 22) / 25));
  out.lerp(new THREE.Color(0.52, 0.48, 0.43), fels);
  if (h > 600) out.lerp(new THREE.Color(0.92, 0.93, 0.95), Math.min(1, (h - 600) / 120));
}

/** Masken der Welt fürs Gelände: erschlossen (R), nasse Aue (G), trockengelegt (B) */
export interface Masken { frei: Uint8Array; trocken: Uint8Array; acker?: Uint8Array }

export function baueGelaende(g: Gelaende, m0: Masken): { gruppe: THREE.Group; uniforms: GelaendeUniforms; setzeMasken(m: Masken): void; entsorge(): void } {
  const B = g.breite, h2 = B / 2, S = 3, N = Math.round(B / S), K = 8, Q = N / K;
  const tex = new THREE.DataTexture(new Uint8Array(g.n * g.n * 4), g.n, g.n, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  const setzeMasken = (m: Masken) => {
    const d = tex.image.data as Uint8Array;
    for (let k = 0; k < g.n * g.n; k++) {
      d[k * 4] = m.frei[k] ? 255 : 0;
      d[k * 4 + 1] = g.aue[k] && !m.trocken[k] && !g.wasser[k] ? 255 : 0;
      d[k * 4 + 2] = m.trocken[k] ? 255 : 0;
      // Acker je Hof: 1 Winterkorn, 2 Sommerkorn, 3 Brache → 0, 64, 128; kein Acker 255
      d[k * 4 + 3] = m.acker?.[k] ? (m.acker[k] - 1) * 64 : 255;
    }
    tex.needsUpdate = true;
  };
  setzeMasken(m0);
  const uniforms: GelaendeUniforms = {
    uFrei: { value: tex }, uRaster: { value: 0 }, uKreis: { value: new THREE.Vector4(0, 0, 0, 0) },
    uKreisFarbe: { value: new THREE.Color(0x3b82f6) }, uBreite: { value: B },
  };
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWp;")
      .replace("#include <project_vertex>", "#include <project_vertex>\n  vWp = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>
varying vec3 vWp;
uniform sampler2D uFrei;
uniform float uRaster;
uniform vec4 uKreis;
uniform vec3 uKreisFarbe;
uniform float uBreite;`)
      .replace("#include <color_fragment>", `#include <color_fragment>
  vec2 kartenUv = (vWp.xz + uBreite * 0.5) / uBreite;
  vec4 maske = texture2D(uFrei, kartenUv);
  float frei = maske.r;
  // nasse Aue: blaugrün getönt (Hochwasser, nicht bebaubar); trockengelegt: feine Entwässerungsgräben
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.32, 0.52, 0.5), 0.45 * smoothstep(0.3, 0.7, maske.g));
  float graben = 1.0 - smoothstep(0.0, 0.25 + fwidth(vWp.x), abs(fract((vWp.x + vWp.z) / 18.0) - 0.5) * 18.0);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.36, 0.45, 0.32), 0.5 * graben * smoothstep(0.3, 0.7, maske.b));
  // Äcker der Höfe (Dreifelderwirtschaft): Winterkorn gold, Sommerkorn grün, Brache braun-grün; Furchen je
  // Frucht in eigener Richtung, Feldraine dunkel, wo zwei Höfe aneinanderstoßen
  float acker = 1.0 - smoothstep(0.6, 0.7, maske.a);
  if (acker > 0.01) {
    float a = maske.a;
    vec3 feld = a < 0.12 ? vec3(0.86, 0.72, 0.32) : a < 0.37 ? vec3(0.5, 0.66, 0.26) : vec3(0.58, 0.5, 0.34);
    vec2 r = a < 0.12 ? vec2(1.0, 0.0) : a < 0.37 ? vec2(0.0, 1.0) : vec2(0.7, 0.7);
    float furche = 0.86 + 0.14 * sin(dot(vWp.xz, r) * 2.6);
    float rain = smoothstep(0.02, 0.08, fwidth(a) * 3.0) * (1.0 - smoothstep(0.6, 0.7, a));
    diffuseColor.rgb = mix(diffuseColor.rgb, feld * furche, 0.9 * acker);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.3, 0.38, 0.2), 0.6 * rain);
  }
  // Bauraster (6 m) nur auf erschlossenem Land
  vec2 f = abs(fract(vWp.xz / 6.0 + 0.5) - 0.5) * 6.0;
  float linie = 1.0 - smoothstep(0.0, 0.18 + fwidth(vWp.x) * 0.8, min(f.x, f.y));
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.72, linie * uRaster * frei);
  // Einzugsbereich: innen getönt, nach außen weich auslaufend, Rand als Linie
  if (uKreis.w > 0.5) {
    float d = distance(vWp.xz, uKreis.xy);
    float innen = 1.0 - smoothstep(uKreis.z * 0.8, uKreis.z * 1.3, d);
    diffuseColor.rgb = mix(diffuseColor.rgb, uKreisFarbe, 0.32 * innen);
    float rand = 1.0 - smoothstep(0.0, 1.5 + fwidth(d) * 1.5, abs(d - uKreis.z));
    diffuseColor.rgb = mix(diffuseColor.rgb, uKreisFarbe, 0.7 * rand);
  }
  // nicht erschlossen: dunkler und entsättigt
  float grau = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
  diffuseColor.rgb = mix(vec3(grau) * 0.55, diffuseColor.rgb, 0.35 + 0.65 * smoothstep(0.2, 0.8, frei));`);
  };
  const gruppe = new THREE.Group();
  const r = perlin(g.wahl.seed + 9);
  const c = new THREE.Color();
  const geos: THREE.BufferGeometry[] = [];
  for (let cy = 0; cy < K; cy++) for (let cx = 0; cx < K; cx++) {
    const m = Q + 1, pos = new Float32Array(m * m * 3), col = new Float32Array(m * m * 3);
    for (let b = 0; b < m; b++) for (let a = 0; a < m; a++) {
      const x = (cx * Q + a) * S, y = (cy * Q + b) * S, h = hoeheGlatt(g, x, y);
      const hx = hoeheGlatt(g, x + S, y) - hoeheGlatt(g, x - S, y), hy = hoeheGlatt(g, x, y + S) - hoeheGlatt(g, x, y - S);
      farbe(g, x, y, h, (Math.hypot(hx, hy) / (2 * S)) * 100, r, c);
      const k = b * m + a;
      pos.set([x - h2, h, y - h2], k * 3);
      col.set([c.r, c.g, c.b], k * 3);
    }
    const idx: number[] = [];
    for (let b = 0; b < Q; b++) for (let a = 0; a < Q; a++) {
      const p = b * m + a;
      idx.push(p, p + m, p + 1, p + 1, p + m, p + m + 1);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    geos.push(geo);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.userData.gelaende = true;
    gruppe.add(mesh);
  }
  // Wasser: Spiegel je Zelle, an Land knapp unter dem Boden
  const sp = wasserspiegel(g), n = g.n;
  const wPos: number[] = [], wIdx: number[] = [], ecke = new Map<number, number>();
  const v = (k: number) => {
    let e = ecke.get(k);
    if (e === undefined) {
      const i = k % n, j = Math.floor(k / n);
      e = wPos.length / 3;
      wPos.push((i + 0.5) * g.zelle - h2, Number.isNaN(sp[k]) ? g.hoehe[k] - 0.3 : sp[k], (j + 0.5) * g.zelle - h2);
      ecke.set(k, e);
    }
    return e;
  };
  for (let j = 0; j + 1 < n; j++) for (let i = 0; i + 1 < n; i++) {
    const a = j * n + i, b = a + 1, cc = a + n, d = cc + 1;
    if (g.wasser[a] || g.wasser[b] || g.wasser[cc] || g.wasser[d]) wIdx.push(v(a), v(cc), v(b), v(b), v(cc), v(d));
  }
  const wMat = new THREE.MeshPhongMaterial({ color: 0x2f73b0, transparent: true, opacity: 0.88, shininess: 40, specular: 0x334a5c });
  if (wIdx.length) {
    const wGeo = new THREE.BufferGeometry();
    wGeo.setAttribute("position", new THREE.Float32BufferAttribute(wPos, 3));
    wGeo.setIndex(wIdx);
    wGeo.computeVertexNormals();
    geos.push(wGeo);
    gruppe.add(new THREE.Mesh(wGeo, wMat));
  }
  return {
    gruppe, uniforms, setzeMasken,
    entsorge() { geos.forEach(x => x.dispose()); mat.dispose(); wMat.dispose(); tex.dispose(); },
  };
}
