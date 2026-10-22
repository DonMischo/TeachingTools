/**
 * Bilder der Vulkan-Simulation: Karte von oben (Gestein obenauf, glühende
 * Lava, junge Ströme dunkel, alte bewachsen) und Querschnitt durch den
 * Hauptschlot mit allen Schichten, Schlot, Gängen und Magmakammer.
 */
import { gelaendeFarben } from "@/lib/gelaende/farbe";
import type { Marke } from "@/lib/gelaende/formen";
import { kette, kraterseen, saeule, STOFFE, type Vulkan } from "./modell";

type RGB = [number, number, number];

/** Glutfarbe der Lava: heiß gelb, abkühlend rot, fast erstarrt dunkelrot (t = 0 heiß … 1 erstarrt) */
export function glut(t: number): RGB {
  t = Math.max(0, Math.min(1, t));
  if (t < 0.35) { const u = t / 0.35; return [255, 236 - 96 * u, 120 - 100 * u]; }
  const u = (t - 0.35) / 0.65;
  return [255 - 115 * u, 140 - 110 * u, 20];
}

/** Wasser je Zelle wie im Gelände: 2 = Meer, 3 = See */
export function wasserMaske(v: Vulkan, seen?: Uint8Array): Uint8Array {
  const w = new Uint8Array(v.n * v.n);
  for (let k = 0; k < w.length; k++) {
    if (v.meer !== null && v.G[k] + v.L[k] < v.meer) w[k] = 2;
    else if (seen?.[k]) w[k] = 3;
  }
  return w;
}

/** oberste Schicht je Zelle (Index, −1 = Grundgebirge) */
function obenauf(v: Vulkan): Int16Array {
  const N = v.n * v.n, top = new Int16Array(N).fill(-1);
  for (let s = 0; s < v.schichten.length; s++) {
    const d = v.schichten[s].d;
    for (let k = 0; k < N; k++) if (d[k] > 0.3) top[k] = s;
  }
  return top;
}

export function kartenFarben(v: Vulkan, seen?: Uint8Array): Uint8ClampedArray {
  const { n, zelle, G, L, T } = v, N = n * n;
  const hoehe = new Float32Array(N);
  for (let k = 0; k < N; k++) hoehe[k] = G[k] + L[k];
  const wasser = wasserMaske(v, seen);
  const px = gelaendeFarben({ n, zelle, hoehe, wasser, aue: new Uint8Array(N) }, { atlas: true });
  const top = obenauf(v);
  const Lx = [-0.6, -0.6, 0.53], ll = Math.hypot(Lx[0], Lx[1], Lx[2]);
  const t0 = v.ausbruch?.t0 ?? 1100, sp = v.ausbruch?.spanne ?? 140;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = j * n + i;
    if (wasser[k]) continue;
    if (L[k] > 0.05) {
      const c = glut((t0 - T[k]) / sp);
      px[k * 4] = c[0]; px[k * 4 + 1] = c[1]; px[k * 4 + 2] = c[2];
      continue;
    }
    if (top[k] < 0 || G[k] - v.start[k] < 0.3) continue;
    const s = v.schichten[top[k]];
    const hl = hoehe[j * n + Math.max(0, i - 1)], hr = hoehe[j * n + Math.min(n - 1, i + 1)];
    const ho = hoehe[Math.max(0, j - 1) * n + i], hu = hoehe[Math.min(n - 1, j + 1) * n + i];
    const nx = -(hr - hl) / (2 * zelle) * 2, ny = -(hu - ho) / (2 * zelle) * 2;
    const licht = Math.max(0, (nx * Lx[0] + ny * Lx[1] + Lx[2]) / (Math.hypot(nx, ny, 1) * ll));
    const sh = 0.5 + 0.65 * licht;
    // frische Lava schwarz, dann verwittert sie graubraun, alte Oberflächen werden grün
    const alter = v.nr - s.nr;
    const grau = Math.min(1, Math.max(0, alter / 6)) * 0.45, gruen = Math.min(1, Math.max(0, (alter - 6) / 20)) * 0.7;
    const b = STOFFE[s.stoff].farbe;
    let c: RGB = [b[0] + (128 - b[0]) * grau, b[1] + (114 - b[1]) * grau, b[2] + (100 - b[2]) * grau];
    c = [c[0] + (92 - c[0]) * gruen, c[1] + (128 - c[1]) * gruen, c[2] + (76 - c[2]) * gruen];
    // Glanzlicht, damit auch dunkle Lava Relief zeigt
    const glanz = Math.max(0, licht - 0.75) * 120;
    // dünne Ascheschleier färben den Boden nur an
    const deck = Math.min(1, (G[k] - v.start[k]) / 4);
    for (let q = 0; q < 3; q++) px[k * 4 + q] = px[k * 4 + q] * (1 - deck) + (c[q] * sh + glanz) * deck;
  }
  return px;
}

/** Schnittlinie durch den Hauptschlot: Endpunkte in Zellkoordinaten */
export function schnittLinie(v: Vulkan, winkel: number): { a: { x: number; y: number }; b: { x: number; y: number }; laenge: number } {
  const c = v.n / 2, dx = Math.cos(winkel), dy = Math.sin(winkel);
  const r = (v.n / 2 - 0.5) / Math.max(Math.abs(dx), Math.abs(dy));
  return { a: { x: c - dx * r, y: c - dy * r }, b: { x: c + dx * r, y: c + dy * r }, laenge: 2 * r };
}

const GRUND: RGB = [122, 112, 104];

export interface QuerschnittOptionen { winkel: number; beschriften: boolean }

export interface SchnittGeometrie {
  ueberhoehung: number;
  /** Oberkante (Boden, Lava oder Meer) in Pixeln je 2-Pixel-Spalte */
  oberflaeche: Float32Array;
  /** tätiger Schlot im Schnitt (Pixel) oder null */
  schlot: { x: number; y: number } | null;
}

/** Querschnitt durch den Hauptschlot; gibt Überhöhung, Oberfläche und Schlot zurück (für die Ausbruchsteilchen) */
export function zeichneQuerschnitt(ctx: CanvasRenderingContext2D, v: Vulkan, o: QuerschnittOptionen): SchnittGeometrie {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const { a, b, laenge } = schnittLinie(v, o.winkel);
  const M = Math.ceil(W / 2);
  const cols = Array.from({ length: M }, (_, m) => {
    const t = m / (M - 1);
    return saeule(v, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
  });
  let hi = -Infinity, lo = Infinity;
  for (const c of cols) { hi = Math.max(hi, c.g + c.l); lo = Math.min(lo, c.b); }
  if (v.meer !== null) hi = Math.max(hi, v.meer);
  const sx = W / (laenge * v.zelle);
  // höchstens 2,5-fach überhöht (bei 100-m-Zellen), sonst wirkt auch der Schild steil; große Ausschnitte mehr
  const zmin = lo - 1500, zmax = Math.max(hi + 350, lo + 1600, zmin + H / (sx * 2.5 * (v.zelle / 100)));
  const sy = H / (zmax - zmin), y = (z: number) => H - (z - zmin) * sy;
  const ueberhoehung = sy / sx;

  // Himmel
  const himmel = ctx.createLinearGradient(0, 0, 0, H);
  himmel.addColorStop(0, "#9cc4ea"); himmel.addColorStop(1, "#dbe8f2");
  ctx.fillStyle = himmel; ctx.fillRect(0, 0, W, H);
  for (let m = 0; m < M; m++) {
    const c = cols[m], x = m * 2, wd = 2;
    // Grundgebirge mit Schichtung angedeutet
    const yb = y(c.b);
    ctx.fillStyle = `rgb(${GRUND.join(",")})`;
    ctx.fillRect(x, yb, wd, H - yb);
    let z = c.b;
    for (let s = 0; s < c.d.length; s++) {
      const d = c.d[s];
      if (d < 0.05) continue;
      const st = v.schichten[s];
      const f = STOFFE[st.stoff].farbe, hell = s % 2 ? 1.07 : 0.94;
      const y1 = y(z + d), y0 = y(z);
      ctx.fillStyle = `rgb(${f[0] * hell},${f[1] * hell},${f[2] * hell})`;
      ctx.fillRect(x, y1, wd, Math.max(0.6, y0 - y1));
      // Schichtgrenze
      if (y0 - y1 > 2.5) { ctx.fillStyle = "rgba(30,20,20,0.35)"; ctx.fillRect(x, y1, wd, 0.8); }
      z += d;
    }
    if (c.l > 0.05) {
      const g = glut(0.3);
      ctx.fillStyle = `rgb(${g.join(",")})`;
      const y1 = y(z + c.l);
      ctx.fillRect(x, y1, wd, Math.max(1.5, y(z) - y1));
      z += c.l;
    }
    if (v.meer !== null && z < v.meer) {
      ctx.fillStyle = "rgba(50,110,190,0.75)";
      ctx.fillRect(x, y(v.meer), wd, y(z) - y(v.meer));
    }
  }
  // Raster für Grundgebirge
  ctx.save();
  ctx.strokeStyle = "rgba(0,0,0,0.08)";
  ctx.beginPath();
  for (let zz = Math.ceil(zmin / 250) * 250; zz < zmax; zz += 250) { ctx.moveTo(0, y(zz)); ctx.lineTo(W, y(zz)); }
  ctx.stroke();
  ctx.restore();

  // Magmakammer, Schlot und Gänge
  const xc = W / 2, aktiv = v.ausbruch !== null;
  const heiss = `rgb(${glut(0.15).join(",")})`, kalt = "rgb(150,40,30)";
  const kammerY = H - 30, kammerRx = Math.max(40, 1600 * sx), kammerRy = Math.max(24, 500 * sy);
  const mitteSaeule = cols[Math.round((M - 1) / 2)];
  const gr = ctx.createRadialGradient(xc, kammerY, 4, xc, kammerY, kammerRx);
  gr.addColorStop(0, aktiv ? "#ffd56a" : "#e0703a"); gr.addColorStop(1, aktiv ? "#d8401c" : "#8a2a1c");
  ctx.fillStyle = gr;
  if (v.platte) {
    // Mantelplume: heißes Gestein steigt aus der Tiefe unter den Hotspot
    const pl = ctx.createLinearGradient(0, H, 0, kammerY);
    pl.addColorStop(0, "rgba(255,120,40,0.85)"); pl.addColorStop(1, "rgba(255,190,90,0.9)");
    ctx.fillStyle = pl;
    ctx.beginPath(); ctx.moveTo(xc - 70, H); ctx.quadraticCurveTo(xc - 18, kammerY + 30, xc - 14, kammerY); ctx.lineTo(xc + 14, kammerY); ctx.quadraticCurveTo(xc + 18, kammerY + 30, xc + 70, H); ctx.fill();
  }
  ctx.beginPath(); ctx.ellipse(xc, kammerY, kammerRx, kammerRy, 0, 0, Math.PI * 2); ctx.fill();
  const dx = Math.cos(o.winkel), dy = Math.sin(o.winkel), cz = v.n / 2;
  /** Lage einer Kartenzelle auf dem Schnitt: x in Pixeln und Abstand quer dazu (Zellen) */
  const projiziert = (i: number, j: number) => {
    const px = i + 0.5 - cz, py = j + 0.5 - cz;
    return { x: xc + ((px * dx + py * dy) / laenge) * W, quer: Math.abs(-px * dy + py * dx) };
  };
  // Schlot zum Gipfel des jüngsten Vulkans (beim Hotspot mit der Platte weggewandert)
  const zi = v.zentrum % v.n, zp = projiziert(zi, (v.zentrum - zi) / v.n);
  const zx = zp.quer < 3.5 ? zp.x : xc;
  const gipfelSaeule = cols[Math.max(0, Math.min(M - 1, Math.round(zx / 2)))];
  const schlotW = Math.max(4, 160 * sx);
  ctx.fillStyle = aktiv && v.ausbruch!.schlot.art === "gipfel" ? heiss : kalt;
  const schlotFuss = Math.abs(zx - xc) < 2 ? kammerY - kammerRy * 0.6 : y(gipfelSaeule.b - 300);
  ctx.fillRect(zx - schlotW / 2, y(gipfelSaeule.g), schlotW, schlotFuss - y(gipfelSaeule.g));
  if (Math.abs(zx - xc) >= 2) {
    ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = schlotW;
    ctx.beginPath(); ctx.moveTo(xc, kammerY - kammerRy * 0.6); ctx.quadraticCurveTo(xc, schlotFuss, zx, schlotFuss); ctx.stroke();
  }
  // Gänge zu Flankenschloten nahe der Schnittlinie
  const gaenge: { x: number; yv: number; aktiv: boolean; art: string }[] = [];
  for (const s of v.schlote) {
    if (s.art === "gipfel") continue;
    const { x, quer } = projiziert(s.i, s.j);
    if (quer > 3.5) continue;
    const c = cols[Math.max(0, Math.min(M - 1, Math.round(x / 2)))];
    gaenge.push({ x, yv: y(c.g), aktiv: aktiv && v.ausbruch!.schlot === s, art: s.art });
  }
  for (const gng of gaenge) {
    ctx.strokeStyle = gng.aktiv ? heiss : kalt;
    ctx.lineWidth = Math.max(2, 90 * sx);
    ctx.beginPath();
    const ys = y(gipfelSaeule.b - 300);
    ctx.moveTo(zx, ys);
    ctx.quadraticCurveTo(gng.x, ys, gng.x, gng.yv);
    ctx.stroke();
  }
  // Calderaränder (Ringbrüche)
  for (const cal of v.calderen) {
    for (const sgn of [-1, 1]) {
      const x = xc + sgn * cal.r * v.zelle * sx;
      ctx.strokeStyle = "rgba(40,20,20,0.7)"; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.moveTo(x, y(cols[Math.max(0, Math.min(M - 1, Math.round(x / 2)))].g)); ctx.lineTo(x, kammerY - kammerRy); ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  // Meeresspiegel
  if (v.meer !== null) {
    ctx.strokeStyle = "rgba(30,80,160,0.9)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, y(v.meer)); ctx.lineTo(W, y(v.meer)); ctx.stroke();
  }

  if (o.beschriften) {
    const schild = (text: string, x: number, yy: number, zu?: [number, number]) => {
      ctx.font = "bold 12px system-ui, sans-serif";
      const w = ctx.measureText(text).width + 8;
      const bx = Math.max(2, Math.min(W - w - 2, x - w / 2)), by = Math.max(2, Math.min(H - 20, yy - 9));
      if (zu) { ctx.strokeStyle = "rgba(60,50,10,0.8)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(bx + w / 2, by + 9); ctx.lineTo(zu[0], zu[1]); ctx.stroke(); }
      ctx.fillStyle = "rgba(254,249,195,0.95)"; ctx.strokeStyle = "rgb(202,138,4)";
      ctx.fillRect(bx, by, w, 18); ctx.strokeRect(bx + 0.5, by + 0.5, w - 1, 17);
      ctx.fillStyle = "#422006"; ctx.fillText(text, bx + 4, by + 13);
    };
    schild("Magmakammer", xc, kammerY - 6);
    if (v.platte) {
      schild("Mantelplume (Hotspot, ortsfest)", xc + 150, H - 14, [xc + 30, H - 14]);
      schild("← Pazifische Platte wandert nach Westen (9 cm/Jahr)", W * 0.3, y(lo - 700));
      for (const g of kette(v)) {
        const pp = projiziert(g.i, g.j);
        if (pp.quer > 6 || g.alter < 0.05) continue;
        schild(`${g.insel ? "Insel" : "Seamount"} · ${g.alter.toFixed(1).replace(".", ",")} Mio. J.`, pp.x, y(g.hoehe) - 26, [pp.x, y(g.hoehe) - 2]);
      }
    }
    const hoch = gipfelSaeule.g - gipfelSaeule.b;
    if (hoch > 40) schild("Schlot", zx + 40, y(gipfelSaeule.b - 200), [zx + schlotW / 2, y(gipfelSaeule.b - 200)]);
    schild("Grundgebirge", W * 0.08 + 40, H - 50);
    // Krater: Mulde am Gipfel
    let rand = -Infinity;
    for (let m = Math.round(M / 2) - 8; m <= Math.round(M / 2) + 8; m++) if (cols[m]) rand = Math.max(rand, cols[m].g);
    if (rand - mitteSaeule.g > 15 && hoch > 80) schild(v.calderen.length ? "Caldera" : "Krater", xc, y(rand) - 26, [xc, y(mitteSaeule.g) - 2]);
    for (const gng of gaenge.slice(-2)) schild(gng.art === "spalte" ? "Spalte" : "Nebenkrater", gng.x, gng.yv - 26, [gng.x, gng.yv - 2]);
    if (v.meer !== null) schild("Meeresspiegel", W - 60, y(v.meer) - 14);
    // dickste Lava- und Ascheschicht an der Flanke
    const flanke = cols[Math.round(M * 0.33)];
    if (flanke && hoch > 80) {
      let zl = flanke.b, best: Record<string, [number, number]> = {};
      flanke.d.forEach((d, s) => {
        const art = STOFFE[v.schichten[s].stoff].locker ? "t" : "l";
        if (d > 3 && (!best[art] || d > best[art][1])) best[art] = [zl + d / 2, d];
        zl += d;
      });
      const xf = Math.round(M * 0.33) * 2;
      if (best.l) schild("Lavaschicht", xf - 70, y(best.l[0]) + 18, [xf, y(best.l[0])]);
      if (best.t) schild("Ascheschicht", xf - 80, y(best.t[0]) - 24, [xf, y(best.t[0])]);
    }
  }
  // Maßstab: Höhen links, km unten
  ctx.fillStyle = "rgba(0,0,0,0.7)"; ctx.font = "11px system-ui, sans-serif";
  for (let zz = Math.ceil(zmin / 1000) * 1000; zz < zmax; zz += 1000) {
    ctx.fillRect(0, y(zz), 6, 1);
    ctx.fillText(`${zz} m`, 8, y(zz) + 4);
  }
  const km = Math.max(1, Math.round((laenge * v.zelle) / 1000 / 5));
  ctx.fillRect(W - 20 - km * 1000 * sx, H - 12, km * 1000 * sx, 3);
  ctx.fillText(`${km} km`, W - 20 - km * 1000 * sx, H - 16);
  const oberflaeche = Float32Array.from(cols, c => y(Math.max(c.g + c.l, v.meer ?? -Infinity)));
  let schlot: SchnittGeometrie["schlot"] = null;
  if (aktiv) {
    if (v.ausbruch!.schlot.art === "gipfel") schlot = { x: zx, y: y(gipfelSaeule.g + gipfelSaeule.l) };
    else { const gg = gaenge.find(x => x.aktiv); if (gg) schlot = { x: gg.x, y: gg.yv }; }
  }
  return { ueberhoehung, oberflaeche, schlot };
}

/** Formen auf der Karte beschriften (Zellkoordinaten) */
export function vulkanMarken(v: Vulkan, seen: Uint8Array): Marke[] {
  const { n, G, start } = v, aus: Marke[] = [];
  if (v.platte) {
    const hi = v.mitte % n, hj = Math.floor(v.mitte / n);
    aus.push({ text: "🔥 Hotspot", erklaerung: "Hier steigt ein Mantelplume auf und schmilzt die Platte von unten an. Er bleibt an Ort und Stelle — die Platte wandert darüber hinweg.", x: hi + 0.5, y: hj + 8 });
    for (const g of kette(v)) {
      if (Math.abs(g.i - hi) < 4) continue;
      const alter = g.alter.toFixed(1).replace(".", ",");
      aus.push(g.insel
        ? { text: `🏝️ ${alter} Mio. J.`, erklaerung: `Vulkaninsel, ${Math.round(g.hoehe)} m hoch. Sie lag vor etwa ${alter} Mio. Jahren über dem Hotspot; seitdem ist sie erloschen, sinkt langsam und wird abgetragen.`, x: g.i + 0.5, y: g.j - 3 }
        : { text: `🌊 Seamount ${alter} Mio. J.`, erklaerung: `Ehemalige Vulkaninsel, heute ${Math.round(-g.hoehe)} m unter dem Meeresspiegel: abgetragen und abgesunken.`, x: g.i + 0.5, y: g.j - 3 });
    }
  }
  const c = Math.floor(n / 2), k0 = c * n + c;
  let rand = -Infinity;
  for (let dj = -4; dj <= 4; dj++) for (let di = -4; di <= 4; di++) if (Math.hypot(di, dj) > 2.5) rand = Math.max(rand, G[k0 + dj * n + di]);
  const hoch = G[k0] - start[k0];
  if (v.calderen.length) {
    const cal = v.calderen[v.calderen.length - 1];
    aus.push({ text: "⭕ Caldera", erklaerung: "Die Magmakammer hat sich bei einem riesigen Ausbruch geleert, der Gipfel ist hineingesackt.", x: cal.i + 0.5, y: cal.j + 0.5 - cal.r });
  } else if (hoch > 50 && rand - G[k0] > 15) aus.push({ text: "🕳️ Krater", erklaerung: "Explosionen haben die Mündung des Schlots aufgesprengt.", x: c + 0.5, y: c - 2 });
  const gezeigt: { i: number; j: number }[] = [];
  for (const s of [...v.schlote].reverse()) {
    if (v.platte) break;
    if (s.art === "gipfel" || gezeigt.length >= 4 || gezeigt.some(g => Math.hypot(g.i - s.i, g.j - s.j) < 8)) continue;
    gezeigt.push(s);
    aus.push(s.art === "spalte"
      ? { text: "〰️ Spalte", erklaerung: "Lava ist aus einem langen Riss an der Flanke ausgetreten — typisch für Schildvulkane (Riftzone).", x: s.i + 0.5, y: s.j + 0.5 }
      : { text: "🔺 Nebenkrater", erklaerung: "Magma hat sich durch einen Gang einen Weg an die Flanke gesucht.", x: s.i + 0.5, y: s.j + 0.5 });
  }
  // aktiver Lavastrom: flüssige Zelle am weitesten vom Schlot
  if (v.ausbruch) {
    const sc = v.ausbruch.schlot;
    let best = -1, bd = 6;
    for (let k = 0; k < n * n; k++) if (v.L[k] > 0.3) { const i = k % n, j = (k - i) / n, d = Math.hypot(i - sc.i, j - sc.j); if (d > bd) { bd = d; best = k; } }
    if (best >= 0) aus.push({ text: "🔥 Lavastrom", erklaerung: "Flüssige Lava fließt bergab, kühlt ab und erstarrt am Rand zuerst.", x: (best % n) + 0.5, y: Math.floor(best / n) + 0.5 });
  }
  let sx = 0, sy = 0, sz = 0;
  for (let k = 0; k < n * n; k++) if (seen[k]) { sx += k % n; sy += Math.floor(k / n); sz++; }
  if (sz >= 4) aus.push({ text: "💧 Kratersee", erklaerung: "Regenwasser sammelt sich im Krater, der nirgends abfließen kann.", x: sx / sz + 0.5, y: sy / sz + 0.5 });
  if (!v.platte && v.meer !== null && Math.max(...Array.from(G)) > v.meer + 20 && hoch > 0) aus.push({ text: "🏝️ Vulkaninsel", erklaerung: "Der Vulkan ist vom Meeresboden bis über den Meeresspiegel gewachsen — wie Hawaii.", x: c + 6, y: c + 10 });
  return aus;
}

export { kraterseen };
