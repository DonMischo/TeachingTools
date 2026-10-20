/**
 * Querschnitt zeichnen: Himmel mit Sonne, Wind, Regen und Schnee; Gestein mit
 * Körnung, Schichten, Rissen, Nässe und Eis in den Klüften; Pflanzen oben.
 * Nur Canvas-2D (läuft im Browser und mit @napi-rs/canvas in Tests).
 */
import { BODEN, GRANIT, LUFT, SCHUTT, STOFFE, WASSER, type Klima, type Querschnitt } from "./verwitterung";

type Ctx = CanvasRenderingContext2D;

const hash = (a: number, b: number) => { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); };

export function zeichneQuerschnitt(ctx: Ctx, q: Querschnitt, k: Klima, t: number, px = 4) {
  const { W, H, stoff, riss, nass, haerte, eltern } = q;
  const BW = W * px, BH = H * px;
  // Himmel
  const winter = q.winter && k.frost > 0.2;
  const g = ctx.createLinearGradient(0, 0, 0, BH * 0.6);
  if (winter) { g.addColorStop(0, "#9fb2c4"); g.addColorStop(1, "#dfe7ee"); }
  else if (k.sonne > 0.8 && k.wasser < 0.2) { g.addColorStop(0, "#5fa0dc"); g.addColorStop(1, "#f3d9a8"); }
  else if (k.wasser > 0.8) { g.addColorStop(0, "#7d93a8"); g.addColorStop(1, "#c9d6dc"); }
  else { g.addColorStop(0, "#7fb4e6"); g.addColorStop(1, "#dbeaf5"); }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, BW, BH);

  // Sonne auf ihrer Tagesbahn
  if (k.sonne > 0) {
    const ph = (t * 0.05) % 1;
    const sx = BW * (0.1 + 0.8 * ph), sy = BH * 0.32 - Math.sin(ph * Math.PI) * BH * 0.24;
    const r = 10 + 10 * k.sonne;
    ctx.save();
    ctx.globalAlpha = 0.35 + 0.65 * k.sonne;
    const sg = ctx.createRadialGradient(sx, sy, 2, sx, sy, r * 2.4);
    sg.addColorStop(0, "#fff6c0"); sg.addColorStop(0.4, "#ffd54a"); sg.addColorStop(1, "rgba(255,213,74,0)");
    ctx.fillStyle = sg;
    ctx.beginPath(); ctx.arc(sx, sy, r * 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // Gestein
  const bild = ctx.createImageData(BW, BH);
  const d = bild.data;
  const himmel = ctx.getImageData(0, 0, BW, BH).data;
  d.set(himmel);
  const top = new Int16Array(W);
  for (let i = 0; i < W; i++) { let j = 0; while (j < H && (stoff[j * W + i] === LUFT || stoff[j * W + i] === WASSER)) j++; top[i] = j; }
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const c = j * W + i, m = stoff[c];
    if (m === LUFT) {
      // Höhle (unter der Oberfläche): dunkel
      if (j > top[i]) for (let b = 0; b < px; b++) for (let a = 0; a < px; a++) { const o = ((j * px + b) * BW + i * px + a) * 4; d[o] = 34; d[o + 1] = 30; d[o + 2] = 28; }
      continue;
    }
    let [r, gg, bb] = m === SCHUTT ? STOFFE[eltern[c] && eltern[c] !== SCHUTT ? eltern[c] : SCHUTT].farbe : STOFFE[m].farbe;
    if (m === SCHUTT) { r *= 0.85; gg *= 0.85; bb *= 0.85; }
    // Schichtung: härtere Bänke dunkler
    const sch = 1.06 - 0.12 * Math.min(1.5, haerte[c]) / 1.5;
    const nas = 1 - 0.28 * nass[c];
    const ri = riss[c];
    const eis = winter && ri > 0.3 && nass[c] > 0.15;
    for (let b = 0; b < px; b++) for (let a = 0; a < px; a++) {
      const x = i * px + a, y = j * px + b;
      let f = sch * nas * (0.88 + 0.24 * hash(x, y));
      // Körnung: Lockermaterial gesprenkelt, Schutt mit Blockkanten
      if (STOFFE[m].locker) f *= 0.9 + 0.2 * hash(x * 3, y * 7);
      if (m === SCHUTT && (a === 0 || b === 0) && hash(i, j) > 0.4) f *= 0.7;
      // Risse als dunkle Linien an einer Zellkante
      let cr = false;
      if (ri > 0.25) {
        const kante = hash(i, j) > 0.5 ? a === Math.floor(hash(j, i) * px) : b === Math.floor(hash(j + 3, i) * px);
        if (kante) { f *= 1 - 0.6 * Math.min(1, ri); cr = true; }
      }
      const o = (y * BW + x) * 4;
      if (cr && eis) { d[o] = 190; d[o + 1] = 232; d[o + 2] = 250; }
      else { d[o] = r * f; d[o + 1] = gg * f; d[o + 2] = bb * f; }
      d[o + 3] = 255;
    }
    // Oberflächenkruste: Rost (Oxidation) bei Chemie, Reif im Winter
    if (j === top[i]) {
      for (let a = 0; a < px; a++) {
        const o = ((j * px) * BW + i * px + a) * 4;
        if (winter) { d[o] = 240; d[o + 1] = 245; d[o + 2] = 250; }
        else if (k.chemie > 0.5 && (m === GRANIT || eltern[c] === GRANIT)) { d[o] = d[o] * 0.8 + 50; d[o + 1] *= 0.85; d[o + 2] *= 0.7; }
      }
    }
  }
  ctx.putImageData(bild, 0, 0);

  // Pflanzen: Gras und Bäume
  if (k.pflanzen > 0) {
    for (let i = 0; i < W; i++) {
      const j = top[i];
      if (j >= H) continue;
      const m = stoff[j * W + i];
      const nahrhaft = m === BODEN ? 1 : STOFFE[m].locker ? 0.5 : 0.15;
      const v = k.pflanzen * nahrhaft * Math.min(1, 0.25 + k.wasser * 1.2);
      if (v < 0.15) continue;
      ctx.fillStyle = winter ? "#c7d1c0" : `rgb(${70 - 20 * v},${140 + 30 * v},${60})`;
      for (let a = 0; a < px; a++) if (hash(i * px + a, 9) < v) ctx.fillRect(i * px + a, j * px - 1 - Math.floor(hash(i, a) * 3 * v), 1, 2 + Math.floor(hash(i, a) * 3 * v));
      if (v > 0.55 && hash(i, 77) < 0.05 * v) {
        const hgt = (6 + hash(i, 5) * 8) * px * 0.6;
        ctx.fillStyle = "#6b4a2e";
        ctx.fillRect(i * px + px / 2 - 1, j * px - hgt, 2, hgt);
        ctx.fillStyle = winter ? "#8a9a86" : "#3f7d3a";
        ctx.beginPath(); ctx.arc(i * px + px / 2, j * px - hgt, hgt * 0.45, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  // Wasser: Tropfen in der Luft, Rinnsale, Sickerwasser
  for (const tr of q.tropfen) {
    const x = tr.x * px + px / 2, y = tr.y * px + px / 2;
    if (tr.unter) { ctx.fillStyle = tr.saett > 0.3 ? "rgba(150,235,240,.9)" : "rgba(70,140,220,.85)"; ctx.fillRect(x - 1, y - 1, 2, 2); }
    else if (tr.y < top[Math.max(0, Math.min(W - 1, tr.x))] - 1) {
      if (winter && k.frost > 0.4) { ctx.fillStyle = "#fff"; ctx.fillRect(x, y, 2, 2); }
      else { ctx.strokeStyle = "rgba(60,120,210,.7)"; ctx.beginPath(); ctx.moveTo(x, y - 5); ctx.lineTo(x, y); ctx.stroke(); }
    } else { ctx.fillStyle = tr.last ? "rgba(150,110,70,.9)" : "rgba(60,130,220,.9)"; ctx.fillRect(x - 1.5, y - 1, 3, 2); }
  }

  // Wind: Schlieren und fliegende Körner
  if (k.wind > 0) {
    const n = Math.round(30 * k.wind);
    ctx.strokeStyle = "rgba(255,255,255,.65)";
    ctx.lineWidth = 1.2;
    for (let s = 0; s < n; s++) {
      const y = BH * 0.08 + hash(s, 1) * BH * 0.4;
      const len = 20 + 40 * k.wind;
      const x = ((hash(s, 2) * BW + t * (60 + 140 * k.wind) * k.richtung) % (BW + len) + BW + len) % (BW + len) - len;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + len / 2, y - 3, x + len, y); ctx.stroke();
    }
    // Körner dicht über dem Boden (Saltation)
    ctx.fillStyle = "rgba(200,170,110,.9)";
    for (let s = 0; s < Math.round(60 * k.wind * k.wind); s++) {
      const i = Math.floor(((hash(s, 3) * W + t * 12 * k.richtung * (1 + hash(s, 4))) % W + W) % W);
      const y = top[i] * px - 2 - hash(s, 5) * 10 * px * Math.abs(Math.sin(t * 3 + s));
      ctx.fillRect(i * px, y, 2, 2);
    }
  }

  // Schnee im Winter
  if (winter && k.frost > 0.3) {
    ctx.fillStyle = "rgba(255,255,255,.9)";
    for (let s = 0; s < 80 * k.frost; s++) ctx.fillRect(hash(s, 8) * BW + Math.sin(t + s) * 6, ((hash(s, 9) * BH * 0.7 + t * 30) % (BH * 0.7)), 2, 2);
  }

  // Maßstab und Jahr
  ctx.fillStyle = "rgba(0,0,0,.55)";
  ctx.fillRect(8, BH - 22, 10 / q.zelle * px + 50, 16);
  ctx.fillStyle = "#fff";
  ctx.fillRect(12, BH - 12, 10 / q.zelle * px, 3);
  ctx.font = "11px system-ui,sans-serif";
  ctx.fillText("10 m", 16 + 10 / q.zelle * px, BH - 10);
}
