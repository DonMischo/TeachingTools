/**
 * Planungsaufträge und ihre Prüfregeln. Jede Regel prüft den Plan der
 * Schüler·innen am Gelände und erklärt, warum es so sein sollte.
 */
import { hoeheBei, inAue, istWasser, neigungBei, wasserAbstand, type Gelaende } from "@/lib/gelaende/gelaende";
import { abstand, flaeche, geschlossen, inPoly, laenge, richtung, schnitte, schwerpunkt, winkelAbstand, zurLinie, type P } from "./geometrie";
import { zoneBei } from "./haeuser";
import { BAUTEN } from "./modell";
import type { BauTyp, Stadt, Stil, StrassenArt } from "./modell";

export interface Pruefung { ok: boolean; hinweis: string; ort?: P }
export interface Regel {
  id: string;
  text: string;
  warum: string;
  pruefe: (s: Stadt, g: Gelaende, start: Stadt | null) => Pruefung;
}

export type Werkzeug = StrassenArt | "mauer" | "rechteckmauer" | "raster" | "zone";

export interface Auftrag {
  id: string;
  stil: Stil;
  icon: string;
  titel: string;
  auftrag: string;
  /** Start: leere Karte oder eine Epoche aus dem Wachstum */
  start: { epoche: number } | null;
  werkzeuge: Werkzeug[];
  bauten: BauTyp[];
  regeln: Regel[];
}

// ---------------------------------------------------------------- Hilfen

const alle = (s: Stadt, t: BauTyp) => s.bauten.filter(b => b.typ === t);
const eins = (s: Stadt, t: BauTyp) => s.bauten.find(b => b.typ === t) ?? null;
const strassen = (s: Stadt, ...arten: StrassenArt[]) => s.strassen.filter(st => arten.includes(st.art));
const fehlt = (was: string): Pruefung => ({ ok: false, hinweis: `Fehlt noch: ${was}.` });
const hatWasser = (g: Gelaende) => g.wasser.some(w => w > 0);

function nahAnStrasse(s: Stadt, p: P, arten: StrassenArt[], d: number): boolean {
  return strassen(s, ...arten).some(st => zurLinie(p, st.punkte).d < d);
}

/** Länge der Straßenstücke nach Richtung: Anteil, der zu einer der Richtungen passt */
function anteilAusgerichtet(l: P[][], winkel: number[], tol: number): { anteil: number; laenge: number } {
  let gut = 0, sum = 0;
  for (const st of l) for (let i = 0; i + 1 < st.length; i++) {
    const d = abstand(st[i], st[i + 1]);
    if (d < 1) continue;
    const w = richtung(st[i], st[i + 1]);
    sum += d;
    if (winkel.some(x => winkelAbstand(w, x) <= tol)) gut += d;
  }
  return { anteil: sum ? gut / sum : 0, laenge: sum };
}

/** kleinstes umschließendes (gedrehtes) Rechteck: Fläche und Winkel */
function huellRechteck(poly: P[]): { flaeche: number; winkel: number } {
  let best = { flaeche: Infinity, winkel: 0 };
  for (let w = 0; w < 90; w += 1) {
    const r = (w * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of poly) { const x = p.x * c + p.y * s, y = -p.x * s + p.y * c; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const f = (x1 - x0) * (y1 - y0);
    if (f < best.flaeche) best = { flaeche: f, winkel: w };
  }
  return best;
}

/** die Mauer, die p umschließt (oder die größte) */
function mauerUm(s: Stadt, p: P | null): P[] | null {
  if (p) { const m = s.mauern.find(m => inPoly(p, m)); if (m) return m; }
  return s.mauern.slice().sort((a, b) => flaeche(b) - flaeche(a))[0] ?? null;
}

function toreZahl(s: Stadt, m: P[], arten: StrassenArt[]): number {
  const punkte: P[] = [];
  for (const st of strassen(s, ...arten)) for (const t of schnitte(st.punkte, geschlossen(m))) if (!punkte.some(q => abstand(q, t) < 30)) punkte.push(t);
  return punkte.length;
}

function mittlereNeigung(g: Gelaende, m: P[]): number {
  const xs = m.map(p => p.x), ys = m.map(p => p.y);
  let n = 0, s = 0;
  for (let x = Math.min(...xs); x <= Math.max(...xs); x += 30) for (let y = Math.min(...ys); y <= Math.max(...ys); y += 30) {
    if (!inPoly({ x, y }, m)) continue;
    s += neigungBei(g, x, y); n++;
  }
  return n ? s / n : 0;
}

const amRand = (g: Gelaende, p: P, d = 80) => p.x < d || p.y < d || p.x > g.breite - d || p.y > g.breite - d;
const m0 = (x: number) => `${Math.round(x)} m`;

/** Rahmen aller Nebenstraßen einer Stadt */
function rahmen(s: Stadt | null): { x0: number; y0: number; x1: number; y1: number } | null {
  const pts = (s?.strassen ?? []).filter(st => st.art === "neben").flatMap(st => st.punkte);
  if (!pts.length) return null;
  return { x0: Math.min(...pts.map(p => p.x)), y0: Math.min(...pts.map(p => p.y)), x1: Math.max(...pts.map(p => p.x)), y1: Math.max(...pts.map(p => p.y)) };
}
const imRahmen = (r: ReturnType<typeof rahmen>, p: P, rand = 0) => !!r && p.x > r.x0 - rand && p.x < r.x1 + rand && p.y > r.y0 - rand && p.y < r.y1 + rand;

// ---------------------------------------------------------------- Römisch

const ROEMISCH: Regel[] = [
  {
    id: "forum", text: "Ein Forum ist gesetzt", warum: "Das Forum ist Markt, Gericht und Versammlungsort — das Herz jeder römischen Stadt.",
    pruefe: s => (eins(s, "forum") ? { ok: true, hinweis: "Forum vorhanden." } : fehlt("Forum")),
  },
  {
    id: "trocken", text: "Die Stadt liegt nicht in der Aue", warum: "Die Aue am Fluss wird bei Hochwasser überflutet. Römische Vermesser wählten trockenen, leicht erhöhten Grund.",
    pruefe: (s, g) => {
      const f = eins(s, "forum");
      if (!f) return fehlt("Forum");
      const m = mauerUm(s, f);
      const pts = m ?? [f];
      const nass = pts.filter(p => inAue(g, p.x, p.y) || istWasser(g, p.x, p.y)).length + (inAue(g, f.x, f.y) ? 1 : 0);
      return nass ? { ok: false, hinweis: "Teile der Stadt liegen in der Aue — Hochwassergefahr!", ort: f } : { ok: true, hinweis: "Trockener Grund." };
    },
  },
  {
    id: "wasser", text: "Wasser ist nah (unter 700 m)", warum: "Fluss oder Küste liefern Wasser, Fische und vor allem einen Transportweg für schwere Waren.",
    pruefe: (s, g) => {
      const f = eins(s, "forum");
      if (!f) return fehlt("Forum");
      if (!hatWasser(g)) return { ok: true, hinweis: "Auf dieser Karte gibt es kein Gewässer — Brunnen und Aquädukt müssen reichen." };
      const d = wasserAbstand(g, f.x, f.y);
      return d < 700 ? { ok: true, hinweis: `Wasser in ${m0(d)}.` } : { ok: false, hinweis: `Das nächste Wasser ist ${m0(d)} entfernt.`, ort: f };
    },
  },
  {
    id: "eben", text: "Ebener Baugrund (unter 8 % Neigung)", warum: "Ein regelmäßiges Raster lässt sich nur auf flachem Land sauber abstecken.",
    pruefe: (s, g) => {
      const f = eins(s, "forum"), m = mauerUm(s, f);
      if (!m) return fehlt("Mauer");
      const n = mittlereNeigung(g, m);
      return n < 8 ? { ok: true, hinweis: `Mittlere Neigung ${n.toFixed(1)} %.` } : { ok: false, hinweis: `Mittlere Neigung ${n.toFixed(1)} % — zu steil für ein Raster.`, ort: schwerpunkt(m) };
    },
  },
  {
    id: "rechteck", text: "Die Mauer ist ein Rechteck", warum: "Römische Städte und Legionslager (Castra) wurden nach Plan rechteckig angelegt — wie ein Spielbrett.",
    pruefe: s => {
      const m = mauerUm(s, eins(s, "forum"));
      if (!m) return fehlt("Mauer");
      const q = flaeche(m) / huellRechteck(m).flaeche;
      return q > 0.88 ? { ok: true, hinweis: "Schön rechteckig." } : { ok: false, hinweis: "Die Mauer ist eher unregelmäßig.", ort: schwerpunkt(m) };
    },
  },
  {
    id: "achsen", text: "Cardo und Decumanus kreuzen sich rechtwinklig am Forum", warum: "Zwei Hauptstraßen teilen die Stadt in vier Teile: der Cardo (Nord–Süd) und der Decumanus (Ost–West). An der Kreuzung liegt das Forum.",
    pruefe: s => {
      const f = eins(s, "forum");
      if (!f) return fehlt("Forum");
      const h = strassen(s, "haupt");
      for (let i = 0; i < h.length; i++) for (let j = i + 1; j < h.length; j++) {
        for (const k of schnitte(h[i].punkte, h[j].punkte)) {
          const a = zurLinie(k, h[i].punkte).seg, b = zurLinie(k, h[j].punkte).seg;
          const w = winkelAbstand(richtung(h[i].punkte[a], h[i].punkte[a + 1]), richtung(h[j].punkte[b], h[j].punkte[b + 1]));
          if (w > 78 && abstand(k, f) < 110) return { ok: true, hinweis: "Die Achsen kreuzen sich am Forum." };
        }
      }
      return { ok: false, hinweis: h.length < 2 ? "Zeichne zwei Hauptstraßen, die sich am Forum kreuzen." : "Die Hauptstraßen kreuzen sich nicht rechtwinklig nahe am Forum.", ort: f };
    },
  },
  {
    id: "himmel", text: "Die Achsen folgen den Himmelsrichtungen", warum: "Oft richteten die Vermesser (Agrimensoren) den Cardo nach Norden aus — wenn das Gelände es zuließ.",
    pruefe: s => {
      const r = anteilAusgerichtet(strassen(s, "haupt").map(st => st.punkte), [0, 90], 10);
      return r.laenge && r.anteil > 0.8 ? { ok: true, hinweis: "Nord–Süd und Ost–West." } : { ok: false, hinweis: "Die Hauptstraßen sind schräg zu den Himmelsrichtungen." };
    },
  },
  {
    id: "tore", text: "Vier Tore, an jeder Achse eins", warum: "Wo Cardo und Decumanus die Mauer erreichen, liegen die Tore — von dort führen die Fernstraßen weiter.",
    pruefe: s => {
      const m = mauerUm(s, eins(s, "forum"));
      if (!m) return fehlt("Mauer");
      const n = toreZahl(s, m, ["haupt", "fernstrasse"]);
      return n >= 4 ? { ok: true, hinweis: `${n} Tore.` } : { ok: false, hinweis: `Erst ${n} Straße(n) durch die Mauer.` };
    },
  },
  {
    id: "raster", text: "Insulae: ein regelmäßiges Raster in der Mauer", warum: "Nebenstraßen parallel zu den Achsen ergeben gleich große Wohnblöcke, die Insulae.",
    pruefe: s => {
      const m = mauerUm(s, eins(s, "forum"));
      if (!m) return fehlt("Mauer");
      const neben = strassen(s, "neben").filter(st => st.punkte.some(p => inPoly(p, m))).map(st => st.punkte);
      const w = huellRechteck(m).winkel;
      const r = anteilAusgerichtet(neben, [w, (w + 90) % 180], 10);
      if (neben.length < 4) return { ok: false, hinweis: `Erst ${neben.length} Nebenstraßen — tipp: das Raster-Werkzeug.` };
      return r.anteil > 0.8 ? { ok: true, hinweis: `${neben.length} Nebenstraßen im Raster.` } : { ok: false, hinweis: "Die Nebenstraßen laufen kreuz und quer." };
    },
  },
  {
    id: "innen", text: "Tempel und Thermen in der Stadt", warum: "Tempel stehen am Forum, Thermen sind öffentliche Bäder für alle Bürger — beides gehört in die Stadt.",
    pruefe: s => {
      const m = mauerUm(s, eins(s, "forum"));
      const t = eins(s, "tempel"), th = eins(s, "thermen");
      if (!t || !th) return fehlt(!t ? "Tempel" : "Thermen");
      if (!m) return fehlt("Mauer");
      return inPoly(t, m) && inPoly(th, m) ? { ok: true, hinweis: "Beide innerhalb der Mauer." } : { ok: false, hinweis: "Tempel oder Thermen liegen draußen.", ort: inPoly(t, m) ? th : t };
    },
  },
  {
    id: "arena", text: "Das Amphitheater liegt vor der Mauer", warum: "Tausende Zuschauer — und Lärm und Gedränge. Arenen lagen meist außerhalb, nahe einem Tor.",
    pruefe: s => {
      const a = eins(s, "amphitheater"), m = mauerUm(s, eins(s, "forum"));
      if (!a) return fehlt("Amphitheater");
      if (!m) return fehlt("Mauer");
      return !inPoly(a, m) ? { ok: true, hinweis: "Draußen, gut erreichbar." } : { ok: false, hinweis: "Das Amphitheater steht in der Stadt.", ort: a };
    },
  },
  {
    id: "graeber", text: "Gräber außerhalb, an einer Fernstraße", warum: "Das Zwölftafelgesetz verbot Bestattungen in der Stadt. Gräber säumten die Ausfallstraßen, damit man sich an die Toten erinnert.",
    pruefe: s => {
      const gs = alle(s, "nekropole"), m = mauerUm(s, eins(s, "forum"));
      if (!gs.length) return fehlt("Gräberfeld");
      const schlecht = gs.find(b => (m && inPoly(b, m)) || !nahAnStrasse(s, b, ["fernstrasse", "haupt"], 70));
      return schlecht ? { ok: false, hinweis: "Ein Gräberfeld liegt in der Stadt oder abseits der Straßen.", ort: schlecht } : { ok: true, hinweis: "An der Straße vor der Stadt." };
    },
  },
  {
    id: "via", text: "Fernstraßen führen von den Toren hinaus", warum: "Das römische Straßennetz verband jede Stadt mit Rom — schnurgerade, gepflastert, für Händler und Legionen.",
    pruefe: (s, g) => {
      const m = mauerUm(s, eins(s, "forum"));
      if (!m) return fehlt("Mauer");
      const gut = strassen(s, "fernstrasse").filter(st => {
        const a = st.punkte[0], b = st.punkte[st.punkte.length - 1];
        const ring = geschlossen(m);
        return (zurLinie(a, ring).d < 50 && amRand(g, b, 200)) || (zurLinie(b, ring).d < 50 && amRand(g, a, 200));
      }).length;
      return gut >= 2 ? { ok: true, hinweis: `${gut} Fernstraßen bis zum Kartenrand.` } : { ok: false, hinweis: "Zeichne mindestens zwei Fernstraßen von einem Tor bis zum Kartenrand." };
    },
  },
  {
    id: "aquaedukt", text: "Ein Aquädukt bringt Wasser von höher gelegenem Gelände", warum: "Aquädukte arbeiten nur mit Gefälle: Die Quelle muss höher liegen als die Stadt.",
    pruefe: (s, g) => {
      const a = strassen(s, "aquaedukt")[0];
      if (!a) return fehlt("Aquädukt");
      const p = a.punkte[0], q = a.punkte[a.punkte.length - 1];
      const hp = hoeheBei(g, p.x, p.y), hq = hoeheBei(g, q.x, q.y);
      const [oben, unten, dh] = hp > hq ? [p, q, hp - hq] : [q, p, hq - hp];
      const m = mauerUm(s, eins(s, "forum"));
      if (m && !inPoly(unten, m) && zurLinie(unten, geschlossen(m)).d > 80) return { ok: false, hinweis: "Der Aquädukt endet nicht an der Stadt.", ort: unten };
      return dh >= 8 ? { ok: true, hinweis: `${Math.round(dh)} m Gefälle.` } : { ok: false, hinweis: `Nur ${Math.round(dh)} m Gefälle — die Quelle muss höher liegen.`, ort: oben };
    },
  },
];

// ---------------------------------------------------------------- Europäisch (Mittelalter)

const MITTELALTER: Regel[] = [
  {
    id: "markt", text: "Ein Marktplatz ist gesetzt", warum: "Der Markt ist der Grund für die Stadt: Hier tauschen Bauern und Händler Waren — mit Marktrecht vom Stadtherrn.",
    pruefe: s => (eins(s, "markt") ? { ok: true, hinweis: "Markt vorhanden." } : fehlt("Marktplatz")),
  },
  {
    id: "fernstrasse", text: "Der Markt liegt an einer Fernstraße", warum: "Ohne Durchgangsverkehr keine Händler. Märkte entstanden, wo Handelswege vorbeiführten.",
    pruefe: s => {
      const m = eins(s, "markt");
      if (!m) return fehlt("Marktplatz");
      return nahAnStrasse(s, m, ["fernstrasse", "haupt"], 60) ? { ok: true, hinweis: "Direkt an der Straße." } : { ok: false, hinweis: "Keine Fernstraße am Markt.", ort: m };
    },
  },
  {
    id: "uebergang", text: "Nah an Furt oder Brücke (unter 500 m)", warum: "Am Flussübergang müssen alle vorbei — der beste Platz für Zoll, Rast und Handel. Viele Städte heißen danach: Frankfurt, Erfurt, Schweinfurt.",
    pruefe: (s, g) => {
      const m = eins(s, "markt");
      if (!m) return fehlt("Marktplatz");
      if (!g.flussLinie.length) return { ok: true, hinweis: "Kein Fluss auf dieser Karte — eine Straßenkreuzung tut es auch." };
      const uebergaenge: P[] = g.furt ? [g.furt] : [];
      for (const st of s.strassen) for (const p of st.punkte) if (istWasser(g, p.x, p.y)) uebergaenge.push(p);
      for (const st of s.strassen) for (const t of schnitte(st.punkte, g.flussLinie)) uebergaenge.push(t);
      const d = Math.min(...uebergaenge.map(u => abstand(u, m)));
      return d < 500 ? { ok: true, hinweis: `Übergang in ${m0(d)}.` } : { ok: false, hinweis: "Weit weg von Furt und Brücke.", ort: g.furt ?? m };
    },
  },
  {
    id: "hochwasser", text: "Der Markt liegt nicht in der Aue", warum: "Hochwasser zerstört Häuser und Waren. Siedlungen lagen am Rand der Aue, leicht erhöht.",
    pruefe: (s, g) => {
      const m = eins(s, "markt");
      if (!m) return fehlt("Marktplatz");
      return inAue(g, m.x, m.y) || istWasser(g, m.x, m.y) ? { ok: false, hinweis: "Der Markt würde überschwemmt.", ort: m } : { ok: true, hinweis: "Sicher vor Hochwasser." };
    },
  },
  {
    id: "kirche", text: "Kirche und Rathaus am Markt", warum: "Kirche (geistliche Macht) und Rathaus (Bürger) stehen am wichtigsten Platz der Stadt.",
    pruefe: s => {
      const m = eins(s, "markt"), k = eins(s, "kirche"), r = eins(s, "rathaus");
      if (!m) return fehlt("Marktplatz");
      if (!k || !r) return fehlt(!k ? "Kirche" : "Rathaus");
      const dk = abstand(k, m), dr = abstand(r, m);
      return dk < 140 && dr < 110 ? { ok: true, hinweis: "Beide am Markt." } : { ok: false, hinweis: "Kirche oder Rathaus stehen zu weit vom Markt.", ort: dk >= 140 ? k : r };
    },
  },
  {
    id: "burg", text: "Die Burg steht auf einer Anhöhe", warum: "Von oben sieht man weit und lässt sich gut verteidigen. Der Burgberg war oft der Anfang der Stadt.",
    pruefe: (s, g) => {
      const b = eins(s, "burg"), m = eins(s, "markt");
      if (!b) return fehlt("Burg");
      const ref = m ? hoeheBei(g, m.x, m.y) : Math.min(...Array.from(g.hoehe));
      const dh = hoeheBei(g, b.x, b.y) - ref;
      return dh > 8 ? { ok: true, hinweis: `${Math.round(dh)} m über dem Markt.` } : { ok: false, hinweis: `Nur ${Math.round(dh)} m höher als der Markt.`, ort: b };
    },
  },
  {
    id: "mauer", text: "Die Mauer umschließt Markt, Kirche und Rathaus", warum: "Mit dem Stadtrecht kam das Recht, eine Mauer zu bauen — Schutz für Bürger und Waren.",
    pruefe: s => {
      const m = eins(s, "markt");
      if (!m) return fehlt("Marktplatz");
      const w = mauerUm(s, m);
      if (!w) return fehlt("Mauer");
      const drin = [m, eins(s, "kirche"), eins(s, "rathaus")].filter(Boolean).every(p => inPoly(p!, w));
      return drin ? { ok: true, hinweis: "Alles hinter der Mauer." } : { ok: false, hinweis: "Etwas Wichtiges liegt außerhalb der Mauer.", ort: m };
    },
  },
  {
    id: "tore", text: "Tore, wo die Fernstraßen die Mauer queren", warum: "Durch die Tore lief der Handel — dort wurde auch Zoll kassiert und nachts abgeschlossen.",
    pruefe: s => {
      const w = mauerUm(s, eins(s, "markt"));
      if (!w) return fehlt("Mauer");
      const n = toreZahl(s, w, ["fernstrasse", "haupt"]);
      return n >= 2 ? { ok: true, hinweis: `${n} Tore.` } : { ok: false, hinweis: `Erst ${n} Straße(n) führen durch die Mauer.` };
    },
  },
  {
    id: "aue", text: "Die Mauer meidet Fluss und Aue", warum: "Mauern im Sumpf sacken ab; der Fluss selbst ist schon ein Schutz.",
    pruefe: (s, g) => {
      const w = mauerUm(s, eins(s, "markt"));
      if (!w) return fehlt("Mauer");
      const ring = geschlossen(w);
      let n = 0, nass = 0;
      for (let i = 0; i + 1 < ring.length; i++) for (let t = 0; t < 1; t += 0.1) {
        const p = { x: ring[i].x + (ring[i + 1].x - ring[i].x) * t, y: ring[i].y + (ring[i + 1].y - ring[i].y) * t };
        n++;
        if (inAue(g, p.x, p.y) || istWasser(g, p.x, p.y)) nass++;
      }
      return nass / n < 0.25 ? { ok: true, hinweis: "Auf trockenem Grund." } : { ok: false, hinweis: `${Math.round((nass / n) * 100)} % der Mauer stehen in Aue oder Wasser.` };
    },
  },
  {
    id: "muehle", text: "Eine Mühle am Fluss", warum: "Wassermühlen mahlten Getreide — nur, wo Wasser fließt.",
    pruefe: (s, g) => {
      const m = eins(s, "muehle");
      if (!m) return fehlt("Mühle");
      if (!hatWasser(g)) return { ok: true, hinweis: "Kein Fluss — dann eben eine Windmühle." };
      const d = wasserAbstand(g, m.x, m.y);
      return d < 45 ? { ok: true, hinweis: "Direkt am Wasser." } : { ok: false, hinweis: `${m0(d)} vom Wasser — da dreht sich kein Mühlrad.`, ort: m };
    },
  },
  {
    id: "gassen", text: "Enge Gassen, gewachsen statt geplant", warum: "Mittelalterliche Städte wuchsen Haus für Haus. Die Gassen folgen dem Gelände und laufen auf Markt und Tore zu — kein Raster.",
    pruefe: s => {
      const w = mauerUm(s, eins(s, "markt"));
      if (!w) return fehlt("Mauer");
      const g = strassen(s, "gasse", "neben").filter(st => st.punkte.some(p => inPoly(p, w))).map(st => st.punkte);
      if (g.length < 4) return { ok: false, hinweis: `Erst ${g.length} Gassen in der Mauer.` };
      let best = 0;
      for (let a = 0; a < 90; a += 5) best = Math.max(best, anteilAusgerichtet(g, [a, a + 90], 8).anteil);
      return best < 0.75 ? { ok: true, hinweis: `${g.length} Gassen, schön unregelmäßig.` } : { ok: false, hinweis: "Das sieht nach einem Raster aus — eher römisch oder amerikanisch." };
    },
  },
];

// ---------------------------------------------------------------- Amerikanisch 1870

const EISENBAHNSTADT: Regel[] = [
  {
    id: "bahn", text: "Eine Bahnlinie quer über die Karte", warum: "Im Westen der USA gründeten Eisenbahngesellschaften die Städte entlang ihrer Strecken — alle paar Meilen eine.",
    pruefe: (s, g) => {
      const b = strassen(s, "bahn");
      const L = Math.max(0, ...b.map(x => laenge(x.punkte)));
      return L > g.breite * 0.6 ? { ok: true, hinweis: `${(L / 1000).toFixed(1)} km Strecke.` } : { ok: false, hinweis: b.length ? "Die Bahn ist zu kurz." : "Noch keine Eisenbahn." };
    },
  },
  {
    id: "depot", text: "Der Bahnhof liegt an der Bahn", warum: "Das Depot ist der Ausgangspunkt: Hier kommen Siedler, Waren und Post an.",
    pruefe: s => {
      const d = eins(s, "depot");
      if (!d) return fehlt("Bahnhof (Depot)");
      return nahAnStrasse(s, d, ["bahn"], 50) ? { ok: true, hinweis: "Direkt am Gleis." } : { ok: false, hinweis: "Der Bahnhof steht nicht an der Bahn.", ort: d };
    },
  },
  {
    id: "main", text: "Die Main Street beginnt am Bahnhof", warum: "Die Hauptstraße mit Läden, Bank und Saloon führt direkt vom Bahnhof in die Stadt.",
    pruefe: s => {
      const d = eins(s, "depot");
      if (!d) return fehlt("Bahnhof (Depot)");
      return nahAnStrasse(s, d, ["haupt"], 80) ? { ok: true, hinweis: "Main Street am Bahnhof." } : { ok: false, hinweis: "Keine Hauptstraße am Bahnhof.", ort: d };
    },
  },
  {
    id: "himmel", text: "Raster nach Himmelsrichtungen", warum: "Die Land Ordinance von 1785 teilte das Land in Quadratmeilen nach Nord–Süd und Ost–West. Die Städte übernahmen das Raster — ohne Rücksicht auf Hügel.",
    pruefe: s => {
      const l = strassen(s, "neben", "haupt").map(st => st.punkte);
      const r = anteilAusgerichtet(l, [0, 90], 6);
      if (l.length < 6) return { ok: false, hinweis: `Erst ${l.length} Straßen — tipp: das Raster-Werkzeug.` };
      return r.anteil > 0.85 ? { ok: true, hinweis: `${Math.round(r.anteil * 100)} % der Straßen nach Himmelsrichtungen.` } : { ok: false, hinweis: `Nur ${Math.round(r.anteil * 100)} % nach Himmelsrichtungen.` };
    },
  },
  {
    id: "bloecke", text: "Gleich große Blöcke", warum: "Gleiche Blöcke lassen sich einfach vermessen, nummerieren und als Parzellen verkaufen.",
    pruefe: s => {
      const xs: number[] = [];
      for (const st of strassen(s, "neben", "haupt")) {
        const a = st.punkte[0], b = st.punkte[st.punkte.length - 1];
        if (winkelAbstand(richtung(a, b), 90) < 6) xs.push((a.x + b.x) / 2);
      }
      const u = [...new Set(xs.map(x => Math.round(x / 5) * 5))].sort((a, b) => a - b);
      if (u.length < 4) return { ok: false, hinweis: "Zu wenige Nord–Süd-Straßen für ein Raster." };
      const abst = u.slice(1).map((x, i) => x - u[i]).filter(d => d > 20);
      const mw = abst.reduce((a, b) => a + b, 0) / abst.length;
      const sd = Math.sqrt(abst.reduce((a, b) => a + (b - mw) ** 2, 0) / abst.length);
      return sd / mw < 0.2 ? { ok: true, hinweis: `Blöcke etwa ${m0(mw)} breit.` } : { ok: false, hinweis: "Die Abstände der Straßen sind sehr unterschiedlich." };
    },
  },
  {
    id: "gericht", text: "Das Courthouse steht mitten im Raster", warum: "Die County Seat bekam einen eigenen Block für das Gericht: den Courthouse Square, Mittelpunkt der Stadt.",
    pruefe: s => {
      const c = eins(s, "gericht");
      if (!c) return fehlt("Courthouse");
      const r = rahmen(s);
      if (!r) return fehlt("Straßenraster");
      const mitte = { x: (r.x0 + r.x1) / 2, y: (r.y0 + r.y1) / 2 };
      const diag = Math.hypot(r.x1 - r.x0, r.y1 - r.y0);
      return imRahmen(r, c) && abstand(c, mitte) < diag * 0.3 ? { ok: true, hinweis: "Mitten im Ort." } : { ok: false, hinweis: "Das Courthouse liegt am Rand.", ort: c };
    },
  },
  {
    id: "silo", text: "Ein Getreidesilo an der Bahn", warum: "Die Farmer der Prärie bringen ihr Getreide in den Grain Elevator — von dort fährt es per Zug in die großen Städte.",
    pruefe: s => {
      const si = eins(s, "silo");
      if (!si) return fehlt("Getreidesilo");
      return nahAnStrasse(s, si, ["bahn"], 70) ? { ok: true, hinweis: "Am Gleis." } : { ok: false, hinweis: "Das Silo steht nicht an der Bahn.", ort: si };
    },
  },
  {
    id: "trocken", text: "Keine Straße endet im Wasser", warum: "Das Raster ignoriert Hügel — aber nicht Flüsse. Brücken baute man nur für wichtige Straßen.",
    pruefe: (s, g) => {
      for (const st of strassen(s, "neben")) for (const p of st.punkte) if (istWasser(g, p.x, p.y)) return { ok: false, hinweis: "Eine Nebenstraße läuft ins Wasser.", ort: p };
      return { ok: true, hinweis: "Alles auf festem Boden." };
    },
  },
];

// ---------------------------------------------------------------- Europäisch 1890 (Erweiterung)

const INDUSTRIE: Regel[] = [
  {
    id: "mauerweg", text: "Die Stadtmauer ist abgerissen", warum: "Kanonen machten Mauern nutzlos, und die Stadt brauchte Platz. Im 19. Jahrhundert fielen fast überall die Mauern.",
    pruefe: (s, _g, start) => {
      const m = eins(s, "markt") ?? (start ? eins(start, "markt") : null);
      return m && s.mauern.some(w => inPoly(m, w)) ? { ok: false, hinweis: "Die Mauer steht noch — mit 🧽 entfernen.", ort: m } : { ok: true, hinweis: "Platz für Neues." };
    },
  },
  {
    id: "ring", text: "Ein Ring auf der alten Mauerlinie", warum: "Wo die Mauer stand, war ein breiter Streifen frei: ideal für einen Boulevard mit Bäumen — wie die Ringstraße in Wien oder die Ringe in Köln.",
    pruefe: (s, _g, start) => {
      const alt = start ? mauerUm(start, eins(start, "markt")) : null;
      if (!alt) return { ok: true, hinweis: "Keine alte Mauer." };
      const ring = strassen(s, "ring");
      if (!ring.length) return fehlt("Ring");
      const r = geschlossen(alt);
      let n = 0, gut = 0;
      for (let i = 0; i + 1 < r.length; i++) for (let t = 0; t < 1; t += 0.25) {
        const p = { x: r[i].x + (r[i + 1].x - r[i].x) * t, y: r[i].y + (r[i + 1].y - r[i].y) * t };
        n++;
        if (ring.some(st => zurLinie(p, st.punkte).d < 55)) gut++;
      }
      return gut / n > 0.7 ? { ok: true, hinweis: `Der Ring folgt ${Math.round((gut / n) * 100)} % der alten Mauer.` } : { ok: false, hinweis: `Der Ring folgt nur ${Math.round((gut / n) * 100)} % der alten Mauer.` };
    },
  },
  {
    id: "bahn", text: "Eine Eisenbahn quer über die Karte", warum: "Die Bahn brachte Kohle, Rohstoffe und Arbeiter — ohne sie keine Industrie.",
    pruefe: (s, g) => {
      const L = Math.max(0, ...strassen(s, "bahn").map(x => laenge(x.punkte)));
      return L > g.breite * 0.5 ? { ok: true, hinweis: `${(L / 1000).toFixed(1)} km Strecke.` } : fehlt("Eisenbahn quer über die Karte");
    },
  },
  {
    id: "altstadt", text: "Die Bahn meidet die Altstadt", warum: "In der dichten Altstadt war kein Platz. Gleise hätten Hunderte Häuser gekostet.",
    pruefe: (s, _g, start) => {
      const alt = start ? mauerUm(start, eins(start, "markt")) : null;
      if (!alt) return { ok: true, hinweis: "Keine Altstadt." };
      for (const st of strassen(s, "bahn")) for (let i = 0; i + 1 < st.punkte.length; i++) for (let t = 0; t <= 1; t += 0.1) {
        const p = { x: st.punkte[i].x + (st.punkte[i + 1].x - st.punkte[i].x) * t, y: st.punkte[i].y + (st.punkte[i + 1].y - st.punkte[i].y) * t };
        if (inPoly(p, alt)) return { ok: false, hinweis: "Die Bahn fährt durch die Altstadt.", ort: p };
      }
      return { ok: true, hinweis: "Die Gleise laufen außen herum." };
    },
  },
  {
    id: "bahnhof", text: "Der Bahnhof liegt vor der Altstadt an der Bahn", warum: "Bahnhöfe entstanden am Rand der damaligen Stadt — heute liegen sie oft mittendrin.",
    pruefe: (s, _g, start) => {
      const b = eins(s, "bahnhof");
      if (!b) return fehlt("Bahnhof");
      const alt = start ? mauerUm(start, eins(start, "markt")) : null;
      if (!nahAnStrasse(s, b, ["bahn"], 50)) return { ok: false, hinweis: "Der Bahnhof steht nicht an der Bahn.", ort: b };
      if (alt && inPoly(b, alt)) return { ok: false, hinweis: "Der Bahnhof steht in der Altstadt.", ort: b };
      const m = eins(s, "markt");
      return !m || abstand(b, m) < 1200 ? { ok: true, hinweis: "Vor der Altstadt, gut erreichbar." } : { ok: false, hinweis: "Der Bahnhof ist sehr weit weg vom Zentrum.", ort: b };
    },
  },
  {
    id: "bahnhofstrasse", text: "Eine Bahnhofstraße führt in die Altstadt", warum: "Die Bahnhofstraße wurde zur feinen Geschäftsstraße mit Hotels und Kaufhäusern.",
    pruefe: (s, _g, start) => {
      const b = eins(s, "bahnhof");
      if (!b) return fehlt("Bahnhof");
      const alt = start ? mauerUm(start, eins(start, "markt")) : null;
      const ok = strassen(s, "haupt").some(st => zurLinie(b, st.punkte).d < 70 && (!alt || st.punkte.some(p => zurLinie(p, geschlossen(alt)).d < 70 || inPoly(p, alt))));
      return ok ? { ok: true, hinweis: "Bahnhofstraße vorhanden." } : { ok: false, hinweis: "Keine Hauptstraße vom Bahnhof zur Altstadt.", ort: b };
    },
  },
  {
    id: "fabriken", text: "Fabriken an Bahn oder Fluss", warum: "Fabriken brauchten Kohle per Bahn oder Schiff und Wasser zum Kühlen.",
    pruefe: (s, g) => {
      const f = alle(s, "fabrik");
      if (f.length < 2) return { ok: false, hinweis: `Erst ${f.length} Fabrik(en) — setze mindestens zwei.` };
      const weit = f.find(b => !nahAnStrasse(s, b, ["bahn"], 130) && wasserAbstand(g, b.x, b.y) > 90);
      return weit ? { ok: false, hinweis: "Eine Fabrik hat weder Gleis noch Wasser.", ort: weit } : { ok: true, hinweis: `${f.length} Fabriken mit Anschluss.` };
    },
  },
  {
    id: "mietshaus", text: "Mietskasernen in der Nähe der Fabriken", warum: "Arbeiter gingen zu Fuß zur Arbeit. Um die Fabriken wuchsen dichte Arbeiterviertel.",
    pruefe: s => {
      const m = alle(s, "mietshaus"), f = alle(s, "fabrik");
      if (!m.length) return fehlt("Mietskaserne");
      return m.some(x => f.some(y => abstand(x, y) < 700)) ? { ok: true, hinweis: "Kurze Wege zur Fabrik." } : { ok: false, hinweis: "Die Mietskasernen liegen weit weg von den Fabriken.", ort: m[0] };
    },
  },
  {
    id: "gruenderzeit", text: "Neue Straßen vor der Altstadt (Gründerzeit)", warum: "Die Stadt wuchs in wenigen Jahrzehnten auf ein Vielfaches — mit geraden, breiten Straßen nach Plan.",
    pruefe: (s, _g, start) => {
      const alt = start ? mauerUm(start, eins(start, "markt")) : null;
      // Kopien sind neue Objekte — nach Lage vergleichen
      const alteLinien = new Set((start?.strassen ?? []).map(st => JSON.stringify(st.punkte)));
      const wirklichNeu = s.strassen.filter(st => (st.art === "neben" || st.art === "haupt") && !alteLinien.has(JSON.stringify(st.punkte)) && (!alt || st.punkte.some(p => !inPoly(p, alt))));
      return wirklichNeu.length >= 4 ? { ok: true, hinweis: `${wirklichNeu.length} neue Straßen.` } : { ok: false, hinweis: `Erst ${wirklichNeu.length} neue Straßen — tipp: das Raster-Werkzeug.` };
    },
  },
];

// ---------------------------------------------------------------- Amerikanisch 1960 (Erweiterung)

const AUTOSTADT: Regel[] = [
  {
    id: "interstate", text: "Eine Interstate quer über die Karte", warum: "Ab 1956 baute die Regierung ein Netz von Autobahnen (Interstate Highways) — auch mitten durch die Städte.",
    pruefe: (s, g) => {
      const L = Math.max(0, ...strassen(s, "autobahn").map(x => laenge(x.punkte)));
      return L > g.breite * 0.5 ? { ok: true, hinweis: `${(L / 1000).toFixed(1)} km Highway.` } : fehlt("Interstate quer über die Karte");
    },
  },
  {
    id: "zentrum", text: "Die Interstate führt nah am CBD vorbei", warum: "Pendler sollten schnell ins Zentrum kommen. Dafür wurden ganze Viertel abgerissen — meist die der Armen.",
    pruefe: s => {
      const cbd = s.zonen.find(z => z.typ === "cbd");
      if (!cbd) return { ok: true, hinweis: "Kein CBD." };
      const c = schwerpunkt(cbd.poly);
      const d = Math.min(Infinity, ...strassen(s, "autobahn").map(st => zurLinie(c, st.punkte).d));
      return d < 500 ? { ok: true, hinweis: `${m0(d)} vom CBD.` } : { ok: false, hinweis: "Die Interstate ist weit weg vom Zentrum.", ort: c };
    },
  },
  {
    id: "suburb", text: "Ein Vorort mit geschwungenen Straßen außerhalb des Rasters", warum: "Suburbs wurden bewusst anders geplant: kurvige Straßen, wenig Durchgangsverkehr, große Grundstücke.",
    pruefe: (s, _g, start) => {
      const r = rahmen(start);
      const draussen = strassen(s, "neben").filter(st => st.punkte.every(p => !imRahmen(r, p, -20))).map(st => st.punkte);
      const a = anteilAusgerichtet(draussen, [0, 90], 8);
      if (a.laenge < 500) return { ok: false, hinweis: `Erst ${m0(a.laenge)} neue Straßen außerhalb des Rasters.` };
      return a.anteil < 0.6 ? { ok: true, hinweis: `${m0(a.laenge)} geschwungene Straßen.` } : { ok: false, hinweis: "Die neuen Straßen sind fast so gerade wie das Raster." };
    },
  },
  {
    id: "sackgasse", text: "Sackgassen (Cul-de-sacs)", warum: "Am Ende einer Sackgasse spielen Kinder auf der Straße — kein Auto fährt durch.",
    pruefe: (s, _g, start) => {
      const r = rahmen(start);
      const neu = strassen(s, "neben").filter(st => st.punkte.every(p => !imRahmen(r, p, -20)));
      let n = 0;
      for (const st of neu) for (const e of [st.punkte[0], st.punkte[st.punkte.length - 1]]) {
        if (!s.strassen.some(o => o !== st && zurLinie(e, o.punkte).d < 12)) n++;
      }
      return n >= 3 ? { ok: true, hinweis: `${n} Sackgassen.` } : { ok: false, hinweis: `Erst ${n} Sackgassen — lass Straßen einfach enden.` };
    },
  },
  {
    id: "mall", text: "Eine Mall an der Interstate, draußen vor der Stadt", warum: "Wer mit dem Auto kommt, braucht Parkplätze und eine Ausfahrt — das gab es nur am Stadtrand.",
    pruefe: (s, _g, start) => {
      const m = eins(s, "einkauf");
      if (!m) return fehlt("Mall");
      if (imRahmen(rahmen(start), m)) return { ok: false, hinweis: "Die Mall steht mitten im alten Raster.", ort: m };
      return nahAnStrasse(s, m, ["autobahn"], 300) ? { ok: true, hinweis: "An der Ausfahrt." } : { ok: false, hinweis: "Die Mall ist weit weg vom Highway.", ort: m };
    },
  },
  {
    id: "schule", text: "Eine Schule im Vorort", warum: "Junge Familien zogen hinaus — die Schulen folgten ihnen.",
    pruefe: (s, _g, start) => {
      const r = rahmen(start);
      const sch = alle(s, "schule").filter(b => !imRahmen(r, b));
      return sch.length ? { ok: true, hinweis: "Schule im Vorort." } : fehlt("Schule außerhalb des Rasters");
    },
  },
  {
    id: "hochhaus", text: "Ein neues Hochhaus im CBD", warum: "Im Zentrum ist der Boden am teuersten — also baut man in die Höhe.",
    pruefe: (s, _g, start) => {
      const vorher = (start?.bauten ?? []).filter(b => b.typ === "hochhaus").length;
      const h = alle(s, "hochhaus").filter(b => zoneBei(s, b) === "cbd");
      return h.length > vorher ? { ok: true, hinweis: `${h.length} Hochhäuser im CBD.` } : { ok: false, hinweis: "Setze ein weiteres Hochhaus in den CBD." };
    },
  },
];

// ---------------------------------------------------------------- Residenzstadt

/** Straßen, deren Verlängerung genau auf p zielt und deren eines Ende nahe p liegt */
function strahlenAuf(s: Stadt, p: P): { winkel: number; laenge: number }[] {
  const aus: { winkel: number; laenge: number }[] = [];
  for (const st of strassen(s, "haupt", "neben", "gasse", "fernstrasse")) {
    const a = st.punkte[0], b = st.punkte[st.punkte.length - 1];
    const [nah, fern] = abstand(a, p) < abstand(b, p) ? [a, b] : [b, a];
    if (abstand(nah, p) > 260 || abstand(fern, p) < 150) continue;
    // Abstand der Geraden durch nah→fern vom Punkt p
    const dx = fern.x - nah.x, dy = fern.y - nah.y, l = Math.hypot(dx, dy);
    const d = Math.abs((p.x - nah.x) * dy - (p.y - nah.y) * dx) / l;
    if (d < 35) aus.push({ winkel: Math.atan2(fern.y - p.y, fern.x - p.x), laenge: l });
  }
  // zerschnittene Strahlen (Bauwerk dazwischen) nur einmal zählen
  return aus.filter((x, i) => !aus.some((y, j) => j < i && Math.abs(Math.atan2(Math.sin(x.winkel - y.winkel), Math.cos(x.winkel - y.winkel))) < 0.03));
}

/** Länge der Achse in Richtung w: weitester Punkt einer Hauptstraße nahe der Geraden ab p */
function achsenLaenge(s: Stadt, p: P, w: number): number {
  let l = 0;
  const ux = Math.cos(w), uy = Math.sin(w);
  for (const st of strassen(s, "haupt", "ring")) for (const q of st.punkte) {
    const t = (q.x - p.x) * ux + (q.y - p.y) * uy;
    const d = Math.abs(-(q.x - p.x) * uy + (q.y - p.y) * ux);
    if (t > 0 && d < 35) l = Math.max(l, t);
  }
  return l;
}

const RESIDENZ: Regel[] = [
  {
    id: "schloss", text: "Ein Schloss ist gesetzt", warum: "Das Schloss des Fürsten ist der Ausgangspunkt der ganzen Planung.",
    pruefe: s => (eins(s, "schloss") ? { ok: true, hinweis: "Schloss vorhanden." } : fehlt("Schloss")),
  },
  {
    id: "eben", text: "Das Schloss steht auf ebenem, trockenem Grund", warum: "Für Achsen, Gärten und einen regelmäßigen Grundriss braucht es weites, flaches Land — Residenzen entstanden oft »auf der grünen Wiese«.",
    pruefe: (s, g) => {
      const b = eins(s, "schloss");
      if (!b) return fehlt("Schloss");
      const n = neigungBei(g, b.x, b.y);
      if (inAue(g, b.x, b.y) || istWasser(g, b.x, b.y)) return { ok: false, hinweis: "Das Schloss steht in der Aue.", ort: b };
      return n < 6 ? { ok: true, hinweis: `${n.toFixed(1)} % Neigung.` } : { ok: false, hinweis: `${n.toFixed(1)} % Neigung — zu steil für einen Barockgarten.`, ort: b };
    },
  },
  {
    id: "strahlen", text: "Mindestens fünf Straßen laufen strahlenförmig aufs Schloss zu", warum: "Alle Wege führen zum Herrscher: Der Grundriss macht die absolute Macht sichtbar (Karlsruhe: 32 Strahlen).",
    pruefe: s => {
      const b = eins(s, "schloss");
      if (!b) return fehlt("Schloss");
      const n = strahlenAuf(s, b).length;
      return n >= 5 ? { ok: true, hinweis: `${n} Straßen zielen aufs Schloss.` } : { ok: false, hinweis: `Erst ${n} Straßen zielen genau aufs Schloss.`, ort: b };
    },
  },
  {
    id: "achse", text: "Eine lange Hauptachse vom Schloss (über 700 m)", warum: "Die Mittelachse ist die Bühne für Auftritte des Fürsten — Paraden, Einzüge, Feste.",
    pruefe: s => {
      const b = eins(s, "schloss");
      if (!b) return fehlt("Schloss");
      const l = Math.max(0, ...strahlenAuf({ ...s, strassen: strassen(s, "haupt") }, b).map(x => achsenLaenge(s, b, x.winkel)));
      return l > 700 ? { ok: true, hinweis: `Hauptachse ${m0(l)}.` } : { ok: false, hinweis: l ? `Die Hauptachse ist nur ${m0(l)} lang.` : "Keine Hauptstraße zielt aufs Schloss.", ort: b };
    },
  },
  {
    id: "symmetrie", text: "Die Strahlen liegen symmetrisch zur Achse", warum: "Symmetrie ist das Ordnungsprinzip des Barock: links wie rechts.",
    pruefe: s => {
      const b = eins(s, "schloss");
      if (!b) return fehlt("Schloss");
      const st = strahlenAuf(s, b);
      const h = strahlenAuf({ ...s, strassen: strassen(s, "haupt") }, b).sort((x, y) => y.laenge - x.laenge)[0];
      if (!h || st.length < 3) return { ok: false, hinweis: "Erst Hauptachse und Strahlen zeichnen." };
      let links = 0, rechts = 0;
      for (const x of st) {
        const d = Math.atan2(Math.sin(x.winkel - h.winkel), Math.cos(x.winkel - h.winkel));
        if (Math.abs(d) < 0.05 || Math.abs(d) > Math.PI - 0.05) continue;
        if (d > 0) links++; else rechts++;
      }
      return Math.abs(links - rechts) <= 2 && links > 0 ? { ok: true, hinweis: `${links} links, ${rechts} rechts.` } : { ok: false, hinweis: `${links} Strahlen links, ${rechts} rechts der Achse.` };
    },
  },
  {
    id: "garten", text: "Ein Schlossgarten liegt am Schloss", warum: "Der Barockgarten setzt die Ordnung in der Natur fort — geometrische Beete, Alleen, Sichtachsen.",
    pruefe: s => {
      const b = eins(s, "schloss");
      if (!b) return fehlt("Schloss");
      const z = s.zonen.find(x => (x.typ === "schlossgarten" || x.typ === "park") && x.poly.some(q => abstand(q, b) < 450));
      return z ? { ok: true, hinweis: "Garten vorhanden." } : { ok: false, hinweis: "Male mit 🎨 ein Viertel »Schlossgarten« ans Schloss.", ort: b };
    },
  },
  {
    id: "markt", text: "Markt und Kirche liegen auf oder an der Hauptachse", warum: "Auch Bürger und Kirche ordnen sich der Achse des Fürsten unter.",
    pruefe: s => {
      const b = eins(s, "schloss"), m = eins(s, "markt"), k = alle(s, "kirche");
      if (!b) return fehlt("Schloss");
      if (!m) return fehlt("Marktplatz");
      // Achse = der Strahl einer Hauptstraße, der am weitesten reicht
      const h = strahlenAuf({ ...s, strassen: strassen(s, "haupt") }, b).sort((x, y) => achsenLaenge(s, b, y.winkel) - achsenLaenge(s, b, x.winkel))[0];
      if (!h) return { ok: false, hinweis: "Keine Hauptachse." };
      const achse = [b, { x: b.x + Math.cos(h.winkel) * 5000, y: b.y + Math.sin(h.winkel) * 5000 }];
      const ok = zurLinie(m, achse).d < 70 && k.some(x => zurLinie(x, achse).d < 140);
      return ok ? { ok: true, hinweis: "Auf der Achse." } : { ok: false, hinweis: "Markt oder Kirche liegen abseits der Achse.", ort: m };
    },
  },
];

// ---------------------------------------------------------------- Festungsstadt

/** Spitzen eines Walls: Ecken, die deutlich weiter außen liegen als ihre Nachbarn */
function spitzen(m: P[]): number {
  const c = schwerpunkt(m);
  const r = m.map(p => abstand(p, c));
  let n = 0;
  for (let i = 0; i < m.length; i++) {
    const a = r[(i - 1 + m.length) % m.length], b = r[(i + 1) % m.length];
    if (r[i] > a * 1.06 && r[i] > b * 1.06) n++;
  }
  return n;
}

const FESTUNG: Regel[] = [
  {
    id: "bastionen", text: "Der Wall hat mindestens vier Bastionen (Spitzen)", warum: "Aus den Bastionen beschießen Verteidiger die Flanken der Nachbarn — es gibt keinen toten Winkel, an dem sich Angreifer verstecken können.",
    pruefe: s => {
      const m = mauerUm(s, eins(s, "paradeplatz"));
      if (!m) return fehlt("Wall");
      const n = spitzen(m);
      return n >= 4 ? { ok: true, hinweis: `${n} Bastionen.` } : { ok: false, hinweis: `Erst ${n} Spitzen — zeichne den Wall sternförmig.`, ort: schwerpunkt(m) };
    },
  },
  {
    id: "platz", text: "Der Paradeplatz liegt in der Mitte", warum: "Von der Mitte aus erreicht die Garnison alle Bastionen gleich schnell.",
    pruefe: s => {
      const p = eins(s, "paradeplatz"), m = mauerUm(s, p);
      if (!p) return fehlt("Paradeplatz");
      if (!m) return fehlt("Wall");
      const d = abstand(p, schwerpunkt(m));
      return d < 90 ? { ok: true, hinweis: "Genau in der Mitte." } : { ok: false, hinweis: `${m0(d)} neben der Mitte.`, ort: p };
    },
  },
  {
    id: "tore", text: "Vier Straßen führen durch Tore hinaus", warum: "Wenige Tore sind leichter zu verteidigen — aber Handel und Truppen müssen hinein und hinaus.",
    pruefe: s => {
      const m = mauerUm(s, eins(s, "paradeplatz"));
      if (!m) return fehlt("Wall");
      const n = toreZahl(s, m, ["haupt", "fernstrasse"]);
      return n >= 4 && n <= 6 ? { ok: true, hinweis: `${n} Tore.` } : { ok: false, hinweis: n < 4 ? `Erst ${n} Tore.` : `${n} Tore — zu viele Schwachstellen.` };
    },
  },
  {
    id: "raster", text: "Innen ein regelmäßiges Raster", warum: "Gerade Straßen erlauben schnelle Truppenbewegungen zu jeder Bastion.",
    pruefe: s => {
      const m = mauerUm(s, eins(s, "paradeplatz"));
      if (!m) return fehlt("Wall");
      const l = strassen(s, "neben", "haupt").filter(st => st.punkte.some(p => inPoly(p, m))).map(st => st.punkte);
      if (l.length < 4) return { ok: false, hinweis: `Erst ${l.length} Straßen im Wall.` };
      let best = 0;
      for (let a = 0; a < 90; a += 5) best = Math.max(best, anteilAusgerichtet(l, [a, a + 90], 8).anteil);
      return best > 0.8 ? { ok: true, hinweis: "Regelmäßiges Raster." } : { ok: false, hinweis: "Die Straßen laufen kreuz und quer." };
    },
  },
  {
    id: "glacis", text: "Vor dem Wall bleibt ein freies Glacis (150 m)", warum: "Kein Haus, kein Baum: Angreifer finden auf dem Glacis keine Deckung.",
    pruefe: s => {
      const m = mauerUm(s, eins(s, "paradeplatz"));
      if (!m) return fehlt("Wall");
      const ring = geschlossen(m);
      const imWeg = s.bauten.find(b => !inPoly(b, m) && b.typ !== "tor" && b.typ !== "zitadelle" && zurLinie(b, ring).d < 150);
      if (imWeg) return { ok: false, hinweis: `${BAUTEN[imWeg.typ].label} steht auf dem Glacis.`, ort: imWeg };
      for (const st of strassen(s, "neben", "gasse")) for (const p of st.punkte) if (!inPoly(p, m) && zurLinie(p, ring).d < 150) return { ok: false, hinweis: "Eine Wohnstraße liegt auf dem Glacis.", ort: p };
      return { ok: true, hinweis: "Freies Schussfeld." };
    },
  },
  {
    id: "graben", text: "Ein Graben umgibt den Wall", warum: "Der Graben hält Angreifer und Belagerungstürme vom Wall fern.",
    pruefe: s => {
      const m = mauerUm(s, eins(s, "paradeplatz"));
      const gr = s.zonen.find(z => z.typ === "graben");
      if (!gr) return { ok: false, hinweis: "Male mit 🎨 ein Viertel »Festungsgraben« um den Wall." };
      return m && m.every(p => inPoly(p, skaliereUm(gr.poly, 1.02))) ? { ok: true, hinweis: "Graben rundum." } : { ok: false, hinweis: "Der Graben umschließt den Wall nicht ganz." };
    },
  },
  {
    id: "kaserne", text: "Kasernen stehen innen nahe am Wall", warum: "Die Soldaten müssen im Alarmfall schnell auf den Wällen sein.",
    pruefe: s => {
      const m = mauerUm(s, eins(s, "paradeplatz"));
      if (!m) return fehlt("Wall");
      const k = alle(s, "kaserne");
      if (!k.length) return fehlt("Kaserne");
      const gut = k.filter(b => inPoly(b, m) && zurLinie(b, geschlossen(m)).d < 120).length;
      return gut ? { ok: true, hinweis: `${gut} Kaserne(n) am Wall.` } : { ok: false, hinweis: "Die Kasernen liegen nicht innen am Wall.", ort: k[0] };
    },
  },
];

const skaliereUm = (poly: P[], f: number) => { const c = schwerpunkt(poly); return poly.map(p => ({ x: c.x + (p.x - c.x) * f, y: c.y + (p.y - c.y) * f })); };

export const AUFTRAEGE: Auftrag[] = [
  {
    id: "kolonie", stil: "roemisch", icon: "🏛️", titel: "Gründe eine römische Kolonie",
    auftrag: "Du bist Vermesser (Agrimensor) im Jahr 15 v. Chr. Suche einen guten Platz, zieh eine Mauer, lege Cardo und Decumanus an, setze Forum, Tempel, Thermen, Amphitheater, Gräber und führe Fernstraßen und einen Aquädukt heran.",
    start: null,
    werkzeuge: ["rechteckmauer", "mauer", "haupt", "raster", "neben", "fernstrasse", "aquaedukt"],
    bauten: ["forum", "tempel", "thermen", "theater", "amphitheater", "nekropole", "castellum", "hafen", "villa"],
    regeln: ROEMISCH,
  },
  {
    id: "marktstadt", stil: "europaeisch", icon: "⛪", titel: "Gründe eine mittelalterliche Marktstadt",
    auftrag: "Um 1200: Ein Graf will eine Stadt gründen. Finde den richtigen Ort am Fluss, setze Markt, Kirche, Rathaus und Burg, zieh eine Mauer mit Toren und lass Gassen wachsen.",
    start: null,
    werkzeuge: ["mauer", "fernstrasse", "haupt", "gasse"],
    bauten: ["markt", "kirche", "rathaus", "burg", "muehle", "kloster", "friedhof", "spital"],
    regeln: MITTELALTER,
  },
  {
    id: "eisenbahnstadt", stil: "amerikanisch", icon: "🚂", titel: "Plane eine Eisenbahnstadt im Westen der USA",
    auftrag: "1870: Die Eisenbahngesellschaft schickt dich los. Lege die Bahn, setze das Depot, zeichne Main Street und ein Straßenraster und stelle Courthouse, Silo und Kirche auf.",
    start: null,
    werkzeuge: ["bahn", "haupt", "raster", "neben"],
    bauten: ["depot", "silo", "gericht", "kirche", "schule"],
    regeln: EISENBAHNSTADT,
  },
  {
    id: "industrie", stil: "europaeisch", icon: "🏭", titel: "Bring die Altstadt ins Industriezeitalter",
    auftrag: "1860: Die Mauer ist zu eng, die Eisenbahn kommt. Reiß die Mauer ab, lege einen Ring an, bau Bahn und Bahnhof, Fabriken und Mietskasernen — und neue Straßen für die wachsende Stadt.",
    start: { epoche: 2 },
    werkzeuge: ["ring", "bahn", "haupt", "neben", "raster"],
    bauten: ["bahnhof", "fabrik", "mietshaus", "schule"],
    regeln: INDUSTRIE,
  },
  {
    id: "autostadt", stil: "amerikanisch", icon: "🚗", titel: "Mach aus der Straßenbahnstadt eine Autostadt",
    auftrag: "1955: Alle wollen ein Auto und ein Haus mit Garten. Bau eine Interstate, plane einen Vorort mit geschwungenen Straßen und Sackgassen, eine Schule, eine Mall an der Ausfahrt und ein Hochhaus im CBD.",
    start: { epoche: 1 },
    werkzeuge: ["autobahn", "haupt", "neben"],
    bauten: ["einkauf", "schule", "hochhaus", "buero"],
    regeln: AUTOSTADT,
  },
  {
    id: "residenz", stil: "residenz", icon: "👑", titel: "Plane eine Residenzstadt",
    auftrag: "1715: Der Fürst will eine neue Hauptstadt. Setze das Schloss auf ebenes Land, lass Straßen strahlenförmig darauf zulaufen, zieh eine lange Hauptachse, male einen Schlossgarten und lege Markt und Kirche auf die Achse.",
    start: null,
    werkzeuge: ["haupt", "neben", "gasse", "zone", "raster"],
    bauten: ["schloss", "markt", "kirche", "rathaus", "theater", "kaserne"],
    regeln: RESIDENZ,
  },
  {
    id: "festung", stil: "festung", icon: "⭐", titel: "Baue eine Festungsstadt",
    auftrag: "1690: Die Grenze muss gesichert werden. Zieh einen sternförmigen Wall mit Bastionen, setze den Paradeplatz in die Mitte, lege ein Raster und vier Tore an, male Graben und halte das Glacis frei. Kasernen gehören an den Wall.",
    start: null,
    werkzeuge: ["mauer", "haupt", "raster", "neben", "fernstrasse", "zone"],
    bauten: ["paradeplatz", "kirche", "kaserne", "zitadelle", "markt"],
    regeln: FESTUNG,
  },
];

/** Regelsätze zum freien Prüfen im Sandkasten */
export const REGELSAETZE: { id: string; label: string; regeln: Regel[] }[] = [
  { id: "roemisch", label: "Römische Kolonie", regeln: ROEMISCH },
  { id: "mittelalter", label: "Mittelalterliche Marktstadt", regeln: MITTELALTER },
  { id: "eisenbahn", label: "Eisenbahnstadt (USA)", regeln: EISENBAHNSTADT },
  { id: "residenz", label: "Residenzstadt", regeln: RESIDENZ },
  { id: "festung", label: "Festungsstadt", regeln: FESTUNG },
];

export function pruefe(regeln: Regel[], s: Stadt, g: Gelaende, start: Stadt | null) {
  return regeln.map(r => {
    let e: Pruefung;
    try { e = r.pruefe(s, g, start); } catch { e = { ok: false, hinweis: "Konnte nicht geprüft werden." }; }
    return { ...r, ...e };
  });
}

export function sterne(ergebnisse: { ok: boolean }[]): number {
  const q = ergebnisse.filter(e => e.ok).length / (ergebnisse.length || 1);
  return q >= 0.95 ? 3 : q >= 0.75 ? 2 : q >= 0.5 ? 1 : 0;
}
