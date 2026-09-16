/**
 * Das Erdmagnetfeld im Flug — und was ein Sonnensturm damit anstellt.
 *
 * Vier Teile, die zusammen die Geschichte erzählen:
 *   Feldlinien     wie bei einem Stabmagneten, aus dem Süden in den Norden
 *   Grenze         die Magnetopause, nur als Umriss aus Längslinien und drei
 *                  Querringen — eine ausgefüllte Blase legt sich wie Nebel
 *                  über die halbe Szene und erklärt trotzdem nichts
 *   Sonnenwind     Teilchenspuren, die von der Sonne kommen, sich vor der
 *                  Grenze stauen und außen herumlaufen. Erst daran sieht man,
 *                  warum die Blase vorn platt und hinten lang ist
 *   Polarlichter   zwei Vorhänge aus wandernden Strahlen um die Magnetpole
 *
 * Maßstab: die Radien der Körper stimmen im Flug, ihre Bahnen sind dagegen
 * logarithmisch gestaucht. Das Magnetfeld liegt zwischen beidem — es folgt
 * deshalb derselben Stauchung wie die Bahnen (flugFeldRadius), nur so, dass
 * die Linien am Boden anfangen. Dadurch stimmt, was man sieht: ISS und GPS
 * liegen innen, die geostationäre Bahn genau am Rand, der Mond streift den
 * Schweif und L1 und L2 liegen draußen. Die Form ist ein Schulbild, keine
 * Simulation.
 *
 * Koordinaten der Gruppe `huelle`: +y zeigt zur Sonne. Der Flug dreht sie
 * jedes Bild dorthin, hier wird durchweg in diesem Rahmen gerechnet.
 */
import * as THREE from "three";
import type { Koerper } from "@/lib/sonnensystem/daten";
import { flugFeldRadius, flugRadius } from "@/lib/sonnensystem/massstab";

const GRAD = Math.PI / 180;
/** L-Werte der gezeichneten Feldlinien, in Erdradien am Äquator. */
const SCHALEN = [1.6, 2.4, 3.6, 5.4, 8];
const MERIDIANE = 8;
const SCHRITTE = 40;
/** Neigung der Magnetachse gegen die Drehachse. */
const DIPOL_NEIGUNG = 11;
/** Nase der Magnetopause in Erdradien — dort steht der Sonnenwind gegen das Feld. */
const NASE = 10;
/** So weit reicht der gezeichnete Schweif nach hinten. */
const SCHWEIF_WINKEL = 152;
/** Teilchenspuren des Sonnenwindes. */
const WIND = 420;
/** Die Stoßfront liegt ein Stück vor der Grenze; dort staut sich der Wind. */
const STOSS = 1.3;
/** Länge einer Windspur in Szeneneinheiten — fest, nicht je Bild gerechnet. */
const SPUR = 0.9;

export interface Magnetfeld {
  /** Feldlinien und Polarlichter. Gehört unter die Achse der Erde. */
  feld: THREE.Group;
  /** Grenze und Sonnenwind. Muss jedes Bild zur Sonne gedreht werden. */
  huelle: THREE.Group;
  sichtbar(an: boolean): void;
  /**
   * Ein Bild weiter. `staerke` 0 = ruhig, 1 = voller Sturm: Wind schneller und
   * dichter, Grenze eingedrückt, Polarlichter hell und rot.
   */
  aktualisiere(dt: number, staerke: number, kameraOrt: THREE.Vector3): void;
  entsorgen(): void;
}

/**
 * Wie weit die Magnetopause in Richtung `winkel` von der Erde weg liegt:
 * r = Nase · (2 / (1 + cos w))^0,6 — die übliche Näherung. Bei 0° die Nase,
 * bei 152° der Schweif.
 */
const grenzRadius = (winkel: number, erde: Koerper) =>
  flugFeldRadius(NASE * Math.pow(2 / (1 + Math.cos(winkel)), 0.6) * erde.radiusKm, erde);

export function baueMagnetfeld(erde: Koerper): Magnetfeld {
  const feld = new THREE.Group();
  feld.visible = false;
  const huelle = new THREE.Group();
  huelle.visible = false;
  const rErde = flugRadius(erde);

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
    color: 0x74d8ff, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const dipol = new THREE.Group();
  dipol.rotation.x = DIPOL_NEIGUNG * GRAD;
  dipol.add(new THREE.LineSegments(linienGeo, linienMat));

  // ── Polarlichter: zwei Vorhänge um die Magnetpole ──
  const vorhangKarte = polarlichtKarte();
  const polarlichtMat = new THREE.MeshBasicMaterial({
    map: vorhangKarte, transparent: true, opacity: 0.5, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const ovalBreite = 67 * GRAD;
  // Unten am Boden eng, oben etwas weiter: die Strahlen folgen den Feldlinien.
  const unten = rErde * Math.cos(ovalBreite);
  const hoehe = rErde * 0.42;
  for (const seite of [1, -1]) {
    const vorhang = new THREE.Mesh(new THREE.CylinderGeometry(unten * 1.14, unten, hoehe, 72, 1, true), polarlichtMat);
    vorhang.position.y = seite * (rErde * Math.sin(ovalBreite) * 1.005 + hoehe / 2);
    vorhang.scale.y = seite;
    dipol.add(vorhang);
  }
  feld.add(dipol);

  // ── Grenze: der Umriss, und zwar immer der zur Kamera passende ──
  // Ein Netz aus Längs- und Querlinien sieht aus wie ein Käfig und sagt nichts.
  // Die Magnetopause ist ein Rotationskörper um die Sonnenrichtung; von jedem
  // Standpunkt aus ist ihr Umriss dasselbe Profil, nur in der Ebene, die
  // senkrecht zur Blickrichtung steht. Also wird genau das gezeichnet — eine
  // einzige Linie, die sich jedes Bild mitdreht, wie im Schulbuch.
  const UMRISS = 48;
  const profilY = new Float32Array(UMRISS + 1);
  const profilR = new Float32Array(UMRISS + 1);
  for (let i = 0; i <= UMRISS; i++) {
    const w = (i / UMRISS) * SCHWEIF_WINKEL * GRAD;
    const r = grenzRadius(w, erde);
    profilY[i] = Math.cos(w) * r;
    profilR[i] = Math.sin(w) * r;
  }
  const umrissPos = new Float32Array(UMRISS * 2 * 2 * 3);
  const umrissFarben = new Float32Array(UMRISS * 2 * 2 * 3);
  const hell = new THREE.Color(0x7cc4ff);
  const dunkel = new THREE.Color(0x000000);
  const mischung = new THREE.Color();
  for (let seite = 0; seite < 2; seite++) {
    for (let i = 0; i < UMRISS; i++) {
      for (let k = 0; k < 2; k++) {
        // Nach hinten ausblenden: der Schweif hat keine scharfe Kante.
        mischung.copy(hell).lerp(dunkel, ((i + k) / UMRISS) ** 0.9);
        const n = ((seite * UMRISS + i) * 2 + k) * 3;
        umrissFarben[n] = mischung.r;
        umrissFarben[n + 1] = mischung.g;
        umrissFarben[n + 2] = mischung.b;
      }
    }
  }
  const grenzGeo = new THREE.BufferGeometry();
  grenzGeo.setAttribute("position", new THREE.BufferAttribute(umrissPos, 3));
  grenzGeo.setAttribute("color", new THREE.BufferAttribute(umrissFarben, 3));
  const grenzMat = new THREE.LineBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const grenzLinie = new THREE.LineSegments(grenzGeo, grenzMat);
  grenzLinie.frustumCulled = false;
  huelle.add(grenzLinie);
  const quer = new THREE.Vector3();
  const blick = new THREE.Vector3();
  const dreheZurueck = new THREE.Quaternion();

  /** Legt den Umriss in die Ebene, die senkrecht auf der Blickrichtung steht. */
  const zeichneUmriss = (kameraOrt: THREE.Vector3, gedrueckt: number) => {
    blick.copy(kameraOrt).sub(huelle.position).applyQuaternion(dreheZurueck.copy(huelle.quaternion).invert());
    // Senkrecht auf Blick und Sonnenrichtung: darin liegt der Umriss.
    quer.set(-blick.z, 0, blick.x);
    if (quer.lengthSq() < 1e-9) quer.set(1, 0, 0);
    quer.normalize();
    for (let seite = 0; seite < 2; seite++) {
      const vorzeichen = seite === 0 ? 1 : -1;
      for (let i = 0; i < UMRISS; i++) {
        for (let k = 0; k < 2; k++) {
          const n = ((seite * UMRISS + i) * 2 + k) * 3;
          const r = profilR[i + k] * vorzeichen * gedrueckt;
          umrissPos[n] = quer.x * r;
          umrissPos[n + 1] = profilY[i + k] * gedrueckt;
          umrissPos[n + 2] = quer.z * r;
        }
      }
    }
    grenzGeo.attributes.position.needsUpdate = true;
  };

  // ── Sonnenwind: Spuren, die sich vor der Grenze stauen und außen herumlaufen ──
  const anfang = grenzRadius(0, erde) * 1.9;
  const schluss = -grenzRadius(SCHWEIF_WINKEL * GRAD, erde) * 1.1;
  const weite = grenzRadius(100 * GRAD, erde) * 1.25;
  const windOrt = new Float32Array(WIND * 3);
  const windSpur = new Float32Array(WIND * 6);
  const setzeNeu = (i: number, y = anfang) => {
    // Gleichmäßig über die Kreisfläche verteilt, sonst drängt sich alles innen.
    const w = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * weite;
    windOrt[i * 3] = Math.cos(w) * r;
    windOrt[i * 3 + 1] = y;
    windOrt[i * 3 + 2] = Math.sin(w) * r;
  };
  for (let i = 0; i < WIND; i++) setzeNeu(i, schluss + Math.random() * (anfang - schluss));
  const windGeo = new THREE.BufferGeometry();
  windGeo.setAttribute("position", new THREE.BufferAttribute(windSpur, 3));
  const windMat = new THREE.LineBasicMaterial({
    color: 0xffe9b8, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const wind = new THREE.LineSegments(windGeo, windMat);
  wind.frustumCulled = false;
  huelle.add(wind);

  let zeit = 0;

  return {
    feld,
    huelle,
    sichtbar(an) { feld.visible = an; huelle.visible = an; },

    aktualisiere(dt, staerke, kameraOrt) {
      zeit += dt;
      // ── Polarlichter: die Strahlen wandern, im Sturm heller und röter ──
      vorhangKarte.offset.x -= dt * (0.025 + staerke * 0.09);
      const flackern = 0.82 + 0.18 * Math.sin(zeit * 2.3) * Math.cos(zeit * 0.7);
      polarlichtMat.opacity = (0.5 + staerke * 0.6) * flackern;
      polarlichtMat.color.setRGB(1, 1 - staerke * 0.45, 1 - staerke * 0.2);
      linienMat.opacity = 0.28 + staerke * 0.3;

      // ── Grenze: der Sonnenwind drückt sie ein, im Sturm bis auf zwei Drittel ──
      const gedrueckt = 1 - staerke * 0.34;
      zeichneUmriss(kameraOrt, gedrueckt);
      grenzMat.opacity = 0.85 + staerke * 0.15;

      // ── Sonnenwind ──
      const tempo = (24 + staerke * 34) * dt;
      windMat.opacity = 0.55 + staerke * 0.4;
      windMat.color.setRGB(1, 0.92 - staerke * 0.3, 0.72 - staerke * 0.45);
      for (let i = 0; i < WIND; i++) {
        const k = i * 3;
        const vorX = windOrt[k], vorY = windOrt[k + 1], vorZ = windOrt[k + 2];
        windOrt[k + 1] -= tempo;
        // Vor der Stoßfront geht es nicht weiter geradeaus, sondern außen herum.
        const laenge = Math.hypot(windOrt[k], windOrt[k + 1], windOrt[k + 2]);
        const winkel = Math.acos(THREE.MathUtils.clamp(windOrt[k + 1] / Math.max(laenge, 1e-6), -1, 1));
        const soll = grenzRadius(Math.min(winkel, SCHWEIF_WINKEL * GRAD), erde) * gedrueckt * STOSS;
        if (laenge < soll) {
          const f = soll / Math.max(laenge, 1e-6);
          windOrt[k] *= f; windOrt[k + 1] *= f; windOrt[k + 2] *= f;
        }
        if (windOrt[k + 1] < schluss) setzeNeu(i);
        // Die Spur zeigt in die Bewegungsrichtung, ist aber immer gleich lang:
        // an der Länge des letzten Schrittes gemessen würde sie bei langsamen
        // Bildern zu Strahlen quer durchs Bild.
        const j = i * 6;
        const dx = windOrt[k] - vorX, dy = windOrt[k + 1] - vorY, dz = windOrt[k + 2] - vorZ;
        const schritt = SPUR / Math.max(Math.hypot(dx, dy, dz), 1e-6);
        windSpur[j] = windOrt[k] - dx * schritt;
        windSpur[j + 1] = windOrt[k + 1] - dy * schritt;
        windSpur[j + 2] = windOrt[k + 2] - dz * schritt;
        windSpur[j + 3] = windOrt[k];
        windSpur[j + 4] = windOrt[k + 1];
        windSpur[j + 5] = windOrt[k + 2];
      }
      windGeo.attributes.position.needsUpdate = true;
    },

    entsorgen() {
      linienGeo.dispose();
      linienMat.dispose();
      vorhangKarte.dispose();
      polarlichtMat.dispose();
      grenzGeo.dispose();
      grenzMat.dispose();
      windGeo.dispose();
      windMat.dispose();
    },
  };
}

/**
 * Der Vorhang als Bild: senkrechte Strahlen unterschiedlicher Breite, unten
 * violett angehaucht, in der Mitte grün, oben rot auslaufend — so sehen
 * Polarlichter wirklich aus. Sauerstoff leuchtet in 100 bis 150 km Höhe grün
 * und weiter oben rot, Stickstoff am unteren Rand violett.
 *
 * Die Textur wiederholt sich seitlich; im Flug wandert sie langsam, dadurch
 * zucken die Strahlen.
 */
function polarlichtKarte(): THREE.Texture {
  const bild = document.createElement("canvas");
  bild.width = 512;
  bild.height = 128;
  const stift = bild.getContext("2d")!;
  for (let i = 0; i < 220; i++) {
    const x = Math.random() * 512;
    const breite = 1 + Math.random() * 6;
    const kraft = 0.12 + Math.random() * 0.5;
    const lauf = stift.createLinearGradient(0, 128, 0, 0);
    lauf.addColorStop(0, "rgba(190,110,255,0)");
    lauf.addColorStop(0.07, `rgba(180,90,255,${kraft * 0.7})`);
    lauf.addColorStop(0.28, `rgba(70,255,140,${kraft})`);
    lauf.addColorStop(0.6, `rgba(90,255,190,${kraft * 0.45})`);
    lauf.addColorStop(0.85, `rgba(255,70,110,${kraft * 0.18})`);
    lauf.addColorStop(1, "rgba(255,70,110,0)");
    stift.fillStyle = lauf;
    stift.fillRect(x, 0, breite, 128);
  }
  const karte = new THREE.Texture(bild);
  karte.wrapS = THREE.RepeatWrapping;
  karte.needsUpdate = true;
  return karte;
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
