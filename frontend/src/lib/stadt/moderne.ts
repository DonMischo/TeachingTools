/**
 * Spätere Epochen, die viele Stile teilen: Industrialisierung (Ring auf der
 * Mauer, Bahn, Bahnhof, Gründerzeit, Fabriken) und Moderne (Großsiedlung,
 * Einfamilienhäuser, Umgehung mit Einkaufszentrum).
 */
import { inAue, istWasser, neigungBei, type Gelaende } from "@/lib/gelaende/gelaende";
import { perlin } from "@/lib/gelaende/rauschen";
import { abstand, geschlossen, inPoly, laenge, punktBei, rechteck, skaliere, zurLinie, type P } from "./geometrie";
import type { Stadt } from "./modell";
import { auslauf, band, bau, baubar, flussRichtung, freiraeumen, nebenStrasse, type Z } from "./hilfen";
import { stromlinien, type Feld } from "./tensor";
import { glaetten, randPunkt, weg } from "./wege";

/** Ring: Industrialisierung (Bahnhof, Ring, Gründerzeit, Fabriken) und Moderne in einem Schritt */
export function industrieUndModerne(g: Gelaende, s: Stadt, kern: P[], c: P, z: Z, ring: boolean): string[] {
  const neu: string[] = [];
  industrialisierung(g, s, kern, c, z, ring);
  neu.push("Bahnhof vor der Altstadt", "Gründerzeitviertel und Industrie an der Bahn");
  moderne(g, s, kern, c, z);
  neu.push("Großwohnsiedlung, Einfamilienhäuser, Umgehungsstraße");
  return neu;
}

export function industrialisierung(g: Gelaende, s: Stadt, kern: P[], m: P, z: Z, ring: boolean) {
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

export function moderne(g: Gelaende, s: Stadt, kern: P[], m: P, z: Z) {
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

