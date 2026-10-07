/**
 * three.js-Szene fürs Kugel-Stab-Modell.
 *
 * Kugeln sind Atome, Stäbe sind Bindungen; jeder Stab ist zweifarbig, weil er
 * von der Mitte aus die Farbe seiner beiden Atome trägt — so sieht man auch
 * ohne Beschriftung, was woran hängt. Mehrfachbindungen liegen als zwei bzw.
 * drei dünnere Stäbe nebeneinander.
 *
 * Beleuchtet wird mit drei Lichtern plus einer gerechneten Umgebung, damit die
 * Kugeln plastisch wirken und nicht wie flache Scheiben.
 */
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RADIUS, RAUMFARBE, type Raummodell } from "@/lib/struktur/raum";

/** Kugelgröße: klein genug, dass die Stäbe zu sehen bleiben. */
const KUGEL = 0.62;
const STAB = 0.105;

export class RaumSzene {
  readonly renderer: THREE.WebGLRenderer;
  private szene = new THREE.Scene();
  private kamera = new THREE.PerspectiveCamera(42, 1, 0.1, 500);
  private steuerung: OrbitControls;
  private ro: ResizeObserver;
  private modell = new THREE.Group();
  private laeuft = true;
  private kugelGeo = new THREE.SphereGeometry(1, 48, 32);
  private stabGeo = new THREE.CylinderGeometry(1, 1, 1, 24, 1, true);
  private stoffe = new Map<string, THREE.Material>();

  constructor(private halter: HTMLElement, private dunkel: boolean) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    halter.appendChild(this.renderer.domElement);
    const stil = this.renderer.domElement.style;
    stil.display = "block";
    stil.width = "100%";
    stil.height = "100%";

    this.szene.add(this.modell);
    this.licht();

    this.kamera.position.set(0, 1.6, 11);
    this.steuerung = new OrbitControls(this.kamera, this.renderer.domElement);
    this.steuerung.enableDamping = true;
    this.steuerung.dampingFactor = 0.08;
    this.steuerung.enablePan = false;
    this.steuerung.autoRotate = true;
    this.steuerung.autoRotateSpeed = 1.1;
    this.steuerung.minDistance = 3;
    this.steuerung.maxDistance = 40;

    this.ro = new ResizeObserver(() => this.groesse());
    this.ro.observe(halter);
    this.groesse();
    this.schleife();
  }

  /**
   * Drei Lichter und eine Umgebung: ein warmes Hauptlicht von vorn oben, ein
   * kühles Gegenlicht von hinten für den Rand der Kugeln, dazu ein weiches
   * Grundlicht von oben und unten.
   */
  private licht() {
    const haupt = new THREE.DirectionalLight(0xfff4e6, 2.6);
    haupt.position.set(4, 6, 8);
    const gegen = new THREE.DirectionalLight(0x9fd0ff, 1.5);
    gegen.position.set(-6, 2, -7);
    const unten = new THREE.DirectionalLight(0xffffff, 0.45);
    unten.position.set(0, -6, 2);
    const grund = new THREE.HemisphereLight(
      this.dunkel ? 0x8fa6c4 : 0xffffff, this.dunkel ? 0x11151f : 0xc8cedb, this.dunkel ? 0.85 : 1.1);
    this.szene.add(haupt, gegen, unten, grund);
    // Eine gerechnete Umgebung gibt den glänzenden Kugeln etwas zum Spiegeln.
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const raum = new THREE.Scene();
    raum.background = new THREE.Color(this.dunkel ? 0x1b2436 : 0xeef1f6);
    const lampe = new THREE.Mesh(
      new THREE.SphereGeometry(6, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.BackSide }),
    );
    raum.add(lampe);
    this.szene.environment = pmrem.fromScene(raum, 0.04).texture;
    this.szene.environmentIntensity = this.dunkel ? 0.35 : 0.5;
    pmrem.dispose();
  }

  private stoff(farbe: string): THREE.Material {
    const da = this.stoffe.get(farbe);
    if (da) return da;
    const neu = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(farbe),
      roughness: 0.28,
      metalness: 0.0,
      clearcoat: 0.85,
      clearcoatRoughness: 0.22,
      sheen: 0.3,
    });
    this.stoffe.set(farbe, neu);
    return neu;
  }

  /** Baut das Molekül neu auf und stellt die Kamera darauf ein. */
  zeige(modell: Raummodell) {
    this.modell.clear();

    for (const a of modell.atome) {
      const kugel = new THREE.Mesh(this.kugelGeo, this.stoff(RAUMFARBE[a.el] ?? "#9aa3b2"));
      kugel.position.set(a.pos.x, a.pos.y, a.pos.z);
      kugel.scale.setScalar((RADIUS[a.el] ?? 0.4) * KUGEL * 2);
      this.modell.add(kugel);
    }

    for (const b of modell.bindungen) {
      const a1 = modell.atome[b.a].pos, a2 = modell.atome[b.b].pos;
      const von = new THREE.Vector3(a1.x, a1.y, a1.z);
      const bis = new THREE.Vector3(a2.x, a2.y, a2.z);
      const mitte = von.clone().add(bis).multiplyScalar(0.5);
      const achse = bis.clone().sub(von);
      const laenge = achse.length();
      // Mehrfachbindungen nebeneinander, quer zur Bindung versetzt.
      const quer = new THREE.Vector3(0, 0, 1).cross(achse).normalize();
      if (quer.lengthSq() < 0.1) quer.set(1, 0, 0).cross(achse).normalize();
      const dicke = b.grad === 1 ? STAB : STAB * 0.72;
      const plaetze = b.grad === 1 ? [0] : b.grad === 2 ? [-1, 1] : [-1, 0, 1];
      for (const platz of plaetze) {
        const weg = quer.clone().multiplyScalar(platz * dicke * 1.9);
        // Je Hälfte ein Stab in der Farbe seines Atoms.
        for (const [atom, ende] of [[b.a, von], [b.b, bis]] as const) {
          const stab = new THREE.Mesh(this.stabGeo, this.stoff(RAUMFARBE[modell.atome[atom].el] ?? "#9aa3b2"));
          const halbMitte = mitte.clone().add(ende).multiplyScalar(0.5).add(weg);
          stab.position.copy(halbMitte);
          stab.scale.set(dicke, laenge / 2, dicke);
          stab.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), achse.clone().normalize());
          this.modell.add(stab);
        }
      }
    }

    // Kamera so weit weg, dass alles ins Bild passt.
    const box = new THREE.Box3().setFromObject(this.modell);
    const groesse = box.getSize(new THREE.Vector3()).length() || 4;
    this.steuerung.target.set(0, 0, 0);
    this.kamera.position.set(0, groesse * 0.18, groesse * 1.15 + 2.2);
    this.steuerung.minDistance = groesse * 0.4;
    this.steuerung.maxDistance = groesse * 4 + 10;
    this.steuerung.update();
  }

  set drehen(an: boolean) {
    this.steuerung.autoRotate = an;
  }

  private groesse() {
    const b = this.halter.clientWidth, h = this.halter.clientHeight;
    if (!b || !h) return;
    this.renderer.setSize(b, h, false);
    this.kamera.aspect = b / h;
    this.kamera.updateProjectionMatrix();
  }

  private schleife = () => {
    if (!this.laeuft) return;
    requestAnimationFrame(this.schleife);
    this.steuerung.update();
    this.renderer.render(this.szene, this.kamera);
  };

  /** Das Bild als PNG — zum Einfügen in Arbeitsblätter. */
  alsPng(): string {
    this.renderer.render(this.szene, this.kamera);
    return this.renderer.domElement.toDataURL("image/png");
  }

  zerstoere() {
    this.laeuft = false;
    this.ro.disconnect();
    this.steuerung.dispose();
    this.kugelGeo.dispose();
    this.stabGeo.dispose();
    for (const s of this.stoffe.values()) s.dispose();
    this.szene.environment?.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
