/**
 * Mittelalterliche Burg (Rittersaal) im gemalten Stil: Modelle aus dem Baukasten der Weltenwerkstatt
 * (TT-Weltenwerkstatt/blender/burg.py → /modelle/welten/burg.glb, fertig gefärbt) und die Kacheln
 * des Stils (Steinplatten) auf der Gebäudekarte.
 *
 * - Quaderwände als Module an jeder Kante Gang/Wand: in Sälen Löwenbanner, Wandfackeln,
 *   Lanzettfenster, Wappen mit Speeren; in Gängen auch Eichentüren; an zwei Nachbarkanten
 *   Rundbögen und Fallgitter. Balkendecke aus Eiche.
 * - In jedem Saal ein Radleuchter; am Ziel der Thron auf dem Podest, in anderen Sälen der Kamin mit
 *   Fellsessel oder die lange Tafel; an den Wänden Rüstungen, Waffenständer, Fässer, Truhen, Holzregale.
 * - An der Ankunft die Treppe hinauf zur Galerie.
 *
 * Gibt null zurück, solange Baukasten oder Kacheln fehlen (dann baut bauwelt.ts den Kachelbau).
 */
import * as THREE from "three";
import { PLATZ, feldMitte, type FreiEbene } from "@/lib/gebaeude/frei";
import { zufallAus } from "../stoff";
import { bauKacheln, kachelName } from "../bausatz";
import { flaeche } from "./bauwelt";
import { deckenRaster, eckBloecke, kitAufsteller, lichtVorrat, schauNach, wandKanten, type WandKante, durchgangsRahmen, fuelleHallen, hatModell, saalVor } from "./kitwelt";
import { glutStoff, kit } from "./modelle";
import { himmel, schweben, umland, type Landschaft, type Stimmung } from "./welt";

export const BURG = "burg";
/** Saalhöhe der Wandmodule und der Balkendecke (Baukasten: 6,0 m, höher als die übrigen Gebäude mit H3 = 4,05 m) */
const HB = 6.0;

const STIMMUNG: Stimmung = {
  himmelOben: 0x1a1612, himmelUnten: 0x2a2420, nebel: 0x3a3028, dichte: 0.016,
  sonne: 0xbcd4ff, sonneStaerke: 0.7, sonneVon: [-0.4, 1, 0.3],
  oben: 0xf0dcc0, unten: 0x4a3a2c, umgebung: 1.15, fackel: 0, belichtung: 1.2,
  bild: { schatten: [0.9, 0.95, 1.1], licht: [1.1, 1.0, 0.86], leuchten: 0.8, schwelle: 0.95 },
};

export function burgLandschaft(e: FreiEbene, seed: number): Landschaft | null {
  const K = kit(BURG), T = bauKacheln(kachelName("burg"));
  if (!K || !T?.boden) return null;
  const r = zufallAus(seed * 41 + 19);
  const g = new THREE.Group();
  const nimm = <T,>(liste: T[]) => liste.splice(Math.floor(r() * liste.length), 1)[0];
  const dreh = () => r() * Math.PI * 2;

  g.add(himmel(STIMMUNG.himmelOben, STIMMUNG.himmelUnten));
  g.add(umland(e, 0x3a342c));
  g.add(flaeche(e, T.boden, 0, true, 0xffffff, 1));

  const auf = kitAufsteller(K, () => 0);
  const setze = auf.setze;
  const lichtOrte: { p: THREE.Vector3; f: number; staerke?: number }[] = [];
  const licht = (x: number, y: number, z: number, f: number, staerke: number) => lichtOrte.push({ p: new THREE.Vector3(x, y, z), f, staerke });
  const vor = (k: WandKante, ab: number): [number, number] => [k.x + k.dx * ab, k.z + k.dy * ab];
  const laengs = (k: WandKante) => schauNach(k.dx, k.dy) + Math.PI / 2;

  // ── Wände: Rundbögen und Fallgitter an zwei gleich gerichteten Nachbarkanten, sonst Quadermodule ──
  const istHalle = (a: number) => a === PLATZ;
  const kanten = wandKanten(e, istHalle);
  const schluessel = (x: number, z: number, dx: number, dy: number) => `${Math.round(x * 10)}|${Math.round(z * 10)}|${dx}|${dy}`;
  const nach = new Map(kanten.map(k => [schluessel(k.x, k.z, k.dx, k.dy), k]));
  const belegt = new Set<WandKante>();
  // begehbare Rahmen in den Durchgängen der Karte (sobald der Baukasten sie hat); daneben kein Wandmodul (Laibung)
  const tueren = durchgangsRahmen(e);
  if (hatModell(K, "bogen2")) {
    for (const t of tueren.rahmen) setze("bogen2", t.x, t.z, t.w, 1, 0);
    for (const k of kanten) if (tueren.neben(k)) belegt.add(k);
  }
  // Blindtüren (die alten Tormodule) nur auf voller Wand, höchstens zwei je Saal
  const blinde = new Map<number, number>();
  const blindFrei = (k: WandKante) => { const s = saalVor(e, k); return !tueren.nah(k) && (s < 0 || (blinde.get(s) ?? 0) < 2); };
  const blindZaehle = (k: WandKante) => { const s = saalVor(e, k); if (s >= 0) blinde.set(s, (blinde.get(s) ?? 0) + 1); };
  for (const k of kanten) {
    if (belegt.has(k) || r() > 0.06 || !blindFrei(k)) continue;
    const n = nach.get(schluessel(k.x + Math.abs(k.dy) * 1.4, k.z + Math.abs(k.dx) * 1.4, k.dx, k.dy));
    if (!n || belegt.has(n) || !blindFrei(n)) continue;
    belegt.add(k).add(n);
    blindZaehle(k);
    const gitter = r() < 0.4;
    setze(gitter ? "fallgitter1" : "bogen1", (k.x + n.x) / 2, (k.z + n.z) / 2, schauNach(k.dx, k.dy), 1, 0);
    if (gitter) licht((k.x + n.x) / 2 + k.dx * 0.8, 2.2, (k.z + n.z) / 2 + k.dy * 0.8, 0xc8dcff, 5);
  }
  for (const k of kanten) {
    if (belegt.has(k)) continue;
    const w = r();
    const modell = k.halle
      ? (w < 0.32 ? "wand1" : w < 0.48 ? "wand2" : w < 0.64 ? "wand3" : w < 0.8 ? "wand4" : "wand5")
      : (w < 0.45 ? "wand1" : w < 0.6 ? "wand3" : w < 0.75 ? "wand6" : w < 0.88 ? "wand5" : "wand2");
    setze(modell, k.x, k.z, schauNach(k.dx, k.dy), 1, 0);
    if (modell === "wand3" && r() < 0.6) { const [x, z] = vor(k, 0.5); licht(x, 2.4, z, 0xff9a40, 6); }
    if (modell === "wand4" && r() < 0.3) { const [x, z] = vor(k, 0.8); licht(x, 2.6, z, 0xa8c8ff, 4); }
  }
  const ecken = eckBloecke(e, HB, 0x5a544c);
  if (ecken) g.add(ecken);

  // ── Balkendecke ──
  deckenRaster(e, istHalle, (x, z) => setze(r() < 0.5 ? "decke1" : "decke2", x, z, Math.floor(r() * 2) * Math.PI / 2, 1, HB));

  // ── Säle: Radleuchter; am Ziel der Thron, sonst Kamin oder Tafel; an den Wänden Rüstungen und Vorräte ──
  const saele = [...e.raeume.map(p => [p.x, p.y] as [number, number]), e.ziel];
  saele.forEach(([hx, hy], i) => {
    const mx = feldMitte(hx), mz = feldMitte(hy);
    const ziel = i === saele.length - 1;
    setze("radleuchter1", mx - 1.6, mz + 1.6, dreh(), 1, HB);
    // der Radleuchter hängt 2,3 m, die Kerzen brennen etwa 3,7 m über dem Boden
    licht(mx - 1.6, HB - 2.3, mz + 1.6, 0xffc070, 12);
    const rand = kanten.filter(k => k.halle && !belegt.has(k) && Math.hypot(k.x - mx, k.z - mz) < 7.5);
    if (ziel && rand.length) {
      // der Thron an der Wand gegenüber dem Eingang
      const k = rand.sort((a, b) => Math.hypot(b.x - mx, b.z - mz) - Math.hypot(a.x - mx, a.z - mz)).shift()!;
      const [x, z] = vor(k, 1.5);
      setze("thron1", x, z, schauNach(k.dx, k.dy), 1, 0);
      setze("teppich1", x + k.dx * 2.6, z + k.dy * 2.6, laengs(k), 1, 0.01);
    } else if (i % 2 === 0 && rand.length) {
      const k = nimm(rand), [x, z] = vor(k, 0.6);
      setze("kamin1", x, z, schauNach(k.dx, k.dy), 1, 0);
      licht(x + k.dx * 0.9, 0.9, z + k.dy * 0.9, 0xff8a30, 12);
      const [sx, sz] = vor(k, 2.2);
      setze("fellsessel1", sx - k.dy * 1.4, sz + k.dx * 1.4, schauNach(-k.dx, -k.dy) + Math.PI + 0.5, 1, 0);
      setze("holzregal1", x - k.dy * 2.4, z + k.dx * 2.4, schauNach(k.dx, k.dy), 1, 0);
    } else if (rand.length) {
      // lange Tafel längs einer Wand, mit Abstand für Bänke
      const k = nimm(rand), [x, z] = vor(k, 2.4);
      setze("tafel1", x, z, laengs(k), 1, 0);
      licht(x, 1.4, z, 0xffc070, 5);
      for (const s of [-1, 1]) setze("stuhl1", x - k.dy * s * 2.5, z + k.dx * s * 2.5, laengs(k) + (s > 0 ? Math.PI / 2 : -Math.PI / 2), 1, 0);
    }
    const AN_DER_WAND = ["ruestung1", "ruestung1", "waffenstaender1", "fass1", "fass2", "truhe1"];
    for (let n = 0; n < 3 && rand.length; n++) {
      const k = nimm(rand), modell = AN_DER_WAND[Math.floor(r() * AN_DER_WAND.length)];
      const [x, z] = vor(k, modell === "waffenstaender1" ? 0.3 : 0.5);
      setze(modell, x, z, modell.startsWith("fass") ? dreh() : schauNach(k.dx, k.dy), 1, 0);
    }
  });

  // ── Ankunft: Treppe hinauf zur Galerie ──
  {
    const [sx, sy] = e.start, mx = feldMitte(sx), mz = feldMitte(sy);
    const k = kanten.filter(q => !belegt.has(q) && Math.hypot(q.x - mx, q.z - mz) < 6)[0];
    if (k) {
      const [x, z] = vor(k, 1.1);
      setze("treppe1", x, z, laengs(k), 1, 0);
    }
  }

  // ── Hallen ohne Aufgabe: Tafel mit Stühlen unter dem Radleuchter, an den Wänden Rüstungen und Vorräte ──
  fuelleHallen(e, kanten, setze, r, {
    mitte: (x, z, w) => {
      const lx = Math.cos(w), lz = -Math.sin(w);
      setze("radleuchter1", x, z, dreh(), 1, HB);
      licht(x, HB - 2.3, z, 0xffc070, 10);
      if (r() < 0.6) {
        // Tafel (4,2 × 2,0 mit Bänken) längs, je ein Stuhl an den Enden (±2,45 m), zur Tafel gewandt
        setze("tafel1", x, z, w, 1, 0);
        for (const s of [-1, 1]) setze("stuhl1", x + lx * s * 2.45, z + lz * s * 2.45, schauNach(-lx * s, -lz * s), 1, 0);
      } else {
        // Teppich mit Fellsessel, 0,4 m neben der Mitte, zur Saalmitte gedreht
        setze("teppich1", x, z, w, 1, 0.01);
        setze("fellsessel1", x + lx * 0.4, z + lz * 0.4, schauNach(-lx, -lz), 1, 0);
      }
    },
    wand: [["ruestung1", 0.5], ["waffenstaender1", 0.3], ["fass1", 0.5], ["fass2", 0.5], ["truhe1", 0.5], ["holzregal1", 0.4]],
  }, k => !belegt.has(k));

  const lit = new THREE.MeshLambertMaterial({ vertexColors: true });
  const stoff = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const glut = glutStoff(1.5);
  auf.fertig(g, (k, teil) => (teil.glut ? glut : /_stoff/.test(k) || /^wand2/.test(k) || /^thron/.test(k) ? stoff : lit),
    (k, teil) => !teil.glut && /^(kamin|thron|treppe|tafel|ruestung|waffenstaender|radleuchter)/.test(k));

  const luft = schweben(e, r, { farben: [0xffd8a0, 0xffe8c8], anzahl: 180, groesse: 0.045, fall: 0.015, hoehe: HB - 0.4, leuchtet: true });
  g.add(luft.punkte);

  return { gruppe: g, wandHoehe: 99, decke: HB, stimmung: STIMMUNG, takt: luft.takt, lichter: lichtVorrat(g, lichtOrte, 6, 12) };
}
