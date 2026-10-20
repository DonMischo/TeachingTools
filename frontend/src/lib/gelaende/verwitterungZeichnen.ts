/**
 * Querschnitt zeichnen, in zwei Ebenen:
 *   felsBild()            Gestein mit Körnung, Schichten, Rissen, Nässe, Eis
 *                         (nur neu, wenn sich etwas geändert hat)
 *   zeichneQuerschnitt()  Himmel, Sonne, Gestein, Pflanzen, Wasser, Wind,
 *                         Schnee, Beschriftungen — in jedem Bild
 * Nur Canvas-2D (läuft im Browser und mit @napi-rs/canvas in Tests).
 */
import { BODEN, GRANIT, LUFT, SCHUTT, SINTER, STOFFE, WASSER, type Klima, type Querschnitt } from "./verwitterung";

type Ctx = CanvasRenderingContext2D;

const hash = (a: number, b: number) => { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); };

function oberkanten(q: Querschnitt): Int16Array {
  const { W, H, stoff } = q;
  const top = new Int16Array(W);
  for (let i = 0; i < W; i++) { let j = 0; while (j < H && (stoff[j * W + i] === LUFT || stoff[j * W + i] === WASSER)) j++; top[i] = j; }
  return top;
}

/** Gesteinsebene in ctx (Größe W·px × H·px); Luft über der Oberfläche bleibt durchsichtig */
/** `wege`: Zellen, durch die viel Wasser fließt, blau tönen (Wasserwege im Gestein) */
export function felsBild(ctx: Ctx, q: Querschnitt, k: Klima, px: number, wege = false) {
  const { W, H, stoff, riss, nass, haerte, eltern } = q;
  const BW = W * px, BH = H * px;
  const winter = q.winter && k.frost > 0.2;
  const bild = ctx.createImageData(BW, BH);
  const d = bild.data;
  const top = oberkanten(q);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const c = j * W + i, m = stoff[c];
    if (m === LUFT) {
      const hoehle = q.draussen ? !q.draussen[c] : j > top[i];
      // Höhlenbach: Gänge mit viel Karstwasser blau, Rest dunkel
      const bach = hoehle && q.karst && q.karst[c] > 2 && j + 1 < H && stoff[c + W] !== LUFT;
      if (hoehle) for (let b = 0; b < px; b++) for (let a = 0; a < px; a++) { const o = ((j * px + b) * BW + i * px + a) * 4; if (bach && b >= px / 3) { d[o] = 50; d[o + 1] = 120; d[o + 2] = 210; } else { d[o] = 30; d[o + 1] = 27; d[o + 2] = 26; } d[o + 3] = 255; }
      continue;
    }
    let [r, gg, bb] = m === SCHUTT ? STOFFE[eltern[c] && eltern[c] !== SCHUTT ? eltern[c] : SCHUTT].farbe : STOFFE[m].farbe;
    if (m === SCHUTT) { r *= 0.82; gg *= 0.82; bb *= 0.82; }
    const sch = 1.07 - 0.14 * Math.min(1.5, haerte[c]) / 1.5;
    const nas = 1 - 0.28 * nass[c];
    const ri = riss[c];
    const eis = winter && ri > 0.3 && nass[c] > 0.15;
    // Rand zu Luft: leichte Kante, damit Blöcke und Höhlen lesbar sind
    const randL = i > 0 && stoff[c - 1] === LUFT, randO = j > 0 && stoff[c - W] === LUFT;
    for (let b = 0; b < px; b++) for (let a = 0; a < px; a++) {
      const x = i * px + a, y = j * px + b;
      let f = sch * nas * (0.9 + 0.2 * hash(x, y));
      if (STOFFE[m].locker) f *= 0.9 + 0.2 * hash(x * 3, y * 7);
      if (m === SCHUTT && (a === 0 || b === 0) && hash(i, j) > 0.35) f *= 0.68;
      if ((randL && a === 0) || (randO && b === 0)) f *= 1.12;
      let cr = false;
      if (ri > 0.38) {
        const kante = hash(i, j) > 0.5 ? a === Math.floor(hash(j, i) * px) : b === Math.floor(hash(j + 3, i) * px);
        if (kante) { f *= 1 - 0.6 * Math.min(1, ri); cr = true; }
      }
      const o = (y * BW + x) * 4;
      if (wege && q.fluss && q.fluss[c] > 0.3) { const w = Math.min(0.85, Math.log1p(q.fluss[c]) / 3.5); d[o] = r * f * (1 - w) + 30 * w; d[o + 1] = gg * f * (1 - w) + 110 * w; d[o + 2] = bb * f * (1 - w) + 240 * w; d[o + 3] = 255; continue; }
      if (cr && eis) { d[o] = 190; d[o + 1] = 232; d[o + 2] = 250; }
      else if (m === SINTER) { d[o] = 236 * f; d[o + 1] = 214 * f; d[o + 2] = 170 * f; }
      else { d[o] = r * f; d[o + 1] = gg * f; d[o + 2] = bb * f; }
      d[o + 3] = 255;
    }
    if (j === top[i]) for (let a = 0; a < px; a++) {
      const o = ((j * px) * BW + i * px + a) * 4;
      if (winter) { d[o] = 240; d[o + 1] = 245; d[o + 2] = 250; }
      else if (k.chemie > 0.5 && (m === GRANIT || eltern[c] === GRANIT)) { d[o] = d[o] * 0.8 + 50; d[o + 1] *= 0.85; d[o + 2] *= 0.7; }
    }
  }
  ctx.putImageData(bild, 0, 0);
}

import type { Form } from "./formen";

export interface ZeichenOptionen { marken?: boolean; formen?: Form[] }

/** Beschriftungen der Ausgangslandschaft, die auch später stimmen (Schichten, Gesteine) */
const BLEIBT = /Ton|Schiefer|darunter|undurchlässig|Bankung|Klüfte|Schieferung|Buntsandstein|Sandstein \(|Basaltdecke|Tal$/;

export function zeichneQuerschnitt(ctx: Ctx, q: Querschnitt, k: Klima, t: number, px: number, fels: CanvasImageSource, o: ZeichenOptionen = {}) {
  const { W, H, stoff } = q;
  const BW = W * px, BH = H * px;
  const winter = q.winter && k.frost > 0.2;
  const g = ctx.createLinearGradient(0, 0, 0, BH * 0.6);
  if (winter) { g.addColorStop(0, "#9fb2c4"); g.addColorStop(1, "#dfe7ee"); }
  else if (k.sonne > 0.8 && k.wasser < 0.2) { g.addColorStop(0, "#5fa0dc"); g.addColorStop(1, "#f3d9a8"); }
  else if (k.wasser > 0.8) { g.addColorStop(0, "#7d93a8"); g.addColorStop(1, "#c9d6dc"); }
  else { g.addColorStop(0, "#7fb4e6"); g.addColorStop(1, "#dbeaf5"); }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, BW, BH);
  if (k.sonne > 0) {
    const ph = (t * 0.05) % 1;
    const sx = BW * (0.1 + 0.8 * ph), sy = BH * 0.3 - Math.sin(ph * Math.PI) * BH * 0.22;
    const r = (10 + 10 * k.sonne) * px / 3;
    ctx.save();
    ctx.globalAlpha = 0.35 + 0.65 * k.sonne;
    const sg = ctx.createRadialGradient(sx, sy, 2, sx, sy, r * 2.4);
    sg.addColorStop(0, "#fff6c0"); sg.addColorStop(0.4, "#ffd54a"); sg.addColorStop(1, "rgba(255,213,74,0)");
    ctx.fillStyle = sg;
    ctx.beginPath(); ctx.arc(sx, sy, r * 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  ctx.drawImage(fels, 0, 0, BW, BH);
  const top = oberkanten(q);

  if (k.pflanzen > 0) for (let i = 0; i < W; i++) {
    const j = top[i];
    if (j >= H) continue;
    const m = stoff[j * W + i];
    const nahrhaft = m === BODEN ? 1 : STOFFE[m].locker ? 0.5 : 0.15;
    const v = k.pflanzen * nahrhaft * Math.min(1, 0.25 + k.wasser * 1.2);
    if (v < 0.15) continue;
    ctx.fillStyle = winter ? "#c7d1c0" : `rgb(${70 - 20 * v},${140 + 30 * v},60)`;
    for (let a = 0; a < px; a++) if (hash(i * px + a, 9) < v) { const h = 2 + Math.floor(hash(i, a) * 3 * v * px / 2); ctx.fillRect(i * px + a, j * px - h, 1, h); }
    if (v > 0.55 && hash(i, 77) < 0.03 * v) {
      const hgt = (5 + hash(i, 5) * 7) / q.zelle * px * 0.3;
      ctx.fillStyle = "#6b4a2e";
      ctx.fillRect(i * px + px / 2 - 1, j * px - hgt, 2, hgt);
      ctx.fillStyle = winter ? "#8a9a86" : "#3f7d3a";
      ctx.beginPath(); ctx.arc(i * px + px / 2, j * px - hgt, hgt * 0.42, 0, Math.PI * 2); ctx.fill();
    }
  }

  for (const tr of q.tropfen) {
    const x = tr.x * px + px / 2, y = tr.y * px + px / 2;
    if (tr.unter) { ctx.fillStyle = tr.saett > 0.3 ? "rgba(150,235,240,.9)" : "rgba(70,140,220,.85)"; ctx.fillRect(x - 1, y - 1, 2, 2); continue; }
    const imFreien = tr.y < top[Math.max(0, Math.min(W - 1, tr.x))];
    const amBoden = tr.y + 1 < H && stoff[(tr.y + 1) * W + tr.x] !== LUFT;
    if (!amBoden && imFreien) {
      if (winter && k.frost > 0.4) { ctx.fillStyle = "#fff"; ctx.fillRect(x, y, 2, 2); }
      else { ctx.strokeStyle = "rgba(60,120,210,.7)"; ctx.beginPath(); ctx.moveTo(x, y - 2 * px); ctx.lineTo(x, y); ctx.stroke(); }
    } else {
      // fließendes Wasser: Bach, Höhlenbach, Rinnsal
      ctx.fillStyle = tr.last ? "rgba(150,110,70,.9)" : imFreien ? "rgba(60,130,220,.9)" : "rgba(80,160,235,.95)";
      ctx.fillRect(x - px * 0.7, y - px * 0.3, px * 1.4, px * 0.9);
    }
  }

  if (k.wind > 0) {
    const n = Math.round(30 * k.wind);
    ctx.strokeStyle = "rgba(255,255,255,.65)";
    ctx.lineWidth = 1.2;
    for (let s = 0; s < n; s++) {
      const y = BH * 0.05 + hash(s, 1) * BH * 0.3;
      const len = 20 + 40 * k.wind;
      const x = ((hash(s, 2) * BW + t * (60 + 140 * k.wind) * k.richtung) % (BW + len) + BW + len) % (BW + len) - len;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + len / 2, y - 3, x + len, y); ctx.stroke();
    }
    ctx.fillStyle = "rgba(200,170,110,.9)";
    for (let s = 0; s < Math.round(80 * k.wind * k.wind); s++) {
      const i = Math.floor(((hash(s, 3) * W + t * 12 * k.richtung * (1 + hash(s, 4))) % W + W) % W);
      const y = top[i] * px - 2 - hash(s, 5) * 8 * px * Math.abs(Math.sin(t * 3 + s));
      ctx.fillRect(i * px, y, 2, 2);
    }
  }
  if (winter && k.frost > 0.3) {
    ctx.fillStyle = "rgba(255,255,255,.9)";
    for (let s = 0; s < 120 * k.frost; s++) ctx.fillRect(hash(s, 8) * BW + Math.sin(t + s) * 6, ((hash(s, 9) * BH * 0.6 + t * 30) % (BH * 0.6)), 2, 2);
  }

  if (o.marken !== false) {
    // Schrift wächst mit dem Bild, damit sie auch verkleinert lesbar bleibt
    const fs = Math.max(12, Math.round(BW / 72));
    ctx.font = `bold ${fs}px system-ui,sans-serif`;
    ctx.textBaseline = "middle";
    // Ausgangsbeschriftung: anfangs alle, später nur die Schichten — die Formen erkennt die Simulation selbst
    for (const mk of q.marken.filter(m => q.jahr === 0 || BLEIBT.test(m.text))) {
      const x = mk.x * px, y = mk.y * px;
      const w = ctx.measureText(mk.text).width + fs * 0.7;
      const bx = Math.max(2, Math.min(BW - w - 2, x - w / 2));
      ctx.fillStyle = "rgba(255,255,255,.85)";
      ctx.fillRect(bx, y - fs * 0.7, w, fs * 1.4);
      ctx.fillStyle = "#1f2937";
      ctx.fillText(mk.text, bx + fs * 0.35, y);
    }
  }
  // erkannte Formen: gelbe Schilder mit Punkt am Ort
  if (o.marken !== false && o.formen) {
    const fs = Math.max(12, Math.round(BW / 75));
    ctx.font = `bold ${fs}px system-ui,sans-serif`;
    ctx.textBaseline = "middle";
    const belegt: { x0: number; x1: number; y: number }[] = [];
    for (const f of o.formen) {
      if (f.x < 0) continue;
      const x = f.x * px, y = f.y * px;
      const w = ctx.measureText(f.text).width + fs * 0.7;
      let by = y - fs * 2.2;
      // nicht übereinander schreiben
      for (let n = 0; n < 6 && belegt.some(b => Math.abs(b.y - by) < fs * 1.5 && b.x0 < x + w / 2 && b.x1 > x - w / 2); n++) by -= fs * 1.6;
      by = Math.max(fs, by);
      const bx = Math.max(2, Math.min(BW - w - 2, x - w / 2));
      belegt.push({ x0: bx, x1: bx + w, y: by });
      ctx.strokeStyle = "rgba(250,204,21,.95)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(Math.max(bx + 4, Math.min(bx + w - 4, x)), by + fs * 0.7); ctx.stroke();
      ctx.fillStyle = "rgba(250,204,21,.95)"; ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(254,249,195,.95)"; ctx.fillRect(bx, by - fs * 0.7, w, fs * 1.4);
      ctx.strokeRect(bx, by - fs * 0.7, w, fs * 1.4);
      ctx.fillStyle = "#422006"; ctx.fillText(f.text, bx + fs * 0.35, by);
    }
  }
  const zehn = (10 / q.zelle) * px;
  ctx.fillStyle = "rgba(0,0,0,.55)";
  ctx.fillRect(8, BH - 24, zehn + 54, 18);
  ctx.fillStyle = "#fff";
  ctx.fillRect(12, BH - 14, zehn, 3);
  ctx.font = "12px system-ui,sans-serif";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("10 m", 18 + zehn, BH - 10);
}
