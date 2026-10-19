/**
 * Zeichnet das Steilküsten-Zellmodell: Gestein als Pixelbild mit Licht und
 * Schatten (Überhänge werfen Schatten, die Hohlkehle wird zur dunklen
 * Höhle), Wasser mit laufenden Wellen bis in die Kehle, Gischt an der Wand,
 * stürzende und rutschende Massen, Bäume, Regenrinnsale und Quellaustritte.
 *
 * Maßstab 1:1 (keine Überhöhung) — so sieht ein Kliff wirklich aus.
 */
import {
  MAT, MATERIAL, geometrie, kliffKante, xVon, zVon, zeileVon,
  type Bewegung, type Kliff, type KWellen,
} from "@/lib/kueste/kliff";
import type { Wetter } from "@/lib/kueste/profil";
import { X, Z, himmel, schilder, trefferZeigen, type Bild, type QuizTreffer } from "./zeichnen";
import type { Begriff } from "@/lib/kueste/begriffe";

interface Teilchen { x: number; z: number; vx: number; vz: number; t: number; r: number }
/** Schaum auf der Wasseroberfläche: läuft mit der gebrochenen Welle zum Ufer */
interface Schaum { x: number; t: number; dauer: number }

interface Speicher {
  version: number;
  sat: number;
  bild: HTMLCanvasElement | null;
  massen: Map<number, HTMLCanvasElement>;
  gischt: Teilchen[];
  schaum: Schaum[];
}

const speicher = new WeakMap<Kliff, Speicher>();

function holen(k: Kliff): Speicher {
  let s = speicher.get(k);
  if (!s) { s = { version: -1, sat: -1, bild: null, massen: new Map(), gischt: [], schaum: [] }; speicher.set(k, s); }
  return s;
}

function hash(a: number, b: number) {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Farbe einer Zelle ohne Licht */
function grundfarbe(m: number, herk: number, c: number, r: number): [number, number, number] {
  const n = hash(c, r);
  if (m === MAT.SCHUTT) {
    const [a, b, d] = MATERIAL[herk || MAT.KREIDE].farbe;
    const v = (n - 0.5) * 36 - 6;
    if (n < 0.08) return [a * 0.7, b * 0.7, d * 0.7];
    return [a + v, b + v, d + v];
  }
  if (m === MAT.BLOCK) {
    const feuer = herk === MAT.FEUER || herk === MAT.KREIDE;
    const v = (n - 0.5) * 30;
    return feuer ? [58 + v, 60 + v, 70 + v] : [118 + v, 114 + v, 108 + v];
  }
  if (m === MAT.DECKWERK) {
    const v = (((c >> 2) + (r >> 2)) % 2 ? 10 : -10) + (n - 0.5) * 12;
    return [130 + v, 132 + v, 138 + v];
  }
  const [a, b, d] = MATERIAL[m].farbe;
  let v = (n - 0.5) * 10;
  if (m === MAT.FEUER && n < 0.16) return [64, 66, 74];
  if (m === MAT.KREIDE && r % 7 === 0) v -= 5;
  if ((m === MAT.MERGEL || m === MAT.LEHM) && n < 0.05) return n < 0.025 ? [205, 196, 178] : [96, 90, 84];
  if (m === MAT.SAND) v += Math.sin(r * 0.9) * 4;
  if (m === MAT.BODEN && n < 0.2) v -= 18;
  return [a + v, b + v, d + v];
}

/** Das Gestein als Bild (ein Pixel je Zelle), nur neu, wenn sich etwas geändert hat */
function gesteinBild(k: Kliff): HTMLCanvasElement {
  const s = holen(k);
  if (s.bild && s.version === k.version && Math.abs(s.sat - k.saettigung) < 0.05) return s.bild;
  const { nx, nz, mat, herk } = k;
  const cv = s.bild ?? document.createElement("canvas");
  cv.width = nx; cv.height = nz;
  const ctx = cv.getContext("2d")!;
  const img = ctx.createImageData(nx, nz);
  const d = img.data;
  const g = geometrie(k);
  const nass = k.saettigung > 0.4 ? (k.saettigung - 0.4) / 0.6 : 0;
  for (let c = 0; c < nx; c++) {
    let decke = -1; // Zeile der nächsten festen Zelle darüber (Überhang)
    for (let r = nz - 1; r >= 0; r--) {
      const i = r * nx + c;
      const m = mat[i];
      const p = ((nz - 1 - r) * nx + c) * 4;
      if (m === MAT.LUFT) {
        // Schatten unter Überhängen: je näher an der Decke, desto dunkler
        if (decke >= 0 && r < g.top[c]) {
          const abstand = (decke - r) * k.dx;
          const a = Math.max(0, 0.55 - abstand * 0.12);
          if (a > 0) { d[p] = 20; d[p + 1] = 18; d[p + 2] = 16; d[p + 3] = Math.round(a * 255); }
        }
        continue;
      }
      decke = r;
      let [R, G, B] = grundfarbe(m, herk[i], c, r);
      const oben = r < nz - 1 ? mat[i + nx] : MAT.LUFT;
      const unten = r > 0 ? mat[i - nx] : 1;
      const links = c > 0 ? mat[i - 1] : 1;
      let licht = 0;
      if (oben === MAT.LUFT) licht += 16;
      if (unten === MAT.LUFT) licht -= 45;
      if (links === MAT.LUFT) licht -= 8;
      if (k.gestoert[i]) licht -= 10;
      licht -= Math.min(1, k.schaden[i]) * 30;
      // Nasse Wand über dem Ton (Quellhorizont)
      if (nass > 0 && links === MAT.LUFT && m !== MAT.TON) {
        for (let q = 1; q <= 4 && r - q >= 0; q++) if (mat[i - q * nx] === MAT.TON) { licht -= 40 * nass; break; }
      }
      R = Math.max(0, Math.min(255, R + licht));
      G = Math.max(0, Math.min(255, G + licht));
      B = Math.max(0, Math.min(255, B + licht * 0.9));
      d[p] = R; d[p + 1] = G; d[p + 2] = B; d[p + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  s.bild = cv; s.version = k.version; s.sat = k.saettigung;
  return cv;
}

function massenBild(k: Kliff, b: Bewegung): HTMLCanvasElement {
  const s = holen(k);
  let cv = s.massen.get(b.id);
  if (cv) return cv;
  const { c0, c1, r0, r1 } = b.bbox;
  const w = c1 - c0 + 1, h = r1 - r0 + 1;
  cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const ctx = cv.getContext("2d")!;
  const img = ctx.createImageData(w, h);
  for (let j = 0; j < b.idx.length; j++) {
    const i = b.idx[j];
    const c = i % k.nx, r = (i - c) / k.nx;
    const [R, G, B] = grundfarbe(b.mMat[j], b.mHerk[j], c, r);
    const p = ((r1 - r) * w + (c - c0)) * 4;
    img.data[p] = R; img.data[p + 1] = G; img.data[p + 2] = B; img.data[p + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  s.massen.set(b.id, cv);
  return cv;
}

export interface KliffSzene {
  k: Kliff;
  wetter: Wetter;
  W: number;
  H0: number;
  wl: KWellen;
  t: number;
  dt: number;
  begriffe: Begriff[] | null;
  markiert: string | null;
  quizTreffer: QuizTreffer | null;
}

/** Wasseroberfläche je Spalte und was die Welle dort gerade tut */
interface Wasserbild {
  ober: number[];
  /** Phase der Welle je Spalte (rad) und Brechgrad 0…1 (1 = gebrochen) */
  phase: number[];
  brech: number[];
  tiefe: number[];
  omega: number;
  pfad: () => void;
}

/**
 * Form einer Welle: im tiefen Wasser fast ein Sinus, zum Ufer hin spitze
 * Kämme und flache, lange Täler (wie echte Flachwasserwellen).
 * Liefert die Auslenkung in Anteilen der Wellenhöhe (Kamm bis Tal = 1).
 */
function wellenForm(theta: number, brech: number) {
  const n = 1 + 3 * brech;
  const e = ((1 + Math.sin(theta)) / 2) ** n;
  return e - Math.min(0.5, 1 / Math.sqrt(Math.PI * n));
}

function wasser(b: Bild, s: KliffSzene): Wasserbild {
  const { ctx } = b;
  const { k, W, wl } = s;
  const g = geometrie(k);
  const T = 5 + Math.min(5, s.H0);
  const omega = (2 * Math.PI) / T;
  const rW = Math.max(0, Math.min(k.nz - 1, zeileVon(k, W)));
  const ufer = Math.min(k.nx, wl.ufer);
  // Oberfläche mit laufenden Wellen
  const ober: number[] = [], phasen: number[] = [], brech: number[] = [], tiefen: number[] = [];
  let phase = 0;
  for (let c = 0; c < ufer; c++) {
    const tiefe = Math.max(0.2, W - wl.boden[c]);
    const lambda = Math.min(1.56 * T * T, T * Math.sqrt(9.81 * tiefe));
    phase += (2 * Math.PI * k.dx) / lambda;
    const th = phase - omega * s.t;
    const br = Math.min(1, wl.H[c] / (0.78 * tiefe));
    phasen[c] = th; brech[c] = br; tiefen[c] = tiefe;
    ober[c] = W + wl.H[c] * wellenForm(th, br);
  }
  // Seewärts des Modellgebiets läuft das Meer im Bild weiter
  const links = Math.min(0, b.a.x0);
  const pfad = () => {
    ctx.beginPath();
    ctx.moveTo(X(b, links), Z(b, k.z0));
    ctx.lineTo(X(b, 0), Z(b, k.z0));
    for (let r = 0; r <= rW; r++) {
      const c = g.front[r];
      ctx.lineTo(X(b, c * k.dx), Z(b, zVon(k, r) - k.dx / 2));
      ctx.lineTo(X(b, c * k.dx), Z(b, Math.min(W, zVon(k, r) + k.dx / 2)));
    }
    for (let c = ufer - 1; c >= 0; c--) ctx.lineTo(X(b, xVon(k, c)), Z(b, ober[c] ?? W));
    ctx.lineTo(X(b, links), Z(b, ober[0] ?? W));
    ctx.closePath();
  };
  pfad();
  const gr = ctx.createLinearGradient(0, Z(b, W), 0, Z(b, k.z0));
  gr.addColorStop(0, "rgba(64,146,196,0.92)");
  gr.addColorStop(1, "rgba(16,58,108,0.96)");
  ctx.fillStyle = gr;
  ctx.fill();
  return { ober, phase: phasen, brech, tiefe: tiefen, omega, pfad };
}

/** Schaumgewicht an einer Stelle der Welle: am Kamm und vorn hinab (Walze) */
function walze(theta: number) {
  const m = ((theta % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  return Math.exp(-(((m - Math.PI / 2 - 0.35) / 0.55) ** 2));
}

function oberflaeche(b: Bild, s: KliffSzene, wb: Wasserbild) {
  const { ctx } = b;
  const { k, W, wl } = s;
  const { ober, omega } = wb;
  const ufer = Math.min(k.nx, wl.ufer);
  const px = (X(b, 1) - X(b, 0));
  const sp = holen(k);
  const Hs = wl.amUfer;
  // Trübe Brandungszone: die gebrochenen Wellen wirbeln Sand und Schlamm auf
  if (Hs > 0.2 && ufer > 0) {
    const c0 = Math.max(0, wl.brecher >= 0 ? wl.brecher : ufer - Math.round(15 / k.dx));
    ctx.save();
    wb.pfad();
    ctx.clip();
    const gr = ctx.createLinearGradient(X(b, c0 * k.dx), 0, X(b, ufer * k.dx), 0);
    gr.addColorStop(0, "rgba(176,150,104,0)");
    gr.addColorStop(1, `rgba(176,150,104,${Math.min(0.45, 0.25 * Hs)})`);
    ctx.fillStyle = gr;
    ctx.fillRect(X(b, c0 * k.dx), Z(b, W + Hs + 1), X(b, (ufer + 1) * k.dx) - X(b, c0 * k.dx), b.h);
    ctx.restore();
  }
  ctx.beginPath();
  ctx.moveTo(X(b, Math.min(0, b.a.x0)), Z(b, ober[0] ?? W));
  for (let c = 0; c < ufer; c++) ctx.lineTo(X(b, xVon(k, c)), Z(b, ober[c]));
  ctx.strokeStyle = "rgba(170,215,240,0.95)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Weißwasser: die Walze auf dem Kamm gebrochener Wellen
  for (let c = 0; c < ufer; c++) {
    const br = wb.brech[c];
    if (br < 0.75 || wl.H[c] < 0.08) continue;
    const st = (walze(wb.phase[c]) * (br - 0.6)) / 0.4;
    if (st < 0.08) continue;
    // ein schäumender Streifen auf dem Kamm, darüber zerstiebende Flocken
    const h = Math.max(1.5, px * 0.35 * wl.H[c] * st);
    const x = X(b, c * k.dx), y = Z(b, ober[c]);
    ctx.fillStyle = `rgba(255,255,255,${Math.min(0.9, 0.2 + st * 0.7)})`;
    ctx.fillRect(x, y - h * 0.3, X(b, (c + 1) * k.dx) - x + 0.5, h);
    if (Math.random() < st * 0.5) {
      const d = Math.max(1, Math.min(3, px * 0.04));
      ctx.fillRect(x + Math.random() * px * k.dx, y - h * 0.3 - Math.random() * px * 0.3 * wl.H[c], d, d);
    }
    // hinter der Walze bleibt Schaum zurück
    if (sp.schaum.length < 500 && Math.random() < st * s.dt * 6) sp.schaum.push({ x: xVon(k, c), t: 0, dauer: 2 + Math.random() * 3 });
  }
  // Schaumflocken treiben mit dem Schwall zum Ufer und zerfallen
  const xUfer = ufer * k.dx;
  const spalte = (x: number) => Math.min(ufer - 1, Math.max(0, Math.floor(x / k.dx)));
  sp.schaum = sp.schaum.filter(f => {
    const schub = f.t < 1.2 ? 0.8 : 0.15;
    f.x = Math.min(xUfer - 0.05, f.x + schub * Math.sqrt(9.81 * (wb.tiefe[spalte(f.x)] ?? 0.2)) * s.dt);
    f.t += s.dt;
    return f.t < f.dauer && ufer > 0;
  });
  const rs = Math.max(0.8, Math.min(3, px * 0.06));
  for (const f of sp.schaum) {
    ctx.fillStyle = `rgba(250,252,255,${0.8 * (1 - f.t / f.dauer)})`;
    ctx.fillRect(X(b, f.x) - rs, Z(b, ober[spalte(f.x)] ?? W) - rs * 0.5, 2 * rs, rs);
  }
  // Auflauf: nach jeder Welle schießt ein Wasserfilm den Hang bzw. die Wand hinauf
  if (ufer > 0 && ufer < k.nx && Hs > 0.1) {
    const g = geometrie(k);
    const oben = W + 1.4 * Hs * Math.max(0, Math.sin(wb.phase[ufer - 1])) ** 1.5;
    const film = Math.max(1.5, Math.min(px * 0.15, 6));
    ctx.fillStyle = "rgba(64,146,196,0.92)";
    for (let r = Math.max(0, zeileVon(k, W)) + 1; r < Math.min(k.nz, zeileVon(k, oben) + 1); r++) {
      const c = g.front[r];
      if (c >= k.nx) continue;
      const zo = Math.min(oben, zVon(k, r) + k.dx / 2), zu = zVon(k, r) - k.dx / 2;
      ctx.fillRect(X(b, c * k.dx) - film, Z(b, zo), film + 1, Z(b, zu) - Z(b, zo) + 0.5);
    }
  }
  // Gischt: am Kliff schlägt jede Welle hoch
  if (ufer < k.nx && Hs > 0.15) {
    const puls = Math.max(0, Math.sin(omega * s.t));
    const n = Math.round(puls * Hs * 60 * s.dt * 10);
    const x0 = ufer * k.dx;
    for (let i = 0; i < n; i++) {
      sp.gischt.push({
        x: x0 - Math.random() * 0.4, z: W + Math.random() * Hs * 0.5,
        vx: -(0.5 + Math.random() * 2.5), vz: (1.5 + Math.random() * 3) * Math.sqrt(Hs * 2), t: 0, r: 0.5 + Math.random(),
      });
    }
  }
  for (const b2 of k.bewegungen) {
    if (b2.art !== "fall" || b2.vz > -4) continue;
    // stürzende Masse klatscht ins Wasser
    if (b2.pivZ + b2.tz < W + 3 && b2.pivZ + b2.tz > W - 2) {
      for (let i = 0; i < 20; i++) sp.gischt.push({ x: b2.pivX + b2.tx + (Math.random() - 0.5) * 6, z: W, vx: (Math.random() - 0.7) * 6, vz: 4 + Math.random() * 8, t: 0, r: 1 + Math.random() * 1.5 });
    }
  }
  const g = 9.81;
  sp.gischt = sp.gischt.filter(p => {
    p.t += s.dt; p.vz -= g * s.dt; p.x += p.vx * s.dt; p.z += p.vz * s.dt;
    return p.t < 1.6 && p.z > W - 0.5;
  }).slice(-900);
  // Tropfen in echter Größe (Zentimeter), aber immer mindestens ein Pixel
  for (const p of sp.gischt) {
    ctx.fillStyle = `rgba(255,255,255,${0.85 * (1 - p.t / 1.6)})`;
    ctx.beginPath(); ctx.arc(X(b, p.x), Z(b, p.z), Math.max(0.9, Math.min(4, p.r * px * 0.05)), 0, Math.PI * 2); ctx.fill();
  }
}

/**
 * Ein Baum. `tot` = Jahre seit dem Absterben (undefined: lebt):
 * erst braunes Laub, dann kahl, dann ein grauer Stamm, der zerfällt und verblasst.
 */
function baum(ctx: CanvasRenderingContext2D, x: number, y: number, px: number, winkel: number, groesse: number, art: string, tot?: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-winkel);
  const phase = tot === undefined ? "lebt" : tot < 0.3 ? "braun" : tot < 1.5 ? "kahl" : "morsch";
  const rest = phase === "morsch" ? Math.max(0.25, 1 - (tot! - 1.5) / 2.8) : 1;
  ctx.globalAlpha = phase === "morsch" ? Math.max(0.25, rest) : 1;
  if (art === "halm") {
    ctx.strokeStyle = phase === "lebt" ? "#7c9a3c" : phase === "braun" ? "#a08a4a" : "#9a917e"; ctx.lineWidth = Math.max(1, px * 0.08);
    for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(k * px * 0.25, -px * (0.8 + Math.abs(k) * 0.1) * groesse * rest); ctx.stroke(); }
  } else if (art === "busch") {
    if (phase === "lebt" || phase === "braun") {
      ctx.fillStyle = phase === "lebt" ? "#4f7f3a" : "#8b6b3a";
      ctx.beginPath(); ctx.ellipse(0, -px * 1.1 * groesse, px * 1.6 * groesse, px * 1.2 * groesse, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = phase === "lebt" ? "#65984a" : "#a27d44";
      ctx.beginPath(); ctx.ellipse(-px * 0.5, -px * 1.5 * groesse, px * 0.9 * groesse, px * 0.7 * groesse, 0, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.strokeStyle = "#6f655a"; ctx.lineWidth = Math.max(1, px * 0.12);
      for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(k * px * 0.6, -px * 1.8 * groesse * rest); ctx.stroke(); }
    }
  } else {
    const h = px * 9 * groesse * rest;
    ctx.strokeStyle = phase === "morsch" ? "#8c877f" : phase === "kahl" ? "#6b5d4c" : "#5b4630";
    ctx.lineWidth = Math.max(1.5, px * 0.5 * groesse);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -h); ctx.stroke();
    if (phase === "lebt" || phase === "braun") {
      ctx.fillStyle = phase === "lebt" ? "#3f6f33" : "#8b6b3a";
      ctx.beginPath(); ctx.ellipse(0, -h * 0.8, px * 3 * groesse, h * 0.36, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = phase === "lebt" ? "#5a8f45" : "#a88348";
      ctx.beginPath(); ctx.ellipse(-px * 0.9 * groesse, -h * 0.9, px * 1.8 * groesse, h * 0.22, 0, 0, Math.PI * 2); ctx.fill();
    } else if (phase === "kahl" || rest > 0.6) {
      // kahle Äste
      ctx.lineWidth = Math.max(1, px * 0.18 * groesse);
      for (const [a, l, s] of [[0.5, 0.35, 0.55], [-0.6, 0.3, 0.65], [0.4, 0.25, 0.8], [-0.35, 0.22, 0.88]] as const) {
        ctx.beginPath(); ctx.moveTo(0, -h * s); ctx.lineTo(Math.sin(a) * h * l, -h * s - Math.cos(a) * h * l); ctx.stroke();
      }
    }
  }
  ctx.restore();
}

function objekte(b: Bild, s: KliffSzene) {
  const { ctx } = b;
  const { k } = s;
  const px = X(b, 1) - X(b, 0);
  for (const o of k.objekte) {
    if (o.zerstoert) continue;
    const x = X(b, xVon(k, o.c)), y = Z(b, zVon(k, o.r) + k.dx / 2);
    if (o.art === "aussicht") {
      ctx.fillStyle = "#6b4a2b";
      ctx.fillRect(x - px * 2.5, y - px * 1.2, px * 5, px * 0.35);
      ctx.strokeStyle = "#6b4a2b"; ctx.lineWidth = Math.max(1, px * 0.15);
      ctx.beginPath(); ctx.moveTo(x - px * 2.5, y - px * 1.2); ctx.lineTo(x - px * 2.5, y - px * 2.3); ctx.lineTo(x + px * 2.5, y - px * 2.3); ctx.lineTo(x + px * 2.5, y - px * 1.2); ctx.stroke();
      continue;
    }
    const zeichen = o.art === "haus" ? "🏠" : o.art === "bank" ? "🪑" : o.art === "leuchtturm" ? "🗼" : k.schutz.gesperrt ? "🚧" : "🚶";
    ctx.font = `${Math.max(14, Math.min(40, px * (o.art === "haus" ? 5 : 2.2)))}px system-ui, "Segoe UI Emoji", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(zeichen, x, y);
  }
}

function regen(b: Bild, s: KliffSzene) {
  const { ctx } = b;
  const { k } = s;
  const g = geometrie(k);
  const rW = Math.max(0, zeileVon(k, s.W + 1));
  // Rinnsale laufen die Wand hinab
  if (s.wetter.regen) {
    ctx.strokeStyle = "rgba(120,170,220,0.6)";
    ctx.lineWidth = 1.2;
    ctx.setLineDash([6, 10]);
    ctx.lineDashOffset = -s.t * 40;
    for (let n = 0; n < 6; n++) {
      const start = rW + Math.floor(((n * 0.37 + 0.1) % 1) * (g.top[k.nx - 1] - rW));
      ctx.beginPath();
      for (let r = start; r >= rW; r -= 2) {
        const c = g.front[r];
        if (c >= k.nx) break;
        const p = [X(b, c * k.dx) - 1, Z(b, zVon(k, r))] as const;
        if (r === start) ctx.moveTo(...p); else ctx.lineTo(...p);
      }
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }
  // Quellhorizont: Wasser tropft über dem Ton aus der Wand
  if (k.saettigung > 0.45) {
    ctx.fillStyle = "rgba(110,160,210,0.8)";
    for (let r = rW; r < k.nz - 2; r++) {
      const c = g.front[r];
      if (c >= k.nx || c === 0) continue;
      if (k.mat[(r - 1) * k.nx + c] !== MAT.TON) continue;
      const fall = ((s.t * 1.3 + r * 0.17) % 1);
      ctx.beginPath(); ctx.arc(X(b, c * k.dx) - 2, Z(b, zVon(k, r) - fall * 3), 1.8, 0, Math.PI * 2); ctx.fill();
    }
  }
}

function bewegungen(b: Bild, s: KliffSzene) {
  const { ctx } = b;
  const { k } = s;
  const px = X(b, 1) - X(b, 0);
  for (const m of k.bewegungen) {
    const bild = massenBild(k, m);
    const { c0, r1 } = m.bbox;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(X(b, m.pivX + m.tx), Z(b, m.pivZ + m.tz));
    ctx.rotate(-m.theta);
    const ox = (xVon(k, c0) - k.dx / 2 - m.pivX) * px;
    const oy = -(zVon(k, r1) + k.dx / 2 - m.pivZ) * px;
    ctx.drawImage(bild, ox, oy, bild.width * k.dx * px, bild.height * k.dx * px);
    ctx.restore();
    for (const { id, j } of m.baeume) {
      const t = k.baeume.find(x => x.id === id);
      if (!t) continue;
      const i = m.idx[j];
      const c = i % k.nx, r = (i - c) / k.nx;
      const x = xVon(k, c) - m.pivX, z = zVon(k, r) - m.pivZ;
      const co = Math.cos(m.theta), si = Math.sin(m.theta);
      baum(ctx, X(b, m.pivX + co * x - si * z + m.tx), Z(b, m.pivZ + si * x + co * z + m.tz), px, t.neigung + m.theta, t.groesse, t.art);
    }
  }
  // Staubwolke bei Stürzen
  for (const m of k.bewegungen) {
    if (m.art !== "fall" || m.zeit < 0.3) continue;
    ctx.fillStyle = `rgba(235,230,215,${Math.min(0.35, m.zeit * 0.2)})`;
    ctx.beginPath(); ctx.ellipse(X(b, m.pivX + m.tx), Z(b, m.pivZ + m.tz), px * (4 + m.zeit * 6), px * (3 + m.zeit * 4), 0, 0, Math.PI * 2); ctx.fill();
  }
}

export function zeichneKliff(b: Bild, s: KliffSzene) {
  const { ctx } = b;
  const { k } = s;
  ctx.clearRect(0, 0, b.w, b.h);
  himmel(b, { wetter: s.wetter, t: s.t });
  const wb = wasser(b, s);
  // Gestein
  const bild = gesteinBild(k);
  const px = X(b, 1) - X(b, 0);
  ctx.save();
  ctx.imageSmoothingEnabled = px < 2;
  const oben = Z(b, k.z0 + k.nz * k.dx), hoehe = k.nz * k.dx * px, B = k.nx * k.dx;
  ctx.drawImage(bild, X(b, 0), oben, B * px, hoehe);
  // Über den Rand des Modellgebiets hinaus: Randspalten fortsetzen, damit
  // die Bühne nie leer ist (Hochfläche landwärts, Meeresgrund seewärts)
  if (b.a.x1 > B) ctx.drawImage(bild, k.nx - 1, 0, 1, k.nz, X(b, B) - 0.5, oben, X(b, b.a.x1) - X(b, B) + 1, hoehe);
  if (b.a.x0 < 0) ctx.drawImage(bild, 0, 0, 1, k.nz, X(b, b.a.x0), oben, X(b, 0) - X(b, b.a.x0) + 0.5, hoehe);
  ctx.restore();
  // Tiefenabdunklung nur im Wasser selbst — der Meeresboden bleibt Gestein
  ctx.save();
  wb.pfad();
  ctx.clip();
  ctx.fillStyle = "rgba(30,90,150,0.35)";
  ctx.fillRect(0, Z(b, s.W + 3), b.w, b.h);
  ctx.restore();
  oberflaeche(b, s, wb);
  // Bewuchs und Bäume
  const g = geometrie(k);
  ctx.fillStyle = "#5f9a3e";
  for (let c = 0; c < k.nx; c++) {
    if (!k.bewuchs[c] || g.top[c] < 0) continue;
    const m = k.mat[g.top[c] * k.nx + c];
    if (m !== MAT.BODEN && m !== MAT.SCHUTT && k.bewuchs[c] !== 1) continue;
    ctx.fillRect(X(b, c * k.dx), Z(b, zVon(k, g.top[c]) + k.dx / 2) - Math.max(1.5, px * 0.2), Math.max(1, px * k.dx) + 0.5, Math.max(1.5, px * 0.2));
  }
  for (const t of k.baeume) {
    if (t.weg) continue;
    if (k.bewegungen.some(m => m.baeume.some(q => q.id === t.id))) continue;
    const tot = t.tot === undefined ? undefined : (k.stunde - t.tot) / 8766;
    if (t.fall) baum(ctx, X(b, t.fall.x), Z(b, t.fall.z), px, t.neigung, t.groesse, t.art, tot);
    else baum(ctx, X(b, xVon(k, t.c)), Z(b, zVon(k, t.r) + k.dx / 2), px, t.neigung, t.groesse, t.art, tot);
  }
  objekte(b, s);
  regen(b, s);
  bewegungen(b, s);
  // Ruhewasserlinie
  ctx.save();
  ctx.setLineDash([6, 5]);
  ctx.strokeStyle = "rgba(20,70,160,0.7)";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, Z(b, 0)); ctx.lineTo(X(b, kliffKante(k)), Z(b, 0)); ctx.stroke();
  ctx.restore();
  schilder(b, { begriffe: s.begriffe, markiert: s.markiert, W: s.W });
  if (s.quizTreffer) trefferZeigen(b, s.quizTreffer);
  // Maßstab
  const laenge = Math.max(10, px * 10);
  const meter = laenge / px > 30 ? 50 : 10;
  const l = meter * px;
  ctx.strokeStyle = "rgba(255,255,255,0.95)"; ctx.fillStyle = "rgba(255,255,255,0.95)"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(b.w - 12 - l, b.h - 12); ctx.lineTo(b.w - 12, b.h - 12); ctx.stroke();
  ctx.font = "11px system-ui, sans-serif"; ctx.textAlign = "right"; ctx.textBaseline = "bottom";
  ctx.fillText(`${meter} m (unverzerrt)`, b.w - 12, b.h - 15);
}
