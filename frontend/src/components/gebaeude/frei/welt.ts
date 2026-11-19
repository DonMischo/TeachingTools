/**
 * Die Welten der freien 3D-Ansicht — drei Kachelsätze auf derselben Karte:
 *
 *   gebaeude  Mauern, Türstürze, Lampen, Topfpflanzen (in den Farben aller Baustile)
 *   hoehle    Felsbrocken, Säulen, leuchtende Kristalle, Fackellicht
 *   wald      hohe Stämme mit Kronen, Büsche als Rand, Gras, Lichtung je Station
 *   garten    geschnittene Hecken, Kieswege, Rasenplätze, Beete, Teiche (Stil »garten«)
 *   winter    Tannen mit Schneekappen im Schnee · oase: Palmen, Sand, Sandstein · pilze: Leuchtpilze bei Nacht
 *
 * `baueLandschaft` baut alles, was sich nicht ändert (einmal je Abschnitt),
 * `baueOrte` die Stationen, das Tor und den Rückweg (neu bei jedem Fortschritt).
 * Ohne React.
 */
import * as THREE from "three";
import { DURCHGANG, PLATZ, WAND, WEG, ZELLE, feldMitte, istFrei, type FreiEbene, type FreiOrt, type KartenArt } from "@/lib/gebaeude/frei";
import type { Objekt } from "@/lib/gebaeude/objekte";
import { baueObjekt } from "../objekte3d";
import { felsGeometrie, musterMaterial, textur, zufallAus } from "../stoff";
import { bauwelt } from "./bauwelt";
import { pilzwaldLandschaft } from "./pilzwald";
import { FASSUNGEN, weltModelle, type ModellArt } from "./modelle";
import { AUSSEHEN, STILE, type RaumZustand, type Stil } from "../szene";

export type Welt = "gebaeude" | "hoehle" | "wald" | "garten" | "winter" | "oase" | "pilze";

/** Welcher Kachelsatz zu welchem Baustil gehört */
export function weltVon(stil: Stil): Welt {
  if (stil === "wald" || stil === "garten" || stil === "winter" || stil === "oase" || stil === "pilze") return stil;
  return AUSSEHEN[stil].organisch ? "hoehle" : "gebaeude";
}

/** Wälder und Höhle bekommen angenagte Karten; Gebäude und Garten bleiben gerade */
export function istOrganisch(stil: Stil): boolean {
  const w = weltVon(stil);
  return w !== "gebaeude" && w !== "garten";
}

/** Welcher Kartenbau zu welcher Welt passt: Lichtungen mit Pfaden im Wald, im Pilzwald dazu ein Bach */
export function kartenArt(stil: Stil): KartenArt {
  const w = weltVon(stil);
  return w === "pilze" ? "bach" : w === "wald" || w === "winter" || w === "oase" ? "lichtung" : istOrganisch(stil) ? "genagt" : "raster";
}

export interface Stimmung {
  himmelOben: number; himmelUnten: number;
  nebel: number; dichte: number;
  sonne: number; sonneStaerke: number; sonneVon: [number, number, number];
  /** Himmelslicht: Farbe von oben, Farbe von unten, Stärke */
  oben: number; unten: number; umgebung: number;
  /** Fackel über der Figur (0 = aus) */
  fackel: number;
  /** Farbe dieses Lichts (Vorgabe: warm wie eine Fackel) */
  fackelFarbe?: number;
  belichtung: number;
}

export interface Landschaft {
  gruppe: THREE.Group;
  stimmung: Stimmung;
  /** bis zu dieser Höhe versperren Wände der Kamera die Sicht (0 = gar nicht) */
  wandHoehe: number;
  /** je Bild aufrufen: bewegt, was in der Luft schwebt (Zeit in Sekunden) */
  takt?: (zeit: number) => void;
  /** je Bild mit dem Ort der Figur: z. B. die Fackeln in ihrer Nähe flackern lassen */
  lichter?: (x: number, z: number, zeit: number) => void;
  /** Bodenhöhe für die Figur (z. B. auf einer Brücke); ohne: überall 0 */
  hoehe?: (x: number, z: number) => number;
}

export const farbe = (hex: number) => new THREE.Color(hex);
export const css = (hex: number) => `#${hex.toString(16).padStart(6, "0")}`;
export const aus = <T,>(liste: T[], r: () => number) => liste[Math.floor(r() * liste.length)];

export interface Stueck { p: THREE.Vector3; s: THREE.Vector3; q?: THREE.Quaternion; f?: THREE.Color }

/** Viele gleiche Körper als eine InstancedMesh */
export function reihe(geo: THREE.BufferGeometry, mat: THREE.Material, stuecke: Stueck[], schatten = true): THREE.InstancedMesh {
  const m = new THREE.InstancedMesh(geo, mat, Math.max(1, stuecke.length));
  m.count = stuecke.length;
  const mx = new THREE.Matrix4(), q0 = new THREE.Quaternion();
  stuecke.forEach((t, i) => {
    mx.compose(t.p, t.q ?? q0, t.s);
    m.setMatrixAt(i, mx);
    if (t.f) m.setColorAt(i, t.f);
  });
  m.castShadow = schatten;
  m.receiveShadow = true;
  // die Teile liegen über die ganze Karte verstreut
  m.frustumCulled = false;
  return m;
}

const wuerfel = new THREE.BoxGeometry(1, 1, 1);
wuerfel.userData.geteilt = true;

/**
 * Stellt Blender-Modelle (modelle.ts) auf: je Teil eine InstancedMesh, je Stück eine Farbe pro Teil.
 * `setze` gibt false zurück, solange die Modelle nicht geladen sind — dann baut der Aufrufer die Form selbst.
 */
function modellSetzer(r: () => number) {
  const M = weltModelle();
  const platziert = new Map<string, Stueck[]>();
  /** `schmal`: je Teil ein Faktor für die Breite (schlankere Stämme bei gleicher Krone) */
  const setze = (art: ModellArt, p: THREE.Vector3, s: THREE.Vector3, q: THREE.Quaternion, farben: Record<string, THREE.Color>, schmal: Record<string, number> = {}): boolean => {
    if (!M) return false;
    const name = `${art}${1 + Math.floor(r() * FASSUNGEN[art])}`;
    if (!Object.keys(farben).some(teil => M[`${name}_${teil}`])) return false;
    for (const [teil, f] of Object.entries(farben)) {
      const k = `${name}_${teil}`;
      if (!M[k]) continue;
      let liste = platziert.get(k);
      if (!liste) platziert.set(k, liste = []);
      const k2 = schmal[teil] ?? 1;
      liste.push({ p, s: k2 === 1 ? s : new THREE.Vector3(s.x * k2, s.y, s.z * k2), q, f });
    }
    return true;
  };
  /** alles Aufgestellte in die Gruppe */
  const fertig = (g: THREE.Group, schatten = true) => {
    for (const [k, liste] of platziert) {
      g.add(reihe(M![k], new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true }), liste, schatten));
    }
  };
  return { da: !!M, setze, fertig };
}

let stamm: THREE.BufferGeometry | null = null;
/** Baumstamm: unten breiter, leicht krumm, Fuß bei y = 0, Höhe 1 */
function stammGeometrie(): THREE.BufferGeometry {
  if (stamm) return stamm;
  const g = new THREE.CylinderGeometry(0.62, 1, 1, 7, 5);
  g.translate(0, 0.5, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    p.setX(i, p.getX(i) + Math.sin(y * 5.1) * 0.12);
    p.setZ(i, p.getZ(i) + Math.cos(y * 3.7) * 0.12);
  }
  g.computeVertexNormals();
  g.userData.geteilt = true;
  stamm = g;
  return g;
}

let bueschel: THREE.BufferGeometry | null = null;
/** Grasbüschel: elf Halme, die auseinanderfallen */
function bueschelGeometrie(): THREE.BufferGeometry {
  if (bueschel) return bueschel;
  const r = zufallAus(5);
  const ecken: number[] = [], normalen: number[] = [];
  for (let k = 0; k < 11; k++) {
    const a = r() * Math.PI * 2, weit = 0.08 + r() * 0.3, h = 0.2 + r() * 0.34, b = 0.035 + r() * 0.03;
    const fx = Math.cos(a) * 0.1, fz = Math.sin(a) * 0.1, qx = -Math.sin(a) * b, qz = Math.cos(a) * b;
    const s = [fx - qx, 0, fz - qz, fx + qx, 0, fz + qz, Math.cos(a) * weit, h, Math.sin(a) * weit];
    // von beiden Seiten zu sehen (zweites Dreieck andersherum) und hell wie der Boden: Normale nach oben
    ecken.push(...s, s[3], s[4], s[5], s[0], s[1], s[2], s[6], s[7], s[8]);
    for (let n = 0; n < 6; n++) normalen.push(0, 1, 0);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(ecken, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(normalen, 3));
  g.userData.geteilt = true;
  bueschel = g;
  return g;
}

/**
 * Material, das in seiner eigenen Farbe glimmt: beleuchtet wie Lambert (also mit Form und Schatten),
 * dazu strahlt die Farbe des einzelnen Stücks mit `glimmen` von selbst — für Pilzhüte bei Nacht.
 */
function glimmMaterial(glimmen: number): THREE.MeshLambertMaterial {
  const m = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true });
  m.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
      #ifdef USE_COLOR
        totalEmissiveRadiance += vColor.rgb * ${glimmen.toFixed(3)};
      #endif`);
  };
  m.customProgramCacheKey = () => `hp-glimmen-${glimmen.toFixed(3)}`;
  return m;
}

let hut: THREE.BufferGeometry | null = null;
/** Pilzhut: gewölbte Kappe mit eingezogenem Rand und heller Unterseite (Lamellen); Breite 1, Fuß bei y = 0 */
function hutGeometrie(): THREE.BufferGeometry {
  if (hut) return hut;
  const profil: [number, number, number][] = [
    // Radius, Höhe, Helligkeit: oben über die Wölbung zum Rand, dann unten zurück zum Stiel
    [0.001, 0.46, 1], [0.14, 0.45, 1], [0.28, 0.39, 1], [0.4, 0.28, 0.95], [0.48, 0.14, 0.9], [0.5, 0.04, 0.85],
    [0.46, 0, 1.35], [0.3, 0.05, 1.5], [0.12, 0.09, 1.6], [0.001, 0.1, 1.6],
  ];
  const g = new THREE.LatheGeometry(profil.map(([x, y]) => new THREE.Vector2(x, y)), 16);
  const farben: number[] = [];
  const n = g.attributes.position.count / profil.length;
  for (let k = 0; k < n; k++) for (const [, , hell] of profil) farben.push(hell, hell, hell);
  g.setAttribute("color", new THREE.Float32BufferAttribute(farben, 3));
  g.computeVertexNormals();
  g.userData.geteilt = true;
  hut = g;
  return g;
}

let stiel: THREE.BufferGeometry | null = null;
/** Pilzstiel: unten bauchig, oben schlank, mit Ring; Fuß bei y = 0, Höhe 1 */
function stielGeometrie(): THREE.BufferGeometry {
  if (stiel) return stiel;
  const profil: [number, number][] = [[0.001, 0], [1.25, 0.02], [1.35, 0.1], [1.0, 0.24], [0.8, 0.5], [0.72, 0.74], [0.95, 0.77], [0.7, 0.8], [0.66, 1]];
  const g = new THREE.LatheGeometry(profil.map(([x, y]) => new THREE.Vector2(x, y)), 10);
  const p = g.attributes.position;
  g.setAttribute("color", new THREE.Float32BufferAttribute(new Array(p.count * 3).fill(1), 3));
  g.computeVertexNormals();
  g.userData.geteilt = true;
  stiel = g;
  return g;
}

export interface Schweben {
  farben: number[]; anzahl: number;
  /** Größe eines Teilchens in Welteinheiten */
  groesse: number;
  /** Fallgeschwindigkeit (negativ = steigt), Höhe der Luftschicht */
  fall: number; hoehe: number;
  /** leuchtet (hell auf dunkel) statt zu decken */
  leuchtet: boolean;
}

/**
 * Was in der Luft schwebt: Pollen, Schnee, Sporen, Funken. Punkte über den freien Feldern,
 * die im Shader treiben und fallen — `takt(zeit)` stellt nur die Uhr.
 */
export function schweben(e: FreiEbene, r: () => number, S: Schweben): { punkte: THREE.Points; takt: (zeit: number) => void } {
  const frei: number[] = [];
  for (let i = 0; i < e.art.length; i++) if (e.art[i] !== WAND) frei.push(i);
  const ort: number[] = [], farben: number[] = [], phase: number[] = [];
  const c = new THREE.Color();
  for (let k = 0; k < S.anzahl && frei.length; k++) {
    const i = frei[Math.floor(r() * frei.length)], x = i % e.b, y = (i - x) / e.b;
    ort.push((x + r()) * ZELLE, r() * S.hoehe, (y + r()) * ZELLE);
    c.set(aus(S.farben, r));
    farben.push(c.r, c.g, c.b);
    phase.push(r());
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(ort, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(farben, 3));
  g.setAttribute("aPhase", new THREE.Float32BufferAttribute(phase, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uZeit: { value: 0 }, uGroesse: { value: S.groesse }, uFall: { value: S.fall }, uHoehe: { value: S.hoehe }, uHoch: { value: 720 } },
    vertexColors: true, transparent: true, depthWrite: false,
    blending: S.leuchtet ? THREE.AdditiveBlending : THREE.NormalBlending,
    vertexShader: /* glsl */ `
      attribute float aPhase;
      uniform float uZeit, uGroesse, uFall, uHoehe, uHoch;
      varying vec3 vFarbe;
      varying float vHell;
      void main() {
        vec3 p = position;
        p.y = mod( position.y - uZeit * uFall * ( 0.6 + aPhase * 0.8 ), uHoehe );
        p.x += sin( uZeit * ( 0.4 + aPhase * 0.5 ) + aPhase * 6.283 ) * 0.5;
        p.z += cos( uZeit * ( 0.35 + aPhase * 0.4 ) + aPhase * 12.566 ) * 0.5;
        vec4 mv = modelViewMatrix * vec4( p, 1.0 );
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uGroesse * uHoch / max( 0.5, -mv.z );
        vFarbe = color;
        // funkelt leise; verblasst in der Ferne und kurz über dem Boden bzw. unter der Decke
        vHell = ( 0.65 + 0.35 * sin( uZeit * 2.0 + aPhase * 40.0 ) ) * smoothstep( 46.0, 18.0, -mv.z )
          * smoothstep( 0.0, 0.4, p.y ) * smoothstep( uHoehe, uHoehe - 0.6, p.y );
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vFarbe;
      varying float vHell;
      void main() {
        float d = length( gl_PointCoord - 0.5 );
        float a = smoothstep( 0.5, 0.12, d ) * vHell;
        if ( a < 0.01 ) discard;
        gl_FragColor = vec4( vFarbe, a );
      }`,
  });
  const punkte = new THREE.Points(g, mat);
  punkte.frustumCulled = false;
  return { punkte, takt: zeit => { mat.uniforms.uZeit.value = zeit; } };
}

/** Sterne am Nachthimmel: feste Punkte weit draußen */
function sterne(r: () => number): THREE.Points {
  const ort: number[] = [], farben: number[] = [];
  for (let k = 0; k < 500; k++) {
    const a = r() * Math.PI * 2, h = 0.12 + r() * 0.88, rad = Math.sqrt(1 - h * h);
    ort.push(Math.cos(a) * rad * 400, h * 400, Math.sin(a) * rad * 400);
    const hell = 0.5 + r() * 0.5;
    farben.push(hell, hell, Math.min(1, hell * (0.9 + r() * 0.3)));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(ort, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(farben, 3));
  const p = new THREE.Points(g, new THREE.PointsMaterial({ size: 2.2, sizeAttenuation: false, vertexColors: true, fog: false, depthWrite: false }));
  p.frustumCulled = false;
  return p;
}

/** gemalte Himmel aus Blender (scripts/bausatz/himmel.py), je Welt einmal geladen */
const HIMMEL_BILDER = new Map<string, THREE.Texture>();

/**
 * Himmel: große Kugel mit Farbverlauf vom Horizont nach oben. Mit `bild` (Name eines gemalten Himmels
 * unter /modelle/himmel/) tauscht die Kugel den Verlauf gegen das Rundumbild, sobald es geladen ist.
 */
export function himmel(oben: number, unten: number, bild?: string): THREE.Mesh {
  const m = verlauf(oben, unten);
  if (bild && typeof document !== "undefined") {
    const zeige = (t: THREE.Texture) => {
      const alt = m.material as THREE.Material;
      m.material = new THREE.MeshBasicMaterial({ map: t, side: THREE.BackSide, fog: false, depthWrite: false });
      alt.dispose();
    };
    const da = HIMMEL_BILDER.get(bild);
    if (da?.image) zeige(da);
    else new THREE.TextureLoader().load(`/modelle/himmel/${bild}.jpg`, t => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.userData.geteilt = true;
      HIMMEL_BILDER.set(bild, t);
      zeige(t);
    }, undefined, () => { /* ohne Bild bleibt der Verlauf */ });
  }
  return m;
}

function verlauf(oben: number, unten: number): THREE.Mesh {
  const g = new THREE.SphereGeometry(420, 24, 12);
  const p = g.attributes.position, farben: number[] = [];
  const o = farbe(oben), u = farbe(unten), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    c.copy(u).lerp(o, Math.min(1, Math.max(0, p.getY(i) / 420) * 2.2));
    farben.push(c.r, c.g, c.b);
  }
  g.setAttribute("color", new THREE.Float32BufferAttribute(farben, 3));
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  m.renderOrder = -1;
  return m;
}

/**
 * Wie tief steckt ein Feld in der Wand? 0 = frei, 1 = Wand am Weg, 2 = dahinter …
 * Das Raster bekommt ringsum `rand` Felder dazu (der Wald geht hinter der Karte weiter).
 */
export function tiefen(e: FreiEbene, rand: number, max = 7): { t: Uint8Array; B: number } {
  const B = e.b + 2 * rand;
  const t = new Uint8Array(B * B).fill(max);
  const schlange: number[] = [];
  for (let y = 0; y < e.h; y++) for (let x = 0; x < e.b; x++) {
    if (e.art[y * e.b + x] !== WAND) { const i = (y + rand) * B + x + rand; t[i] = 0; schlange.push(i); }
  }
  for (let k = 0; k < schlange.length; k++) {
    const i = schlange[k], x = i % B, y = (i - x) / B;
    if (t[i] >= max - 1) continue;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= B || ny >= B) continue;
      const j = ny * B + nx;
      if (t[j] > t[i] + 1) { t[j] = t[i] + 1; schlange.push(j); }
    }
  }
  return { t, B };
}

/** Feld ohne Wand in der Nachbarschaft: ein einzelner Baum bzw. eine Säule mitten im Weg */
export function allein(e: FreiEbene, x: number, y: number): boolean {
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if ((dx || dy) && !istFrei(e, x + dx, y + dy)) return false;
  }
  return true;
}

/** Der Boden als gemaltes Bild: `male` setzt die Pinselstriche; mit `hoehe` (Welt x, z → y) wird er zum Gelände */
export function boden(e: FreiEbene, male: (ctx: CanvasRenderingContext2D, px: number) => void, grund: number, hoehe?: (x: number, z: number) => number): THREE.Mesh {
  const px = Math.max(8, Math.min(20, Math.floor(2048 / e.b)));
  const c = typeof document !== "undefined" ? document.createElement("canvas") : null;
  const ctx = c?.getContext("2d");
  const mat = new THREE.MeshLambertMaterial({ color: ctx ? 0xffffff : grund });
  if (c && ctx) {
    c.width = e.b * px; c.height = e.h * px;
    ctx.fillStyle = css(grund);
    ctx.fillRect(0, 0, c.width, c.height);
    male(ctx, px);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    mat.map = tex;
  }
  const g = hoehe ? new THREE.PlaneGeometry(e.b * ZELLE, e.h * ZELLE, e.b * 2, e.h * 2) : new THREE.PlaneGeometry(e.b * ZELLE, e.h * ZELLE);
  g.rotateX(-Math.PI / 2);
  if (hoehe) {
    const p = g.attributes.position as THREE.BufferAttribute, mx = (e.b * ZELLE) / 2, mz = (e.h * ZELLE) / 2;
    for (let i = 0; i < p.count; i++) p.setY(i, hoehe(p.getX(i) + mx, p.getZ(i) + mz));
    g.computeVertexNormals();
  }
  const m = new THREE.Mesh(g, mat);
  m.position.set((e.b * ZELLE) / 2, 0, (e.h * ZELLE) / 2);
  m.receiveShadow = true;
  m.userData.boden = true;
  return m;
}

/** Ein Pinselstrich: flache, schräge Ellipse */
export function strich(ctx: CanvasRenderingContext2D, x: number, y: number, lang: number, breit: number, winkel: number, f: string, deckung = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(winkel);
  ctx.globalAlpha = deckung;
  ctx.fillStyle = f;
  ctx.beginPath();
  ctx.ellipse(0, 0, lang, breit, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Je Feld einige Striche in Farben, die `wahl` für das Feld nennt */
export function striche(ctx: CanvasRenderingContext2D, e: FreiEbene, px: number, r: () => number, anzahl: number, wahl: (art: number, x: number, y: number) => number[] | null, deckung = 0.85) {
  for (let y = 0; y < e.h; y++) for (let x = 0; x < e.b; x++) {
    const farben = wahl(e.art[y * e.b + x], x, y);
    if (!farben) continue;
    for (let k = 0; k < anzahl; k++) {
      strich(ctx, (x + r() * 1.4 - 0.2) * px, (y + r() * 1.4 - 0.2) * px, px * (0.45 + r() * 0.5), px * (0.16 + r() * 0.2),
        (r() - 0.5) * 1.1, css(aus(farben, r)), deckung);
    }
  }
}

/** Ebene in einer Farbe weit um die Karte herum (bis zum Nebel) */
export function umland(e: FreiEbene, f: number): THREE.Mesh {
  const g = new THREE.PlaneGeometry(900, 900);
  g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: f }));
  m.position.set((e.b * ZELLE) / 2, -0.03, (e.h * ZELLE) / 2);
  return m;
}

// ── Wald und seine Verwandten ────────────────────────────────────────────

type Baum = "laub" | "tanne" | "palme" | "pilz";

interface Natur {
  schatten: number[]; wiese: number[]; pfad: number[]; lichtung: number[]; blueten: number[];
  stamm: number[]; krone: number[]; busch: number[]; gras: number[]; stein: number;
  baum: Baum;
  /** Anteil der Felder am Weg, auf denen ein Baum steht */
  dicht: number;
  /** Grasbüschel je freiem Feld (Anteil) */
  halme: number;
  /** Felsen am Wegrand (Anteil) */
  felsen: number;
  grund: number; umland: number;
  /** was in der Luft treibt */
  luft: Schweben;
  stimmung: Stimmung;
}

const NATUR: Record<"wald" | "winter" | "oase" | "pilze", Natur> = {
  wald: {
    schatten: [0x3f4a1f, 0x4d5a26, 0x5a4a22, 0x6b5a2a, 0x46522a],
    wiese: [0x8a8f2e, 0xa39a34, 0xb7a23c, 0x7d8a2c, 0xc2a64a, 0x96a238],
    pfad: [0x9a7646, 0xa9834f, 0x8c6a3d, 0xb8935a],
    lichtung: [0xa8b03a, 0xc0b848, 0x93a836, 0xd1c05a],
    blueten: [0xfff3c4, 0xffd24a, 0xf2a0c0, 0xffffff],
    stamm: [0x6b4a32, 0x7a5638, 0x5a4034, 0x80624a, 0x6a5148],
    krone: [0x6b8e23, 0x8a9a2b, 0xc9a227, 0xd98a1f, 0xb5541b, 0x4f7a28, 0xe0b53a, 0x7da033],
    busch: [0x4f7a28, 0x6b8e23, 0x8a9a2b, 0x3f6a2a, 0xa8a030],
    gras: [0x9aa83e, 0x86a034, 0xb3ac48, 0x76942f, 0xc09f40],
    stein: 0x8f8a82, baum: "laub", dicht: 0.9, halme: 0.3, felsen: 0.12, grund: 0x5d6b2a, umland: 0x4d5a26,
    // Pollen und Staub im Sonnenlicht
    luft: { farben: [0xfff2c0, 0xffe08a, 0xffffff], anzahl: 260, groesse: 0.09, fall: 0.06, hoehe: 5, leuchtet: true },
    stimmung: {
      himmelOben: 0x86b4e6, himmelUnten: 0xf2ddb0, nebel: 0xe9d6ac, dichte: 0.017,
      sonne: 0xffc98f, sonneStaerke: 3.4, sonneVon: [-0.62, 0.58, -0.4],
      oben: 0xb9d2ff, unten: 0x9a6a36, umgebung: 1.0, fackel: 0, belichtung: 1.0,
    },
  },
  // Winterwald: Tannen mit Schneekappen, verschneiter Boden, kaltes Licht
  winter: {
    schatten: [0xc3d0e0, 0xb4c4d8, 0xd2dcea, 0xa9bbd2],
    wiese: [0xf2f6fb, 0xe6edf6, 0xffffff, 0xdbe5f1],
    pfad: [0xcfd9e6, 0xbcc9da, 0xd8e0ea],
    lichtung: [0xffffff, 0xf4f8fc, 0xe9f0f8],
    blueten: [0xbfe3ff, 0xffffff, 0xd6ecff],
    stamm: [0x4a3a30, 0x55443a, 0x3f332c],
    krone: [0x3a6e52, 0x44805c, 0x316248, 0x4f8c68],
    busch: [0xf4f8fc, 0xe2ebf5, 0xffffff, 0x9fb7a8],
    gras: [0xa89a78, 0x8f8468, 0xbcae8c],
    stein: 0xb9c2cf, baum: "tanne", dicht: 0.9, halme: 0.08, felsen: 0.15, grund: 0xe6edf6, umland: 0xdbe5f1,
    // Schnee fällt
    luft: { farben: [0xffffff, 0xf2f6fb], anzahl: 700, groesse: 0.11, fall: 0.9, hoehe: 8, leuchtet: false },
    stimmung: {
      himmelOben: 0x9dbbe0, himmelUnten: 0xf2f6fb, nebel: 0xe8eef6, dichte: 0.02,
      sonne: 0xfff1dc, sonneStaerke: 2.5, sonneVon: [-0.6, 0.5, 0.45],
      oben: 0xd9e8ff, unten: 0xa8b8d0, umgebung: 1.15, fackel: 0, belichtung: 0.9,
    },
  },
  // Oase: Sand und Dünen, Palmen, Sandsteinfelsen, grüne Plätze am Wasser
  oase: {
    schatten: [0xd9b676, 0xcfa965, 0xe3c388, 0xc59c58],
    wiese: [0xedd39a, 0xe6c887, 0xf3dcab, 0xdfc07c],
    pfad: [0xd6b577, 0xcba865, 0xe0c188],
    lichtung: [0x9fc45a, 0x8ab64e, 0xb4d068, 0x7aa846],
    blueten: [0xff6f61, 0xffd166, 0xffffff, 0xf78fb3],
    stamm: [0x8a6a44, 0x7a5c3a, 0x9a7850],
    krone: [0x4f9a3c, 0x5fae46, 0x3f8a36, 0x74bb50],
    busch: [0xc9a368, 0xb8935a, 0x8f9a4a, 0xd4b47c],
    gras: [0xb8b060, 0xa3a352, 0xcbbd72],
    stein: 0xc9a56c, baum: "palme", dicht: 0.6, halme: 0.1, felsen: 0.45, grund: 0xe6c887, umland: 0xdfc07c,
    // Flugsand
    luft: { farben: [0xfff0c8, 0xf3dcab], anzahl: 160, groesse: 0.07, fall: 0.1, hoehe: 4, leuchtet: true },
    stimmung: {
      himmelOben: 0x3f95e6, himmelUnten: 0xf6e3b4, nebel: 0xf3dfb0, dichte: 0.009,
      sonne: 0xffe6b0, sonneStaerke: 3.6, sonneVon: [-0.4, 0.85, 0.3],
      oben: 0xcfe4ff, unten: 0xe0b060, umgebung: 1.15, fackel: 0, belichtung: 0.9,
    },
  },
  // Leuchtpilzwald: Nacht, Riesenpilze mit leuchtenden Hüten
  pilze: {
    schatten: [0x141a2e, 0x1a2038, 0x10162a, 0x1f1a3a],
    wiese: [0x1f3a44, 0x25444c, 0x1a3340, 0x2a3a52],
    pfad: [0x2a3550, 0x323c5a, 0x243048],
    lichtung: [0x2a5560, 0x326470, 0x244c58],
    blueten: [0x5ef2e0, 0xf070d8, 0xa98bff, 0xb6ff6a],
    stamm: [0xd8d0e8, 0xc8c0dc, 0xe6def2],
    krone: [0x38e1d6, 0xe85ad0, 0x9a7bff, 0xa6f25a, 0x52b8ff],
    busch: [0x38e1d6, 0xe85ad0, 0x9a7bff, 0xa6f25a],
    gras: [0x2f6a66, 0x3a7a70, 0x2a5a6a],
    stein: 0x4a4a6a, baum: "pilz", dicht: 0.7, halme: 0.25, felsen: 0.1, grund: 0x1a2a3a, umland: 0x141a2e,
    // leuchtende Sporen steigen auf
    luft: { farben: [0x5ef2e0, 0xf070d8, 0xa98bff, 0xb6ff6a], anzahl: 520, groesse: 0.13, fall: -0.22, hoehe: 7, leuchtet: true },
    stimmung: {
      himmelOben: 0x05041a, himmelUnten: 0x241a5c, nebel: 0x171245, dichte: 0.02,
      sonne: 0xa9b8ff, sonneStaerke: 0.7, sonneVon: [0.35, 0.8, -0.4],
      // das Licht über der Figur ist hier kühl wie Mondschein, damit sie nicht zum Schattenriss wird
      oben: 0x8a7cf0, unten: 0x1f5560, umgebung: 0.7, fackel: 9, fackelFarbe: 0xcfe6ff, belichtung: 1.1,
    },
  },
};

function waldLandschaft(e: FreiEbene, seed: number, art: keyof typeof NATUR = "wald"): Landschaft {
  const g = new THREE.Group();
  const r = zufallAus(seed * 7 + 3);
  const P = NATUR[art];
  g.add(himmel(P.stimmung.himmelOben, P.stimmung.himmelUnten, art));
  g.add(umland(e, P.umland));
  g.add(boden(e, (ctx, px) => {
    striche(ctx, e, px, r, 6, a => (a === WAND ? P.schatten : a === PLATZ ? P.lichtung : P.wiese));
    // ausgetretener Pfad: wo ringsum alles frei ist
    striche(ctx, e, px, r, 3, (a, x, y) => (a === WEG && allein(e, x, y) ? P.pfad : null), 0.55);
    // Blüten (bzw. Eiskristalle, Leuchtsporen) auf den Lichtungen
    for (let y = 0; y < e.h; y++) for (let x = 0; x < e.b; x++) {
      if (e.art[y * e.b + x] !== PLATZ) continue;
      for (let k = 0; k < 2; k++) {
        ctx.fillStyle = css(aus(P.blueten, r));
        ctx.beginPath();
        ctx.arc((x + r()) * px, (y + r()) * px, px * (0.05 + r() * 0.05), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (art === "winter") {
      // zugefrorener Teich um jede Station: heller Eisring mit Kratzern
      for (const [x, y] of [...e.raeume.map(p => [p.x, p.y]), e.start, e.ziel]) {
        ctx.lineWidth = px * 1.3;
        ctx.strokeStyle = "#bfe0f5";
        ctx.beginPath();
        ctx.arc((x + 0.5) * px, (y + 0.5) * px, px * 3.7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.lineWidth = px * 0.08;
        ctx.strokeStyle = "#ffffff";
        for (let k = 0; k < 14; k++) {
          const a = r() * Math.PI * 2, b = a + 0.15 + r() * 0.3;
          ctx.beginPath();
          ctx.arc((x + 0.5) * px, (y + 0.5) * px, px * (3.3 + r() * 0.8), a, b);
          ctx.stroke();
        }
      }
    }
    if (art === "oase") {
      // Wasserloch in der Mitte jedes Platzes (unter der Station): blauer Ring
      for (const [x, y] of [...e.raeume.map(p => [p.x, p.y]), e.start, e.ziel]) {
        ctx.lineWidth = px * 1.1;
        ctx.strokeStyle = "#6fc3e8";
        ctx.beginPath();
        ctx.arc((x + 0.5) * px, (y + 0.5) * px, px * 3.7, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }, P.grund));

  const RAND = 7;
  const { t, B } = tiefen(e, RAND);
  const staemme: Stueck[] = [], kronen: Stueck[] = [], buesche: Stueck[] = [], graeser: Stueck[] = [], steine: Stueck[] = [];
  const kegel: Stueck[] = [], huete: Stueck[] = [], stiele: Stueck[] = [], tupfen: Stueck[] = [], scheine: Stueck[] = [];
  const strahlen: Stueck[] = [], staemmeLiegend: Stueck[] = [], kakteen: Stueck[] = [];
  const sonneRichtung = new THREE.Vector3(...P.stimmung.sonneVon).normalize();
  /** ein Pilz: Stiel, Hut, auf manchen weiße Tupfen; große werfen einen Lichtschein auf den Boden */
  const pilz = (sx: number, sz: number, h: number, breit: number, f: THREE.Color) => {
    const dick = Math.max(0.04, breit * 0.05 + h * 0.007);
    const neigung = new THREE.Quaternion().setFromEuler(new THREE.Euler((r() - 0.5) * 0.16, r() * 6.3, (r() - 0.5) * 0.16));
    const kopf = new THREE.Vector3(0, h, 0).applyQuaternion(neigung).add(new THREE.Vector3(sx, 0, sz));
    stiele.push({ p: new THREE.Vector3(sx, -0.05, sz), s: new THREE.Vector3(dick, h, dick), q: neigung, f: f.clone().lerp(farbe(0xd8d0ec), 0.45).multiplyScalar(0.55) });
    const hoch = breit * (0.75 + r() * 0.5);
    huete.push({ p: new THREE.Vector3(kopf.x, kopf.y - hoch * 0.1, kopf.z), s: new THREE.Vector3(breit, hoch, breit), q: neigung, f });
    if (r() < 0.45) {
      for (let k = 0; k < 6; k++) {
        const a = r() * Math.PI * 2, rad = (0.08 + r() * 0.3), oben = 0.46 * Math.sqrt(Math.max(0, 1 - (rad / 0.52) ** 2));
        const stelle = new THREE.Vector3(Math.cos(a) * rad * breit, (oben - 0.1) * hoch, Math.sin(a) * rad * breit).applyQuaternion(neigung).add(kopf);
        const gross = breit * (0.035 + r() * 0.035);
        tupfen.push({ p: stelle, s: new THREE.Vector3(gross, gross * 0.5, gross), q: neigung });
      }
    }
    if (breit > 1.5) scheine.push({ p: new THREE.Vector3(sx, 0.03 + r() * 0.01, sz), s: new THREE.Vector3(breit * 1.5, 1, breit * 1.5), f: f.clone().multiplyScalar(0.35) });
  };
  const lichter: [number, number, number][] = [];
  const hoch = new THREE.Vector3(0, 1, 0);
  const dreh = () => new THREE.Quaternion().setFromAxisAngle(hoch, r() * Math.PI * 2);
  const hell = (liste: number[], von = 0.9, breit = 0.25) => farbe(aus(liste, r)).multiplyScalar(von + r() * breit);

  const modell = modellSetzer(r);
  const gedreht = (neigen = 0) => new THREE.Quaternion().setFromEuler(new THREE.Euler((r() - 0.5) * neigen, r() * Math.PI * 2, (r() - 0.5) * neigen));
  /** Blender-Baum, wenn geladen: `h` hoch, etwas breiter oder schmaler */
  const modellBaum = (art: "laubbaum" | "tanne" | "palme", sx: number, sz: number, h: number, farben: Record<string, THREE.Color>) => {
    // Tannen schlank (sonst reichen die unteren Äste in den Weg), Stämme schmaler als in Blender
    const w = h * (art === "tanne" ? 0.58 : 0.85) * (0.9 + r() * 0.2);
    return modell.setze(art, new THREE.Vector3(sx, -0.08, sz), new THREE.Vector3(w, h, w), gedreht(art === "palme" ? 0 : 0.08), farben,
      art === "tanne" ? {} : { stamm: art === "palme" ? 0.6 : 0.5 });
  };

  /** ein Baum der jeweiligen Art bei (sx, sz); `nah` = am Weg (voller ausgebaut) */
  const pflanze = (sx: number, sz: number, nah: boolean, amWeg: boolean) => {
    // am Weg nur junge Tannen: die Äste der großen reichen bis auf Kopfhöhe in den Weg
    if (P.baum === "tanne" && modellBaum("tanne", sx, sz, amWeg ? 2.6 + r() * 1.6 : 6 + r() * 4, { stamm: hell(P.stamm, 0.85, 0.3), krone: hell(P.krone), schnee: farbe(0xf4f8fc) })) return;
    if (P.baum === "palme" && modellBaum("palme", sx, sz, 5 + r() * 2.6, { stamm: hell(P.stamm, 0.85, 0.3), krone: hell(P.krone) })) return;
    if (P.baum === "laub" && modellBaum("laubbaum", sx, sz, 7.5 + r() * 4, { stamm: hell(P.stamm, 0.85, 0.3), krone: hell(P.krone) })) return;
    if (P.baum === "tanne") {
      const h = 5 + r() * 4, dick = 0.16 + r() * 0.1;
      staemme.push({ p: new THREE.Vector3(sx, -0.1, sz), s: new THREE.Vector3(dick, h * 0.7, dick), f: hell(P.stamm, 0.85, 0.3) });
      const stufen = nah ? 6 : 4;
      for (let k = 0; k < stufen; k++) {
        // unten bleibt der Stamm frei: tiefe Äste nähmen am Weg die Sicht
        const anteil = k / stufen, breit = (2.0 - anteil * 1.45) * (0.85 + r() * 0.3), hk = h * 0.25;
        const y = 2.4 + (h - 2.4) * anteil * 0.8 + hk / 2;
        kegel.push({ p: new THREE.Vector3(sx, y, sz), s: new THREE.Vector3(breit, hk, breit), q: dreh(), f: hell(P.krone) });
        // Schneekappe: etwas kleiner, ein Stück höher
        kegel.push({ p: new THREE.Vector3(sx, y + hk * 0.26, sz), s: new THREE.Vector3(breit * 0.84, hk * 0.56, breit * 0.84), q: dreh(), f: farbe(0xf4f8fc) });
      }
    } else if (P.baum === "palme") {
      const h = 4.2 + r() * 2.6, dick = 0.14 + r() * 0.06;
      const neigung = new THREE.Quaternion().setFromEuler(new THREE.Euler((r() - 0.5) * 0.4, r() * 6.3, (r() - 0.5) * 0.4));
      staemme.push({ p: new THREE.Vector3(sx, -0.1, sz), s: new THREE.Vector3(dick, h, dick), q: neigung, f: hell(P.stamm, 0.85, 0.3) });
      const spitze = new THREE.Vector3(0, h, 0).applyQuaternion(neigung).add(new THREE.Vector3(sx, 0, sz));
      const wedel = nah ? 7 : 5, start = r() * 6;
      for (let k = 0; k < wedel; k++) {
        const a = start + (k / wedel) * Math.PI * 2, lang = 1.5 + r() * 0.7;
        // Wedel: lang und flach, hängt nach außen herab
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -a, -0.35 - r() * 0.25, "YXZ"));
        kronen.push({
          p: new THREE.Vector3(spitze.x + Math.cos(a) * lang * 0.45, spitze.y - 0.15, spitze.z + Math.sin(a) * lang * 0.45),
          s: new THREE.Vector3(lang, 0.16, 0.55), q, f: hell(P.krone),
        });
      }
    } else if (P.baum === "pilz") {
      // Am Weg stehen Riesen, deren Hüte über der Kamera sitzen (sonst steckte sie mitten im Hut);
      // dahinter auch mannshohe, deren leuchtende Hüte man auf Augenhöhe sieht.
      const riese = amWeg || r() < 0.4;
      const h = riese ? 6 + r() * 4 : 1.8 + r() * 2.2, breit = riese ? 3 + r() * 2.6 : 1.3 + r() * 1.4;
      const f = farbe(aus(P.krone, r)).multiplyScalar(0.8 + r() * 0.3);
      pilz(sx, sz, h, breit, f);
      // um den Fuß ein paar junge Pilze in derselben Farbe
      if (nah) for (let k = 0, n = Math.floor(r() * 3); k < n; k++) {
        pilz(sx + (r() - 0.5) * 1.6, sz + (r() - 0.5) * 1.6, 0.35 + r() * 0.7, 0.35 + r() * 0.4, f.clone().multiplyScalar(0.9));
      }
      // nur wenige echte Lichter, weit auseinander
      if (nah && lichter.length < 6 && lichter.every(([lx, lz]) => Math.hypot(lx - sx, lz - sz) > 14)) lichter.push([sx, sz, f.getHex()]);
    } else {
      const h = 6.5 + r() * 4.5, dick = 0.2 + r() * 0.17;
      const neigung = new THREE.Quaternion().setFromEuler(new THREE.Euler((r() - 0.5) * 0.12, r() * 6.3, (r() - 0.5) * 0.12));
      staemme.push({ p: new THREE.Vector3(sx, -0.1, sz), s: new THREE.Vector3(dick, h, dick), q: neigung, f: hell(P.stamm, 0.85, 0.3) });
      for (let k = 0; k < (nah ? 3 : 2); k++) {
        const breit = 2.2 + r() * 1.6;
        kronen.push({
          p: new THREE.Vector3(sx + (r() - 0.5) * 1.8, h * (0.82 + r() * 0.22), sz + (r() - 0.5) * 1.8),
          s: new THREE.Vector3(breit, 1.3 + r() * 0.9, breit), q: dreh(), f: hell(P.krone),
        });
      }
    }
  };

  for (let Y = 0; Y < B; Y++) for (let X = 0; X < B; X++) {
    const tiefe = t[Y * B + X], x = X - RAND, y = Y - RAND;
    const wx = feldMitte(x), wz = feldMitte(y);
    if (tiefe === 0) {
      if (e.art[y * e.b + x] !== DURCHGANG && r() < P.halme) {
        graeser.push({ p: new THREE.Vector3(wx + (r() - 0.5) * ZELLE, 0, wz + (r() - 0.5) * ZELLE), s: new THREE.Vector3().setScalar(0.8 + r() * 0.9), q: dreh(), f: farbe(aus(P.gras, r)) });
      }
      // Sonne fällt in Bahnen durch die Kronen
      if ((art === "wald" || art === "winter") && e.art[y * e.b + x] === PLATZ && r() < 0.05) {
        const lang = 13 + r() * 5, breit = 0.9 + r() * 1.6;
        // die Bahn steht in Sonnenrichtung schräg; zwei gekreuzte Flächen, damit sie von überall zu sehen ist
        const zurSonne = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), sonneRichtung);
        for (const dreh2 of [0, Math.PI / 2]) {
          strahlen.push({
            p: new THREE.Vector3(wx, 0, wz), s: new THREE.Vector3(breit, lang, 1),
            q: zurSonne.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), dreh2)),
          });
        }
      }
      continue;
    }
    const einzeln = tiefe === 1 && allein(e, x, y);
    if (art === "wald") {
      // Fliegenpilze am Fuß der Bäume, hier und da ein umgestürzter Stamm
      if (tiefe === 1 && r() < 0.22) for (let k = 0, n = 1 + Math.floor(r() * 3); k < n; k++) {
        pilz(wx + (r() - 0.5) * 1.2, wz + (r() - 0.5) * 1.2, 0.25 + r() * 0.35, 0.3 + r() * 0.3, farbe(aus([0xd63a2f, 0xe0552f, 0xc9902f], r)));
      }
      if (tiefe === 1 && !einzeln && r() < 0.05) {
        const h = 0.5 + r() * 0.4;
        modell.setze("stumpf", new THREE.Vector3(wx + (r() - 0.5) * 0.5, -0.04, wz + (r() - 0.5) * 0.5), new THREE.Vector3(h * 1.3, h, h * 1.3), gedreht(), { stamm: hell(P.stamm, 0.75, 0.3) });
      }
      if (tiefe === 2 && r() < 0.06) {
        const lang = 2.5 + r() * 2.5, dick = 0.3 + r() * 0.2;
        staemmeLiegend.push({
          p: new THREE.Vector3(wx, dick * 0.4, wz), s: new THREE.Vector3(dick, lang, dick),
          q: new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, r() * Math.PI, "YXZ")), f: hell(P.stamm, 0.7, 0.3),
        });
      }
    } else if (art === "oase") {
      // Kakteen: Säule mit ein, zwei Armen
      if (tiefe >= 2 && tiefe <= 4 && r() < 0.1) {
        const h = 1.6 + r() * 1.8, gruen = farbe(aus([0x4f8a3c, 0x5c9a46, 0x45803a], r));
        if (modell.setze("kaktus", new THREE.Vector3(wx, 0, wz), new THREE.Vector3(h, h, h), gedreht(), { krone: gruen })) continue;
        kakteen.push({ p: new THREE.Vector3(wx, h / 2, wz), s: new THREE.Vector3(0.5, h * 0.6, 0.5), f: gruen });
        for (const seite of [-1, 1]) {
          if (r() < 0.3) continue;
          const hoch = h * (0.35 + r() * 0.25), a = r() * 6.3;
          kakteen.push({ p: new THREE.Vector3(wx + Math.cos(a) * 0.45 * seite, hoch + 0.35, wz + Math.sin(a) * 0.45 * seite), s: new THREE.Vector3(0.3, 0.6, 0.3), f: gruen });
          kakteen.push({ p: new THREE.Vector3(wx + Math.cos(a) * 0.25 * seite, hoch, wz + Math.sin(a) * 0.25 * seite), s: new THREE.Vector3(0.28, 0.35, 0.28), q: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -a, Math.PI / 2, "YXZ")), f: gruen });
        }
      }
      // Dünen: flache Sandrücken hinter dem Rand
      if (tiefe >= 4 && r() < 0.14) {
        const breit = 6 + r() * 7;
        steine.push({ p: new THREE.Vector3(wx, -0.2, wz), s: new THREE.Vector3(breit, 1.6 + r() * 2.2, breit * (0.6 + r() * 0.5)), q: dreh(), f: farbe(aus(P.wiese, r)).multiplyScalar(0.95 + r() * 0.1) });
      }
    }
    // am Weg dicht, dahinter lichter, weit hinten nur noch einzelne Stämme
    if (einzeln || r() < (tiefe === 1 ? P.dicht : tiefe <= 3 ? P.dicht * 0.66 : P.dicht * 0.33)) {
      pflanze(wx + (r() - 0.5) * 0.5, wz + (r() - 0.5) * 0.5, tiefe <= 3, tiefe === 1);
    }
    if (tiefe <= 2 && r() < (einzeln ? 1 : 0.75)) {
      const breit = einzeln ? 0.9 : 1.2 + r() * 0.6;
      const stueck: Stueck = { p: new THREE.Vector3(wx + (r() - 0.5) * 0.4, 0.3, wz + (r() - 0.5) * 0.4), s: new THREE.Vector3(breit, 0.7 + r() * 0.5, breit), q: dreh(), f: hell(P.busch, 0.85, 0.3) };
      // im Pilzwald leuchtet der Rand: Grüppchen kleiner Pilze statt Büschen
      if (P.baum === "pilz") {
        for (let k = 0, n = 2 + Math.floor(r() * 3); k < n; k++) {
          pilz(stueck.p.x + (r() - 0.5) * 1.1, stueck.p.z + (r() - 0.5) * 1.1, 0.4 + r() * 1.1, 0.45 + r() * 0.6, farbe(aus(P.busch, r)).multiplyScalar(0.75 + r() * 0.3));
        }
      } else if (!modell.setze("busch", new THREE.Vector3(stueck.p.x, -0.05, stueck.p.z), stueck.s, stueck.q!, { krone: stueck.f! })) buesche.push(stueck);
    }
    if (tiefe <= 3 && P.halme > 0.15) for (let k = 0; k < 2; k++) {
      graeser.push({ p: new THREE.Vector3(wx + (r() - 0.5) * ZELLE, 0, wz + (r() - 0.5) * ZELLE), s: new THREE.Vector3().setScalar(1 + r() * 1.2), q: dreh(), f: farbe(aus(P.gras, r)).multiplyScalar(0.75 + r() * 0.3) });
    }
    if (tiefe <= 2 && !einzeln && r() < P.felsen) {
      const gross = (P.felsen > 0.3 ? 0.9 : 0.5) + r() * (P.felsen > 0.3 ? 1.1 : 0.5);
      const ort = new THREE.Vector3(wx + (r() - 0.5) * 0.5, gross * 0.25, wz + (r() - 0.5) * 0.5), groesse = new THREE.Vector3(gross * 1.3, gross * 0.9, gross);
      const f = farbe(P.stein).multiplyScalar(0.8 + r() * 0.3);
      if (!modell.setze("fels", new THREE.Vector3(ort.x, -0.1 * gross, ort.z), groesse.multiplyScalar(1.15), dreh(), { stein: f })) steine.push({ p: ort, s: groesse, q: dreh(), f });
    }
  }
  modell.fertig(g);
  const weiss = () => new THREE.MeshLambertMaterial({ color: 0xffffff });
  g.add(reihe(stammGeometrie(), weiss(), staemme));
  g.add(reihe(felsGeometrie(), weiss(), kronen));
  g.add(reihe(felsGeometrie(), weiss(), buesche));
  g.add(reihe(felsGeometrie(), weiss(), steine));
  g.add(reihe(new THREE.ConeGeometry(0.5, 1, 8), weiss(), kegel));
  if (huete.length) {
    // Pilze glimmen in ihrer Farbe, bleiben aber beleuchtete Körper mit Wölbung und heller Unterseite
    g.add(reihe(hutGeometrie(), glimmMaterial(P.baum === "pilz" ? 0.7 : 0.06), huete));
    g.add(reihe(stielGeometrie(), glimmMaterial(P.baum === "pilz" ? 0.1 : 0), stiele));
    g.add(reihe(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.5 }), tupfen, false));
    // Lichtschein am Boden unter den großen Hüten
    const kreis = new THREE.CircleGeometry(1, 20);
    kreis.rotateX(-Math.PI / 2);
    const schein = reihe(kreis, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false }), P.baum === "pilz" ? scheine : [], false);
    schein.receiveShadow = false;
    g.add(schein);
    if (P.baum === "pilz") g.add(sterne(r));
  }
  if (strahlen.length) {
    // Lichtbahnen: schmale, schräge Flächen in Sonnenrichtung, die nur aufhellen
    const bahn = new THREE.PlaneGeometry(1, 1);
    bahn.translate(0, 0.5, 0);
    const licht = reihe(bahn, new THREE.MeshBasicMaterial({ color: P.stimmung.sonne, transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }), strahlen, false);
    licht.receiveShadow = false;
    g.add(licht);
  }
  if (staemmeLiegend.length) g.add(reihe(new THREE.CylinderGeometry(0.5, 0.5, 1, 8), weiss(), staemmeLiegend));
  if (kakteen.length) g.add(reihe(new THREE.CapsuleGeometry(0.5, 1, 4, 8), weiss(), kakteen));
  const luft = schweben(e, r, P.luft);
  g.add(luft.punkte);
  g.add(reihe(bueschelGeometrie(), weiss(), graeser, false));
  for (const [lx, lz, f] of lichter) {
    const l = new THREE.PointLight(f, 22, 16, 1.5);
    l.position.set(lx, 2.2, lz);
    g.add(l);
  }
  // Tannen tragen ihr Grün auf Augenhöhe: die Kamera bleibt auf dem Weg, sonst steckte sie in den Zweigen
  return { gruppe: g, wandHoehe: P.baum === "tanne" ? 99 : 0, stimmung: P.stimmung, takt: luft.takt };
}

// ── Höhle ────────────────────────────────────────────────────────────────

function hoehleLandschaft(e: FreiEbene, stil: Stil, seed: number): Landschaft {
  const g = new THREE.Group();
  const r = zufallAus(seed * 11 + 5);
  const F = STILE[stil];
  const glut = F.licht ?? 0xffa24a;
  const fels = farbe(F.wand), grund = farbe(F.boden);
  const ton = (c: THREE.Color, heller: number) => c.clone().multiplyScalar(heller).getHex();
  g.add(himmel(0x04050a, 0x0a0c14));
  g.add(umland(e, ton(fels, 0.4)));
  g.add(boden(e, (ctx, px) => {
    striche(ctx, e, px, r, 6, a => (a === WAND ? [ton(fels, 0.5), ton(fels, 0.65)]
      : a === PLATZ ? [ton(grund, 1.15), ton(grund, 1.3), ton(grund, 1.0)] : [ton(grund, 0.8), ton(grund, 0.95), ton(grund, 1.08), ton(fels, 0.9)]));
    // Pfützen aus Licht: Kristallstaub bzw. Glut am Wegrand
    striche(ctx, e, px, r, 1, (a, x, y) => (a !== WAND && r() < 0.1 && !allein(e, x, y) ? [glut] : null), 0.45);
  }, ton(grund, 0.9)));

  const { t, B } = tiefen(e, 3);
  const brocken: Stueck[] = [], zapfen: Stueck[] = [], kristalle: Stueck[] = [];
  const haengend: Stueck[] = [], pilzHuete: Stueck[] = [], pilzStiele: Stueck[] = [];
  const lichter: [number, number][] = [];
  const hoch = new THREE.Vector3(0, 1, 0);
  const dreh = () => new THREE.Quaternion().setFromAxisAngle(hoch, r() * Math.PI * 2);
  for (let Y = 0; Y < B; Y++) for (let X = 0; X < B; X++) {
    const tiefe = t[Y * B + X], x = X - 3, y = Y - 3;
    if (tiefe === 0 || tiefe > 3) continue;
    const wx = feldMitte(x), wz = feldMitte(y);
    const einzeln = tiefe === 1 && allein(e, x, y);
    if (einzeln) {
      // Tropfsteinsäule
      const h = 4.5 + r() * 2.5;
      brocken.push({ p: new THREE.Vector3(wx, h * 0.42, wz), s: new THREE.Vector3(1.15, h, 1.15), q: dreh(), f: farbe(ton(fels, 0.9 + r() * 0.4)) });
      brocken.push({ p: new THREE.Vector3(wx, 0.3, wz), s: new THREE.Vector3(1.7, 1.1, 1.7), q: dreh(), f: farbe(ton(fels, 0.8 + r() * 0.3)) });
      continue;
    }
    // am Weg mannshohe Brocken, dahinter türmt sich der Fels
    const teile = tiefe === 1 ? 2 : 1;
    for (let k = 0; k < teile; k++) {
      const h = tiefe === 1 ? 2.4 + r() * 2.4 : 5.5 + tiefe * 1.5 + r() * 3;
      // am Weg kaum breiter als das Feld: sonst ragen die Brocken in den Weg und verdecken die Figur
      const breit = ZELLE * (tiefe === 1 ? 1.3 + r() * 0.4 : 1.8 + r() * 0.9);
      const kipp = new THREE.Quaternion().setFromEuler(new THREE.Euler((r() - 0.5) * 0.3, r() * 6.3, (r() - 0.5) * 0.3));
      brocken.push({
        p: new THREE.Vector3(wx + (r() - 0.5) * 0.3, h * 0.3, wz + (r() - 0.5) * 0.3), s: new THREE.Vector3(breit, h, breit * (0.8 + r() * 0.4)), q: kipp,
        f: farbe(ton(fels, (tiefe === 1 ? 0.9 : 0.6) + r() * 0.5)),
      });
    }
    // Tropfsteine hängen von der Decke (die man nur ahnt)
    if (tiefe <= 2 && r() < 0.35) {
      const h = 1.5 + r() * 3;
      haengend.push({ p: new THREE.Vector3(wx + (r() - 0.5) * 1.4, 8.5 - h / 2 + r() * 1.5, wz + (r() - 0.5) * 1.4), s: new THREE.Vector3(1.6 + r(), h, 1.6 + r()), f: farbe(ton(fels, 0.7 + r() * 0.4)) });
    }
    if (tiefe === 1 && r() < 0.14) {
      // Leuchtpilze in der Farbe der Glut
      for (let k = 0, n = 2 + Math.floor(r() * 3); k < n; k++) {
        const h = 0.3 + r() * 0.6, breit = 0.35 + r() * 0.4, f = farbe(glut).multiplyScalar(0.7 + r() * 0.4);
        const px2 = wx + (r() - 0.5) * 1.3, pz2 = wz + (r() - 0.5) * 1.3;
        pilzStiele.push({ p: new THREE.Vector3(px2, 0, pz2), s: new THREE.Vector3(breit * 0.07 + 0.03, h, breit * 0.07 + 0.03), f: f.clone().lerp(farbe(0xd8d0ec), 0.5).multiplyScalar(0.6) });
        pilzHuete.push({ p: new THREE.Vector3(px2, h - breit * 0.08, pz2), s: new THREE.Vector3(breit, breit * 0.9, breit), f });
      }
    }
    if (tiefe === 1 && r() < 0.5) {
      const h = 0.5 + r() * 1.3;
      zapfen.push({ p: new THREE.Vector3(wx + (r() - 0.5) * 1.2, h / 2, wz + (r() - 0.5) * 1.2), s: new THREE.Vector3(1, h, 1), f: farbe(ton(fels, 1.2 + r() * 0.4)) });
    }
    if (tiefe === 1 && r() < 0.1) {
      for (let k = 0; k < 4; k++) {
        const h = 0.5 + r() * 1.1;
        const kipp = new THREE.Quaternion().setFromEuler(new THREE.Euler((r() - 0.5) * 0.9, r() * 6, (r() - 0.5) * 0.9));
        kristalle.push({ p: new THREE.Vector3(wx + (r() - 0.5) * 0.9, h * 0.4, wz + (r() - 0.5) * 0.9), s: new THREE.Vector3(1, h, 1), q: kipp });
      }
      // nur wenige echte Lichter, weit auseinander
      if (lichter.length < 7 && lichter.every(([lx, lz]) => Math.hypot(lx - wx, lz - wz) > 13)) lichter.push([wx, wz]);
    }
  }
  {
    // mit den Blender-Felsen: kantiger und abwechslungsreicher als der eine runde Brocken
    const modell = modellSetzer(r);
    const uebrig = brocken.filter(b => !modell.setze("fels", new THREE.Vector3(b.p.x, b.p.y - b.s.y * 0.42, b.p.z), b.s.clone().multiply(new THREE.Vector3(1.1, 1.25, 1.1)), b.q ?? new THREE.Quaternion(), { stein: b.f! }));
    modell.fertig(g, false);
    g.add(reihe(felsGeometrie(), new THREE.MeshLambertMaterial({ color: 0xffffff }), uebrig, false));
  }
  g.add(reihe(new THREE.ConeGeometry(0.24, 1, 6), new THREE.MeshLambertMaterial({ color: 0xffffff }), zapfen, false));
  g.add(reihe(new THREE.ConeGeometry(0.14, 1, 5), new THREE.MeshLambertMaterial({ color: glut, emissive: glut, emissiveIntensity: 1.6 }), kristalle, false));
  for (const [lx, lz] of lichter) {
    const l = new THREE.PointLight(glut, 16, 15, 1.5);
    l.position.set(lx, 1.6, lz);
    g.add(l);
  }
  const spitzeUnten = new THREE.ConeGeometry(0.24, 1, 6);
  spitzeUnten.rotateX(Math.PI);
  g.add(reihe(spitzeUnten, new THREE.MeshLambertMaterial({ color: 0xffffff }), haengend, false));
  g.add(reihe(hutGeometrie(), glimmMaterial(0.9), pilzHuete, false));
  g.add(reihe(stielGeometrie(), glimmMaterial(0.15), pilzStiele, false));
  // Funken bzw. Kristallstaub steigen auf
  const luft = schweben(e, r, { farben: [glut, farbe(glut).lerp(farbe(0xffffff), 0.5).getHex()], anzahl: 240, groesse: 0.09, fall: -0.3, hoehe: 5, leuchtet: true });
  g.add(luft.punkte);
  return {
    takt: luft.takt,
    gruppe: g, wandHoehe: 99,
    stimmung: {
      himmelOben: 0x04050a, himmelUnten: 0x0a0c14, nebel: 0x080a12, dichte: 0.034,
      sonne: 0x8fa8ff, sonneStaerke: 0, sonneVon: [0.2, 1, 0.1],
      oben: 0x8fa6e0, unten: 0x3a3340, umgebung: 1.0, fackel: 30, belichtung: 1.15,
    },
  };
}

// ── Gebäude ──────────────────────────────────────────────────────────────

/** Stile, in denen es dämmrig ist (Fackel an) */
const DUNKEL = new Set<Stil>(["verlies", "gotisch", "raumstation", "neon"]);

function gebaeudeLandschaft(e: FreiEbene, stil: Stil, seed: number): Landschaft {
  // Gebäude aus Blender-Kacheln und -Ausstattung (bauwelt.ts) — solange sie laden, das schlichte Haus
  const gebaut = bauwelt(e, stil, seed);
  if (gebaut) return gebaut;
  const g = new THREE.Group();
  const r = zufallAus(seed * 13 + 1);
  const F = STILE[stil], A = AUSSEHEN[stil];
  const dunkel = DUNKEL.has(stil);
  const H = 2.4 + F.wandH * 1.1;
  const oben = dunkel ? 0x0b0d14 : 0x8fb3d9, unten = dunkel ? 0x14161f : 0xe4ecf3;
  g.add(himmel(oben, unten));
  g.add(umland(e, F.sockel));
  const muster = A.boden ? textur(A.boden) : null;
  g.add(boden(e, (ctx, px) => {
    for (let y = 0; y < e.h; y++) for (let x = 0; x < e.b; x++) {
      const a = e.art[y * e.b + x];
      if (a === WAND) continue;
      // Fliesen: je vier Felder eine Farbe
      const fliese = F.boden2 !== undefined && (Math.floor(x / 2) + Math.floor(y / 2)) % 2 === 1 ? F.boden2 : F.boden;
      ctx.fillStyle = css(a === PLATZ ? farbe(fliese).lerp(farbe(0xffffff), 0.12).getHex() : a === DURCHGANG ? farbe(fliese).lerp(farbe(F.tuer), 0.35).getHex() : fliese);
      ctx.fillRect(x * px, y * px, px + 1, px + 1);
    }
    if (muster) {
      // das Muster des Baustils (Parkett, Stein, Marmor …) darüberlegen
      const flaeche = ctx.createPattern(muster.image as HTMLCanvasElement, "repeat");
      if (flaeche) {
        const skala = (4.4 / ZELLE) * px / (muster.image as HTMLCanvasElement).width;
        ctx.save();
        ctx.globalAlpha = 0.6;
        ctx.globalCompositeOperation = "multiply";
        ctx.scale(skala, skala);
        ctx.fillStyle = flaeche;
        ctx.fillRect(0, 0, ctx.canvas.width / skala, ctx.canvas.height / skala);
        ctx.restore();
      }
    }
    // Teppich um jede Station, den Eingang und das Tor
    for (const [x, y] of [...e.raeume.map(p => [p.x, p.y]), e.start, e.ziel]) {
      ctx.fillStyle = css(farbe(F.tuer).lerp(farbe(F.boden), 0.35).getHex());
      ctx.globalAlpha = 0.75;
      ctx.beginPath();
      ctx.ellipse((x + 0.5) * px, (y + 0.5) * px, px * 3.2, px * 3.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.lineWidth = px * 0.18;
      ctx.strokeStyle = css(F.oben);
      ctx.stroke();
    }
    // Pinselspuren: helle und dunkle Flecken
    striche(ctx, e, px, r, 2, a => (a === WAND ? null : [0xffffff, 0x000000]), 0.05);
  }, F.sockel));

  const waende: Stueck[] = [], sockel: Stueck[] = [], leisten: Stueck[] = [], stuerze: Stueck[] = [], pfosten: Stueck[] = [], lampen: Stueck[] = [];
  const rahmen: Stueck[] = [], scheiben: Stueck[] = [], bilder: Stueck[] = [], regale: Stueck[] = [], buecher: Stueck[] = [];
  const flecken: Stueck[] = [], halos: Stueck[] = [], lichtkreise: Stueck[] = [], baenke: Stueck[] = [];
  const zinnen: Stueck[] = [], spitzen: Stueck[] = [], streifen: Stueck[] = [];
  const BUCH = [0xb23a48, 0x2a6f97, 0xe9c46a, 0x52796f, 0x6d597a, 0xe76f51];
  const BILD = [0x3d5a80, 0xe07a5f, 0x81b29a, 0xf2cc8f, 0x9d4edd, 0x457b9d];
  /** flache Platte an der Wandseite, die zum freien Nachbarn zeigt */
  const anWand = (wx: number, wz: number, d: [number, number], hoehe: number, breit: number, hoch: number, dick: number, vor = 0.04): Stueck => ({
    p: new THREE.Vector3(wx + d[0] * (ZELLE / 2 + vor), hoehe, wz + d[1] * (ZELLE / 2 + vor)),
    s: new THREE.Vector3(d[0] ? dick : breit, hoch, d[1] ? dick : breit),
  });
  for (let y = 0; y < e.h; y++) for (let x = 0; x < e.b; x++) {
    const a = e.art[y * e.b + x], wx = feldMitte(x), wz = feldMitte(y);
    if (a === DURCHGANG) {
      stuerze.push({ p: new THREE.Vector3(wx, H - 0.3, wz), s: new THREE.Vector3(ZELLE, 0.6, ZELLE) });
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (!istFrei(e, x + dx, y + dy)) pfosten.push({ p: new THREE.Vector3(wx + dx * (ZELLE / 2 - 0.1), (H - 0.6) / 2, wz + dy * (ZELLE / 2 - 0.1)), s: new THREE.Vector3(dx ? 0.2 : ZELLE, H - 0.6, dy ? 0.2 : ZELLE) });
      }
      continue;
    }
    if (a === PLATZ && (x * 5 + y * 11) % 7 === 0) {
      const d = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as [number, number][]).find(([dx, dy]) => e.art[(y + dy) * e.b + x + dx] === WAND);
      if (d) {
        // Regal: steht im Zimmer flach an der Wand, drei Reihen bunter Bücher
        const mx = wx + d[0] * (ZELLE / 2 - 0.2), mz = wz + d[1] * (ZELLE / 2 - 0.2);
        regale.push({ p: new THREE.Vector3(mx, 0.95, mz), s: new THREE.Vector3(d[0] ? 0.38 : 1.25, 1.9, d[1] ? 0.38 : 1.25) });
        for (let reihe = 0; reihe < 3; reihe++) for (let k = 0; k < 4; k++) {
          const quer = (k - 1.5) * 0.27;
          buecher.push({
            p: new THREE.Vector3(mx - d[0] * 0.2 + (d[0] ? 0 : quer), 0.45 + reihe * 0.55, mz - d[1] * 0.2 + (d[1] ? 0 : quer)),
            s: new THREE.Vector3(d[0] ? 0.06 : 0.22, 0.3 + r() * 0.12, d[1] ? 0.06 : 0.22), f: farbe(aus(BUCH, r)),
          });
        }
      }
    }
    if (a !== WAND) continue;
    waende.push({ p: new THREE.Vector3(wx, H / 2, wz), s: new THREE.Vector3(ZELLE, H, ZELLE) });
    let frei: [number, number] | null = null, amWeg = false;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!istFrei(e, x + dx, y + dy)) continue;
      amWeg = true;
      if (!dx !== !dy) frei = [dx, dy];
    }
    if (!amWeg) continue;
    sockel.push({ p: new THREE.Vector3(wx, 0.5, wz), s: new THREE.Vector3(ZELLE + 0.1, 1.0, ZELLE + 0.1) });
    leisten.push({ p: new THREE.Vector3(wx, H + F.obenH * 0.75, wz), s: new THREE.Vector3(ZELLE + 0.08, Math.max(0.1, F.obenH * 1.5), ZELLE + 0.08) });
    const wahl = (x * 7 + y * 13) % 6;
    if (frei && wahl === 0) {
      lampen.push({ p: new THREE.Vector3(wx + frei[0] * (ZELLE / 2 + 0.08), 2.35, wz + frei[1] * (ZELLE / 2 + 0.08)), s: new THREE.Vector3(0.22, 0.32, 0.22) });
      // weicher Schein um die Lampe und auf dem Boden darunter
      halos.push({ p: new THREE.Vector3(wx + frei[0] * (ZELLE / 2 + 0.2), 2.35, wz + frei[1] * (ZELLE / 2 + 0.2)), s: new THREE.Vector3().setScalar(0.9) });
      lichtkreise.push({ p: new THREE.Vector3(wx + frei[0] * (ZELLE / 2 + 0.7), 0.03, wz + frei[1] * (ZELLE / 2 + 0.7)), s: new THREE.Vector3(1.5, 1, 1.5) });
    } else if (frei && wahl === 1 && e.art[(y + frei[1]) * e.b + x + frei[0]] === WEG) {
      // Bank im Flur, flach an der Wand
      const mx = wx + frei[0] * (ZELLE / 2 + 0.24), mz = wz + frei[1] * (ZELLE / 2 + 0.24);
      baenke.push({ p: new THREE.Vector3(mx, 0.42, mz), s: new THREE.Vector3(frei[0] ? 0.42 : 1.2, 0.09, frei[1] ? 0.42 : 1.2) });
      for (const s2 of [-0.5, 0.5]) baenke.push({ p: new THREE.Vector3(mx + (frei[0] ? 0 : s2), 0.2, mz + (frei[1] ? 0 : s2)), s: new THREE.Vector3(frei[0] ? 0.36 : 0.09, 0.4, frei[1] ? 0.36 : 0.09) });
    } else if (frei && wahl === 3) {
      // Fenster: Rahmen und helle Scheibe
      rahmen.push(anWand(wx, wz, frei, 2.0, 1.05, 1.3, 0.1));
      scheiben.push(anWand(wx, wz, frei, 2.0, 0.85, 1.1, 0.12, 0.05));
      // das Fenster wirft einen hellen Fleck auf den Boden
      flecken.push({ p: new THREE.Vector3(wx + frei[0] * (ZELLE / 2 + 1.3), 0.035, wz + frei[1] * (ZELLE / 2 + 1.3)), s: new THREE.Vector3(frei[0] ? 2.0 : 1.0, 1, frei[1] ? 2.0 : 1.0) });
    } else if (frei && wahl === 5) {
      rahmen.push(anWand(wx, wz, frei, 1.95, 0.8, 0.62, 0.08));
      bilder.push({ ...anWand(wx, wz, frei, 1.95, 0.66, 0.48, 0.1, 0.045), f: farbe(aus(BILD, r)) });
    }
    if (frei && F.leuchten) streifen.push(anWand(wx, wz, frei, 0.1, ZELLE, 0.08, 0.06, 0.07));
    const kante = H + Math.max(0.1, F.obenH * 1.5);
    if (A.ecken === "zinne" && (x + y) % 2 === 0) zinnen.push({ p: new THREE.Vector3(wx, kante + 0.25, wz), s: new THREE.Vector3(ZELLE * 0.62, 0.5, ZELLE * 0.62) });
    if ((A.ecken === "spitze" || A.ecken === "kristall") && (x + y) % 3 === 0) {
      const h = 0.9 + r() * 0.7;
      spitzen.push({ p: new THREE.Vector3(wx, kante + h / 2, wz), s: new THREE.Vector3(1, h, 1) });
    }
  }
  // oben heller Putz im Muster des Stils, unten ein Sockel in der Wandfarbe
  g.add(reihe(wuerfel, musterMaterial(farbe(F.wand).lerp(farbe(F.boden), 0.45).getHex(), A.wand, 2.2), waende));
  g.add(reihe(wuerfel, new THREE.MeshLambertMaterial({ color: F.wand }), sockel));
  g.add(reihe(wuerfel, new THREE.MeshLambertMaterial({ color: F.oben }), leisten));
  // der Sturz gehört zur Mauer (heller Putz); nur die Pfosten tragen die Türfarbe
  g.add(reihe(wuerfel, musterMaterial(farbe(F.wand).lerp(farbe(F.boden), 0.45).getHex(), A.wand, 2.2), stuerze));
  g.add(reihe(wuerfel, new THREE.MeshLambertMaterial({ color: F.tuer }), pfosten));
  g.add(reihe(wuerfel, new THREE.MeshLambertMaterial({ color: F.tuer }), rahmen, false));
  const tag = dunkel ? 0x2a3350 : 0xcfe8ff;
  g.add(reihe(wuerfel, new THREE.MeshLambertMaterial({ color: tag, emissive: tag, emissiveIntensity: dunkel ? 0.6 : 0.9 }), scheiben, false));
  g.add(reihe(wuerfel, new THREE.MeshLambertMaterial({ color: 0xffffff }), bilder, false));
  g.add(reihe(wuerfel, new THREE.MeshLambertMaterial({ color: 0x7a5230 }), regale));
  g.add(reihe(wuerfel, new THREE.MeshLambertMaterial({ color: 0xffffff }), buecher, false));
  g.add(reihe(wuerfel, new THREE.MeshLambertMaterial({ color: F.wand }), zinnen));
  const eis = A.ecken === "kristall";
  g.add(reihe(new THREE.ConeGeometry(eis ? 0.2 : 0.32, 1, eis ? 5 : 4), new THREE.MeshLambertMaterial(eis ? { color: 0xe0f2fe, emissive: 0x38bdf8, emissiveIntensity: 0.5 } : { color: F.oben }), spitzen));
  const neon = F.licht ?? 0xff3b3b;
  g.add(reihe(wuerfel, new THREE.MeshLambertMaterial({ color: neon, emissive: neon, emissiveIntensity: 2.4 }), streifen, false));
  g.add(reihe(wuerfel, new THREE.MeshLambertMaterial({ color: 0x7a5230 }), baenke));
  const schein = F.licht ?? 0xffdf9e;
  {
    const hell = (farbwert: number, deckung: number) => new THREE.MeshBasicMaterial({ color: farbwert, transparent: true, opacity: deckung, blending: THREE.AdditiveBlending, depthWrite: false });
    const fleck = new THREE.PlaneGeometry(1, 1);
    fleck.rotateX(-Math.PI / 2);
    const kreis = new THREE.CircleGeometry(1, 20);
    kreis.rotateX(-Math.PI / 2);
    for (const m of [
      reihe(fleck, hell(dunkel ? 0x6a7ab8 : 0xfff2cc, dunkel ? 0.18 : 0.3), flecken, false),
      reihe(kreis, hell(schein, dunkel ? 0.3 : 0.14), lichtkreise, false),
      reihe(new THREE.SphereGeometry(0.5, 12, 8), hell(schein, dunkel ? 0.45 : 0.22), halos, false),
    ]) { m.receiveShadow = false; g.add(m); }
  }
  g.add(reihe(wuerfel, new THREE.MeshLambertMaterial({ color: schein, emissive: schein, emissiveIntensity: dunkel ? 2.2 : 1.1 }), lampen, false));

  // Topfpflanzen in den Ecken der Zimmer
  const toepfe: Stueck[] = [], gruen: Stueck[] = [], saeulen: Stueck[] = [];
  const hoch = new THREE.Vector3(0, 1, 0);
  for (const p of e.raeume) for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    if (r() < 0.35) continue;
    const wx = feldMitte(p.x + sx * p.r) + sx * 0.25, wz = feldMitte(p.y + sy * p.r) + sy * 0.25;
    if (A.ecken === "saeule") { saeulen.push({ p: new THREE.Vector3(wx, (H + 0.3) / 2, wz), s: new THREE.Vector3(1, H + 0.3, 1) }); continue; }
    toepfe.push({ p: new THREE.Vector3(wx, 0.3, wz), s: new THREE.Vector3(0.6, 0.6, 0.6) });
    const breit = 0.9 + r() * 0.4;
    gruen.push({ p: new THREE.Vector3(wx, 1.1 + r() * 0.3, wz), s: new THREE.Vector3(breit, 1.2 + r() * 0.6, breit), q: new THREE.Quaternion().setFromAxisAngle(hoch, r() * 6), f: farbe(aus([0x3f7a2a, 0x5a8f2f, 0x2f6a3a], r)) });
  }
  g.add(reihe(new THREE.CylinderGeometry(0.42, 0.3, 1, 10), new THREE.MeshLambertMaterial({ color: 0xb4623a }), toepfe));
  g.add(reihe(new THREE.CylinderGeometry(0.3, 0.36, 1, 14), musterMaterial(F.stuetze, "marmor", 1.6), saeulen));
  // Staub tanzt im Licht
  const luft = schweben(e, r, { farben: [dunkel ? schein : 0xfff2cc, 0xffffff], anzahl: 180, groesse: 0.06, fall: 0.04, hoehe: 3.2, leuchtet: true });
  g.add(luft.punkte);
  g.add(reihe(felsGeometrie(), new THREE.MeshLambertMaterial({ color: 0xffffff }), gruen));

  return {
    // die Kamera bleibt immer diesseits der Mauern: von oben verdeckte die Mauerkrone die Figur
    gruppe: g, wandHoehe: 99, takt: luft.takt,
    stimmung: dunkel
      ? { himmelOben: oben, himmelUnten: unten, nebel: 0x0b0d14, dichte: 0.026, sonne: 0x9fb4ff, sonneStaerke: 0.35, sonneVon: [-0.3, 1, 0.25], oben: 0x8a94c0, unten: 0x2a2420, umgebung: 0.7, fackel: 40, belichtung: 1.15 }
      : { himmelOben: oben, himmelUnten: unten, nebel: unten, dichte: 0.008, sonne: 0xffe9c4, sonneStaerke: 2.4, sonneVon: [-0.45, 1, 0.3], oben: 0xffffff, unten: 0xb89a7a, umgebung: 1.25, fackel: 0, belichtung: 0.95 },
  };
}

// ── Garten ───────────────────────────────────────────────────────────────

const GARTEN = {
  kies: [0xe6d9b8, 0xd9caa4, 0xefe4c8, 0xcdbd96],
  rasen: [0x7fb04a, 0x8cbc52, 0x72a544, 0x9ac65c],
  beet: [0x5e8a3a, 0x6c9840, 0x53803a, 0x7aa548],
  hecke: [0x3f7a34, 0x4a8a3a, 0x35692e, 0x578f3e],
  blueten: [0xf2668b, 0xffd24a, 0xffffff, 0xb07cf0, 0xff8f3c, 0xe63946],
  krone: [0x5a9a3c, 0x6fae44, 0x4a8a3a, 0x86bb4e, 0xf0a8c0],
  stamm: [0x7a5a40, 0x8a6a4c, 0x6a4c38],
  wasser: [0x6fc3e8, 0x8fd4f0, 0x58b0dc],
};

/** Formaler Garten: geschnittene Hecken, Kieswege, Rasenplätze mit Beeten, Teiche und Bäume hinter den Hecken */
function gartenLandschaft(e: FreiEbene, seed: number): Landschaft {
  const g = new THREE.Group();
  const r = zufallAus(seed * 17 + 9);
  const RAND = 6;
  const { t, B } = tiefen(e, RAND);
  const tiefeBei = (x: number, y: number) => t[(y + RAND) * B + x + RAND];
  g.add(himmel(0x5fa8ee, 0xdcecf7, "garten"));
  g.add(umland(e, 0x7fb04a));
  // Teiche hinter den Hecken: dort, wo ringsum genug Platz ist
  const teiche: [number, number, number][] = [];
  for (let y = 2; y < e.h - 2; y++) for (let x = 2; x < e.b - 2; x++) {
    if (tiefeBei(x, y) >= 3 && r() < 0.08 && teiche.every(([tx, ty]) => Math.hypot(tx - x, ty - y) > 7)) teiche.push([x, y, 1.1 + r() * 0.7]);
  }
  g.add(boden(e, (ctx, px) => {
    striche(ctx, e, px, r, 6, a => (a === WAND ? GARTEN.beet : a === PLATZ ? GARTEN.rasen : GARTEN.kies));
    // Plätze: Kiesring um die Mitte, dazu ein Rondell mit Blüten
    for (const [x, y] of [...e.raeume.map(p => [p.x, p.y]), e.start, e.ziel]) {
      ctx.lineWidth = px * 0.9;
      ctx.strokeStyle = css(GARTEN.kies[0]);
      ctx.beginPath();
      ctx.arc((x + 0.5) * px, (y + 0.5) * px, px * 3.4, 0, Math.PI * 2);
      ctx.stroke();
      for (let k = 0; k < 46; k++) {
        const a = r() * Math.PI * 2, ab = px * (4.2 + r() * 0.7);
        ctx.fillStyle = css(aus(GARTEN.blueten, r));
        ctx.beginPath();
        ctx.arc((x + 0.5) * px + Math.cos(a) * ab, (y + 0.5) * px + Math.sin(a) * ab, px * (0.1 + r() * 0.1), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    for (const [x, y, gross] of teiche) {
      ctx.fillStyle = css(GARTEN.kies[1]);
      ctx.beginPath();
      ctx.ellipse((x + 0.5) * px, (y + 0.5) * px, px * (gross + 0.3), px * (gross * 0.8 + 0.3), 0, 0, Math.PI * 2);
      ctx.fill();
      for (let k = 0; k < 5; k++) strich(ctx, (x + 0.5) * px, (y + 0.5) * px, px * gross * (1 - k * 0.15), px * gross * 0.8 * (1 - k * 0.15), 0, css(aus(GARTEN.wasser, r)), 0.9);
    }
  }, 0x7fb04a));

  const hecken: Stueck[] = [], kuppen: Stueck[] = [], staemme: Stueck[] = [], kronen: Stueck[] = [], blumen: Stueck[] = [], graeser: Stueck[] = [];
  const balken: Stueck[] = [], vasen: Stueck[] = [];
  const hoch = new THREE.Vector3(0, 1, 0);
  const dreh = () => new THREE.Quaternion().setFromAxisAngle(hoch, r() * Math.PI * 2);
  const H = 2.0;
  for (let Y = 0; Y < B; Y++) for (let X = 0; X < B; X++) {
    const tiefe = t[Y * B + X], x = X - RAND, y = Y - RAND;
    const wx = feldMitte(x), wz = feldMitte(y);
    if (tiefe === 0) {
      if (e.art[y * e.b + x] === DURCHGANG) {
        // Laube über dem Durchgang
        // die Heckenlinie läuft dort entlang, wo nebenan Hecke oder wieder Durchgang ist
        const inLinie = (dx: number, dy: number) => !istFrei(e, x + dx, y + dy) || e.art[(y + dy) * e.b + x + dx] === DURCHGANG;
        const laengsX = inLinie(1, 0) || inLinie(-1, 0);
        for (const s of [-0.45, 0.45]) {
          // zwei Holme längs, dazu Sprossen quer
          balken.push({ p: new THREE.Vector3(wx + (laengsX ? 0 : s), 2.75, wz + (laengsX ? s : 0)), s: new THREE.Vector3(laengsX ? ZELLE : 0.12, 0.12, laengsX ? 0.12 : ZELLE) });
          balken.push({ p: new THREE.Vector3(wx + (laengsX ? s * 0.8 : 0), 2.86, wz + (laengsX ? 0 : s * 0.8)), s: new THREE.Vector3(laengsX ? 0.09 : 1.3, 0.09, laengsX ? 1.3 : 0.09) });
          // Pfosten nur am Ende der Laube, wo die Hecke anschließt
          for (const d of [-1, 1]) {
            if (istFrei(e, x + (laengsX ? d : 0), y + (laengsX ? 0 : d))) continue;
            balken.push({ p: new THREE.Vector3(wx + (laengsX ? d * (ZELLE / 2 - 0.1) : s), 1.38, wz + (laengsX ? s : d * (ZELLE / 2 - 0.1))), s: new THREE.Vector3(0.16, 2.76, 0.16) });
          }
        }
        if (r() < 0.7) blumen.push({ p: new THREE.Vector3(wx + (r() - 0.5), 2.9, wz + (r() - 0.5)), s: new THREE.Vector3().setScalar(0.45 + r() * 0.3), q: dreh(), f: farbe(aus(GARTEN.blueten, r)) });
        continue;
      }
      // Blumen am Fuß der Hecken
      let anHecke: [number, number] | null = null;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!istFrei(e, x + dx, y + dy)) anHecke = [dx, dy];
      if (anHecke && r() < 0.45) {
        for (let k = 0; k < 3; k++) {
          const quer = (r() - 0.5) * ZELLE;
          blumen.push({
            p: new THREE.Vector3(wx + anHecke[0] * 0.5 + (anHecke[0] ? 0 : quer), 0.22 + r() * 0.15, wz + anHecke[1] * 0.5 + (anHecke[1] ? 0 : quer)),
            s: new THREE.Vector3().setScalar(0.2 + r() * 0.16), q: dreh(), f: farbe(aus(GARTEN.blueten, r)),
          });
        }
        graeser.push({ p: new THREE.Vector3(wx + anHecke[0] * 0.5, 0, wz + anHecke[1] * 0.5), s: new THREE.Vector3().setScalar(0.9 + r() * 0.5), q: dreh(), f: farbe(aus(GARTEN.beet, r)) });
      }
      continue;
    }
    if (tiefe === 1) {
      // geschnittene Hecke, obenauf eine runde Kuppe
      hecken.push({ p: new THREE.Vector3(wx, H / 2, wz), s: new THREE.Vector3(ZELLE + 0.04, H, ZELLE + 0.04), f: farbe(aus(GARTEN.hecke, r)).multiplyScalar(0.9 + r() * 0.2) });
      kuppen.push({ p: new THREE.Vector3(wx, H - 0.05, wz), s: new THREE.Vector3(ZELLE * 1.15, 0.55 + r() * 0.2, ZELLE * 1.15), q: dreh(), f: farbe(aus(GARTEN.hecke, r)).multiplyScalar(1.0 + r() * 0.25) });
      continue;
    }
    const imTeich = teiche.some(([tx, ty, gross]) => Math.hypot(tx - x, ty - y) < gross + 1);
    if (imTeich) continue;
    // hinter den Hecken: Bäume mit runder Krone, Blumenbüsche
    if (r() < (tiefe <= 3 ? 0.16 : 0.28)) {
      const h = 2.6 + r() * 1.8, breit = 2.2 + r() * 1.6;
      staemme.push({ p: new THREE.Vector3(wx, -0.05, wz), s: new THREE.Vector3(0.16 + r() * 0.08, h, 0.16 + r() * 0.08), q: dreh(), f: farbe(aus(GARTEN.stamm, r)) });
      kronen.push({ p: new THREE.Vector3(wx, h + breit * 0.3, wz), s: new THREE.Vector3(breit, breit * (0.85 + r() * 0.3), breit), q: dreh(), f: farbe(aus(GARTEN.krone, r)).multiplyScalar(0.9 + r() * 0.25) });
    } else if (r() < 0.3) {
      const breit = 0.7 + r() * 0.6;
      kronen.push({ p: new THREE.Vector3(wx + (r() - 0.5) * 0.6, breit * 0.35, wz + (r() - 0.5) * 0.6), s: new THREE.Vector3(breit, breit * 0.8, breit), q: dreh(), f: farbe(aus(GARTEN.hecke, r)).multiplyScalar(1.1) });
      for (let k = 0; k < 4; k++) {
        blumen.push({ p: new THREE.Vector3(wx + (r() - 0.5) * 1.1, breit * 0.55 + r() * 0.2, wz + (r() - 0.5) * 1.1), s: new THREE.Vector3().setScalar(0.18 + r() * 0.14), q: dreh(), f: farbe(aus(GARTEN.blueten, r)) });
      }
    }
  }
  // Steinvasen mit Blumen in den Ecken der Plätze
  for (const p of e.raeume) for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    const wx = feldMitte(p.x + sx * p.r) + sx * 0.2, wz = feldMitte(p.y + sy * p.r) + sy * 0.2;
    vasen.push({ p: new THREE.Vector3(wx, 0.45, wz), s: new THREE.Vector3(0.7, 0.9, 0.7) });
    for (let k = 0; k < 5; k++) {
      blumen.push({ p: new THREE.Vector3(wx + (r() - 0.5) * 0.6, 1.0 + r() * 0.3, wz + (r() - 0.5) * 0.6), s: new THREE.Vector3().setScalar(0.22 + r() * 0.14), q: dreh(), f: farbe(aus(GARTEN.blueten, r)) });
    }
  }
  const weiss = () => new THREE.MeshLambertMaterial({ color: 0xffffff });
  g.add(reihe(wuerfel, weiss(), hecken));
  g.add(reihe(felsGeometrie(), weiss(), kuppen));
  g.add(reihe(stammGeometrie(), weiss(), staemme));
  g.add(reihe(felsGeometrie(), weiss(), kronen));
  g.add(reihe(felsGeometrie(), weiss(), blumen, false));
  g.add(reihe(bueschelGeometrie(), weiss(), graeser, false));
  g.add(reihe(wuerfel, new THREE.MeshLambertMaterial({ color: 0xf4efe2 }), balken));
  g.add(reihe(new THREE.CylinderGeometry(0.5, 0.28, 1, 12), new THREE.MeshLambertMaterial({ color: 0xd9d2c0 }), vasen));
  // Blütenblätter treiben durch den Garten
  const luft = schweben(e, r, { farben: [0xf7b8d0, 0xffffff, 0xffd9e6], anzahl: 220, groesse: 0.1, fall: 0.35, hoehe: 5, leuchtet: false });
  g.add(luft.punkte);
  return {
    takt: luft.takt,
    gruppe: g, wandHoehe: 0,
    stimmung: {
      himmelOben: 0x5fa8ee, himmelUnten: 0xdcecf7, nebel: 0xdcecf7, dichte: 0.006,
      sonne: 0xfff0cf, sonneStaerke: 3.0, sonneVon: [-0.5, 0.8, 0.35],
      oben: 0xcfe4ff, unten: 0x7da045, umgebung: 1.1, fackel: 0, belichtung: 0.95,
    },
  };
}

export function baueLandschaft(e: FreiEbene, stil: Stil, seed: number): Landschaft {
  const w = weltVon(stil);
  if (w === "pilze") { const p = pilzwaldLandschaft(e, seed); if (p) return p; }
  return w === "wald" || w === "winter" || w === "oase" || w === "pilze" ? waldLandschaft(e, seed, w) : w === "garten" ? gartenLandschaft(e, seed)
    : w === "hoehle" ? hoehleLandschaft(e, stil, seed) : gebaeudeLandschaft(e, stil, seed);
}

// ── Stationen, Tor, Rückweg ──────────────────────────────────────────────

const RAUM_FARBE: Record<RaumZustand, number> = { offen: 0xf59e0b, geloest: 0x22c55e, info: 0x60a5fa, gelesen: 0x94a3b8 };

export interface OrteBild {
  zustaende: RaumZustand[];
  zielOffen: boolean;
  zielArt: "weiter" | "ausgang";
  objekte?: Objekt[];
  stil: Stil;
  /** gibt es einen Rückweg (nicht im ersten Abschnitt)? */
  mitZurueck: boolean;
  /** ein Boss bewacht das Tor */
  waechter: boolean;
  /** Nummer des Abschnitts: wählt die Monster aus */
  abschnitt: number;
}

export interface Marke { ort: FreiOrt; text: string; ton: "offen" | "geloest" | "info" | "gelesen" | "zu" | "weiter"; x: number; y: number; z: number }

/** Leuchtender Ring am Boden und eine Lichtsäule: von Weitem zu sehen */
function leuchtfeuer(g: THREE.Group, f: number, saeule: boolean) {
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.55, 1.85, 40), new THREE.MeshBasicMaterial({ color: f, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.04;
  g.add(ring);
  if (!saeule) return;
  const s = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 16, 8, 1, true),
    new THREE.MeshBasicMaterial({ color: f, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  s.position.y = 8;
  g.add(s);
}

/** Tor aus zwei Pfosten und einem Sturz; dazwischen schimmert es rot (zu) oder grün (offen) */
function tor(g: THREE.Group, stein: number, schein: number, breit = 2.6, hoehe = 3.4) {
  const mat = new THREE.MeshLambertMaterial({ color: stein });
  for (const s of [-1, 1]) {
    const p = new THREE.Mesh(wuerfel, mat);
    p.scale.set(0.5, hoehe, 0.6);
    p.position.set(s * (breit / 2 + 0.25), hoehe / 2, 0);
    p.castShadow = true;
    g.add(p);
  }
  const sturz = new THREE.Mesh(wuerfel, mat);
  sturz.scale.set(breit + 1.3, 0.5, 0.7);
  sturz.position.y = hoehe + 0.25;
  sturz.castShadow = true;
  g.add(sturz);
  const flaeche = new THREE.Mesh(new THREE.PlaneGeometry(breit, hoehe),
    new THREE.MeshBasicMaterial({ color: schein, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  flaeche.position.y = hoehe / 2;
  g.add(flaeche);
}

/** Erzader: grauer Fels mit blauen Kristallen; `leer` = abgebaut, nur Geröll und ein Splitter bleiben */
function erz(leer: boolean, r: () => number): THREE.Group {
  const g = new THREE.Group();
  const fels = new THREE.MeshLambertMaterial({ color: 0x6b7280 });
  const kristall = new THREE.MeshLambertMaterial({ color: 0x93c5fd, emissive: 0x3b82f6, emissiveIntensity: leer ? 0.5 : 1.3 });
  const brocken = (x: number, y: number, z: number, b: number, h: number) => {
    const m = new THREE.Mesh(felsGeometrie(), fels);
    m.position.set(x, y, z);
    m.scale.set(b, h, b * (0.8 + r() * 0.4));
    m.rotation.y = r() * 6;
    m.castShadow = true;
    g.add(m);
  };
  const zacke = (x: number, y: number, z: number, h: number, kippX: number, kippZ: number) => {
    const m = new THREE.Mesh(new THREE.ConeGeometry(0.16, h, 5), kristall);
    m.position.set(x, y + h / 2, z);
    m.rotation.set(kippX, r() * 6, kippZ);
    g.add(m);
  };
  if (leer) {
    for (let k = 0; k < 5; k++) brocken((r() - 0.5) * 1.3, 0.12, (r() - 0.5) * 1.3, 0.35 + r() * 0.3, 0.25 + r() * 0.15);
    zacke(0, 0.1, 0, 0.5, 0.3, 0.2);
    return g;
  }
  brocken(0, 0.55, 0, 1.5, 1.2);
  brocken(0.5, 0.3, 0.4, 0.9, 0.7);
  brocken(-0.55, 0.3, -0.3, 0.8, 0.6);
  for (let k = 0; k < 7; k++) {
    const a = r() * Math.PI * 2, ab = 0.2 + r() * 0.45;
    zacke(Math.cos(a) * ab, 0.7 + r() * 0.3, Math.sin(a) * ab, 0.6 + r() * 0.6, Math.sin(a) * 0.6, -Math.cos(a) * 0.6);
  }
  return g;
}

export function baueOrte(e: FreiEbene, bild: OrteBild): { gruppe: THREE.Group; marken: Marke[] } {
  const g = new THREE.Group();
  const marken: Marke[] = [];
  const w = weltVon(bild.stil);
  const stein = w === "wald" ? 0x7a5638 : w === "garten" ? 0xe8e2d2 : w === "winter" ? 0x8fa3b8 : w === "oase" ? 0xc9a56c : w === "pilze" ? 0x6a5acd : w === "hoehle" ? farbe(STILE[bild.stil].wand).multiplyScalar(1.5).getHex() : STILE[bild.stil].tuer;

  e.raeume.forEach((p, k) => {
    const zg = new THREE.Group();
    zg.userData.ort = { art: "raum", raum: k } satisfies FreiOrt;
    zg.position.set(feldMitte(p.x), 0, feldMitte(p.y));
    const z = bild.zustaende[k] ?? "offen";
    leuchtfeuer(zg, RAUM_FARBE[z], z === "offen" || z === "info");
    if (z === "info" || z === "gelesen") {
      // Erklärungen stecken als Info-Splitter im Erz: erst abbauen, dann lesen
      const ader = erz(z === "gelesen", zufallAus(k * 31 + bild.abschnitt * 7 + 1));
      zg.userData.erz = ader;
      zg.add(ader);
    } else {
      const ding = baueObjekt(bild.objekte?.[k] ?? "pult", z === "geloest", k + bild.abschnitt * 3);
      ding.scale.setScalar(1.5);
      ding.rotation.y = k * 1.3;
      ding.traverse(o => { o.castShadow = true; });
      zg.userData.ding = ding;
      zg.add(ding);
    }
    g.add(zg);
    marken.push({ ort: { art: "raum", raum: k }, text: z === "info" ? "⛏" : z === "gelesen" ? "i" : String(k + 1), ton: z, x: zg.position.x, y: 3.4, z: zg.position.z });
  });

  const zg = new THREE.Group();
  zg.userData.ort = { art: "ziel" } satisfies FreiOrt;
  zg.position.set(feldMitte(e.ziel[0]), 0, feldMitte(e.ziel[1]));
  const offen = bild.zielOffen;
  tor(zg, stein, offen ? 0x22c55e : 0xe11d48);
  leuchtfeuer(zg, offen ? 0x22c55e : 0xe11d48, true);
  if (bild.waechter) {
    // der Boss steht neben dem Tor; ist es offen, liegt er besiegt da
    const boss = baueObjekt("boss", offen, bild.abschnitt);
    boss.scale.setScalar(1.5);
    boss.position.set(offen ? 2.6 : 0, 0, offen ? 0.5 : 1.6);
    boss.traverse(o => { o.castShadow = true; });
    zg.userData.ding = boss;
    zg.add(boss);
  }
  g.add(zg);
  marken.push({ ort: { art: "ziel" }, text: offen ? (bild.zielArt === "ausgang" ? "EXIT" : "➡") : "🔒", ton: offen ? "weiter" : "zu", x: zg.position.x, y: 4.6, z: zg.position.z });

  if (bild.mitZurueck) {
    const rg = new THREE.Group();
    rg.userData.ort = { art: "zurueck" } satisfies FreiOrt;
    rg.position.set(feldMitte(e.start[0]), 0, feldMitte(e.start[1]));
    tor(rg, stein, 0x94a3b8, 2.2, 2.8);
    leuchtfeuer(rg, 0x94a3b8, false);
    g.add(rg);
    marken.push({ ort: { art: "zurueck" }, text: "⬅", ton: "gelesen", x: rg.position.x, y: 3.9, z: rg.position.z });
  }
  return { gruppe: g, marken };
}
