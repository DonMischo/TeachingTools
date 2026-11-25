/**
 * Viktorianisches Herrenhaus im gemalten Stil: Modelle aus dem Baukasten der Weltenwerkstatt
 * (TT-Weltenwerkstatt/blender/viktorianisch.py → /modelle/welten/viktorianisch.glb, fertig gefärbt)
 * und die Kacheln des Stils (Fischgrätparkett, Stuckdecke) auf der Gebäudekarte.
 *
 * - Wände aus Modulen (Täfelung, Tapete, Bilderleiste, Stuckkranz) an jeder Kante Gang/Wand:
 *   in Hallen Fenster mit Samtvorhängen, Spiegel, Porträts, Wandleuchter; in Fluren auch Türen;
 *   hier und da ein Rundbogen zu einem Nebengang.
 * - Über jeder Halle ein Kronleuchter, darunter ein Perserteppich; an den Wänden Kamin mit Sesseln,
 *   Chesterfield-Sofa und Teetisch, Standuhr, Vitrine, Konsole mit Kandelaber, Lampe, Farn.
 * - An der Ankunft die Treppe hinauf zur Galerie, in den Fluren Läufer.
 *
 * Gibt null zurück, solange Baukasten oder Kacheln fehlen (dann baut bauwelt.ts den Kachelbau).
 */
import * as THREE from "three";
import { PLATZ, feldMitte, type FreiEbene } from "@/lib/gebaeude/frei";
import { zufallAus } from "../stoff";
import { bauKacheln, kachelName } from "../bausatz";
import { H3, flaeche } from "./bauwelt";
import { eckBloecke, kitAufsteller, lichtVorrat, schauNach, wandKanten, type WandKante, durchgangsRahmen, fuelleHallen, hatModell, saalVor } from "./kitwelt";
import { kit } from "./modelle";
import { himmel, schweben, umland, type Landschaft, type Stimmung } from "./welt";

export const VIKTORIANISCH = "viktorianisch";

const STIMMUNG: Stimmung = {
  himmelOben: 0x2a1a12, himmelUnten: 0x3a2a20, nebel: 0x4a3426, dichte: 0.014,
  sonne: 0xffd8a0, sonneStaerke: 0.6, sonneVon: [-0.3, 1, 0.2],
  oben: 0xffe0b0, unten: 0x5a3a28, umgebung: 1.15, fackel: 0, belichtung: 1.2,
};

export function herrenhausLandschaft(e: FreiEbene, seed: number): Landschaft | null {
  const K = kit(VIKTORIANISCH), T = bauKacheln(kachelName("viktorianisch"));
  if (!K || !T?.boden || !T.decke) return null;
  const r = zufallAus(seed * 37 + 17);
  const g = new THREE.Group();
  const nimm = <T,>(liste: T[]) => liste.splice(Math.floor(r() * liste.length), 1)[0];

  g.add(himmel(STIMMUNG.himmelOben, STIMMUNG.himmelUnten));
  g.add(umland(e, 0x3a2418));
  g.add(flaeche(e, T.boden, 0, true, 0xffffff, 1));
  g.add(flaeche(e, T.decke, H3, false, 0xffffff, 1));

  const auf = kitAufsteller(K, () => 0);
  const setze = auf.setze;
  const lichtOrte: { p: THREE.Vector3; f: number; staerke?: number }[] = [];
  const licht = (x: number, y: number, z: number, f: number, staerke: number) => lichtOrte.push({ p: new THREE.Vector3(x, y, z), f, staerke });
  const vor = (k: WandKante, ab: number): [number, number] => [k.x + k.dx * ab, k.z + k.dy * ab];
  /** längs der Wand (für Sofa, Läufer, Treppe) */
  const laengs = (k: WandKante) => schauNach(k.dx, k.dy) + Math.PI / 2;

  // ── Wände: Rundbögen an zwei gleich gerichteten Nachbarkanten, sonst Wandmodule ──
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
    if (belegt.has(k) || r() > 0.05 || !blindFrei(k)) continue;
    const n = nach.get(schluessel(k.x + Math.abs(k.dy) * 1.4, k.z + Math.abs(k.dx) * 1.4, k.dx, k.dy));
    if (!n || belegt.has(n) || !blindFrei(n)) continue;
    belegt.add(k).add(n);
    blindZaehle(k);
    setze("bogen1", (k.x + n.x) / 2, (k.z + n.z) / 2, schauNach(k.dx, k.dy), 1, 0);
    licht((k.x + n.x) / 2 - k.dx * 0.6, 2.4, (k.z + n.z) / 2 - k.dy * 0.6, 0xffc070, 4);
  }
  for (const k of kanten) {
    if (belegt.has(k)) continue;
    const w = r();
    const modell = k.halle
      ? (w < 0.3 ? "wand1" : w < 0.5 ? "wand5" : w < 0.62 ? "wand2" : w < 0.76 ? "wand3" : "wand4")
      : (w < 0.4 ? "wand1" : w < 0.55 ? "wand6" : w < 0.68 ? "wand3" : w < 0.8 ? "wand2" : "wand4");
    setze(modell, k.x, k.z, schauNach(k.dx, k.dy), 1, 0);
    if (modell === "wand4" && r() < 0.5) { const [x, z] = vor(k, 0.4); licht(x, 2.3, z, 0xffc070, 3.5); }
  }
  const ecken = eckBloecke(e, H3, 0x4a2a1c);
  if (ecken) g.add(ecken);

  // ── Hallen: Kronleuchter und Teppich, an den Wänden Möbelgruppen ──
  const hallen = [...e.raeume.map(p => [p.x, p.y] as [number, number]), e.ziel];
  hallen.forEach(([hx, hy], i) => {
    const mx = feldMitte(hx), mz = feldMitte(hy);
    setze("kronleuchter1", mx + 1.6, mz - 1.6, r() * Math.PI, 1, H3);
    licht(mx + 1.6, 2.9, mz - 1.6, 0xffc878, 12);
    setze(r() < 0.5 ? "teppich1" : "teppich2", mx, mz, Math.floor(r() * 2) * Math.PI / 2, 1, 0.01);
    const rand = kanten.filter(k => k.halle && !belegt.has(k) && Math.hypot(k.x - mx, k.z - mz) < 7.5);
    // Kamin mit Sesseln (am Ziel immer, sonst jede zweite Halle)
    if ((i % 2 === 0 || i === hallen.length - 1) && rand.length) {
      const k = nimm(rand), [x, z] = vor(k, 0.55);
      setze("kamin1", x, z, schauNach(k.dx, k.dy), 1, 0);
      licht(x + k.dx * 0.8, 0.8, z + k.dy * 0.8, 0xff8a30, 10);
      for (const s of [-1, 1]) {
        const sx = x + k.dx * 2 - k.dy * s * 1.5, sz = z + k.dy * 2 + k.dx * s * 1.5;
        setze("ohrensessel1", sx, sz, schauNach(-k.dx, -k.dy) + s * 0.5 + Math.PI, 1, 0);
      }
    }
    const MOEBEL = ["sofa1", "standuhr1", "vitrine1", "konsole1", "lampe1", "farn1", "schirmstaender1"];
    for (let n = 0; n < 4 && rand.length; n++) {
      const k = nimm(rand), modell = MOEBEL[Math.floor(r() * MOEBEL.length)];
      const ab = modell === "sofa1" ? 0.6 : modell === "konsole1" || modell === "vitrine1" ? 0.35 : modell === "standuhr1" ? 0.3 : 0.5;
      const [x, z] = vor(k, ab);
      setze(modell, x, z, schauNach(k.dx, k.dy), 1, 0);
      if (modell === "sofa1") { const [tx, tz] = vor(k, 1.6); setze("teetisch1", tx, tz, laengs(k), 1, 0); }
      if (modell === "konsole1") { setze("kandelaber1", x, z, schauNach(k.dx, k.dy), 1, 0.85); licht(x + k.dx * 0.5, 1.6, z + k.dy * 0.5, 0xffc070, 4); }
      if (modell === "lampe1") licht(x, 1.4, z, 0xffd090, 4);
    }
  });

  // ── Ankunft: Treppe zur Galerie an der Hallenwand ──
  {
    const [sx, sy] = e.start, mx = feldMitte(sx), mz = feldMitte(sy);
    const k = kanten.filter(q => !belegt.has(q) && Math.hypot(q.x - mx, q.z - mz) < 6)[0];
    if (k) {
      const [x, z] = vor(k, 0.85);
      setze("treppe1", x, z, laengs(k), 1, 0);
    }
  }
  // ── Flure: Läufer längs der Wand, in der Gangmitte ──
  for (const k of kanten) {
    if (k.halle || belegt.has(k) || r() > 0.04) continue;
    const [x, z] = vor(k, 2.1);
    setze("laeufer1", x, z, laengs(k), 1, 0.01);
  }

  const lit = new THREE.MeshLambertMaterial({ vertexColors: true });
  const stoff = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const glut = new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(1.5, 1.5, 1.5) });
  // ── Hallen ohne Aufgabe: Sitzgruppe auf dem Teppich unter dem Kronleuchter, an den Wänden Vitrinen, Uhren, Farne ──
  fuelleHallen(e, kanten, setze, r, {
    mitte: (x, z, w) => {
      // Sitzgruppe (etwa 4,5 × 3,5 m): Teppich längs, Teetisch in der Mitte, Sofa 1,05 m dahinter zum Tisch,
      // zwei Ohrensessel ±1,6 m seitlich, zum Tisch gedreht und 20° zum Sofa geneigt; Kronleuchter darüber
      const lx = Math.cos(w), lz = -Math.sin(w), fx = Math.sin(w), fz = Math.cos(w);
      setze("kronleuchter1", x, z, r() * Math.PI, 1, H3);
      licht(x, 2.9, z, 0xffc878, 10);
      setze(r() < 0.5 ? "teppich1" : "teppich2", x, z, w, 1, 0.01);
      setze("teetisch1", x, z, w, 1, 0);
      setze("sofa1", x - fx * 1.05, z - fz * 1.05, w, 1, 0);
      for (const s of [-1, 1]) {
        const dx = -lx * s - fx * 0.36, dz = -lz * s - fz * 0.36;
        setze("ohrensessel1", x + lx * s * 1.6, z + lz * s * 1.6, schauNach(dx, dz), 1, 0);
      }
    },
    wand: [["vitrine1", 0.4], ["standuhr1", 0.35], ["konsole1", 0.3], ["kandelaber1", 0.4], ["farn1", 0.5]],
    licht: (m, x, z) => { if (m === "kandelaber1") licht(x, 1.6, z, 0xffc070, 4); },
  }, k => !belegt.has(k));

  auf.fertig(g, (k, teil) => (teil.glut ? glut : /_stoff|_samt|_pflanze/.test(k) || /^wand5/.test(k) ? stoff : lit),
    (k, teil) => !teil.glut && /^(kamin|treppe|sofa|ohrensessel|vitrine|standuhr|kronleuchter)/.test(k));

  const luft = schweben(e, r, { farben: [0xffe8c0, 0xffd8a0], anzahl: 160, groesse: 0.04, fall: 0.015, hoehe: 3.6, leuchtet: true });
  g.add(luft.punkte);

  return { gruppe: g, wandHoehe: 99, decke: H3, stimmung: STIMMUNG, takt: luft.takt, lichter: lichtVorrat(g, lichtOrte, 6, 12) };
}
