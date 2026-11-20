/**
 * Gebäude der freien 3D-Ansicht aus Blender-Kacheln und -Ausstattung:
 *
 * - Mauern, Boden und Decke je Baustil als Kacheln (scripts/bausatz/kacheln.py): Farbe mit gebackenen
 *   Schatten und eine Normal-Map, damit das Licht über Fugen und Kanten streift. Eine Kachel = ein Feld.
 * - Die Decke ist nur von unten zu sehen — von oben (Draufsicht, weit herausgezoomt) fällt sie weg.
 * - Ausstattung (scripts/bausatz/verlies3d.py), je Stil ein Rezept (REZEPT): Torrahmen, Pfeiler,
 *   Fackeln, Banner, Fenster, Balken, Ketten, Fässer, Kisten, Knochen, Kerzen, Geröll.
 * - Dunkle Stile: die vier Fackeln, die der Figur am nächsten sind, werfen echtes, flackerndes Licht.
 *
 * Gibt null zurück, solange Kacheln oder Ausstattung nicht geladen sind — dann baut welt.ts das schlichte Haus.
 */
import * as THREE from "three";
import { DURCHGANG, PLATZ, WAND, ZELLE, feldMitte, istFrei, type FreiEbene } from "@/lib/gebaeude/frei";
import { bauKacheln, bausatz, kachelName, type BauTeil, type Kachel } from "../bausatz";
import { STILE, type Stil } from "../szene";
import { zufallAus } from "../stoff";
import { himmel, reihe, schweben, umland, type Landschaft, type Stimmung, type Stueck } from "./welt";

/** Mauerhöhe wie im schlichten Haus (2,4 + wandH · 1,1 beim Verlies) */
export const H3 = 4.05;
const AUSSTATTUNG = "verlies3d";
const LICHTER = 4;

type Kram = "fass" | "kiste" | "knochen" | "kerzen" | "geroell";

interface Rezept {
  /** Mauerkachel reicht über die ganze Wandhöhe H3 statt eines Feldes (Fachwerk: Schwelle bis Rähm) */
  mauerHoch?: boolean;
  /** dämmrig: Fackellicht wandert mit, Nebel dicht */
  dunkel: boolean;
  /** Anteil der Wandseiten mit Fackel, Banner (rot/blau), Fenster */
  fackel: number; banner: number; fenster: number;
  /** Farbe, in der die Fensterscheiben leuchten (Mondlicht, Tageslicht, Kirchenfenster, Bildschirm) */
  fensterTon: number;
  /** Gerümpel an den Wänden: Anteil der Felder in Sälen bzw. Gängen und Gewichte je Sorte */
  kram: [number, number]; sorten: Partial<Record<Kram, number>>;
  balken: boolean; ketten: boolean; pfeiler: boolean; torrahmen: boolean;
  /** Tönung von Decke und Sockel, Stärke des Reliefs der Mauer */
  decke: number; sockel: number; relief: number;
  /** Licht, falls hell (sonst das Fackellicht des Verlieses) */
  stimmung?: Partial<Stimmung>;
}

const MITTELALTERLICH = { fass: 3, kiste: 2, kerzen: 1 };
const HELL: Partial<Stimmung> = {
  himmelOben: 0x8fb3d9, himmelUnten: 0xe4ecf3, nebel: 0xd8dde4, dichte: 0.01,
  sonne: 0xffe9c4, sonneStaerke: 1.6, sonneVon: [-0.45, 1, 0.3], oben: 0xffffff, unten: 0xb89a7a, umgebung: 1.25, fackel: 0, belichtung: 0.95,
};
const TAG = 0xfff1d6;

export const REZEPT: Partial<Record<Stil, Rezept>> = {
  verlies: { dunkel: true, fackel: 0.13, banner: 0.07, fenster: 0.04, fensterTon: 0xffffff, kram: [0.22, 0.08],
    sorten: { fass: 27, kiste: 20, knochen: 15, kerzen: 18, geroell: 20 }, balken: true, ketten: true, pfeiler: true, torrahmen: true, decke: 0x9a8f86, sockel: 0x8c8279, relief: 1.4 },
  burg: { dunkel: false, fackel: 0.09, banner: 0.14, fenster: 0.08, fensterTon: TAG, kram: [0.16, 0.05], sorten: MITTELALTERLICH,
    balken: true, ketten: false, pfeiler: true, torrahmen: true, decke: 0xb0a090, sockel: 0x8c8279, relief: 1.4,
    stimmung: { ...HELL, umgebung: 0.95, sonneStaerke: 1.1, fackel: 14, nebel: 0xc9c2b8 } },
  gotisch: { dunkel: true, fackel: 0.05, banner: 0.1, fenster: 0.12, fensterTon: 0xc4a0ff, kram: [0.14, 0.04], sorten: { kerzen: 6, knochen: 1, geroell: 1 },
    balken: false, ketten: true, pfeiler: true, torrahmen: true, decke: 0x9a96a8, sockel: 0x6b6560, relief: 1.4 },
  mittelalter: { mauerHoch: true, dunkel: false, fackel: 0.04, banner: 0.05, fenster: 0.12, fensterTon: TAG, kram: [0.18, 0.06], sorten: MITTELALTERLICH,
    balken: true, ketten: false, pfeiler: false, torrahmen: false, decke: 0xffffff, sockel: 0x8a7a66, relief: 1, stimmung: HELL },
  antike: { mauerHoch: true, dunkel: false, fackel: 0, banner: 0, fenster: 0.1, fensterTon: TAG, kram: [0.1, 0.02], sorten: { kerzen: 1 },
    balken: false, ketten: false, pfeiler: false, torrahmen: false, decke: 0xffffff, sockel: 0xd6cfc2, relief: 0.8, stimmung: { ...HELL, nebel: 0xf2ece0 } },
  klassisch: { dunkel: false, fackel: 0, banner: 0, fenster: 0.14, fensterTon: TAG, kram: [0.06, 0], sorten: { kiste: 1 },
    balken: false, ketten: false, pfeiler: false, torrahmen: false, decke: 0xffffff, sockel: 0x8b7e74, relief: 0.8, stimmung: HELL },
  viktorianisch: { mauerHoch: true, dunkel: false, fackel: 0, banner: 0, fenster: 0.12, fensterTon: TAG, kram: [0.1, 0.02], sorten: { kerzen: 2, kiste: 1 },
    balken: false, ketten: false, pfeiler: false, torrahmen: false, decke: 0xffffff, sockel: 0x3b1f14, relief: 0.8, stimmung: { ...HELL, umgebung: 1.05 } },
  retro: { dunkel: false, fackel: 0, banner: 0, fenster: 0.14, fensterTon: TAG, kram: [0.06, 0], sorten: { kiste: 1 },
    balken: false, ketten: false, pfeiler: false, torrahmen: false, decke: 0xffffff, sockel: 0x65a30d, relief: 0.8, stimmung: HELL },
  holz: { dunkel: false, fackel: 0.04, banner: 0, fenster: 0.12, fensterTon: TAG, kram: [0.2, 0.06], sorten: { fass: 3, kiste: 3 },
    balken: true, ketten: false, pfeiler: false, torrahmen: false, decke: 0xffffff, sockel: 0x6b4423, relief: 1.2, stimmung: HELL },
  eis: { dunkel: false, fackel: 0, banner: 0, fenster: 0, fensterTon: TAG, kram: [0, 0], sorten: {},
    balken: false, ketten: false, pfeiler: false, torrahmen: false, decke: 0xffffff, sockel: 0x7dd3fc, relief: 1,
    stimmung: { ...HELL, himmelOben: 0x9dbbe0, himmelUnten: 0xf2f6fb, nebel: 0xe8eef6, oben: 0xe0f2fe, unten: 0x7dd3fc } },
  wueste: { dunkel: false, fackel: 0.06, banner: 0.06, fenster: 0.05, fensterTon: TAG, kram: [0.16, 0.06], sorten: { fass: 2, kiste: 2, geroell: 2 },
    balken: true, ketten: false, pfeiler: true, torrahmen: true, decke: 0xffffff, sockel: 0xb45309, relief: 1.2, stimmung: { ...HELL, nebel: 0xf3dfb0 } },
  beton: { dunkel: false, fackel: 0, banner: 0, fenster: 0.12, fensterTon: TAG, kram: [0.08, 0.03], sorten: { kiste: 3, geroell: 1 },
    balken: false, ketten: false, pfeiler: false, torrahmen: false, decke: 0xffffff, sockel: 0x78716c, relief: 0.8, stimmung: HELL },
  raumstation: { dunkel: true, fackel: 0, banner: 0, fenster: 0.16, fensterTon: 0x5eead4, kram: [0.1, 0.03], sorten: { kiste: 1 },
    balken: false, ketten: false, pfeiler: false, torrahmen: false, decke: 0xffffff, sockel: 0x334155, relief: 1,
    stimmung: { fackel: 22, fackelFarbe: 0x9fe8ff, nebel: 0x070b12, oben: 0x6080b0, umgebung: 0.7 } },
  neon: { mauerHoch: true, dunkel: true, fackel: 0, banner: 0, fenster: 0.18, fensterTon: 0xff4fd8, kram: [0.06, 0.02], sorten: { kiste: 1 },
    balken: false, ketten: false, pfeiler: false, torrahmen: false, decke: 0xffffff, sockel: 0x18181b, relief: 1,
    stimmung: { fackel: 22, fackelFarbe: 0xffc0f0, nebel: 0x0a0710, oben: 0x8070b0, umgebung: 0.75 } },
};

const DUNKEL: Stimmung = {
  himmelOben: 0x050608, himmelUnten: 0x0b0a0a, nebel: 0x0a0807, dichte: 0.03,
  sonne: 0x9fb4ff, sonneStaerke: 0.22, sonneVon: [-0.3, 1, 0.25],
  oben: 0x6f6a80, unten: 0x2a2018, umgebung: 0.55, fackel: 26, belichtung: 1.2,
};

/**
 * Quader, dessen Texturkoordinaten in Feldern zählen: eine Kachel je ZELLE, gleich auf allen Seiten.
 * `kachelH`: Höhe einer Kachel an den Seiten (z. B. die ganze Wand), `ab`: Höhe der Unterkante über dem Boden.
 */
function kachelQuader(b: number, h: number, t: number, kachelH = ZELLE, ab = 0): THREE.BoxGeometry {
  const g = new THREE.BoxGeometry(b, h, t);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  // Seiten der BoxGeometry: +x, −x, +y, −y, +z, −z (je 4 Ecken) → Breite und Höhe der Kachel
  const masse: [number, number][] = [[t, h], [t, h], [b, t], [b, t], [b, h], [b, h]];
  for (let s = 0; s < 6; s++) for (let k = 0; k < 4; k++) {
    const i = s * 4 + k;
    const seite = s !== 2 && s !== 3;
    uv.setXY(i, uv.getX(i) * masse[s][0] / ZELLE, seite ? (ab + uv.getY(i) * masse[s][1]) / kachelH : uv.getY(i) * masse[s][1] / ZELLE);
  }
  return g;
}

function kachelStoff(k: Kachel, ton = 0xffffff, relief = 1): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ map: k.farbe, normalMap: k.normal, normalScale: new THREE.Vector2(relief, relief), color: ton });
}

/** Ebene über der ganzen Karte (Boden: Normale nach oben, Decke: nach unten), eine Kachel je Feld */
export function flaeche(e: FreiEbene, k: Kachel, hoehe: number, oben: boolean, ton: number, relief: number): THREE.Mesh {
  const g = new THREE.PlaneGeometry(e.b * ZELLE, e.h * ZELLE);
  g.rotateX(oben ? -Math.PI / 2 : Math.PI / 2);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * e.b, uv.getY(i) * e.h);
  const m = new THREE.Mesh(g, kachelStoff(k, ton, relief));
  m.position.set((e.b * ZELLE) / 2, hoehe, (e.h * ZELLE) / 2);
  m.receiveShadow = true;
  m.castShadow = false;
  if (oben) m.userData.boden = true;
  return m;
}

/** Teil aus der Ausstattung an vielen Orten: Stein und Glut je eine InstancedMesh */
function teile(g: THREE.Group, teil: BauTeil | undefined, stuecke: Stueck[], schatten = true, glutTon: THREE.ColorRepresentation = 0xffffff) {
  if (!teil?.geo || !stuecke.length) return;
  g.add(reihe(teil.geo, new THREE.MeshLambertMaterial({ vertexColors: true }), stuecke, schatten));
  if (teil.glut) g.add(reihe(teil.glut, new THREE.MeshBasicMaterial({ vertexColors: true, color: glutTon, toneMapped: false }), stuecke, false));
}

const oben = new THREE.Vector3(0, 1, 0);
const drehung = (w: number) => new THREE.Quaternion().setFromAxisAngle(oben, w);
const eins = new THREE.Vector3(1, 1, 1);
const RICHTUNGEN: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** Fensterscheiben leuchten in der Farbe des Stils: Ton so wählen, dass das fahle Blau der Vorlage darin aufgeht */
function scheibe(ton: number): THREE.Color {
  const c = new THREE.Color(ton);
  // Vorlage: MOND · 0,55 aus verlies3d.py ≈ (0.145, 0.23, 0.55) linear → auf den Wunschton heben
  // ungeklemmt: Werte über 1 lassen die Scheibe heller leuchten als die Vorlage
  return new THREE.Color(Math.min(5, c.r / 0.145), Math.min(5, c.g / 0.23), Math.min(5, c.b / 0.55));
}

/** Gebäude des Stils aus Kacheln und Ausstattung — null, wenn es kein Rezept gibt oder noch etwas lädt */
export function bauwelt(e: FreiEbene, stil: Stil, seed: number): Landschaft | null {
  const R = REZEPT[stil];
  const K = bausatz(AUSSTATTUNG), T = bauKacheln(kachelName(stil));
  if (!R || !K || !T?.mauer || !T.boden || !T.decke) return null;
  const F = STILE[stil];
  const g = new THREE.Group();
  const r = zufallAus(seed * 31 + 7);
  /** fester Zufall je Feld: bei gleichem Seed sieht jedes Feld gleich aus */
  const feld = (x: number, y: number, n: number) => zufallAus((x * 73856093) ^ (y * 19349663) ^ ((seed + n) * 83492791))();
  const wand = (x: number, y: number) => !istFrei(e, x, y);
  const stimmung: Stimmung = { ...DUNKEL, ...(R.dunkel ? {} : HELL), ...R.stimmung };

  g.add(himmel(stimmung.himmelOben, stimmung.himmelUnten));
  g.add(umland(e, F.sockel));
  g.add(flaeche(e, T.boden, 0, true, 0xffffff, 1));
  g.add(flaeche(e, T.decke, H3, false, R.decke, 1.2));

  const mauern: Stueck[] = [], sockel: Stueck[] = [], stuerze: Stueck[] = [];
  const tueren: Stueck[] = [], pfeiler: Stueck[] = [], balken: Stueck[] = [], ketten: Stueck[] = [];
  const fackeln: Stueck[] = [], bannerRot: Stueck[] = [], bannerBlau: Stueck[] = [], fenster: Stueck[] = [];
  const kram: Record<Kram, Stueck[]> = { fass: [], kiste: [], knochen: [], kerzen: [], geroell: [] };
  const halos: Stueck[] = [], kreise: Stueck[] = [];
  const lichtOrte: THREE.Vector3[] = [];
  const STURZ = 3.15;
  const sorten = Object.entries(R.sorten) as [Kram, number][];
  const summe = sorten.reduce((s, [, w]) => s + w, 0);

  // Stationen, Ankunft und Tor bleiben frei von Gerümpel
  const frei = (x: number, y: number) => [...e.raeume.map(p => [p.x, p.y, p.r + 1]), [...e.start, 2.5], [...e.ziel, 2.5]]
    .every(([px, py, rr]) => Math.max(Math.abs(px - x), Math.abs(py - y)) > rr);

  for (let y = 0; y < e.h; y++) for (let x = 0; x < e.b; x++) {
    const a = e.art[y * e.b + x], wx = feldMitte(x), wz = feldMitte(y);
    if (a === WAND) {
      mauern.push({ p: new THREE.Vector3(wx, H3 / 2, wz), s: eins, f: new THREE.Color().setScalar(0.88 + feld(x, y, 1) * 0.18) });
      for (const [dx, dy] of RICHTUNGEN) {
        if (!istFrei(e, x + dx, y + dy) || e.art[(y + dy) * e.b + x + dx] === DURCHGANG) continue;
        sockel.push({ p: new THREE.Vector3(wx + dx * 0.06, 0.2, wz + dy * 0.06), s: eins });
        // Schmuck an dieser Wandseite: zeigt zum Weg
        const w = feld(x * 4 + dx + 2, y * 4 + dy + 2, 3);
        const fx = wx + dx * (ZELLE / 2), fz = wz + dy * (ZELLE / 2);
        const lage = { p: new THREE.Vector3(fx, 0, fz), s: eins, q: drehung(Math.atan2(-dx, -dy)) };
        if (w < R.fackel) {
          fackeln.push(lage);
          const flamme = new THREE.Vector3(fx + dx * 0.32, 2.58, fz + dy * 0.32);
          lichtOrte.push(flamme);
          halos.push({ p: flamme, s: new THREE.Vector3().setScalar(0.85) });
          kreise.push({ p: new THREE.Vector3(fx + dx * 1.1, 0.02, fz + dy * 1.1), s: new THREE.Vector3(1.4, 1, 1.4) });
        } else if (w < R.fackel + R.banner) (feld(x, y, 4) < 0.55 ? bannerRot : bannerBlau).push(lage);
        else if (w < R.fackel + R.banner + R.fenster) fenster.push(lage);
      }
      continue;
    }
    if (a === DURCHGANG) {
      // Laufrichtung: dorthin, wo beide Nachbarn frei sind (der Rahmen steht quer dazu)
      const laengsZ = istFrei(e, x, y - 1) && istFrei(e, x, y + 1);
      const laengsX = istFrei(e, x - 1, y) && istFrei(e, x + 1, y);
      const alongZ = laengsZ || (!laengsX && wand(x - 1, y) && wand(x + 1, y));
      // breite Durchgänge (mehrere Felder nebeneinander): keine Pfosten mitten in der Öffnung, nur der Sturz
      const schmal = alongZ ? wand(x - 1, y) && wand(x + 1, y) : wand(x, y - 1) && wand(x, y + 1);
      if (schmal && R.torrahmen) tueren.push({ p: new THREE.Vector3(wx, 0, wz), s: eins, q: drehung(alongZ ? 0 : Math.PI / 2) });
      stuerze.push({ p: new THREE.Vector3(wx, (STURZ + H3) / 2, wz), s: eins });
      continue;
    }
    if (R.balken && y % 3 === 1) balken.push({ p: new THREE.Vector3(wx, H3, wz), s: eins });
    if (R.ketten && feld(x, y, 5) < 0.04) ketten.push({ p: new THREE.Vector3(wx + (feld(x, y, 6) - 0.5) * 0.6, H3, wz + (feld(x, y, 7) - 0.5) * 0.6), s: eins, q: drehung(feld(x, y, 8) * 6) });
    // Gerümpel an der Wand: in Sälen öfter als in Gängen
    const anWand = RICHTUNGEN.filter(([dx, dy]) => wand(x + dx, y + dy));
    if (!summe || !anWand.length || !frei(x, y) || feld(x, y, 9) > R.kram[a === PLATZ ? 0 : 1]) continue;
    const [dx, dy] = anWand[Math.floor(feld(x, y, 10) * anWand.length)];
    const quer = (feld(x, y, 11) - 0.5) * 0.5;
    const p = new THREE.Vector3(wx + dx * (ZELLE / 2 - 0.4) + (dx ? 0 : quer), 0, wz + dy * (ZELLE / 2 - 0.4) + (dy ? 0 : quer));
    let wahl = feld(x, y, 13) * summe;
    const sorte = sorten.find(([, w]) => (wahl -= w) < 0)?.[0] ?? sorten[0][0];
    kram[sorte].push({ p, s: eins, q: drehung(feld(x, y, 12) * Math.PI * 2) });
    if (sorte === "kiste" && feld(x, y, 14) < 0.3) kram.kiste.push({ p: p.clone().setY(0.62), s: new THREE.Vector3().setScalar(0.8), q: drehung(feld(x, y, 15) * 6) });
  }

  // Pfeiler an vorspringenden Mauerecken (eine von vier Nachbarzellen ist Wand), selten auch in Innenecken
  if (R.pfeiler) for (let j = 1; j < e.h; j++) for (let i = 1; i < e.b; i++) {
    const n = [wand(i - 1, j - 1), wand(i, j - 1), wand(i - 1, j), wand(i, j)].filter(Boolean).length;
    if (n === 1 || (n === 3 && feld(i, j, 16) < 0.3)) pfeiler.push({ p: new THREE.Vector3(i * ZELLE, 0, j * ZELLE), s: eins, q: drehung(Math.floor(feld(i, j, 17) * 4) * Math.PI / 2) });
  }

  const mauer = kachelStoff(T.mauer, 0xffffff, R.relief);
  const kachelH = R.mauerHoch ? H3 : ZELLE;
  g.add(reihe(kachelQuader(ZELLE, H3, ZELLE, kachelH), mauer, mauern));
  g.add(reihe(kachelQuader(ZELLE + 0.04, 0.4, ZELLE + 0.04), new THREE.MeshLambertMaterial({ color: R.sockel }), sockel));
  g.add(reihe(kachelQuader(ZELLE, H3 - STURZ, ZELLE, kachelH, STURZ), mauer, stuerze));
  teile(g, K.tuer, tueren);
  teile(g, K.pfeiler, pfeiler);
  teile(g, K.fackel, fackeln, false);
  teile(g, K.banner_rot, bannerRot, false);
  teile(g, K.banner_blau, bannerBlau, false);
  teile(g, K.fenster, fenster, false, scheibe(R.fensterTon));
  teile(g, K.balken, balken);
  teile(g, K.kette, ketten, false);
  teile(g, K.fass, kram.fass);
  teile(g, K.kiste, kram.kiste);
  teile(g, K.knochen, kram.knochen, false);
  teile(g, K.kerzen, kram.kerzen, false);
  teile(g, K.geroell, kram.geroell);

  // Schein um die Flammen und ein warmer Fleck auf dem Boden davor
  const hell = (farbe: number, deckung: number) => new THREE.MeshBasicMaterial({ color: farbe, transparent: true, opacity: deckung, blending: THREE.AdditiveBlending, depthWrite: false });
  const kreis = new THREE.CircleGeometry(1, 24);
  kreis.rotateX(-Math.PI / 2);
  for (const m of [
    reihe(new THREE.SphereGeometry(0.5, 12, 8), hell(0xffa64d, 0.32), halos, false),
    reihe(kreis, hell(0xff9a40, 0.05), kreise, false),
  ]) { m.receiveShadow = false; g.add(m); }

  // Teppich um Stationen, Ankunft und Tor: in der Tür- und Leistenfarbe des Stils
  const teppich: Stueck[] = [], rand: Stueck[] = [];
  for (const [x, y] of [...e.raeume.map(p => [p.x, p.y]), e.start, e.ziel]) {
    teppich.push({ p: new THREE.Vector3(feldMitte(x), 0.012, feldMitte(y)), s: new THREE.Vector3(3.1, 1, 3.1) });
    rand.push({ p: new THREE.Vector3(feldMitte(x), 0.014, feldMitte(y)), s: new THREE.Vector3(3.1, 1, 3.1) });
  }
  const ring = new THREE.RingGeometry(0.93, 1, 48);
  ring.rotateX(-Math.PI / 2);
  const flach = (farbe: number, deckung: number) => new THREE.MeshLambertMaterial({ color: farbe, transparent: true, opacity: deckung, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const teppichFarbe = stil === "verlies" ? 0x4a1712 : new THREE.Color(F.tuer).lerp(new THREE.Color(F.boden), 0.25).getHex();
  g.add(reihe(new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2), flach(teppichFarbe, 0.72), teppich, false));
  g.add(reihe(ring, flach(stil === "verlies" ? 0xb08a3a : F.oben, 0.9), rand, false));

  // Fackellicht: ein paar echte Lichter wandern zu den Fackeln, die der Figur am nächsten sind
  const lichter = lichtOrte.length ? Array.from({ length: LICHTER }, () => {
    const l = new THREE.PointLight(0xff9a45, 0, 10, 1.6);
    g.add(l);
    return l;
  }) : [];
  const naechste = (x: number, z: number) => lichtOrte
    .map(p => ({ p, d: (p.x - x) ** 2 + (p.z - z) ** 2 }))
    .sort((a, b) => a.d - b.d).slice(0, LICHTER);

  const luft = schweben(e, r, { farben: R.dunkel ? [0xffb070, 0xfff2cc] : [0xfff2cc, 0xffffff], anzahl: 200, groesse: 0.05, fall: 0.03, hoehe: 3.4, leuchtet: true });
  g.add(luft.punkte);

  return {
    gruppe: g, wandHoehe: 99, takt: luft.takt, stimmung,
    lichter: lichter.length ? (x, z, zeit) => {
      const nah = naechste(x, z);
      lichter.forEach((l, i) => {
        const n = nah[i];
        if (!n || n.d > 18 * 18) { l.intensity = 0; return; }
        l.position.copy(n.p);
        // jede Fackel flackert anders (Phase aus ihrem Ort)
        const ph = n.p.x * 1.7 + n.p.z * 2.3;
        l.intensity = 11 + Math.sin(zeit * 9 + ph) * 1.6 + Math.sin(zeit * 23 + ph * 2) * 1.1 + Math.sin(zeit * 3.1 + ph) * 0.8;
      });
    } : undefined,
  };
}
