/**
 * Kristallhöhle im gemalten Stil: Modelle aus dem Baukasten der Weltenwerkstatt
 * (TT-Weltenwerkstatt/blender/hoehle.py → /modelle/welten/hoehle.glb, fertig gefärbt),
 * aufgestellt auf einer Höhlenkarte mit Bach (lib/gebaeude/lichtung.ts, Art »hoehlebach«).
 *
 * - Felswände an jeder Kante zwischen Gang und Fels, ein Stück in den Fels zurückgesetzt (die Wand
 *   wölbt sich bis 1,5 m vor); in der Tiefe Felsmassen, darüber eine geschlossene Decke mit Tropfsteinen.
 *   Über den Wegen hängen nur kurze Zapfen, damit die Kamera frei bleibt.
 * - Tropfsteinsäulen auf den einzelnen Säulenfeldern der Karte, Stalagmiten am Rand.
 * - Leuchtende Kristalle in Türkis und Violett an den Wänden — das Hauptlicht; warme Inseln an
 *   Feuerkörben und Laternen bei den Stationen.
 * - Bach in einer Senke mit Steinbrücken (Runen), Wasserfälle, wo er aus dem Fels tritt.
 * - Am Ziel ein Torbogen mit Licht am Gangende; Lore auf Gleisen, Statuen, Knochen, Quarz, Höhlenpilze.
 *
 * Gibt null zurück, solange der Baukasten nicht geladen ist (dann baut welt.ts die alte Höhle).
 */
import * as THREE from "three";
import { PLATZ, WAND, ZELLE, type FreiEbene } from "@/lib/gebaeude/frei";
import { zufallAus } from "../stoff";
import { bachGelaende, brueckenAus, brueckenHoehe, kitAufsteller, lichtVorrat, wasserFlaeche } from "./kitwelt";
import { kit } from "./modelle";
import { aus, boden, schweben, strich, striche, tiefen, type Landschaft, type Stimmung } from "./welt";

export const HOEHLE = "hoehle";

const STIMMUNG: Stimmung = {
  himmelOben: 0x0a1418, himmelUnten: 0x1c3038, nebel: 0x2a4a56, dichte: 0.024,
  sonne: 0x9ad0d8, sonneStaerke: 0.35, sonneVon: [0.3, 0.9, -0.2],
  // Grundlicht dunkel blaugrün, über der Figur ein schwaches warmes Licht, damit sie nicht zum Schattenriss wird
  oben: 0x7aa8b8, unten: 0x2a3036, umgebung: 1.1, fackel: 9, fackelFarbe: 0xffd2a0, belichtung: 1.35,
};

const DECKE = 8.0;
const BETT = -0.85;
const FUSS: Record<string, number> = {
  tropfsaeule1: 2.1, tropfsaeule2: 1.5, tropfsaeule3: 2.2, stalagmit1: 1.2, stalagmit2: 0.8, felsen1: 2.0, felsen2: 1.6,
  tuerkiskristall1: 1.5, lilakristall1: 1.5, tuerkiskristall2: 0.9, lilakristall2: 0.9, torbogen1: 2.4, torbogen2: 2.4,
  wasserfall1: 2.4, statue1: 0.7, lore1: 1.4, hoehlenpilz1: 1.7, hoehlenpilz2: 1.0, feuerkorb1: 0.5,
};
const RICHTUNGEN: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
/** Drehung, damit die Schauseite (+z im Modell) in Richtung (dx, dz) zeigt */
const schauNach = (dx: number, dz: number) => Math.atan2(dx, dz);

export function hoehlenLandschaft(e: FreiEbene, seed: number): Landschaft | null {
  const K = kit(HOEHLE);
  if (!K) return null;
  const r = zufallAus(seed * 17 + 5);
  const g = new THREE.Group();
  const Z = ZELLE, RAND = 6;
  const { t, B } = tiefen(e, RAND, 8);
  const { gelaende, wTiefe, istWasser } = bachGelaende(e, t, B, RAND, seed, BETT, 0);
  const frei = (x: number, y: number) => x >= 0 && y >= 0 && x < e.b && y < e.h && e.art[y * e.b + x] !== WAND;
  const tiefe = (x: number, y: number) => t[(y + RAND) * B + x + RAND];
  const dreh = () => r() * Math.PI * 2;

  // ── Boden: dunkler Fels, heller ausgetretener Weg, Bachbett ────────────
  const FELS = [0x2a3036, 0x31383e, 0x262c30, 0x353b3c], ROST = [0x4a3a2c, 0x5a4230];
  const WEGSTEIN = [0x5a5650, 0x645f56, 0x4f4c48, 0x6b6458], HALLE = [0x4a4844, 0x55524c, 0x433f3a];
  g.add(boden(e, (ctx, px) => {
    striche(ctx, e, px, r, 6, (a, x, y) => (istWasser(x, y) ? [0x10242a, 0x16303a, 0x0f2026] : a === WAND ? (r() < 0.2 ? ROST : FELS) : a === PLATZ ? HALLE : WEGSTEIN));
    for (let y = 0; y < e.h; y++) for (let x = 0; x < e.b; x++) {
      if (!frei(x, y) || istWasser(x, y)) continue;
      // Steinplatten und Kiesel auf dem Weg, Kristallsplitter als helle Tupfer
      if (r() < 0.3) {
        const cx = (x + 0.2 + r() * 0.6) * px, cy = (y + 0.2 + r() * 0.6) * px, w = px * (0.2 + r() * 0.16);
        strich(ctx, cx + px * 0.04, cy + px * 0.05, w, w * 0.7, r() * 3, "#1a1c1e", 0.5);
        strich(ctx, cx, cy, w, w * 0.7, r() * 3, aus(["#6e6a62", "#7a7468", "#625e58"], r));
      }
      if (r() < 0.12) {
        ctx.fillStyle = aus(["#6fd8f0", "#a080f0", "#5ab0ff"], r);
        ctx.beginPath();
        ctx.arc((x + r()) * px, (y + r()) * px, px * 0.04, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, 0x262c30, gelaende));
  const wm = wasserFlaeche(e, BETT * 0.4, new THREE.MeshPhongMaterial({ color: 0x1f5f6e, specular: 0x9fe8f0, shininess: 100, emissive: 0x0f4a58, emissiveIntensity: 0.9, transparent: true, opacity: 0.85 }));
  if (wm) g.add(wm);

  const auf = kitAufsteller(K, gelaende, FUSS);
  const lichtOrte: { p: THREE.Vector3; f: number; staerke?: number }[] = [];
  const setze = auf.setze;

  // ── Wände: je Kante Gang/Fels ein Wandstück, mit Abstand zum letzten gleicher Richtung ──
  const waende: [number, number, number, number][] = [];
  for (let y = -RAND; y < e.h + RAND; y++) for (let x = -RAND; x < e.b + RAND; x++) {
    if (frei(x, y) || istWasser(x, y)) continue;
    for (const [dx, dy] of RICHTUNGEN) {
      if (!frei(x + dx, y + dy) && !istWasser(x + dx, y + dy)) continue;
      // Grundlinie: Zellkante, 1,3 m in den Fels zurück (die Wand wölbt sich oben bis 2 m vor, die Kamera prüft nur die Felder); Schauseite zum Gang
      const kx = (x + 0.5 + dx * 0.5) * Z - dx * 1.3, kz = (y + 0.5 + dy * 0.5) * Z - dy * 1.3;
      if (waende.some(([wx, wz, wdx, wdy]) => wdx === dx && wdy === dy && Math.hypot(wx - kx, wz - kz) < 2.3)) continue;
      waende.push([kx, kz, dx, dy]);
      setze(`wand${1 + Math.floor(r() * 3)}`, kx, kz, schauNach(dx, dy), new THREE.Vector3(1, 0.95 + r() * 0.1, 1), 0);
    }
  }
  // tiefer im Fels: Felsmassen, damit zwischen den Wandstücken nie ein Loch bleibt
  for (let y = -RAND; y < e.h + RAND; y++) for (let x = -RAND; x < e.b + RAND; x++) {
    const d = tiefe(x, y);
    if (d < 2 || d > 3 || istWasser(x, y) || r() > 0.5) continue;
    setze(r() < 0.5 ? "felsen1" : "felsen2", (x + 0.5) * Z, (y + 0.5) * Z, dreh(), 1, 0);
  }

  // ── Decke mit Tropfsteinen ────────────────────────────────────────────
  const KACHEL = 5.6;
  for (let z = -RAND * Z; z < (e.h + RAND) * Z; z += KACHEL) for (let x = -RAND * Z; x < (e.b + RAND) * Z; x += KACHEL) {
    setze(r() < 0.6 ? "decke1" : "decke2", x + KACHEL / 2, z + KACHEL / 2, Math.floor(r() * 4) * Math.PI / 2, 1, DECKE);
  }
  for (let y = 0; y < e.h; y++) for (let x = 0; x < e.b; x++) {
    const wx = (x + r()) * Z, wz = (y + r()) * Z;
    if (frei(x, y)) {
      // über Wegen nur kurze Zapfen (Spitzen über 5 m)
      if (r() < 0.07) setze(r() < 0.6 ? "tropfstein3" : "tropfstein2", wx, wz, dreh(), 0.9 + r() * 0.3, DECKE - 0.4);
    } else if (tiefe(x, y) <= 2 && r() < 0.12) setze(r() < 0.5 ? "tropfstein1" : "tropfstein4", wx, wz, dreh(), 0.9 + r() * 0.3, DECKE - 0.5);
  }

  // ── Säulen und Stalagmiten ────────────────────────────────────────────
  for (let y = 0; y < e.h; y++) for (let x = 0; x < e.b; x++) {
    if (frei(x, y) || istWasser(x, y)) continue;
    // einzelnes Säulenfeld mitten im Gang: Tropfsteinsäule, schmal genug, dass man drumherum kommt
    let ringsFrei = true;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) if (!frei(x + dx, y + dy)) ringsFrei = false;
    if (ringsFrei) {
      const s = 0.6 + r() * 0.15;
      setze(r() < 0.5 ? "tropfsaeule1" : "tropfsaeule2", (x + 0.5) * Z, (y + 0.5) * Z, dreh(), new THREE.Vector3(s, DECKE / 8.6 + 0.02, s), 0);
    } else if (tiefe(x, y) === 1 && r() < 0.08) {
      setze(`stalagmit${1 + Math.floor(r() * 3)}`, (x + 0.5) * Z, (y + 0.5) * Z, dreh(), 0.8 + r() * 0.4, 0);
    }
  }

  // ── Kristalle an den Wänden: das Hauptlicht ───────────────────────────
  for (const [kx, kz, dx, dy] of waende) {
    if (r() > 0.3) continue;
    const art = r() < 0.55 ? "tuerkiskristall" : "lilakristall", gr = r() < 0.35 ? 1 : 2;
    // vor die Wand, schräg in den Gang
    const x = kx + dx * (gr === 1 ? 1.6 : 1.3), z = kz + dy * (gr === 1 ? 1.6 : 1.3);
    if (!auf.frei(x, z, FUSS[`${art}${gr}`])) continue;
    setze(`${art}${gr}`, x, z, dreh(), gr === 1 ? 0.8 : 0.9 + r() * 0.2);
    lichtOrte.push({ p: new THREE.Vector3(x + dx * 0.8, 1.8, z + dy * 0.8), f: art === "tuerkiskristall" ? 0x4fd0f0 : 0xa070e8, staerke: gr === 1 ? 16 : 10 });
  }
  // kleine Kristalle am Wegrand
  for (let y = 0; y < e.h; y++) for (let x = 0; x < e.b; x++) {
    if (!frei(x, y) || istWasser(x, y) || r() > 0.1) continue;
    let amRand = false;
    for (const [dx, dy] of RICHTUNGEN) if (!frei(x + dx, y + dy)) amRand = true;
    if (amRand) setze(`kristallchen${1 + Math.floor(r() * 3)}`, (x + r()) * Z, (y + r()) * Z, dreh(), 0.9 + r() * 0.8);
  }

  // ── Bach: Brücken, Wasserfälle an den Enden, Ufer ─────────────────────
  const bruecken = brueckenAus(e);
  for (const b of bruecken) setze("steinbruecke1", b.x, b.z, -b.w, 1, BETT * 0.4 - 0.1);
  if (e.wasser) {
    // Wasserfall: wo das Bachende an Fels stößt, Schauseite zum Wasser
    const enden: [number, number][] = [];
    for (let y = 0; y < e.h; y++) for (let x = 0; x < e.b; x++) {
      if (!istWasser(x, y)) continue;
      const nachbarn = RICHTUNGEN.filter(([dx, dy]) => istWasser(x + dx, y + dy)).length;
      const amFels = RICHTUNGEN.some(([dx, dy]) => !frei(x + dx, y + dy) && !istWasser(x + dx, y + dy));
      if (nachbarn <= 2 && amFels && (x < 3 || y < 3 || x > e.b - 4 || y > e.h - 4)) enden.push([x, y]);
    }
    const gesetzt: [number, number][] = [];
    for (const [x, y] of enden) {
      if (gesetzt.some(([gx, gy]) => Math.hypot(gx - x, gy - y) < 12)) continue;
      // zur Mitte des Wassers schauen
      const [dx, dy] = x < 3 ? [1, 0] : x > e.b - 4 ? [-1, 0] : y < 3 ? [0, 1] : [0, -1];
      setze("wasserfall1", (x + 0.5) * Z - dx * 1.2, (y + 0.5) * Z - dy * 1.2, schauNach(dx, dy), 1, 0);
      lichtOrte.push({ p: new THREE.Vector3((x + 0.5 + dx * 2) * Z, 2.5, (y + 0.5 + dy * 2) * Z), f: 0x6fd8f0, staerke: 6 });
      gesetzt.push([x, y]);
    }
    // Ufer: Geröll, Farne, hängende Wurzeln über dem Wasser
    for (let y = 0; y < e.h; y++) for (let x = 0; x < e.b; x++) {
      if (istWasser(x, y) || wTiefe[y * e.b + x] !== 1) continue;
      if (!frei(x, y) && r() < 0.35) setze(r() < 0.5 ? `geroell${1 + Math.floor(r() * 2)}` : "farn1", (x + r()) * Z, (y + r()) * Z, dreh(), 0.7 + r() * 0.4);
      if (r() < 0.06) setze(`wurzeln${1 + Math.floor(r() * 2)}`, (x + r()) * Z, (y + r()) * Z, dreh(), 1, DECKE - 0.5);
    }
  }

  // ── Ziel: Torbogen in der Wand, mit Licht am Gangende ─────────────────
  {
    const [zx, zy] = e.ziel;
    let best: [number, number, number, number] | null = null, bd = Infinity;
    for (const [kx, kz, dx, dy] of waende) {
      const d = Math.hypot(kx - (zx + 0.5) * Z, kz - (zy + 0.5) * Z);
      // die Wand der Zielhalle, die zur Mitte schaut
      const zurMitte = ((zx + 0.5) * Z - kx) * dx + ((zy + 0.5) * Z - kz) * dy > 0;
      if (zurMitte && d < bd) { bd = d; best = [kx, kz, dx, dy]; }
    }
    if (best && bd < 14) {
      const [kx, kz, dx, dy] = best;
      setze("torbogen1", kx - dx * 0.3, kz - dy * 0.3, schauNach(dx, dy), 1, 0);
      lichtOrte.push({ p: new THREE.Vector3(kx + dx * 1.5, 2.4, kz + dy * 1.5), f: 0x6fe8f0, staerke: 10 });
    }
  }

  // ── an den Stationen: Feuerkorb oder Laterne, manchmal Statue, Lore, alter Torbogen ──
  const hallen = [...e.raeume.map(p => [p.x, p.y] as [number, number]), e.start];
  hallen.forEach(([hx, hy], i) => {
    const mx = (hx + 0.5) * Z, mz = (hy + 0.5) * Z;
    const a = r() * Math.PI * 2, x = mx + Math.cos(a) * 4.6, z = mz + Math.sin(a) * 4.6;
    if (r() < 0.6) {
      setze("feuerkorb1", x, z, dreh(), 1);
      lichtOrte.push({ p: new THREE.Vector3(x, 1.6, z), f: 0xff9040, staerke: 9 });
    } else {
      setze("laterne2", x, z, dreh(), 1);
      lichtOrte.push({ p: new THREE.Vector3(x, 1.8, z), f: 0xffa050, staerke: 7 });
    }
    if (i % 3 === 1) {
      // Statue an der Hallenwand, zur Mitte
      const w = waende.filter(([kx, kz]) => Math.hypot(kx - mx, kz - mz) < 11);
      const [kx, kz, dx, dy] = w[Math.floor(r() * w.length)] ?? [];
      if (kx !== undefined) setze("statue1", kx + dx * 2.2, kz + dy * 2.2, schauNach(dx, dy), 1);
    }
    if (i % 3 === 2) {
      // Lore auf einem Gleisstück entlang der Hallenwand
      const w = waende.filter(([kx, kz]) => Math.hypot(kx - mx, kz - mz) < 11);
      const [kx, kz, dx, dy] = w[Math.floor(r() * w.length)] ?? [];
      if (kx !== undefined) {
        const lx = kx + dx * 2.4, lz = kz + dy * 2.4, laengs = Math.atan2(-dx, dy) + Math.PI / 2;
        setze("lore1", lx, lz, laengs, 1, 0);
        setze("gleis1", lx + Math.cos(laengs) * 2.8, lz - Math.sin(laengs) * 2.8, laengs, 1, 0);
      }
    }
    if (i % 4 === 3) {
      const w = waende.filter(([kx, kz]) => Math.hypot(kx - mx, kz - mz) < 12);
      const [kx, kz, dx, dy] = w[Math.floor(r() * w.length)] ?? [];
      if (kx !== undefined) setze("torbogen2", kx - dx * 0.3, kz - dy * 0.3, schauNach(dx, dy), 1, 0);
    }
  });

  // ── Kleinkram am Rand der Gänge ───────────────────────────────────────
  for (let y = 0; y < e.h; y++) for (let x = 0; x < e.b; x++) {
    if (frei(x, y) || istWasser(x, y) || tiefe(x, y) !== 1) continue;
    const wx = (x + 0.5) * Z, wz = (y + 0.5) * Z;
    // zum Gang hin versetzt
    const [dx, dy] = RICHTUNGEN.find(([a, b]) => frei(x + a, y + b)) ?? [0, 0];
    const px = wx + dx * 0.9 + (r() - 0.5) * 0.6, pz = wz + dy * 0.9 + (r() - 0.5) * 0.6;
    const w = r();
    if (w < 0.05) setze(r() < 0.5 ? "knochen1" : "skelett1", px, pz, dreh(), 0.9 + r() * 0.2);
    else if (w < 0.12) setze(`quarz${1 + Math.floor(r() * 2)}`, px, pz, dreh(), 0.6 + r() * 0.5);
    else if (w < 0.2) setze(`geroell${1 + Math.floor(r() * 2)}`, px, pz, dreh(), 0.6 + r() * 0.5);
    else if (w < 0.24 && auf.frei(px, pz, 1)) {
      setze(r() < 0.4 ? "hoehlenpilz1" : "hoehlenpilz2", px, pz, dreh(), 0.8 + r() * 0.3);
      lichtOrte.push({ p: new THREE.Vector3(px, 1.6, pz), f: 0x6fe8f0, staerke: 4 });
    } else if (w < 0.26) setze("laterne1", px, pz, dreh(), 1);
  }

  // ── Stoffe: Kristalle, Feuer, Licht kräftig; Wasser und Gischt schwach ──
  const lit = new THREE.MeshLambertMaterial({ vertexColors: true });
  const innen = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const glut = new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(1.6, 1.6, 1.6) });
  const sanft = new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(1.1, 1.1, 1.1), transparent: true, opacity: 0.85, depthWrite: false });
  auf.fertig(g,
    (k, teil) => (teil.glut ? (/_wasser$|_becken$|_schaum$/.test(k) && !k.startsWith("wasserfall1_wasser") ? sanft : glut)
      : /_wedel|_lamellen|_wurzel|_gang|decke/.test(k) ? innen : lit),
    (k, teil) => !teil.glut && /^(tropfsaeule|stalagmit1|steinbruecke|torbogen|statue|lore|tuerkiskristall1|lilakristall1)/.test(k));

  const luft = schweben(e, r, { farben: [0x6fd8f0, 0xa080f0, 0x9ad0d8, 0xffd0a0], anzahl: 320, groesse: 0.06, fall: -0.04, hoehe: 6, leuchtet: true });
  g.add(luft.punkte);

  return {
    gruppe: g, wandHoehe: 99, kameraRand: 0.85, stimmung: STIMMUNG, takt: luft.takt,
    hoehe: brueckenHoehe(bruecken), lichter: lichtVorrat(g, lichtOrte, 6, 16),
  };
}
