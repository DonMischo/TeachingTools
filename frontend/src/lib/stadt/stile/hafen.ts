/**
 * Hafen- und Handelsstadt nach dem Vorbild Hamburg / Lübeck:
 *   um 1250  Hansestadt: Kaufmannshäuser am Ufer, Markt, Kirche, Mauer, Kai
 *   um 1890  Freihafen: Speicherstadt mit Fleeten, Werft, Bahn zum Hafen
 *   um 1975  Container: Terminal auf neuem Land weit draußen, Autobahn
 *   heute    Neues Hafenquartier auf den alten Kais, Speicherstadt Welterbe
 */
import { istWasser, type Gelaende } from "@/lib/gelaende/gelaende";
import { zufallsquelle } from "@/lib/gelaende/rauschen";
import { abstand, rechteck, schwerpunkt, type P } from "../geometrie";
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

/**
 * Uferlinie um den Wasserpunkt c: Strahlen von c bis zum ersten Land, nach Winkel geordnet, nur das
 * zusammenhängende Stück um den Kai. Liefert Punkte entlang (s) und landeinwärts versetzt (off).
 */
export function uferBogen(g: Gelaende, c: P, kai: P) {
  const roh: P[] = [];
  for (let k = 0; k < 360; k++) {
    const w = (k / 360) * Math.PI * 2;
    let p: P | null = null;
    for (let r = 20; r < 1400; r += 6) {
      const q = polar(c, w, r);
      if (q.x < 0 || q.y < 0 || q.x > g.breite || q.y > g.breite) break;
      if (!istWasser(g, q.x, q.y)) { p = q; break; }
    }
    roh.push(p ?? { x: NaN, y: NaN });
  }
  // beim Kai beginnen, in beide Richtungen bis zur ersten Lücke oder einem Sprung
  let i0 = 0, bd = Infinity;
  roh.forEach((p, i) => { const d = abstand(p, kai); if (d < bd) { bd = d; i0 = i; } });
  const sammle = (dir: number) => {
    const aus: P[] = [];
    for (let k = 1; k < 180; k++) {
      const p = roh[(i0 + dir * k + 360) % 360], v = aus.length ? aus[aus.length - 1] : roh[i0];
      if (Number.isNaN(p.x) || abstand(p, v) > 120) break;
      aus.push(p);
    }
    return aus;
  };
  const pkte = [...sammle(-1).reverse(), roh[i0], ...sammle(1)];
  const sAt = [0];
  for (let i = 1; i < pkte.length; i++) sAt.push(sAt[i - 1] + abstand(pkte[i - 1], pkte[i]));
  const laenge = sAt[sAt.length - 1];
  const beiKai = sAt[pkte.indexOf(roh[i0])];
  const punkt = (t: number, off: number): P => {
    let i = 0;
    while (i + 1 < sAt.length - 1 && sAt[i + 1] < t) i++;
    const u = Math.max(0, Math.min(1, (t - sAt[i]) / ((sAt[i + 1] ?? sAt[i]) - sAt[i] || 1)));
    const a = pkte[i], b = pkte[Math.min(pkte.length - 1, i + 1)];
    const q = { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
    // landeinwärts senkrecht zur geglätteten Uferlinie (vom Wasser weg)
    const v = pkte[Math.max(0, i - 3)], w = pkte[Math.min(pkte.length - 1, i + 4)];
    let nx = -(w.y - v.y), ny = w.x - v.x;
    const nl = Math.hypot(nx, ny) || 1;
    nx /= nl; ny /= nl;
    if (nx * (q.x - c.x) + ny * (q.y - c.y) < 0) { nx = -nx; ny = -ny; }
    return { x: q.x + nx * off, y: q.y + ny * off };
  };
  const linie = (a: number, b: number, off: number) => {
    const aus: P[] = [];
    for (let t = a; t <= b; t += 25) aus.push(punkt(t, off));
    return aus;
  };
  const band = (a: number, b: number, off0: number, off1: number) => [...linie(a, b, off0), ...linie(a, b, off1).reverse()];
  const richtung = (t: number) => { const p = punkt(t - 5, 0), q = punkt(t + 5, 0); return Math.atan2(q.y - p.y, q.x - p.x); };
  return { laenge, beiKai, punkt, linie, band, richtung };
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
    // in der Bucht liegen die Schiffe geschützt: die Bucht schlägt die offene Küste
    const bucht = g.bucht ? -abstand(p, g.bucht) / 80 : 0;
    return bucht + (meerNah(p) ? 2 : 0) + eignung(g, p, "hafen") * 0.5 - abstand(p, mitte) / 1200 + z() * 0.3;
  }) ?? mitte;
}

export function hafen(g: Gelaende, seed: number): Epoche[] {
  const z = zufallsquelle(seed);
  const s = leereStadt("hafen");
  const kai = hafenStandort(g, z);
  const ww = zumWasser(g, kai);
  const land = ww + Math.PI;
  // Uferlinie um die Bucht (bzw. am Ufer entlang): die Stadt wächst als Band am Wasser
  const ufer = uferBogen(g, g.bucht && abstand(g.bucht, kai) < 900 ? g.bucht : polar(kai, ww, 220), kai);
  const L = ufer.laenge;
  const s0 = ufer.beiKai;
  const lang = (a: number, b: number) => [Math.max(0, s0 + a), Math.min(L, s0 + b)] as const;
  const [a1, b1] = lang(-360, 360);
  // Altstadt: Band 20–230 m landeinwärts, Kaistraße am Wasser, Gänge quer dazu
  const mauer = ufer.band(a1, b1, 12, 230);
  s.mauern.push(mauer);
  s.zonen.push({ typ: "kontor", poly: mauer });
  s.strassen.push({ art: "haupt", name: "Kaistraße", punkte: ufer.linie(a1, b1, 22) });
  for (const off of [110, 190]) s.strassen.push({ art: "neben", punkte: ufer.linie(a1 + 10, b1 - 10, off) });
  for (let t = a1 + 30; t < b1 - 10; t += 55) s.strassen.push({ art: "gasse", punkte: [ufer.punkt(t, 22), ufer.punkt(t, 225)] });
  const markt = ufer.punkt(s0 + 40, 140);
  // Handelsstraße nur ins Hinterland (nicht übers Meer)
  s.strassen.push({ art: "fernstrasse", name: "Handelsstraße", punkte: weg(g, ufer.punkt(s0, 225), randPunkt(markt, land, g.breite), { steigung: 0.6, wasser: 40 }) });
  bau(s, "markt", markt, ufer.richtung(s0 + 40));
  bau(s, "kirche", ufer.punkt(s0 - 90, 160), ufer.richtung(s0 - 90));
  bau(s, "rathaus", ufer.punkt(s0 + 120, 150), ufer.richtung(s0 + 120));
  bau(s, "kai", ufer.punkt(s0, -4), ufer.richtung(s0));
  bau(s, "zollhaus", ufer.punkt(s0 - 10, 50), ufer.richtung(s0));
  s.namen = [{ text: "Hafen", x: kai.x, y: kai.y - 40 }];
  freiraeumen(s);
  const e1: Epoche = {
    jahr: "um 1250", titel: "Hansestadt am Wasser",
    text: "Kaufleute siedeln, wo Schiffe sicher anlegen: in einer geschützten Bucht oder an einer Flussmündung. Die Stadt zieht sich am Ufer entlang — jeder Kaufmann will ans Wasser. Am Kai wird umgeladen, der Zoll füllt die Stadtkasse. Schmale Gänge führen vom Kai den Hang hinauf. Die Kaufmannshäuser stehen mit dem Giebel zur Straße, unten Lager, oben Wohnung, ganz oben ein Speicherboden mit Kran. Die Stadt gehört zur Hanse, einem Bund von Handelsstädten von Brügge bis Nowgorod.",
    neu: ["Kai in geschützter Lage", "Stadt als Band am Ufer", "Kaufmannshäuser mit Speicherböden", "Markt, Kirche, Rathaus", "Zollhaus", "Stadtmauer"],
    stadt: kopie(s),
  };

  // Freihafen: Speicherstadt am Ufer auf der einen Seite, Kais und Lager auf der anderen — rund um die Bucht
  const [a2, b2] = lang(380, 760);
  if (b2 - a2 > 150) {
    s.zonen.push({ typ: "speicher", poly: ufer.band(a2, b2, 8, 150) });
    s.strassen.push({ art: "kanal", name: "Fleet", punkte: ufer.linie(a2, b2, 75) });
    s.strassen.push({ art: "neben", punkte: ufer.linie(a2, b2, 20) }, { art: "neben", punkte: ufer.linie(a2, b2, 135) });
    for (let t = a2 + 40; t < b2; t += 90) s.strassen.push({ art: "neben", punkte: [ufer.punkt(t, 20), ufer.punkt(t, 140)] });
  }
  const [a3, b3] = lang(-820, -380);
  const hg = ufer.punkt((a3 + b3) / 2, 100);
  if (b3 - a3 > 150) {
    s.zonen.push({ typ: "hafengebiet", poly: ufer.band(a3, b3, 6, 200) });
    s.strassen.push({ art: "neben", punkte: ufer.linie(a3, b3, 30) }, { art: "neben", punkte: ufer.linie(a3, b3, 150) });
    for (let t = a3 + 60; t < b3; t += 140) s.strassen.push({ art: "neben", punkte: [ufer.punkt(t, 30), ufer.punkt(t, 190)] });
    bau(s, "kai", ufer.punkt((a3 + b3) / 2, -4), ufer.richtung((a3 + b3) / 2));
  }
  // Werft und Leuchtturm: am offenen Wasser
  const werft = besterPunkt(g, 200, p => {
    const d = g.abstandWasser[Math.floor(p.y / g.zelle) * g.n + Math.floor(p.x / g.zelle)];
    if (!baubar(g, p, 8) || d > 40 || abstand(p, kai) < 900 || abstand(p, kai) > 1600) return -1e9;
    return -abstand(p, kai) / 400;
  });
  if (werft) { bau(s, "werft", werft, zumWasser(g, werft) + Math.PI / 2); s.zonen.push({ typ: "industrie", poly: rechteck(werft, 220, 160, zumWasser(g, werft)) }); }
  if (g.bucht) {
    const spitze = baubarNahe(g, polar(g.bucht, ww, 520), z, 300, 30);
    if (spitze) bau(s, "leuchtturm", spitze);
  }
  industrialisierung(g, s, mauer, markt, z, true);
  // An der Küste passt die Bahn quer zum Fluss oft nicht: Bahnhof dann landeinwärts hinter die Altstadt
  const bh = s.bauten.find(b => b.typ === "bahnhof");
  if (!bh || abstand(bh, markt) > 800) {
    s.strassen = s.strassen.filter(x => x.art !== "bahn" && x.name !== "Bahnhofstraße");
    s.bauten = s.bauten.filter(b => b.typ !== "bahnhof");
    const bp = baubarNahe(g, ufer.punkt(s0, 330), z, 250, 8);
    if (bp) {
      bau(s, "bahnhof", bp, ufer.richtung(s0));
      s.strassen.push({ art: "bahn", name: "Eisenbahn", punkte: glaetten(weg(g, bp, randPunkt(bp, land, g.breite), { steigung: 4, wasser: 40 }), 2) });
      s.strassen.push({ art: "haupt", name: "Bahnhofstraße", punkte: weg(g, bp, markt, { steigung: 0.6, wasser: 40, raster: 16 }) });
    }
  }
  // Hafenbahn bis an die Kais
  const bhf = s.bauten.find(b => b.typ === "bahnhof");
  if (bhf) s.strassen.push({ art: "bahn", name: "Hafenbahn", punkte: glaetten(weg(g, bhf, polar(hg, land, 60), { steigung: 4, wasser: 40, raster: 20 }), 2) });
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
  s.zonen = s.zonen.map(x => (x.typ === "industrie" && x.poly.length > 0 && abstand(schwerpunkt(x.poly), hg) < 400 ? { ...x, typ: "hafencity" as const } : x));
  freiraeumen(s);
  const e4: Epoche = {
    jahr: "heute", titel: "Neues Hafenquartier",
    text: "Auf den alten Kais entsteht ein neues Stadtviertel mit Wohnungen, Büros und Konzerthaus direkt am Wasser (wie die HafenCity in Hamburg). Die Speicherstadt ist Welterbe. Für die vielen neuen Bewohner braucht es Anschluss: Eine U-Bahn wird unter dem Wasser hindurch gebaut — teuer, aber ohne sie würde das Quartier im Stau ersticken.",
    neu: ["Neues Quartier auf den alten Kais", "Speicherstadt als Welterbe", "Wohnen am Wasser"],
    stadt: kopie(s),
  };
  return [e1, e2, e3, e4];
}
