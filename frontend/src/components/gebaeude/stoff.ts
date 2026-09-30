/**
 * Oberflächen für die Gebäude-Stile: Muster werden auf ein Canvas gemalt
 * (grau, die Farbe kommt vom Material) und nach Weltkoordinaten aufgelegt —
 * so passen schmale und breite Felder nahtlos aneinander, nichts wird verzerrt.
 */
import * as THREE from "three";

export type Muster =
  | "fels" | "erde" | "stein" | "holz" | "parkett" | "marmor" | "teppich"
  | "fachwerk" | "metall" | "eis" | "tapete" | "sand" | "beton" | "putz";

const GROESSE = 256;

/** fester Zufall, damit ein Muster bei jedem Laden gleich aussieht */
export function zufallAus(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Malen = (c: CanvasRenderingContext2D, z: () => number) => void;
const G = GROESSE;
const grau = (v: number, a = 1) => `rgba(${v},${v},${v},${a})`;

/** Flecken in verschiedenen Helligkeiten (Grundlage für Stein, Erde, Sand …) */
function flecken(c: CanvasRenderingContext2D, z: () => number, n: number, r: [number, number], hell: [number, number], a = 0.35) {
  for (let i = 0; i < n; i++) {
    const x = z() * G, y = z() * G, rr = r[0] + z() * (r[1] - r[0]);
    c.fillStyle = grau(Math.round(hell[0] + z() * (hell[1] - hell[0])), a);
    // auch über den Rand, damit die Kachel nahtlos ist
    for (const dx of [-G, 0, G]) for (const dy of [-G, 0, G]) {
      c.beginPath(); c.arc(x + dx, y + dy, rr, 0, Math.PI * 2); c.fill();
    }
  }
}

function risse(c: CanvasRenderingContext2D, z: () => number, n: number, farbe: string, breite: number) {
  c.strokeStyle = farbe; c.lineWidth = breite;
  for (let i = 0; i < n; i++) {
    let x = z() * G, y = z() * G;
    c.beginPath(); c.moveTo(x, y);
    for (let k = 0; k < 6; k++) { x += (z() - 0.5) * 40; y += (z() - 0.5) * 40; c.lineTo(x, y); }
    c.stroke();
  }
}

/** Mauerwerk: Reihen versetzter Blöcke mit Fugen */
function bloecke(c: CanvasRenderingContext2D, z: () => number, reihen: number, jeReihe: number, fuge: number, grund: number) {
  const h = G / reihen, b = G / jeReihe;
  c.fillStyle = grau(grund - 90); c.fillRect(0, 0, G, G);
  for (let r = 0; r < reihen; r++) {
    const versatz = r % 2 ? b / 2 : 0;
    for (let k = -1; k <= jeReihe; k++) {
      c.fillStyle = grau(Math.round(grund - 25 + z() * 30));
      c.fillRect(k * b + versatz + fuge / 2, r * h + fuge / 2, b - fuge, h - fuge);
    }
  }
}

const MALER: Record<Muster, Malen> = {
  fels: (c, z) => {
    c.fillStyle = grau(215); c.fillRect(0, 0, G, G);
    flecken(c, z, 70, [10, 40], [150, 255], 0.35);
    flecken(c, z, 200, [2, 6], [90, 160], 0.4);
    risse(c, z, 10, grau(80, 0.6), 2);
  },
  erde: (c, z) => {
    c.fillStyle = grau(220); c.fillRect(0, 0, G, G);
    flecken(c, z, 90, [6, 26], [160, 250], 0.35);
    flecken(c, z, 400, [1, 3], [100, 170], 0.6); // Steinchen
  },
  stein: (c, z) => {
    bloecke(c, z, 4, 2, 6, 245);
    flecken(c, z, 160, [2, 8], [150, 255], 0.2);
  },
  holz: (c, z) => {
    // Dielen: 4 Bretter, Maserung längs, versetzte Stöße
    const b = G / 4;
    for (let k = 0; k < 4; k++) {
      c.fillStyle = grau(Math.round(205 + z() * 40)); c.fillRect(0, k * b, G, b);
      c.strokeStyle = grau(150, 0.35); c.lineWidth = 1.2;
      for (let m = 0; m < 7; m++) {
        const y = k * b + 4 + z() * (b - 8);
        c.beginPath(); c.moveTo(0, y);
        for (let x = 0; x <= G; x += 32) c.lineTo(x, y + Math.sin(x / 30 + m) * 2);
        c.stroke();
      }
      c.fillStyle = grau(90); c.fillRect(0, k * b, G, 2);
      c.fillRect(((k * 0.37) % 1) * G, k * b, 3, b);
    }
  },
  parkett: (c, z) => {
    // Fischgrät aus kleinen Brettchen
    c.fillStyle = grau(120); c.fillRect(0, 0, G, G);
    const l = 64, w = 16;
    for (let y = -l; y < G + l; y += w * 2) for (let x = -l; x < G + l; x += l) {
      for (const [dx, dy, quer] of [[0, 0, false], [l / 2, w, true]] as const) {
        c.fillStyle = grau(Math.round(200 + z() * 45));
        if (quer) c.fillRect(x + dx + 1, y + dy + 1, w - 2, l - 2);
        else c.fillRect(x + dx + 1, y + dy + 1, l - 2, w - 2);
      }
    }
  },
  marmor: (c, z) => {
    c.fillStyle = grau(250); c.fillRect(0, 0, G, G);
    flecken(c, z, 30, [20, 50], [225, 250], 0.25);
    c.lineWidth = 1.5;
    for (let i = 0; i < 6; i++) {
      c.strokeStyle = grau(Math.round(150 + z() * 50), 0.55);
      let x = z() * G, y = 0;
      c.beginPath(); c.moveTo(x, y);
      while (y < G) { y += 12; x += (z() - 0.5) * 22; c.lineTo(x, y); }
      c.stroke();
    }
    // große Platten
    c.fillStyle = grau(170); c.fillRect(0, 0, G, 2); c.fillRect(0, 0, 2, G);
  },
  teppich: (c, z) => {
    // 70er: Kreise in Ringen auf Flor
    c.fillStyle = grau(230); c.fillRect(0, 0, G, G);
    for (let y = 32; y < G; y += 64) for (let x = 32; x < G; x += 64) {
      for (const [r, v] of [[28, 170], [20, 245], [12, 190], [5, 245]] as const) {
        c.fillStyle = grau(v); c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
      }
    }
    flecken(c, z, 900, [0.6, 1.4], [150, 255], 0.35);
  },
  fachwerk: (c, z) => {
    c.fillStyle = grau(250); c.fillRect(0, 0, G, G);
    flecken(c, z, 60, [4, 14], [225, 250], 0.3);
    c.fillStyle = grau(60);
    const b = 14;
    c.fillRect(0, 0, b, G); c.fillRect(G / 2 - b / 2, 0, b, G); // Ständer
    c.fillRect(0, G - b, G, b); c.fillRect(0, G / 2 - b / 2, G, b); // Riegel
    c.strokeStyle = grau(60); c.lineWidth = b;
    c.beginPath(); c.moveTo(b, G / 2); c.lineTo(G / 2, 0); c.stroke(); // Streben
    c.beginPath(); c.moveTo(G / 2, G); c.lineTo(G, G / 2); c.stroke();
  },
  metall: (c, z) => {
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
      c.fillStyle = grau(Math.round(215 + z() * 30)); c.fillRect(x * 128 + 2, y * 128 + 2, 124, 124);
      c.fillStyle = grau(150);
      for (const [nx, ny] of [[10, 10], [118, 10], [10, 118], [118, 118]]) {
        c.beginPath(); c.arc(x * 128 + nx, y * 128 + ny, 3, 0, Math.PI * 2); c.fill();
      }
    }
    c.fillStyle = grau(110); c.fillRect(0, 0, G, 2); c.fillRect(0, 128, G, 2); c.fillRect(0, 0, 2, G); c.fillRect(128, 0, 2, G);
    c.strokeStyle = grau(255, 0.15); c.lineWidth = 1;
    for (let i = 0; i < 40; i++) { const y = z() * G; c.beginPath(); c.moveTo(0, y); c.lineTo(G, y); c.stroke(); }
  },
  eis: (c, z) => {
    c.fillStyle = grau(245); c.fillRect(0, 0, G, G);
    flecken(c, z, 40, [15, 45], [215, 255], 0.3);
    risse(c, z, 14, grau(255, 0.9), 1.5);
    risse(c, z, 8, grau(170, 0.5), 1);
  },
  tapete: (c, z) => {
    // Streifen und Lilien (Damast)
    c.fillStyle = grau(215); c.fillRect(0, 0, G, G);
    c.fillStyle = grau(245, 0.5);
    for (let x = 0; x < G; x += 64) c.fillRect(x, 0, 8, G);
    c.fillStyle = grau(255, 0.55);
    for (let y = 32; y < G; y += 64) for (let x = 32; x < G; x += 64) {
      const s = (y / 64) % 2 ? 32 : 0;
      c.beginPath(); c.ellipse((x + s) % G, y, 7, 14, 0, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse((x + s) % G - 9, y + 6, 4, 9, -0.6, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse((x + s) % G + 9, y + 6, 4, 9, 0.6, 0, Math.PI * 2); c.fill();
    }
    flecken(c, z, 60, [2, 5], [180, 230], 0.15);
  },
  sand: (c, z) => {
    c.fillStyle = grau(235); c.fillRect(0, 0, G, G);
    c.strokeStyle = grau(200, 0.5); c.lineWidth = 3;
    for (let y = 8; y < G; y += 22) {
      c.beginPath();
      for (let x = 0; x <= G; x += 8) c.lineTo(x, y + Math.sin((x / G) * Math.PI * 4 + y) * 5);
      c.stroke();
    }
    flecken(c, z, 800, [0.6, 1.5], [170, 255], 0.5);
  },
  beton: (c, z) => {
    c.fillStyle = grau(235); c.fillRect(0, 0, G, G);
    flecken(c, z, 50, [10, 40], [210, 250], 0.2);
    flecken(c, z, 300, [0.8, 2], [140, 190], 0.5); // Poren
    c.fillStyle = grau(170); c.fillRect(0, 0, G, 2); c.fillRect(0, 0, 2, G); // Schalungsfugen
    for (const [x, y] of [[40, 40], [216, 40], [40, 216], [216, 216]]) {
      c.fillStyle = grau(160); c.beginPath(); c.arc(x, y, 4, 0, Math.PI * 2); c.fill();
    }
  },
  putz: (c, z) => {
    c.fillStyle = grau(245); c.fillRect(0, 0, G, G);
    flecken(c, z, 120, [3, 12], [215, 255], 0.25);
  },
};

const cache = new Map<Muster, THREE.CanvasTexture | null>();

/** Die Musterkachel (null ohne Canvas, z. B. in Tests) */
export function textur(m: Muster): THREE.CanvasTexture | null {
  if (cache.has(m)) return cache.get(m)!;
  let t: THREE.CanvasTexture | null = null;
  const c = typeof document !== "undefined" ? document.createElement("canvas") : null;
  const ctx = c?.getContext("2d");
  if (c && ctx) {
    c.width = c.height = GROESSE;
    MALER[m](ctx, zufallAus([...m].reduce((s, ch) => s * 31 + ch.charCodeAt(0), 7)));
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
