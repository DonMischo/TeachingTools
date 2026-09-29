/**
 * Die Erde mit herausgeschnittenem Keil — die three.js-Szene.
 *
 * Jede Schicht ist eine eigene Gruppe aus Außenfläche (Kugel ohne Keil) und
 * Schnittflächen (Kreisringsektoren in den Schnittebenen). Abziehen hebt eine
 * Gruppe nach außen und blendet sie aus. Auf den Schnittflächen des Mantels
 * läuft, wenn eingeschaltet, der Konvektionslöser als Textur mit.
 *
 * Winkelkonvention von three.js' SphereGeometry: ein Punkt bei (φ, θ) liegt
 * bei x = −r·cosφ·sinθ, y = r·cosθ, z = r·sinφ·sinθ. Die Kugel wird von φ = 0
 * bis 2π − W gebaut; der Keil ist der Rest. Eine Schnittebene bei φ entsteht
 * aus der xy-Ebene durch Drehen um y um φ + π.
 */
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { ERDRADIUS, SCHICHTEN, schichtBei } from "@/lib/erde/schichten";
import { farbeBei, glut, mantelFarbe, type Farbmodus } from "@/lib/erde/farben";
import { JAHRE_JE_ZEITEINHEIT, Konvektion } from "@/lib/erde/konvektion";

export type Keilform = "achtel" | "keil";

export interface KeilOptionen {
  form: Keilform;
  /** Öffnung des Keils in Grad. */
  winkel: number;
  ueberhoeht: boolean;
  farbmodus: Farbmodus;
  konvektion: boolean;
  /** Zeitraffer der Konvektion: Anteil des größten stabilen Zeitschritts je Bild (0,02–2). */
  tempo: number;
  abgezogen: number;
  ausgewaehlt: string | null;
}

/** Tiefen-Stützstellen für die überhöhte Darstellung (Anteil des Radius). */
const UEBERHOEHT: [number, number][] = [
  [0, 0], [35, 0.035], [100, 0.07], [250, 0.11], [410, 0.15], [660, 0.2], [2700, 0.49], [2891, 0.52], [5150, 0.8], [ERDRADIUS, 1],
];

function stueckweise(t: [number, number][], x: number, rueck = false): number {
  const a = rueck ? 1 : 0, b = rueck ? 0 : 1;
  for (let i = 1; i < t.length; i++) {
    if (x <= t[i][a]) {
      const f = (x - t[i - 1][a]) / (t[i][a] - t[i - 1][a] || 1);
      return t[i - 1][b] + f * (t[i][b] - t[i - 1][b]);
    }
  }
  return t[t.length - 1][b];
}

export function anzeigeRadius(tiefe: number, ueberhoeht: boolean): number {
  return ueberhoeht ? 1 - stueckweise(UEBERHOEHT, tiefe) : 1 - tiefe / ERDRADIUS;
}

export function tiefeAusRadius(r: number, ueberhoeht: boolean): number {
  const f = 1 - Math.min(1, Math.max(0, r));
  return ueberhoeht ? stueckweise(UEBERHOEHT, f, true) : f * ERDRADIUS;
}

/** Kreisringsektor in der xy-Ebene; Ringe als [Radius, Tiefe], Farbe je Ring. */
function sektor(
  ringe: [number, number][], t0: number, t1: number, farbe: (tiefe: number) => [number, number, number], seg = 48,
): THREE.BufferGeometry {
  const pos: number[] = [], col: number[] = [], uv: number[] = [], idx: number[] = [];
  const nr = ringe.length;
  for (let a = 0; a <= seg; a++) {
    const t = t0 + ((t1 - t0) * a) / seg;
    for (let k = 0; k < nr; k++) {
      const [r, z] = ringe[k];
      pos.push(r * Math.cos(t), r * Math.sin(t), 0);
      const c = farbe(z);
      col.push(c[0], c[1], c[2]);
      uv.push(a / seg, nr > 1 ? k / (nr - 1) : 0);
    }
  }
  for (let a = 0; a < seg; a++) for (let k = 0; k < nr - 1; k++) {
    const i = a * nr + k;
    idx.push(i, i + nr, i + 1, i + 1, i + nr, i + nr + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Ringe von oben nach unten, fein genug für Farbverläufe. */
function ringeFuer(von: number, bis: number, ueberhoeht: boolean, n = 12): [number, number][] {
  const aus: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const z = von + ((bis - von) * i) / n;
    // Knapp innerhalb der Schicht, damit Sprünge nicht verschmieren.
    const zf = Math.min(bis - 0.01, Math.max(von + 0.01, z));
    aus.push([anzeigeRadius(z, ueberhoeht), zf]);
  }
  return aus;
}

interface Flaeche { t0: number; t1: number; ebene: "senkrecht" | "aequator"; phi: number }

function flaechen(form: Keilform, W: number): Flaeche[] {
  const L = 2 * Math.PI - W;
  if (form === "keil") {
    return [
      { t0: -Math.PI / 2, t1: Math.PI / 2, ebene: "senkrecht", phi: 0 },
      { t0: -Math.PI / 2, t1: Math.PI / 2, ebene: "senkrecht", phi: L },
    ];
  }
  return [
    { t0: 0, t1: Math.PI / 2, ebene: "senkrecht", phi: 0 },
    { t0: 0, t1: Math.PI / 2, ebene: "senkrecht", phi: L },
    { t0: L + Math.PI, t1: 3 * Math.PI, ebene: "aequator", phi: 0 },
  ];
}

function lege(mesh: THREE.Object3D, f: Flaeche) {
  if (f.ebene === "senkrecht") mesh.rotation.y = f.phi + Math.PI;
  else mesh.rotation.x = -Math.PI / 2;
}

interface SchichtObjekt {
  id: string;
  gruppe: THREE.Group;
  materialien: THREE.Material[];
  flaechen: THREE.Mesh[];
  abheben: number;
}

interface KonvFlaeche {
  loeser: Konvektion;
  leinwand: HTMLCanvasElement;
  textur: THREE.CanvasTexture;
  mesh: THREE.Mesh;
  teilchen: { x: number; z: number; alter: number }[];
  bild: ImageData;
}

const KONV_OBEN = 100;
const KONV_UNTEN = 2891;

export class KeilSzene {
  private renderer: THREE.WebGLRenderer;
  private szene = new THREE.Scene();
  kamera: THREE.PerspectiveCamera;
  private steuerung: OrbitControls;
  private erde = new THREE.Group();
  private schichten: SchichtObjekt[] = [];
  private konv: KonvFlaeche[] = [];
  private konvGruppe = new THREE.Group();
  private opt: KeilOptionen | null = null;
  private erdTextur: THREE.Texture;
  private texturFehlt = false;
  private strahl = new THREE.Raycaster();
  private maus = new THREE.Vector2();
  private laeuft = true;
  private rahmen = 0;
  private beobachter: ResizeObserver;
  /** Wird je Bild aufgerufen, um Beschriftungen zu setzen. */
  beiBild: ((projiziere: (tiefe: number, hoehe: number, flaeche: number) => { x: number; y: number; vorne: boolean } | null) => void) | null = null;
  beiHover: ((id: string | null) => void) | null = null;
  beiKlick: ((id: string | null) => void) | null = null;
  /** Modellzeit der Konvektion in Mio. Jahren (für die Anzeige). */
  konvektionsJahre = 0;
  /** Wie viele Mio. Jahre je echter Sekunde vergehen (geglättet). */
  konvektionsRate = 0;
  private letzteMessung: [number, number] | null = null;

  constructor(private buehne: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.domElement.className = "absolute inset-0 w-full h-full touch-none";
    buehne.prepend(this.renderer.domElement);

    this.kamera = new THREE.PerspectiveCamera(38, 1, 0.01, 100);
    this.kamera.position.set(2.3, 1.6, 2.3);
    this.szene.add(this.kamera);
    this.szene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const licht = new THREE.DirectionalLight(0xffffff, 1.9);
    licht.position.set(1.5, 2, 3);
    this.kamera.add(licht);

    this.steuerung = new OrbitControls(this.kamera, this.renderer.domElement);
    this.steuerung.enableDamping = true;
    this.steuerung.enablePan = false;
    this.steuerung.minDistance = 1.3;
    this.steuerung.maxDistance = 8;

    // Fehlt das Bild (z. B. in der Einzeldatei ohne Server), bleibt die Erde blau.
    this.erdTextur = new THREE.TextureLoader().load("/sonnensystem/texturen/erde.webp", undefined, undefined, () => {
      for (const s of this.schichten) {
        const m = s.materialien[0] as THREE.MeshStandardMaterial;
        if (m.map) { m.map = null; m.color.set(0x2f6aa8); m.needsUpdate = true; }
      }
      this.texturFehlt = true;
    });
    this.erdTextur.colorSpace = THREE.SRGBColorSpace;
    this.erdTextur.wrapS = THREE.RepeatWrapping;
    this.erdTextur.anisotropy = 4;

    this.szene.add(this.erde);
    this.erde.add(this.konvGruppe);

    this.beobachter = new ResizeObserver(() => this.groesse());
    this.beobachter.observe(buehne);
    this.groesse();

    const el = this.renderer.domElement;
    el.addEventListener("pointermove", this.aufBewegung);
    el.addEventListener("pointerdown", this.aufDruck);
    el.addEventListener("pointerup", this.aufLos);
    this.schleife();
  }

  private groesse() {
    const w = this.buehne.clientWidth || 1, h = this.buehne.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.kamera.aspect = w / h;
    this.kamera.updateProjectionMatrix();
  }

  setzeOptionen(o: KeilOptionen) {
    const alt = this.opt;
    this.opt = o;
    const neu = !alt || alt.form !== o.form || alt.winkel !== o.winkel || alt.ueberhoeht !== o.ueberhoeht || alt.farbmodus !== o.farbmodus;
    if (neu) this.baue();
    else this.faerbeAuswahl();
    this.konvGruppe.visible = o.konvektion && o.abgezogen <= 2;
    for (const s of this.schichten) {
      const mantel = s.id !== "kruste" && s.id !== "lithomantel" && s.id !== "aussenkern" && s.id !== "innenkern";
      for (const f of s.flaechen) f.visible = !(mantel && this.konvGruppe.visible);
    }
  }

  private baue() {
    const o = this.opt!;
    for (const s of this.schichten) { this.erde.remove(s.gruppe); entsorge(s.gruppe); }
    this.schichten = [];
    this.konvGruppe.clear();
    for (const k of this.konv) { k.textur.dispose(); k.mesh.geometry.dispose(); (k.mesh.material as THREE.Material).dispose(); }
    this.konv = [];

    const W = (o.winkel * Math.PI) / 180;
    const L = 2 * Math.PI - W;
    const fl = flaechen(o.form, W);

    for (const s of SCHICHTEN) {
      const gruppe = new THREE.Group();
      const rA = anzeigeRadius(s.von, o.ueberhoeht);
      const materialien: THREE.Material[] = [];
      // Außenfläche.
      const aussen = s.id === "kruste"
        ? new THREE.MeshStandardMaterial(this.texturFehlt ? { color: 0x2f6aa8, roughness: 0.9 } : { map: this.erdTextur, roughness: 0.9 })
        : new THREE.MeshStandardMaterial({ color: new THREE.Color(...farbeBei(o.farbmodus, s.von + 0.01)), roughness: 0.8 });
      materialien.push(aussen);
      const kugeln: THREE.BufferGeometry[] = o.form === "keil"
        ? [new THREE.SphereGeometry(rA, 128, 64, 0, L, 0, Math.PI)]
        : [new THREE.SphereGeometry(rA, 128, 32, 0, L, 0, Math.PI / 2), new THREE.SphereGeometry(rA, 128, 32, 0, 2 * Math.PI, Math.PI / 2, Math.PI / 2)];
      kugeln.forEach((g, i) => {
        // Textur nicht stauchen: u läuft über den gebauten Winkel, nicht über 2π.
        const anteil = o.form === "keil" || i === 0 ? L / (2 * Math.PI) : 1;
        const uv = g.getAttribute("uv");
        for (let k = 0; k < uv.count; k++) {
          uv.setX(k, uv.getX(k) * anteil);
          // Halbkugeln: v läuft sonst über die halbe statt die ganze Höhe.
          if (o.form === "achtel") uv.setY(k, i === 0 ? 0.5 + uv.getY(k) / 2 : uv.getY(k) / 2);
        }
        gruppe.add(new THREE.Mesh(g, aussen));
      });
      // Schnittflächen.
      const schnitt = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.85 });
      materialien.push(schnitt);
      const ringe = ringeFuer(s.von, s.bis, o.ueberhoeht, o.farbmodus === "schichten" || o.farbmodus === "zustand" ? 1 : 24);
      const flaechenMeshes: THREE.Mesh[] = [];
      for (const f of fl) {
        const m = new THREE.Mesh(sektor(ringe, f.t0, f.t1, z => farbeBei(o.farbmodus, z)), schnitt);
        lege(m, f);
        gruppe.add(m);
        flaechenMeshes.push(m);
      }
      gruppe.userData.id = s.id;
      this.erde.add(gruppe);
      this.schichten.push({ id: s.id, gruppe, materialien, flaechen: flaechenMeshes, abheben: 0 });
    }

    // Konvektion auf den Mantelflächen: je Fläche ein eigener Löser.
    const ringe = ringeFuer(KONV_OBEN, KONV_UNTEN, o.ueberhoeht, 40).reverse(); // unten → oben
    for (const f of fl) {
      const bogen = Math.abs(f.t1 - f.t0);
      const seiten = Math.min(5.2, Math.max(1, 2.5 * bogen / (Math.PI / 2)));
      const nz = 26;
      const loeser = new Konvektion({ nx: Math.round(nz * seiten), nz, seiten, ra: 4e5, kernHeizt: true, zerfall: 3 });
      const leinwand = document.createElement("canvas");
      leinwand.width = (loeser.nx + 1) * 4;
      leinwand.height = (nz + 1) * 4;
      const textur = new THREE.CanvasTexture(leinwand);
      textur.colorSpace = THREE.SRGBColorSpace;
      const mat = new THREE.MeshStandardMaterial({ map: textur, side: THREE.DoubleSide, roughness: 0.85 });
      const g = sektor(ringe, f.t0, f.t1, () => [1, 1, 1], 64);
      g.deleteAttribute("color");
      const mesh = new THREE.Mesh(g, mat);
      lege(mesh, f);
      this.konvGruppe.add(mesh);
      const teilchen = Array.from({ length: Math.round(90 * seiten) }, () => ({ x: Math.random() * seiten, z: Math.random(), alter: Math.random() * 300 }));
      const bild = new ImageData(loeser.nx + 1, nz + 1);
      // Vorlauf, damit schon Säulen stehen.
      for (let i = 0; i < 60; i++) loeser.schritt();
      this.konv.push({ loeser, leinwand, textur, mesh, teilchen, bild });
    }
    this.konvektionsJahre = 0;
    this.letzteMessung = null;

    // Keil zur Kamera drehen.
    const phiC = L + W / 2;
    const psiKeil = Math.atan2(-Math.sin(phiC), -Math.cos(phiC));
    const psiKamera = Math.atan2(-this.kamera.position.z, this.kamera.position.x);
    this.erde.rotation.y = psiKamera - psiKeil;
    this.faerbeAuswahl();
  }

  private faerbeAuswahl() {
    const id = this.opt?.ausgewaehlt;
    for (const s of this.schichten) {
      s.materialien.forEach((m, i) => {
        const mm = m as THREE.MeshStandardMaterial;
        // Die Erdoberfläche mit Foto nicht einfärben, nur die Schnittflächen.
        const leuchten = s.id === id && !(s.id === "kruste" && i === 0);
        mm.emissive = new THREE.Color(leuchten ? 0x442211 : 0x000000);
      });
    }
  }

  private zeichneKonvektion(k: KonvFlaeche) {
    const { loeser, bild, leinwand, teilchen } = k;
    const temp = this.opt?.farbmodus === "temperatur";
    const W = loeser.nx + 1, H = loeser.nz + 1;
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const T = Math.min(1, Math.max(0, loeser.T[j * W + i]));
      const c = temp ? glut((1300 + T * 2400) / 5600) : mantelFarbe(T);
      const p = ((H - 1 - j) * W + i) * 4;
      bild.data[p] = c[0] * 255; bild.data[p + 1] = c[1] * 255; bild.data[p + 2] = c[2] * 255; bild.data[p + 3] = 255;
    }
    const ctx = leinwand.getContext("2d")!;
    // Kleines Bild erst auf eine Hilfsleinwand, dann weich hochskaliert.
    const klein = hilfsLeinwand(W, H);
    klein.getContext("2d")!.putImageData(bild, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(klein, 0, 0, leinwand.width, leinwand.height);
    const sx = leinwand.width / loeser.opt.seiten, sy = leinwand.height;
    // 410/660-km-Grenzen als feine Linien.
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.setLineDash([4, 4]);
    for (const z of [410, 660]) {
      const v = (KONV_UNTEN - z) / (KONV_UNTEN - KONV_OBEN);
      ctx.beginPath(); ctx.moveTo(0, (1 - v) * sy); ctx.lineTo(leinwand.width, (1 - v) * sy); ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(255,245,220,0.85)";
    for (const t of teilchen) ctx.fillRect(t.x * sx - 1, (1 - t.z) * sy - 1, 2.2, 2.2);
    k.textur.needsUpdate = true;
  }

  private bewegeTeilchen(k: KonvFlaeche, dt: number) {
    const L = k.loeser.opt.seiten;
    for (const t of k.teilchen) {
      const [u, w] = k.loeser.geschwindigkeit(t.x, t.z);
      t.x += u * dt; t.z += w * dt; t.alter++;
      if (t.x < 0 || t.x > L || t.z < 0 || t.z > 1 || t.alter > 400) {
        t.x = Math.random() * L; t.z = Math.random(); t.alter = 0;
      }
    }
  }

  private schleife = () => {
    if (!this.laeuft) return;
    this.rahmen = requestAnimationFrame(this.schleife);
    this.steuerung.update();
    const o = this.opt;
    if (o) {
      // Abziehen: nach außen heben und ausblenden.
      this.schichten.forEach((s, i) => {
        const ziel = i < o.abgezogen ? 1 : 0;
        s.abheben += (ziel - s.abheben) * 0.12;
        if (Math.abs(ziel - s.abheben) < 0.002) s.abheben = ziel;
        s.gruppe.visible = s.abheben < 0.99;
        s.gruppe.scale.setScalar(1 + 0.45 * s.abheben);
        for (const m of s.materialien) {
          m.transparent = s.abheben > 0;
          m.opacity = 1 - s.abheben;
          m.depthWrite = s.abheben < 0.5;
        }
      });
      if (this.konvGruppe.visible) {
        // Langsamer heißt: kleinere Schritte, nicht seltenere — sonst ruckelt es.
        const n = Math.max(1, Math.ceil(o.tempo));
        for (const k of this.konv) {
          for (let i = 0; i < n; i++) {
            const dt = (k.loeser.zeitschritt() * o.tempo) / n;
            k.loeser.schritt(dt);
            this.bewegeTeilchen(k, dt);
          }
          this.zeichneKonvektion(k);
        }
        if (this.konv.length) {
          const jahre = (this.konv[0].loeser.zeit * JAHRE_JE_ZEITEINHEIT) / 1e6;
          const jetzt = performance.now();
          if (this.letzteMessung) {
            const rate = (jahre - this.letzteMessung[1]) / Math.max(1e-3, (jetzt - this.letzteMessung[0]) / 1000);
            this.konvektionsRate += (rate - this.konvektionsRate) * 0.05;
          }
          this.letzteMessung = [jetzt, jahre];
          this.konvektionsJahre = jahre;
        }
      }
    }
    this.renderer.render(this.szene, this.kamera);
    if (this.beiBild && o) this.beiBild(this.projiziere);
  };

  /**
   * Bildschirmort eines Punkts auf einer Schnittfläche: Tiefe (km),
   * Höhenwinkel auf der Fläche (Grad), Index der Fläche.
   */
  private projiziere = (tiefe: number, hoehe: number, flaeche: number) => {
    const o = this.opt!;
    const f = flaechen(o.form, (o.winkel * Math.PI) / 180)[flaeche];
    if (!f) return null;
    const r = anzeigeRadius(tiefe, o.ueberhoeht);
    const t = (hoehe * Math.PI) / 180;
    const p = new THREE.Vector3(r * Math.cos(t), r * Math.sin(t), 0);
    const hilfe = new THREE.Object3D();
    lege(hilfe, f);
    hilfe.updateMatrix();
    p.applyMatrix4(hilfe.matrix).applyMatrix4(this.erde.matrixWorld);
    // Die Fläche zeigt in den Keil hinein; von hinten ist die Beschriftung verdeckt.
    const L = 2 * Math.PI - (o.winkel * Math.PI) / 180;
    const normale = f.ebene === "aequator" ? new THREE.Vector3(0, 1, 0)
      : f.phi === 0 ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(Math.sin(L), 0, Math.cos(L));
    normale.transformDirection(this.erde.matrixWorld);
    const sichtbar = normale.dot(this.kamera.position.clone().sub(p)) > 0;
    const n = p.clone().project(this.kamera);
    const w = this.buehne.clientWidth, h = this.buehne.clientHeight;
    return { x: (n.x * 0.5 + 0.5) * w, y: (-n.y * 0.5 + 0.5) * h, vorne: n.z < 1 && sichtbar };
  };

  private treffer(e: PointerEvent): string | null {
    const el = this.renderer.domElement;
    const r = el.getBoundingClientRect();
    this.maus.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.strahl.setFromCamera(this.maus, this.kamera);
    const ziele: THREE.Object3D[] = [];
    for (const s of this.schichten) if (s.gruppe.visible && s.abheben < 0.2) ziele.push(s.gruppe);
    if (this.konvGruppe.visible) ziele.push(this.konvGruppe);
    const hit = this.strahl.intersectObjects(ziele, true)[0];
    if (!hit) return null;
    const lokal = this.erde.worldToLocal(hit.point.clone());
    const tiefe = tiefeAusRadius(lokal.length(), this.opt!.ueberhoeht) + 0.3;
    return schichtBei(tiefe).id;
  }

  private druckOrt: [number, number] | null = null;
  private aufBewegung = (e: PointerEvent) => {
    const id = this.treffer(e);
    this.renderer.domElement.style.cursor = id ? "pointer" : "grab";
    this.beiHover?.(id);
  };
  private aufDruck = (e: PointerEvent) => { this.druckOrt = [e.clientX, e.clientY]; };
  private aufLos = (e: PointerEvent) => {
    if (!this.druckOrt) return;
    const weg = Math.hypot(e.clientX - this.druckOrt[0], e.clientY - this.druckOrt[1]);
    this.druckOrt = null;
    if (weg > 5) return; // war ein Drehen
    this.beiKlick?.(this.treffer(e));
  };

  entsorgen() {
    this.laeuft = false;
    cancelAnimationFrame(this.rahmen);
    this.beobachter.disconnect();
    const el = this.renderer.domElement;
    el.removeEventListener("pointermove", this.aufBewegung);
    el.removeEventListener("pointerdown", this.aufDruck);
    el.removeEventListener("pointerup", this.aufLos);
    this.steuerung.dispose();
    entsorge(this.szene);
    for (const k of this.konv) k.textur.dispose();
    this.erdTextur.dispose();
    this.renderer.dispose();
    el.remove();
  }
}

const leinwaende = new Map<string, HTMLCanvasElement>();
function hilfsLeinwand(w: number, h: number) {
  const k = `${w}x${h}`;
  let c = leinwaende.get(k);
  if (!c) { c = document.createElement("canvas"); c.width = w; c.height = h; leinwaende.set(k, c); }
  return c;
}

function entsorge(o: THREE.Object3D) {
  o.traverse(k => {
    const m = k as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mat = m.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach(x => x.dispose());
    else mat?.dispose();
  });
}
