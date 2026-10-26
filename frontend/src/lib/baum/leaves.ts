// @ts-nocheck
/* eslint-disable */
// Baumleben: aus der eigenständigen Fassung übernommen, ungeprüftes JavaScript.
import { BL } from "./bl";
/* Blattschemata als SVG. Alle Koordinaten in cm, y zeigt nach oben negativ. BL.leafSVG(spec) liefert einen SVG-String. */
(function () {
  const PI = Math.PI;
  const f2 = n => Math.round(n * 100) / 100;
  const path = pts => "M" + pts.map(p => f2(p[0]) + " " + f2(p[1])).join("L") + "Z";
  const smooth = (x, a, b) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  // halbe Blattbreite (0..1) entlang der Mittelrippe, t: 0 = Grund, 1 = Spitze
  const SHAPES = {
    ellipse: { m: .5, a: .85, b: .9 }, ovate: { m: .38, a: .7, b: 1 }, obovate: { m: .64, a: 1.1, b: .7 },
    lance: { m: .33, a: .7, b: 1.4 }, oblong: { m: .5, a: .45, b: .6 }, heart: { m: .3, a: .4, b: 1, w0: .55 },
    round: { m: .48, a: .55, b: .6, w0: .2 }, rhomb: { m: .33, lin: true, w0: .05 }
  };
  function width(spec, t) {
    const s = SHAPES[spec.shape] || SHAPES.ellipse;
    let w;
    if (s.lin) w = t < s.m ? s.w0 + (1 - s.w0) * t / s.m : (1 - t) / (1 - s.m);
    else w = t < s.m ? (s.w0 || 0) + (1 - (s.w0 || 0)) * Math.pow(Math.sin(PI / 2 * t / s.m), s.a)
                     : Math.pow(Math.max(0, Math.cos(PI / 2 * Math.min(1, (t - s.m) / (1 - s.m)))), s.b);
    if (spec.tip === "acuminate" && t > .8) w *= Math.pow((1 - t) / .2, .9) * (t > .8 ? 1 : 1);
    if (spec.tip === "round" && t > .85) w = Math.max(w, Math.sqrt(Math.max(0, 1 - Math.pow((t - .85) / .15, 2))) * width({ ...spec, tip: "" }, .85));
    return Math.max(0, w);
  }

  // Zähne am Rand: Versatz nach außen in Abhängigkeit der Bogenlänge
  function tooth(margin, s, L) {
    const per = { serrate: L * .045, double: L * .04, crenate: L * .09, wavy: L * .28, spiny: L * .055, entire: 1 }[margin] || 1;
    const amp = { serrate: L * .018, double: L * .016, crenate: L * .025, wavy: L * .02, spiny: L * .03, entire: 0 }[margin] || 0;
    const u = (s / per) % 1;
    if (margin === "serrate") return amp * Math.pow(u, 2.2);
    if (margin === "spiny") return amp * Math.pow(u, 5) * 1.4;
    if (margin === "double") { const big = Math.floor(s / per) % 3 === 2 ? 1.9 : 1; return amp * big * Math.pow(u, 2); }
    if (margin === "crenate") return amp * Math.sin(PI * u);
    if (margin === "wavy") return amp * Math.sin(2 * PI * u);
    return 0;
  }

  // Umriss eines einfachen Blattes, Grund im Ursprung, Spitze bei (0,-L)
  function simpleOutline(spec, L, mirrorAsym = true) {
    const W = spec.W * L / 2, N = 140, right = [], left = [];
    const lobes = spec.lobes || 0;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      let w = width(spec, t);
      if (lobes) {
        const lob = .5 - .5 * Math.cos(2 * PI * (lobes - .5) * (1 - t) + PI);
        w *= 1 - spec.depth * lob * smooth(t, .02, .15) * (1 - smooth(t, .9, 1) * .6);
        if (spec.aur) w += .28 * Math.exp(-Math.pow((t - .03) / .045, 2));
      }
      let y = -t * L;
      if (spec.shape === "heart") y += L * .16 * Math.pow(Math.max(0, 1 - t / .3), 2);
      if (spec.shape === "round") y += L * .05 * Math.pow(Math.max(0, 1 - t / .2), 2);
      right.push([w * W, y]);
      const a = spec.asym || 0;
      left.push([-w * W * (1 - a * .4 * (1 - t)), y - a * L * .5 * Math.pow(Math.max(0, 1 - t / .35), 2)]);
    }
    if (spec.tip === "notch") { right.push([0, -L * .86]); }
    // Zähne entlang der Normalen
    const addTeeth = (pts, sign) => {
      if (!spec.margin || spec.margin === "entire") return pts;
      let s = 0; const out = [];
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i], q = pts[Math.min(pts.length - 1, i + 1)], o = pts[Math.max(0, i - 1)];
        if (i) s += Math.hypot(p[0] - o[0], p[1] - o[1]);
        let nx = q[1] - o[1], ny = -(q[0] - o[0]); const nl = Math.hypot(nx, ny) || 1;
        nx = nx / nl * sign; ny = ny / nl * sign;
        const t = i / pts.length, fade = smooth(t, .05, .2) * (1 - smooth(t, .93, 1));
        const d = tooth(spec.margin, s, L) * fade;
        out.push([p[0] + nx * d, p[1] + ny * d]);
      }
      return out;
    };
    const R = addTeeth(right, 1), Lf = addTeeth(left, -1);
    return [[0, 0], ...R, ...Lf.reverse()];
  }

  function veins(spec, L, out) {
    const W = spec.W * L / 2, n = spec.veins || 6;
    let d = `M0 0L0 ${f2(-L * .97)}`;
    const ts = [];
    if (spec.lobes) for (let k = 0; k < spec.lobes; k++) ts.push(1 - (k + .5) / (spec.lobes - .5) * .95);
    else for (let k = 1; k <= n; k++) ts.push(k / (n + 1) * .92);
    for (const t of ts) {
      if (t < .04 || t > .97) continue;
      const t2 = Math.min(.99, t + (spec.lobes ? .03 : .07));
      const w = width(spec, t2) * W * (spec.lobes ? 1 : .86);
      const y0 = -t * L, y1 = -t2 * L;
      d += `M0 ${f2(y0)}Q${f2(w * .5)} ${f2(y0 - (y0 - y1) * .3)} ${f2(w)} ${f2(y1)}`;
      d += `M0 ${f2(y0)}Q${f2(-w * .5)} ${f2(y0 - (y0 - y1) * .3)} ${f2(-w)} ${f2(y1)}`;
    }
    out.push(`<path d="${d}" class="lf-vein"/>`);
  }

  function simpleLeaf(spec, out, tf = "") {
    const L = spec.L, pet = spec.pet || 0;
    const g = [];
    g.push(`<path d="${path(simpleOutline(spec, L))}" class="${spec.silver ? "lf-fill lf-silver" : "lf-fill"}"/>`);
    veins(spec, L, g);
    if (spec.fold) g.push(`<path d="${path(simpleOutline({ ...spec, margin: "entire", W: spec.W * .02 }, L))}" class="lf-vein"/>`);
    if (pet) g.push(`<path d="M0 0L0 ${f2(pet)}" class="lf-pet"/>`);
    if (spec.glands) g.push(`<circle cx="-.18" cy=".45" r=".14" class="lf-gland"/><circle cx=".18" cy=".6" r=".14" class="lf-gland"/>`);
    out.push(`<g${tf ? ` transform="${tf}"` : ""}>${g.join("")}</g>`);
    return { minX: -spec.W * L / 2 - .5, maxX: spec.W * L / 2 + .5, minY: -L - .3, maxY: pet + .3 };
  }

  function palmLeaf(spec, out) {
    const R = spec.R, N = 720, pts = [], lob = spec.lobes, wd = 70 * spec.sharp;
    for (let i = 0; i <= N; i++) {
      const th = -180 + 360 * i / N;
      let r = spec.sinus;
      for (const [a, l, w2] of lob) {
        const k = Math.max(0, 1 - Math.abs(th - a) / (w2 || wd));
        r = Math.max(r, spec.sinus + (l - spec.sinus) * Math.pow(k, spec.round ? .45 : 1.15));
      }
      if (spec.teeth) { const u = (i * spec.nteeth / N) % 1; r += spec.teeth * Math.pow(u, 2) * Math.min(1, r * 1.4); }
      if (spec.cord) r *= 1 - .85 * Math.exp(-Math.pow((Math.abs(th) - 180) / 16, 2));
      else r *= 1 - .45 * Math.exp(-Math.pow((Math.abs(th) - 180) / 30, 2));
      const rad = th * PI / 180, sy = spec.pinnLobe ? 1.35 : 1;
      pts.push([Math.sin(rad) * r * R, -Math.cos(rad) * r * R * sy + (spec.pinnLobe ? -R * .25 : 0)]);
    }
    let d = "";
    for (const [a, l] of lob) {
      if (spec.spiky && l < .8 && Math.abs(a) % 55 > 5 && Math.abs(a) < 100) continue;
      const rad = a * PI / 180, sy = spec.pinnLobe ? 1.35 : 1;
      d += `M0 0L${f2(Math.sin(rad) * l * R * .9)} ${f2(-Math.cos(rad) * l * R * .9 * sy + (spec.pinnLobe ? -R * .25 : 0))}`;
    }
    out.push(`<path d="${path(pts)}" class="lf-fill"/><path d="${d}" class="lf-vein"/><path d="M0 0L0 ${spec.pet}" class="lf-pet"/>`);
    return { minX: -R * 1.05, maxX: R * 1.05, minY: -R * (spec.pinnLobe ? 1.65 : 1.1), maxY: spec.pet + .3 };
  }

  function pinnate(spec, out) {
    const H = spec.rachis, pairs = (spec.n - 1) / 2, lf = spec.leaflet;
    let d = `M0 ${f2(H * .18)}L0 ${f2(-H)}`;
    out.push(`<path d="${d}" class="lf-pet"/>`);
    let maxX = 0;
    for (let k = 0; k < pairs; k++) {
      const t = .12 + .78 * k / Math.max(1, pairs - 1) * (pairs > 1 ? 1 : 0);
      const y = -H * t * .9;
      const sc = spec.termBig ? .65 + .35 * k / Math.max(1, pairs - 1) : 1 - .12 * (1 - k / Math.max(1, pairs - 1));
      const Lk = lf.L * sc;
      for (const side of [1, -1]) {
        simpleLeaf({ ...lf, L: Lk, pet: .15 }, out, `translate(0 ${f2(y)}) rotate(${side * 68}) translate(0 -.15)`);
        maxX = Math.max(maxX, Lk * .95 + .3);
      }
    }
    const Lt = lf.L * (spec.termBig ? 1.25 : 1);
    simpleLeaf({ ...lf, L: Lt, pet: .3 }, out, `translate(0 ${f2(-H - .3)})`);
    if (spec.thorns) out.push(`<path d="M0 ${f2(H * .17)}l-.5 -.2M0 ${f2(H * .17)}l.5 -.2" class="lf-pet"/>`);
    return { minX: -maxX, maxX, minY: -H - Lt - .8, maxY: H * .18 + .3 };
  }

  function digit(spec, out) {
    const n = spec.n, lf = spec.leaflet; let R = 0;
    for (let k = 0; k < n; k++) {
      const a = -125 + 250 * k / (n - 1);
      const sc = .5 + .5 * Math.cos(a * PI / 250);
      const Lk = lf.L * sc; R = Math.max(R, Lk);
      simpleLeaf({ ...lf, L: Lk, pet: 0 }, out, `rotate(${f2(a)})`);
    }
    out.push(`<path d="M0 0L0 ${spec.pet}" class="lf-pet"/>`);
    return { minX: -R - .5, maxX: R + .5, minY: -R - .5, maxY: spec.pet + .3 };
  }

  // Nadelzweige
  function needles(spec, out) {
    const T = spec.type, len = spec.len, cls = spec.dark ? "lf-needle lf-dark" : "lf-needle";
    const twigL = T === "laerche" ? 9 : T.startsWith("kiefer") ? Math.max(8, len * 1.3) : 9;
    const g = [`<path d="M0 0L0 ${-twigL}" class="lf-twig"/>`];
    let bx = len + 1;
    if (T === "fichte") {
      for (let i = 0; i < 34; i++) {
        const y = -.4 - i * (twigL - .8) / 34, side = i % 2 ? 1 : -1, a = 40 + (i * 37 % 35);
        const r = a * PI / 180, l = len * (i % 3 === 0 ? .55 : 1);
        g.push(`<path d="M0 ${f2(y)}L${f2(side * Math.sin(r) * l)} ${f2(y - Math.cos(r) * l)}" class="${cls}" style="stroke-width:.11"/>`);
      }
      g.push(inset(len + 2.2, "square", "vierkantig")); bx = len + 3.4;
    } else if (T === "tanne" || T === "eibe") {
      for (let i = 0; i < 18; i++) {
        const y = -.5 - i * (twigL - 1) / 18;
        for (const side of [1, -1]) {
          const a = (75 - i * .6) * PI / 180, l = len * (.85 + .15 * Math.sin(i));
          const ex = side * Math.sin(a) * l, ey = y - Math.cos(a) * l;
          g.push(flatNeedle(0, y, ex, ey, T === "tanne"));
        }
      }
      g.push(T === "tanne" ? inset(len + 2, "flat-stripes", "Unterseite: 2 weiße Streifen") : inset(len + 2, "flat", "Unterseite ohne Streifen")); bx = len + 3.4;
    } else if (T === "kiefer2" || T === "kiefer5") {
      const k = T === "kiefer2" ? 2 : 5, bundles = T === "kiefer2" ? 7 : 6;
      for (let i = 0; i < bundles; i++) {
        const y = -.8 - i * (twigL - 1.5) / bundles, side = i % 2 ? 1 : -1;
        const base = (35 + (i % 3) * 8) * PI / 180;
        g.push(`<path d="M0 ${f2(y)}l${f2(side * .35)} ${f2(-.35)}" class="lf-twig" style="stroke-width:.25"/>`);
        for (let j = 0; j < k; j++) {
          const a = base + (j - (k - 1) / 2) * .09, bxp = side * .35, byp = y - .35;
          const ex = bxp + side * Math.sin(a) * len, ey = byp - Math.cos(a) * len;
          const cx = bxp + side * Math.sin(a + (j % 2 ? .25 : -.25)) * len * .55, cy = byp - Math.cos(a) * len * .5;
          g.push(`<path d="M${f2(bxp)} ${f2(byp)}Q${f2(cx)} ${f2(cy)} ${f2(ex)} ${f2(ey)}" class="${cls}" style="stroke-width:${k === 2 ? .1 : .07}"/>`);
        }
      }
      g.push(inset(len + 1.6, k === 2 ? "half" : "third", k === 2 ? "Querschnitt halbrund" : "Querschnitt dreikantig")); bx = len + 3;
    } else if (T === "laerche") {
      for (let i = 0; i < 5; i++) {
        const y = -1 - i * 1.8, side = i % 2 ? 1 : -1, sx = side * .5, sy = y - .2;
        g.push(`<circle cx="${f2(sx)}" cy="${f2(sy)}" r=".28" class="lf-shoot"/>`);
        for (let j = 0; j < 24; j++) {
          const a = (-80 + 160 * j / 23 + side * 25) * PI / 180, l = len * (.7 + .3 * Math.sin(j * 1.7) ** 2);
          g.push(`<path d="M${f2(sx)} ${f2(sy)}L${f2(sx + Math.sin(a) * l)} ${f2(sy - Math.cos(a) * l)}" class="${cls}" style="stroke-width:.06"/>`);
        }
      }
      g.push(inset(len + 2.2, "flat", "flach, weich")); bx = len + 3.4;
    }
    out.push(g.join(""));
    return { minX: -len - 1, maxX: bx, minY: -twigL - (T === "laerche" ? 2 : len) * .6 - .5, maxY: .5 };
  }
  function flatNeedle(x0, y0, x1, y1, notch) {
    const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy), nx = -dy / l * .1, ny = dx / l * .1;
    const tip = notch ? `L${f2(x1 + nx * .4)} ${f2(y1 + ny * .4)}L${f2(x1 - dx / l * .12)} ${f2(y1 - dy / l * .12)}L${f2(x1 - nx * .4)} ${f2(y1 - ny * .4)}`
                      : `L${f2(x1)} ${f2(y1)}`;
    return `<path d="M${f2(x0 + nx)} ${f2(y0 + ny)}L${f2(x1 - dx / l * .25 + nx)} ${f2(y1 - dy / l * .25 + ny)}${tip}L${f2(x1 - dx / l * .25 - nx)} ${f2(y1 - dy / l * .25 - ny)}L${f2(x0 - nx)} ${f2(y0 - ny)}Z" class="lf-flat"/>`;
  }
  // Querschnitt-Einsatz unten rechts
  function inset(x, kind, label) {
    const y = -1.3, s = .55;
    let shape = "";
    if (kind === "square") shape = `<path d="M${x} ${y - s}L${x + s} ${y}L${x} ${y + s}L${x - s} ${y}Z" class="lf-flat"/>`;
    if (kind === "flat" || kind === "flat-stripes") shape = `<rect x="${x - .9}" y="${y - .18}" width="1.8" height=".36" rx=".15" class="lf-flat"/>` +
      (kind === "flat-stripes" ? `<rect x="${x - .55}" y="${y + .05}" width=".35" height=".1" class="lf-stripe"/><rect x="${x + .2}" y="${y + .05}" width=".35" height=".1" class="lf-stripe"/>` : "");
    if (kind === "half") shape = `<path d="M${x - .6} ${y}A.6 .6 0 0 1 ${x + .6} ${y}Z" class="lf-flat"/>`;
    if (kind === "third") shape = `<path d="M${x} ${y - .55}L${x + .5} ${y + .35}L${x - .5} ${y + .35}Z" class="lf-flat"/>`;
    return `<g class="lf-inset">${shape}<text x="${x}" y="${y + 1.05}" text-anchor="middle">${label}</text></g>`;
  }

  BL.leafSVG = function (spec, opts = {}) {
    const out = [];
    let bb;
    if (spec.k === "simple") bb = simpleLeaf(spec, out);
    else if (spec.k === "oak") bb = simpleLeaf({ ...spec, shape: "obovate", margin: "entire", tip: "round", veins: 0 }, out);
    else if (spec.k === "palm") bb = palmLeaf(spec, out);
    else if (spec.k === "pinnate") bb = pinnate(spec, out);
    else if (spec.k === "digit") bb = digit(spec, out);
    else bb = needles(spec, out);
    // Maßstab 1 cm
    const pad = .8, w = bb.maxX - bb.minX + 2 * pad, h = bb.maxY - bb.minY + 2 * pad + 1.2;
    const sx = bb.minX, sy = bb.maxY + .9;
    out.push(`<g class="lf-scale"><path d="M${f2(sx)} ${f2(sy)}h1"/><text x="${f2(sx + 1.2)}" y="${f2(sy + .15)}">1 cm</text></g>`);
    return `<svg viewBox="${f2(bb.minX - pad)} ${f2(bb.minY - pad)} ${f2(w)} ${f2(h)}" class="leaf-svg" role="img" aria-label="${opts.label || "Blattschema"}">${out.join("")}</svg>`;
  };
})();
