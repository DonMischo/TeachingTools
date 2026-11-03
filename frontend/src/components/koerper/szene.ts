/**
 * three.js-Szene der Körper-Werkstatt: ein Körper zum Drehen, dessen
 * Teilflächen sich anklicken lassen, das Netz zum Auf- und Zuklappen,
 * zuschaltbare Linien und Ecken mit Beschriftung, und die
 * zusammengesetzten Körper zum Auseinanderziehen.
 *
 * Die Punkte kommen fertig aus lib/koerper-netz.ts — die Szene malt nur.
 * Beschriftungen sind HTML-Schildchen über der Leinwand, jedes Bild neu
 * projiziert.
 */
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { z } from "@/lib/prozent";
import { KOERPER, add, gl, mitte, type KoerperKey, type Masse, type Rund, type V3 } from "@/lib/koerper";
import { faltePolyeder, rolleRund, type NetzFlaeche } from "@/lib/koerper-netz";
import { ZUSAMMEN, type ZKey } from "@/lib/koerper-zusammen";

export type Ansicht = {
  key: KoerperKey; m: Masse;
  auswahl: string | null;
  /** Klappstand des Netzes (0 = flach, 1 = zu); null = kein Netz, normale Ansicht */
  netz: number | null;
  linien: string[];
  ecken: boolean;
  kanten: boolean;
  /** Flächen durchnummerieren (zum Zählen) */
  flaechen?: boolean;
};
export type ZAnsicht = { zkey: ZKey; m: Masse; auseinander: number };

export const FARBE = { G: "#3b82f6", D: "#10b981", M: ["#f59e0b", "#fbbf24"], wahl: "#e11d48", kante: "#db2777", verdeckt: "#ef4444" };
export const LINIENFARBE: Record<string, string> = {
  h: "#dc2626", hs: "#7c3aed", ha: "#7c3aed", hb: "#9333ea", s: "#ea580c", r: "#0891b2", r1: "#0891b2", r2: "#0e7490",
  d: "#16a34a", df: "#65a30d", hg: "#7c3aed", a: "#2563eb", b: "#2563eb", c: "#2563eb", g: "#2563eb", a2: "#2563eb",
};

const v3 = (p: V3) => new THREE.Vector3(p[0], p[1], p[2]);

function vieleck(pts: V3[]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pts.flat(), 3));
  const idx: number[] = [];
  for (let i = 1; i < pts.length - 1; i++) idx.push(0, i, i + 1);
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function gitter(unten: V3[], oben: V3[]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([...unten.flat(), ...oben.flat()], 3));
  const n = unten.length, idx: number[] = [];
  for (let i = 0; i < n - 1; i++) idx.push(i, i + 1, n + i + 1, i, n + i + 1, n + i);
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

type Schild = { el: HTMLDivElement; pos: THREE.Vector3 };

export class KoerperSzene {
  readonly renderer: THREE.WebGLRenderer;
  private szene = new THREE.Scene();
  private kamera = new THREE.PerspectiveCamera(40, 1, 0.05, 500);
  private steuerung: OrbitControls;
  private ro: ResizeObserver;
  private modell = new THREE.Group();
  private laeuft = true;
  private schilder: Schild[] = [];
  private ebene: HTMLDivElement;
  private stoffe = new Map<string, THREE.Material>();
  private zuletzt = "";
  private groesseZuletzt = 0;
  private druck: { x: number; y: number } | null = null;

  constructor(private halter: HTMLElement, private dunkel: boolean, private klick: (teil: string | null) => void) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    halter.appendChild(this.renderer.domElement);
    Object.assign(this.renderer.domElement.style, { display: "block", width: "100%", height: "100%", touchAction: "none" });
    this.ebene = document.createElement("div");
    Object.assign(this.ebene.style, { position: "absolute", inset: "0", pointerEvents: "none", overflow: "hidden" });
    halter.appendChild(this.ebene);

    this.szene.add(this.modell);
    const haupt = new THREE.DirectionalLight(0xffffff, 2.2);
    haupt.position.set(5, 9, 7);
    const gegen = new THREE.DirectionalLight(0xbfdcff, 0.9);
    gegen.position.set(-6, 3, -6);
    this.szene.add(haupt, gegen, new THREE.HemisphereLight(0xffffff, dunkel ? 0x1e293b : 0xcbd5e1, dunkel ? 1.1 : 1.4));

    this.kamera.position.set(8, 7, 12);
    this.steuerung = new OrbitControls(this.kamera, this.renderer.domElement);
    this.steuerung.enableDamping = true;
    this.steuerung.dampingFactor = 0.08;
    this.steuerung.enablePan = false;

    const el = this.renderer.domElement;
    el.addEventListener("pointerdown", this.runter);
    el.addEventListener("pointerup", this.hoch);

    this.ro = new ResizeObserver(() => this.groesse());
    this.ro.observe(halter);
    this.groesse();
    this.schleife();
  }

  set drehen(an: boolean) {
    this.steuerung.autoRotate = an;
    this.steuerung.autoRotateSpeed = 1.2;
  }

  private runter = (e: PointerEvent) => { this.druck = { x: e.clientX, y: e.clientY }; };
  private hoch = (e: PointerEvent) => {
    const d = this.druck;
    this.druck = null;
    if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) return;
    const r = this.renderer.domElement.getBoundingClientRect();
    const zeiger = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    const strahl = new THREE.Raycaster();
    strahl.setFromCamera(zeiger, this.kamera);
    const ziele = this.modell.children.filter(o => (o as THREE.Mesh).isMesh && o.userData.teil);
    const treffer = strahl.intersectObjects(ziele, false)[0];
    this.klick(treffer ? (treffer.object.userData.teil as string) : null);
  };

  private stoff(farbe: string, deckkraft: number): THREE.Material {
    const k = `${farbe}|${deckkraft}`;
    const da = this.stoffe.get(k);
    if (da) return da;
    const neu = new THREE.MeshStandardMaterial({
      color: new THREE.Color(farbe), transparent: deckkraft < 1, opacity: deckkraft, side: THREE.DoubleSide,
      depthWrite: deckkraft >= 0.9, roughness: 0.55, metalness: 0, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
    });
    this.stoffe.set(k, neu);
    return neu;
  }

  private linienStoff(farbe: string, gestrichelt: boolean, durch = false): THREE.Material {
    const k = `l${farbe}|${gestrichelt}|${durch}`;
    const da = this.stoffe.get(k);
    if (da) return da;
    const neu = gestrichelt
      ? new THREE.LineDashedMaterial({ color: farbe, dashSize: 0.25, gapSize: 0.15, depthTest: !durch, transparent: true })
      : new THREE.LineBasicMaterial({ color: farbe, depthTest: !durch, transparent: true });
    this.stoffe.set(k, neu);
    return neu;
  }

  private leeren() {
    for (const o of [...this.modell.children]) {
      this.modell.remove(o);
      (o as THREE.Mesh).geometry?.dispose();
    }
    for (const s of this.schilder) s.el.remove();
    this.schilder = [];
  }

  private schild(text: string, pos: V3, farbe = "#111827", gross = false) {
    const el = document.createElement("div");
    el.textContent = text;
    Object.assign(el.style, {
      position: "absolute", transform: "translate(-50%, -50%)", whiteSpace: "nowrap", font: `700 ${gross ? 14 : 13}px system-ui, sans-serif`,
      color: farbe, background: this.dunkel ? "rgba(15,23,42,0.82)" : "rgba(255,255,255,0.88)", padding: "1px 6px", borderRadius: "6px",
      border: `1px solid ${farbe}55`,
    });
    if (this.dunkel && farbe === "#111827") el.style.color = "#f1f5f9";
    this.ebene.appendChild(el);
    this.schilder.push({ el, pos: v3(pos) });
  }

  private flaeche(pts: V3[], teil: string, farbe: string, deckkraft = 0.72) {
    const mesh = new THREE.Mesh(vieleck(pts), this.stoff(farbe, deckkraft));
    mesh.userData.teil = teil;
    this.modell.add(mesh);
  }

  private zug(pts: V3[], farbe: string, zu = true, gestrichelt = false, durch = false) {
    const g = new THREE.BufferGeometry().setFromPoints(pts.map(v3));
    const l = zu ? new THREE.LineLoop(g, this.linienStoff(farbe, gestrichelt, durch)) : new THREE.Line(g, this.linienStoff(farbe, gestrichelt, durch));
    if (gestrichelt) l.computeLineDistances();
    if (durch) l.renderOrder = 10;
    this.modell.add(l);
  }

  /** Kante als dünne Röhre (WebGL-Linien sind nur 1 px breit). */
  private stab(a: V3, b: V3, farbe: string, dicke: number) {
    const A = v3(a), B = v3(b), l = A.distanceTo(B);
    if (l < 1e-6) return;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(dicke, dicke, l, 10), this.stoff(farbe, 1));
    m.position.copy(A.clone().add(B).multiplyScalar(0.5));
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
    this.modell.add(m);
  }

  private punkt(p: V3, farbe: string, r: number) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), this.stoff(farbe, 1));
    m.position.copy(v3(p));
    this.modell.add(m);
  }

  private farbeFuer(teil: string, auswahl: string | null): [string, number] {
    if (auswahl && (teil === auswahl || (auswahl === "M" && teil.startsWith("M")))) return [FARBE.wahl, 0.9];
    const g = teil[0] as "G" | "D" | "M";
    if (g === "M") return [FARBE.M[(Number(teil.slice(1)) || 1) % 2], 0.62];
    return [FARBE[g] ?? FARBE.M[0], 0.62];
  }

  /** Ein Körper aus dem Labor. */
  zeige(a: Ansicht) {
    this.leeren();
    const k = KOERPER[a.key], d = k.rechne(a.m);
    const t = a.netz ?? 1;
    const dick = Math.max(0.025, Math.max(...Object.values(a.m)) * 0.008);
    const ausgewaehlt: V3[] = [];

    if (k.poly) {
      const p = k.poly(a.m);
      const faces: NetzFlaeche[] = a.netz === null ? p.flaechen.map(f => ({ teil: f.teil, pts: f.idx.map(i => p.ecken[i]) })) : faltePolyeder(p, t);
      for (const f of faces) {
        const [farbe, dk] = this.farbeFuer(f.teil, a.auswahl);
        this.flaeche(f.pts, f.teil, farbe, dk);
        if (a.kanten) for (let i = 0; i < f.pts.length; i++) this.stab(f.pts[i], f.pts[(i + 1) % f.pts.length], FARBE.kante, dick * 1.6);
        else this.zug(f.pts, this.dunkel ? "#e2e8f0" : "#1f2937");
        if (a.auswahl && (f.teil === a.auswahl)) ausgewaehlt.push(mitte(f.pts));
      }
      if (a.flaechen) faces.forEach((f, i) => this.schild(String(i + 1), mitte(f.pts), "#1d4ed8", true));
      if (a.ecken && a.netz === null) {
        p.ecken.forEach((e, i) => {
          this.punkt(e, FARBE.kante, dick * 3.2);
          this.schild(p.namen[i], add(e, [0, Math.max(0.25, dick * 9), 0]));
        });
      }
    } else {
      const r = k.rund!(a.m);
      this.rund(r, a.auswahl, a.netz, ausgewaehlt, a.kanten ? dick * 1.6 : 0);
      if (a.ecken && r.art === "mantel" && r.r2 === 0 && a.netz === null) {
        this.punkt([0, r.h, 0], FARBE.kante, dick * 3.2);
        this.schild("S (Spitze)", [0, r.h + 0.4, 0]);
      }
    }

    if (a.netz === null) {
      for (const id of a.linien) {
        const l = d.linien.find(x => x.id === id);
        if (!l) continue;
        const farbe = LINIENFARBE[l.id] ?? "#dc2626";
        this.zug([l.von, l.bis], farbe, false, !l.kante, true);
        if (l.kante) this.stab(l.von, l.bis, farbe, dick * 1.3);
        this.schild(`${l.zeichen} ${gl(l.wert)} ${z(l.wert)} cm`, mitte([l.von, l.bis]), farbe);
      }
    }

    const teil = a.auswahl ? d.teile.find(x => x.id === a.auswahl) : null;
    if (teil && ausgewaehlt.length) this.schild(`${teil.name}: ${z(teil.wert)} cm²`, ausgewaehlt[0], FARBE.wahl, true);

    this.rahme(`${a.key}|${a.netz === null ? "zu" : "netz"}`, a.netz === null ? [1, 0.75, 1.3] : k.poly ? [0.15, 1.6, 0.7] : [0.2, 0.25, 1.4]);
  }

  /** Drehkörper: Mantel gerollt nach `netz`, Kugeln als Kugeln. `versatz`/`kopf` für zusammengesetzte Körper. */
  private rund(r: Rund, auswahl: string | null, netz: number | null, ausgewaehlt: V3[], kante: number,
    opt: { versatz?: V3; kopf?: boolean; farbe?: string; verdeckt?: string[]; deckkraft?: number } = {}) {
    const ver = opt.versatz ?? [0, 0, 0];
    const lage = (p: V3): V3 => add(opt.kopf ? [p[0], r.h - p[1], p[2]] : p, ver);
    const farbe = (teil: string): [string, number] =>
      opt.verdeckt?.includes(teil) ? [FARBE.verdeckt, 0.55] : opt.farbe ? [opt.farbe, opt.deckkraft ?? 0.62] : this.farbeFuer(teil, auswahl);
    const linie = this.dunkel ? "#e2e8f0" : "#1f2937";

    if (r.art !== "mantel") {
      const halb = r.art === "halbkugel";
      const geo = new THREE.SphereGeometry(r.r1, 64, 32, 0, Math.PI * 2, 0, halb ? Math.PI / 2 : Math.PI);
      const [f, dk] = farbe("M");
      const m = new THREE.Mesh(geo, this.stoff(f, dk));
      m.position.copy(v3(lage(halb ? [0, 0, 0] : [0, r.r1, 0])));
      m.userData.teil = "M";
      this.modell.add(m);
      if (auswahl === "M") ausgewaehlt.push(lage([0, halb ? r.r1 * 0.7 : r.r1 * 1.6, r.r1 * 0.5]));
      const ring = Array.from({ length: 64 }, (_, i): V3 => [r.r1 * Math.cos(i / 64 * 2 * Math.PI), halb ? 0 : r.r1, r.r1 * Math.sin(i / 64 * 2 * Math.PI)]).map(lage);
      if (halb) {
        const [fg, dg] = farbe("G");
        this.flaeche(ring, "G", fg, dg);
        if (auswahl === "G") ausgewaehlt.push(lage([0, 0, 0]));
      }
      this.zug(ring, linie, true, !halb);
      return;
    }

    const n = rolleRund(r, netz ?? 1);
    const [fm, dm] = farbe("M");
    const mantel = new THREE.Mesh(gitter(n.mantel[0].map(lage), n.mantel[1].map(lage)), this.stoff(fm, dm));
    mantel.userData.teil = "M";
    this.modell.add(mantel);
    if (auswahl === "M") ausgewaehlt.push(lage(mitte([...n.mantel[0], ...n.mantel[1]].filter((_, i) => i % 16 === 0))));
    const zeich = (pts: V3[], zu: boolean) => {
      if (kante) for (let i = 0; i < pts.length - (zu ? 0 : 1); i++) this.stab(pts[i], pts[(i + 1) % pts.length], FARBE.kante, kante);
      else this.zug(pts, linie, zu);
    };
    for (const c of n.kreise) {
      const pts = c.pts.map(lage);
      const [f, dk] = farbe(c.teil);
      this.flaeche(pts, c.teil, f, dk);
      zeich(pts, true);
      if (auswahl === c.teil) ausgewaehlt.push(mitte(pts));
    }
    if (netz !== null && netz < 0.999) {
      const [u, o] = n.mantel;
      zeich([u[0], o[0]].map(lage), false);
      zeich([u[u.length - 1], o[o.length - 1]].map(lage), false);
      zeich(u.map(lage), false);
      if (r.r2 > 0) zeich(o.map(lage), false);
    }
  }

  /** Zusammengesetzter Körper; `auseinander` (0–1) zieht die Teile auseinander. */
  zeigeZusammen(a: ZAnsicht) {
    this.leeren();
    const k = ZUSAMMEN[a.zkey];
    const steine = k.bausteine(a.m);
    const weit = Math.max(...Object.values(a.m)) * 0.9 * a.auseinander;
    const farben = ["#3b82f6", "#f59e0b"];
    const linie = this.dunkel ? "#e2e8f0" : "#1f2937";
    steine.forEach((s, i) => {
      const ver = add(s.versatz, [s.abheben[0] * weit, s.abheben[1] * weit, s.abheben[2] * weit]);
      const farbe = s.weg ? FARBE.verdeckt : farben[i % 2];
      const deck = s.weg ? 0.5 : steine.some(x => x.weg) ? 0.35 : 0.62;
      if (s.poly) {
        for (const f of s.poly.flaechen) {
          const pts = f.idx.map(j => add(s.poly!.ecken[j], ver));
          const verdeckt = s.verdeckt?.includes(f.teil);
          this.flaeche(pts, verdeckt ? "X" : s.name, verdeckt ? FARBE.verdeckt : farbe, verdeckt ? 0.55 : deck);
          this.zug(pts, linie);
        }
      } else if (s.rund) {
        this.rund(s.rund, null, null, [], 0, { versatz: ver, kopf: s.kopf, farbe, verdeckt: s.verdeckt, deckkraft: deck });
      }
      const hoehe = s.rund ? s.rund.h : Math.max(...s.poly!.ecken.map(e => e[1]));
      if (a.auseinander > 0.05 || s.weg) this.schild(s.weg ? `${s.name} (wird abgezogen)` : s.name, add(ver, [0, hoehe / 2, 0]), s.weg ? FARBE.verdeckt : "#111827");
      if (s.weg && s.rund) {
        // Rand der Bohrung bleibt im Werkstück sichtbar.
        const ring = (y: number) => Array.from({ length: 48 }, (_, j): V3 => [s.rund!.r1 * Math.cos(j / 48 * 2 * Math.PI), y, s.rund!.r1 * Math.sin(j / 48 * 2 * Math.PI)]);
        this.zug(ring(0), linie);
        this.zug(ring(s.rund.h), linie);
      }
    });
    this.rahme(`z|${a.zkey}`, [1, 0.7, 1.3]);
  }

  /** Kamera neu ausrichten, wenn sich Körper/Modus ändert oder die Größe deutlich springt. */
  private rahme(schluessel: string, richtung: V3) {
    const box = new THREE.Box3().setFromObject(this.modell);
    const groesse = box.getSize(new THREE.Vector3()).length() || 4;
    const neu = schluessel !== this.zuletzt;
    if (!neu && Math.abs(groesse / (this.groesseZuletzt || 1) - 1) < 0.3) return;
    const ziel = box.getCenter(new THREE.Vector3());
    const dir = neu ? v3(richtung).normalize() : this.kamera.position.clone().sub(this.steuerung.target).normalize();
    this.steuerung.target.copy(ziel);
    this.kamera.position.copy(ziel.clone().add(dir.multiplyScalar(groesse * 1.25 + 1)));
    this.steuerung.minDistance = groesse * 0.3;
    this.steuerung.maxDistance = groesse * 5 + 10;
    this.steuerung.update();
    this.zuletzt = schluessel;
    this.groesseZuletzt = groesse;
  }

  private groesse() {
    const b = this.halter.clientWidth, h = this.halter.clientHeight;
    if (!b || !h) return;
    this.renderer.setSize(b, h, false);
    this.kamera.aspect = b / h;
    this.kamera.updateProjectionMatrix();
  }

  /** Ein Bild rechnen und die Schildchen nachziehen (auch für Tests ohne laufende Schleife). */
  bild() {
    this.steuerung.update();
    this.renderer.render(this.szene, this.kamera);
    const b = this.halter.clientWidth, h = this.halter.clientHeight;
    for (const s of this.schilder) {
      const p = s.pos.clone().project(this.kamera);
      s.el.style.left = `${(p.x + 1) / 2 * b}px`;
      s.el.style.top = `${(1 - p.y) / 2 * h}px`;
      s.el.style.display = p.z > 1 ? "none" : "";
    }
  }

  private schleife = () => {
    if (!this.laeuft) return;
    requestAnimationFrame(this.schleife);
    this.bild();
  };

  alsPng(): string {
    this.bild();
    return this.renderer.domElement.toDataURL("image/png");
  }

  zerstoere() {
    this.laeuft = false;
    this.leeren();
    this.ro.disconnect();
    this.steuerung.dispose();
    this.renderer.domElement.removeEventListener("pointerdown", this.runter);
    this.renderer.domElement.removeEventListener("pointerup", this.hoch);
    for (const s of this.stoffe.values()) s.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.ebene.remove();
  }
}
