/**
 * Zwei Schichtstapel im Raum — links Lenas Handy, rechts der Server in Tokio.
 * Das Paket wandert links hinunter, unten hinüber und rechts hinauf. Mit
 * jeder Schicht kommt eine Hülle in deren Farbe dazu (Kapselung) bzw. fällt
 * auf der anderen Seite wieder weg.
 */
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CSS2DObject, CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { SCHICHTEN, type SchichtNr } from "@/lib/schichten/kapselung";

const ABSTAND_X = 5.2;
const KARTE_B = 4.2, KARTE_T = 3;
/** Schritte: 0–6 Lena 7→1, 7 unterwegs, 8–14 Tokio 1→7 */
export const SCHRITTE = 15;

export function schrittInfo(s: number): { seite: "lena" | "unterwegs" | "tokio"; schicht: SchichtNr | null } {
  if (s < 7) return { seite: "lena", schicht: (7 - s) as SchichtNr };
  if (s === 7) return { seite: "unterwegs", schicht: null };
  return { seite: "tokio", schicht: (s - 7) as SchichtNr };
}

function karteLinie(farbe: string): THREE.Group {
  const g = new THREE.Group();
  const form = new THREE.Shape();
  const b = KARTE_B / 2, t = KARTE_T / 2, r = 0.35;
  form.moveTo(-b + r, -t);
  form.lineTo(b - r, -t); form.quadraticCurveTo(b, -t, b, -t + r);
  form.lineTo(b, t - r); form.quadraticCurveTo(b, t, b - r, t);
  form.lineTo(-b + r, t); form.quadraticCurveTo(-b, t, -b, t - r);
  form.lineTo(-b, -t + r); form.quadraticCurveTo(-b, -t, -b + r, -t);
  const punkte = form.getPoints(8).map(p => new THREE.Vector3(p.x, 0, p.y));
  const linie = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(punkte), new THREE.LineBasicMaterial({ color: farbe, transparent: true }));
  const flaeche = new THREE.Mesh(new THREE.ShapeGeometry(form), new THREE.MeshBasicMaterial({ color: farbe, transparent: true, opacity: 0.06, side: THREE.DoubleSide, depthWrite: false }));
  flaeche.rotation.x = Math.PI / 2;
  g.add(flaeche, linie);
  return g;
}

function huelle(farbe: string, groesse: number): THREE.LineSegments {
  const geo = new THREE.EdgesGeometry(new THREE.BoxGeometry(groesse, groesse, groesse));
  return new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: farbe, transparent: true, opacity: 0 }));
}

function etikett(text: string, art: "kopf" | "schicht"): CSS2DObject {
  const d = document.createElement("div");
  d.textContent = text;
  Object.assign(d.style, art === "kopf"
    ? { color: "#e2e8f0", font: "700 13px system-ui, sans-serif", letterSpacing: "0.04em", whiteSpace: "nowrap" }
    : { color: "#94a3b8", font: "600 11px system-ui, sans-serif", whiteSpace: "nowrap", textTransform: "uppercase", letterSpacing: "0.08em" });
  return new CSS2DObject(d);
}

export class StapelSzene {
  private renderer: THREE.WebGLRenderer;
  private etiketten = new CSS2DRenderer();
  private szene = new THREE.Scene();
  private kamera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
  private steuerung: OrbitControls;
  private ro: ResizeObserver;
  private karten: { lena: THREE.Group[]; tokio: THREE.Group[] } = { lena: [], tokio: [] };
  private schildLena: CSS2DObject[] = [];
  private paket = new THREE.Group();
  private kern: THREE.Mesh;
  private huellen: THREE.LineSegments[] = [];
  private ziel = new THREE.Vector3();
  private blick = new THREE.Vector3();
  private schritt = 0;
  private uhr = new THREE.Clock();
  private hoehe: number[] = [];
  private nutzerDreht = false;

  constructor(private halter: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.domElement.style.display = "block";
    halter.appendChild(this.renderer.domElement);
    Object.assign(this.etiketten.domElement.style, { position: "absolute", inset: "0", pointerEvents: "none" });
    halter.appendChild(this.etiketten.domElement);
    this.szene.background = new THREE.Color("#060a14");
    this.szene.fog = new THREE.Fog("#060a14", 18, 40);

    const gitter = new THREE.GridHelper(60, 40, "#1e293b", "#111827");
    gitter.position.y = -0.6;
    this.szene.add(gitter);

    this.setzeModell("osi");
    for (const seite of ["lena", "tokio"] as const) {
      const x = seite === "lena" ? -ABSTAND_X : ABSTAND_X;
      SCHICHTEN.forEach((s, i) => {
        const k = karteLinie(s.farbe);
        k.position.set(x, this.hoehe[i], 0);
        this.szene.add(k);
        this.karten[seite].push(k);
      });
      const kopf = etikett(seite === "lena" ? "📱 Lena · Erfurt" : "🖥️ Server · Tokio", "kopf");
      kopf.position.set(x, this.hoehe[0] + 1.1, 0);
      this.szene.add(kopf);
    }
    SCHICHTEN.forEach((s, i) => {
      const e = etikett(`${s.nr} ${s.name}`, "schicht");
      e.position.set(0, this.hoehe[i], 0);
      this.szene.add(e);
      this.schildLena.push(e);
    });

    this.kern = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), new THREE.MeshBasicMaterial({ color: "#f59e0b" }));
    this.paket.add(this.kern);
    // Hüllen für Schicht 6 bis 2, von innen nach außen
    for (let nr = 6; nr >= 2; nr--) {
      const h = huelle(SCHICHTEN.find(s => s.nr === nr)!.farbe, 0.7 + (7 - nr) * 0.2);
      this.huellen.push(h);
      this.paket.add(h);
    }
    this.szene.add(this.paket);

    this.kamera.position.set(-ABSTAND_X, 8, 11);
    this.steuerung = new OrbitControls(this.kamera, this.renderer.domElement);
    this.steuerung.enableDamping = true;
    this.steuerung.addEventListener("start", () => { this.nutzerDreht = true; });
    this.ro = new ResizeObserver(() => this.groesse());
    this.ro.observe(halter);
    this.groesse();
    this.setzeSchritt(0, true);
  }

  private groesse() {
    const b = this.halter.clientWidth, h = this.halter.clientHeight;
    if (!b || !h) return;
    this.renderer.setSize(b, h);
    this.etiketten.setSize(b, h);
    this.kamera.aspect = b / h;
    this.kamera.updateProjectionMatrix();
  }

  /** Höhen der Karten; im TCP/IP-Modell rücken Schichten einer Gruppe zusammen */
  setzeModell(modell: "osi" | "tcpip") {
    const h: number[] = [];
    let y = 0;
    for (let i = SCHICHTEN.length - 1; i >= 0; i--) {
      h[i] = y;
      const darueber = SCHICHTEN[i - 1];
      y += modell === "tcpip" && darueber && darueber.tcpip === SCHICHTEN[i].tcpip ? 0.35 : 1.15;
    }
    this.hoehe = h;
    for (const seite of ["lena", "tokio"] as const) this.karten[seite].forEach((k, i) => { k.position.y = h[i]; });
    this.schildLena.forEach((e, i) => {
      const s = SCHICHTEN[i];
      const erste = SCHICHTEN.findIndex(x => x.tcpip === s.tcpip) === i;
      e.element.textContent = modell === "osi" ? `${s.nr} ${s.name}` : erste ? s.tcpip : "";
      e.position.y = h[i];
    });
    this.setzeSchritt(this.schritt, true);
  }

  setzeSchritt(s: number, sofort = false) {
    // Neuer Schritt: die Kamera führt wieder, auch wenn vorher jemand gedreht hat
    if (s !== this.schritt) this.nutzerDreht = false;
    this.schritt = s;
    const { seite, schicht } = schrittInfo(s);
    const idx = schicht ? SCHICHTEN.findIndex(x => x.nr === schicht) : SCHICHTEN.length - 1;
    const x = seite === "lena" ? -ABSTAND_X : seite === "tokio" ? ABSTAND_X : 0;
    const y = seite === "unterwegs" ? -0.2 : this.hoehe[idx] + 0.55;
    this.ziel.set(x, y, 0);
    for (const k of ["lena", "tokio"] as const) {
      this.karten[k].forEach((g, i) => {
        const aktiv = k === seite && i === idx;
        (g.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>).material.opacity = aktiv ? 0.28 : 0.06;
        (g.children[1] as THREE.LineLoop<THREE.BufferGeometry, THREE.LineBasicMaterial>).material.opacity = aktiv ? 1 : 0.45;
      });
    }
    if (sofort) this.paket.position.copy(this.ziel);
    // Blick auf die Mitte zwischen aktiver Karte und Stapelmitte; unterwegs auf beide Stapel
    const mitte = this.hoehe[0] / 2;
    this.blick.set(x, seite === "unterwegs" ? mitte : (this.hoehe[idx] + mitte) / 2, 0);
  }

  /** Abstand, aus dem eine Fläche b × h ganz ins Bild passt */
  private abstand(b: number, h: number): number {
    const t = Math.tan((this.kamera.fov * Math.PI) / 360);
    return Math.max(h / 2 / t, b / 2 / (t * this.kamera.aspect)) * 1.12;
  }

  /** Foto als Textur auf den Kern */
  setzeBild(url: string | null) {
    const m = this.kern.material as THREE.MeshBasicMaterial;
    m.map?.dispose();
    m.map = null;
    m.color.set("#f59e0b");
    if (url) {
      new THREE.TextureLoader().load(url, t => {
        t.colorSpace = THREE.SRGBColorSpace;
        m.map = t;
        m.color.set("#ffffff");
        m.needsUpdate = true;
      });
    }
    m.needsUpdate = true;
  }

  bild() {
    const dt = Math.min(0.05, this.uhr.getDelta());
    const t = this.uhr.elapsedTime;
    const { seite, schicht } = schrittInfo(this.schritt);
    // Paket gleitet zum Ziel; unterwegs pendelt es zwischen den Stapeln
    const ziel = this.ziel.clone();
    if (seite === "unterwegs") ziel.x = Math.sin(t * 0.8) * ABSTAND_X * 0.9;
    this.paket.position.lerp(ziel, 1 - Math.exp(-dt * 5));
    this.paket.rotation.y += dt * 0.4;
    // Hüllen: sichtbar ist jede Schicht, die gerade um die Daten liegt
    const tiefste = schicht ?? 1;
    this.huellen.forEach((h, i) => {
      const nr = 6 - i;
      const soll = nr >= tiefste ? 0.95 : 0;
      const m = h.material as THREE.LineBasicMaterial;
      m.opacity += (soll - m.opacity) * Math.min(1, dt * 6);
      h.visible = m.opacity > 0.02;
    });
    const kernSoll = tiefste === 1 ? 0.55 : 1;
    this.kern.scale.setScalar(this.kern.scale.x + (kernSoll - this.kern.scale.x) * Math.min(1, dt * 6));

    if (!this.nutzerDreht) {
      this.steuerung.target.lerp(this.blick, 1 - Math.exp(-dt * 3));
      const unterwegs = seite === "unterwegs";
      const d = unterwegs ? this.abstand(2 * ABSTAND_X + KARTE_B + 2, this.hoehe[0] + 2.5) : this.abstand(KARTE_B + 4, this.hoehe[0] + 2);
      const richtung = new THREE.Vector3(unterwegs ? 0 : -Math.sign(this.blick.x) * 0.25, 0.45, 1).normalize();
      const wunsch = this.blick.clone().addScaledVector(richtung, d);
      this.kamera.position.lerp(wunsch, 1 - Math.exp(-dt * 2));
    }
    this.steuerung.update();
    this.renderer.render(this.szene, this.kamera);
    this.etiketten.render(this.szene, this.kamera);
  }

  /** Blick wieder automatisch führen */
  folgen() {
    this.nutzerDreht = false;
    this.setzeSchritt(this.schritt);
  }

  entsorgen() {
    this.ro.disconnect();
    this.steuerung.dispose();
    this.szene.traverse(o => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mat = m.material as THREE.Material | undefined;
      if (mat) { (mat as THREE.MeshBasicMaterial).map?.dispose(); mat.dispose(); }
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.etiketten.domElement.remove();
  }
}
