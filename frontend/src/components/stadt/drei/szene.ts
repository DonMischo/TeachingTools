/**
 * Szene der 3D-Stadt (three.js): Gelände mit dem Stadtplan als Bodenbild, Wasser, Häuser als
 * Instanzen (Wand + Dach aus Blender, Fassaden- und Dachkacheln aus fassade.ts), Wahrzeichen, Mauern, Aquädukt und
 * Wald aus den TaskCrawler-Bäumen. Welt: x = Karte x, z = Karte y, y = Höhe; Ursprung in der Kartenmitte.
 * Dazu Raster für das Laufen: Höhe, Wasser und belegte Flächen.
 */
import * as THREE from "three";
import { hoeheBei, type Gelaende } from "@/lib/gelaende/gelaende";
import { zufallsquelle } from "@/lib/gelaende/rauschen";
import { waldMaske } from "@/lib/gelaende/wald";
import { abstand, inPoly, rechteck, type P } from "@/lib/stadt/geometrie";
import type { Haus } from "@/lib/stadt/haeuser";
import { BAUTEN, OEPNV, STRASSEN, type Stadt } from "@/lib/stadt/modell";
import { MODELL_VON, TEILFARBEN } from "./modelle";
import { dachStoff, fassadenStoff, bauwerkStoff, steinStoff } from "./fassade";

export interface StadtSzene {
  gruppe: THREE.Group;
  /** Bodenhöhe an Weltkoordinaten */
  boden(x: number, z: number): number;
  /** darf man hier stehen? (kein Haus, keine Mauer, kein Wasser außer auf Brücken) */
  frei(x: number, z: number): boolean;
  entsorge(): void;
}

type Teile = Record<string, THREE.BufferGeometry> | null;

const R = 2; // Rastermaß für Laufen und Belegung (m)

/** Geometrie mit Helligkeit 1 je Ecke (für Ersatzformen ohne Blender-Modell) */
function hell(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const n = g.attributes.position.count;
  g.setAttribute("color", new THREE.Float32BufferAttribute(new Float32Array(n * 3).fill(1), 3));
  return g;
}
const kasten = () => hell(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0));
function satteldach(): THREE.BufferGeometry {
  const s = new THREE.Shape([new THREE.Vector2(-0.5, 0), new THREE.Vector2(0.5, 0), new THREE.Vector2(0, 1)]);
  return hell(new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false }).translate(0, 0, -0.5).rotateY(Math.PI / 2));
}


/** Spiegel je Zelle: Flüsse knapp unter dem niedrigsten Ufer, Meer auf Meereshöhe */
export function wasserspiegel(g: Gelaende): Float32Array {
  const sp = new Float32Array(g.n * g.n).fill(NaN);
  for (let j = 0; j < g.n; j++) for (let i = 0; i < g.n; i++) {
    const k = j * g.n + i;
    if (!g.wasser[k]) continue;
    if (g.wasser[k] === 2 && g.meer !== null) { sp[k] = g.meer; continue; }
    let m = Infinity;
    for (let b = -3; b <= 3; b++) for (let a = -3; a <= 3; a++) {
      const ii = i + a, jj = j + b;
      if (ii < 0 || jj < 0 || ii >= g.n || jj >= g.n) continue;
      const kk = jj * g.n + ii;
      if (!g.wasser[kk]) m = Math.min(m, g.hoehe[kk]);
    }
    sp[k] = Number.isFinite(m) ? m - 0.5 : g.hoehe[k] + 0.5;
  }
  return sp;
}

/** Raster der Größe R: Rechteck/Polygon eintragen */
class Raster {
  n: number;
  daten: Uint8Array;
  constructor(public breite: number) { this.n = Math.ceil(breite / R); this.daten = new Uint8Array(this.n * this.n); }
  poly(p: P[], wert = 1) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const q of p) { x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y); }
    for (let j = Math.max(0, Math.floor(y0 / R)); j <= Math.min(this.n - 1, Math.floor(y1 / R)); j++)
      for (let i = Math.max(0, Math.floor(x0 / R)); i <= Math.min(this.n - 1, Math.floor(x1 / R)); i++)
        if (inPoly({ x: (i + 0.5) * R, y: (j + 0.5) * R }, p)) this.daten[j * this.n + i] = wert;
  }
  linie(l: P[], breite: number) {
    for (let k = 0; k + 1 < l.length; k++) {
      const a = l[k], b = l[k + 1], d = abstand(a, b);
      if (d > 0.1) this.poly(rechteck({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, d + breite, breite, Math.atan2(b.y - a.y, b.x - a.x)));
    }
  }
  bei(x: number, y: number) {
    const i = Math.floor(x / R), j = Math.floor(y / R);
    return i < 0 || j < 0 || i >= this.n || j >= this.n ? 1 : this.daten[j * this.n + i];
  }
}

export function baueStadtSzene(g: Gelaende, s: Stadt, hs: Haus[], bodenBild: HTMLCanvasElement | null, teile: Teile, baeume: Teile, seed = 1): StadtSzene {
  const gruppe = new THREE.Group();
  const B = g.breite, h2 = B / 2;
  const welt = (p: P) => new THREE.Vector3(p.x - h2, 0, p.y - h2);
  const geos: THREE.BufferGeometry[] = [], mats: THREE.Material[] = [], texte: THREE.Texture[] = [];
  const z = zufallsquelle(seed);

  // ── Gelände: eine Ecke je Zelle (Zellmitte), wie hoeheBei ──
  const n = g.n;
  const pos = new Float32Array(n * n * 3), uv = new Float32Array(n * n * 2);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = j * n + i, x = (i + 0.5) * g.zelle, y = (j + 0.5) * g.zelle;
    pos.set([x - h2, g.hoehe[k], y - h2], k * 3);
    uv.set([x / B, 1 - y / B], k * 2);
  }
  const idx: number[] = [];
  for (let j = 0; j + 1 < n; j++) for (let i = 0; i + 1 < n; i++) {
    const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const gGeo = new THREE.BufferGeometry();
  gGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  gGeo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  gGeo.setIndex(idx);
  gGeo.computeVertexNormals();
  let karteTex: THREE.Texture | null = null;
  if (bodenBild) {
    karteTex = new THREE.CanvasTexture(bodenBild);
    karteTex.colorSpace = THREE.SRGBColorSpace;
    karteTex.anisotropy = 8;
    texte.push(karteTex);
  }
  const gMat = new THREE.MeshLambertMaterial({ map: karteTex, color: karteTex ? 0xffffff : 0x7aa25a });
  const gelaende = new THREE.Mesh(gGeo, gMat);
  gelaende.receiveShadow = true;
  gruppe.add(gelaende);
  geos.push(gGeo); mats.push(gMat);

  // ── Wasser ──
  const sp = wasserspiegel(g);
  const wPos: number[] = [], wIdx: number[] = [];
  const ecke = new Map<number, number>();
  const ecken = (k: number) => {
    let v = ecke.get(k);
    if (v === undefined) {
      const i = k % n, j = Math.floor(k / n);
      const y = Number.isNaN(sp[k]) ? g.hoehe[k] - 0.2 : sp[k];
      v = wPos.length / 3;
      wPos.push((i + 0.5) * g.zelle - h2, y, (j + 0.5) * g.zelle - h2);
      ecke.set(k, v);
    }
    return v;
  };
  for (let j = 0; j + 1 < n; j++) for (let i = 0; i + 1 < n; i++) {
    const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
    if (!g.wasser[a] && !g.wasser[b] && !g.wasser[c] && !g.wasser[d]) continue;
    wIdx.push(ecken(a), ecken(c), ecken(b), ecken(b), ecken(c), ecken(d));
  }
  if (wIdx.length) {
    const wGeo = new THREE.BufferGeometry();
    wGeo.setAttribute("position", new THREE.Float32BufferAttribute(wPos, 3));
    wGeo.setIndex(wIdx);
    wGeo.computeVertexNormals();
    const wMat = new THREE.MeshPhongMaterial({ color: 0x3f7fb8, transparent: true, opacity: 0.82, shininess: 90, specular: 0x99bbdd });
    gruppe.add(new THREE.Mesh(wGeo, wMat));
    geos.push(wGeo); mats.push(wMat);
  }

  // ── Belegung fürs Laufen und für den Wald ──
  const hart = new Raster(B), strasse = new Raster(B);
  for (const st of s.strassen) if (!OEPNV.includes(st.art) && st.art !== "aquaedukt") strasse.linie(st.punkte, STRASSEN[st.art].breite + 2);
  for (const h of hs) hart.poly(h.ecken);
  for (const m of s.mauern) for (let k = 0; k < m.length; k++) hart.linie([m[k], m[(k + 1) % m.length]], 3);

  // ── Häuser ──
  const wandGeo = teile?.haus_wand_wand ?? kasten();
  const DACH = { sattel: "dach_sattel", walm: "dach_walm", flach: "dach_flach", mansard: "dach_mansard" } as const;
  type Dach = keyof typeof DACH;
  const dachArt = (h: Haus): Dach => {
    if (h.flach) return "flach";
    if (["gruenderzeit", "residenz", "ville", "hafencity"].includes(h.zone)) return "mansard";
    if (["einfamilienhaus", "pendler", "vorort", "kolonie", "gated"].includes(h.zone) && (h.c.x * 7 + h.c.y * 3) % 10 < 4) return "walm";
    return "sattel";
  };
  const wandMat = fassadenStoff(new THREE.MeshLambertMaterial({ vertexColors: true }));
  const dachMat = dachStoff(new THREE.MeshLambertMaterial({ vertexColors: true }));
  mats.push(wandMat, dachMat);
  const wand = new THREE.InstancedMesh(wandGeo, wandMat, Math.max(1, hs.length));
  wand.count = hs.length;
  const dachZahl: Record<Dach, number> = { sattel: 0, walm: 0, flach: 0, mansard: 0 };
  for (const h of hs) dachZahl[dachArt(h)]++;
  const daecher = {} as Record<Dach, { dach: THREE.InstancedMesh; akzent: THREE.InstancedMesh | null; i: number }>;
  for (const d of Object.keys(DACH) as Dach[]) {
    const geo = teile?.[`${DACH[d]}_dach`] ?? satteldach();
    const ak = teile?.[`${DACH[d]}_akzent`];
    const dm = new THREE.InstancedMesh(geo, dachMat, Math.max(1, dachZahl[d]));
    dm.count = dachZahl[d];
    const am = ak ? new THREE.InstancedMesh(ak, dachMat, Math.max(1, dachZahl[d])) : null;
    if (am) am.count = dachZahl[d];
    daecher[d] = { dach: dm, akzent: am, i: 0 };
  }
  const mat = new THREE.Matrix4(), q = new THREE.Quaternion(), achse = new THREE.Vector3(0, 1, 0), farbe = new THREE.Color();
  hs.forEach((h, i) => {
    const hoehen = h.ecken.map(e => hoeheBei(g, e.x, e.y));
    const unten = Math.min(...hoehen) - 0.4, oben = Math.max(...hoehen);
    const wh = h.hoehe + (oben - unten);
    const p = welt(h.c);
    q.setFromAxisAngle(achse, -h.dreh);
    mat.compose(new THREE.Vector3(p.x, unten, p.z), q, new THREE.Vector3(h.b, wh, h.t));
    wand.setMatrixAt(i, mat);
    wand.setColorAt(i, farbe.set(h.fassade));
    const d = dachArt(h), D = daecher[d];
    const dh = d === "flach" ? 1.2 : d === "mansard" ? 4.2 : Math.min(h.b, h.t) * 0.45;
    const ueber = d === "flach" ? 1 : 1.06;
    mat.compose(new THREE.Vector3(p.x, unten + wh, p.z), q, new THREE.Vector3(h.b * ueber, dh, h.t * (d === "flach" ? 1 : 1.1)));
    D.dach.setMatrixAt(D.i, mat);
    D.dach.setColorAt(D.i, farbe.set(h.dach));
    if (D.akzent) { D.akzent.setMatrixAt(D.i, mat); D.akzent.setColorAt(D.i, farbe.set(d === "flach" ? "#a9aeb3" : "#6a4a3a")); }
    D.i++;
  });
  wand.castShadow = wand.receiveShadow = true;
  gruppe.add(wand);
  for (const D of Object.values(daecher)) {
    D.dach.castShadow = true;
    gruppe.add(D.dach);
    if (D.akzent) gruppe.add(D.akzent);
  }

  // ── Wahrzeichen ──
  const matCache = new Map<string, THREE.MeshLambertMaterial>();
  const lambert = (c: string, modell: string, teil: "wand" | "dach" | "akzent") => {
    const key = `${c}|${modell}|${teil}`;
    let m = matCache.get(key);
    if (!m) { m = bauwerkStoff(modell, teil, () => new THREE.MeshLambertMaterial({ vertexColors: true, color: c })); matCache.set(key, m); mats.push(m); }
    return m;
  };
  for (const b of s.bauten) {
    const art = BAUTEN[b.typ];
    const name = MODELL_VON[b.typ];
    if (!name || art.hoehe < 3) continue;
    const p = welt(b);
    const fl = rechteck(b, art.b, art.h, b.dreh ?? 0);
    const unten = Math.min(...fl.map(e => hoeheBei(g, e.x, e.y))) - 0.5;
    const objekt = new THREE.Group();
    objekt.position.set(p.x, unten, p.z);
    objekt.rotation.y = -(b.dreh ?? 0);
    objekt.scale.set(art.b, Math.max(8, art.hoehe), art.h);
    const f = TEILFARBEN[name] ?? { dach: "#8a4b33", akzent: "#8a4b33" };
    for (const [teil, c] of [["wand", art.farbe], ["dach", f.dach], ["akzent", f.akzent]] as const) {
      const geo = teile?.[`${name}_${teil}`] ?? (teil === "wand" ? kasten() : null);
      if (!geo) continue;
      if (!teile) geos.push(geo);
      const m = new THREE.Mesh(geo, lambert(c, name, teil));
      m.castShadow = m.receiveShadow = true;
      objekt.add(m);
    }
    gruppe.add(objekt);
    hart.poly(fl);
  }

  // ── Mauern mit Türmen ──
  const mauerTeile: { a: P; b: P }[] = [];
  for (const m of s.mauern) for (let k = 0; k < m.length; k++) mauerTeile.push({ a: m[k], b: m[(k + 1) % m.length] });
  if (mauerTeile.length) {
    const mGeo = kasten(), tGeo = hell(new THREE.CylinderGeometry(3.2, 3.6, 1, 10).translate(0, 0.5, 0));
    geos.push(mGeo, tGeo);
    const mMat = steinStoff(new THREE.MeshLambertMaterial({ vertexColors: true, color: 0x9a8f80 }));
    mats.push(mMat);
    const mi = new THREE.InstancedMesh(mGeo, mMat, mauerTeile.length), ti = new THREE.InstancedMesh(tGeo, mMat, mauerTeile.length);
    mauerTeile.forEach(({ a, b }, i) => {
      const mitte = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, p = welt(mitte);
      const y = Math.min(hoeheBei(g, a.x, a.y), hoeheBei(g, b.x, b.y)) - 1;
      q.setFromAxisAngle(achse, -Math.atan2(b.y - a.y, b.x - a.x));
      mat.compose(new THREE.Vector3(p.x, y, p.z), q, new THREE.Vector3(abstand(a, b), 10, 2.6));
      mi.setMatrixAt(i, mat);
      const pa = welt(a);
      mat.compose(new THREE.Vector3(pa.x, hoeheBei(g, a.x, a.y) - 1, pa.z), new THREE.Quaternion(), new THREE.Vector3(1, 15, 1));
      ti.setMatrixAt(i, mat);
    });
    mi.castShadow = ti.castShadow = true;
    gruppe.add(mi, ti);
  }

  // ── Aquädukt: Pfeiler mit gleichmäßigem Gefälle ──
  for (const st of s.strassen.filter(x => x.art === "aquaedukt")) {
    const a = st.punkte[0], b = st.punkte[st.punkte.length - 1], L = abstand(a, b);
    const ha = hoeheBei(g, a.x, a.y), hb = hoeheBei(g, b.x, b.y) + 6;
    const k = Math.max(2, Math.floor(L / 14));
    const pGeo = kasten();
    geos.push(pGeo);
    const pMat = new THREE.MeshLambertMaterial({ vertexColors: true, color: 0xc7a77e });
    mats.push(pMat);
    const pi = new THREE.InstancedMesh(pGeo, pMat, k * 2);
    let c = 0;
    const w = -Math.atan2(b.y - a.y, b.x - a.x);
    q.setFromAxisAngle(achse, w);
    for (let i = 0; i < k; i++) {
      const t = (i + 0.5) / k, m = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      const deck = ha + (hb - ha) * t, grund = hoeheBei(g, m.x, m.y), p = welt(m);
      if (deck - grund > 1.5) { mat.compose(new THREE.Vector3(p.x, grund - 1, p.z), q, new THREE.Vector3(3, deck - grund + 1, 3)); pi.setMatrixAt(c++, mat); }
      mat.compose(new THREE.Vector3(p.x, Math.max(deck, grund), p.z), q, new THREE.Vector3(L / k + 0.2, 2, 3.4));
      pi.setMatrixAt(c++, mat);
    }
    pi.count = c;
    pi.castShadow = true;
    gruppe.add(pi);
  }

  // ── Wald: TaskCrawler-Bäume, nicht in Vierteln und nicht auf Straßen ──
  const maske = waldMaske(g);
  const orte: { p: P; art: string; s: number; w: number }[] = [];
  const zonen = s.zonen.filter(x => x.typ !== "obstplantage");
  for (let y = 8; y < B; y += 16) for (let x = 8; x < B; x += 16) {
    const p = { x: x + (z() - 0.5) * 12, y: y + (z() - 0.5) * 12 };
    const k = Math.min(n - 1, Math.floor(p.y / g.zelle)) * n + Math.min(n - 1, Math.floor(p.x / g.zelle));
    if (z() > maske[k] * 1.1 || g.wasser[k] || strasse.bei(p.x, p.y) || hart.bei(p.x, p.y)) continue;
    if (zonen.some(zz => inPoly(p, zz.poly))) continue;
    const hoch = g.hoehe[k] > 400 || z() < 0.25;
    orte.push({ p, art: hoch ? `tanne${1 + Math.floor(z() * 2)}` : `laubbaum${1 + Math.floor(z() * 3)}`, s: 9 + z() * 9, w: z() * Math.PI * 2 });
  }
  const arten = [...new Set(orte.map(o => o.art))];
  for (const art of arten) {
    const hier = orte.filter(o => o.art === art);
    const tanne = art.startsWith("tanne");
    const teileBaum: [string, THREE.BufferGeometry, string][] = baeume?.[`${art}_krone`]
      ? [["stamm", baeume[`${art}_stamm`], "#6b4a2f"], ["krone", baeume[`${art}_krone`], tanne ? "#36573c" : "#557f3c"]]
      : [["krone", (() => { const c = hell(new THREE.ConeGeometry(0.3, 1, 7).translate(0, 0.5, 0)); geos.push(c); return c; })(), tanne ? "#36573c" : "#557f3c"]];
    for (const [, geo, c] of teileBaum) {
      if (!geo) continue;
      const bm = new THREE.MeshLambertMaterial({ vertexColors: true, color: c });
      mats.push(bm);
      const im = new THREE.InstancedMesh(geo, bm, hier.length);
      hier.forEach((o, i) => {
        const p = welt(o.p);
        q.setFromAxisAngle(achse, o.w);
        mat.compose(new THREE.Vector3(p.x, hoeheBei(g, o.p.x, o.p.y) - 0.3, p.z), q, new THREE.Vector3(o.s, o.s, o.s));
        im.setMatrixAt(i, mat);
        im.setColorAt(i, farbe.set(c).offsetHSL(0, 0, (((i * 37) % 11) - 5) * 0.012));
      });
      im.castShadow = true;
      gruppe.add(im);
    }
  }

  // Brücken: auf Straßen über Wasser darf man gehen
  const boden = (x: number, zz: number) => {
    const mx = x + h2, my = zz + h2;
    const k = Math.min(n - 1, Math.max(0, Math.floor(my / g.zelle))) * n + Math.min(n - 1, Math.max(0, Math.floor(mx / g.zelle)));
    const h = hoeheBei(g, mx, my);
    return g.wasser[k] && strasse.bei(mx, my) ? Math.max(h, sp[k] + 1.2) : h;
  };
  const frei = (x: number, zz: number) => {
    const mx = x + h2, my = zz + h2;
    if (mx < 2 || my < 2 || mx > B - 2 || my > B - 2) return false;
    if (hart.bei(mx, my)) return false;
    const k = Math.min(n - 1, Math.floor(my / g.zelle)) * n + Math.min(n - 1, Math.floor(mx / g.zelle));
    return !g.wasser[k] || !!strasse.bei(mx, my);
  };

  return {
    gruppe, boden, frei,
    entsorge() {
      for (const x of geos) if (!x.userData.geteilt) x.dispose();
      gruppe.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh && !m.geometry.userData.geteilt) m.geometry.dispose(); });
      for (const m of mats) m.dispose();
      for (const t of texte) t.dispose();
      gruppe.traverse(o => { const im = o as THREE.InstancedMesh; if (im.isInstancedMesh) im.dispose(); });
    },
  };
}
