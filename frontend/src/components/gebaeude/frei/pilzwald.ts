/**
 * Pilzwald im gemalten Stil: Modelle aus dem Baukasten der Weltenwerkstatt
 * (TT-Weltenwerkstatt/blender/pilzwald.py → /modelle/welten/pilzwald.glb, fertig gefärbt),
 * aufgestellt auf einer Lichtungskarte mit Bach (lib/gebaeude/lichtung.ts).
 *
 * - Uralte Bäume bilden das Dach; darunter Riesenpilze in Gruppen — rote und ockerfarbene ans Licht,
 *   leuchtende violette und türkise in den Schatten.
 * - Am Wegrand Farne, Farnschnecken, Moossteine, Pilzchen; der Bach liegt in einer Senke, die Wege
 *   führen auf Steinbrücken hinüber (die Figur steigt mit, `hoehe`).
 * - Das Ziel steht in einem Kreis aus Menhiren mit leuchtenden Runen.
 * - Warmes Licht fällt in Bahnen durchs Laub, blaugrüner Dunst, Glühwürmchen; ein paar Punktlichter
 *   folgen der Figur zu den leuchtenden Pilzen.
 *
 * Gibt null zurück, solange der Baukasten nicht geladen ist (dann baut welt.ts den alten Pilzwald).
 */
import * as THREE from "three";
import { PLATZ, WAND, WEG, ZELLE, type FreiEbene } from "@/lib/gebaeude/frei";
import { zufallAus } from "../stoff";
import { kit } from "./modelle";
import { aus, boden, himmel, schweben, strich, striche, tiefen, umland, type Landschaft, type Stimmung, type Stueck } from "./welt";

export const PILZWALD = "pilzwald";

const STIMMUNG: Stimmung = {
  himmelOben: 0x9fd0c8, himmelUnten: 0x7ab2bc, nebel: 0x7ab2bc, dichte: 0.026,
  sonne: 0xffdc96, sonneStaerke: 3.4, sonneVon: [-0.45, 0.72, -0.5],
  oben: 0xa8dcd4, unten: 0x55702f, umgebung: 0.95, fackel: 0, belichtung: 1.05,
};

/** Grundfläche der Modelle (Radius in m) — damit nichts ineinander wächst */
const FUSS: Record<string, number> = {
  fliegenpilz1: 2.6, fliegenpilz2: 1.6, fliegenpilz3: 2.5, lilapilz1: 2.8, lilapilz2: 1.6, lilapilz3: 2.7,
  tuerkispilz1: 2.2, tuerkispilz2: 1.5, tuerkispilz3: 2.4, ockerpilz1: 1.8, ockerpilz2: 1.7,
  uraltbaum1: 2.6, uraltbaum2: 2.6, uraltbaum3: 2.6, hohlbaum1: 2.8, baumstamm1: 1.2, baumstamm2: 1.2,
};

/** Bachbett und Hügel (m) */
const BETT = -0.8;

export function pilzwaldLandschaft(e: FreiEbene, seed: number): Landschaft | null {
  const K = kit(PILZWALD);
  if (!K) return null;
  const r = zufallAus(seed * 13 + 7);
  const g = new THREE.Group();
  const Z = ZELLE, RAND = 8;
  const { t, B } = tiefen(e, RAND, 9);
  const wasser = e.wasser;
  const istWasser = (x: number, y: number) => !!wasser && x >= 0 && y >= 0 && x < e.b && y < e.h && wasser[y * e.b + x] === 1;

  // ── Gelände: Senke für den Bach, sanfte Hügel im Wald ───────────────────
  const wTiefe = new Uint8Array(e.b * e.h);
  if (wasser) {
    // Abstand ins Wasser hinein (1 = Ufer)
    const offen: number[] = [];
    for (let i = 0; i < wasser.length; i++) if (wasser[i]) { wTiefe[i] = 9; } else offen.push(i);
    for (let k = 0; k < offen.length; k++) {
      const i = offen[k], x = i % e.b, y = (i - x) / e.b;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, j = ny * e.b + nx;
        if (nx < 0 || ny < 0 || nx >= e.b || ny >= e.h) continue;
        if (wTiefe[j] > wTiefe[i] + 1) { wTiefe[j] = wTiefe[i] + 1; offen.push(j); }
      }
    }
  }
  const welle = (x: number, y: number) => 0.5 + 0.25 * Math.sin(x * 0.37 + seed) * Math.cos(y * 0.29 - seed * 0.5) + 0.25 * Math.sin((x + y) * 0.17);
  const zellH = new Float32Array(e.b * e.h);
  for (let y = 0; y < e.h; y++) for (let x = 0; x < e.b; x++) {
    const i = y * e.b + x;
    if (wasser?.[i]) zellH[i] = wTiefe[i] <= 1 ? BETT * 0.6 : BETT;
    else if (e.art[i] === WAND) zellH[i] = 0.55 * welle(x, y) * Math.min(1, (t[(y + RAND) * B + x + RAND] - 1) / 3);
  }
  const zelleH = (x: number, y: number) => zellH[Math.max(0, Math.min(e.h - 1, y)) * e.b + Math.max(0, Math.min(e.b - 1, x))];
  const gelaende = (wx: number, wz: number) => {
    const u = wx / Z - 0.5, v = wz / Z - 0.5, x0 = Math.floor(u), y0 = Math.floor(v), fx = u - x0, fy = v - y0;
    return (zelleH(x0, y0) * (1 - fx) + zelleH(x0 + 1, y0) * fx) * (1 - fy) + (zelleH(x0, y0 + 1) * (1 - fx) + zelleH(x0 + 1, y0 + 1) * fx) * fy;
  };

  // ── Boden: gemalt ──────────────────────────────────────────────────────
  const MOOS = [0x3f5a2a, 0x4a6530, 0x384f26, 0x50692f], LAUB = [0x5e4630, 0x6b5030, 0x4f3c28];
  const LICHT = [0x6f8f35, 0x7e9e3a, 0x8aa63e, 0x67853a, 0x95ac46], ERDE = [0x9a7446, 0xae8650, 0x8a6a40, 0xb8925a];
  const BLUETEN = ["#a070e0", "#f0a040", "#ffffff", "#f2a0c0", "#ffd84a", "#7fd0f0"];
  g.add(himmel(STIMMUNG.himmelOben, STIMMUNG.himmelUnten));
  g.add(umland(e, 0x3f5a2a));
  g.add(boden(e, (ctx, px) => {
    striche(ctx, e, px, r, 6, (a, x, y) => (istWasser(x, y) ? [0x22424a, 0x2a4a52, 0x1f3a44] : a === WAND ? (r() < 0.25 ? LAUB : MOOS) : a === PLATZ ? LICHT : naheMitte(e, x, y) ? ERDE : LICHT));
    // ausgetretene Erde in der Mitte der Pfade (deckend), darauf Trittsteine
    striche(ctx, e, px, r, 5, (a, x, y) => (a === WEG && !istWasser(x, y) && naheMitte(e, x, y) ? ERDE : null), 0.9);
    for (let y = 0; y < e.h; y++) for (let x = 0; x < e.b; x++) {
      const a = e.art[y * e.b + x];
      if (a === WEG && !istWasser(x, y) && naheMitte(e, x, y) && r() < 0.35) {
        const cx = (x + 0.2 + r() * 0.6) * px, cy = (y + 0.2 + r() * 0.6) * px, w = px * (0.22 + r() * 0.14);
        strich(ctx, cx + px * 0.04, cy + px * 0.05, w, w * 0.7, r() * 3, "#5a4a32", 0.5);
        strich(ctx, cx, cy, w, w * 0.7, r() * 3, aus(["#b8b0a0", "#c6bfae", "#a9a292"], r));
        strich(ctx, cx - w * 0.3, cy - w * 0.2, w * 0.45, w * 0.3, r() * 3, "#7f9a45", 0.6);
      }
      // Blütentupfer auf den Lichtungen und am Wegrand
      if (a !== WAND && !istWasser(x, y) && r() < (a === PLATZ ? 0.8 : 0.35)) {
        for (let k = 0; k < 3; k++) {
          ctx.fillStyle = aus(BLUETEN, r);
          ctx.beginPath();
          ctx.arc((x + r()) * px, (y + r()) * px, px * (0.03 + r() * 0.04), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }, 0x4f6b2e, gelaende));

  // ── Wasser ────────────────────────────────────────────────────────────
  if (wasser) {
    const ecken: number[] = [];
    for (let y = 0; y < e.h; y++) for (let x = 0; x < e.b; x++) {
      if (!wasser[y * e.b + x]) continue;
      const x0 = (x - 0.08) * Z, x1 = (x + 1.08) * Z, z0 = (y - 0.08) * Z, z1 = (y + 1.08) * Z, h = BETT * 0.42;
      ecken.push(x0, h, z0, x0, h, z1, x1, h, z0, x1, h, z0, x0, h, z1, x1, h, z1);
    }
    const wg = new THREE.BufferGeometry();
    wg.setAttribute("position", new THREE.Float32BufferAttribute(ecken, 3));
    wg.computeVertexNormals();
    const wm = new THREE.Mesh(wg, new THREE.MeshPhongMaterial({ color: 0x2f6f86, specular: 0x9fe8f0, shininess: 90, emissive: 0x0f3a44, transparent: true, opacity: 0.86 }));
    wm.receiveShadow = true;
    g.add(wm);
  }

  // ── Modelle aufstellen ───────────────────────────────────────────────
  const platziert = new Map<string, Stueck[]>();
  const belegt: [number, number, number][] = [];
  const frei = (x: number, z: number, rad: number) => belegt.every(([bx, bz, br]) => Math.hypot(bx - x, bz - z) > (br + rad) * 0.72);
  const hoch = new THREE.Vector3(0, 1, 0);
  const lichtOrte: { p: THREE.Vector3; f: number }[] = [];
  /** ein Modell (alle seine Teile) bei (x, z), gedreht um `w`, skaliert */
  const setze = (modell: string, x: number, z: number, w: number, s = 1, y?: number) => {
    const teile = Object.keys(K).filter(k => k.startsWith(`${modell}_`));
    if (!teile.length) return false;
    const p = new THREE.Vector3(x, y ?? gelaende(x, z), z), q = new THREE.Quaternion().setFromAxisAngle(hoch, w), sk = new THREE.Vector3(s, s, s);
    for (const k of teile) {
      let liste = platziert.get(k);
      if (!liste) platziert.set(k, liste = []);
      liste.push({ p, q, s: sk });
    }
    if (FUSS[modell]) belegt.push([x, z, FUSS[modell] * s]);
    if (/^(lilapilz|tuerkispilz)/.test(modell) && s > 0.8) lichtOrte.push({ p: new THREE.Vector3(x, 2.4, z), f: modell.startsWith("lila") ? 0x9a7bff : 0x6fe8f0 });
    return true;
  };
  const tiefeBei = (x: number, y: number) => t[(y + RAND) * B + x + RAND];
  const zufallsDrehung = () => r() * Math.PI * 2;

  // Hohlbäume mit Tür: je ein, zwei Lichtungen einer am Rand, die Tür zur Mitte
  const lichtungen = [...e.raeume.map(p => [p.x, p.y] as [number, number]), e.start];
  for (const [lx, ly] of lichtungen.filter(() => r() < 0.4).slice(0, 2)) {
    for (let k = 0; k < 12; k++) {
      const a = r() * Math.PI * 2, d = 7.5 + r() * 1.5;
      const x = Math.round(lx + Math.cos(a) * d), y = Math.round(ly + Math.sin(a) * d);
      if (x < 0 || y < 0 || x >= e.b || y >= e.h || tiefeBei(x, y) < 2 || istWasser(x, y)) continue;
      const wx = (x + 0.5) * Z, wz = (y + 0.5) * Z, mx = (lx + 0.5) * Z, mz = (ly + 0.5) * Z;
      if (!frei(wx, wz, FUSS.hohlbaum1)) continue;
      setze("hohlbaum1", wx, wz, Math.atan2(mx - wx, mz - wz));
      lichtOrte.push({ p: new THREE.Vector3(wx + (mx - wx) * 0.25, 1.6, wz + (mz - wz) * 0.25), f: 0xffb050 });
      break;
    }
  }

  // Menhirkreis ums Ziel: am Rand der Lichtung, Lücken wo Pfade hineinführen
  {
    const [zx, zy] = e.ziel, mx = (zx + 0.5) * Z, mz = (zy + 0.5) * Z, n = 9;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + 0.2, d = 6.6;
      const x = mx + Math.cos(a) * d, z = mz + Math.sin(a) * d, fx = Math.floor(x / Z), fy = Math.floor(z / Z);
      // nicht auf einen Pfad, der zur Lichtung führt
      let aufPfad = false;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (e.art[(fy + dy) * e.b + fx + dx] === WEG) aufPfad = true;
      if (aufPfad) continue;
      setze(`menhir${1 + (k % 3)}`, x, z, Math.atan2(mx - x, mz - z), 0.9 + r() * 0.25, 0);
      if (k % 3 === 0) lichtOrte.push({ p: new THREE.Vector3(x, 1.6, z), f: 0x6fe8f0 });
    }
  }
  // alte Säulen am Rand mancher Lichtungen
  for (const p of e.raeume) {
    if (r() > 0.45) continue;
    const a = r() * Math.PI * 2, d = 6.4, x = (p.x + 0.5) * Z + Math.cos(a) * d, z = (p.y + 0.5) * Z + Math.sin(a) * d;
    if (e.art[Math.floor(z / Z) * e.b + Math.floor(x / Z)] === WEG) continue;
    setze(r() < 0.5 ? "saeule1" : "saeule2", x, z, zufallsDrehung(), 1, 0);
    if (r() < 0.5) setze("kristallsockel1", x + Math.cos(a + 1.2) * 1.8, z + Math.sin(a + 1.2) * 1.8, zufallsDrehung(), 0.9, 0);
  }

  // Bäume zuerst (sie brauchen den meisten Platz), dann Riesenpilze, dann Kleinkram
  const zellen: [number, number, number][] = [];
  for (let Y = 0; Y < B; Y++) for (let X = 0; X < B; X++) zellen.push([X - RAND, Y - RAND, t[Y * B + X]]);
  for (const [x, y, d] of zellen) {
    if (d < 3 || istWasser(x, y) || r() > 0.32) continue;
    const wx = (x + 0.2 + r() * 0.6) * Z, wz = (y + 0.2 + r() * 0.6) * Z, s = 0.8 + r() * 0.35;
    if (frei(wx, wz, FUSS.uraltbaum1 * s * 1.6)) setze(`uraltbaum${1 + Math.floor(r() * 3)}`, wx, wz, zufallsDrehung(), s);
  }
  const PILZ_LICHT = ["fliegenpilz", "fliegenpilz", "ockerpilz", "lilapilz", "tuerkispilz"];
  const PILZ_SCHATTEN = ["lilapilz", "tuerkispilz", "lilapilz", "tuerkispilz", "fliegenpilz", "ockerpilz"];
  for (const [x, y, d] of zellen) {
    if (d < 1 || d > 6 || istWasser(x, y)) continue;
    const chance = d === 1 ? 0.07 : d === 2 ? 0.14 : 0.09;
    if (r() > chance) continue;
    const art = aus(d <= 2 ? PILZ_LICHT : PILZ_SCHATTEN, r);
    // nah am Weg Gruppen und große (Hüte über der Kamera), mittlere erst ab dem zweiten Feld
    const fassung = d === 1 ? (r() < 0.6 ? 3 : 1) : 1 + Math.floor(r() * 3);
    const modell = art === "ockerpilz" ? `ockerpilz${Math.min(2, fassung)}` : `${art}${fassung}`;
    const wx = (x + 0.2 + r() * 0.6) * Z, wz = (y + 0.2 + r() * 0.6) * Z, s = 0.85 + r() * 0.3;
    if (frei(wx, wz, (FUSS[modell] ?? 2) * s)) setze(modell, wx, wz, zufallsDrehung(), s);
  }
  for (const [x, y, d] of zellen) {
    if (d < 2 || d > 5 || istWasser(x, y) || r() > 0.012) continue;
    const wx = (x + 0.5) * Z, wz = (y + 0.5) * Z;
    if (frei(wx, wz, 3)) setze(`baumstamm${1 + Math.floor(r() * 2)}`, wx, wz, zufallsDrehung(), 0.9 + r() * 0.2);
  }
  // Kleinkram: am Weg dicht, dahinter lichter
  for (const [x, y, d] of zellen) {
    if (istWasser(x, y)) continue;
    const wx = () => (x + r()) * Z, wz = () => (y + r()) * Z;
    if (d === 0) {
      // auf Wegen nur am Rand und selten: Eicheln, Pilzchen
      if (e.art[y * e.b + x] === WEG && !naheMitte(e, x, y) && r() < 0.05) setze("eicheln1", wx(), wz(), zufallsDrehung(), 0.9 + r() * 0.4);
      continue;
    }
    if (d > 4) continue;
    const dicht = d === 1 ? 1 : d === 2 ? 0.6 : 0.3;
    if (r() < 0.3 * dicht) setze(`farn${1 + Math.floor(r() * 2)}`, wx(), wz(), zufallsDrehung(), 0.8 + r() * 0.5);
    if (r() < 0.1 * dicht) setze(`farnschnecke${1 + Math.floor(r() * 2)}`, wx(), wz(), zufallsDrehung(), 0.8 + r() * 0.4);
    if (r() < 0.12 * dicht) setze(`pilzchen${1 + Math.floor(r() * 3)}`, wx(), wz(), zufallsDrehung(), 0.8 + r() * 0.5);
    if (r() < 0.07 * dicht) setze(`moosstein${1 + Math.floor(r() * 3)}`, wx(), wz(), zufallsDrehung(), 0.7 + r() * 0.6);
  }
  // Ufer: Steine und Farne am Bach
  if (wasser) for (let y = 0; y < e.h; y++) for (let x = 0; x < e.b; x++) {
    if (wasser[y * e.b + x] || e.art[y * e.b + x] !== WAND || wTiefe[y * e.b + x] !== 1 || r() > 0.3) continue;
    setze(r() < 0.6 ? `moosstein${1 + Math.floor(r() * 3)}` : `farn${1 + Math.floor(r() * 2)}`, (x + r()) * Z, (y + r()) * Z, zufallsDrehung(), 0.7 + r() * 0.5);
  }
  // Brücken: Längsachse (Modell x) entlang des Pfads
  const bruecken = (e.bruecken ?? []).map(b => ({ x: b.x * Z, z: b.y * Z, w: b.winkel }));
  for (const b of bruecken) setze("steinbruecke1", b.x, b.z, -b.w, 1, BETT * 0.42 - 0.1);

  // je Teil eine InstancedMesh; leuchtende Teile unbeleuchtet in ihrer Farbe
  const lit = new THREE.MeshLambertMaterial({ vertexColors: true });
  const blatt = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const glut = new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(1.7, 1.7, 1.7) });
  for (const [k, liste] of platziert) {
    const teil = K[k];
    const gross = /^(uraltbaum|hohlbaum|fliegenpilz|lilapilz|tuerkispilz|ockerpilz|steinbruecke|menhir|saeule)/.test(k);
    const m = (n: THREE.Material) => {
      const im = new THREE.InstancedMesh(teil.geo, n, liste.length);
      const mx = new THREE.Matrix4();
      liste.forEach((s, i) => { im.setMatrixAt(i, mx.compose(s.p, s.q!, s.s)); });
      im.castShadow = gross && !teil.glut && !k.endsWith("_flechten");
      im.receiveShadow = !teil.glut;
      im.frustumCulled = false;
      return im;
    };
    g.add(m(teil.glut ? glut : /_wedel|_lamellen|_flechten/.test(k) ? blatt : lit));
  }

  // ── Licht in Bahnen durchs Laub ───────────────────────────────────────
  const sonne = new THREE.Vector3(...STIMMUNG.sonneVon).normalize();
  const zurSonne = new THREE.Quaternion().setFromUnitVectors(hoch, sonne);
  const bahnen: Stueck[] = [];
  for (let y = 0; y < e.h; y++) for (let x = 0; x < e.b; x++) {
    if (e.art[y * e.b + x] === WAND || r() > 0.035) continue;
    const lang = 16 + r() * 8, breit = 0.8 + r() * 2.2;
    for (const d2 of [0, Math.PI / 2]) {
      bahnen.push({ p: new THREE.Vector3((x + r()) * Z, 0, (y + r()) * Z), s: new THREE.Vector3(breit, lang, 1), q: zurSonne.clone().multiply(new THREE.Quaternion().setFromAxisAngle(hoch, d2 + r())) });
    }
  }
  if (bahnen.length) {
    const bahn = new THREE.PlaneGeometry(1, 1);
    bahn.translate(0, 0.5, 0);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 0.09, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    const verlauf = bahnTextur();
    if (verlauf) mat.alphaMap = verlauf;
    const im = new THREE.InstancedMesh(bahn, mat, bahnen.length);
    const mx = new THREE.Matrix4();
    bahnen.forEach((s, i) => im.setMatrixAt(i, mx.compose(s.p, s.q!, s.s)));
    im.frustumCulled = false;
    g.add(im);
  }

  // Glühwürmchen und Funken
  const luft = schweben(e, r, { farben: [0xffd84a, 0xffe9a0, 0xffc040, 0x9ff0ff], anzahl: 420, groesse: 0.08, fall: -0.06, hoehe: 6, leuchtet: true });
  g.add(luft.punkte);

  // ein paar Punktlichter wandern zu den leuchtenden Dingen in der Nähe der Figur
  const LICHTER = 4;
  const lampen = lichtOrte.length ? Array.from({ length: LICHTER }, () => { const l = new THREE.PointLight(0x6fe8f0, 0, 11, 1.6); g.add(l); return l; }) : [];

  const hoeheBei = (x: number, z: number) => {
    let h = 0;
    for (const b of bruecken) {
      const dx = x - b.x, dz = z - b.z, c = Math.cos(b.w), s = Math.sin(b.w);
      const laengs = dx * c + dz * s, quer = -dx * s + dz * c;
      if (Math.abs(quer) < 2.4 && Math.abs(laengs) < 4.9) h = Math.max(h, 0.12 + 1.43 * (1 - (laengs / 4.9) ** 2));
    }
    return h;
  };

  return {
    gruppe: g, wandHoehe: 0, stimmung: STIMMUNG, takt: luft.takt, hoehe: bruecken.length ? hoeheBei : undefined,
    lichter: lampen.length ? (x, z, zeit) => {
      const nah = lichtOrte.map(o => ({ o, d: (o.p.x - x) ** 2 + (o.p.z - z) ** 2 })).sort((a, b) => a.d - b.d);
      lampen.forEach((l, i) => {
        const n = nah[i];
        if (!n || n.d > 20 * 20) { l.intensity = 0; return; }
        l.position.copy(n.o.p);
        l.color.setHex(n.o.f);
        l.intensity = 7 + Math.sin(zeit * 1.3 + n.o.p.x) * 1.2;
      });
    } : undefined,
  };
}

/** Wegfeld mit freien Nachbarn ringsum: Mitte des Pfads (dort ist die Erde ausgetreten) */
function naheMitte(e: FreiEbene, x: number, y: number): boolean {
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const nx = x + dx, ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= e.b || ny >= e.h || e.art[ny * e.b + nx] === WAND || e.wasser?.[ny * e.b + nx]) return false;
  }
  return true;
}

/** Lichtbahn: unten weich einsetzend, oben auslaufend, an den Seiten weich */
let bahnBild: THREE.Texture | null | undefined;
function bahnTextur(): THREE.Texture | null {
  if (bahnBild !== undefined) return bahnBild;
  if (typeof document === "undefined") return (bahnBild = null);
  const c = document.createElement("canvas");
  c.width = 64; c.height = 256;
  const ctx = c.getContext("2d");
  if (!ctx) return (bahnBild = null);
  const senk = ctx.createLinearGradient(0, 256, 0, 0);
  senk.addColorStop(0, "#000"); senk.addColorStop(0.12, "#fff"); senk.addColorStop(0.6, "#bbb"); senk.addColorStop(1, "#000");
  ctx.fillStyle = senk;
  ctx.fillRect(0, 0, 64, 256);
  const quer = ctx.createLinearGradient(0, 0, 64, 0);
  quer.addColorStop(0, "rgba(0,0,0,1)"); quer.addColorStop(0.5, "rgba(0,0,0,0)"); quer.addColorStop(1, "rgba(0,0,0,1)");
  ctx.fillStyle = quer;
  ctx.fillRect(0, 0, 64, 256);
  bahnBild = new THREE.CanvasTexture(c);
  bahnBild.userData.geteilt = true;
  return bahnBild;
}
