/**
 * Städte wachsen lassen — Epoche für Epoche, je nach Stil:
 *   römisch      Kolonie mit Cardo/Decumanus → Blütezeit → Spätantike → heute
 *   europäisch   Burg und Furt → Marktstadt mit Mauer → Vorstädte
 *                → Industrialisierung (Ring, Bahnhof) → Moderne
 *   amerikanisch Eisenbahnstadt → Straßenbahnstadt → Autostadt → Sprawl
 * Jede Epoche ist eine vollständige Kopie der Stadt (zum Blättern).
 */
import { hoeheBei, inAue, istWasser, neigungBei, wasserAbstand, type Gelaende } from "@/lib/gelaende/gelaende";
import { perlin, zufallsquelle } from "@/lib/gelaende/rauschen";
import {
  abstand, geschlossen, inPoly, laenge, punktBei, rechteck, schnitte, skaliere, zurLinie, type P,
} from "./geometrie";
import { BAUTEN, kopie, leereStadt, type Bau, type BauTyp, type Epoche, type Stadt, type Stil, type Strasse, type StrassenArt, type ZonenTyp } from "./modell";
import { stromlinien, type Feld } from "./tensor";
import { glaetten, randPunkt, weg } from "./wege";

type Z = () => number;

// ---------------------------------------------------------------- Hilfen

/** Band um einen Linienzug als Polygon */
export function band(l: P[], breite: number): P[] {
  if (l.length < 2) return [];
  const links: P[] = [], rechts: P[] = [];
  for (let i = 0; i < l.length; i++) {
    const a = l[Math.max(0, i - 1)], b = l[Math.min(l.length - 1, i + 1)];
    const d = abstand(a, b) || 1;
    const nx = -(b.y - a.y) / d, ny = (b.x - a.x) / d;
    links.push({ x: l[i].x + nx * breite / 2, y: l[i].y + ny * breite / 2 });
    rechts.push({ x: l[i].x - nx * breite / 2, y: l[i].y - ny * breite / 2 });
  }
  return [...links, ...rechts.reverse()];
}

/** Linienzug fein abtasten und an Wasser (bzw. Meer) zerschneiden */
export function zerschneiden(l: P[], g: Gelaende, nurMeer = false): P[][] {
  const aus: P[][] = [];
  let cur: P[] = [];
  const nass = (p: P) => (nurMeer ? g.wasser[Math.floor(Math.max(0, Math.min(g.n - 1, p.y / g.zelle))) * g.n + Math.floor(Math.max(0, Math.min(g.n - 1, p.x / g.zelle)))] === 2 : istWasser(g, p.x, p.y));
  for (let i = 0; i + 1 < l.length; i++) {
    const a = l[i], b = l[i + 1], d = abstand(a, b);
    const k = Math.max(1, Math.ceil(d / 6));
    for (let s = 0; s <= k; s++) {
      if (s === 0 && i > 0) continue;
      const p = { x: a.x + (b.x - a.x) * s / k, y: a.y + (b.y - a.y) * s / k };
      const draussen = p.x < 0 || p.y < 0 || p.x > g.breite || p.y > g.breite;
      if (nass(p) || draussen) { if (cur.length > 1) aus.push(cur); cur = []; }
      else if (!cur.length || s === k || s === 0) cur.push(p);
      else { cur.push(p); }
    }
  }
  if (cur.length > 1) aus.push(cur);
  return aus.map(c => c.length > 2 ? [c[0], ...c.slice(1, -1).filter((_, i) => i % 4 === 3), c[c.length - 1]] : c);
}

/** Bauwerke mit Platz (Forum, Markt …) schneiden Neben­straßen und Gassen weg */
const PLATZ: BauTyp[] = ["forum", "markt", "thermen", "theater", "kloster", "burg", "gericht", "einkauf", "bahnhof", "buero", "amphitheater", "kirche", "fabrik", "schule", "friedhof"];
export function freiraeumen(s: Stadt): void {
  const flaechen = s.bauten.filter(b => PLATZ.includes(b.typ)).map(b => rechteck(b, BAUTEN[b.typ].b + 6, BAUTEN[b.typ].h + 6, b.dreh ?? 0));
  if (!flaechen.length) return;
  const neu: Strasse[] = [];
  for (const st of s.strassen) {
    if (st.art !== "neben" && st.art !== "gasse") { neu.push(st); continue; }
    let cur: P[] = [];
    for (let i = 0; i + 1 < st.punkte.length; i++) {
      const a = st.punkte[i], b = st.punkte[i + 1];
      const k = Math.max(1, Math.ceil(abstand(a, b) / 4));
      for (let q = i ? 1 : 0; q <= k; q++) {
        const p = { x: a.x + (b.x - a.x) * q / k, y: a.y + (b.y - a.y) * q / k };
        if (flaechen.some(f => inPoly(p, f))) { if (cur.length > 1) neu.push({ ...st, punkte: duenn(cur) }); cur = []; }
        else cur.push(p);
      }
    }
    if (cur.length > 1) neu.push({ ...st, punkte: duenn(cur) });
  }
  s.strassen = neu;
}
const duenn = (c: P[]) => (c.length > 2 ? [c[0], ...c.slice(1, -1).filter((_, i) => i % 3 === 2), c[c.length - 1]] : c);

/** gerades Straßenraster in einem Rechteck, am Wasser unterbrochen */
function raster(g: Gelaende, x0: number, y0: number, x1: number, y1: number, bx: number, by: number, ox: number, oy: number, art: StrassenArt = "neben", drin?: (p: P) => boolean): Strasse[] {
  const aus: Strasse[] = [];
  const zu = (l: P[]) => {
    for (const st of zerschneiden(l, g)) {
      if (!drin) { aus.push({ art, punkte: st }); continue; }
      // nur Teile innerhalb des Gebiets
      let cur: P[] = [];
      const feinst: P[] = [];
      for (let i = 0; i + 1 < st.length; i++) {
        const a = st[i], b = st[i + 1], k = Math.max(1, Math.ceil(abstand(a, b) / 8));
        for (let q = i ? 1 : 0; q <= k; q++) feinst.push({ x: a.x + (b.x - a.x) * q / k, y: a.y + (b.y - a.y) * q / k });
      }
      for (const p of feinst) {
        if (drin(p)) cur.push(p);
        else { if (cur.length > 1) aus.push({ art, punkte: [cur[0], cur[cur.length - 1]] }); cur = []; }
      }
      if (cur.length > 1) aus.push({ art, punkte: [cur[0], cur[cur.length - 1]] });
    }
  };
  for (let x = ox + Math.ceil((x0 - ox) / bx) * bx; x <= x1 + 0.01; x += bx) zu([{ x, y: y0 }, { x, y: y1 }]);
  for (let y = oy + Math.ceil((y0 - oy) / by) * by; y <= y1 + 0.01; y += by) zu([{ x: x0, y }, { x: x1, y }]);
  return aus;
}

const rechteckPoly = (x0: number, y0: number, x1: number, y1: number): P[] => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];

/** bester Punkt nach einer Bewertung über ein grobes Gitter */
function besterPunkt(g: Gelaende, rand: number, wert: (p: P) => number): P | null {
  let best: P | null = null, bw = -Infinity;
  for (let y = rand; y <= g.breite - rand; y += 48) for (let x = rand; x <= g.breite - rand; x += 48) {
    const p = { x, y };
    const w = wert(p);
    if (w > bw) { bw = w; best = p; }
  }
  return bw > -1e8 ? best : null;
}

/** Kann hier gebaut werden? kein Wasser, keine Aue, nicht zu steil */
const baubar = (g: Gelaende, p: P, maxNeigung = 12) =>
  p.x > 0 && p.y > 0 && p.x < g.breite && p.y < g.breite && !istWasser(g, p.x, p.y) && !inAue(g, p.x, p.y) && neigungBei(g, p.x, p.y) < maxNeigung;

/** Punkt in der Nähe von p, der baubar ist (spiralförmig suchen) */
function baubarNahe(g: Gelaende, p: P, z: Z, max = 300, neigung = 12): P | null {
  if (baubar(g, p, neigung)) return p;
  for (let r = 16; r <= max; r += 16) for (let k = 0; k < 12; k++) {
    const w = (k / 12) * Math.PI * 2 + z() * 0.3;
    const q = { x: p.x + Math.cos(w) * r, y: p.y + Math.sin(w) * r };
    if (baubar(g, q, neigung)) return q;
  }
  return null;
}

/** Richtung des Flusses nahe p (Bogenmaß), sonst null */
function flussRichtung(g: Gelaende, p: P): number | null {
  if (g.flussLinie.length < 2) return null;
  const r = zurLinie(p, g.flussLinie);
  const a = g.flussLinie[r.seg], b = g.flussLinie[r.seg + 1];
  return Math.atan2(b.y - a.y, b.x - a.x);
}

/** Fernstraße von Kartenrand zu Kartenrand durch p, dem Gelände folgend */
function fernstrasse(g: Gelaende, p: P, w: number, steigung = 0.6, wasser = 30): P[] {
  const a = randPunkt(p, w + Math.PI, g.breite), b = randPunkt(p, w, g.breite);
  const k = { steigung, wasser };
  const l1 = weg(g, a, p, k), l2 = weg(g, p, b, k);
  return [...l1, ...l2.slice(1)];
}

function bau(s: Stadt, typ: BauTyp, p: P | null, dreh = 0): Bau | null {
  if (!p) return null;
  const b = { typ, x: p.x, y: p.y, dreh };
  s.bauten.push(b);
  return b;
}

/** Punkt neben einer Straße, Abstand d von ihr, auf der Seite s */
function nebenStrasse(l: P[], weg: number, d: number, seite: 1 | -1): P {
  const { p, dx, dy } = punktBei(l, weg);
  return { x: p.x - dy * d * seite, y: p.y + dx * d * seite };
}

/** Teil des Linienzugs von Punkt q aus (nahe daran) in Richtung weg vom Zentrum c, Länge L */
function auslauf(l: P[], q: P, c: P, L: number): P[] {
  const r = zurLinie(q, l);
  const vorwaerts = abstand(l[Math.min(l.length - 1, r.seg + 1)], c) > abstand(l[r.seg], c);
  const aus: P[] = [r.q];
  let s = 0;
  if (vorwaerts) for (let i = r.seg + 1; i < l.length && s < L; i++) { s += abstand(aus[aus.length - 1], l[i]); aus.push(l[i]); }
  else for (let i = r.seg; i >= 0 && s < L; i--) { s += abstand(aus[aus.length - 1], l[i]); aus.push(l[i]); }
  return aus;
}

// ---------------------------------------------------------------- Römisch

interface RoemischerPlan { c: P; W: number; H: number }

export function roemischerStandort(g: Gelaende, z: Z): RoemischerPlan {
  for (const f of [1, 0.75, 0.55]) {
    const W = 560 * f, H = 400 * f;
    const p = besterPunkt(g, 520, c => {
      let neig = 0, schlecht = 0;
      for (let i = 0; i <= 6; i++) for (let j = 0; j <= 6; j++) {
        const q = { x: c.x - W / 2 + (W * i) / 6, y: c.y - H / 2 + (H * j) / 6 };
        if (istWasser(g, q.x, q.y)) return -1e9;
        if (inAue(g, q.x, q.y)) schlecht++;
        neig += neigungBei(g, q.x, q.y);
      }
      neig /= 49;
      if (schlecht > 2 || neig > 9) return -1e9;
      const dw = wasserAbstand(g, c.x, c.y);
      const nah = g.wasser.some(w => w) ? -Math.abs(dw - (W / 2 + 120)) / 120 : 0;
      return nah - neig * 0.6 - schlecht + z() * 0.4 - abstand(c, { x: g.breite / 2, y: g.breite / 2 }) / 900;
    });
    if (p) return { c: p, W, H };
  }
  return { c: { x: g.breite / 2, y: g.breite / 2 }, W: 300, H: 220 };
}

export function roemisch(g: Gelaende, seed: number): Epoche[] {
  const z = zufallsquelle(seed);
  const { c, W, H } = roemischerStandort(g, z);
  const B = 80;
  const x0 = c.x - W / 2, x1 = c.x + W / 2, y0 = c.y - H / 2, y1 = c.y + H / 2;
  const s = leereStadt("roemisch");
  const mauer = rechteckPoly(x0, y0, x1, y1);
  s.mauern.push(mauer);
  s.zonen.push({ typ: "insulae", poly: mauer });
  // Insulae-Raster, dann die beiden Hauptachsen
  s.strassen.push(...raster(g, x0, y0, x1, y1, B, B, c.x, c.y).filter(st => {
    const [a, b] = [st.punkte[0], st.punkte[st.punkte.length - 1]];
    return !(Math.abs(a.x - c.x) < 1 && Math.abs(b.x - c.x) < 1) && !(Math.abs(a.y - c.y) < 1 && Math.abs(b.y - c.y) < 1);
  }));
  s.strassen.push({ art: "haupt", name: "Cardo maximus", punkte: [{ x: c.x, y: y0 }, { x: c.x, y: y1 }] });
  s.strassen.push({ art: "haupt", name: "Decumanus maximus", punkte: [{ x: x0, y: c.y }, { x: x1, y: c.y }] });
  // Viae: gerade aus den vier Toren bis an den Kartenrand, Brücke über Flüsse, Halt am Meer
  const tore = [{ x: c.x, y: y0 }, { x: x1, y: c.y }, { x: c.x, y: y1 }, { x: x0, y: c.y }];
  const richt = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];
  const viae: P[][] = [];
  tore.forEach((t, i) => {
    bau(s, "tor", t);
    const ende = randPunkt(t, richt[i] + (z() - 0.5) * 0.25, g.breite);
    const stuecke = zerschneiden([t, ende], g, true);
    if (stuecke.length && abstand(stuecke[0][0], t) < 10) {
      const l = [stuecke[0][0], stuecke[0][stuecke[0].length - 1]];
      viae.push(l);
      s.strassen.push({ art: "fernstrasse", name: "Via", punkte: l });
    }
  });
  bau(s, "forum", { x: c.x + 50, y: c.y + 36 });
  s.namen = [{ text: "Cardo", x: c.x + 8, y: y0 + 40 }, { text: "Decumanus", x: x0 + 60, y: c.y - 10 }];
  freiraeumen(s);
  const e1: Epoche = {
    jahr: "um 15 v. Chr.", titel: "Gründung einer Kolonie",
    text: "Vermesser legen die Stadt am Reißbrett an: ein Rechteck auf ebenem, trockenem Grund nahe am Fluss. Zwei Hauptachsen kreuzen sich rechtwinklig — der Cardo (Nord–Süd) und der Decumanus (Ost–West). Wo sie sich treffen, liegt das Forum. Dazwischen ein gleichmäßiges Raster aus Wohnblöcken, den Insulae. Die Mauer hat vier Tore, aus jedem führt eine schnurgerade Fernstraße.",
    neu: ["Rechteckige Mauer mit vier Toren", "Cardo und Decumanus", "Forum an der Kreuzung", "Insulae-Raster", "Gerade Fernstraßen (Viae)"],
    stadt: kopie(s),
  };

  // Blütezeit
  bau(s, "tempel", { x: c.x + 42, y: c.y - 34 });
  bau(s, "thermen", { x: c.x - B - 40, y: c.y + 40 });
  bau(s, "theater", { x: c.x - B - 40, y: c.y - 40 });
  const ecken = [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
  const amph = ecken.map(e => ({ x: e.x + Math.sign(e.x - c.x) * 120, y: e.y + Math.sign(e.y - c.y) * 110 }))
    .filter(p => baubar(g, p, 10))
    .sort((a, b) => neigungBei(g, a.x, a.y) - neigungBei(g, b.x, b.y))[0];
  bau(s, "amphitheater", amph ?? null);
  for (const v of viae) {
    if (laenge(v) < 260) continue;
    const seite = z() > 0.5 ? 1 : -1;
    const p = nebenStrasse(v, 150, 36, seite);
    if (baubar(g, p, 14)) bau(s, "nekropole", p, Math.atan2(v[1].y - v[0].y, v[1].x - v[0].x));
    const vor = auslauf(v, v[0], c, 260);
    if (vor.length > 1) s.zonen.push({ typ: "suburbium", poly: band(vor, 140) });
  }
  // Aquädukt: Quelle auf höherem Gelände, Gefälle bis zur Stadt
  const hc = hoeheBei(g, c.x, c.y);
  const quelle = besterPunkt(g, 40, p => {
    const d = abstand(p, c);
    if (d < 900 || d > 2400 || istWasser(g, p.x, p.y)) return -1e9;
    return hoeheBei(g, p.x, p.y) - hc - d / 200;
  });
  let aquaedukt = false;
  if (quelle && hoeheBei(g, quelle.x, quelle.y) > hc + 12) {
    const r = zurLinie(quelle, geschlossen(mauer));
    const ziel = { x: r.q.x + (c.x - r.q.x) * 0.08, y: r.q.y + (c.y - r.q.y) * 0.08 };
    s.strassen.push({ art: "aquaedukt", name: "Aquädukt", punkte: [quelle, ziel] });
    bau(s, "castellum", ziel);
    aquaedukt = true;
  }
  // Hafen am nächsten Wasser
  const hafen = besterPunkt(g, 30, p => {
    const d = wasserAbstand(g, p.x, p.y);
    if (d > 30 || d < 10 || istWasser(g, p.x, p.y)) return -1e9;
    return -abstand(p, c);
  });
  if (hafen && abstand(hafen, c) < 700) bau(s, "hafen", hafen);
  for (let i = 0; i < 3; i++) {
    const w = z() * Math.PI * 2, d = 800 + z() * 500;
    const p = { x: c.x + Math.cos(w) * d, y: c.y + Math.sin(w) * d };
    if (baubar(g, p, 8)) bau(s, "villa", p);
  }
  freiraeumen(s);
  const e2: Epoche = {
    jahr: "2. Jh. n. Chr.", titel: "Blütezeit",
    text: "Die Stadt ist reich geworden: Tempel und Thermen am Forum, ein Theater. Das Amphitheater für Tausende liegt vor der Mauer, ebenso die Gräberfelder — Bestattungen in der Stadt waren verboten, also reihen sich die Gräber an den Ausfallstraßen. " +
      (aquaedukt ? "Ein Aquädukt bringt frisches Wasser mit leichtem Gefälle von einer höher gelegenen Quelle." : "Für einen Aquädukt fehlt höheres Gelände in der Nähe — die Stadt lebt von Brunnen und dem Fluss.") +
      " Vor den Toren wachsen Vorstädte (Suburbium), draußen versorgen Gutshöfe die Stadt.",
    neu: ["Tempel, Thermen, Theater", "Amphitheater vor der Mauer", "Gräber an den Fernstraßen", aquaedukt ? "Aquädukt mit Wasserverteiler" : "kein Aquädukt (kein höheres Gelände)", "Suburbium vor den Toren", "Gutshöfe auf dem Land"],
    stadt: kopie(s),
  };

  // Spätantike: kleinere Festung, Teile werden aufgegeben
  const kw = W * 0.55, kh = H * 0.6;
  const kern = rechteckPoly(c.x - kw / 2 + 30, c.y - kh / 2, c.x + kw / 2 + 30, c.y + kh / 2);
  s.mauern = [kern];
  s.zonen = [{ typ: "verlassen", poly: mauer }, { typ: "insulae", poly: kern }];
  s.bauten = s.bauten.filter(b => b.typ !== "villa");
  const e3: Epoche = {
    jahr: "um 300 n. Chr.", titel: "Spätantike",
    text: "Germaneneinfälle und Krisen: Die Bevölkerung schrumpft. Um das Zentrum entsteht eine kleinere, stärkere Mauer — oft aus den Steinen aufgegebener Gebäude. Vorstädte und Gutshöfe verfallen, die Randbezirke werden zu Gärten und Ruinen.",
    neu: ["Kleinere Festungsmauer um den Kern", "Randbezirke aufgegeben", "Vorstädte und Gutshöfe verlassen"],
    stadt: kopie(s),
  };

  // heute: das römische Raster lebt in der Altstadt weiter
  s.mauern = [];
  s.zonen = [{ typ: "altstadt", poly: mauer }];
  s.bauten = s.bauten.map(b => b.typ === "tempel" ? { ...b, typ: "kirche" as const, dreh: Math.PI / 2 } : b.typ === "forum" ? { ...b, typ: "markt" as const } : b)
    .filter(b => !["thermen", "nekropole", "castellum", "tor", "hafen"].includes(b.typ));
  s.strassen = s.strassen.filter(st => st.art !== "aquaedukt");
  const heute = industrieUndModerne(g, s, mauer, c, z, false);
  s.namen = [{ text: "Altstadt", x: c.x - 40, y: c.y - H / 2 + 30 }];
  const e4: Epoche = {
    jahr: "heute", titel: "Römisches Erbe",
    text: "Viele deutsche Städte haben römische Wurzeln — Köln, Trier, Mainz, Regensburg, Augsburg. Im Stadtplan der Altstadt sieht man das Raster noch heute: Straßen folgen Cardo und Decumanus, auf dem Tempel steht der Dom, das Forum wurde zum Markt. Draußen wuchs die Stadt wie jede europäische Stadt: Bahnhof, Gründerzeit, Neubaugebiete.",
    neu: ["Straßenraster der Altstadt = römisches Raster", "Dom auf dem Platz des Tempels", "Markt auf dem Forum", ...heute],
    stadt: kopie(s),
  };
  return [e1, e2, e3, e4];
}

// ---------------------------------------------------------------- Europäisch

/** Ring: Industrialisierung (Bahnhof, Ring, Gründerzeit, Fabriken) und Moderne in einem Schritt */
function industrieUndModerne(g: Gelaende, s: Stadt, kern: P[], c: P, z: Z, ring: boolean): string[] {
  const neu: string[] = [];
  industrialisierung(g, s, kern, c, z, ring);
  neu.push("Bahnhof vor der Altstadt", "Gründerzeitviertel und Industrie an der Bahn");
  moderne(g, s, kern, c, z);
  neu.push("Großwohnsiedlung, Einfamilienhäuser, Umgehungsstraße");
  return neu;
}

export interface EuropaeischerPlan { markt: P; R: number; burg: P | null }

export function europaeischerStandort(g: Gelaende, z: Z): EuropaeischerPlan {
  const R = 230;
  const mitte = { x: g.breite / 2, y: g.breite / 2 };
  let markt: P | null = null;
  if (g.furt) {
    // neben der Furt, auf der Seite des Burgbergs, raus aus der Aue
    const w = flussRichtung(g, g.furt) ?? 0;
    const nx = -Math.sin(w), ny = Math.cos(w);
    const seite = g.berg ? Math.sign((g.berg.x - g.furt.x) * nx + (g.berg.y - g.furt.y) * ny) || 1 : z() > 0.5 ? 1 : -1;
    for (let d = 60; d < 700 && !markt; d += 20) {
      const p = { x: g.furt.x + nx * d * seite, y: g.furt.y + ny * d * seite };
      if (baubar(g, p, 8)) markt = { x: p.x + nx * 60 * seite, y: p.y + ny * 60 * seite };
    }
  }
  markt ??= besterPunkt(g, 600, p => (baubar(g, p, 6) ? -neigungBei(g, p.x, p.y) - abstand(p, mitte) / 300 + z() : -1e9)) ?? mitte;
  let burg: P | null = null;
  if (g.berg && abstand(g.berg, markt) < 1000) burg = g.berg;
  else burg = besterPunkt(g, 60, p => {
    const d = abstand(p, markt!);
    if (d < R + 60 || d > 700 || istWasser(g, p.x, p.y)) return -1e9;
    return hoeheBei(g, p.x, p.y) - d / 40;
  });
  return { markt, R, burg };
}

/** unregelmäßige Mauer um m, die Wasser und Aue ausspart */
function mittelalterlicheMauer(g: Gelaende, m: P, R: number, seed: number): P[] {
  const r = perlin(seed + 77);
  const poly: P[] = [];
  const k = 18;
  for (let i = 0; i < k; i++) {
    const w = (i / k) * Math.PI * 2;
    let rr = R * (1 + 0.22 * r(Math.cos(w) * 1.3, Math.sin(w) * 1.3));
    let p = { x: m.x + Math.cos(w) * rr, y: m.y + Math.sin(w) * rr };
    while (rr > R * 0.35 && (istWasser(g, p.x, p.y) || inAue(g, p.x, p.y) || wasserAbstand(g, p.x, p.y) < 14)) {
      rr -= 10;
      p = { x: m.x + Math.cos(w) * rr, y: m.y + Math.sin(w) * rr };
    }
    poly.push(p);
  }
  return poly;
}

function industrialisierung(g: Gelaende, s: Stadt, kern: P[], m: P, z: Z, ring: boolean) {
  const R = Math.sqrt(kern.reduce((a, p) => Math.max(a, abstand(p, m) ** 2), 0));
  if (ring) {
    s.mauern = [];
    s.strassen.push({ art: "ring", name: "Ring", punkte: geschlossen(kern) });
    s.zonen.push({ typ: "park", poly: band(geschlossen(skaliere(kern, (R + 22) / R, m)), 26) });
  }
  // Bahn: flach, an der Altstadt vorbei, gern im Tal
  const w = flussRichtung(g, m) ?? z() * Math.PI;
  const nx = -Math.sin(w), ny = Math.cos(w);
  let best: P[] | null = null, bk = Infinity;
  for (const seite of [1, -1]) {
    const mitte = { x: m.x + nx * (R + 330) * seite, y: m.y + ny * (R + 330) * seite };
    if (mitte.x < 100 || mitte.y < 100 || mitte.x > g.breite - 100 || mitte.y > g.breite - 100) continue;
    if (istWasser(g, mitte.x, mitte.y)) continue;
    const kosten = neigungBei(g, mitte.x, mitte.y) + (inAue(g, mitte.x, mitte.y) ? 3 : 0);
    if (kosten < bk) {
      bk = kosten;
      const extra = (p: P) => (abstand(p, m) < R + 140 ? 60 : 0);
      const a = randPunkt(mitte, w + Math.PI, g.breite), b = randPunkt(mitte, w, g.breite);
      best = [...weg(g, a, mitte, { steigung: 4, wasser: 8, extra }), ...weg(g, mitte, b, { steigung: 4, wasser: 8, extra }).slice(1)];
    }
  }
  if (!best) {
    const mitte = { x: m.x + nx * (R + 330), y: m.y + ny * (R + 330) };
    best = [randPunkt(mitte, w + Math.PI, g.breite), randPunkt(mitte, w, g.breite)];
  }
  const bahn = glaetten(best, 2);
  s.strassen.push({ art: "bahn", name: "Eisenbahn", punkte: bahn });
  const rb = zurLinie(m, bahn);
  const ra = bahn[rb.seg], rbb = bahn[rb.seg + 1];
  const bw = Math.atan2(rbb.y - ra.y, rbb.x - ra.x);
  const zuM = { x: m.x - rb.q.x, y: m.y - rb.q.y }, zl = Math.hypot(zuM.x, zuM.y) || 1;
  const bhf = { x: rb.q.x + (zuM.x / zl) * 28, y: rb.q.y + (zuM.y / zl) * 28 };
  bau(s, "bahnhof", bhf, bw);
  // Bahnhofstraße zum nächsten Punkt der Altstadt
  const zielAlt = zurLinie(bhf, geschlossen(kern)).q;
  const bhfStr = [{ x: bhf.x + (zuM.x / zl) * 20, y: bhf.y + (zuM.y / zl) * 20 }, zielAlt];
  s.strassen.push({ art: "haupt", name: "Bahnhofstraße", punkte: bhfStr });
  // Gründerzeit zwischen Altstadt und Bahn (und etwas darüber hinaus)
  const gz = skaliere(kern, (R + 430) / R, m);
  const bwinkel = Math.atan2(bhfStr[1].y - bhfStr[0].y, bhfStr[1].x - bhfStr[0].x);
  const feld: Feld = { basen: [{ art: "raster", c: bhf, winkel: bwinkel, groesse: 3000 }, { art: "radial", c: m, groesse: R * 0.9 }] };
  const drin = (p: P) => inPoly(p, gz) && !inPoly(p, skaliere(kern, (R + 30) / R, m)) && !istWasser(g, p.x, p.y) && zurLinie(p, bahn).d > 22 && neigungBei(g, p.x, p.y) < 14;
  const linien = stromlinien(feld, drin, {
    dsep: 95, dtest: 40, schritt: 8, maxLaenge: 1400, minLaenge: 60, verbinden: 45, zufall: z,
    keime: [...bhfStr, ...kern.filter((_, i) => i % 3 === 0)], rahmen: { x0: m.x - R - 430, y0: m.y - R - 430, x1: m.x + R + 430, y1: m.y + R + 430 }, max: 40,
  });
  s.strassen.push(...linien.map(punkte => ({ art: "neben" as const, punkte })));
  s.zonen.splice(Math.max(0, s.zonen.findIndex(zz => zz.typ === "altstadt")), 0, { typ: "gruenderzeit", poly: gz });
  // Industrie an der Bahn
  const um = auslauf(bahn, rb.q, { x: rb.q.x - Math.cos(bw) * 9999, y: rb.q.y - Math.sin(bw) * 9999 }, 700);
  const um2 = auslauf(bahn, rb.q, { x: rb.q.x + Math.cos(bw) * 9999, y: rb.q.y + Math.sin(bw) * 9999 }, 700);
  for (const st of [um, um2]) {
    if (st.length < 2) continue;
    const L = laenge(st);
    s.zonen.push({ typ: "industrie", poly: band(st.slice(1), 170) });
    for (let d = 160; d < L - 40; d += 170) {
      const seite = (z() > 0.5 ? 1 : -1) as 1 | -1;
      const p = nebenStrasse(st, d, 52, seite);
      const { dx, dy } = punktBei(st, d);
      if (baubar(g, p, 12) && !inPoly(p, kern)) bau(s, "fabrik", p, Math.atan2(dy, dx));
    }
  }
  const fl = s.bauten.find(b => b.typ === "fabrik");
  if (fl) s.namen = [...(s.namen ?? []), { text: "Industrie", x: fl.x, y: fl.y - 40 }];
  const mh = linien.filter(l => l.length > 3).slice(0, 2);
  for (const l of mh) bau(s, "mietshaus", nebenStrasse(l, Math.min(60, laenge(l) / 2), 34, 1));
  freiraeumen(s);
}

function moderne(g: Gelaende, s: Stadt, kern: P[], m: P, z: Z) {
  const R = Math.sqrt(kern.reduce((a, p) => Math.max(a, abstand(p, m) ** 2), 0));
  const bahn = s.strassen.find(st => st.art === "bahn")?.punkte ?? [];
  const frei = (p: P, r: number) => {
    for (let i = 0; i < 9; i++) {
      const q = { x: p.x + Math.cos(i * 0.7) * r * (i % 3) / 2, y: p.y + Math.sin(i * 0.7) * r * (i % 3) / 2 };
      if (!baubar(g, q, 10)) return false;
    }
    return !s.zonen.some(zz => zz.typ !== "industrie" && inPoly(p, zz.poly));
  };
  const plaetze: P[] = [];
  for (let d = R + 650; d < R + 1250 && plaetze.length < 12; d += 80) for (let k = 0; k < 16; k++) {
    const w = (k / 16) * Math.PI * 2;
    const p = { x: m.x + Math.cos(w) * d, y: m.y + Math.sin(w) * d };
    if (p.x > 240 && p.y > 240 && p.x < g.breite - 240 && p.y < g.breite - 240 && frei(p, 200) && (!bahn.length || zurLinie(p, bahn).d > 200)) plaetze.push(p);
  }
  const verbinde = (von: P) => {
    // Zufahrt zur nächsten Hauptstraße
    let best: P | null = null, bd = Infinity;
    for (const st of s.strassen) if (st.art === "haupt" || st.art === "fernstrasse" || st.art === "ring") {
      const r = zurLinie(von, st.punkte);
      if (r.d < bd) { bd = r.d; best = r.q; }
    }
    if (best) s.strassen.push({ art: "haupt", punkte: weg(g, von, best, { steigung: 0.8, wasser: 20, raster: 20 }) });
  };
  // Großwohnsiedlung: Plattenbauten an einer Ringstraße
  const gw = plaetze[0];
  if (gw) {
    const dreh = z() * Math.PI;
    const poly = rechteck(gw, 380, 280, dreh);
    s.zonen.push({ typ: "grosssiedlung", poly });
    s.strassen.push({ art: "neben", punkte: geschlossen(rechteck(gw, 300, 200, dreh)) });
    s.strassen.push({ art: "neben", punkte: [rechteck(gw, 300, 0, dreh)[0], rechteck(gw, 300, 0, dreh)[1]] });
    bau(s, "schule", gw, dreh);
    verbinde(rechteck(gw, 300, 200, dreh)[0]);
  }
  // Einfamilienhäuser: geschwungene Straßen, Sackgassen
  const ef = plaetze.find(p => !gw || abstand(p, gw) > 650);
  if (ef) {
    const poly = rechteck(ef, 520, 420, z() * Math.PI);
    s.zonen.push({ typ: "einfamilienhaus", poly });
    const feld: Feld = { basen: [{ art: "radial", c: ef, groesse: 260 }, { art: "raster", c: ef, winkel: z() * 3, groesse: 300 }], rauschen: { r: perlin(Math.floor(z() * 1e6)), staerke: 0.6, skala: 260 } };
    const l = stromlinien(feld, p => inPoly(p, skaliere(poly, 0.92, ef)) && baubar(g, p, 18), {
      dsep: 62, dtest: 26, schritt: 6, maxLaenge: 600, minLaenge: 40, verbinden: 20, zufall: z, keime: [ef], rahmen: { x0: ef.x - 270, y0: ef.y - 220, x1: ef.x + 270, y1: ef.y + 220 }, max: 16,
    });
    s.strassen.push(...l.map(punkte => ({ art: "neben" as const, punkte })));
    verbinde(ef);
  }
  // Umgehungsstraße mit Gewerbegebiet an der Ausfahrt
  const w = (flussRichtung(g, m) ?? 0) + Math.PI / 2 * (z() > 0.5 ? 0 : 1) + (z() - 0.5) * 0.4;
  const off = { x: m.x + Math.cos(w + Math.PI / 2) * (R + 1050), y: m.y + Math.sin(w + Math.PI / 2) * (R + 1050) };
  const umg = [...weg(g, randPunkt(off, w + Math.PI, g.breite), off, { steigung: 1, wasser: 4, raster: 32 }), ...weg(g, off, randPunkt(off, w, g.breite), { steigung: 1, wasser: 4, raster: 32 }).slice(1)];
  if (umg.length > 1) {
    s.strassen.push({ art: "autobahn", name: "Umgehung", punkte: glaetten(umg, 2) });
    const r = zurLinie(m, umg);
    const zu = { x: m.x - r.q.x, y: m.y - r.q.y }, zl = Math.hypot(zu.x, zu.y) || 1;
    const ge = { x: r.q.x + zu.x / zl * 170, y: r.q.y + zu.y / zl * 170 };
    if (baubar(g, ge, 10)) {
      s.zonen.push({ typ: "gewerbe", poly: rechteck(ge, 380, 240, Math.atan2(zu.y, zu.x)) });
      bau(s, "einkauf", ge, Math.atan2(zu.y, zu.x) + Math.PI / 2);
      s.strassen.push({ art: "haupt", punkte: [{ x: r.q.x, y: r.q.y }, { x: ge.x - zu.x / zl * 70, y: ge.y - zu.y / zl * 70 }] });
      verbinde({ x: ge.x + zu.x / zl * 70, y: ge.y + zu.y / zl * 70 });
    }
  }
  freiraeumen(s);
}

export function europaeisch(g: Gelaende, seed: number): Epoche[] {
  const z = zufallsquelle(seed);
  const { markt: M, R, burg } = europaeischerStandort(g, z);
  const s = leereStadt("europaeisch");
  // Fernstraßen: über die Furt und entlang des Tals
  const wf = g.furt ? (flussRichtung(g, g.furt) ?? 0) : z() * Math.PI;
  const quer: P[] = g.furt
    ? (() => {
      const a = randPunkt(M, wf + Math.PI / 2, g.breite), b = randPunkt(g.furt, wf - Math.PI / 2, g.breite);
      const k = { steigung: 0.6, wasser: 40 };
      return [...weg(g, a, M, k), ...weg(g, M, g.furt, k).slice(1), ...weg(g, g.furt, b, k).slice(1)];
    })()
    : fernstrasse(g, M, wf + Math.PI / 2);
  const laengs = fernstrasse(g, M, wf, 0.6, 60);
  s.strassen.push({ art: "fernstrasse", name: "Fernstraße", punkte: quer }, { art: "fernstrasse", name: "Fernstraße", punkte: laengs });
  if (burg) bau(s, "burg", burg);
  bau(s, "kirche", baubarNahe(g, { x: M.x + 50, y: M.y - 40 }, z), Math.PI / 2);
  const dorf: P[] = [];
  for (let i = 0; i < 12; i++) { const w = (i / 12) * Math.PI * 2; dorf.push({ x: M.x + Math.cos(w) * 130, y: M.y + Math.sin(w) * 110 }); }
  s.zonen.push({ typ: "dorf", poly: dorf });
  if (g.furt) s.zonen.push({ typ: "dorf", poly: rechteck(g.furt, 160, 160) });
  s.namen = g.furt ? [{ text: "Furt", x: g.furt.x + 30, y: g.furt.y }] : [];
  const e1: Epoche = {
    jahr: "um 900", titel: "Burg, Kirche und Furt",
    text: g.furt
      ? "Am Anfang steht ein günstiger Ort: Hier ist der Fluss flach genug, um ihn zu durchwaten — eine Furt. Zwei Fernstraßen treffen sich. Auf der Anhöhe sichert eine Burg den Übergang, daneben entsteht eine kleine Siedlung mit Kirche, sicher über dem Hochwasser."
      : "Zwei Fernstraßen kreuzen sich auf trockenem Grund. Eine Burg auf der Anhöhe schützt die Kreuzung, daneben entsteht eine kleine Siedlung mit Kirche.",
    neu: [g.furt ? "Furt über den Fluss" : "Kreuzung zweier Fernstraßen", burg ? "Burg auf der Anhöhe" : "keine Anhöhe für eine Burg", "Kirche und Siedlung außerhalb der Aue"],
    stadt: kopie(s),
  };

  // Marktstadt mit Mauer
  const mauer = mittelalterlicheMauer(g, M, R, seed);
  s.mauern = [mauer];
  if (burg && abstand(burg, M) < 900) s.mauern.push(rechteck(burg, 110, 96, z()));
  s.zonen = [{ typ: "altstadt", poly: mauer }];
  s.bauten = s.bauten.filter(b => b.typ !== "kirche");
  bau(s, "markt", M, wf);
  bau(s, "kirche", { x: M.x + Math.cos(wf + 1.2) * 75, y: M.y + Math.sin(wf + 1.2) * 75 }, wf);
  bau(s, "rathaus", { x: M.x + Math.cos(wf - 1.6) * 52, y: M.y + Math.sin(wf - 1.6) * 52 }, wf);
  const tore: P[] = [];
  for (const f of [quer, laengs]) for (const t of schnitte(f, geschlossen(mauer))) { tore.push(t); bau(s, "tor", t); }
  const gassenFeld: Feld = {
    basen: [{ art: "radial", c: M, groesse: R * 0.8 }, { art: "raster", c: M, winkel: wf, groesse: R * 2.2 }],
    rauschen: { r: perlin(seed + 5), staerke: 0.35, skala: 180 },
  };
  const innen = skaliere(mauer, 0.95, M);
  const gassen = stromlinien(gassenFeld, p => inPoly(p, innen) && !istWasser(g, p.x, p.y), {
    dsep: 36, dtest: 15, schritt: 5, maxLaenge: 700, minLaenge: 30, verbinden: 18, zufall: z,
    keime: [...tore, M], rahmen: { x0: M.x - R * 1.3, y0: M.y - R * 1.3, x1: M.x + R * 1.3, y1: M.y + R * 1.3 }, max: 60,
  });
  s.strassen.push(...gassen.map(punkte => ({ art: "gasse" as const, punkte })));
  // Hauptgassen vom Markt zu den Toren
  for (const t of tore) s.strassen.push({ art: "haupt", punkte: weg(g, M, t, { steigung: 0.4, wasser: 60, raster: 12, extra: p => (inPoly(p, mauer) ? 0 : 50) }) });
  const kl = mauer[Math.floor(z() * mauer.length)];
  bau(s, "kloster", { x: kl.x + (M.x - kl.x) * 0.3, y: kl.y + (M.y - kl.y) * 0.3 });
  const muehle = besterPunkt(g, 20, p => {
    const d = wasserAbstand(g, p.x, p.y);
    if (d < 6 || d > 22 || g.wasser[Math.floor(p.y / g.zelle) * g.n + Math.floor(p.x / g.zelle)]) return -1e9;
    return -abstand(p, M);
  });
  if (muehle && abstand(muehle, M) < R + 300) bau(s, "muehle", muehle);
  bau(s, "friedhof", { x: M.x + Math.cos(wf + 1.2) * 75 + Math.cos(wf) * 70, y: M.y + Math.sin(wf + 1.2) * 75 + Math.sin(wf) * 70 });
  freiraeumen(s);
  s.namen = [];
  const e2: Epoche = {
    jahr: "um 1250", titel: "Marktstadt mit Stadtrecht",
    text: "Der Stadtherr verleiht das Stadtrecht: Markt, eigene Gerichte, eine Mauer. Der Markt liegt an der Fernstraße, nahe am Flussübergang — hier kommen die Händler vorbei. Kirche und Rathaus stehen am Markt. Die Mauer folgt dem Gelände und meidet die Aue. Innen wachsen enge, krumme Gassen, Haus an Haus. Eine Mühle nutzt die Wasserkraft.",
    neu: ["Marktplatz mit Rathaus und Kirche", "Mauer mit Toren an den Fernstraßen", "Enge, unregelmäßige Gassen", "Kirchhof (Friedhof) an der Kirche", "Kloster, Mühle am Fluss"],
    stadt: kopie(s),
  };

  // Vorstädte
  const fernen = [quer, laengs];
  let spital = false;
  for (const t of tore) {
    const f = fernen.reduce((a, b) => (zurLinie(t, a).d < zurLinie(t, b).d ? a : b));
    const vor = auslauf(f, t, M, 300);
    if (vor.length < 2) continue;
    s.zonen.push({ typ: "vorstadt", poly: band(vor, 110) });
    if (!spital && laenge(vor) > 120) { bau(s, "spital", nebenStrasse(vor, 70, 34, 1)); spital = true; }
  }
  s.bauten = s.bauten.filter(b => b.typ !== "friedhof");
  const fh = baubarNahe(g, { x: M.x + Math.cos(wf + 2.5) * (R + 160), y: M.y + Math.sin(wf + 2.5) * (R + 160) }, z, 200, 10);
  bau(s, "friedhof", fh);
  freiraeumen(s);
  const e3: Epoche = {
    jahr: "um 1550", titel: "Vorstädte vor den Toren",
    text: "In der Mauer wird es eng. Vor den Toren, entlang der Fernstraßen, entstehen Vorstädte — dort wohnen Handwerker, Fuhrleute und alle, die sich das Bürgerrecht nicht leisten können. Das Spital für Kranke und Pilger liegt vor dem Tor, der Friedhof wird wegen Seuchen aus der Stadt verlegt.",
    neu: ["Vorstädte entlang der Ausfallstraßen", "Spital vor dem Tor", "Friedhof vor die Stadt verlegt"],
    stadt: kopie(s),
  };

  // Industrialisierung
  industrialisierung(g, s, mauer, M, z, true);
  s.mauern = s.mauern.slice(0, 0);
  const e4: Epoche = {
    jahr: "um 1890", titel: "Industrialisierung",
    text: "Die Mauer wird abgerissen — an ihrer Stelle entsteht ein breiter Ring mit Grünanlagen. Die Eisenbahn kommt, der Bahnhof liegt vor der Altstadt, wo noch Platz ist, und eine Bahnhofstraße führt ins Zentrum. Fabriken siedeln sich an der Bahn an. Für die Arbeiter wachsen Gründerzeitviertel: gerade Straßen, geschlossene Blöcke, Mietskasernen mit Hinterhöfen.",
    neu: ["Ring auf der alten Mauer", "Bahnhof und Bahnhofstraße", "Fabriken an der Bahn", "Gründerzeitviertel mit Blockrandbebauung"],
    stadt: kopie(s),
  };

  moderne(g, s, mauer, M, z);
  s.namen = [{ text: "Fußgängerzone", x: M.x + 20, y: M.y + 50 }];
  const e5: Epoche = {
    jahr: "um 1975", titel: "Moderne Stadt",
    text: "Nach dem Krieg wächst die Stadt nach außen: Großwohnsiedlungen mit Hochhäusern am Stadtrand, Einfamilienhäuser mit geschwungenen Straßen und Sackgassen. Das Auto prägt die Planung — eine Umgehungsstraße, an der Ausfahrt ein Einkaufszentrum auf der grünen Wiese. Die Altstadt wird zur Fußgängerzone.",
    neu: ["Großwohnsiedlung (Plattenbau)", "Einfamilienhausgebiet mit Sackgassen", "Umgehungsstraße", "Einkaufszentrum an der Ausfahrt", "Fußgängerzone in der Altstadt"],
    stadt: kopie(s),
  };
  return [e1, e2, e3, e4, e5];
}

// ---------------------------------------------------------------- Amerikanisch

export function amerikanischerStandort(g: Gelaende, z: Z): P {
  const mitte = { x: g.breite / 2, y: g.breite / 2 };
  return besterPunkt(g, 1150, p => {
    if (!baubar(g, p, 6)) return -1e9;
    let n = 0;
    for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) n += baubar(g, { x: p.x + i * 110, y: p.y + j * 90 }, 10) ? 1 : 0;
    return n - abstand(p, mitte) / 250 + z() * 0.5 - Math.abs(wasserAbstand(g, p.x, p.y) - 300) / 600;
  }) ?? mitte;
}

export function amerikanisch(g: Gelaende, seed: number): Epoche[] {
  const z = zufallsquelle(seed);
  const c = amerikanischerStandort(g, z);
  const bx = 110, by = 90;
  const s = leereStadt("amerikanisch");
  // schnurgerade Bahn, fast Ost–West
  const bw = (z() - 0.5) * 0.3;
  const bahnRoh = [randPunkt(c, bw + Math.PI, g.breite), randPunkt(c, bw, g.breite)];
  const bahn = zerschneiden(bahnRoh, g, true).sort((a, b) => laenge(b) - laenge(a))[0] ?? bahnRoh;
  s.strassen.push({ art: "bahn", name: "Railroad", punkte: [bahn[0], bahn[bahn.length - 1]] });
  // Raster nach Himmelsrichtungen — dem Gelände egal (Land Ordinance 1785)
  const ox = c.x, oy = c.y - 30;
  const kx0 = c.x - 3 * bx, kx1 = c.x + 3 * bx, ky0 = oy - 4 * by, ky1 = oy + 2 * by;
  s.strassen.push(...raster(g, kx0, ky0, kx1, ky1, bx, by, ox, oy).filter(st => !st.punkte.every(p => Math.abs(p.x - c.x) < 1)));
  s.strassen.push({ art: "haupt", name: "Main Street", punkte: [{ x: c.x, y: ky0 }, { x: c.x, y: ky1 }] });
  bau(s, "depot", { x: c.x + 50, y: c.y - 16 }, bw);
  bau(s, "silo", { x: c.x + 200, y: c.y - 22 });
  bau(s, "gericht", { x: c.x + bx / 2 + bx, y: oy - by * 1.5 });
  bau(s, "kirche", { x: c.x - bx * 1.5, y: oy - by * 2.5 + 10 });
  s.zonen.push({ typ: "kleinstadt", poly: rechteckPoly(kx0, ky0, kx1, ky1) });
  s.namen = [{ text: "Main Street", x: c.x + 8, y: ky0 + 30 }];
  freiraeumen(s);
  const e1: Epoche = {
    jahr: "um 1870", titel: "Eisenbahnstadt",
    text: "Die Eisenbahngesellschaft legt die Stadt an, wo ihre Strecke verläuft: ein Depot, ein Getreidesilo für die Farmer, und ein Schachbrett aus gleich großen Blöcken, ausgerichtet nach Norden — ganz gleich, wie das Gelände ist. Die Main Street beginnt am Bahnhof. Mitten im Raster steht das Courthouse auf seinem eigenen Platz. Südlich der Gleise wohnt, wer arm ist: »the wrong side of the tracks«.",
    neu: ["Bahnlinie als Grund der Stadt", "Depot und Getreidesilo", "Schachbrett nach Himmelsrichtungen", "Main Street ab dem Bahnhof", "Courthouse Square"],
    stadt: kopie(s),
  };

  // Straßenbahnstadt
  const R2 = 820;
  const gx0 = c.x - R2, gx1 = c.x + R2, gy0 = c.y - R2, gy1 = c.y + R2;
  const altStr = s.strassen.filter(st => st.art !== "neben");
  s.strassen = [...altStr, ...raster(g, gx0, gy0, gx1, gy1, bx, by, ox, oy).filter(st => !st.punkte.every(p => Math.abs(p.x - c.x) < 1))];
  s.strassen = s.strassen.filter(st => st.name !== "Main Street");
  s.strassen.push({ art: "haupt", name: "Main Street", punkte: [{ x: c.x, y: gy0 }, { x: c.x, y: gy1 }] });
  const ave = oy - 2 * by;
  s.strassen.push({ art: "haupt", name: "Streetcar", punkte: [{ x: gx0, y: ave }, { x: gx1, y: ave }] });
  s.strassen.push({ art: "haupt", name: "Streetcar", punkte: [{ x: c.x - 4 * bx, y: gy0 }, { x: c.x - 4 * bx, y: gy1 }] });
  s.strassen.push({ art: "haupt", name: "Streetcar", punkte: [{ x: c.x + 4 * bx, y: gy0 }, { x: c.x + 4 * bx, y: gy1 }] });
  s.strassen = s.strassen.flatMap(st => (st.art === "haupt" ? zerschneiden(st.punkte, g, true).map(p => ({ ...st, punkte: [p[0], p[p.length - 1]] })) : [st]));
  const cbd = rechteckPoly(c.x - 1.5 * bx, oy - 3 * by, c.x + 1.5 * bx, oy);
  const ueb = rechteckPoly(c.x - 3.5 * bx, oy - 5 * by, c.x + 3.5 * bx, oy + 2 * by);
  const ind = band([bahn[0], bahn[bahn.length - 1]], 190);
  const arb = rechteckPoly(c.x - 6 * bx, c.y - 2.5 * by, c.x + 6 * bx, c.y + 3.5 * by);
  s.zonen = [{ typ: "vorort", poly: rechteckPoly(gx0, gy0, gx1, gy1) }, { typ: "arbeiter", poly: arb }, { typ: "industrie", poly: ind }, { typ: "uebergang", poly: ueb }, { typ: "cbd", poly: cbd }];
  for (let k = -3; k <= 3; k++) {
    if (k === 0) continue;
    const p = { x: c.x + k * 1.4 * bx + 60, y: c.y + (k % 2 ? 52 : -52) };
    if (baubar(g, p, 20)) bau(s, "fabrik", p, bw);
  }
  bau(s, "hochhaus", { x: c.x + bx / 2, y: oy - by / 2 });
  bau(s, "hochhaus", { x: c.x - bx / 2, y: oy - by * 1.5 });
  bau(s, "schule", { x: c.x - 5.5 * bx, y: oy - 5.5 * by });
  bau(s, "kirche", { x: c.x + 4.5 * bx, y: oy - 4.5 * by });
  s.namen = [{ text: "CBD", x: c.x - 20, y: oy - 3 * by - 10 }];
  freiraeumen(s);
  const e2: Epoche = {
    jahr: "um 1910", titel: "Straßenbahnstadt",
    text: "Die Stadt wächst schnell. Das Raster wird einfach weitergezeichnet — über Hügel und Bäche hinweg. Im Zentrum (Central Business District) steigen die Bodenpreise, die ersten Hochhäuser entstehen. Straßenbahnen fahren die Avenues hinaus, an ihren Enden wachsen Wohnviertel (Streetcar Suburbs). Fabriken liegen an der Bahn, die Arbeiter wohnen gleich daneben. Rund ums Zentrum verfällt die Übergangszone.",
    neu: ["Raster ohne Rücksicht aufs Gelände", "CBD mit ersten Hochhäusern", "Straßenbahn-Avenues und Wohnviertel", "Fabriken und Arbeiterviertel an der Bahn", "Übergangszone um das Zentrum"],
    stadt: kopie(s),
  };

  // Autostadt
  const ix = c.x + 2.5 * bx;
  const inter = zerschneiden([{ x: ix + 40, y: 0 }, { x: ix, y: c.y }, { x: ix - 40, y: g.breite }], g, true).sort((a, b) => laenge(b) - laenge(a))[0];
  if (inter) s.strassen.push({ art: "autobahn", name: "Interstate", punkte: inter });
  const vorstaedte: P[] = [];
  for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1], [-1, 0], [1, 0]]) {
    const p = { x: c.x + dx * (R2 + 330), y: c.y + dy * (R2 + 330) };
    if (p.x > 150 && p.y > 150 && p.x < g.breite - 150 && p.y < g.breite - 150 && baubar(g, p, 16)) vorstaedte.push(p);
  }
  const seedR = perlin(seed + 9);
  for (const v of vorstaedte.slice(0, 3)) {
    const poly = rechteck(v, 560, 480, 0);
    s.zonen.unshift({ typ: "pendler", poly });
    const feld: Feld = { basen: [{ art: "radial", c: v, groesse: 220 }, { art: "raster", c: v, winkel: 0.4, groesse: 260 }], rauschen: { r: seedR, staerke: 0.7, skala: 220 } };
    const l = stromlinien(feld, p => inPoly(p, skaliere(poly, 0.94, v)) && !istWasser(g, p.x, p.y) && neigungBei(g, p.x, p.y) < 20 && Math.abs(p.x - ix) > 30, {
      dsep: 64, dtest: 24, schritt: 6, maxLaenge: 500, minLaenge: 40, verbinden: 14, zufall: z, keime: [v], rahmen: { x0: v.x - 280, y0: v.y - 240, x1: v.x + 280, y1: v.y + 240 }, max: 14,
    });
    s.strassen.push(...l.map(punkte => ({ art: "neben" as const, punkte })));
    // Zubringer zum Raster
    const ziel = { x: Math.max(gx0, Math.min(gx1, v.x)), y: Math.max(gy0, Math.min(gy1, v.y)) };
    s.strassen.push({ art: "haupt", punkte: zerschneiden([v, ziel], g)[0] ?? [v, ziel] });
    bau(s, "schule", { x: v.x + 90, y: v.y + 70 });
  }
  bau(s, "hochhaus", { x: c.x + bx / 2, y: oy - by * 2.5 });
  bau(s, "hochhaus", { x: c.x - bx / 2, y: oy - by * 0.5 });
  freiraeumen(s);
  const e3: Epoche = {
    jahr: "um 1960", titel: "Autostadt",
    text: "Mit dem Auto ziehen die Familien in die Vororte (Suburbs): Einfamilienhäuser mit Rasen, geschwungene Straßen und Sackgassen (Cul-de-sacs) statt Raster. Eine Interstate wird mitten durch die Stadt gebaut und zerschneidet alte Viertel. Im CBD stehen mehr und höhere Hochhäuser, aber abends ist er leer — gewohnt wird draußen.",
    neu: ["Suburbs mit geschwungenen Straßen und Sackgassen", "Interstate durch die Stadt", "Pendeln: Wohnen draußen, Arbeiten im CBD"],
    stadt: kopie(s),
  };

  // Sprawl
  const RB = 1260;
  const ringP: P[] = [];
  for (let i = 0; i <= 32; i++) { const w = (i / 32) * Math.PI * 2; ringP.push({ x: c.x + Math.cos(w) * RB, y: c.y + Math.sin(w) * RB * 0.92 }); }
  for (const st of zerschneiden(ringP, g, true)) s.strassen.push({ art: "autobahn", name: "Beltway", punkte: st });
  const kreuz = inter ? schnitte(inter, ringP).sort((a, b) => a.y - b.y) : [];
  const mallOrt = kreuz.find(p => p.y > 200 && p.y < g.breite - 200) ?? { x: c.x + RB * 0.7, y: c.y + RB * 0.6 };
  const mall = baubarNahe(g, { x: mallOrt.x + 170, y: mallOrt.y + (mallOrt.y < c.y ? 120 : -120) }, z, 250, 10);
  if (mall) {
    bau(s, "einkauf", mall);
    s.zonen.push({ typ: "parkplatz", poly: rechteck(mall, 300, 200) });
    const buero = baubarNahe(g, { x: mall.x, y: mall.y + (mall.y < c.y ? -220 : 220) }, z, 200, 10);
    if (buero) { bau(s, "buero", buero); s.zonen.push({ typ: "gewerbe", poly: rechteck(buero, 260, 180) }); }
  }
  for (const v of vorstaedte.slice(3, 6)) {
    const poly = rechteck(v, 560, 480, 0);
    s.zonen.unshift({ typ: "pendler", poly });
    const feld: Feld = { basen: [{ art: "radial", c: v, groesse: 220 }], rauschen: { r: seedR, staerke: 0.8, skala: 200 } };
    const l = stromlinien(feld, p => inPoly(p, skaliere(poly, 0.94, v)) && !istWasser(g, p.x, p.y) && neigungBei(g, p.x, p.y) < 20 && Math.abs(p.x - ix) > 30, {
      dsep: 70, dtest: 26, schritt: 6, maxLaenge: 500, minLaenge: 40, verbinden: 12, zufall: z, keime: [v], rahmen: { x0: v.x - 280, y0: v.y - 240, x1: v.x + 280, y1: v.y + 240 }, max: 12,
    });
    s.strassen.push(...l.map(punkte => ({ art: "neben" as const, punkte })));
  }
  s.zonen.push({ typ: "parkplatz", poly: rechteckPoly(c.x - 3 * bx + 6, oy - 4 * by + 6, c.x - 2 * bx - 6, oy - 3 * by - 6) });
  s.zonen.push({ typ: "parkplatz", poly: rechteckPoly(c.x + 2 * bx + 6, oy - 1 * by + 6, c.x + 3 * bx - 6, oy - 6) });
  s.namen = [{ text: "CBD", x: c.x - 20, y: oy - 3 * by - 10 }, ...(mall ? [{ text: "Edge City", x: mall.x - 40, y: mall.y - 110 }] : [])];
  freiraeumen(s);
  const e4: Epoche = {
    jahr: "um 2000", titel: "Sprawl und Edge City",
    text: "Ein Autobahnring (Beltway) umschließt die Stadt. An seinen Ausfahrten entstehen Shopping Malls und Bürostädte (Edge Cities) — neue Zentren weit draußen. Die Vororte fressen sich ins Land (Urban Sprawl). Im alten Zentrum werden Gebäude für Parkplätze abgerissen. Von innen nach außen liegen die Zonen wie Ringe: CBD, Übergangszone, Arbeiterviertel, Wohnviertel, Pendlerzone (Burgess-Modell).",
    neu: ["Autobahnring (Beltway)", "Mall und Bürostadt an der Ausfahrt", "Urban Sprawl", "Parkplätze im Zentrum"],
    stadt: kopie(s),
  };
  return [e1, e2, e3, e4];
}

export function wachse(stil: Stil, g: Gelaende, seed: number): Epoche[] {
  if (stil === "roemisch") return roemisch(g, seed);
  if (stil === "europaeisch") return europaeisch(g, seed);
  return amerikanisch(g, seed);
}

/** Zonentypen, die in einer Stadt vorkommen (für Quiz und Legende) */
export function zonenIn(s: Stadt): ZonenTyp[] {
  return [...new Set(s.zonen.map(z => z.typ))];
}
