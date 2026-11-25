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
import { PLATZ, ZELLE, feldMitte, type FreiEbene } from "@/lib/gebaeude/frei";
import { zufallAus } from "../stoff";
import { bauKacheln, kachelName } from "../bausatz";
import { H3, flaeche } from "./bauwelt";
import { deckenRaster, eckBloecke, kitAufsteller, lichtVorrat, schauNach, wandKanten, type WandKante, durchgangsRahmen, fuelleHallen, hatModell, mauerKappen, saalVor } from "./kitwelt";
import { glutStoff, kit } from "./modelle";
import { bodenLoecher, nasserBoden, type Loch } from "./nassboden";
import { himmel, schweben, umland, type Landschaft, type Stimmung } from "./welt";

export const NEON = "neon";
const AUTOMAT_LICHT: Record<string, number> = { automat1: 0x7fd0ff, automat2: 0xff9a7a, automat3: 0xffd27a };

const STIMMUNG: Stimmung = {
  // dunkel und dunstig: das Licht kommt aus Lampen, Neon und Automaten, nicht aus dem Raum
  himmelOben: 0x060c10, himmelUnten: 0x0c1a20, nebel: 0x142c34, dichte: 0.02,
  sonne: 0xbfe0ff, sonneStaerke: 0.3, sonneVon: [0.2, 1, 0.1],
  oben: 0x8ab4c4, unten: 0x1c2428, umgebung: 0.85, fackel: 5, fackelFarbe: 0xe8f4ff, belichtung: 1.3,
  // Schatten blaugrün, Lichter warm mit einem Hauch Magenta
  bild: { schatten: [0.84, 1.0, 1.08], licht: [1.1, 0.98, 1.0], leuchten: 1.1, schwelle: 0.85 },
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
  // Kabelkanäle längs durch die Säle (2,8 m je Stück); darüber wird der Boden ausgeschnitten
  const kanaele: { x: number; z: number; w: number }[] = [], loecher: Loch[] = [];
  if (hatModell(K, "kanal1")) for (const s of e.saele ?? []) {
    if (s.art === "vorplatz" || Math.min(s.b, s.h) < 8 || r() < 0.25) continue;
    const laengs = s.b >= s.h, stuecke = Math.floor(((laengs ? s.b : s.h) * ZELLE - 2.8) / 2.8);
    if (stuecke < 1) continue;
    const mx = (s.x + s.b / 2) * ZELLE, mz = (s.y + s.h / 2) * ZELLE;
    const quer = (r() < 0.5 ? -1 : 1) * ZELLE * 1.5, lang = stuecke * 2.8;
    for (let n = 0; n < stuecke; n++) {
      const t = -lang / 2 + 1.4 + n * 2.8;
      kanaele.push({ x: laengs ? mx + t : mx + quer, z: laengs ? mz + quer : mz + t, w: laengs ? 0 : Math.PI / 2 });
    }
    // Loch knapp innerhalb der Trogwände
    const hl = lang / 2 - 0.06, hb = 0.36;
    loecher.push(laengs ? [mx - hl, mz + quer - hb, mx + hl, mz + quer + hb] : [mx + quer - hb, mz - hl, mx + quer + hb, mz + hl]);
  }
  // Riffelblech dunkel und nass, darüber das Spiegelbild
  const boden = flaeche(e, T.boden, 0, true, 0x8a949c, 1.2);
  bodenLoecher(boden.material as THREE.Material, loecher);
  g.add(boden);
  const nass = nasserBoden(e.b * ZELLE, e.h * ZELLE, { pfuetzen: 0.32, film: 0.22, staerke: 1.15, dunkel: 0.5, loecher });
  nass.position.set((e.b * ZELLE) / 2, 0.012, (e.h * ZELLE) / 2);
  g.add(nass);

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
  // begehbare Rahmen in den Durchgängen der Karte (sobald der Baukasten sie hat); daneben kein Wandmodul (Laibung)
  const tueren = durchgangsRahmen(e);
  if (hatModell(K, "tor3")) {
    for (const t of tueren.rahmen) setze("tor3", t.x, t.z, t.w, 1, 0);
    for (const k of kanten) if (tueren.neben(k)) belegt.add(k);
  }
  // Blindtüren (die alten Tormodule) nur auf voller Wand, höchstens zwei je Saal
  const blinde = new Map<number, number>();
  const blindFrei = (k: WandKante) => { const s = saalVor(e, k); return !tueren.nah(k) && (s < 0 || (blinde.get(s) ?? 0) < 2); };
  const blindZaehle = (k: WandKante) => { const s = saalVor(e, k); if (s >= 0) blinde.set(s, (blinde.get(s) ?? 0) + 1); };
  for (const k of kanten) {
    if (!k.halle || belegt.has(k) || r() > 0.06 || !blindFrei(k)) continue;
    // Nachbarkante entlang der Wand (quer zur Blickrichtung)
    const n = nach.get(schluessel({ ...k, x: k.x + Math.abs(k.dy) * 1.4, z: k.z + Math.abs(k.dx) * 1.4 }));
    if (!n || belegt.has(n) || !blindFrei(n)) continue;
    belegt.add(k).add(n);
    blindZaehle(k);
    setze(r() < 0.6 ? "tor1" : "tor2", (k.x + n.x) / 2, (k.z + n.z) / 2, schauNach(k.dx, k.dy), 1, 0);
    licht((k.x + n.x) / 2 + k.dx * 0.8, 3.4, (k.z + n.z) / 2 + k.dy * 0.8, 0xff4040, 4);
  }
  // Leitstandfenster: zwei Zellen gerade Wand, höchstens eins je Saal
  if (hatModell(K, "fenster1")) {
    const mitFenster = new Set<number>();
    for (const k of kanten) {
      const sv = saalVor(e, k);
      if (!k.halle || sv < 0 || mitFenster.has(sv) || belegt.has(k) || r() > 0.12 || tueren.nah(k)) continue;
      const n = nach.get(schluessel({ ...k, x: k.x + Math.abs(k.dy) * 1.4, z: k.z + Math.abs(k.dx) * 1.4 }));
      if (!n || belegt.has(n) || tueren.nah(n)) continue;
      belegt.add(k).add(n);
      mitFenster.add(sv);
      const fx = (k.x + n.x) / 2, fz = (k.z + n.z) / 2;
      setze("fenster1", fx, fz, schauNach(k.dx, k.dy), 1, 0);
      licht(fx + k.dx * 1.2, 2.0, fz + k.dy * 1.2, 0x50b8ff, 6);
      if (hatModell(K, "warnplatte1")) setze("warnplatte1", fx + k.dx * 1.6, fz + k.dy * 1.6, schauNach(k.dx, k.dy), 1, 0);
    }
  }
  const WAENDE = ["wand1", "wand2", "wand3", "wand4", "wand5", "wand6", "wand7"].filter(m => hatModell(K, m));
  for (const k of kanten) {
    if (belegt.has(k)) continue;
    const m = WAENDE[Math.floor(r() * WAENDE.length)];
    setze(m, k.x, k.z, schauNach(k.dx, k.dy), 1, 0);
    // Warnschild mit Lampe
    if (m === "wand7") { const [lx, lz] = vor(k, 0.7); licht(lx, 2.6, lz, 0xffa030, 4); }
  }
  const ecken = eckBloecke(e, H3, 0x2e3a40);
  if (ecken) g.add(ecken);

  // Reaktoren in der Mitte großer Säle ohne Aufgabe (höchstens zwei); sie ragen durch die Decke
  const reaktoren = hatModell(K, "reaktor1")
    ? (e.saele ?? []).filter(s => s.art === "halle" && Math.min(s.b, s.h) >= 10 && r() < 0.6).slice(0, 2)
      .map(s => ({ x: (s.x + s.b / 2) * ZELLE, z: (s.y + s.h / 2) * ZELLE }))
    : [];
  const amReaktor = (x: number, z: number, ab: number) => reaktoren.some(q => Math.hypot(q.x - x, q.z - z) < ab);
  // ── Decke: Lichtpaneele (kalt) und Rohrbündel ──
  deckenRaster(e, istHalle, (x, z, halle) => {
    if (amReaktor(x, z, 2.4)) return;
    const paneel = r() < (halle ? 0.5 : 0.4);
    setze(paneel ? "decke1" : r() < 0.5 || !hatModell(K, "decke3") ? "decke2" : "decke3", x, z, Math.floor(r() * 2) * Math.PI / 2, 1, H3);
    if (paneel && r() < 0.4) licht(x, H3 - 1.1, z, r() < 0.45 ? 0xffb060 : 0xdff2ff, 7);
  });

  // ── an den Wänden: Neonleisten, Bodenleuchten, Kameras ──
  for (const k of kanten) {
    if (belegt.has(k)) continue;
    const w = r();
    if (w < 0.14) {
      const tuerkis = r() < 0.5;
      setze(tuerkis ? "neonleiste2" : "neonleiste1", k.x + k.dx * 0.02, k.z + k.dy * 0.02, schauNach(k.dx, k.dy), 1, 3.0);
      const [lx, lz] = vor(k, 0.8);
      licht(lx, 2.8, lz, tuerkis ? 0x40e0f0 : 0xff40c0, 8);
    } else if (w < 0.17) setze("kamera1", k.x, k.z, schauNach(k.dx, k.dy) + (r() - 0.5) * 0.8, 1, 3.3);
    if (r() < 0.22) {
      const [bx, bz] = vor(k, 0.35);
      setze("bodenlicht1", bx, bz, schauNach(k.dx, k.dy) + Math.PI / 2, 1, 0);
    }
  }

  // ── Hallen der Stationen: Automaten, Server, Terminals, Bildschirme, Arme, Wagen ──
  const AN_DER_WAND = ["automat1", "automat2", "automat3", "server1", "server1", "terminal1", "monitorwand1", "roboterarm1", "wagen1"];
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
      if (modell.startsWith("automat")) licht(x + k.dx * 0.8, 1.4, z + k.dy * 0.8, AUTOMAT_LICHT[modell] ?? 0x7fd0ff, 4);
    }
    // loser Kabellauf und eine Warnplatte im Saal
    if (hatModell(K, "kabellauf1") && r() < 0.7) setze("kabellauf1", mx + (r() - 0.5) * 5, mz + (r() - 0.5) * 5, Math.floor(r() * 4) * Math.PI / 2, 1, 0.005);
    if (hatModell(K, "warnplatte1") && r() < 0.5) setze("warnplatte1", mx + (r() - 0.5) * 4, mz + (r() - 0.5) * 4, 0, 1, 0);
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

  g.add(warnstreifen(kanten.filter(k => !belegt.has(k))));
  for (const k of kanaele) setze("kanal1", k.x, k.z, k.w, 1, 0);
  // Roboterarme an der Decke, längs einer Saalwand (tiefster Punkt 1,75 m: nur am Rand)
  if (hatModell(K, "roboterarm2")) (e.saele ?? []).forEach((s, nr) => {
    if (s.art === "vorplatz" || r() > 0.5) return;
    const rand = kanten.filter(k => k.halle && saalVor(e, k) === nr && !belegt.has(k));
    const k = rand[Math.floor(r() * rand.length)];
    if (!k) return;
    const [x, z] = vor(k, 1.0);
    if (!amReaktor(x, z, 3)) setze("roboterarm2", x, z, schauNach(k.dx, k.dy) + Math.PI / 2, 1, H3);
  });

  const lit = new THREE.MeshLambertMaterial({ vertexColors: true });
  const glut = glutStoff(1.5);
  const glas = new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(1.3, 1.3, 1.3), transparent: true, opacity: 0.75, depthWrite: false });
  const oel = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 120, specular: 0x88aacc, transparent: true, opacity: 0.85 });
  // ── Hallen ohne Aufgabe: Holotisch mit Terminal, Serverreihen und Monitorwände, Kleinkram am Boden ──
  fuelleHallen(e, kanten, setze, r, {
    mitte: (x, z, w) => {
      if (amReaktor(x, z, 0.5)) {
        // Reaktor: Kern glüht türkis, Warnplatten rundum
        setze("reaktor1", x, z, w, 1, 0);
        licht(x, 2.2, z, 0x40f0e0, 14);
        if (hatModell(K, "warnplatte1")) for (const [a, b] of [[2.2, 0], [-2.2, 0], [0, 2.2], [0, -2.2]]) setze("warnplatte1", x + a, z + b, 0, 1, 0);
        return;
      }
      // Holotisch, das Terminal 1,2 m davor, zum Tisch gewandt
      const fx = Math.sin(w), fz = Math.cos(w);
      setze("holotisch1", x, z, w, 1, 0);
      setze("terminal1", x + fx * 1.2, z + fz * 1.2, w + Math.PI, 1, 0);
      licht(x, 1.8, z, 0x40e0f0, 8);
    },
    wand: [["server1", 0.6], ["server1", 0.6], ["monitorwand1", 0.1], ["automat1", 0.5], ["automat2", 0.5], ["automat3", 0.5], ["roboterarm1", 0.8]],
    boden: ["wagen1", "pfuetze1", "bodenlicht1", "kabellauf1", "warnplatte1"],
    licht: (m, x, z) => { if (m.startsWith("automat")) licht(x, 1.4, z, AUTOMAT_LICHT[m] ?? 0x7fd0ff, 4); },
  }, k => !belegt.has(k));

  mauerKappen(e, K, g, r);

  auf.fertig(g, (k, teil) => (k.endsWith("_glas") ? glas : teil.glut ? glut : k.endsWith("_oel") ? oel : lit),
    (k, teil) => !teil.glut && /^(automat|server|roboterarm|wagen|aufzug|treppe|laufsteg|holotisch|reaktor)/.test(k));

  const luft = schweben(e, r, { farben: [0x9ad0e8, 0xdff2ff, 0xff80d0], anzahl: 160, groesse: 0.04, fall: 0.02, hoehe: 3.6, leuchtet: true });
  g.add(luft.punkte);

  // Decke für die Kamera: Unterkante der Rohrbündel (hängen bis 1,1 m herab), nicht die Deckenplatte
  return { gruppe: g, wandHoehe: 99, decke: H3 - 1.0, stimmung: STIMMUNG, takt: luft.takt, lichter: lichtVorrat(g, lichtOrte, 6, 12) };
}

/**
 * Gelb-schwarze Warnstreifen auf dem Boden, 0,85 m vor jeder Wand (vor dem Sockel der Module): eine Geometrie, ein Muster.
 * Je Wandkante ein Streifen von Zellbreite, die Schrägen laufen über die Kanten weiter.
 */
function warnstreifen(kanten: WandKante[]): THREE.Mesh {
  const lage: number[] = [], uv: number[] = [], index: number[] = [];
  const BREIT = 0.16, AB = 0.85, Y = 0.006;
  for (const k of kanten) {
    const qx = -k.dy, qz = k.dx; // längs der Wand
    const cx = k.x + k.dx * AB, cz = k.z + k.dy * AB;
    const n = lage.length / 3;
    for (const [l, b] of [[-0.5, 0], [0.5, 0], [0.5, 1], [-0.5, 1]] as [number, number][]) {
      const ab = (b - 0.5) * BREIT;
      const x = cx + qx * l * ZELLE + k.dx * ab, z = cz + qz * l * ZELLE + k.dy * ab;
      lage.push(x, Y, z);
      // Muster in Weltkoordinaten längs der Wand, damit Nachbarn nahtlos anschließen
      uv.push((x * Math.abs(qx) + z * Math.abs(qz)) / 0.5, b);
    }
    index.push(n, n + 1, n + 2, n, n + 2, n + 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(lage, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(lage.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  geo.setIndex(index);
  const c = document.createElement("canvas");
  c.width = 64; c.height = 16;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#16181a"; ctx.fillRect(0, 0, 64, 16);
  ctx.fillStyle = "#d8a21c";
  for (let x = -32; x < 96; x += 32) { ctx.beginPath(); ctx.moveTo(x, 16); ctx.lineTo(x + 16, 16); ctx.lineTo(x + 32, 0); ctx.lineTo(x + 16, 0); ctx.fill(); }
  // abgetreten: dunkle Flecken
  for (let i = 0; i < 40; i++) { ctx.fillStyle = `rgba(20,20,20,${0.15 + Math.random() * 0.35})`; ctx.fillRect(Math.random() * 64, Math.random() * 16, 1 + Math.random() * 4, 1 + Math.random() * 2); }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex, polygonOffset: true, polygonOffsetFactor: -2 }));
  m.receiveShadow = true;
  return m;
}

