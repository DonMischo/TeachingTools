/**
 * Tech-Region nach dem Vorbild Silicon Valley (San José, Palo Alto):
 *   um 1900  Valley of Heart's Delight: Kleinstadt an der Bahn, Obstplantagen
 *   um 1955  Universität und Forschungspark, erste Elektronikfirmen, Suburbs
 *   um 1985  Silicon Valley: Highways, Campus an der Ausfahrt, Plantagen weg
 *   heute    Wohnungsnot, Pendelverkehr, Stau — Stadtbahn kommt spät
 */
import { type Gelaende } from "@/lib/gelaende/gelaende";
import { zufallsquelle } from "@/lib/gelaende/rauschen";
import { abstand, inPoly, rechteck, type P } from "../geometrie";
import { kopie, leereStadt, type Epoche } from "../modell";
import { bau, baubar, besterPunkt, freiraeumen, raster, rechteckPoly, zerschneiden, type Z } from "../hilfen";
import { eignung } from "../standort";
import { glaetten, randPunkt, weg } from "../wege";

const polar = (c: P, w: number, r: number): P => ({ x: c.x + Math.cos(w) * r, y: c.y + Math.sin(w) * r });

export function tech(g: Gelaende, seed: number): Epoche[] {
  const z: Z = zufallsquelle(seed);
  const s = leereStadt("tech");
  const mitte = { x: g.breite / 2, y: g.breite / 2 };
  const c = besterPunkt(g, 700, p => {
    if (!baubar(g, p, 5)) return -1e9;
    let n = 0;
    for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) n += baubar(g, { x: p.x + i * 180, y: p.y + j * 180 }, 8) ? 1 : 0;
    return n * 0.6 + eignung(g, p, "tech") - abstand(p, mitte) / 600 + z() * 0.4;
  }) ?? mitte;
  const flach = (p: P, b: number, h: number) => rechteck(p, b, h).every(q => baubar(g, q, 8));
  const belegt = (p: P, b: number, h: number) => rechteck(p, b, h).some(q => s.zonen.some(x => x.typ !== "obstplantage" && inPoly(q, x.poly)));

  // Kleinstadt an der Bahn
  const bahnRoh = [randPunkt(c, Math.PI + (z() - 0.5) * 0.3, g.breite), randPunkt(c, (z() - 0.5) * 0.3, g.breite)];
  const bahn = zerschneiden(bahnRoh, g, true).sort((a, b) => b.length - a.length)[0] ?? bahnRoh;
  s.strassen.push({ art: "bahn", name: "Southern Pacific", punkte: [bahn[0], bahn[bahn.length - 1]] });
  const B = 100;
  s.strassen.push(...raster(g, c.x - 3 * B, c.y - 3 * B, c.x + 3 * B, c.y + 2 * B, B, B, c.x, c.y));
  s.zonen.push({ typ: "kleinstadt", poly: rechteckPoly(c.x - 3 * B, c.y - 3 * B, c.x + 3 * B, c.y + 2 * B) });
  bau(s, "depot", { x: c.x + 40, y: c.y - 14 });
  bau(s, "kirche", { x: c.x - B * 1.5, y: c.y - B * 1.5 });
  // Plantagen rundum
  for (let k = 0; k < 10; k++) {
    const p = polar(c, (k / 10) * Math.PI * 2, 900 + z() * 400);
    if (flach(p, 500, 400)) s.zonen.push({ typ: "obstplantage", poly: rechteck(p, 500, 400) });
  }
  freiraeumen(s);
  const e1: Epoche = {
    jahr: "um 1900", titel: "Tal der Obstgärten",
    text: "Ein breites, fruchtbares Tal an einer Meeresbucht. Rund um eine kleine Bahnstadt wachsen Pflaumen, Aprikosen und Kirschen — die Gegend heißt »Valley of Heart's Delight«. Mit der Bahn gehen die Früchte in Konserven in alle Welt.",
    neu: ["Kleinstadt an der Bahn", "Obstplantagen im ganzen Tal"],
    stadt: kopie(s),
  };

  // Universität und Forschungspark
  const uni = [Math.PI * 0.75, -Math.PI * 0.75, Math.PI / 2, -Math.PI / 2].map(a => polar(c, a, 1500)).find(p => flach(p, 420, 320) && !belegt(p, 420, 320)) ?? polar(c, Math.PI * 0.75, 1200);
  bau(s, "universitaet", uni);
  s.zonen = s.zonen.filter(x => !rechteck(uni, 900, 700).some(q => inPoly(q, x.poly)) || x.typ !== "obstplantage");
  s.zonen.push({ typ: "uni", poly: rechteck(uni, 420, 320) });
  const fp = polar(uni, Math.atan2(c.y - uni.y, c.x - uni.x), 450);
  bau(s, "forschungspark", fp);
  s.zonen.push({ typ: "campus", poly: rechteck(fp, 380, 280) });
  s.strassen.push({ art: "haupt", name: "El Camino Real", punkte: glaetten(weg(g, uni, c, { steigung: 0.6, wasser: 20, raster: 24 }), 2) });
  // Suburbs: Einfamilienhäuser auf früheren Plantagen
  const suburbs: P[] = [];
  for (const x of s.zonen.filter(x => x.typ === "obstplantage")) {
    if (suburbs.length >= 3) break;
    const m = { x: (x.poly[0].x + x.poly[2].x) / 2, y: (x.poly[0].y + x.poly[2].y) / 2 };
    if (abstand(m, c) > 1300) continue;
    x.typ = "einfamilienhaus";
    suburbs.push(m);
    s.strassen.push(...raster(g, m.x - 240, m.y - 190, m.x + 240, m.y + 190, 120, 50, m.x, m.y));
    s.strassen.push({ art: "haupt", punkte: weg(g, m, c, { steigung: 0.6, wasser: 20, raster: 24 }) });
  }
  freiraeumen(s);
  const e2: Epoche = {
    jahr: "um 1955", titel: "Universität und Forschungspark",
    text: "Die Universität verpachtet ihr Land an junge Firmen — der erste Forschungspark entsteht (Stanford 1951). Absolventen gründen Elektronikfirmen gleich nebenan, das Militär kauft Radar und Funk. Familien ziehen in neue Einfamilienhaus-Siedlungen auf früheren Obstplantagen. Gefahren wird mit dem Auto.",
    neu: ["Universität als Keimzelle", "Forschungspark", "Suburbs auf Plantagen"],
    stadt: kopie(s),
  };

  // Highways und Campus an den Ausfahrten
  const w = Math.atan2(bahn[bahn.length - 1].y - bahn[0].y, bahn[bahn.length - 1].x - bahn[0].x);
  const hw: P[][] = [];
  for (const seite of [1, -1]) {
    const off = polar(c, w + Math.PI / 2 * seite, 700);
    const l = [...weg(g, randPunkt(off, w + Math.PI, g.breite), off, { steigung: 1, wasser: 3, raster: 32 }), ...weg(g, off, randPunkt(off, w, g.breite), { steigung: 1, wasser: 3, raster: 32 }).slice(1)];
    if (l.length > 1) { const gl = glaetten(l, 2); hw.push(gl); s.strassen.push({ art: "autobahn", name: seite > 0 ? "Highway 101" : "Highway 280", punkte: gl }); }
  }
  let campusZahl = 0;
  for (const l of hw) for (let i = 4; i < l.length && campusZahl < 4; i += 6) {
    const p = l[i];
    const m = polar(p, Math.atan2(c.y - p.y, c.x - p.x), 260);
    if (!flach(m, 380, 280) || belegt(m, 380, 280) || abstand(m, c) < 500 || abstand(m, c) > 2400) continue;
    s.zonen = s.zonen.filter(x => !(x.typ === "obstplantage" && inPoly(m, x.poly)));
    s.zonen.push({ typ: "campus", poly: rechteck(m, 380, 280) }, { typ: "parkplatz", poly: rechteck(polar(m, 0, 240), 120, 200) });
    bau(s, campusZahl === 0 ? "techzentrale" : "rechenzentrum", m);
    s.strassen.push({ art: "haupt", punkte: [m, p] });
    campusZahl++;
  }
  s.zonen = s.zonen.map(x => (x.typ === "obstplantage" ? { ...x, typ: "pendler" as const } : x));
  for (const x of s.zonen.filter(x => x.typ === "pendler")) {
    const m = { x: (x.poly[0].x + x.poly[2].x) / 2, y: (x.poly[0].y + x.poly[2].y) / 2 };
    s.strassen.push(...raster(g, m.x - 240, m.y - 190, m.x + 240, m.y + 190, 120, 50, m.x, m.y));
  }
  const mall = polar(c, w + Math.PI / 2, 560);
  if (baubar(g, mall, 8)) { bau(s, "einkauf", mall, w); s.zonen.push({ typ: "parkplatz", poly: rechteck(polar(mall, w + Math.PI / 2, 90), 200, 80, w) }); }
  freiraeumen(s);
  const e3: Epoche = {
    jahr: "um 1985", titel: "Silicon Valley",
    text: "Mikrochips aus Silizium geben dem Tal den Namen. Firmen bauen flache Bürogelände mit riesigen Parkplätzen direkt an die Highway-Ausfahrten. Die letzten Plantagen verschwinden unter Vororten. Alles ist auf das Auto ausgelegt: Arbeit, Wohnen und Einkaufen liegen getrennt und weit auseinander.",
    neu: ["Highways", "Firmen-Campus an den Ausfahrten", "Mall mit Parkplatz", "Plantagen werden Vororte"],
    stadt: kopie(s),
  };

  // heute: dichter, aber zu wenig Wohnungen; Stau
  const verdichtet = polar(c, w, 380);
  if (baubar(g, verdichtet, 8)) {
    s.zonen.push({ typ: "konversion", poly: rechteck(verdichtet, 240, 200, w) });
    s.strassen.push(...raster(g, verdichtet.x - 110, verdichtet.y - 90, verdichtet.x + 110, verdichtet.y + 90, 70, 60, verdichtet.x, verdichtet.y));
  }
  s.zonen.push({ typ: "cbd", poly: rechteck(c, 200, 160) });
  freiraeumen(s);
  const e4: Epoche = {
    jahr: "heute", titel: "Pendeln und Stau",
    text: "Hunderttausende Jobs, aber zu wenig Wohnungen: Mieten und Hauspreise gehören zu den höchsten der Welt. Viele pendeln täglich zwei Stunden, die Highways stehen im Stau. Firmen schicken eigene Busse. Eine Stadtbahn und die alte Bahnlinie sollen helfen — doch in Vororten mit Einfamilienhäusern wohnen zu wenige Menschen an jeder Haltestelle, damit Busse und Bahnen sich lohnen.",
    neu: ["Verdichtung im Zentrum", "Wohnungsnot", "Pendelverkehr und Stau"],
    stadt: kopie(s),
  };
  return [e1, e2, e3, e4];
}
