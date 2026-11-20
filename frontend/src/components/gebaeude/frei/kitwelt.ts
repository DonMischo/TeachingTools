/**
 * Gemeinsames für Welten aus den Baukästen der Weltenwerkstatt (pilzwald.ts, hoehlenwelt.ts):
 * Gelände mit Bachsenke, Wasserfläche, Aufstellen fertig gefärbter Modelle als InstancedMesh,
 * Brückenhöhe für die Figur und ein kleiner Vorrat an Punktlichtern, der der Figur folgt.
 */
import * as THREE from "three";
import { WAND, ZELLE, type FreiEbene } from "@/lib/gebaeude/frei";
import type { KitTeil } from "./modelle";

const Z = ZELLE;

/**
 * Bodenhöhe je Weltpunkt: Bachfelder als Senke (`bett`, am Ufer flacher), Wandfelder als sanfte
 * Hügel (`huegel`, nach innen ansteigend), freie Felder flach auf 0.
 * `t`/`B`/`rand`: Tiefen aus `tiefen()` (Abstand ins Wandfeld).
 */
export function bachGelaende(e: FreiEbene, t: Uint8Array, B: number, rand: number, seed: number, bett: number, huegel: number) {
  const wasser = e.wasser;
  const wTiefe = new Uint8Array(e.b * e.h);
  if (wasser) {
    const offen: number[] = [];
    for (let i = 0; i < wasser.length; i++) if (wasser[i]) wTiefe[i] = 9; else offen.push(i);
    for (let k = 0; k < offen.length; k++) {
      const i = offen[k], x = i % e.b, y = (i - x) / e.b;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, j = ny * e.b + nx;
        if (nx < 0 || ny < 0 || nx >= e.b || ny >= e.h) continue;
        if (wTiefe[j] > wTiefe[i] + 1) { wTiefe[j] = wTiefe[i] + 1; offen.push(j); }
      }
    }
  }
  const welle = (x: number, y: number) => 0.5 + 0.25 * Math.sin(x * 0.37 + seed) * Math.cos(y * 0.29 - seed * 0.5) + 0.25 * Math.sin((x + y) * 0.17);
  const zellH = new Float32Array(e.b * e.h);
  for (let y = 0; y < e.h; y++) for (let x = 0; x < e.b; x++) {
    const i = y * e.b + x;
    if (wasser?.[i]) zellH[i] = wTiefe[i] <= 1 ? bett * 0.6 : bett;
    else if (e.art[i] === WAND) zellH[i] = huegel * welle(x, y) * Math.min(1, (t[(y + rand) * B + x + rand] - 1) / 3);
  }
  const zelleH = (x: number, y: number) => zellH[Math.max(0, Math.min(e.h - 1, y)) * e.b + Math.max(0, Math.min(e.b - 1, x))];
  const gelaende = (wx: number, wz: number) => {
    const u = wx / Z - 0.5, v = wz / Z - 0.5, x0 = Math.floor(u), y0 = Math.floor(v), fx = u - x0, fy = v - y0;
    return (zelleH(x0, y0) * (1 - fx) + zelleH(x0 + 1, y0) * fx) * (1 - fy) + (zelleH(x0, y0 + 1) * (1 - fx) + zelleH(x0 + 1, y0 + 1) * fx) * fy;
  };
  const istWasser = (x: number, y: number) => !!wasser && x >= 0 && y >= 0 && x < e.b && y < e.h && wasser[y * e.b + x] === 1;
  return { gelaende, wTiefe, istWasser };
}

/** Wasserfläche über allen Bachfeldern in Höhe `y` */
export function wasserFlaeche(e: FreiEbene, y: number, mat: THREE.Material): THREE.Mesh | null {
  if (!e.wasser) return null;
  const ecken: number[] = [];
  for (let fy = 0; fy < e.h; fy++) for (let fx = 0; fx < e.b; fx++) {
    if (!e.wasser[fy * e.b + fx]) continue;
    const x0 = (fx - 0.08) * Z, x1 = (fx + 1.08) * Z, z0 = (fy - 0.08) * Z, z1 = (fy + 1.08) * Z;
    ecken.push(x0, y, z0, x0, y, z1, x1, y, z0, x1, y, z0, x0, y, z1, x1, y, z1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(ecken, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat);
  m.receiveShadow = true;
  return m;
}

interface Platz { p: THREE.Vector3; q: THREE.Quaternion; s: THREE.Vector3 }

/**
 * Stellt Modelle eines Baukastens auf: `setze` merkt alle Teile eines Modells vor, `fertig` baut je Teil
 * eine InstancedMesh. `fuss`: Radius der Grundfläche je Modell, damit nichts ineinander wächst (`frei`).
 */
export function kitAufsteller(K: Record<string, KitTeil>, boden: (x: number, z: number) => number, fuss: Record<string, number> = {}) {
  const platziert = new Map<string, Platz[]>();
  const belegt: [number, number, number][] = [];
  const hoch = new THREE.Vector3(0, 1, 0);
  const teileVon = new Map<string, string[]>();
  const frei = (x: number, z: number, rad: number) => belegt.every(([bx, bz, br]) => Math.hypot(bx - x, bz - z) > (br + rad) * 0.72);
  /** ein Modell (alle seine Teile) bei (x, z), um `w` gedreht, skaliert (Zahl oder je Achse); `y` sonst Bodenhöhe */
  const setze = (modell: string, x: number, z: number, w: number, s: number | THREE.Vector3 = 1, y?: number): boolean => {
    let teile = teileVon.get(modell);
    if (!teile) teileVon.set(modell, teile = Object.keys(K).filter(k => k.startsWith(`${modell}_`)));
    if (!teile.length) return false;
    const p = new THREE.Vector3(x, y ?? boden(x, z), z), q = new THREE.Quaternion().setFromAxisAngle(hoch, w);
    const sk = typeof s === "number" ? new THREE.Vector3(s, s, s) : s;
    for (const k of teile) {
      let liste = platziert.get(k);
      if (!liste) platziert.set(k, liste = []);
      liste.push({ p, q, s: sk });
    }
    if (fuss[modell]) belegt.push([x, z, fuss[modell] * Math.max(sk.x, sk.z)]);
    return true;
  };
  /**
   * Alles in die Gruppe. `stoff(teil)` wählt das Material (leuchtende, blattartige …), `wirft(teil)`
   * sagt, wer Schatten wirft (große Dinge; Kleinkram nicht, das spart viel).
   */
  const fertig = (g: THREE.Group, stoff: (name: string, teil: KitTeil) => THREE.Material, wirft: (name: string, teil: KitTeil) => boolean) => {
    const mx = new THREE.Matrix4();
    for (const [k, liste] of platziert) {
      const teil = K[k];
      const im = new THREE.InstancedMesh(teil.geo, stoff(k, teil), liste.length);
      liste.forEach((s, i) => im.setMatrixAt(i, mx.compose(s.p, s.q, s.s)));
      im.castShadow = wirft(k, teil);
      im.receiveShadow = !teil.glut;
      im.frustumCulled = false;
      g.add(im);
    }
  };
  return { setze, frei, fertig };
}

/** Höhe der Lauffläche über den Brücken (Modell `steinbruecke1`: 9,8 m lang, Scheitel 1,55 m) */
export function brueckenHoehe(bruecken: { x: number; z: number; w: number }[]): ((x: number, z: number) => number) | undefined {
  if (!bruecken.length) return undefined;
  return (x, z) => {
    let h = 0;
    for (const b of bruecken) {
      const dx = x - b.x, dz = z - b.z, c = Math.cos(b.w), s = Math.sin(b.w);
      const laengs = dx * c + dz * s, quer = -dx * s + dz * c;
      if (Math.abs(quer) < 2.4 && Math.abs(laengs) < 4.9) h = Math.max(h, 0.12 + 1.43 * (1 - (laengs / 4.9) ** 2));
    }
    return h;
  };
}

/** Brücken der Karte in Weltkoordinaten (Längsachse = Pfadrichtung) */
export const brueckenAus = (e: FreiEbene) => (e.bruecken ?? []).map(b => ({ x: b.x * Z, z: b.y * Z, w: b.winkel }));

/**
 * Ein paar Punktlichter, die zu den nächsten leuchtenden Orten wandern (nur in der Nähe der Figur);
 * gibt die Funktion für `Landschaft.lichter` zurück.
 */
export function lichtVorrat(g: THREE.Group, orte: { p: THREE.Vector3; f: number; staerke?: number }[], anzahl = 4, weit = 11): ((x: number, z: number, zeit: number) => void) | undefined {
  if (!orte.length) return undefined;
  const lampen = Array.from({ length: anzahl }, () => { const l = new THREE.PointLight(0xffffff, 0, weit, 1.6); g.add(l); return l; });
  return (x, z, zeit) => {
    const nah = orte.map(o => ({ o, d: (o.p.x - x) ** 2 + (o.p.z - z) ** 2 })).sort((a, b) => a.d - b.d);
    lampen.forEach((l, i) => {
      const n = nah[i];
      if (!n || n.d > 22 * 22) { l.intensity = 0; return; }
      l.position.copy(n.o.p);
      l.color.setHex(n.o.f);
      l.intensity = (n.o.staerke ?? 7) * (1 + Math.sin(zeit * 1.3 + n.o.p.x) * 0.15);
    });
  };
}

// ── Gebäude aus Wandmodulen (Tempel, Neon-Halle) ─────────────────────────

/** eine Kante zwischen Wandfeld und Gang: Mitte (Welt), Richtung zum Gang, liegt sie an einer Halle? */
export interface WandKante { x: number; z: number; dx: number; dy: number; halle: boolean }

const VIER: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** alle Kanten Wandfeld/Gang; dort steht je ein Modul mit der Grundlinie auf der Zellkante */
export function wandKanten(e: FreiEbene, istHalle: (art: number) => boolean): WandKante[] {
  const frei = (x: number, y: number) => x >= 0 && y >= 0 && x < e.b && y < e.h && e.art[y * e.b + x] !== WAND;
  const aus: WandKante[] = [];
  for (let y = 0; y < e.h; y++) for (let x = 0; x < e.b; x++) {
    if (frei(x, y)) continue;
    for (const [dx, dy] of VIER) {
      if (!frei(x + dx, y + dy)) continue;
      aus.push({ x: (x + 0.5 + dx * 0.5) * Z, z: (y + 0.5 + dy * 0.5) * Z, dx, dy, halle: istHalle(e.art[(y + dy) * e.b + x + dx]) });
    }
  }
  return aus;
}

/** Drehung, damit die Schauseite (+z im Modell) in Richtung (dx, dz) zeigt */
export const schauNach = (dx: number, dz: number) => Math.atan2(dx, dz);

/**
 * Eckzellen, die nur schräg an einen Gang stoßen, bekommen kein Modul: dort ein schlichter Block,
 * sonst sähe man zwischen den Modulen ins Leere.
 */
export function eckBloecke(e: FreiEbene, hoehe: number, farbe: number): THREE.InstancedMesh | null {
  const frei = (x: number, y: number) => x >= 0 && y >= 0 && x < e.b && y < e.h && e.art[y * e.b + x] !== WAND;
  const orte: THREE.Vector3[] = [];
  for (let y = 0; y < e.h; y++) for (let x = 0; x < e.b; x++) {
    if (frei(x, y) || VIER.some(([dx, dy]) => frei(x + dx, y + dy))) continue;
    if ([[1, 1], [1, -1], [-1, 1], [-1, -1]].some(([dx, dy]) => frei(x + dx, y + dy))) orte.push(new THREE.Vector3((x + 0.5) * Z, hoehe / 2, (y + 0.5) * Z));
  }
  if (!orte.length) return null;
  const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: farbe }), orte.length);
  const m = new THREE.Matrix4(), q0 = new THREE.Quaternion(), s = new THREE.Vector3(Z, hoehe, Z);
  orte.forEach((p, i) => im.setMatrixAt(i, m.compose(p, q0, s)));
  im.receiveShadow = true;
  im.frustumCulled = false;
  return im;
}

/** Deckenraster 2,8 m über allem Begehbaren: `setze(mitteX, mitteZ, liegtUeberHalle)` */
export function deckenRaster(e: FreiEbene, istHalle: (art: number) => boolean, setze: (x: number, z: number, halle: boolean) => void) {
  const frei = (x: number, y: number) => x >= 0 && y >= 0 && x < e.b && y < e.h && e.art[y * e.b + x] !== WAND;
  for (let y = 0; y < e.h; y += 2) for (let x = 0; x < e.b; x += 2) {
    if (![frei(x, y), frei(x + 1, y), frei(x, y + 1), frei(x + 1, y + 1)].some(Boolean)) continue;
    setze((x + 1) * Z, (y + 1) * Z, istHalle(e.art[Math.min(e.h - 1, y) * e.b + Math.min(e.b - 1, x)]));
  }
}
