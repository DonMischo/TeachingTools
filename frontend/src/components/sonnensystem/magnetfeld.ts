/**
 * Das Erdmagnetfeld im Flug — und was ein Sonnensturm damit anstellt.
 *
 * Drei Teile, die zusammen die Geschichte erzählen:
 *   Feldlinien     wie bei einem Stabmagneten, aus dem Süden in den Norden
 *   Hülle          die Magnetopause: sonnenseitig flach gedrückt, hinten ein
 *                  langer Schweif — das macht der Sonnenwind
 *   Polarlichter   zwei Ringe um die Magnetpole, wo die Teilchen ankommen
 *
 * Maßstab: die Radien der Körper stimmen im Flug, ihre Bahnen sind dagegen
 * logarithmisch gestaucht. Das Magnetfeld liegt zwischen beidem — es folgt
 * deshalb derselben Stauchung wie die Bahnen (flugFeldRadius), nur so, dass
 * die Linien am Boden anfangen. Dadurch stimmt, was man sieht: ISS und GPS
 * liegen innen, die geostationäre Bahn genau am Rand, der Mond streift den
 * Schweif und L1 und L2 liegen draußen. Die Form ist ein Schulbild, keine
 * Simulation.
 */
import * as THREE from "three";
import type { Koerper } from "@/lib/sonnensystem/daten";
import { flugFeldRadius, flugRadius } from "@/lib/sonnensystem/massstab";

const GRAD = Math.PI / 180;
/** L-Werte der gezeichneten Schalen, in Erdradien am Äquator. */
const SCHALEN = [1.6, 2.4, 3.6, 5.4, 8];
const MERIDIANE = 8;
const SCHRITTE = 40;
/** Neigung der Magnetachse gegen die Drehachse. */
const DIPOL_NEIGUNG = 11;
/** Nase der Magnetopause in Erdradien — dort steht der Sonnenwind gegen das Feld. */
const NASE = 10;

export interface Magnetfeld {
  /** Feldlinien und Polarlichter. Gehört unter die Achse der Erde. */
  feld: THREE.Group;
  /** Die Hülle. Steht für sich: sie muss jedes Bild zur Sonne gedreht werden. */
  huelle: THREE.Group;
  sichtbar(an: boolean): void;
  /** 0 = ruhig, 1 = voller Sturm: Polarlichter hell, Hülle eingedrückt. */
  sturm(staerke: number): void;
  entsorgen(): void;
}

export function baueMagnetfeld(erde: Koerper): Magnetfeld {
  const feld = new THREE.Group();
  feld.visible = false;
  const huelle = new THREE.Group();
  huelle.visible = false;

  // ── Feldlinien ──
  const linien: number[] = [];
  for (const L of SCHALEN) {
    const breiteMax = Math.acos(Math.sqrt(1 / L));
    for (let j = 0; j < MERIDIANE; j++) {
      const laenge = (j / MERIDIANE) * Math.PI * 2;
      let vor: [number, number, number] | null = null;
      for (let i = 0; i <= SCHRITTE; i++) {
        const breite = -breiteMax + (2 * breiteMax * i) / SCHRITTE;
        // Dipol: r = L · cos²(Breite), in Erdradien.
        const r = flugFeldRadius(L * Math.cos(breite) ** 2 * erde.radiusKm, erde);
        const p: [number, number, number] = [
          r * Math.cos(breite) * Math.cos(laenge),
          r * Math.sin(breite),
          r * Math.cos(breite) * Math.sin(laenge),
        ];
        if (vor) linien.push(...vor, ...p);
        vor = p;
      }
    }
  }
  const linienGeo = new THREE.BufferGeometry();
  linienGeo.setAttribute("position", new THREE.Float32BufferAttribute(linien, 3));
  const linienMat = new THREE.LineBasicMaterial({
    color: 0x74d8ff, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const dipol = new THREE.Group();
  dipol.rotation.x = DIPOL_NEIGUNG * GRAD;
  dipol.add(new THREE.LineSegments(linienGeo, linienMat));

  // ── Polarlichter: zwei Ringe um die Magnetpole ──
  const rErde = flugRadius(erde);
  const polarlichtMat = new THREE.MeshBasicMaterial({
    color: 0x6bffb0, transparent: true, opacity: 0.4, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const ovalBreite = 67 * GRAD;
  for (const seite of [1, -1]) {
    // Ein Kegelmantel vom Oval nach oben: von unten sieht das aus wie ein Vorhang.
    const unten = rErde * Math.cos(ovalBreite);
    const geo = new THREE.CylinderGeometry(unten * 0.7, unten, rErde * 0.4, 64, 1, true);
    const ring = new THREE.Mesh(geo, polarlichtMat);
    ring.position.y = seite * rErde * Math.sin(ovalBreite) * 1.02;
    dipol.add(ring);
  }
  feld.add(dipol);

  // ── Hülle: ein Rotationskörper um die Sonnenrichtung ──
  // r(Winkel) = Nase · (2 / (1 + cos Winkel))^0,6 — die übliche Näherung für
  // die Magnetopause. Bei 150° ist daraus der lange Schweif geworden.
  const profil: THREE.Vector2[] = [];
  for (let i = 0; i <= 40; i++) {
    const w = (i / 40) * 152 * GRAD;
    const rErdradien = NASE * Math.pow(2 / (1 + Math.cos(w)), 0.6);
    const r = flugFeldRadius(rErdradien * erde.radiusKm, erde);
    profil.push(new THREE.Vector2(Math.max(r * Math.sin(w), 0.001), r * Math.cos(w)));
  }
  // Als Drahtnetz statt als Fläche: eine gefüllte Blase dieser Größe legt sich
  // wie Nebel über die halbe Szene, das Netz zeigt die Form genauso gut.
  const huellenMat = new THREE.MeshBasicMaterial({
    color: 0x4ab0ff, transparent: true, opacity: 0.22, wireframe: true,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const huellenMesh = new THREE.Mesh(new THREE.LatheGeometry(profil.filter((_, i) => i % 3 === 0), 20), huellenMat);
  huelle.add(huellenMesh);
  // Die Stoßfront davor: dort wird der Sonnenwind abgebremst.
  const stossMat = new THREE.MeshBasicMaterial({
    color: 0xffb060, transparent: true, opacity: 0.12, wireframe: true,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const stoss = new THREE.Mesh(
    new THREE.LatheGeometry(profil.filter((_, i) => i % 6 === 0).map(p => p.clone().multiplyScalar(1.3)), 14),
    stossMat,
  );
  huelle.add(stoss);

  return {
    feld,
    huelle,
    sichtbar(an) { feld.visible = an; huelle.visible = an; },
    sturm(staerke) {
      polarlichtMat.opacity = 0.25 + staerke * 0.75;
      polarlichtMat.color.setHSL(0.38 - staerke * 0.28, 1, 0.55);
      linienMat.opacity = 0.45 + staerke * 0.35;
      // Der Sonnenwind drückt die Hülle ein — im Sturm bis auf zwei Drittel.
      const gedrueckt = 1 - staerke * 0.34;
      huellenMesh.scale.set(gedrueckt, gedrueckt, gedrueckt);
      stoss.scale.set(gedrueckt, gedrueckt, gedrueckt);
      huellenMat.opacity = 0.22 + staerke * 0.3;
      stossMat.opacity = 0.12 + staerke * 0.35;
    },
    entsorgen() {
      linienGeo.dispose();
      linienMat.dispose();
      polarlichtMat.dispose();
      huellenMesh.geometry.dispose();
      huellenMat.dispose();
      stoss.geometry.dispose();
      stossMat.dispose();
    },
  };
}

/**
 * Die Wolke eines Sonnensturms: eine Blase, die von der Sonne wegwächst.
 *
 * Echt sind das ein bis drei Tage bis zur Erde; hier sind es zwölf Sekunden,
 * sonst säße man nur da. Den Ablauf steuert der Flug (Flug.tsx).
 */
export function baueSturmwolke(): { wolke: THREE.Mesh; setze(radius: number, kraft: number): void; entsorgen(): void } {
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffa23a, transparent: true, opacity: 0, side: THREE.DoubleSide, wireframe: true,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const wolke = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 14), mat);
  wolke.visible = false;
  wolke.frustumCulled = false;
  return {
    wolke,
    setze(radius, kraft) {
      wolke.visible = kraft > 0;
      wolke.scale.setScalar(Math.max(radius, 0.01));
      mat.opacity = kraft * 0.6;
    },
    entsorgen() { wolke.geometry.dispose(); mat.dispose(); },
  };
}
