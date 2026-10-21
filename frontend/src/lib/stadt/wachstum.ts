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
  abstand, geschlossen, inPoly, laenge, rechteck, schnitte, skaliere, zurLinie, type P,
} from "./geometrie";
import { kopie, leereStadt, type Epoche, type Stadt, type Stil, type ZonenTyp } from "./modell";
import { auslauf, band, bau, baubar, baubarNahe, besterPunkt, fernstrasse, flussRichtung, freiraeumen, nebenStrasse, raster, rechteckPoly, zerschneiden, type Z } from "./hilfen";
import { stromlinien, type Feld } from "./tensor";
import { industrialisierung, industrieUndModerne, moderne } from "./moderne";
import { randPunkt, weg } from "./wege";
import { residenz } from "./stile/residenz";
import { festung } from "./stile/festung";
import { sozialistisch } from "./stile/sozialistisch";
import { lateinamerika } from "./stile/lateinamerika";
import { orientalisch } from "./stile/orientalisch";

// für Planen und Tests
export { band, zerschneiden, freiraeumen } from "./hilfen";

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

  // um 2020: Umbau der Stadt — Brachen, Gentrifizierung, Reurbanisierung
  s.zonen = s.zonen.map(x => (x.typ === "industrie" ? { ...x, typ: "konversion" as const } : x));
  s.bauten = s.bauten.filter((b, i) => b.typ !== "fabrik" || i % 3 === 0);
  if (g.flussLinie.length) {
    const ufer = auslauf(g.flussLinie, zurLinie(M, g.flussLinie).q, { x: M.x + 9999, y: M.y }, 500);
    if (ufer.length > 1) s.zonen.push({ typ: "park", poly: band(ufer, 90) });
  }
  s.namen = [{ text: "Fußgängerzone", x: M.x + 20, y: M.y + 50 }, { text: "Gentrifizierung", x: M.x + R + 120, y: M.y - R - 60 }];
  const e6: Epoche = {
    jahr: "um 2020", titel: "Umbau der Stadt",
    text: "Viele Fabriken haben geschlossen. Auf den Industriebrachen entstehen neue Quartiere mit Wohnungen, Büros und Parks (Konversion); alte Fabrikhallen werden zu Lofts und Kulturorten. Die Gründerzeitviertel sind wieder beliebt: Sanierte Altbauten ziehen Studierende, Kreative und Besserverdienende an — die Mieten steigen, Alteingesessene müssen wegziehen (Gentrifizierung). Junge Menschen ziehen zurück in die Innenstadt (Reurbanisierung), am Fluss entsteht ein Uferpark.",
    neu: ["Neue Quartiere auf Industriebrachen", "Gentrifizierung der Gründerzeitviertel", "Reurbanisierung", "Uferpark am Fluss"],
    stadt: kopie(s),
  };
  return [e1, e2, e3, e4, e5, e6];
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
  switch (stil) {
    case "roemisch": return roemisch(g, seed);
    case "europaeisch": return europaeisch(g, seed);
    case "amerikanisch": return amerikanisch(g, seed);
    case "residenz": return residenz(g, seed);
    case "festung": return festung(g, seed);
    case "sozialistisch": return sozialistisch(g, seed);
    case "lateinamerika": return lateinamerika(g, seed);
    case "orientalisch": return orientalisch(g, seed);
  }
}

/** Zonentypen, die in einer Stadt vorkommen (für Quiz und Legende) */
export function zonenIn(s: Stadt): ZonenTyp[] {
  return [...new Set(s.zonen.map(z => z.typ))];
}
