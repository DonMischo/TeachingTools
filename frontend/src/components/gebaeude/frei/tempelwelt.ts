/**
 * Antiker Tempel im gemalten Stil: Modelle aus dem Baukasten der Weltenwerkstatt
 * (TT-Weltenwerkstatt/blender/antike.py → /modelle/welten/antike.glb, fertig gefärbt) und die
 * Kacheln des Stils (Mosaikboden) auf der Gebäudekarte.
 *
 * - Wände aus Modulen an jeder Kante zwischen Gang und Wandfeld: in Hallen zweigeschossige
 *   Kolonnaden (manchmal mit Schild, gebrochener Säule, Statuennische), in Gängen die Cellawand.
 *   Jedes Modul füllt die Wandzelle dahinter, Architrav und Gesims schließen ohne Fuge.
 * - Kassettendecke in Wandhöhe, hier und da eingebrochen mit Efeu und einem Sonnenstrahl;
 *   die Kamera bleibt unter der Decke (`decke`).
 * - Am Ziel die thronende Göttin mit blauem Nimbus; in den Hallen Dreifüße mit Feuer, Amphoren,
 *   Bänke, Sarkophage, umgestürzte Säulentrommeln; an der Ankunft die Zauberflamme und eine Statue.
 *
 * - Auf dem Vorplatz der Karte (unter freiem Himmel) steht der Tempel mit der Freitreppe zur Ankunft;
 *   dort gibt es keine Decke (`deckeBei`).
 * - In den Durchgängen der begehbare Rahmen `durchgang2` (sobald der Baukasten ihn hat); Hallen ohne Aufgabe
 *   bekommen Altar oder Göttin, Amphoren, Bänke, Säulen und Ruinen.
 *
 * Gibt null zurück, solange Baukasten oder Kacheln fehlen (dann baut bauwelt.ts den Kachelbau).
 */
import * as THREE from "three";
import { PLATZ, WAND, ZELLE, feldMitte, type FreiEbene } from "@/lib/gebaeude/frei";
import { zufallAus } from "../stoff";
import { bauKacheln, kachelName } from "../bausatz";
import { flaeche } from "./bauwelt";
import { deckenRaster, durchgangsRahmen, eckBloecke, fuelleHallen, hatModell, kitAufsteller, lichtVorrat, schauNach, wandKanten, type WandKante } from "./kitwelt";
import { kit } from "./modelle";
import { himmel, schweben, umland, type Landschaft, type Stimmung, type Stueck } from "./welt";

export const ANTIKE = "antike";
/** Hallenhöhe des Tempels (Wandmodule und Decke aus dem Baukasten), höher als die übrigen Gebäude (H3 = 4,05 m) */
const HA = 6.0;

const STIMMUNG: Stimmung = {
  himmelOben: 0x3a86e0, himmelUnten: 0xb8dcf4, nebel: 0xe8d6b8, dichte: 0.012,
  sonne: 0xffdca0, sonneStaerke: 1.6, sonneVon: [-0.35, 1, 0.25],
  oben: 0xfff0d8, unten: 0xb08a5a, umgebung: 1.05, fackel: 0, belichtung: 1.0,
};

export function tempelLandschaft(e: FreiEbene, seed: number): Landschaft | null {
  const K = kit(ANTIKE), T = bauKacheln(kachelName("antike"));
  if (!K || !T?.boden) return null;
  const r = zufallAus(seed * 23 + 11);
  const g = new THREE.Group();
  const dreh = () => r() * Math.PI * 2;
  const nimm = <T,>(liste: T[]) => liste.splice(Math.floor(r() * liste.length), 1)[0];

  g.add(himmel(STIMMUNG.himmelOben, STIMMUNG.himmelUnten));
  g.add(umland(e, 0xd6cfc2));
  // Mosaik feiner als eine Kachel je Feld: so wirkt es wie Steinchen, nicht wie ein Teppich
  const mosaik = flaeche(e, T.boden, 0, true, 0xffffff, 1);
  const uv = mosaik.geometry.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2, uv.getY(i) * 2);
  g.add(mosaik);

  const auf = kitAufsteller(K, () => 0);
  const setze = auf.setze;
  const lichtOrte: { p: THREE.Vector3; f: number; staerke?: number }[] = [];
  const licht = (x: number, y: number, z: number, f: number, staerke: number) => lichtOrte.push({ p: new THREE.Vector3(x, y, z), f, staerke });

  // ── Wände: Kolonnaden (2,8 m breit, zwei Zellen tief) an Hallenwänden, wo zwei Wandzellen dahinter liegen;
  //    sonst die Cellawand (ein Feld breit und tief), Grundlinie auf der Zellkante, Schauseite zum Gang ──
  const istHalle = (a: number) => a === PLATZ;
  // Vorplatz: Felder unter freiem Himmel; die Wandfelder des Tempelkerns bekommen keine Wandmodule
  const vp = e.vorplatz;
  const imPlatz = (fx: number, fy: number) => !!vp && fx >= vp.platz.x && fx < vp.platz.x + vp.platz.b && fy >= vp.platz.y && fy < vp.platz.y + vp.platz.h;
  const imKern = (fx: number, fy: number) => !!vp && fx >= vp.kern.x && fx < vp.kern.x + vp.kern.b && fy >= vp.kern.y && fy < vp.kern.y + vp.kern.h;
  const kanten = wandKanten(e, istHalle).filter(k => !imKern(Math.floor(k.x / ZELLE - k.dx * 0.5), Math.floor(k.z / ZELLE - k.dy * 0.5)));
  const wandZelle = (wx: number, wz: number) => {
    const x = Math.floor(wx / ZELLE), y = Math.floor(wz / ZELLE);
    return x < 0 || y < 0 || x >= e.b || y >= e.h || e.art[y * e.b + x] === WAND;
  };
  /** liegen hinter der Kante zwei Wandzellen (Platz für Seitengang und Rückwand der Kolonnade)? */
  const tief = (k: WandKante) => [0.7, 2.1].every(d => wandZelle(k.x - k.dx * d, k.z - k.dy * d));
  const schluessel = (x: number, z: number, dx: number, dy: number) => `${Math.round(x * 10)}|${Math.round(z * 10)}|${dx}|${dy}`;
  const nach = new Map(kanten.map(k => [schluessel(k.x, k.z, k.dx, k.dy), k]));
  const belegt = new Set<WandKante>();
  // begehbare Rahmen in den Durchgängen (2,8 m tief, einer je Durchgang); daneben die Laibung statt eines Wandmoduls
  const tueren = durchgangsRahmen(e);
  if (hatModell(K, "durchgang2")) {
    for (const t of tueren.rahmen) setze("durchgang2", t.x, t.z, t.w, 1, 0);
    for (const k of kanten) if (tueren.neben(k)) belegt.add(k);
  }
  for (const k of kanten) {
    if (!k.halle || belegt.has(k) || !tief(k)) continue;
    const n = nach.get(schluessel(k.x + Math.abs(k.dy) * ZELLE, k.z + Math.abs(k.dx) * ZELLE, k.dx, k.dy));
    if (!n || belegt.has(n) || !n.halle || !tief(n)) continue;
    belegt.add(k).add(n);
    const w = r();
    setze(w < 0.62 ? "kolonnade1" : w < 0.76 ? "kolonnade2" : w < 0.88 ? "kolonnade4" : "kolonnade3", (k.x + n.x) / 2, (k.z + n.z) / 2, schauNach(k.dx, k.dy), 1, 0);
  }
  for (const k of kanten) {
    if (belegt.has(k)) continue;
    const w = r();
    setze(w < 0.75 ? "wand1" : w < 0.88 ? "wand3" : "wand2", k.x, k.z, schauNach(k.dx, k.dy), 1, 0);
  }
  // Eckzellen ohne Modul: schlichter Marmorblock
  const ecken = eckBloecke(e, HA, 0xd8ccb4);
  if (ecken) g.add(ecken);

  // ── Decke: Kassetten im 2,8-m-Raster über allem Begehbaren; manche eingebrochen, mit Sonnenstrahl ──
  const bahnen: Stueck[] = [];
  const hoch = new THREE.Vector3(0, 1, 0);
  deckenRaster(e, istHalle, (mx, mz, halle) => {
    if (imPlatz(Math.floor(mx / ZELLE), Math.floor(mz / ZELLE))) return;
    const kaputt = halle && r() < 0.12;
    setze(kaputt ? "decke2" : "decke1", mx, mz, Math.floor(r() * 4) * Math.PI / 2, 1, HA);
    if (kaputt) {
      // Licht fällt durchs Loch
      for (const w2 of [0, Math.PI / 2]) {
        bahnen.push({ p: new THREE.Vector3(mx, 0, mz), s: new THREE.Vector3(1.8, HA + 1, 1), q: new THREE.Quaternion().setFromAxisAngle(hoch, w2) });
      }
      if (r() < 0.7) setze("efeu1", mx + (r() - 0.5) * 1.6, mz + (r() - 0.5) * 1.6, dreh(), 1, HA - 0.1);
    }
  });

  // ── Ziel: die thronende Göttin an der Hallenwand gegenüber, der Nimbus leuchtet ──
  {
    const [zx, zy] = e.ziel, mx = feldMitte(zx), mz = feldMitte(zy);
    const k = kanten.filter(q => q.halle && Math.hypot(q.x - mx, q.z - mz) < 7)
      .sort((a, b) => Math.hypot(b.x - mx, b.z - mz) - Math.hypot(a.x - mx, a.z - mz))[0];
    if (k) {
      const tx = k.x + k.dx * 1.6, tz = k.z + k.dy * 1.6;
      setze("thron1", tx, tz, schauNach(k.dx, k.dy), 0.85, 0);
      licht(tx + k.dx * 0.8, 3.4, tz + k.dy * 0.8, 0x5a9aff, 9);
      for (const s of [-1, 1]) {
        const qx = tx - k.dy * s * 2.4 + k.dx * 1.2, qz = tz + k.dx * s * 2.4 + k.dy * 1.2;
        setze("dreifuss1", qx, qz, dreh(), 1, 0);
        licht(qx, 1.9, qz, 0xff9a40, 8);
      }
    }
  }
  // ── Vorplatz: der Tempel, Freitreppe zur Ankunft (+z); Zypressen an den Ecken ──
  if (vp && hatModell(K, "tempel1")) {
    const box = new THREE.Box3();
    for (const [name, teil] of Object.entries(K)) if (name.startsWith("tempel1_")) { teil.geo.computeBoundingBox(); box.union(teil.geo.boundingBox!); }
    const tx = (vp.platz.x + vp.platz.b / 2) * ZELLE, tz = (vp.kern.y + vp.kern.h / 2) * ZELLE;
    setze("tempel1", tx - (box.min.x + box.max.x) / 2, tz - (box.min.z + box.max.z) / 2, 0, 1, 0);
    for (const [cx, cz] of [[vp.platz.x + 1, vp.platz.y + vp.platz.h - 1], [vp.platz.x + vp.platz.b - 1, vp.platz.y + vp.platz.h - 1]]) {
      setze(r() < 0.5 ? "zypresse1" : "zypresse2", cx * ZELLE, cz * ZELLE, dreh(), 1, 0);
    }
  }
  // ── Ankunft: Zauberflamme und behelmte Göttin ──
  if (!vp) {
    const [sx, sy] = e.start, mx = feldMitte(sx), mz = feldMitte(sy);
    const nah = kanten.filter(q => Math.hypot(q.x - mx, q.z - mz) < 6);
    const k = nah[Math.floor(r() * nah.length)];
    if (k) {
      setze("goettin1", k.x + k.dx * 1.3, k.z + k.dy * 1.3, schauNach(k.dx, k.dy), 0.8, 0);
      const fx = k.x + k.dx * 1.4 - k.dy * 2, fz = k.z + k.dy * 1.4 + k.dx * 2;
      setze("zauberfeuer1", fx, fz, dreh(), 1, 0);
      licht(fx, 2, fz, 0x5ae0e8, 9);
    }
  }
  // ── Hallen der Stationen: Dreifüße, Amphoren, Bänke, Sarkophage, Ruinen ──
  for (const p of e.raeume) {
    const mx = feldMitte(p.x), mz = feldMitte(p.y);
    const rand = kanten.filter(q => q.halle && Math.hypot(q.x - mx, q.z - mz) < 7.5);
    for (let n = 0; n < 2 && rand.length; n++) {
      const k = nimm(rand);
      setze("dreifuss1", k.x + k.dx * 1.1, k.z + k.dy * 1.1, dreh(), 1, 0);
      licht(k.x + k.dx * 1.1, 1.9, k.z + k.dy * 1.1, 0xff9a40, 8);
    }
    for (let n = 0; n < 4 && rand.length; n++) {
      const k = nimm(rand), w = r();
      const modell = w < 0.45 ? `amphore${1 + Math.floor(r() * 2)}` : w < 0.65 ? "bank1" : w < 0.78 ? "sarkophag1" : w < 0.9 ? "trommeln1" : "altar1";
      const quer = modell === "bank1" || modell === "sarkophag1" || modell === "altar1";
      setze(modell, k.x + k.dx * (quer ? 0.9 : 0.6), k.z + k.dy * (quer ? 0.9 : 0.6), quer ? schauNach(k.dx, k.dy) : dreh(), 1, 0);
    }
  }
  // ── Gänge: hier und da eine Feuerschale, Bruchsteine, Efeu ──
  for (const k of kanten) {
    if (k.halle) continue;
    const w = r();
    if (w < 0.035) {
      setze("feuerschale1", k.x + k.dx * 0.55, k.z + k.dy * 0.55, dreh(), 1, 0);
      licht(k.x + k.dx * 0.6, 1.2, k.z + k.dy * 0.6, 0xff9a40, 5);
    } else if (w < 0.06) setze("bruchstein1", k.x + k.dx * 0.6, k.z + k.dy * 0.6, dreh(), 0.7, 0);
    else if (w < 0.1) setze("efeu1", k.x + k.dx * 0.25, k.z + k.dy * 0.25, dreh(), 1, HA - 0.15);
  }

  // ── Hallen ohne Aufgabe: Göttin oder Altar mit Dreifüßen, an den Wänden Amphoren, Bänke, Säulen; Ruinen am Boden ──
  fuelleHallen(e, kanten, setze, r, {
    mitte: (x, z, w, s) => {
      const lx = Math.cos(w), lz = -Math.sin(w);
      const altar = (ax: number, az: number, aw: number) => {
        // Altar (2,0 × 1,1), je ein Dreifuß ±1,7 m seitlich längs seiner Breite
        setze(r() < 0.5 ? "altar1" : "altar2", ax, az, aw, 1, 0);
        const bx = Math.cos(aw), bz = -Math.sin(aw);
        for (const q of [-1, 1]) {
          const qx = ax + bx * q * 1.7, qz = az + bz * q * 1.7;
          setze("dreifuss1", qx, qz, dreh(), 1, 0);
          licht(qx, 1.9, qz, 0xff9a40, 7);
        }
      };
      if (r() < 0.45 && HA >= 6) {
        // Göttin (5,7 m hoch) an der Stirnwand, Schauseite in den Saal, der Altar 2,5 m vor ihr
        const halb = (Math.max(s.b, s.h) * ZELLE) / 2;
        const gx = x - lx * (halb - 0.85), gz = z - lz * (halb - 0.85);
        const blick = schauNach(lx, lz);
        setze("goettin1", gx, gz, blick, 1, 0);
        altar(gx + lx * 2.5, gz + lz * 2.5, blick);
      } else altar(x, z, w + Math.PI / 2);
    },
    wand: [["amphore1", 0.6], ["amphore2", 0.6], ["bank1", 0.9], ["sarkophag1", 0.9], ["feuerschale1", 0.55], ["saeule1", 1.0], ["saeule2", 1.0]],
    boden: ["trommeln1", "kapitell1", "bruchstein1"],
    licht: (m, x, z) => { if (m === "feuerschale1") licht(x, 1.2, z, 0xff9a40, 5); },
  }, k => !belegt.has(k));

  const lit = new THREE.MeshLambertMaterial({ vertexColors: true });
  const blatt = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const glut = new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(1.6, 1.6, 1.6) });
  auf.fertig(g, (k, teil) => (teil.glut ? glut : /_efeu|_blatt|_halme|_wasser/.test(k) ? blatt : lit),
    (k, teil) => !teil.glut && /^(thron|goettin|dreifuss|trommeln|sarkophag|altar)/.test(k));

  // Sonnenstrahlen durch die eingebrochene Decke
  if (bahnen.length) {
    const bahn = new THREE.PlaneGeometry(1, 1);
    bahn.translate(0, 0.5, 0);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    const im = new THREE.InstancedMesh(bahn, mat, bahnen.length);
    const m = new THREE.Matrix4();
    bahnen.forEach((s, i) => im.setMatrixAt(i, m.compose(s.p, s.q!, s.s)));
    im.frustumCulled = false;
    g.add(im);
  }

  const luft = schweben(e, r, { farben: [0xfff0d8, 0xffe2b0], anzahl: 240, groesse: 0.05, fall: 0.02, hoehe: 3.6, leuchtet: true });
  g.add(luft.punkte);

  const deckeBei = vp ? (x: number, z: number) => (imPlatz(Math.floor(x / ZELLE), Math.floor(z / ZELLE)) ? 0 : HA) : undefined;
  return { gruppe: g, wandHoehe: 99, decke: HA, deckeBei, stimmung: STIMMUNG, takt: luft.takt, lichter: lichtVorrat(g, lichtOrte, 5, 12) };
}
