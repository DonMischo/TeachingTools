/**
 * Venturi-Rohr in 3D (three.js): gläsernes Rohr mit Konus, Engstelle und Diffusor,
 * Strömungsteilchen mit Tempo q/A(x), gefärbt nach dem örtlichen Druck,
 * gläserne Steigrohre (Wasser) bzw. Fläschchen mit Saugröhrchen (Luft).
 * Die Physik rechnet Venturi.tsx; die Szene zeigt nur, was sie bekommt.
 */
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

/** Abschnitte in Szeneneinheiten: weit | Konus | Engstelle | Diffusor | weit. */
export const ABSCHNITT = { a: -4.4, b: -2, c: -0.8, d: 0.6, e: 3, f: 4.4 };
/** Steigrohre (p₁, p₂, p₃) bzw. Röhrchen des Zerstäubers. */
export const STEIGROHR_X = [-3.2, -0.1, 3.7];
const MM = 0.018;           // Szeneneinheiten je mm Durchmesser (als Radius)
const SAEULE = 0.5;         // Szeneneinheiten je m Wassersäule
const OBEN = 4.6;           // obere Kante der Steigrohre
const TISCH = -2.3;         // Tischplatte
const N_TEILCHEN = 520, N_BLASEN = 36, N_TROPFEN = 90;

export const radiusBei = (x: number, d1: number, d2: number) => {
  const R1 = d1 * MM, R2 = d2 * MM, A = ABSCHNITT;
  if (x <= A.b || x >= A.e) return R1;
  const s = (t: number) => t * t * (3 - 2 * t);     // weiche Übergänge
  if (x < A.c) return R1 + (R2 - R1) * s((x - A.b) / (A.c - A.b));
  if (x <= A.d) return R2;
  return R2 + (R1 - R2) * s((x - A.d) / (A.e - A.d));
};
/** Oberkante der Wassersäule im Steigrohr bei x (Szeneneinheiten). */
export const saeulenOben = (x: number, p: number, dichte: number, d1: number, d2: number) =>
  Math.min(OBEN, radiusBei(x, d1, d2) + Math.max(0, p / (dichte * 9.81)) * SAEULE);

export type Schild = { id: string; text: string; pos: [number, number, number]; farbe?: string; gross?: boolean };
export type VenturiZustand = {
  luft: boolean; q: number; d1: number; d2: number;
  /** Druck p(x) in Pa (Überdruck), für die Farbe der Teilchen. */
  druck: (x: number) => number; pMin: number; pMax: number;
  saeulen: number[];          // Drücke p₁, p₂, p₃ (nur Wasser)
  dichte: number;
  saugt: boolean; kavitation: boolean;
  steigt: number;             // 0..1 Füllung des Saugröhrchens (Luft)
  spruehen: boolean;
  schilder: Schild[];
};

const KALT = new THREE.Color("hsl(250, 75%, 62%)"), MITTE = new THREE.Color("hsl(190, 85%, 60%)"), WARM = new THREE.Color("hsl(28, 95%, 58%)");
const druckFarbe = (t: number, ziel: THREE.Color) =>
  t < 0.5 ? ziel.copy(KALT).lerp(MITTE, t * 2) : ziel.copy(MITTE).lerp(WARM, (t - 0.5) * 2);

export class VenturiSzene {
  private renderer: THREE.WebGLRenderer;
  private szene = new THREE.Scene();
  private kamera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  private steuerung: OrbitControls;
  private beobachter: ResizeObserver;
  private rohr = new THREE.Group();
  private teilchen: THREE.InstancedMesh;
  private tStand = Array.from({ length: N_TEILCHEN }, () => ({ x: 0, r: 0, w: 0 }));
  private blasen: THREE.InstancedMesh;
  private bStand = Array.from({ length: N_BLASEN }, (_, i) => ({ x: 0, y: 0, z: 0, im: true, alter: i / N_BLASEN }));
  private kav: THREE.InstancedMesh;
  private kStand = Array.from({ length: 44 }, (_, i) => ({ x: ABSCHNITT.c + (i / 44) * 2.6, y: 0, z: 0, s: Math.random() }));
  private tropfen: THREE.InstancedMesh;
  private dStand: { x: number; y: number; z: number; vx: number; vy: number }[] = [];
  private steigrohre = new THREE.Group();
  private saeulen: THREE.Mesh[] = [];
  private zerstaeuber = new THREE.Group();
  private roehrchenFluessig: THREE.Mesh;
  private schildEbene: HTMLDivElement;
  private schildEl = new Map<string, HTMLDivElement>();
  private z: VenturiZustand | null = null;
  private profilSchluessel = "";
  private rahmen = 0;
  private letzte = 0;
  private hilf = new THREE.Object3D();
  private farbe = new THREE.Color();
  private v3 = new THREE.Vector3();

  constructor(private buehne: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.domElement.className = "absolute inset-0 w-full h-full touch-none";
    buehne.prepend(this.renderer.domElement);
    this.schildEbene = document.createElement("div");
    this.schildEbene.className = "absolute inset-0 pointer-events-none overflow-hidden";
    buehne.append(this.schildEbene);

    this.kamera.position.set(1.2, 3, 14.5);
    this.szene.add(new THREE.HemisphereLight(0xeef6ff, 0x6b5a48, 1.1));
    const licht = new THREE.DirectionalLight(0xffffff, 1.6);
    licht.position.set(3, 8, 6);
    this.szene.add(licht);

    this.steuerung = new OrbitControls(this.kamera, this.renderer.domElement);
    this.steuerung.target.set(0, 1.6, 0);
    this.steuerung.enableDamping = true;
    this.steuerung.enablePan = false;
    this.steuerung.minDistance = 6;
    this.steuerung.maxDistance = 20;
    this.steuerung.minPolarAngle = 0.35;
    this.steuerung.maxPolarAngle = 1.85;
    this.steuerung.minAzimuthAngle = -1.1;
    this.steuerung.maxAzimuthAngle = 1.1;
    this.steuerung.update();

    this.baueUmgebung();
    this.szene.add(this.rohr, this.steigrohre, this.zerstaeuber);

    const kugel = new THREE.SphereGeometry(1, 10, 8);
    this.teilchen = new THREE.InstancedMesh(kugel, new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0 }), N_TEILCHEN);
    this.teilchen.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < N_TEILCHEN; i++) {
      const t = this.tStand[i];
      t.x = ABSCHNITT.a - 1.6 + Math.random() * (ABSCHNITT.f - ABSCHNITT.a + 3.2);
      t.r = Math.sqrt(Math.random()) * 0.88; t.w = Math.random() * Math.PI * 2;
      this.teilchen.setColorAt(i, MITTE);
    }
    this.szene.add(this.teilchen);

    const blase = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1, transparent: true, opacity: 0.85 });
    this.blasen = new THREE.InstancedMesh(kugel, blase, N_BLASEN);
    this.kav = new THREE.InstancedMesh(kugel, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.05, emissive: 0x9fd8ff, emissiveIntensity: 0.35, transparent: true, opacity: 0.9 }), this.kStand.length);
    this.tropfen = new THREE.InstancedMesh(kugel, new THREE.MeshStandardMaterial({ color: new THREE.Color("hsl(310, 65%, 58%)"), roughness: 0.2 }), N_TROPFEN);
    for (const m of [this.blasen, this.kav, this.tropfen]) { m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.count = 0; this.szene.add(m); }

    // Zerstäuber: Fläschchen auf dem Tisch, Röhrchen bis an die Engstelle
    const x = STEIGROHR_X[1];
    const glas = glasMaterial();
    const flasche = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.9, 40, 1, true), glas);
    flasche.position.set(x, TISCH + 0.45, 0);
    const hals = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.55, 0.3, 32, 1, true), glas);
    hals.position.set(x, TISCH + 1.05, 0);
    const inhalt = new THREE.Mesh(new THREE.CylinderGeometry(0.57, 0.57, 0.55, 40), new THREE.MeshStandardMaterial({ color: new THREE.Color("hsl(310, 55%, 62%)"), transparent: true, opacity: 0.8, roughness: 0.15 }));
    inhalt.position.set(x, TISCH + 0.3, 0);
    const roehrchen = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1, 16, 1, true), glas);
    roehrchen.name = "roehrchen";
    this.roehrchenFluessig = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 12), (inhalt.material as THREE.Material));
    this.zerstaeuber.add(flasche, hals, inhalt, roehrchen, this.roehrchenFluessig);

    this.beobachter = new ResizeObserver(() => this.groesse());
    this.beobachter.observe(buehne);
    this.groesse();
    this.rahmen = requestAnimationFrame(this.schleife);
  }

  private baueUmgebung() {
    const holz = new THREE.MeshStandardMaterial({ color: 0x9a6b43, roughness: 0.8 });
    const tisch = new THREE.Mesh(new THREE.BoxGeometry(13, 0.3, 4.2), holz);
    tisch.position.set(0, TISCH - 0.15, 0);
    const kante = new THREE.Mesh(new THREE.BoxGeometry(13, 0.06, 4.25), new THREE.MeshStandardMaterial({ color: 0x7a5232, roughness: 0.7 }));
    kante.position.set(0, TISCH - 0.01, 0);
    this.szene.add(tisch, kante);
    // Stativ: zwei Stangen mit Schellen
    const metall = new THREE.MeshStandardMaterial({ color: 0x8a949e, metalness: 0.7, roughness: 0.35 });
    for (const sx of [-3.9, 4]) {
      const fuss = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.9), metall);
      fuss.position.set(sx, TISCH + 0.04, 0);
      const stange = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, -TISCH, 12), metall);
      stange.position.set(sx, TISCH / 2, 0);
      this.szene.add(fuss, stange);
    }
    // Zu- und Ablauf aus Metall
    for (const [x0, x1] of [[-7, ABSCHNITT.a], [ABSCHNITT.f, 7]]) {
      const l = x1 - x0;
      const r = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, l, 32), metall);
      r.rotation.z = Math.PI / 2;
      r.position.x = (x0 + x1) / 2;
      r.name = "metallrohr";
      if (x0 > 0) r.userData.auslass = true;
      this.szene.add(r);
    }
  }

  private groesse() {
    const w = this.buehne.clientWidth || 1, h = this.buehne.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.kamera.aspect = w / h;
    // schmal: weiter weg, damit das ganze Rohr ins Bild passt
    this.steuerung.minDistance = w / h < 1.2 ? 9 : 6;
    this.kamera.updateProjectionMatrix();
  }

  /** Rohrprofil, Steigrohre und Zerstäuber nach Durchmesser neu bauen. */
  private baueProfil(z: VenturiZustand) {
    entsorge(this.rohr); this.rohr.clear();
    entsorge(this.steigrohre); this.steigrohre.clear(); this.saeulen = [];
    const { d1, d2 } = z, A = ABSCHNITT;
    const punkte = (schrumpf: number) => {
      const p: THREE.Vector2[] = [];
      for (let i = 0; i <= 120; i++) {
        const x = A.a + (i / 120) * (A.f - A.a);
        p.push(new THREE.Vector2(Math.max(0.01, radiusBei(x, d1, d2) - schrumpf), x));
      }
      return p;
    };
    const lathe = (schrumpf: number, mat: THREE.Material) => {
      const g = new THREE.LatheGeometry(punkte(schrumpf), 48);
      g.rotateZ(-Math.PI / 2);
      return new THREE.Mesh(g, mat);
    };
    const aussen = lathe(0, glasMaterial());
    aussen.renderOrder = 3;
    const fuellung = lathe(0.025, new THREE.MeshStandardMaterial({
      color: z.luft ? 0xdfeaf2 : new THREE.Color("hsl(203, 85%, 55%)"), transparent: true, opacity: z.luft ? 0.08 : 0.28,
      roughness: 0.1, depthWrite: false, side: THREE.BackSide,
    }));
    fuellung.renderOrder = 2;
    this.rohr.add(fuellung, aussen);
    // Flansche an den Enden und Messingringe an den Übergängen
    const messing = new THREE.MeshStandardMaterial({ color: 0xc79a45, metalness: 0.8, roughness: 0.3 });
    const metall = new THREE.MeshStandardMaterial({ color: 0x8a949e, metalness: 0.7, roughness: 0.35 });
    for (const x of [A.a, A.f]) {
      const f = new THREE.Mesh(new THREE.CylinderGeometry(d1 * MM + 0.16, d1 * MM + 0.16, 0.16, 40), metall);
      f.rotation.z = Math.PI / 2; f.position.x = x;
      this.rohr.add(f);
    }
    for (const x of [A.b, A.c, A.d, A.e]) {
      const r = radiusBei(x, d1, d2);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r + 0.012, 0.022, 8, 48), messing);
      ring.rotation.y = Math.PI / 2; ring.position.x = x;
      this.rohr.add(ring);
    }
    this.szene.traverse(o => { if (o.name === "metallrohr") o.scale.set(d1 * MM + 0.04, 1, d1 * MM + 0.04); });

    // Steigrohre aus Glas mit Messingfuß
    const glas = glasMaterial();
    const wasser = new THREE.MeshStandardMaterial({ color: new THREE.Color("hsl(203, 85%, 52%)"), transparent: true, opacity: 0.85, roughness: 0.15 });
    for (const x of STEIGROHR_X) {
      const fuss = radiusBei(x, d1, d2) - 0.04;
      const roehre = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, OBEN - fuss, 24, 1, true), glas);
      roehre.position.set(x, (OBEN + fuss) / 2, 0);
      roehre.renderOrder = 3;
      const muffe = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.22, 0.18, 24), messing);
      muffe.position.set(x, fuss + 0.12, 0);
      const saeule = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.105, 1, 20), wasser);
      this.steigrohre.add(roehre, muffe, saeule);
      this.saeulen.push(saeule);
      // Skala: Striche je 0,5 m Wassersäule
      for (let m = 0.5; fuss + m * SAEULE < OBEN; m += 0.5) {
        const strich = new THREE.Mesh(new THREE.BoxGeometry(m % 1 === 0 ? 0.12 : 0.07, 0.012, 0.012), new THREE.MeshBasicMaterial({ color: 0x3c4650 }));
        strich.position.set(x + 0.15, fuss + 0.04 + m * SAEULE, 0.05);
        this.steigrohre.add(strich);
      }
    }
    // Saugröhrchen bis an die Unterseite der Engstelle
    const x = STEIGROHR_X[1], unten = -radiusBei(x, d1, d2) + 0.02, fussR = TISCH + 0.15;
    const roehrchen = this.zerstaeuber.getObjectByName("roehrchen")!;
    roehrchen.scale.y = unten - fussR;
    roehrchen.position.set(x, (unten + fussR) / 2, 0);
  }

  setze(z: VenturiZustand) {
    const schluessel = `${z.d1}|${z.d2}|${z.luft}`;
    if (schluessel !== this.profilSchluessel) { this.profilSchluessel = schluessel; this.baueProfil(z); }
    this.z = z;
    this.steigrohre.visible = !z.luft;
    this.zerstaeuber.visible = z.luft;
    // Zerstäuber: offenes Ende, damit der Sprühnebel sichtbar herauskommt
    this.szene.traverse(o => { if (o.userData.auslass) o.visible = !z.luft; });
    // Schilder abgleichen
    const da = new Set(z.schilder.map(s => s.id));
    for (const [id, el] of this.schildEl) if (!da.has(id)) { el.remove(); this.schildEl.delete(id); }
    for (const s of z.schilder) {
      let el = this.schildEl.get(s.id);
      if (!el) {
        el = document.createElement("div");
        el.style.cssText = "position:absolute;left:0;top:0;white-space:nowrap;border-radius:999px;font-weight:700;padding:1px 10px;background:var(--surface);color:var(--text);box-shadow:0 2px 6px rgb(0 0 0 / .18);transform-origin:center";
        this.schildEbene.append(el);
        this.schildEl.set(s.id, el);
      }
      el.textContent = s.text;
      el.style.border = `1.5px solid ${s.farbe ?? "#e0a000"}`;
      el.style.fontSize = s.gross ? "15px" : "13px";
    }
    if (!this.rahmen) this.zeichne();
  }

  private schleife = (jetzt: number) => {
    this.rahmen = 0;
    if (!document.hidden) {
      const dt = this.letzte ? Math.min(0.05, (jetzt - this.letzte) / 1000) : 0;
      this.schritt(dt);
    }
    this.letzte = jetzt;
    this.rahmen = requestAnimationFrame(this.schleife);
  };

  /** Ein Zeitschritt plus Bild (auch für Tests im versteckten Fenster). */
  schritt(dt: number) {
    const z = this.z;
    if (z) this.bewege(z, dt);
    this.steuerung.update();
    this.zeichne();
  }

  private bewege(z: VenturiZustand, dt: number) {
    const { d1, d2 } = z, A = ABSCHNITT, h = this.hilf;
    const tempo = (x: number) => {
      const r = radiusBei(x, d1, d2) / MM / 1000 * 2;            // Durchmesser in m
      const v = (z.q / 1000) / (Math.PI * r * r / 4);
      return Math.min(7, v * (z.luft ? 0.035 : 0.4));
    };
    const spanne = Math.max(1, z.pMax - z.pMin);
    const groesse = z.luft ? 0.035 : 0.05;
    for (let i = 0; i < N_TEILCHEN; i++) {
      const t = this.tStand[i];
      const R = radiusBei(t.x, d1, d2) - 0.04;
      t.x += tempo(t.x) * (1 - 0.35 * t.r * t.r) * dt;
      if (t.x > A.f + 1.6) { t.x = A.a - 1.6; t.w = Math.random() * Math.PI * 2; }
      h.position.set(t.x, Math.cos(t.w) * t.r * R, Math.sin(t.w) * t.r * R);
      // in der Engstelle gestreckt: Bewegungsunschärfe zeigt das Tempo
      const streck = 1 + Math.min(3, tempo(t.x) * 0.25);
      h.scale.set(groesse * streck, groesse, groesse);
      h.updateMatrix();
      this.teilchen.setMatrixAt(i, h.matrix);
      druckFarbe(Math.max(0, Math.min(1, (z.druck(t.x) - z.pMin) / spanne)), this.farbe);
      if (z.luft) this.farbe.lerp(new THREE.Color(0xe8eef3), 0.45);
      this.teilchen.setColorAt(i, this.farbe);
    }
    this.teilchen.instanceMatrix.needsUpdate = true;
    if (this.teilchen.instanceColor) this.teilchen.instanceColor.needsUpdate = true;

    // Wassersäulen
    if (!z.luft) z.saeulen.forEach((p, i) => {
      const x = STEIGROHR_X[i], fuss = radiusBei(x, d1, d2) - 0.04;
      const oben = saeulenOben(x, p, z.dichte, d1, d2);
      const s = this.saeulen[i];
      const hoehe = Math.max(0.001, oben - fuss);
      s.visible = oben > fuss + 0.05;
      s.scale.y = hoehe;
      s.position.set(x, fuss + hoehe / 2, 0);
    });

    // angesaugte Luft: Blasen das mittlere Steigrohr hinab, dann mit dem Strom
    const xs = STEIGROHR_X[1];
    if (z.saugt) {
      this.blasen.count = N_BLASEN;
      for (let i = 0; i < N_BLASEN; i++) {
        const b = this.bStand[i];
        b.alter += dt * 0.5;
        if (b.alter >= 1) { b.alter -= 1; b.im = true; b.x = xs; b.y = OBEN; b.z = 0; }
        if (b.im) {
          b.y = OBEN - b.alter * 6;
          b.x = xs + Math.sin(b.alter * 30 + i) * 0.03;
          if (b.y < radiusBei(xs, d1, d2)) { b.im = false; b.z = (Math.random() - 0.5) * 0.1; }
        } else {
          b.x += tempo(b.x) * dt;
          const R = radiusBei(b.x, d1, d2) - 0.08;
          b.y = Math.max(-R, Math.min(R, b.y + (Math.random() - 0.3) * dt * 0.8));
        }
        const s = 0.045 + (i % 3) * 0.015;
        h.position.set(b.x, b.y, b.z); h.scale.setScalar(b.x > A.f + 0.2 ? 0 : s); h.updateMatrix();
        this.blasen.setMatrixAt(i, h.matrix);
      }
      this.blasen.instanceMatrix.needsUpdate = true;
    } else this.blasen.count = 0;

    // Kavitation: Dampfblasen wachsen in der Engstelle und fallen im Diffusor zusammen
    if (z.kavitation) {
      this.kav.count = this.kStand.length;
      this.kStand.forEach((k, i) => {
        k.x += tempo(k.x) * dt * 0.8;
        if (k.x > A.d + 1.2) {
          k.x = A.c + Math.random() * 0.3; k.s = Math.random();
          const R = radiusBei(k.x, d1, d2) * 0.8, w = Math.random() * Math.PI * 2;
          k.y = Math.cos(w) * R * Math.random(); k.z = Math.sin(w) * R * Math.random();
        }
        const wachs = Math.min(1, (k.x - A.c) / (A.d - A.c));
        const zerfall = k.x > A.d ? Math.max(0, 1 - (k.x - A.d) / 1.2) ** 2 : 1;
        h.position.set(k.x, k.y, k.z); h.scale.setScalar((0.02 + 0.09 * wachs * (0.5 + k.s)) * zerfall); h.updateMatrix();
        this.kav.setMatrixAt(i, h.matrix);
      });
      this.kav.instanceMatrix.needsUpdate = true;
    } else this.kav.count = 0;

    // Zerstäuber: Flüssigkeit im Röhrchen, ab voller Höhe Tröpfchen in den Strom
    if (z.luft) {
      const unten = TISCH + 0.55, oben = -radiusBei(xs, d1, d2);
      const hoehe = Math.max(0.001, (oben - unten) * Math.min(1, z.steigt));
      this.roehrchenFluessig.scale.y = hoehe;
      this.roehrchenFluessig.position.set(xs, unten + hoehe / 2, 0);
      if (z.spruehen) for (let k = 0; k < 3; k++) if (this.dStand.length < N_TROPFEN)
        this.dStand.push({ x: xs, y: oben + 0.02, z: (Math.random() - 0.5) * 0.06, vx: 0, vy: 0.3 + Math.random() * 0.6 });
      this.dStand = this.dStand.filter(d => {
        const innen = d.x < A.f;
        const ziel = innen ? tempo(d.x) * 1.4 : 3;
        d.vx += (ziel - d.vx) * Math.min(1, dt * 4);
        d.vy = innen ? d.vy * (1 - dt * 3) : d.vy - 3 * dt;
        d.x += d.vx * dt; d.y += d.vy * dt;
        if (innen) { const R = radiusBei(d.x, d1, d2) - 0.04; d.y = Math.max(-R, Math.min(R, d.y)); }
        if (!innen) d.z += (Math.random() - 0.5) * dt * 2;
        return d.x < 8 && d.y > TISCH;
      });
      this.tropfen.count = this.dStand.length;
      this.dStand.forEach((d, i) => { h.position.set(d.x, d.y, d.z); h.scale.setScalar(d.x < A.f ? 0.03 : 0.045); h.updateMatrix(); this.tropfen.setMatrixAt(i, h.matrix); });
      this.tropfen.instanceMatrix.needsUpdate = true;
    } else { this.tropfen.count = 0; this.dStand = []; }
  }

  private zeichne() {
    this.renderer.render(this.szene, this.kamera);
    const z = this.z;
    if (!z) return;
    const w = this.buehne.clientWidth, hh = this.buehne.clientHeight;
    for (const s of z.schilder) {
      const el = this.schildEl.get(s.id);
      if (!el) continue;
      this.v3.set(...s.pos).project(this.kamera);
      const x = (this.v3.x * 0.5 + 0.5) * w, y = (-this.v3.y * 0.5 + 0.5) * hh;
      el.style.display = this.v3.z > 1 ? "none" : "block";
      el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    }
  }

  /** Bild als PNG (zum Prüfen). */
  bild() { this.zeichne(); return this.renderer.domElement.toDataURL("image/png"); }

  entsorgen() {
    cancelAnimationFrame(this.rahmen);
    this.rahmen = -1;
    this.beobachter.disconnect();
    this.steuerung.dispose();
    entsorge(this.szene);
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
    this.schildEbene.remove();
  }
}

function glasMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: 0xe6f3fb, transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0,
    clearcoat: 1, clearcoatRoughness: 0.05, side: THREE.DoubleSide, depthWrite: false,
  });
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
