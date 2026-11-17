/**
 * Industriestadt nach dem Vorbild des Ruhrgebiets (Essen, Duisburg,
 * Gelsenkirchen): Nicht eine Stadt wächst, sondern Zechen und Hütten ziehen
 * Arbeiter an, und die Siedlungen wachsen zusammen.
 *   um 1840  Dorf am Fluss, erste Zeche über dem Kohleflöz
 *   um 1890  Hochindustrialisierung: Hochofen am Fluss, Kanal, Bahn,
 *            Zechenkolonien, Mietskasernen um den alten Ortskern
 *   um 1965  Autobahn, Großsiedlungen, erste Zechen schließen
 *   heute    Strukturwandel: Landschaftspark, Welterbe, Hochschule, Dienstleistung
 */
import { istWasser, type Gelaende } from "@/lib/gelaende/gelaende";
import { zufallsquelle } from "@/lib/gelaende/rauschen";
import { abstand, inPoly, rechteck, type P } from "../geometrie";
import { kopie, leereStadt, type Epoche } from "../modell";
import { bau, baubar, baubarNahe, besterPunkt, fernstrasse, flussRichtung, freiraeumen, gedrehtesRaster, type Z } from "../hilfen";
import { eignung, flussAbstand } from "../standort";
import { glaetten, randPunkt, weg } from "../wege";

const polar = (c: P, w: number, r: number): P => ({ x: c.x + Math.cos(w) * r, y: c.y + Math.sin(w) * r });

/** Fläche rund um p ist baubar */
const frei = (g: Gelaende, p: P, b: number, h: number, dreh: number, n = 14) => baubar(g, p, n) && rechteck(p, b, h, dreh).every(q => baubar(g, q, n + 4));

export function industrie(g: Gelaende, seed: number): Epoche[] {
  const z: Z = zufallsquelle(seed);
  const s = leereStadt("industrie");
  const mitte = { x: g.breite / 2, y: g.breite / 2 };
  // altes Dorf: am Fluss, trocken
  const dorf = besterPunkt(g, 500, p => (baubar(g, p, 8) ? eignung(g, p, "industrie") - abstand(p, mitte) / 600 + z() * 0.3 : -1e9)) ?? mitte;
  const wf = flussRichtung(g, dorf) ?? z() * Math.PI;
  s.strassen.push({ art: "fernstrasse", name: "Hellweg", punkte: fernstrasse(g, dorf, wf + (z() - 0.5) * 0.4, 0.5, 30) });
  s.zonen.push({ typ: "dorf", poly: rechteck(dorf, 260, 200, wf) });
  s.strassen.push(...gedrehtesRaster(g, dorf, 240, 180, 80, 60, wf, "gasse"));
  bau(s, "kirche", polar(dorf, wf + Math.PI / 2, 40), wf);
  // erste Zeche über dem Kohlefeld
  const kohle = g.kohle ?? polar(dorf, wf + Math.PI / 2, 900);
  const zechen: P[] = [];
  const ersteZeche = baubarNahe(g, kohle, z, 400, 8);
  if (ersteZeche) {
    zechen.push(ersteZeche);
    bau(s, "zechenturm", ersteZeche, wf);
    s.zonen.push({ typ: "zeche", poly: rechteck(ersteZeche, 260, 180, wf) });
    s.strassen.push({ art: "haupt", punkte: weg(g, ersteZeche, dorf, { steigung: 0.5, wasser: 30, raster: 24 }) });
  }
  s.namen = [{ text: "Hellweg", x: dorf.x + 40, y: dorf.y - 120 }];
  freiraeumen(s);
  const e1: Epoche = {
    jahr: "um 1840", titel: "Dorf und erste Zeche",
    text: "Ein Bauerndorf an einer alten Handelsstraße. Unter den Feldern liegt Steinkohle. Neue Dampfmaschinen pumpen das Grubenwasser ab — jetzt kann man tief graben. Die erste Zeche mit ihrem Förderturm entsteht genau über dem Flöz, nicht im Dorf.",
    neu: ["Bauerndorf am Fluss", "Zeche über dem Kohlefeld"],
    stadt: kopie(s),
  };

  // Hochindustrialisierung
  // Hütte direkt am Fluss (Kühlwasser, Schiffe)
  const huette = besterPunkt(g, 300, p => {
    const d = flussAbstand(g, p);
    if (!frei(g, p, 300, 160, wf, 6) || abstand(p, dorf) < 400) return -1e9;
    return -(Number.isFinite(d) ? Math.abs(d - 140) / 40 : 0) - abstand(p, dorf) / 500;
  });
  if (huette) {
    bau(s, "hochofen", huette, wf);
    s.zonen.push({ typ: "industrie", poly: rechteck(huette, 480, 300, wf) });
  }
  // weitere Zechen auf dem Kohlefeld
  for (let k = 0; k < 10 && zechen.length < 3; k++) {
    const p = polar(kohle, z() * Math.PI * 2, 450 + z() * 400);
    if (!frei(g, p, 260, 180, wf, 8) || zechen.some(q => abstand(p, q) < 500) || abstand(p, dorf) < 450) continue;
    zechen.push(p);
    bau(s, "zechenturm", p, wf);
    s.zonen.push({ typ: "zeche", poly: rechteck(p, 260, 180, wf) });
  }
  // Kanal vom Fluss zur ersten Zeche, mit Hafen
  if (zechen[0] && g.flussLinie.length > 1) {
    let start = g.flussLinie[0], bd = Infinity;
    for (const p of g.flussLinie) { const d = abstand(p, zechen[0]); if (d < bd) { bd = d; start = p; } }
    const ende = polar(zechen[0], Math.atan2(start.y - zechen[0].y, start.x - zechen[0].x), 150);
    const kanal = glaetten(weg(g, start, ende, { steigung: 6, wasser: 0, raster: 24 }), 2);
    if (kanal.length > 1) {
      s.strassen.push({ art: "kanal", name: "Kanal", punkte: kanal });
      bau(s, "kanalhafen", ende, Math.atan2(start.y - ende.y, start.x - ende.x));
    }
  }
  // Bahn verbindet Hütte und Zechen, quer durch
  const bahnZiele = [huette, ...zechen].filter((p): p is P => !!p);
  if (bahnZiele.length) {
    const a = randPunkt(bahnZiele[0], wf + Math.PI, g.breite);
    const pfad: P[] = [a];
    for (const p of [...bahnZiele].sort((u, v) => abstand(u, a) - abstand(v, a))) pfad.push(...weg(g, pfad[pfad.length - 1], polar(p, wf + Math.PI / 2, 120), { steigung: 4, wasser: 8 }).slice(1));
    pfad.push(...weg(g, pfad[pfad.length - 1], randPunkt(pfad[pfad.length - 1], wf, g.breite), { steigung: 4, wasser: 8 }).slice(1));
    s.strassen.push({ art: "bahn", name: "Zechenbahn", punkte: glaetten(pfad, 2) });
    bau(s, "bahnhof", baubarNahe(g, polar(dorf, wf - Math.PI / 2, 260), z, 200, 8), wf);
  }
  // Zechenkolonien: kleine Doppelhäuser mit Garten neben jeder Zeche und Hütte
  for (const p of bahnZiele) {
    for (const w of [0, Math.PI, Math.PI / 2, -Math.PI / 2]) {
      const k = polar(p, wf + w, 360);
      if (!frei(g, k, 240, 180, wf, 10) || rechteck(k, 260, 200, wf).some(q => s.zonen.some(x => inPoly(q, x.poly)))) continue;
      s.zonen.push({ typ: "kolonie", poly: rechteck(k, 260, 200, wf) });
      s.strassen.push(...gedrehtesRaster(g, k, 240, 180, 60, 60, wf + 0.05, "neben"));
      s.strassen.push({ art: "neben", punkte: weg(g, k, p, { steigung: 0.6, wasser: 30, raster: 24 }) });
      break;
    }
  }
  // Mietskasernen um den alten Ortskern
  s.zonen.push({ typ: "gruenderzeit", poly: rechteck(dorf, 700, 560, wf) });
  s.strassen.push(...gedrehtesRaster(g, dorf, 700, 560, 110, 90, wf, "neben", p => abstand(p, dorf) > 140));
  bau(s, "rathaus", polar(dorf, wf, 120), wf);
  freiraeumen(s);
  const e2: Epoche = {
    jahr: "um 1890", titel: "Hochindustrialisierung",
    text: "Kohle + Erz = Stahl: Am Fluss entsteht ein Hüttenwerk mit Hochöfen, es braucht Kühlwasser und Schiffe. Ein Kanal bringt Kohle per Schiff, eine Zechenbahn verbindet alles. Hunderttausende ziehen aus Ostpreußen und Polen zu. Die Zechen bauen eigene Siedlungen — die Zechenkolonien mit Garten und Stall. Ums alte Dorf wachsen dichte Mietskasernen. Zentren gibt es viele, eine echte Mitte keine.",
    neu: ["Hüttenwerk am Fluss", "Weitere Zechen", "Kanal mit Hafen", "Zechenbahn und Bahnhof", "Zechenkolonien", "Mietskasernen um den Ortskern"],
    stadt: kopie(s),
  };

  // Wirtschaftswunder: Autobahn quer durch, Großsiedlung, erste Zechen schließen
  const aw = wf + (z() - 0.5) * 0.3;
  const off = polar(dorf, aw + Math.PI / 2, 520);
  const ab = [...weg(g, randPunkt(off, aw + Math.PI, g.breite), off, { steigung: 1, wasser: 4, raster: 32 }), ...weg(g, off, randPunkt(off, aw, g.breite), { steigung: 1, wasser: 4, raster: 32 }).slice(1)];
  if (ab.length > 1) s.strassen.push({ art: "autobahn", name: "Ruhrschnellweg", punkte: glaetten(ab, 2) });
  const gs = [0.6, -0.6, 2.4, -2.4].map(a => polar(dorf, wf + a, 1100)).find(p => frei(g, p, 380, 280, wf, 10) && !rechteck(p, 380, 280, wf).some(q => s.zonen.some(x => x.typ !== "gruenderzeit" && inPoly(q, x.poly))));
  if (gs) {
    s.zonen.push({ typ: "grosssiedlung", poly: rechteck(gs, 380, 280, wf) });
    s.strassen.push(...gedrehtesRaster(g, gs, 300, 200, 100, 100, wf, "neben"));
    s.strassen.push({ art: "haupt", punkte: weg(g, gs, dorf, { steigung: 0.6, wasser: 20, raster: 24 }) });
    bau(s, "schule", gs, wf);
  }
  const zu = zechen.slice(1);
  for (const p of zu) s.zonen = s.zonen.map(x => (x.typ === "zeche" && abstand(x.poly[0], p) < 260 ? { ...x, typ: "industrie" as const } : x));
  freiraeumen(s);
  const e3: Epoche = {
    jahr: "um 1965", titel: "Autobahn und Zechensterben",
    text: "Öl und Importkohle sind billiger — die »Kohlekrise« beginnt, Zeche um Zeche schließt. Gleichzeitig kommt das Auto: Eine Stadtautobahn schneidet quer durch die Siedlungen. Neue Großsiedlungen am Rand bieten moderne Wohnungen mit Bad und Zentralheizung statt Kohleofen.",
    neu: ["Stadtautobahn", "Großsiedlung", "Erste Zechen schließen"],
    stadt: kopie(s),
  };

  // Strukturwandel
  s.zonen = s.zonen.map(x => (x.typ === "zeche" ? { ...x, typ: "landschaftspark" as const } : x));
  s.zonen = s.zonen.map(x => (x.typ === "industrie" && huette && abstand(x.poly[0], huette) < 400 ? { ...x, typ: "landschaftspark" as const } : x));
  const uni = [Math.PI / 2, -Math.PI / 2, Math.PI].map(a => polar(dorf, wf + a, 800)).find(p => frei(g, p, 260, 200, wf, 10) && !istWasser(g, p.x, p.y));
  if (uni) {
    bau(s, "universitaet", uni, wf);
    s.zonen.push({ typ: "uni", poly: rechteck(uni, 300, 220, wf) });
    s.strassen.push({ art: "haupt", punkte: weg(g, uni, dorf, { steigung: 0.6, wasser: 20, raster: 24 }) });
  }
  if (zechen[1]) {
    s.zonen.push({ typ: "gewerbe", poly: rechteck(polar(zechen[1], wf, 260), 280, 200, wf) });
    bau(s, "einkauf", polar(zechen[1], wf, 260), wf);
  }
  freiraeumen(s);
  const e4: Epoche = {
    jahr: "heute", titel: "Strukturwandel",
    text: "Die letzte Steinkohlenzeche schloss 2018. Aus Zechen und Hütten wurden Landschaftsparks, Museen und Konzertorte (Zeche Zollverein ist Welterbe, der Landschaftspark Duisburg-Nord ein Kletter- und Lichtpark). Hochschulen und Dienstleister ersetzen die Schwerindustrie. Weil es viele kleine Zentren gibt, sind die Wege lang — ein dichtes Netz aus S-Bahn, Straßenbahn und Bus verbindet sie.",
    neu: ["Zechen werden Landschaftspark und Welterbe", "Hochschule", "Gewerbe auf alten Flächen"],
    stadt: kopie(s),
  };
  return [e1, e2, e3, e4];
}
