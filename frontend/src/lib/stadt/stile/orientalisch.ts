/**
 * Orientalisch-islamische Stadt nach dem Modell von Dettmann/Wirth, z. B.
 * Fès oder Marrakesch:
 *   um 1200  Medina: Freitagsmoschee in der Mitte, Bazar entlang der
 *            Hauptgassen, Wohnquartiere mit Sackgassen, Kasbah an der Mauer
 *   um 1930  Kolonialzeit: Ville nouvelle vor der Medina, dazwischen ein
 *            Grüngürtel (getrennte, »dualistische« Stadt)
 *   heute    Wachstum: informelle Siedlungen, Neubauviertel, Mall
 */
import { hoeheBei, inAue, istWasser, type Gelaende } from "@/lib/gelaende/gelaende";
import { perlin, zufallsquelle } from "@/lib/gelaende/rauschen";
import { abstand, geschlossen, inPoly, laenge, punktBei, rechteck, schnitte, skaliere, zurLinie, type P } from "../geometrie";
import { kopie, leereStadt, type Epoche, type Stadt } from "../modell";
import { band, bau, baubar, besterPunkt, fernstrasse, freiraeumen, raster, type Z } from "../hilfen";
import { moderne } from "../moderne";
import { stromlinien, type Feld } from "../tensor";
import { weg } from "../wege";

const polar = (c: P, w: number, r: number): P => ({ x: c.x + Math.cos(w) * r, y: c.y + Math.sin(w) * r });

/**
 * Sackgassen wie ein Baum: von den Hauptgassen zweigen Gassen ab, die sich
 * verästeln und blind enden — sie verbinden sich nie. Privatsphäre der
 * Familien statt Durchgangsverkehr.
 */
export function sackgassen(s: Stadt, staemme: P[][], drin: (p: P) => boolean, z: Z, dichte = 24): P[][] {
  const belegt: P[] = staemme.flat();
  const aus: P[][] = [];
  // frei: nichts in 11 m Nähe — außer dem eigenen Anfang (der Stamm, von dem die Gasse abzweigt)
  const frei = (p: P, ohne: P[], start: P) => !belegt.some(q => !ohne.includes(q) && abstand(q, start) > 16 && abstand(p, q) < 11);
  const wachse = (start: P, w: number, L: number, tiefe: number) => {
    const pts: P[] = [start];
    let p = start, richtung = w;
    for (let d = 0; d < L; d += 6) {
      richtung += (z() - 0.5) * 0.6;
      const q = polar(p, richtung, 6);
      if (!drin(q) || !frei(q, pts.slice(-3), start)) break;
      pts.push(q);
      p = q;
      // Abzweig
      if (tiefe < 2 && d > 18 && z() < 0.12) wachse(q, richtung + (z() > 0.5 ? 1 : -1) * Math.PI / 2, L * 0.6, tiefe + 1);
    }
    if (pts.length > 2) { aus.push(pts); belegt.push(...pts); }
  };
  for (const st of staemme) {
    const L = laenge(st);
    for (let d = 10; d < L - 10; d += dichte * (0.6 + z() * 0.8)) {
      const { p, dx, dy } = punktBei(st, d);
      const seite = z() > 0.5 ? 1 : -1;
      wachse(p, Math.atan2(dy, dx) + seite * Math.PI / 2, 50 + z() * 80, 0);
    }
  }
  s.strassen.push(...aus.map(punkte => ({ art: "gasse" as const, punkte })));
  return aus;
}

export function orientalisch(g: Gelaende, seed: number): Epoche[] {
  const z = zufallsquelle(seed);
  const R = 400;
  const mitte = { x: g.breite / 2, y: g.breite / 2 };
  const c = besterPunkt(g, 800, p => {
    if (!baubar(g, p, 8)) return -1e9;
    let gut = 0;
    for (let k = 0; k < 12; k++) { const q = polar(p, (k / 12) * Math.PI * 2, R); if (baubar(g, q, 14)) gut++; }
    return gut - abstand(p, mitte) / 400 + z() * 0.4;
  }) ?? mitte;
  const s = leereStadt("orientalisch");
  // Mauer: unregelmäßig, meidet Wasser
  const r = perlin(seed + 3);
  const mauer: P[] = Array.from({ length: 18 }, (_, i) => {
    const w = (i / 18) * Math.PI * 2;
    let rr = R * (1 + 0.18 * r(Math.cos(w), Math.sin(w)));
    let p = polar(c, w, rr);
    while (rr > R * 0.4 && (istWasser(g, p.x, p.y) || inAue(g, p.x, p.y))) { rr -= 10; p = polar(c, w, rr); }
    return p;
  });
  s.mauern.push(mauer);
  s.zonen.push({ typ: "medina", poly: mauer });
  bau(s, "moschee", c, 0);
  bau(s, "hammam", { x: c.x + 62, y: c.y + 58 }, 0);
  // Fernwege durch die Tore, Hauptgassen Tor → Moschee
  const richt = [0, 1, 2, 3, 4].map(i => (i / 5) * Math.PI * 2 + z() * 0.4);
  const staemme: P[][] = [];
  const tore: P[] = [];
  for (const w of richt) {
    const f = fernstrasse(g, polar(c, w, R * 0.6), w);
    const t = schnitte(f, geschlossen(mauer))[0];
    if (!t) continue;
    tore.push(t);
    bau(s, "tor", t);
    const draussen = f.filter(p => !inPoly(p, mauer));
    const ab = draussen.findIndex(p => abstand(p, t) < 60);
    s.strassen.push({ art: "fernstrasse", punkte: [t, ...draussen.slice(Math.max(0, ab))] });
    const innen = weg(g, t, polar(c, w, 50), { steigung: 0.3, wasser: 50, raster: 10, extra: p => (inPoly(p, mauer) ? 0 : 40) });
    staemme.push(innen);
    s.strassen.push({ art: "neben", name: "Hauptgasse", punkte: innen });
    // Bazar entlang der Hauptgasse, nahe der Moschee am dichtesten
    s.zonen.push({ typ: "bazar", poly: band(innen.filter(p => abstand(p, c) < R * 0.7), 46) });
    // Karawanserei innen am Tor, Friedhof draußen
    bau(s, "karawanserei", polar(t, w + Math.PI, 70), w);
    if (z() < 0.6) { const fh = polar(t, w + 0.5, 110); if (baubar(g, fh, 16) && !inPoly(fh, mauer)) bau(s, "friedhof", fh, w); }
  }
  s.zonen.push({ typ: "bazar", poly: Array.from({ length: 12 }, (_, i) => polar(c, (i / 12) * Math.PI * 2, 95)) });
  // Kasbah am höchsten Punkt der Mauer
  const hoch = mauer.reduce((a, b) => (hoeheBei(g, b.x, b.y) > hoeheBei(g, a.x, a.y) ? b : a));
  const kas = { x: hoch.x + (c.x - hoch.x) * 0.22, y: hoch.y + (c.y - hoch.y) * 0.22 };
  bau(s, "kasbah", kas, Math.atan2(c.y - kas.y, c.x - kas.x) + Math.PI / 2);
  s.mauern.push(rechteck(kas, 190, 150, Math.atan2(c.y - kas.y, c.x - kas.x) + Math.PI / 2));
  freiraeumen(s);
  const innen = skaliere(mauer, 0.96, c);
  sackgassen(s, staemme, p => inPoly(p, innen) && !istWasser(g, p.x, p.y) && abstand(p, c) > 60 && abstand(p, kas) > 110, z);
  s.namen = [{ text: "Bazar (Suq)", x: c.x + 30, y: c.y - 110 }, { text: "Medina", x: c.x - R * 0.6, y: c.y + R * 0.5 }];
  const e1: Epoche = {
    jahr: "um 1200", titel: "Medina",
    text: "Im Zentrum steht die Freitagsmoschee. Um sie herum und entlang der Hauptgassen zu den Toren liegt der Bazar (Suq): nahe der Moschee die wertvollen Waren (Gold, Bücher, Stoffe), zu den Toren hin laute und schmutzige Handwerke (Schmiede, Gerber). Die Wohnquartiere dahinter sind ruhig: Gassen verästeln sich und enden blind (Sackgassen) — Fremde haben dort nichts zu suchen, die Häuser öffnen sich nach innen zum Hof. An der Mauer, auf der Anhöhe, liegt die Kasbah des Herrschers; an den Toren Karawansereien für die Fernhändler.",
    neu: ["Freitagsmoschee im Zentrum", "Bazar entlang der Hauptgassen", "Wohnquartiere mit Sackgassen", "Kasbah an der Mauer", "Karawansereien an den Toren"],
    stadt: kopie(s),
  };

  // Kolonialzeit: Ville nouvelle
  const vn = besterPunkt(g, 350, p => {
    const d = abstand(p, c);
    if (d < R + 500 || d > R + 1000 || !baubar(g, p, 6)) return -1e9;
    let gut = 0;
    for (let k = 0; k < 8; k++) if (baubar(g, polar(p, (k / 8) * Math.PI * 2, 320), 10)) gut++;
    return gut - d / 300 + z() * 0.4;
  });
  if (vn) {
    const poly = Array.from({ length: 16 }, (_, i) => polar(vn, (i / 16) * Math.PI * 2, 380));
    s.zonen.push({ typ: "ville", poly });
    s.strassen.push(...raster(g, vn.x - 360, vn.y - 360, vn.x + 360, vn.y + 360, 110, 110, vn.x, vn.y, "neben", p => inPoly(p, poly)));
    // Boulevards sternförmig vom zentralen Platz
    for (let k = 0; k < 4; k++) {
      const w = (k / 4) * Math.PI * 2 + Math.PI / 4;
      s.strassen.push({ art: "ring", name: "Boulevard", punkte: [polar(vn, w, 40), polar(vn, w, 370)] });
    }
    const zuMedina = tore.reduce((a, b) => (abstand(b, vn) < abstand(a, vn) ? b : a), tore[0] ?? c);
    s.strassen.push({ art: "haupt", name: "Avenue", punkte: weg(g, vn, zuMedina, { steigung: 0.5, wasser: 20, raster: 20 }) });
    // Grüngürtel zwischen den Städten
    const mittel = { x: (vn.x + c.x) / 2, y: (vn.y + c.y) / 2 };
    s.zonen.push({ typ: "park", poly: rechteck(mittel, 260, Math.max(200, abstand(vn, c) - R - 380), Math.atan2(vn.y - c.y, vn.x - c.x) + Math.PI / 2) });
    bau(s, "bahnhof", polar(vn, Math.atan2(vn.y - c.y, vn.x - c.x), 320), Math.atan2(vn.y - c.y, vn.x - c.x) + Math.PI / 2);
    bau(s, "kirche", polar(vn, 0.3, 120), 0);
    s.namen = [...(s.namen ?? []), { text: "Ville nouvelle", x: vn.x - 50, y: vn.y - 400 }];
  }
  freiraeumen(s);
  const e2: Epoche = {
    jahr: "um 1930", titel: "Ville nouvelle",
    text: "Die Kolonialmacht (in Marokko Frankreich) lässt die Medina stehen und baut daneben eine eigene Stadt für Europäer: die Ville nouvelle mit Raster, breiten Boulevards, Bahnhof und Kirche. Ein Grüngürtel trennt beide — zwei Städte nebeneinander, eine »dualistische« Stadt. Handel und Verwaltung wandern in die Neustadt.",
    neu: ["Ville nouvelle mit Boulevards", "Grüngürtel zwischen Medina und Neustadt", "Bahnhof in der Neustadt", "Dualistische Stadt"],
    stadt: kopie(s),
  };

  // heute
  moderne(g, s, mauer, c, z);
  for (let i = 0; i < 2; i++) {
    const p = besterPunkt(g, 200, q => {
      const d = abstand(q, c);
      if (d < R + 300 || d > R + 1300 || istWasser(g, q.x, q.y) || s.zonen.some(x => inPoly(q, x.poly))) return -1e9;
      return -d / 500 + z();
    });
    if (!p) break;
    const n = perlin(seed + 50 + i);
    const poly = Array.from({ length: 18 }, (_, k) => { const w = (k / 18) * Math.PI * 2; return polar(p, w, 150 * (1 + 0.3 * n(Math.cos(w), Math.sin(w)))); });
    s.zonen.push({ typ: "marginal", poly });
    const feld: Feld = { basen: [{ art: "radial", c: p, groesse: 160 }], rauschen: { r: n, staerke: 1, skala: 80 } };
    s.strassen.push(...stromlinien(feld, q => inPoly(q, poly) && !istWasser(g, q.x, q.y), {
      dsep: 26, dtest: 10, schritt: 4, maxLaenge: 300, minLaenge: 20, verbinden: 10, zufall: z, keime: [p], rahmen: { x0: p.x - 220, y0: p.y - 220, x1: p.x + 220, y1: p.y + 220 }, max: 30,
    }).map(punkte => ({ art: "gasse" as const, punkte })));
    const nah = s.strassen.filter(st => st.art === "haupt" || st.art === "fernstrasse").map(st => zurLinie(p, st.punkte)).sort((a, b) => a.d - b.d)[0];
    if (nah && nah.d < 600) s.strassen.push({ art: "neben", punkte: [p, nah.q] });
  }
  freiraeumen(s);
  const e3: Epoche = {
    jahr: "heute", titel: "Wachsende Stadt",
    text: "Die Bevölkerung wächst schnell, viele kommen vom Land. Am Rand entstehen informelle Siedlungen (Bidonvilles) und große Neubauviertel, an der Umgehungsstraße eine Mall. Die Medina ist heute oft UNESCO-Welterbe (z. B. Fès): Touristen kommen in den Bazar, während wohlhabende Familien in die Neubauviertel ziehen.",
    neu: ["Informelle Siedlungen am Rand", "Neubauviertel und Mall", "Medina als Welterbe und Touristenziel"],
    stadt: kopie(s),
  };
  return [e1, e2, e3];
}
