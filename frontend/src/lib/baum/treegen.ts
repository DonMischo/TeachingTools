// @ts-nocheck
/* eslint-disable */
// Baumleben: aus der eigenständigen Fassung übernommen, ungeprüftes JavaScript.
import { BL } from "./bl";
/* Prozedurale Bäume in 2D.
   Laubbäume: Raumkolonisierung (Runions, Lane & Prusinkiewicz 2007) in einer Kronenhülle, die mit dem Baum mitwächst.
   Nadelbäume: Quirl-Architektur, ein Quirl pro Wachstumsschritt (nach Weber & Penn 1995).
   Astdicke: Pfeifenmodell (da-Vinci-Regel, r^2.4 = Summe der Kinder).
   Knospenschicksal: Markow-Kette entlang der Triebe (ruhend, Kurztrieb, Langtrieb, Blüte, tot), abhängig vom Licht.
   Blattstellung: wechselständig zweizeilig oder spiralig mit dem Goldenen Winkel. */
BL.TreeGen = (function () {
  const P = {
    buche: { kind: "sca", env: { cb: .22, wMax: .5, yMax: .6, pTop: 2.6, pBot: 1.8 }, n: 700, jitter: .08, trop: .05, leaf: { a: .55, len: .9, phyl: "distich" },
      col: { spring: ["#a8d46f", "#c3e283"], summer: ["#2f6a26", "#5c9a3c"], autumn: ["#9c4f1c", "#d9902f", "#c2701f"] }, bark: "#8e918a", fruit: "#6b4a2a" },
    stieleiche: { kind: "sca", env: { cb: .18, wMax: .56, yMax: .52, pTop: 1.7, pBot: 1.8, lumps: 7 }, n: 620, jitter: .34, trop: -.04, leaf: { a: .5, len: 1, phyl: "spiral", lobed: true },
      col: { spring: ["#b3cf6a", "#cddf86"], summer: ["#35612a", "#5f8a3a"], autumn: ["#7d6527", "#a88a3a", "#6b4f22"] }, bark: "#5e4a38", fruit: "#8a6a2a" },
    birke: { kind: "sca", env: { cb: .14, wMax: .26, yMax: .42, pTop: 1.3, pBot: 2 }, n: 420, jitter: .16, trop: .22, weep: true, leaf: { a: .75, len: .65, phyl: "spiral" },
      col: { spring: ["#b9e07a", "#d3ec92"], summer: ["#4f8f39", "#7db552"], autumn: ["#d9b52e", "#f0d455", "#c79a28"] }, bark: "#ececE6", fruit: "#7a6a4a" },
    fichte: { kind: "whorl", whorls: 64, angle: 1.25, droop: .55, lenCap: .2, twig: "hang", needle: ["#1f4426", "#2f5e35"], bark: "#7a5a44" },
    waldkiefer: { kind: "whorl", whorls: 46, angle: 1.05, droop: .1, lenCap: .17, twig: "tuft", pine: true, needle: ["#3d6b44", "#5d8a5a"], bark: "#b06a3e", barkLow: "#6e5a4a" }
  };
  const GOLD = 137.508 * Math.PI / 180;

  // ---------- Kronenhülle ----------
  function inEnv(e, x, y, lump) {
    if (y < e.cb || y > 1) return false;
    const ty = y < e.yMax ? (e.yMax - y) / (e.yMax - e.cb) : (y - e.yMax) / (1 - e.yMax);
    const p = y < e.yMax ? e.pBot : e.pTop;
    const hw = e.wMax * Math.pow(Math.max(0, 1 - Math.pow(ty, p)), 1 / p) * (lump ? lump(x, y) : 1);
    return Math.abs(x) <= hw;
  }

  // ---------- Laubbaum: Raumkolonisierung ----------
  function buildSCA(pp, r) {
    const e = pp.env;
    const lumpC = e.lumps ? Array.from({ length: e.lumps }, () => [(r() - .5) * 2 * e.wMax, e.cb + r() * (1 - e.cb), .1 + r() * .12]) : null;
    const lump = lumpC ? (x, y) => { let m = .78; for (const [lx, ly, lr] of lumpC) m = Math.max(m, 1.12 - Math.hypot(x - lx, y - ly) / lr * .3); return m; } : null;
    // Lockpunkte gleichmäßig in der Hülle; jeder wird aktiv, sobald die mitwachsende Hülle ihn erreicht
    // Jede Wachstumsphase bekommt eigene Lockpunkte: Punkt in der Hülle, verkleinert auf die Größe zu diesem Zeitpunkt.
    // So hat auch ein junger Baum eine kleine, verzweigte Krone; tief angesetzte Jugendäste sterben später ab.
    const att = [];
    while (att.length < pp.n * 1.6) {
      const x = (r() * 2 - 1) * e.wMax * 1.15, y = e.cb + r() * (1 - e.cb);
      if (!inEnv(e, x, y, lump)) continue;
      const sc = .05 + .95 * Math.sqrt(r());
      att.push({ x: x * sc, y: y * sc, req: sc, dead: false });
    }
    const nodes = [{ x: 0, y: 0, p: -1, b: 0, dx: 0, dy: 1, depth: 0 }];
    const K = 150, extra = 70;
    for (let k = 1; k <= K + extra; k++) {
      const s = Math.min(1, k / K);
      const seg = Math.max(.0045, .02 * s), infl = Math.max(.02, .11 * s), kill = seg * 1.6;
      // Raster für die Suche nach dem nächsten Knoten
      const cell = infl, grid = new Map();
      nodes.forEach((n, i) => { const key = Math.floor(n.x / cell) + ":" + Math.floor(n.y / cell); (grid.get(key) || grid.set(key, []).get(key)).push(i); });
      const pull = new Map();
      for (const a of att) {
        if (a.dead || a.req > s) continue;
        const gx = Math.floor(a.x / cell), gy = Math.floor(a.y / cell);
        let best = -1, bd = infl;
        for (let ix = -1; ix <= 1; ix++) for (let iy = -1; iy <= 1; iy++) {
          const l = grid.get((gx + ix) + ":" + (gy + iy)); if (!l) continue;
          for (const i of l) { const d = Math.hypot(nodes[i].x - a.x, nodes[i].y - a.y); if (d < bd) { bd = d; best = i; } }
        }
        if (best < 0) continue;
        const v = pull.get(best) || [0, 0, 0]; v[0] += (a.x - nodes[best].x) / bd; v[1] += (a.y - nodes[best].y) / bd; v[2]++; pull.set(best, v);
      }
      const born = [];
      if (!pull.size) {
        // keine Lockpunkte in Reichweite: der Leittrieb wächst weiter nach oben
        let top = 0; nodes.forEach((n, i) => { if (n.y > nodes[top].y) top = i; });
        if (nodes[top].y < s * .98) born.push([top, 0, 1]);
      } else for (const [i, v] of pull) {
        if (nodes.length + born.length > 2600) break;
        born.push([i, v[0] / v[2], v[1] / v[2]]);
      }
      let leaderTip = 0; nodes.forEach((m, j) => { if (m.y > nodes[leaderTip].y) leaderTip = j; });
      for (const [i, vx, vy] of born) {
        const n = nodes[i];
        const apical = n.depth === nodes[i === 0 ? 0 : i].depth && i === leaderTip ? .9 : 0;
        let dx = vx + n.dx * .35 + (r() - .5) * pp.jitter * 2, dy = vy + n.dy * .35 + pp.trop + apical + (r() - .5) * pp.jitter * 2;
        const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
        const nn = { x: n.x + dx * seg, y: n.y + dy * seg, p: i, b: s, dx, dy, depth: n.depth + 1 };
        if (nn.y < .002) continue;
        nodes.push(nn);
        for (const a of att) if (!a.dead && Math.hypot(a.x - nn.x, a.y - nn.y) < kill) a.dead = true;
      }
      if (k > K && !born.length) break;
    }
    return nodes;
  }

  // ---------- Nadelbaum: Quirle ----------
  function buildWhorl(pp, r) {
    const nodes = [{ x: 0, y: 0, p: -1, b: 0, dx: 0, dy: 1, depth: 0 }];
    const N = pp.whorls, leader = [0];
    for (let i = 1; i <= N; i++) {
      const prev = leader[leader.length - 1], y = i / N;
      nodes.push({ x: (r() - .5) * .002, y, p: prev, b: y, dx: 0, dy: 1, depth: 0, leader: true }); leader.push(nodes.length - 1);
    }
    // Äste: Länge wächst mit dem Alter des Quirls, gedeckelt (ergibt den Kegel), Spitzen leicht aufgebogen
    const branches = [];
    for (let i = 2; i < N - 1; i++) {
      const base = leader[i], by = i / N;
      for (const side of [-1, 1, -.45, .45]) {
        const proj = Math.abs(side) < 1 ? .55 : 1;
        branches.push({ base, by, side: Math.sign(side), proj, back: Math.abs(side) < 1, ang: pp.angle + (r() - .5) * .2, rr: .8 + r() * .4, seed: r() });
      }
    }
    return { nodes, branches, leader };
  }

  // ---------- Markow-Kette für das Knospenschicksal ----------
  // Zustände: 0 ruhend, 1 Kurztrieb (Blattbüschel), 2 Langtrieb (Zweig mit Blättern), 3 Blüte/Frucht, 4 abgestorben
  function budFates(nodes, r, light) {
    const T = e => [
      [.38, .3 + .1 * e, .12 + .2 * e, .04 * e, .16 * (1 - e)],
      [.25, .35 + .1 * e, .2 * e, .1 * e, .1 * (1 - e)],
      [.2, .25, .35 * e + .1, .08 * e, .07 * (1 - e)],
      [.35, .3, .2 * e, .1 * e, .05],
      [.25, .15, .05, 0, .55]
    ];
    const fate = new Int8Array(nodes.length);
    for (let i = 1; i < nodes.length; i++) {
      const prev = fate[nodes[i].p], row = T(light[i])[prev], sum = row.reduce((a, b) => a + b, 0);
      let x = r() * sum, k = 0; while (k < 4 && (x -= row[k]) > 0) k++;
      fate[i] = k;
    }
    return fate;
  }

  function build(sp, seed, lightMode) {
    const pp = P[sp], r = BL.rng(seed * 7919 + sp.length * 31);
    if (pp.kind === "whorl") { const m = buildWhorl(pp, r); m.pp = pp; m.sp = sp; m.r = seed; return m; }
    const nodes = buildSCA(pp, r);
    // Kinder und Lichtgenuss (oben und außen = Sonnenseite)
    const kids = nodes.map(() => []); nodes.forEach((n, i) => { if (n.p >= 0) kids[n.p].push(i); });
    const light = nodes.map(n => BL.clamp(.25 + .55 * n.y + .5 * Math.abs(n.x) / pp.env.wMax - .15 * (lightMode === 2 ? 1 : 0), 0, 1));
    const fate = budFates(nodes, r, light);
    // Blätter: an jungen Trieben je nach Knospenschicksal, Blattstellung über Goldenen Winkel
    const leaves = [], fruits = [];
    nodes.forEach((n, i) => {
      if (i === 0 || n.depth < 3) return;
      const f = fate[i], e = light[i];
      if (f === 4 || f === 0 && r() < .5) return;
      if (f === 3) fruits.push(i);
      const count = f === 2 ? 5 + Math.floor(r() * 4) : 2 + Math.floor(r() * 3);
      const twig = f === 2 ? .012 + r() * .01 : 0;
      let tdx = n.dx + (r() - .5) * 1.2, tdy = n.dy + (r() - .5) * 1.2 - (pp.weep ? 1.6 : 0);
      const tl = Math.hypot(tdx, tdy) || 1; tdx /= tl; tdy /= tl;
      for (let k = 0; k < count; k++) {
        const q = twig ? (k + 1) / count : 0;
        const phase = pp.leaf.phyl === "distich" ? (k % 2 ? 1 : -1) * Math.PI / 2 : Math.sin(k * GOLD) * Math.PI / 2;
        const base = Math.atan2(tdx, tdy) + phase * .9 + (r() - .5) * .5;
        leaves.push({ n: i, x: n.x + tdx * twig * q, y: n.y + tdy * twig * q, ang: base + (pp.weep ? Math.PI * .85 : 0), s: .7 + r() * .6, e,
          bb: .01 + (1 - e) * .05 + r() * .03, on: .53 + r() * .1, off: 0, tone: r(), tw: twig ? i : -1 });
      }
    });
    return { nodes, kids, light, fate, leaves, fruits, pp, sp, r: seed };
  }

  // Sichtbare Teile bei Wachstumsanteil g. Selbstreinigung: Äste am Schaft unterhalb der Kronenbasis sterben ab.
  // Der Schaft endet an der ersten Zwiesel (zwei etwa gleich dicke Stämmlinge); darüber ist alles Krone.
  function visibleSCA(M, g, cbFrac, step) {
    const N = M.nodes.length, vis = new Uint8Array(N); let h = .01;
    M.nodes.forEach((n, i) => { if (n.b <= g + 1e-6) { vis[i] = 1; h = Math.max(h, n.y); } });
    const rr = pipeRadii(M, vis), top = new Float32Array(N);
    for (let i = N - 1; i >= 0; i--) if (vis[i]) { top[i] = Math.max(top[i], M.nodes[i].y); const p = M.nodes[i].p; if (p >= 0) top[p] = Math.max(top[p], top[i]); }
    // Schaft: immer zum Kind, das am höchsten hinaufführt; Ende an einer Zwiesel
    const bole = new Uint8Array(N); let cur = 0; bole[0] = 1;
    while (true) {
      const ks = M.kids[cur].filter(c => vis[c]).sort((a, b) => top[b] - top[a]);
      if (!ks.length) break;
      if (ks.length > 1 && top[ks[1]] > h * .8 && rr[ks[1]] > rr[ks[0]] * .55) break;
      cur = ks[0]; bole[cur] = 1;
    }
    const cut = cbFrac * h;
    const dead = new Uint8Array(N);
    for (let i = 1; i < N; i++) {
      if (!vis[i]) continue;
      const p = M.nodes[i].p;
      if (dead[p] || (M.prune && M.prune.deadFrom[i] <= step)) { dead[i] = 1; vis[i] = 0; continue; }
      if (!bole[i] && bole[p] && M.nodes[p].y < cut && rr[i] < rr[p] * .5) { dead[i] = 1; vis[i] = 0; }
    }
    return { vis, h };
  }
  // Selbstreinigung geht nur in eine Richtung: einmal abgeworfene Äste wachsen nicht wieder nach.
  // steps = [{ g, cb }] Jahr für Jahr; render bekommt dann v.step (Jahr) und hält sich an die Geschichte.
  function pruneHistory(M, steps) {
    M.prune = null;
    if (M.pp.kind === "whorl") {
      let g = 0, cut = 0;
      const gMax = new Float32Array(steps.length), cutMax = new Float32Array(steps.length);
      steps.forEach((st, i) => {
        g = Math.max(g, st.g);
        const h = Math.max(2, Math.floor(g * M.pp.whorls)) / M.pp.whorls, pineOld = M.pp.pine ? BL.clamp((g - .45) / .4, 0, 1) : 0;
        cut = Math.max(cut, Math.max(st.cb, pineOld * .62) * h);
        gMax[i] = g; cutMax[i] = cut;
      });
      M.prune = { gMax, cutMax };
      return;
    }
    const deadFrom = new Int32Array(M.nodes.length).fill(1e9);
    steps.forEach((st, k) => {
      const { vis } = visibleSCA(M, st.g, st.cb);
      M.nodes.forEach((n, i) => { if (!vis[i] && n.b <= st.g + 1e-6 && deadFrom[i] > k) deadFrom[i] = k; });
    });
    M.prune = { deadFrom };
  }
  function pipeRadii(M, vis) {
    const rr = new Float32Array(M.nodes.length);
    for (let i = M.nodes.length - 1; i >= 0; i--) {
      if (!vis[i]) continue;
      if (rr[i] === 0) rr[i] = 1;
      const p = M.nodes[i].p; if (p >= 0) rr[p] = Math.pow(Math.pow(rr[p], 2.4) + Math.pow(rr[i], 2.4), 1 / 2.4);
    }
    return rr;
  }

  function mix(a, b, t) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const c = k => Math.round(((pa >> k) & 255) * (1 - t) + ((pb >> k) & 255) * t);
    return `rgb(${c(16)},${c(8)},${c(0)})`;
  }
  // Farben als [r, g, b] für die natürliche Darstellung (Licht und Schatten rechnen)
  const hex = h => { const p = parseInt(h.slice(1), 16); return [p >> 16 & 255, p >> 8 & 255, p & 255]; };
  const toward = (c, d, t) => c.map((x, i) => x + (d[i] - x) * t);
  const rgba = (c, f = 1, a = 1) => `rgba(${c.map(x => Math.round(BL.clamp(x * f, 0, 255))).join(",")},${a})`;
  function leafRGB(pp, L, season) {
    const c = pp.col, sunT = L.e * .8 + L.tone * .2;
    // Saison 0 = Frühlingsbeginn, 0,75 = Winterbeginn
    const off = Math.min(.745, L.on + .07 + L.tone * .06);
    if (season < L.bb) return null;
    if (season < .12) return toward(hex(c.spring[0]), hex(c.spring[1]), sunT);
    if (season < L.on) return toward(hex(c.summer[0]), hex(c.summer[1]), sunT);
    const a = c.autumn, k = Math.floor(L.tone * a.length) % a.length;
    if (season < off) return toward(hex(c.summer[0]), hex(a[k]), BL.clamp((season - L.on) / (off - L.on) * 1.6, 0, 1));
    return null;
  }
  function leafColor(pp, L, season) { const c = leafRGB(pp, L, season); return c && rgba(c); }

  // ---------- Zeichnen ----------
  // v: { cx, gy, Hpx, g, season, trunkPx, cb, dead (0..1 Kronenverlust), snag, dark, leaves (bool),
  //      real (natürliche Darstellung statt Schema), sunX (-1 Sonne links … 1 rechts) }
  function render(ctx, M, v) {
    if (M.pp.kind === "whorl") return renderWhorl(ctx, M, v);
    if (v.real) return renderReal(ctx, M, v);
    const { vis, h } = visibleSCA(M, v.g, v.cb, v.step ?? -1);
    const rr = pipeRadii(M, vis), r0 = rr[0] || 1, k = v.Hpx / h;
    const X = n => v.cx + n.x * k, Y = n => v.gy - n.y * k;
    const pp = M.pp, snagH = v.snag ? .55 * h : 9;
    ctx.save(); ctx.lineCap = "round";
    // Äste vom dicksten zum dünnsten
    for (let i = 1; i < M.nodes.length; i++) {
      if (!vis[i]) continue;
      const n = M.nodes[i], p = M.nodes[n.p];
      if (v.snag && (n.y > snagH || rr[i] < r0 * .05)) continue;
      const w = Math.max(.5, v.trunkPx * rr[i] / r0);
      ctx.strokeStyle = M.sp === "birke" && w > Math.max(3, v.trunkPx * .3) ? (v.dark ? "#d8d8d2" : "#ececE6") : M.sp === "birke" ? "#5a3f36" : rr[i] / r0 < .04 ? "#6e5a48" : pp.bark;
      ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(X(p), Y(p)); ctx.lineTo(X(n), Y(n)); ctx.stroke();
    }
    if (M.sp === "birke") {
      ctx.strokeStyle = "#222"; ctx.lineWidth = 1;
      for (let i = 0; i < 14; i++) { const yy = v.gy - v.Hpx * (.02 + i * .03), w = v.trunkPx * .4; ctx.beginPath(); ctx.moveTo(v.cx - w * ((i * 37) % 7) / 7, yy); ctx.lineTo(v.cx + w * .3, yy - 1); ctx.stroke(); }
    }
    let half = 0;
    if (v.leaves && !v.snag) {
      const leafPx = BL.clamp(v.Hpx * .028, 2.6, 16) * pp.leaf.len;
      // weinende Birkenzweige
      if (pp.weep) {
        ctx.strokeStyle = "rgba(90,70,50,.55)"; ctx.lineWidth = .6;
        const seen = new Set();
        for (const L of M.leaves) { if (L.tw < 0 || seen.has(L.tw) || !vis[L.n]) continue; seen.add(L.tw); const n = M.nodes[L.n]; ctx.beginPath(); ctx.moveTo(X(n), Y(n)); ctx.lineTo(X(n) + Math.sin(n.x * 40) * 2, Y(n) + leafPx * 3.2); ctx.stroke(); }
      }
      // Schattenblätter zuerst, Sonnenblätter oben
      // nur junges Holz trägt Blätter, im Inneren der Krone ist es kahl
      const hasKid = new Uint8Array(M.nodes.length); for (let i = 1; i < M.nodes.length; i++) if (vis[i]) hasKid[M.nodes[i].p] = 1;
      const list = M.leaves.filter(L => vis[L.n] && (!hasKid[L.n] || M.nodes[L.n].b >= v.g - .45) && !(v.dead && ((L.n * 7919) % 100) / 100 < v.dead));
      list.sort((a, b) => a.e - b.e);
      // Laubmasse: weiche, dunklere Schattenschicht unter den Blättern gibt der Krone Volumen
      ctx.globalAlpha = .28;
      for (let j = 0; j < list.length; j += 2) {
        const L = list[j], col = leafColor(pp, L, v.season); if (!col) continue;
        ctx.fillStyle = mix(pp.col.summer[0], "#10200c", .45);
        if (v.season >= L.on) ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(v.cx + L.x * k, v.gy - L.y * k + leafPx * .4, leafPx * (1.5 + L.s * .6), 0, 7); ctx.fill();
      }
      ctx.globalAlpha = 1;
      for (const L of list) {
        const col = leafColor(pp, L, v.season); if (!col) continue;
        const x = v.cx + L.x * k + (pp.weep ? Math.sin(L.ang) * leafPx * 1.4 : 0), y = v.gy - L.y * k + (pp.weep ? leafPx * 1.6 * L.s : 0);
        const len = leafPx * L.s;
        ctx.fillStyle = col; ctx.save(); ctx.translate(x, y); ctx.rotate(L.ang);
        ctx.beginPath();
        if (pp.leaf.lobed && len > 3.5) { for (let j = 0; j < 3; j++) ctx.ellipse(0, -len * (.25 + j * .28), len * pp.leaf.a * (.55 + .2 * (j % 2)), len * .2, 0, 0, 7); }
        else ctx.ellipse(0, -len * .5, len * pp.leaf.a * .5, len * .5, 0, 0, 7);
        ctx.fill(); ctx.restore();
        half = Math.max(half, Math.abs(x - v.cx));
      }
      // Früchte im Herbst
      if (v.season > .45 && v.season < .7 && v.g > .35) {
        ctx.fillStyle = pp.fruit;
        for (const i of M.fruits) if (vis[i]) { const n = M.nodes[i]; ctx.beginPath(); ctx.arc(X(n) + 1, Y(n) + 3, Math.max(1.4, leafPx * .3), 0, 7); ctx.fill(); }
      }
    }
    ctx.restore();
    if (!half) M.nodes.forEach((n, i) => { if (vis[i]) half = Math.max(half, Math.abs(X(n) - v.cx)); });
    return { half, h, vis, k };
  }

  // Blattform als Pfad um den Ursprung, Spitze nach oben
  function leafPath(ctx, pp, len) {
    if (pp.leaf.lobed && len > 3.5) { for (let j = 0; j < 3; j++) ctx.ellipse(0, -len * (.25 + j * .28), len * pp.leaf.a * (.55 + .2 * (j % 2)), len * .2, 0, 0, 7); }
    else ctx.ellipse(0, -len * .5, len * pp.leaf.a * .5, len * .5, 0, 0, 7);
  }

  // Natürliche Darstellung: Rinde mit Licht- und Schattenseite, Blätter in Büscheln, beleuchtet von der Sonnenseite,
  // Schnee auf waagerechten Ästen im Winter.
  function renderReal(ctx, M, v) {
    const { vis, h } = visibleSCA(M, v.g, v.cb, v.step ?? -1);
    const rr = pipeRadii(M, vis), r0 = rr[0] || 1, k = v.Hpx / h;
    const X = n => v.cx + n.x * k, Y = n => v.gy - n.y * k;
    const pp = M.pp, snagH = v.snag ? .55 * h : 9, birch = M.sp === "birke";
    const sunX = v.sunX ?? -.6, rnd = BL.rng(M.r * 17 + 3), snow = v.season >= .8 && v.season < .97;
    const bark = hex(pp.bark), twig = hex("#5b4a3c"), white = [236, 234, 226];
    const barkOf = w => birch ? (w > Math.max(3, v.trunkPx * .3) ? white : hex("#4e3a32")) : w < Math.max(1.2, v.trunkPx * .05) ? twig : bark;
    ctx.save(); ctx.lineCap = "round"; ctx.lineJoin = "round";
    // Wurzelanlauf am Stammfuß
    const tw = v.trunkPx;
    if (tw > 3) {
      ctx.fillStyle = rgba(barkOf(tw), .7);
      ctx.beginPath(); ctx.moveTo(v.cx - tw * 1.15, v.gy + 1);
      ctx.quadraticCurveTo(v.cx - tw * .5, v.gy - tw * .15, v.cx - tw * .5, v.gy - tw * 1.3); ctx.lineTo(v.cx + tw * .5, v.gy - tw * 1.3);
      ctx.quadraticCurveTo(v.cx + tw * .5, v.gy - tw * .15, v.cx + tw * 1.15, v.gy + 1); ctx.fill();
    }
    const segs = [];
    for (let i = 1; i < M.nodes.length; i++) {
      if (!vis[i]) continue;
      const n = M.nodes[i];
      if (v.snag && (n.y > snagH || rr[i] < r0 * .05)) continue;
      const p = M.nodes[n.p], x0 = X(p), y0 = Y(p), x1 = X(n), y1 = Y(n), L = Math.hypot(x1 - x0, y1 - y0) || 1;
      // Normale zur Sonnenseite (oben, Richtung Sonne)
      let nx = -(y1 - y0) / L, ny = (x1 - x0) / L;
      if (nx * sunX - ny < 0) { nx = -nx; ny = -ny; }
      segs.push({ x0, y0, x1, y1, w: Math.max(.5, v.trunkPx * rr[i] / r0), nx, ny, horiz: Math.abs(x1 - x0) / L });
    }
    // Schattenton, dann die schmalere Lichtseite darüber
    for (const s of segs) { ctx.strokeStyle = rgba(barkOf(s.w), birch && s.w > 3 ? .78 : .62); ctx.lineWidth = s.w; ctx.beginPath(); ctx.moveTo(s.x0, s.y0); ctx.lineTo(s.x1, s.y1); ctx.stroke(); }
    for (const s of segs) {
      if (s.w < 1.6) continue;
      const o = s.w * .2; ctx.strokeStyle = rgba(barkOf(s.w), birch && s.w > 3 ? 1.04 : 1.12); ctx.lineWidth = s.w * .5;
      ctx.beginPath(); ctx.moveTo(s.x0 + s.nx * o, s.y0 + s.ny * o); ctx.lineTo(s.x1 + s.nx * o, s.y1 + s.ny * o); ctx.stroke();
    }
    // Borke: Längsrisse auf dicken Ästen, bei der Birke schwarze Querbänder
    ctx.lineCap = "butt";
    for (const s of segs) {
      if (s.w < 6) continue;
      if (birch) {
        if (s.w < v.trunkPx * .45 || rnd() > .55) continue;
        ctx.strokeStyle = "rgba(30,26,24,.85)"; ctx.lineWidth = Math.max(1, s.w * .1);
        const mx = (s.x0 + s.x1) / 2, my = (s.y0 + s.y1) / 2, l = s.w * (.25 + rnd() * .3), q = (rnd() - .5) * s.w * .4;
        ctx.beginPath(); ctx.moveTo(mx + q - l / 2, my); ctx.lineTo(mx + q + l / 2, my - 1); ctx.stroke();
        continue;
      }
      ctx.strokeStyle = rgba(bark, .42, .55); ctx.lineWidth = Math.max(.7, s.w * .06); ctx.setLineDash([s.w * .9, s.w * .5]);
      for (const f of [-.28, .05, .32]) { const o = s.w * f; ctx.beginPath(); ctx.moveTo(s.x0 + s.nx * o, s.y0 + s.ny * o); ctx.lineTo(s.x1 + s.nx * o, s.y1 + s.ny * o); ctx.stroke(); }
      ctx.setLineDash([]);
    }
    ctx.lineCap = "round";
    // Feine Zweige an den Triebspitzen: im Winter sieht man die Feinverzweigung
    const hasKid = new Uint8Array(M.nodes.length); for (let i = 1; i < M.nodes.length; i++) if (vis[i]) hasKid[M.nodes[i].p] = 1;
    const leafPx = BL.clamp(v.Hpx * .028, 2.6, 16) * pp.leaf.len;
    if (!v.snag) {
      ctx.strokeStyle = rgba(birch ? hex("#4e3a32") : twig, .9, .85); ctx.lineWidth = .6;
      for (let i = 1; i < M.nodes.length; i++) {
        if (!vis[i] || hasKid[i]) continue;
        const n = M.nodes[i], x = X(n), y = Y(n), l = leafPx * (birch ? 2.2 : 1.4);
        for (const a of [-.45, .4]) {
          const dx = n.dx * Math.cos(a) - n.dy * Math.sin(a), dy = n.dx * Math.sin(a) + n.dy * Math.cos(a);
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + dx * l, y - dy * l + (birch ? l * .8 : 0)); ctx.stroke();
        }
      }
    }
    if (snow) {
      ctx.strokeStyle = "rgba(246,249,252,.92)";
      for (const s of segs) {
        if (s.w < 1.2 || s.horiz < .45) continue;
        const o = s.w * .45; ctx.lineWidth = Math.max(.8, s.w * .35);
        ctx.beginPath(); ctx.moveTo(s.x0, s.y0 - o); ctx.lineTo(s.x1, s.y1 - o); ctx.stroke();
      }
    }
    let half = 0;
    if (v.leaves && !v.snag) {
      if (pp.weep) {
        ctx.strokeStyle = "rgba(78,58,50,.5)"; ctx.lineWidth = .6;
        const seen = new Set();
        for (const L of M.leaves) { if (L.tw < 0 || seen.has(L.tw) || !vis[L.n]) continue; seen.add(L.tw); const n = M.nodes[L.n]; ctx.beginPath(); ctx.moveTo(X(n), Y(n)); ctx.quadraticCurveTo(X(n) + Math.sin(n.x * 40) * 3, Y(n) + leafPx, X(n) + Math.sin(n.x * 40) * 2, Y(n) + leafPx * 3.2); ctx.stroke(); }
      }
      // unten bleibt der Stamm frei sichtbar
      const list = M.leaves.filter(L => vis[L.n] && L.y > h * .17 && (!hasKid[L.n] || M.nodes[L.n].b >= v.g - .45) && !(v.dead && ((L.n * 7919) % 100) / 100 < v.dead));
      list.sort((a, b) => a.e - b.e);
      // Blätter sitzen nicht auf dem Ast, sondern rund um die Triebe verteilt: so wird die Krone voll
      const P = list.map(L => {
        const a = L.ang * 2.3 + L.tone * 6.283, d = leafPx * 2.4 * Math.sqrt((L.tone * 7.7 + L.s) % 1);
        return [v.cx + L.x * k + Math.cos(a) * d + (pp.weep ? Math.sin(L.ang) * leafPx * 1.4 : 0), v.gy - L.y * k + Math.sin(a) * d * .8 + (pp.weep ? leafPx * 1.6 * L.s : 0)];
      });
      // Kronenausdehnung für die Beleuchtung
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const [x, y] of P) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      const ccx = (x0 + x1) / 2, ccy = (y0 + y1) / 2, rx = Math.max(4, (x1 - x0) / 2), ry = Math.max(4, (y1 - y0) / 2);
      const lx = sunX * .8, ly = -.75, ll = Math.hypot(lx, ly);
      // Laubmasse in zwei Schichten: tiefer Schatten im Kroneninneren, darüber das zur Sonne hin hellere Volumen.
      // Deckend gezeichnet, damit die Krone als geschlossene, wolkige Form erscheint und nicht als Perlenkette.
      const mass = (rad, f, shift) => {
        for (let j = 0; j < list.length; j++) {
          const L = list[j], col = leafRGB(pp, L, v.season); if (!col) continue;
          const [x, y] = P[j], dot = ((x - ccx) / rx * lx + (y - ccy) / ry * ly) / ll;
          ctx.fillStyle = rgba(col, f * (1 + .35 * dot));
          ctx.beginPath(); ctx.arc(x - sunX * shift, y + Math.abs(shift), leafPx * rad * (.8 + L.s * .4), 0, 7); ctx.fill();
        }
      };
      mass(1.7, .38, leafPx * .5);
      mass(1.45, .62, -leafPx * .25);
      for (let j = 0; j < list.length; j++) {
        const L = list[j], col = leafRGB(pp, L, v.season); if (!col) continue;
        const [x, y] = P[j], dot = ((x - ccx) / rx * lx + (y - ccy) / ry * ly) / ll;
        const lit = BL.clamp(.78 + .45 * dot + .3 * (L.e - .5) + (rnd() - .5) * .3, .35, 1.55);
        const len = leafPx * L.s;
        // ein Büschel aus drei Blättern
        for (let c = 0; c < 3; c++) {
          const ox = c ? (rnd() - .5) * len * 1.1 : 0, oy = c ? (rnd() - .5) * len * .9 : 0;
          ctx.fillStyle = rgba(col, lit * (1 - c * .07));
          ctx.save(); ctx.translate(x + ox, y + oy); ctx.rotate(L.ang + (c ? (rnd() - .5) * 1.6 : 0));
          ctx.beginPath(); leafPath(ctx, pp, len * (c ? .8 : 1)); ctx.fill(); ctx.restore();
        }
        // Glanzlicht auf sonnigen Blättern
        if (lit > 1.15 && len > 3) { ctx.fillStyle = rgba(col, 1.45, .55); ctx.beginPath(); ctx.ellipse(x - len * .12, y - len * .5, len * .18, len * .28, L.ang, 0, 7); ctx.fill(); }
        half = Math.max(half, Math.abs(x - v.cx));
      }
      if (v.season > .45 && v.season < .7 && v.g > .35) {
        const f = hex(pp.fruit);
        for (const i of M.fruits) if (vis[i]) {
          const n = M.nodes[i], fr = Math.max(1.4, leafPx * .3);
          ctx.fillStyle = rgba(f); ctx.beginPath(); ctx.arc(X(n) + 1, Y(n) + 3, fr, 0, 7); ctx.fill();
          ctx.fillStyle = rgba(f, 1.6, .7); ctx.beginPath(); ctx.arc(X(n) + 1 - fr * .3, Y(n) + 3 - fr * .3, fr * .35, 0, 7); ctx.fill();
        }
      }
    }
    ctx.restore();
    if (!half) M.nodes.forEach((n, i) => { if (vis[i]) half = Math.max(half, Math.abs(X(n) - v.cx)); });
    return { half, h, vis, k };
  }

  function renderWhorl(ctx, M, v) {
    const pp = M.pp, r = BL.rng(M.r * 13 + 1), N = pp.whorls;
    const topI = Math.max(2, Math.floor(v.g * N)), h = topI / N, k = v.Hpx / h;
    const hist = M.prune && M.prune.gMax && v.step >= 0 ? Math.min(v.step, M.prune.gMax.length - 1) : -1;
    const gOld = hist >= 0 ? Math.max(v.g, M.prune.gMax[hist]) : v.g;
    const pineOld = pp.pine ? BL.clamp((gOld - .45) / .4, 0, 1) : 0;
    const cbFrac = Math.max(v.cb, pineOld * .62, hist >= 0 ? M.prune.cutMax[hist] / h : 0);
    const X = x => v.cx + x * k, Y = y => v.gy - y * k;
    const real = v.real, sunX = v.sunX ?? -.6, snow = real && v.season >= .8 && v.season < .97;
    ctx.save(); ctx.lineCap = "round";
    // Stamm, verjüngt sich zur Spitze
    const topY = v.snag ? h * .55 : h;
    for (let i = 0; i < topI; i++) {
      const y0 = i / N, y1 = (i + 1) / N; if (y0 > topY) break;
      const col = pp.pine && y0 > h * .45 ? pp.bark : pp.barkLow || pp.bark, w = Math.max(1, v.trunkPx * (1 - y0 / h * .9));
      ctx.strokeStyle = real ? rgba(hex(col), .68) : col;
      ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(v.cx, Y(y0)); ctx.lineTo(v.cx, Y(y1) - .5); ctx.stroke();
      if (real && w > 2) { const o = sunX * w * .2; ctx.strokeStyle = rgba(hex(col), 1.12); ctx.lineWidth = w * .45; ctx.beginPath(); ctx.moveTo(v.cx + o, Y(y0)); ctx.lineTo(v.cx + o, Y(y1) - .5); ctx.stroke(); }
    }
    let half = 0;
    const ends = [];
    const sorted = M.branches.slice().sort((a, b) => (b.back ? 1 : 0) - (a.back ? 1 : 0));
    for (const b of sorted) {
      if (b.by > h - .5 / N) continue;
      if (pp.pine && b.seed < pineOld * .45) continue;
      const age = (h - b.by);
      if (b.by < cbFrac * h) {
        // abgestorbene untere Äste als graue Stummel
        if (!v.leaves || b.back || b.by < h * .08) continue;
        ctx.strokeStyle = "rgba(130,120,108,.7)"; ctx.lineWidth = 1;
        const l = Math.min(.03, age * .3) * k; ctx.beginPath(); ctx.moveTo(v.cx, Y(b.by)); ctx.lineTo(v.cx + b.side * l, Y(b.by) + l * .3); ctx.stroke();
        continue;
      }
      if (v.snag) continue;
      let len = Math.min(pp.lenCap * b.rr, age * .75) * b.proj;
      let ang = b.ang;
      if (pp.pine) { len *= 1 + pineOld * 1.1 * (b.by / h); ang -= pineOld * .5; }
      // Astverlauf: erst abwärts (Gewicht), Spitze aufgebogen
      const steps = 8, pts = [[0, b.by]];
      for (let s = 1; s <= steps; s++) {
        const t = s / steps, droop = pp.droop * len * (t * t - .6 * Math.pow(t, 3.5));
        pts.push([b.side * Math.sin(ang) * len * t, b.by + Math.cos(ang) * len * t - droop]);
      }
      const w = Math.max(.7, v.trunkPx * .22 * Math.sqrt(len / pp.lenCap));
      // Sonnenseite heller, hintere Äste im Schatten
      const lit = real ? (b.back ? .62 : 1) * (b.side * sunX < 0 ? 1.12 : .86) : 1;
      ctx.strokeStyle = real ? rgba(hex("#5e4836"), lit) : b.back ? "#4a3a2c" : "#5e4836"; ctx.lineWidth = w;
      ctx.beginPath(); ctx.moveTo(X(pts[0][0]), Y(pts[0][1])); for (const p of pts) ctx.lineTo(X(p[0]), Y(p[1])); ctx.stroke();
      ends.push(pts.map(p => [X(p[0]), Y(p[1])]));
      if (!v.leaves) continue;
      const col = v.dead && b.seed < v.dead ? null : (b.back ? pp.needle[0] : pp.needle[1]);
      if (!col) continue;
      if (real) { needlesReal(ctx, pp, b, pts, len, X, Y, k, lit, snow, pineOld); half = Math.max(half, Math.abs(X(pts[steps][0]) - v.cx)); continue; }
      if (pp.twig === "hang") {
        // Fichte: Zweige hängen kammartig herab, benadelt
        ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineCap = "round";
        const th = Math.max(2.5, k * .016);
        ctx.beginPath(); ctx.moveTo(X(pts[1][0]), Y(pts[1][1]) - th * .4);
        for (const p of pts.slice(2)) ctx.lineTo(X(p[0]), Y(p[1]) - th * .4);
        for (const p of pts.slice(1).reverse()) { const q = (p[1] - b.by) / Math.max(.001, len); ctx.lineTo(X(p[0]), Y(p[1]) + th * (1.1 + .6 * Math.abs(p[0]) / Math.max(.001, len))); }
        ctx.closePath(); ctx.fill();
        ctx.lineWidth = Math.max(.8, k * .003);
        for (let s = 3; s <= steps; s++) {
          const [px, py] = pts[s], hang = (.3 + .4 * s / steps) * len * .16 * (.6 + ((s * 7 + b.seed * 10) % 3) * .25);
          ctx.beginPath(); ctx.moveTo(X(px), Y(py)); ctx.lineTo(X(px) + b.side * .8, Y(py) + th + hang * k); ctx.stroke();
        }
      } else {
        // Kiefer: Nadelbüschel an den Zweigenden
        const cr = BL.rng(Math.floor(b.seed * 1e6));
        for (let s = 4; s <= steps; s += 2) {
          const [px, py] = pts[s], rad = Math.max(1.6, k * .007) * (1 + pineOld * .8);
          for (let j = 0; j < 6; j++) {
            ctx.fillStyle = j % 3 ? col : pp.needle[0];
            ctx.beginPath(); ctx.ellipse(X(px) + (cr() - .5) * rad * 3, Y(py) - rad * .6 + (cr() - .6) * rad * 2, rad * (1 + cr()), rad * (.6 + cr() * .4), (cr() - .5) * .8, 0, 7); ctx.fill();
          }
        }
      }
      half = Math.max(half, Math.abs(X(pts[steps][0]) - v.cx));
    }
    // Spitze
    if (v.leaves && !v.snag) { ctx.fillStyle = real ? rgba(hex(pp.needle[1]), 1.1) : pp.needle[1]; ctx.beginPath(); ctx.moveTo(v.cx, Y(h) - 4); ctx.lineTo(v.cx - 3, Y(h - 1.5 / N)); ctx.lineTo(v.cx + 3, Y(h - 1.5 / N)); ctx.fill(); }
    // Zapfen
    if (v.leaves && v.g > .3 && v.season > .4 && v.season < .9) {
      ctx.fillStyle = pp.pine ? "#7a6248" : "#8a5a36";
      for (let i = 0; i < ends.length; i += 5) { const e = ends[i][ends[i].length - 1]; if (pp.pine || ends[i][0][1] < Y(h * .7)) { ctx.beginPath(); ctx.ellipse(e[0], e[1] + 4, 1.8, pp.pine ? 2.6 : 4.5, 0, 0, 7); ctx.fill(); } }
    }
    ctx.restore();
    return { half, h, ends, k };
  }

  // Benadelung in der natürlichen Darstellung. Fichte: Zweigvorhang mit Verlauf (oben Licht, unten Schatten)
  // und einzelnen Nadelstrichen; Kiefer: Nadelbüschel, die strahlenförmig aus dem Zweigende stehen.
  function needlesReal(ctx, pp, b, pts, len, X, Y, k, lit, snow, pineOld) {
    const dark = hex(pp.needle[0]), light = hex(pp.needle[1]), cr = BL.rng(Math.floor(b.seed * 1e6) + 1), steps = pts.length - 1;
    ctx.lineCap = "round";
    if (pp.twig === "hang") {
      const th = Math.max(2.5, k * .016);
      const top = Y(pts[1][1]) - th, bot = Y(pts[steps][1]) + th * 2;
      const g = ctx.createLinearGradient(0, Math.min(top, bot) - th, 0, Math.max(top, bot) + th);
      g.addColorStop(0, rgba(light, lit * 1.05)); g.addColorStop(1, rgba(dark, lit * .6));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(X(pts[1][0]), Y(pts[1][1]) - th * .4);
      for (const p of pts.slice(2)) ctx.lineTo(X(p[0]), Y(p[1]) - th * .4);
      for (const p of pts.slice(1).reverse()) ctx.lineTo(X(p[0]), Y(p[1]) + th * (1.1 + .6 * Math.abs(p[0] - pts[0][0]) / Math.max(.001, len)));
      ctx.closePath(); ctx.fill();
      // herabhängende Seitenzweige mit Nadeln
      ctx.lineWidth = Math.max(.6, k * .0022);
      for (let s = 2; s <= steps; s++) {
        const [px, py] = pts[s];
        for (let j = 0; j < 4; j++) {
          const hang = (.3 + .5 * s / steps) * len * .17 * (.5 + cr()), x = X(px) + (cr() - .5) * th, y = Y(py);
          ctx.strokeStyle = rgba(cr() < .5 ? dark : light, lit * (.65 + cr() * .45));
          ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + b.side * th * .6, y + th, x + b.side * th * .3, y + th + hang * k); ctx.stroke();
        }
      }
      // Nadelstriche entlang der Oberkante fangen das Licht
      ctx.lineWidth = Math.max(.5, k * .0016);
      for (let s = 1; s <= steps; s++) {
        const [px, py] = pts[s];
        for (let j = 0; j < 5; j++) {
          const a = -Math.PI / 2 + (cr() - .5) * 2.2, l = th * (.6 + cr() * .7), x = X(px) + (cr() - .5) * th * 1.5, y = Y(py) - th * .2;
          ctx.strokeStyle = rgba(light, lit * (1 + cr() * .35), .85);
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
        }
      }
      if (snow) {
        ctx.strokeStyle = "rgba(246,249,252,.92)"; ctx.lineWidth = th * .6;
        ctx.beginPath(); ctx.moveTo(X(pts[1][0]), Y(pts[1][1]) - th * .6); for (const p of pts.slice(2, steps)) ctx.lineTo(X(p[0]), Y(p[1]) - th * .6); ctx.stroke();
      }
      return;
    }
    // Kiefer
    for (let s = 4; s <= steps; s += 2) {
      const [px, py] = pts[s], rad = Math.max(2, k * .011) * (1 + pineOld * .8), cx = X(px), cy = Y(py) - rad * .5;
      ctx.fillStyle = rgba(dark, lit * .55); ctx.beginPath(); ctx.ellipse(cx + rad * .3, cy + rad * .5, rad * 2, rad * 1.1, 0, 0, 7); ctx.fill();
      ctx.lineWidth = Math.max(.5, rad * .16);
      for (let j = 0; j < 16; j++) {
        const a = -Math.PI / 2 + (cr() - .5) * 2.9, l = rad * (1.3 + cr() * 1.1);
        ctx.strokeStyle = rgba(cr() < .4 ? dark : light, lit * (.8 + cr() * .5));
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * l, cy + Math.sin(a) * l * .8); ctx.stroke();
      }
      if (snow) { ctx.fillStyle = "rgba(246,249,252,.9)"; ctx.beginPath(); ctx.ellipse(cx, cy - rad * .9, rad * 1.4, rad * .45, 0, 0, 7); ctx.fill(); }
    }
  }

  // Wege für Wasser und Zucker: Stammfuß → Hauptpfad → Blatt
  function flowPaths(M, v, res, n = 12) {
    if (M.pp.kind === "whorl") return res.ends.filter((_, i) => i % 3 === 0).slice(0, n).map(e => [[v.cx, v.gy], [v.cx, e[0][1]], ...e]);
    const out = [], { vis, k } = res;
    const tips = M.leaves.filter(L => vis[L.n] && L.e > .5);
    for (let j = 0; j < n && tips.length; j++) {
      const L = tips[Math.floor((j * 2654435761 % 4294967296) / 4294967296 * tips.length)];
      const chain = []; for (let i = L.n; i >= 0; i = M.nodes[i].p) chain.push([v.cx + M.nodes[i].x * k, v.gy - M.nodes[i].y * k]);
      out.push(chain.reverse());
    }
    return out;
  }
  return { build, render, flowPaths, pruneHistory, params: P };
})();
