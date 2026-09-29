/**
 * three.js-Teil des Gebäudes: baut die Stockwerke als Klötzchen (Boden,
 * Wände nur am Flur entlang, Zimmer, Türen, Treppe) — ohne React.
 */
import * as THREE from "three";
import type { Plan, Punkt } from "@/lib/gebaeude/plan";

export type RaumZustand = "offen" | "geloest" | "info" | "gelesen";

/** Höhe eines Stockwerks in Feldern */
export const STOCK_H = 3;

const FARBE = {
  boden: 0xece4d8, bodenRand: 0x8b7e74, wand: 0x5b4b45, wandOben: 0xd9cfc4,
  offen: 0xf59e0b, geloest: 0x22c55e, info: 0x60a5fa, gelesen: 0x94a3b8,
  tuer: 0x7c2d12, treppe: 0xcbd5e1, gesperrt: 0xe11d48, ausgang: 0x22c55e,
};

const RAUM_FARBE: Record<RaumZustand, number> = {
  offen: FARBE.offen, geloest: FARBE.geloest, info: FARBE.info, gelesen: FARBE.gelesen,
};

const box = new THREE.BoxGeometry(1, 1, 1);

/** Schild mit Text über einem Feld (Zimmernummer, Schloss …) */
export function schild(text: string, farbe = "#111827", hinter = "#fef3c7"): THREE.Sprite {
  const c = document.createElement("canvas");
  c.width = 128; c.height = 128;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = hinter;
  ctx.beginPath();
  ctx.arc(64, 64, 58, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = farbe;
  ctx.stroke();
  ctx.fillStyle = farbe;
  ctx.font = `bold ${text.length > 2 ? 44 : 64}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 64, 68);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
  s.scale.set(0.9, 0.9, 1);
  s.renderOrder = 10;
  return s;
}

function klotz(farbe: number, b: number, h: number, t: number, x: number, y: number, z: number): THREE.Mesh {
  const m = new THREE.Mesh(box, new THREE.MeshLambertMaterial({ color: farbe }));
  m.scale.set(b, h, t);
  m.position.set(x, y + h / 2, z);
  return m;
}

/**
 * Maße: Die ungeraden Rasterzeilen/-spalten (Flure, Zimmer, Kreuzungen) sind
 * breit, die geraden (Wände und kurze Durchgänge dazwischen) schmal.
 */
export const WEIT = 2.2;
export const SCHMAL = 0.3;

export function breite(i: number): number {
  return Math.abs(i) % 2 === 1 ? WEIT : SCHMAL;
}

/** Weltkoordinate der Mitte von Rasterspalte bzw. -zeile i */
export function welt(i: number): number {
  return Math.ceil(i / 2) * SCHMAL + Math.floor(i / 2) * WEIT + breite(i) / 2;
}

/** Umkehrung von `welt`: in welcher Rasterspalte liegt die Weltkoordinate w? */
export function feldAus(w: number, R: number): number {
  for (let i = 0; i < R; i++) if (w < welt(i) + breite(i) / 2) return i;
  return R - 1;
}

/** Viele gleiche Klötze als eine InstancedMesh, je Feld in dessen Breite */
function klotzReihe(felder: Punkt[], farbe: number, h: number, y: number): THREE.InstancedMesh {
  const m = new THREE.InstancedMesh(box, new THREE.MeshLambertMaterial({ color: farbe }), Math.max(1, felder.length));
  m.count = felder.length;
  const mat = new THREE.Matrix4();
  felder.forEach(([x, z], i) => {
    mat.compose(new THREE.Vector3(welt(x), y + h / 2, welt(z)), new THREE.Quaternion(), new THREE.Vector3(breite(x), h, breite(z)));
    m.setMatrixAt(i, mat);
  });
  return m;
}

export interface StockBild {
  zustaende: RaumZustand[];
  zielOffen: boolean;
  zielArt: "treppe" | "ausgang";
  /** Stockwerke unter dem aktuellen werden abgedunkelt */
  unten: boolean;
}

export function baueStock(plan: Plan, i: number, bild: StockBild): THREE.Group {
  const g = new THREE.Group();
  const st = plan.stockwerke[i];
  const R = plan.R;
  const y0 = i * STOCK_H;
  const boden: Punkt[] = [];
  const waende: Punkt[] = [];
  const offen = (x: number, y: number) => x >= 0 && y >= 0 && x < R && y < R && st.boden[y * R + x];
  const sonder = new Set<string>([`${st.ziel}`, ...st.raeume.map(r => `${r.x},${r.y}`)]);
  for (let y = 0; y < R; y++) {
    for (let x = 0; x < R; x++) {
      if (offen(x, y)) {
        if (!sonder.has(`${x},${y}`)) boden.push([x, y]);
        continue;
      }
      // Wände nur dort, wo sie an Flur grenzen — dazwischen bleibt Luft.
      let amFlur = false;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (offen(x + dx, y + dy)) amFlur = true;
      if (amFlur) waende.push([x, y]);
    }
  }
  const dunkel = (f: number) => (bild.unten ? new THREE.Color(f).multiplyScalar(0.55).getHex() : f);
  g.add(klotzReihe(boden, dunkel(FARBE.boden), 0.25, y0));
  g.add(klotzReihe(waende, dunkel(FARBE.wand), bild.unten ? 0.5 : 1.2, y0));
  if (!bild.unten) g.add(klotzReihe(waende, FARBE.wandOben, 0.06, y0 + 1.2));

  const rand = WEIT / 2 - 0.08;
  st.raeume.forEach((r, k) => {
    const z = bild.zustaende[k] ?? "offen";
    const rx = welt(r.x), rz = welt(r.y);
    g.add(klotz(dunkel(RAUM_FARBE[z]), WEIT, 0.3, WEIT, rx, y0, rz));
    if (bild.unten) return;
    // Pult mit Aufgabe
    g.add(klotz(0x78350f, 0.9, 0.5, 0.55, rx, y0 + 0.3, rz));
    // Türrahmen im kurzen Durchgang davor, quer zur Laufrichtung
    const [tx, ty] = r.tuer;
    const quer = tx % 2 === 0; // Durchgang in x-Richtung → Rahmen steht entlang z
    const mx = welt(tx), mz = welt(ty);
    for (const s of [-rand, rand]) {
      g.add(klotz(FARBE.tuer, 0.16, 1.5, 0.16, mx + (quer ? 0 : s), y0 + 0.25, mz + (quer ? s : 0)));
    }
    g.add(klotz(FARBE.tuer, quer ? 0.18 : WEIT, 0.16, quer ? WEIT : 0.18, mx, y0 + 1.75, mz));
    const sp = schild(z === "info" || z === "gelesen" ? "i" : String(k + 1), "#111827",
      z === "geloest" ? "#bbf7d0" : z === "offen" ? "#fef3c7" : z === "info" ? "#dbeafe" : "#e2e8f0");
    sp.position.set(rx, y0 + 2.3, rz);
    g.add(sp);
  });

  // Treppe bzw. Ausgang
  const [zx, zy] = [welt(st.ziel[0]), welt(st.ziel[1])];
  if (bild.zielArt === "treppe") {
    const stufe = WEIT / 5;
    for (let s = 0; s < 5; s++) {
      g.add(klotz(dunkel(FARBE.treppe), WEIT, 0.25 + s * (STOCK_H / 5), stufe, zx, y0, zy - WEIT / 2 + stufe / 2 + s * stufe));
    }
  } else {
    g.add(klotz(dunkel(FARBE.ausgang), WEIT, 0.3, WEIT, zx, y0, zy));
    if (!bild.unten) {
      for (const s of [-rand, rand]) g.add(klotz(FARBE.ausgang, 0.16, 1.8, 0.16, zx + s, y0 + 0.3, zy));
      g.add(klotz(FARBE.ausgang, WEIT, 0.16, 0.16, zx, y0 + 2.1, zy));
    }
  }
  if (!bild.unten) {
    if (!bild.zielOffen) g.add(klotz(FARBE.gesperrt, WEIT * 0.9, 0.14, 0.14, zx, y0 + 1.0, zy + WEIT / 2 - 0.1));
    const sp = schild(bild.zielOffen ? (bild.zielArt === "treppe" ? "⬆" : "EXIT") : "🔒", "#111827", bild.zielOffen ? "#bbf7d0" : "#fecdd3");
    sp.position.set(zx, y0 + 2.8, zy);
    g.add(sp);
  }
  return g;
}

export function figur(farbe: number): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: farbe });
  const koerper = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.7, 12), mat);
  koerper.position.y = 0.6;
  const kopf = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), new THREE.MeshLambertMaterial({ color: 0xfcd9b6 }));
  kopf.position.y = 1.1;
  g.add(koerper, kopf);
  return g;
}

/** Alles unterhalb eines Objekts freigeben */
export function entsorge(o: THREE.Object3D) {
  o.traverse(k => {
    const m = k as THREE.Mesh;
    if (m.geometry && m.geometry !== box) m.geometry.dispose();
    const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
    for (const mat of mats) {
      (mat as THREE.SpriteMaterial).map?.dispose();
      mat.dispose();
    }
  });
}
