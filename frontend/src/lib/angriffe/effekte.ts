/**
 * Elementar-Angriffe für 3D-Kämpfe (Bosskampf): ein Baukasten aus Spitzen, Partikeln, Brocken,
 * Rissen, Bodenscheiben, Druckwellen, Lichtsäulen, Blitzen, Ranken und Flammen, dazu elf Elemente,
 * die daraus jeweils Weg, Treffer und Finale zusammensetzen. Alles hängt an einer Szene;
 * effektWelt() erzeugt Texturen und Materialien erst im Browser.
 */
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export type ElementId = "eis" | "feuer" | "erde" | "blitz" | "pflanzen" | "dunkel" | "gift" | "blut" | "schatten" | "fee" | "wind"
  | "schall" | "licht" | "klingen" | "arkan";
export const ELEMENTE: { id: ElementId; name: string; icon: string }[] = [
  { id: "eis", name: "Eis", icon: "❄️" }, { id: "feuer", name: "Feuer", icon: "🔥" }, { id: "erde", name: "Erde", icon: "🪨" },
  { id: "blitz", name: "Blitz", icon: "⚡" }, { id: "pflanzen", name: "Pflanzen", icon: "🌿" }, { id: "dunkel", name: "Dunkelheit", icon: "🌑" },
  { id: "gift", name: "Gift", icon: "☠️" }, { id: "blut", name: "Blut", icon: "🩸" }, { id: "schatten", name: "Schatten", icon: "👤" },
  { id: "fee", name: "Fee", icon: "🧚" }, { id: "wind", name: "Wind", icon: "🌪️" }, { id: "schall", name: "Schall", icon: "🔊" },
  { id: "licht", name: "Licht", icon: "✨" }, { id: "klingen", name: "Klingen", icon: "⚔️" }, { id: "arkan", name: "Arkan", icon: "🔮" },
];

type V3 = THREE.Vector3;
type Rgb = [number, number, number];
/** Hex-Zahl (sRGB) oder lineares [r, g, b]; Werte über 1 leuchten im Bloom */
type Farbe = number | Rgb;

const zufall = (a: number, b: number) => a + Math.random() * (b - a);
const wahl = <T,>(liste: readonly T[]): T => liste[Math.floor(Math.random() * liste.length)];
const easeOutBack = (x: number) => { const c1 = 2.2, c3 = c1 + 1; return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2; };
const easeOutCubic = (x: number) => 1 - (1 - x) ** 3;
const P = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const V2 = (x: number, y: number) => new THREE.Vector2(x, y);
const OBEN = P(0, 1, 0);
const C = (x: Farbe): Rgb => (Array.isArray(x) ? x : ((c) => [c.r, c.g, c.b] as Rgb)(new THREE.Color(x)));
/** Richtung, die um `lehne` (Bogenmaß) von der Senkrechten zur waagrechten Richtung `waag` kippt */
const kipp = (lehne: number, waag: V3) => OBEN.clone().multiplyScalar(Math.cos(lehne)).addScaledVector(waag, Math.sin(lehne)).normalize();
const kreis = (w: number) => P(Math.cos(w), 0, Math.sin(w));

type Getroffen = { tint: number; staerke?: number; blitz?: Rgb; stoss?: number; dir?: V3 };
type Farbteil = { mat: { color: THREE.Color; emissive: THREE.Color }; farbe: THREE.Color; leuchten: THREE.Color };

/** Eine Kampffigur: Modell plus Trefferzustand (Einfärben, Aufleuchten, Wegstoßen, Wirbeln). */
export class Figur {
  gruppe = new THREE.Group();
  /** Standpunkt am Boden; die Gruppe steht bei basis + stoss */
  basis = new THREE.Vector3();
  stoss = new THREE.Vector3();
  /** Blickrichtung (rotation.y) und zusätzliche Drehung (Wirbelwind) */
  blick = 0;
  dreh = 0;
  hoehe = 1.8;
  blitz = 0; frost = 0; frostZiel = 0; puls = 0;
  blitzFarbe = new THREE.Color(1.2, 1.4, 1.6);
  tint = new THREE.Color(0xa8dcff);
  private teile: Farbteil[] = [];
  private modell: THREE.Object3D | null = null;

  setzeModell(o: THREE.Object3D, hoehe: number) {
    if (this.modell) this.gruppe.remove(this.modell);
    this.modell = o; this.hoehe = hoehe;
    this.gruppe.add(o);
    this.teile = [];
    o.traverse((t) => {
      const m = (t as THREE.Mesh).material as unknown as { color?: THREE.Color; emissive?: THREE.Color } | undefined;
      if (m?.color && m.emissive) this.teile.push({ mat: m as Farbteil["mat"], farbe: m.color.clone(), leuchten: m.emissive.clone() });
    });
  }
  treffer({ tint, staerke = 1, blitz = [1.2, 1.4, 1.6], stoss = 0.3, dir }: Getroffen) {
    this.tint.set(tint); this.frostZiel = staerke; this.blitzFarbe.setRGB(...blitz); this.blitz = 1;
    if (dir) this.stoss.copy(dir).multiplyScalar(stoss);
  }
  loesen = () => { this.frostZiel = 0; };
  update(dt: number) {
    this.blitz = Math.max(0, this.blitz - dt * 4);
    this.frost += (this.frostZiel - this.frost) * Math.min(1, dt * 8);
    this.stoss.multiplyScalar(Math.exp(-dt * 7));
    this.puls = Math.max(0, this.puls - dt * 3);
    this.gruppe.position.copy(this.basis).add(this.stoss);
    const q = this.stoss.length(), p = 1 + Math.sin(this.puls * Math.PI) * 0.2;
    this.gruppe.scale.set((1 + q * 0.4) * p, (1 - q * 0.4) * p, (1 + q * 0.4) * p);
    this.gruppe.rotation.y = this.blick + this.dreh;
    const zusatz = this.tint.clone().multiplyScalar(this.frost * 0.15);
    for (const t of this.teile) {
      t.mat.color.copy(t.farbe).lerp(this.tint, this.frost * 0.75);
      t.mat.emissive.copy(t.leuchten).add(this.blitzFarbe.clone().multiplyScalar(this.blitz)).add(zusatz);
    }
  }
}

export type EffektWelt = ReturnType<typeof effektWelt>;

/** Erzeugt den Effekt-Baukasten für eine Szene. renderer wird nur für die Spiegel-Umgebung gebraucht. */
export function effektWelt(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
  const umgebung = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  const v = P();
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = P(), _p = P(), _farbe = new THREE.Color();
  const wegwerfen: { dispose(): void }[] = [umgebung];

  let wackel = 0, dunkel = 0, dunkelZiel = 0;
  const ruetteln = (x: number) => { wackel = Math.max(wackel, x); };
  const frontLicht = new THREE.PointLight(0x5ab8ff, 0, 7, 2);
  const blitzLicht = new THREE.PointLight(0x9fd8ff, 0, 14, 2);
  scene.add(frontLicht, blitzLicht);
  const aufblitzen = (p: V3, farbe: number, staerke: number) => { blitzLicht.color.set(farbe); blitzLicht.position.copy(p); blitzLicht.intensity = staerke; };

  const WEICH = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d")!;
    const verlauf = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    verlauf.addColorStop(0, "rgba(255,255,255,1)");
    verlauf.addColorStop(0.4, "rgba(255,255,255,0.45)");
    verlauf.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = verlauf;
    g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  })();
  wegwerfen.push(WEICH);

  // ---------- Materialien: Facetten + leuchtender Fresnel-Rand ----------
  function mitRand<M extends THREE.Material>(mat: M, [r, g, b]: Rgb, staerke = 1.4, hoch = 3): M {
    mat.onBeforeCompile = (s) => {
      s.fragmentShader = s.fragmentShader.replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
        float fresnel = 1.0 - abs(dot(normalize(vViewPosition), normal));
        totalEmissiveRadiance += vec3(${r.toFixed(3)}, ${g.toFixed(3)}, ${b.toFixed(3)}) * pow(fresnel, ${hoch.toFixed(1)}) * ${staerke.toFixed(2)};`);
    };
    mat.customProgramCacheKey = () => `rand:${r},${g},${b}:${staerke}:${hoch}`;
    wegwerfen.push(mat);
    return mat;
  }
  /** Rand in der Instanzfarbe (Splitter, Tropfen, Blasen) */
  function randAusFarbe<M extends THREE.Material>(mat: M, staerke: number): M {
    mat.onBeforeCompile = (s) => {
      s.fragmentShader = s.fragmentShader.replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
        #ifdef USE_COLOR
          float fresnel = 1.0 - abs(dot(normalize(vViewPosition), normal));
          totalEmissiveRadiance += vColor.rgb * pow(fresnel, 3.0) * ${staerke.toFixed(2)};
        #endif`);
    };
    mat.customProgramCacheKey = () => `randfarbe:${staerke}`;
    wegwerfen.push(mat);
    return mat;
  }
  const MAT: Record<string, THREE.Material> = {
    eis: mitRand(new THREE.MeshStandardMaterial({ color: 0x5fb4ee, emissive: 0x1a6cff, emissiveIntensity: 0.35, roughness: 0.12, metalness: 0.25, flatShading: true, transparent: true, opacity: 0.9, envMap: umgebung, envMapIntensity: 1.2 }), [0.5, 0.85, 1.0], 1.4),
    stein: mitRand(new THREE.MeshStandardMaterial({ color: 0x6e5c4a, roughness: 0.95, flatShading: true }), [1.0, 0.4, 0.1], 0.35, 4),
    dorn: mitRand(new THREE.MeshStandardMaterial({ color: 0x2f7a2a, emissive: 0x0a2a06, roughness: 0.6, flatShading: true }), [0.5, 1.0, 0.25], 0.7),
    blut: mitRand(new THREE.MeshPhysicalMaterial({ color: 0x3a0005, emissive: 0x0c0001, roughness: 0.22, clearcoat: 0.8, clearcoatRoughness: 0.12, envMap: umgebung, envMapIntensity: 0.55 }), [0.6, 0.0, 0.03], 0.35),
    schatten: mitRand(new THREE.MeshStandardMaterial({ color: 0x040208, roughness: 1 }), [0.5, 0.2, 1.0], 1.5, 2),
  };

  // ---------- Formen (Höhe 1, Radius 0.5, Fuß bei y = 0) ----------
  /** Ecken verwackeln; gleiche Ecken bekommen denselben Versatz, damit keine Naht aufreißt */
  function zacken(geo: THREE.BufferGeometry, staerke: number) {
    const p = geo.attributes.position, versatz = new Map<string, Rgb>();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), key = `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;
      if (!versatz.has(key)) versatz.set(key, [zufall(-1, 1) * staerke, y > 0.001 && y < 0.999 ? zufall(-0.5, 0.5) * staerke : 0, zufall(-1, 1) * staerke]);
      const [dx, dy, dz] = versatz.get(key)!;
      p.setXYZ(i, x + dx, y + dy, z + dz);
    }
    geo.computeVertexNormals();
    return geo;
  }
  /** Nach +x krümmen (Dornen, Tentakel, Blutzungen) */
  function biegen(geo: THREE.BufferGeometry, k: number, welle = 0) {
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) + k * y * y + welle * Math.sin(y * Math.PI * 2)); }
    geo.computeVertexNormals();
    return geo;
  }
  const GEO: Record<string, THREE.BufferGeometry[]> = {
    eis: Array.from({ length: 8 }, () => new THREE.LatheGeometry([V2(0, 0), V2(0.5, 0), V2(zufall(0.36, 0.46), zufall(0.35, 0.55)), V2(zufall(0.15, 0.25), zufall(0.75, 0.88)), V2(0, 1)], 4 + Math.floor(Math.random() * 3), Math.random() * Math.PI)),
    fels: Array.from({ length: 6 }, () => zacken(new THREE.LatheGeometry([V2(0, 0), V2(0.5, 0), V2(zufall(0.4, 0.5), zufall(0.25, 0.45)), V2(zufall(0.2, 0.32), zufall(0.7, 0.85)), V2(0, 1)], 4 + Math.floor(Math.random() * 2), Math.random() * Math.PI), 0.07)),
    dorn: Array.from({ length: 6 }, () => biegen(new THREE.LatheGeometry([V2(0, 0), V2(0.5, 0), V2(0.32, 0.25), V2(0.14, 0.65), V2(0, 1)], 6), zufall(0.25, 0.5))),
    // glatte, leicht gewellte Zungen (Ecken verschmolzen, damit die Naht nicht sichtbar ist)
    blut: Array.from({ length: 6 }, () => {
      let g: THREE.BufferGeometry = new THREE.LatheGeometry(Array.from({ length: 16 }, (_, i) => { const y = i / 15; return V2(i === 15 ? 0 : 0.5 * (1 - y ** 1.8) ** 0.55 * (1 + 0.1 * Math.sin(y * Math.PI * 3 + Math.random())), y); }), 14);
      g.deleteAttribute("normal"); g.deleteAttribute("uv");
      g = mergeVertices(g);
      return biegen(g, zufall(0.15, 0.45), zufall(0.03, 0.07));
    }),
    tentakel: Array.from({ length: 5 }, () => biegen(new THREE.LatheGeometry(Array.from({ length: 12 }, (_, i) => { const y = i / 11; return V2(i === 11 ? 0 : 0.5 * (1 - y) ** 0.8 + 0.02, y); }), 8), zufall(0.35, 0.7), zufall(0.06, 0.12))),
  };
  for (const liste of Object.values(GEO)) wegwerfen.push(...liste);

  // ---------- Partikel: leuchtend (additiv) und Rauch (deckend, kann dunkel) ----------
  type Wurf = { dauer?: number; g0?: number; g1?: number; alpha?: number; zug?: number; schwer?: number; farbe?: Farbe; farbe2?: Farbe };
  class Partikel {
    i = 0;
    pos: Float32Array; vel: Float32Array; f0: Float32Array; f1: Float32Array; farbe: Float32Array;
    leben: Float32Array; dauer: Float32Array; g0: Float32Array; g1: Float32Array; a0: Float32Array; zug: Float32Array; schwer: Float32Array; groesse: Float32Array; alpha: Float32Array;
    geo = new THREE.BufferGeometry();
    mat: THREE.ShaderMaterial;
    constructor(private max: number, blending: THREE.Blending, reihenfolge: number) {
      const f = (n: number) => new Float32Array(n);
      this.pos = f(max * 3); this.vel = f(max * 3); this.f0 = f(max * 3); this.f1 = f(max * 3); this.farbe = f(max * 3);
      this.leben = f(max).fill(1); this.dauer = f(max); this.g0 = f(max); this.g1 = f(max); this.a0 = f(max); this.zug = f(max); this.schwer = f(max); this.groesse = f(max); this.alpha = f(max);
      const attr = (name: string, arr: Float32Array, n: number) => this.geo.setAttribute(name, new THREE.BufferAttribute(arr, n).setUsage(THREE.DynamicDrawUsage));
      attr("position", this.pos, 3); attr("aGroesse", this.groesse, 1); attr("aAlpha", this.alpha, 1); attr("aFarbe", this.farbe, 3);
      this.mat = new THREE.ShaderMaterial({
        uniforms: { uTex: { value: WEICH }, uSkala: { value: 300 } },
        vertexShader: `attribute float aGroesse; attribute float aAlpha; attribute vec3 aFarbe; uniform float uSkala; varying float vA; varying vec3 vF;
          void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
            gl_PointSize = aGroesse * uSkala / -mv.z; vA = aAlpha; vF = aFarbe; }`,
        fragmentShader: `uniform sampler2D uTex; varying float vA; varying vec3 vF;
          void main() { float a = texture2D(uTex, gl_PointCoord).a * vA; if (a < 0.003) discard; gl_FragColor = vec4(vF, a); }`,
        transparent: true, depthWrite: false, blending,
      });
      const punkte = new THREE.Points(this.geo, this.mat);
      punkte.frustumCulled = false;
      punkte.renderOrder = reihenfolge;
      scene.add(punkte);
      wegwerfen.push(this.geo, this.mat);
    }
    wurf(p: V3, vel: V3, { dauer = 1, g0 = 0.5, g1 = 1, alpha = 1, zug = 0, schwer = 0, farbe = [1, 1, 1], farbe2 }: Wurf = {}) {
      const i = this.i, k = i * 3;
      this.i = (i + 1) % this.max;
      this.pos[k] = p.x; this.pos[k + 1] = p.y; this.pos[k + 2] = p.z;
      this.vel[k] = vel.x; this.vel[k + 1] = vel.y; this.vel[k + 2] = vel.z;
      this.f0.set(C(farbe), k); this.f1.set(C(farbe2 ?? farbe), k);
      this.leben[i] = 0; this.dauer[i] = dauer; this.g0[i] = g0; this.g1[i] = g1; this.a0[i] = alpha; this.zug[i] = zug; this.schwer[i] = schwer;
    }
    update(dt: number) {
      for (let i = 0; i < this.max; i++) {
        if (this.leben[i] >= this.dauer[i]) { this.alpha[i] = 0; continue; }
        this.leben[i] += dt;
        const t = Math.min(1, this.leben[i] / this.dauer[i]), bremse = Math.exp(-this.zug[i] * dt), k = i * 3;
        this.vel[k] *= bremse; this.vel[k + 1] = this.vel[k + 1] * bremse - this.schwer[i] * dt; this.vel[k + 2] *= bremse;
        for (let j = 0; j < 3; j++) {
          this.pos[k + j] += this.vel[k + j] * dt;
          this.farbe[k + j] = this.f0[k + j] + (this.f1[k + j] - this.f0[k + j]) * t;
        }
        this.groesse[i] = this.g0[i] + (this.g1[i] - this.g0[i]) * t;
        this.alpha[i] = this.a0[i] * Math.min(1, t * 6) * (1 - t) ** 1.5;
      }
      for (const n of ["position", "aGroesse", "aAlpha", "aFarbe"]) this.geo.attributes[n].needsUpdate = true;
    }
  }
  const rauch = new Partikel(1500, THREE.NormalBlending, 2);
  const leucht = new Partikel(3500, THREE.AdditiveBlending, 3);

  // ---------- Brocken: instanzierte Stücke mit Schwerkraft (Splitter, Kiesel, Tropfen, Blasen) ----------
  class Brocken {
    i = 0;
    mesh: THREE.InstancedMesh;
    p: Float32Array; v: Float32Array; winkel: Float32Array; dreh: Float32Array; g: Float32Array; l: Float32Array; d: Float32Array; schwer: Float32Array;
    achse: V3[]; blase: Uint8Array; farben: Rgb[];
    constructor(geo: THREE.BufferGeometry, mat: THREE.Material, private max: number) {
      this.mesh = new THREE.InstancedMesh(geo, mat, max);
      this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.mesh.frustumCulled = false;
      const f = (n: number) => new Float32Array(n);
      this.p = f(max * 3); this.v = f(max * 3); this.winkel = f(max); this.dreh = f(max); this.g = f(max); this.l = f(max).fill(1); this.d = f(max); this.schwer = f(max);
      this.achse = Array.from({ length: max }, () => P()); this.blase = new Uint8Array(max); this.farben = Array.from({ length: max }, () => [1, 1, 1] as Rgb);
      _m.makeScale(0, 0, 0);
      for (let i = 0; i < max; i++) { this.mesh.setMatrixAt(i, _m); this.mesh.setColorAt(i, _farbe.setRGB(1, 1, 1)); }
      scene.add(this.mesh);
      wegwerfen.push(geo, this.mesh);
    }
    wurf(p: V3, vel: V3, groesse: number, dauer: number, farbe: number = 0xffffff, { schwer = 15, blase = false } = {}) {
      const i = this.i, k = i * 3;
      this.i = (i + 1) % this.max;
      this.p[k] = p.x; this.p[k + 1] = p.y; this.p[k + 2] = p.z;
      this.v[k] = vel.x; this.v[k + 1] = vel.y; this.v[k + 2] = vel.z;
      this.achse[i].randomDirection(); this.winkel[i] = Math.random() * 6.28; this.dreh[i] = blase ? 0 : zufall(6, 18);
      this.g[i] = groesse; this.l[i] = 0; this.d[i] = dauer; this.schwer[i] = schwer; this.blase[i] = blase ? 1 : 0;
      this.mesh.setColorAt(i, _farbe.set(farbe));
      this.farben[i] = [_farbe.r, _farbe.g, _farbe.b];
      this.mesh.instanceColor!.needsUpdate = true;
    }
    update(dt: number) {
      for (let i = 0; i < this.max; i++) {
        const k = i * 3;
        if (this.l[i] >= this.d[i]) { _m.makeScale(0, 0, 0); this.mesh.setMatrixAt(i, _m); continue; }
        this.l[i] += dt;
        this.v[k + 1] -= this.schwer[i] * dt;
        this.p[k] += this.v[k] * dt; this.p[k + 1] += this.v[k + 1] * dt; this.p[k + 2] += this.v[k + 2] * dt;
        if (this.schwer[i] > 0 && this.p[k + 1] < 0.04) { this.p[k + 1] = 0.04; this.v[k + 1] *= -0.3; this.v[k] *= 0.55; this.v[k + 2] *= 0.55; this.dreh[i] *= 0.5; }
        this.winkel[i] += this.dreh[i] * dt;
        const t = Math.min(1, this.l[i] / this.d[i]);
        if (this.blase[i] && t >= 1) { // Blase platzt
          _p.set(this.p[k], this.p[k + 1], this.p[k + 2]);
          for (let j = 0; j < 3; j++) leucht.wurf(_p, v.randomDirection().multiplyScalar(0.8), { farbe: this.farben[i].map((c) => c * 1.5) as Rgb, dauer: 0.3, g0: 0.08, g1: 0.02 });
        }
        const g = this.blase[i] ? this.g[i] * (0.3 + 0.7 * Math.min(1, t * 3)) : this.g[i] * (t > 0.7 ? (1 - t) / 0.3 : 1);
        _q.setFromAxisAngle(this.achse[i], this.winkel[i]);
        _m.compose(_p.set(this.p[k], this.p[k + 1], this.p[k + 2]), _q, _s.set(g, g, g));
        this.mesh.setMatrixAt(i, _m);
      }
      this.mesh.instanceMatrix.needsUpdate = true;
    }
  }
  const brockenMat = randAusFarbe(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.1, flatShading: true, envMap: umgebung, envMapIntensity: 0.8 }), 1.0);
  const splitter = new Brocken(new THREE.OctahedronGeometry(0.08).scale(0.6, 1.7, 0.6), brockenMat, 900);
  const kiesel = new Brocken(new THREE.DodecahedronGeometry(0.09), randAusFarbe(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true }), 0.15), 500);
  const tropfen = new Brocken(new THREE.SphereGeometry(0.06, 8, 6).scale(0.8, 1.3, 0.8),
    randAusFarbe(new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.1, clearcoat: 1, envMap: umgebung }), 0.6), 700);
  const blasen = new Brocken(new THREE.SphereGeometry(0.1, 12, 8),
    randAusFarbe(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.05, transparent: true, opacity: 0.6, envMap: umgebung }), 1.6), 400);
  const ALLE_BROCKEN = [splitter, kiesel, tropfen, blasen];

  // ---------- Zeitsteuerung ----------
  type Effekt = { update(dt: number): boolean };
  const effekte: Effekt[] = [];
  /** Zeitlich begrenzte Animation: schritt(t, anteil 0..1, dt), danach ende() */
  class Ablauf implements Effekt {
    private t: number;
    constructor(private dauer: number, private schritt: (t: number, k: number, dt: number) => void, private ende?: (() => void) | null, verz = 0) { this.t = -verz; }
    update(dt: number) {
      this.t += dt;
      if (this.t < 0) return true;
      const t = Math.min(this.t, this.dauer);
      this.schritt(t, t / this.dauer, dt);
      if (this.t >= this.dauer) { this.ende?.(); return false; }
      return true;
    }
  }
  const ablauf = (dauer: number, schritt: (t: number, k: number, dt: number) => void, ende?: (() => void) | null, verz = 0) => { effekte.push(new Ablauf(dauer, schritt, ende, verz)); };
  /** Ruft fn(t, anteil) `rate`-mal pro Sekunde auf, `dauer` Sekunden lang */
  function strom(dauer: number, rate: number, fn: (t: number, k: number) => void, verz = 0) {
    let rest = 0;
    ablauf(dauer, (t, k, dt) => { rest += dt * rate; while (rest >= 1) { rest--; fn(t, k); } }, null, verz);
  }
  const entfernen = (o: THREE.Object3D, ...weg: { dispose(): void }[]) => { scene.remove(o); for (const w of weg) w.dispose(); };

  // ---------- Spitzen ----------
  type SpitzeOpt = { geo?: string; mat?: string; verz?: number; wachs?: number; bruch?: number; biegRichtung?: V3; brocken?: number; teile?: Brocken; sinken?: boolean; wabbeln?: boolean; beimBruch?: (sp: Spitze) => void };
  class Spitze implements Effekt {
    mesh: THREE.Mesh; fuss: V3; k = zufall(0.7, 1.3); alter: number; zerbrochen = false;
    wachs: number; bruch: number; brocken: number; teile: Brocken; sinken: boolean; wabbeln: boolean; beimBruch?: (sp: Spitze) => void;
    /** fuss: Bodenpunkt, richtung: Wuchsachse, bruch: Sekunden ab Erscheinen bis zum Zerspringen (oder Versinken) */
    constructor(fuss: V3, public richtung: V3, public h: number, public w: number, o: SpitzeOpt = {}) {
      const geo = o.geo ?? "eis";
      this.mesh = new THREE.Mesh(wahl(GEO[geo]), MAT[o.mat ?? geo]);
      this.mesh.position.copy(fuss).addScaledVector(richtung, -0.08 * h);
      if (o.biegRichtung) { // gekrümmte Formen biegen sich zu biegRichtung hin
        const x = o.biegRichtung.clone().addScaledVector(richtung, -o.biegRichtung.dot(richtung));
        if (x.lengthSq() < 1e-4) x.set(1, 0, 0);
        x.normalize();
        this.mesh.quaternion.setFromRotationMatrix(_m.makeBasis(x, richtung, P().crossVectors(x, richtung)));
      } else {
        this.mesh.quaternion.setFromUnitVectors(OBEN, richtung).multiply(new THREE.Quaternion().setFromAxisAngle(OBEN, Math.random() * 6.28));
      }
      this.mesh.scale.setScalar(0);
      this.mesh.visible = false;
      scene.add(this.mesh);
      this.fuss = fuss.clone(); this.alter = -(o.verz ?? 0); this.wachs = o.wachs ?? 0.12; this.bruch = o.bruch ?? 1.5;
      this.brocken = o.brocken ?? 0xa8dcff; this.teile = o.teile ?? splitter; this.sinken = !!o.sinken; this.wabbeln = !!o.wabbeln; this.beimBruch = o.beimBruch;
    }
    update(dt: number) {
      this.alter += dt;
      const a = this.alter;
      if (a < 0) return true;
      this.mesh.visible = true;
      if (a < this.bruch) {
        const s = easeOutBack(Math.min(1, a / this.wachs));
        const wab = this.wabbeln ? 1 + Math.sin(a * 14) * 0.08 * Math.exp(-a * 2.5) : 1; // flüssig: schwingt nach
        this.mesh.scale.set(this.w * s / wab, this.h * s * wab, this.w * s * this.k / wab);
        return true;
      }
      if (!this.zerbrochen) { this.zerbrochen = true; this.beimBruch?.(this); if (!this.sinken) this.zerspringen(); }
      const z = (a - this.bruch) / (this.sinken ? 0.4 : 0.14);
      if (z >= 1) { scene.remove(this.mesh); return false; }
      if (this.sinken) {
        this.mesh.position.copy(this.fuss).addScaledVector(this.richtung, -this.h * (0.08 + z));
        this.mesh.scale.set(this.w * (1 - z * 0.5), this.h, this.w * (1 - z * 0.5) * this.k);
      } else this.mesh.scale.set(this.w * (1 - z), this.h * (1 - z * 0.6), this.w * (1 - z) * this.k);
      return true;
    }
    zerspringen() {
      const n = Math.round(2 + this.h * 4), p = P();
      for (let i = 0; i < n; i++) {
        p.copy(this.fuss).addScaledVector(this.richtung, this.h * Math.random() * 0.85);
        v.randomDirection().multiplyScalar(zufall(1, 3.5)); v.y = Math.abs(v.y) + zufall(1, 3);
        this.teile.wurf(p, v, zufall(0.5, 1.3) * (0.6 + this.h * 0.25), zufall(0.7, 1.3), this.brocken);
      }
      leucht.wurf(p, v.set(0, 1, 0), { farbe: C(this.brocken).map((c) => c * 1.5) as Rgb, dauer: 0.5, g0: 0.25, g1: 0.02 });
    }
  }

  // ---------- Der Angriff: ein Zeitplan aus Ereignissen, den das Element füllt ----------
  type Plan = { licht: number; tempo?: number; frontLicht?: boolean; plan: (a: Angriff) => void };
  class Angriff implements Effekt {
    t = 0; ende = 3;
    plan: { t: number; fn: () => void }[] = [];
    start: V3; ziel: V3; dir: V3; seite: V3; L: number; reise: number; stopp: number; finale: number;
    /** Körpermitte des Opfers (Höhe über dem Boden) */
    mitteY: number;
    constructor(private el: Plan, public taeter: Figur, public opfer: Figur) {
      this.start = taeter.basis.clone().setY(0); this.ziel = opfer.basis.clone().setY(0);
      this.dir = this.ziel.clone().sub(this.start);
      this.L = this.dir.length();
      this.dir.normalize();
      this.seite = P(-this.dir.z, 0, this.dir.x);
      this.reise = (0.3 + this.L * 0.065) * (el.tempo ?? 1);
      this.stopp = Math.max(0.5, this.L - 0.9);
      this.finale = this.reise + 0.16;
      this.mitteY = opfer.hoehe * 0.5;
      this.bei(0, () => { // Abwurf beim Täter
        taeter.puls = 1;
        for (let i = 0; i < 10; i++) leucht.wurf(this.start.clone().setY(0.6), P().randomDirection().setY(0.3).multiplyScalar(1.4), { farbe: el.licht, dauer: 0.9, g0: 0.3, g1: 1.2, alpha: 0.25, zug: 2 });
      });
      el.plan(this);
      this.plan.sort((x, y) => x.t - y.t);
    }
    bei(t: number, fn: () => void) { this.plan.push({ t, fn }); }
    punkt(s: number, quer = 0, y = 0) { return this.start.clone().addScaledVector(this.dir, s).addScaledVector(this.seite, quer).setY(y); }
    /** Körpermitte des Opfers */
    mitte(y = this.mitteY) { return this.ziel.clone().setY(y); }
    /** fn(s, f, t, p) in Schritten entlang der Spur, zeitlich passend zur Reise */
    spur(schritt: number, fn: (s: number, f: number, t: number, p: V3) => void, bis = this.stopp) {
      for (let s = schritt * 0.5; s < bis; s += schritt) {
        const f = s / bis, t = f * this.reise;
        this.bei(t, () => fn(s, f, t, this.punkt(s, 0, 0.25)));
      }
    }
    treffer(o: Getroffen) { this.opfer.treffer(o); }
    loesen = () => this.opfer.loesen();
    update(dt: number) {
      this.t += dt;
      while (this.plan.length && this.plan[0].t <= this.t) this.plan.shift()!.fn();
      if (this.el.frontLicht !== false && this.t < this.reise) {
        frontLicht.color.set(this.el.licht);
        frontLicht.position.copy(this.punkt((this.t / this.reise) * this.stopp, 0, 0.6));
        frontLicht.intensity = 18;
      }
      return this.t < this.ende || this.plan.length > 0;
    }
  }

  /** Fächer aus Spitzen entlang der Spur (s: Weg, f: Anteil 0..1, t: Zeitpunkt) */
  type Faecher = { breite0: number; breite1: number; dichte: number; lehne: [number, number]; h0: number; h1: number; hz: number; dicke: [number, number]; spitze: SpitzeOpt };
  function faecher(a: Angriff, s: number, f: number, t: number, o: Faecher) {
    const breite = o.breite0 + f * o.breite1, anzahl = 1 + Math.floor(f * o.dichte + Math.random() * 1.8);
    for (let k = 0; k < anzahl; k++) {
      const quer = (Math.random() * 2 - 1) * breite;
      const fuss = a.punkt(s + zufall(-0.08, 0.08), quer);
      const lehne = zufall(...o.lehne) + Math.abs(quer) * 0.25;
      const waag = a.dir.clone().multiplyScalar(0.85).addScaledVector(a.seite, Math.sign(quer) * 0.5 * Math.min(1, Math.abs(quer) / breite + 0.2)).normalize();
      const h = (o.h0 + f * o.h1 + Math.random() * o.hz) * (1 - Math.abs(quer) / (breite + 0.5) * 0.5);
      effekte.push(new Spitze(fuss, kipp(lehne, waag), h, h * zufall(...o.dicke), { ...o.spitze, biegRichtung: waag, bruch: a.reise + 1.15 + f * 0.35 - t }));
    }
  }
  /** Kranz aus Spitzen um das Opfer; innen: true kippt sie zum Opfer hin */
  type Kranz = { r0: number; r1: number; innen?: boolean; vor?: number; lehne: (r: number) => number; h: (r: number) => number; dicke: [number, number]; bruch: number; verz?: number; verzFaktor?: number; spitze: SpitzeOpt };
  function kranz(a: Angriff, n: number, o: Kranz) {
    for (let i = 0; i < n; i++) {
      const w = Math.random() * Math.PI * 2, r = o.r0 + Math.random() ** 0.7 * (o.r1 - o.r0);
      const raus = kreis(w), waag = o.innen ? raus.clone().negate() : raus;
      const fuss = a.ziel.clone().addScaledVector(raus, r).addScaledVector(a.dir, o.vor ?? 0);
      const h = o.h(r);
      effekte.push(new Spitze(fuss, kipp(o.lehne(r), waag), h, h * zufall(...o.dicke),
        { ...o.spitze, biegRichtung: waag, verz: (o.verz ?? 0) + r * (o.verzFaktor ?? 0.05) + zufall(0, 0.03), bruch: o.bruch + r * 0.08 + zufall(0, 0.1) }));
    }
  }

  // ---------- Risse, Scheiben, Wellen, Säulen ----------
  const risseMat = new THREE.ShaderMaterial({
    uniforms: { uFort: { value: 0 }, uAlpha: { value: 1 }, uFarbe: { value: new THREE.Color() }, uGlanz: { value: 1 } },
    vertexShader: `attribute float aDist; attribute float aQuer; varying float vD; varying float vQ;
      void main() { vD = aDist; vQ = aQuer; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uFort; uniform float uAlpha; uniform vec3 uFarbe; uniform float uGlanz; varying float vD; varying float vQ;
      void main() { if (vD > uFort) discard;
        float kern = 1.0 - abs(vQ); float front = smoothstep(0.7, 0.0, uFort - vD);
        gl_FragColor = vec4(uFarbe * (0.5 + kern * 0.8 + front * 2.5) * uGlanz, uAlpha * (0.35 + 0.65 * kern)); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  wegwerfen.push(risseMat);
  function risseGeometrie(laenge: number, breite: number, anzahl: number) {
    const pos: number[] = [], dist: number[] = [], quer: number[] = [], idx: number[] = [];
    const segment = (ax: number, az: number, bx: number, bz: number, da: number, db: number, wa: number, wb: number) => {
      const dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz) || 1, nx = -dz / l, nz = dx / l, b = pos.length / 3;
      pos.push(ax + nx * wa, 0, az + nz * wa, ax - nx * wa, 0, az - nz * wa, bx + nx * wb, 0, bz + nz * wb, bx - nx * wb, 0, bz - nz * wb);
      dist.push(da, da, db, db); quer.push(1, -1, 1, -1);
      idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
    };
    const ast = (x: number, z: number, w0: number, lang: number, d: number, dick: number, tiefe: number) => {
      let w = w0, rest = lang;
      while (rest > 0) {
        const s = zufall(0.15, 0.38);
        w += (Math.random() - 0.5) * 1.0 + (w0 - w) * 0.35; // zackig, aber grob radial
        const nx = x + Math.cos(w) * s, nz = z + Math.sin(w) * s;
        segment(x, z, nx, nz, d, d + s, dick * rest / lang + 0.008, dick * Math.max(0, rest - s) / lang + 0.008);
        x = nx; z = nz; d += s; rest -= s;
        if (tiefe < 2 && rest > 0.5 && Math.random() < 0.22)
          ast(x, z, w + (Math.random() < 0.5 ? -1 : 1) * zufall(0.5, 1.1), rest * zufall(0.4, 0.7), d, dick * rest / lang * 0.7, tiefe + 1);
      }
    };
    for (let i = 0; i < anzahl; i++) {
      const w = (i / anzahl) * Math.PI * 2 + zufall(-0.25, 0.25);
      ast(Math.cos(w) * 0.45, Math.sin(w) * 0.45, w, zufall(2.2, 4.6) * laenge, 0, 0.075 * breite, 0);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("aDist", new THREE.Float32BufferAttribute(dist, 1));
    geo.setAttribute("aQuer", new THREE.Float32BufferAttribute(quer, 1));
    geo.setIndex(idx);
    return geo;
  }
  /** Leuchtende Risse (oder Wurzeln), die vom Opfer aus über den Boden laufen */
  function risse(mitte: V3, { farbe, halten = 1.9, laenge = 1, breite = 1, glanz = 1, anzahl = 11 }: { farbe: number; halten?: number; laenge?: number; breite?: number; glanz?: number; anzahl?: number }) {
    const mat = risseMat.clone();
    mat.uniforms.uFarbe.value.set(farbe);
    mat.uniforms.uGlanz.value = glanz;
    const mesh = new THREE.Mesh(risseGeometrie(laenge, breite, anzahl), mat);
    mesh.position.set(mitte.x, 0.012, mitte.z);
    mesh.rotation.y = Math.random() * 6.28;
    scene.add(mesh);
    ablauf(halten + 0.9, (t) => {
      mat.uniforms.uFort.value = 5.2 * laenge * easeOutCubic(Math.min(1, t / 0.45));
      mat.uniforms.uAlpha.value = t < halten ? 1 : 1 - (t - halten) / 0.9;
    }, () => entfernen(mesh, mesh.geometry, mat));
  }

  const scheibenGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  wegwerfen.push(scheibenGeo);
  /** Weiche Bodenscheibe: additiv leuchtend oder (additiv: false) als dunkler Fleck/Lache */
  function scheibe(mitte: V3, { farbe, groesse = 3, halten = 1.5, additiv = true, alpha = 0.9, wachs = 0.35, verz = 0 }: { farbe: number; groesse?: number; halten?: number; additiv?: boolean; alpha?: number; wachs?: number; verz?: number }) {
    const mat = new THREE.MeshBasicMaterial({ map: WEICH, color: farbe, transparent: true, depthWrite: false, opacity: 0,
      blending: additiv ? THREE.AdditiveBlending : THREE.NormalBlending });
    const mesh = new THREE.Mesh(scheibenGeo, mat);
    mesh.position.set(mitte.x, 0.006 + Math.random() * 0.004, mitte.z);
    mesh.renderOrder = 1;
    scene.add(mesh);
    ablauf(halten + 0.8, (t) => {
      mesh.scale.setScalar(groesse * (0.2 + 0.8 * easeOutCubic(Math.min(1, t / wachs))));
      mat.opacity = alpha * (t < halten ? 1 : 1 - (t - halten) / 0.8);
    }, () => entfernen(mesh, mat), verz);
  }

  const ringGeo = new THREE.RingGeometry(0.93, 1, 72).rotateX(-Math.PI / 2);
  wegwerfen.push(ringGeo);
  /** Druckwelle als flacher Ring */
  function welle(mitte: V3, { farbe, r = 5, dauer = 0.6, y = 0.05 }: { farbe: Farbe; r?: number; dauer?: number; y?: number }) {
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(...C(farbe)), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(ringGeo, mat);
    mesh.position.set(mitte.x, y, mitte.z);
    scene.add(mesh);
    ablauf(dauer, (t, k) => { mesh.scale.setScalar(0.3 + r * easeOutCubic(k)); mat.opacity = 0.5 * (1 - k) ** 1.5; }, () => entfernen(mesh, mat));
  }

  const saeuleGeo = new THREE.CylinderGeometry(1, 1, 1, 40, 1, true).translate(0, 0.5, 0);
  wegwerfen.push(saeuleGeo);
  /** Lichtsäule (Geysir, Feenlicht, Blitzschlag) */
  function saeule(mitte: V3, { farbe, r = 1.3, h = 7, dauer = 1.1 }: { farbe: Farbe; r?: number; h?: number; dauer?: number }) {
    const mat = new THREE.ShaderMaterial({
      uniforms: { uFarbe: { value: new THREE.Color(...C(farbe)) }, uA: { value: 1 } },
      vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform vec3 uFarbe; uniform float uA; varying vec2 vUv;
        void main() { float a = pow(1.0 - vUv.y, 1.6) * uA * (0.6 + 0.4 * sin(vUv.x * 60.0 + vUv.y * 8.0)); gl_FragColor = vec4(uFarbe, a); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(saeuleGeo, mat);
    mesh.position.set(mitte.x, 0, mitte.z);
    scene.add(mesh);
    ablauf(dauer, (t, k) => {
      const auf = easeOutCubic(Math.min(1, k * 4)), rr = r * (1 - k * 0.5) * (0.3 + 0.7 * auf);
      mesh.scale.set(rr, h * auf, rr);
      mat.uniforms.uA.value = 0.45 * (k < 0.6 ? 1 : (1 - k) / 0.4);
    }, () => entfernen(mesh, mat));
  }

  // ---------- Blitze ----------
  function zickzack(a: V3, b: V3, zacken: number) {
    const n = Math.max(4, Math.round(a.distanceTo(b) * 2.5)), pts = [a.clone()];
    for (let i = 1; i < n; i++)
      pts.push(a.clone().lerp(b, i / n).add(P().randomDirection().multiplyScalar(zacken * Math.sin(Math.PI * i / n) * zufall(0.4, 1))));
    pts.push(b.clone());
    return pts;
  }
  function rohr(pts: V3[], dicke: number) {
    const pfad = new THREE.CurvePath<V3>();
    for (let i = 0; i < pts.length - 1; i++) pfad.add(new THREE.LineCurve3(pts[i], pts[i + 1]));
    return new THREE.TubeGeometry(pfad, pts.length * 3, dicke, 4, false);
  }
  /** Flackernder Blitz von a nach b mit Seitenästen; wird alle 50 ms neu gezackt */
  class Blitz implements Effekt {
    mat: THREE.MeshBasicMaterial; mesh: THREE.Mesh; a: V3; b: V3; t: number; naechstes = 0;
    dicke: number; dauer: number; zacken: number; aeste: number;
    constructor(a: V3, b: V3, { farbe = [2.0, 2.3, 4.5] as Rgb, dicke = 0.04, dauer = 0.3, zacken = 0.5, aeste = 2, verz = 0 } = {}) {
      this.mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(...farbe), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
      this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), this.mat);
      this.mesh.visible = false;
      scene.add(this.mesh);
      this.a = a.clone(); this.b = b.clone(); this.t = -verz;
      this.dicke = dicke; this.dauer = dauer; this.zacken = zacken; this.aeste = aeste;
    }
    neu() {
      const pts = zickzack(this.a, this.b, this.zacken), teile = [rohr(pts, this.dicke)], laenge = this.a.distanceTo(this.b);
      for (let k = 0; k < this.aeste; k++) {
        const start = pts[1 + Math.floor(Math.random() * (pts.length - 2))];
        teile.push(rohr(zickzack(start, start.clone().add(P().randomDirection().multiplyScalar(laenge * zufall(0.15, 0.3))), this.zacken * 0.5), this.dicke * 0.5));
      }
      this.mesh.geometry.dispose();
      this.mesh.geometry = mergeGeometries(teile);
      teile.forEach((g) => g.dispose());
    }
    update(dt: number) {
      this.t += dt;
      if (this.t < 0) return true;
      if (this.t >= this.dauer) { entfernen(this.mesh, this.mesh.geometry, this.mat); return false; }
      this.mesh.visible = true;
      if ((this.naechstes -= dt) <= 0) { this.naechstes = 0.05; this.neu(); }
      this.mat.opacity = zufall(0.55, 1) * (1 - this.t / this.dauer) ** 0.5;
      return true;
    }
  }

  // ---------- Ranken, Pilze, Blüten, Kugeln, Schattenband ----------
  /** Ranke, die entlang einer Kurve wächst (spitz zulaufend) und sich danach wieder zurückzieht */
  class Ranke implements Effekt {
    mesh: THREE.Mesh; t: number; proRing: number;
    constructor(punkte: V3[], private o: { radius?: number; wachs?: number; halten?: number; verz?: number; mat?: THREE.Material } = {}, private SEG = 80) {
      const RAD = 7, kurve = new THREE.CatmullRomCurve3(punkte);
      const geo = new THREE.TubeGeometry(kurve, SEG, o.radius ?? 0.08, RAD, false), pos = geo.attributes.position, mitte = P();
      for (let i = 0; i <= SEG; i++) {
        kurve.getPointAt(i / SEG, mitte);
        const k = 1 - (i / SEG) * 0.85;
        for (let j = 0; j <= RAD; j++) { const n = i * (RAD + 1) + j; _p.fromBufferAttribute(pos, n).sub(mitte).multiplyScalar(k).add(mitte); pos.setXYZ(n, _p.x, _p.y, _p.z); }
      }
      geo.computeVertexNormals();
      geo.setDrawRange(0, 0);
      this.mesh = new THREE.Mesh(geo, o.mat ?? MAT.dorn);
      scene.add(this.mesh);
      this.t = -(o.verz ?? 0); this.proRing = RAD * 6;
    }
    update(dt: number) {
      this.t += dt;
      const t = this.t, wachs = this.o.wachs ?? 0.45, halten = this.o.halten ?? 1.6;
      if (t < 0) return true;
      const k = t < halten ? easeOutCubic(Math.min(1, t / wachs)) : 1 - (t - halten) / 0.3;
      if (k <= 0) { entfernen(this.mesh, this.mesh.geometry); return false; }
      this.mesh.geometry.setDrawRange(0, Math.floor(k * this.SEG) * this.proRing);
      return true;
    }
  }

  const stielGeo = new THREE.CylinderGeometry(0.06, 0.09, 0.32, 10).translate(0, 0.16, 0);
  const hutGeo = new THREE.SphereGeometry(0.2, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.7, 1);
  const stielMat = new THREE.MeshStandardMaterial({ color: 0xf3ead8, emissive: 0x403828, roughness: 0.6 });
  wegwerfen.push(stielGeo, hutGeo, stielMat);
  /** Leuchtender Pilz (Feenring) */
  function pilz(fuss: V3, { farbe, groesse = 1, verz = 0, halten = 2 }: { farbe: number; groesse?: number; verz?: number; halten?: number }) {
    const g = new THREE.Group(), hutMat = new THREE.MeshStandardMaterial({ color: farbe, emissive: farbe, emissiveIntensity: 1.6, roughness: 0.4 }), hut = new THREE.Mesh(hutGeo, hutMat);
    g.add(new THREE.Mesh(stielGeo, stielMat));
    hut.position.y = 0.3;
    g.add(hut);
    g.position.copy(fuss).setY(0);
    g.rotation.set(zufall(-0.2, 0.2), Math.random() * 6.28, zufall(-0.2, 0.2));
    g.scale.setScalar(0);
    scene.add(g);
    ablauf(halten, (t) => {
      const auf = easeOutBack(Math.min(1, t / 0.25)), ab = t > halten - 0.25 ? (halten - t) / 0.25 : 1;
      g.scale.setScalar(groesse * auf * ab);
    }, () => entfernen(g, hutMat), verz);
  }

  const blattGeo = new THREE.SphereGeometry(0.3, 12, 8).scale(0.4, 0.06, 1).translate(0, 0, 0.28);
  const bluetenMitteGeo = new THREE.SphereGeometry(0.12, 12, 8);
  wegwerfen.push(blattGeo, bluetenMitteGeo);
  /** Blüte, die sich über dem Opfer öffnet */
  function bluete(mitte: V3, { farbe = 0xff7ab8, verz = 0, halten = 1.6 }: { farbe?: number; verz?: number; halten?: number }) {
    const g = new THREE.Group(), blaetter: THREE.Mesh[] = [];
    const mat = new THREE.MeshStandardMaterial({ color: farbe, emissive: farbe, emissiveIntensity: 0.6, roughness: 0.5, side: THREE.DoubleSide });
    const mitteMat = new THREE.MeshStandardMaterial({ color: 0xffd23a, emissive: 0xffb000, emissiveIntensity: 1.5 });
    for (let i = 0; i < 7; i++) {
      const halter = new THREE.Group(), b = new THREE.Mesh(blattGeo, mat);
      halter.rotation.y = (i / 7) * Math.PI * 2;
      halter.add(b); g.add(halter); blaetter.push(b);
    }
    g.add(new THREE.Mesh(bluetenMitteGeo, mitteMat));
    g.position.copy(mitte);
    g.scale.setScalar(0);
    scene.add(g);
    ablauf(halten, (t) => {
      g.scale.setScalar(1.6 * easeOutBack(Math.min(1, t / 0.2)) * (t > halten - 0.25 ? (halten - t) / 0.25 : 1));
      for (const b of blaetter) b.rotation.x = -1.3 + 1.1 * easeOutBack(Math.min(1, t / 0.35));
      g.rotation.y = t * 0.8;
    }, () => entfernen(g, mat, mitteMat), verz);
  }

  /** Schwarze Kugel mit leuchtendem Rand (Dunkelheit) */
  const kugelMat = (rand: Rgb) => new THREE.ShaderMaterial({
    uniforms: { uRand: { value: new THREE.Color(...rand) } },
    vertexShader: `varying vec3 vN; varying vec3 vV;
      void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uRand; varying vec3 vN; varying vec3 vV;
      void main() { float f = 1.0 - abs(dot(normalize(vN), normalize(vV))); gl_FragColor = vec4(uRand * pow(f, 2.0) * 2.5, 1.0); }`,
  });

  /** Schattenband: der Schatten des Täters streckt sich über den Boden bis zum Opfer */
  function schattenband(a: Angriff, halten: number) {
    const geo = new THREE.PlaneGeometry(1, 1, 24, 1), pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i) + 0.5; pos.setXY(i, x, pos.getY(i) * (0.5 + 1.1 * x)); }
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uA: { value: 0.85 } },
      vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform float uA; varying vec2 vUv;
        void main() { float kante = smoothstep(0.5, 0.15, abs(vUv.y - 0.5)); float enden = smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.9, vUv.x);
          gl_FragColor = vec4(0.01, 0.0, 0.02, uA * kante * enden); }`,
      transparent: true, depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(a.start.x, 0.011, a.start.z);
    mesh.rotation.y = Math.atan2(-a.dir.z, a.dir.x);
    mesh.renderOrder = 1;
    scene.add(mesh);
    const ende = a.reise + halten;
    ablauf(ende + 0.6, (t) => {
      mesh.scale.x = Math.max(0.01, (a.L + 0.6) * easeOutCubic(Math.min(1, t / a.reise)));
      mat.uniforms.uA.value = t < ende ? 0.85 : 0.85 * (1 - (t - ende) / 0.6);
    }, () => entfernen(mesh, geo, mat));
  }

  // ---------- Flammen (Feuer) ----------
  const flammenGeo = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
  const flammenMat = new THREE.ShaderMaterial({
    uniforms: { uZeit: { value: 0 }, uSeed: { value: 0 }, uA: { value: 1 } },
    // Billboard: Fuß am Ursprung, immer zur Kamera gedreht
    vertexShader: `varying vec2 vUv;
      void main() { vUv = uv;
        vec4 mitte = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        mitte.xy += position.xy * vec2(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz));
        gl_Position = projectionMatrix * mitte; }`,
    fragmentShader: `uniform float uZeit; uniform float uSeed; uniform float uA; varying vec2 vUv;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
      float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
      void main() {
        float y = vUv.y, x = (vUv.x - 0.5) * 2.0;
        float n = fbm(vec2(vUv.x * 2.5 + uSeed, y * 2.0 - uZeit * 2.6));
        float n2 = fbm(vec2(vUv.x * 5.0 - uSeed, y * 4.0 - uZeit * 4.2));
        float xs = x + (n - 0.5) * (0.4 + 0.9 * y);                 // züngelt seitlich
        float breite = mix(0.9, 0.0, pow(y, 0.65)) * (0.75 + 0.5 * n2); // ausgefranste Ränder
        float flamme = smoothstep(breite, breite * 0.2, abs(xs)) * smoothstep(0.95, 0.35, y + (n2 - 0.5) * 0.6) * smoothstep(0.0, 0.12, y);
        float hitze = flamme * (1.2 - 0.8 * y) * (0.6 + 0.8 * n2);
        vec3 farbe = mix(vec3(0.3, 0.01, 0.0), vec3(1.1, 0.3, 0.02), smoothstep(0.15, 0.5, hitze));
        farbe = mix(farbe, vec3(1.8, 1.05, 0.35), smoothstep(0.65, 1.0, hitze));
        float a = smoothstep(0.08, 0.35, hitze) * uA;
        gl_FragColor = vec4(farbe * a, a * 0.85); }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  wegwerfen.push(flammenGeo, flammenMat);
  /** Eine flackernde Flammenzunge, die aufschießt, brennt und erlischt */
  function flammenzunge(fuss: V3, { h = 1.2, b, dauer = 1.2, verz = 0 }: { h?: number; b?: number; dauer?: number; verz?: number }) {
    const mat = flammenMat.clone(), seed = Math.random() * 50, breite = b ?? h * 0.55;
    mat.uniforms.uSeed.value = seed;
    const mesh = new THREE.Mesh(flammenGeo, mat);
    mesh.position.copy(fuss).setY(0);
    mesh.frustumCulled = false;
    mesh.renderOrder = 4;
    mesh.scale.setScalar(0.001);
    scene.add(mesh);
    ablauf(dauer, (t) => {
      const auf = easeOutCubic(Math.min(1, t / 0.18)), ab = t > dauer - 0.35 ? Math.max(0, (dauer - t) / 0.35) : 1;
      mesh.scale.set(breite * (0.6 + 0.4 * auf), Math.max(0.001, h * auf * (0.7 + 0.3 * ab) * (1 + Math.sin(t * 17 + seed) * 0.07)), 1);
      mat.uniforms.uZeit.value = t;
      mat.uniforms.uA.value = ab;
    }, () => entfernen(mesh, mat), verz);
  }

  // ---------- Kleine Helfer der Elemente ----------
  function schwaden(a: Angriff, p: V3, breite: number, farbe: Farbe, alpha: [number, number] = [0.1, 0.17]) {
    for (let k = 0; k < 2; k++) {
      const raus = (Math.random() < 0.5 ? -1 : 1) * zufall(0.2, 0.7);
      leucht.wurf(p.clone().addScaledVector(a.seite, raus * breite), P().copy(a.seite).multiplyScalar(raus).addScaledVector(a.dir, 0.4).setY(zufall(0.15, 0.4)),
        { farbe, dauer: zufall(1.6, 2.6), g0: 0.7, g1: zufall(1.8, 2.8), alpha: zufall(...alpha), zug: 1.2 });
    }
  }
  const glut = (p: V3, staerke = 1) => leucht.wurf(p, P().randomDirection().multiplyScalar(zufall(0.5, 2) * staerke).setY(zufall(1.5, 4) * staerke),
    { farbe: [2.5, 1.1, 0.2], farbe2: [1.2, 0.15, 0], dauer: zufall(0.8, 1.6), g0: 0.07, g1: 0.02, schwer: 2.5 });
  const qualm = (p: V3, { tempo = 1, g0 = 0.6, g1 = 2.2, alpha = 0.35 } = {}) =>
    rauch.wurf(p, P(zufall(-0.3, 0.3), zufall(0.6, 1.3), zufall(-0.3, 0.3)).multiplyScalar(tempo), { farbe: [0.05, 0.04, 0.04], dauer: zufall(1.8, 2.8), g0, g1, alpha, zug: 0.8 });
  const STEINE = [0x7a6650, 0x5e4f40, 0x9a8468, 0x6b6258];
  const staub = (p: V3, { vel, g0 = 0.5, g1 = 1.8, alpha = 0.5, zug = 1.2 }: { vel?: V3; g0?: number; g1?: number; alpha?: number; zug?: number } = {}) =>
    rauch.wurf(p, vel ?? P(zufall(-0.4, 0.4), zufall(0.3, 0.9), zufall(-0.4, 0.4)), { farbe: [0.22, 0.16, 0.11], dauer: zufall(1.4, 2.4), g0, g1, alpha, zug });
  const BLITZFARBE: Rgb = [2.0, 2.3, 4.5], VIOLETT: Rgb = [2.6, 1.6, 4.5];
  const funke = (p: V3, staerke = 1) => leucht.wurf(p, P().randomDirection().multiplyScalar(zufall(2, 6) * staerke), { farbe: BLITZFARBE, farbe2: [0.4, 0.5, 1.5], dauer: zufall(0.25, 0.6), g0: 0.12, g1: 0.02, zug: 3, schwer: 4 });
  const BLATT: Rgb[] = [[0.12, 0.45, 0.08], [0.2, 0.6, 0.1], [0.35, 0.55, 0.08]];
  const blatt = (p: V3, vel: V3, g = 0.16) => rauch.wurf(p, vel, { farbe: wahl(BLATT), dauer: zufall(1.4, 2.4), g0: g, g1: g * 0.8, alpha: 0.95, zug: 1.6, schwer: 0.6 });
  const bluetenblatt = (p: V3, vel: V3) => leucht.wurf(p, vel, { farbe: [1.6, 0.5, 1.0], farbe2: [0.8, 0.3, 0.6], dauer: zufall(1.2, 2), g0: 0.12, g1: 0.08, alpha: 0.8, zug: 1.6, schwer: 0.5 });
  const DUNKEL: Rgb = [0.015, 0.0, 0.03];
  const GIFT = 0x7ad82a, GIFTE = [0x7ad82a, 0x5adf1a, 0xb0ff5a];
  const giftDampf = (p: V3, { tempo = 1, g0 = 0.6, g1 = 2, alpha = 0.4 } = {}) =>
    rauch.wurf(p, P(zufall(-0.3, 0.3), zufall(0.3, 0.8), zufall(-0.3, 0.3)).multiplyScalar(tempo), { farbe: [0.12, 0.3, 0.03], dauer: zufall(1.6, 2.6), g0, g1, alpha, zug: 1 });
  const blase = (p: V3, groesse = 1) => blasen.wurf(p, P(zufall(-0.1, 0.1), zufall(0.2, 0.6), zufall(-0.1, 0.1)), zufall(0.6, 1.4) * groesse, zufall(0.5, 1.1), wahl(GIFTE), { schwer: -0.3, blase: true });
  const BLUT = [0x5a000a, 0x46000a, 0x6a0010], LACHE = 0x1a0003;
  const blutnebel = (p: V3, { vel, g0 = 0.5, g1 = 1.8, alpha = 0.4, zug = 1.4 }: { vel?: V3; g0?: number; g1?: number; alpha?: number; zug?: number } = {}) =>
    rauch.wurf(p, vel ?? P(zufall(-0.4, 0.4), zufall(0.2, 0.6), zufall(-0.4, 0.4)), { farbe: [0.25, 0.0, 0.015], dauer: zufall(1.4, 2.2), g0, g1, alpha, zug });
  function spritzer(p: V3, n: number, tempo: [number, number] = [1, 3], groesse: [number, number] = [0.5, 1]) {
    for (let i = 0; i < n; i++) {
      const r = P().randomDirection(); r.y = Math.abs(r.y) * 1.5 + 0.3;
      tropfen.wurf(p, r.normalize().multiplyScalar(zufall(...tempo)), zufall(...groesse), zufall(0.8, 1.4), wahl(BLUT));
    }
  }
  const wisp = (p: V3, { g0 = 0.35, g1 = 0.9, alpha = 0.6 } = {}) =>
    rauch.wurf(p, P(zufall(-0.2, 0.2), zufall(0.5, 1.2), zufall(-0.2, 0.2)), { farbe: [0.01, 0.0, 0.02], dauer: zufall(1, 1.8), g0, g1, alpha, zug: 0.8 });
  const FEE: Rgb[] = [[2.0, 0.6, 1.6], [0.4, 1.8, 1.6], [2.0, 1.6, 0.5]];
  const FEE_HEX = [0xff6ad5, 0x40e0d0, 0xffd04a];
  const LUFT: Rgb = [1.1, 1.35, 1.5];

  // ---------- Elemente ----------
  // ❄ Eis: Kristalle wandern auffächernd zum Opfer, Boden reißt, großer Kristallhaufen
  function planEis(a: Angriff) {
    a.spur(0.22, (s, f, t, p) => {
      faecher(a, s, f, t, { breite0: 0.15, breite1: 1.5, dichte: 2.5, lehne: [0.35, 0.65], h0: 0.35, h1: 1.0, hz: 0.45, dicke: [0.22, 0.3], spitze: { geo: "eis", wachs: 0.1, brocken: 0xa8dcff } });
      schwaden(a, p, 0.15 + f * 1.5, 0x4a8ad8);
      leucht.wurf(p, P().randomDirection().multiplyScalar(1.2).setY(zufall(1, 2.5)), { farbe: [0.6, 0.85, 1.0], dauer: zufall(0.4, 0.8), g0: 0.14, g1: 0.02, schwer: 3 });
      if (Math.random() < 0.6) splitter.wurf(p.clone().setY(0.1), P().randomDirection().multiplyScalar(1.5).setY(zufall(2, 4)), zufall(0.4, 0.8), 0.9, 0xa8dcff);
    });
    a.bei(a.reise, () => {
      a.treffer({ tint: 0xa8dcff, staerke: 1, blitz: [0.8, 1.0, 1.2], stoss: 0.25, dir: a.dir });
      ruetteln(0.25);
      risse(a.ziel, { farbe: 0x6cc8ff, halten: 1.9 });
      scheibe(a.ziel, { farbe: 0x5aa8ff, groesse: 7, halten: 1.6 });
    });
    a.bei(a.finale, () => {
      kranz(a, 7, { r0: 0.15, r1: 0.6, lehne: () => zufall(0.12, 0.38), h: () => zufall(2.6, 3.8), dicke: [0.2, 0.26], bruch: 1.55, verzFaktor: 0, spitze: { geo: "eis", wachs: 0.14 } });
      kranz(a, 48, { r0: 0.6, r1: 2.7, vor: 0.25, lehne: (r) => Math.min(1.25, 0.3 + r * 0.32 + zufall(-0.1, 0.1)), h: (r) => Math.max(0.45, (3.1 - r) * 0.85 + zufall(-0.2, 0.5)), dicke: [0.22, 0.32], bruch: 1.55, spitze: { geo: "eis", wachs: 0.12 } });
      const m = a.mitte();
      for (let i = 0; i < 150; i++) { v.randomDirection(); v.y = Math.abs(v.y) * 1.2 + 0.2; v.multiplyScalar(zufall(4, 11)); splitter.wurf(m, v, zufall(0.6, 1.8), zufall(0.9, 1.7), 0xa8dcff); }
      for (let i = 0; i < 50; i++) leucht.wurf(m, P().randomDirection().multiplyScalar(zufall(3, 9)), { farbe: [0.6, 0.85, 1.0], dauer: zufall(0.5, 1.1), g0: zufall(0.12, 0.25), g1: 0.02, zug: 2.5, schwer: 2 });
      for (let i = 0; i < 60; i++) leucht.wurf(a.ziel.clone().setY(zufall(0.2, 0.8)), kreis(Math.random() * 6.28).multiplyScalar(zufall(3, 6.5)).setY(zufall(0.2, 1)),
        { farbe: 0x4a8ad8, dauer: zufall(1.6, 2.6), g0: 1, g1: zufall(2.5, 3.8), alpha: zufall(0.14, 0.24), zug: 2.4 });
      aufblitzen(a.mitte(a.mitteY + 0.5), 0x9fd8ff, 120);
      a.treffer({ tint: 0xa8dcff, blitz: [1.5, 1.8, 2], stoss: 0.45, dir: a.dir });
      ruetteln(0.55);
    });
    a.bei(a.finale + 1.7, a.loesen);
    a.ende = a.finale + 2.6;
  }

  // 🔥 Feuer: Flammenzungen fächern zum Opfer, Glut und dicker Qualm; Feuerball aus großen Flammen, Opfer brennt
  function planFeuer(a: Angriff) {
    a.spur(0.24, (s, f, t, p) => {
      const breite = 0.15 + f * 1.2, ende = a.finale + 1.1 - t;
      for (let k = 0; k < 1 + Math.floor(f * 1.5 + Math.random()); k++)
        flammenzunge(a.punkt(s, (Math.random() * 2 - 1) * breite), { h: (0.6 + f * 1.1) * zufall(0.8, 1.2), b: (0.5 + f * 0.6) * zufall(0.8, 1.2), dauer: ende + zufall(0, 0.4) });
      strom(ende, 3 + f * 3, () => qualm(a.punkt(s, zufall(-breite, breite), 0.9 + f * 1.2), { g0: 0.5, g1: 2.2, alpha: 0.3 }));
      if (Math.random() < 0.7) glut(p);
      scheibe(p, { farbe: 0x000000, additiv: false, alpha: 0.6, groesse: 1 + f * 1.8, halten: 2.4, wachs: 0.2 });
      if (Math.random() < 0.5) scheibe(p, { farbe: 0xff4a00, alpha: 0.3, groesse: 0.9 + f, halten: ende, wachs: 0.15 });
    });
    a.bei(a.reise, () => {
      a.treffer({ tint: 0x2a1408, staerke: 0.85, blitz: [2, 0.9, 0.2], stoss: 0.25, dir: a.dir });
      ruetteln(0.25);
      risse(a.ziel, { farbe: 0xff5a10, glanz: 1.1, halten: 2.2 });
      for (let i = 0; i < 5; i++) flammenzunge(a.ziel.clone().addScaledVector(kreis(Math.random() * 6.28), zufall(0.2, 0.55)), { h: zufall(2, 2.8), dauer: 2.4 + Math.random() * 0.4 }); // Opfer fängt Feuer
    });
    a.bei(a.finale, () => {
      const m = a.mitte();
      for (let i = 0; i < 12; i++) { // Feuerball aus großen Flammen
        const r = Math.random() ** 0.6 * 1.6, h = (3.6 - r) * 1.2 + zufall(0, 0.8);
        flammenzunge(a.ziel.clone().addScaledVector(kreis(Math.random() * 6.28), r), { h, b: h * 0.6, dauer: 1.1 + Math.random() * 0.5, verz: r * 0.04 });
      }
      for (let i = 0; i < 3; i++) leucht.wurf(m, P().randomDirection().multiplyScalar(0.5), { farbe: [1.6, 0.5, 0.08], farbe2: [0.4, 0.05, 0], dauer: 0.45, g0: zufall(3, 4), g1: 2, alpha: 0.3 });
      for (let i = 0; i < 60; i++) {
        v.randomDirection(); v.y = Math.abs(v.y) * 1.1 + 0.15; v.multiplyScalar(zufall(3, 8));
        leucht.wurf(m, v, { farbe: [2.2, 1.0, 0.2], farbe2: [0.6, 0.05, 0.0], dauer: zufall(0.4, 0.8), g0: zufall(0.25, 0.5), g1: 0.1, alpha: 0.8, zug: 2.8, schwer: -1 });
      }
      for (let i = 0; i < 150; i++) glut(m, 2);
      strom(1.4, 45, () => qualm(a.ziel.clone().add(P(zufall(-1, 1), zufall(1.5, 3.5), zufall(-1, 1))), { tempo: zufall(1.5, 3), g0: 1.2, g1: 5, alpha: 0.45 })); // Rauchsäule
      welle(a.ziel, { farbe: [2.2, 0.8, 0.1], r: 6, dauer: 0.6 });
      scheibe(a.ziel, { farbe: 0x000000, additiv: false, alpha: 0.75, groesse: 6, halten: 2.5 });
      scheibe(a.ziel, { farbe: 0xff5a10, groesse: 5, alpha: 0.6, halten: 1.0 });
      aufblitzen(a.mitte(a.mitteY + 0.5), 0xff8a30, 220);
      a.treffer({ tint: 0x2a1408, staerke: 0.9, blitz: [2.5, 1.2, 0.3], stoss: 0.45, dir: a.dir });
      ruetteln(0.6);
    });
    a.bei(a.finale + 2.0, a.loesen);
    a.ende = a.finale + 2.8;
  }

  // 🪨 Erde: Felsspitzen brechen nacheinander auf, Staub; Steinkiefer schließt sich, Opfer wird hochgeschleudert
  function planErde(a: Angriff) {
    const fels = (wachs: number): SpitzeOpt => ({ geo: "fels", mat: "stein", wachs, teile: kiesel, brocken: wahl(STEINE),
      beimBruch: (sp) => { for (let k = 0; k < 2; k++) staub(sp.fuss.clone().addScaledVector(sp.richtung, sp.h * Math.random()), { g0: 0.7, g1: 2 }); } });
    a.spur(0.3, (s, f, t, p) => {
      faecher(a, s, f, t, { breite0: 0.2, breite1: 1.0, dichte: 1.6, lehne: [0.15, 0.4], h0: 0.45, h1: 1.1, hz: 0.4, dicke: [0.38, 0.5], spitze: fels(0.07) });
      for (let k = 0; k < 3; k++) staub(a.punkt(s, zufall(-0.5, 0.5) * (0.3 + f), 0.15));
      for (let k = 0; k < 3; k++) kiesel.wurf(p, P().randomDirection().multiplyScalar(1.5).setY(zufall(2.5, 5)), zufall(0.5, 1.1), 1.2, wahl(STEINE));
      ruetteln(0.1);
    });
    a.bei(a.reise, () => {
      a.treffer({ tint: 0x8a7a66, staerke: 0.55, blitz: [0.8, 0.5, 0.2], stoss: 0.2, dir: a.dir });
      ruetteln(0.3);
      risse(a.ziel, { farbe: 0xe06a18, glanz: 0.75, laenge: 1.15, breite: 1.4, halten: 2.0 });
    });
    a.bei(a.finale, () => {
      kranz(a, 12, { r0: 1.2, r1: 1.9, innen: true, lehne: () => zufall(0.25, 0.45), h: () => zufall(2.4, 3.4), dicke: [0.42, 0.55], bruch: 1.45, verzFaktor: 0.03, spitze: fels(0.09) });
      kranz(a, 22, { r0: 2.0, r1: 3.2, lehne: (r) => 0.3 + r * 0.12, h: (r) => Math.max(0.5, (4 - r) * 0.6 + zufall(-0.2, 0.3)), dicke: [0.4, 0.55], bruch: 1.5, spitze: fels(0.08) });
      const m = a.mitte(0.6);
      for (let i = 0; i < 130; i++) { v.randomDirection(); v.y = Math.abs(v.y) * 1.4 + 0.3; v.multiplyScalar(zufall(4, 10)); kiesel.wurf(m, v, zufall(0.8, 2.6), zufall(1.2, 2), wahl(STEINE)); }
      for (let i = 0; i < 80; i++) staub(a.ziel.clone().setY(zufall(0.2, 0.7)), { vel: kreis(Math.random() * 6.28).multiplyScalar(zufall(3, 6.5)).setY(zufall(0.1, 0.5)), g0: 1, g1: zufall(2.8, 4.2), alpha: 0.55, zug: 2.2 });
      welle(a.ziel, { farbe: [0.9, 0.45, 0.15], r: 6, dauer: 0.6 });
      aufblitzen(m, 0xffa060, 80);
      a.treffer({ tint: 0x8a7a66, staerke: 0.6, blitz: [1, 0.6, 0.3], stoss: 0 });
      a.opfer.stoss.set(a.dir.x * 0.2, 1.1, a.dir.z * 0.2); // hochgeschleudert
      ruetteln(0.75);
    });
    a.bei(a.finale + 1.7, a.loesen);
    a.ende = a.finale + 2.8;
  }

  // ⚡ Blitz: Entladung vom Täter, Bögen springen über den Boden, drei Einschläge von oben, großer Schlag mit Bodenblitzen
  function planBlitz(a: Angriff) {
    a.bei(0, () => effekte.push(new Blitz(a.start.clone().setY(1.3), a.mitte(), { dicke: 0.035, dauer: 0.22, zacken: 0.7, aeste: 3 })));
    a.spur(0.55, (s, f) => {
      const q = (Math.random() * 2 - 1) * (0.2 + f * 1.2), nach = a.punkt(s + 0.2, q, zufall(0.05, 0.3));
      effekte.push(new Blitz(a.punkt(Math.max(0, s - 0.7), q * 0.5, zufall(0.05, 0.3)), nach, { dicke: 0.025, dauer: 0.18, zacken: 0.35, aeste: 1, farbe: VIOLETT }));
      for (let k = 0; k < 5; k++) funke(nach, 0.6);
      scheibe(nach, { farbe: 0x6a5aff, groesse: 1.2, alpha: 0.5, halten: 0.3, wachs: 0.1 });
    });
    const schlag = (k: number, dicke: number) => {
      effekte.push(new Blitz(a.ziel.clone().add(P(zufall(-1.5, 1.5), 14, zufall(-1.5, 1.5))), a.mitte(), { dicke, dauer: 0.32, zacken: 1.4, aeste: 4 }));
      for (let i = 0; i < 40 * k; i++) funke(a.mitte(a.mitteY * 0.8));
      aufblitzen(a.mitte(a.mitteY + 1), 0xb0a0ff, 180 * k);
      scheibe(a.ziel, { farbe: 0x8a7aff, groesse: 3 * k, alpha: 0.9, halten: 0.25, wachs: 0.08 });
      ruetteln(0.3 * k);
      a.opfer.blitz = 1;
    };
    a.bei(a.reise, () => {
      a.treffer({ tint: 0xd8e0ff, staerke: 0.4, blitz: [2.5, 2.5, 4], stoss: 0.3, dir: a.dir });
      schlag(1, 0.06);
      risse(a.ziel, { farbe: 0xa090ff, glanz: 1.4, halten: 1.6 });
    });
    a.bei(a.reise + 0.22, () => schlag(1, 0.05));
    a.bei(a.reise + 0.4, () => schlag(1, 0.06));
    a.bei(a.reise + 0.65, () => {
      schlag(2, 0.14);
      for (let i = 0; i < 9; i++) {
        const w = (i / 9) * Math.PI * 2 + zufall(-0.2, 0.2);
        effekte.push(new Blitz(a.ziel.clone().setY(0.2), a.ziel.clone().addScaledVector(kreis(w), zufall(2.5, 4.5)).setY(0.05), { dicke: 0.04, dauer: 0.45, zacken: 0.5, aeste: 2, farbe: VIOLETT, verz: zufall(0, 0.06) }));
      }
      saeule(a.ziel, { farbe: [1.8, 1.8, 4], r: 0.7, h: 14, dauer: 0.5 });
      welle(a.ziel, { farbe: VIOLETT, r: 6.5, dauer: 0.5 });
      strom(1.3, 12, () => { // Opfer knistert nach
        const p = a.ziel.clone().add(P(zufall(-0.5, 0.5), zufall(0.2, a.opfer.hoehe * 0.95), zufall(-0.5, 0.5)));
        effekte.push(new Blitz(p, p.clone().add(P().randomDirection().multiplyScalar(zufall(0.4, 0.9))), { dicke: 0.015, dauer: 0.1, zacken: 0.2, aeste: 0 }));
        funke(p, 0.4);
      });
      a.opfer.stoss.copy(a.dir).multiplyScalar(0.5);
    });
    a.bei(a.reise + 2.0, a.loesen);
    a.ende = a.reise + 2.4;
  }

  // 🌿 Pflanzen: Dornen sprießen auffächernd, Blätter; Wurzeln, Ranken winden sich hoch, Blüte öffnet sich
  function planPflanzen(a: Angriff) {
    const H = a.opfer.hoehe;
    a.spur(0.24, (s, f, t, p) => {
      faecher(a, s, f, t, { breite0: 0.15, breite1: 1.3, dichte: 2.2, lehne: [0.2, 0.45], h0: 0.3, h1: 0.8, hz: 0.35, dicke: [0.2, 0.28], spitze: { geo: "dorn", wachs: 0.14, brocken: 0x3f7a22 } });
      for (let k = 0; k < 2; k++) blatt(p.clone().setY(0.4), P().randomDirection().multiplyScalar(1.5).setY(zufall(1, 2.5)));
      if (Math.random() < 0.4) bluetenblatt(p.clone().setY(0.5), P().randomDirection().multiplyScalar(1.2).setY(zufall(0.5, 1.5)));
    });
    a.bei(a.reise, () => {
      a.treffer({ tint: 0x4f8a3a, staerke: 0.55, blitz: [0.6, 1.4, 0.4], stoss: 0.2, dir: a.dir });
      risse(a.ziel, { farbe: 0x7ac030, glanz: 0.7, breite: 1.8, laenge: 0.9, halten: 2.4 }); // Wurzeln
      ruetteln(0.15);
    });
    a.bei(a.finale, () => {
      for (let i = 0; i < 6; i++) {
        const w0 = (i / 6) * Math.PI * 2, punkte: V3[] = [];
        for (let j = 0; j <= 14; j++) { const k = j / 14; punkte.push(a.ziel.clone().addScaledVector(kreis(w0 + k * Math.PI * 1.4), 1.0 - k * 0.45).setY(k * H * 1.25)); }
        effekte.push(new Ranke(punkte, { radius: 0.09, wachs: 0.5, halten: 1.7, verz: i * 0.04 }));
      }
      kranz(a, 22, { r0: 0.9, r1: 2.2, lehne: (r) => 0.35 + r * 0.25, h: (r) => Math.max(0.4, (2.8 - r) * 0.8 + zufall(-0.1, 0.4)), dicke: [0.2, 0.28], bruch: 1.6, spitze: { geo: "dorn", wachs: 0.14, brocken: 0x3f7a22 } });
      bluete(a.mitte(H * 1.3), { verz: 0.4, halten: 1.4 });
      const m = a.mitte();
      for (let i = 0; i < 80; i++) blatt(m, P().randomDirection().multiplyScalar(zufall(2.5, 6)));
      for (let i = 0; i < 60; i++) bluetenblatt(m, P().randomDirection().multiplyScalar(zufall(2, 5)));
      strom(1.8, 25, () => leucht.wurf(a.ziel.clone().add(P(zufall(-1.2, 1.2), zufall(0.3, H * 1.4), zufall(-1.2, 1.2))), P(0, zufall(0.2, 0.6), 0), { farbe: [1.8, 1.6, 0.4], dauer: 1.2, g0: 0.08, g1: 0.02 })); // Pollen
      welle(a.ziel, { farbe: [0.5, 1.4, 0.3], r: 4.5, dauer: 0.6 });
      aufblitzen(m, 0x9aff60, 60);
      a.opfer.stoss.copy(a.dir).multiplyScalar(0.3);
      ruetteln(0.35);
    });
    a.bei(a.finale + 1.9, a.loesen);
    a.ende = a.finale + 2.6;
  }

  // 🌑 Dunkelheit: schwarze Kugel zieht Finsternis hinter sich her, Kuppel verschlingt das Opfer, Funken werden eingesogen, Implosion
  function planDunkel(a: Angriff) {
    const R = Math.max(1.6, a.opfer.hoehe * 0.9);
    a.bei(0, () => {
      dunkelZiel = 1;
      const kugel = new THREE.Mesh(new THREE.SphereGeometry(0.42, 32, 16), kugelMat([0.6, 0.2, 1.4]));
      scene.add(kugel);
      const von = a.start.clone().setY(1.2), nach = a.mitte();
      let rest = 0;
      ablauf(a.reise, (t, k, dt) => {
        kugel.position.lerpVectors(von, nach, k * k);
        kugel.scale.setScalar(1 + Math.sin(t * 30) * 0.06);
        rest += dt * 70;
        while (rest >= 1) {
          rest--;
          rauch.wurf(kugel.position.clone().add(P().randomDirection().multiplyScalar(0.3)), P().randomDirection().multiplyScalar(0.4), { farbe: DUNKEL, dauer: zufall(0.9, 1.6), g0: 0.7, g1: 1.6, alpha: 0.6, zug: 1.5 });
          if (Math.random() < 0.3) leucht.wurf(kugel.position, P().randomDirection().multiplyScalar(1.2), { farbe: [0.6, 0.15, 1.2], dauer: 0.6, g0: 0.1, g1: 0.02 });
        }
      }, () => entfernen(kugel, kugel.geometry, kugel.material as THREE.Material));
    });
    a.spur(0.5, (s, f, t) => scheibe(a.punkt(s), { farbe: 0x000000, additiv: false, alpha: 0.55, groesse: 1.4 + f * 2, halten: a.finale + 1.4 - t, wachs: 0.3 }));
    a.bei(a.reise, () => {
      a.treffer({ tint: 0x1a0a2a, staerke: 0.9, blitz: [0.8, 0.2, 1.6], stoss: 0.3, dir: a.dir });
      risse(a.ziel, { farbe: 0x8a40ff, glanz: 1.1, halten: 1.8 });
      scheibe(a.ziel, { farbe: 0x000000, additiv: false, alpha: 0.8, groesse: 6, halten: 1.8 });
      const kuppel = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 20), kugelMat([0.7, 0.25, 1.6]));
      kuppel.position.copy(a.mitte());
      scene.add(kuppel);
      ablauf(0.85, (t) => {
        const r = t < 0.2 ? R * easeOutBack(t / 0.2) : t < 0.7 ? R + Math.sin(t * 40) * 0.04 : R * (1 - (t - 0.7) / 0.15);
        kuppel.scale.setScalar(Math.max(0.01, r));
      }, () => entfernen(kuppel, kuppel.geometry, kuppel.material as THREE.Material));
      strom(0.6, 160, () => { // Licht wird eingesogen
        const r = zufall(3, 5), richtung = P().randomDirection();
        richtung.y = Math.abs(richtung.y);
        leucht.wurf(a.mitte().addScaledVector(richtung, r), richtung.clone().multiplyScalar(-r / 0.45), { farbe: [0.7, 0.2, 1.6], farbe2: [1.5, 1.2, 2.5], dauer: 0.45, g0: 0.12, g1: 0.04 });
      });
    });
    a.bei(a.reise + 0.85, () => { // Implosion -> Ausbruch
      const m = a.mitte();
      for (let i = 0; i < 160; i++) leucht.wurf(m, P().randomDirection().multiplyScalar(zufall(3, 10)), { farbe: [0.8, 0.25, 1.8], farbe2: [0.2, 0.0, 0.5], dauer: zufall(0.5, 1.1), g0: 0.16, g1: 0.02, zug: 2.5 });
      for (let i = 0; i < 70; i++) rauch.wurf(m.clone().setY(zufall(0.2, 1)), kreis(Math.random() * 6.28).multiplyScalar(zufall(3, 7)).setY(zufall(0, 0.6)), { farbe: DUNKEL, dauer: zufall(1.4, 2.4), g0: 1, g1: zufall(3, 4.5), alpha: 0.6, zug: 2.2 });
      welle(a.ziel, { farbe: [0.8, 0.25, 1.8], r: 6.5, dauer: 0.6 });
      aufblitzen(m, 0x9a50ff, 160);
      a.opfer.blitz = 1;
      a.opfer.stoss.copy(a.dir).multiplyScalar(0.45);
      ruetteln(0.6);
    });
    a.bei(a.reise + 2.0, () => { a.loesen(); dunkelZiel = 0; });
    a.ende = a.reise + 2.8;
  }

  // ☠ Gift: blubbernde Giftlachen und Dämpfe, Giftgeysir, Gift wirkt am Opfer nach
  function planGift(a: Angriff) {
    const H = a.opfer.hoehe;
    a.spur(0.25, (s, f, t, p) => {
      const lache = a.punkt(s, zufall(-0.3, 0.3) * (0.3 + f)), halten = a.finale + 1.6 - t;
      scheibe(lache, { farbe: 0x0a2a04, additiv: false, alpha: 0.7, groesse: 0.9 + f * 1.4, halten, wachs: 0.25 });
      scheibe(lache, { farbe: GIFT, alpha: 0.45, groesse: 0.7 + f * 1.1, halten, wachs: 0.25 });
      strom(halten, 4 + f * 4, () => blase(lache.clone().add(P(zufall(-0.4, 0.4) * (0.5 + f), 0.03, zufall(-0.4, 0.4) * (0.5 + f))), 0.7 + f * 0.6));
      if (Math.random() < 0.6) giftDampf(p);
      for (let k = 0; k < 2; k++) tropfen.wurf(p.clone().setY(0.1), P().randomDirection().multiplyScalar(1.2).setY(zufall(2, 3.5)), zufall(0.6, 1), 0.8, GIFT);
    });
    a.bei(a.reise, () => {
      a.treffer({ tint: 0x6adf3a, staerke: 0.75, blitz: [0.6, 1.6, 0.2], stoss: 0.2, dir: a.dir });
      risse(a.ziel, { farbe: 0x7aff3a, glanz: 0.8, halten: 2.3 });
      scheibe(a.ziel, { farbe: 0x0a2a04, additiv: false, alpha: 0.75, groesse: 5, halten: 2.5 });
      scheibe(a.ziel, { farbe: GIFT, alpha: 0.6, groesse: 4.2, halten: 2.5 });
    });
    a.bei(a.finale + 0.1, () => {
      saeule(a.ziel, { farbe: [0.7, 2.0, 0.2], r: 1.0, h: 6, dauer: 0.9 });
      const m = a.mitte(0.6);
      for (let i = 0; i < 160; i++) { v.randomDirection(); v.y = Math.abs(v.y) * 2 + 0.6; v.normalize().multiplyScalar(zufall(4, 10)); tropfen.wurf(m, v, zufall(0.8, 1.8), zufall(1, 1.8), wahl(GIFTE)); }
      for (let i = 0; i < 70; i++) giftDampf(a.ziel.clone().add(P(zufall(-1.2, 1.2), zufall(0.3, H * 1.1), zufall(-1.2, 1.2))), { tempo: zufall(1, 2.5), g0: 1.2, g1: 4.5, alpha: 0.45 });
      for (let i = 0; i < 50; i++) blase(a.ziel.clone().add(P(zufall(-1.5, 1.5), 0.05, zufall(-1.5, 1.5))), 1.5);
      strom(2.4, 10, () => { // Gift wirkt nach
        giftDampf(a.ziel.clone().add(P(zufall(-0.4, 0.4), zufall(0.5, H * 0.9), zufall(-0.4, 0.4))), { alpha: 0.3 });
        blase(a.ziel.clone().add(P(zufall(-0.5, 0.5), zufall(0.4, H * 0.9), zufall(-0.5, 0.5))), 0.8);
      });
      welle(a.ziel, { farbe: [0.6, 1.8, 0.2], r: 5, dauer: 0.6 });
      aufblitzen(m, 0x8aff40, 90);
      a.opfer.blitz = 1;
      a.opfer.stoss.copy(a.dir).multiplyScalar(0.35);
      ruetteln(0.4);
    });
    a.bei(a.finale + 2.6, a.loesen);
    a.ende = a.finale + 3.2;
  }

  // 🩸 Blut: flüssige Blutzungen schnellen wabbelnd hoch und zerfließen zu Lachen, Blutstrahlen; Blutranken bohren sich ins Opfer, Blutregen
  function planBlut(a: Angriff) {
    const zunge = (wachs: number): SpitzeOpt => ({ geo: "blut", mat: "blut", wachs, sinken: true, wabbeln: true,
      beimBruch: (sp) => { spritzer(sp.fuss.clone().setY(0.1), 2, [0.5, 1.5], [0.4, 0.8]); scheibe(sp.fuss, { farbe: LACHE, additiv: false, alpha: 0.75, groesse: 0.6 + sp.h, halten: 1.2, wachs: 0.3 }); } });
    a.spur(0.28, (s, f, t, p) => {
      faecher(a, s, f, t, { breite0: 0.15, breite1: 1.0, dichte: 1.2, lehne: [0.2, 0.45], h0: 0.35, h1: 0.8, hz: 0.3, dicke: [0.5, 0.65], spitze: zunge(0.16) });
      const strahl = a.dir.clone().multiplyScalar(0.5).setY(1).normalize();
      for (let i = 0; i < 4; i++) tropfen.wurf(p.clone().setY(0.1), strahl.clone().multiplyScalar(zufall(3, 5)).add(P().randomDirection().multiplyScalar(0.6)), zufall(0.7, 1.3), zufall(0.8, 1.2), wahl(BLUT));
      if (Math.random() < 0.4) blutnebel(p, { alpha: 0.25 });
      scheibe(a.punkt(s, zufall(-0.3, 0.3)), { farbe: LACHE, additiv: false, alpha: 0.8, groesse: 0.7 + f * 1.3, halten: a.finale + 1.8 - t, wachs: 0.25 });
    });
    a.bei(a.reise, () => {
      a.treffer({ tint: 0x8a1020, staerke: 0.6, blitz: [1.6, 0.1, 0.15], stoss: 0.25, dir: a.dir });
      risse(a.ziel, { farbe: 0xc0001a, glanz: 0.6, halten: 2.0 });
      scheibe(a.ziel, { farbe: LACHE, additiv: false, alpha: 0.85, groesse: 4.5, halten: 2.2 });
    });
    a.bei(a.finale, () => {
      const y = a.mitteY;
      for (let i = 0; i < 8; i++) { // Blutranken winden sich aus der Lache ins Opfer
        const w = (i / 8) * Math.PI * 2 + zufall(-0.2, 0.2), r = zufall(1.5, 2.0);
        const punkte = [
          a.ziel.clone().addScaledVector(kreis(w), r).setY(-0.1),
          a.ziel.clone().addScaledVector(kreis(w + 0.3), r * 0.85).setY(y * 0.8),
          a.ziel.clone().addScaledVector(kreis(w + 0.6), r * 0.45).setY(y * 1.4),
          a.ziel.clone().addScaledVector(kreis(w + 0.8), 0.12).setY(y),
        ];
        effekte.push(new Ranke(punkte, { radius: 0.16, wachs: 0.3, halten: 1.4, verz: i * 0.03, mat: MAT.blut }));
      }
      kranz(a, 18, { r0: 0.8, r1: 2.4, lehne: (r) => 0.3 + r * 0.25, h: (r) => Math.max(0.4, (2.6 - r) * 0.8 + zufall(-0.1, 0.4)), dicke: [0.5, 0.65], bruch: 1.5, spitze: zunge(0.18) });
      const m = a.mitte();
      spritzer(m, 140, [3, 8], [0.6, 1.5]);
      for (let i = 0; i < 30; i++) blutnebel(a.ziel.clone().setY(zufall(0.3, 1.2)), { vel: kreis(Math.random() * 6.28).multiplyScalar(zufall(2.5, 5)).setY(zufall(0.1, 0.5)), g0: 0.8, g1: zufall(2, 3.2), alpha: 0.4, zug: 2.3 });
      welle(a.ziel, { farbe: [1.2, 0.03, 0.06], r: 5, dauer: 0.6 });
      strom(0.9, 40, () => tropfen.wurf(a.ziel.clone().add(P(zufall(-2.5, 2.5), zufall(3, 5), zufall(-2.5, 2.5))), P(0, -2, 0), zufall(0.5, 1), 1.2, wahl(BLUT)), 0.35); // Blutregen
      aufblitzen(m, 0xff2030, 100);
      a.opfer.blitz = 1;
      a.opfer.stoss.copy(a.dir).multiplyScalar(0.4);
      ruetteln(0.5);
    });
    a.bei(a.finale + 1.8, a.loesen);
    a.ende = a.finale + 2.7;
  }

  // 👤 Schatten: der Schatten des Täters kriecht zum Opfer, Tentakel greifen von außen zu und stoßen zu
  function planSchatten(a: Angriff) {
    const H = a.opfer.hoehe;
    const tentakel = (wachs: number, extra: SpitzeOpt = {}): SpitzeOpt => ({ geo: "tentakel", mat: "schatten", wachs, sinken: true, ...extra });
    a.bei(0, () => { dunkelZiel = 0.6; schattenband(a, 1.9); });
    a.spur(0.3, (s, f, t, p) => {
      for (let k = 0; k < 2; k++) wisp(a.punkt(s, zufall(-0.4, 0.4) * (0.5 + f), 0.05));
      if (Math.random() < 0.45) {
        const q = zufall(-0.4, 0.4) * (0.5 + f), waag = a.dir.clone().addScaledVector(a.seite, Math.sign(q) * 0.4).normalize(), h = zufall(0.4, 0.9) + f * 0.4;
        effekte.push(new Spitze(a.punkt(s, q), kipp(zufall(0.2, 0.45), waag), h, h * 0.22, { ...tentakel(0.2), biegRichtung: waag, bruch: a.reise + 1.4 - t + f * 0.2 }));
      }
      if (Math.random() < 0.3) leucht.wurf(p, P(0, zufall(0.3, 0.8), 0), { farbe: [0.5, 0.15, 1.2], dauer: 0.8, g0: 0.08, g1: 0.02 });
    });
    a.bei(a.reise, () => {
      a.treffer({ tint: 0x120a1a, staerke: 0.8, blitz: [0.5, 0.15, 1.2], stoss: 0.15, dir: a.dir });
      scheibe(a.ziel, { farbe: 0x000000, additiv: false, alpha: 0.85, groesse: 5.5, halten: 2.2, wachs: 0.4 });
      risse(a.ziel, { farbe: 0x6a30d0, glanz: 0.6, breite: 0.8, halten: 2.0 });
    });
    a.bei(a.reise + 0.1, () => kranz(a, 10, { r0: 1.3, r1: 2.0, innen: true, lehne: () => zufall(0.15, 0.3), h: () => zufall(1.2, 1.8) * H, dicke: [0.2, 0.26], bruch: 1.6, verzFaktor: 0.08,
      spitze: tentakel(0.35, { beimBruch: (sp) => { for (let k = 0; k < 4; k++) wisp(sp.fuss.clone().addScaledVector(sp.richtung, sp.h * Math.random()), { g0: 0.5, g1: 1.4 }); } }) }));
    a.bei(a.reise + 0.5, () => { // Zustoßen
      kranz(a, 14, { r0: 0.45, r1: 0.9, innen: true, lehne: () => zufall(0.35, 0.6), h: () => zufall(0.8, 1.2) * H, dicke: [0.14, 0.2], bruch: 1.15, verzFaktor: 0.02, spitze: tentakel(0.07) });
      const m = a.mitte();
      for (let i = 0; i < 60; i++) wisp(a.ziel.clone().add(P(zufall(-1.5, 1.5), zufall(0, H * 0.8), zufall(-1.5, 1.5))), { g0: 0.6, g1: 2, alpha: 0.55 });
      for (let i = 0; i < 90; i++) leucht.wurf(m, P().randomDirection().multiplyScalar(zufall(2, 7)), { farbe: [0.6, 0.2, 1.4], farbe2: [0.1, 0.0, 0.3], dauer: zufall(0.4, 0.9), g0: 0.1, g1: 0.02, zug: 2.5 });
      welle(a.ziel, { farbe: [0.5, 0.15, 1.2], r: 5, dauer: 0.5 });
      aufblitzen(m, 0x7a40ff, 70);
      a.treffer({ tint: 0x120a1a, staerke: 0.9, blitz: [0.6, 0.2, 1.4], stoss: 0.4, dir: a.dir });
      ruetteln(0.45);
    });
    a.bei(a.reise + 2.0, () => { a.loesen(); dunkelZiel = 0; });
    a.ende = a.reise + 2.8;
  }

  // 🧚 Fee: drei Lichtschwärme spiralen zum Opfer, Pilze wachsen am Weg, Feenring, Lichtsäule mit Funkenfontäne
  function planFee(a: Angriff) {
    const H = a.opfer.hoehe;
    a.spur(0.1, (s, f, t) => {
      for (let k = 0; k < 3; k++) {
        const w = s * 3 + k * 2.1, p = a.punkt(s, Math.sin(w) * (0.3 + f * 0.6), 0.9 + Math.cos(w) * (0.3 + f * 0.4));
        leucht.wurf(p, P().randomDirection().multiplyScalar(0.3), { farbe: FEE[k], dauer: zufall(0.7, 1.2), g0: 0.22, g1: 0.02, schwer: -0.2 });
        if (Math.random() < 0.5) leucht.wurf(p, P().randomDirection().multiplyScalar(0.8), { farbe: [2, 2, 2], dauer: 0.5, g0: 0.06, g1: 0.01 });
      }
      if (Math.random() < 0.18) pilz(a.punkt(s, zufall(-0.6, 0.6) * (0.4 + f)), { farbe: wahl(FEE_HEX), groesse: zufall(0.5, 0.9), halten: a.finale + 1.8 - t });
    }, a.L - 0.3);
    a.bei(a.reise, () => {
      a.treffer({ tint: 0xe0a8ff, staerke: 0.5, blitz: [1.6, 0.8, 1.6], stoss: 0.15, dir: a.dir });
      for (let i = 0; i < 14; i++) pilz(a.ziel.clone().addScaledVector(kreis((i / 14) * Math.PI * 2), 1.7), { farbe: FEE_HEX[i % 3], groesse: zufall(1.1, 1.5), verz: i * 0.035, halten: 2.3 });
      scheibe(a.ziel, { farbe: 0xb070ff, groesse: 4.5, alpha: 0.35, halten: 2 });
      strom(0.6, 60, () => leucht.wurf(a.ziel.clone().addScaledVector(kreis(Math.random() * 6.28), 1.7).setY(0.3), P(0, zufall(0.5, 1.5), 0), { farbe: wahl(FEE), dauer: 0.9, g0: 0.14, g1: 0.02 }));
    });
    a.bei(a.reise + 0.55, () => {
      saeule(a.ziel, { farbe: [1.1, 0.55, 1.0], r: 1.5, h: 11, dauer: 1.5 });
      const m = a.mitte(0.5);
      for (let i = 0; i < 220; i++) {
        const r = P().randomDirection(); r.y = Math.abs(r.y) * 3 + 1;
        leucht.wurf(m, r.normalize().multiplyScalar(zufall(3, 8)), { farbe: wahl(FEE), dauer: zufall(1.0, 1.8), g0: zufall(0.12, 0.22), g1: 0.02, zug: 1.2, schwer: 2.5 });
      }
      strom(1.4, 50, (t) => leucht.wurf(a.ziel.clone().addScaledVector(kreis(t * 12 + Math.random() * 0.5), 0.9).setY((t * H * 1.6) % (H * 1.6)), P(0, 1, 0), { farbe: wahl(FEE), dauer: 0.7, g0: 0.16, g1: 0.02 }));
      welle(a.ziel, { farbe: [2, 1.6, 0.5], r: 5.5, dauer: 0.8 });
      welle(a.ziel, { farbe: [2, 0.6, 1.6], r: 3.5, dauer: 0.6 });
      aufblitzen(a.mitte(H + 0.2), 0xff90e0, 150);
      a.opfer.blitz = 1;
      ruetteln(0.2);
    });
    a.bei(a.reise + 2.2, a.loesen);
    a.ende = a.reise + 2.9;
  }

  // 🌪 Wind: Windsicheln fliegen gefächert, Luftschlieren, Staub und Blätter; ein Wirbelsturm hebt das Opfer an und dreht es
  const sichelGeo = new THREE.TorusGeometry(0.55, 0.035, 6, 28, Math.PI * 0.9);
  const bandGeo = new THREE.TorusGeometry(1, 0.03, 4, 40, 1.8).rotateX(Math.PI / 2);
  const truemmerGeo = new THREE.DodecahedronGeometry(0.08);
  wegwerfen.push(sichelGeo, bandGeo, truemmerGeo);
  const luftMat = (opacity: number) => new THREE.MeshBasicMaterial({ color: new THREE.Color(...LUFT), transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  function planWind(a: Angriff) {
    const H = a.opfer.hoehe;
    for (const [k, quer] of [[0, -0.7], [1, 0], [2, 0.7]] as const) { // drei Windsicheln, leicht versetzt
      a.bei(k * 0.08, () => {
        const flieger = new THREE.Group(), mat = luftMat(0.85), sichel = new THREE.Mesh(sichelGeo, mat);
        flieger.add(sichel);
        scene.add(flieger);
        const von = a.start.clone().setY(1.0).addScaledVector(a.seite, quer * 0.4), nach = a.mitte().addScaledVector(a.seite, quer * 0.5);
        let rest = 0;
        ablauf(a.reise, (t, f, dt) => {
          flieger.position.lerpVectors(von, nach, f);
          flieger.lookAt(nach.x + a.dir.x, nach.y, nach.z + a.dir.z);
          sichel.rotation.z = t * 22 + k;
          sichel.scale.setScalar(0.8 + f * 0.6);
          rest += dt * 60;
          while (rest >= 1) {
            rest--;
            leucht.wurf(flieger.position.clone().add(P().randomDirection().multiplyScalar(0.3)), a.dir.clone().multiplyScalar(-1), { farbe: LUFT, dauer: 0.35, g0: 0.25, g1: 0.05, alpha: 0.35 });
          }
        }, () => entfernen(flieger, mat));
      });
    }
    a.spur(0.3, (s, f, t, p) => {
      for (let k = 0; k < 3; k++) // Luftschlieren: schnelle, kurze Streifen in Flugrichtung
        leucht.wurf(a.punkt(s, zufall(-1, 1) * (0.3 + f), zufall(0.3, 1.8)), a.dir.clone().multiplyScalar(zufall(7, 11)), { farbe: LUFT, dauer: 0.25, g0: 0.14, g1: 0.04, alpha: 0.5 });
      staub(p.clone().setY(0.1), { vel: a.dir.clone().multiplyScalar(zufall(2, 4)).addScaledVector(a.seite, zufall(-1, 1)).setY(zufall(0.3, 1)), g0: 0.4, g1: 1.6, alpha: 0.35 });
      if (Math.random() < 0.6) blatt(p.clone().setY(0.3), a.dir.clone().multiplyScalar(zufall(3, 5)).setY(zufall(1, 2)), 0.13);
    });
    a.bei(a.reise, () => {
      a.treffer({ tint: 0xd8f0ff, staerke: 0.3, blitz: [1.2, 1.4, 1.5], stoss: 0.7, dir: a.dir });
      welle(a.ziel, { farbe: LUFT, r: 3.5, dauer: 0.4, y: a.mitteY });
      ruetteln(0.3);
    });
    a.bei(a.finale, () => { // Wirbelsturm
      const DAUER = 1.8, baender: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; y: number; phase: number; tempo: number }[] = [];
      const gruppe = new THREE.Group();
      gruppe.position.copy(a.ziel);
      scene.add(gruppe);
      for (let i = 0; i < 16; i++) {
        const mat = luftMat(0), mesh = new THREE.Mesh(bandGeo, mat);
        gruppe.add(mesh);
        baender.push({ mesh, mat, y: (i / 15) * H * 2.2, phase: Math.random() * 6.28, tempo: zufall(6, 10) });
      }
      const truemmer = Array.from({ length: 18 }, () => {
        const m = new THREE.Mesh(truemmerGeo, MAT.stein);
        gruppe.add(m);
        return { m, w: Math.random() * 6.28, y: zufall(0, H), r: zufall(0.6, 1.3), tempo: zufall(5, 9), dreh: P().randomDirection() };
      });
      const start = a.opfer.dreh;
      ablauf(DAUER, (t, k, dt) => {
        const auf = Math.min(1, t / 0.3), ab = t > DAUER - 0.35 ? (DAUER - t) / 0.35 : 1;
        for (const b of baender) {
          const sichtbar = b.y <= auf * H * 2.2 ? 1 : 0, r = (0.45 + b.y * 0.35) * (1 + (1 - ab) * 1.5);
          b.mesh.position.y = b.y + Math.sin(t * 3 + b.phase) * 0.08;
          b.mesh.rotation.y = b.phase + t * b.tempo;
          b.mesh.scale.set(r, 1, r);
          b.mat.opacity = 0.55 * sichtbar * ab * zufall(0.7, 1);
        }
        for (const s of truemmer) {
          s.w += s.tempo * dt; s.y += dt * 1.2;
          if (s.y > H * 2) s.y = 0.1;
          s.m.position.set(Math.cos(s.w) * s.r * (1 + s.y * 0.2), s.y, Math.sin(s.w) * s.r * (1 + s.y * 0.2));
          s.m.rotateOnAxis(s.dreh, dt * 8);
          s.m.visible = ab > 0.05;
        }
        if (Math.random() < 0.7) staub(a.ziel.clone().add(kreis(Math.random() * 6.28).multiplyScalar(zufall(0.6, 1.4))).setY(0.1), { vel: P(zufall(-1, 1), zufall(1, 2.5), zufall(-1, 1)), g0: 0.5, g1: 1.8, alpha: 0.35 });
        a.opfer.stoss.set(0, (0.6 + Math.sin(t * 5) * 0.1) * ab * Math.min(1, t * 4), 0); // angehoben
        a.opfer.dreh = start + t * 14 * ab;
      }, () => {
        a.opfer.dreh = start;
        entfernen(gruppe, ...baender.map((b) => b.mat));
        welle(a.ziel, { farbe: LUFT, r: 6, dauer: 0.6 });
        for (let i = 0; i < 50; i++) staub(a.ziel.clone().setY(zufall(0.2, 0.8)), { vel: kreis(Math.random() * 6.28).multiplyScalar(zufall(3, 6)).setY(zufall(0.1, 0.4)), g0: 0.8, g1: 3, alpha: 0.45, zug: 2.2 });
        a.treffer({ tint: 0xd8f0ff, staerke: 0.3, blitz: [1.2, 1.4, 1.5], stoss: 0.3, dir: a.dir });
        ruetteln(0.4);
      });
      ruetteln(0.35);
    });
    a.bei(a.finale + 2.0, a.loesen);
    a.ende = a.finale + 2.7;
  }

  // ---------- Klassen-Elemente: Schall (Rapper/Rocker), Licht (Priester), Klingen (Krieger), Arkan (Magier) ----------
  /** Zeichenfläche → Textur (weiß gemalt; gefärbt wird im Material) */
  function zeichne(groesse: number, malen: (g: CanvasRenderingContext2D, s: number) => void) {
    const c = document.createElement("canvas");
    c.width = c.height = groesse;
    const g = c.getContext("2d")!;
    g.strokeStyle = g.fillStyle = "#fff"; g.lineCap = "round"; g.lineJoin = "round";
    malen(g, groesse);
    const t = new THREE.CanvasTexture(c);
    wegwerfen.push(t);
    return t;
  }
  /** Rune aus Strichen: Stamm mit ein, zwei Ästen und manchmal einem Haken */
  function rune(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
    g.beginPath();
    g.moveTo(x, y - r); g.lineTo(x, y + r);
    for (let k = 0; k < 1 + Math.floor(Math.random() * 2); k++) {
      const sy = y - r + Math.random() * r * 1.2, s = Math.random() < 0.5 ? -1 : 1;
      g.moveTo(x, sy); g.lineTo(x + s * r * 0.7, sy + r * zufall(0.3, 0.7));
    }
    if (Math.random() < 0.5) { g.moveTo(x - r * 0.5, y + r * 0.4); g.lineTo(x, y + r * 0.1); g.lineTo(x + r * 0.5, y + r * 0.4); }
    g.stroke();
  }
  const RUNENKREIS = zeichne(512, (g, s) => {
    const m = s / 2, ring = (r: number) => { g.beginPath(); g.arc(m, m, r, 0, Math.PI * 2); g.stroke(); };
    g.lineWidth = 7; ring(m * 0.95);
    g.lineWidth = 3; ring(m * 0.86); ring(m * 0.6); ring(m * 0.52);
    g.lineWidth = 4; g.beginPath(); // Siebenstern
    for (let i = 0; i <= 7; i++) { const w = (i * 3 * Math.PI * 2) / 7 - Math.PI / 2, x = m + Math.cos(w) * m * 0.52, y = m + Math.sin(w) * m * 0.52; if (i) g.lineTo(x, y); else g.moveTo(x, y); }
    g.stroke();
    for (let i = 0; i < 16; i++) { const w = (i / 16) * Math.PI * 2; rune(g, m + Math.cos(w) * m * 0.73, m + Math.sin(w) * m * 0.73, m * 0.06); }
    g.lineWidth = 2;
    for (let i = 0; i < 64; i++) { const w = (i / 64) * Math.PI * 2; g.beginPath(); g.moveTo(m + Math.cos(w) * m * 0.88, m + Math.sin(w) * m * 0.88); g.lineTo(m + Math.cos(w) * m * 0.92, m + Math.sin(w) * m * 0.92); g.stroke(); }
  });
  const GLYPHEN = Array.from({ length: 6 }, () => zeichne(64, (g, s) => { g.lineWidth = 5; rune(g, s / 2, s / 2, s * 0.32); }));
  const NOTEN = [
    zeichne(64, (g) => { g.beginPath(); g.ellipse(22, 46, 11, 8, -0.4, 0, Math.PI * 2); g.fill(); g.lineWidth = 5; g.beginPath(); g.moveTo(32, 44); g.lineTo(32, 8); g.quadraticCurveTo(44, 16, 50, 30); g.stroke(); }),
    zeichne(64, (g) => {
      for (const [x, y] of [[16, 48], [44, 42]]) { g.beginPath(); g.ellipse(x, y, 9, 7, -0.4, 0, Math.PI * 2); g.fill(); }
      g.lineWidth = 5; g.beginPath(); g.moveTo(24, 46); g.lineTo(24, 12); g.moveTo(52, 40); g.lineTo(52, 6); g.stroke();
      g.lineWidth = 8; g.beginPath(); g.moveTo(24, 14); g.lineTo(52, 8); g.stroke();
    }),
  ];
  /** Leuchtendes, additives Material (Farbe linear, über 1 = Bloom) */
  const glanz = (farbe: Rgb, opacity = 1, map?: THREE.Texture) =>
    new THREE.MeshBasicMaterial({ color: new THREE.Color(...farbe), map, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  /** Leuchtende Hülle: hell am Rand, innen fast durchsichtig */
  const schaleMat = (farbe: Rgb) => new THREE.ShaderMaterial({
    uniforms: { uFarbe: { value: new THREE.Color(...farbe) }, uA: { value: 1 } },
    vertexShader: `varying vec3 vN; varying vec3 vV;
      void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uFarbe; uniform float uA; varying vec3 vN; varying vec3 vV;
      void main() { float f = 1.0 - abs(dot(normalize(vN), normalize(vV))); gl_FragColor = vec4(uFarbe * (pow(f, 2.5) * 1.5 + 0.05), uA * (pow(f, 2.0) + 0.1)); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  /** Fliegendes Bildchen (Note, Glyphe) */
  function bildchen(tex: THREE.Texture, p: V3, { farbe, groesse = 0.35, dauer = 1.2, vel = P(0, 1, 0), drehen = 0, schwer = 0 }: { farbe: Rgb; groesse?: number; dauer?: number; vel?: V3; drehen?: number; schwer?: number }) {
    const mat = new THREE.SpriteMaterial({ map: tex, color: new THREE.Color(...farbe), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 });
    const sp = new THREE.Sprite(mat), v0 = vel.clone();
    sp.position.copy(p);
    scene.add(sp);
    ablauf(dauer, (t, k, dt) => {
      v0.y -= schwer * dt;
      sp.position.addScaledVector(v0, dt);
      sp.position.x += Math.sin(t * 6) * 0.01;
      mat.rotation += drehen * dt;
      mat.opacity = Math.min(1, k * 6) * (1 - k);
      sp.scale.setScalar(groesse * (0.7 + 0.5 * Math.min(1, k * 4)));
    }, () => entfernen(sp, mat));
  }
  /** Drehender Runenkreis am Boden */
  function runenkreis(mitte: V3, { farbe, r = 2.5, dauer = 2, dreh = 0.6, y = 0.02, verz = 0 }: { farbe: Rgb; r?: number; dauer?: number; dreh?: number; y?: number; verz?: number }) {
    const mat = glanz(farbe, 0, RUNENKREIS), m = new THREE.Mesh(scheibenGeo, mat);
    m.position.set(mitte.x, y, mitte.z);
    m.renderOrder = 1;
    m.scale.setScalar(0.001);
    scene.add(m);
    ablauf(dauer, (t) => {
      const auf = easeOutBack(Math.min(1, t / 0.35)), ab = t > dauer - 0.4 ? (dauer - t) / 0.4 : 1;
      m.scale.setScalar(Math.max(0.001, 2 * r * auf));
      m.rotation.y = t * dreh;
      mat.opacity = 0.9 * ab;
    }, () => entfernen(m, mat), verz);
  }

  // 🔊 Schall: Schallringe fliegen zum Opfer, EQ-Balken pumpen am Weg, Lautsprecher, Noten; vier Bass-Schläge lassen das Opfer im Takt springen
  const NEON: Rgb[] = [[2.2, 0.4, 1.8], [0.3, 1.6, 2.2], [1.8, 1.6, 0.3]];
  const schallRingGeo = new THREE.TorusGeometry(0.5, 0.03, 6, 40);
  const balkenGeo = new THREE.BoxGeometry(0.16, 1, 0.16).translate(0, 0.5, 0);
  wegwerfen.push(schallRingGeo, balkenGeo);
  function schallwelle(von: V3, nach: V3, farbe: Rgb, dauer: number) {
    const mat = glanz(farbe, 0), m = new THREE.Mesh(schallRingGeo, mat);
    m.position.copy(von);
    m.lookAt(nach);
    scene.add(m);
    ablauf(dauer, (t, k) => { m.position.lerpVectors(von, nach, k); m.scale.setScalar(0.6 + k * 2.2); mat.opacity = Math.sin(Math.PI * k) * 0.9; }, () => entfernen(m, mat));
  }
  function eqBalken(fuss: V3, farbe: Rgb, hoehe: number, dauer: number, takt: number, verz = 0) {
    const mat = glanz(farbe.map((c) => c * 0.5) as Rgb, 0.55), m = new THREE.Mesh(balkenGeo, mat), phase = Math.random() * 6.28;
    m.position.copy(fuss).setY(0);
    m.scale.set(1, 0.01, 1);
    scene.add(m);
    ablauf(dauer, (t) => {
      const auf = Math.min(1, t / 0.15), ab = t > dauer - 0.3 ? (dauer - t) / 0.3 : 1;
      m.scale.y = Math.max(0.01, hoehe * auf * ab * (0.25 + 0.75 * Math.abs(Math.sin(t * takt + phase))));
    }, () => entfernen(m, mat), verz);
  }
  const note = (p: V3, farbe: Rgb, vel = P(zufall(-0.3, 0.3), zufall(0.8, 1.5), zufall(-0.3, 0.3))) =>
    bildchen(wahl(NOTEN), p, { farbe, groesse: zufall(0.3, 0.45), dauer: zufall(1, 1.5), vel, drehen: zufall(-1.5, 1.5) });
  function lautsprecher(fuss: V3, blick: V3, farbe: Rgb, dauer: number, takt: number) {
    const g = new THREE.Group(), membranen: THREE.Object3D[] = [];
    const kasten = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.1, 0.55), new THREE.MeshStandardMaterial({ color: 0x15151c, roughness: 0.6 }));
    kasten.position.y = 0.55;
    g.add(kasten);
    for (const [y, r] of [[0.8, 0.2], [0.35, 0.26]]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.035, 8, 24), glanz(farbe, 0.9));
      const kern = new THREE.Mesh(new THREE.CircleGeometry(r * 0.85, 24), new THREE.MeshStandardMaterial({ color: 0x2a2a33, roughness: 0.4, metalness: 0.3 }));
      ring.position.set(0, y, 0.28); kern.position.set(0, y, 0.279);
      g.add(ring, kern);
      membranen.push(ring, kern);
    }
    g.position.copy(fuss).setY(0);
    g.lookAt(blick.x, 0, blick.z);
    g.scale.setScalar(0.001);
    scene.add(g);
    ablauf(dauer, (t) => {
      const auf = easeOutBack(Math.min(1, t / 0.3)), ab = t > dauer - 0.3 ? (dauer - t) / 0.3 : 1, schlag = Math.max(0, Math.sin(t * takt)) ** 8;
      g.scale.setScalar(Math.max(0.001, auf * ab * (1 + schlag * 0.08)));
      for (const mm of membranen) mm.scale.setScalar(1 + schlag * 0.25);
    }, () => {
      scene.remove(g);
      g.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose(); (m.material as THREE.Material | undefined)?.dispose(); });
    });
  }
  function planSchall(a: Angriff) {
    const TAKT = 0.26, puls = Math.PI / TAKT, H = a.opfer.hoehe;
    for (let i = 0; i < 6; i++) a.bei(i * (a.reise / 6), () => schallwelle(a.start.clone().setY(1.2), a.mitte(), NEON[i % 3], a.reise * 0.9));
    a.spur(0.5, (s, f, t) => {
      const breite = 0.3 + f * 1.1;
      for (const seite of [-1, 1]) eqBalken(a.punkt(s, seite * breite * zufall(0.5, 1)), wahl(NEON), 0.4 + f * 1.2, a.finale + 1.6 - t, puls);
      if (Math.random() < 0.6) note(a.punkt(s, zufall(-0.5, 0.5), zufall(0.6, 1.4)), wahl(NEON));
    });
    a.bei(a.reise, () => {
      a.treffer({ tint: 0xf0c0ff, staerke: 0.35, blitz: [1.8, 0.6, 1.6], stoss: 0.3, dir: a.dir });
      for (const s of [-1, 1]) lautsprecher(a.ziel.clone().addScaledVector(a.seite, s * 1.7).addScaledVector(a.dir, 0.3), a.start, NEON[s < 0 ? 0 : 1], 2.6, puls);
      for (let i = 0; i < 18; i++) eqBalken(a.ziel.clone().addScaledVector(kreis((i / 18) * Math.PI * 2), 2.3), NEON[i % 3], zufall(0.8, 1.8), 2.4, puls, i * 0.02);
    });
    for (let b = 0; b < 4; b++) a.bei(a.reise + 0.3 + b * TAKT * 2, () => { // Bass-Drop
      const st = b === 3 ? 2 : 1, m = a.mitte();
      welle(a.ziel, { farbe: NEON[b % 3], r: 3.5 * st, dauer: 0.45 });
      welle(a.ziel, { farbe: NEON[(b + 1) % 3], r: 2.5 * st, dauer: 0.4, y: a.mitteY });
      for (let i = 0; i < 3 * st; i++) note(m.clone().add(P().randomDirection().multiplyScalar(0.5)), wahl(NEON), P().randomDirection().multiplyScalar(zufall(1.5, 3)).setY(zufall(0.5, 2.5)));
      for (let i = 0; i < 25 * st; i++) leucht.wurf(m, P().randomDirection().multiplyScalar(zufall(2, 6) * st), { farbe: wahl(NEON), dauer: 0.5, g0: 0.12, g1: 0.02, zug: 3 });
      if (st > 1) {
        scheibe(a.ziel, { farbe: 0xff40d0, groesse: 6, alpha: 0.6, halten: 0.3, wachs: 0.1 });
        risse(a.ziel, { farbe: 0xd060ff, glanz: 1, halten: 1.2 });
        for (let i = 0; i < 40; i++) leucht.wurf(a.ziel.clone().setY(zufall(0.2, H)), kreis(Math.random() * 6.28).multiplyScalar(zufall(3, 6)), { farbe: wahl(NEON), dauer: 0.7, g0: 0.5, g1: 1.6, alpha: 0.18, zug: 2.5 });
      }
      a.opfer.stoss.set(a.dir.x * 0.15 * st, 0.35 * st, a.dir.z * 0.15 * st); // springt im Takt
      a.opfer.blitz = 0.8;
      aufblitzen(m, 0xff60e0, 60 * st);
      ruetteln(0.25 * st);
    });
    a.bei(a.reise + 2.4, a.loesen);
    a.ende = a.reise + 2.9;
  }

  // ✨ Licht: leuchtende Runen und Lichtsäulen am Weg, Runenkreise, fünf Strahlen schlagen ein, Lichtsäule mit Strahlenkranz, Heiligenschein und Lichtregen
  const GOLD: Rgb = [2.2, 1.7, 0.7], WEISSGOLD: Rgb = [2.4, 2.2, 1.6];
  const strahlGeo = new THREE.PlaneGeometry(0.12, 1).translate(0, 0.5, 0);
  const scheinGeo = new THREE.TorusGeometry(0.6, 0.05, 8, 40);
  wegwerfen.push(strahlGeo, scheinGeo);
  function planLicht(a: Angriff) {
    const H = a.opfer.hoehe;
    a.bei(0, () => runenkreis(a.start, { farbe: GOLD, r: 1.1, dauer: a.reise + 0.6, dreh: 1.2 }));
    a.spur(0.45, (s, f, t) => {
      const p = a.punkt(s, zufall(-0.4, 0.4) * (0.4 + f));
      runenkreis(p, { farbe: GOLD, r: 0.35 + f * 0.4, dauer: a.finale + 1.2 - t, dreh: 2 });
      if (Math.random() < 0.3) saeule(p, { farbe: [1.2, 0.9, 0.4], r: 0.12 + f * 0.1, h: 4, dauer: 0.5 });
      for (let k = 0; k < 6; k++) leucht.wurf(p.clone().setY(zufall(0.2, 2)), P(zufall(-0.2, 0.2), zufall(0.3, 1), zufall(-0.2, 0.2)), { farbe: WEISSGOLD, dauer: zufall(0.6, 1.2), g0: 0.1, g1: 0.02 });
    });
    a.bei(a.reise, () => {
      a.treffer({ tint: 0xfff3c0, staerke: 0.45, blitz: [2.4, 2.1, 1.4], stoss: 0.2, dir: a.dir });
      runenkreis(a.ziel, { farbe: GOLD, r: 2.6, dauer: 2.4, dreh: 0.5 });
      runenkreis(a.ziel, { farbe: WEISSGOLD, r: 1.7, dauer: 2.3, dreh: -0.9, y: 0.03 });
      for (let i = 0; i < 5; i++) { // fünf Lichtstrahlen schlagen im Kreis ein
        const p = a.ziel.clone().addScaledVector(kreis((i / 5) * Math.PI * 2), 1.7);
        ablauf(0.01, () => {
          saeule(p, { farbe: GOLD, r: 0.2, h: 12, dauer: 0.5 });
          scheibe(p, { farbe: 0xffe08a, groesse: 1.4, alpha: 0.8, halten: 0.3, wachs: 0.1 });
          for (let k = 0; k < 15; k++) leucht.wurf(p.clone().setY(0.2), P().randomDirection().multiplyScalar(zufall(1, 3)).setY(zufall(0.5, 2)), { farbe: GOLD, dauer: 0.6, g0: 0.1, g1: 0.02, schwer: 2 });
          ruetteln(0.12);
        }, null, i * 0.09);
      }
    });
    a.bei(a.reise + 0.55, () => {
      const m = a.mitte();
      saeule(a.ziel, { farbe: [1.4, 1.1, 0.5], r: 1.1, h: 14, dauer: 1.3 });
      const scheinMat = glanz(GOLD, 0), schein = new THREE.Mesh(scheinGeo, scheinMat);
      schein.rotation.x = Math.PI / 2;
      schein.position.copy(a.mitte(H + 0.5));
      scene.add(schein);
      ablauf(1.6, (t) => {
        schein.scale.setScalar(Math.max(0.001, easeOutBack(Math.min(1, t / 0.3)) * (1 + t * 0.3)));
        scheinMat.opacity = t > 1.2 ? (1.6 - t) / 0.4 : 1;
        schein.rotation.z = t * 2;
      }, () => entfernen(schein, scheinMat));
      for (let i = 0; i < 16; i++) { // Strahlenkranz
        const mat = glanz(WEISSGOLD, 0), st = new THREE.Mesh(strahlGeo, mat), l = zufall(2.5, 4.5);
        st.position.copy(m);
        st.rotation.set(0, Math.random() * Math.PI, (i / 16) * Math.PI * 2);
        scene.add(st);
        ablauf(0.9, (t, k) => { st.scale.set(1 + k, l * easeOutCubic(Math.min(1, k * 3)), 1); mat.opacity = 0.7 * (1 - k); }, () => entfernen(st, mat));
      }
      for (let i = 0; i < 160; i++) leucht.wurf(m, P().randomDirection().multiplyScalar(zufall(2, 7)), { farbe: wahl([GOLD, WEISSGOLD]), dauer: zufall(0.6, 1.3), g0: 0.14, g1: 0.02, zug: 2 });
      strom(1.4, 60, () => leucht.wurf(a.ziel.clone().add(P(zufall(-2, 2), zufall(3, 5), zufall(-2, 2))), P(0, -zufall(1, 2), 0), { farbe: GOLD, dauer: 1.6, g0: 0.1, g1: 0.04 })); // Lichtregen
      welle(a.ziel, { farbe: GOLD, r: 6, dauer: 0.7 });
      aufblitzen(a.mitte(H), 0xffe8a0, 200);
      a.treffer({ tint: 0xfff3c0, staerke: 0.6, blitz: [3, 2.7, 1.8], stoss: 0.35, dir: a.dir });
      ruetteln(0.4);
    });
    a.bei(a.reise + 2.2, a.loesen);
    a.ende = a.reise + 2.8;
  }

  // ⚔ Klingen: Schwerter regnen fächernd entlang des Wegs, ein Schwertkreis um das Opfer, Kreuzhieb, ein Riesenschwert schlägt dahinter ein
  const stahlMat = mitRand(new THREE.MeshStandardMaterial({ color: 0xd6dde6, metalness: 0.9, roughness: 0.22, envMap: umgebung, envMapIntensity: 1.4 }), [0.8, 0.9, 1.0], 0.6);
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xd4a017, metalness: 0.8, roughness: 0.3, envMap: umgebung });
  const griffMat = new THREE.MeshStandardMaterial({ color: 0x4a2a14, roughness: 0.8 });
  const SCHWERT: [THREE.BufferGeometry, THREE.Material][] = [
    [new THREE.ConeGeometry(0.07, 0.25, 4).rotateX(Math.PI).translate(0, 0.125, 0).scale(1, 1, 0.3), stahlMat], // Spitze unten bei y = 0
    [new THREE.CylinderGeometry(0.07, 0.07, 1.0, 4).translate(0, 0.75, 0).scale(1, 1, 0.3), stahlMat],
    [new THREE.BoxGeometry(0.42, 0.06, 0.09).translate(0, 1.28, 0), goldMat],
    [new THREE.CylinderGeometry(0.03, 0.03, 0.24, 8).translate(0, 1.43, 0), griffMat],
    [new THREE.SphereGeometry(0.05, 10, 8).translate(0, 1.58, 0), goldMat],
  ];
  const hiebGeo = new THREE.TorusGeometry(1.1, 0.045, 6, 48, 2.4);
  wegwerfen.push(goldMat, griffMat, hiebGeo, ...SCHWERT.map(([g]) => g));
  function einschlag(p: V3, st: number) {
    for (let i = 0; i < 14 * st; i++) leucht.wurf(p.clone().setY(0.05), P().randomDirection().multiplyScalar(zufall(1.5, 4) * Math.sqrt(st)).setY(zufall(1, 3)), { farbe: [2.4, 1.6, 0.6], farbe2: [1.2, 0.3, 0.05], dauer: zufall(0.3, 0.6), g0: 0.07, g1: 0.02, schwer: 9 });
    for (let i = 0; i < 2 * st; i++) staub(p.clone().setY(0.1), { g0: 0.4 * st, g1: 1.2 * st, alpha: 0.4 });
    for (let i = 0; i < 2 * st; i++) kiesel.wurf(p.clone().setY(0.1), P().randomDirection().multiplyScalar(1.5).setY(zufall(2, 4)), zufall(0.4, 0.9), 1, wahl(STEINE));
    scheibe(p, { farbe: 0x000000, additiv: false, alpha: 0.5, groesse: 0.5 * st, halten: 1.5, wachs: 0.05 });
    ruetteln(0.08 * st);
  }
  /** Ein Schwert fällt von oben und bleibt mit der Spitze im Boden stecken, zerspringt am Ende */
  function schwert(ziel: V3, { groesse = 1, verz = 0, neigung = 0.25, halten = 1.5, fallHoehe = 7, staerke = 1 }: { groesse?: number; verz?: number; neigung?: number; halten?: number; fallHoehe?: number; staerke?: number }) {
    const g = new THREE.Group();
    for (const [geo, mat] of SCHWERT) g.add(new THREE.Mesh(geo, mat));
    g.scale.setScalar(groesse);
    const rx = zufall(-neigung, neigung), rz = zufall(-neigung, neigung);
    g.rotation.set(rx, Math.random() * 6.28, rz);
    const oben = ziel.clone().setY(fallHoehe), unten = ziel.clone().setY(-0.25 * groesse);
    g.position.copy(oben);
    g.visible = false;
    scene.add(g);
    const FALL = 0.18;
    let eingeschlagen = false, zerbrochen = false;
    ablauf(FALL + halten + 0.25, (t) => {
      g.visible = true;
      if (t < FALL) { g.position.lerpVectors(oben, unten, (t / FALL) ** 2); return; }
      if (!eingeschlagen) { eingeschlagen = true; g.position.copy(unten); einschlag(ziel, staerke * groesse); }
      const w = t - FALL, z = w - halten;
      g.rotation.x = rx + Math.sin(w * 40) * 0.05 * Math.exp(-w * 6); // federt nach
      if (z > 0) {
        if (!zerbrochen) {
          zerbrochen = true;
          for (let i = 0; i < 6 * groesse; i++) splitter.wurf(ziel.clone().setY(zufall(0, 1.5 * groesse)), P().randomDirection().multiplyScalar(zufall(1, 3)).setY(zufall(1, 3)), zufall(0.6, 1.2), zufall(0.6, 1), 0xd6dde6);
        }
        g.scale.setScalar(groesse * Math.max(0.001, 1 - z / 0.25));
      }
    }, () => scene.remove(g), verz);
  }
  /** Leuchtender Hieb quer über das Opfer */
  function hieb(a: Angriff, winkel: number) {
    const mat = glanz([2.4, 2.6, 3.0], 0), m = new THREE.Mesh(hiebGeo, mat);
    m.position.copy(a.mitte());
    m.lookAt(a.mitte().add(a.dir));
    m.rotateZ(Math.PI / 2 - 1.2 + winkel);
    scene.add(m);
    ablauf(0.35, (t, k) => { m.scale.setScalar(0.6 + 0.6 * easeOutCubic(k)); mat.opacity = (1 - k) ** 1.5; }, () => entfernen(m, mat));
  }
  function planKlingen(a: Angriff) {
    a.spur(0.4, (s, f, t) => {
      const breite = 0.2 + f * 1.0;
      for (let k = 0; k < 1 + Math.floor(f * 2 + Math.random()); k++)
        schwert(a.punkt(s, (Math.random() * 2 - 1) * breite), { groesse: 0.5 + f * 0.5, halten: a.finale + 1.1 - t, neigung: 0.3 });
    });
    a.bei(a.reise, () => {
      a.treffer({ tint: 0xc8d0dc, staerke: 0.35, blitz: [2, 2, 2.2], stoss: 0.3, dir: a.dir });
      for (let i = 0; i < 8; i++) schwert(a.ziel.clone().addScaledVector(kreis((i / 8) * Math.PI * 2 + 0.2), 1.5), { groesse: 1.1, verz: i * 0.04, halten: 1.6 - i * 0.04, neigung: 0.15 });
      risse(a.ziel, { farbe: 0xc8d8ff, glanz: 0.8, halten: 2 });
    });
    a.bei(a.reise + 0.5, () => { // Kreuzhieb
      for (const w of [0.7, -0.7]) hieb(a, w);
      const m = a.mitte();
      for (let i = 0; i < 40; i++) leucht.wurf(m, P().randomDirection().multiplyScalar(zufall(2, 6)), { farbe: [2.4, 2.2, 1.8], dauer: 0.4, g0: 0.08, g1: 0.02, zug: 3, schwer: 4 });
      aufblitzen(m, 0xdde8ff, 90);
      a.treffer({ tint: 0xc8d0dc, staerke: 0.4, blitz: [2.5, 2.5, 2.8], stoss: 0.35, dir: a.dir });
      ruetteln(0.3);
    });
    a.bei(a.reise + 0.85, () => schwert(a.ziel.clone().addScaledVector(a.dir, 0.9), { groesse: 3.2, halten: 1.1, neigung: 0.05, fallHoehe: 14, staerke: 1.2 })); // Riesenschwert
    a.bei(a.reise + 1.03, () => {
      const m = a.mitte(0.6);
      welle(a.ziel, { farbe: [1.6, 1.7, 2.0], r: 6, dauer: 0.6 });
      for (let i = 0; i < 90; i++) { v.randomDirection(); v.y = Math.abs(v.y) * 1.4 + 0.3; v.multiplyScalar(zufall(3, 8)); kiesel.wurf(m, v, zufall(0.6, 1.8), zufall(1, 1.6), wahl(STEINE)); }
      for (let i = 0; i < 40; i++) staub(a.ziel.clone().setY(zufall(0.2, 0.7)), { vel: kreis(Math.random() * 6.28).multiplyScalar(zufall(3, 6)).setY(zufall(0.1, 0.5)), g0: 0.8, g1: 2.8, alpha: 0.45, zug: 2.2 });
      aufblitzen(m, 0xdde8ff, 120);
      a.treffer({ tint: 0xc8d0dc, staerke: 0.5, blitz: [2.5, 2.5, 2.8], stoss: 0 });
      a.opfer.stoss.copy(a.dir).multiplyScalar(-0.45).setY(0.3);
      ruetteln(0.7);
    });
    a.bei(a.reise + 2.3, a.loesen);
    a.ende = a.reise + 2.8;
  }

  // 🔮 Arkan: Runenkreis am Täter, sieben Zaubergeschosse fliegen in Bögen zum Opfer, Runenkreise und kreisende Glyphen, arkane Explosion
  const ARKAN: Rgb[] = [[1.4, 0.4, 2.4], [0.4, 1.6, 2.4], [2.0, 0.9, 2.4]];
  const geschossGeo = new THREE.SphereGeometry(0.14, 16, 12), schaleGeo = new THREE.SphereGeometry(1, 40, 20);
  wegwerfen.push(geschossGeo, schaleGeo);
  function geschoss(a: Angriff, i: number, n: number, dauer: number) {
    const farbe = ARKAN[i % 3], mat = glanz(farbe, 1), m = new THREE.Mesh(geschossGeo, mat);
    scene.add(m);
    const von = a.start.clone().setY(1.5), nach = a.mitte().add(P(zufall(-0.3, 0.3), zufall(-0.3, 0.3), zufall(-0.3, 0.3)));
    const seitlich = (i / (n - 1) - 0.5) * 2;
    const kurve = new THREE.QuadraticBezierCurve3(von, a.punkt(a.L * 0.45, seitlich * 2.4, 1.5 + Math.abs(seitlich) * 1.2 + zufall(0, 1)), nach);
    let rest = 0;
    ablauf(dauer, (t, k, dt) => {
      kurve.getPoint(k, m.position);
      m.scale.setScalar(1 + Math.sin(t * 30) * 0.15);
      rest += dt * 90;
      while (rest >= 1) { rest--; leucht.wurf(m.position, P().randomDirection().multiplyScalar(0.3), { farbe, dauer: 0.45, g0: 0.22, g1: 0.02, alpha: 0.8 }); }
    }, () => {
      entfernen(m, mat);
      for (let j = 0; j < 30; j++) leucht.wurf(nach, P().randomDirection().multiplyScalar(zufall(1.5, 4)), { farbe, dauer: 0.5, g0: 0.14, g1: 0.02, zug: 3 });
      a.opfer.blitz = 0.8;
      a.opfer.stoss.copy(a.dir).multiplyScalar(0.15);
      ruetteln(0.1);
    });
  }
  function planArkan(a: Angriff) {
    const H = a.opfer.hoehe, N = 7, flug = a.reise * 1.4, ankunft = 0.05 + flug;
    a.bei(0, () => runenkreis(a.start, { farbe: ARKAN[0], r: 1.2, dauer: flug + 0.8, dreh: 1.5 }));
    for (let i = 0; i < N; i++) a.bei(0.05 + i * 0.07, () => geschoss(a, i, N, flug));
    a.bei(ankunft, () => {
      a.treffer({ tint: 0xc8a0ff, staerke: 0.45, blitz: [1.4, 0.6, 2.4], stoss: 0.2, dir: a.dir });
      runenkreis(a.ziel, { farbe: ARKAN[0], r: 2.6, dauer: 2.0, dreh: 0.8 });
      runenkreis(a.ziel, { farbe: ARKAN[1], r: 1.8, dauer: 1.9, dreh: -1.3, y: 0.03 });
      const glyphen = Array.from({ length: 10 }, (_, i) => {
        const mat = new THREE.SpriteMaterial({ map: GLYPHEN[i % GLYPHEN.length], color: new THREE.Color(...ARKAN[i % 3]), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 });
        const sp = new THREE.Sprite(mat);
        sp.scale.setScalar(0.45);
        scene.add(sp);
        return { sp, mat, w: (i / 10) * Math.PI * 2, y: zufall(0.2, H) };
      });
      ablauf(1.0, (t, k) => { // Glyphen kreisen enger und steigen auf
        for (const gl of glyphen) {
          const r = 1.4 - k * 0.9;
          gl.sp.position.set(a.ziel.x + Math.cos(gl.w + t * 4) * r, gl.y + t * 0.6, a.ziel.z + Math.sin(gl.w + t * 4) * r);
          gl.mat.opacity = Math.min(1, t * 4) * (1 - k * 0.5);
        }
      }, () => glyphen.forEach((gl) => entfernen(gl.sp, gl.mat)));
    });
    a.bei(ankunft + 1.0, () => { // arkane Explosion
      const m = a.mitte(), mat = schaleMat(ARKAN[1]), schale = new THREE.Mesh(schaleGeo, mat);
      schale.position.copy(m);
      scene.add(schale);
      ablauf(0.6, (t, k) => { schale.scale.setScalar(0.3 + 3.2 * easeOutCubic(k)); mat.uniforms.uA.value = 1 - k; }, () => entfernen(schale, mat));
      for (let i = 0; i < 220; i++) leucht.wurf(m, P().randomDirection().multiplyScalar(zufall(3, 9)), { farbe: wahl(ARKAN), farbe2: [0.2, 0.05, 0.5], dauer: zufall(0.5, 1.1), g0: 0.15, g1: 0.02, zug: 2.4 });
      welle(a.ziel, { farbe: ARKAN[0], r: 6.5, dauer: 0.6 });
      welle(a.ziel, { farbe: ARKAN[1], r: 4, dauer: 0.5, y: a.mitteY });
      aufblitzen(m, 0xb080ff, 180);
      a.treffer({ tint: 0xc8a0ff, staerke: 0.7, blitz: [1.8, 0.9, 2.8], stoss: 0.5, dir: a.dir });
      ruetteln(0.6);
    });
    a.bei(ankunft + 2.6, a.loesen);
    a.ende = ankunft + 3.0;
  }

  const PLAENE: Record<ElementId, Plan> = {
    eis: { licht: 0x5ab8ff, plan: planEis },
    feuer: { licht: 0xff7a20, plan: planFeuer },
    erde: { licht: 0xc08040, tempo: 1.3, plan: planErde },
    blitz: { licht: 0x9a90ff, tempo: 0.55, plan: planBlitz },
    pflanzen: { licht: 0x7adf40, plan: planPflanzen },
    dunkel: { licht: 0x8a40ff, tempo: 1.3, frontLicht: false, plan: planDunkel },
    gift: { licht: 0x7aff3a, tempo: 1.15, plan: planGift },
    blut: { licht: 0xff2030, plan: planBlut },
    schatten: { licht: 0x6a30d0, tempo: 1.2, frontLicht: false, plan: planSchatten },
    fee: { licht: 0xff7ae0, tempo: 1.2, plan: planFee },
    wind: { licht: 0xcfe8ff, tempo: 0.9, plan: planWind },
    schall: { licht: 0xff50e0, plan: planSchall },
    licht: { licht: 0xffe08a, tempo: 1.1, plan: planLicht },
    klingen: { licht: 0xdde8ff, plan: planKlingen },
    arkan: { licht: 0xa060ff, frontLicht: false, plan: planArkan },
  };

  return {
    /** Startet einen Angriff; gibt die Dauer in Sekunden zurück */
    angriff(el: ElementId, taeter: Figur, opfer: Figur) {
      const a = new Angriff(PLAENE[el], taeter, opfer);
      effekte.push(a);
      return a.ende;
    },
    /** Zerfall einer besiegten Figur: Funken und Rauch, die Figur sinkt weg */
    zerfall(f: Figur, farbe: Farbe = [1.2, 1.2, 1.6]) {
      const m = f.basis.clone().setY(f.hoehe * 0.5);
      for (let i = 0; i < 120; i++) leucht.wurf(m.clone().add(P().randomDirection().multiplyScalar(f.hoehe * 0.4)), P(zufall(-0.5, 0.5), zufall(1, 3), zufall(-0.5, 0.5)), { farbe, dauer: zufall(0.8, 1.6), g0: 0.12, g1: 0.02, zug: 1 });
      for (let i = 0; i < 40; i++) rauch.wurf(m.clone().setY(zufall(0.2, f.hoehe)), P(zufall(-1, 1), zufall(0.5, 1.5), zufall(-1, 1)), { farbe: [0.1, 0.1, 0.12], dauer: 2, g0: 0.8, g1: 2.5, alpha: 0.4, zug: 1 });
      ablauf(1.2, (t, k) => { f.basis.y = -f.hoehe * k * k; }, () => { f.gruppe.visible = false; });
    },
    update(dt: number) {
      for (let i = effekte.length - 1; i >= 0; i--) if (!effekte[i].update(dt)) effekte.splice(i, 1);
      for (const b of ALLE_BROCKEN) b.update(dt);
      rauch.update(dt); leucht.update(dt);
      blitzLicht.intensity *= Math.exp(-dt * 7);
      frontLicht.intensity *= Math.exp(-dt * 8);
      dunkel += (dunkelZiel - dunkel) * Math.min(1, dt * 3);
      wackel = Math.max(0, wackel - dt * 1.6);
    },
    /** Kamerawackeln (0..~0.75) und Abdunkeln (0..1) für die Bühne */
    get wackel() { return wackel; },
    get dunkel() { return dunkel; },
    /** Pixel pro Welteinheit in 1 m Abstand (für die Partikelgröße) */
    setzeSkala(px: number) { rauch.mat.uniforms.uSkala.value = leucht.mat.uniforms.uSkala.value = px; },
    dispose() {
      effekte.length = 0;
      for (const w of wegwerfen) w.dispose();
    },
  };
}
