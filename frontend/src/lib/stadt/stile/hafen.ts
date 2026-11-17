/**
 * Hafen- und Handelsstadt nach dem Vorbild Hamburg / Lübeck:
 *   um 1250  Hansestadt: Kaufmannshäuser am Ufer, Markt, Kirche, Mauer, Kai
 *   um 1890  Freihafen: Speicherstadt mit Fleeten, Werft, Bahn zum Hafen
 *   um 1975  Container: Terminal auf neuem Land weit draußen, Autobahn
 *   heute    Neues Hafenquartier auf den alten Kais, Speicherstadt Welterbe
 */
import { istWasser, type Gelaende } from "@/lib/gelaende/gelaende";
import { zufallsquelle } from "@/lib/gelaende/rauschen";
import { abstand, inPoly, rechteck, type P } from "../geometrie";
import { kopie, leereStadt, type Epoche } from "../modell";
import { bau, baubar, baubarNahe, besterPunkt, freiraeumen, gedrehtesRaster, type Z } from "../hilfen";
import { industrialisierung, moderne } from "../moderne";
import { eignung } from "../standort";
import { glaetten, randPunkt, weg } from "../wege";

const polar = (c: P, w: number, r: number): P => ({ x: c.x + Math.cos(w) * r, y: c.y + Math.sin(w) * r });

/** Richtung vom Land zum Wasser bei p (Bogenmaß), aus 24 Strahlen */
function zumWasser(g: Gelaende, p: P): number {
  let best = 0, bd = Infinity;
  for (let k = 0; k < 24; k++) {
    const w = (k / 24) * Math.PI * 2;
    for (let r = 10; r < 400; r += 10) {
      const q = polar(p, w, r);
      if (istWasser(g, q.x, q.y)) { if (r < bd) { bd = r; best = w; } break; }
    }
  }
  return best;
}

/** Ufer: baubar, 20–60 m vom Wasser, bevorzugt an der Bucht bzw. am Meer */
export function hafenStandort(g: Gelaende, z: Z): P {
  const mitte = { x: g.breite / 2, y: g.breite / 2 };
  const meerNah = (p: P) => {
    for (let k = 0; k < 12; k++) for (const r of [60, 140, 240]) {
      const q = polar(p, (k / 12) * Math.PI * 2, r);
      if (q.x > 0 && q.y > 0 && q.x < g.breite && q.y < g.breite && g.wasser[Math.floor(q.y / g.zelle) * g.n + Math.floor(q.x / g.zelle)] === 2) return true;
    }
    return false;
  };
  return besterPunkt(g, 250, p => {
    if (!baubar(g, p, 8)) return -1e9;
    const d = g.abstandWasser[Math.floor(p.y / g.zelle) * g.n + Math.floor(p.x / g.zelle)];
    if (d < 20 || d > 70) return -1e9;
    const bucht = g.bucht ? -abstand(p, g.bucht) / 300 : 0;
    return bucht + (meerNah(p) ? 2 : 0) + eignung(g, p, "hafen") * 0.5 - abstand(p, mitte) / 1200 + z() * 0.3;
  }) ?? mitte;
}

export function hafen(g: Gelaende, seed: number): Epoche[] {
  const z = zufallsquelle(seed);
  const s = leereStadt("hafen");
  const kai = hafenStandort(g, z);
  const ww = zumWasser(g, kai);
  const land = ww + Math.PI;
  const quer = ww + Math.PI / 2;
  // Hansestadt: Kaufmannsstadt landeinwärts vom Kai, Giebel zur Straße
  const markt = polar(kai, land, 190);
  const R = 220;
  const mauer = Array.from({ length: 16 }, (_, i) => {
    const w = (i / 16) * Math.PI * 2;
    let r = R * (0.9 + z() * 0.2);
    let p = polar(markt, w, r);
    while (r > 60 && istWasser(g, p.x, p.y)) { r -= 10; p = polar(markt, w, r); }
    return p;
  });
  s.mauern.push(mauer);
  s.zonen.push({ typ: "kontor", poly: mauer });
  // Straßen vom Ufer den Hang hinauf (wie Lübecks Gänge), quer dazu die Hauptstraße
  s.strassen.push(...gedrehtesRaster(g, markt, 2 * R, 2 * R, 44, 120, land, "gasse", p => inPoly(p, mauer)));
  // Handelsstraße nur ins Hinterland (nicht übers Meer)
  s.strassen.push({ art: "fernstrasse", name: "Handelsstraße", punkte: weg(g, markt, randPunkt(markt, land, g.breite), { steigung: 0.6, wasser: 40 }) });
  bau(s, "markt", markt, quer);
  bau(s, "kirche", polar(markt, land, 80), quer);
  bau(s, "rathaus", polar(markt, quer, 70), quer);
  bau(s, "kai", polar(kai, ww, 6), quer);
  bau(s, "zollhaus", polar(kai, land, 40), quer);
  s.namen = [{ text: "Hafen", x: kai.x, y: kai.y - 40 }];
  freiraeumen(s);
  const e1: Epoche = {
    jahr: "um 1250", titel: "Hansestadt am Wasser",
    text: "Kaufleute siedeln, wo Schiffe sicher anlegen: in einer geschützten Bucht oder an einer Flussmündung. Am Kai wird umgeladen, der Zoll füllt die Stadtkasse. Die Kaufmannshäuser stehen mit dem Giebel zur Straße, unten Lager, oben Wohnung, ganz oben ein Speicherboden mit Kran. Die Stadt gehört zur Hanse, einem Bund von Handelsstädten von Brügge bis Nowgorod.",
    neu: ["Kai in geschützter Lage", "Kaufmannshäuser mit Speicherböden", "Markt, Kirche, Rathaus", "Zollhaus", "Stadtmauer"],
    stadt: kopie(s),
  };

  // Freihafen und Speicherstadt am Ufer neben der Altstadt
  const sp = polar(polar(kai, quer, R + 180), ww, -30);
  const speicherOk = baubar(g, sp, 10);
  if (speicherOk) {
    s.zonen.push({ typ: "speicher", poly: rechteck(sp, 320, 140, quer) });
    s.strassen.push({ art: "kanal", name: "Fleet", punkte: [polar(sp, quer, -170), polar(sp, quer, 170)] });
    s.strassen.push(...gedrehtesRaster(g, sp, 320, 140, 80, 140, quer, "neben"));
  }
  // Hafenbecken-Gebiet auf der anderen Seite
  const hg = polar(polar(kai, quer, -(R + 260)), ww, -40);
  if (baubar(g, hg, 10)) {
    s.zonen.push({ typ: "hafengebiet", poly: rechteck(hg, 420, 200, quer) });
    s.strassen.push(...gedrehtesRaster(g, hg, 420, 200, 140, 100, quer, "neben"));
    bau(s, "kai", polar(hg, ww, 90), quer);
  }
  // Werft und Leuchtturm: am offenen Wasser
  const werft = besterPunkt(g, 200, p => {
    const d = g.abstandWasser[Math.floor(p.y / g.zelle) * g.n + Math.floor(p.x / g.zelle)];
    if (!baubar(g, p, 8) || d > 40 || abstand(p, kai) < 600 || abstand(p, kai) > 1400) return -1e9;
    return -abstand(p, kai) / 400;
  });
  if (werft) { bau(s, "werft", werft, zumWasser(g, werft) + Math.PI / 2); s.zonen.push({ typ: "industrie", poly: rechteck(werft, 220, 160, zumWasser(g, werft)) }); }
  if (g.bucht) {
    const spitze = baubarNahe(g, polar(g.bucht, ww, 520), z, 300, 30);
    if (spitze) bau(s, "leuchtturm", spitze);
  }
  industrialisierung(g, s, mauer, markt, z, true);
  // Hafenbahn bis an die Kais
  const bhf = s.bauten.find(b => b.typ === "bahnhof");
  if (bhf) s.strassen.push({ art: "bahn", name: "Hafenbahn", punkte: glaetten(weg(g, bhf, polar(hg, land, 60), { steigung: 4, wasser: 8, raster: 20 }), 2) });
  freiraeumen(s);
  const e2: Epoche = {
    jahr: "um 1890", titel: "Freihafen und Speicherstadt",
    text: "Dampfschiffe sind größer, der Welthandel wächst. Im Freihafen dürfen Waren zollfrei gelagert werden: Direkt am Wasser entsteht die Speicherstadt — Backsteinspeicher an Fleeten (Kanälen), von Schuten be- und entladen. Gegenüber Kais mit Kränen, weiter draußen Werften. Die Hafenbahn bringt Güter ins Hinterland. Die Mauer weicht einem Ring.",
    neu: ["Speicherstadt an Fleeten", "Kais und Lagerhallen", "Werft", "Hafenbahn", "Ring statt Mauer"],
    stadt: kopie(s),
  };

  // Container: großes flaches Gelände am tiefen Wasser, weit draußen
  const ct = besterPunkt(g, 300, p => {
    const d = g.abstandWasser[Math.floor(p.y / g.zelle) * g.n + Math.floor(p.x / g.zelle)];
    if (d > 60 || abstand(p, kai) < 1000) return -1e9;
    const w = zumWasser(g, p);
    if (!rechteck(polar(p, w + Math.PI, 150), 500, 260, w + Math.PI / 2).every(q => baubar(g, q, 8))) return -1e9;
    return -abstand(p, kai) / 800;
  });
  if (ct) {
    const w = zumWasser(g, ct), m = polar(ct, w + Math.PI, 150);
    s.zonen.push({ typ: "containerhafen", poly: rechteck(m, 500, 260, w + Math.PI / 2) });
    s.strassen.push(...gedrehtesRaster(g, m, 480, 240, 60, 60, w + Math.PI / 2, "neben"));
    bau(s, "kai", polar(ct, w, 4), w + Math.PI / 2);
    const a = [...weg(g, m, randPunkt(m, w + Math.PI, g.breite), { steigung: 1, wasser: 3, raster: 32 })];
    if (a.length > 1) s.strassen.push({ art: "autobahn", name: "Hafenautobahn", punkte: glaetten(a, 2) });
  }
  if (hg && baubar(g, hg, 10)) s.zonen = s.zonen.map(x => (x.typ === "hafengebiet" ? { ...x, typ: "industrie" as const } : x));
  freiraeumen(s);
  const e3: Epoche = {
    jahr: "um 1975", titel: "Containerhafen",
    text: "Die Container-Revolution: Ein genormter Stahlkasten passt auf Schiff, Bahn und Lkw. Riesige Schiffe brauchen tiefes Wasser und viel flaches Land zum Stapeln — die neuen Terminals liegen weit draußen, mit eigener Autobahn. Die alten Kais nahe der Altstadt werden nicht mehr gebraucht; statt Tausender Hafenarbeiter genügen wenige Kranführer.",
    neu: ["Containerterminal weit draußen", "Hafenautobahn", "Alte Kais verlieren ihre Arbeit"],
    stadt: kopie(s),
  };

  moderne(g, s, mauer, markt, z);
  s.zonen = s.zonen.map(x => (x.typ === "industrie" && hg && abstand(x.poly[0], hg) < 400 ? { ...x, typ: "hafencity" as const } : x));
  freiraeumen(s);
  const e4: Epoche = {
    jahr: "heute", titel: "Neues Hafenquartier",
    text: "Auf den alten Kais entsteht ein neues Stadtviertel mit Wohnungen, Büros und Konzerthaus direkt am Wasser (wie die HafenCity in Hamburg). Die Speicherstadt ist Welterbe. Für die vielen neuen Bewohner braucht es Anschluss: Eine U-Bahn wird unter dem Wasser hindurch gebaut — teuer, aber ohne sie würde das Quartier im Stau ersticken.",
    neu: ["Neues Quartier auf den alten Kais", "Speicherstadt als Welterbe", "Wohnen am Wasser"],
    stadt: kopie(s),
  };
  return [e1, e2, e3, e4];
}
