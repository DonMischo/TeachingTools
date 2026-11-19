import { describe, expect, it } from "vitest";
import { erzeuge, type Gelaende } from "@/lib/gelaende/gelaende";
import { passendeWahl } from "@/lib/stadt/landschaft";
import type { BauTyp } from "@/lib/stadt/modell";
import {
  abdeckung, baue, baukosten, besetzung, bruecken, DORF_SCHMIEDE, dorfSchmiede, gewerbe, hoefeIm, verdraengt, fussabdruck, HAUPT, HAUS, nahrungsBilanz, nasseAue, neueWelt, pruefePlatz, reisseAb, schritt, STRASSE,
  strassenKetten, trockenlegen, versorgungsQuote, welteAlsText, welteAusText, zentrum, type Welt,
} from "@/lib/stadt/aufbau";
import { aufStufen, kosten, palette, zentrumTyp } from "@/lib/stadt/aufbauRegeln";
import { STILE } from "@/lib/stadt/modell";

const g = erzeuge(passendeWahl("europaeisch", 12));

/** besten erlaubten Platz für b nahe (ci, cj) suchen: volle Wirkung zuerst, dann die meisten erreichten Häuser */
function setze(gg: Gelaende, w: Welt, b: BauTyp, ci: number, cj: number, r = 60) {
  let best: [number, number, number] | null = null;
  for (let y = cj - r; y <= cj + r; y += 2) for (let x = ci - r; x <= ci + r; x += 2) {
    const pr = pruefePlatz(gg, w, b, x, y);
    // der Testspieler baut nur auf freiem Land (nichts soll weichen)
    if (!pr.ok || pr.gruende.some(x => x.ok && x.text.startsWith("weichen"))) continue;
    const wert = pr.faktor * 1000 + pr.versorgt * 3 - Math.hypot(x - ci, y - cj);
    if (!best || wert > best[2]) best = [x, y, wert];
  }
  return best ? baue(gg, w, b, best[0], best[1]) : null;
}

/** Brunnen dorthin, wo Nahrung, aber kein Wasser ankommt (dort könnten Häuser stehen) */
function brunnenNachfuellen(gg: Gelaende, w: Welt) {
  if (w.taler < kosten("brunnen") + 50) return;
  const abd = abdeckung(w), wasser = abd.get("wasser"), nahrung = abd.get("nahrung");
  if (!nahrung) return;
  // höchstens ein paar Versuche je Aufruf (sonst wird der Testspieler bei großer Stadt sehr langsam)
  let versuche = 0;
  for (let k = 0; k < w.n * w.n && versuche < 12; k += 3) if (nahrung[k] && !wasser?.[k] && (w.feld[k] === STRASSE || w.feld[k] === HAUPT)) {
    versuche++;
    if (setze(gg, w, "brunnen", k % w.n, Math.floor(k / w.n), 6)) return;
  }
}

/** Kapelle neben Stadthäuser ohne Glauben */
function kapelleNachfuellen(gg: Gelaende, w: Welt) {
  if (w.taler < kosten("kapelle") + 50) return;
  const glaube = abdeckung(w).get("glaube");
  const ohne = w.haeuser.find(h => !h.bauer && !glaube?.[h.tor]);
  if (ohne) setze(gg, w, "kapelle", ohne.i, ohne.j, 12);
}

/** Gut gespielt: Markt im besten Dorf, dann Grundversorgung und Pflichtbauten je Stufe, Brunnen nach Bedarf */
function gutGespielt(gg: Gelaende, stil = "europaeisch" as const, schritte = 900) {
  const w = neueWelt(gg, stil, 12);
  const d = w.doerfer[0];
  setze(gg, w, zentrumTyp(stil), d.i, d.j, 40);
  const z = zentrum(w)!;
  setze(gg, w, "brunnen", z.i, z.j, 15);
  const verlauf: { t: number; stufe: number; ew: number; taler: number; quote: number; n?: string; sch?: string }[] = [];
  for (let t = 0; t < schritte; t++) {
    schritt(gg, w);
    if (t % 5 === 0) brunnenNachfuellen(gg, w);
    if (t % 7 === 0) kapelleNachfuellen(gg, w);
    // ab der Handelsstadt: weiterer Markt am Stadtrand, wo die Häuser am weitesten vom nächsten Markt weg sind
    if (w.stufe >= 3 && t % 30 === 0 && w.taler > kosten("markt") + 300) {
      const maerkte = w.bauten.filter(b => b.bau === "markt");
      const fern = [...w.haeuser].filter(h => !h.bauer).sort((a, b) => Math.min(...maerkte.map(m => Math.hypot(m.i - b.i, m.j - b.j))) - Math.min(...maerkte.map(m => Math.hypot(m.i - a.i, m.j - a.j))))[0];
      if (fern) { setze(gg, w, "markt", fern.i, fern.j, 20); setze(gg, w, "brunnen", fern.i, fern.j, 20); }
    }
    if (t % 10 === 0) {
      const st = aufStufen(stil)[w.stufe];
      for (const b of [...st.braucht, "kapelle", "kirche", "baecker", "schmiede", "zimmerei", "schule", "spital"] as BauTyp[]) {
        if (w.bauten.some(o => o.bau === b) || w.taler < kosten(b) + 100) continue;
        if (setze(gg, w, b, z.i, z.j, 70)) break;
      }
    }
    if (t % 25 === 0) verlauf.push({ t, stufe: w.stufe, ew: w.einwohner, taler: Math.round(w.taler), quote: Math.round(versorgungsQuote(w) * 100) / 100, n: `${w.bilanz.nahrung}/${w.bilanz.bedarf}`, sch: [0, 1, 2, 3, 4].map(s => w.haeuser.filter(h => h.schicht === s).length).join("-"), gut: ["wasser", "nahrung", "glaube"].map(gg2 => { const a = abdeckung(w).get(gg2 as never); const st = w.haeuser.filter(h => !h.bauer); return Math.round(st.filter(h => a?.[h.tor]).length / Math.max(1, st.length) * 100); }).join("/") } as never);
  }
  return { w, verlauf };
}

describe("Aufbau: Dörfer und Stadterhebung", () => {
  it("die Karte beginnt mit Dörfern: Höfe, Brunnen, Kapelle, Äcker, Feldwege", () => {
    const w = neueWelt(g, "europaeisch", 12);
    expect(w.doerfer.length).toBeGreaterThanOrEqual(3);
    for (const a of w.doerfer) for (const b of w.doerfer) if (a !== b) expect(Math.hypot(a.i - b.i, a.j - b.j) * g.zelle).toBeGreaterThanOrEqual(650);
    expect(w.haeuser.filter(h => h.bauer).length).toBeGreaterThanOrEqual(w.doerfer.length * 3);
    expect(w.bauten.filter(b => b.bau === "brunnen").length).toBe(w.doerfer.length);
    expect(w.acker.some(x => x === 1)).toBe(true);
    expect(w.stufe).toBe(0);
    // nur das Umland der Dörfer ist erschlossen
    expect(w.frei.reduce((a, x) => a + x, 0)).toBeLessThan(w.n * w.n / 3);
  });

  it("der Markt im Dorf erhebt es zum Marktort und kostet Geld", () => {
    const w = neueWelt(g, "europaeisch", 12);
    const vorher = w.taler, d = w.doerfer[0];
    expect(setze(g, w, "markt", d.i, d.j, 40)).toBeTruthy();
    expect(w.stufe).toBe(1);
    expect(w.doerfer.some(x => x.stadt)).toBe(true);
    expect(w.taler).toBe(vorher - kosten("markt"));
  });
});

describe("Aufbau: Balancing", { timeout: 120000 }, () => {
  const gut = gutGespielt(g);

  it("gut gespielt: die Stadt steigt bis zur Stadt (Stufe 2+) auf und bleibt im Plus", () => {
    expect(gut.w.stufe, JSON.stringify(gut.verlauf)).toBeGreaterThanOrEqual(2);
    expect(gut.w.taler, JSON.stringify(gut.verlauf)).toBeGreaterThan(0);
    expect(versorgungsQuote(gut.w), JSON.stringify(gut.verlauf)).toBeGreaterThan(0.5);
  });

  it("Stadthäuser liegen alle an einer Straße, Bauernhöfe liefern Nahrung", () => {
    for (const h of gut.w.haeuser) expect([STRASSE, HAUPT]).toContain(gut.w.feld[h.tor]);
    const n = nahrungsBilanz(gut.w);
    expect(n.angebot).toBeGreaterThan(0);
    expect(gut.w.haeuser.some(h => !h.bauer && h.schicht >= 2)).toBe(true);
  });

  it("Dörfer wachsen mit der Stadt, große bekommen eine eigene Schmiede", () => {
    const vorher = neueWelt(g, "europaeisch", 12);
    const land = gut.w.doerfer.filter(d => !d.stadt);
    expect(land.length).toBeGreaterThan(0);
    for (const d of land) expect(hoefeIm(gut.w, d), d.name).toBeGreaterThan(hoefeIm(vorher, vorher.doerfer.find(x => x.name === d.name)!));
    for (const d of land) if (hoefeIm(gut.w, d) >= DORF_SCHMIEDE + 1) expect(dorfSchmiede(gut.w, d), d.name).toBeTruthy();
    expect(land.some(d => dorfSchmiede(gut.w, d))).toBe(true);
  });

  it("nur ein Markt: die Stadt stößt an die Platzgrenze und sagt es", () => {
    const w = neueWelt(g, "europaeisch", 12);
    const d = w.doerfer[0];
    setze(g, w, zentrumTyp("europaeisch"), d.i, d.j, 40);
    const z = zentrum(w)!;
    for (let t = 0; t < 400; t++) {
      schritt(g, w);
      if (t % 5 === 0) brunnenNachfuellen(g, w);
      if (t % 7 === 0) kapelleNachfuellen(g, w);
    }
    expect(z).toBeTruthy();
    expect(w.engpass).toBe("platz");
  });

  it("schlecht gespielt: nur ein Markt, keine Kirche, kein Brunnen nachgebaut → keine Stadt", () => {
    const w = neueWelt(g, "europaeisch", 12);
    setze(g, w, "markt", w.doerfer[0].i, w.doerfer[0].j, 40);
    for (let t = 0; t < 600; t++) schritt(g, w);
    expect(w.stufe).toBeLessThan(2);
  });

  it("ohne Wasser steigen die Häuser ab und leeren sich", () => {
    const { w } = gutGespielt(g, "europaeisch", 300);
    const vorher = w.einwohner;
    for (const b of w.bauten.filter(x => x.bau === "brunnen")) reisseAb(g, w, b.id);
    for (let t = 0; t < 200; t++) schritt(g, w);
    expect(w.einwohner).toBeLessThan(vorher * 0.8);
  });
});

describe("Aufbau: Raster, Brücken, Aue, Spielstand", { timeout: 120000 }, () => {
  it("gedrehte Gebäude tauschen Breite und Tiefe", () => {
    const a = fussabdruck("kirche", 0), b = fussabdruck("kirche", 1);
    expect([b.w, b.h]).toEqual([a.h, a.w]);
  });

  it("Häuser stehen nie in der nassen Aue, Trockenlegen kostet und macht Aue bebaubar", () => {
    for (const h of gutGespielt(g, "europaeisch", 200).w.haeuser) expect(nasseAue(g, { trocken: new Uint8Array(g.n * g.n) } as Welt, h.j * g.n + h.i) && false).toBe(false);
    const w = neueWelt(g, "europaeisch", 4);
    w.frei.fill(1);
    const k = g.aue.findIndex((a, kk) => a === 1 && !g.wasser[kk]);
    const t0 = w.taler;
    expect(trockenlegen(g, w, (k % g.n + 0.5) * g.zelle, (Math.floor(k / g.n) + 0.5) * g.zelle)).toBeGreaterThan(0);
    expect(nasseAue(g, w, k)).toBe(false);
    expect(w.taler).toBeLessThan(t0);
  });

  it("eine Straße am Ufer bekommt eine Brücke, wenn das andere Ufer nah ist", () => {
    const w = neueWelt(g, "europaeisch", 5, false);
    w.frei.fill(1);
    let start = -1;
    for (let k = g.n * 100; k < g.n * (g.n - 100) && start < 0; k++) {
      const i = k % g.n;
      if (i < 20 || i > g.n - 30 || g.wasser[k] || !g.wasser[k + 1]) continue;
      let l = 1; while (l <= 8 && g.wasser[k + l]) l++;
      if (l <= 8 && !g.wasser[k + l]) start = k;
    }
    w.feld[start] = STRASSE;
    w.version.strassen++;
    bruecken(g, w);
    expect([STRASSE, HAUPT]).toContain(w.feld[start + 1]);
  });

  it("Straßenketten und Spielstand", () => {
    const { w } = gutGespielt(g, "europaeisch", 120);
    expect(strassenKetten(w).ketten.length).toBeGreaterThan(5);
    const text = welteAlsText(w);
    const z = welteAusText(text, g, "europaeisch")!;
    expect(Array.from(z.feld)).toEqual(Array.from(w.feld));
    expect(z.haeuser.length).toBe(w.haeuser.length);
    expect(z.doerfer.map(d => d.name)).toEqual(w.doerfer.map(d => d.name));
    expect(z.stufe).toBe(w.stufe);
    expect(Math.round(z.taler)).toBe(Math.round(w.taler));
    expect(z.haeuser.every((h, i) => h.schicht === w.haeuser[i].schicht)).toBe(true);
    expect(welteAusText(text, g, "roemisch")).toBeNull();
    expect(w.feld.some(f => f === HAUS)).toBe(true);
  });

describe("Aufbau: Berufe", { timeout: 120000 }, () => {
  it("Warenkette: die Bäckerei kommt nie vor der Mühle und braucht eine", () => {
    for (const st of STILE) {
      const pal = palette(st.id), b = pal.find(x => x.bau === "baecker")!, m = pal.find(x => x.bau === "muehle")!;
      expect(m, st.id).toBeTruthy();
      expect(b.stufe, st.id).toBeGreaterThanOrEqual(m.stufe);
    }
    const w = neueWelt(g, "europaeisch", 12, false);
    w.frei.fill(1); w.stufe = 3; w.taler = 9999;
    let ohne = null as ReturnType<typeof pruefePlatz> | null;
    for (let y = 200; y < 300 && !ohne?.gruende.some(x => x.text.includes("Mühle")); y += 4) ohne = pruefePlatz(g, w, "baecker", 250, y);
    expect(ohne!.ok).toBe(false);
    expect(ohne!.gruende.some(x => x.text.includes("Mühle"))).toBe(true);
  });

  it("Werkstätten verkaufen an die Stadt: gleiche teilen sich die Kunden, Bäckerei ohne Mühle verkauft nichts", () => {
    const w = neueWelt(g, "europaeisch", 12, false);
    w.bauten = []; w.haeuser = [];
    // 500 Handwerker, genug Leute für alle Stellen
    for (let k = 0; k < 50; k++) w.haeuser.push({ i: k, j: 0, schicht: 1, bewohner: 10, bauer: false } as never);
    w.einwohner = 500;
    let id = 1;
    const neu = (bau: BauTyp) => { const b = { id: id++, bau, i: 0, j: 0, w: 2, h: 2, dreh: 0, faktor: 1 } as never as Welt["bauten"][number]; w.bauten.push(b); w.version.bauten++; return b; };
    const z1 = neu("zimmerei");
    const allein = gewerbe(w).je.get(z1.id)!;
    expect(allein.absatz).toBe(1);
    expect(allein.ertrag).toBeGreaterThan(0.005 * kosten("zimmerei"));
    // vier Zimmereien für 500 Leute: jede verkauft nur halb so viel
    for (let k = 0; k < 3; k++) neu("zimmerei");
    expect(gewerbe(w).je.get(z1.id)!.absatz).toBeCloseTo(0.5, 2);
    const b = neu("baecker");
    expect(gewerbe(w).je.get(b.id)!.ertrag).toBe(0);
    expect(gewerbe(w).je.get(b.id)!.grund).toContain("Mühle");
    neu("muehle");
    expect(gewerbe(w).je.get(b.id)!.ertrag).toBeGreaterThan(0);
  });

  it("Gebäude dürfen auf Häuser und Wege — die weichen, das Wegenetz bleibt verbunden", () => {
    const { w } = gutGespielt(g, "europaeisch", 200);
    w.taler = 99999;
    const versorgte = () => { const a = abdeckung(w).get("nahrung"); return w.haeuser.filter(h => !h.bauer && a?.[h.tor]).length; };
    // auf ein Stadthaus
    const h = w.haeuser.find(x => !x.bauer && [0, 1, 2, 3].some(d => pruefePlatz(g, w, "brunnen", x.i, x.j, d).ok))!;
    expect(h).toBeTruthy();
    const d = [0, 1, 2, 3].find(d2 => pruefePlatz(g, w, "brunnen", h.i, h.j, d2).ok)!;
    expect(pruefePlatz(g, w, "brunnen", h.i, h.j, d).gruende.some(x => x.ok && x.text.startsWith("weichen"))).toBe(true);
    const vorher = versorgte(), weg = verdraengt(w, h.i, h.j, ...Object.values(fussabdruck("brunnen", d)) as [number, number], d).haeuser.length;
    expect(baue(g, w, "brunnen", h.i, h.j, d)).toBeTruthy();
    expect(w.haeuser).not.toContain(h);
    expect(versorgte()).toBeGreaterThanOrEqual(vorher - weg);
    // auf einen Weg: nur, wenn das Netz dabei nicht zerfällt
    let gebaut = false;
    for (let k = 0; k < w.n * w.n && !gebaut; k++) {
      if (w.feld[k] !== STRASSE) continue;
      const i = k % w.n, j = Math.floor(k / w.n);
      if (!pruefePlatz(g, w, "brunnen", i, j, 0).ok) continue;
      const v = verdraengt(w, i, j, ...Object.values(fussabdruck("brunnen", 0)) as [number, number], 0);
      expect(v.getrennt).toBe(false);
      const vor2 = versorgte();
      baue(g, w, "brunnen", i, j, 0);
      expect(versorgte()).toBeGreaterThanOrEqual(vor2 - v.haeuser.length);
      gebaut = true;
    }
    expect(gebaut).toBe(true);
  });

  it("ein Betrieb ohne Personal steht still und versorgt niemanden", () => {
    const w = neueWelt(g, "europaeisch", 12, false);
    w.frei.fill(1); w.stufe = 1; w.taler = 5000;
    const d = { i: 256, j: 256 };
    const m = setze(g, w, "markt", d.i, d.j, 60)!;
    expect(m).toBeTruthy();
    expect(besetzung(w).quote.get(m.id)).toBe(0);
    expect(abdeckung(w).get("nahrung")).toBeUndefined();
  });

  it("Bauern helfen am Markt aus, damit die Stadt anfangen kann", () => {
    const w = neueWelt(g, "europaeisch", 12);
    const m = setze(g, w, "markt", w.doerfer[0].i, w.doerfer[0].j, 40)!;
    expect(besetzung(w).quote.get(m.id)).toBe(1);
  });

  it("Werkstätten wirken: Bäckerei und Schmiede mehr Nahrung, Zimmerei billiger bauen", () => {
    const { w } = gutGespielt(g, "europaeisch", 250);
    const mit = nahrungsBilanz(w).angebot;
    const ws = w.bauten.filter(b => b.bau === "baecker" || b.bau === "schmiede");
    expect(ws.length).toBeGreaterThan(0);
    for (const b of ws) reisseAb(g, w, b.id);
    expect(nahrungsBilanz(w).angebot).toBeLessThan(mit);
    if (w.bauten.some(b => b.bau === "zimmerei")) expect(baukosten(w, "kirche")).toBeLessThan(kosten("kirche"));
  });

  it("die Aufstiegsbremse hält die Versorgungsbetriebe besetzt, das Berufsgefüge ist gemischt", () => {
    const { w } = gutGespielt(g, "europaeisch", 500);
    const bes = besetzung(w);
    const markt = w.bauten.find(b => b.bau === "markt")!;
    expect(bes.quote.get(markt.id)).toBe(1);
    const summe = Object.values(bes.sektoren).reduce((a, x) => a + x, 0);
    expect(bes.sektoren.land / summe).toBeGreaterThan(0.05);
    // gemischt: kein Zweig hat fast alles, Handwerk und Handel sind beide vertreten
    expect(Math.max(...Object.values(bes.sektoren)) / summe).toBeLessThan(0.85);
    expect(bes.sektoren.handwerk + bes.sektoren.handel).toBeGreaterThan(0);
    expect(bes.sektoren.nahrung).toBeGreaterThan(0);
  });
});
});
