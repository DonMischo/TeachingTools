/**
 * three.js-Szene für den 3D-Haufen. Die Positionen liegen schon als
 * Float32Array im Dla-Objekt — der Puffer zeigt direkt darauf, hochgeladen wird
 * je Bild nur der neu angewachsene Teil.
 */
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { farbe, type Dla } from "@/lib/dla/kern";

export type Modus = "punkte" | "aeste";

function rundePunkte(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.6, "rgba(255,255,255,0.9)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export class RaumSzene {
  readonly renderer: THREE.WebGLRenderer;
  private szene = new THREE.Scene();
  private kamera = new THREE.PerspectiveCamera(45, 1, 0.1, 20000);
  private steuerung: OrbitControls;
  private ro: ResizeObserver;
  private punkte?: THREE.Points;
  private aeste?: THREE.LineSegments;
  private farben?: THREE.BufferAttribute;
  private lage?: THREE.BufferAttribute;
  private index?: THREE.BufferAttribute;
  private dla?: Dla;
  private gezeichnet = 0;
  private folgen = true;
  private textur = rundePunkte();
  private modus: Modus = "punkte";

  constructor(private halter: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    halter.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.display = "block";
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    this.szene.background = new THREE.Color("#060a14");
    this.kamera.position.set(0, 0, 60);
    this.steuerung = new OrbitControls(this.kamera, this.renderer.domElement);
    this.steuerung.enableDamping = true;
    this.steuerung.autoRotate = true;
    this.steuerung.autoRotateSpeed = 0.6;
    // Wer selbst dreht oder zoomt, behält seinen Blick
    this.steuerung.addEventListener("start", () => { this.folgen = false; });
    this.ro = new ResizeObserver(() => this.groesse());
    this.ro.observe(halter);
    this.groesse();
  }

  private groesse() {
    const b = this.halter.clientWidth, h = this.halter.clientHeight;
    if (!b || !h) return;
    this.renderer.setSize(b, h, false);
    this.kamera.aspect = b / h;
    this.kamera.updateProjectionMatrix();
  }

  set drehen(an: boolean) {
    this.steuerung.autoRotate = an;
  }

  setzeModus(m: Modus) {
    this.modus = m;
    if (this.punkte) this.punkte.visible = m === "punkte";
    if (this.aeste) this.aeste.visible = m === "aeste";
  }

  private aufraeumen() {
    for (const o of [this.punkte, this.aeste]) {
      if (!o) continue;
      this.szene.remove(o);
      o.geometry.dispose();
      (o.material as THREE.Material).dispose();
    }
  }

  neu(dla: Dla) {
    this.aufraeumen();
    this.dla = dla;
    this.gezeichnet = 0;
    this.folgen = true;
    this.steuerung.target.set(0, 0, 0);
    this.lage = new THREE.BufferAttribute(dla.pos, 3);
    this.farben = new THREE.BufferAttribute(new Float32Array(dla.kapazitaet * 3), 3);
    this.index = new THREE.BufferAttribute(new Uint32Array(dla.kapazitaet * 2), 1);
    for (const a of [this.lage, this.farben, this.index]) a.setUsage(THREE.DynamicDrawUsage);

    const gp = new THREE.BufferGeometry();
    gp.setAttribute("position", this.lage);
    gp.setAttribute("color", this.farben);
    this.punkte = new THREE.Points(gp, new THREE.PointsMaterial({
      size: 1.5, vertexColors: true, map: this.textur, alphaTest: 0.4, transparent: true, depthWrite: true,
    }));

    const ga = new THREE.BufferGeometry();
    ga.setAttribute("position", this.lage);
    ga.setAttribute("color", this.farben);
    ga.setIndex(this.index);
    this.aeste = new THREE.LineSegments(ga, new THREE.LineBasicMaterial({ vertexColors: true }));

    for (const o of [this.punkte, this.aeste]) {
      o.frustumCulled = false;
      this.szene.add(o);
    }
    this.setzeModus(this.modus);
  }

  /** Neu angewachsene Teilchen hochladen, Kamera nachführen, zeichnen. */
  bild() {
    const dla = this.dla;
    if (dla && this.lage && this.farben && this.index && this.punkte && this.aeste) {
      const von = this.gezeichnet, bis = dla.anzahl;
      if (bis > von) {
        const f = this.farben.array as Float32Array, ix = this.index.array as Uint32Array;
        for (let i = von; i < bis; i++) {
          const [r, g, b] = farbe(i / dla.kapazitaet);
          f[i * 3] = r; f[i * 3 + 1] = g; f[i * 3 + 2] = b;
          const e = dla.eltern[i];
          ix[i * 2] = e < 0 ? i : e;
          ix[i * 2 + 1] = i;
        }
        this.lage.addUpdateRange(von * 3, (bis - von) * 3);
        this.lage.needsUpdate = true;
        this.farben.addUpdateRange(von * 3, (bis - von) * 3);
        this.farben.needsUpdate = true;
        this.index.addUpdateRange(von * 2, (bis - von) * 2);
        this.index.needsUpdate = true;
        this.punkte.geometry.setDrawRange(0, bis);
        this.aeste.geometry.setDrawRange(0, bis * 2);
        this.gezeichnet = bis;
      }
      if (this.folgen) {
        const soll = Math.max(30, dla.rmax * 3.2);
        const ist = this.kamera.position.length();
        this.kamera.position.multiplyScalar(1 + (soll / ist - 1) * 0.25);
      }
    }
    this.steuerung.update();
    this.renderer.render(this.szene, this.kamera);
  }

  entsorgen() {
    this.ro.disconnect();
    this.steuerung.dispose();
    this.aufraeumen();
    this.textur.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
