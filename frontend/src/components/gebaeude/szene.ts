/**
 * three.js-Teil des Gebäudes: baut die Stockwerke als Klötzchen (Boden,
 * Wände nur am Flur entlang, Zimmer, Türen, Treppe) — ohne React.
 */
import * as THREE from "three";
import type { Plan, Punkt } from "@/lib/gebaeude/plan";
import type { Objekt } from "@/lib/gebaeude/objekte";
import { baueObjekt } from "./objekte3d";

export type RaumZustand = "offen" | "geloest" | "info" | "gelesen";

/** Höhe eines Stockwerks in Feldern */
export const STOCK_H = 3;

/** Haus: Stockwerke gehen nach oben (+1). Verlies: Ebenen gehen nach unten (−1). */
export type Richtung = 1 | -1;

/** Bodenhöhe von Stockwerk bzw. Ebene i */
export function hoeheVon(i: number, richtung: Richtung = 1): number {
  return i * STOCK_H * richtung;
}

const FARBE = {
  boden: 0xece4d8, bodenRand: 0x8b7e74, wand: 0x5b4b45, wandOben: 0xd9cfc4,
  offen: 0xf59e0b, geloest: 0x22c55e, info: 0x60a5fa, gelesen: 0x94a3b8,
  tuer: 0x7c2d12, treppe: 0xcbd5e1, gesperrt: 0xe11d48, ausgang: 0x22c55e,
};

const RAUM_FARBE: Record<RaumZustand, number> = {
  offen: FARBE.offen, geloest: FARBE.geloest, info: FARBE.info, gelesen: FARBE.gelesen,
};

/**
 * Aussehen des Hauses. Beton und Neon nach den Bildern von MarkovJunior
 * (Apartemazements), Garten wie ein Palast mit Hecken am Wasser.
 */
export type Stil = "klassisch" | "beton" | "neon" | "garten" | "verlies";

interface Palette {
  boden: number; wand: number; wandH: number; oben: number; obenH: number;
  tuer: number; treppe: number; stuetze: number; sockel: number;
  /** Zimmer leuchten (Neon) */
  leuchten?: boolean;
}

export const STILE: Record<Stil, Palette & { name: string }> = {
  klassisch: { name: "Klassisch", boden: 0xece4d8, wand: 0x5b4b45, wandH: 1.2, oben: 0xd9cfc4, obenH: 0.06, tuer: 0x7c2d12, treppe: 0xcbd5e1, stuetze: 0x8b7e74, sockel: 0x475569 },
  beton: { name: "Beton", boden: 0xe7e5e4, wand: 0xa8a29e, wandH: 0.9, oben: 0xf5f5f4, obenH: 0.12, tuer: 0x57534e, treppe: 0xf5f5f4, stuetze: 0xd6d3d1, sockel: 0x78716c },
  neon: { name: "Glas & Neon", boden: 0xd4d4d8, wand: 0x27272a, wandH: 1.3, oben: 0xfafafa, obenH: 0.1, tuer: 0xfafafa, treppe: 0xe4e4e7, stuetze: 0xf4f4f5, sockel: 0x3f3f46, leuchten: true },
  garten: { name: "Gartenpalast", boden: 0xd9e4c8, wand: 0xf5ecd7, wandH: 0.8, oben: 0x3f6212, obenH: 0.45, tuer: 0x92400e, treppe: 0xf5ecd7, stuetze: 0xf5ecd7, sockel: 0x2563eb },
  verlies: { name: "Verlies", boden: 0x57534e, wand: 0x3f3a36, wandH: 1.5, oben: 0x78716c, obenH: 0.12, tuer: 0x44403c, treppe: 0x78716c, stuetze: 0x44403c, sockel: 0x1c1917 },
};

const box = new THREE.BoxGeometry(1, 1, 1);

/** Schild mit Text über einem Feld (Zimmernummer, Schloss …) */
export function schild(text: string, farbe = "#111827", hinter = "#fef3c7"): THREE.Sprite {
  const c = document.createElement("canvas");
  c.width = 128; c.height = 128;
  const ctx = c.getContext("2d");
  if (!ctx) return new THREE.Sprite(new THREE.SpriteMaterial({ depthTest: false })); // ohne Canvas (Tests)
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

function klotz(farbe: number, b: number, h: number, t: number, x: number, y: number, z: number, leuchtet = false): THREE.Mesh {
  const m = new THREE.Mesh(box, new THREE.MeshLambertMaterial(
    leuchtet ? { color: farbe, emissive: farbe, emissiveIntensity: 0.9 } : { color: farbe }));
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

/** Breite eines ganzen Abschnitts (R Rasterspalten) in Welteinheiten */
export function abschnittBreite(R: number): number {
  return welt(R - 1) + breite(R - 1) / 2;
}

/** Ebene: um wie viel Abschnitt i nach rechts versetzt liegt (sonst 0) */
export function versatzVon(i: number, R: number, flach?: boolean): number {
  return flach ? i * abschnittBreite(R) : 0;
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
  /** was in den Zimmern steht (Vorgabe: Schreibtisch) */
  objekte?: Objekt[];
  /** Stockwerke unter dem aktuellen werden abgedunkelt */
  unten: boolean;
  stil?: Stil;
  /** Gesamtansicht: Stützen bis zum Stockwerk darunter, keine Schilder */
  ganz?: boolean;
  /** +1 Haus (nach oben), −1 Verlies (nach unten) */
  richtung?: Richtung;
  /** Ein Boss bewacht Treppe bzw. Ausgang (Verlies) */
  waechter?: boolean;
  /** Ebene: Abschnitte nebeneinander, Türen in der Wand statt Treppen */
  flach?: boolean;
}

/** Tür in der Wand zwischen zwei Abschnitten; offen klappt sie zur Seite. */
function wandtuer(g: THREE.Group, x: number, z: number, y0: number, offen: boolean, farbe: number, hoehe: number) {
  if (offen) {
    const fluegel = klotz(farbe, WEIT * 0.9, hoehe, 0.1, x + WEIT * 0.45, y0 + 0.25, z - WEIT / 2 + 0.1);
    g.add(fluegel);
  } else {
    g.add(klotz(farbe, 2 * SCHMAL, hoehe, WEIT, x, y0 + 0.25, z));
    g.add(klotz(0xfacc15, 2 * SCHMAL + 0.04, 0.12, 0.12, x, y0 + 0.25 + hoehe * 0.5, z + WEIT * 0.3));
  }
}

/**
 * Treppe in einem Feld: nach oben fünf Stufen, nach unten ein Schacht mit
 * fünf Stufen hinab. `zurTuer` zeigt, von welcher Seite man hineinläuft.
 */
function treppe(g: THREE.Group, x: number, z: number, y0: number, hoch: boolean, farbe: number) {
  const stufe = WEIT / 5;
  for (let s = 0; s < 5; s++) {
    if (hoch) {
      g.add(klotz(farbe, WEIT, 0.25 + s * (STOCK_H / 5), stufe, x, y0, z - WEIT / 2 + stufe / 2 + s * stufe));
    } else {
      // Stufen hinab: jede liegt tiefer; darunter ist es dunkel
      const oben = y0 + 0.25 - (s + 1) * (STOCK_H / 5);
      g.add(klotz(farbe, WEIT, 0.2, stufe, x, oben - 0.2, z - WEIT / 2 + stufe / 2 + s * stufe));
    }
  }
  if (!hoch) {
    // Schachtwände, damit das Loch als Loch zu sehen ist
    for (const s of [-1, 1]) g.add(klotz(0x1c1917, 0.12, STOCK_H, WEIT, x + s * (WEIT / 2 - 0.06), y0 - STOCK_H + 0.25, z));
  }
}

export function baueStock(plan: Plan, i: number, bild: StockBild): THREE.Group {
  const g = new THREE.Group();
  const st = plan.stockwerke[i];
  const R = plan.R;
  const richtung = bild.richtung ?? 1;
  const flach = !!bild.flach;
  const y0 = flach ? 0 : hoeheVon(i, richtung);
  g.position.x = versatzVon(i, R, flach);
  const boden: Punkt[] = [];
  const waende: Punkt[] = [];
  const offen = (x: number, y: number) => x >= 0 && y >= 0 && x < R && y < R && st.boden[y * R + x];
  const sonder = new Set<string>([
    ...st.raeume.flatMap(r => (r.flaeche ?? [[r.x, r.y]]).map(([x, y]) => `${x},${y}`)),
    ...(flach ? [] : [`${st.ziel}`, ...(i > 0 ? [`${st.start}`] : [])]),
  ]);
  // Ebene: die Wandfelder, in denen Türen sitzen, bleiben frei
  const tuerFelder = new Set<string>(flach ? [`${R - 1},${st.ziel[1]}`, ...(i > 0 ? [`0,${st.start[1]}`] : [])] : []);
  for (let y = 0; y < R; y++) {
    for (let x = 0; x < R; x++) {
      if (offen(x, y)) {
        if (!sonder.has(`${x},${y}`)) boden.push([x, y]);
        continue;
      }
      // Wände nur dort, wo sie an Flur grenzen — dazwischen bleibt Luft.
      let amFlur = false;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (offen(x + dx, y + dy)) amFlur = true;
      if (amFlur && !tuerFelder.has(`${x},${y}`)) waende.push([x, y]);
    }
  }
  const F = STILE[bild.stil ?? "klassisch"];
  const dunkel = (f: number) => (bild.unten ? new THREE.Color(f).multiplyScalar(0.55).getHex() : f);
  g.add(klotzReihe(boden, dunkel(F.boden), 0.25, y0));
  g.add(klotzReihe(waende, dunkel(F.wand), bild.unten ? 0.5 : F.wandH, y0));
  if (!bild.unten) g.add(klotzReihe(waende, F.oben, F.obenH, y0 + F.wandH));

  // Stützen: an den Eckpfeilern bis hinunter zum Stockwerk darunter — nur wo
  // dort kein Flur ist, damit nichts im Weg steht.
  if (bild.ganz && i > 0) {
    const unter = plan.stockwerke[i - 1];
    const pfeiler = waende.filter(([x, y]) => x % 2 === 0 && y % 2 === 0 && x > 0 && y > 0 && x < R - 1 && y < R - 1
      && !unter.boden[y * R + x] && (x + y) % 4 === 0);
    const m = new THREE.InstancedMesh(box, new THREE.MeshLambertMaterial({ color: F.stuetze }), Math.max(1, pfeiler.length));
    m.count = pfeiler.length;
    const mat = new THREE.Matrix4();
    pfeiler.forEach(([x, y], k) => {
      mat.compose(new THREE.Vector3(welt(x), y0 - (richtung * STOCK_H) / 2, welt(y)), new THREE.Quaternion(), new THREE.Vector3(SCHMAL, STOCK_H, SCHMAL));
      m.setMatrixAt(k, mat);
    });
    g.add(m);
  }

  const rand = WEIT / 2 - 0.08;
  st.raeume.forEach((r, k) => {
    // Alles eines Zimmers in einer Gruppe: ein Klick auf irgendetwas darin
    // (Boden, Objekt, Schild) schickt die Figur hierher.
    const zg = new THREE.Group();
    zg.userData.ort = { art: "raum", raum: k };
    g.add(zg);
    const z = bild.zustaende[k] ?? "offen";
    const rx = welt(r.x), rz = welt(r.y);
    // Verlies: der ganze Saal in der Zimmerfarbe (gedämpft), die Mitte kräftig
    if (r.flaeche) {
      const rand = r.flaeche.filter(([x, y]) => x !== r.x || y !== r.y);
      zg.add(klotzReihe(rand, dunkel(new THREE.Color(RAUM_FARBE[z]).lerp(new THREE.Color(F.boden), 0.6).getHex()), 0.27, y0));
    }
    zg.add(klotz(dunkel(RAUM_FARBE[z]), WEIT, 0.3, WEIT, rx, y0, rz, F.leuchten && !bild.unten));
    if (F.leuchten && !bild.unten) {
      // Neon: eine Lichtsäule über dem Zimmer, wie die roten Räume im Bild
      zg.add(klotz(0xff3b3b, WEIT * 0.96, 1.1, 0.08, rx, y0 + 0.3, rz - WEIT / 2 + 0.05, true));
    }
    if (bild.unten) return;
    // Das Objekt schaut zur Tür.
    const ding = baueObjekt(bild.objekte?.[k] ?? "pult", z === "geloest");
    ding.position.set(rx, y0 + 0.3, rz);
    ding.rotation.y = Math.atan2(r.tuer[0] - r.x, r.tuer[1] - r.y);
    zg.add(ding);
    // Türrahmen im kurzen Durchgang davor, quer zur Laufrichtung
    const [tx, ty] = r.tuer;
    const quer = tx % 2 === 0; // Durchgang in x-Richtung → Rahmen steht entlang z
    const mx = welt(tx), mz = welt(ty);
    for (const s of [-rand, rand]) {
      zg.add(klotz(F.tuer, 0.16, 1.5, 0.16, mx + (quer ? 0 : s), y0 + 0.25, mz + (quer ? s : 0)));
    }
    zg.add(klotz(F.tuer, quer ? 0.18 : WEIT, 0.16, quer ? WEIT : 0.18, mx, y0 + 1.75, mz));
    if (bild.ganz) return;
    const sp = schild(z === "info" || z === "gelesen" ? "i" : String(k + 1), "#111827",
      z === "geloest" ? "#bbf7d0" : z === "offen" ? "#fef3c7" : z === "info" ? "#dbeafe" : "#e2e8f0");
    sp.position.set(rx, y0 + 2.3, rz);
    zg.add(sp);
  });

  // Treppe bzw. Ausgang
  const zielG = new THREE.Group();
  zielG.userData.ort = { art: "ziel" };
  g.add(zielG);
  const [zx, zy] = [welt(st.ziel[0]), welt(st.ziel[1])];
  if (flach) {
    const tx = welt(R - 1) + SCHMAL / 2; // Grenze zum nächsten Abschnitt
    const letzte = bild.zielArt === "ausgang";
    wandtuer(zielG, tx, zy, y0, bild.zielOffen, letzte ? FARBE.ausgang : F.tuer, F.wandH + 0.2);
    // ein Streifen Boden unter der Tür, damit man sie auch offen trifft
    zielG.add(klotz(dunkel(F.boden), 2 * SCHMAL, 0.25, WEIT, tx, y0, zy));
  } else if (bild.zielArt === "treppe") {
    treppe(zielG, zx, zy, y0, richtung === 1, dunkel(F.treppe));
  } else {
    zielG.add(klotz(dunkel(FARBE.ausgang), WEIT, 0.3, WEIT, zx, y0, zy));
    if (!bild.unten) {
      for (const s of [-rand, rand]) zielG.add(klotz(FARBE.ausgang, 0.16, 1.8, 0.16, zx + s, y0 + 0.3, zy));
      zielG.add(klotz(FARBE.ausgang, WEIT, 0.16, 0.16, zx, y0 + 2.1, zy));
    }
  }
  // Der Boss steht im Durchgang vor Treppe bzw. Ausgang; ist die Tür offen, liegt er besiegt da.
  if (bild.waechter && !bild.unten) {
    const vor = flach ? st.ziel : [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [st.ziel[0] + dx, st.ziel[1] + dy] as Punkt)
      .find(([x, y]) => offen(x, y));
    if (vor && flach) {
      const boss = baueObjekt("boss", bild.zielOffen);
      boss.position.set(zx + 0.2, y0 + 0.25, zy + (bild.zielOffen ? WEIT * 0.3 : 0));
      boss.rotation.y = -Math.PI / 2;
      zielG.add(boss);
    } else if (vor) {
      const boss = baueObjekt("boss", bild.zielOffen);
      boss.position.set(welt(vor[0]) + (welt(vor[0]) - zx) * 0.3, y0 + 0.25, welt(vor[1]) + (welt(vor[1]) - zy) * 0.3);
      boss.rotation.y = Math.atan2(vor[0] - st.ziel[0], vor[1] - st.ziel[1]);
      zielG.add(boss);
    }
  }
  if (!bild.unten && !bild.ganz) {
    if (!bild.zielOffen && !flach) zielG.add(klotz(FARBE.gesperrt, WEIT * 0.9, 0.14, 0.14, zx, y0 + 1.0, zy + WEIT / 2 - 0.1));
    const pfeil = flach ? "➡" : richtung === 1 ? "⬆" : "⬇";
    const sp = schild(bild.zielOffen ? (bild.zielArt === "treppe" ? pfeil : "EXIT") : "🔒", "#111827", bild.zielOffen ? "#bbf7d0" : "#fecdd3");
    sp.position.set(flach ? welt(R - 1) + SCHMAL / 2 : zx, y0 + 2.8, zy);
    zielG.add(sp);
  }

  // Treppe zurück: dort, wo man auf diesem Stockwerk angekommen ist
  if (i > 0) {
    const zurueck = new THREE.Group();
    zurueck.userData.ort = { art: "zurueck" };
    g.add(zurueck);
    const [sx, sz] = [welt(st.start[0]), welt(st.start[1])];
    if (flach) zurueck.add(klotz(dunkel(F.boden), WEIT, 0.26, WEIT, sx, y0, sz));
    else treppe(zurueck, sx, sz, y0, richtung === -1, dunkel(F.treppe));
    if (!bild.unten && !bild.ganz) {
      const sp = schild(flach ? "⬅" : richtung === 1 ? "⬇" : "⬆", "#111827", "#e2e8f0");
      sp.position.set(sx, y0 + 2.4, sz);
      zurueck.add(sp);
    }
  }
  return g;
}

/** Ort, auf den ein Klick zielt: das erste getroffene Zimmer, die Treppe weiter oder die zurück. */
export type KlickOrt = { art: "raum"; raum: number } | { art: "ziel" } | { art: "zurueck" };

export function ortAmStrahl(stockwerk: THREE.Object3D, zeiger: THREE.Raycaster): KlickOrt | null {
  for (const treffer of zeiger.intersectObject(stockwerk, true)) {
    let o: THREE.Object3D | null = treffer.object;
    while (o && !o.userData.ort) o = o.parent;
    if (o) return o.userData.ort as KlickOrt;
  }
  return null;
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
