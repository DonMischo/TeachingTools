/**
 * Straßen, Häuser, Gebäude, Wald und der Bau-Geist des Aufbaus als three.js-Instanzen.
 * `aktualisiere(welt)` stellt alles nach dem Stand der Welt auf (billig genug für jeden Zeitschritt).
 */
import * as THREE from "three";
import type { Gelaende } from "@/lib/gelaende/gelaende";
import { zufallsquelle } from "@/lib/gelaende/rauschen";
import { waldMaske } from "@/lib/gelaende/wald";
import { BAUTEN, type BauTyp } from "@/lib/stadt/modell";
import { FREI, fussabdruck, HAUPT, hausFarben, STRASSE, strassenKetten, type Kette, type Welt } from "@/lib/stadt/aufbau";
import { MODELL_VON, TEILFARBEN } from "../drei/modelle";
import { hoeheGlatt } from "./gelaende";
import { wasserspiegel } from "../drei/szene";

type Teile = Record<string, THREE.BufferGeometry> | null;
const MAX_HAUS = 24000, MAX_STRASSE = 40000;

function hell(g: THREE.BufferGeometry) {
  g.setAttribute("color", new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(1), 3));
  return g;
}

export class AufbauObjekte {
  gruppe = new THREE.Group();
  private strassen: THREE.InstancedMesh;
  private wand: THREE.InstancedMesh;
  private dach: THREE.InstancedMesh;
  private bauGruppe = new THREE.Group();
  private baeume: { mesh: THREE.InstancedMesh; matrizen: THREE.Matrix4[]; zellen: number[] }[] = [];
  geist = new THREE.Group();
  private geistArt = "";
  private geistBoden: THREE.Mesh;
  private mats: THREE.Material[] = [];
  private geos: THREE.BufferGeometry[] = [];
  private h2: number;
  private bauSchluessel = "";
  private spiegel: Float32Array;
  private pfeiler: THREE.InstancedMesh;

  constructor(private g: Gelaende, private teile: Teile, baeume: Teile, stilFarben: { fassade: string; dach: string; flach: boolean }) {
    this.h2 = g.breite / 2;
    this.spiegel = wasserspiegel(g);
    const pGeo = hell(new THREE.BoxGeometry(6.2, 1, 5.6).translate(0, 0.5, 0));
    const pMat = new THREE.MeshLambertMaterial({ vertexColors: true, color: 0x9a8f80 });
    this.pfeiler = new THREE.InstancedMesh(pGeo, pMat, 4000);
    this.pfeiler.count = 0;
    this.pfeiler.castShadow = this.pfeiler.receiveShadow = true;
    this.geos.push(pGeo);
    const sGeo = hell(new THREE.BoxGeometry(6, 1.2, 6).translate(0, -0.5, 0));
    const sMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.strassen = new THREE.InstancedMesh(sGeo, sMat, MAX_STRASSE);
    this.strassen.count = 0;
    this.strassen.receiveShadow = true;
    const wGeo = teile?.haus_wand_wand ?? hell(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0));
    const dGeo = (stilFarben.flach ? teile?.dach_flach_dach : teile?.dach_sattel_dach) ?? hell(new THREE.ConeGeometry(0.72, 1, 4, 1).rotateY(Math.PI / 4).translate(0, 0.5, 0));
    const wMat = new THREE.MeshLambertMaterial({ vertexColors: true }), dMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.wand = new THREE.InstancedMesh(wGeo, wMat, MAX_HAUS);
    this.dach = new THREE.InstancedMesh(dGeo, dMat, MAX_HAUS);
    this.wand.count = this.dach.count = 0;
    this.wand.castShadow = this.dach.castShadow = this.wand.receiveShadow = true;
    this.mats.push(sMat, wMat, dMat);
    this.geos.push(sGeo);
    this.gruppe.add(this.strassen, this.wand, this.dach, this.bauGruppe, this.geist, this.pfeiler);
    this.mats.push(pMat);
    // Wald aus den TaskCrawler-Bäumen; jeder Baum kennt sein Feld und verschwindet, wenn dort gebaut wird
    const maske = waldMaske(g), z = zufallsquelle(g.wahl.seed + 3), n = g.n;
    const orte: { x: number; y: number; art: string; s: number; w: number; k: number }[] = [];
    for (let y = 5; y < g.breite; y += 10) for (let x = 5; x < g.breite; x += 10) {
      const px = x + (z() - 0.5) * 8, py = y + (z() - 0.5) * 8;
      const k = Math.min(n - 1, Math.floor(py / g.zelle)) * n + Math.min(n - 1, Math.floor(px / g.zelle));
      if (z() > maske[k] * 1.1 || g.wasser[k]) continue;
      const tanne = g.hoehe[k] > 400 || z() < 0.25;
      orte.push({ x: px, y: py, art: tanne ? `tanne${1 + Math.floor(z() * 2)}` : `laubbaum${1 + Math.floor(z() * 3)}`, s: 8 + z() * 8, w: z() * 6.28, k });
    }
    const q = new THREE.Quaternion(), achse = new THREE.Vector3(0, 1, 0);
    for (const art of [...new Set(orte.map(o => o.art))]) {
      const hier = orte.filter(o => o.art === art), tanne = art.startsWith("tanne");
      const paare: [THREE.BufferGeometry | undefined, string][] = baeume?.[`${art}_krone`]
        ? [[baeume[`${art}_stamm`], "#6b4a2f"], [baeume[`${art}_krone`], tanne ? "#33573a" : "#4f8a3a"]]
        : [[(() => { const c = hell(new THREE.ConeGeometry(0.3, 1, 7).translate(0, 0.5, 0)); this.geos.push(c); return c; })(), tanne ? "#33573a" : "#4f8a3a"]];
      for (const [geo, farbe] of paare) {
        if (!geo) continue;
        const m = new THREE.MeshLambertMaterial({ vertexColors: true, color: farbe });
        this.mats.push(m);
        const im = new THREE.InstancedMesh(geo, m, hier.length);
        im.castShadow = true;
        const matrizen = hier.map(o => new THREE.Matrix4().compose(new THREE.Vector3(o.x - this.h2, hoeheGlatt(g, o.x, o.y) - 0.3, o.y - this.h2), q.setFromAxisAngle(achse, o.w).clone(), new THREE.Vector3(o.s, o.s, o.s)));
        matrizen.forEach((mm, i) => im.setMatrixAt(i, mm));
        this.baeume.push({ mesh: im, matrizen, zellen: hier.map(o => o.k) });
        this.gruppe.add(im);
      }
    }
    // Boden des Geistes: Grundfläche grün/rot
    const gMat = new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.45, depthWrite: false });
    this.mats.push(gMat);
    this.geistBoden = new THREE.Mesh(new THREE.BoxGeometry(1, 0.6, 1), gMat);
    this.geos.push(this.geistBoden.geometry);
    this.geist.add(this.geistBoden);
    this.geist.visible = false;
  }

  private band: THREE.Mesh | null = null;
  private bandMat = new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });

  /** Höhe der Fahrbahn bei (x, y) Karte: an Land das Gelände, über Wasser das Brückendeck */
  private fahrbahn(x: number, y: number) {
    const g = this.g, k = Math.min(g.n - 1, Math.max(0, Math.floor(y / g.zelle))) * g.n + Math.min(g.n - 1, Math.max(0, Math.floor(x / g.zelle)));
    const h = hoeheGlatt(g, x, y) + 0.18;
    return g.wasser[k] && !Number.isNaN(this.spiegel[k]) ? Math.max(h, this.spiegel[k] + 1.8) : h;
  }

  /** Straßenband: je Kette ein Streifen (Hauptstraße 7 m, Gasse 5 m breit), dem Gelände folgend */
  private baueBand(ketten: Kette[]) {
    const pos: number[] = [], col: number[] = [], idx: number[] = [];
    const h2 = this.h2, c = new THREE.Color();
    for (const k of ketten) {
      const p = k.punkte;
      if (p.length < 2) continue;
      const halb = k.haupt ? 3.5 : 2.5;
      c.set(k.haupt ? "#c8b48c" : "#ddd0b0");
      const start = pos.length / 3;
      for (let i = 0; i < p.length; i++) {
        const a = p[Math.max(0, i - 1)], b = p[Math.min(p.length - 1, i + 1)];
        const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1;
        const nx = -dy / l * halb, ny = dx / l * halb;
        for (const s of [1, -1]) {
          const x = p[i].x + nx * s, y = p[i].y + ny * s;
          pos.push(x - h2, this.fahrbahn(x, y), y - h2);
          col.push(c.r, c.g, c.b);
        }
        if (i > 0) { const q = start + (i - 1) * 2; idx.push(q, q + 2, q + 1, q + 1, q + 2, q + 3); }
      }
    }
    if (this.band) { this.gruppe.remove(this.band); this.band.geometry.dispose(); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    this.band = new THREE.Mesh(geo, this.bandMat);
    this.band.receiveShadow = true;
    this.gruppe.add(this.band);
  }

  /** Mittel- und Höchstwert der Geländehöhe über einer Feldfläche */
  private boden(i: number, j: number, w: number, h: number) {
    const z = this.g.zelle;
    const hs = [[0, 0], [w, 0], [0, h], [w, h], [w / 2, h / 2]].map(([a, b]) => hoeheGlatt(this.g, (i + a) * z, (j + b) * z));
    return { min: Math.min(...hs), max: Math.max(...hs) };
  }

  aktualisiere(w: Welt) {
    const g = this.g, z = g.zelle, n = w.n, h2 = this.h2;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), achse = new THREE.Vector3(0, 1, 0), c = new THREE.Color();
    // Straßen: geglättetes Band zwischen den Kreuzungen, Kreuzungen als Pflasterfelder
    const { ketten, knoten } = strassenKetten(w);
    this.baueBand(ketten);
    let s = 0;
    for (const k of knoten) {
      if (s >= MAX_STRASSE) break;
      const f = w.feld[k];
      const i = k % n, j = Math.floor(k / n);
      const y = g.wasser[k] ? this.fahrbahn((i + 0.5) * z, (j + 0.5) * z) - 0.06 : this.boden(i, j, 1, 1).max + 0.12;
      m.makeTranslation((i + 0.5) * z - h2, y, (j + 0.5) * z - h2);
      this.strassen.setMatrixAt(s, m);
      this.strassen.setColorAt(s, c.set(f === HAUPT ? "#c8b48c" : "#ddd0b0"));
      s++;
    }
    this.strassen.count = s;
    this.strassen.instanceMatrix.needsUpdate = true;
    if (this.strassen.instanceColor) this.strassen.instanceColor.needsUpdate = true;
    // Brücken: steinerner Unterbau vom Flussbett bis unters Deck
    let pI = 0;
    for (let k = 0; k < n * n && pI < 4000; k++) {
      if (!g.wasser[k] || (w.feld[k] !== STRASSE && w.feld[k] !== HAUPT)) continue;
      const i = k % n, j = Math.floor(k / n), x = (i + 0.5) * z, y = (j + 0.5) * z;
      const deck = this.fahrbahn(x, y) - 0.2, bett = g.hoehe[k] - 1;
      m.compose(new THREE.Vector3(x - h2, bett, y - h2), new THREE.Quaternion(), new THREE.Vector3(1, Math.max(0.5, deck - bett), 1));
      this.pfeiler.setMatrixAt(pI++, m);
    }
    this.pfeiler.count = pI;
    this.pfeiler.instanceMatrix.needsUpdate = true;
    this.pfeiler.computeBoundingSphere();
    // Häuser: Einzelhaus (2 × 2 Felder) oder Hof (3 × 3 Felder) mit Flügeln um einen Innenhof; Front zur Straße
    const fb = hausFarben(w.stil);
    let hI = 0;
    const dq = new THREE.Quaternion();
    /** ein Flügel: Mitte (lx, lz) und Maße im Hausrahmen (+z = Straße), First längs x oder längs z */
    const fluegel = (h: (typeof w.haeuser)[number], x0: number, y0: number, unten: number, lx: number, lz: number, bx: number, bz: number, hh: number, laengsZ: boolean, farbe: number) => {
      if (hI >= MAX_HAUS) return;
      const th = (h.dreh * Math.PI) / 2, cs = Math.cos(th), sn = Math.sin(th);
      const px = x0 + lx * cs + lz * sn, pz = y0 - lx * sn + lz * cs;
      q.setFromAxisAngle(achse, th);
      m.compose(new THREE.Vector3(px, unten, pz), q, new THREE.Vector3(bx, hh, bz));
      this.wand.setMatrixAt(hI, m);
      this.wand.setColorAt(hI, c.set(fb.fassade).offsetHSL(0, 0, farbe * 0.012));
      const rh = fb.flach ? 1.2 : Math.min(bx, bz) * 0.5;
      dq.setFromAxisAngle(achse, th + (laengsZ ? Math.PI / 2 : 0));
      m.compose(new THREE.Vector3(px, unten + hh, pz), fb.flach ? q : dq, laengsZ ? new THREE.Vector3(bz * 1.06, rh, bx * 1.12) : new THREE.Vector3(bx * 1.06, rh, bz * 1.12));
      this.dach.setMatrixAt(hI, m);
      this.dach.setColorAt(hI, c.set(fb.dach).offsetHSL(0, 0, farbe * 0.015));
      hI++;
    };
    for (const h of w.haeuser) {
      const b = this.boden(h.i, h.j, h.s, h.s), voll = Math.min(1, 0.4 + h.bewohner / Math.max(1, h.ziel));
      const hoehe = Math.max(4, h.hoehe * voll), wh = hoehe + (b.max - b.min) + 0.4, unten = b.min - 0.4;
      const x0 = (h.i + h.s / 2) * z - h2, y0 = (h.j + h.s / 2) * z - h2, f = ((h.i * 7 + h.j * 3) % 9) - 4;
      if (h.s === 3 && h.hof) {
        // Hof 18 × 18 m: Wohnhaus an der Straße, Stall links, Scheune hinten, beim Vierseithof rechts das Torhaus
        fluegel(h, x0, y0, unten, 0, 5.8, 17, 5.6, wh, false, f);
        fluegel(h, x0, y0, unten, -5.8, -0.4, 5.4, 6.8, wh * 0.82, true, f - 2);
        fluegel(h, x0, y0, unten, 0, -5.8, 17, 5.6, wh * 0.9, false, f + 2);
        if (h.hof === 4) fluegel(h, x0, y0, unten, 5.8, -0.4, 5.4, 6.8, wh * 0.75, true, f - 1);
      } else fluegel(h, x0, y0, unten, 0, 0, h.s * 6 - 2, h.s * 6 - 3, wh, false, f);
    }
    this.wand.count = this.dach.count = hI;
    for (const im of [this.wand, this.dach]) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
    // Hüllkugeln neu, sonst schneidet three.js gewachsene Instanzgruppen weg
    for (const im of [this.strassen, this.wand, this.dach]) im.computeBoundingSphere();
    // Gebäude nur neu aufstellen, wenn sich etwas geändert hat
    const schluessel = w.bauten.map(b => b.id).join(",");
    if (schluessel !== this.bauSchluessel) {
      this.bauSchluessel = schluessel;
      this.bauGruppe.traverse(o => { const me = o as THREE.Mesh; if (me.isMesh && !me.geometry.userData.geteilt) me.geometry.dispose(); });
      this.bauGruppe.clear();
      for (const b of w.bauten) { const gr = this.gebaeude(b.bau, b.i, b.j, 1, b.dreh); gr.userData.id = b.id; this.bauGruppe.add(gr); }
    }
    // Bäume auf bebauten Feldern ausblenden
    const null0 = new THREE.Matrix4().makeScale(0, 0, 0);
    for (const t of this.baeume) {
      t.zellen.forEach((k, i) => t.mesh.setMatrixAt(i, w.feld[k] === FREI ? t.matrizen[i] : null0));
      t.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  /** ein Gebäude als Gruppe (Modell aus Blender, Plätze als Pflaster) */
  gebaeude(b: BauTyp, i: number, j: number, deckkraft: number, dreh = 0): THREE.Group {
    const g = this.g, z = g.zelle, h2 = this.h2, { w, h } = fussabdruck(b, dreh), roh = fussabdruck(b), art = BAUTEN[b];
    const gr = new THREE.Group();
    const bo = this.boden(i, j, w, h);
    gr.position.set((i + w / 2) * z - h2, bo.min - 0.5, (j + h / 2) * z - h2);
    gr.userData.bau = b;
    const transparent = deckkraft < 1;
    const name = MODELL_VON[b];
    // Sockel bzw. Pflaster über die ganze Fläche
    const sockel = new THREE.Mesh(hell(new THREE.BoxGeometry(w * z, bo.max - bo.min + 0.8, h * z).translate(0, (bo.max - bo.min + 0.8) / 2, 0)), this.mat(name ? "#a99d8a" : "#d8c9a6", transparent, deckkraft));
    sockel.receiveShadow = true;
    gr.add(sockel);
    if (name && art.hoehe >= 3) {
      const f = TEILFARBEN[name] ?? { dach: "#8a4b33", akzent: "#8a4b33" };
      const modell = new THREE.Group();
      modell.position.y = bo.max - bo.min + 0.8;
      // Modell in eigener Ausrichtung strecken, dann die Vierteldrehung (Zufahrt Süden → Westen → Norden → Osten)
      modell.scale.set(roh.w * z - 2, Math.max(8, art.hoehe), roh.h * z - 2);
      const drehung = new THREE.Group();
      drehung.rotation.y = (-dreh * Math.PI) / 2;
      drehung.position.y = modell.position.y;
      modell.position.y = 0;
      drehung.add(modell);
      for (const [teil, farbe] of [["wand", art.farbe], ["dach", f.dach], ["akzent", f.akzent]] as const) {
        const geo = this.teile?.[`${name}_${teil}`] ?? (teil === "wand" ? hell(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)) : null);
        if (!geo) continue;
        const mesh = new THREE.Mesh(geo, this.mat(farbe, transparent, deckkraft));
        mesh.castShadow = !transparent;
        modell.add(mesh);
      }
      gr.add(drehung);
    }
    return gr;
  }

  private matCache = new Map<string, THREE.MeshLambertMaterial>();
  private mat(farbe: string, transparent: boolean, deckkraft: number) {
    const key = `${farbe}|${transparent ? deckkraft : 1}`;
    let m = this.matCache.get(key);
    if (!m) { m = new THREE.MeshLambertMaterial({ vertexColors: true, color: farbe, transparent, opacity: deckkraft, depthWrite: !transparent }); this.matCache.set(key, m); this.mats.push(m); }
    return m;
  }

  /** Geist: halbdurchsichtiges Gebäude am Bauplatz, Boden grün (erlaubt), gelb (schwach) oder rot */
  zeigeGeist(b: BauTyp | null, i: number, j: number, zustand: "gut" | "schwach" | "nein", dreh = 0) {
    if (!b) { this.geist.visible = false; return; }
    if (this.geistArt !== `${b}|${dreh}`) {
      for (const k of [...this.geist.children]) if (k !== this.geistBoden) this.geist.remove(k);
      this.geist.add(this.gebaeude(b, 0, 0, 0.55, dreh));
      this.geistArt = `${b}|${dreh}`;
    }
    const { w, h } = fussabdruck(b, dreh), z = this.g.zelle, bo = this.boden(i, j, w, h);
    const modell = this.geist.children.find(k => k !== this.geistBoden)!;
    modell.position.set(0, bo.min - 0.5, 0);
    this.geist.position.set((i + w / 2) * z - this.h2, 0, (j + h / 2) * z - this.h2);
    this.geistBoden.position.y = bo.max + 0.4;
    this.geistBoden.scale.set(w * z, 1, h * z);
    (this.geistBoden.material as THREE.MeshBasicMaterial).color.set(zustand === "gut" ? 0x22c55e : zustand === "schwach" ? 0xeab308 : 0xdc2626);
    modell.visible = zustand !== "nein";
    this.geist.visible = true;
  }

  entsorge() {
    this.geos.forEach(x => x.dispose());
    this.mats.forEach(x => x.dispose());
    this.bandMat.dispose();
    this.band?.geometry.dispose();
    this.gruppe.traverse(o => { const im = o as THREE.InstancedMesh; if (im.isInstancedMesh) im.dispose(); });
  }
}

