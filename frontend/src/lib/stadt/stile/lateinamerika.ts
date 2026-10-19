/**
 * Lateinamerikanische Stadt nach dem Phasenmodell von Borsdorf, Bähr und
 * Janoschka (2002): kompakt → sektoral → polarisiert → fragmentiert.
 *   1600  Kolonialstadt nach den Leyes de Indias: Schachbrett um die Plaza Mayor
 *   1930  sektoral: Oberschicht zieht entlang eines Boulevards hinaus, Industrie an der Bahn
 *   1970  polarisiert: Landflucht, Marginalsiedlungen an Hängen und in der Aue
 *   2000  fragmentiert: Gated Communities, Malls, Stadtautobahnen — Inseln von Reich und Arm
 */
import { inAue, istWasser, neigungBei, type Gelaende } from "@/lib/gelaende/gelaende";
import { perlin, zufallsquelle } from "@/lib/gelaende/rauschen";
import { abstand, inPoly, rechteck, type P } from "../geometrie";
import { kopie, leereStadt, type Epoche, type Stadt } from "../modell";
import { band, bau, baubar, besterPunkt, fernstrasse, freiraeumen, raster, zerschneiden, type Z } from "../hilfen";
import { stromlinien, type Feld } from "../tensor";
import { randPunkt, weg } from "../wege";

const polar = (c: P, w: number, r: number): P => ({ x: c.x + Math.cos(w) * r, y: c.y + Math.sin(w) * r });

/** unregelmäßiger Fleck als Polygon */
function fleck(c: P, r: number, seed: number): P[] {
  const n = perlin(seed);
  return Array.from({ length: 20 }, (_, i) => {
    const w = (i / 20) * Math.PI * 2;
    return polar(c, w, r * (1 + 0.35 * n(Math.cos(w) * 1.4, Math.sin(w) * 1.4)));
  });
}

/** dichte, krumme Wege in einer Marginalsiedlung */
function wildeWege(g: Gelaende, s: Stadt, poly: P[], c: P, r: number, z: Z) {
  const feld: Feld = { basen: [{ art: "radial", c, groesse: r }], rauschen: { r: perlin(Math.floor(z() * 1e6)), staerke: 1.1, skala: 90 } };
  const l = stromlinien(feld, p => inPoly(p, poly) && !istWasser(g, p.x, p.y), {
    dsep: 26, dtest: 10, schritt: 4, maxLaenge: 400, minLaenge: 20, verbinden: 10, zufall: z, keime: [c],
    rahmen: { x0: c.x - r * 1.4, y0: c.y - r * 1.4, x1: c.x + r * 1.4, y1: c.y + r * 1.4 }, max: 40,
  });
  s.strassen.push(...l.map(punkte => ({ art: "gasse" as const, punkte })));
}

export function lateinamerika(g: Gelaende, seed: number): Epoche[] {
  const z = zufallsquelle(seed);
  const mitte = { x: g.breite / 2, y: g.breite / 2 };
  const c = besterPunkt(g, 1000, p => {
    if (!baubar(g, p, 5)) return -1e9;
    let gut = 0;
    for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) if (baubar(g, { x: p.x + i * 110, y: p.y + j * 110 }, 10)) gut++;
    return gut - abstand(p, mitte) / 300 + z() * 0.5;
  }) ?? mitte;
  const B = 110;
  const s = leereStadt("lateinamerika");
  // Kolonialstadt: 5×5 Cuadras um die Plaza
  const k0 = 2.5 * B;
  s.strassen.push(...raster(g, c.x - k0, c.y - k0, c.x + k0, c.y + k0, B, B, c.x - B / 2, c.y - B / 2));
  s.zonen.push({ typ: "kolonial", poly: rechteck(c, 2 * k0, 2 * k0) });
  bau(s, "plaza", c, 0);
  bau(s, "kathedrale", { x: c.x + B, y: c.y }, 0);
  bau(s, "cabildo", { x: c.x - B, y: c.y + 10 }, 0);
  bau(s, "kirche", { x: c.x - B * 2, y: c.y - B * 2 }, 0);
  for (const w of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const f = fernstrasse(g, polar(c, w, k0), w);
    const teil = f.filter(p => abstand(p, c) > k0 * 0.98);
    if (teil.length > 1) s.strassen.push({ art: "fernstrasse", name: "Camino Real", punkte: teil });
  }
  s.namen = [{ text: "Plaza Mayor", x: c.x - 40, y: c.y - 62 }];
  freiraeumen(s);
  const e1: Epoche = {
    jahr: "um 1600", titel: "Kolonialstadt",
    text: "Die spanische Krone schreibt vor, wie Städte in Amerika anzulegen sind (Leyes de Indias, 1573): ein Schachbrett aus quadratischen Blöcken (Cuadras) um die Plaza Mayor. An der Plaza stehen Kathedrale, Rathaus (Cabildo) und Gouverneurspalast. Je näher an der Plaza, desto vornehmer — die Oberschicht wohnt im Zentrum, die Armen am Rand. Genau umgekehrt wie in der nordamerikanischen Stadt.",
    neu: ["Plaza Mayor mit Kathedrale und Cabildo", "Schachbrett aus Cuadras", "Oberschicht im Zentrum, Arme am Rand"],
    stadt: kopie(s),
  };

  // sektorale Stadt
  const k1 = 6.5 * B;
  s.strassen = s.strassen.filter(st => st.art !== "neben");
  s.strassen.push(...raster(g, c.x - k1, c.y - k1, c.x + k1, c.y + k1, B, B, c.x - B / 2, c.y - B / 2));
  // Richtung des Oberschicht-Sektors: bergauf, weg vom Fluss
  let bestW = 0, bestH = -Infinity;
  for (let k = 0; k < 8; k++) {
    const w = (k / 8) * Math.PI * 2, p = polar(c, w, 1100);
    const h = baubar(g, p, 14) ? -neigungBei(g, p.x, p.y) * 0.2 + (inAue(g, p.x, p.y) ? -5 : 0) + z() : -1e9;
    if (h > bestH) { bestH = h; bestW = w; }
  }
  const boul = zerschneiden([polar(c, bestW, k0), polar(c, bestW, 1400)], g)[0] ?? [c, polar(c, bestW, 1200)];
  s.strassen.push({ art: "ring", name: "Prachtboulevard", punkte: [boul[0], boul[boul.length - 1]] });
  const sektor = band([polar(c, bestW, k0 * 0.8), polar(c, bestW, 1500)], 520);
  // Villenstraßen im Sektor jenseits des alten Rasters
  s.strassen.push(...raster(g, c.x - 1600, c.y - 1600, c.x + 1600, c.y + 1600, 140, 140, c.x - B / 2, c.y - B / 2, "neben",
    p => inPoly(p, sektor) && (Math.abs(p.x - c.x) > k1 || Math.abs(p.y - c.y) > k1)));
  const bahnW = bestW + Math.PI;
  const bahnMitte = polar(c, bahnW, 650);
  const bahnRoh = [randPunkt(bahnMitte, bahnW + Math.PI / 2, g.breite), randPunkt(bahnMitte, bahnW - Math.PI / 2, g.breite)];
  const bahn = zerschneiden(bahnRoh, g, true).sort((a, b) => b.length - a.length)[0];
  if (bahn) s.strassen.push({ art: "bahn", name: "Eisenbahn", punkte: [bahn[0], bahn[bahn.length - 1]] });
  s.zonen = [
    { typ: "arbeiter", poly: rechteck(c, 2 * k1, 2 * k1) },
    { typ: "verfall", poly: rechteck(c, 2 * k0, 2 * k0) },
    { typ: "industrie", poly: band([bahnRoh[0], bahnRoh[1]], 220) },
    { typ: "oberschicht", poly: sektor },
  ];
  for (let i = -2; i <= 2; i++) {
    const p = polar(polar(bahnMitte, bahnW, 60), bahnW + Math.PI / 2, i * 260);
    if (baubar(g, p, 14)) bau(s, "fabrik", p, bahnW);
  }
  s.namen = [{ text: "Barrio alto", x: polar(c, bestW, 1100).x, y: polar(c, bestW, 1100).y }];
  freiraeumen(s);
  const e2: Epoche = {
    jahr: "um 1930", titel: "Sektorale Stadt",
    text: "Mit dem Exportboom wächst die Stadt. Die Oberschicht verlässt das enge Zentrum und zieht entlang eines Prachtboulevards in neue Villenviertel hinaus — ein Sektor, der sich immer weiter vom Zentrum entfernt. Gegenüber entsteht an der Bahn ein Industriesektor mit Arbeitervierteln. Die alten Kolonialhäuser im Zentrum werden in viele kleine Mietwohnungen aufgeteilt und verfallen (Conventillos).",
    neu: ["Oberschicht-Sektor entlang des Boulevards", "Industriesektor an der Bahn", "Zentrum verfällt (Conventillos)"],
    stadt: kopie(s),
  };

  // polarisierte Stadt: Marginalsiedlungen in Ungunstlagen
  const marg: P[] = [];
  for (let i = 0; i < 5; i++) {
    const p = besterPunkt(g, 200, q => {
      const d = abstand(q, c);
      if (d < k1 * 0.95 || d > 1500 || istWasser(g, q.x, q.y) || inPoly(q, sektor)) return -1e9;
      if (marg.some(m => abstand(m, q) < 380)) return -1e9;
      // Hänge und Aue: dort will niemand sonst wohnen
      return neigungBei(g, q.x, q.y) * 0.4 + (inAue(g, q.x, q.y) ? 6 : 0) - d / 400 + z();
    });
    if (!p) break;
    marg.push(p);
    const poly = fleck(p, 170 + z() * 60, seed + i * 31);
    s.zonen.push({ typ: "marginal", poly });
    wildeWege(g, s, poly, p, 190, z);
  }
  const sb = besterPunkt(g, 250, q => {
    const d = abstand(q, c);
    if (d < k1 + 150 || d > 1400 || !baubar(g, q, 10) || inPoly(q, sektor) || marg.some(m => abstand(m, q) < 400)) return -1e9;
    return -d / 300 + z();
  });
  if (sb) {
    s.zonen.push({ typ: "sozialbau", poly: rechteck(sb, 380, 280) });
    s.strassen.push(...raster(g, sb.x - 170, sb.y - 120, sb.x + 170, sb.y + 120, 85, 60, sb.x, sb.y));
  }
  freiraeumen(s);
  const e3: Epoche = {
    jahr: "um 1970", titel: "Polarisierte Stadt",
    text: "Millionen Menschen ziehen vom Land in die Stadt (Landflucht). Wohnungen gibt es nicht — sie bauen selbst: Marginalsiedlungen (Favelas, Barriadas, Villas miseria) aus Wellblech und Ziegeln, oft über Nacht. Sie liegen dort, wo sonst niemand bauen will: an steilen Hängen (Rutschungen) und in der Aue (Hochwasser). Der Staat antwortet mit sozialem Wohnungsbau am Stadtrand. Arm und Reich driften auseinander: Polarisierung.",
    neu: ["Marginalsiedlungen an Hängen und in der Aue", "Sozialer Wohnungsbau am Rand", "Landflucht, schnelles Wachstum (Megacity)"],
    stadt: kopie(s),
  };

  // fragmentierte Stadt
  const ringP: P[] = [];
  for (let i = 0; i <= 28; i++) ringP.push(polar(c, (i / 28) * Math.PI * 2, 1250));
  for (const st of zerschneiden(ringP, g, true)) s.strassen.push({ art: "autobahn", name: "Stadtautobahn", punkte: st });
  const gated: P[] = [];
  for (const a of [-0.5, 0.5, 0, 1.4, -1.4]) {
    const p = polar(c, bestW + a, 1150 + z() * 200);
    if (!baubar(g, p, 14) || p.x < 200 || p.y < 200 || p.x > g.breite - 200 || p.y > g.breite - 200) continue;
    if (gated.some(q => abstand(q, p) < 420)) continue;
    gated.push(p);
    const poly = rechteck(p, 300, 240, z());
    s.zonen.push({ typ: "gated", poly });
    s.mauern.push(poly);
    const feld: Feld = { basen: [{ art: "radial", c: p, groesse: 120 }], rauschen: { r: perlin(seed + gated.length), staerke: 0.5, skala: 150 } };
    const l = stromlinien(feld, q => inPoly(q, rechteck(p, 260, 200, 0)) && !istWasser(g, q.x, q.y), {
      dsep: 55, dtest: 20, schritt: 5, maxLaenge: 300, minLaenge: 30, verbinden: 12, zufall: z, keime: [p], rahmen: { x0: p.x - 150, y0: p.y - 120, x1: p.x + 150, y1: p.y + 120 }, max: 6,
    });
    s.strassen.push(...l.map(punkte => ({ art: "neben" as const, punkte })));
    // Zufahrt mit Pförtner zur Autobahn
    s.strassen.push({ art: "haupt", punkte: weg(g, p, polar(c, Math.atan2(p.y - c.y, p.x - c.x), 1250), { steigung: 0.5, wasser: 20, raster: 24 }) });
  }
  const mall = polar(c, bestW + 0.25, 1290);
  if (baubar(g, mall, 12)) { bau(s, "einkauf", mall, 0); s.zonen.push({ typ: "parkplatz", poly: rechteck(mall, 280, 200) }); }
  const buero = polar(c, bestW - 0.2, 900);
  if (baubar(g, buero, 12)) bau(s, "hochhaus", buero, 0);
  // eine Marginalsiedlung direkt neben einer Gated Community
  if (gated[0]) {
    const p = polar(gated[0], bestW + Math.PI / 2, 330);
    if (baubar(g, p, 30)) { const poly = fleck(p, 130, seed + 99); s.zonen.push({ typ: "marginal", poly }); wildeWege(g, s, poly, p, 140, z); }
  }
  freiraeumen(s);
  const e4: Epoche = {
    jahr: "um 2000", titel: "Fragmentierte Stadt",
    text: "Die Stadt zerfällt in Inseln: Gated Communities mit Mauer, Kameras und Wachpersonal (Barrios cerrados), Shopping Malls und Bürotürme an der Stadtautobahn — und gleich daneben Marginalsiedlungen, deren Bewohner dort als Hausangestellte arbeiten. Reich und Arm leben auf engem Raum, aber getrennt (Segregation). Wer kann, fährt nur noch von Insel zu Insel.",
    neu: ["Gated Communities mit Mauer", "Malls und Bürotürme an der Stadtautobahn", "Arm neben Reich: Fragmentierung, Segregation"],
    stadt: kopie(s),
  };
  return [e1, e2, e3, e4];
}
