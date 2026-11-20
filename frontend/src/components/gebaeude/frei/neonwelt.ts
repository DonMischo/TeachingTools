/**
 * Neon-Werkhalle (Cyberpunk) im gemalten Stil: Modelle aus dem Baukasten der Weltenwerkstatt
 * (TT-Weltenwerkstatt/blender/neon.py → /modelle/welten/neon.glb, fertig gefärbt) und die
 * Kacheln des Stils (Riffelblech) auf der Gebäudekarte.
 *
 * - Wände aus Modulen (Beton, Stahl, Lüfter, Verteilerkasten, Kabelstränge) an jeder Kante Gang/Wand,
 *   an langen geraden Hallenwänden Schotttore; Stahldecke mit Lichtpaneelen und Rohrbündeln.
 * - Neonleisten in Magenta und Türkis, Bodenleuchten in Bernstein den Wänden entlang.
 * - In den Hallen Automaten, Serverschränke, Terminals, Bildschirmwände, Roboterarme, Lastenwagen,
 *   Ölpfützen; an der Ankunft der Holotisch, am Ziel der Aufzug und eine Treppe zum Laufsteg.
 * - Gegner sind hier Roboter (welt.ts: baueOrte).
 *
 * Gibt null zurück, solange Baukasten oder Kacheln fehlen (dann baut bauwelt.ts den Kachelbau).
 */
import * as THREE from "three";
import { PLATZ, feldMitte, type FreiEbene } from "@/lib/gebaeude/frei";
import { zufallAus } from "../stoff";
import { bauKacheln, kachelName } from "../bausatz";
import { H3, flaeche } from "./bauwelt";
import { deckenRaster, eckBloecke, kitAufsteller, lichtVorrat, schauNach, wandKanten, type WandKante } from "./kitwelt";
import { kit } from "./modelle";
import { himmel, schweben, umland, type Landschaft, type Stimmung } from "./welt";

export const NEON = "neon";

const STIMMUNG: Stimmung = {
  himmelOben: 0x0a1418, himmelUnten: 0x10242c, nebel: 0x1e4450, dichte: 0.016,
  sonne: 0xbfe0ff, sonneStaerke: 0.5, sonneVon: [0.2, 1, 0.1],
  oben: 0x9ac8d8, unten: 0x2a3036, umgebung: 1.45, fackel: 7, fackelFarbe: 0xdff2ff, belichtung: 1.45,
};

export function neonLandschaft(e: FreiEbene, seed: number): Landschaft | null {
  const K = kit(NEON), T = bauKacheln(kachelName("neon"));
  if (!K || !T?.boden) return null;
  const r = zufallAus(seed * 29 + 13);
  const g = new THREE.Group();
  const dreh = () => r() * Math.PI * 2;
  const nimm = <T,>(liste: T[]) => liste.splice(Math.floor(r() * liste.length), 1)[0];

  g.add(himmel(STIMMUNG.himmelOben, STIMMUNG.himmelUnten));
  g.add(umland(e, 0x1a2228));
  g.add(flaeche(e, T.boden, 0, true, 0xffffff, 1.2));

  const auf = kitAufsteller(K, () => 0);
  const setze = auf.setze;
  const lichtOrte: { p: THREE.Vector3; f: number; staerke?: number }[] = [];
  const licht = (x: number, y: number, z: number, f: number, staerke: number) => lichtOrte.push({ p: new THREE.Vector3(x, y, z), f, staerke });
  /** ein Stück vor der Wand, in den Gang hinein */
  const vor = (k: WandKante, ab: number): [number, number] => [k.x + k.dx * ab, k.z + k.dy * ab];

  // ── Wände: Schotttore an zwei gleich gerichteten Nachbarkanten einer Halle, sonst Wandmodule ──
  const istHalle = (a: number) => a === PLATZ;
  const kanten = wandKanten(e, istHalle);
  const schluessel = (k: WandKante) => `${Math.round(k.x * 10)}|${Math.round(k.z * 10)}|${k.dx}|${k.dy}`;
  const nach = new Map(kanten.map(k => [schluessel(k), k]));
  const belegt = new Set<WandKante>();
  for (const k of kanten) {
    if (!k.halle || belegt.has(k) || r() > 0.06) continue;
    // Nachbarkante entlang der Wand (quer zur Blickrichtung)
    const n = nach.get(schluessel({ ...k, x: k.x + Math.abs(k.dy) * 1.4, z: k.z + Math.abs(k.dx) * 1.4 }));
    if (!n || belegt.has(n)) continue;
    belegt.add(k).add(n);
    setze(r() < 0.6 ? "tor1" : "tor2", (k.x + n.x) / 2, (k.z + n.z) / 2, schauNach(k.dx, k.dy), 1, 0);
    licht((k.x + n.x) / 2 + k.dx * 0.8, 3.4, (k.z + n.z) / 2 + k.dy * 0.8, 0xff4040, 4);
  }
  for (const k of kanten) {
    if (belegt.has(k)) continue;
    const w = r();
    setze(w < 0.3 ? "wand1" : w < 0.5 ? "wand2" : w < 0.65 ? "wand3" : w < 0.82 ? "wand4" : "wand5", k.x, k.z, schauNach(k.dx, k.dy), 1, 0);
  }
  const ecken = eckBloecke(e, H3, 0x2e3a40);
  if (ecken) g.add(ecken);

  // ── Decke: Lichtpaneele (kalt) und Rohrbündel mit Magenta-Leiste ──
  deckenRaster(e, istHalle, (x, z, halle) => {
    const paneel = r() < (halle ? 0.55 : 0.45);
    setze(paneel ? "decke1" : "decke2", x, z, Math.floor(r() * 2) * Math.PI / 2, 1, H3);
    if (paneel && r() < 0.35) licht(x, H3 - 1.1, z, 0xdff2ff, 6);
  });

  // ── an den Wänden: Neonleisten, Bodenleuchten, Kameras ──
  for (const k of kanten) {
    if (belegt.has(k)) continue;
    const w = r();
    if (w < 0.08) {
      const tuerkis = r() < 0.5;
      setze(tuerkis ? "neonleiste2" : "neonleiste1", k.x + k.dx * 0.02, k.z + k.dy * 0.02, schauNach(k.dx, k.dy), 1, 3.0);
      const [lx, lz] = vor(k, 0.8);
      licht(lx, 2.8, lz, tuerkis ? 0x40e0f0 : 0xff40c0, 6);
    } else if (w < 0.11) setze("kamera1", k.x, k.z, schauNach(k.dx, k.dy) + (r() - 0.5) * 0.8, 1, 3.3);
    if (r() < 0.22) {
      const [bx, bz] = vor(k, 0.35);
      setze("bodenlicht1", bx, bz, schauNach(k.dx, k.dy) + Math.PI / 2, 1, 0);
    }
  }

  // ── Hallen der Stationen: Automaten, Server, Terminals, Bildschirme, Arme, Wagen ──
  const AN_DER_WAND = ["automat1", "automat2", "server1", "server1", "terminal1", "monitorwand1", "roboterarm1", "wagen1"];
  for (const p of e.raeume) {
    const mx = feldMitte(p.x), mz = feldMitte(p.y);
    const rand = kanten.filter(k => k.halle && !belegt.has(k) && Math.hypot(k.x - mx, k.z - mz) < 7.5);
    for (let n = 0; n < 5 && rand.length; n++) {
      const k = nimm(rand), modell = AN_DER_WAND[Math.floor(r() * AN_DER_WAND.length)];
      if (modell === "monitorwand1") {
        // hängt an der Wand (Ursprung an der Wand)
        setze(modell, k.x, k.z, schauNach(k.dx, k.dy), 1, 0);
        const [lx, lz] = vor(k, 1);
        licht(lx, 1.8, lz, 0x60c8ff, 4);
        continue;
      }
      const ab = modell.startsWith("automat") ? 0.5 : modell === "server1" ? 0.6 : modell === "roboterarm1" ? 0.9 : 0.6;
      const [x, z] = vor(k, ab);
      // Automaten und Schränke mit der Front zum Gang; Arm und Wagen längs der Wand
      const w = modell === "roboterarm1" || modell === "wagen1" ? schauNach(k.dx, k.dy) + Math.PI / 2 : schauNach(k.dx, k.dy);
      setze(modell, x, z, w, 1, 0);
      if (modell.startsWith("automat")) licht(x + k.dx * 0.8, 1.4, z + k.dy * 0.8, modell === "automat1" ? 0x7fd0ff : 0xff9a7a, 4);
    }
    if (r() < 0.6) setze("pfuetze1", mx + (r() - 0.5) * 6, mz + (r() - 0.5) * 6, dreh(), 0.8 + r() * 0.6, 0.01);
  }
  // ── Ankunft: Holotisch; Ziel: Aufzug und Treppe zum Laufsteg ──
  {
    const [sx, sy] = e.start, mx = feldMitte(sx), mz = feldMitte(sy);
    const k = kanten.filter(q => Math.hypot(q.x - mx, q.z - mz) < 6 && !belegt.has(q))[0];
    if (k) {
      const [x, z] = vor(k, 2.2);
      setze("holotisch1", x, z, schauNach(-k.dx, -k.dy), 1, 0);
      licht(x, 1.8, z, 0x40e0f0, 8);
    }
  }
  {
    const [zx, zy] = e.ziel, mx = feldMitte(zx), mz = feldMitte(zy);
    const rand = kanten.filter(q => q.halle && !belegt.has(q) && Math.hypot(q.x - mx, q.z - mz) < 7.5);
    const k = rand.sort((a, b) => Math.hypot(b.x - mx, b.z - mz) - Math.hypot(a.x - mx, a.z - mz))[0];
    if (k) {
      const [x, z] = vor(k, 1.5);
      setze("aufzug1", x, z, schauNach(k.dx, k.dy), 1, 0);
      licht(x, 2.2, z, 0x40e0f0, 10);
      const quer = rand.find(q => q !== k && q.dx === k.dx && q.dy === k.dy && Math.hypot(q.x - k.x, q.z - k.z) > 4);
      if (quer) {
        const [tx, tz] = vor(quer, 0.75);
        setze("treppe1", tx, tz, schauNach(-quer.dy, quer.dx), 1, 0);
      }
    }
  }

  const lit = new THREE.MeshLambertMaterial({ vertexColors: true });
  const glut = new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(1.5, 1.5, 1.5) });
  const glas = new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(1.3, 1.3, 1.3), transparent: true, opacity: 0.75, depthWrite: false });
  const oel = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 120, specular: 0x88aacc, transparent: true, opacity: 0.85 });
  auf.fertig(g, (k, teil) => (k.endsWith("_glas") ? glas : teil.glut ? glut : k.endsWith("_oel") ? oel : lit),
    (k, teil) => !teil.glut && /^(automat|server|roboterarm|wagen|aufzug|treppe|laufsteg|holotisch)/.test(k));

  const luft = schweben(e, r, { farben: [0x9ad0e8, 0xdff2ff, 0xff80d0], anzahl: 160, groesse: 0.04, fall: 0.02, hoehe: 3.6, leuchtet: true });
  g.add(luft.punkte);

  return { gruppe: g, wandHoehe: 99, decke: H3, stimmung: STIMMUNG, takt: luft.takt, lichter: lichtVorrat(g, lichtOrte, 6, 12) };
}
